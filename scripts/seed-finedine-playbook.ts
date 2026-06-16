/**
 * FineDine v1 update — seed the FineDine sales playbook onto a workspace.
 *
 * Upserts a `WorkspacePlaybook` row (one per workspace) with the
 * `FINEDINE_PLAYBOOK` shape from `src/lib/playbook/types.ts`. Idempotent:
 * re-running overwrites the JSON columns with the latest seed (so editing
 * the seed + re-running is the dev workflow until the playbook editor UI
 * ships).
 *
 * Usage:
 *   npx tsx scripts/seed-finedine-playbook.ts --workspace-slug finedine-beta
 *   npx tsx scripts/seed-finedine-playbook.ts --workspace-id <cuid>
 *   npx tsx scripts/seed-finedine-playbook.ts --all-restaurant-tech
 *
 * The `--all-restaurant-tech` flag seeds every RESTAURANT_TECH workspace
 * that does not already have a playbook (skips ones that do).
 */
import { PrismaClient } from "@/generated/prisma/client";
import { FINEDINE_PLAYBOOK } from "@/lib/playbook/types";
import "dotenv/config";

interface Args {
  workspaceSlug?: string;
  workspaceId?: string;
  allRestaurantTech?: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--workspace-slug" && next) {
      a.workspaceSlug = next;
      i += 1;
    } else if (arg === "--workspace-id" && next) {
      a.workspaceId = next;
      i += 1;
    } else if (arg === "--all-restaurant-tech") {
      a.allRestaurantTech = true;
    }
  }
  if (!a.workspaceSlug && !a.workspaceId && !a.allRestaurantTech) {
    throw new Error(
      "Pass --workspace-slug <slug>, --workspace-id <id>, or --all-restaurant-tech",
    );
  }
  return a;
}

const PLAYBOOK_DATA = {
  stages: FINEDINE_PLAYBOOK.stages as unknown as object,
  angles: FINEDINE_PLAYBOOK.angles as unknown as object,
  qualificationChecklist: FINEDINE_PLAYBOOK.qualificationChecklist as unknown as object,
  temperatureRules: FINEDINE_PLAYBOOK.temperatureRules as unknown as object,
  noShowRiskRules: FINEDINE_PLAYBOOK.noShowRiskRules as unknown as object,
};

async function seedOne(prisma: PrismaClient, workspaceId: string): Promise<void> {
  await prisma.workspacePlaybook.upsert({
    where: { workspaceId },
    update: PLAYBOOK_DATA,
    create: { workspaceId, ...PLAYBOOK_DATA },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    if (args.allRestaurantTech) {
      const workspaces = await prisma.workspace.findMany({
        where: { niche: "RESTAURANT_TECH" },
        select: { id: true, name: true, playbook: { select: { id: true } } },
      });
      let seeded = 0;
      let skipped = 0;
      for (const ws of workspaces) {
        if (ws.playbook) {
          skipped += 1;
          continue;
        }
        await seedOne(prisma, ws.id);
        seeded += 1;
        console.log(`  ✓ seeded playbook for "${ws.name}" (${ws.id})`);
      }
      console.log(`\nDone. seeded=${seeded} skipped=${skipped}`);
      return;
    }

    const workspace = await prisma.workspace.findFirst({
      where: args.workspaceId
        ? { id: args.workspaceId }
        : { slug: args.workspaceSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!workspace) {
      throw new Error(
        `Workspace not found for ${args.workspaceId ?? args.workspaceSlug}`,
      );
    }
    await seedOne(prisma, workspace.id);
    console.log(`✓ seeded FineDine playbook for "${workspace.name}" (${workspace.slug})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
