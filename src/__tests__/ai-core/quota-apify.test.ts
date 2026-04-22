/**
 * Unit tests for quota gating of Apify-backed workers.
 *
 * Focus: monthly USD ceiling (ApifyBudgetExceededError) vs per-kind
 * count cap (QuotaExceededError), cycle reset propagation, and
 * non-Apify kinds bypassing the USD sum query.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAgentRunCount = vi.fn();
const mockAgentRunAggregate = vi.fn();
const mockWorkspaceFindUniqueOrThrow = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: {
      count: (...args: unknown[]) => mockAgentRunCount(...args),
      aggregate: (...args: unknown[]) => mockAgentRunAggregate(...args),
    },
    workspace: {
      findUniqueOrThrow: (...args: unknown[]) =>
        mockWorkspaceFindUniqueOrThrow(...args),
    },
  },
}));

const APIFY_KINDS = [
  "APIFY_GMAPS_DEEP",
  "APIFY_WEB_CRAWL_DEEP",
  "APIFY_INSTAGRAM_DEEP",
  "APIFY_FACEBOOK_DEEP",
  "APIFY_TIKTOK_DEEP",
  "APIFY_SERP_RANK",
  "APIFY_COMPETITOR_ADS",
  "APIFY_LINKEDIN_COMPANY",
  "APIFY_REDDIT_MENTIONS",
] as const;

const cycleResetAt = new Date("2026-04-01T00:00:00.000Z");

beforeEach(() => {
  mockAgentRunCount.mockReset();
  mockAgentRunAggregate.mockReset();
  mockWorkspaceFindUniqueOrThrow.mockReset();
  mockWorkspaceFindUniqueOrThrow.mockResolvedValue({ cycleResetAt });
  mockAgentRunCount.mockResolvedValue(0);
  mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 0 } });
});

describe("quota - Apify FREE plan", () => {
  it("every APIFY_* kind reports allowed=false on FREE", async () => {
    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    for (const kind of APIFY_KINDS) {
      const res = await checkWorkerQuota({
        workspaceId: "ws1",
        plan: "FREE",
        kind,
      });
      expect(res.allowed, `${kind} should be blocked on FREE`).toBe(false);
    }
  });
});

describe("quota - Apify PRO USD ceiling", () => {
  it("allows when aggregate cost is below the 500c ceiling", async () => {
    mockAgentRunCount.mockResolvedValue(0);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 499 } });

    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    const res = await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "APIFY_GMAPS_DEEP",
    });
    expect(res.allowed).toBe(true);
    expect(res.apifyCentsUsed).toBe(499);
    expect(res.apifyCentsLimit).toBe(500);
  });

  it("throws ApifyBudgetExceededError (not QuotaExceededError) at 500c on PRO", async () => {
    mockAgentRunCount.mockResolvedValue(0);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 500 } });

    const { assertWorkerQuota, ApifyBudgetExceededError, QuotaExceededError } =
      await import("@/lib/agent-workers/quota");
    let thrown: unknown = null;
    try {
      await assertWorkerQuota({
        workspaceId: "ws1",
        plan: "PRO",
        kind: "APIFY_GMAPS_DEEP",
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ApifyBudgetExceededError);
    expect(thrown).not.toBeInstanceOf(QuotaExceededError);
  });

  it("aggregates cost across ALL Apify kinds in the cycle", async () => {
    mockAgentRunCount.mockResolvedValue(0);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 100 } });

    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "APIFY_GMAPS_DEEP",
    });

    expect(mockAgentRunAggregate).toHaveBeenCalledTimes(1);
    const call = mockAgentRunAggregate.mock.calls[0][0];
    expect(call.where.workerKind).toEqual({ in: expect.any(Array) });
    const inArr: string[] = call.where.workerKind.in;
    expect(inArr.slice().sort()).toEqual([...APIFY_KINDS].sort());
    expect(call._sum).toEqual({ costUsdCents: true });
  });
});

describe("quota - Apify count cap still fires when USD is under ceiling", () => {
  it("throws QuotaExceededError when per-kind count hits the limit", async () => {
    // PRO APIFY_GMAPS_DEEP monthly count limit = 50 (LAUNCH_LIMITS).
    mockAgentRunCount.mockResolvedValue(50);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costUsdCents: 100 } });

    const { assertWorkerQuota, QuotaExceededError, ApifyBudgetExceededError } =
      await import("@/lib/agent-workers/quota");
    let thrown: unknown = null;
    try {
      await assertWorkerQuota({
        workspaceId: "ws1",
        plan: "PRO",
        kind: "APIFY_GMAPS_DEEP",
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(QuotaExceededError);
    expect(thrown).not.toBeInstanceOf(ApifyBudgetExceededError);
  });
});

describe("quota - cycle reset propagation", () => {
  it("passes workspace.cycleResetAt into the count query", async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    mockWorkspaceFindUniqueOrThrow.mockResolvedValue({ cycleResetAt: tomorrow });
    mockAgentRunCount.mockResolvedValue(0);

    const { checkWorkerQuota } = await import("@/lib/agent-workers/quota");
    await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "APIFY_GMAPS_DEEP",
    });

    const countCall = mockAgentRunCount.mock.calls[0][0];
    expect(countCall.where.createdAt).toEqual({ gte: tomorrow });
  });
});

describe("quota - non-Apify kinds skip the Apify aggregate query", () => {
  it("does not call agentRun.aggregate for WEBSITE_AUDITOR", async () => {
    mockAgentRunCount.mockResolvedValue(0);

    const { checkWorkerQuota, isApifyKind } = await import(
      "@/lib/agent-workers/quota"
    );
    expect(isApifyKind("WEBSITE_AUDITOR")).toBe(false);

    await checkWorkerQuota({
      workspaceId: "ws1",
      plan: "PRO",
      kind: "WEBSITE_AUDITOR",
    });
    expect(mockAgentRunAggregate).not.toHaveBeenCalled();
  });
});
