/**
 * Minimal Google Search Console client.
 *
 * Uses a service-account JSON key (GSC_SERVICE_ACCOUNT_JSON) with
 * `https://www.googleapis.com/auth/webmasters.readonly` scope. The
 * service account must be added as a verified owner of the property
 * (either URL-prefix or domain) in Search Console.
 *
 * We implement the JWT flow by hand to avoid pulling in `googleapis` — it
 * is a ~100MB install that we don't otherwise need in the worker image.
 *
 * The public surface is just:
 *   - `fetchSearchAnalytics()` — query the searchanalytics.query endpoint.
 *   - `isGscConfigured()`      — returns true when env is set.
 *
 * Callers cache results in Redis so the dashboard is snappy.
 */

import { createSign } from "node:crypto";

const GSC_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export function isGscConfigured(): boolean {
  return Boolean(
    process.env.GSC_SERVICE_ACCOUNT_JSON && process.env.GSC_SITE_URL,
  );
}

function loadKey(): ServiceAccountKey | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccountKey;
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function mintToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }
  const key = loadKey();
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: key.client_email,
    scope: GSC_SCOPE,
    aud: key.token_uri ?? GSC_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const toSign = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claim),
  )}`;
  const sig = createSign("RSA-SHA256")
    .update(toSign)
    .sign(key.private_key);
  const assertion = `${toSign}.${base64url(sig)}`;

  const res = await fetch(key.token_uri ?? GSC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    console.error(
      "[gsc] token mint failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return null;
  }
  const body = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return tokenCache.token;
}

export type GscQueryRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function fetchSearchAnalytics(opts: {
  startDate: string;
  endDate: string;
  dimensions?: Array<"query" | "page" | "country" | "device" | "date">;
  rowLimit?: number;
}): Promise<GscQueryRow[]> {
  const token = await mintToken();
  const site = process.env.GSC_SITE_URL;
  if (!token || !site) return [];

  const url = `${GSC_API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: opts.startDate,
      endDate: opts.endDate,
      dimensions: opts.dimensions ?? ["query"],
      rowLimit: opts.rowLimit ?? 1000,
    }),
  });
  if (!res.ok) {
    console.error(
      "[gsc] query failed",
      res.status,
      await res.text().catch(() => ""),
    );
    return [];
  }
  const body = (await res.json()) as { rows?: GscQueryRow[] };
  return body.rows ?? [];
}
