/**
 * Post-analysis HubSpot writeback hook.
 *
 * Called by the agent-runs worker after `executeAgentRun` returns. When
 * the run is a successful LEAD_INTELLIGENCE_BRIEF for a lead whose
 * workspace has an active HubSpot connection, it pushes the fresh brief
 * (read from THIS run's output) to HubSpot via `enqueueCrmWriteback`.
 *
 * Guarantees:
 *   - workspace-scoped: `workspaceId` is re-derived from the AgentRun row,
 *     never taken from the job payload;
 *   - idempotent: the CrmSyncLog row is keyed on the run id, so BullMQ
 *     retries / duplicate jobs don't write twice;
 *   - never throws: a HubSpot failure is logged + recorded FAILED on
 *     CrmSyncLog (visible in Settings → Integrations and retried by the
 *     reconcile tick) and can never fail the brief run.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { enqueueCrmWriteback, type WritebackResult } from "./writeback";

const SUCCEEDED = new Set(["SUCCEEDED", "SUCCEEDED_NO_MEMORY"]);

export type BriefHookResult =
  | WritebackResult
  | { status: "NOT_APPLICABLE"; reason: string };

export async function writebackAfterBriefRun(
  prisma: PrismaClient,
  runId: string,
): Promise<BriefHookResult> {
  try {
    const run = await prisma.agentRun.findUnique({
      where: { id: runId },
      select: { id: true, workspaceId: true, leadId: true, workerKind: true, status: true, outputJson: true },
    });
    if (!run) return { status: "NOT_APPLICABLE", reason: "run_not_found" };
    if (run.workerKind !== "LEAD_INTELLIGENCE_BRIEF") {
      return { status: "NOT_APPLICABLE", reason: "not_a_brief" };
    }
    if (!SUCCEEDED.has(run.status)) {
      return { status: "NOT_APPLICABLE", reason: `run_${String(run.status).toLowerCase()}` };
    }
    if (!run.leadId) return { status: "NOT_APPLICABLE", reason: "no_lead" };

    // A brief that skipped itself (head agent off) has no decision. Writing
    // back would push the old scorer / playbook angle as if it were fresh.
    const out = run.outputJson;
    if (out && typeof out === "object" && !Array.isArray(out) && (out as Record<string, unknown>).skipped) {
      return { status: "NOT_APPLICABLE", reason: "brief_skipped" };
    }

    const conn = await prisma.crmConnection.findUnique({
      where: { workspaceId_provider: { workspaceId: run.workspaceId, provider: "HUBSPOT" } },
      select: { status: true },
    });
    if (!conn || conn.status === "REVOKED") {
      return { status: "NOT_APPLICABLE", reason: "hubspot_not_connected" };
    }

    const res = await enqueueCrmWriteback(prisma, {
      workspaceId: run.workspaceId,
      leadId: run.leadId,
      reason: "analysis",
      briefRunId: run.id,
    });
    const log = res.status === "FAILED" ? logger.warn : logger.info;
    log("hubspot.writeback.after_brief", {
      runId,
      workspaceId: run.workspaceId,
      leadId: run.leadId,
      status: res.status,
      reason: res.reason,
      targets: res.targets,
    });
    return res;
  } catch (err) {
    // DB hiccup etc. Never propagate into the agent-runs job.
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("hubspot.writeback.after_brief_error", { runId, err: msg });
    return { status: "FAILED", reason: msg };
  }
}
