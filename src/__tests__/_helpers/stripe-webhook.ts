/**
 * Stripe webhook signing helper for tests.
 *
 * Stripe verifies webhook payloads with an HMAC-SHA256 signature over
 * the concatenation `<timestamp>.<raw body>` keyed on the endpoint
 * secret. Replicate the exact format Stripe sends so the test request
 * passes `stripe.webhooks.constructEvent()` without monkey-patching
 * the SDK.
 *
 * Usage:
 *   const { signature, body } = signedEvent({ type: "invoice.paid", ... });
 *   const req = new Request("http://localhost/api/billing/webhook", {
 *     method: "POST",
 *     headers: { "stripe-signature": signature, "content-type": "application/json" },
 *     body,
 *   });
 *
 * The secret defaults to `process.env.STRIPE_WEBHOOK_SECRET` (set in
 * the test setup file). Pass an explicit secret to test rotation /
 * mismatched-secret rejection.
 */
import { createHmac, randomUUID } from "node:crypto";

export interface SignedStripeEvent {
  /** Raw body string the route MUST verify against - do not re-stringify. */
  body: string;
  /** Value for the `Stripe-Signature` header. */
  signature: string;
  /** Unix seconds used in the signature (also matches the event payload). */
  timestamp: number;
  /** Convenience: the parsed event object (already serialised into `body`). */
  event: StripeEventLike;
}

export interface StripeEventLike {
  id: string;
  type: string;
  api_version?: string;
  created: number;
  livemode?: boolean;
  request?: { id: string | null; idempotency_key: string | null };
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
}

export interface SignEventOptions {
  /** Override the webhook secret. Defaults to STRIPE_WEBHOOK_SECRET env. */
  secret?: string;
  /** Override the timestamp (defaults to "now"). Useful for replay tests. */
  timestamp?: number;
  /** Override the event id. Defaults to a uuid-prefixed `evt_test_*`. */
  id?: string;
  /** Defaults to `false` (test mode). */
  livemode?: boolean;
}

/**
 * Builds a Stripe-style event object + signature for use in route
 * tests. `body` is the exact string the route receives via
 * `request.text()`; signing is performed over it byte-for-byte.
 */
export function signedEvent(
  partial: { type: string; data: { object: Record<string, unknown>; previous_attributes?: Record<string, unknown> } },
  opts: SignEventOptions = {},
): SignedStripeEvent {
  const secret = opts.secret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET not set - either set it in the test env or pass `secret` explicitly",
    );
  }

  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const event: StripeEventLike = {
    id: opts.id ?? `evt_test_${randomUUID().replace(/-/g, "")}`,
    type: partial.type,
    api_version: "2025-01-27.acacia",
    created: timestamp,
    livemode: opts.livemode ?? false,
    request: { id: null, idempotency_key: null },
    data: partial.data,
  };

  const body = JSON.stringify(event);
  const signedPayload = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(signedPayload).digest("hex");

  return {
    body,
    signature: `t=${timestamp},v1=${sig}`,
    timestamp,
    event,
  };
}

/**
 * Builds a deliberately invalid signature (wrong secret) for negative
 * tests that assert the route returns 400 on tamper.
 */
export function tamperedSignature(
  partial: { type: string; data: { object: Record<string, unknown> } },
): SignedStripeEvent {
  return signedEvent(partial, { secret: "whsec_wrong_secret_for_tamper_test" });
}
