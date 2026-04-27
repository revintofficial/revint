import type { Plan } from "@/generated/prisma/client";

export type Currency = "USD" | "GBP";
export const SUPPORTED_CURRENCIES: Currency[] = ["USD", "GBP"];
export const DEFAULT_CURRENCY: Currency = "USD";

export type BillingCycle = "monthly" | "annual";
export const SUPPORTED_CYCLES: BillingCycle[] = ["monthly", "annual"];
export const DEFAULT_CYCLE: BillingCycle = "monthly";

/**
 * P0.9: Annual billing - 20% discount on monthly price (industry standard 2026:
 * Asana 18%, Canva 23%, Notion 31%; deeper than 30% signals desperation).
 * Per-currency annual Stripe Price IDs are optional - fall back to monthly
 * when not configured so we never break checkout for tenants without annual
 * pricing set up.
 */
export const ANNUAL_DISCOUNT_PCT = 20;

export interface PlanDefinition {
  id: Plan;
  name: string;
  tagline: string;
  /** USD headline price - shown as the default. Use `monthlyPrices` for both. */
  monthlyPrice: number;
  /** Per-currency display prices (whole units, no cents). */
  monthlyPrices: Record<Currency, number>;
  /**
   * USD-default price ID for backward compat. Prefer `priceIds[currency]`
   * via `getPriceId(plan, currency)` for new code.
   */
  priceId: string | null;
  /** Per-currency Stripe Price IDs - both must exist for the plan to be live. */
  priceIds: Record<Currency, string | null>;
  /** P0.9: Per-currency annual Stripe Price IDs (optional). */
  annualPriceIds: Record<Currency, string | null>;
  leadsPerCycle: number;
  aiCreditsPerCycle: number;
  /** P0.8: max number of seats this tier allows. */
  maxSeats: number;
  /** P0.8: max mockup generations per cycle (separate from `aiCreditsPerCycle`). */
  mockupsPerCycle: number;
  features: string[];
  highlight?: boolean;
}

/**
 * P0.8 - Pro Team $149/3 seat pricing tier introduced.
 *
 * Per-tier reasoning (last30days research, see plan §8):
 *   - r/SaaS "is per seat pricing dead": SaaSpocalypse, lean teams penalized
 *   - r/SaaS "per-user seat tax killing lean teams": ICP4 sentiment direkt
 *   - r/B2BSaaS tier list: SalesTarget.ai $149 flat anchor → matched at $149
 *   - Pro Solo $79 (1 seat) → Pro Team $149 (3 seat) → Agency $249 (5 seat)
 *
 * Mevcut "PRO" customer'lari grandfather olarak Pro Solo'da kalir; yeni
 * signup'lar pricing card uzerinden Pro Solo veya Pro Team secebilir.
 */
