import type { CompetitorProfile } from "./types";

export const lemlist: CompetitorProfile = {
  slug: "lemlist",
  name: "Lemlist",
  homepage: "https://www.lemlist.com",
  tagline: "Personalized cold email with dynamic image tokens.",
  positioning:
    "Lemlist pioneered image personalization in cold email — swap screenshots, names, or logos into outgoing messages. Strong UX, popular with European SaaS teams and solo operators.",
  bestFor:
    "Solo founders and small teams selling to SMBs with a narrative-heavy cold email style.",
  weaknesses: [
    "Image personalization fatigue — prospects now recognize the format and discount it.",
    "No lead discovery layer: you bring the list.",
    "Pricing scales awkwardly for agencies managing multiple client workspaces.",
  ],
  pricing: {
    entry: "$39/user/mo (Email Starter)",
    mid: "$79/user/mo (Email Pro)",
    enterprise: "$159/user/mo (Multichannel Expert)",
    freeTrial: "14-day free trial",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 2,
    outreachAutomation: 4,
    dataFreshness: 3,
    priceForAgencies: 3,
  },
  citations: [
    {
      label: "Lemlist pricing",
      url: "https://www.lemlist.com/pricing",
    },
    {
      label: "Lemlist image personalization — case studies",
      url: "https://www.lemlist.com/case-studies",
    },
  ],
  whyLeadacInstead: [
    "Audit-grounded openers land on substance, not a token-swapped image.",
    "Postcode + niche discovery gives you a list Lemlist can't generate.",
    "Leadac can push to Lemlist or any other sender you already use.",
  ],
};
