/**
 * OUTCOME_ATTRIBUTOR worker unit tests.
 *
 * Validates the deterministic event → outcome mapping + the side-effects:
 *   - Updates the active LeadNextAction and InsightApplication rows.
 *   - Bumps InsightPerformance counters keyed correctly.
 *   - Adjusts LeadTrigger.confidence on positive vs. negative outcomes.
 *   - Emits `outcome_attributed` for every successful attribution.
 *   - Skips with `skipped: true` when an event has no mappable outcome
 *     (e.g. neutral inbox reply, FOLLOWUP stage change).
 *
 * No real Prisma — all DB accessors are vi.hoisted mocks so the tests
 * stay deterministic + fast.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    leadNextAction: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    insightApplication: {
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    insightPerformance: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    account: {
      findUnique: vi.fn(),
    },
    leadTrigger: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { run } from "@/lib/agent-workers/outcome-attributor";

function makeCtx(
  overrides: Partial<AgentWorkerContext> = {},
  inputs: Record<string, unknown> = {},
): AgentWorkerContext {
  const lead = {
    id: "lead-1",
    accountId: null,
    nicheSlug: "fnb",
    subNicheSlug: "fnb-bar-club",
  } as unknown as AgentWorkerContext["lead"];
  return {
    runId: "run-1",
    workspaceId: "ws-1",
    workspacePlan: "PRO" as never,
    leadId: "lead-1",
    userId: "user-1",
    lead,
    workspace: {} as never,
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    runInputs: inputs,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.leadNextAction.findFirst.mockReset();
  prismaMock.leadNextAction.update.mockReset().mockResolvedValue({});
  prismaMock.insightApplication.findMany.mockReset();
  prismaMock.insightApplication.updateMany.mockReset().mockResolvedValue({ count: 0 });
  prismaMock.insightPerformance.upsert.mockReset().mockResolvedValue({});
  prismaMock.account.findUnique.mockReset();
  prismaMock.leadTrigger.findUnique.mockReset();
  prismaMock.leadTrigger.updateMany.mockReset().mockResolvedValue({ count: 0 });
});

describe("OUTCOME_ATTRIBUTOR — event → outcome mapping", () => {
  it("skips when inbox_reply_received sentiment is NEUTRAL (no mapping)", async () => {
    const ctx = makeCtx({}, { event: "inbox_reply_received", sentiment: "NEUTRAL" });
    const out = await run(ctx);
    expect(out.output).toMatchObject({ skipped: true, reason: "no_mappable_outcome" });
    expect(prismaMock.leadNextAction.findFirst).not.toHaveBeenCalled();
    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it("skips when watchlist_stage_changed is FOLLOWUP (not WON/LOST)", async () => {
    const ctx = makeCtx({}, { event: "watchlist_stage_changed", newStage: "FOLLOWUP" });
    const out = await run(ctx);
    expect(out.output).toMatchObject({ skipped: true });
    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it("maps disposition BOOKED_MEETING → MEETING_BOOKED", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue(null);
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "disposition_logged", disposition: "BOOKED_MEETING" });
    const out = await run(ctx);
    expect(out.output).toMatchObject({ outcome: "MEETING_BOOKED" });
    expect(ctx.emit).toHaveBeenCalledWith(
      "outcome_attributed",
      expect.objectContaining({ outcome: "MEETING_BOOKED", sourceEvent: "disposition_logged" }),
    );
  });

  it("maps disposition ANSWERED_NOT_INTERESTED → REJECTED", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue(null);
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx(
      {},
      { event: "disposition_logged", disposition: "ANSWERED_NOT_INTERESTED" },
    );
    const out = await run(ctx);
    expect(out.output).toMatchObject({ outcome: "REJECTED" });
  });
});

describe("OUTCOME_ATTRIBUTOR — side effects on persistence", () => {
  it("stamps the active LeadNextAction with outcome + outcomeAt", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue({
      id: "nba-1",
      triggerIds: [],
    });
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "inbox_reply_received", sentiment: "POSITIVE" });
    await run(ctx);
    expect(prismaMock.leadNextAction.update).toHaveBeenCalledWith({
      where: { id: "nba-1" },
      data: expect.objectContaining({
        outcome: "REPLY_POSITIVE",
        outcomeAt: expect.any(Date),
      }),
    });
  });

  it("stamps every active InsightApplication with outcome + attributedBy=runId", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue({ id: "nba-1", triggerIds: [] });
    prismaMock.insightApplication.findMany.mockResolvedValue([
      { id: "app-1", insightId: "ins-1", framework: "CHALLENGER" },
      { id: "app-2", insightId: "ins-2", framework: "MEDDPICC" },
    ]);
    const ctx = makeCtx({}, { event: "inbox_reply_received", sentiment: "POSITIVE" });
    await run(ctx);
    expect(prismaMock.insightApplication.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["app-1", "app-2"] } },
      data: expect.objectContaining({
        outcome: "REPLY_POSITIVE",
        attributedBy: "run-1",
      }),
    });
  });

  it("upserts InsightPerformance keyed by insight + niche + trigger + framework + tier", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue({
      id: "nba-1",
      triggerIds: ["trg-1"],
    });
    prismaMock.leadTrigger.findUnique.mockResolvedValue({ type: "BAD_SERVICE_REVIEWS" });
    prismaMock.insightApplication.findMany.mockResolvedValue([
      { id: "app-1", insightId: "ins-1", framework: "CHALLENGER" },
    ]);
    const ctx = makeCtx({}, { event: "disposition_logged", disposition: "BOOKED_MEETING" });
    await run(ctx);
    expect(prismaMock.insightPerformance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_insightId_nicheSlug_triggerType_framework_segmentTier: {
            workspaceId: "ws-1",
            insightId: "ins-1",
            nicheSlug: "fnb-bar-club",
            triggerType: "BAD_SERVICE_REVIEWS",
            framework: "CHALLENGER",
            segmentTier: null,
          },
        },
        create: expect.objectContaining({
          applied: 1,
          meetingBooked: { increment: 1 },
        }),
        update: expect.objectContaining({
          applied: { increment: 1 },
          meetingBooked: { increment: 1 },
        }),
      }),
    );
  });

  it("emits outcome_attributed payload referencing the source event", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue(null);
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "watchlist_stage_changed", newStage: "WON" });
    await run(ctx);
    expect(ctx.emit).toHaveBeenCalledWith(
      "outcome_attributed",
      expect.objectContaining({
        workspaceId: "ws-1",
        leadId: "lead-1",
        outcome: "WON",
        sourceEvent: "watchlist_stage_changed",
      }),
    );
  });
});

describe("OUTCOME_ATTRIBUTOR — trigger confidence learning loop", () => {
  it("nudges LeadTrigger.confidence UP on REPLY_POSITIVE/MEETING_BOOKED/WON", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue({
      id: "nba-1",
      triggerIds: ["trg-1", "trg-2"],
    });
    prismaMock.leadTrigger.findUnique.mockResolvedValue({ type: "BAD_SERVICE_REVIEWS" });
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "disposition_logged", disposition: "BOOKED_MEETING" });
    await run(ctx);
    expect(prismaMock.leadTrigger.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["trg-1", "trg-2"] } },
      data: {
        validatedCount: { increment: 1 },
        confidence: { increment: 0.05 },
      },
    });
  });

  it("nudges LeadTrigger.confidence DOWN on REPLY_NEGATIVE/REJECTED/LOST", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue({
      id: "nba-1",
      triggerIds: ["trg-1"],
    });
    prismaMock.leadTrigger.findUnique.mockResolvedValue({ type: "BAD_SERVICE_REVIEWS" });
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "watchlist_stage_changed", newStage: "LOST" });
    await run(ctx);
    expect(prismaMock.leadTrigger.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["trg-1"] } },
      data: {
        falsePositiveCount: { increment: 1 },
        confidence: { decrement: 0.05 },
      },
    });
  });

  it("does NOT touch LeadTrigger when the active NBA cited zero triggers", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue({
      id: "nba-1",
      triggerIds: [],
    });
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "watchlist_stage_changed", newStage: "WON" });
    await run(ctx);
    expect(prismaMock.leadTrigger.updateMany).not.toHaveBeenCalled();
  });
});

describe("OUTCOME_ATTRIBUTOR — graceful degradation", () => {
  it("returns success when no active NBA exists (still emits + tries insights)", async () => {
    prismaMock.leadNextAction.findFirst.mockResolvedValue(null);
    prismaMock.insightApplication.findMany.mockResolvedValue([]);
    const ctx = makeCtx({}, { event: "inbox_reply_received", sentiment: "POSITIVE" });
    const out = await run(ctx);
    expect(out.output).toMatchObject({
      outcome: "REPLY_POSITIVE",
      nbaUpdated: false,
      applicationsUpdated: 0,
    });
    expect(prismaMock.leadNextAction.update).not.toHaveBeenCalled();
    expect(ctx.emit).toHaveBeenCalled();
  });

  it("throws when called without a lead (workers without context are misconfigured)", async () => {
    const ctx = makeCtx({ lead: null, leadId: null }, {
      event: "inbox_reply_received",
      sentiment: "POSITIVE",
    });
    await expect(run(ctx)).rejects.toThrow(/requires a lead/i);
  });
});
