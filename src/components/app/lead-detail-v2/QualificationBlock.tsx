"use client";

/**
 * QualificationBlock — composes ICP bars + BANT bars + MEDDPICC
 * checklist for the v2 QUALIFICATION block. PRO+ surface for
 * MEDDPICC; FREE sees the `<PlanLockedBlock>` for that sub-section.
 * BANT + ICP remain visible to FREE so the lead is still triagable.
 *
 * The block primitive (id `qualification-block`) is owned by
 * `LeadDetailV2Client`; this component renders the body only. Phase 2
 * loading states use minimum-height placeholders so the populated →
 * loading swap doesn't shift layout.
 */

import type { ReactNode } from "react";

import { BantBars, type BantBarsCopy } from "./BantBars";
import {
  IcpDimensionBars,
  type IcpDimensionBarsCopy,
} from "./IcpDimensionBars";
import {
  MeddpiccChecklist,
  type MeddpiccChecklistCopy,
  type MeddpiccChecklistData,
} from "./MeddpiccChecklist";
import {
  PlanLockedBlock,
  type PlanLockedBlockCopy,
} from "./PlanLockedBlock";
import type { BantBars as BantBarsData } from "@/lib/lead-detail/derive-bant";
import type { IcpDimensionsResult } from "@/lib/icp-fit/dimensions";

export interface QualificationBlockCopy {
  loading: string;
  empty: string;
  meddpiccTitle: string;
  meddpicc: MeddpiccChecklistCopy;
  meddpiccLocked: PlanLockedBlockCopy;
  bant: BantBarsCopy;
  icp: IcpDimensionBarsCopy;
}

export interface QualificationBlockProps {
  loading: boolean;
  bant: BantBarsData | null;
  icpDimensions: IcpDimensionsResult | null;
  meddpicc: MeddpiccChecklistData | null;
  meddpiccUnlocked: boolean;
  copy: QualificationBlockCopy;
}

export function QualificationBlock({
  loading,
  bant,
  icpDimensions,
  meddpicc,
  meddpiccUnlocked,
  copy,
}: QualificationBlockProps): ReactNode {
  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="qualification-loading"
      >
        {copy.loading}
      </p>
    );
  }

  if (!bant && !icpDimensions && !meddpicc) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="qualification-empty"
      >
        {copy.empty}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="qualification-block-body">
      {icpDimensions ? <IcpDimensionBars data={icpDimensions} copy={copy.icp} /> : null}
      {bant ? <BantBars data={bant} copy={copy.bant} /> : null}
      <section className="space-y-2">
        <h3
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.meddpiccTitle}
        </h3>
        {meddpiccUnlocked ? (
          meddpicc ? (
            <MeddpiccChecklist data={meddpicc} copy={copy.meddpicc} />
          ) : (
            <p
              className="text-[12px]"
              style={{ color: "var(--leadac-text-3)" }}
              data-testid="meddpicc-empty"
            >
              {copy.empty}
            </p>
          )
        ) : (
          <PlanLockedBlock copy={copy.meddpiccLocked} />
        )}
      </section>
    </div>
  );
}
