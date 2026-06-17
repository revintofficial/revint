import type { CompetitorProfile } from "./types";

export const leadForensics: CompetitorProfile = {
  slug: "lead-forensics",
  name: "Lead Forensics",
  homepage: "https://www.leadforensics.com",
  tagline: "Reverse-IP visitor identification for your website.",
  positioning:
    "Lead Forensics identifies the companies visiting your website by reverse-IP lookup. Useful for inbound sales; useless for cold outbound, because it only works on traffic you already have.",
  bestFor:
    "B2B SaaS companies with existing inbound traffic and an SDR team to follow up on unidentified visitors.",
  weaknesses: [
    "Only works post-visit. You can't source cold leads.",
    "Reverse-IP accuracy drops to ~30-50% outside large enterprises.",
    "Expensive annual contracts; aggressive retention sales motion.",
  ],
  pricing: {
    entry: "Custom — typically £6k+/yr",
    mid: "Custom",
    enterprise: "£15k-£40k+/yr",
    freeTrial: "Free trial with sample visitors",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 1,
    outreachAutomation: 2,
    dataFreshness: 3,
    priceForAgencies: 1,
  },
  citations: [
    {
      label: "Lead Forensics G2 reviews",
      url: "https://www.g2.com/products/lead-forensics/reviews",
    },
    {
      label: "Lead Forensics contract-lock discussion",
      url: "https://www.reddit.com/r/sales/",
    },
  ],
  whyRevintInstead: [
    "Lead Forensics waits for visitors. Revint goes and finds them — postcode + niche returns 47 fresh targets in five minutes.",
    "Every Revint lead arrives audited; Lead Forensics gives you a company name with no context.",
    "Flat monthly pricing, cancel anytime — no multi-year lock-in.",
  ],
};
