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
    tagline: "Try it on your next deal.",
    monthlyPrice: 0,
    priceId: null,
    leadsPerCycle: 50,
    aiCreditsPerCycle: 20,
    features: [
      "50 leads / month",
      "20 AI analyses / month",
      "1 workspace",
      "Pipeline & shortlist",
      "Email support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tagline: "For freelancers closing deals.",
    monthlyPrice: 29,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    leadsPerCycle: 1000,
    aiCreditsPerCycle: 500,
    features: [
      "1,000 leads / month",
      "500 AI analyses / month",
      "Website plan generator",
      "Bulk discover & analyze",
      "Excel & PDF export",
      "Priority support",
    ],
    highlight: true,
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    tagline: "For teams running outbound at scale.",
    monthlyPrice: 99,
    priceId: process.env.STRIPE_PRICE_AGENCY || null,
    leadsPerCycle: 10_000,
    aiCreditsPerCycle: 5_000,
    features: [
      "10,000 leads / month",
      "5,000 AI analyses / month",
      "Unlimited team seats",
      "API access (coming soon)",
      "Dedicated onboarding",
      "SLA support",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["FREE", "PRO", "AGENCY"];

export function getPlan(plan: Plan): PlanDefinition {
  return PLANS[plan];
}
