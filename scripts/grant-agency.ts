/**
 * Grant AGENCY plan to a user's primary workspace.
 *
 * Run with:  npx tsx scripts/grant-agency.ts <email>
 */
import { Client } from "pg";
import "dotenv/config";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: tsx scripts/grant-agency.ts <email>");

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  try {
    const u = await c.query(`select id from auth.users where email = $1`, [email]);
    if (!u.rows[0]) throw new Error(`No auth user for ${email}. Sign up first.`);
    const userId = u.rows[0].id as string;

    const w = await c.query(
      `select w.id, w.name, w.slug, w.plan
       from workspace_members wm
       join workspaces w on w.id = wm.workspace_id
       where wm.user_id = $1
       order by wm.created_at asc`,
      [userId]
    );

    if (!w.rows.length) throw new Error(`No workspace found for ${email}.`);

    for (const row of w.rows) {
      await c.query(
        `update workspaces
         set plan = 'AGENCY',
             current_period_end = now() + interval '100 years',
             updated_at = now()
         where id = $1`,
        [row.id]
      );
      console.log(`Upgraded "${row.name}" (${row.slug}) from ${row.plan} -> AGENCY`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
