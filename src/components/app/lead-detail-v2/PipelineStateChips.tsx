"use client";

/**
 * PipelineStateChips — Phase 2.5.
 *
 * Chip row inside `AccountBlock` summarising the lead's lifecycle
 * progress. Replaces the legacy `IdentityRail` rows. Reads
 * `decision-surface.pipelineState`. Five chips:
 *   - crawl status (PENDING/CRAWLING/CRAWLED/FAILED/NO_WEBSITE)
 *   - analyze status (PENDING/ANALYZING/ANALYZED/FAILED)
 *   - reviews status (PENDING/ANALYZING/ANALYZED/FAILED/NO_REVIEWS)
 *   - outreach pipeline (NEW/REACHED_OUT/IN_TALKS/WON/LOST)
 *   - DNC flag (only when true)
 *
 * Tone:
 *   ANALYZED / CRAWLED / WON       → ok (green)
 *   FAILED / DNC                    → warn (red)
 *   PENDING / ANALYZING / CRAWLING → neutral (in-flight)
 *   NO_WEBSITE / NO_REVIEWS         → neutral (out of scope)
 *   REACHED_OUT / IN_TALKS          → info (blue)
 *   LOST                            → neutral (terminal)
 */

import { type ReactNode } from "react";

import type { PipelineStateDto } from "@/lib/lead-detail/use-decision-surface";

export interface PipelineStateChipsCopy {
  crawl: Record<PipelineStateDto["crawl"], string>;
  analyze: Record<PipelineStateDto["analyze"], string>;
  reviews: Record<PipelineStateDto["reviews"], string>;
  outreach: Record<NonNullable<PipelineStateDto["outreach"]>, string>;
  dnc: string;
  empty: string;
}

export interface PipelineStateChipsProps {
  state: PipelineStateDto | null;
  copy: PipelineStateChipsCopy;
}

type Tone = "ok" | "warn" | "neutral" | "info";

const TONE_BG: Record<Tone, string> = {
  ok: "color-mix(in srgb, var(--leadac-success) 15%, transparent)",
  warn: "color-mix(in srgb, var(--leadac-error) 15%, transparent)",
  neutral: "var(--leadac-surface-2, rgba(255,255,255,0.05))",
  info: "color-mix(in srgb, var(--leadac-info) 15%, transparent)",
};

const TONE_FG: Record<Tone, string> = {
  ok: "var(--leadac-success)",
  warn: "var(--leadac-error)",
  neutral: "var(--leadac-text-2)",
  info: "var(--leadac-info)",
};

function crawlTone(s: PipelineStateDto["crawl"]): Tone {
  if (s === "CRAWLED") return "ok";
  if (s === "FAILED") return "warn";
  return "neutral";
}
function analyzeTone(s: PipelineStateDto["analyze"]): Tone {
  if (s === "ANALYZED") return "ok";
  if (s === "FAILED") return "warn";
  return "neutral";
}
function reviewsTone(s: PipelineStateDto["reviews"]): Tone {
  if (s === "ANALYZED") return "ok";
  if (s === "FAILED") return "warn";
  return "neutral";
}
function outreachTone(s: NonNullable<PipelineStateDto["outreach"]>): Tone {
  if (s === "WON") return "ok";
  if (s === "LOST") return "neutral";
  if (s === "REACHED_OUT" || s === "IN_TALKS") return "info";
  return "neutral";
}

export function PipelineStateChips({
  state,
  copy,
}: PipelineStateChipsProps): ReactNode {
  if (!state) {
    return (
      <span
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.empty}
      </span>
    );
  }
  return (
    <div data-testid="pipeline-state-chips" className="flex flex-wrap gap-1.5">
      <Chip label={copy.crawl[state.crawl]} tone={crawlTone(state.crawl)} />
      <Chip
        label={copy.analyze[state.analyze]}
        tone={analyzeTone(state.analyze)}
      />
      <Chip
        label={copy.reviews[state.reviews]}
        tone={reviewsTone(state.reviews)}
      />
      {state.outreach ? (
        <Chip
          label={copy.outreach[state.outreach]}
          tone={outreachTone(state.outreach)}
        />
      ) : null}
      {state.dnc ? <Chip label={copy.dnc} tone="warn" /> : null}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: Tone }): ReactNode {
  return (
    <span
      className="rounded-full border border-white/10 px-2 py-0.5 text-[11px]"
      style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}
    >
      {label}
    </span>
  );
}
