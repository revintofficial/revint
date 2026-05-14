/**
 * Lead Detail route — server-component wrapper that picks legacy vs v2.
 *
 * Phase 0 of the Lead Detail v2 rebuild keeps the URL identical and
 * reads a single feature flag to decide which surface to render. The
 * legacy 5-tab surface lives at
 * `src/components/app/leads/LegacyLeadDetailClient.tsx`; the v2
 * placeholder lives at
 * `src/components/app/lead-detail-v2/LeadDetailV2Client.tsx`.
 *
 * Hard rules (build plan §4.0 kill criteria):
 *   - `requireUser()` MUST resolve `workspaceId` BEFORE the flag
 *     decides the surface (multi-tenant safety).
 *   - Flag resolution is synchronous after `requireUser()`. No extra
 *     DB round-trip in Phase 0.
 *   - On `?v=1` the legacy surface renders byte-equivalent to the
 *     pre-split page (only the export name + the `use(params)` line
 *     changed; the render tree is identical).
 *   - Phase 0 introduces NO new data fetches in this server component
 *     beyond what `requireUser()` already does.
 */
import { cookies } from "next/headers";

import LegacyLeadDetailClient from "@/components/app/leads/LegacyLeadDetailClient";
import { LeadDetailV2Client } from "@/components/app/lead-detail-v2/LeadDetailV2Client";
import { LegacyWorkersBeacon } from "@/components/app/lead-detail-v2/LegacyWorkersBeacon";
import { requireUser } from "@/lib/auth";
import { isLeadDetailV2Enabled } from "@/lib/feature-flags";
import { loadLeadDetailDictionary } from "@/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const [{ id }, sp, cookieStore, session] = await Promise.all([
    params,
    searchParams,
    cookies(),
    requireUser(),
  ]);

  const v2Enabled = isLeadDetailV2Enabled(
    { workspaceId: session.workspaceId },
    { v: sp.v },
    cookieStore,
  );

  // Phase 6: emit a deprecation beacon whenever the page is hit
  // with `?tab=workers`. The legacy 5-tab page (rendered when v2 is
  // off OR the user explicitly requested `?v=1`) consumes the param
  // and renders the workers tab as before — but we want to know how
  // long that legacy traffic persists before we can delete the alias.
  // The beacon fires once per mount via PostHog client-side so it
  // only counts real user navigations, not server prefetch.
  const legacyWorkersLink = sp.tab === "workers";

  if (!v2Enabled) {
    return (
      <>
        {legacyWorkersLink ? <LegacyWorkersBeacon leadId={id} /> : null}
        <LegacyLeadDetailClient id={id} />
      </>
    );
  }

  // Phase 0 i18n: pick the workspace's preferred locale once it lands
  // on the session. Until then, default-locale + Turkish are the only
  // populated catalogs; both ship Lead Detail v2 keys from day 1.
  const dict = await loadLeadDetailDictionary(DEFAULT_LOCALE);
  const v2 = dict.common.leadDetailV2;
  return (
    <>
      {legacyWorkersLink ? <LegacyWorkersBeacon leadId={id} /> : null}
    <LeadDetailV2Client
      leadId={id}
      workspaceId={session.workspaceId}
      copy={{
        placeholderTitle: v2.placeholderTitle,
        placeholderSubtitle: v2.placeholderSubtitle,
        backToLeads: v2.backToLeads,
        header: {
          tierLabel: v2.header.tierLabel,
          stageLabel: v2.header.stageLabel,
          changeStage: v2.header.changeStage,
          dial: v2.header.dial,
          email: v2.header.email,
          voiceNote: v2.header.voiceNote,
          moreActions: v2.header.moreActions,
          edit: v2.header.edit,
          archive: v2.header.archive,
          discard: v2.header.discard,
          stages: v2.stages,
          // Phase 1.4 (V2 Richness Absorption) — sticky HUD copy.
          dncBadge: v2.header.dncBadge,
          confidenceLabel: v2.header.confidenceLabel,
          lastCallLabel: v2.header.lastCallLabel,
          neverCalledLabel: v2.header.neverCalledLabel,
        },
        stages: v2.stages,
        whyNow: {
          title: v2.whyNow.title,
          empty: v2.whyNow.empty,
          windowDays: v2.whyNow.windowDays,
          windowToday: v2.whyNow.windowToday,
          evidence: v2.evidence,
          // Phase 1.1 — disclosure label for the absorbed full
          // WebsiteIntelligencePanel below the chip strip.
          fullPanelLabel: v2.whyNow.fullPanelLabel,
        },
        nextGesture: {
          title: v2.nextGesture.title,
          preliminary: v2.nextGesture.preliminary,
          final: v2.nextGesture.final,
          empty: v2.nextGesture.empty,
          openFullGraph: v2.nextGesture.openFullGraph,
          dial: v2.nextGesture.dial,
          email: v2.nextGesture.email,
          whatsapp: v2.nextGesture.whatsapp,
          schedule: v2.nextGesture.schedule,
          snooze: v2.nextGesture.snooze,
          snoozeMenu: v2.nextGesture.snoozeMenu,
          // Phase 1.7 — FourThingsCard copy. Optional on the type
          // but always passed here so the card mounts everywhere
          // the new V2 surface renders.
          fourThings: v2.nextGesture.fourThings,
          // Phase 1.3 (V2 Richness Absorption) — SalesTalkingPoints
          // copy (re-skin of legacy WebsitePlanSection). Same
          // wire-everywhere policy as `fourThings`.
          salesTalkingPoints: v2.nextGesture.salesTalkingPoints,
        },
        preliminaryBanner: { message: v2.preliminaryBanner.message },
        updatedToast: { message: v2.updatedToast.message },
        blocks: v2.blocks,
        evidence: v2.evidence,
        powerTools: v2.header.powerTools,
        qualification: {
          loading: v2.qualification.loading,
          empty: v2.qualification.empty,
          meddpiccTitle: v2.qualification.meddpiccTitle,
          icp: {
            labels: v2.qualification.icp.labels,
            unknown: v2.qualification.icp.unknown,
            evidence: v2.evidence,
          },
          bant: {
            overall: v2.qualification.bant.overall,
            labels: v2.qualification.bant.labels,
            status: v2.qualification.bant.status,
            evidence: v2.evidence,
          },
          meddpicc: {
            labels: v2.qualification.meddpicc.labels,
            status: v2.qualification.meddpicc.status,
            evidence: v2.evidence,
          },
          meddpiccLocked: v2.qualification.meddpiccLocked,
        },
        discovery: {
          loading: v2.discovery.loading,
          empty: v2.discovery.empty,
          spin: {
            columns: v2.discovery.spin.columns,
            emptyColumn: v2.discovery.spin.emptyColumn,
            evidence: v2.evidence,
          },
          locked: v2.discovery.locked,
        },
        who: {
          loading: v2.who.loading,
          empty: v2.who.empty,
          card: {
            unknownName: v2.who.card.unknownName,
            rosette: v2.who.card.rosette,
            championLabel: v2.who.card.championLabel,
            influenceLabel: v2.who.card.influenceLabel,
            evidence: v2.evidence,
          },
          // Phase 1.4 (V2 Richness Absorption) — CompactIdentityCard
          // copy. Wired everywhere V2 renders so the rep always sees
          // the contact rail at the top of WHO.
          identity: v2.who.identity,
        },
        history: {
          loading: v2.history.loading,
          empty: v2.history.empty,
          timelineHeading: v2.history.timelineHeading,
          objectionsHeading: v2.history.objectionsHeading,
          activityKindLabels: v2.history.activityKindLabels,
          objections: v2.objections,
          closestWin: {
            prefix: v2.closestWin.prefix,
            triggerSuffix: v2.closestWin.triggerSuffix,
            apply: v2.closestWin.apply,
            detailsTemplate: v2.closestWin.detailsTemplate,
          },
          // Phase 1.2 — disclosure labels for the absorbed V1
          // review surfaces (ReviewIntelligencePanel, timeline,
          // raw reviews accordion).
          fullReviewIntelLabel: v2.history.fullReviewIntelLabel,
          fullReviewTimelineLabel: v2.history.fullReviewTimelineLabel,
          rawReviewsLabel: v2.history.rawReviewsLabel,
          // Phase 1.5 (V2 Richness Absorption) — disclosure label
          // for the absorbed voice-notes list inside HistoryBlock.
          voiceNotesLabel: v2.history.voiceNotesLabel,
        },
        account: v2.account,
        queueStrip: v2.queueStrip,
        disposition: v2.disposition,
        voiceNoteFab: v2.discovery.voiceNoteFab,
        mobileStickyCTA: v2.mobileStickyCTA,
      }}
    />
    </>
  );
}
