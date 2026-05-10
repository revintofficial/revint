"use client";

/**
 * ClaimWithEvidence — Phase 7 inline `claim · chip · chip` row.
 *
 * RETHINK §4.4 mandates that every claim on the lead detail page
 * carries always-visible inline evidence chips. There is no "Why?"
 * link, no hover-to-reveal source — the chip ships next to the
 * claim from first paint. This component is the generic wrapper
 * every block uses to render that pattern, so the next refactor
 * (e.g. swapping `EvidenceChip` for a different glyph set, or
 * piping perf-marks through every chip) only touches one file.
 *
 * Inputs:
 *   - `claim`: the user-facing claim string (or a ReactNode if a
 *     block needs a custom inline visual like a BANT bar).
 *   - `evidence`: an array of `BuiltEvidenceChip` objects produced
 *     by the `build*EvidenceChip` helpers in `EvidenceChip.tsx`.
 *   - `copy`: the standard `EvidenceChipCopy` dictionary so the
 *     chip can render type labels in the active locale.
 *
 * The wrapper keeps each chip on the same line as the claim on
 * desktop, wraps to a second line on phones (PLAN §5.6 layout-shift
 * policy: `min-height` placeholder so collapse-to-mobile doesn't
 * push siblings).
 */

import type { ReactNode } from "react";

import {
  EvidenceChip,
  type BuiltEvidenceChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";

export interface ClaimWithEvidenceProps {
  claim: ReactNode;
  evidence: BuiltEvidenceChip[];
  copy: EvidenceChipCopy;
  /**
   * Optional density override. Default `inline` keeps the chips on
   * the same baseline as the claim; `stacked` puts them under the
   * claim (used by tall MEDDPICC rows that already have icons).
   */
  density?: "inline" | "stacked";
  /** Optional visual id for tests / perf marks. */
  testid?: string;
  /** Optional max chips to render — over the cap collapses to a "+N more" pill. */
  maxChips?: number;
}

const DEFAULT_MAX_CHIPS = 3;

export function ClaimWithEvidence({
  claim,
  evidence,
  copy,
  density = "inline",
  testid,
  maxChips = DEFAULT_MAX_CHIPS,
}: ClaimWithEvidenceProps) {
  const visible = evidence.slice(0, maxChips);
  const overflow = Math.max(0, evidence.length - visible.length);

  if (density === "stacked") {
    return (
      <div
        data-testid={testid}
        className="flex min-h-9 flex-col gap-1.5"
      >
        <div
          className="text-[13px] leading-snug"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {claim}
        </div>
        {visible.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((c) => (
              <EvidenceChip
                key={c.key}
                type={c.type}
                label={c.label}
                sourceQuote={c.sourceQuote}
                confidence={c.confidence}
                href={c.href}
                copy={copy}
              />
            ))}
            {overflow > 0 ? <OverflowPill count={overflow} /> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid={testid}
      className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span
        className="text-[13px] leading-snug"
        style={{ color: "var(--leadac-text-1)" }}
      >
        {claim}
      </span>
      {visible.length > 0 ? (
        <span aria-hidden style={{ color: "var(--leadac-text-3)" }}>
          ·
        </span>
      ) : null}
      <span className="flex flex-wrap items-center gap-1">
        {visible.map((c) => (
          <EvidenceChip
            key={c.key}
            type={c.type}
            label={c.label}
            sourceQuote={c.sourceQuote}
            confidence={c.confidence}
            href={c.href}
            copy={copy}
          />
        ))}
        {overflow > 0 ? <OverflowPill count={overflow} /> : null}
      </span>
    </div>
  );
}

function OverflowPill({ count }: { count: number }) {
  return (
    <span
      aria-label={`+${count} more sources`}
      className="inline-flex h-5 items-center rounded-full border border-white/10 bg-white/3 px-1.5 text-[11px] leading-none"
      style={{ color: "var(--leadac-text-3)" }}
    >
      +{count}
    </span>
  );
}
