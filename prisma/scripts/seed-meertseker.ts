/**
 * One-shot seed: deliver all legacy-workspace data + the CSV exports to the
 * meertseker@gmail.com account.
 *
 * Run with:  npx tsx prisma/scripts/seed-meertseker.ts
 */
import { Client } from "pg";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import "dotenv/config";

const TARGET_EMAIL = "meertseker@gmail.com";
const LEGACY_WS_ID = "ws_legacy_default";
const CSV_DIR = "C:/Users/meert/Downloads";

const FILES = {
  leads: "leads_rows.csv",
  watchlist: "watchlist_items_rows.csv",
  sales: "sales_opportunities_rows.csv",
  reviews: "google_reviews_rows.csv",
  todos: "team_todos_rows.csv",
};

interface LeadRow {
  id: string;
  place_id: string;
  business_name: string;
  formatted_address: string;
  borough: string | null;
  phone: string | null;
  website_url: string | null;
  has_website: string;
  google_maps_uri: string | null;
  rating: string | null;
  review_count: string | null;
  business_status: string | null;
  primary_type: string | null;
  source_query: string | null;
  source_lat: string | null;
  source_lng: string | null;
  crawl_status: string;
  analyze_status: string;
  created_at: string;
  updated_at: string;
}

interface WatchlistRow {
  id: string;
  lead_id: string;
  site_url: string | null;
  notes: string | null;
  website_plan: string | null;
  pipeline_notes: string | null;
  selected_offer: string | null;
  meeting_result: string | null;
  created_at: string;
  updated_at: string;
}

interface SalesRow {
  id: string;
  lead_id: string;
  opportunity_score: string;
  reason_codes: string;
  why_good_target: string | null;
  likely_pain_points: string;
  best_sales_angle: string | null;
  suggested_offer: string;
  personalized_first_message: string | null;
  expected_price_band: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ReviewRow {
  id: string;
  lead_id: string;
  author_name: string;
  author_photo: string | null;
  rating: string;
  text: string | null;
  relative_time: string;
  publish_time: string;
  created_at: string;
}

interface TodoRow {
  id: string;
  column: string;
  text: string;
  done: string;
  sort_order: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
}

function readCsv<T>(filename: string): T[] {
  const path = resolve(CSV_DIR, filename);
  if (!existsSync(path)) {
    console.warn(`  ! Skipping ${filename} (not found at ${path})`);
    return [];
  }
  const raw = readFileSync(path, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true }) as T[];
}

function nullable(v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === "" || v === "NULL") return null;
  return v;
}
function bool(v: string | null | undefined): boolean {
  return v === "true" || v === "t" || v === "1";
}
function num(v: string | null | undefined): number | null {
  const n = nullable(v);
  if (n === null) return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}
