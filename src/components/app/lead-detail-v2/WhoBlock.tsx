"use client";

/**
 * WhoBlock — buying-committee grid for the v2 WHO block. Mounts with
 * id `who-block`. Visible to FREE (PLAN §5.3 — basic stakeholders are
 * not gated; only MEDDPICC + SPIN are).
 *
 * Desktop: 3-column grid of `<StakeholderCard>` rows.
 * Mobile (< 640px): horizontally-paged scroll snap (PLAN §4 line 188).
 */

import type { ReactNode } from "react";

import {
  StakeholderCard,
  type StakeholderCardCopy,
  type StakeholderCardData,
} from "./StakeholderCard";

export interface WhoBlockCopy {
  loading: string;
  empty: string;
  card: StakeholderCardCopy;
}

export interface WhoBlockProps {
  loading: boolean;
  stakeholders: StakeholderCardData[];
  copy: WhoBlockCopy;
}

export function WhoBlock({
  loading,
  stakeholders,
  copy,
}: WhoBlockProps): ReactNode {
  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="who-loading"
      >
        {copy.loading}
      </p>
    );
  }

  if (stakeholders.length === 0) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="who-empty"
      >
        {copy.empty}
      </p>
    );
  }

  return (
    <div data-testid="who-block-body">
      <div className="hidden gap-2 sm:grid sm:grid-cols-3">
        {stakeholders.map((s) => (
          <StakeholderCard key={s.id} data={s} copy={copy.card} />
        ))}
      </div>
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {stakeholders.map((s) => (
          <div
            key={s.id}
            className="min-w-[80%] shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <StakeholderCard data={s} copy={copy.card} />
          </div>
        ))}
      </div>
    </div>
  );
}
