/**
 * FineDine v1 update — HubSpot OAuth (authorization code flow).
 *
 * Mirrors the Gmail/Outlook pattern in `src/lib/oauth/providers.ts` but
 * kept separate because HubSpot tokens live on `CrmConnection` (not
 * `EmailAccount`) and are encrypted at rest.
 *
 * Graceful degradation: if `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET`
 * are not set, `isHubspotConfigured()` returns false and the connect
 * route returns 503. The product works without it (HubSpot integration
 * is opt-in).
 */

import { createHash, randomBytes } from "node:crypto";

const AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

/**
 * Scopes requested at connect time. `crm.objects.*` cover contacts /
 * companies / deals read+write; `crm.schemas.*` allow provisioning the
 * canonical `revint_*` custom properties; the webhook subscription is
 * configured in the HubSpot app settings (not a scope).
 */
export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.owners.read",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
  "crm.schemas.deals.read",
];

export function isHubspotConfigured(): boolean {
  return (
    !!process.env.HUBSPOT_CLIENT_ID && !!process.env.HUBSPOT_CLIENT_SECRET
  );
}

export function getHubspotRedirectUri(): string {
  return (
    process.env.HUBSPOT_REDIRECT_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/hubspot/callback`
  );
}

function clientId(): string {
  const v = process.env.HUBSPOT_CLIENT_ID;
  if (!v) throw new Error("HUBSPOT_CLIENT_ID is not set in .env");
  return v;
}

function clientSecret(): string {
  const v = process.env.HUBSPOT_CLIENT_SECRET;
  if (!v) throw new Error("HUBSPOT_CLIENT_SECRET is not set in .env");
  return v;
}

/**
 * PKCE (RFC 7636). HubSpot now requires a `code_challenge` on the
 * authorization request ("PKCE is required for this authorization
 * request"). We generate a high-entropy `code_verifier`, derive the
 * S256 `code_challenge` from it, stash the verifier in a short-lived
 * httpOnly cookie at connect time, and replay it on token exchange.
 */
export function generateCodeVerifier(): string {
  // 32 random bytes → 43-char base64url string (within the 43–128 range).
  return randomBytes(32).toString("base64url");
}

export function deriveCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

/**
 * Build the HubSpot consent URL. `state` is an opaque CSRF token the
 * connect route stores in a short-lived signed cookie and re-validates
 * on callback. `codeChallenge` is the S256 PKCE challenge.
 */
export function buildHubspotAuthUrl(
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: getHubspotRedirectUri(),
    scope: HUBSPOT_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface HubspotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeHubspotCode(
  code: string,
  codeVerifier: string,
): Promise<HubspotTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: getHubspotRedirectUri(),
    code,
    code_verifier: codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshHubspotToken(
  refreshToken: string,
): Promise<HubspotTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export interface HubspotTokenInfo {
  hub_id: number;
  hub_domain?: string;
  user?: string;
  user_id?: number;
  scopes?: string[];
}

/**
 * Resolve the portal (hub) id + metadata from an access token. Used at
 * connect time to persist `CrmConnection.portalId` so inbound webhooks
 * can resolve the workspace.
 */
export async function getHubspotTokenInfo(
  accessToken: string,
): Promise<HubspotTokenInfo> {
  const res = await fetch(
    `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token info failed: ${res.status} ${text}`);
  }
  return res.json();
}
