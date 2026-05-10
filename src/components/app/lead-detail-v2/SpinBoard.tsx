"use client";

/**
 * SpinBoard — 4-column SPIN (Situation / Problem / Implication /
 * Need-payoff) board for the v2 DISCOVERY block.
 *
 * Desktop: 4 horizontal columns, each listing the matching
 * `DiscoveryItem`s with an inline evidence chip per item.
 * Mobile (< 640px): the same data collapses to a 4-section vertical
 * accordion (PLAN §4 line 224 / RETHINK §4.7).
 */

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  EvidenceChip,
  buildDiscoveryItemChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";

export type SpinKindKey = "SITUATION" | "PROBLEM" | "IMPLICATION" | "NEED_PAYOFF";

export interface SpinBoardItem {
  id: string;
  spinKind: SpinKindKey;
  text: string;
  evidence: string | null;
  confidence: number;
}

export interface SpinBoardCopy {
  columns: Record<SpinKindKey, string>;
  emptyColumn: string;
  evidence: EvidenceChipCopy;
}

export interface SpinBoardProps {
  items: Record<SpinKindKey, SpinBoardItem[]>;
  copy: SpinBoardCopy;
}

const ORDER: SpinKindKey[] = [
  "SITUATION",
  "PROBLEM",
  "IMPLICATION",
  "NEED_PAYOFF",
];

function ColumnContent({
  kind,
  items,
  copy,
}: {
  kind: SpinKindKey;
  items: SpinBoardItem[];
  copy: SpinBoardCopy;
}): ReactNode {
  if (items.length === 0) {
    return (
      <p
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.emptyColumn}
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const chip = buildDiscoveryItemChip({
          itemId: item.id,
          spinKind: item.spinKind,
          evidence: item.evidence,
          confidence: item.confidence,
        });
        return (
          <li key={item.id} className="space-y-1">
            <p
              className="text-[12px] leading-snug"
              style={{ color: "var(--leadac-text-1)" }}
            >
              {item.text}
            </p>
            {item.evidence ? (
              <EvidenceChip
                type={chip.type}
                label={copy.columns[kind]}
                sourceQuote={chip.sourceQuote}
                confidence={chip.confidence}
                copy={copy.evidence}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SpinBoard({ items, copy }: SpinBoardProps): ReactNode {
  const [openMobile, setOpenMobile] = useState<SpinKindKey | null>(null);

  return (
    <div data-testid="spin-board">
      <div className="hidden grid-cols-4 gap-2 sm:grid">
        {ORDER.map((kind) => (
          <section
            key={kind}
            className="flex flex-col gap-2 rounded-lg border px-2.5 py-2"
            style={{
              borderColor: "var(--leadac-border)",
              background: "var(--leadac-card)",
              minHeight: 96,
            }}
          >
            <h4
              className="text-[10px] font-medium uppercase tracking-[0.08em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.columns[kind]}
            </h4>
            <ColumnContent kind={kind} items={items[kind]} copy={copy} />
          </section>
        ))}
      </div>

      <ul className="space-y-1.5 sm:hidden" data-testid="spin-board-mobile">
        {ORDER.map((kind) => {
          const open = openMobile === kind;
          const count = items[kind].length;
          return (
            <li
              key={kind}
              className="rounded-lg border"
              style={{ borderColor: "var(--leadac-border)" }}
            >
              <button
                type="button"
                onClick={() => setOpenMobile(open ? null : kind)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
                aria-expanded={open}
              >
                <span
                  className="text-[12px] font-medium uppercase tracking-[0.06em]"
                  style={{ color: "var(--leadac-text-2)" }}
                >
                  {copy.columns[kind]}
                </span>
                <span className="flex items-center gap-2 text-[11px] tabular-nums">
                  <span style={{ color: "var(--leadac-text-3)" }}>
                    {count}
                  </span>
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform"
                    style={{ transform: open ? "rotate(180deg)" : "none" }}
                    aria-hidden
                  />
                </span>
              </button>
              {open ? (
                <div className="border-t px-3 py-2" style={{ borderColor: "var(--leadac-border)" }}>
                  <ColumnContent kind={kind} items={items[kind]} copy={copy} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
