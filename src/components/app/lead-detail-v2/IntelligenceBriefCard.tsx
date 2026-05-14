"use client";

/**
 * IntelligenceBriefCard — Phase 2.5.
 *
 * Top-of-block card inside `QualificationBlock`. Reads
 * `decision-surface.intelligenceBrief` (cached output of the
 * LEAD_INTELLIGENCE_BRIEF agent worker) and renders the headline +
 * salesConfidence + up-to-3 painPoints. Empty state hides the card.
 *
 * "Open full brief →" deep-links to the Phase 7 reasoning route once
 * it ships. Until then the link is rendered as a `<button disabled>`
 * with an aria-tooltip explaining the path. We avoid 404s by checking
 * for the run id (so the link only appears when there's something
 * to point at).
 *
 * Phase 7 (V-L) — every claim rendered here is wrapped in
 * `ClaimWithEvidence` so the "claim · chip" pattern is enforced
 * uniformly across the lead detail page (RETHINK §4.4 — no "Why?"
 * link; first-paint inline evidence). The headline and each pain
 * point become a claim node, with a `prior-nba`-typed evidence chip
 * pointing back to the cached `LEAD_INTELLIGENCE_BRIEF` run via the
 * reasoning route. T-D (Wave 2 — Brief Truth-Grounding) will reshape
 * the underlying data flow (quote-grounded pain points, hypothesis
 * count, website-claim blocking) and is expected to rebase on top
 * of this surgical wrap.
 *
 * Backward-compat: the optional `copy.evidence` field defaults to
 * absent — when missing, claims fall back to the legacy un-wrapped
 * render so existing call sites that haven't migrated their copy
 * bundles continue to work.
 */

import { type ReactNode } from "react";
import Link from "next/link";

