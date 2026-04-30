/**
 * Hard-delete all leads in workspaces the user can access (owner or member).
 *
 * Usage: npx tsx scripts/delete-leads-for-user-email.ts <email>
 *
 * Clears planner_sessions.lead_id first (FK is not CASCADE). Removes
 * lead_sequence_states for those workspaces so orphan FKs cannot block.
 */
import { Client } from "pg";
import "dotenv/config";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error("Usage: npx tsx scripts/delete-leads-for-user-email.ts <email>");
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");

  const c = new Client({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await c.connect();

  try {
    const userRes = await c.query(`select id, email from users where lower(email) = $1`, [
      email,
    ]);
    if (!userRes.rows[0]) {
      throw new Error(`No app user found with email (case-insensitive): ${email}`);
    }
    const userId = userRes.rows[0].id as string;
    const canonicalEmail = userRes.rows[0].email as string;

    const wsRes = await c.query<{ id: string; slug: string; name: string }>(
      `select distinct w.id, w.slug, w.name
       from workspaces w
       where w.owner_id = $1::uuid
       union
       select w.id, w.slug, w.name
       from workspace_members wm
       join workspaces w on w.id = wm.workspace_id
       where wm.user_id = $1::uuid`,
      [userId]
    );

    if (!wsRes.rows.length) {
      console.log(`No workspaces for ${canonicalEmail}; nothing to delete.`);
      return;
    }

    const ids = wsRes.rows.map((r) => r.id);

    const countBefore = await c.query(`select count(*)::int as c from leads where workspace_id = any($1)`, [
      ids,
    ]);
    const n = countBefore.rows[0]?.c ?? 0;

    console.log(`User: ${canonicalEmail} (${userId})`);
    console.log(`Workspaces (${ids.length}):`);
    for (const w of wsRes.rows) {
      console.log(`  - ${w.slug} (${w.name})`);
    }
    console.log(`Leads to delete: ${n}`);

    if (n === 0) {
      return;
    }

    await c.query("begin");
    await c.query(
      `update planner_sessions set lead_id = null where workspace_id = any($1) and lead_id is not null`,
      [ids]
    );
    await c.query(`delete from lead_sequence_states where workspace_id = any($1)`, [ids]);
    const del = await c.query(`delete from leads where workspace_id = any($1) returning id`, [ids]);
    await c.query("commit");

    console.log(`Deleted ${del.rowCount} lead row(s).`);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