function jsonOrEmpty(v: string | null | undefined): string {
  const n = nullable(v);
  if (n === null) return "[]";
  try {
    JSON.parse(n);
    return n;
  } catch {
    return "[]";
  }
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  try {
    // 1. Resolve target user + workspace
    const u = await c.query(
      `select id from auth.users where email = $1`,
      [TARGET_EMAIL]
    );
    if (!u.rows[0]) {
      throw new Error(`No auth user for ${TARGET_EMAIL}. Sign up first.`);
    }
    const userId = u.rows[0].id as string;

    // Make sure they have a public.users row (the trigger should have done this).
    await c.query(
      `insert into users (id, email) values ($1, $2)
       on conflict (id) do nothing`,
      [userId, TARGET_EMAIL]
    );

    const w = await c.query(
      `select w.id from workspace_members wm
       join workspaces w on w.id = wm.workspace_id
       where wm.user_id = $1
       order by wm.created_at asc
       limit 1`,
      [userId]
    );
    let wsId: string;
    if (w.rows[0]) {
      wsId = w.rows[0].id;
      console.log(`Target workspace: ${wsId}`);
    } else {
      const created = await c.query(
        `insert into workspaces (id, name, slug, owner_id)
         values (gen_random_uuid()::text, $1, $2, $3) returning id`,
        ["My Workspace", TARGET_EMAIL.split("@")[0], userId]
      );
      wsId = created.rows[0].id;
      await c.query(
        `insert into workspace_members (id, workspace_id, user_id, role)
         values (gen_random_uuid()::text, $1, $2, 'OWNER')`,
        [wsId, userId]
      );
      console.log(`Created workspace ${wsId}`);
    }

    // 2. Move legacy workspace contents to the user. Resolve duplicate
    // (workspace_id, place_id) by deleting the user's previously discovered
    // copy and keeping the richer legacy row.
    const dupes = await c.query(
      `select l_user.id as user_id, l_legacy.id as legacy_id
       from leads l_user
       join leads l_legacy
         on l_legacy.workspace_id = $1
        and l_user.workspace_id = $2
        and l_legacy.place_id = l_user.place_id`,
      [LEGACY_WS_ID, wsId]
    );
    if (dupes.rows.length) {
      const userIds = dupes.rows.map((r) => r.user_id);
      console.log(`Removing ${userIds.length} duplicate user leads to make room for legacy rows`);
      await c.query(`delete from leads where id = ANY($1::text[])`, [userIds]);
    }

    const movedLeads = await c.query(
      `update leads set workspace_id = $1 where workspace_id = $2`,
      [wsId, LEGACY_WS_ID]
    );
    console.log(`Moved ${movedLeads.rowCount} leads to ${wsId}`);

    const movedTodos = await c.query(
      `update team_todos set workspace_id = $1 where workspace_id = $2`,
      [wsId, LEGACY_WS_ID]
    );
    console.log(`Moved ${movedTodos.rowCount} todos to ${wsId}`);

    // 3. Upsert any rows from the CSVs we don't already have. Keys are the
    // original cuid `id`s from the export.
    const leads = readCsv<LeadRow>(FILES.leads);
    let leadsInserted = 0;
    for (const l of leads) {
      const r = await c.query(
        `insert into leads (
          id, workspace_id, place_id, business_name, formatted_address, borough,
          phone, website_url, has_website, google_maps_uri, rating, review_count,
          business_status, primary_type, source_query, source_lat, source_lng,
          crawl_status, analyze_status, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::"CrawlStatus",$19::"AnalyzeStatus",$20,$21)
        on conflict (id) do nothing`,
        [
          l.id, wsId, l.place_id, l.business_name, l.formatted_address,
          nullable(l.borough), nullable(l.phone), nullable(l.website_url),
          bool(l.has_website), nullable(l.google_maps_uri),
          num(l.rating), num(l.review_count),
          nullable(l.business_status), nullable(l.primary_type),
          nullable(l.source_query), num(l.source_lat), num(l.source_lng),
          l.crawl_status || "PENDING", l.analyze_status || "PENDING",
          l.created_at, l.updated_at,
        ]
      );
      leadsInserted += r.rowCount ?? 0;
    }
    console.log(`Inserted ${leadsInserted} new leads from CSV`);

    // Build a set of valid lead IDs we can FK against (after the move + insert).
    const validLeadsRes = await c.query(
      `select id from leads where workspace_id = $1`,
      [wsId]
    );
    const validLeads = new Set(validLeadsRes.rows.map((r) => r.id));

    const sales = readCsv<SalesRow>(FILES.sales);
    let salesInserted = 0;
    let salesSkipped = 0;
    for (const s of sales) {
      if (!validLeads.has(s.lead_id)) {
        salesSkipped++;
        continue;
      }
      const r = await c.query(
        `insert into sales_opportunities (
          id, lead_id, opportunity_score, reason_codes, why_good_target,
          likely_pain_points, best_sales_angle, suggested_offer,
          personalized_first_message, expected_price_band, status,
          created_at, updated_at
        ) values ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8::"SuggestedOffer",$9,$10,$11::"OutreachStatus",$12,$13)
        on conflict (lead_id) do update set
          opportunity_score = EXCLUDED.opportunity_score,
          reason_codes = EXCLUDED.reason_codes,
          why_good_target = EXCLUDED.why_good_target,
          likely_pain_points = EXCLUDED.likely_pain_points,
          best_sales_angle = EXCLUDED.best_sales_angle,
          suggested_offer = EXCLUDED.suggested_offer,
          personalized_first_message = EXCLUDED.personalized_first_message,
          expected_price_band = EXCLUDED.expected_price_band,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at`,
        [
          s.id, s.lead_id, parseInt(s.opportunity_score, 10),
          jsonOrEmpty(s.reason_codes), nullable(s.why_good_target),
          jsonOrEmpty(s.likely_pain_points), nullable(s.best_sales_angle),
          (s.suggested_offer || "STARTER").toUpperCase(),
          nullable(s.personalized_first_message), nullable(s.expected_price_band),
          (s.status || "NEW").toUpperCase(), s.created_at, s.updated_at,
        ]
      );
      salesInserted += r.rowCount ?? 0;
    }
    console.log(`Upserted ${salesInserted} sales opportunities (skipped ${salesSkipped} orphans)`);

    const wls = readCsv<WatchlistRow>(FILES.watchlist);
    let wlInserted = 0;
    let wlSkipped = 0;
    for (const w of wls) {
      if (!validLeads.has(w.lead_id)) {
        wlSkipped++;
        continue;
      }
      const r = await c.query(
        `insert into watchlist_items (
          id, lead_id, site_url, notes, website_plan, pipeline_notes,
          selected_offer, meeting_result, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7::"SuggestedOffer",$8::"MeetingResult",$9,$10)
        on conflict (lead_id) do update set
          site_url = EXCLUDED.site_url,
          notes = EXCLUDED.notes,
          website_plan = EXCLUDED.website_plan,
          pipeline_notes = EXCLUDED.pipeline_notes,
          selected_offer = EXCLUDED.selected_offer,
          meeting_result = EXCLUDED.meeting_result,
          updated_at = EXCLUDED.updated_at`,
        [
          w.id, w.lead_id, nullable(w.site_url), nullable(w.notes),
          nullable(w.website_plan), nullable(w.pipeline_notes),
          nullable(w.selected_offer), nullable(w.meeting_result),
          w.created_at, w.updated_at,
        ]
      );
      wlInserted += r.rowCount ?? 0;
    }
    console.log(`Upserted ${wlInserted} watchlist items (skipped ${wlSkipped} orphans)`);

    const reviews = readCsv<ReviewRow>(FILES.reviews);
    let revInserted = 0;
    let revSkipped = 0;
    for (const v of reviews) {
      if (!validLeads.has(v.lead_id)) {
        revSkipped++;
        continue;
      }
      const r = await c.query(
        `insert into google_reviews (
          id, lead_id, author_name, author_photo, rating, text,
          relative_time, publish_time, created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (id) do nothing`,
        [
          v.id, v.lead_id, v.author_name, nullable(v.author_photo),
          parseInt(v.rating, 10), nullable(v.text), v.relative_time,
          v.publish_time, v.created_at,
        ]
      );
      revInserted += r.rowCount ?? 0;
    }
    console.log(`Inserted ${revInserted} new google reviews (skipped ${revSkipped} orphans)`);

    const todos = readCsv<TodoRow>(FILES.todos);
    let todoInserted = 0;
    for (const t of todos) {
      const r = await c.query(
        `insert into team_todos (
          id, workspace_id, "column", text, done, sort_order, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set
          "column" = EXCLUDED."column",
          text = EXCLUDED.text,
          done = EXCLUDED.done,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at`,
        [
          t.id, wsId, t.column, t.text, bool(t.done),
          parseInt(t.sort_order || "0", 10),
          t.created_at, t.updated_at,
        ]
      );
      todoInserted += r.rowCount ?? 0;
    }
    console.log(`Upserted ${todoInserted} todos`);

    // 4. Drop the now-empty legacy workspace
    const remaining = await c.query(
      `select count(*)::int as c from leads where workspace_id = $1`,
      [LEGACY_WS_ID]
    );
    if (remaining.rows[0].c === 0) {
      await c.query(
        `delete from team_todos where workspace_id = $1`,
        [LEGACY_WS_ID]
      );
      await c.query(
        `delete from workspace_members where workspace_id = $1`,
        [LEGACY_WS_ID]
      );
      await c.query(`delete from workspaces where id = $1`, [LEGACY_WS_ID]);
      console.log(`Dropped legacy workspace ${LEGACY_WS_ID}`);
    }

    // Final summary
    const finals = await c.query(
      `select
         (select count(*)::int from leads where workspace_id = $1) as leads,
         (select count(*)::int from sales_opportunities so join leads l on l.id = so.lead_id where l.workspace_id = $1) as opportunities,
         (select count(*)::int from watchlist_items wi join leads l on l.id = wi.lead_id where l.workspace_id = $1) as watchlist,
         (select count(*)::int from google_reviews gr join leads l on l.id = gr.lead_id where l.workspace_id = $1) as reviews,
         (select count(*)::int from team_todos where workspace_id = $1) as todos`,
      [wsId]
    );
    console.log("\nFinal state for", TARGET_EMAIL, ":", finals.rows[0]);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
