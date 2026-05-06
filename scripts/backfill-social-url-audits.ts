/**
 * Round 2 P0.8 — one-shot retroactive backfill for social-only
 * `WebsiteAudit` rows that pre-date the social-URL gate fix shipped in
 * Round 1. Those rows have `crawlError = null` because the original
 * crawl path silently 200'd Instagram/Facebook landing pages and
 * harvested generic "Create an account or log in to ..." copy as the
 * site's title + meta description — the bug Camden's tester filed
 * against Coffee Couch + YBA Brazil.
 *
 * The Round 1 social-URL gate stamps NEW crawls with
 * `crawlError = "SOCIAL_URL"` so the UI can mask them; this script
 * re-enqueues the historical rows so the same gate fires retroactively.
 *
 * USAGE
 *
 *   tsx scripts/backfill-social-url-audits.ts --dry-run
 *   tsx scripts/backfill-social-url-audits.ts --apply
 *
 * Flags:
 *   --dry-run    Print the matching audit rows + per-workspace counts
 *                without enqueueing anything. Default if neither flag
 *                is supplied — refuses to mutate without an explicit
 *                opt-in.
 *   --apply      Insert PENDING `AgentRun` rows + enqueue them onto
 *                the BullMQ `agent-runs` queue. Rate-limited at 100ms
 *                between enqueues so a 30-lead burst doesn't stampede
 *                Playwright concurrency.
 *   --cutoff=ISO Override the cutoff date for `crawlAttemptedAt`.
 *                Defaults to 2026-05-02 (Round 1 deploy date — adjust
 *                if your environment shipped on a different day).
 *   --max=N      Hard cap on rows touched in a single run.
 *                Default 200. Belt-and-braces guard against a future
 *                regression that reintroduces the bug at higher scale.
 *
 * MULTI-TENANT
 *
 *   This is a global ops script, NOT an authed handler. We deliberately
 *   skip `requireUser()` and the `workspaceId` filter because we need
 *   to sweep the historical bug across every workspace at once. We do
 *   still scope every `AgentRun.create` to the lead's owning
 *   `workspaceId` so the resulting rows behave like normal user-
 *   triggered runs (quota counts, RLS, audit trail).
 *
 * SAFETY
 *
 *   - Skips leads that already have a fresh PENDING/RUNNING
 *     `WEBSITE_AUDITOR` run; we don't want two concurrent crawls on
 *     the same lead.
 *   - Tags `inputsJson.triggeredBy = "round_2_backfill_social_url"`
 *     so post-deploy SQL can isolate this batch:
 *       SELECT count(*), status FROM agent_runs
 *       WHERE inputs_json->>'triggeredBy' = 'round_2_backfill_social_url'
 *       GROUP BY status;
 *   - 24h monitoring window: SUCCEEDED rate ≥ 80% with no FAILED
 *     spike from Round 1 #7 embed crash means the fix held.
 */
import "dotenv/config";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "../src/lib/prisma";
import { getAgentRunsQueue } from "../src/lib/queues";

const SOCIAL_HOST_RE =
  /(?:^|\.)(instagram|facebook|tiktok|linkedin|twitter|x|youtube|threads)\.(?:com|net|me|tv)/i;

const DEFAULT_CUTOFF = "2026-05-02T00:00:00.000Z";
const DEFAULT_MAX = 200;
const ENQUEUE_GAP_MS = 100;

interface Cli {
  dryRun: boolean;
  apply: boolean;
  cutoff: Date;
  max: number;
}

function parseArgs(argv: string[]): Cli {
  let apply = false;
  let dryRun = false;
  let cutoff = new Date(DEFAULT_CUTOFF);
  let max = DEFAULT_MAX;

  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--cutoff=")) {
      const raw = arg.slice("--cutoff=".length);
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`--cutoff: invalid ISO date "${raw}"`);
      }
      cutoff = parsed;
    } else if (arg.startsWith("--max=")) {
      const raw = Number(arg.slice("--max=".length));
      if (!Number.isFinite(raw) || raw <= 0) {
        throw new Error(`--max: expected positive integer, got "${arg}"`);
      }
      max = Math.floor(raw);
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage:",
          "  tsx scripts/backfill-social-url-audits.ts --dry-run",
          "  tsx scripts/backfill-social-url-audits.ts --apply [--cutoff=ISO] [--max=N]",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  // Refuse silent mutation. If neither flag is given, treat the run
  // as a dry-run so a stray `tsx scripts/backfill-...` doesn't fan out
  // 30 enqueues.
  if (!apply && !dryRun) dryRun = true;
  if (apply && dryRun) {
    throw new Error("--apply and --dry-run are mutually exclusive");
  }

  return { dryRun, apply, cutoff, max };
}

function isSocialUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return SOCIAL_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

interface Candidate {
  auditId: string;
  leadId: string;
  workspaceId: string;
  url: string;
  businessName: string;
  crawlAttemptedAt: Date | null;
}

