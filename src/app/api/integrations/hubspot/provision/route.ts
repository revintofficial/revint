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
  hasProvisionScope,
  PROVISION_REQUIRED_SCOPE,
  REVINT_PROPERTY_NAMES,
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

    // Scope guard — provisioning custom properties needs
    // `crm.schemas.contacts.write`. A token granted by the wrong / older
    // app silently 403s every property create, which previously got
    // stamped as a false success. Refuse early with a clear reconnect
    // instruction instead.
    const conn = await prisma.crmConnection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
      select: { scopes: true, status: true },
    });
    if (!conn || conn.status === "REVOKED") {
      throw new HubspotNotConnectedError();
    }
    if (!hasProvisionScope(conn.scopes)) {
      await prisma.crmConnection.updateMany({
        where: { workspaceId, provider: "HUBSPOT" },
        data: { lastError: `missing_scope:${PROVISION_REQUIRED_SCOPE}` },
      });
      logger.warn("api.hubspot.provision.missing_scope", {
        workspaceId,
        required: PROVISION_REQUIRED_SCOPE,
      });
      return NextResponse.json(
        {
          error: "missing_scope",
          scope: PROVISION_REQUIRED_SCOPE,
          message:
            "HubSpot bağlantısı şema yazma izni taşımıyor. Doğru Revint app'i ile yeniden bağlanın.",
        },
        { status: 409 },
      );
    }

    const client = await getHubspotClient(prisma, workspaceId);
    const provisioned = await ensureRevintProperties(client);
    const hadErrors = provisioned.errors.length > 0;

    // Only stamp `propertiesProvisionedAt` when nothing failed. A partial
    // provision leaves the prior timestamp untouched and records the
    // failing property names so the settings UI can prompt a re-run.
    await prisma.crmConnection.updateMany({
      where: { workspaceId, provider: "HUBSPOT" },
      data: {
        ...(hadErrors ? {} : { propertiesProvisionedAt: new Date() }),
        lastError: hadErrors
          ? `property_provision_failed:${provisioned.errors.join(",")}`
          : null,
      },
    });

    logger.info("api.hubspot.provision.ok", {
      workspaceId,
      created: provisioned.created.length,
      skipped: provisioned.skipped.length,
      errors: provisioned.errors.length,
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
        total: REVINT_PROPERTY_NAMES.length,
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
