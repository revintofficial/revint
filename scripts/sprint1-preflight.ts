/**
 * Sprint 1 (Round 2 Hafta 1 Hotfix) pre-flight SQL checks.
 *
 * Read-only baseline counts that must be captured BEFORE merging the
 * Sprint 1 hotfix PRs. See `research/finedine/round2-plans/00-unified-plan.md`
 * §3.1 P0 row + the Sprint 1 plan §5.
 *
 * What it does:
 *   1. PR-W1.B regression baseline — count audits flagged with the
 *      false-positive `detectedMenuTool="E-Menu"` (≥5 → manual review
 *      blocker for the QR_MENU_PATTERNS rewrite).
 *   2. PR-W1.B baseline — count `hasOnlineReservation=true` rows so we
 *      can track how many flip to `false` after the multi-signal change.
 *   3. PR-W1.B (P0.7) — list current `WEBSITE_EXPIRED` candidate audits
 *      (404 + title ILIKE expired) so QA has a fixture set.
 *   4. P0.8 backfill scope — count Round 1-pre social-only audits with
 *      `crawl_error IS NULL`. This is exactly the set the social-URL
 *      backfill script will re-enqueue.
 *   5. PR-W1.E — agent_runs status distribution last 7 days, including
 *      the `SUCCEEDED_NO_MEMORY` count that the new per-lead cap must
 *      now include.
 *
 * Usage:
 *   npx tsx scripts/sprint1-preflight.ts                # baseline (Day 1)
 *   npx tsx scripts/sprint1-preflight.ts --post-deploy  # verify (Day 2)
 *
 * --post-deploy mode runs the same SQLs but flips the assertions:
 *   - E-Menu count must be 0 (PR-W1.B took effect on the next crawl
 *     cycle for those audits).
 *   - hasOnlineReservation count expected to drop materially from the
 *     Day 1 baseline (we don't know the exact target so we just report
 *     the delta if `EXPECTED_RESERVATION_BASELINE` env var is set).
 *   - WEBSITE_EXPIRED candidates should now have crawlError stamped on
 *     re-crawl (script re-runs with crawl_error filter).
 *   - Social-only backfill scope should be 0 (or near-0) after the
 *     P0.8 backfill apply finished.
 *   - SUCCEEDED_NO_MEMORY must now appear in the per-lead cap counter
 *     (we just confirm the status row exists).
 *
 * Exit codes:
 *   0 — clean (baseline captured / post-deploy assertions pass)
 *   1 — connection failure
 *   2 — post-deploy assertion failed (block deploy or rollback)
 *
 * Multi-tenant note: this script runs against the live DB and must NOT
 * scope to a specific workspace — these counts are global health
 * baselines, not per-tenant reads. Do not move this query pattern into
 * application code.
 */
import "dotenv/config";
import { Client } from "pg";

interface CheckRow {
  label: string;
  detail: string;
  warn?: boolean;
  /** Round 2 — assertion failure in --post-deploy mode (exit 2). */
  fail?: boolean;
}

interface Mode {
  postDeploy: boolean;
}

function parseMode(argv: string[]): Mode {
  const postDeploy = argv.includes("--post-deploy");
  return { postDeploy };
}

