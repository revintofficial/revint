"use client";

/**
 * LeadDetailV2Client — Phase 2 seven-block vertical narrative.
 *
 * Reads `/api/leads/[id]/decision-surface` (Phase 2 aggregator) via
 * `useDecisionSurface`. Derives the 8-stage RETHINK vocabulary via
 * `deriveLeadDetailStage(leadCore, watchlistItem)`, then feeds it into
 * `usePipelineStage` for the §4.3 expand-rules table. WHY_NOW and
 * NEXT_GESTURE were filled in Phase 1; Phase 2 lights up WHO,
 * DISCOVERY, QUALIFICATION, HISTORY. Phase 4 fills ACCOUNT.
 *
 * Telemetry (PostHog, defensive null-safe wrapper):
 *   - lead_detail.v2.viewed                  (mount, once per leadId)
 *   - lead_detail.legacy_hash_consumed       (legacy-hash redirect)
 *   - lead_detail.v2.preliminary_received    (when nba.preliminary first lands)
 *   - lead_detail.v2.final_received          (when nba.final first lands)
 *   - lead_detail.block.expanded             (any block stub → expanded)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

import { AccountBlock, type AccountBlockCopy } from "./AccountBlock";
import { Block, type BlockState } from "./Block";
import { CollapsedStub } from "./CollapsedStub";
import { DispositionStrip, type DispositionStripCopy } from "./DispositionStrip";
import { type EvidenceChipCopy } from "./EvidenceChip";
import { HeaderBar, type HeaderBarCopy } from "./HeaderBar";
import { MobileStickyCTA, type MobileStickyCTACopy } from "./MobileStickyCTA";
import { NextGestureBlock, type NextGestureBlockCopy } from "./NextGestureBlock";
import { type PipelineStageChipCopy } from "./PipelineStageChip";
import { PowerToolsLink } from "./PowerToolsLink";
import { PreliminaryBanner } from "./PreliminaryBanner";
import { QueueStrip, type QueueStripCopy } from "./QueueStrip";
import { RecentDialProvider } from "./RecentDialContext";
import { StickyShell } from "./StickyShell";
import { UpdatedToast } from "./UpdatedToast";
import { VoiceNoteFAB, type VoiceNoteFABCopy } from "./VoiceNoteFAB";
import { WhyNowBlock, type WhyNowBlockCopy } from "./WhyNowBlock";
import {
  QualificationBlock,
  type QualificationBlockCopy,
} from "./QualificationBlock";
import {
  DiscoveryBlock,
  type DiscoveryBlockCopy,
} from "./DiscoveryBlock";
import { WhoBlock, type WhoBlockCopy } from "./WhoBlock";
import {
  HistoryBlock,
  type HistoryBlockCopy,
} from "./HistoryBlock";
import {
  getRedirectTarget,
  type LegacyHashAction,
} from "@/lib/lead-detail/legacy-hash-redirect";
import { deriveLeadDetailStage } from "@/lib/lead-detail/derive-stage";
import {
  usePipelineStage,
  type LeadDetailV2BlockKey,
  type LeadDetailV2Stage,
} from "@/lib/lead-detail/use-pipeline-stage";
import { useDecisionSurface } from "@/lib/lead-detail/use-decision-surface";
import { useLeadQueue } from "@/lib/lead-detail/use-lead-queue";

export interface LeadDetailV2Copy {
  placeholderTitle: string;
  placeholderSubtitle: string;
  backToLeads: string;
  header: HeaderBarCopy;
  stages: PipelineStageChipCopy["stages"];
  whyNow: { title: string } & WhyNowBlockCopy;
  nextGesture: { title: string } & NextGestureBlockCopy;
  preliminaryBanner: { message: string };
  updatedToast: { message: string };
  blocks: {
    who: string;
    discovery: string;
    qualification: string;
    history: string;
    account: string;
    whoStub: string;
    discoveryStub: string;
    qualificationStub: string;
    historyStub: string;
    accountStub: string;
    placeholderBody: string;
  };
  evidence: EvidenceChipCopy;
  powerTools: string;
  qualification: QualificationBlockCopy;
  discovery: DiscoveryBlockCopy;
  who: WhoBlockCopy;
  history: HistoryBlockCopy;
  account: AccountBlockCopy;
  queueStrip: QueueStripCopy;
  disposition: DispositionStripCopy;
  voiceNoteFab: VoiceNoteFABCopy;
  mobileStickyCTA: MobileStickyCTACopy;
}

export interface LeadDetailV2ClientProps {
  leadId: string;
  workspaceId: string;
  copy: LeadDetailV2Copy;
}

function safeCapture(event: string, props: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    const ph = posthog as unknown as {
      __loaded?: boolean;
      capture?: (e: string, p: Record<string, unknown>) => void;
    };
    if (!ph.__loaded || typeof ph.capture !== "function") return;
    ph.capture(event, props);
  } catch {
    // Telemetry must never break the page.
  }
}

function applyHashAction(
  action: LegacyHashAction,
  leadId: string,
  navigate: (href: string) => void,
): boolean {
  if (action.kind === "noop") return false;
  if (action.kind === "scroll") {
    const el =
      typeof document !== "undefined"
        ? document.getElementById(action.target)
        : null;
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  if (action.kind === "navigate") {
    // Phase 6: legacy workers hashes resolve to relative routes
    // (e.g. "/workers"). Compose with the lead URL via the
    // App Router so we keep client navigation (no full reload).
    const href = action.target.startsWith("http")
      ? action.target
      : `/app/leads/${leadId}${action.target}`;
    navigate(href);
    return true;
  }
  return false;
}

function blockState(rule: "expanded" | "stub", overrideExpand: boolean): BlockState {
  if (overrideExpand) return "expanded";
  return rule === "expanded" ? "expanded" : "collapsed-stub";
}

export function LeadDetailV2Client({
  leadId,
  workspaceId,
  copy,
}: LeadDetailV2ClientProps) {
  const router = useRouter();
  const viewedRef = useRef(false);
  const consumedHashRef = useRef<string | null>(null);
  const preliminarySeenRef = useRef(false);
  const finalSeenRef = useRef(false);
  const expandTelemetrySent = useRef<Set<LeadDetailV2BlockKey>>(new Set());

  const surface = useDecisionSurface(leadId);
  const {
    leadCore,
    nba,
    bant,
    icpDimensions,
    stakeholders,
    dealQualification,
    latestDiscovery,
    recentObjections,
    accountSummary,
    activities,
    planGate,
    closestWin,
    queuePosition,
    recentDialAt,
    preliminaryShippable,
    finalLatencyMs,
    loading,
  } = surface;
  const queue = useLeadQueue(3);

  const [stageOverride, setStageOverride] = useState<LeadDetailV2Stage | null>(
    null,
  );
  const [expanded, setExpanded] = useState<
    Partial<Record<LeadDetailV2BlockKey, boolean>>
  >({});

  const derivedStage = useMemo<LeadDetailV2Stage>(() => {
    return deriveLeadDetailStage(
      leadCore ? { lastContactedAt: leadCore.lastContactedAt } : null,
      leadCore?.watchlist
        ? {
            dealStage: leadCore.watchlist.dealStage,
            pipelineStage: leadCore.watchlist.pipelineStage,
          }
        : null,
    );
  }, [leadCore]);

  const stage = stageOverride ?? derivedStage;

  const { expandRules, isStaleWhyNow } = usePipelineStage({
    stage,
    whyNowAt: nba?.triggers[0]?.detectedAt ?? null,
  });

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    safeCapture("lead_detail.v2.viewed", { leadId, workspaceId });
  }, [leadId, workspaceId]);

  useEffect(() => {
    if (preliminarySeenRef.current) return;
    if (!nba?.preliminary) return;
    preliminarySeenRef.current = true;
    safeCapture("lead_detail.v2.preliminary_received", {
      leadId,
      workspaceId,
    });
  }, [nba?.preliminary, leadId, workspaceId]);

  useEffect(() => {
    if (finalSeenRef.current) return;
    if (!nba?.final) return;
    finalSeenRef.current = true;
    safeCapture("lead_detail.v2.final_received", {
      leadId,
      workspaceId,
      latencyMs: finalLatencyMs ?? null,
    });
  }, [nba?.final, leadId, workspaceId, finalLatencyMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    if (consumedHashRef.current === hash) return;

    const action = getRedirectTarget(hash);
    if (action.kind === "noop") return;

    const raf = window.requestAnimationFrame(() => {
      const acted = applyHashAction(action, leadId, (href) => router.replace(href));
      if (!acted) return;
      consumedHashRef.current = hash;
      safeCapture("lead_detail.legacy_hash_consumed", {
        leadId,
        workspaceId,
        hash,
      });
      // Phase 6: workers hashes also fire the dedicated
      // deprecation beacon so dashboards can isolate the
      // workers-link traffic from the broader hash-consumed
      // signal during the deprecation window.
      if (action.kind === "navigate" && action.target === "/workers") {
        safeCapture("lead_detail.legacy_workers_link_followed", {
          leadId,
          workspaceId,
        });
      }
    });

    return () => window.cancelAnimationFrame(raf);
  }, [leadId, workspaceId, leadCore?.id, router]);

  const stubLabels: Record<
    Exclude<LeadDetailV2BlockKey, "WHY_NOW" | "NEXT_GESTURE">,
    { title: string; preview: string }
  > = {
    WHO: { title: copy.blocks.who, preview: copy.blocks.whoStub },
    DISCOVERY: {
      title: copy.blocks.discovery,
      preview: copy.blocks.discoveryStub,
    },
    QUALIFICATION: {
      title: copy.blocks.qualification,
      preview: copy.blocks.qualificationStub,
    },
    HISTORY: { title: copy.blocks.history, preview: copy.blocks.historyStub },
    ACCOUNT: { title: copy.blocks.account, preview: copy.blocks.accountStub },
  };

  const expand = useCallback(
    (key: LeadDetailV2BlockKey) => {
      setExpanded((prev) => ({ ...prev, [key]: true }));
      if (!expandTelemetrySent.current.has(key)) {
        expandTelemetrySent.current.add(key);
        safeCapture("lead_detail.block.expanded", {
          leadId,
          workspaceId,
          blockKey: key,
        });
      }
    },
    [leadId, workspaceId],
  );

  const handleStageChange = useCallback((next: LeadDetailV2Stage) => {
    setStageOverride(next);
  }, []);

  const businessName = leadCore?.businessName ?? "…";
  const subNicheLabel = leadCore?.subNicheLabel ?? null;
  const tier = leadCore?.accountTier ?? null;
  const phone = leadCore?.phone ?? null;
  const email = stakeholders.find((s) => s.email)?.email ?? null;

  const whyNowState: BlockState = blockState(
    expandRules.WHY_NOW,
    expanded.WHY_NOW === true,
  );
  const nextGestureState: BlockState = blockState(
    expandRules.NEXT_GESTURE,
    expanded.NEXT_GESTURE === true,
  );
  const whoState: BlockState = blockState(
    expandRules.WHO,
    expanded.WHO === true,
  );
  const discoveryState: BlockState = blockState(
    expandRules.DISCOVERY,
    expanded.DISCOVERY === true,
  );
  const qualificationState: BlockState = blockState(
    expandRules.QUALIFICATION,
    expanded.QUALIFICATION === true,
  );
  const historyState: BlockState = blockState(
    expandRules.HISTORY,
    expanded.HISTORY === true,
  );
  const accountState: BlockState = blockState(
    expandRules.ACCOUNT,
    expanded.ACCOUNT === true,
  );

  const queueStripNode = (
    <QueueStrip
      items={queue.items}
      totalToday={
        queuePosition?.totalToday ?? queue.totalToday
      }
      doneToday={queue.doneToday}
      locked={queue.locked || (planGate?.plan ?? "FREE") === "FREE"}
      currentLeadId={leadId}
      copy={copy.queueStrip}
      onSnooze={() => {
        const trig =
          typeof document !== "undefined"
            ? (document.querySelector(
                '[data-testid="snooze-menu-trigger"]',
              ) as HTMLElement | null)
            : null;
        trig?.click();
      }}
      onDone={() => queue.mutate()}
    />
  );

  return (
    <RecentDialProvider
      serverRecentDialFor={{ leadId, iso: recentDialAt }}
    >
    <StickyShell
      header={
        <HeaderBar
          businessName={businessName}
          subNicheLabel={subNicheLabel}
          backLabel={copy.backToLeads}
          tier={tier}
          stage={stage}
          watchlistItemId={leadCore?.watchlist?.id ?? null}
          onStageChange={handleStageChange}
          phone={phone}
          email={email}
          onVoiceNote={() => {
            const target =
              typeof document !== "undefined"
                ? document.getElementById("discovery-block")
                : null;
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          copy={{ ...copy.header, stages: copy.stages }}
        />
      }
      queueStrip={queueStripNode}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-4 sm:gap-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-end">
          <PowerToolsLink leadId={leadId} label={copy.powerTools} />
        </div>

        <Block
          id="why-now-block"
          title={copy.whyNow.title}
          state={whyNowState}
          stub={
            <CollapsedStub
              title={copy.whyNow.title}
              preview={
                leadCore?.whyNow ??
                (nba && nba.triggers.length > 0
                  ? nba.triggers[0].type.toLowerCase().replace(/_/g, " ")
                  : copy.whyNow.empty)
              }
            />
          }
          onExpand={() => expand("WHY_NOW")}
        >
          <WhyNowBlock
            triggers={nba?.triggers ?? []}
            preliminary={nba?.preliminary ?? null}
            final={nba?.final ?? null}
            isStale={isStaleWhyNow}
            copy={{
              empty: copy.whyNow.empty,
              windowDays: copy.whyNow.windowDays,
              windowToday: copy.whyNow.windowToday,
              evidence: copy.evidence,
            }}
          />
        </Block>

        <PreliminaryBanner
          visible={preliminaryShippable && !nba?.final}
          message={copy.preliminaryBanner.message}
        />

        <Block
          id="next-gesture-block"
          title={copy.nextGesture.title}
          state={nextGestureState}
          stub={
            <CollapsedStub
              title={copy.nextGesture.title}
              preview={
                nba?.final
                  ? nba.final.actionKind.replace(/_/g, " ").toLowerCase()
                  : nba?.preliminary
                    ? nba.preliminary.actionKind.replace(/_/g, " ").toLowerCase()
                    : copy.nextGesture.empty
              }
            />
          }
          onExpand={() => expand("NEXT_GESTURE")}
        >
          <NextGestureBlock
            data={nba}
            loading={loading}
            leadId={leadId}
            phone={phone}
            email={email}
            copy={copy.nextGesture}
            onSnoozed={() => queue.mutate()}
          />
        </Block>

        <Block
          id="who-block"
          title={stubLabels.WHO.title}
          state={whoState}
          stub={
            <CollapsedStub
              title={stubLabels.WHO.title}
              preview={
                stakeholders.length > 0
                  ? `${stakeholders.length}`
                  : stubLabels.WHO.preview
              }
            />
          }
          onExpand={() => expand("WHO")}
        >
          <WhoBlock
            loading={loading && stakeholders.length === 0}
            stakeholders={stakeholders}
            copy={{
              loading: copy.who.loading,
              empty: copy.who.empty,
              card: { ...copy.who.card, evidence: copy.evidence },
            }}
          />
        </Block>

        <Block
          id="discovery-block"
          title={stubLabels.DISCOVERY.title}
          state={discoveryState}
          stub={
            <CollapsedStub
              title={stubLabels.DISCOVERY.title}
              preview={
                latestDiscovery
                  ? Object.values(latestDiscovery.items)
                      .reduce((acc, list) => acc + list.length, 0)
                      .toString()
                  : stubLabels.DISCOVERY.preview
              }
            />
          }
          onExpand={() => expand("DISCOVERY")}
        >
          <DiscoveryBlock
            loading={loading && latestDiscovery == null}
            spinUnlocked={planGate?.spinUnlocked ?? false}
            items={latestDiscovery ? latestDiscovery.items : null}
            copy={{
              loading: copy.discovery.loading,
              empty: copy.discovery.empty,
              spin: { ...copy.discovery.spin, evidence: copy.evidence },
              locked: copy.discovery.locked,
            }}
          />
        </Block>

        <Block
          id="qualification-block"
          title={stubLabels.QUALIFICATION.title}
          state={qualificationState}
          stub={
            <CollapsedStub
              title={stubLabels.QUALIFICATION.title}
              preview={
                bant
                  ? `${bant.overall}`
                  : stubLabels.QUALIFICATION.preview
              }
            />
          }
          onExpand={() => expand("QUALIFICATION")}
        >
          <QualificationBlock
            loading={loading && bant == null && icpDimensions == null}
            bant={bant}
            icpDimensions={icpDimensions}
            meddpicc={dealQualification}
            meddpiccUnlocked={planGate?.meddpiccUnlocked ?? false}
            copy={{
              loading: copy.qualification.loading,
              empty: copy.qualification.empty,
              meddpiccTitle: copy.qualification.meddpiccTitle,
              icp: { ...copy.qualification.icp, evidence: copy.evidence },
              bant: { ...copy.qualification.bant, evidence: copy.evidence },
              meddpicc: {
                ...copy.qualification.meddpicc,
                evidence: copy.evidence,
              },
              meddpiccLocked: copy.qualification.meddpiccLocked,
            }}
          />
        </Block>

        <Block
          id="history-block"
          title={stubLabels.HISTORY.title}
          state={historyState}
          stub={
            <CollapsedStub
              title={stubLabels.HISTORY.title}
              preview={
                activities.length > 0
                  ? `${activities.length}`
                  : stubLabels.HISTORY.preview
              }
            />
          }
          onExpand={() => expand("HISTORY")}
        >
          <HistoryBlock
            loading={loading && activities.length === 0}
            leadId={leadId}
            activities={activities.map((a) => ({
              id: a.id,
              kind: a.kind,
              payload: a.payload,
              createdAt: a.createdAt,
            }))}
            objections={recentObjections}
            closestWin={closestWin}
            copy={{
              loading: copy.history.loading,
              empty: copy.history.empty,
              timelineHeading: copy.history.timelineHeading,
              objectionsHeading: copy.history.objectionsHeading,
              activityKindLabels: copy.history.activityKindLabels,
              objections: copy.history.objections,
              closestWin: copy.history.closestWin,
            }}
          />
        </Block>

        <Block
          id="account-block"
          title={stubLabels.ACCOUNT.title}
          state={accountState}
          stub={
            <CollapsedStub
              title={stubLabels.ACCOUNT.title}
              preview={
                accountSummary
                  ? accountSummary.locationsCount != null
                    ? `${accountSummary.name} · ${accountSummary.locationsCount}`
                    : accountSummary.name
                  : stubLabels.ACCOUNT.preview
              }
            />
          }
          onExpand={() => expand("ACCOUNT")}
        >
          <AccountBlock
            leadId={leadId}
            workspaceId={workspaceId}
            expanded={accountState === "expanded"}
            accountSummary={accountSummary}
            accountId={leadCore?.accountId ?? null}
            plan={planGate?.plan ?? "FREE"}
            onTelemetry={safeCapture}
            copy={copy.account}
          />
        </Block>
      </div>

      <UpdatedToast
        triggerId={nba?.final?.id ?? null}
        template={copy.updatedToast.message}
      />
      <DispositionStrip
        leadId={leadId}
        copy={copy.disposition}
        onLogged={() => queue.mutate()}
      />

      {/*
       * Phase 5: phone-only sticky action bar (Dial / Voice / More).
       * Reserves 64px above the queue strip so neither bar reflows
       * when it appears (CLS = 0).
       */}
      <MobileStickyCTA
        phone={phone}
        email={email}
        copy={copy.mobileStickyCTA}
        onVoiceNote={() => {
          const fab =
            typeof document !== "undefined"
              ? (document.querySelector(
                  '[data-testid="voice-note-fab-mobile"]',
                ) as HTMLButtonElement | null)
              : null;
          fab?.focus();
        }}
      />

      {/*
       * Phase 5: global mobile-only voice-note FAB. Tap-and-hold to
       * record, release to upload. Renders only on phone (sm:hidden).
       */}
      <VoiceNoteFAB leadId={leadId} copy={copy.voiceNoteFab} />
    </StickyShell>
    </RecentDialProvider>
  );
}
