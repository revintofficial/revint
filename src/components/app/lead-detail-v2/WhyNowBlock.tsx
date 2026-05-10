"use client";

/**
 * WhyNowBlock — single-line headline + urgency window + inline
 * evidence-chip row. Source of truth for Phase 1: the active
 * `LeadTrigger[]` carried back by `/api/leads/[id]/next-action`
 * plus the latest `LeadNextAction.reasoning` snippet from
 * SDR_BRAIN. The headline is the highest-severity trigger's
 * `impactPrediction`; chips are the rest.
 *
 * Renders inside a `<Block />` parent (id `why-now-block`). Phase 2
 * extends this with arbitration deltas + multi-trigger merging.
 */

import { type ReactNode, useMemo } from "react";
import { Clock } from "lucide-react";

import {
  buildTriggerEvidenceChip,
  type EvidenceChipCopy,
  type EvidenceChipType,
} from "./EvidenceChip";
import { ClaimWithEvidence } from "./ClaimWithEvidence";
import type {
  LeadTriggerDto,
  LeadNextActionDto,
} from "@/lib/lead-detail/use-decision-surface";

export interface WhyNowBlockCopy {
  empty: string;
  windowDays: string;
  windowToday: string;
  evidence: EvidenceChipCopy;
}

export interface WhyNowBlockProps {
  triggers: LeadTriggerDto[];
  preliminary: LeadNextActionDto | null;
  final: LeadNextActionDto | null;
  isStale?: boolean;
  copy: WhyNowBlockCopy;
}

const TRIGGER_TYPE_TO_CHIP: Record<string, EvidenceChipType> = {
  NEW_LOCATION_OPENING: "linkedin",
  CHAIN_EXPANSION: "linkedin",
  HIRING_MARKETING: "linkedin",
  HIRING_OPS: "linkedin",
  HIRING_TECH: "linkedin",
  BAD_SERVICE_REVIEWS: "review",
  RATING_DROP: "review",
  MENU_REDESIGN_SIGNAL: "audit",
  BOOKING_PROVIDER_CHANGE: "audit",
  DELIVERY_EXPANSION: "audit",
  INTERNATIONAL_AUDIENCE_GROWTH: "audit",
  SEASONAL_TOURISM: "audit",
  COMPETITOR_PRESSURE: "audit",
  REBRANDING: "audit",
  FUNDING_RAISED: "linkedin",
  EXEC_CHANGE: "linkedin",
};

function shortLabel(type: string): string {
  return type.toLowerCase().replace(/_/g, " ");
}

function pickHeadline(args: {
  triggers: LeadTriggerDto[];
  preliminary: LeadNextActionDto | null;
  final: LeadNextActionDto | null;
}): { text: string; sourceTriggerId: string | null } {
  const { triggers, preliminary, final } = args;
  if (triggers.length > 0) {
    const sorted = [...triggers].sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.confidence - a.confidence;
    });
    const top = sorted[0];
    if (top.impactPrediction && top.impactPrediction.length > 0) {
      return { text: top.impactPrediction, sourceTriggerId: top.id };
    }
    return { text: shortLabel(top.type), sourceTriggerId: top.id };
  }
  const reason = (final ?? preliminary)?.reasoning;
  if (reason && reason.length > 0) {
    return { text: reason, sourceTriggerId: null };
  }
  return { text: "", sourceTriggerId: null };
}

function pickUrgency(triggers: LeadTriggerDto[], copy: WhyNowBlockCopy): string | null {
  if (triggers.length === 0) return null;
  const sorted = [...triggers]
    .filter((t) => t.urgencyWindowDays != null)
    .sort(
      (a, b) =>
        (a.urgencyWindowDays ?? Infinity) - (b.urgencyWindowDays ?? Infinity),
    );
  const tightest = sorted[0]?.urgencyWindowDays;
  if (tightest == null) return null;
  if (tightest <= 0) return copy.windowToday;
  return copy.windowDays.replace("{days}", String(tightest));
}

export function WhyNowBlock({
  triggers,
  preliminary,
  final,
  isStale,
  copy,
}: WhyNowBlockProps): ReactNode {
  const headline = useMemo(
    () => pickHeadline({ triggers, preliminary, final }),
    [triggers, preliminary, final],
  );
  const urgency = useMemo(() => pickUrgency(triggers, copy), [triggers, copy]);

  const chips = useMemo(() => {
    return triggers.map((t) =>
      buildTriggerEvidenceChip({
        triggerId: t.id,
        type: TRIGGER_TYPE_TO_CHIP[t.type] ?? "audit",
        label: shortLabel(t.type),
        evidence: t.evidence,
        confidence: t.confidence,
      }),
    );
  }, [triggers]);

  if (!headline.text) {
    return (
      <p className="text-[13px]" style={{ color: "var(--leadac-text-3)" }}>
        {copy.empty}
      </p>
    );
  }

  return (
    <div className="space-y-2" data-stale={isStale ? "true" : undefined}>
      {urgency ? (
        <div
          className="inline-flex items-center gap-1 text-[11px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          <Clock className="h-3 w-3" aria-hidden />
          <span>{urgency}</span>
        </div>
      ) : null}
      {/*
       * Phase 7: every claim renders through `<ClaimWithEvidence>`
       * so the `claim · chip · chip` pattern is enforced from one
       * surface. The legacy "evidence row under the headline"
       * shape becomes a single component call.
       */}
      <ClaimWithEvidence
        claim={
          <span
            className="text-[14px] leading-snug"
            style={{
              color: isStale ? "var(--leadac-text-3)" : "var(--leadac-text-1)",
            }}
            data-testid="why-now-headline"
          >
            {headline.text}
          </span>
        }
        evidence={chips}
        copy={copy.evidence}
        density="stacked"
        testid="why-now-evidence"
      />
    </div>
  );
}
