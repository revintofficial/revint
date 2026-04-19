import type { Plan } from "@/generated/prisma/client";

export interface PlanDefinition {
  id: Plan;
  name: string;
  tagline: string;
  monthlyPrice: number;
  priceId: string | null;
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
    priceId: null,
    leadsPerCycle: 50,
    aiCreditsPerCycle: 20,
    maxSeats: 1,
    mockupsPerCycle: 3,
    features: [
      "50 fresh leads / month",
      "20 AI website audits",
      "3 website mockups",
      "Pipeline & shortlist",
      "No credit card required",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro Solo",
    tagline: "For solo SDRs and vertical specialists.",
    monthlyPrice: 79,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    leadsPerCycle: 1_000,
    aiCreditsPerCycle: 500,
    maxSeats: 1,
    mockupsPerCycle: 50,
    features: [
      "1,000 fresh leads / month",
      "50 AI website mockups / month",
      "500 AI audits + opener generator",
      "Smartlead & Instantly CSV export",
      "Bulk discover & analyze",
      "Priority support",
    ],
  },
  PRO_TEAM: {
    id: "PRO_TEAM",
    name: "Pro Team",
    tagline: "For walk-in web agency starters and small teams.",
    monthlyPrice: 149,
    priceId: process.env.STRIPE_PRICE_PRO_TEAM || null,
    leadsPerCycle: 2_500,
    aiCreditsPerCycle: 1_500,
    maxSeats: 3,
    mockupsPerCycle: 150,
    features: [
      "3 seats included",
      "2,500 fresh leads / month",
      "150 AI website mockups / month",
      "1,500 AI audits + opener generator",
      "Mobile PWA + voice notes for field use",
      "Smartlead & Instantly CSV export",
      "Direct send from Gmail / Outlook",
      "Priority support",
    ],
    highlight: true,
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    tagline: "For agencies running outbound for clients.",
    monthlyPrice: 249,
    priceId: process.env.STRIPE_PRICE_AGENCY || null,
    leadsPerCycle: 5_000,
    aiCreditsPerCycle: 5_000,
    maxSeats: 5,
    mockupsPerCycle: 300,
    features: [
      "5 seats included",
      "5,000 fresh leads / month",
      "300 AI website mockups / month",
      "Multi-tenant workspaces",
      "Watchlist + priority crawl queue",
      "White label (coming Q2)",
      "AI sales co-pilot chat",
      "Reply attribution dashboard",
      "Dedicated onboarding",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["FREE", "PRO", "PRO_TEAM", "AGENCY"];

export function getPlan(plan: Plan): PlanDefinition {
  return PLANS[plan];
}

/** P0.8: assert this workspace can invite an additional seat without exceeding tier max. */
export function planAllowsAdditionalSeat(plan: Plan, currentSeatCount: number): boolean {
  return currentSeatCount < PLANS[plan].maxSeats;
}
