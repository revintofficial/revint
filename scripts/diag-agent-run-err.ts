/**
 * Dump FULL errorMsg for the latest FAILED AgentRun per workerKind for
 * a given lead. The diag-lead-brain truncation was hiding the real
 * Prisma validation error.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const leadId = process.argv[2]?.trim();
  if (!leadId) throw new Error("Usage: tsx scripts/diag-agent-run-err.ts <leadId>");

  const lead = await prisma.lead.findFirst({
    where: { id: leadId },
    select: { workspaceId: true, businessName: true },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const kinds = ["BANT_INFERRER", "TRIGGER_DETECTOR", "ACCOUNT_TIER_RANKER", "ICP_SCORER", "BUYING_COMMITTEE_MAPPER", "COMMERCIAL_INSIGHT_MATCHER", "OBJECTION_PREDICTOR", "LEAD_INTELLIGENCE_BRIEF"];

  for (const kind of kinds) {
    const run = await prisma.agentRun.findFirst({
      where: { workspaceId: lead.workspaceId, leadId, workerKind: kind as never },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, errorMsg: true, createdAt: true, startedAt: true, finishedAt: true },
    });
    console.log(`\n=== ${kind} ===`);
    if (!run) {
      console.log("(no run found)");
      continue;
    }
    console.log(`id=${run.id} status=${run.status}`);
    console.log(`createdAt=${run.createdAt.toISOString()}`);
    console.log(`started=${run.startedAt?.toISOString() ?? "n/a"} finished=${run.finishedAt?.toISOString() ?? "n/a"}`);
    if (run.errorMsg) {
      console.log("--- errorMsg (full) ---");
      console.log(run.errorMsg);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
