// src/lib/agent-workers/deadline.ts
/**
 * Outer deadline of one worker execution. Default: three times the
 * estimated duration, capped at 180 s. A worker that is legitimately
 * long-running in-process declares its own `deadlineMs` in the registry.
 */
export function workerDeadlineMsFor(
  meta: { estimatedDurationMs?: number; deadlineMs?: number } | null | undefined,
): number {
  if (meta?.deadlineMs && meta.deadlineMs > 0) return meta.deadlineMs;
  return Math.min((meta?.estimatedDurationMs ?? 60_000) * 3, 180_000);
}

const SYNC_WATCHDOG_MS = 3 * 60_000;
const ASYNC_WATCHDOG_MS = 10 * 60_000;
const DEADLINE_GRACE_MS = 60_000;

function ms(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Lazy watchdog verdict for a PENDING / RUNNING run (GET /api/agent-runs/[id]).
 * Async Apify runs: ten minutes from creation (a webhook is expected).
 * Sync runs: the worker's own deadline plus a minute when it declares one,
 * otherwise three minutes, counted from the latest of creation, start and
 * deferral, so a run that is waiting for capacity or being retried is not
 * declared dead while it is alive.
 */
export function watchdogVerdict(
  run: { createdAt: Date | string; startedAt: Date | string | null; inputsJson: unknown },
  meta: { estimatedDurationMs?: number; deadlineMs?: number } | null | undefined,
  nowMs: number = Date.now(),
): { expired: boolean; limitMs: number; ageMs: number; isAsync: boolean } {
  const inputs =
    run.inputsJson && typeof run.inputsJson === "object" && !Array.isArray(run.inputsJson)
      ? (run.inputsJson as Record<string, unknown>)
      : {};
  const isAsync = inputs.mode === "async-apify" && typeof inputs.apifyRunId === "string";
  if (isAsync) {
    const ageMs = nowMs - ms(run.createdAt);
    return { expired: ageMs > ASYNC_WATCHDOG_MS, limitMs: ASYNC_WATCHDOG_MS, ageMs, isAsync };
  }
  const limitMs = meta?.deadlineMs && meta.deadlineMs > 0 ? meta.deadlineMs + DEADLINE_GRACE_MS : SYNC_WATCHDOG_MS;
  const deferredAt = typeof inputs.deferredAt === "string" ? inputs.deferredAt : null;
  const base = Math.max(ms(run.createdAt), ms(run.startedAt), ms(deferredAt));
  const ageMs = nowMs - base;
  return { expired: ageMs > limitMs, limitMs, ageMs, isAsync };
}
