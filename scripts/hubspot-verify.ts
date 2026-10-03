/**
 * End-to-end HubSpot writeback check: which of the 14 `revint_*`
 * properties exist in the portal (contacts + companies) and which are
 * filled on a given Company / Contact. Read-only.
 *
 *   npx tsx scripts/hubspot-verify.ts --portal 148499892 --company 1234567890
 *   npx tsx scripts/hubspot-verify.ts --portal 148499892 --lead <leadId>
 *   npx tsx scripts/hubspot-verify.ts --workspace <workspaceId> --contact 42
 *
 * `--portal` resolves the workspace through `crm_connections.portal_id`.
 * `--lead` uses the lead's crmCompanyId / crmContactId (workspace-scoped)
 * and also prints the lead's latest outbound `crm_sync_logs` rows.
 * Exit code 1 when a definition is missing or the given record has no
 * filled revint_* property — usable as a post-deploy smoke check.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { getHubspotClient } from "@/lib/integrations/hubspot/client";
import { missingWritebackScopes } from "@/lib/integrations/hubspot/properties";
import { verifyRevintProperties } from "@/lib/integrations/hubspot/verify";

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const portal = argValue(args, "--portal");
  let workspaceId = argValue(args, "--workspace");
  let companyId = argValue(args, "--company") ?? null;
  let contactId = argValue(args, "--contact") ?? null;
  const leadId = argValue(args, "--lead");

  if (!workspaceId && portal) {
    const conns = await prisma.crmConnection.findMany({
      where: { provider: "HUBSPOT", portalId: portal, status: { not: "REVOKED" } },
      select: { workspaceId: true },
    });
    if (conns.length === 0) throw new Error(`No active HubSpot connection for portal ${portal}`);
    if (conns.length > 1) {
      throw new Error(
        `Portal ${portal} is connected to ${conns.length} workspaces (${conns
          .map((c) => c.workspaceId)
          .join(", ")}); pass --workspace`,
      );
    }
    workspaceId = conns[0].workspaceId;
  }
  if (!workspaceId) {
    throw new Error("Usage: tsx scripts/hubspot-verify.ts (--portal <id> | --workspace <id>) [--company <id>] [--contact <id>] [--lead <id>]");
  }

  const conn = await prisma.crmConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
    select: { portalId: true, status: true, scopes: true, lastError: true, propertiesProvisionedAt: true },
  });
  console.log(`Workspace ${workspaceId} · portal ${conn?.portalId ?? "?"} · status ${conn?.status ?? "none"}`);
  const missing = missingWritebackScopes(conn?.scopes);
  console.log(`  scopes: ${missing.length ? `MISSING ${missing.join(", ")}` : "OK"}`);
  console.log(`  propertiesProvisionedAt: ${conn?.propertiesProvisionedAt?.toISOString() ?? "never"}`);
  if (conn?.lastError) console.log(`  connection lastError: ${conn.lastError}`);

  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { businessName: true, crmCompanyId: true, crmContactId: true, crmLastSyncedAt: true },
    });
    if (!lead) throw new Error(`Lead ${leadId} not found in workspace ${workspaceId}`);
    companyId = companyId ?? lead.crmCompanyId;
    contactId = contactId ?? lead.crmContactId;
    console.log(`  lead ${lead.businessName} · crmLastSyncedAt ${lead.crmLastSyncedAt?.toISOString() ?? "never"}`);
    const logs = await prisma.crmSyncLog.findMany({
      where: { workspaceId, leadId, direction: "OUTBOUND" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { status: true, attempts: true, updatedAt: true, lastError: true },
    });
    for (const l of logs) {
      console.log(
        `    sync ${l.updatedAt.toISOString()} ${l.status} x${l.attempts}${
          l.lastError ? ` — ${l.lastError.split("\n")[0].slice(0, 200)}` : ""
        }`,
      );
    }
  }

  const client = await getHubspotClient(prisma, workspaceId);
  const report = await verifyRevintProperties(client, { companies: companyId, contacts: contactId });

  let bad = false;
  for (const obj of report) {
    console.log(
      `\n${obj.objectType}${obj.recordId ? ` #${obj.recordId}` : ""}: ${obj.existsCount}/14 defined` +
        (obj.recordId ? `, ${obj.filledCount}/14 filled` : ""),
    );
    if (obj.definitionsError) console.log(`  definitions error: ${obj.definitionsError}`);
    if (obj.recordError) console.log(`  record error: ${obj.recordError}`);
    for (const p of obj.properties) {
      const val = obj.recordId ? ` ${p.filled ? `= ${(p.value ?? "").slice(0, 80)}` : "(empty)"}` : "";
      console.log(`  ${p.exists ? "✓" : "✗"} ${p.name}${val}`);
    }
    if (obj.existsCount < 14 || obj.definitionsError) bad = true;
    if (obj.recordId && (obj.filledCount === 0 || obj.recordError)) bad = true;
  }
  if (bad) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
