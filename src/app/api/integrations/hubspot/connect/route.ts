/**
 * FineDine v1 update — HubSpot OAuth start.
 *
 * Admin-only (CRM connection is workspace-wide config). Issues a signed
 * `state` (workspace + user + nonce), sets the nonce in a short-lived
 * httpOnly cookie for CSRF defense (mirrors the Gmail/Outlook flow), and
 * redirects to the HubSpot consent screen.
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { requireWorkspaceAdminApi, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import {
  buildHubspotAuthUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  isHubspotConfigured,
} from "@/lib/integrations/hubspot/oauth";
import { planMeetsMinimum } from "@/lib/agent-workers/registry";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireWorkspaceAdminApi();

    if (!isHubspotConfigured()) {
      return NextResponse.json(
        {
          error: "hubspot_not_configured",
          message: "HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET not set in .env",
        },
        { status: 503 },
      );
    }

    // Plan gate — HubSpot integration is a paid-plan feature. FREE is
    // grandfathered + sunsetted, so existing FREE workspaces can't
    // start a new HubSpot connection (write-back + webhooks consume
    // real HubSpot quota the customer's portal pays for, and we
    // shoulder all the request volume).
    if (!planMeetsMinimum(session.workspace.plan, "PRO")) {
      return NextResponse.json(
        {
          error: "plan_too_low",
          required: "PRO",
          message:
            "HubSpot integration requires a Solo (PRO) plan or higher.",
        },
        { status: 402 },
      );
    }

    const url = new URL(request.url);
    // Allow opt-in redirect to onboarding (or any in-app path) after
    // the callback — defaults to the integrations settings page. The
    // value is sanity-checked to be a same-origin app-relative path so
    // a malicious caller can't redirect through us to an external host.
    const returnToRaw = url.searchParams.get("returnTo");
    const returnTo =
      returnToRaw && /^\/app\/[a-z0-9_\-\/?=&]+$/i.test(returnToRaw)
        ? returnToRaw
        : null;

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({
        workspaceId: session.workspaceId,
        userId: session.user.id,
        nonce,
        ...(returnTo ? { returnTo } : {}),
      }),
    ).toString("base64url");

    // PKCE: keep the verifier server-side (httpOnly cookie); send only
    // the derived S256 challenge to HubSpot. The callback replays the
    // verifier on token exchange.
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);

    const res = NextResponse.redirect(buildHubspotAuthUrl(state, codeChallenge));
    const cookieOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    };
    res.cookies.set("hubspot_oauth_state", nonce, cookieOpts);
    res.cookies.set("hubspot_pkce_verifier", codeVerifier, cookieOpts);
    return res;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    logger.error("api.hubspot.connect_error", { err });
    return NextResponse.json({ error: "Failed to start HubSpot OAuth" }, { status: 500 });
  }
}
