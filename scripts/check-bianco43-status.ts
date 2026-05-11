/**
 * One-shot status check for the Bianco43 Greenwich replan.
 *   npx tsx scripts/check-bianco43-status.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const FINEDINE_BETA_WORKSPACE_ID = "5496e39e-cc76-41bd-b18b-f1128fb9e41b";
const BIANCO_LEAD_ID = "cmp0ckgqy002q7k5kxmhih0xz";
const SESSION_ID = "cmp0khnd200017k9www21jopl";

async function main() {
  const session = await prisma.plannerSession.findFirst({
    where: { id: SESSION_ID, workspaceId: FINEDINE_BETA_WORKSPACE_ID },
    select: {
      id: true,
      status: true,
      triggeredBy: true,
      errorMsg: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log("--- PlannerSession ---");
  console.log(session ?? "(not found)");
  console.log("");

  const runs = await prisma.agentRun.findMany({
    where: {
      workspaceId: FINEDINE_BETA_WORKSPACE_ID,
      leadId: BIANCO_LEAD_ID,
      plannerSessionId: SESSION_ID,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      workerKind: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      errorMsg: true,
    },
  });
  console.log(`--- AgentRuns for this session (${runs.length}) ---`);
  for (const r of runs) {
    const dur =
      r.startedAt && r.finishedAt
        ? `${r.finishedAt.getTime() - r.startedAt.getTime()}ms`
        : r.startedAt
          ? "RUNNING"
          : "QUEUED";
    console.log(
      `  [${r.status.padEnd(11)}] ${r.workerKind.padEnd(28)} ${dur} ${r.errorMsg ? `err=${r.errorMsg.slice(0, 80)}` : ""}`,
    );
  }
  console.log("");

  // Latest opener output (regardless of session)
  const latestOpener = await prisma.agentRun.findFirst({
    where: {
      workspaceId: FINEDINE_BETA_WORKSPACE_ID,
      leadId: BIANCO_LEAD_ID,
      workerKind: "OPENER_WRITER",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      finishedAt: true,
      outputJson: true,
      plannerSessionId: true,
    },
  });
  console.log("--- Latest OPENER_WRITER output for Bianco43 ---");
  if (!latestOpener) {
    console.log("(none yet)");
  } else {
    console.log(`runId:         ${latestOpener.id}`);
    console.log(`finishedAt:    ${latestOpener.finishedAt?.toISOString()}`);
    console.log(`session:       ${latestOpener.plannerSessionId}`);
    const out = latestOpener.outputJson as Record<string, unknown> | null;
    if (out && typeof out === "object") {
      const hook = (out as { hook?: string }).hook;
      const angle = (out as { angle?: string }).angle;
      const reasoning = (out as { reasoning?: string }).reasoning;
      console.log(`hook:          ${hook ?? "(missing)"}`);
      console.log(`angle:         ${angle ?? "(missing)"}`);
      console.log(`reasoning:     ${reasoning?.slice(0, 200) ?? "(missing)"}`);
    } else {
      console.log("output:", out);
    }
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