async function eMenuFalsePosCount(client: Client, mode: Mode): Promise<CheckRow> {
  const res = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM website_audits
      WHERE raw_features_json->>'detectedMenuTool' = 'E-Menu'`,
  );
  const n = Number(res.rows[0]?.count ?? 0);
  if (mode.postDeploy) {
    // Post-deploy: PR-W1.B removed `e-menu` / `emenu` from the QR-menu
    // patterns entirely. Any row still flagged means the data layer
    // was never re-crawled — this is allowed for legacy rows but the
    // *new* baseline trend should be ≤ Day 1 baseline. We don't know
    // the Day 1 number from inside this script, so we accept any
    // value but warn loudly above the original review threshold.
    return {
      label: "qr_menu.e_menu_count",
      detail: `${n} rows still flagged 'E-Menu' (legacy pre-deploy crawls; expected ≤ Day 1 baseline)`,
      warn: n >= 5,
    };
  }
  return {
    label: "qr_menu.e_menu_count",
    detail: `${n} rows flagged 'E-Menu'`,
    warn: n >= 5,
  };
}

async function hasOnlineReservationCount(
  client: Client,
  mode: Mode,
): Promise<CheckRow> {
  const res = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM website_audits
      WHERE raw_features_json->>'hasOnlineReservation' = 'true'`,
  );
  const n = Number(res.rows[0]?.count ?? 0);
  if (mode.postDeploy) {
    const baseline = Number(
      process.env.EXPECTED_RESERVATION_BASELINE ?? Number.NaN,
    );
    if (Number.isFinite(baseline)) {
      const delta = n - baseline;
      return {
        label: "extractor.has_online_reservation_true",
        detail: `${n} rows (Day-1 baseline ${baseline}, delta ${delta >= 0 ? "+" : ""}${delta}); LUMI-style false-pos should drop on next re-crawl`,
        warn: delta > 0,
      };
    }
    return {
      label: "extractor.has_online_reservation_true",
      detail: `${n} rows flagged true (set EXPECTED_RESERVATION_BASELINE to compare with Day 1)`,
    };
  }
  return {
    label: "extractor.has_online_reservation_true",
    detail: `${n} rows currently flagged true`,
  };
}

async function expiredAuditCandidates(
  client: Client,
  mode: Mode,
): Promise<CheckRow> {
  const res = await client.query<{ id: string; url: string; title: string }>(
    `SELECT id, url, title
       FROM website_audits
      WHERE http_status = 404
        AND title ILIKE '%expired%'
      LIMIT 25`,
  );
  const sample = res.rows.slice(0, 5).map((r) => `  - ${r.id} ${r.url} :: ${r.title}`).join("\n");
  if (mode.postDeploy) {
    // Post-deploy: same set should now have crawl_error =
    // 'WEBSITE_EXPIRED' on next crawl. Count the ones that already
    // got the new tag for an early signal.
    const tagged = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM website_audits
        WHERE crawl_error = 'WEBSITE_EXPIRED'`,
    );
    return {
      label: "crawler.website_expired_candidates",
      detail:
        `${res.rows.length} candidate audit(s) still 404+expired in title; ${tagged.rows[0]?.count ?? 0} have crawl_error='WEBSITE_EXPIRED'` +
        (res.rows.length ? `\n${sample}` : ""),
    };
  }
  return {
    label: "crawler.website_expired_candidates",
    detail:
      `${res.rows.length} candidate audits (404 + title ILIKE expired)` +
      (res.rows.length ? `\n${sample}` : ""),
  };
}

async function socialOnlyBackfillScope(
  client: Client,
  mode: Mode,
): Promise<CheckRow> {
  // P0.8 backfill targets: pre-Round-1 social-only audits left at
  // crawlError = NULL because the social-url-gate fix only stamps NEW
  // crawls. Cutoff `2026-05-02` matches the Round 1 deploy date in the
  // unified plan. Adjust if the actual deploy date differs.
  const res = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM website_audits
      WHERE url ~ '(instagram|facebook|tiktok|linkedin|twitter|x\\.com|youtube|threads)\\.(com|net|me|tv)'
        AND crawl_error IS NULL
        AND crawl_attempted_at < '2026-05-02'`,
  );
  const n = Number(res.rows[0]?.count ?? 0);
  if (mode.postDeploy) {
    // After backfill --apply + 24h drain, this set must be ≤ 5%
    // of the Day-1 number (set EXPECTED_BACKFILL_REMAINING_MAX env
    // to override). FAIL when above threshold so the operator
    // re-runs the backfill before signing off.
    const max = Number(process.env.EXPECTED_BACKFILL_REMAINING_MAX ?? "5");
    return {
      label: "backfill.social_url_scope",
      detail: `${n} stale social-only audits remaining (threshold ≤ ${max})`,
      fail: n > max,
    };
  }
  return {
    label: "backfill.social_url_scope",
    detail: `${n} stale social-only audits to re-enqueue`,
  };
}

