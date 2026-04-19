/**
 * P1.1 / P1.3 - OAuth provider config for Gmail + Outlook (Microsoft Graph).
 *
 * Used for both:
 *   - Direct email send (P1.1): scope `gmail.send` / `Mail.Send`
 *   - Reply attribution v1 (P1.4): scope `gmail.readonly` / `Mail.Read`
 *   - Calendar sync (P1.3): scope `calendar` / `Calendars.ReadWrite`
 *
 * Graceful degradation: if env vars not set, OAuth start route returns 503.
 * The product still works without these (CSV export remains primary path).
 */

export type OAuthProvider = "gmail" | "outlook";

export const OAUTH_SCOPES: Record<OAuthProvider, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
  ],
  outlook: [
    "https://graph.microsoft.com/Mail.Send",
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Calendars.ReadWrite",
    "https://graph.microsoft.com/User.Read",
    "offline_access",
  ],
};

export interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
}

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`${key} is not set in .env`);
  }
  return v;
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  const redirect = process.env.OAUTH_REDIRECT_URL ||
    "http://localhost:3000/api/oauth/callback";

  if (provider === "gmail") {
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: envOrThrow("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: envOrThrow("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirectUri: redirect,
      scopes: OAUTH_SCOPES.gmail.join(" "),
    };
  }

  return {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: envOrThrow("MICROSOFT_OAUTH_CLIENT_ID"),
    clientSecret: envOrThrow("MICROSOFT_OAUTH_CLIENT_SECRET"),
    redirectUri: redirect,
    scopes: OAUTH_SCOPES.outlook.join(" "),
  };
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === "gmail") {
    return !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  }
  return !!process.env.MICROSOFT_OAUTH_CLIENT_ID && !!process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
}

export function buildAuthUrl(provider: OAuthProvider, state: string): string {
  const cfg = getProviderConfig(provider);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: cfg.scopes,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  id_token?: string;
}

export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
): Promise<TokenResponse> {
  const cfg = getProviderConfig(provider);
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed for ${provider}: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  provider: OAuthProvider,
  refreshToken: string,
): Promise<TokenResponse> {
  const cfg = getProviderConfig(provider);
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed for ${provider}: ${res.status} ${text}`);
  }
  return res.json();
}
