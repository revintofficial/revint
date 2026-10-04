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
