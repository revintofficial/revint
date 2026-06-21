/**
 * Diagnostic: show how Revint leads map to HubSpot CRM records for the
 * connected portal, so we can see why a contact shows "Not yet on Revint"
 * (lead_not_found) in the App Card.
 *
 *   npx tsx scripts/hubspot-lead-link-diag.ts
 */
import { prisma } from "@/lib/prisma";
import "dotenv/config";

async function main(): Promise<void> {
  const conn = await prisma.crmConnection.findFirst({
    where: { provider: "HUBSPOT", status: { not: "REVOKED" } },
    select: { portalId: true, workspaceId: true, status: true, scopes: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!conn) {
    console.log("No active HubSpot connection found.");
    return;
  }
  console.log(`Portal ${conn.portalId} · workspace ${conn.workspaceId} · status ${conn.status}`);

  const leads = await prisma.lead.findMany({
    where: { workspaceId: conn.workspaceId },
    select: {
      id: true,
      businessName: true,
      crmContactId: true,
      crmCompanyId: true,
      crmDealId: true,
      leadTemperature: true,
      salesConfidence: true,
      intelligenceVersion: true,
      inboundReceivedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  console.log(`\n${leads.length} lead(s) in this workspace:\n`);
  for (const l of leads) {
    console.log(
      [
        `• ${l.businessName ?? "(no name)"}`,
        `id=${l.id}`,
        `contact=${l.crmContactId ?? "-"}`,
        `company=${l.crmCompanyId ?? "-"}`,
        `deal=${l.crmDealId ?? "-"}`,
        `temp=${l.leadTemperature ?? "-"}`,
        `conf=${l.salesConfidence ?? "-"}`,
        `intelV=${l.intelligenceVersion ?? "-"}`,
      ].join("  "),
    );
  }

  const linked = leads.filter(
    (l) => l.crmContactId || l.crmCompanyId || l.crmDealId,
  ).length;
  const scored = leads.filter((l) => l.salesConfidence != null).length;
  console.log(
    `\nLinked to CRM: ${linked}/${leads.length} · scored (salesConfidence set): ${scored}/${leads.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
