/**
 * Hard-delete every Lead in every workspace that a given user belongs
 * to (as owner or member). Built for the FineDine beta tester
 * (`finedine-owner@leadac.beta`) but accepts any email via --email.
 *
 * Behaviour:
 *   - Dry-run by default. Prints workspace list + lead count per ws.
 *   - `--apply` performs hard deletes, scoped by workspaceId per workspace.
 *
 * Cascade map (verified against prisma/schema.prisma):
 *   LeadActivity, WebsiteAudit, SalesOpportunity, WatchlistItem,
 *   GoogleReview, ReviewAnalysis, VoiceNote, AgentRun, SemanticMemory,
 *   Mockup (lead-scoped), CopilotMessage(*) — all cascade on Lead delete.
 *   PlannerSession.leadId is optional with no explicit onDelete → SetNull.
 *   LeadSequenceState has NO FK to Lead (plain string column) → must be
 *   cleaned up explicitly per workspace before the lead deletes, or we
 *   leak orphan cadence rows.
 *
 *   (*) CopilotMessage.leadIds is a JSON array, not a FK. We don't touch
 *   the chat history — references will become stale but rendering
 *   tolerates missing leads.
 *
 * Multi-tenant rule: every delete is scoped by workspaceId. We never
 * delete by lead id alone.
 *
 * Usage:
 *   npx tsx scripts/delete-leads-by-owner-email.ts --email finedine-owner@leadac.beta
 *   npx tsx scripts/delete-leads-by-owner-email.ts --email finedine-owner@leadac.beta --apply
 */

import { PrismaClient } from "@/generated/prisma/client";
import "dotenv/config";

function getArg(name: string): string | undefined {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  return undefined;
}

async function main() {
  const email = getArg("email") ?? "finedine-owner@leadac.beta";
  const apply = process.argv.includes("--apply");

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) {
      console.error(`User ${email} not found. Aborting.`);
      process.exit(1);
    }

    console.log(`Target user: ${user.email} (${user.id})${user.fullName ? ` — ${user.fullName}` : ""}`);

    // Union of (a) workspaces where this user is the owner and
    // (b) workspaces where they have a WorkspaceMember row. The
    // signup path always creates a membership row for owners, but
    // we union to defend against drift.
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        plan: true,
        _count: { select: { leads: true } },
      },
      orderBy: { name: "asc" },
    });

    if (workspaces.length === 0) {
      console.log("No workspaces found for this user. Nothing to do.");
      return;
    }

    console.log(`\nFound ${workspaces.length} workspace(s):\n`);
    for (const ws of workspaces) {
      const ownerTag = ws.ownerId === user.id ? "OWNER" : "MEMBER";
      console.log(
        `  [${ownerTag}] ${ws.name.padEnd(36)} slug=${ws.slug.padEnd(28)} plan=${ws.plan.padEnd(8)} leads=${ws._count.leads}`,
      );
    }

    const totalLeads = workspaces.reduce((acc, ws) => acc + ws._count.leads, 0);
    console.log(`\nTotal leads across listed workspaces: ${totalLeads}`);

    if (totalLeads === 0) {
      console.log("Nothing to delete.");
      return;
    }

    if (!apply) {
      console.log(`\n[dry] Would hard-delete ${totalLeads} lead(s) across ${workspaces.length} workspace(s).`);
      console.log("[dry] Re-run with --apply to commit.");
      return;
    }

    let deletedLeads = 0;
    let deletedSeqStates = 0;

    for (const ws of workspaces) {
      if (ws._count.leads === 0) continue;

      // Sequence states have no FK to Lead — clean them first to avoid
      // orphan cadence rows pointing at deleted lead ids.
      const seqResult = await prisma.leadSequenceState.deleteMany({
        where: { workspaceId: ws.id },
      });
      deletedSeqStates += seqResult.count;

      const leadResult = await prisma.lead.deleteMany({
        where: { workspaceId: ws.id },
      });
      deletedLeads += leadResult.count;

      console.log(
        `  ${ws.name.padEnd(36)} → leads: ${leadResult.count}, sequence states: ${seqResult.count}`,
      );
    }

    console.log(`\nDone. Hard-deleted ${deletedLeads} lead(s) and ${deletedSeqStates} sequence state(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Delete failed:", err);
  process.exit(1);
});
