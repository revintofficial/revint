/**
 * FineDine beta — agent health check + lead cleanup.
 *
 * Two phases:
 *
 *   1. HEALTH (always runs): aggregates AgentRun status / stuck
 *      PlannerSession / lead-level intelligence coverage for every
 *      workspace OWNED by `finedine-owner@leadac.beta`. Read-only;
 *      writes nothing.
 *
 *   2. CLEAN (only with `--apply`): hard-deletes every Lead row
 *      (cascades to AgentRun, SemanticMemory, WebsiteAudit, etc.)
 *      and every PlannerSession row in those workspaces, then
 *      resets `leads_this_cycle` / `ai_credits_this_cycle` so the
 *      tester can start fresh on the next discovery click.
 *
 * Why hard-delete here (vs the soft-delete in cleanup-finedine-bad-geo):
 * the tester explicitly asked to wipe the workspace before re-testing.
 * AgentRun rows carry the worker telemetry but they are scoped to the
 * leads we are throwing away — keeping them around just clutters the
 * dashboard with orphan history. The Lead → child onDelete cascades
 * are already declared in schema.prisma so a `prisma.lead.deleteMany`
 * cleans the entire subgraph in one round trip.
 *
 * Multi-tenant safety: every Prisma query is scoped by workspaceId
 * (resolved from the authenticated owner email — never trusting an
 * argv id). Refuses to do anything outside the resolved set.
 *
 * Usage:
 *   npx tsx scripts/finedine-agent-health.ts            # dry / health only
 *   npx tsx scripts/finedine-agent-health.ts --apply    # also wipe leads
 *   npx tsx scripts/finedine-agent-health.ts --owner user@beta --apply
 */
import { PrismaClient } from "@/generated/prisma/client";
import { Client as PgClient } from "pg";
import "dotenv/config";

const DEFAULT_OWNER_EMAIL = "finedine-owner@leadac.beta";
const RECENT_WINDOW_HOURS = 24 * 7;
const STUCK_AFTER_MS = 5 * 60 * 1000;

interface Args {
  ownerEmail: string;
  apply: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { ownerEmail: DEFAULT_OWNER_EMAIL, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--owner" && next) {
      out.ownerEmail = next;
      i++;
    } else if (a === "--apply") {
      out.apply = true;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`\n=== FineDine Agent Health Check ===`);
  console.log(`Owner email : ${args.ownerEmail}`);
  console.log(`Mode        : ${args.apply ? "APPLY (destructive)" : "DRY (read-only)"}`);
  console.log("");

