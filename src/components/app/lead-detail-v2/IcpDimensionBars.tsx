"use client";

/**
 * IcpDimensionBars — Phase 2 horizontal bar replacement for the
 * dropped `IcpScoreRing`. RETHINK §6 dropped the ring because it eats
 * vertical space without scannability; the bars expose dimension
 * names + scores in one tab-stop pass.
 *
 * Each bar:
 *   - Carries a TEXT label (color-blind A11y per design brief §10).
 *   - Pairs a status hue with an icon glyph so the bar does not rely
 *     on color alone.
 *   - Surfaces an always-visible inline `<EvidenceChip>` describing
 *     the matched value ("$5M ARR matches $1M-$10M target"); RETHINK
 *     §4.4 forbids hover-only tooltips on Phase 2 surfaces.
 */

import type { ReactNode } from "react";
import { CheckCircle2, MinusCircle, AlertCircle } from "lucide-react";

import {
  EvidenceChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";
import type {
  IcpDimensionsResult,
  IcpDimensionKey,
} from "@/lib/icp-fit/dimensions";

export type IcpDimensionLabelKey =
  | "revenue"
  | "staff"
  | "stack"
  | "geo"
  | "vertical"
  | "total";

export interface IcpDimensionEvidence {
  /** Optional inline chip per dimension (e.g. "priceLevel=3"). */
  revenue?: { label: string; quote: string | null };
  staff?: { label: string; quote: string | null };
  stack?: { label: string; quote: string | null };
  geo?: { label: string; quote: string | null };
  vertical?: { label: string; quote: string | null };
}

export interface IcpDimensionBarsCopy {
  labels: Record<IcpDimensionLabelKey, string>;
  unknown: string;
  evidence: EvidenceChipCopy;
}

export interface IcpDimensionBarsProps {
  data: IcpDimensionsResult;
  evidence?: IcpDimensionEvidence;
  copy: IcpDimensionBarsCopy;
}

const ORDER: IcpDimensionKey[] = [
  "revenue",
  "staff",
  "stack",
  "geo",
  "vertical",
];

function tone(score: number | null): string {
  if (score == null) return "var(--leadac-text-3)";
  if (score >= 70) return "var(--leadac-success)";
  if (score >= 40) return "var(--leadac-warning)";
  return "var(--leadac-error)";
}

function statusIcon(score: number | null): ReactNode {
  if (score == null) return <MinusCircle aria-hidden className="h-3.5 w-3.5" />;
  if (score >= 70) return <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />;
  if (score >= 40) return <MinusCircle aria-hidden className="h-3.5 w-3.5" />;
  return <AlertCircle aria-hidden className="h-3.5 w-3.5" />;
}

export function IcpDimensionBars({
  data,
  evidence,
  copy,
}: IcpDimensionBarsProps): ReactNode {
  return (
    <div className="space-y-2.5" data-testid="icp-dimension-bars">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[12px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--leadac-text-2)" }}
        >
          {copy.labels.total}
        </span>
        <div
          className="inline-flex items-center gap-1 text-[13px]"
          style={{ color: tone(data.total) }}
        >
          {statusIcon(data.total)}
          <span className="font-semibold tabular-nums">{data.total}</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {ORDER.map((key) => {
          const value = data[key];
          const label = copy.labels[key];
          const ev = evidence?.[key];
          const t = tone(value);
          return (
            <li
              key={key}
              className="grid grid-cols-[88px_1fr_auto] items-center gap-2"
            >
              <span
                className="truncate text-[12px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                {label}
              </span>
              <div
                className="relative h-2 overflow-hidden rounded-full"
                style={{ background: "var(--leadac-hover)" }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value ?? 0}
                aria-label={`${label}: ${value ?? copy.unknown}`}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                  style={{
                    width: `${value ?? 0}%`,
                    background: t,
                  }}
                />
              </div>
              <div className="flex items-center gap-1 text-[11px] tabular-nums">
                <span style={{ color: t }}>
                  {value == null ? copy.unknown : value}
                </span>
              </div>
              {ev ? (
                <div className="col-span-3 -mt-0.5 flex justify-end">
                  <EvidenceChip
                    type="audit"
                    label={ev.label}
                    sourceQuote={ev.quote}
                    confidence={null}
                    copy={copy.evidence}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