async function findCandidates(cli: Cli): Promise<Candidate[]> {
  // Round 2 P0.8 — pre-Round-1 social-only audits left at
  // crawlError = NULL because the social-url-gate fix only stamps NEW
  // crawls. We pull twice the cap and post-filter in JS so we can
  // catch hostnames the LIKE clause can't disambiguate (e.g.
  // "twitter.com/user" vs "x.com/user", "facebook.com" subdomain
  // forms). Workspace JOIN is via the lead since WebsiteAudit only
  // carries leadId.
  const rows = await prisma.websiteAudit.findMany({
    where: {
      crawlError: null,
      crawlAttemptedAt: { lt: cli.cutoff },
    },
    select: {
      id: true,
      leadId: true,
      url: true,
      crawlAttemptedAt: true,
      lead: {
        select: { workspaceId: true, businessName: true },
      },
    },
    take: cli.max * 4,
    orderBy: { crawlAttemptedAt: "asc" },
  });

  const social: Candidate[] = [];
  for (const row of rows) {
    if (!isSocialUrl(row.url)) continue;
    social.push({
      auditId: row.id,
      leadId: row.leadId,
      workspaceId: row.lead.workspaceId,
      url: row.url,
      businessName: row.lead.businessName,
      crawlAttemptedAt: row.crawlAttemptedAt,
    });
    if (social.length >= cli.max) break;
  }
  return social;
}

async function hasInflightAuditor(leadId: string): Promise<boolean> {
  const existing = await prisma.agentRun.findFirst({
    where: {
      leadId,
      workerKind: "WEBSITE_AUDITOR",
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: { id: true },
  });
  return existing !== null;
}

async function enqueueOne(c: Candidate): Promise<{ enqueued: boolean; runId?: string; reason?: string }> {
  if (await hasInflightAuditor(c.leadId)) {
    return { enqueued: false, reason: "inflight_auditor_run" };
  }

  const run = await prisma.agentRun.create({
    data: {
      workspaceId: c.workspaceId,
      leadId: c.leadId,
      workerKind: "WEBSITE_AUDITOR",
      status: "PENDING",
      inputsJson: {
        triggeredBy: "round_2_backfill_social_url",
        sourceAuditId: c.auditId,
      } as never,
    },
    select: { id: true },
  });

  try {
    const queue = getAgentRunsQueue();
    await queue.add(
      `agent-run-${run.id}`,
      { runId: run.id },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
    return { enqueued: true, runId: run.id };
  } catch (err) {
    // Queue unavailable — flip the row to FAILED so the next run of
    // this script doesn't think it's still in-flight. We don't raise:
    // a single Redis blip should not abort the whole batch.
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMsg: `backfill enqueue failed: ${(err as Error).message ?? String(err)}`,
      },
    });
    return { enqueued: false, reason: "queue_unavailable", runId: run.id };
  }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));

  console.log(
    `\n=== Round 2 P0.8 backfill — ${cli.dryRun ? "DRY RUN" : "APPLY"} ===`,
  );
  console.log(`cutoff: crawlAttemptedAt < ${cli.cutoff.toISOString()}`);
  console.log(`max:    ${cli.max}\n`);

  const candidates = await findCandidates(cli);
  if (candidates.length === 0) {
    console.log("No matching audits. Nothing to do.");
    return;
  }

  // Per-workspace summary so the operator can spot a single noisy
  // workspace vs a broad legacy bug.
  const byWorkspace = new Map<string, number>();
  for (const c of candidates) {
    byWorkspace.set(c.workspaceId, (byWorkspace.get(c.workspaceId) ?? 0) + 1);
  }

  console.log(`Found ${candidates.length} social-only audit(s) across ${byWorkspace.size} workspace(s):`);
  for (const [ws, n] of [...byWorkspace.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ws}  ${n}`);
  }
  console.log();
  for (const c of candidates.slice(0, 10)) {
    const at = c.crawlAttemptedAt?.toISOString() ?? "(never)";
    console.log(`  - ${c.businessName.padEnd(30).slice(0, 30)} ${at} ${c.url}`);
  }
  if (candidates.length > 10) {
    console.log(`  ... ${candidates.length - 10} more`);
  }
  console.log();

  if (cli.dryRun) {
    console.log("Dry run — no AgentRun rows created. Re-run with --apply to enqueue.");
    return;
  }

  let enqueued = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const res = await enqueueOne(c);
    if (res.enqueued) {
      enqueued++;
      console.log(`  [${i + 1}/${candidates.length}] enqueued ${res.runId} for lead ${c.leadId}`);
    } else if (res.reason === "inflight_auditor_run") {
      skipped++;
      console.log(`  [${i + 1}/${candidates.length}] skip ${c.leadId} (in-flight auditor run)`);
    } else {
      failed++;
      console.log(
        `  [${i + 1}/${candidates.length}] fail  ${c.leadId} (${res.reason ?? "unknown"})`,
      );
    }
    // Rate-limit so 50 leads × Playwright concurrency 4 doesn't blow
    // the crawler pool. ~100ms between enqueues spreads the workers'
    // pickup across roughly the same window as a normal user batch.
    if (i < candidates.length - 1) await sleep(ENQUEUE_GAP_MS);
  }

  console.log(
    `\nDone. enqueued=${enqueued} skipped=${skipped} failed=${failed} of ${candidates.length}`,
  );
  console.log(
    "\nMonitoring SQL (run after 24h):\n" +
      "  SELECT status, count(*) FROM agent_runs\n" +
      "    WHERE inputs_json->>'triggeredBy' = 'round_2_backfill_social_url'\n" +
      "  GROUP BY status;\n",
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("backfill-social-url-audits failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
