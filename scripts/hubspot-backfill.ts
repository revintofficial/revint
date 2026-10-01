/**
 * HubSpot writeback backfill — push each CRM-linked lead's latest
 * successful LEAD_INTELLIGENCE_BRIEF to HubSpot (Company + Contact).
 *
 * DRY-RUN BY DEFAULT: prints the `revint_*` payload per lead and writes
 * nothing. Pass `--apply` to actually write. Applying is idempotent: each
 * write is keyed on the brief run id in `crm_sync_logs`, so re-running
 * only retries leads whose last attempt failed.
 *
 *   npx tsx scripts/hubspot-backfill.ts <workspaceId>            # dry run
 *   npx tsx scripts/hubspot-backfill.ts <workspaceId> --apply    # write
 *   npx tsx scripts/hubspot-backfill.ts <workspaceId> --apply --limit 50
 *   npx tsx scripts/hubspot-backfill.ts --all --apply            # every HubSpot workspace
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { runHubspotBackfill } from "@/lib/integrations/hubspot/verify";

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function backfillWorkspace(workspaceId: string, apply: boolean, limit: number) {
  const conn = await prisma.crmConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
    select: { status: true, portalId: true, lastError: true },
  });
  if (!conn || conn.status === "REVOKED") {
    console.log(`[${workspaceId}] no active HubSpot connection — skipped`);
    return;
  }
  console.log(
    `[${workspaceId}] portal ${conn.portalId ?? "?"} · ${apply ? "APPLY" : "DRY RUN"}${
      conn.lastError ? ` · connection lastError: ${conn.lastError}` : ""
    }`,
  );

  const results = await runHubspotBackfill(prisma, { workspaceId, apply, limit });
  const tally: Record<string, number> = {};
  for (const r of results) {
    tally[r.status] = (tally[r.status] ?? 0) + 1;
    console.log(
      `  - ${r.businessName ?? r.leadId} [${r.targets.join(", ") || "no target"}] → ${r.status}${
        r.reason ? ` (${r.reason.split("\n")[0]})` : ""
      }`,
    );
    if (r.properties) {
      for (const [k, v] of Object.entries(r.properties)) {
        console.log(`      ${k} = ${v.length > 120 ? `${v.slice(0, 117)}...` : v}`);
      }
    }
  }
  console.log(`[${workspaceId}] ${results.length} lead(s):`, tally);
  if (!apply) console.log("Dry run only. Re-run with --apply to write to HubSpot.");
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const all = args.includes("--all");
  const limit = Number(argValue(args, "--limit") ?? 500);
  const workspaceId = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit");

  if (!all && !workspaceId) {
    throw new Error("Usage: tsx scripts/hubspot-backfill.ts <workspaceId> [--apply] [--limit N] | --all [--apply]");
  }

  const ids = all
    ? (
        await prisma.crmConnection.findMany({
          where: { provider: "HUBSPOT", status: { not: "REVOKED" } },
          select: { workspaceId: true },
        })
      ).map((c) => c.workspaceId)
    : [workspaceId as string];

  for (const id of ids) await backfillWorkspace(id, apply, limit);
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
