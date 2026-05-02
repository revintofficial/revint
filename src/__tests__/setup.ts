import "@testing-library/jest-dom/vitest";

// Stripe webhook signing helper requires this; set a deterministic
// dummy secret for unit tests so the helper can construct signatures
// and the route handler can verify them with the same value.
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_unit_helper_default_secret";
}
if (!process.env.STRIPE_SECRET_KEY) {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_for_unit_tests";
}

// PLANS reads STRIPE_PRICE_* env vars at module load time, so any
// per-test override applied AFTER the route module loads would arrive
// too late. Set deterministic test SKUs here so PLANS.{PRO,PRO_TEAM,
// AGENCY}.{priceIds,annualPriceIds} are non-null in every unit test
// that hits billing code.
const PRICE_DEFAULTS: Record<string, string> = {
  STRIPE_PRICE_PRO_USD: "price_test_pro_usd",
  STRIPE_PRICE_PRO_GBP: "price_test_pro_gbp",
  STRIPE_PRICE_PRO_ANNUAL_USD: "price_test_pro_annual_usd",
  STRIPE_PRICE_PRO_ANNUAL_GBP: "price_test_pro_annual_gbp",
  STRIPE_PRICE_PRO_TEAM_USD: "price_test_pro_team_usd",
  STRIPE_PRICE_PRO_TEAM_GBP: "price_test_pro_team_gbp",
  STRIPE_PRICE_PRO_TEAM_ANNUAL_USD: "price_test_pro_team_annual_usd",
  STRIPE_PRICE_PRO_TEAM_ANNUAL_GBP: "price_test_pro_team_annual_gbp",
  STRIPE_PRICE_AGENCY_USD: "price_test_agency_usd",
  STRIPE_PRICE_AGENCY_GBP: "price_test_agency_gbp",
  STRIPE_PRICE_AGENCY_ANNUAL_USD: "price_test_agency_annual_usd",
  STRIPE_PRICE_AGENCY_ANNUAL_GBP: "price_test_agency_annual_gbp",
};
for (const [key, value] of Object.entries(PRICE_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
