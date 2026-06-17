import type { CompetitorProfile } from "./types";

export const clay: CompetitorProfile = {
  slug: "clay",
  name: "Clay",
  homepage: "https://www.clay.com",
  tagline: "Spreadsheet-first lead research automation.",
  positioning:
    "Clay is a data-enrichment spreadsheet with 70+ integrations. Power-user playbook builders stack waterfalls of providers to get the right fields. Steep learning curve, strong results when tuned.",
  bestFor:
    "B2B SaaS RevOps teams with an in-house signal engineer to babysit the waterfalls.",
  weaknesses: [
    "Credit-based pricing gets expensive fast; a simple enrichment can burn through $200 in a day.",
    "No website auditing built in — you have to wire in BuiltWith, Wappalyzer, PageSpeed credits separately.",
    "Not designed for local-service discovery. You bring your own list.",
  ],
  pricing: {
    entry: "$149/mo (Starter, 2k credits)",
    mid: "$349/mo (Explorer, 10k credits)",
    enterprise: "$800+/mo (Pro and above)",
    freeTrial: "Free tier with 100 credits",
  },
  scorecard: {
    localDiscovery: 2,
    websiteAudit: 2,
    outreachAutomation: 3,
    dataFreshness: 4,
    priceForAgencies: 2,
  },
  citations: [
    {
      label: "Clay pricing",
      url: "https://www.clay.com/pricing",
    },
    {
      label: "Clay vs Apollo comparison — Reddit",
      url: "https://www.reddit.com/r/sales/",
      note: "Ongoing threads comparing credit cost vs Apollo flat fee.",
    },
  ],
  whyRevintInstead: [
    "No waterfall to maintain. Enter a postcode and a niche; the audit runs automatically.",
    "Flat pricing beats credit-burn for agencies running 2-5k leads/mo.",
    "Purpose-built for local-service outbound, not generic SaaS enrichment.",
  ],
};
