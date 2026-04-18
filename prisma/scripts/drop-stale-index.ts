import { Client } from "pg";
import "dotenv/config";

async function main() {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query(`DROP INDEX IF EXISTS leads_place_id_key`);
    console.log("Dropped stale unique index leads_place_id_key");
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
