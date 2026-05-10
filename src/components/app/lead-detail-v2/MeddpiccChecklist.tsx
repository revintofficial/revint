"use client";

/**
 * MeddpiccChecklist — 7-row vertical list rendering of the MEDDPICC
 * qualification rollup. Phase 2 surface; PRO+ only (FREE renders the
 * `<PlanLockedBlock>`).
 *
 * Spec note: Plan §4 line 200 says 7 rows; this drops "Paper Process"
 * to keep the checklist scannable. Standard MEDDPIC*C (8 letters) ≠
 * the 7-row UI catalog; the rethink team sided with 7.
 *
 * RETHINK §4.4 ("no Why? link"): each row exposes inline evidence
 * chips read from `DealQualificationFact.sourceQuote`. Color is paired
 * with an icon for color-blind safety.
 */

import type { ReactNode } from "react";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

import {
  EvidenceChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";

export type MeddpiccRowKey =
  | "metrics"
  | "economicBuyer"
  | "decisionCriteria"
  | "decisionProcess"
  | "identifyPain"
  | "champion"
  | "competition";

export type MeddpiccCellStatus = "present" | "partial" | "missing";

export interface MeddpiccCell {
  status: MeddpiccCellStatus;
  evidence: Array<{
    type:
      | "linkedin"
      | "review"
      | "audit"
      | "voice-note"
      | "prior-nba"
      | "contradiction";
    sourceQuote: string | null;
    refType: string | null;
    refId: string | null;
  }>;
  stakeholderId?: string | null;
}

export interface MeddpiccChecklistData {
  metrics: MeddpiccCell;
  economicBuyer: MeddpiccCell;
  decisionCriteria: MeddpiccCell;
  decisionProcess: MeddpiccCell;
  identifyPain: MeddpiccCell;
  champion: MeddpiccCell;
  competition: MeddpiccCell;
}

export interface MeddpiccChecklistCopy {
  labels: Record<MeddpiccRowKey, string>;
  status: Record<MeddpiccCellStatus, string>;
  evidence: EvidenceChipCopy;
}

export interface MeddpiccChecklistProps {
  data: MeddpiccChecklistData;
  copy: MeddpiccChecklistCopy;
}

const ORDER: MeddpiccRowKey[] = [
  "metrics",
  "economicBuyer",
  "decisionCriteria",
  "decisionProcess",
  "identifyPain",
  "champion",
  "competition",
];

function statusTone(status: MeddpiccCellStatus): string {
  if (status === "present") return "var(--leadac-success)";
  if (status === "partial") return "var(--leadac-warning)";
  return "var(--leadac-error)";
}

function statusIcon(status: MeddpiccCellStatus): ReactNode {
  if (status === "present")
    return <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />;
  if (status === "partial")
    return <MinusCircle aria-hidden className="h-3.5 w-3.5" />;
  return <XCircle aria-hidden className="h-3.5 w-3.5" />;
}

export function MeddpiccChecklist({
  data,
  copy,
}: MeddpiccChecklistProps): ReactNode {
  return (
    <ul className="space-y-2" data-testid="meddpicc-checklist">
      {ORDER.map((key) => {
        const cell = data[key];
        const tone = statusTone(cell.status);
        return (
          <li
            key={key}
            className="grid grid-cols-[20px_1fr_auto] items-start gap-2"
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
              style={{
                color: tone,
                background: "color-mix(in srgb, " + tone + " 18%, transparent)",
              }}
            >
              {statusIcon(cell.status)}
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--leadac-text-1)" }}
                >
                  {copy.labels[key]}
                </span>
                <span
                  className="text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: tone }}
                >
                  {copy.status[cell.status]}
                </span>
              </div>
              {cell.evidence.length > 0 ? (
                <div
                  className="flex flex-wrap gap-1.5"
                  data-testid={`meddpicc-evidence-${key}`}
                >
                  {cell.evidence.slice(0, 3).map((e, idx) => (
                    <EvidenceChip
                      key={`${key}-${idx}-${e.refId ?? "_"}`}
                      type={e.type}
                      label={
                        e.refType ?? copy.evidence.types[e.type] ?? copy.labels[key]
                      }
                      sourceQuote={e.sourceQuote}
                      copy={copy.evidence}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
