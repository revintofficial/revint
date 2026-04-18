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
  // Lock to a specific API version so the typed shape stays stable.
  _stripe = new Stripe(key, {
    apiVersion: "2025-01-27.acacia" as Stripe.StripeConfig["apiVersion"],
  });
  return _stripe;
}

export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
