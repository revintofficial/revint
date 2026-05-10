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

  if (!v2Enabled) {
    return <LegacyLeadDetailClient id={id} />;
  }

  // Phase 0 i18n: pick the workspace's preferred locale once it lands
  // on the session. Until then, default-locale + Turkish are the only
  // populated catalogs; both ship Lead Detail v2 keys from day 1.
  const dict = await loadLeadDetailDictionary(DEFAULT_LOCALE);
  const v2 = dict.common.leadDetailV2;
  return (
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
        },
        stages: v2.stages,
        whyNow: {
          title: v2.whyNow.title,
          empty: v2.whyNow.empty,
          windowDays: v2.whyNow.windowDays,
          windowToday: v2.whyNow.windowToday,
          evidence: v2.evidence,
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
          voiceNoteFab: v2.discovery.voiceNoteFab,
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
        },
        history: {
          loading: v2.history.loading,
          empty: v2.history.empty,
          timelineHeading: v2.history.timelineHeading,
          objectionsHeading: v2.history.objectionsHeading,
          activityKindLabels: v2.history.activityKindLabels,
          objections: v2.objections,
        },
      }}
    />
  );
}
