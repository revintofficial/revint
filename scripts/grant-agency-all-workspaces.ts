/**
 * Set every workspace to AGENCY plan with a long trial period (matches
 * `grant-agency.ts` per-workspace behavior).
 *
 * Idempotent: workspaces already on AGENCY still get `currentPeriodEnd` refreshed.
 *
 * Run:
 *   npx tsx scripts/grant-agency-all-workspaces.ts           # apply
 *   npx tsx scripts/grant-agency-all-workspaces.ts --dry-run # list only
 */
import { PrismaClient } from "@/generated/prisma/client";
import "dotenv/config";

const HUNDRED_YEARS_MS = 100 * 365.25 * 24 * 60 * 60 * 1000;

function periodEnd(): Date {
  return new Date(Date.now() + HUNDRED_YEARS_MS);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const prisma = new PrismaClient();
  try {
    const before = await prisma.workspace.findMany({
      select: { id: true, name: true, slug: true, plan: true },
      orderBy: { slug: "asc" },
    });

    console.log(`Workspaces (${before.length}):`);
    for (const w of before) {
      console.log(`  - ${w.slug} | ${w.plan} | ${w.name}`);
    }

    if (dryRun) {
      const wouldChange = before.filter((w) => w.plan !== "AGENCY");
      console.log(
        `\n--dry-run: would set plan=AGENCY on ${wouldChange.length} workspace(s); ${before.length - wouldChange.length} already AGENCY.`
      );
      return;
    }

    const updated = await prisma.workspace.updateMany({
      data: {
        plan: "AGENCY",
        currentPeriodEnd: periodEnd(),
      },
    });

    console.log(`\nUpdated ${updated.count} row(s) -> AGENCY, current_period_end ~100y.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
