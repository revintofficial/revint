/**
 * Diagnostic: validate the stored OAuth token + fetch contact associations
 * for a company-linked lead, so we can reproduce the App Card lookup the
 * way HubSpot actually calls it (objectTypeId "0-1" for contacts).
 *
 *   npx tsx scripts/hubspot-assoc-diag.ts <companyId>
 */
import { prisma } from "@/lib/prisma";
import { getHubspotClient } from "@/lib/integrations/hubspot/client";
import "dotenv/config";

async function main(): Promise<void> {
  const companyId = process.argv[2] ?? "433596564678";

  const conn = await prisma.crmConnection.findFirst({
    where: { provider: "HUBSPOT", status: { not: "REVOKED" } },
    select: { workspaceId: true, portalId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!conn) {
    console.log("No active HubSpot connection.");
    return;
  }
  console.log(`workspace ${conn.workspaceId} · portal ${conn.portalId}`);

  let client;
  try {
    client = await getHubspotClient(prisma, conn.workspaceId);
    console.log("✓ getHubspotClient OK (token usable)");
  } catch (e) {
    console.log(`✗ getHubspotClient failed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  try {
    const assoc = await client.getAssociations("companies", companyId, "contacts");
    console.log(`Company ${companyId} → contacts:`, JSON.stringify(assoc.results ?? assoc, null, 2));
  } catch (e) {
    console.log(`✗ getAssociations failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
