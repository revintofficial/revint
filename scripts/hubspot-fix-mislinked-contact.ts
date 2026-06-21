/**
 * Repair: clear a crmContactId that was attached to the wrong (unscored,
 * CRM-only) lead, so the card-data association fallback can re-resolve the
 * contact to its correct scored company-linked lead.
 *
 * Specific to the test data in workspace cmqk0oj0x: contact 800803505378's
 * HubSpot primary company is 433544966336 (scored "Zizzi - Greenwich"), but
 * the id got stuck on the unscored "Zizzi" lead (company 433523368152).
 *
 *   npx tsx scripts/hubspot-fix-mislinked-contact.ts
 */
import { prisma } from "@/lib/prisma";
import "dotenv/config";

const WORKSPACE_ID = "cmqk0oj0x00057k3g23z3zxwh";
const WRONG_LEAD_ID = "cmqlr3jsl000fjl048opekonz"; // unscored "Zizzi"
const CONTACT_ID = "800803505378";

async function main(): Promise<void> {
  const before = await prisma.lead.findFirst({
    where: { id: WRONG_LEAD_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, businessName: true, crmContactId: true, crmCompanyId: true },
  });
  console.log("before:", JSON.stringify(before));

  if (!before) {
    console.log("Lead not found — nothing to do.");
    return;
  }
  if (before.crmContactId !== CONTACT_ID) {
    console.log(`crmContactId is ${before.crmContactId ?? "null"} (not ${CONTACT_ID}) — skipping to avoid clobbering.`);
    return;
  }

  const res = await prisma.lead.updateMany({
    where: { id: WRONG_LEAD_ID, workspaceId: WORKSPACE_ID, crmContactId: CONTACT_ID },
    data: { crmContactId: null },
  });
  console.log(`cleared crmContactId on ${WRONG_LEAD_ID} (count=${res.count})`);

  const after = await prisma.lead.findFirst({
    where: { id: WRONG_LEAD_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, businessName: true, crmContactId: true, crmCompanyId: true },
  });
  console.log("after:", JSON.stringify(after));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