import { ClaimWithEvidence } from "./ClaimWithEvidence";
import {
  type BuiltEvidenceChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";
import type { IntelligenceBriefDto } from "@/lib/lead-detail/use-decision-surface";

export interface IntelligenceBriefCardCopy {
  title: string;
  salesConfidenceLabel: string;
  painPointsLabel: string;
  openFullBrief: string;
  empty: string;
  generatedAt: string;
  /**
   * Phase 7 — when supplied, `headline` + each `painPoint` render
   * through `<ClaimWithEvidence>` so the lead detail page enforces
   * the "every claim has inline evidence" contract. Each claim gets
   * a single `prior-nba` evidence chip pointing back to the cached
   * brief run via the reasoning route.
   */
  evidence?: EvidenceChipCopy;
  /**
   * Optional label for the brief evidence chip (e.g. "brief" / "AI
   * brief"). Defaults to the `prior-nba` type label from
   * `evidence.types["prior-nba"]` when omitted.
   */
  evidenceChipLabel?: string;
  /**
   * Truth Layer T-D — section heading for `hypotheses[]` (e.g.
   * "Hypotheses"). Defaults to "Hypotheses" when omitted so the
   * card stays useful even before the parent ships an i18n string.
   */
  hypothesesLabel?: string;
  /**
   * Truth Layer T-D — short visual label rendered next to each
   * hypothesis ("may be wrong"). The whole point of this affordance
   * is reps must NOT pitch hypotheses as facts; the label is the
   * visual cue they look for during a cold call.
   */
  mayBeWrongLabel?: string;
}

/**
 * Truth Layer T-D — model-inferred hypothesis. Lives in a separate
 * array from `painPoints` and renders with a "may be wrong"
 * affordance. Mirrors the `Hypothesis` shape from
 * `@/lib/sdr-brain/contracts` (`pain-point@v1`) without coupling the
 * UI bundle to the contracts barrel — the parent passes the array
 * already projected from the worker output, so we only need the
 * structural type here.
 */
export interface IntelligenceBriefHypothesis {
  claim: string;
  reasoning: string;
  confidence: number;
}

export interface IntelligenceBriefCardProps {
  brief: IntelligenceBriefDto | null;
  /**
   * Phase 7 — when `true`, "Open full brief →" links to the reasoning
   * route. Until that route ships the parent should pass `false` so
   * the link disables itself rather than 404ing.
   */
  reasoningRouteEnabled?: boolean;
  leadId: string;
  copy: IntelligenceBriefCardCopy;
  /**
   * Truth Layer T-D — model-inferred plausibilities surfaced from the
   * brief output's `hypotheses[]` array. Optional so legacy parents
   * (and the V-L shipping iteration that hadn't wired this yet) keep
   * working unchanged. When the array is empty / omitted we render
   * nothing — the card keeps its existing footprint.
   */
  hypotheses?: ReadonlyArray<IntelligenceBriefHypothesis>;
}

/**
 * Build the `prior-nba` evidence chip every claim in this card
 * shares — they all derive from the same cached brief run, so the
 * source quote + href reference the brief itself. T-D (Wave 2) is
 * expected to extend this with per-pain-point quote grounding; the
 * chip shape stays stable so consumer code does not change.
 */
function buildBriefEvidenceChip(args: {
  brief: IntelligenceBriefDto;
  leadId: string;
  reasoningRouteEnabled: boolean;
  copy: IntelligenceBriefCardCopy;
  scopeKey: string;
}): BuiltEvidenceChip {
  const { brief, leadId, reasoningRouteEnabled, copy, scopeKey } = args;
  const label =
    copy.evidenceChipLabel ?? copy.evidence?.types["prior-nba"] ?? "brief";
  const href = reasoningRouteEnabled
    ? `/app/leads/${leadId}/reasoning/${brief.runId}`
    : null;
  const sourceQuote = brief.whyGoodTarget ?? brief.headline ?? null;
  return {
    key: `brief:${brief.runId}:${scopeKey}`,
    type: "prior-nba",
    label,
    sourceQuote,
    confidence: brief.salesConfidence != null ? brief.salesConfidence / 100 : null,
    href,
  };
}

export function IntelligenceBriefCard({
  brief,
  reasoningRouteEnabled = false,
  leadId,
  copy,
  hypotheses,
}: IntelligenceBriefCardProps): ReactNode {
  if (!brief) return null;

  const sc = brief.salesConfidence;
  const painPoints = brief.painPoints.slice(0, 3);
  const generatedDate = new Date(brief.generatedAt);
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? null
    : generatedDate.toLocaleDateString();
  const evidenceCopy = copy.evidence;
  // Truth Layer T-D — hypothesis bucket. Hide entries with very low
  // model confidence so a noisy run doesn't drown the card in
  // speculation. The 0.4 floor matches the `Hypothesis` contract
  // comment in `pain-point@v1` ("UI hides hypotheses below 0.4").
  const visibleHypotheses = (hypotheses ?? [])
    .filter((h) => typeof h.confidence === "number" && h.confidence >= 0.4)
    .slice(0, 3);
  const hypothesesLabel = copy.hypothesesLabel ?? "Hypotheses";
  const mayBeWrongLabel = copy.mayBeWrongLabel ?? "may be wrong";

  return (
    <div
      data-testid="intelligence-brief-card"
      className="rounded-lg border border-white/8 bg-white/3 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-[11px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.title}
        </h3>
        {sc != null ? (
          <span
            className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[10px]"
            style={{ color: "var(--leadac-text-2)" }}
            aria-label={copy.salesConfidenceLabel}
          >
            {copy.salesConfidenceLabel}: {Math.round(sc)}%
          </span>
        ) : null}
      </div>

      {brief.headline ? (
        evidenceCopy ? (
          <div className="mt-1.5" data-testid="intelligence-brief-headline-claim">
            <ClaimWithEvidence
              claim={
                <span
                  className="text-[13px] leading-snug"
                  style={{ color: "var(--leadac-text-1)" }}
                >
                  {brief.headline}
                </span>
              }
              evidence={[
                buildBriefEvidenceChip({
                  brief,
                  leadId,
                  reasoningRouteEnabled,
                  copy,
                  scopeKey: "headline",
                }),
              ]}
              copy={evidenceCopy}
              density="inline"
              ariaLabel={brief.headline}
            />
          </div>
        ) : (
          <p
            className="mt-1.5 text-[13px] leading-snug"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {brief.headline}
          </p>
        )
      ) : null}

      {painPoints.length > 0 ? (
        <div className="mt-2.5">
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.painPointsLabel}
          </span>
          {evidenceCopy ? (
            <ul
              className="mt-1 flex flex-col gap-1"
              data-testid="intelligence-brief-pain-list"
            >
              {painPoints.map((p) => (
                <li key={p}>
                  <ClaimWithEvidence
                    testid="intelligence-brief-pain-claim"
                    claim={
                      <span
                        className="text-[12px] leading-snug"
                        style={{ color: "var(--leadac-text-2)" }}
                      >
                        {p}
                      </span>
                    }
                    evidence={[
                      buildBriefEvidenceChip({
                        brief,
                        leadId,
                        reasoningRouteEnabled,
                        copy,
                        scopeKey: `pain:${p}`,
                      }),
                    ]}
                    copy={evidenceCopy}
                    density="inline"
                    ariaLabel={p}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-1">
              {painPoints.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[11px]"
                  style={{ color: "var(--leadac-text-2)" }}
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {visibleHypotheses.length > 0 ? (
        <div
          className="mt-2.5"
          data-testid="intelligence-brief-hypotheses"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-warning)" }}
            >
              {hypothesesLabel}
            </span>
            <span
              aria-hidden
              className="text-[10px]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              ·
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {mayBeWrongLabel}
            </span>
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {visibleHypotheses.map((h) => (
              <li
                key={h.claim}
                data-testid="intelligence-brief-hypothesis"
                aria-label={`${h.claim} — ${mayBeWrongLabel}`}
                className="rounded-md border border-dashed bg-white/3 px-2 py-1.5 text-[12px] leading-snug"
                style={{
                  // Color-distinguish from grounded painPoints (solid
                  // border, neutral surface) so reps cannot mistake a
                  // hypothesis for a verified claim during a cold call.
                  borderColor:
                    "color-mix(in srgb, var(--leadac-warning) 45%, transparent)",
                  color: "var(--leadac-text-2)",
                }}
              >
                <span className="block">{h.claim}</span>
                <span
                  className="mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--leadac-warning)" }}
                  data-testid="intelligence-brief-hypothesis-affordance"
                >
                  {mayBeWrongLabel}
                  <span
                    aria-hidden
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    · {Math.round(h.confidence * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        {generatedLabel ? (
          <span
            className="text-[10px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.generatedAt} {generatedLabel}
          </span>
        ) : (
          <span />
        )}
        {reasoningRouteEnabled ? (
          <Link
            href={`/app/leads/${leadId}/reasoning/${brief.runId}`}
            className="text-[11px] underline"
            style={{ color: "var(--leadac-info)" }}
          >
            {copy.openFullBrief}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="text-[11px] opacity-40"
            style={{ color: "var(--leadac-text-2)" }}
            title={copy.openFullBrief}
          >
            {copy.openFullBrief}
          </button>
        )}
      </div>
    </div>
  );
}
