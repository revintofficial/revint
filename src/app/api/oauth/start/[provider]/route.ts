/**
 * P1.1 - OAuth start: redirect user to Gmail or Outlook consent screen.
 * Stores `state` (signed workspace+user id) in a short-lived cookie.
 */

import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { buildAuthUrl, isProviderConfigured, type OAuthProvider } from "@/lib/oauth/providers";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const session = await requireUser();
    const { provider } = await params;

    if (provider !== "gmail" && provider !== "outlook") {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    if (!isProviderConfigured(provider as OAuthProvider)) {
      return NextResponse.json(
        {
          error: "oauth_not_configured",
          message: `${provider.toUpperCase()}_OAUTH_CLIENT_ID/SECRET not set in .env`,
        },
        { status: 503 },
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({
        workspaceId: session.workspaceId,
        userId: session.user.id,
        provider,
        nonce,
      }),
    ).toString("base64url");

    const url = buildAuthUrl(provider as OAuthProvider, state);

    const res = NextResponse.redirect(url);
    res.cookies.set("oauth_state", nonce, {
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
    logger.error("api.oauth.start_error", { err });
    return NextResponse.json({ error: "Failed to start OAuth" }, { status: 500 });
  }
}
