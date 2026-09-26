import { prisma } from "@/lib/prisma";
import type { AgentRun } from "@/generated/prisma/client";

type TelemetryRun = Pick<
  AgentRun,
  | "id"
  | "workspaceId"
  | "plannerSessionId"
  | "workerKind"
  | "costTokens"
  | "costUsdCents"
  | "startedAt"
  | "finishedAt"
  | "errorMsg"
  | "status"
>;

export async function recordChainTelemetry(run: TelemetryRun): Promise<void> {
  if (!run.plannerSessionId) return;

  const durationMs = run.startedAt && run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null;

  await prisma.chainTelemetry.create({
    data: {
      workspaceId: run.workspaceId,
      plannerSessionId: run.plannerSessionId,
      agentRunId: run.id,
      workerKind: run.workerKind,
      durationMs,
      costTokens: run.costTokens,
      costUsdCents: run.costUsdCents,
      slaBreach: durationMs !== null && durationMs > 120_000,
      errorClass: run.status === "FAILED" ? run.status : null,
    },
  });
}
