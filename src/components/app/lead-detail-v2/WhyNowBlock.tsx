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

import { type ReactNode, useMemo, useState } from "react";
import { Clock } from "lucide-react";

import {
  buildTriggerEvidenceChip,
  type EvidenceChipCopy,
  type EvidenceChipType,
} from "./EvidenceChip";
import { ClaimWithEvidence } from "./ClaimWithEvidence";
import {
  ReviewVelocityBadge,
  type ReviewVelocityBadgeCopy,
} from "./ReviewVelocityBadge";
import {
  WebsiteSignalStrip,
  type WebsiteSignalStripCopy,
} from "./WebsiteSignalStrip";
import { WebsiteIntelLazyPanel } from "./WebsiteIntelLazyPanel";
import type {
  LeadTriggerDto,
  LeadNextActionDto,
  ReviewVelocityDto,
  WebsiteIntelSummaryDto,
} from "@/lib/lead-detail/use-decision-surface";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

export interface WhyNowBlockCopy {
  empty: string;
  windowDays: string;
  windowToday: string;
  evidence: EvidenceChipCopy;
  // Phase 2.5 — additive copy keys for the website chip strip and
  // Phase 3's review-velocity badge. Optional so existing callers
  // don't break before the i18n layer ships.
  websiteSignals?: WebsiteSignalStripCopy;
  reviewVelocity?: ReviewVelocityBadgeCopy;
  // Phase 1.1 (V2 Richness Absorption) — disclosure label for the
  // lazy full WebsiteIntelligencePanel below the chip strip.
  fullPanelLabel?: string;
}

export interface WhyNowBlockProps {
  triggers: LeadTriggerDto[];
  preliminary: LeadNextActionDto | null;
  final: LeadNextActionDto | null;
  isStale?: boolean;
  // Phase 2.5 — chip strip + velocity badge inputs.
  websiteIntelSummary?: WebsiteIntelSummaryDto | null;
  reviewVelocity?: ReviewVelocityDto | null;
  /**
   * When the WhyNow chips include a `REVIEW_VOLUME_*` trigger
   * (Phase 8) the velocity badge promotes to a stronger tone.
   * Default false.
   */
  reviewVelocityPromoted?: boolean;
  /** Called when the rep taps "View full website panel →" — parent
   * should expand the HISTORY block. */
  onOpenWebsitePanel?: () => void;
  // Phase 1.1 (V2 Richness Absorption) — lazy full-panel inputs.
  // All optional so existing call sites continue to render only the
  // chip strip until they pass these props.
  leadId?: string;
  websiteUrl?: string | null;
  hasWebsite?: boolean;
  businessName?: string;
  workspaceNiche?: string | null;
  nicheSlug?: string | null;
  subNicheSlug?: string | null;
  /**
   * Pipeline stage drives whether the full WebsiteIntelligencePanel
   * is mounted expanded (`REPLIED+`) or collapsed (`COLD`/`CONTACTED`).
   * Aligned with PLAN §4.3 stage-driven expansion rules.
   */
  stage?: LeadDetailV2Stage | null;
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
  // Phase 8 — review-volume triggers map onto the existing "review"
  // chip family. EvidenceChip already renders structured numeric
  // evidence (Phase 3), so the chip surfaces `recentCount` /
  // `priorCount` / `deltaPct` for the new types for free.
  REVIEW_VOLUME_SURGE: "review",
  REVIEW_VOLUME_DIP: "review",
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
  websiteIntelSummary,
  reviewVelocity,
  reviewVelocityPromoted,
  onOpenWebsitePanel,
  leadId,
  websiteUrl,
  hasWebsite,
  businessName,
  workspaceNiche,
  nicheSlug,
  subNicheSlug,
  stage,
  copy,
}: WhyNowBlockProps): ReactNode {
  const headline = useMemo(
    () => pickHeadline({ triggers, preliminary, final }),
    [triggers, preliminary, final],
  );
  const urgency = useMemo(() => pickUrgency(triggers, copy), [triggers, copy]);

  // Phase 1.1 — full WebsiteIntelligencePanel is mounted under the
  // chip strip. Default open on REPLIED+ (rep is deep in the
  // conversation and wants the audit data on screen). Default
  // closed on COLD/CONTACTED so the 3-minute call-prep view stays
  // scannable.
  const fullPanelDefaultOpen =
    stage === "REPLIED" ||
    stage === "MEETING_BOOKED" ||
    stage === "PROPOSAL" ||
    stage === "NEGOTIATING" ||
    stage === "WON" ||
    stage === "LOST";
  const [fullPanelOpen, setFullPanelOpen] = useState(fullPanelDefaultOpen);

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

      {/*
       * Phase 3 — review velocity badge. Renders only when
       * `classifyVelocityBadge` returns a kind (≥ 25% delta + 3
       * recent reviews). The `promoted` flag flips on when a
       * Phase 8 `REVIEW_VOLUME_*` trigger sits in the chip row.
       */}
      {reviewVelocity && copy.reviewVelocity ? (
        <ReviewVelocityBadge
          velocity={reviewVelocity}
          promoted={reviewVelocityPromoted ?? false}
          copy={copy.reviewVelocity}
        />
      ) : null}

      {/*
       * Phase 2.5 — website signal chip strip below the trigger row.
       * Renders even when there's no audit (placeholder text).
       */}
      {copy.websiteSignals ? (
        <WebsiteSignalStrip
          summary={websiteIntelSummary ?? null}
          onOpenFullPanel={
            onOpenWebsitePanel ?? (leadId ? () => setFullPanelOpen(true) : undefined)
          }
          copy={copy.websiteSignals}
        />
      ) : null}

      {/*
       * Phase 1.1 (V2 Richness Absorption) — full V1
       * `WebsiteIntelligencePanel` mounted below the chip strip.
       * Lazy: the `<details>` element holds an unmounted child
       * until the rep opens it (or stage rules pre-open it). The
       * wrapper component handles the `/website-intel` fetch + the
       * content-check / website-search action callbacks so the V2
       * shell stays free of audit-specific state.
       */}
      {leadId && businessName ? (
        <details
          className="mt-3 rounded-lg border border-white/8 bg-white/3"
          open={fullPanelOpen}
          onToggle={(e) => setFullPanelOpen(e.currentTarget.open)}
          data-testid="why-now-website-panel-details"
        >
          <summary
            className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.fullPanelLabel ?? "Full website panel"}
          </summary>
          <div className="px-3 pb-3 pt-1">
            <WebsiteIntelLazyPanel
              leadId={leadId}
              websiteUrl={websiteUrl ?? null}
              hasWebsite={hasWebsite ?? false}
              businessName={businessName}
              workspaceNiche={workspaceNiche ?? null}
              nicheSlug={nicheSlug ?? null}
              subNicheSlug={subNicheSlug ?? null}
              active={fullPanelOpen}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
