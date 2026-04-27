/**
 * P1.1 - OAuth callback: exchange code → tokens, persist EmailAccount.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { exchangeCodeForToken, type OAuthProvider } from "@/lib/oauth/providers";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

interface ProfileResponse {
  email?: string;
  mail?: string;
  userPrincipalName?: string;
}

async function fetchProfile(
  provider: OAuthProvider,
  accessToken: string,
): Promise<string> {
  if (provider === "gmail") {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to fetch Gmail profile");
    const data = (await res.json()) as ProfileResponse;
    return data.email ?? "";
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Microsoft profile");
  const data = (await res.json()) as ProfileResponse;
  return data.mail ?? data.userPrincipalName ?? "";
}

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${url.origin}/app/settings/email-accounts?oauth_error=${encodeURIComponent(error)}`);
    }
    if (!code || !stateRaw) {
      return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    let state: { workspaceId: string; userId: string; provider: OAuthProvider; nonce: string };
    try {
      state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    if (state.workspaceId !== session.workspaceId || state.userId !== session.user.id) {
      return NextResponse.json({ error: "State workspace mismatch" }, { status: 403 });
    }

    // CSRF defense: the state nonce we issued at /api/oauth/start was set in
    // an httpOnly `oauth_state` cookie. The callback must present that exact
    // nonce or we reject - this prevents an attacker from forcing a victim
    // to link the attacker's mailbox to the victim's workspace.
    const cookieStore = await cookies();
    const cookieNonce = cookieStore.get("oauth_state")?.value;
    if (!cookieNonce || cookieNonce !== state.nonce) {
      logger.warn("api.oauth.state_nonce_mismatch", {
        workspaceId: session.workspaceId,
        userId: session.user.id,
        provider: state.provider,
        hasCookie: Boolean(cookieNonce),
      });
      return NextResponse.json(
        { error: "OAuth state nonce mismatch" },
        { status: 403 },
      );
    }
    cookieStore.set("oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });

    const tokens = await exchangeCodeForToken(state.provider, code);
    const email = await fetchProfile(state.provider, tokens.access_token);
    if (!email) {
      return NextResponse.json({ error: "Could not fetch email from provider" }, { status: 502 });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.emailAccount.upsert({
      where: { workspaceId_email: { workspaceId: session.workspaceId, email } },
      create: {
        workspaceId: session.workspaceId,
        userId: session.user.id,
        provider: state.provider === "gmail" ? "GMAIL" : "OUTLOOK",
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt,
      },
    });

    return NextResponse.redirect(
      `${url.origin}/app/settings/email-accounts?connected=${encodeURIComponent(email)}`,
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.oauth.callback_error", err);
  }
}
