import { ControlFrame } from "@/components/admin/control-frame";
import { ReviewInbox } from "@/components/admin/control-review-panel";
import { requireControlRole, roleAtLeast, resolveControlLens } from "@/lib/control/roles";
import { buildReviewView, listReviewQueue } from "@/lib/control/review";
import { toDecisionCard } from "@/lib/control/decision";
import { buildShelf, shelfAuditFromRow, type ShelfRun } from "@/lib/control/evidence-shelf";
import { prisma } from "@/lib/prisma";

/** The four workers of the automatic chain; one drawer each. */
const SHELF_KINDS = ["APIFY_GMAPS_DEEP", "WEBSITE_AUDITOR", "REVIEW_ANALYST", "LEAD_INTELLIGENCE_BRIEF"] as const;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; lead?: string }>;
}) {
  const { workspaceId, lead } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <ReviewsBody workspaceId={workspaceId} leadId={lead} /> : null}
    </ControlFrame>
  );
}

/**
 * Everything the card needs for one lead, workspace scoped: the lead strip,
 * the latest successful run of each shelf worker, and the audit / review
 * analysis rows behind those runs. The brief is the latest SUCCEEDED brief
 * (the only status a verdict can be written against).
 */
async function loadCard(workspaceId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { id: true, businessName: true, formattedAddress: true, rating: true, reviewCount: true, websiteUrl: true, googleMapsUri: true, accountId: true },
  });
  if (!lead) return null;
  const [locationCount, runs, brief, audit, reviewAnalysis] = await Promise.all([
    lead.accountId ? prisma.lead.count({ where: { workspaceId, accountId: lead.accountId } }) : Promise.resolve(1),
    prisma.agentRun.findMany({
      where: { workspaceId, leadId, workerKind: { in: [...SHELF_KINDS] }, status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] } },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      distinct: ["workerKind"],
      select: { id: true, workerKind: true, status: true, finishedAt: true, outputJson: true, errorMsg: true },
    }),
    prisma.agentRun.findFirst({
      where: { workspaceId, leadId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED" },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, workerKind: true, status: true, finishedAt: true, outputJson: true, errorMsg: true },
    }),
    prisma.websiteAudit.findFirst({
      where: { leadId, lead: { workspaceId } },
      select: { url: true, reachable: true, crawlError: true, crawlAttemptedAt: true, hasBookingSystem: true, bookingProvider: true, rawFeaturesJson: true },
    }),
    prisma.reviewAnalysis.findFirst({
      where: { leadId, lead: { workspaceId } },
      select: { reviewsAnalyzedCount: true, analyzedAt: true, weaknessKpis: true, painPhrases: true, strengthPhrases: true },
    }),
  ]);
  return { lead, locationCount, runs, brief, audit, reviewAnalysis };
}

async function ReviewsBody({ workspaceId, leadId }: { workspaceId: string; leadId?: string }) {
  const actor = await requireControlRole("VIEWER");
  const [queue, lens] = await Promise.all([listReviewQueue(workspaceId), resolveControlLens(actor.userId)]);
  const selectedId = leadId || queue[0]?.leadId || null;
  const selectedIndex = queue.findIndex(row => row.leadId === selectedId);
  const nextLeadId = selectedIndex >= 0 ? queue[selectedIndex + 1]?.leadId ?? null : null;
  const data = selectedId ? await loadCard(workspaceId, selectedId) : null;
  const brief = data?.brief ?? null;
  const view = brief ? await buildReviewView({ workspaceId, agentRunId: brief.id, lens }) : null;

  let selected = null;
  if (data && brief && view) {
    const decision = toDecisionCard(brief.outputJson, { finishedAt: brief.finishedAt?.toISOString() ?? null, locationCount: data.locationCount });
    // The brief drawer reads the same run the verdict is written against.
    const runs: ShelfRun[] = [...data.runs.filter(r => r.workerKind !== "LEAD_INTELLIGENCE_BRIEF"), brief].map(r => ({
      workerKind: r.workerKind,
      status: r.status,
      finishedAt: r.finishedAt?.toISOString() ?? null,
      output: r.outputJson,
      errorMsg: r.errorMsg,
    }));
    const shelfLead = {
      websiteUrl: data.lead.websiteUrl,
      googleMapsUri: data.lead.googleMapsUri,
      address: data.lead.formattedAddress || null,
      rating: data.lead.rating,
      reviewCount: data.lead.reviewCount,
    };
    selected = {
      businessName: data.lead.businessName,
      lead: shelfLead,
      decision,
      drawers: buildShelf({
        runs,
        card: decision,
        lead: shelfLead,
        locationCount: data.locationCount,
        audit: shelfAuditFromRow(data.audit),
        reviewAnalysis: data.reviewAnalysis
          ? { ...data.reviewAnalysis, analyzedAt: data.reviewAnalysis.analyzedAt.toISOString() }
          : null,
      }),
      agentRunId: brief.id,
      view,
      nextLeadId,
    };
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">İnceleme</h1>
      <ReviewInbox
        workspaceId={workspaceId}
        canReview={roleAtLeast(actor.role, "REVIEWER") && lens !== null}
        lens={lens}
        queue={queue}
        selectedLeadId={selectedId}
        selected={selected}
      />
    </section>
  );
}
