/**
 * Truth Layer contract — `PainPoint` + `Hypothesis` + `AvoidanceTopic`.
 *
 * Producer: T-D Brief Truth-Grounding (`src/lib/agent-workers/lead-intelligence-brief.ts`).
 * Consumers: T-F NBA Hygiene, IntelligenceBriefCard, BrainDossier.
 *
 * The whole point of this contract is the discriminated union on
 * `evidenceRef` — every `PainPoint` is either grounded in a quoted
 * review, an owner reply, an explicitly-missing field on the lead, or
 * marked `inferred` (in which case it MUST live in the `hypotheses[]`
 * array, not `painPoints[]`). The schema validator inside T-D rejects
 * any `painPoint` whose source is `"inferred"`.
 *
 * `Lead` is referenced as a structural type (only `keyof Lead` matters
 * here); we re-export the relevant key union below so consumers don't
 * have to import Prisma types just to read this contract.
 */

import type { Lead } from "@/generated/prisma/client";

export const __contractVersion = 1;

export type PainPointSource =
  | "review_quote"
  | "owner_reply"
  | "missing_field"
  | "inferred";

/**
 * The subset of `Lead` columns that count as "missing-field evidence".
 * This is intentionally explicit — not every nullable Lead column is a
 * pain point worth surfacing (e.g. `subNicheConfidence: null` is an
 * internal classifier signal, not customer-facing pain).
 */
export type LeadEvidenceField = Extract<
  keyof Lead,
  | "phone"
  | "websiteUrl"
  | "rating"
  | "reviewCount"
  | "googleMapsUri"
  | "businessStatus"
>;

export type PainPointEvidenceRef =
  | { kind: "review"; reviewId: string; quote: string }
  | { kind: "owner_reply"; replyId: string; quote: string }
  | { kind: "missing_field"; field: LeadEvidenceField }
  | null;

export interface PainPoint {
  claim: string;
  source: PainPointSource;
  evidenceRef: PainPointEvidenceRef;
  /** 1 = trivial, 5 = deal-breaker. */
  severity: 1 | 2 | 3 | 4 | 5;
}

/**
 * Hypothesis — same shape as `PainPoint` but explicitly marked as
 * model-inferred. Lives in a separate array so the UI can render it
 * with a "may be wrong" affordance.
 */
export interface Hypothesis {
  claim: string;
  /** Why the model thinks this is plausible — surfaced to the SDR. */
  reasoning: string;
  /** 0..1, model's self-confidence. UI hides hypotheses below 0.4. */
  confidence: number;
}

export type AvoidanceReason =
  | "owner_defensive_in_replies"
  | "negative_review_spike"
  | "competitor_relationship"
  | "regulatory_sensitive";

export interface AvoidanceTopic {
  topic: string;
  reason: AvoidanceReason;
  evidenceRef: { quote: string; sourceUrl?: string };
}
