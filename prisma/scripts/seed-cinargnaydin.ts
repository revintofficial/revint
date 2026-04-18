/**
 * Seed CSV exports into the cinargnaydin@gmail.com workspace.
 *
 * Generates fresh IDs for every row (the original cuids already belong to
 * the meertseker workspace) and remaps lead_id foreign keys via a map.
 *
 * Run with:  npx tsx prisma/scripts/seed-cinargnaydin.ts
 */
import { Client } from "pg";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import "dotenv/config";

const TARGET_EMAIL = "cinargnaydin@gmail.com";
const CSV_DIR = "C:/Users/meert/Downloads";

const FILES = {
  leads: "leads_rows.csv",
  watchlist: "watchlist_items_rows.csv",
  sales: "sales_opportunities_rows.csv",
  reviews: "google_reviews_rows.csv",
  todos: "team_todos_rows.csv",
};

interface LeadRow {
  id: string; place_id: string; business_name: string; formatted_address: string;
  borough: string | null; phone: string | null; website_url: string | null;
  has_website: string; google_maps_uri: string | null; rating: string | null;
  review_count: string | null; business_status: string | null;
  primary_type: string | null; source_query: string | null;
  source_lat: string | null; source_lng: string | null;
  crawl_status: string; analyze_status: string;
  created_at: string; updated_at: string;
}
interface WatchlistRow {
  id: string; lead_id: string; site_url: string | null; notes: string | null;
  website_plan: string | null; pipeline_notes: string | null;
  selected_offer: string | null; meeting_result: string | null;
  created_at: string; updated_at: string;
}
interface SalesRow {
  id: string; lead_id: string; opportunity_score: string;
  reason_codes: string; why_good_target: string | null;
  likely_pain_points: string; best_sales_angle: string | null;
  suggested_offer: string; personalized_first_message: string | null;
  expected_price_band: string | null; status: string;
  created_at: string; updated_at: string;
}
interface ReviewRow {
  id: string; lead_id: string; author_name: string; author_photo: string | null;
  rating: string; text: string | null; relative_time: string;
  publish_time: string; created_at: string;
}
interface TodoRow {
  id: string; column: string; text: string; done: string;
  sort_order: string; created_at: string; updated_at: string;
}

