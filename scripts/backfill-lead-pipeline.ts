/**
 * Backfill `WorkspaceLeadPipeline` rows for every existing workspace.
 *
 * Each workspace gets a `BALANCED` preset row with the canonical
 * steps for that preset + workspace plan. Idempotent: workspaces that
 * already have a row are skipped.
 *
 * Run with:  npx tsx scripts/backfill-lead-pipeline.ts
 *
 * The lead onboarding planner already lazy-creates the row on the
 * first `lead_created` event for any workspace that doesn't have one
 * yet, so the backfill is technically optional. We run it on deploy
 * anyway because:
 *   1. The Settings → Lead Pipeline page expects the row to exist so
 *      it can show "last saved at" telemetry.
 *   2. Bulk-inserting once at deploy time is cheaper than O(n)
 *      upserts at lead-ingest time when a workspace finally creates
 *      its first lead.
 */
import { PrismaClient } from "@/generated/prisma/client";
import { getDefaultChain } from "@/lib/ai-core/chains";
import "dotenv/config";

async function main() {
  const prisma = new PrismaClient();
  try {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, plan: true, name: true, leadPipeline: { select: { id: true } } },
    });

    let inserted = 0;
    let skipped = 0;

    for (const ws of workspaces) {
      if (ws.leadPipeline) {
        skipped++;
        continue;
      }
      const steps = getDefaultChain("BALANCED", ws.plan);
      await prisma.workspaceLeadPipeline.create({
        data: {
          workspaceId: ws.id,
          preset: "BALANCED",
          steps: steps as unknown as object,
          enabled: true,
        },
      });
      inserted++;
      console.log(`+ ${ws.name} (${ws.id}) — BALANCED · ${steps.length} steps`);
    }

    console.log(
      `\nBackfill complete. inserted=${inserted} skipped=${skipped} total=${workspaces.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
