/**
 * BANT 4-bar deriver for Lead Detail v2.
 *
 * Two ingredients:
 *
 *   1. The pure `deriveBuyingReadiness()` from
 *      `src/lib/sdr-brain/buying-readiness.ts`. That function is the
 *      canonical numeric source for B/A/N/T scores; the schema
 *      comment at `prisma/schema.prisma:1599` explicitly says BANT
 *      is "a pure derive — no table; recomputed on read."
 *
 *   2. Any matching `DealQualificationFact` rows whose `fieldPath`
 *      starts with `budget.` / `authority.` / `need.` / `timing.`.
 *      These optional facts carry source quotes that the v2 BANT bars
 *      surface as inline evidence chips (RETHINK §4.4 — drop hover-
 *      only tooltips for always-visible chips).
 *
 * The buying-readiness scores are kept as the "score" axis. The
 * matched DealQualificationFact rows become the "evidence" axis. If
 * neither numeric input nor evidence exists for a dimension, the
 * status is "missing" with score 0 and the UI hints to run discovery.
 */

import type { BuyingReadiness } from "@/lib/sdr-brain/buying-readiness";

export type BantStatus = "present" | "partial" | "missing";

export interface BantEvidenceRef {
  factId: string;
  fieldPath: string;
  sourceQuote: string | null;
  confidence: number;
}

export interface BantBar {
  score: number;
  status: BantStatus;
  evidence: BantEvidenceRef[];
}

export interface BantBars {
  budget: BantBar;
  authority: BantBar;
  need: BantBar;
  timing: BantBar;
  overall: number;
}

export interface BantFactInput {
  id: string;
  fieldPath: string;
  sourceQuote: string | null;
  confidence: number;
  supersededAt: Date | null;
}

const FIELD_PREFIXES: ReadonlyArray<keyof Omit<BantBars, "overall">> = [
  "budget",
  "authority",
  "need",
  "timing",
];

function classify(score: number, evidenceCount: number): BantStatus {
  if (score >= 60 || evidenceCount >= 1) return "present";
  if (score >= 30) return "partial";
  return "missing";
}

function pickEvidenceFor(
  facts: BantFactInput[],
  prefix: string,
): BantEvidenceRef[] {
  return facts
    .filter((f) => f.supersededAt == null)
    .filter((f) => f.fieldPath.toLowerCase().startsWith(`${prefix}.`))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((f) => ({
      factId: f.id,
      fieldPath: f.fieldPath,
      sourceQuote: f.sourceQuote,
      confidence: f.confidence,
    }));
}

export function deriveBantBars(
  buyingReadiness: BuyingReadiness,
  facts: BantFactInput[],
): BantBars {
  const result: Partial<BantBars> = {};
  for (const dim of FIELD_PREFIXES) {
    const score = buyingReadiness[dim];
    const evidence = pickEvidenceFor(facts, dim);
    result[dim] = {
      score,
      status: classify(score, evidence.length),
      evidence,
    };
  }
  return {
    budget: result.budget!,
    authority: result.authority!,
    need: result.need!,
    timing: result.timing!,
    overall: buyingReadiness.overall,
  };
}
