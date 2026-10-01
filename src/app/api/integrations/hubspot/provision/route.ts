/**
 * POST /api/integrations/hubspot/provision
 *
 * Idempotently (re)creates the canonical `revint_*` custom properties +
 * the "Revint" property group in the connected portal and stamps
 * `propertiesProvisionedAt`. The Revint App Card itself ships with the
 * HubSpot app and is installed when the customer grants OAuth, so once a
 * connection exists the card is present in their records — this route only
 * has to guarantee the backing properties exist.
 *
 * The OAuth callback already runs this best-effort on connect; this route
 * is the explicit, user-triggerable path so the onboarding wizard can
 * (re)provision and report exactly what landed in the portal ("card +
 * properties added") without sending the user off to the settings page.
 *
 * Admin-only, paid-plan gated (mirrors connect/sync).
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireWorkspaceAdminApi,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth";
import {
  getHubspotClient,
  HubspotNotConnectedError,
} from "@/lib/integrations/hubspot/client";
import {
  ensureRevintProperties,
  missingScopeErrorCode,
  missingWritebackScopes,
  provisionErrorCode,
  REVINT_PROPERTY_NAMES,
  REVINT_PROPERTY_OBJECT_TYPES,
} from "@/lib/integrations/hubspot/properties";
import { planMeetsMinimum } from "@/lib/agent-workers/registry";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireWorkspaceAdminApi();
    const { workspaceId } = session;

    if (!planMeetsMinimum(session.workspace.plan, "PRO")) {
      return NextResponse.json(
        {
          error: "plan_too_low",
          required: "PRO",
          message: "HubSpot integration requires a Solo (PRO) plan or higher.",
        },
        { status: 402 },
      );
    }

    // Scope guard — provisioning + writeback need the schema/object
    // write scopes on contacts AND companies. A token granted by the
    // wrong / older app 403s every property create, which previously got
    // stamped as a false success. Refuse early with a clear reconnect
    // instruction instead.
    const conn = await prisma.crmConnection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
      select: { scopes: true, status: true },
    });
    if (!conn || conn.status === "REVOKED") {
      throw new HubspotNotConnectedError();
    }
    const missing = missingWritebackScopes(conn.scopes);
    if (missing.length > 0) {
      await prisma.crmConnection.updateMany({
        where: { workspaceId, provider: "HUBSPOT" },
        data: { lastError: missingScopeErrorCode(missing) },
      });
      logger.warn("api.hubspot.provision.missing_scope", { workspaceId, missing });
      return NextResponse.json(
        {
          error: "missing_scope",
          scope: missing[0],
          missingScopes: missing,
          message:
            "HubSpot bağlantısı gerekli yazma izinlerini taşımıyor (" +
            missing.join(", ") +
            "). revint-app ile yeniden bağlanın.",
        },
        { status: 409 },
      );
    }

    const client = await getHubspotClient(prisma, workspaceId);
    const provisioned = await ensureRevintProperties(client);
    const hadErrors = !provisioned.ok;

    // Only stamp `propertiesProvisionedAt` when nothing failed. A partial
    // provision leaves the prior timestamp untouched and records the
    // failure (with the HubSpot status/message) so the settings UI can
    // prompt a fix.
    await prisma.crmConnection.updateMany({
      where: { workspaceId, provider: "HUBSPOT" },
      data: {
        ...(hadErrors ? {} : { propertiesProvisionedAt: new Date() }),
        lastError: provisionErrorCode(provisioned),
      },
    });

    logger.info("api.hubspot.provision.done", {
      workspaceId,
      ok: provisioned.ok,
      created: provisioned.created.length,
      skipped: provisioned.skipped.length,
      errors: provisioned.errors.length,
      missingScope: provisioned.missingScope,
    });

    return NextResponse.json({
      ok: !hadErrors,
      // The App Card is installed with the OAuth grant — once a live
      // connection exists it's already on the customer's records.
      cardInstalled: true,
      properties: {
        created: provisioned.created.length,
        existing: provisioned.skipped.length,
        failed: provisioned.errors.length,
        failedNames: provisioned.errors,
        failures: provisioned.errorDetails.slice(0, 5),
        missingScope: provisioned.missingScope,
        total: REVINT_PROPERTY_NAMES.length * REVINT_PROPERTY_OBJECT_TYPES.length,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof HubspotNotConnectedError) {
      return NextResponse.json(
        { error: "hubspot_not_connected" },
        { status: 409 },
      );
    }
    return internalError("api.hubspot.provision_error", err);
  }
}
