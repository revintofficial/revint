"use client";

/**
 * DiscoveryBlock — wraps the SPIN board + voice-note FAB anchor for
 * the v2 DISCOVERY block. Mounts with id `discovery-block`.
 *
 * PRO+ surface — FREE workspaces see the `<PlanLockedBlock>` instead.
 * On mobile (< 640px) the SPIN board collapses to a 4-section
 * accordion; the FAB button is anchored at the top of the body so
 * field reps can drop a voice note before reading the items.
 */

import type { ReactNode } from "react";

import {
  PlanLockedBlock,
  type PlanLockedBlockCopy,
} from "./PlanLockedBlock";
import {
  SpinBoard,
  type SpinBoardCopy,
  type SpinBoardItem,
  type SpinKindKey,
} from "./SpinBoard";
import {
  VoiceNoteFAB,
  type VoiceNoteFABCopy,
} from "./VoiceNoteFAB";

export interface DiscoveryBlockCopy {
  loading: string;
  empty: string;
  spin: SpinBoardCopy;
  locked: PlanLockedBlockCopy;
  voiceNoteFab: VoiceNoteFABCopy;
}

export interface DiscoveryBlockProps {
  loading: boolean;
  spinUnlocked: boolean;
  items: Record<SpinKindKey, SpinBoardItem[]> | null;
  copy: DiscoveryBlockCopy;
}

export function DiscoveryBlock({
  loading,
  spinUnlocked,
  items,
  copy,
}: DiscoveryBlockProps): ReactNode {
  if (!spinUnlocked) {
    return (
      <div className="space-y-3" data-testid="discovery-block-locked">
        <VoiceNoteFAB copy={copy.voiceNoteFab} />
        <PlanLockedBlock copy={copy.locked} />
      </div>
    );
  }

  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="discovery-loading"
      >
        {copy.loading}
      </p>
    );
  }

  if (!items) {
    return (
      <div className="space-y-3" data-testid="discovery-block-empty">
        <VoiceNoteFAB copy={copy.voiceNoteFab} />
        <p
          className="text-[13px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.empty}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="discovery-block-body">
      <VoiceNoteFAB copy={copy.voiceNoteFab} />
      <SpinBoard items={items} copy={copy.spin} />
    </div>
  );
}
