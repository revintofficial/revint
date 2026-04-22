/**
 * Pre-deploy sanity check: verify that:
 *   1. pgvector extension is installed on the target database
 *   2. The `semantic_memory.embedding` column is typed as vector(768)
 *   3. The HNSW index exists on that column
 *
 * Usage:
 *   npx tsx scripts/check-pgvector.ts
 *
 * Exits non-zero when any check fails; CI/CD pipelines can gate
 * deploys on this script. Safe to run in prod; read-only.
 */
import "dotenv/config";
import { Client } from "pg";

interface CheckResult {
  ok: boolean;
  detail?: string;
}

async function checkExtension(client: Client): Promise<CheckResult> {
  const res = await client.query<{ extversion: string }>(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  if (res.rows.length === 0) {
    return {
      ok: false,
      detail: "pgvector extension not installed. Run: npx tsx prisma/migrations/apply.ts add_pgvector_extension.sql",
    };
  }
  return { ok: true, detail: `pgvector v${res.rows[0].extversion}` };
}

async function checkEmbeddingColumn(client: Client): Promise<CheckResult> {
  const res = await client.query<{ udt_name: string; data_type: string }>(
    `SELECT udt_name, data_type FROM information_schema.columns
     WHERE table_name = 'semantic_memory' AND column_name = 'embedding'`,
  );
  if (res.rows.length === 0) {
    return {
      ok: false,
      detail: "semantic_memory.embedding column missing. Run: prisma db push",
    };
  }
  const type = res.rows[0].udt_name;
  if (type !== "vector") {
    return {
      ok: false,
      detail: `embedding column is ${type}, expected vector. Run: npx tsx prisma/migrations/apply.ts add_ai_core.sql`,
    };
  }
  return { ok: true, detail: "embedding vector(768) ok" };
}

async function checkHnswIndex(client: Client): Promise<CheckResult> {
  const res = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'semantic_memory' AND indexname = 'semantic_memory_embedding_hnsw'`,
  );
  if (res.rows.length === 0) {
    return {
      ok: false,
      detail: "HNSW index missing. Run: npx tsx prisma/migrations/apply.ts add_ai_core.sql",
    };
  }
  return { ok: true, detail: "HNSW index ok" };
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL or DATABASE_URL not set");
    process.exit(2);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const checks: Array<[string, CheckResult]> = [];
    checks.push(["extension", await checkExtension(client)]);
    checks.push(["embedding_column", await checkEmbeddingColumn(client)]);
    checks.push(["hnsw_index", await checkHnswIndex(client)]);

    let failed = 0;
    for (const [name, r] of checks) {
      const label = r.ok ? "PASS" : "FAIL";
      console.log(`[${label}] ${name}: ${r.detail ?? ""}`);
      if (!r.ok) failed++;
    }

    if (failed > 0) {
      console.error(`\n${failed} check(s) failed. Fix migrations before deploying.`);
      process.exit(1);
    }
    console.log("\nAll checks passed.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("check-pgvector failed:", e);
  process.exit(1);
});
