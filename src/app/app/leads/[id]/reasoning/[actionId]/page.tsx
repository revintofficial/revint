/**
 * Lead Detail v2 — Phase 7 reasoning power-view route.
 *
 * Renders the full `LeadNextAction.reasoningGraph` + arbitration
 * record log for a single NBA. The route is the canonical
 * destination for every "open full graph →" link in v2 blocks.
 *
 * Hard rules (PLAN §6 risk #10):
 *   - `requireUser()` resolves `workspaceId` BEFORE the lookup.
 *   - The `LeadNextAction` lookup is `findFirst({ id, leadId,
 *     workspaceId })` so a foreign workspace cannot read another
 *     workspace's reasoning graph (which contains source quotes
 *     that may include PII from voice-note transcripts).
 *   - 404 (not 403) on miss / wrong workspace / unknown actionId.
 *
 * Plan gating (PLAN §5.3): the reasoning power view is a PRO+
 * surface. FREE workspaces see a teaser ("upgrade to inspect the
 * full evidence/inference/decision graph") instead of the live
 * graph.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ReasoningGraphFullView } from "@/components/app/lead-detail-v2/ReasoningGraphFullView";
import { PlanLockedBlock } from "@/components/app/lead-detail-v2/PlanLockedBlock";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadLeadDetailDictionary } from "@/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { planMeetsMinimum } from "@/lib/agent-workers/registry";
import type {
  ContradictionRecord,
  ReasoningGraph,
} from "@/lib/sdr-brain/reasoning-graph";

interface ReasoningPageProps {
  params: Promise<{ id: string; actionId: string }>;
}

export default async function LeadReasoningPage({ params }: ReasoningPageProps) {
  const [{ id, actionId }, session] = await Promise.all([
    params,
    requireUser(),
  ]);

  // Lead-scoped workspace check first so we never disclose lead
  // existence to a foreign workspace.
  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, businessName: true },
  });
  if (!lead) {
    notFound();
  }

  // The action lookup must include workspaceId AND leadId so a
  // valid actionId from another lead in the same workspace can't
  // be cross-mounted onto this lead's URL (defense in depth).
  const action = await prisma.leadNextAction.findFirst({
    where: {
      id: actionId,
      leadId: lead.id,
      workspaceId: session.workspaceId,
    },
    select: {
      id: true,
      reasoningGraph: true,
      arbitrationRecords: true,
      createdAt: true,
      version: true,
    },
  });
  if (!action) {
    notFound();
  }

  const dict = await loadLeadDetailDictionary(DEFAULT_LOCALE);
  const labels = dict.common.leadDetailV2.reasoningRoute;

  // Plan gating: PRO+ unlocks the live graph. FREE sees the locked
  // teaser. The component decides which icon set to use (PRO+ uses
  // the existing color-coded EVIDENCE/INFERENCE/DECISION dots).
  const unlocked = planMeetsMinimum(session.workspace.plan, "PRO");

  // Prisma Json column is `unknown` at the type level; the writer
  // (`SDR_BRAIN`) guarantees the shape, so we cast at the boundary.
  const graph = (action.reasoningGraph as ReasoningGraph | null) ?? null;
  const contradictions =
    (action.arbitrationRecords as ContradictionRecord[] | null) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <nav
        aria-label="lead-secondary"
        className="flex items-center gap-1.5 text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        <Link
          href={`/app/leads/${lead.id}`}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
          style={{ color: "var(--leadac-text-2)" }}
          aria-label={labels.backToLeadAriaTemplate.replace(
            "{business}",
            lead.businessName,
          )}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          <span>{lead.businessName}</span>
        </Link>
        <span aria-hidden>›</span>
        <span aria-current="page" style={{ color: "var(--leadac-text-1)" }}>
          {labels.crumb}
        </span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1
          className="text-[20px] font-semibold tracking-tight"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {labels.heading}
        </h1>
        <p className="text-[13px]" style={{ color: "var(--leadac-text-3)" }}>
          {labels.subheading}
        </p>
      </header>

      {unlocked ? (
        <ReasoningGraphFullView
          leadId={lead.id}
          actionId={action.id}
          graph={graph}
          contradictions={contradictions}
          empty={labels.empty}
        />
      ) : (
        <PlanLockedBlock copy={labels.locked} />
      )}
    </div>
  );
}
