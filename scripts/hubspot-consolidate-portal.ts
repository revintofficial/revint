/**
 * Consolidate HubSpot portal 148499892 onto a single canonical workspace.
 *
 * The same portal got connected from multiple Revint workspaces during
 * testing, which made card-data / webhook portal->workspace resolution
 * ambiguous. This soft-revokes every connection for the portal EXCEPT the
 * canonical one (DB-only status flip — we deliberately do NOT hit HubSpot's
 * token-revoke endpoint, because all connections share one app install and
 * revoking the shared token would break the canonical connection too).
 *
 *   npx tsx scripts/hubspot-consolidate-portal.ts <portalId> <canonicalWorkspaceId>
 */
import { prisma } from "@/lib/prisma";
import "dotenv/config";

async function main(): Promise<void> {
  const portalId = process.argv[2] ?? "148499892";
  const canonical = process.argv[3] ?? "cmqk0oj0x00057k3g23z3zxwh";

  const conns = await prisma.crmConnection.findMany({
    where: { portalId, provider: "HUBSPOT" },
    select: { id: true, workspaceId: true, status: true },
  });

  const canonicalConn = conns.find((c) => c.workspaceId === canonical);
  if (!canonicalConn) {
    console.log(`✗ No connection found for canonical workspace ${canonical}. Aborting.`);
    return;
  }

  for (const c of conns) {
    if (c.workspaceId === canonical) {
      console.log(`✓ keep   conn=${c.id} ws=${c.workspaceId} (canonical, status=${c.status})`);
      continue;
    }
    if (c.status === "REVOKED") {
      console.log(`· already conn=${c.id} ws=${c.workspaceId} (already REVOKED)`);
      continue;
    }
    await prisma.crmConnection.update({
      where: { id: c.id },
      data: { status: "REVOKED" },
    });
    console.log(`✗ revoke conn=${c.id} ws=${c.workspaceId} (was ${c.status} -> REVOKED, DB-only)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
