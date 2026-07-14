/**
 * Single source of truth for `SemanticMemory.refType` values that the
 * brief uses for `REASONING_SUMMARY` rows.
 *
 * V2-cleanup — only WHY_NOW_SYNTHESIZER survives. BantInferrer,
 * CommercialInsightMatcher, BuyingCommitteeMapper, and
 * ObjectionPredictor refType constants were removed along with their
 * workers (V2 enterprise residue that produced empty or copy-paste
 * output for SMB restaurant-tech sales).
 *
 * Convention: PascalCase, mirrors the worker class name. Do NOT switch
 * to SCREAMING_SNAKE_CASE without migrating existing memory rows.
 */

export const REASONING_SUMMARY_REF_TYPES = {
  WhyNowSynthesizer: "WhyNowSynthesizer",
} as const;

export type ReasoningSummaryRefType =
  (typeof REASONING_SUMMARY_REF_TYPES)[keyof typeof REASONING_SUMMARY_REF_TYPES];