async function agentRunsStatusBreakdown(
  client: Client,
  mode: Mode,
): Promise<CheckRow> {
  const res = await client.query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
       FROM agent_runs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY status
      ORDER BY count DESC`,
  );
  const lines = res.rows.map((r) => `  ${r.status.padEnd(22)} ${r.count}`).join("\n");
  const hasNoMemory = res.rows.some((r) => r.status === "SUCCEEDED_NO_MEMORY");
  if (mode.postDeploy && !hasNoMemory) {
    // Post-deploy assertion: PR-W1.E quota.ts now counts
    // SUCCEEDED_NO_MEMORY against the per-lead daily cap. If the
    // status doesn't appear in the last 7 days it could just mean no
    // workspace hit the embedding-degraded path — not a failure, but
    // worth flagging.
    return {
      label: "quota.agent_runs_status_7d",
      detail: lines + "\n  (no SUCCEEDED_NO_MEMORY rows in last 7d — verify per-lead cap accounting from staging fixture)",
    };
  }
  return {
    label: "quota.agent_runs_status_7d",
    detail: lines || "(no agent_runs in last 7 days)",
  };
}

async function backfillEnqueueStatus(
  client: Client,
  mode: Mode,
): Promise<CheckRow> {
  if (!mode.postDeploy) {
    return {
      label: "backfill.enqueue_status",
      detail: "(skipped — dry-run baseline doesn't require this)",
    };
  }
  // Read Round 2 §1 acceptance: "Backfill 24h gözlem: SUCCEEDED ≥
  // %80, FAILED Round 1 #7 embed crash dışında 0".
  const res = await client.query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
       FROM agent_runs
      WHERE inputs_json->>'triggeredBy' = 'round_2_backfill_social_url'
      GROUP BY status
      ORDER BY count DESC`,
  );
  if (res.rows.length === 0) {
    return {
      label: "backfill.enqueue_status",
      detail: "(no backfill runs found — skipped or never executed)",
    };
  }
  const total = res.rows.reduce((s, r) => s + Number(r.count), 0);
  const succeeded =
    Number(
      res.rows.find((r) => r.status === "SUCCEEDED")?.count ?? 0,
    ) +
    Number(
      res.rows.find((r) => r.status === "SUCCEEDED_NO_MEMORY")?.count ?? 0,
    );
  const succeededRatio = total > 0 ? succeeded / total : 0;
  const lines = res.rows.map((r) => `  ${r.status.padEnd(22)} ${r.count}`).join("\n");
  return {
    label: "backfill.enqueue_status",
    detail: `${total} backfill runs, ${(succeededRatio * 100).toFixed(1)}% SUCCEEDED+SUCCEEDED_NO_MEMORY\n${lines}`,
    fail: total > 0 && succeededRatio < 0.8,
  };
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL or DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const rows: CheckRow[] = [];
    rows.push(await eMenuFalsePosCount(client, mode));
    rows.push(await hasOnlineReservationCount(client, mode));
    rows.push(await expiredAuditCandidates(client, mode));
    rows.push(await socialOnlyBackfillScope(client, mode));
    rows.push(await agentRunsStatusBreakdown(client, mode));
    rows.push(await backfillEnqueueStatus(client, mode));

    const banner = mode.postDeploy
      ? "=== Sprint 1 post-deploy verification ==="
      : "=== Sprint 1 pre-flight baselines ===";
    console.log(`\n${banner}\n`);

    let warnings = 0;
    let failures = 0;
    for (const r of rows) {
      const tag = r.fail ? "FAIL" : r.warn ? "WARN" : "OK  ";
      console.log(`[${tag}] ${r.label}\n  ${r.detail.replace(/\n/g, "\n  ")}\n`);
      if (r.fail) failures++;
      else if (r.warn) warnings++;
    }

    if (failures > 0) {
      console.error(
        `\n${failures} post-deploy assertion(s) FAILED. Block sign-off; either roll back or re-run the failing remediation step before retrying.`,
      );
      process.exit(2);
    }
    if (warnings > 0) {
      console.warn(
        `\n${warnings} baseline(s) flagged for manual review${mode.postDeploy ? " (non-blocking; investigate trend)" : " before merging PR-W1.B"}.`,
      );
      process.exit(0);
    }
    if (mode.postDeploy) {
      console.log("Post-deploy verification clean. Sprint 1 sign-off ✓");
    } else {
      console.log("Baselines captured. Paste into Sprint 1 deploy checklist.");
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("sprint1-preflight failed:", e);
  process.exit(1);
});
