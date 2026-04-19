import type { Plan } from "@/generated/prisma/client";

export interface PlanDefinition {
  id: Plan;
  name: string;
  tagline: string;
  monthlyPrice: number;
  priceId: string | null;
  leadsPerCycle: number;
  aiCreditsPerCycle: number;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    tagline: "Test it on your next prospect list.",
    monthlyPrice: 0,
    priceId: null,
    leadsPerCycle: 50,
    aiCreditsPerCycle: 20,
    features: [
      "50 fresh leads / month",
      "20 AI website audits",
      "Pipeline & shortlist",
      "No credit card required",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tagline: "For solo SDRs and freelancers.",
    monthlyPrice: 29,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    leadsPerCycle: 1000,
    aiCreditsPerCycle: 500,
    features: [
      "1,000 fresh leads / month",
      "500 AI audits + mockups",
      "Personalized first-draft openers",
      "Smartlead & Instantly CSV export",
      "Bulk discover & analyze",
      "Priority support",
    ],
    highlight: true,
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    tagline: "For B2B outbound agencies.",
    monthlyPrice: 99,
    priceId: process.env.STRIPE_PRICE_AGENCY || null,
    leadsPerCycle: 10_000,
    aiCreditsPerCycle: 5_000,
    features: [
      "10,000 fresh leads / month",
      "5,000 AI audits + mockups",
      "Multi-tenant workspaces",
      "Unlimited team seats",
      "White label (coming Q2)",
      "Priority crawl queue",
      "Dedicated onboarding",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["FREE", "PRO", "AGENCY"];

export function getPlan(plan: Plan): PlanDefinition {
  return PLANS[plan];
}
