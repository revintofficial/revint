/**
 * Keyword & positioning dataset — mined from live competitor sites (June 2026).
 *
 * Single source of truth for the "Operational Revenue Intelligence for SMB
 * Markets" positioning. Copy on the homepage, metadata builder, FAQ, and
 * future `/vs` bundle pages should reference this file rather than
 * re-deriving the language.
 *
 * Three buckets:
 *
 *   1. OWNED_BY_COMPETITORS — verbatim hero language each player claims.
 *      Do NOT paraphrase into LeadAC copy; if a buyer reads it on our site
 *      and on theirs, the one they read first wins the association.
 *   2. COMMODITY — table-stakes vocabulary every player uses. Safe to use,
 *      but it does not differentiate. Never lead a hero with these.
 *   3. WHITE_SPACE — the words nobody owns yet that fit our frame. These
 *      are the wedge words. Lead with them, repeat them across surfaces,
 *      reinforce them in FAQ + vertical pages.
 *
 * Avoid list is enforced loosely — copy reviewers should grep against
 * AVOID_PHRASES before shipping new pages.
 */

export type KeywordSource = {
  /** Competitor name (display). */
  competitor: string;
  /** Public URL the phrase was lifted from. */
  url: string;
  /** ISO date the page was captured. */
  capturedAt: string;
};

export type OwnedPhrase = {
  /** Verbatim hero / category phrase the competitor uses. */
  phrase: string;
  /** What that phrase positions them as, in our words. */
  positioning: string;
  source: KeywordSource;
};

export type WhiteSpacePhrase = {
  phrase: string;
  /** Why no incumbent owns it yet. */
  rationale: string;
  /** How LeadAC should use it (hero, eyebrow, subhead, FAQ, etc.). */
  usage: string;
};

/**
 * What each competitor's homepage already claims (June 2026 capture).
 * Treat these as no-fly zones — if our copy rhymes too closely with one
 * of these phrases, the buyer will assume we are a knockoff.
 */
