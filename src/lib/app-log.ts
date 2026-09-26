/**
 * Pure helpers for the platform log drain. No Prisma, no I/O — safe to
 * import from the logger, tests, and the admin reader.
 */

export const APP_LOG_RETENTION_MS = 48 * 60 * 60 * 1000;
export const APP_LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export const APP_LOG_SOURCES = ["web", "worker"] as const;

export type AppLogLevel = (typeof APP_LOG_LEVELS)[number];
export type AppLogSource = (typeof APP_LOG_SOURCES)[number];

const MAX_EVENT = 200;
const MAX_MESSAGE = 500;
const MAX_FIELDS_CHARS = 8_000;

export function shouldPersistLogs(): boolean {
  if (process.env.LOG_SINK === "0") return false;
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.VITEST) return false;
  return true;
}

export function resolveLogSource(): AppLogSource {
  return process.env.IS_WORKER === "1" ? "worker" : "web";
}

export function clipEvent(event: string): string {
  const trimmed = event.trim() || "log";
  return trimmed.length > MAX_EVENT ? trimmed.slice(0, MAX_EVENT) : trimmed;
}

export function summarizeLogFields(
  fields: Record<string, unknown>,
): string | null {
  const err = fields.err ?? fields.error;
  if (typeof err === "string" && err.trim()) return err.trim().slice(0, MAX_MESSAGE);
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, MAX_MESSAGE);
    }
  }
  if (typeof fields.message === "string" && fields.message.trim()) {
    return fields.message.trim().slice(0, MAX_MESSAGE);
  }
  return null;
}

export function capLogFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  let json: string;
  try {
    json = JSON.stringify(fields);
  } catch {
    return { truncated: true, preview: "[unserializable]" };
  }
  if (json.length <= MAX_FIELDS_CHARS) return fields;
  return { truncated: true, preview: json.slice(0, MAX_FIELDS_CHARS) };
}

export function retentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - APP_LOG_RETENTION_MS);
}

const LEVEL_SET = new Set<string>(APP_LOG_LEVELS);
const SOURCE_SET = new Set<string>(APP_LOG_SOURCES);

export function normaliseLogLevel(value: string | null | undefined): AppLogLevel | null {
  if (!value) return null;
  return LEVEL_SET.has(value) ? (value as AppLogLevel) : null;
}

export function normaliseLogSource(
  value: string | null | undefined,
): AppLogSource | null {
  if (!value) return null;
  return SOURCE_SET.has(value) ? (value as AppLogSource) : null;
}

export function normaliseLogQuery(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 120);
  return trimmed.length ? trimmed : null;
}

export type AppLogFilter = {
  createdAt: { gte: Date };
  level?: AppLogLevel;
  source?: AppLogSource;
  OR?: Array<
    | { event: { contains: string; mode: "insensitive" } }
    | { message: { contains: string; mode: "insensitive" } }
  >;
};

export function buildAppLogFilter(input: {
  level?: string | null;
  source?: string | null;
  q?: string | null;
  now?: Date;
}): AppLogFilter {
  const level = normaliseLogLevel(input.level);
  const source = normaliseLogSource(input.source);
  const q = normaliseLogQuery(input.q);
  const filter: AppLogFilter = {
    createdAt: { gte: retentionCutoff(input.now) },
  };
  if (level) filter.level = level;
  if (source) filter.source = source;
  if (q) {
    filter.OR = [
      { event: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
    ];
  }
  return filter;
}

export function logRuntime(): "vercel" | "railway" | "local" {
  if (process.env.IS_WORKER === "1") {
    return process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID
      ? "railway"
      : "local";
  }
  return process.env.VERCEL ? "vercel" : "local";
}

export function sourceLabel(source: string, runtime?: string | null): string {
  if (source === "worker") {
    return runtime === "local" ? "Worker (local)" : "Railway";
  }
  if (source === "web") {
    return runtime === "local" ? "App (local)" : "Vercel";
  }
  return source;
}

export function scrubLogText(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/([^:@/\s]+):([^@/\s]+)@/gi, "postgres://$1:***@")
    .replace(/(?:sk|rk)_[A-Za-z0-9_]+/g, "[redacted]");
}
