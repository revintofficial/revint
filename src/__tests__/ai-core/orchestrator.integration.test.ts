/**
 * Integration tests for `orchestrator.advance`.
 *
 * A fresh PlannerSession is constructed for each test. We mock the
 * BullMQ queue + Gemini so we do not need Redis or the network; every
 * other interaction (Prisma reads/writes, sentinel dispatch) is real.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { makeFakeGemini } from "../_helpers/mock-gemini";

const queueAdd = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/queues", () => ({
  getAgentRunsQueue: () => ({ add: queueAdd }),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return makeFakeGemini({ responses: [] }).getGenerativeModel();
    }
  },
}));

import { prisma } from "@/lib/prisma";
import { advance } from "@/lib/ai-core/orchestrator";
import { SENTINEL_STEPS } from "@/lib/ai-core/chains";
import type { PersistedPlan } from "@/lib/ai-core/planner";
import {
  makeWorkspaceWithOwner,
  makeLead,
  cleanupWorkspace,
  cleanupUser,
} from "../_helpers/factories";

const createdWorkspaceIds = new Set<string>();
const createdUserIds = new Set<string>();

beforeAll(() => {
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(async () => {
  queueAdd.mockClear();
  for (const id of createdWorkspaceIds) await cleanupWorkspace(id);
  createdWorkspaceIds.clear();
  for (const id of createdUserIds) await cleanupUser(id);
  createdUserIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seed() {
  const { workspace, user } = await makeWorkspaceWithOwner();
  createdWorkspaceIds.add(workspace.id);
  createdUserIds.add(user.id);
  return { workspace, user };
}

async function makeSession(args: {
  workspaceId: string;
  leadId?: string | null;
  plan: PersistedPlan;
}) {
  return prisma.plannerSession.create({
    data: {
      workspaceId: args.workspaceId,
      leadId: args.leadId ?? null,
      goal: "test",
      plan: args.plan as never,
      status: "PLANNING",
      triggeredBy: "EVENT",
    },
  });
}

describe("orchestrator.advance - fresh session", () => {
  it("schedules every zero-dep PENDING step in one call", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      { stepId: "a", workerKind: "WEBSITE_AUDITOR", dependsOn: [], status: "PENDING" },
      { stepId: "b", workerKind: "REVIEW_ANALYST", dependsOn: [], status: "PENDING" },
      { stepId: "c", workerKind: "SOCIAL_SCRAPER", dependsOn: [], status: "PENDING" },
    ];
    const session = await makeSession({ workspaceId: workspace.id, plan });

    const res = await advance(session.id);
    expect(res.scheduled.sort()).toEqual(["a", "b", "c"]);
    const runs = await prisma.agentRun.count({
      where: { plannerSessionId: session.id },
    });
    expect(runs).toBe(3);
    const statuses = await prisma.agentRun.findMany({
      where: { plannerSessionId: session.id },
      select: { status: true },
    });
    expect(statuses.every((r) => r.status === "PENDING" || r.status === "RUNNING")).toBe(true);
  });
});

describe("orchestrator.advance - sequential gating", () => {
  it("schedules dependent step only after upstream SUCCEEDED", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      { stepId: "a", workerKind: "WEBSITE_AUDITOR", dependsOn: [], status: "PENDING" },
      { stepId: "b", workerKind: "SALES_OPPORTUNITY_SCORER", dependsOn: ["a"], status: "PENDING" },
    ];
    const session = await makeSession({ workspaceId: workspace.id, plan });

    await advance(session.id);
    const aRun = await prisma.agentRun.findFirst({
      where: { plannerSessionId: session.id, workerKind: "WEBSITE_AUDITOR" },
    });
    expect(aRun).toBeTruthy();

    await prisma.agentRun.update({
      where: { id: aRun!.id },
      data: { status: "SUCCEEDED" },
    });

    const res = await advance(session.id);
    expect(res.scheduled).toContain("b");
  });
});

describe("orchestrator.advance - optional failure", () => {
  it("marks optional failed step SKIPPED and continues downstream", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      { stepId: "opt", workerKind: "SOCIAL_SCRAPER", dependsOn: [], status: "PENDING", optional: true },
      { stepId: "down", workerKind: "SALES_OPPORTUNITY_SCORER", dependsOn: ["opt"], status: "PENDING" },
    ];
    const session = await makeSession({ workspaceId: workspace.id, plan });

    await advance(session.id);
    const run = await prisma.agentRun.findFirst({
      where: { plannerSessionId: session.id, workerKind: "SOCIAL_SCRAPER" },
    });
    await prisma.agentRun.update({
      where: { id: run!.id },
      data: { status: "FAILED" },
    });

    const res = await advance(session.id);
    expect(res.scheduled).toContain("down");
    const after = await prisma.plannerSession.findUnique({ where: { id: session.id } });
    const persisted = after!.plan as unknown as PersistedPlan;
    const optStep = persisted.find((s) => s.stepId === "opt");
    expect(optStep!.status).toBe("SKIPPED");
  });
});

describe("orchestrator.advance - hard failure", () => {
  it("marks session FAILED when a non-optional step fails", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      { stepId: "hard", workerKind: "WEBSITE_AUDITOR", dependsOn: [], status: "PENDING" },
    ];
    const session = await makeSession({ workspaceId: workspace.id, plan });

    await advance(session.id);
    const run = await prisma.agentRun.findFirst({
      where: { plannerSessionId: session.id },
    });
    await prisma.agentRun.update({
      where: { id: run!.id },
      data: { status: "FAILED" },
    });

    queueAdd.mockClear();
    const res = await advance(session.id);
    expect(res.status).toBe("FAILED");
    expect(res.scheduled).toHaveLength(0);
  });
});

describe("orchestrator.advance - completion", () => {
  it("marks COMPLETED when every step is SUCCEEDED", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      { stepId: "a", workerKind: "WEBSITE_AUDITOR", dependsOn: [], status: "PENDING" },
    ];
    const session = await makeSession({ workspaceId: workspace.id, plan });

    await advance(session.id);
    const run = await prisma.agentRun.findFirst({
      where: { plannerSessionId: session.id },
    });
    await prisma.agentRun.update({
      where: { id: run!.id },
      data: { status: "SUCCEEDED" },
    });

    const res = await advance(session.id);
    expect(res.status).toBe("COMPLETED");
  });
});

describe("orchestrator.advance - concurrent invocations", () => {
  // The current advance() is not transactional. Two parallel calls
  // against a fresh session can both enqueue the same step. This
  // documents the race bug; flip to `it` once advance() is moved
  // inside a serializable transaction or uses `SELECT ... FOR UPDATE`.
  it.todo(
    "race test: Promise.all([advance, advance]) on one zero-dep step " +
      "creates exactly one AgentRun - TODO: advance() is not yet transactional",
  );
});

describe("orchestrator.advance - sentinels", () => {
  it("EMBED_LEAD_PROFILE writes LEAD_PROFILE memory and creates no AgentRun for that step", async () => {
    const { workspace } = await seed();
    const lead = await makeLead(workspace.id);
    const plan: PersistedPlan = [
      {
        stepId: "embed_profile",
        workerKind: "SALES_OPPORTUNITY_SCORER",
        dependsOn: [],
        status: "PENDING",
        inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
      },
    ];
    const session = await makeSession({
      workspaceId: workspace.id,
      leadId: lead.id,
      plan,
    });

    await advance(session.id);
    const runCount = await prisma.agentRun.count({
      where: { plannerSessionId: session.id },
    });
    expect(runCount).toBe(0);
    const mem = await prisma.semanticMemory.count({
      where: {
        workspaceId: workspace.id,
        kind: "LEAD_PROFILE",
        leadId: lead.id,
      },
    });
    expect(mem).toBeGreaterThanOrEqual(1);
  });

  it("WRITE_OPENER_OUTCOME writes OPENER_SUCCESS for WON, OPENER_FAILURE for LOST, nothing for NEW", async () => {
    const { workspace } = await seed();
    const won = await makeLead(workspace.id);
    const lost = await makeLead(workspace.id);
    const neutral = await makeLead(workspace.id);
    const openerText = "Merhaba, kisa bir one-click pitch.";
    await prisma.salesOpportunity.create({
      data: {
        leadId: won.id,
        opportunityScore: 80,
        status: "WON",
        personalizedFirstMessage: openerText,
      },
    });
    await prisma.salesOpportunity.create({
      data: {
        leadId: lost.id,
        opportunityScore: 50,
        status: "LOST",
        personalizedFirstMessage: openerText,
      },
    });
    await prisma.salesOpportunity.create({
      data: {
        leadId: neutral.id,
        opportunityScore: 50,
        status: "NEW",
        personalizedFirstMessage: openerText,
      },
    });

    for (const lead of [won, lost, neutral]) {
      const plan: PersistedPlan = [
        {
          stepId: "wo",
          workerKind: "INBOX_REPLY_ATTRIBUTOR",
          dependsOn: [],
          status: "PENDING",
          inputs: { __sentinel: SENTINEL_STEPS.WRITE_OPENER_OUTCOME },
        },
      ];
      const session = await makeSession({
        workspaceId: workspace.id,
        leadId: lead.id,
        plan,
      });
      await advance(session.id);
    }

    const success = await prisma.semanticMemory.count({
      where: { workspaceId: workspace.id, kind: "OPENER_SUCCESS", leadId: won.id },
    });
    expect(success).toBe(1);
    const failure = await prisma.semanticMemory.count({
      where: { workspaceId: workspace.id, kind: "OPENER_FAILURE", leadId: lost.id },
    });
    expect(failure).toBe(1);
    const neutralCount = await prisma.semanticMemory.count({
      where: {
        workspaceId: workspace.id,
        kind: { in: ["OPENER_SUCCESS", "OPENER_FAILURE"] },
        leadId: neutral.id,
      },
    });
    expect(neutralCount).toBe(0);
  });

  it("sentinel with null leadId is marked SKIPPED when optional", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      {
        stepId: "embed_profile",
        workerKind: "SALES_OPPORTUNITY_SCORER",
        dependsOn: [],
        status: "PENDING",
        optional: true,
        inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
      },
    ];
    const session = await makeSession({
      workspaceId: workspace.id,
      leadId: null,
      plan,
    });
    await advance(session.id);
    const after = await prisma.plannerSession.findUnique({ where: { id: session.id } });
    const persisted = after!.plan as unknown as PersistedPlan;
    expect(persisted[0].status).toBe("SKIPPED");
  });

  it("sentinel with null leadId is FAILED when not optional", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      {
        stepId: "embed_profile",
        workerKind: "SALES_OPPORTUNITY_SCORER",
        dependsOn: [],
        status: "PENDING",
        inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
      },
    ];
    const session = await makeSession({
      workspaceId: workspace.id,
      leadId: null,
      plan,
    });
    const res = await advance(session.id);
    expect(res.status).toBe("FAILED");
  });
});

describe("orchestrator.advance - CANCELLED short-circuit", () => {
  it("returns without scheduling when session is CANCELLED", async () => {
    const { workspace } = await seed();
    const plan: PersistedPlan = [
      { stepId: "a", workerKind: "WEBSITE_AUDITOR", dependsOn: [], status: "PENDING" },
    ];
    const session = await makeSession({ workspaceId: workspace.id, plan });
    await prisma.plannerSession.update({
      where: { id: session.id },
      data: { status: "CANCELLED" },
    });

    queueAdd.mockClear();
    const res = await advance(session.id);
    expect(res.status).toBe("CANCELLED");
    expect(res.scheduled).toHaveLength(0);
    const runCount = await prisma.agentRun.count({
      where: { plannerSessionId: session.id },
    });
    expect(runCount).toBe(0);
  });
});
