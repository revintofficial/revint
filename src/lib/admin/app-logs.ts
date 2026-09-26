import type { Prisma } from "@/generated/prisma/client";
import { buildAppLogFilter, type AppLogFilter } from "@/lib/app-log";
import { prisma } from "@/lib/prisma";

export type AdminLogRow = {
  id: string;
  createdAt: string;
  level: string;
  event: string;
  source: string;
  message: string | null;
  fields: unknown;
};

export type AdminLogLevelCount = {
  level: string;
  count: number;
};

export type AdminLogsPage = {
  rows: AdminLogRow[];
  counts: AdminLogLevelCount[];
  nextCursor: string | null;
  error: string | null;
};

const PAGE_SIZE = 80;

function isMissingTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2021"
  );
}

export async function loadAdminLogs(input: {
  level?: string | null;
  source?: string | null;
  q?: string | null;
  cursor?: string | null;
}): Promise<AdminLogsPage> {
  const where: AppLogFilter = buildAppLogFilter(input);
  const cursor = input.cursor?.trim() || null;
  try {
    const [found, grouped] = await Promise.all([
      prisma.appLog.findMany({
        where: where as Prisma.AppLogWhereInput,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.appLog.groupBy({
        by: ["level"],
        where: { createdAt: where.createdAt },
        _count: { _all: true },
      }),
    ]);
    const hasMore = found.length > PAGE_SIZE;
    const page = hasMore ? found.slice(0, PAGE_SIZE) : found;
    return {
      rows: page.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        level: row.level,
        event: row.event,
        source: row.source,
        message: row.message,
        fields: row.fields,
      })),
      counts: grouped
        .map((row) => ({ level: row.level, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      error: null,
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        rows: [],
        counts: [],
        nextCursor: null,
        error:
          "The app_log table is not in the database yet. Run npm run db:push against this environment, then redeploy Vercel and Railway.",
      };
    }
    const message = err instanceof Error ? err.message : "Could not read logs.";
    return { rows: [], counts: [], nextCursor: null, error: message };
  }
}