  const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!pgUrl) throw new Error("DIRECT_URL / DATABASE_URL not set in .env");

  // Use raw pg for the auth.users lookup because the Supabase auth
  // schema is not modeled in Prisma — and we must NOT introduce a
  // public.users lookup-by-email (multi-tenant audit risk). We then
  // hand the resolved userId to Prisma for everything else.
  const pg = new PgClient({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();

  const prisma = new PrismaClient();

  try {
    // 1. Resolve owner userId from auth.users.
    const userRows = await pg.query(
      `select id from auth.users where lower(email) = lower($1)`,
      [args.ownerEmail],
    );
    if (userRows.rows.length === 0) {
      console.error(
        `No auth.users row for ${args.ownerEmail}. Aborting (will not guess).`,
      );
      process.exit(1);
    }
    const ownerId = userRows.rows[0].id as string;
    console.log(`Resolved owner id: ${ownerId}`);

    // 2. Find workspaces this user OWNs.
    const workspaceRows = await pg.query(
      `select w.id, w.name, w.slug, w.plan, w.niche, w.country,
              w.leads_this_cycle, w.ai_credits_this_cycle, w.cycle_reset_at,
              w.current_period_end, w.onboarding_completed_at
         from workspaces w
         join workspace_members wm on wm.workspace_id = w.id
        where wm.user_id = $1 and wm.role = 'OWNER'
        order by w.created_at asc`,
      [ownerId],
    );
    if (workspaceRows.rows.length === 0) {
      console.error(`User ${args.ownerEmail} does not own any workspaces.`);
      process.exit(1);
    }
    console.log(`Owned workspaces: ${workspaceRows.rows.length}\n`);

    const workspaceIds = workspaceRows.rows.map((r) => r.id as string);

    // 3. Per-workspace health check.
    const since = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);
    for (const w of workspaceRows.rows) {
      const wsId = w.id as string;
      console.log(`---- Workspace: ${w.name}  [${wsId}] ----`);
      console.log(
        `plan=${w.plan} niche=${w.niche} country=${w.country} ` +
          `cycle: leads=${w.leads_this_cycle} aiCredits=${w.ai_credits_this_cycle}`,
      );

      // Lead count + intelligence coverage.
      const totalLeads = await prisma.lead.count({ where: { workspaceId: wsId } });
      const liveLeads = await prisma.lead.count({
        where: { workspaceId: wsId, discardedAt: null, archivedAt: null },
      });
      const leadsWithScore = await prisma.lead.count({
        where: { workspaceId: wsId, salesOpportunity: { isNot: null } },
      });
      const leadsWithAudit = await prisma.lead.count({
        where: { workspaceId: wsId, websiteAudit: { isNot: null } },
      });
      const leadsWithReviews = await prisma.lead.count({
        where: { workspaceId: wsId, reviewAnalysis: { isNot: null } },
      });
      const leadsWithBriefScore = await prisma.lead.count({
        where: { workspaceId: wsId, salesConfidence: { not: null } },
      });

      console.log(
        `leads: total=${totalLeads} live=${liveLeads} ` +
          `withAudit=${leadsWithAudit} withReviews=${leadsWithReviews} ` +
          `withScore=${leadsWithScore} withBrief=${leadsWithBriefScore}`,
      );

      // AgentRun aggregate (last RECENT_WINDOW_HOURS).
      const runStats = await prisma.agentRun.groupBy({
        by: ["workerKind", "status"],
        where: { workspaceId: wsId, createdAt: { gte: since } },
        _count: { _all: true },
      });
      console.log(
        `agentRuns last ${RECENT_WINDOW_HOURS}h: ${runStats.length} (kind, status) buckets`,
      );
      const byKind = new Map<string, Record<string, number>>();
      for (const r of runStats) {
        const m = byKind.get(r.workerKind) ?? {};
        m[r.status] = r._count._all;
        byKind.set(r.workerKind, m);
      }
      const sortedKinds = [...byKind.entries()].sort();
      for (const [kind, counts] of sortedKinds) {
        const summary = Object.entries(counts)
          .map(([s, n]) => `${s}=${n}`)
          .join(" ");
        console.log(`  ${kind.padEnd(28)} ${summary}`);
      }

      // Recent failures (top 5) — surface message clusters so a chronic
      // worker-level failure (e.g. an embedding outage hitting REVIEW_ANALYST)
      // shows up at a glance.
      const recentFailed = await prisma.agentRun.findMany({
        where: {
          workspaceId: wsId,
          status: "FAILED",
          createdAt: { gte: since },
        },
        select: {
          id: true,
          workerKind: true,
          errorMsg: true,
          createdAt: true,
          leadId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (recentFailed.length > 0) {
        console.log(`recent FAILED runs (top ${recentFailed.length}):`);
        for (const f of recentFailed) {
          const msg = (f.errorMsg ?? "(no message)").slice(0, 120);
          console.log(`  ${f.workerKind} ${f.createdAt.toISOString()}  ${msg}`);
        }
      }

      // PlannerSession state. Pull all sessions for this workspace, bucket
      // by status, then flag any EXECUTING/PLANNING with no in-flight runs
      // older than STUCK_AFTER_MS — these are the rows recoverStuckSessions
      // should be picking up.
      const sessionStats = await prisma.plannerSession.groupBy({
        by: ["status"],
        where: { workspaceId: wsId },
        _count: { _all: true },
      });
      console.log(
        `plannerSessions: ${sessionStats
          .map((s) => `${s.status}=${s._count._all}`)
          .join(" ")}`,
      );

      const stuckCandidates = await prisma.plannerSession.findMany({
        where: {
          workspaceId: wsId,
          status: { in: ["EXECUTING", "PLANNING"] },
          updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) },
        },
        select: { id: true, status: true, updatedAt: true, leadId: true },
        orderBy: { updatedAt: "asc" },
        take: 50,
      });
      let stuckCount = 0;
      if (stuckCandidates.length > 0) {
        const inFlight = await prisma.agentRun.groupBy({
          by: ["plannerSessionId"],
          where: {
            plannerSessionId: { in: stuckCandidates.map((c) => c.id) },
            status: { in: ["PENDING", "RUNNING"] },
          },
          _count: { _all: true },
        });
        const inFlightIds = new Set(
          inFlight
            .map((r) => r.plannerSessionId)
            .filter((v): v is string => v != null),
        );
        const stuck = stuckCandidates.filter((s) => !inFlightIds.has(s.id));
        stuckCount = stuck.length;
        if (stuck.length > 0) {
          console.log(
            `STUCK sessions (status w/ no in-flight runs, idle >${
              STUCK_AFTER_MS / 1000
            }s): ${stuck.length}`,
          );
          for (const s of stuck.slice(0, 5)) {
            console.log(
              `  ${s.id} status=${s.status} idleSince=${s.updatedAt.toISOString()} lead=${s.leadId ?? "(none)"}`,
            );
          }
        }
      }
      // Surface stuckCount only when there is something worth reporting.
      void stuckCount;

      // Pipeline preset. A disabled pipeline is the fastest explanation
      // for "leads were created but no AgentRun rows ever fired".
      const pipeline = await prisma.workspaceLeadPipeline.findUnique({
        where: { workspaceId: wsId },
        select: { preset: true, enabled: true, updatedAt: true },
      });
      console.log(
        `pipeline: ${pipeline ? `${pipeline.preset} enabled=${pipeline.enabled}` : "(missing — chain will fall back to BALANCED)"}`,
      );

      console.log("");
    }

    // 4. Apply phase — destructive cleanup.
    if (!args.apply) {
      console.log(
        `[dry] No changes made. Re-run with --apply to wipe leads / planner sessions.`,
      );
      return;
    }

    console.log(`\n=== APPLY: clearing leads + planner sessions ===`);
    for (const wsId of workspaceIds) {
      // Delete order matters because PlannerSession.Lead has no
      // explicit onDelete and would block a Lead delete on the FK.
      // Drop sessions (and their AgentRun children via the
      // session→runs cascade in schema), then drop leads (which
      // cascades to AgentRun, SemanticMemory, WebsiteAudit, etc.).
      const sessionDel = await prisma.plannerSession.deleteMany({
        where: { workspaceId: wsId },
      });
      const leadDel = await prisma.lead.deleteMany({
        where: { workspaceId: wsId },
      });

      // Clear orphan AgentRun rows that lived without a lead (e.g.
      // workspace-scoped copilot runs). Lead-scoped runs were already
      // cascaded with the lead delete; this catches the rest.
      const runDel = await prisma.agentRun.deleteMany({
        where: { workspaceId: wsId },
      });

      // SemanticMemory: lead-scoped rows are gone via cascade. Also
      // wipe workspace-scoped rows (LEAD_PROFILE/REVIEW_CHUNK/etc.)
      // so the next discovery starts with no learned baseline.
      const memDel = await prisma.semanticMemory.deleteMany({
        where: { workspaceId: wsId },
      });

      // Reset cycle counters so the tester gets full quota again on
      // the next discovery batch — otherwise prior consumption keeps
      // the workspace at the cap.
      await prisma.workspace.update({
        where: { id: wsId },
        data: {
          leadsCreatedThisCycle: 0,
          aiCreditsUsedThisCycle: 0,
          cycleResetAt: new Date(),
        },
      });

      console.log(
        `  ${wsId}: leads=${leadDel.count} sessions=${sessionDel.count} ` +
          `runs(orphan)=${runDel.count} memory=${memDel.count} cycle=reset`,
      );
    }
    console.log(`\nDone. Tester can re-run discovery on a clean slate.`);
  } finally {
    await prisma.$disconnect();
    await pg.end();
  }
}

main().catch((err) => {
  console.error("\nHealth check failed:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
