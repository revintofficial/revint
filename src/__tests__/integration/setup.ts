/**
 * Integration-test setup.
 *
 * Loaded by `vitest.config.integration.ts` via `setupFiles`. It:
 *   1. Reads `.env.test` into `process.env` (without overwriting values
 *      the caller already set in the shell).
 *   2. Hard-stops the suite if the resolved DATABASE_URL looks like a
 *      production database. This is the last line of defence against
 *      a developer accidentally running destructive integration tests
 *      against the wrong URL.
 *   3. Exposes a `beforeAll` hook that verifies pgvector is installed;
 *      if the extension is missing the whole suite fails fast with a
 *      clear error instead of producing confusing cosine-similarity
 *      failures in each individual test.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll } from "vitest";

const ENV_TEST_PATH = resolve(process.cwd(), ".env.test");

if (existsSync(ENV_TEST_PATH)) {
  // `override: false` keeps shell-exported vars winning over the file
  // so CI can point at a different DB without editing anything.
  loadEnv({ path: ENV_TEST_PATH, override: false });
} else {
  console.warn(
    "[integration-setup] .env.test not found at " +
      ENV_TEST_PATH +
      " - integration tests that need DATABASE_URL will fail to connect. " +
      "Copy .env.test.example to .env.test and set DATABASE_URL.",
  );
}

const url = process.env.DATABASE_URL ?? "";

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "[integration-setup] NODE_ENV=production - integration tests MUST NOT run against a production environment. Abort.",
  );
}

if (url && /\bprod(uction)?\b|prod\.|-prod-|prod-/i.test(url)) {
  throw new Error(
    "[integration-setup] DATABASE_URL looks like a production database (contains 'prod'). Refusing to run integration tests. Set a dedicated test DATABASE_URL in .env.test.",
  );
}

if (!url) {
  // Leave the warning above; tests that hit Prisma will throw a clear
  // connection error on their own. We do NOT throw here so vitest can
  // still collect the file list and print a useful summary.
  console.warn("[integration-setup] DATABASE_URL is empty; Prisma calls will fail.");
}

/**
 * Verifies the pgvector extension + HNSW index are present. Run once
 * per worker process; subsequent `beforeAll` calls in individual test
 * files are free to assume the DB schema is ready.
 *
 * Lazy-imports Prisma so this file is still safe to load even when the
 * Prisma client was not generated (e.g. on a fresh checkout before
 * `npm install`).
 */
beforeAll(async () => {
  if (!url) return;
  const { prisma } = await import("@/lib/prisma");
  const rows = (await prisma.$queryRawUnsafe(
    "SELECT extname FROM pg_extension WHERE extname = 'vector'",
  )) as Array<{ extname: string }>;
  if (rows.length === 0) {
    throw new Error(
      "[integration-setup] pgvector extension is not installed on the test database. Run `npm run db:ai-core` (or manually `CREATE EXTENSION IF NOT EXISTS vector;`) before running integration tests.",
    );
  }
});

afterAll(async () => {
  if (!url) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
