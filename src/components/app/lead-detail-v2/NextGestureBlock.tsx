"use client";

/**
 * NextGestureBlock — wraps the existing `NbaContent` (extracted from
 * `NbaCard`) in the v2 `Block` primitive's expanded body. Adds the
 * v2-specific chrome on top: version chip, action chips
 * (Dial / Email / WhatsApp / Schedule / Snooze), and an "open full
 * graph →" link placeholder (Phase 7 wires the route).
 *
 * Phase 1 shipped the action chips. Phase 3 wires the Snooze CTA to
 * the real `<SnoozeMenu>` component and signals the
 * `RecentDialContext` provider when the rep taps Dial so the
 * `<DispositionStrip>` overlay can appear within the 5-minute
 * window.
 *
 * Phase 7 (V-L) — ClaimWithEvidence audit.
 *
 * V-L wraps every claim rendered directly inside a v2 block with
 * `<ClaimWithEvidence>` (PLAN §4.7 "Every claim in v2 (BANT cells,
 * MEDDPICC rows, ICP-dimension bars, NextGesture pushback) shows
 * always-visible inline evidence chips. No 'Why?' link anywhere on
 * the page.").
 *
 * Audit of this file's render tree:
 *   - `versionLabel` Badge ("Preliminary · v3") — metadata, not a
 *     claim. The deep-link to the reasoning route already lives next
 *     to it, satisfying the "no Why? link" pattern.
 *   - `copy.empty` paragraph — empty state, not a claim.
 *   - Action chips (Dial / Email / WhatsApp / Schedule / Snooze) —
 *     CTAs, not claims.
 *   - Composed sub-components (`NbaContent`, `FourThingsCard`,
 *     `RecommendedApproach`, `SalesTalkingPoints`) — each owns its
 *     own claim surface. `NbaContent` is shared with the legacy
 *     `NbaCard` and is intentionally NOT touched here (single source
 *     of DOM for both v1 and v2). T-F (Wave 2 — NBA Hygiene) reshapes
 *     the data flow into `NbaContent` (avoidance overlap + objection
 *     source) and is expected to land the ClaimWithEvidence wrap for
 *     `predictedObjections` / `whatNotToPitch` inside the body of
 *     NbaContent at that time. V-L's edits here stay surgical: no
 *     wrapping is required because no direct claim text is rendered
 *     in this file's body. The wraps live in `IntelligenceBriefCard`
 *     (V-L Wave 1) and the BANT / MEDDPICC / ICP / SPIN / Stakeholder
 *     blocks that already shipped through Phase 7's first half.
 */

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";

import {
  NbaContent,
  type LeadNextActionDto,
  type NextActionResponse,
} from "@/components/app/nba/NbaCard";
import { Badge } from "@/components/ui/badge";
import { useRecentDial } from "./RecentDialContext";
import {
  RecommendedApproach,
  type RecommendedApproachCopy,
} from "./RecommendedApproach";
import { SnoozeMenu, type SnoozeMenuCopy } from "./SnoozeMenu";
import {
  FourThingsCard,
  type FourThingsCardCopy,
} from "./FourThingsCard";
import {
  SalesTalkingPoints,
  type SalesTalkingPointsCopy,
} from "./SalesTalkingPoints";
import { ClaimWithEvidence } from "./ClaimWithEvidence";
import type { BuiltEvidenceChip, EvidenceChipCopy } from "./EvidenceChip";
import { isTruthLayerFlagEnabled } from "@/lib/feature-flags";
import { track } from "@/lib/lead-detail/telemetry";
import {
  validateAvoidance,
  type ValidateAvoidanceResult,
} from "@/lib/sdr-brain/avoidance-validator";
import type { AvoidanceTopic } from "@/lib/sdr-brain/contracts";
import type {
  IntelligenceBriefDto,
  LeadTriggerDto,
  RecommendedPackageDto,
} from "@/lib/lead-detail/use-decision-surface";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

