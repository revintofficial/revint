/**
 * One-shot: re-emit `lead_created` for the Bianco43 Greenwich lead in the
 * FineDine Beta workspace so the OPENER_WRITER re-runs against the freshly
 * re-embedded SemanticMemory rows (Phase 1 + Phase 2 of the SDR Brain v2
 * recovery plan).
 *
 *   npx tsx scripts/replan-bianco43.ts
 *
 * REQUIRES: a worker supervisor running (`npm run workers`).
 *
 * Multi-tenant safety: the lead lookup is scoped to the FineDine Beta
 * workspaceId; emit() carries workspaceId explicitly.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/ai-core/events";

const FINEDINE_BETA_WORKSPACE_ID = "5496e39e-cc76-41bd-b18b-f1128fb9e41b";
const OWNER_EMAIL = "finedine-owner@leadac.beta";

async function main() {
  const ws = await prisma.workspace.findUnique({
    where: { id: FINEDINE_BETA_WORKSPACE_ID },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!ws) throw new Error(`workspace not found: ${FINEDINE_BETA_WORKSPACE_ID}`);

  const owner = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error(`user not found: ${OWNER_EMAIL}`);

  const lead = await prisma.lead.findFirst({
    where: {
      workspaceId: ws.id,
      OR: [
        { businessName: { contains: "Bianco43", mode: "insensitive" } },
        { businessName: { contains: "Bianco 43", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessName: true,
      formattedAddress: true,
      pipelineStatus: true,
      createdAt: true,
    },
  });
  if (!lead) {
    console.log(
      `[replan-bianco43] no lead matching "Bianco43" in workspace ${ws.slug}`,
    );
    return;
  }

  console.log(`workspace: ${ws.slug} (${ws.name}) [${ws.id}]`);
  console.log(`owner:     ${owner.email} [${owner.id}]`);
  console.log(`lead:      ${lead.id} "${lead.businessName}"`);
  console.log(`address:   ${lead.formattedAddress ?? "(none)"}`);
  console.log(`pipeline:  ${lead.pipelineStatus}`);
  console.log("");

  const sessionId = await emit("lead_created", {
    workspaceId: ws.id,
    leadId: lead.id,
    userId: owner.id,
  });

  if (!sessionId) {
    console.log(
      "[replan-bianco43] emit() returned null — pipeline disabled / blocked / no packages.",
    );
    return;
  }
  console.log(`[replan-bianco43] plannerSession = ${sessionId}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Tail `npm run workers` in a separate terminal.");
  console.log(
    `  2. Open: http://localhost:3000/app/leads/${lead.id}?v=2 in ~60s.`,
  );
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
