/**
 * Single source of truth for the four pricing tiers.
 *
 * brand-assets §1.2 + §2.9 + plan §3.3 row "/pricing" — Decoy effect,
 * anchor low/high, target Team highlighted, "Cancel anytime" loss-aversion
 * footnote, mental accounting "≈$50/SDR/month".
 *
 * Order: Pilot → Team (highlighted) → Growth → Enterprise. Left to right
 * cheap → expensive so the eye lands on Team as the target choice.
 */

export type PricingTier = {
  id: "pilot" | "team" | "growth" | "enterprise";
  name: string;
  tagline: string;
  /** Monthly price in USD. Enterprise uses null → renders as "Custom". */
  monthly: number | null;
  /** Visible price label, e.g. "$1,500" or "Custom". */
  priceLabel: string;
  /** Annual cost label, e.g. "$18,000/yr" — used for the per-SDR math footnote. */
  annualLabel?: string;
  /** Footnote rendered under the price (mental accounting hook). */
  unit?: string;
  /** Bullets the buyer reads top-to-bottom. */
  features: string[];
  /** Differentiating "what's included beyond the previous tier" pitch. */
  highlight?: string;
  /** Single primary CTA for this tier. */
  cta: { href: string; label: string };
  /** If true, the card renders with the signal-amber emphasis. */
  recommended?: boolean;
  /** Brief one-line context that appears under the tier name. */
  audience: string;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "pilot",
    name: "Pilot",
    tagline: "30-day evaluation",
    monthly: 500,
    priceLabel: "$500",
    unit: "per month, 30 days",
    audience: "First touch with the memory layer.",
    features: [
      "500 enriched local accounts",
      "1 vertical pack (Field service, Restaurant tech, or Dental)",
      "HubSpot OAuth — 12 fields per account",
      "1 SDR seat",
      "Closed-loop ICP refinement",
      "Email support, 1-business-day response",
    ],
    cta: { href: "/demo", label: "Start the pilot" },
  },
  {
    id: "team",
    name: "Team",
    tagline: "The default for 5–10 SDR teams",
    monthly: 1500,
    priceLabel: "$1,500",
    annualLabel: "$18,000 per year",
    unit: "per month — roughly $50 per SDR per month",
    audience: "Most vertical SaaS teams land here.",
    recommended: true,
    highlight:
      "Same price band as Gong's mid-market minimum. We ship the memory layer.",
    features: [
      "5,000 enriched accounts per month",
      "5 SDR seats",
      "1 vertical pack with custom signals",
      "HubSpot + Smartlead native integrations",
      "Closed-loop ICP refinement (auto retrain weekly)",
      "Slack alerts on signal changes",
      "Live onboarding call + shared Slack channel",
    ],
    cta: { href: "/demo", label: "Book a 20-min demo" },
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For 15-seat teams running multiple verticals",
    monthly: 3000,
    priceLabel: "$3,000",
    annualLabel: "$36,000 per year",
    unit: "per month",
    audience: "Multi-vertical motions, Series B-stage GTM.",
    features: [
      "20,000 enriched accounts per month",
      "15 SDR seats",
      "Up to 3 vertical packs with custom signals",
      "Pipedrive + Close + Salesforce sync",
      "Lost-reason taxonomy on closed-loop refinement",
      "Audit log + per-account decision history",
      "Priority Slack channel, 4-hour response",
    ],
    cta: { href: "/demo", label: "Talk to the founder" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For 30+ sellers, multi-region, SSO",
    monthly: null,
    priceLabel: "Custom",
    unit: "starts at $5,000 per month",
    audience: "Vertical SaaS with RevOps team + multi-region GTM.",
    features: [
      "Unlimited seats",
      "Unlimited vertical packs + custom verticals on request",
      "SSO (SAML/OIDC) + SCIM provisioning",
      "Custom data residency (US, EU, UK)",
      "Dedicated success manager",
      "SOC 2 Type II report (in progress, Q3 2026 target)",
      "DPA + custom MSA",
    ],
    cta: { href: "/demo", label: "Talk to sales" },
  },
];

/** Loss-aversion footnote that renders below the table. */
export const PRICING_FOOTNOTE =
  "Cancel anytime. No annual contract. No platform fee. No mandatory onboarding services SOW. Pilot starts at $500 per month for 30 days, and we don't auto-roll you onto a higher tier.";