export interface NextGestureBlockCopy {
  preliminary: string;
  final: string;
  empty: string;
  openFullGraph: string;
  dial: string;
  email: string;
  whatsapp: string;
  schedule: string;
  snooze: string;
  snoozeMenu: SnoozeMenuCopy;
  // Phase 2.5 — additive copy for the recommended-approach subsection.
  recommendedApproach?: RecommendedApproachCopy;
  // Phase 1.7 — copy for the new FourThingsCard (headline of the
  // V2 Richness Absorption work). Optional so existing call sites
  // that haven't migrated their copy bundles don't break — the
  // card simply doesn't render in that case.
  fourThings?: FourThingsCardCopy;
  // Phase 1.3 (V2 Richness Absorption) — copy for the SalesTalkingPoints
  // card (re-skin of legacy WebsitePlanSection). Optional for the same
  // call-site-migration reason as `fourThings`.
  salesTalkingPoints?: SalesTalkingPointsCopy;
  // ---------------------------------------------------------------
  // Truth Layer T-F (Wave 2) — NBA Hygiene additive copy.
  //
  // Optional so existing call sites that haven't migrated their copy
  // bundles continue to work (the legacy NbaContent body keeps
  // rendering the original "Predicted objections" / "What NOT to
  // pitch" headings in English). When supplied:
  //   - `predictedObjectionsLabel` heads the per-objection
  //     ClaimWithEvidence rows in the v2 surface.
  //   - `avoidanceLabel` heads the validator-filtered avoidance row.
  //   - `evidence` is the standard EvidenceChipCopy dictionary the
  //     wrapper needs to render the chip type label in the active
  //     locale. Mirrors `IntelligenceBriefCardCopy.evidence`.
  // ---------------------------------------------------------------
  predictedObjectionsLabel?: string;
  avoidanceLabel?: string;
  evidence?: EvidenceChipCopy;
}

export interface NextGestureBlockProps {
  data: NextActionResponse | null;
  loading: boolean;
  leadId: string;
  /** Workspace id, used for PostHog telemetry on the FourThingsCard. */
  workspaceId?: string;
  /** Business name powers the OPENER fallback template. */
  businessName?: string;
  /**
   * Pipeline stage drives default visibility of the FourThingsCard:
   * COLD / CONTACTED show it expanded by default (highest priority);
   * REPLIED+ collapses it behind a "Show call prep card" disclosure
   * so the rep's attention stays on the live conversation context.
   */
  stage?: LeadDetailV2Stage | null;
  phone: string | null;
  email: string | null;
  // Phase 2.5 — package + first-message recommendations from the
  // V1 SCORER worker (absorbed into the NEXT_GESTURE block per
  // PLAN §5.9 rows 11/12).
  recommendedPackage?: RecommendedPackageDto | null;
  personalizedFirstMessage?: string | null;
  plan?: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" | null;
  // Phase 1.7 — FourThingsCard inputs. All optional so the card
  // gracefully degrades when a parent hasn't wired them through.
  intelligenceBrief?: IntelligenceBriefDto | null;
  triggers?: LeadTriggerDto[];
  callQuestions?: string[];
  // Phase 1.3 (V2 Richness Absorption) — markdown for the
  // SalesTalkingPoints card (already cached on
  // `WatchlistItem.websitePlan`, surfaced via decision-surface).
  salesTalkingPointsMarkdown?: string | null;
  copy: NextGestureBlockCopy;
  /** Optional callback for the parent to invalidate the queue strip. */
  onSnoozed?: () => void;
  /**
   * Phase 1.3 — fired after the SalesTalkingPoints card finishes
   * generating a new plan so the parent can re-fetch the
   * decision-surface and pick up the cached markdown.
   */
  onSalesTalkingPointsGenerated?: () => void;
}

