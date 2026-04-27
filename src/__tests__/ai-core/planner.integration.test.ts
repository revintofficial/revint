/**
 * Integration tests for `planFromEvent`.
 *
 * Each invocation should persist a PlannerSession row with the
 * expected step set, dependsOn chains, trigger enum, and starting
 * status. BullMQ + Gemini are mocked so no Redis or network is
 * required.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { makeFakeGemini } from "../_helpers/mock-gemini";

vi.mock("@/lib/queues", () => ({
  getAgentRunsQueue: () => ({ add: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return makeFakeGemini({ responses: [] }).getGenerativeModel();
    }
  },
}));

import { prisma } from "@/lib/prisma";
import { planFromEvent } from "@/lib/ai-core/planner";
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
  const lead = await makeLead(workspace.id);
  return { workspace, user, lead };
}

async function getSession(id: string) {
  const s = await prisma.plannerSession.findUnique({ where: { id } });
  expect(s).toBeTruthy();
  const plan = s!.plan as unknown as PersistedPlan;
  return { session: s!, plan };
}

describe("planFromEvent - lead_created", () => {
  it("creates a 6-step chain with correct dependsOn", async () => {
    const { workspace, lead } = await seed();
    const result = await planFromEvent("lead_created", {
      workspaceId: workspace.id,
      leadId: lead.id,
    });
    const { session, plan } = await getSession(result!.id);

    const ids = plan.map((s) => s.stepId).sort();
    expect(ids).toEqual(
      ["audit", "social", "review", "email_verify", "score", "embed_profile"].sort(),
    );
    expect(plan.find((s) => s.stepId === "email_verify")!.dependsOn).toEqual(["audit"]);
    expect(plan.find((s) => s.stepId === "score")!.dependsOn.sort()).toEqual(
      ["audit", "review"].sort(),
    );
    expect(plan.find((s) => s.stepId === "embed_profile")!.dependsOn).toEqual(["score"]);
    expect(session.triggeredBy).toBe("EVENT");
    expect(session.status).toBe("PLANNING");
  });
});

describe("planFromEvent - user_one_click_pitch", () => {
  it("creates a mockup + opener + video plan", async () => {
    const { workspace, user, lead } = await seed();
    const result = await planFromEvent("user_one_click_pitch", {
      workspaceId: workspace.id,
      userId: user.id,
      leadId: lead.id,
    });
    const { session, plan } = await getSession(result!.id);
    const ids = plan.map((s) => s.stepId).sort();
    expect(ids).toEqual(["mockup", "opener", "video"].sort());
    expect(session.triggeredBy).toBe("USER_BUTTON");
    expect(session.status).toBe("PLANNING");
  });
});

describe("planFromEvent - user_deep_research", () => {
  it("creates the 9-step Apify fan-out with review/score refresh + embed + competitor ads", async () => {
    const { workspace, user, lead } = await seed();
    const result = await planFromEvent("user_deep_research", {
      workspaceId: workspace.id,
      userId: user.id,
      leadId: lead.id,
    });
    const { session, plan } = await getSession(result!.id);
    expect(plan).toHaveLength(9);
    const ids = plan.map((s) => s.stepId).sort();
    expect(ids).toEqual(
      [
        "gmaps",
        "webcrawl",
        "instagram",
        "facebook",
        "serp",
        "competitor_ads",
        "review_refresh",
        "score_refresh",
        "embed_profile",
      ].sort(),
    );
    expect(session.triggeredBy).toBe("USER_DEEP_RESEARCH");
    expect(session.status).toBe("PLANNING");
  });
});

describe("planFromEvent - user_receptionist_with_kb", () => {
  it("creates a 2-step plan: webcrawl -> receptionist", async () => {
    const { workspace, user, lead } = await seed();
    const result = await planFromEvent("user_receptionist_with_kb", {
      workspaceId: workspace.id,
      userId: user.id,
      leadId: lead.id,
    });
    const { session, plan } = await getSession(result!.id);
    expect(plan).toHaveLength(2);
    const receptionist = plan.find((s) => s.stepId === "receptionist");
    expect(receptionist!.dependsOn).toEqual(["webcrawl"]);
    expect(session.triggeredBy).toBe("USER_BUTTON");
    expect(session.status).toBe("PLANNING");
  });
});
