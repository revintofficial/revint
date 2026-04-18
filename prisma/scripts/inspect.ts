import { Client } from "pg";
import "dotenv/config";

async function main() {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const counts = await c.query(`
      select 'leads' as t, count(*)::int as c, workspace_id from leads group by workspace_id
      union all
      select 'todos', count(*)::int, workspace_id from team_todos group by workspace_id
    `);
    console.log("BY WORKSPACE:", counts.rows);

    const auditCount = await c.query(`select count(*)::int as c from website_audits`);
    const oppCount = await c.query(`select count(*)::int as c from sales_opportunities`);
    const wlCount = await c.query(`select count(*)::int as c from watchlist_items`);
    const revCount = await c.query(`select count(*)::int as c from google_reviews`);
    console.log("audits:", auditCount.rows[0].c);
    console.log("opportunities:", oppCount.rows[0].c);
    console.log("watchlist:", wlCount.rows[0].c);
    console.log("reviews:", revCount.rows[0].c);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
