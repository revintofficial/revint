import { AgentWorkerKind } from "@/generated/prisma/client";
import { getWorker } from "@/lib/agent-workers/registry";
import { writeAdminAudit } from "@/lib/control/audit";
import { tryEnqueue } from "@/lib/control/enqueue-run";
import type { ControlRole } from "@/lib/control/roles";
import { prisma } from "@/lib/prisma";

type RerunResult =
  | { ok: false; status: 400 | 404; error: string }
  | { ok: true; runId: string; enqueued: boolean };

export async function rerunLeadWorker(input: {
  actorUserId: string;
  actorRole: ControlRole;
  workspaceId: string;
  leadId: string;
  workerKind: string;
  reason: string;
}): Promise<RerunResult> {
  const reason = input.reason.trim();
  if (!input.workspaceId || !reason) return { ok: false, status: 400, error: "Workspace and reason are required" };
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, workspaceId: input.workspaceId },
    select: { id: true, subNicheVersion: true },
  });
  if (!lead) return { ok: false, status: 404, error: "Not found" };

  if (!Object.values(AgentWorkerKind).includes(input.workerKind as AgentWorkerKind)) {
    return { ok: false, status: 400, error: "Invalid worker" };
  }
  const kind = input.workerKind as AgentWorkerKind;
  const worker = getWorker(kind);
  if (!worker?.phase1Enabled || worker.hiddenFromPanel) {
    return { ok: false, status: 400, error: "Worker is not available for lead reruns" };
  }

  const run = await prisma.agentRun.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      userId: input.actorUserId,
      workerKind: kind,
      status: "PENDING",
      inputsJson: {},
      inputSubNicheVersion: lead.subNicheVersion,
    },
    select: { id: true },
  });
  const enqueued = await tryEnqueue(run.id);
  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "trace.rerun",
    targetType: "Lead",
    targetId: input.leadId,
    reason,
    beforeJson: null,
    afterJson: { workerKind: kind, runId: run.id, enqueued },
    outcome: "SUCCEEDED",
  });
  return { ok: true, runId: run.id, enqueued };
}
