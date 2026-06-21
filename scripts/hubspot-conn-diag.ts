/**
 * Diagnostic: list every CrmConnection for a portal + lead counts per
 * workspace, to detect the "same HubSpot portal connected to multiple
 * Revint workspaces" case that makes card-data resolve the wrong leads.
 *
 *   npx tsx scripts/hubspot-conn-diag.ts [portalId]
 */
import { prisma } from "@/lib/prisma";
import "dotenv/config";

async function main(): Promise<void> {
  const portalId = process.argv[2] ?? "148499892";

  const conns = await prisma.crmConnection.findMany({
    where: { portalId, provider: "HUBSPOT" },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`\n${conns.length} CrmConnection row(s) for portal ${portalId}:\n`);
  for (const c of conns) {
    const total = await prisma.lead.count({ where: { workspaceId: c.workspaceId } });
    const scored = await prisma.lead.count({
      where: { workspaceId: c.workspaceId, salesConfidence: { not: null } },
    });
    const linked = await prisma.lead.count({
      where: {
        workspaceId: c.workspaceId,
        OR: [
          { crmContactId: { not: null } },
          { crmCompanyId: { not: null } },
          { crmDealId: { not: null } },
        ],
      },
    });
    console.log(
      `• conn=${c.id} ws=${c.workspaceId} status=${c.status} updated=${c.updatedAt.toISOString()}\n` +
        `    leads=${total}  scored=${scored}  crmLinked=${linked}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