export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    tagline: "Test it on your next prospect list.",
    monthlyPrice: 0,
    monthlyPrices: { USD: 0, GBP: 0 },
    priceId: null,
    priceIds: { USD: null, GBP: null },
    annualPriceIds: { USD: null, GBP: null },
    leadsPerCycle: 50,
    aiCreditsPerCycle: 20,
    maxSeats: 1,
    mockupsPerCycle: 3,
    features: [
      "50 fresh leads / month",
      "20 AI website audits",
      "3 website mockups",
      "Pipeline & shortlist",
      "Co-pilot chat (preview)",
      "No credit card required",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro Solo",
    tagline: "For solo SDRs and vertical specialists.",
    monthlyPrice: 79,
    monthlyPrices: { USD: 79, GBP: 59 },
    priceId: process.env.STRIPE_PRICE_PRO_USD || process.env.STRIPE_PRICE_PRO || null,
    priceIds: {
      USD: process.env.STRIPE_PRICE_PRO_USD || process.env.STRIPE_PRICE_PRO || null,
      GBP: process.env.STRIPE_PRICE_PRO_GBP || null,
    },
    annualPriceIds: {
      USD: process.env.STRIPE_PRICE_PRO_ANNUAL_USD || null,
      GBP: process.env.STRIPE_PRICE_PRO_ANNUAL_GBP || null,
    },
    leadsPerCycle: 1_000,
    aiCreditsPerCycle: 500,
    maxSeats: 1,
    mockupsPerCycle: 50,
    features: [
      "1,000 fresh leads / month",
      "50 AI website mockups / month",
      "500 AI audits + opener generator",
      "Native Gmail / Outlook send + reply attribution",
      "Opener learning loop (success memory)",
      "Smartlead & Instantly CSV export",
      "Deep review scan (up to 500 / lead)",
      "Priority support",
    ],
  },
  PRO_TEAM: {
    id: "PRO_TEAM",
    name: "Pro Team",
    tagline: "For walk-in web agency starters and small teams.",
    monthlyPrice: 149,
    monthlyPrices: { USD: 149, GBP: 99 },
    priceId: process.env.STRIPE_PRICE_PRO_TEAM_USD || process.env.STRIPE_PRICE_PRO_TEAM || null,
    priceIds: {
      USD: process.env.STRIPE_PRICE_PRO_TEAM_USD || process.env.STRIPE_PRICE_PRO_TEAM || null,
      GBP: process.env.STRIPE_PRICE_PRO_TEAM_GBP || null,
    },
    annualPriceIds: {
      USD: process.env.STRIPE_PRICE_PRO_TEAM_ANNUAL_USD || null,
      GBP: process.env.STRIPE_PRICE_PRO_TEAM_ANNUAL_GBP || null,
    },
    leadsPerCycle: 2_500,
    aiCreditsPerCycle: 1_500,
    maxSeats: 3,
    mockupsPerCycle: 150,
    features: [
      "3 seats included",
      "2,500 fresh leads / month",
      "150 AI website mockups / month",
      "1,500 AI audits + opener generator",
      "AI receptionist + review-reply + lead-response exports",
      "Native Gmail / Outlook send + reply attribution",
      "Mobile PWA + voice notes for field use",
      "Smartlead & Instantly CSV export",
      "Priority support",
    ],
    highlight: true,
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    tagline: "For agencies running outbound for clients.",
    monthlyPrice: 249,
    monthlyPrices: { USD: 249, GBP: 199 },
    priceId: process.env.STRIPE_PRICE_AGENCY_USD || process.env.STRIPE_PRICE_AGENCY || null,
    priceIds: {
      USD: process.env.STRIPE_PRICE_AGENCY_USD || process.env.STRIPE_PRICE_AGENCY || null,
      GBP: process.env.STRIPE_PRICE_AGENCY_GBP || null,
    },
    annualPriceIds: {
      USD: process.env.STRIPE_PRICE_AGENCY_ANNUAL_USD || null,
      GBP: process.env.STRIPE_PRICE_AGENCY_ANNUAL_GBP || null,
    },
    leadsPerCycle: 5_000,
    aiCreditsPerCycle: 5_000,
    maxSeats: 5,
    mockupsPerCycle: 300,
    features: [
      "5 seats included",
      "5,000 fresh leads / month",
      "300 AI website mockups / month",
      "Full install suite — receptionist, review-reply, lead-response, booking widget, GBP poster",
      "Deep Apify enrichment — 500 reviews, socials, SERP, competitor ads, LinkedIn hiring",
      "AI sales co-pilot with tool calling",
      "Reply attribution dashboard",
      "Multi-tenant workspaces + white-label branding",
      "Dedicated onboarding",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["FREE", "PRO", "PRO_TEAM", "AGENCY"];

export function getPlan(plan: Plan): PlanDefinition {
  return PLANS[plan];
}

/**
 * Human-readable label for a Plan enum value. Use this anywhere the
 * UI is about to render the raw enum (which would print "PRO_TEAM"
 * instead of "Pro Team"). Accepts loose string input because some
 * server-rendered surfaces erase the Plan brand into a plain string;
 * unknown values fall back to title-casing so we never print SHOUTY
 * underscored tokens to the user.
 */
export function getPlanLabel(plan: Plan | string | null | undefined): string {
  if (!plan) return "Unknown";
  const def = PLANS[plan as Plan];
  if (def?.name) return def.name;
  // Defensive fallback: turn FOO_BAR into "Foo Bar".
  return String(plan)
    .toLowerCase()
    .split("_")
    .map((s) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

/** P0.8: assert this workspace can invite an additional seat without exceeding tier max. */
export function planAllowsAdditionalSeat(plan: Plan, currentSeatCount: number): boolean {
  return currentSeatCount < PLANS[plan].maxSeats;
}

/**
 * Look up the Stripe Price ID for a plan in the requested currency and cycle.
 * Annual is preferred when requested AND configured; otherwise falls back to
 * the same-currency monthly price (then USD monthly) so checkout never breaks
 * for tenants without annual pricing wired up.
 */
export function getPriceId(
  plan: Plan,
  currency: Currency = DEFAULT_CURRENCY,
  cycle: BillingCycle = DEFAULT_CYCLE
): string | null {
  const def = PLANS[plan];
  if (cycle === "annual") {
    const annual = def.annualPriceIds[currency] ?? def.annualPriceIds[DEFAULT_CURRENCY];
    if (annual) return annual;
  }
  return def.priceIds[currency] ?? def.priceIds[DEFAULT_CURRENCY] ?? def.priceId;
}

/** True if at least one annual price ID is configured for this plan. */
export function hasAnnualPricing(plan: Plan, currency: Currency = DEFAULT_CURRENCY): boolean {
  const def = PLANS[plan];
  return Boolean(def.annualPriceIds[currency] ?? def.annualPriceIds[DEFAULT_CURRENCY]);
}

/** Narrow an arbitrary string to a supported Currency, or fall back to default. */
export function normalizeCurrency(input: unknown): Currency {
  if (typeof input === "string") {
    const upper = input.toUpperCase();
    if ((SUPPORTED_CURRENCIES as string[]).includes(upper)) {
      return upper as Currency;
    }
  }
  return DEFAULT_CURRENCY;
}

/** Narrow an arbitrary string to a supported BillingCycle, default monthly. */
export function normalizeCycle(input: unknown): BillingCycle {
  if (typeof input === "string") {
    const lower = input.toLowerCase();
    if ((SUPPORTED_CYCLES as string[]).includes(lower)) {
      return lower as BillingCycle;
    }
  }
  return DEFAULT_CYCLE;
}

/**
 * Display price for a plan/currency/cycle. Annual cycle returns the discounted
 * effective monthly price (rounded). UI components show the per-month figure
 * even on annual to avoid sticker shock.
 */
export function getDisplayPrice(
  plan: Plan,
  currency: Currency = DEFAULT_CURRENCY,
  cycle: BillingCycle = DEFAULT_CYCLE
): number {
  const monthly = PLANS[plan].monthlyPrices[currency] ?? PLANS[plan].monthlyPrice;
  if (cycle === "annual") {
    return Math.round(monthly * (1 - ANNUAL_DISCOUNT_PCT / 100));
  }
  return monthly;
}

/** Currency symbol for display. */
export function currencySymbol(currency: Currency): string {
  return currency === "GBP" ? "£" : "$";
}

/**
 * Best-effort browser-side currency detection from navigator.language /
 * Intl.Locale region. UK locales -> GBP, everything else -> USD. Safe on
 * SSR (returns default).
 */
export function detectBrowserCurrency(): Currency {
  if (typeof navigator === "undefined") return DEFAULT_CURRENCY;
  const lang = navigator.language || "";
  const region = lang.split("-")[1]?.toUpperCase() || "";
  if (region === "GB" || lang.toLowerCase() === "en-gb") return "GBP";
  return DEFAULT_CURRENCY;
}
