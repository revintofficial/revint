import { readFileSync } from "fs";
import { resolve } from "path";
import { Client } from "pg";
import "dotenv/config";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const sqlFile = process.argv[2] || "bootstrap_multitenant.sql";
  const sqlPath = resolve(__dirname, sqlFile);
  const sql = readFileSync(sqlPath, "utf-8");

  console.log(`Applying migration: ${sqlFile}`);
  console.log(`Target: ${url.replace(/:[^@]+@/, ":***@")}`);

  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration applied successfully");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
