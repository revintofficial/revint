/**
 * Shape of a competitor profile, shared by /alternatives/[slug] and the
 * /vs/* family. Every field is content-team-owned; this file stays typed
 * so the UI can't drift from the data. Add new competitors as siblings.
 */

export type CompetitorProfile = {
  slug: string;
  name: string;
  homepage: string;
  tagline: string;
  /** 30-50 word positioning statement — used in hero + meta descriptions. */
  positioning: string;
  /** What kind of buyer they serve best. */
  bestFor: string;
  /** Known weaknesses. Source in `citations`. */
  weaknesses: string[];
  /** Headline pricing, for the comparison table. Keep short. */
  pricing: {
    entry: string;
    mid?: string;
    enterprise?: string;
    freeTrial: string;
  };
  /** Per-dimension scorecard (1-5) used in comparison tables. */
  scorecard: {
    localDiscovery: number;
    websiteAudit: number;
    outreachAutomation: number;
    dataFreshness: number;
    priceForAgencies: number;
  };
  /** Sources for claims — populates the "sources" block on each page. */
  citations: Array<{
    label: string;
    url: string;
    note?: string;
  }>;
  /** Top 3 reasons a Revint-leaning buyer would switch. */
  whyRevintInstead: string[];
};

export const LEADAC_SELF: CompetitorProfile = {
  slug: "revint",
  name: "Revint",
  homepage: "https://revint.dev",
  tagline: "Postcode and a niche. Fresh local leads, audited and pitched.",
  positioning:
    "Live Google Maps discovery plus a 20-signal Playwright audit on every site, a 0-100 opportunity score, and a cold-email opener grounded in what the audit actually found.",
  bestFor:
    "Outbound agencies, SMMAs, and walk-in web agencies selling to local-service businesses.",
  weaknesses: [
    "Newer entrant, public dataset still ramping",
    "No built-in email sender (we push to Smartlead/Instantly/GHL instead)",
  ],
  pricing: {
    entry: "Free (50 leads)",
    mid: "$79/mo (1,000 leads)",
    enterprise: "$249/mo (5,000 leads, 5 seats)",
    freeTrial: "Yes, no credit card",
  },
  scorecard: {
    localDiscovery: 5,
    websiteAudit: 5,
    outreachAutomation: 3,
    dataFreshness: 5,
    priceForAgencies: 5,
  },
  citations: [
    {
      label: "Revint product overview",
      url: "https://revint.dev/",
      note: "Homepage, updated monthly",
    },
  ],
  whyRevintInstead: [
    "Per-lead website audits with screenshots beat contact-only lead lists.",
    "Cold openers reference the audit — not a persona guess.",
    "Postcode plus niche gives you the list other agencies don't already have.",
  ],
};
