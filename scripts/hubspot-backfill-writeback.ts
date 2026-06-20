/**
 * Phase 4 — one-shot HubSpot writeback backfill.
 *
 * The `crm_sync_logs` table was empty because writeback was never
 * triggered after analysis (fixed in Phase 2). Existing leads that were
 * already scored + CRM-linked therefore have nothing in HubSpot. This
 * script sweeps every contact/deal-linked lead in a workspace and fires
 * `enqueueCrmWriteback(reason:"analysis")` once, so the canonical
 * `revint_*` properties get populated for the current book of business.
 *
 * `enqueueCrmWriteback` is idempotent (payload-hash keyed) and safely
 * SKIPs leads with no CRM linkage, so re-running is harmless.
 *
 * Run with:
 *   npx tsx scripts/hubspot-backfill-writeback.ts <workspaceId> [--all]
 *
 *   <workspaceId>  required unless --all is passed
 *   --all          backfill every workspace with a HubSpot connection
 */
import { prisma } from "@/lib/prisma";
import { enqueueCrmWriteback } from "@/lib/integrations/hubspot/writeback";
import "dotenv/config";

async function backfillWorkspace(workspaceId: string): Promise<void> {
  const conn = await prisma.crmConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
    select: { status: true },
  });
  if (!conn || conn.status === "REVOKED") {
    console.log(`  [${workspaceId}] no active HubSpot connection — skipped`);
    return;
  }

  const leads = await prisma.lead.findMany({
    where: {
      workspaceId,
      OR: [{ crmContactId: { not: null } }, { crmDealId: { not: null } }],
    },
    select: { id: true, businessName: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`  [${workspaceId}] ${leads.length} CRM-linked lead(s) to writeback`);

  let success = 0;
  let skipped = 0;
  let failed = 0;
  for (const lead of leads) {
    const res = await enqueueCrmWriteback(prisma, {
      workspaceId,
      leadId: lead.id,
      reason: "analysis",
    });
    if (res.status === "SUCCESS") success += 1;
    else if (res.status === "SKIPPED") skipped += 1;
    else failed += 1;
    console.log(
      `    - ${lead.businessName ?? lead.id}: ${res.status}${
        res.reason ? ` (${res.reason})` : ""
      }`,
    );
  }

  console.log(
    `  [${workspaceId}] done — ${success} success, ${skipped} skipped, ${failed} failed`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const workspaceId = args.find((a) => !a.startsWith("--"));

  if (!all && !workspaceId) {
    throw new Error(
      "Usage: tsx scripts/hubspot-backfill-writeback.ts <workspaceId> [--all]",
    );
  }

  let workspaceIds: string[];
  if (all) {
    const conns = await prisma.crmConnection.findMany({
      where: { provider: "HUBSPOT", status: { not: "REVOKED" } },
      select: { workspaceId: true },
    });
    workspaceIds = conns.map((c) => c.workspaceId);
    console.log(`Backfilling ${workspaceIds.length} workspace(s) with HubSpot.`);
  } else {
    workspaceIds = [workspaceId as string];
  }

  for (const id of workspaceIds) {
    await backfillWorkspace(id);
  }
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
