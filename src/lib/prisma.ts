import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function needsSsl(url: string): boolean {
  const isLocal =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("host.docker.internal");
  return !isLocal;
}

/**
 * Pool sizing. Web processes share the pool across request concurrency; 2
 * was way too tight - two dashboard loads starved each other. Workers hold
 * long transactions and want a higher ceiling. PRISMA_POOL_MAX overrides.
 *
 * Worker process needs significantly more headroom than the web tier:
 * the agent-runs queue runs at concurrency 10, plus crawl/analyze/
 * review-analysis/email-verification/discovery in the same node — peak
 * aggregate concurrent demand is ~25 jobs each potentially holding 1-2
 * connections (memory.query + agentRun.update + semanticMemory.upsert
 * fan-out). At pool=10 we routinely hit `connectionTimeoutMillis` and
 * pg fires "Connection terminated due to connection timeout", which
 * surfaces as worker_deadline_exceeded / FAILED rows. Supabase pgbouncer
 * happily holds 25-30 backend slots.
 */
function poolMax(): number {
  const override = Number(process.env.PRISMA_POOL_MAX);
  if (Number.isFinite(override) && override > 0) return override;
  return process.env.IS_WORKER === "1" ? 25 : 10;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Set it in the Vercel project environment settings (Production + Preview)."
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    ssl: needsSsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
    max: poolMax(),
    idleTimeoutMillis: 10_000,
    // 10s is too aggressive for the agent-runs path: a single executeAgentRun
    // call may chain memoryQuery (pgvector) + agentRun.update + semanticMemory
    // upserts + Gemini round-trips, holding a connection 5-15s. When the pool
    // is briefly saturated, late arrivals time out and pg surfaces
    // "Connection terminated due to connection timeout" — counted as worker
    // failure even though it was just pool back-pressure. 30s gives the pool
    // enough slack to drain naturally without dropping jobs.
    connectionTimeoutMillis: 30_000,
  });

  return new PrismaClient({ adapter });
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as InstanceType<typeof PrismaClient>, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
