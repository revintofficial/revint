import type { CompetitorProfile } from "./types";

export const instantly: CompetitorProfile = {
  slug: "instantly",
  name: "Instantly",
  homepage: "https://instantly.ai",
  tagline: "Cold email sender + inbox rotation.",
  positioning:
    "Instantly is a cold email sending platform with unlimited mailboxes, inbox warming, and a basic lead DB. Sits at the end of the funnel — you still need a list and a message.",
  bestFor:
    "Agencies running high-volume cold email where inbox deliverability is the bottleneck.",
  weaknesses: [
    "No lead discovery beyond its own B2B contact database (patchy on local).",
    "No website auditing or mockup generation.",
    "Lead quality ends up similar to Apollo — same contacts, different sender.",
  ],
  pricing: {
    entry: "$37/mo (Growth)",
    mid: "$97/mo (Hypergrowth)",
    enterprise: "$358/mo (Light Speed)",
    freeTrial: "14-day free trial",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 1,
    outreachAutomation: 5,
    dataFreshness: 3,
    priceForAgencies: 4,
  },
  citations: [
    {
      label: "Instantly pricing",
      url: "https://instantly.ai/pricing",
    },
    {
      label: "Instantly vs Smartlead — G2",
      url: "https://www.g2.com/compare/instantly-vs-smartlead-ai",
    },
  ],
  whyLeadacInstead: [
    "Instantly sends. Leadac sources. They're complementary — but Leadac replaces the upstream list provider.",
    "Per-lead website audits give your Instantly sequences something real to say in email #1.",
    "Push Leadac exports straight into Instantly; no duplicate data entry.",
  ],
};
