/**
 * Phase-3 smoke driver — re-emits `lead_created` for the last N leads
 * across every workspace the given user can access (owner OR member).
 *
 * Why this exists.  Phase 6 of the plan ships a proper
 * `POST /api/leads/[id]/replan-brain` endpoint + `user_replan_brain`
 * chain that skips Discovery/Audit/Scorer and only runs the SDR-Brain
 * substrate. Until that lands, this script is the only safe way to
 * see Phase-0-through-3 output on previously-ingested leads. It is a
 * one-shot tool (not registered in package.json) — use it like:
 *
 *   npx tsx scripts/replan-brain-for-user.ts finedine-owner@leadac.beta
 *
 * Optional second arg: how many recent leads to re-emit per workspace
 * (default 20).
 *
 *   npx tsx scripts/replan-brain-for-user.ts founder@foo.com 5
 *
 * REQUIRES: a BullMQ worker supervisor (`npm run workers`) running in
 * a separate terminal — without it, the emitted PlannerSessions sit in
 * the queue and never advance.
 *
 * Side effects:
 *   - Each lead re-runs its FULL `lead_created` chain (per workspace
 *     preset). Workers that already have output (audit, scorer)
 *     mostly short-circuit; BANT_INFERRER + TRIGGER_DETECTOR always
 *     re-derive (deterministic, cheap).
 *   - LeadNextAction.preliminary rows get superseded + a fresh one
 *     written — that is the intended Phase 3 verification path.
 *
 * Multi-tenant safety:
 *   - Each emit() call passes `workspaceId` explicitly. The planner
 *     never crosses tenants (audit checked).
 *   - The lead lookup filters by `workspaceId` per workspace; we
 *     never use a join that could leak across tenants.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/ai-core/events";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const take = Number.parseInt(process.argv[3] ?? "20", 10);
  if (!email || Number.isNaN(take) || take <= 0) {
    throw new Error(
      "Usage: npx tsx scripts/replan-brain-for-user.ts <email> [leadCount=20]",
    );
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(`No user with email (case-insensitive): ${email}`);
  }

  const owned = await prisma.workspace.findMany({
    where: { ownerId: user.id },
    select: { id: true, slug: true, name: true },
  });
  const member = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    select: { workspace: { select: { id: true, slug: true, name: true } } },
  });
  const seen = new Set<string>();
  const workspaces = [...owned, ...member.map((m) => m.workspace)].filter((w) =>
    seen.has(w.id) ? false : (seen.add(w.id), true),
  );

  if (workspaces.length === 0) {
    console.log(`No workspaces for ${user.email}`);
    return;
  }

  console.log(`User: ${user.email}`);
  console.log(`Workspaces (${workspaces.length}):`);
  for (const w of workspaces) console.log(`  - ${w.slug} (${w.name}) [${w.id}]`);
  console.log("");

  let totalEmitted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const ws of workspaces) {
    const leads = await prisma.lead.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        businessName: true,
        createdAt: true,
        pipelineStatus: true,
      },
    });
    console.log(
      `[${ws.slug}] re-emitting lead_created for ${leads.length} most-recent lead(s):`,
    );
    for (const l of leads) {
      try {
        const sessionId = await emit("lead_created", {
          workspaceId: ws.id,
          leadId: l.id,
          userId: user.id,
        });
        if (!sessionId) {
          totalSkipped++;
          console.log(
            `  · SKIP ${l.id} "${l.businessName}" (pipeline disabled / blocked / no packages)`,
          );
        } else {
          totalEmitted++;
          console.log(
            `  ✓ ${l.id} "${l.businessName}" → plannerSession ${sessionId}`,
          );
        }
      } catch (err) {
        totalFailed++;
        console.error(
          `  ✗ ${l.id} "${l.businessName}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    console.log("");
  }

  console.log(
    `Summary: emitted=${totalEmitted} skipped=${totalSkipped} failed=${totalFailed}`,
  );
  console.log("");
  console.log("Next steps:");
  console.log("  1. Make sure `npm run workers` is running in another terminal.");
  console.log("  2. Tail that terminal for `agent_workers.*` log lines.");
  console.log("  3. Open a lead's v2 page in ~60s:");
  if (workspaces.length > 0) {
    const sampleWs = workspaces[0]!;
    const sampleLead = await prisma.lead.findFirst({
      where: { workspaceId: sampleWs.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (sampleLead) {
      console.log(
        `     http://localhost:3000/app/leads/${sampleLead.id}?v=2`,
      );
      console.log(
        `     http://localhost:3000/app/leads/${sampleLead.id}/workers`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
