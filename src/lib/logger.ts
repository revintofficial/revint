/**
 * Structured logger. Emits JSON lines to stdout so log collectors (Vercel,
 * Axiom, Datadog, CloudWatch) can parse them, and forwards errors to Sentry
 * when SENTRY_DSN is set.
 *
 * Do NOT log raw Error objects with `console.error(err)`. Call logger.error
 * with a short event name + a fields object. Secrets (tokens, DB strings,
 * cookies) are redacted automatically.
 */

type Fields = Record<string, unknown>;

const SECRET_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /database[_-]?url/i,
  /direct[_-]?url/i,
];

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((r) => r.test(key));
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Redact values that smell like secrets even if the key is benign.
    if (value.startsWith("sk_") || value.startsWith("rk_")) return "[redacted]";
    if (/^postgres(ql)?:\/\/[^@]+@/i.test(value)) {
      return value.replace(/:([^:@/]+)@/, ":***@");
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // Stack is useful in dev but gets noisy in prod aggregators. Kept.
      stack: value.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, fields: Fields) {
  const record = {
    level,
    event,
    ts: new Date().toISOString(),
    ...((redact(fields) as Record<string, unknown>) || {}),
  };
  const line = JSON.stringify(record);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
  // Sentry hook: forward errors only. Keep the hook synchronous and cheap so
  // we don't block the request. The actual Sentry SDK integration lives in
  // instrumentation.ts if/when SENTRY_DSN is set.
  if (level === "error" && process.env.SENTRY_DSN) {
    try {
      const g = globalThis as unknown as {
        __sentry_capture?: (payload: unknown) => void;
      };
      g.__sentry_capture?.(record);
    } catch {
      // ignore - logging must never throw
    }
  }
}

export const logger = {
  debug: (event: string, fields: Fields = {}) =>
    process.env.NODE_ENV !== "production" && emit("debug", event, fields),
  info: (event: string, fields: Fields = {}) => emit("info", event, fields),
  warn: (event: string, fields: Fields = {}) => emit("warn", event, fields),
  error: (event: string, fields: Fields = {}) => emit("error", event, fields),
};

export type Logger = typeof logger;
