/**
 * Round 2 §3.6 — quota disclosure unit tests.
 *
 * Validates the four `QuotaBlockReason` paths and the corresponding
 * `PermanentError` subclasses (`QuotaExceededError`,
 * `PerLeadDailyCapExceededError`, `ApifyBudgetExceededError`,
 * `PlanTooLowError`). Also exercises the new `SUCCEEDED_NO_MEMORY`
 * status inclusion in the per-lead daily counter — the bug that
 * surfaced as the "44/50000 quota exceeded" misleading UX in the
 * Round 2 Camden tester report.
 *
 * Notes:
 * - Mocks Prisma at the module boundary; the real `quota.ts` resolves
 *   counters inside `prisma.$transaction(async tx => …)`. The test
 *   forwards `tx` to the same mocks so each call site can return a
 *   per-call value via `mockAgentRunCount.mockImplementationOnce`.
 * - We don't try to assert on the RepeatableRead isolation level —
 *   that's a Postgres concern and is exercised on staging instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAgentRunCount = vi.fn();
const mockAgentRunAggregate = vi.fn();
const mockWorkspaceFindUniqueOrThrow = vi.fn();

vi.mock("@/lib/prisma", () => {
  const txProxy = {
    agentRun: {
      count: (...args: unknown[]) => mockAgentRunCount(...args),
      aggregate: (...args: unknown[]) => mockAgentRunAggregate(...args),
    },
  };
  const prisma: Record<string, unknown> = {
    agentRun: {
      count: (...args: unknown[]) => mockAgentRunCount(...args),
      aggregate: (...args: unknown[]) => mockAgentRunAggregate(...args),
    },
    workspace: {
      findUniqueOrThrow: (...args: unknown[]) =>
        mockWorkspaceFindUniqueOrThrow(...args),
    },
    $transaction: async (
      fn: (tx: typeof txProxy) => Promise<unknown>,
      _opts?: unknown,
    ) => fn(txProxy),
  };
  return { prisma };
});

const cycleResetAt = new Date("2026-04-01T00:00:00.000Z");

beforeEach(() => {
  mockAgentRunCount.mockReset();
  mockAgentRunAggregate.mockReset();
  mockWorkspaceFindUniqueOrThrow.mockReset();
  mockWorkspaceFindUniqueOrThrow.mockResolvedValue({ cycleResetAt });
  mockAgentRunCount.mockResolvedValue(0);
  mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 0 } });
});

describe("checkWorkerQuota — blockReason discriminator", () => {
  it("allowed=true + blockReason=null when no gate trips", async () => {
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    mockAgentRunCount.mockResolvedValue(10);
    const res = await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "REVIEW_ANALYST",
      leadId: "lead1",
    });
    expect(res.allowed).toBe(true);
    expect(res.blockReason).toBe(null);
    expect(res.workerMonthlyUsed).toBe(10);
    expect(res.perLeadDailyUsed).toBe(10);
    expect(res.perLeadDailyLimit).toBe(50);
  });

  it("WORKER_MONTHLY_QUOTA when monthly count >= limit", async () => {
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    // PRO REVIEW_ANALYST limit = 500. monthly call returns 500, perLead 0.
    mockAgentRunCount
      .mockResolvedValueOnce(500) // monthly
      .mockResolvedValueOnce(0); // perLead
    const res = await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "REVIEW_ANALYST",
      leadId: "lead1",
    });
    expect(res.allowed).toBe(false);
    expect(res.blockReason).toBe("WORKER_MONTHLY_QUOTA");
    expect(res.workerMonthlyUsed).toBe(500);
    expect(res.workerMonthlyLimit).toBe(500);
  });

  it("PER_LEAD_DAILY_CAP wins over WORKER_MONTHLY_QUOTA when both fire", async () => {
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    mockAgentRunCount
      .mockResolvedValueOnce(500) // monthly at limit too
      .mockResolvedValueOnce(50); // perLead at cap (PER_LEAD_DAILY_CAP=50)
    const res = await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "REVIEW_ANALYST",
      leadId: "lead1",
    });
    expect(res.blockReason).toBe("PER_LEAD_DAILY_CAP");
    expect(res.perLeadDailyUsed).toBe(50);
  });

  it("APIFY_USD_BUDGET when aggregate cost >= MONTHLY_APIFY_USD_CENTS", async () => {
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    mockAgentRunCount.mockResolvedValue(0); // both monthly and perLead
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 500 } });
    const res = await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "APIFY_GMAPS_DEEP",
      leadId: "lead1",
    });
    expect(res.allowed).toBe(false);
    expect(res.blockReason).toBe("APIFY_USD_BUDGET");
    expect(res.apifyCentsUsed).toBe(500);
    expect(res.apifyCentsLimit).toBe(500);
  });

  it("PLAN_TOO_LOW on FREE for an Apify kind (registry minPlan gates first)", async () => {
    // Apify workers declare minPlan=PRO in the registry, so the gate
    // catches FREE callers via the plan check before evaluating the
    // 0-limit fallback. Surfaces as `PLAN_TOO_LOW` so the UI shows the
    // upgrade CTA, not a generic "worker unavailable" message.
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    const res = await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "FREE",
      kind: "APIFY_GMAPS_DEEP",
    });
    expect(res.allowed).toBe(false);
    expect(res.blockReason).toBe("PLAN_TOO_LOW");
  });
});

describe("assertWorkerQuota — error class fan-out", () => {
  it("WORKER_MONTHLY_QUOTA → QuotaExceededError", async () => {
    const { assertWorkerQuota, QuotaExceededError } = await import(
      "@/lib/agent-workers/quota"
    );
    mockAgentRunCount.mockResolvedValue(500);
    let err: unknown = null;
    try {
      await assertWorkerQuota({
        workspaceId: "ws1",
        plan: "PRO",
        kind: "REVIEW_ANALYST",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect((err as InstanceType<typeof QuotaExceededError>).used).toBe(500);
    expect((err as InstanceType<typeof QuotaExceededError>).limit).toBe(500);
  });

  it("PER_LEAD_DAILY_CAP → PerLeadDailyCapExceededError", async () => {
    const { assertWorkerQuota, PerLeadDailyCapExceededError } = await import(
      "@/lib/agent-workers/quota"
    );
    mockAgentRunCount
      .mockResolvedValueOnce(0) // monthly
      .mockResolvedValueOnce(50); // perLead at cap
    let err: unknown = null;
    try {
      await assertWorkerQuota({
        workspaceId: "ws1",
        plan: "PRO",
        kind: "REVIEW_ANALYST",
        leadId: "lead-runaway",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PerLeadDailyCapExceededError);
    expect((err as InstanceType<typeof PerLeadDailyCapExceededError>).leadId).toBe(
      "lead-runaway",
    );
    expect((err as InstanceType<typeof PerLeadDailyCapExceededError>).used).toBe(
      50,
    );
  });

  it("APIFY_USD_BUDGET → ApifyBudgetExceededError", async () => {
    const { assertWorkerQuota, ApifyBudgetExceededError } = await import(
      "@/lib/agent-workers/quota"
    );
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 500 } });
    let err: unknown = null;
    try {
      await assertWorkerQuota({
        workspaceId: "ws1",
        plan: "PRO",
        kind: "APIFY_GMAPS_DEEP",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApifyBudgetExceededError);
    expect((err as InstanceType<typeof ApifyBudgetExceededError>).usedCents).toBe(
      500,
    );
    expect((err as InstanceType<typeof ApifyBudgetExceededError>).limitCents).toBe(
      500,
    );
  });

  it("WORKER_DISABLED on FREE Apify → PlanTooLowError", async () => {
    const { assertWorkerQuota, PlanTooLowError } = await import(
      "@/lib/agent-workers/quota"
    );
    let err: unknown = null;
    try {
      await assertWorkerQuota({
        workspaceId: "ws1",
        plan: "FREE",
        kind: "APIFY_GMAPS_DEEP",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PlanTooLowError);
  });
});

describe("PermanentError taxonomy — BullMQ retry classification", () => {
  it("all 4 quota errors are PermanentError subclasses (retryable=false)", async () => {
    const {
      QuotaExceededError,
      PerLeadDailyCapExceededError,
      ApifyBudgetExceededError,
      PlanTooLowError,
    } = await import("@/lib/agent-workers/quota");
    const { PermanentError, isRetryable } = await import(
      "@/lib/agent-workers/errors"
    );
    const a = new QuotaExceededError(1, 1, "REVIEW_ANALYST");
    const b = new PerLeadDailyCapExceededError("lead", 1, 1);
    const c = new ApifyBudgetExceededError(1, 1);
    const d = new PlanTooLowError("REVIEW_ANALYST", "PRO");
    for (const err of [a, b, c, d]) {
      expect(err).toBeInstanceOf(PermanentError);
      expect(isRetryable(err)).toBe(false);
      expect(err.retryable).toBe(false);
    }
  });
});

describe("per-lead cap — SUCCEEDED_NO_MEMORY inclusion (Round 2 §3.6)", () => {
  it("counts SUCCEEDED_NO_MEMORY in the per-lead status filter", async () => {
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");

    // Drive the implementation: first count = monthly, second = perLead.
    mockAgentRunCount
      .mockResolvedValueOnce(0) // monthly
      .mockResolvedValueOnce(50); // perLead at cap

    await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "REVIEW_ANALYST",
      leadId: "lead-degraded",
    });

    // Inspect the second `count()` call — that's the per-lead query.
    expect(mockAgentRunCount.mock.calls.length).toBe(2);
    const perLeadCall = mockAgentRunCount.mock.calls[1][0];
    const statusIn: string[] = perLeadCall.where.status.in;
    expect(statusIn).toContain("SUCCEEDED");
    expect(statusIn).toContain("SUCCEEDED_NO_MEMORY");
    expect(statusIn).toContain("PENDING");
    expect(statusIn).toContain("RUNNING");
  });
});
