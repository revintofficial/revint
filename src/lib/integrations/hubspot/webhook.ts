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
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 5 * 60_000;

/** HubSpot v3 URI decoding — only these sequences are expanded. */
const HUBSPOT_URI_DECODE: Record<string, string> = {
  "%3A": ":",
  "%2F": "/",
  "%3F": "?",
  "%40": "@",
  "%21": "!",
  "%24": "$",
  "%27": "'",
  "%28": "(",
  "%29": ")",
  "%2A": "*",
  "%2C": ",",
  "%3B": ";",
};

export function decodeHubspotRequestUri(uri: string): string {
  let out = uri;
  for (const [encoded, decoded] of Object.entries(HUBSPOT_URI_DECODE)) {
    out = out.split(encoded).join(decoded);
  }
  return out;
}

function expandUrlCandidates(urls: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    const variants = [raw, decodeHubspotRequestUri(raw)];
    for (const u of variants) {
      out.add(u);
      out.add(u.endsWith("/") ? u.slice(0, -1) : `${u}/`);
      if (u.startsWith("http://")) {
        out.add(`https://${u.slice("http://".length)}`);
      }
    }
  }
  return [...out];
}

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
  const candidates = expandUrlCandidates([...overrides, args.requestUrl]);

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

/**
 * HubSpot v2 signature (legacy CRM cards + some app-card requests).
 * Concatenates `clientSecret + method + uri + body`, SHA-256 hex.
 */
export function verifyHubspotSignatureV2(args: {
  method: string;
  requestUrl: string;
  rawBody: string;
  signature: string | null;
  clientSecret: string | undefined;
  urlOverride?: string | string[] | null;
}): VerifyResult {
  const { method, rawBody, signature, clientSecret } = args;
  if (!clientSecret) return { valid: false, reason: "no_client_secret" };
  if (!signature) return { valid: false, reason: "missing_headers" };

  const overrides = Array.isArray(args.urlOverride)
    ? args.urlOverride
    : args.urlOverride
      ? [args.urlOverride]
      : [];
  const candidates = expandUrlCandidates([...overrides, args.requestUrl]);

  for (const uri of candidates) {
    const expected = createHash("sha256")
      .update(`${clientSecret}${method}${uri}${rawBody}`, "utf8")
      .digest("hex");
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { valid: true };
      }
    } catch {
      // length mismatch — try next candidate.
    }
  }
  return { valid: false, reason: "signature_mismatch" };
}

/**
 * Accept either v3 (preferred) or v2 HubSpot request signatures.
 * App cards may ship v2 per HubSpot docs; webhooks + hubspot.fetch use v3.
 */
export function verifyHubspotRequest(args: {
  method: string;
  requestUrl: string;
  rawBody: string;
  clientSecret: string | undefined;
  urlOverride?: string | string[] | null;
  signatureV3: string | null;
  timestamp: string | null;
  signatureV2: string | null;
  signatureVersion: string | null;
}): VerifyResult {
  const preferV2 =
    args.signatureVersion?.toLowerCase() === "v2" ||
    (!args.signatureV3 && !!args.signatureV2);

  let lastReason: string | undefined;

  if (!preferV2 && args.signatureV3) {
    const v3 = verifyHubspotSignatureV3({
      method: args.method,
      requestUrl: args.requestUrl,
      rawBody: args.rawBody,
      signature: args.signatureV3,
      timestamp: args.timestamp,
      clientSecret: args.clientSecret,
      urlOverride: args.urlOverride,
    });
    if (v3.valid) return v3;
    lastReason = v3.reason;
  }

  if (args.signatureV2) {
    const v2 = verifyHubspotSignatureV2({
      method: args.method,
      requestUrl: args.requestUrl,
      rawBody: args.rawBody,
      signature: args.signatureV2,
      clientSecret: args.clientSecret,
      urlOverride: args.urlOverride,
    });
    if (v2.valid) return v2;
    lastReason = v2.reason;
  }

  if (args.signatureV3 && !preferV2) {
    const v3 = verifyHubspotSignatureV3({
      method: args.method,
      requestUrl: args.requestUrl,
      rawBody: args.rawBody,
      signature: args.signatureV3,
      timestamp: args.timestamp,
      clientSecret: args.clientSecret,
      urlOverride: args.urlOverride,
    });
    if (v3.valid) return v3;
    lastReason = v3.reason;
  }

  return { valid: false, reason: lastReason ?? "missing_headers" };
}
