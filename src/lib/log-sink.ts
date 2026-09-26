/**
 * Batched, non-blocking drain from logger → AppLog.
 *
 * Stdout still happens in logger.ts (Vercel and Railway keep their own
 * streams). This sink is best-effort: a database failure must never
 * throw into the request or the worker.
 *
 * Web processes also schedule a Next.js `after()` flush so serverless
 * isolates persist the buffer before they freeze. Workers flush on a
 * timer and on shutdown.
 */

import type { Prisma } from "@/generated/prisma/client";
import {
  capLogFields,
  clipEvent,
  logRuntime,
  resolveLogSource,
  retentionCutoff,
  scrubLogText,
  shouldPersistLogs,
  summarizeLogFields,
  type AppLogLevel,
} from "@/lib/app-log";

type PendingLog = {
  createdAt: Date;
  level: string;
  event: string;
  source: string;
  message: string | null;
  fields: Record<string, unknown>;
};

const FLUSH_MS = 1000;
const URGENT_FLUSH_MS = 50;
const BATCH_AT = 25;
const MAX_BUFFER = 200;
const PURGE_EVERY_MS = 15 * 60 * 1000;
const FAIL_BACKOFF_MS = 15_000;

let buffer: PendingLog[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let lastPurgeAt = 0;
let failUntil = 0;
let requestFlushScheduled = false;
let consoleCaptureInstalled = false;
let sinkFailureLoggedAt = 0;

const nativeConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
};

function isLoggerJsonLine(value: string): boolean {
  if (!value.startsWith('{"level":')) return false;
  return value.includes('"event":');
}

export function enqueueAppLog(input: {
  level: AppLogLevel;
  event: string;
  fields: Record<string, unknown>;
}): void {
  if (!shouldPersistLogs()) return;
  const fields = capLogFields({ ...input.fields, runtime: logRuntime() });
  if (typeof fields.message === "string") {
    fields.message = scrubLogText(fields.message);
  }
  const summary = summarizeLogFields(fields);
  buffer.push({
    createdAt: new Date(),
    level: input.level,
    event: clipEvent(input.event),
    source: resolveLogSource(),
    message: summary ? scrubLogText(summary) : null,
    fields,
  });
  if (buffer.length > MAX_BUFFER) {
    buffer.splice(0, buffer.length - MAX_BUFFER);
  }
  if (input.level === "error" || buffer.length >= BATCH_AT) {
    scheduleTimer(URGENT_FLUSH_MS);
    void flushAppLogs();
  } else {
    scheduleTimer(FLUSH_MS);
  }
  if (process.env.IS_WORKER !== "1") {
    void scheduleRequestFlush();
  }
}

function scheduleTimer(delay: number): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushAppLogs();
  }, delay);
  timer.unref?.();
}

async function scheduleRequestFlush(): Promise<void> {
  if (requestFlushScheduled) return;
  requestFlushScheduled = true;
  try {
    const mod = (await import("next/server")) as {
      after?: (fn: () => Promise<void> | void) => void;
    };
    if (typeof mod.after !== "function") {
      requestFlushScheduled = false;
      return;
    }
    mod.after(() => {
      requestFlushScheduled = false;
      return flushAppLogs();
    });
  } catch {
    requestFlushScheduled = false;
  }
}

export function flushAppLogs(): Promise<void> {
  if (flushing) return flushing;
  if (buffer.length === 0) return Promise.resolve();
  if (Date.now() < failUntil) return Promise.resolve();
  flushing = doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.appLog.createMany({
      data: batch as Prisma.AppLogCreateManyInput[],
    });
    await maybePurge(prisma);
  } catch (err) {
    buffer = batch.concat(buffer).slice(-MAX_BUFFER);
    failUntil = Date.now() + FAIL_BACKOFF_MS;
    scheduleTimer(FAIL_BACKOFF_MS);
    const now = Date.now();
    if (now - sinkFailureLoggedAt > 60_000) {
      sinkFailureLoggedAt = now;
      const message = err instanceof Error ? err.message : String(err);
      nativeConsole.error(`[log-sink] persist failed: ${message}`);
    }
  }
}

async function maybePurge(prisma: {
  appLog: {
    deleteMany: (args: {
      where: { createdAt: { lt: Date } };
    }) => Promise<unknown>;
  };
}): Promise<void> {
  const now = Date.now();
  if (now - lastPurgeAt < PURGE_EVERY_MS) return;
  lastPurgeAt = now;
  try {
    await prisma.appLog.deleteMany({
      where: { createdAt: { lt: retentionCutoff() } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    nativeConsole.error(`[log-sink] purge failed: ${message}`);
  }
}

export async function purgeExpiredAppLogs(): Promise<void> {
  if (!shouldPersistLogs()) return;
  try {
    const { prisma } = await import("@/lib/prisma");
    lastPurgeAt = Date.now();
    await prisma.appLog.deleteMany({
      where: { createdAt: { lt: retentionCutoff() } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    nativeConsole.error(`[log-sink] purge failed: ${message}`);
  }
}

/**
 * Pick up console.error / console.warn that never went through logger.
 * Logger's own JSON lines are ignored so each event is stored once.
 */
export function installConsoleCapture(): void {
  if (consoleCaptureInstalled) return;
  if (!shouldPersistLogs()) return;
  consoleCaptureInstalled = true;

  for (const level of ["error", "warn"] as const) {
    const original = nativeConsole[level];
    console[level] = (...args: unknown[]) => {
      original(...args);
      const text = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return arg.stack || arg.message;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" ")
        .slice(0, 2_000);
      if (!text || text.startsWith("[log-sink]")) return;
      if (isLoggerJsonLine(text)) return;
      enqueueAppLog({
        level,
        event: `console.${level}`,
        fields: { message: text },
      });
    };
  }
}
