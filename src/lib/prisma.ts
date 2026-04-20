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
 */
function poolMax(): number {
  const override = Number(process.env.PRISMA_POOL_MAX);
  if (Number.isFinite(override) && override > 0) return override;
  // Supabase pooler lets us punch through to 15-20 on the free tier
  // comfortably; production usually wants this tuned up alongside the
  // Postgres max_connections setting.
  return process.env.IS_WORKER === "1" ? 10 : 10;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Set it in AWS Amplify Console > App settings > Environment variables."
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    ssl: needsSsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
    max: poolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
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
