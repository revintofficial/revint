// scripts/analysis-baseline.ts
/**
 * Read-only baseline of the lead analysis chain for one workspace.
 *
 *   npx tsx scripts/analysis-baseline.ts <workspaceId>              # last 30 leads, markdown
 *   npx tsx scripts/analysis-baseline.ts <workspaceId> --limit 50
 *   npx tsx scripts/analysis-baseline.ts <workspaceId> --json       # per-lead rows
 *
 * Writes nothing. Every query is scoped to the given workspace.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { loadMapFacts, toRoomOneAudit } from "@/lib/agent-workers/lead-intelligence-brief";
import { buildRevintProperties } from "@/lib/integrations/hubspot/writeback";
import {
  CHAIN_WORKERS,
  aggregateBaseline,
  renderBaselineMarkdown,
  summarizeLead,
  type BaselineRun,
  type ChainWorker,
} from "@/lib/control/analysis-baseline";

async function main() {
  const args = process.argv.slice(2);
  const workspaceId = args.find((a) => !a.startsWith("--"));
  if (!workspaceId) throw new Error("usage: analysis-baseline.ts <workspaceId> [--limit N] [--json]");
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Math.max(1, Number(args[limitAt + 1]) || 30) : 30;

  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { websiteAudit: true, reviewAnalysis: true, googleReviews: { select: { text: true } } },
  });

  const rows = [];
  for (const lead of leads) {
    const runs: Partial<Record<ChainWorker, BaselineRun | null>> = {};
    for (const kind of CHAIN_WORKERS) {
      runs[kind] = await prisma.agentRun.findFirst({
        where: { workspaceId, leadId: lead.id, workerKind: kind },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, outputJson: true, finishedAt: true },
      });
    }
    const nextAction = await prisma.leadNextAction.findFirst({
      where: { workspaceId, leadId: lead.id, supersededAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const brief = runs.LEAD_INTELLIGENCE_BRIEF;
    const briefSucceeded = brief && (brief.status === "SUCCEEDED" || brief.status === "SUCCEEDED_NO_MEMORY");
    const built = await buildRevintProperties(prisma, workspaceId, lead.id, briefSucceeded ? { briefRunId: brief.id } : {});
    const map = await loadMapFacts(workspaceId, lead.id);
    rows.push(
      summarizeLead({
        leadId: lead.id,
        businessName: lead.businessName,
        runs,
        roomOneAudit: toRoomOneAudit(lead as never, map.facts) as Record<string, unknown> | null,
        reviewTexts: lead.googleReviews.map((r) => r.text ?? ""),
        nextActionCreatedAt: nextAction?.createdAt ?? null,
        hubspotProps: built?.properties ?? null,
      }),
    );
  }

  console.log(args.includes("--json") ? JSON.stringify(rows, null, 2) : renderBaselineMarkdown(aggregateBaseline(rows)));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
