/**
 * HubSpot OAuth callback.
 *
 * Validates the signed state + CSRF nonce, exchanges the code for tokens, resolves the
 * portal id, upserts the `CrmConnection` (tokens encrypted at rest), and
 * provisions the canonical `revint_*` custom properties + a best-effort
 * default pipeline→playbook stage mapping. Redirects back to the
 * Integrations settings page with a status flag.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  exchangeHubspotCode,
  getHubspotTokenInfo,
  verifyHubspotOAuthState,
  timingSafeEqualString,
  type HubspotOAuthState,
} from "@/lib/integrations/hubspot/oauth";
import { getOptionalUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/integrations/crypto";
import { HubspotClient } from "@/lib/integrations/hubspot/client";
import {
  ensureRevintProperties,
  hasProvisionScope,
  PROVISION_REQUIRED_SCOPE,
} from "@/lib/integrations/hubspot/properties";
import { buildDefaultStageMapping } from "@/lib/integrations/hubspot/field-map";
import { getPlaybook } from "@/lib/playbook/resolve";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";
import { planMeetsMinimum } from "@/lib/agent-workers/registry";

export const runtime = "nodejs";

const SETTINGS_PATH = "/app/settings/integrations";

function sharedRevintCookieDomain(request: Request): string | undefined {
  const host =
    request.headers.get("host")?.toLowerCase().split(":")[0] ||
    new URL(request.url).hostname.toLowerCase();
  if (!host) return undefined;
  if (host === "revint.dev" || host.endsWith(".revint.dev")) {
    return ".revint.dev";
  }
  return undefined;
}

function safeReturnTo(returnTo?: string | null): string {
  return returnTo && /^\/app\/[a-z0-9_\-\/?=&]+$/i.test(returnTo)
    ? returnTo
    : SETTINGS_PATH;
}

function redirectWithHubspotFlag(
  origin: string,
  state: HubspotOAuthState | null,
  key: "hubspot_connected" | "hubspot_error",
  value: string,
): NextResponse {
  const returnTo = safeReturnTo(state?.returnTo);
  const sep = returnTo.includes("?") ? "&" : "?";
  return NextResponse.redirect(
    `${origin}${returnTo}${sep}${key}=${encodeURIComponent(value)}`,
  );
}

async function resolveHubspotOAuthActor(state: HubspotOAuthState) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: state.workspaceId,
      userId: state.userId,
    },
    include: {
      workspace: true,
      user: true,
    },
  });

  if (!member) {
    return {
      ok: false as const,
      status: 403,
      error: "workspace_membership_required",
    };
  }

  if (member.role !== "OWNER" && member.role !== "ADMIN") {
    return {
      ok: false as const,
      status: 403,
      error: "workspace_admin_required",
    };
  }

  if (!planMeetsMinimum(member.workspace.plan, "PRO")) {
    return {
      ok: false as const,
      status: 402,
      error: "plan_too_low",
    };
  }

  return {
    ok: true as const,
    workspaceId: member.workspaceId,
    user: member.user,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    let state: HubspotOAuthState | null = null;

    if (stateRaw) {
      try {
        state = verifyHubspotOAuthState(stateRaw);
      } catch (err) {
        logger.warn("api.hubspot.invalid_state", { err });
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
    }

    if (oauthError) {
      return redirectWithHubspotFlag(url.origin, state, "hubspot_error", oauthError);
    }
    if (!code || !state) {
      return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const cookieNonce = cookieStore.get("hubspot_oauth_state")?.value;
    if (!cookieNonce || !timingSafeEqualString(cookieNonce, state.nonce)) {
      logger.warn("api.hubspot.state_nonce_mismatch", {
        workspaceId: state.workspaceId,
        userId: state.userId,
        hasCookie: Boolean(cookieNonce),
      });
      return redirectWithHubspotFlag(
        url.origin,
        state,
        "hubspot_error",
        "state_nonce_mismatch",
      );
    }
    const codeVerifier = cookieStore.get("hubspot_pkce_verifier")?.value;
    if (!codeVerifier) {
      logger.warn("api.hubspot.pkce_verifier_missing", {
        workspaceId: state.workspaceId,
        userId: state.userId,
      });
      return redirectWithHubspotFlag(
        url.origin,
        state,
        "hubspot_error",
        "pkce_verifier_missing",
      );
    }

    // Defense-in-depth identity binding. The nonce/verifier cookies are
    // `.revint.dev`-scoped (they must survive the connect-on-`app.` →
    // callback-on-apex hop), which means a sibling subdomain or XSS could
    // "toss" attacker-chosen values onto the victim's browser and pair an
    // attacker's signed state with the victim's authorization `code`
    // (confused-deputy → cross-tenant token write). Since Supabase auth
    // cookies are also `.revint.dev`-scoped, a logged-in user carries
    // their session to the apex callback: when present, the consenting
    // user MUST be the same user who minted the state. Sessionless
    // callbacks (legacy app-host-only sessions) fall through to the nonce
    // + DB-actor checks, preserving the documented cross-host flow.
    const sessionUser = await getOptionalUser();
    if (sessionUser && sessionUser.user.id !== state.userId) {
      logger.warn("api.hubspot.session_state_mismatch", {
        workspaceId: state.workspaceId,
        stateUserId: state.userId,
        sessionUserId: sessionUser.user.id,
      });
      return redirectWithHubspotFlag(
        url.origin,
        state,
        "hubspot_error",
        "session_mismatch",
      );
    }

    const actor = await resolveHubspotOAuthActor(state);
    if (!actor.ok) {
      logger.warn("api.hubspot.actor_rejected", {
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: actor.status,
        error: actor.error,
      });
      return redirectWithHubspotFlag(url.origin, state, "hubspot_error", actor.error);
    }

    const cookieDomain = sharedRevintCookieDomain(request);
    const clearOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    };

    const tokens = await exchangeHubspotCode(code, codeVerifier);
    const info = await getHubspotTokenInfo(tokens.access_token);
    const portalId = String(info.hub_id);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const conn = await prisma.crmConnection.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: actor.workspaceId,
          provider: "HUBSPOT",
        },
      },
      create: {
        workspaceId: actor.workspaceId,
        provider: "HUBSPOT",
        portalId,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        expiresAt,
        scopes: info.scopes ?? [],
        status: "ACTIVE",
        connectedByUserId: actor.user.id,
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

      // Scope guard — without `crm.schemas.contacts.write` every
      // property create 403s and silently lands in `errors[]`. Don't
      // attempt provisioning (and never stamp a false success); record
      // the missing scope so settings can prompt a reconnect with the
      // correct app.
      const canProvision = hasProvisionScope(info.scopes);
      const provisioned = canProvision
        ? await ensureRevintProperties(client)
        : { created: [], skipped: [], errors: [] };
      if (!canProvision) {
        logger.warn("api.hubspot.provision_scope_missing", {
          workspaceId: actor.workspaceId,
          portalId,
          required: PROVISION_REQUIRED_SCOPE,
        });
      }

      let defaultPipelineId: string | null = null;
      let fieldMappingJson: object = {};
      try {
        const pipelines = await client.listDealPipelines();
        const primary = pipelines.results[0];
        if (primary) {
          defaultPipelineId = primary.id;
          const playbook = await getPlaybook(prisma, actor.workspaceId);
          fieldMappingJson = buildDefaultStageMapping(primary, playbook);
        }
      } catch (err) {
        logger.warn("api.hubspot.pipeline_map_failed", { err });
      }

      // Only stamp `propertiesProvisionedAt` on a clean provision.
      // Partial / blocked provisioning records the failure so the
      // connection doesn't masquerade as fully set up.
      const provisionOk = canProvision && provisioned.errors.length === 0;
      const lastError = !canProvision
        ? `missing_scope:${PROVISION_REQUIRED_SCOPE}`
        : provisioned.errors.length > 0
          ? `property_provision_failed:${provisioned.errors.join(",")}`
          : null;

      await prisma.crmConnection.update({
        where: { id: conn.id },
        data: {
          ...(provisionOk ? { propertiesProvisionedAt: new Date() } : {}),
          lastError,
          defaultPipelineId,
          fieldMappingJson,
        },
      });

      logger.info("api.hubspot.connected", {
        workspaceId: actor.workspaceId,
        portalId,
        canProvision,
        propsCreated: provisioned.created.length,
        propsSkipped: provisioned.skipped.length,
        propsFailed: provisioned.errors.length,
      });
    } catch (err) {
      logger.error("api.hubspot.provision_error", { err });
    }

    // Clear the single-use OAuth cookies on the redirect response itself.
    // Mutating the `cookies()` store does not reliably attach Set-Cookie
    // to a separately-constructed NextResponse.redirect, which would let
    // the nonce/verifier survive for their full 10-minute TTL.
    const res = redirectWithHubspotFlag(url.origin, state, "hubspot_connected", "1");
    res.cookies.set("hubspot_oauth_state", "", clearOpts);
    res.cookies.set("hubspot_pkce_verifier", "", clearOpts);
    return res;
  } catch (err) {
    return internalError("api.hubspot.callback_error", err);
  }
}
