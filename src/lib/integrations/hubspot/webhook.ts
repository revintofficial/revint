/**
 * HubSpot v3 signature verification.
 *
 * HubSpot signs every server-to-server request (webhooks + the App Card
 * `hubspot.fetch()` calls) with `X-HubSpot-Signature-v3`, computed as
 *   base64(HMAC-SHA256(clientSecret, method + uri + body + timestamp))
 * Requests older than 5 minutes are rejected (replay protection).
 *
 * The `uri` HubSpot signs is the **full public URL it called**. Behind a
 * proxy (Vercel edge, Cloudflare) the URL the runtime observes may not
 * match (different scheme, dropped trailing slash, custom host header),
 * so callers should pass an explicit `urlOverride` from the appropriate
 * env var — `HUBSPOT_WEBHOOK_URL` for inbound webhooks, `HUBSPOT_CARD_URL`
 * for the App Card `card-data` endpoint.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 5 * 60_000;

export interface HubspotWebhookEvent {
  eventId: number;
  subscriptionId?: number;
  portalId: number;
  appId?: number;
  occurredAt: number;
  subscriptionType: string; // e.g. "contact.creation", "deal.propertyChange"
  attemptNumber?: number;
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

export function verifyHubspotSignatureV3(args: {
  method: string;
  requestUrl: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  clientSecret: string | undefined;
  /**
   * Optional URL(s) the signature should be computed against. When omitted,
   * `requestUrl` is used. Override this when running behind a proxy
   * (`HUBSPOT_WEBHOOK_URL` / `HUBSPOT_CARD_URL`). Accepts an array so the
   * caller can supply several plausible public-URL representations
   * (env override + forwarded-host reconstruction) and have the verifier
   * accept the request if ANY of them matches HubSpot's signed URL.
   */
  urlOverride?: string | string[] | null;
}): VerifyResult {
  const { method, rawBody, signature, timestamp, clientSecret } = args;
  if (!clientSecret) return { valid: false, reason: "no_client_secret" };
  if (!signature || !timestamp) return { valid: false, reason: "missing_headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) {
    return { valid: false, reason: "stale_timestamp" };
  }

  // HubSpot signs the full public URL it called. Behind Vercel/Cloudflare
  // the runtime-observed URL can differ in scheme (http vs https), host
  // (internal vs custom domain), or trailing slash, which silently breaks
  // the HMAC. Build every plausible representation and accept if any one
  // matches — this removes the entire URL-mismatch failure class without
  // weakening replay/secret protection.
  const overrides = Array.isArray(args.urlOverride)
    ? args.urlOverride
    : args.urlOverride
      ? [args.urlOverride]
      : [];
  const candidates = new Set<string>();
  for (const u of [...overrides, args.requestUrl]) {
    if (!u) continue;
    candidates.add(u);
    candidates.add(u.endsWith("/") ? u.slice(0, -1) : `${u}/`);
    if (u.startsWith("http://")) candidates.add(`https://${u.slice("http://".length)}`);
  }

  const sigBuf = Buffer.from(signature);
  for (const uri of candidates) {
    const expected = createHmac("sha256", clientSecret)
      .update(`${method}${uri}${rawBody}${timestamp}`, "utf8")
      .digest("base64");
    try {
      const a = Buffer.from(expected);
      if (a.length === sigBuf.length && timingSafeEqual(a, sigBuf)) {
        return { valid: true };
      }
    } catch {
      // length mismatch or malformed buffer — try the next candidate.
    }
  }
  return { valid: false, reason: "signature_mismatch" };
}
