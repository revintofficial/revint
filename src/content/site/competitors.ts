/**
 * Competitor index — positioning §1.3 + §11.
 *
 * Each row carries the public hero language (so we don't paraphrase it
 * wrong), our reframe sentence, and the price floor LeadAC compares
 * against. Comparison pages and the homepage stack-position diagram both
 * read from this list.
 */

export type Competitor = {
  slug: string;
  name: string;
  /** Their public homepage hero or 1-line tagline — verbatim, dated. */
  publicTagline: string;
  publicTaglineSource: { name: string; url: string; date: string };
  /** Our one-line reframe — brand-voice rule §3. */
  reframe: string;
  /** Per-seat / per-team price floor in USD (annual). Null if unknown. */
  priceFloorAnnualUsd: number | null;
  /** Their core primitive in one verb (used in the stack-position diagram). */
  primitive: "finds" | "enriches" | "records" | "sends" | "forecasts" | "ai-sdr";
  /** Internal disposition — `compete` shipped on Day 1, `defer` later. */
  status: "compete" | "compete-bundle" | "defer";
};

export const COMPETITORS_SITE: Competitor[] = [
  {
    slug: "apollo",
    name: "Apollo",
    publicTagline:
      "The AI sales platform for smarter, faster revenue growth.",
    publicTaglineSource: {
      name: "apollo.io homepage",
      url: "https://www.apollo.io",
      date: "2026-05-22",
    },
    reframe:
      "Apollo gives you a list of contacts based on firmographic data. We give you the operational context Apollo's database does not index — location count, vertical software stack, review tone, owner activity.",
    priceFloorAnnualUsd: 1392,
    primitive: "finds",
    status: "compete",
  },
  {
    slug: "clay",
    name: "Clay",
    publicTagline:
      "Go to market with unique data — and the ability to act on it.",
    publicTaglineSource: {
      name: "clay.com homepage",
      url: "https://www.clay.com",
      date: "2026-05-22",
    },
    reframe:
      "Clay is a workshop. We are the finished tool. Clay requires a GTM engineer and burns credits unpredictably; we ship pre-built vertical signal libraries that work in under an hour.",
    priceFloorAnnualUsd: 5352,
    primitive: "enriches",
    status: "compete",
  },
  {
    slug: "gong",
    name: "Gong",
    publicTagline:
      "Gong Revenue AI OS — where humans, agents, and tools work together to optimize revenue outcomes.",
    publicTaglineSource: {
      name: "gong.io homepage",
      url: "https://www.gong.io",
      date: "2026-05-22",
    },
    reframe:
      "Gong is conversation intelligence — it remembers what your team said. We are operational intelligence — we remember what the account is doing. Gong starts at $100K per year for 25 reps and 8 weeks of onboarding. We start at $1,500 per month for 5 reps and 1 hour of onboarding.",
    priceFloorAnnualUsd: 100000,
    primitive: "records",
    status: "compete",
  },
  {
    slug: "smartlead",
    name: "Smartlead",
    publicTagline: "Unlock the full power of AI outbound.",
    publicTaglineSource: {
      name: "smartlead.ai homepage",
      url: "https://www.smartlead.ai",
      date: "2026-05-22",
    },
    reframe:
      "Smartlead sends. We tell Smartlead what to send. We hand off the per-account context that turns the send into a reply.",
    priceFloorAnnualUsd: 468,
    primitive: "sends",
    status: "defer",
  },
  {
    slug: "outreach",
    name: "Outreach",
    publicTagline:
      "You didn't hire enough sellers. Now you don't have to.",
    publicTaglineSource: {
      name: "outreach.ai homepage",
      url: "https://www.outreach.ai",
      date: "2026-05-22",
    },
    reframe:
      "Outreach is being repositioned upmarket as a revenue orchestration platform. We sit one layer below the orchestrator — operational memory for the SDR motion that still has to happen, and a price that fits a 5-seat team.",
    priceFloorAnnualUsd: 14400,
    primitive: "forecasts",
    status: "defer",
  },
  {
    slug: "11x",
    name: "11x",
    publicTagline: "Digital workers. Human results.",
    publicTaglineSource: {
      name: "11x.ai homepage",
      url: "https://www.11x.ai",
      date: "2026-05-22",
    },
    reframe:
      "11x replaces the SDR. We make the SDR you have ramp in weeks instead of months by surfacing the brief your best SDR built in their head, before they quit.",
    priceFloorAnnualUsd: 60000,
    primitive: "ai-sdr",
    status: "defer",
  },
];

/** Brand-line shape — `Apollo finds. Clay enriches. Gong records. LeadAC remembers.` */
export const STACK_LINE = [
  { slug: "apollo", verb: "finds" },
  { slug: "clay", verb: "enriches" },
  { slug: "gong", verb: "records" },
  { slug: "leadac", verb: "remembers" },
] as const;

/** Helper — find a competitor by slug (throws if missing so pages fail loudly). */
export function getCompetitor(slug: string): Competitor {
  const c = COMPETITORS_SITE.find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown competitor slug: ${slug}`);
  return c;
}