function readCsv<T>(filename: string): T[] {
  const path = resolve(CSV_DIR, filename);
  if (!existsSync(path)) {
    console.warn(`  ! Skipping ${filename} (not found)`);
    return [];
  }
  const raw = readFileSync(path, "utf-8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as T[];
}

const nullable = (v: string | null | undefined) =>
  v === undefined || v === null || v === "" || v === "NULL" ? null : v;
const bool = (v: string | null | undefined) =>
  v === "true" || v === "t" || v === "1";
const num = (v: string | null | undefined) => {
  const n = nullable(v);
  if (n === null) return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
};
const jsonOrEmpty = (v: string | null | undefined) => {
  const n = nullable(v);
  if (n === null) return "[]";
  try { JSON.parse(n); return n; } catch { return "[]"; }
};
const newId = () => randomUUID().replace(/-/g, "");

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  try {
    // 1. Resolve auth user + ensure public.users row
    const u = await c.query(
      `select id from auth.users where email = $1`,
      [TARGET_EMAIL]
    );
    if (!u.rows[0]) throw new Error(`No auth user for ${TARGET_EMAIL}. Sign up first.`);
    const userId = u.rows[0].id as string;

    await c.query(
      `insert into users (id, email) values ($1, $2)
       on conflict (id) do update set email = EXCLUDED.email`,
      [userId, TARGET_EMAIL]
    );

    // 2. Find or create their workspace
    let wsId: string;
    const w = await c.query(
      `select w.id from workspace_members wm
       join workspaces w on w.id = wm.workspace_id
       where wm.user_id = $1
       order by wm.created_at asc
       limit 1`,
      [userId]
    );
    if (w.rows[0]) {
      wsId = w.rows[0].id;
      console.log(`Using existing workspace ${wsId}`);
    } else {
      wsId = newId();
      const baseSlug = TARGET_EMAIL.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let slug = baseSlug;
      let i = 0;
      while ((await c.query(`select 1 from workspaces where slug = $1`, [slug])).rows[0]) {
        slug = `${baseSlug}-${++i}`;
      }
      await c.query(
        `insert into workspaces (id, name, slug, owner_id)
         values ($1, $2, $3, $4)`,
        [wsId, "Cinar's Workspace", slug, userId]
      );
      await c.query(
        `insert into workspace_members (id, workspace_id, user_id, role)
         values ($1, $2, $3, 'OWNER')`,
        [newId(), wsId, userId]
      );
      console.log(`Created workspace ${wsId} (slug: ${slug})`);
    }

    // 3. Insert leads with new IDs and build a remap.
    const leads = readCsv<LeadRow>(FILES.leads);
    const idMap = new Map<string, string>(); // oldLeadId -> newLeadId
    let leadsInserted = 0;
    let leadsSkipped = 0;
    for (const l of leads) {
      // Skip if this workspace already has this place_id (re-runs idempotent).
      const existing = await c.query(
        `select id from leads where workspace_id = $1 and place_id = $2`,
        [wsId, l.place_id]
      );
      if (existing.rows[0]) {
        idMap.set(l.id, existing.rows[0].id);
        leadsSkipped++;
        continue;
      }
      const fresh = newId();
      idMap.set(l.id, fresh);
      await c.query(
        `insert into leads (
          id, workspace_id, place_id, business_name, formatted_address, borough,
          phone, website_url, has_website, google_maps_uri, rating, review_count,
          business_status, primary_type, source_query, source_lat, source_lng,
          crawl_status, analyze_status, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::"CrawlStatus",$19::"AnalyzeStatus",$20,$21)`,
        [
          fresh, wsId, l.place_id, l.business_name, l.formatted_address,
          nullable(l.borough), nullable(l.phone), nullable(l.website_url),
          bool(l.has_website), nullable(l.google_maps_uri),
          num(l.rating), num(l.review_count),
          nullable(l.business_status), nullable(l.primary_type),
          nullable(l.source_query), num(l.source_lat), num(l.source_lng),
          l.crawl_status || "PENDING", l.analyze_status || "PENDING",
          l.created_at, l.updated_at,
        ]
      );
      leadsInserted++;
    }
    console.log(`Leads: ${leadsInserted} inserted, ${leadsSkipped} already present`);

    // 4. Sales opportunities (one per lead, FK = lead_id unique)
    const sales = readCsv<SalesRow>(FILES.sales);
    let salesInserted = 0;
    let salesSkipped = 0;
    for (const s of sales) {
      const newLeadId = idMap.get(s.lead_id);
      if (!newLeadId) { salesSkipped++; continue; }
      const existing = await c.query(
        `select 1 from sales_opportunities where lead_id = $1`,
        [newLeadId]
      );
      if (existing.rows[0]) { salesSkipped++; continue; }
      await c.query(
        `insert into sales_opportunities (
          id, lead_id, opportunity_score, reason_codes, why_good_target,
          likely_pain_points, best_sales_angle, suggested_offer,
          personalized_first_message, expected_price_band, status,
          created_at, updated_at
        ) values ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8::"SuggestedOffer",$9,$10,$11::"OutreachStatus",$12,$13)`,
        [
          newId(), newLeadId, parseInt(s.opportunity_score, 10),
          jsonOrEmpty(s.reason_codes), nullable(s.why_good_target),
          jsonOrEmpty(s.likely_pain_points), nullable(s.best_sales_angle),
          (s.suggested_offer || "STARTER").toUpperCase(),
          nullable(s.personalized_first_message), nullable(s.expected_price_band),
          (s.status || "NEW").toUpperCase(), s.created_at, s.updated_at,
        ]
      );
      salesInserted++;
    }
    console.log(`Opportunities: ${salesInserted} inserted, ${salesSkipped} skipped`);

    // 5. Watchlist items
    const wls = readCsv<WatchlistRow>(FILES.watchlist);
    let wlInserted = 0;
    let wlSkipped = 0;
    for (const w of wls) {
      const newLeadId = idMap.get(w.lead_id);
      if (!newLeadId) { wlSkipped++; continue; }
      const existing = await c.query(
        `select 1 from watchlist_items where lead_id = $1`,
        [newLeadId]
      );
      if (existing.rows[0]) { wlSkipped++; continue; }
      await c.query(
        `insert into watchlist_items (
          id, lead_id, site_url, notes, website_plan, pipeline_notes,
          selected_offer, meeting_result, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7::"SuggestedOffer",$8::"MeetingResult",$9,$10)`,
        [
          newId(), newLeadId, nullable(w.site_url), nullable(w.notes),
          nullable(w.website_plan), nullable(w.pipeline_notes),
          nullable(w.selected_offer), nullable(w.meeting_result),
          w.created_at, w.updated_at,
        ]
      );
      wlInserted++;
    }
    console.log(`Watchlist: ${wlInserted} inserted, ${wlSkipped} skipped`);

    // 6. Google reviews (multiple per lead)
    const reviews = readCsv<ReviewRow>(FILES.reviews);
    let revInserted = 0;
    let revSkipped = 0;
    for (const v of reviews) {
      const newLeadId = idMap.get(v.lead_id);
      if (!newLeadId) { revSkipped++; continue; }
      await c.query(
        `insert into google_reviews (
          id, lead_id, author_name, author_photo, rating, text,
          relative_time, publish_time, created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId(), newLeadId, v.author_name, nullable(v.author_photo),
          parseInt(v.rating, 10), nullable(v.text), v.relative_time,
          v.publish_time, v.created_at,
        ]
      );
      revInserted++;
    }
    console.log(`Reviews: ${revInserted} inserted, ${revSkipped} skipped`);

    // 7. Todos (already has its own workspace_id column in CSV, ignored)
    const todos = readCsv<TodoRow>(FILES.todos);
    let todoInserted = 0;
    for (const t of todos) {
      // Avoid double-inserting on re-run by checking text+column.
      const existing = await c.query(
        `select 1 from team_todos where workspace_id = $1 and "column" = $2 and text = $3`,
        [wsId, t.column, t.text]
      );
      if (existing.rows[0]) continue;
      await c.query(
        `insert into team_todos (
          id, workspace_id, "column", text, done, sort_order, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          newId(), wsId, t.column, t.text, bool(t.done),
          parseInt(t.sort_order || "0", 10),
          t.created_at, t.updated_at,
        ]
      );
      todoInserted++;
    }
    console.log(`Todos: ${todoInserted} inserted`);

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
    console.log(`\nFinal state for ${TARGET_EMAIL}:`, finals.rows[0]);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
