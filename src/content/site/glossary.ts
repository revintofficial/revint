/**
 * Whitespace glossary — brand-assets §4.2 Tier 2 keywords.
 *
 * Each term gets its own /glossary/[slug] page. The /glossary index links
 * across the set. brand-assets §3.4 marketing-ideas #5 (glossary marketing)
 * makes this the AEO citation magnet for unowned vocabulary.
 *
 * Definitions are 1 sentence (oneSentence) for AEO extraction + 1 paragraph
 * (definition) for the page body. Related slugs cross-link.
 */

export type GlossaryTerm = {
  slug: string;
  term: string;
  oneSentence: string;
  definition: string;
  related: string[]; // other slugs
  /** Page on the site where the term is the primary topic. */
  primaryPage: string;
  /** Persona who searches this term first. */
  persona: "daniel" | "mike" | "revops";
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "operational-intelligence",
    term: "Operational intelligence",
    oneSentence:
      "Knowing what an account is actually doing in the world — reviews, location count, vertical software stack, owner activity — distinct from conversation intelligence.",
    definition:
      "Operational intelligence is the category of sales intelligence that indexes public, observable signals about an account: how many locations it operates, which vertical software it installed, the tone of its recent reviews, whether its owner has updated their Google Business Profile in the last 60 days. It sits next to conversation intelligence (Gong, Chorus) and firmographic data (Apollo, ZoomInfo) but on a different substrate. Operational intelligence answers the question 'should we call this account today, and what angle works?', while conversation intelligence answers 'what did our team say, and what should we say next?'.",
    related: [
      "memory-layer-for-vertical-saas",
      "vertical-aware-account-discovery",
      "closed-loop-icp-refinement",
    ],
    primaryPage: "/manifesto",
    persona: "daniel",
  },
  {
    slug: "memory-layer-for-vertical-saas",
    term: "Memory layer for vertical SaaS",
    oneSentence:
      "A CRM-native store of what works in a vertical that survives SDR turnover, territory changes, and new-vertical expansion.",
    definition:
      "A memory layer for vertical SaaS is the system that captures the pattern your best SDR built in their head — why a multi-location HVAC group on Housecall Pro converts faster than a single-shop competitor — and writes it into the CRM as a structured signal so the next SDR doesn't rebuild it from zero. The substrate is operational data on the account (location count, vertical software stack, review tone) plus closed-loop CRM outcomes (won/lost reasons), tied together by per-vertical pattern matching. The output is a pre-call brief inside the HubSpot card before the SDR dials.",
    related: [
      "operational-intelligence",
      "closed-loop-icp-refinement",
      "pre-call-brief-in-hubspot",
    ],
    primaryPage: "/manifesto",
    persona: "daniel",
  },
  {
    slug: "closed-loop-icp-refinement",
    term: "Closed-loop ICP refinement",
    oneSentence:
      "The pattern where every won and lost deal automatically sharpens the next account list, instead of the SDR manually re-tagging accounts.",
    definition:
      "Closed-loop ICP refinement is a system pattern that takes deal outcomes from the CRM (closed-won, closed-lost, lost reason, time-to-close, ACV) and feeds them back into the discovery model so the next list of accounts skews toward the patterns that closed and away from the patterns that lost. Without closed-loop refinement, the ICP definition lives in a spreadsheet that gets re-written every quarter by whoever has time; with it, the definition is a live model that adjusts weekly based on what your CRM actually saw close.",
    related: [
      "memory-layer-for-vertical-saas",
      "vertical-aware-account-discovery",
      "account-intelligence-for-vertical-saas",
    ],
    primaryPage: "/resources/closed-loop-icp-refinement",
    persona: "daniel",
  },
  {
    slug: "vertical-aware-account-discovery",
    term: "Vertical-aware account discovery",
    oneSentence:
      "Discovery that indexes vertical software signatures, location count, and owner activity — instead of LinkedIn firmographic data.",
    definition:
      "Vertical-aware account discovery is account discovery tuned to a specific vertical's signal vocabulary. For restaurant tech that means OpenTable, Toast, Resy, Square footer detection plus reservation-flow quality assessment. For field service software it means ServiceTitan, Jobber, Housecall Pro signature detection plus multi-location operator identification. The discovery model knows what 'a good account looks like' for each vertical, instead of running the same firmographic filter regardless of who you sell to.",
    related: [
      "account-intelligence-for-vertical-saas",
      "operational-intelligence",
      "closed-loop-icp-refinement",
    ],
    primaryPage: "/for/field-service-saas",
    persona: "mike",
  },
  {
    slug: "pre-call-brief-in-hubspot",
    term: "Pre-call brief in HubSpot",
    oneSentence:
      "A one-screen brief on each account that lives inside the HubSpot contact card before the SDR dials.",
    definition:
      "A pre-call brief is the structured summary an SDR reads in the 30 seconds before they dial — who the account is, what they're doing now, which vertical software they installed, what just changed, and the suggested opening angle. In Revint, the pre-call brief lives inside the HubSpot contact card as a custom-property block, so the SDR doesn't have to open another app or tab to read it. The shape is: account context (3 lines), top 3 signals (mono data cells), and one suggested opener (2 sentences).",
    related: [
      "memory-layer-for-vertical-saas",
      "operational-intelligence",
      "crm-native-account-enrichment",
    ],
    primaryPage: "/integrations/hubspot",
    persona: "mike",
  },
  {
    slug: "audit-grade-outbound",
    term: "Audit-grade outbound",
    oneSentence:
      "Outbound where every account decision, signal, and outcome is auditable — for compliance and for learning.",
    definition:
      "Audit-grade outbound is outbound where the trail of decisions — why was this account on the list, why did the SDR pick this angle, what was the signal that triggered the call, what was the outcome — is captured as structured data, not lost to memory or a Slack thread. The compliance dimension matters for regulated verticals (legal, dental, healthcare-adjacent); the learning dimension matters for every team, because audit-grade outbound is the precondition for closed-loop ICP refinement.",
    related: [
      "closed-loop-icp-refinement",
      "operational-intelligence",
      "crm-native-account-enrichment",
    ],
    primaryPage: "/security",
    persona: "revops",
  },
  {
    slug: "account-intelligence-for-vertical-saas",
    term: "Account intelligence for vertical SaaS",
    oneSentence:
      "Context specific to local-business verticals — review tone, booking flow, vertical software stack — that Apollo and ZoomInfo cannot index.",
    definition:
      "Account intelligence for vertical SaaS is the per-account context that matters when your buyer is a local business operator, not a desk worker with a LinkedIn profile. Apollo and ZoomInfo are built on firmographic data — industry code, employee count, tech stack scraped from LinkedIn — which is shallow for local businesses. Account intelligence for vertical SaaS adds the operational layer: vertical software footprint, location count, review pattern, owner activity, booking flow quality. The output makes the difference between an Apollo list with a 12% bounce rate and a list where the SDR can open with 'I noticed you just added the second location on Resy.'",
    related: [
      "operational-intelligence",
      "vertical-aware-account-discovery",
      "memory-layer-for-vertical-saas",
    ],
    primaryPage: "/for/restaurant-tech-saas",
    persona: "daniel",
  },
  {
    slug: "crm-native-account-enrichment",
    term: "CRM-native account enrichment",
    oneSentence:
      "Enrichment that writes 12 fields directly into the CRM contact and company records — not a separate dashboard.",
    definition:
      "CRM-native account enrichment is enrichment that lives inside the CRM the SDR already uses, instead of in a separate enrichment dashboard that the SDR has to remember to open. In Revint, enrichment writes 12 fields per account into HubSpot company properties (location_count, vertical_stack_signature, review_tone, owner_activity_score, etc.) so they show up in the same contact card the SDR opens to dial. CRM-native enrichment is what closes the gap between 'we bought an enrichment tool' and 'the SDR actually used the enrichment data.'",
    related: [
      "pre-call-brief-in-hubspot",
      "memory-layer-for-vertical-saas",
      "operational-intelligence",
    ],
    primaryPage: "/integrations/hubspot",
    persona: "mike",
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm {
  const t = GLOSSARY.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown glossary slug: ${slug}`);
  return t;
}
