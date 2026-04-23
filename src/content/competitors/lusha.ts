import type { CompetitorProfile } from "./types";

export const lusha: CompetitorProfile = {
  slug: "lusha",
  name: "Lusha",
  homepage: "https://www.lusha.com",
  tagline: "B2B contact lookups via Chrome extension.",
  positioning:
    "Lusha is a credit-based contact lookup tool with a popular Chrome extension. Quick unit lookups on LinkedIn profiles, direct-dial phone numbers, straightforward pricing.",
  bestFor:
    "Individual SDRs doing account-based prospecting on LinkedIn, one contact at a time.",
  weaknesses: [
    "Credit-based pricing gets expensive in bulk; no local-business coverage to speak of.",
    "No outbound automation or audit layer.",
    "GDPR coverage flagged by EU reviewers — check compliance for your region.",
  ],
  pricing: {
    entry: "$29/mo (Pro, 5 credits/day)",
    mid: "$51/mo (Premium)",
    enterprise: "Custom (Scale)",
    freeTrial: "Free with 5 credits/mo",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 1,
    outreachAutomation: 2,
    dataFreshness: 3,
    priceForAgencies: 3,
  },
  citations: [
    {
      label: "Lusha pricing",
      url: "https://www.lusha.com/pricing",
    },
    {
      label: "Lusha GDPR coverage thread — Reddit",
      url: "https://www.reddit.com/r/sales/",
    },
  ],
  whyLeadacInstead: [
    "Bulk postcode + niche search beats one-contact-at-a-time lookups.",
    "Every Leadac lead ships with an audit — you know why to reach out before the first email.",
    "Agency-friendly flat pricing, no credit burn.",
  ],
};
