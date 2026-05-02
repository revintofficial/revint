/**
 * Beta finding §7 — `SUCCEEDED_NO_MEMORY` graceful degrade path.
 *
 * Three guarantees:
 *
 *   1. `EmbeddingError` is a real class exported from `embed.ts`. The
 *      executor uses `instanceof EmbeddingError` to distinguish embed
 *      failures from other errors that should still hard-fail the run.
 *
 *   2. The Prisma client's `AgentRunStatus` enum exposes
 *      `SUCCEEDED_NO_MEMORY` so the executor's status-write doesn't
 *      throw at runtime. (The schema was updated alongside this code;
 *      this test catches a regression where someone reverts the schema
 *      without updating the executor or vice versa.)
 *
 *   3. `AgentWorkerContext.memoryDegraded` is part of the worker
 *      contract: workers can branch on it (e.g. skip a few-shot
 *      retrieval) and the executor sets it from the pre-fetch result.
 *
 * A full DB-backed integration test of the degrade path lives in
 * `execute-cross-tenant.integration.test.ts`'s neighbours; this is the
 * fast unit-level sanity check.
 */
import { describe, expect, it } from "vitest";
import { EmbeddingError } from "@/lib/ai-core/embed";
import { AgentRunStatus } from "@/generated/prisma/enums";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

describe("Beta §7 — embedding degrade primitives", () => {
  it("EmbeddingError is throwable and identifiable via instanceof", () => {
    const err = new EmbeddingError("test failure");
    expect(err).toBeInstanceOf(EmbeddingError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("EmbeddingError");
    expect(err.message).toBe("test failure");
  });

  it("EmbeddingError preserves a wrapped cause for diagnostics", () => {
    const root = new Error("upstream 429");
    const err = new EmbeddingError("after retries", root);
    expect(err.cause).toBe(root);
  });

  it("AgentRunStatus enum exposes SUCCEEDED_NO_MEMORY", () => {
    // The executor relies on this value to flip a partially-successful
    // run (worker output OK, memory embed failed) into a non-blocking
    // status that downstream chains can still read from.
    expect(AgentRunStatus.SUCCEEDED_NO_MEMORY).toBe("SUCCEEDED_NO_MEMORY");
    expect(AgentRunStatus.SUCCEEDED).toBe("SUCCEEDED");
    expect(AgentRunStatus.FAILED).toBe("FAILED");
  });

  it("AgentWorkerContext type carries the memoryDegraded signal", () => {
    // Compile-time assertion: if the field is removed from
    // `AgentWorkerContext`, this file stops type-checking.
    const _exemplar: Pick<AgentWorkerContext, "memoryDegraded"> = {
      memoryDegraded: true,
    };
    expect(_exemplar.memoryDegraded).toBe(true);
  });
});