function buildTelHref(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function buildWaHref(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  return `https://wa.me/${cleaned}`;
}

/**
 * Truth Layer T-F — evidence chip for a predicted objection. Routes
 * to the reasoning graph for the active NBA so the rep can drill
 * into the source attribution chain (`truth.nba.objection_source`
 * dashboard tile lands a link into this same path).
 */
function buildObjectionChip(args: {
  leadId: string;
  actionId: string;
  objectionText: string;
  label: string;
}): BuiltEvidenceChip {
  return {
    key: `obj:${args.actionId}:${args.objectionText.slice(0, 32)}`,
    type: "prior-nba",
    label: args.label,
    sourceQuote: args.objectionText,
    confidence: null,
    href: `/app/leads/${args.leadId}/reasoning/${args.actionId}`,
  };
}

/**
 * Truth Layer T-F — evidence chip for a kept avoidance topic. Uses
 * the `review` chip type because every avoidance topic the worker
 * surfaces today derives from a review-extracted defensiveness
 * pattern (`AvoidanceReason` enum is dominated by review-side
 * signals: `owner_defensive_in_replies`, `negative_review_spike`).
 */
function buildAvoidanceChip(args: {
  leadId: string;
  actionId: string;
  topic: AvoidanceTopic;
  label: string;
}): BuiltEvidenceChip {
  return {
    key: `av:${args.actionId}:${args.topic.topic.slice(0, 32)}`,
    type: "review",
    label: args.label,
    sourceQuote: args.topic.evidenceRef.quote ?? args.topic.topic,
    confidence: null,
    href: args.topic.evidenceRef.sourceUrl ?? null,
  };
}

export function NextGestureBlock({
  data,
  loading,
  leadId,
  workspaceId,
  businessName,
  stage,
  phone,
  email,
  recommendedPackage,
  personalizedFirstMessage,
  plan,
  intelligenceBrief,
  triggers,
  callQuestions,
  salesTalkingPointsMarkdown,
  copy,
  onSnoozed,
  onSalesTalkingPointsGenerated,
}: NextGestureBlockProps): ReactNode {
  const tel = useMemo(() => buildTelHref(phone), [phone]);
  const wa = useMemo(() => buildWaHref(phone), [phone]);
  const mail = email ? `mailto:${email}` : null;
  const dialButtonRef = useRef<HTMLAnchorElement | null>(null);
  const { markDialed } = useRecentDial();

  // -----------------------------------------------------------------
  // Truth Layer T-F (Wave 2) — NBA Hygiene plumbing.
  //
  // Hooks here run unconditionally so the validator + telemetry path
  // is not gated on which early-return branch we hit. When `data` is
  // null we collapse to an empty validation result and skip emit.
  // -----------------------------------------------------------------
  const activeNba: LeadNextActionDto | null = useMemo(() => {
    if (!data) return null;
    return data.final ?? data.preliminary ?? null;
  }, [data]);

  const packageFeatures: ReadonlyArray<string> = useMemo(
    () => recommendedPackage?.features ?? [],
    [recommendedPackage],
  );

  const validatorEnabled = useMemo(
    () =>
      isTruthLayerFlagEnabled("TRUTH_LAYER_AVOIDANCE_VALIDATOR", {
        workspaceId: workspaceId ?? "",
      }),
    [workspaceId],
  );

  // Project the raw `whatNotToPitch` strings into typed `AvoidanceTopic`
  // shapes so the validator gets the contract it expects. The reason
  // tag defaults to `owner_defensive_in_replies` because the v2 surface
  // does not carry a per-topic reason today; T-F's pure validator only
  // looks at `topic`, so the reason is inert metadata for now (kept so
  // `[...kept, ...dropped]` round-trips through the AvoidanceTopic
  // shape without information loss).
  const avoidanceValidation: ValidateAvoidanceResult = useMemo(() => {
    if (!activeNba) return { kept: [], dropped: [] };
    const topics: AvoidanceTopic[] = activeNba.whatNotToPitch.map((t) => ({
      topic: t,
      reason: "owner_defensive_in_replies",
      evidenceRef: { quote: t },
    }));
    if (!validatorEnabled) return { kept: topics, dropped: [] };
    return validateAvoidance(topics, packageFeatures);
  }, [activeNba, packageFeatures, validatorEnabled]);

  // Telemetry — `truth.nba.avoidance_overlap_dropped` fires once per
  // distinct dropped-topic-set (the dep array changes whenever the
  // dropped list changes by reference). Wrapped in an effect so SSR /
  // first-paint stays free of side effects per PLAN §6 risk #3.
  useEffect(() => {
    if (!validatorEnabled) return;
    if (avoidanceValidation.dropped.length === 0) return;
    track("truth.nba.avoidance_overlap_dropped", {
      leadId,
      workspaceId: workspaceId ?? "",
      droppedTopics: avoidanceValidation.dropped.map((t) => t.topic),
    });
  }, [avoidanceValidation.dropped, leadId, workspaceId, validatorEnabled]);

  // Reshape the data passed to `NbaContent` so it does not double-
  // render the avoidance / predicted-objections sections T-F now owns.
  // When `copy.evidence` is set we render the v2 ClaimWithEvidence
  // wrappers below; we strip both arrays from NbaContent's view. When
  // `copy.evidence` is absent (legacy call sites) we still apply the
  // validator filter to `whatNotToPitch` so the overlap-dropped
  // contract holds, but keep `predictedObjections` so NbaContent's
  // legacy bullet list keeps working.
  const useV2ClaimWrap = !!copy.evidence;
  const shapedData: NextActionResponse | null = useMemo(() => {
    if (!data) return null;
    const keptAvoidanceStrings = avoidanceValidation.kept.map((t) => t.topic);
    function shape(
      n: LeadNextActionDto | null,
    ): LeadNextActionDto | null {
      if (!n) return null;
      return {
        ...n,
        whatNotToPitch: useV2ClaimWrap ? [] : keptAvoidanceStrings,
        predictedObjections: useV2ClaimWrap ? [] : n.predictedObjections,
      };
    }
    return {
      ...data,
      preliminary: shape(data.preliminary),
      final: shape(data.final),
    };
  }, [data, avoidanceValidation.kept, useV2ClaimWrap]);

  // Phase 1.7 — the FourThingsCard is the highest-priority artifact
  // on COLD/CONTACTED leads (industry SDR 3-minute formula). On
  // REPLIED+ we still surface it but collapse behind a disclosure
  // because the rep's attention should be on the live thread.
  const fourThingsNode: ReactNode = copy.fourThings && businessName ? (
    <FourThingsCard
      businessName={businessName}
      brief={intelligenceBrief ?? null}
      triggers={triggers ?? []}
      personalizedFirstMessage={personalizedFirstMessage ?? null}
      recommendedPackage={recommendedPackage ?? null}
      questions={callQuestions ?? []}
      loading={loading}
      leadId={leadId}
      workspaceId={workspaceId ?? ""}
      copy={copy.fourThings}
    />
  ) : null;

  const fourThingsDefaultOpen = stage === "COLD" || stage === "CONTACTED" || stage == null;
  const fourThingsBlock = fourThingsNode != null ? (
    fourThingsDefaultOpen ? (
      <div className="mb-3">{fourThingsNode}</div>
    ) : (
      <details className="mb-3 rounded-lg border border-white/8 bg-white/3">
        <summary
          className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.fourThings?.title ?? "Call prep"}
        </summary>
        <div className="px-3 pb-3 pt-1">{fourThingsNode}</div>
      </details>
    )
  ) : null;

  // Phase 1.3 (V2 Richness Absorption) — SalesTalkingPoints is the
  // SDR's deep-context companion to the FourThingsCard. Plan says:
  //   COLD       → render collapsed (FourThingsCard already covers
  //                the surface area the rep needs pre-dial).
  //   CONTACTED+ → render expanded (the rep is actively dialing /
  //                following up and wants the full markdown live).
  const salesTalkingPointsBlock: ReactNode =
    copy.salesTalkingPoints && businessName ? (
      <SalesTalkingPoints
        leadId={leadId}
        businessName={businessName}
        markdown={salesTalkingPointsMarkdown ?? null}
        defaultOpen={stage != null && stage !== "COLD"}
        onGenerated={onSalesTalkingPointsGenerated}
        copy={copy.salesTalkingPoints}
      />
    ) : null;

  if (loading && !data) {
    // Phase 1.7 — even on the pure-loading path we render the
    // FourThingsCard if its inputs have already landed (the
    // decision-surface response can resolve before the NBA does).
    return (
      <div className="space-y-2 text-[13px]">
        {fourThingsBlock}
        <div className="h-3 w-32 rounded bg-white/5" />
        <div className="h-3 w-3/4 rounded bg-white/5" />
        <div className="h-3 w-2/3 rounded bg-white/5" />
        {salesTalkingPointsBlock}
      </div>
    );
  }

  if (!data || (!data.preliminary && !data.final)) {
    // Phase 2.5 — even when there's no NBA yet, we still want to
    // surface the absorbed V1 RecommendedApproach signal if the
    // worker pre-computed a package + first message. Hide entirely
    // when both are missing AND we're not on FREE (no upgrade nudge
    // to render).
    // Phase 1.7 — FourThingsCard renders FIRST on this path because
    // the rep needs *something* dial-able when the NBA is still
    // cooking. The card uses its own fallbacks (generic opener,
    // niche-aware questions) so it always shows four real lines.
    return (
      <div className="space-y-3">
        {fourThingsBlock}
        <p className="text-[13px]" style={{ color: "var(--leadac-text-3)" }}>
          {copy.empty}
        </p>
        {copy.recommendedApproach &&
        (recommendedPackage || personalizedFirstMessage || plan === "FREE") ? (
          <RecommendedApproach
            recommendedPackage={recommendedPackage ?? null}
            personalizedFirstMessage={personalizedFirstMessage ?? null}
            plan={plan ?? null}
            copy={copy.recommendedApproach}
          />
        ) : null}
        {salesTalkingPointsBlock}
      </div>
    );
  }

  const active = data.final ?? data.preliminary!;
  const isPreliminary = !data.final && data.preliminary != null;
  const versionLabel = isPreliminary
    ? `${copy.preliminary} · v${active.version}`
    : `${copy.final} · v${active.version}`;

  return (
    <div className="space-y-3">
      {fourThingsBlock}
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={
            isPreliminary
              ? "border-(--leadac-border) text-(--leadac-text-3)"
              : "border-(--leadac-500) text-(--leadac-500)"
          }
        >
          <Sparkles className="mr-1 h-3 w-3" />
          {versionLabel}
        </Badge>
        {/*
         * Phase 7: deep-link to the dedicated reasoning power
         * view. The route enforces multi-tenant scope and plan
         * gating; the link itself is just an anchor so the rep can
         * cmd-click into a new tab without breaking the SPA flow.
         */}
        <Link
          href={`/app/leads/${leadId}/reasoning/${active.id}`}
          className="inline-flex items-center gap-1 text-[11px] underline"
          style={{ color: "var(--leadac-text-3)" }}
          aria-label={copy.openFullGraph}
          data-testid="next-gesture-open-graph"
        >
          {copy.openFullGraph}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <NbaContent
        data={shapedData ?? data}
        hideReasoningTrace
        autoExpandTraceOnFinal={false}
      />

      {/*
       * Truth Layer T-F (Wave 2) — predicted-objection ClaimWithEvidence
       * row group. Only rendered when the caller supplied a v2 copy
       * bundle with `copy.evidence` (the design-system contract that
       * gates the new wrap; mirrors the IntelligenceBriefCard pattern).
       * V-L's audit pin in the file-level docblock handed this exact
       * wrap to T-F.
       */}
      {useV2ClaimWrap && active.predictedObjections.length > 0 ? (
        <div data-testid="next-gesture-objections-section">
          <div
            className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide"
            style={{ color: "var(--leadac-text-3)" }}
          >
            <AlertTriangle className="h-3 w-3" />
            {copy.predictedObjectionsLabel ?? "Predicted objections"}
          </div>
          <ul className="space-y-1">
            {active.predictedObjections.map((o, i) => (
              <li key={`obj-${i}`}>
                <ClaimWithEvidence
                  testid="next-gesture-objection-claim"
                  claim={
                    <span
                      className="text-[13px] leading-snug"
                      style={{ color: "var(--leadac-text-2)" }}
                    >
                      {o}
                    </span>
                  }
                  evidence={[buildObjectionChip({
                    leadId,
                    actionId: active.id,
                    objectionText: o,
                    label:
                      copy.evidence?.types["prior-nba"] ?? "AI",
                  })]}
                  copy={copy.evidence!}
                  density="inline"
                  ariaLabel={o}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
       * Truth Layer T-F (Wave 2) — avoidance section. Only rendered
       * when the validator returned at least one kept topic. An empty
       * `kept` list means EITHER the worker emitted no avoidance OR
       * every entry collided with `recommendedPackage.features` and
       * the validator dropped them all — in both cases the rep should
       * NOT see an empty card (PLAN §3 / T-F).
       */}
      {useV2ClaimWrap && avoidanceValidation.kept.length > 0 ? (
        <div data-testid="next-gesture-avoidance-section">
          <div
            className="mb-1 text-[10px] uppercase tracking-wide"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.avoidanceLabel ?? "What NOT to pitch"}
          </div>
          <ul className="space-y-1">
            {avoidanceValidation.kept.map((t, i) => (
              <li key={`av-${i}`}>
                <ClaimWithEvidence
                  testid="next-gesture-avoidance-claim"
                  claim={
                    <span
                      className="text-[13px] leading-snug"
                      style={{ color: "var(--leadac-text-2)" }}
                    >
                      {t.topic}
                    </span>
                  }
                  evidence={[buildAvoidanceChip({
                    leadId,
                    actionId: active.id,
                    topic: t,
                    label:
                      copy.evidence?.types["review"] ?? "review",
                  })]}
                  copy={copy.evidence!}
                  density="inline"
                  ariaLabel={t.topic}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {tel ? (
          <DialChip
            href={tel}
            label={copy.dial}
            anchorRef={dialButtonRef}
            onClick={() => markDialed(leadId)}
          />
        ) : (
          <ActionChip disabled icon={<Phone className="h-3 w-3" />} label={copy.dial} />
        )}
        {mail ? (
          <ActionChip href={mail} icon={<Mail className="h-3 w-3" />} label={copy.email} />
        ) : (
          <ActionChip disabled icon={<Mail className="h-3 w-3" />} label={copy.email} />
        )}
        {wa ? (
          <ActionChip
            href={wa}
            external
            icon={<MessageCircle className="h-3 w-3" />}
            label={copy.whatsapp}
          />
        ) : (
          <ActionChip
            disabled
            icon={<MessageCircle className="h-3 w-3" />}
            label={copy.whatsapp}
          />
        )}
        <ActionChip
          disabled
          icon={<Calendar className="h-3 w-3" />}
          label={copy.schedule}
        />
        <SnoozeMenu
          leadId={leadId}
          copy={copy.snoozeMenu}
          onSnoozed={() => onSnoozed?.()}
        />
      </div>

      {/*
       * Phase 2.5 — RecommendedApproach absorption (PLAN §5.9 rows
       * 11/12). Collapsed by default so the block stays scannable.
       * Hidden when there's nothing to recommend AND no FREE-tier
       * upgrade nudge to show.
       */}
      {copy.recommendedApproach &&
      (recommendedPackage || personalizedFirstMessage || plan === "FREE") ? (
        <RecommendedApproach
          recommendedPackage={recommendedPackage ?? null}
          personalizedFirstMessage={personalizedFirstMessage ?? null}
          plan={plan ?? null}
          copy={copy.recommendedApproach}
        />
      ) : null}
      {salesTalkingPointsBlock}
    </div>
  );
}

interface ActionChipProps {
  icon: ReactNode;
  label: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
}

function ActionChip({ icon, label, href, disabled, external }: ActionChipProps) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55";
  const style = {
    borderColor: disabled
      ? "color-mix(in srgb, var(--leadac-text-3) 25%, transparent)"
      : "color-mix(in srgb, var(--leadac-500) 45%, transparent)",
    color: disabled ? "var(--leadac-text-3)" : "var(--leadac-text-1)",
    background: disabled
      ? "transparent"
      : "color-mix(in srgb, var(--leadac-500) 8%, transparent)",
    opacity: disabled ? 0.6 : 1,
  };

  if (disabled || !href) {
    return (
      <button type="button" className={className} style={style} disabled>
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <a
      href={href}
      className={className}
      style={style}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

interface DialChipProps {
  href: string;
  label: string;
  anchorRef?: React.RefObject<HTMLAnchorElement | null>;
  onClick?: () => void;
}

function DialChip({ href, label, anchorRef, onClick }: DialChipProps) {
  return (
    <a
      ref={anchorRef}
      data-testid="next-gesture-dial"
      href={href}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{
        borderColor: "color-mix(in srgb, var(--leadac-500) 45%, transparent)",
        color: "var(--leadac-text-1)",
        background: "color-mix(in srgb, var(--leadac-500) 8%, transparent)",
      }}
    >
      <Phone className="h-3 w-3" aria-hidden />
      <span>{label}</span>
    </a>
  );
}
