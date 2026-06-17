/**
 * FineDine v1 update — HubSpot OAuth callback.
 *
 * Validates the CSRF nonce, exchanges the code for tokens, resolves the
 * portal id, upserts the `CrmConnection` (tokens encrypted at rest), and
 * provisions the `leadac_*` custom properties + a best-effort default
 * pipeline→playbook stage mapping. Redirects back to the Integrations
 * settings page with a status flag.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { requireWorkspaceAdminApi, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import {
  exchangeHubspotCode,
  getHubspotTokenInfo,
} from "@/lib/integrations/hubspot/oauth";
import { encryptSecret } from "@/lib/integrations/crypto";
import { HubspotClient } from "@/lib/integrations/hubspot/client";
import { ensureRevintProperties } from "@/lib/integrations/hubspot/properties";
import { buildDefaultStageMapping } from "@/lib/integrations/hubspot/field-map";
import { getPlaybook } from "@/lib/playbook/resolve";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";

const SETTINGS_PATH = "/app/settings/integrations";

export async function GET(request: Request) {
  try {
    const session = await requireWorkspaceAdminApi();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      return NextResponse.redirect(
        `${url.origin}${SETTINGS_PATH}?hubspot_error=${encodeURIComponent(oauthError)}`,
      );
    }
    if (!code || !stateRaw) {
      return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    let state: { workspaceId: string; userId: string; nonce: string };
    try {
      state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    if (
      state.workspaceId !== session.workspaceId ||
      state.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "State workspace mismatch" }, { status: 403 });
    }

    const cookieStore = await cookies();
    const cookieNonce = cookieStore.get("hubspot_oauth_state")?.value;
    if (!cookieNonce || cookieNonce !== state.nonce) {
      logger.warn("api.hubspot.state_nonce_mismatch", {
        workspaceId: session.workspaceId,
        userId: session.user.id,
        hasCookie: Boolean(cookieNonce),
      });
      return NextResponse.json({ error: "OAuth state nonce mismatch" }, { status: 403 });
    }
    const codeVerifier = cookieStore.get("hubspot_pkce_verifier")?.value;
    if (!codeVerifier) {
      logger.warn("api.hubspot.pkce_verifier_missing", {
        workspaceId: session.workspaceId,
        userId: session.user.id,
      });
      return NextResponse.json(
        { error: "OAuth PKCE verifier missing or expired" },
        { status: 400 },
      );
    }

    const clearOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    };
    cookieStore.set("hubspot_oauth_state", "", clearOpts);
    cookieStore.set("hubspot_pkce_verifier", "", clearOpts);

    const tokens = await exchangeHubspotCode(code, codeVerifier);
    const info = await getHubspotTokenInfo(tokens.access_token);
    const portalId = String(info.hub_id);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const conn = await prisma.crmConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: session.workspaceId,
          provider: "HUBSPOT",
        },
      },
      create: {
        workspaceId: session.workspaceId,
        provider: "HUBSPOT",
        portalId,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scopes: info.scopes ?? [],
        status: "ACTIVE",
        connectedByUserId: session.user.id,
      },
      update: {
        portalId,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scopes: info.scopes ?? [],
        status: "ACTIVE",
        lastError: null,
      },
    });

    // Best-effort provisioning: property creation + default stage map.
    // Failures here must not block the connection (the admin can re-run
    // from the settings page), so we catch and log.
    try {
      const client = new HubspotClient(prisma, {
        id: conn.id,
        workspaceId: conn.workspaceId,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        portalId,
      });

      const provisioned = await ensureRevintProperties(client);

      let defaultPipelineId: string | null = null;
      let fieldMappingJson: object = {};
      try {
        const pipelines = await client.listDealPipelines();
        const primary = pipelines.results[0];
        if (primary) {
          defaultPipelineId = primary.id;
          const playbook = await getPlaybook(prisma, session.workspaceId);
          fieldMappingJson = buildDefaultStageMapping(primary, playbook);
        }
      } catch (err) {
        logger.warn("api.hubspot.pipeline_map_failed", { err });
      }

      await prisma.crmConnection.update({
        where: { id: conn.id },
        data: {
          propertiesProvisionedAt: new Date(),
          defaultPipelineId,
          fieldMappingJson,
        },
      });

      logger.info("api.hubspot.connected", {
        workspaceId: session.workspaceId,
        portalId,
        propsCreated: provisioned.created.length,
        propsSkipped: provisioned.skipped.length,
      });
    } catch (err) {
      logger.error("api.hubspot.provision_error", { err });
    }

    return NextResponse.redirect(`${url.origin}${SETTINGS_PATH}?hubspot_connected=1`);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return internalError("api.hubspot.callback_error", err);
  }
}