export const OWNED_BY_COMPETITORS: OwnedPhrase[] = [
  {
    phrase: "Everything you need to sell to SMBs",
    positioning:
      "Orbital's master claim — SMB account intelligence as the whole category.",
    source: {
      competitor: "Orbital",
      url: "https://www.withorbital.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "SMB account intelligence",
    positioning:
      "Orbital's category label. Almost the phrase we considered owning — don't try.",
    source: {
      competitor: "Orbital",
      url: "https://www.withorbital.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "200+ SMB-specific attributes",
    positioning:
      "Orbital's data-depth proof point. Quantified attribute count is their lane.",
    source: {
      competitor: "Orbital",
      url: "https://www.withorbital.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "For companies underserved by ZoomInfo",
    positioning: "Orbital's anti-incumbent line.",
    source: {
      competitor: "Orbital",
      url: "https://www.withorbital.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "AI models trained on SMB buying behavior",
    positioning:
      "Orbital's ML / signal claim. Reinforces them as the up-stack SMB intelligence layer.",
    source: {
      competitor: "Orbital",
      url: "https://www.withorbital.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "The AI platform for selling to local businesses",
    positioning: "Resquared's master claim — selling-to-locals as the category.",
    source: {
      competitor: "Resquared",
      url: "https://www.re2.ai/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Data on over 12 million local businesses",
    positioning: "Resquared's database scale claim.",
    source: {
      competitor: "Resquared",
      url: "https://www.re2.ai/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Local business lead data platform",
    positioning:
      "Openmart's category. Pure data-rail framing — they sell access to records.",
    source: {
      competitor: "Openmart",
      url: "https://www.openmart.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "200M+ verified contacts",
    positioning: "Openmart's scale claim.",
    source: {
      competitor: "Openmart",
      url: "https://www.openmart.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Tells reps where to focus and what to do next",
    positioning:
      "Pocus's wedge sentence. Owns 'what to do next' for PLG / product-usage buyers.",
    source: {
      competitor: "Pocus",
      url: "https://www.pocus.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Opinionated guidance, not more signals",
    positioning: "Pocus's anti-signal-noise line.",
    source: {
      competitor: "Pocus",
      url: "https://www.pocus.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Clear next steps, not vague suggestions",
    positioning: "Pocus's prescription line.",
    source: {
      competitor: "Pocus",
      url: "https://www.pocus.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "AI-native go-to-market platform for buyer intelligence and action",
    positioning:
      "Common Room's master claim. Owns 'buyer intelligence' as the broad GTM category.",
    source: {
      competitor: "Common Room",
      url: "https://www.commonroom.io/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Identify, prioritize, and act on the right buyers with precision",
    positioning: "Common Room's three-verb structure.",
    source: {
      competitor: "Common Room",
      url: "https://www.commonroom.io/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "GTM Intelligence That Actually Converts",
    positioning:
      "HockeyStack's master claim. Owns enterprise GTM intelligence + attribution.",
    source: {
      competitor: "HockeyStack",
      url: "https://www.hockeystack.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Blueprints",
    positioning:
      "HockeyStack's name for the won-deal learning pattern. Enterprise version of our memory thesis.",
    source: {
      competitor: "HockeyStack",
      url: "https://www.hockeystack.com/",
      capturedAt: "2026-06-16",
    },
  },
  {
    phrase: "Account Pre-Call Brief",
    positioning:
      "HockeyStack's agent surface name. Same surface concept, enterprise pricing.",
    source: {
      competitor: "HockeyStack",
      url: "https://www.hockeystack.com/",
      capturedAt: "2026-06-16",
    },
  },
];

/**
 * Commodity vocabulary every player uses. Safe but does not differentiate.
 */
export const COMMODITY_WORDS: string[] = [
  "AI",
  "signals",
  "enrichment",
  "account intelligence",
  "prioritize",
  "pipeline",
  "GTM",
  "verified contacts",
  "buyer intent",
  "outbound",
];

/**
 * Phrases to AVOID in LeadAC copy. Either claimed by a competitor or
 * commoditized to the point of being a deliverability liability.
 */
export const AVOID_PHRASES: Array<{ phrase: string; why: string }> = [
  {
    phrase: "SMB account intelligence",
    why: "Orbital's near-verbatim category. Using it positions us as a knockoff.",
  },
  {
    phrase: "Selling to local businesses",
    why: "Orbital + Resquared both lead with this. Too crowded.",
  },
  {
    phrase: "Local business data",
    why: "Openmart's category — data-rail commodity, race to the bottom on price.",
  },
  {
    phrase: "AI lead generation",
    why: "Commoditized. Saturated keyword, low trust, attracts wrong buyers.",
  },
  {
    phrase: "Apollo for local",
    why: "Now Orbital / Openmart / Resquared territory. Yesterday's wedge.",
  },
  {
    phrase: "Revenue intelligence",
    why: "Unqualified, reads as Gong / Clari / HockeyStack enterprise. Always qualify with 'for SMB markets'.",
  },
  {
    phrase: "AI SDR",
    why: "11x / Artisan / AiSDR own the saturated AI-agent lane. Not our promise.",
  },
  {
    phrase: "Digital workers",
    why: "11x's phrase. Reads as full SDR replacement, opposite of our positioning.",
  },
  {
    phrase: "Buyer intelligence",
    why: "Common Room's category. Reads as broad PLG/community GTM, not SMB-vertical.",
  },
];

/**
 * White space — the wedge words LeadAC should own and repeat.
 * These are the phrases that should appear in the hero, the eyebrow, the
 * meta description, the FAQ answers, and every vertical landing.
 */
export const WHITE_SPACE: WhiteSpacePhrase[] = [
  {
    phrase: "Operational revenue intelligence for SMB markets",
    rationale:
      "The qualified category. 'Revenue intelligence' alone reads as enterprise (Gong/Clari/HockeyStack). The 'for SMB markets' qualifier makes it specific enough to dodge the enterprise read while still claiming the up-stack position.",
    usage: "Hero eyebrow. Meta title. Manifesto opener. /about category line.",
  },
  {
    phrase: "Remembers what closes",
    rationale:
      "Gong only says 'records'. HockeyStack's 'Blueprints' is enterprise. Nobody markets the memory framing for SMB / local-business markets — open lane.",
    usage:
      "Hero headline. Stack-position diagram (LeadAC's verb stays 'remembers'). Recurring brand line.",
  },
  {
    phrase: "The next best revenue action",
    rationale:
      "Pocus owns 'what to do next' but only for PLG / product-usage buyers. The local-business / SMB version of next-best-action is unclaimed.",
    usage:
      "Hero subhead. Brief-card 'recommended next action' block. CTA framing on `/demo`.",
  },
  {
    phrase: "Learns what converts in your vertical",
    rationale:
      "HockeyStack's 'Blueprint' learns enterprise revenue patterns. Vertical-specific SMB learning (restaurants, HVAC, dental, beauty) is wide open.",
    usage: "Closed-loop diagram subtitle. /for/<vertical> hero variants.",
  },
  {
    phrase: "Which source do you trust when they disagree",
    rationale:
      "Source provenance + conflict resolution. Nobody markets this — pure white space and matches the JTBD 'reps don't trust the data' frustration.",
    usage:
      "Future homepage section (deferred until product proof). FAQ answer for stack-overlap objections today.",
  },
  {
    phrase: "Bring your stack, we make it remember",
    rationale:
      "Status-quo antidote framing. Defuses switching cost / sunk-cost objection that Orbital / Openmart customers will raise.",
    usage:
      "Stack-position diagram subtitle. Pricing page intro. Demo CTA microcopy.",
  },
  {
    phrase: "Inside the HubSpot card your SDR already opens",
    rationale:
      "Surface specificity. Pocus says 'embedded in your tools' generically; we name the exact card. HubSpot is the only integration we claim live, which keeps this defensible.",
    usage: "Subhead. Brief-card chrome label. /integrations/hubspot hero.",
  },
];

/**
 * Canonical positioning sentence — the one line everything else should
 * rhyme with. Update here, then update the homepage hero + meta + manifesto.
 */
export const CANONICAL_SENTENCE =
  "Operational revenue intelligence for SMB markets — the memory layer that learns what closes in local-business markets and tells your reps the next best action, inside the HubSpot card they already open.";

/**
 * The four-column stack-position line, in canonical word order.
 * The diagram component reads this; do not re-spell the verbs elsewhere.
 */
export const STACK_VERBS = {
  apollo: "finds",
  clay: "enriches",
  gong: "records",
  leadac: "remembers",
} as const;
