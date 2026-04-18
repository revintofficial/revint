import { Client } from "pg";
import "dotenv/config";

async function main() {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const cons = await c.query(
      `select conname, pg_get_constraintdef(oid) as def
       from pg_constraint
       where conrelid = 'public.leads'::regclass
       order by conname`
    );
    console.log("LEAD CONSTRAINTS:");
    for (const r of cons.rows) console.log(`  ${r.conname} :: ${r.def}`);

    const idx = await c.query(
      `select indexname, indexdef from pg_indexes where tablename = 'leads' order by indexname`
    );
    console.log("\nLEAD INDEXES:");
    for (const r of idx.rows) console.log(`  ${r.indexname} :: ${r.indexdef}`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
