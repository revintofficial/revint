import type { CompetitorProfile } from "./types";

export const zoominfo: CompetitorProfile = {
  slug: "zoominfo",
  name: "ZoomInfo",
  homepage: "https://www.zoominfo.com",
  tagline: "Enterprise B2B contact and intent-data database.",
  positioning:
    "ZoomInfo is the 800-pound gorilla of B2B data — 100M+ contacts, intent signals, technographics, and org charts. Annual contracts, six-figure deals, heavy sales motion.",
  bestFor:
    "Enterprise B2B sales teams with a seven-figure revenue target and a procurement process that can stomach $30k+/yr contracts.",
  weaknesses: [
    "Priced out of reach for most agencies (typically $15k-$40k/yr minimum commit).",
    "Not built for local-service discovery; poor coverage of phone repair, HVAC, dental, barber shops.",
    "Long annual contracts; slow procurement cycle.",
  ],
  pricing: {
    entry: "Custom — typically $15k/yr minimum",
    mid: "Custom",
    enterprise: "$30k-$80k+/yr",
    freeTrial: "Free lookup without contact info",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 2,
    outreachAutomation: 4,
    dataFreshness: 4,
    priceForAgencies: 1,
  },
  citations: [
    {
      label: "ZoomInfo pricing discussion — Reddit",
      url: "https://www.reddit.com/r/sales/",
      note: "Users report starting quotes of $15-40k/yr.",
    },
    {
      label: "ZoomInfo G2 reviews",
      url: "https://www.g2.com/products/zoominfo/reviews",
    },
  ],
  whyRevintInstead: [
    "Agencies selling websites don't need enterprise contact data — they need local-business discovery with site audits.",
    "Monthly pricing, no annual contract, no procurement dance.",
    "Every lead audited; ZoomInfo gives you a name, Revint gives you a name plus a pitch.",
  ],
};
