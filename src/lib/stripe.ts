import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env to enable billing."
    );
  }
  // Intentionally omit `apiVersion` - the Stripe SDK uses the version it
  // was compiled against, which matches the typed shape. Pinning a
  // specific string here is what broke against the Stripe v22 types in
  // earlier revisions (Stripe.StripeConfig was renamed).
  _stripe = new Stripe(key);
  return _stripe;
}

export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
