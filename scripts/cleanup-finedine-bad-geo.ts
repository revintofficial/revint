/**
 * One-time cleanup for the FineDine Beta workspace.
 *
 * Background — see `research/finedine/discovery-bugs.md` and the
 * picker-based Discovery PR. Before the LocationPicker fix, a single
 * "buyukcekmece istanbul" run pulled ~110 leads of which:
 *   - 54 were correctly in Büyükçekmece
 *   -  4 in Beylikdüzü (adjacent — acceptable spillover)
 *   - ~8 in unrelated Istanbul districts (Beyoğlu, Şişli, Sarıyer,
 *     Ataşehir, Kağıthane, Fatih, Esenyurt)
 *   - 35+ in US counties (Bend OR food trucks, NY, SF, LA, Miami,
 *     Fulton, Harris, …)
 *
 * Root cause: when geocodeBorough() failed to parse the typed string,
 * /api/discovery fell through to a Places call without any
 * locationRestriction; Google then returned globally popular matches.
 *
 * This script soft-deletes the off-target rows by setting
 * `discardedAt` so the beta tester (`finedine-owner@leadac.beta`)
 * doesn't see them in the leads list. We do NOT hard-delete because
 * (a) the rows still have value as a "what does silent geocode rot
 * look like" reference, and (b) AgentRun rows reference these leads
 * — cascading those would lose worker telemetry.
 *
 * Safety:
 *   - Always scoped by workspaceId (multi-tenant rule).
 *   - --dry runs read-only and prints what would change.
 *   - DO NOT RUN before the picker fix is deployed. Re-running the
 *     same Discovery click without the fix will just re-import
 *     these rows.
 *
 * Usage:
 *   npx tsx scripts/cleanup-finedine-bad-geo.ts --dry
 *   npx tsx scripts/cleanup-finedine-bad-geo.ts --apply
 */

import { PrismaClient } from "@/generated/prisma/client";
import "dotenv/config";

const FINEDINE_WORKSPACE_ID = "5496e39e-cc76-41bd-b18b-f1128fb9e41b";

// Boroughs that count as "in target" for the Büyükçekmece beta run.
// Beylikdüzü is the only legitimate spillover (adjacent district on
// the European side coast).
const TARGET_BOROUGHS = new Set(["Büyükçekmece", "Beylikdüzü"]);

async function main() {
  const apply = process.argv.includes("--apply");
  const dry = process.argv.includes("--dry") || !apply;

  const prisma = new PrismaClient();
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: FINEDINE_WORKSPACE_ID },
      select: { id: true, name: true, slug: true, country: true },
    });
    if (!ws) {
      console.error(
        `Workspace ${FINEDINE_WORKSPACE_ID} not found. Aborting (this script is FineDine-only).`,
      );
      process.exit(1);
    }

    console.log(`Target workspace: ${ws.name} (${ws.slug}) — country=${ws.country}`);

    // Pull every lead created by a "buyukcekmece" Discovery run that
    // landed outside the two acceptable boroughs. The sourceQuery
    // column carries the original user input so we filter on it
    // verbatim — case-insensitive to catch "Buyukcekmece" + "büyükçekmece".
    const candidates = await prisma.lead.findMany({
      where: {
        workspaceId: ws.id,
        sourceQuery: { contains: "buyukcekmece", mode: "insensitive" },
        borough: { notIn: Array.from(TARGET_BOROUGHS) },
        discardedAt: null,
      },
      select: {
        id: true,
        businessName: true,
        borough: true,
        formattedAddress: true,
        sourceQuery: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`\nFound ${candidates.length} off-target leads (borough not in ${
      Array.from(TARGET_BOROUGHS).join(", ")
    }):\n`);

    // Bucket by borough for the diff report so the operator can sanity-
    // check before flipping --apply.
    const byBorough = new Map<string, typeof candidates>();
    for (const lead of candidates) {
      const key = lead.borough || "(empty)";
      const arr = byBorough.get(key) ?? [];
      arr.push(lead);
      byBorough.set(key, arr);
    }
    const sorted = [...byBorough.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [borough, rows] of sorted) {
      console.log(`  ${borough.padEnd(28)} ${rows.length}`);
    }

    if (candidates.length === 0) {
      console.log("\nNothing to clean up. Exiting.");
      return;
    }

    if (dry) {
      console.log(`\n[dry] Would soft-delete ${candidates.length} leads.`);
      console.log("[dry] Re-run with --apply to commit.");
      return;
    }

    // Soft-delete via discardedAt. updateMany scoped by workspaceId is
    // the safe path — Prisma's `update` with id alone would leak across
    // tenants (multi-tenant rule).
    const ids = candidates.map((c) => c.id);
    const result = await prisma.lead.updateMany({
      where: {
        workspaceId: ws.id,
        id: { in: ids },
      },
      data: {
        discardedAt: new Date(),
      },
    });

    console.log(`\nSoft-deleted ${result.count} leads (discardedAt set).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
