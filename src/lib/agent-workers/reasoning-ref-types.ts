/**
 * Single source of truth for `SemanticMemory.refType` values that the
 * SDR-Brain T2/T3 layer uses for `REASONING_SUMMARY` rows.
 *
 * Background — Phase 0 hot-fix (see `research/sdr-brain-v2-PLAN`):
 *   T2 worker writers and the T3 `runSdrBrainPass` reader had diverging
 *   casing (`"BANT_INFERRER"` vs `"BantInferrer"`), which silently
 *   dropped every BANT + insight summary on the floor. Every brain
 *   writer now imports the constant from this module, and the reader
 *   does the same — typo + casing drift cannot recur without a TS
 *   compile error.
 *
 * Convention: PascalCase, mirrors the worker class name. Do NOT switch
 * to SCREAMING_SNAKE_CASE without migrating existing memory rows.
 */

export const REASONING_SUMMARY_REF_TYPES = {
  BantInferrer: "BantInferrer",
  WhyNowSynthesizer: "WhyNowSynthesizer",
  CommercialInsightMatcher: "CommercialInsightMatcher",
  BuyingCommitteeMapper: "BuyingCommitteeMapper",
  ObjectionPredictor: "ObjectionPredictor",
} as const;

export type ReasoningSummaryRefType =
  (typeof REASONING_SUMMARY_REF_TYPES)[keyof typeof REASONING_SUMMARY_REF_TYPES];
