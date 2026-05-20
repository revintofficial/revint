/**
 * Diagnostic: inspect Berkay's Supabase auth.users row to see when
 * the password was last changed, last sign-in, recovery flow status.
 *
 * Run: npx tsx scripts/check-berkay-auth.ts
 */
import { Client } from "pg";
import "dotenv/config";

const EMAIL = process.env.TARGET_EMAIL ?? "berkaysirakayaaa@gmail.com";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const r = await c.query(
      `select
         id,
         email,
         created_at,
         updated_at,
         last_sign_in_at,
         email_confirmed_at,
         confirmation_sent_at,
         recovery_sent_at,
         email_change_sent_at,
         (encrypted_password is not null) as has_password,
         (updated_at - created_at) as updated_delta,
         raw_app_meta_data,
         raw_user_meta_data
       from auth.users
       where email = $1`,
      [EMAIL],
    );
    if (!r.rows[0]) {
      console.log(`No auth.users row for ${EMAIL}`);
      return;
    }
    console.log(JSON.stringify(r.rows[0], null, 2));

    const userId = r.rows[0].id as string;

    const audit = await c.query(
      `select created_at,
              payload->>'action' as action,
              payload->>'actor_id' as actor_id,
              payload->>'actor_username' as actor_username,
              payload->>'actor_via_sso' as actor_via_sso,
              payload->'traits' as traits
       from auth.audit_log_entries
       where payload::text ilike $1
          or payload::text ilike $2
       order by created_at desc
       limit 50`,
      [`%${EMAIL}%`, `%${userId}%`],
    );
    console.log(`\nAudit log entries (last 50) — for ${EMAIL} / ${userId}:`);
    if (audit.rows.length === 0) {
      console.log("  (none)");
    }
    for (const row of audit.rows) {
      console.log(
        `  ${row.created_at.toISOString()}  ${row.action}  actor=${row.actor_username ?? row.actor_id ?? "?"}  traits=${JSON.stringify(row.traits)}`,
      );
    }

    const pwActions = await c.query(
      `select created_at, payload->>'action' as action, payload
       from auth.audit_log_entries
       where (payload->>'action') ilike '%password%'
          or (payload->>'action') ilike '%recovery%'
          or (payload->>'action') ilike '%update_user%'
       order by created_at desc
       limit 20`,
    );
    console.log(`\nGlobal password/recovery/update_user events (last 20):`);
    for (const row of pwActions.rows) {
      const p = row.payload as Record<string, unknown>;
      console.log(
        `  ${row.created_at.toISOString()}  ${row.action}  payload=${JSON.stringify(p)}`,
      );
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("check failed:", e);
  process.exit(1);
});
