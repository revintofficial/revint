/**
 * SDR Brain v2 — deterministic contradiction detection (T3 pre-pass).
 *
 * Before SDR_BRAIN calls Gemini for arbitration, this module scans the
 * collected T2 reasoner summaries for known conflict patterns. The
 * detector is intentionally rule-based (~12 codes) so the LLM only has
 * to RESOLVE conflicts, never DISCOVER them — discovery is a fragile
 * task to delegate to a non-deterministic model and the rules also act
 * as a regression baseline ("we expect X conflicts on this fixture").
 *
 * Adding a new rule:
 *   1. Append to `CONTRADICTION_RULES` with a stable string code
 *      (UPPER_SNAKE).
 *   2. The rule's `detect` function returns null when there is no
 *      conflict, or a `ContradictionEvidence` describing the pair of
 *      conflicting node ids and a short human reason.
 *   3. Add a unit test in `contradictions.test.ts`.
 *
 * The rule code lives in the produced `ContradictionRecord.code` so
 * dashboards can compute "which contradiction pattern fires the most
 * often per niche" — useful when tuning T2 prompts.
 */
import type { LeadTriggerType } from "@/generated/prisma/client";

/**
 * Loose shape the brief passes to the detector. Each field is the
 * already-summarised T2 output (NOT the full reasoner detail) so the
 * detector stays hot-path-friendly. Fields are nullable because not
 * every workspace runs every T2 reasoner (FREE plan tier filtering).
 *
 * V2-cleanup — `bant`, `committee`, `insights`, and `objectionsPredicted`
 * were removed along with the BANT_INFERRER / BUYING_COMMITTEE_MAPPER /
 * COMMERCIAL_INSIGHT_MATCHER / OBJECTION_PREDICTOR workers. The
 * remaining rules cover the contradictions that matter for SMB
 * restaurant-tech sales (ICP fit vs audit gap, opportunity score vs
 * review density, trigger-overlap inconsistencies).
 */
export interface T2Snapshot {
  whyNow: {
    urgency: number; // 0..100
    headline: string;
  } | null;
  scorer: {
    opportunityScore: number; // 0..100
    icpFit: number | null;
  } | null;
  triggers: Array<{
    id: string;
    type: LeadTriggerType;
    severity: number;
    confidence: number;
  }>;
  audit: {
    checklistScorePct: number | null;
    hasBookingSystem: boolean | null;
    hasEcommerce: boolean | null;
  } | null;
  lead: {
    priceLevel: number | null;
    reviewCount: number | null;
    rating: number | null;
  };
}

export interface ContradictionEvidence {
  fromNodeId: string;
  toNodeId: string;
  reason: string;
}

interface ContradictionRule {
  code: string;
  /** Returns evidence if the rule fires, null otherwise. */
  detect: (s: T2Snapshot) => ContradictionEvidence | null;
}

/**
 * Helper to flatten `nullable <= threshold` checks. The matching
 * `ge` was inlined into rules that needed it; only `le` is currently
 * shared so it stays here.
 */
function le(value: number | null | undefined, threshold: number): boolean {
  return value != null && value <= threshold;
}

export const CONTRADICTION_RULES: ContradictionRule[] = [
  {
    code: "ICP_FIT_VS_AUDIT_FAIL",
    detect: (s) => {
      if (!s.scorer || s.scorer.icpFit == null || !s.audit) return null;
      if (s.scorer.icpFit >= 80 && le(s.audit.checklistScorePct, 40)) {
        return {
          fromNodeId: "icp.score",
          toNodeId: "audit.checklist",
          reason: `ICP fit ${s.scorer.icpFit} but audit checklist only ${s.audit.checklistScorePct}% — either ICP is too lax or website signals are stale.`,
        };
      }
      return null;
    },
  },
  {
    code: "OPPORTUNITY_SCORE_VS_LOW_REVIEWS",
    detect: (s) => {
      if (!s.scorer) return null;
      if (s.scorer.opportunityScore >= 80 && le(s.lead.reviewCount, 5)) {
        return {
          fromNodeId: "scorer.opportunity",
          toNodeId: "lead.reviews",
          reason: `Opportunity score ${s.scorer.opportunityScore} but only ${s.lead.reviewCount ?? 0} reviews — low signal density for a high-confidence prediction.`,
        };
      }
      return null;
    },
  },
  {
    code: "RATING_DROP_VS_BAD_SERVICE_REVIEWS_OVERLAP",
    detect: (s) => {
      const ratingDrop = s.triggers.find((t) => t.type === "RATING_DROP");
      const badService = s.triggers.find((t) => t.type === "BAD_SERVICE_REVIEWS");
      if (!ratingDrop || !badService) return null;
      // If both are detected with conflicting severities (one says
      // critical, the other says mild) flag for arbitration.
      if (Math.abs(ratingDrop.severity - badService.severity) >= 40) {
        return {
          fromNodeId: `trigger.${ratingDrop.id}`,
          toNodeId: `trigger.${badService.id}`,
          reason: `Two related triggers disagree on severity: RATING_DROP=${ratingDrop.severity} vs BAD_SERVICE_REVIEWS=${badService.severity}.`,
        };
      }
      return null;
    },
  },
  {
    code: "NEW_LOCATION_OPENING_VS_NO_HIRING",
    detect: (s) => {
      const opening = s.triggers.find((t) => t.type === "NEW_LOCATION_OPENING");
      const hiringOps = s.triggers.find((t) => t.type === "HIRING_OPS");
      const hiringTech = s.triggers.find((t) => t.type === "HIRING_TECH");
      if (opening && !hiringOps && !hiringTech) {
        return {
          fromNodeId: `trigger.${opening.id}`,
          toNodeId: "triggers.hiring",
          reason: `NEW_LOCATION_OPENING detected but no HIRING_OPS or HIRING_TECH evidence — usually openings come with a hiring spike.`,
        };
      }
      return null;
    },
  },
  {
    code: "HAS_BOOKING_SYSTEM_VS_BOOKING_PROVIDER_TRIGGER",
    detect: (s) => {
      const change = s.triggers.find((t) => t.type === "BOOKING_PROVIDER_CHANGE");
      if (!change || !s.audit) return null;
      if (s.audit.hasBookingSystem === false) {
        return {
          fromNodeId: `trigger.${change.id}`,
          toNodeId: "audit.hasBookingSystem",
          reason: `BOOKING_PROVIDER_CHANGE trigger fired but audit shows no booking system installed.`,
        };
      }
      return null;
    },
  },
];

export interface DetectContradictionsResult {
  code: string;
  fromNodeId: string;
  toNodeId: string;
  reason: string;
}

/**
 * Runs every rule against the snapshot. Returns the raw detection
 * list; SDR_BRAIN feeds this into the Gemini arbitration prompt and
 * also seeds the `LeadNextAction.arbitrationRecords` Json column.
 *
 * Pure function — safe to call in tests, in workers, and on the
 * server-rendered "Why?" preview.
 */
export function detectContradictions(snapshot: T2Snapshot): DetectContradictionsResult[] {
  const out: DetectContradictionsResult[] = [];
  for (const rule of CONTRADICTION_RULES) {
    const evidence = rule.detect(snapshot);
    if (evidence) out.push({ code: rule.code, ...evidence });
  }
  return out;
}
