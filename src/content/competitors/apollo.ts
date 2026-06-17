import type { CompetitorProfile } from "./types";

export const apollo: CompetitorProfile = {
  slug: "apollo",
  name: "Apollo.io",
  homepage: "https://www.apollo.io",
  tagline: "B2B contact database + email sequencer.",
  positioning:
    "Apollo is a 275M-contact B2B database with an email sequencer glued on top. Every outbound agency starts there. After three years of shared use, most contact lists in Apollo are saturated and response rates have cratered.",
  bestFor:
    "Large B2B SaaS outbound teams with defined personas and a well-tuned sequencer.",
  weaknesses: [
    "Contact data, not local-business data — weak coverage of phone-repair shops, HVAC, dental, walk-in-first verticals.",
    "Same contacts everyone else is mailing. Reddit threads on r/sales reference burnout rates of 0.2-0.5% reply.",
    "No website audits, no per-lead pitch angle, no visual mockups.",
  ],
  pricing: {
    entry: "$49/user/mo (Basic)",
    mid: "$79/user/mo (Professional)",
    enterprise: "$119/user/mo (Organization)",
    freeTrial: "Free tier with 600 emails/mo",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 1,
    outreachAutomation: 5,
    dataFreshness: 3,
    priceForAgencies: 3,
  },
  citations: [
    {
      label: "Apollo pricing page",
      url: "https://www.apollo.io/pricing",
    },
    {
      label: "r/sales — Apollo burnout thread",
      url: "https://www.reddit.com/r/sales/",
      note: "Search 'apollo reply rates' for recurring reports of 0.2-0.5% reply rate on saturated lists.",
    },
    {
      label: "G2 reviews — Apollo",
      url: "https://www.g2.com/products/apollo-io/reviews",
    },
  ],
  whyRevintInstead: [
    "You get the local list other agencies haven't hit — fresh Google Maps, not recycled contacts.",
    "Every lead ships with a website audit. Your first email references a real finding, not a persona guess.",
    "Postcode + niche specifies exactly which agencies already won't have seen these leads.",
  ],
};
