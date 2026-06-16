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
import { buildHubspotAuthUrl, isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
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

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({
        workspaceId: session.workspaceId,
        userId: session.user.id,
        nonce,
      }),
    ).toString("base64url");

    const res = NextResponse.redirect(buildHubspotAuthUrl(state));
    res.cookies.set("hubspot_oauth_state", nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
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
