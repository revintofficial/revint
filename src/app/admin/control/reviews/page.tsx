import { ControlFrame } from "@/components/admin/control-frame";
import { ReviewInbox } from "@/components/admin/control-review-panel";
import { requireControlRole, roleAtLeast, resolveControlLens } from "@/lib/control/roles";
import { listLeadReviews, listReviewQueue } from "@/lib/control/review";
import { missingLenses } from "@/lib/control/lenses";
import { toDecisionCard } from "@/lib/control/decision";
import { getLeadTrace, type DecisionCard } from "@/lib/control/trace";

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

async function ReviewsBody({ workspaceId, leadId }: { workspaceId: string; leadId?: string }) {
  const actor = await requireControlRole("VIEWER");
  const [queue, lens] = await Promise.all([listReviewQueue(workspaceId), resolveControlLens(actor.userId)]);
  const selectedId = leadId || queue[0]?.leadId || null;
  const selectedIndex = queue.findIndex(row => row.leadId === selectedId);
  const nextLeadId = selectedIndex >= 0 ? queue[selectedIndex + 1]?.leadId ?? null : null;
  const trace = selectedId ? await getLeadTrace(workspaceId, selectedId) : null;
  const runs = trace ? [...trace.sessions.flatMap(s => s.runs), ...trace.unsessionedRuns] : [];
  const matched = runs.filter(r => r.workerKind === "LEAD_INTELLIGENCE_BRIEF" && r.status === "SUCCEEDED").sort((a,b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") || b.id.localeCompare(a.id))[0];
  const reviews = selectedId && matched ? await listLeadReviews(workspaceId, selectedId, matched.id) : [];
  const decision: DecisionCard = matched?.decision ?? toDecisionCard(null);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">İnceleme</h1>
      <ReviewInbox
        workspaceId={workspaceId}
        canReview={roleAtLeast(actor.role, "REVIEWER") && lens !== null}
        lens={lens}
        queue={queue}
        selectedLeadId={selectedId}
        selected={selectedId && matched ? {
          businessName: trace?.lead.businessName ?? queue.find((row) => row.leadId === selectedId)?.businessName ?? "",
          decision,
          runs: runs.map((run) => ({ workerKind: run.workerKind, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, costUsdCents: run.costUsdCents, errorMsg: run.errorMsg })),
          crm: (trace?.crmSyncs ?? []).map((row) => ({ objectType: row.objectType, status: row.status, lastError: row.lastError })),
          output: JSON.parse(matched.rawJson || "{}"),
          missingLenses: missingLenses(reviews),
          agentRunId: matched?.id ?? null,
          nextLeadId,
          reviews: reviews.map((review) => ({
            id: review.id,
            lens: review.lens,
            verdict: review.verdict,
            errorClass: review.errorClass,
            severity: review.severity,
            note: review.note,
            createdAt: review.createdAt.toISOString(),
          })),
        } : null}
      />
    </section>
  );
}
