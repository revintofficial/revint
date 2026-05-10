"use client";

/**
 * BantBars — 4-bar B/A/N/T renderer with always-visible inline
 * evidence chips. Phase 2 keeps BANT rendering inside the v2
 * QUALIFICATION block.
 *
 * Compliance with RETHINK §4.4 ("no Why? link"): every bar carries
 * up to two inline evidence chips drawn from
 * `DealQualificationFact.sourceQuote`. Phase 2 drops the legacy
 * hover-only tooltip pattern.
 *
 * Compliance with PLAN §5.8 / design-brief §10 (color-blind safe):
 * status icons (✓ / ◐ / ✗) are rendered alongside color so the bars
 * don't rely on hue alone.
 */

import type { ReactNode } from "react";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

import {
  EvidenceChip,
  buildDealQualFactChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";
import type { BantBars as BantBarsData } from "@/lib/lead-detail/derive-bant";

export type BantDimensionKey = "budget" | "authority" | "need" | "timing";

export interface BantBarsCopy {
  labels: Record<BantDimensionKey, string>;
  overall: string;
  status: {
    present: string;
    partial: string;
    missing: string;
  };
  evidence: EvidenceChipCopy;
}

export interface BantBarsProps {
  data: BantBarsData;
  copy: BantBarsCopy;
}

const ORDER: BantDimensionKey[] = ["budget", "authority", "need", "timing"];

function tone(status: "present" | "partial" | "missing"): string {
  if (status === "present") return "var(--leadac-success)";
  if (status === "partial") return "var(--leadac-warning)";
  return "var(--leadac-error)";
}

function statusIcon(status: "present" | "partial" | "missing"): ReactNode {
  if (status === "present")
    return <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />;
  if (status === "partial")
    return <MinusCircle aria-hidden className="h-3.5 w-3.5" />;
  return <XCircle aria-hidden className="h-3.5 w-3.5" />;
}

export function BantBars({ data, copy }: BantBarsProps): ReactNode {
  return (
    <div className="space-y-2.5" data-testid="bant-bars">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[12px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--leadac-text-2)" }}
        >
          {copy.overall}
        </span>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {data.overall}
        </span>
      </div>
      <ul className="space-y-2">
        {ORDER.map((key) => {
          const dim = data[key];
          const t = tone(dim.status);
          return (
            <li key={key} className="space-y-1">
              <div className="grid grid-cols-[88px_1fr_auto] items-center gap-2">
                <span
                  className="truncate text-[12px]"
                  style={{ color: "var(--leadac-text-2)" }}
                >
                  {copy.labels[key]}
                </span>
                <div
                  className="relative h-2 overflow-hidden rounded-full"
                  style={{ background: "var(--leadac-hover)" }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={dim.score}
                  aria-label={`${copy.labels[key]} ${copy.status[dim.status]}: ${dim.score}`}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${dim.score}%`, background: t }}
                  />
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] tabular-nums"
                  style={{ color: t }}
                >
                  {statusIcon(dim.status)}
                  <span>{dim.score}</span>
                </span>
              </div>
              {dim.evidence.length > 0 ? (
                <div
                  className="flex flex-wrap gap-1.5 pl-[88px]"
                  data-testid={`bant-evidence-${key}`}
                >
                  {dim.evidence.map((e) => {
                    const chip = buildDealQualFactChip({
                      factId: e.factId,
                      fieldPath: e.fieldPath,
                      sourceQuote: e.sourceQuote,
                      sourceRefType: null,
                      confidence: e.confidence,
                    });
                    return (
                      <EvidenceChip
                        key={chip.key}
                        type={chip.type}
                        label={chip.label}
                        sourceQuote={chip.sourceQuote}
                        confidence={chip.confidence}
                        copy={copy.evidence}
                      />
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
