/**
 * AgentRun idempotency key helpers.
 *
 * We derive a deterministic hash from the tuple
 * (workspaceId, workerKind, leadId ?? "_", canonicalized inputs) so
 * that two callers trying to enqueue the same logical work collide
 * on the unique partial index in `agent_runs (workspace_id,
 * idempotency_key)` and the second caller silently re-uses the
 * first one's row instead of spinning up a duplicate run.
 *
 * Use sites today:
 *   - orchestrator.ts: when advance() wants to schedule a step, it
 *     first looks for an existing AgentRun with the derived key and
 *     re-uses it if already present (avoids the race documented in
 *     P0-7 entering a second run after lock release).
 *   - /api/leads/:id/workers/:kind (legacy direct-invoke): same
 *     lookup prevents a client-side double-click from creating two
 *     runs.
 *
 * The hash deliberately does NOT include time-varying fields like
 * createdAt or the caller's userId; two different users clicking the
 * same action on the same lead within a short window share the same
 * key and therefore the same run (which is what we want).
 */
import { createHash } from "node:crypto";
import type { AgentWorkerKind } from "@/generated/prisma/client";

export interface IdempotencyKeyInput {
  workspaceId: string;
  workerKind: AgentWorkerKind;
  leadId: string | null;
  /**
   * The same `inputs` object that will flow into AgentRun.inputsJson.
   * Only keys known to meaningfully alter output contribute to the
   * key; caller-provided noise (ids, timestamps, session-scoped
   * trace flags) should be stripped before calling this helper.
   */
  inputs?: Record<string, unknown>;
}

/**
 * Canonicalizes an object by sorting keys recursively so the JSON
 * stringification is stable across calls. Arrays keep their order
 * (ordering is usually semantic there).
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = canonicalize((value as Record<string, unknown>)[k]);
  }
  return out;
}

export function computeIdempotencyKey(input: IdempotencyKeyInput): string {
  const canonical = {
    w: input.workspaceId,
    k: input.workerKind,
    l: input.leadId ?? "_",
    i: canonicalize(input.inputs ?? {}),
  };
  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("base64url")
    .slice(0, 32);
}
