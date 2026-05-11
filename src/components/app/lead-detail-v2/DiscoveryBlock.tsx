"use client";

/**
 * DiscoveryBlock — wraps the SPIN board for the v2 DISCOVERY block.
 * Mounts with id `discovery-block`.
 *
 * PRO+ surface — FREE workspaces see the `<PlanLockedBlock>` instead.
 * On mobile (< 640px) the SPIN board collapses to a 4-section accordion.
 *
 * Phase 5 promoted the voice-note FAB out of this block and into a
 * global mobile-only floating action button rendered by
 * `LeadDetailV2Client` so it stays anchored even while the user
 * scrolls past Discovery. See `VoiceNoteFAB.tsx`.
 */

import type { ReactNode } from "react";

import {
  DossierExpand,
  type DossierExpandCopy,
} from "./DossierExpand";
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
import type { DossierStubDto } from "@/lib/lead-detail/use-decision-surface";

export interface DiscoveryBlockCopy {
  loading: string;
  empty: string;
  spin: SpinBoardCopy;
  locked: PlanLockedBlockCopy;
  // Phase 2.5 — additive copy for the dossier lazy-expand button.
  dossier?: DossierExpandCopy;
}

export interface DiscoveryBlockProps {
  loading: boolean;
  spinUnlocked: boolean;
  items: Record<SpinKindKey, SpinBoardItem[]> | null;
  // Phase 2.5 — dossier stub from `decision-surface.dossierStub`.
  // `hasDossier=false` hides the expand button entirely.
  dossierStub?: DossierStubDto;
  leadId?: string;
  copy: DiscoveryBlockCopy;
}

export function DiscoveryBlock({
  loading,
  spinUnlocked,
  items,
  dossierStub,
  leadId,
  copy,
}: DiscoveryBlockProps): ReactNode {
  if (!spinUnlocked) {
    return (
      <div className="space-y-3" data-testid="discovery-block-locked">
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
      <SpinBoard items={items} copy={copy.spin} />
      {dossierStub?.hasDossier && leadId && copy.dossier ? (
        <DossierExpand
          leadId={leadId}
          stub={dossierStub}
          copy={copy.dossier}
        />
      ) : null}
    </div>
  );
}
