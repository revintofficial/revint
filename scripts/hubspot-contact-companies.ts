/**
 * Diagnostic: list the companies a contact is associated with (and which
 * is primary), so we can see why the card-data fallback resolves an
 * unscored duplicate instead of the scored lead.
 *
 *   npx tsx scripts/hubspot-contact-companies.ts <contactId>
 */
import { prisma } from "@/lib/prisma";
import { getHubspotClient } from "@/lib/integrations/hubspot/client";
import "dotenv/config";

async function main(): Promise<void> {
  const contactId = process.argv[2] ?? "800803505378";
  const conn = await prisma.crmConnection.findFirst({
    where: { provider: "HUBSPOT", status: { not: "REVOKED" } },
    orderBy: { updatedAt: "desc" },
    select: { workspaceId: true },
  });
  if (!conn) return;
  const client = await getHubspotClient(prisma, conn.workspaceId);
  const assoc = await client.getAssociations("contacts", contactId, "companies");
  console.log(`contact ${contactId} → companies:`);
  console.log(JSON.stringify(assoc.results ?? assoc, null, 2));

  for (const a of assoc.results ?? []) {
    const companyId = String(a.toObjectId);
    const lead = await prisma.lead.findFirst({
      where: { workspaceId: conn.workspaceId, crmCompanyId: companyId },
      select: { id: true, businessName: true, salesConfidence: true },
    });
    console.log(`  company ${companyId} → lead ${lead?.businessName ?? "(none)"} conf=${lead?.salesConfidence ?? "-"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
