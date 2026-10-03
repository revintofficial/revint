// scripts/website-audit-eval/list-workspaces.ts
/**
 * Read-only: per workspace, how many food-service leads carry a website.
 * Used to pick the eval sample. Each count is scoped by workspaceId.
 *
 *   npx tsx scripts/website-audit-eval/list-workspaces.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const FOOD = /restaurant|cafe|coffee|bar|pub|bakery|bistro|steak|pizza|food|meal|brunch|acai|dessert/i;

async function main() {
  const workspaces = await prisma.workspace.findMany({ select: { id: true, name: true } });
  for (const ws of workspaces) {
    const leads = await prisma.lead.findMany({
      where: { workspaceId: ws.id, websiteUrl: { not: null } },
      select: { primaryType: true },
    });
    const food = leads.filter((l) => l.primaryType && FOOD.test(l.primaryType)).length;
    if (food > 0) console.log(`${ws.id}\t${ws.name}\t${food}/${leads.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
