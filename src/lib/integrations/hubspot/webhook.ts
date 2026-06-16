/**
 * FineDine v1 update — HubSpot webhook v3 signature verification.
 *
 * HubSpot signs each webhook with `X-HubSpot-Signature-v3`, computed as
 * base64(HMAC-SHA256(clientSecret, method + uri + body + timestamp)).
 * Requests older than 5 minutes are rejected (replay protection). The
 * `uri` HubSpot signs is the full public URL it called; behind a proxy
 * that differs from `request.url`, so `HUBSPOT_WEBHOOK_URL` can override
 * it.
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
}): VerifyResult {
  const { method, rawBody, signature, timestamp, clientSecret } = args;
  if (!clientSecret) return { valid: false, reason: "no_client_secret" };
  if (!signature || !timestamp) return { valid: false, reason: "missing_headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const uri = process.env.HUBSPOT_WEBHOOK_URL || args.requestUrl;
  const sourceString = `${method}${uri}${rawBody}${timestamp}`;
  const expected = createHmac("sha256", clientSecret)
    .update(sourceString, "utf8")
    .digest("base64");

  let match = false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    match = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    match = false;
  }
  return match ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
