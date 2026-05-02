/**
 * H8 regression - rapid POST /api/leads/[id]/workers/[kind] used to
 * spawn duplicate AgentRun rows because the route only auto-cancelled
 * stuck (>3 min) runs and never checked for a fresh PENDING/RUNNING
 * sibling. The fix returns 409 with the existing runId when one is
 * already in-flight so the UI's "Run again" is idempotent.
 */
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  return {
    requireUser: vi.fn().mockResolvedValue({
      user: { id: "u_h8", email: "h8@test.com" },
      workspaceId: "ws_h8",
      workspace: { id: "ws_h8", name: "T", slug: "t", plan: "PRO" },
      role: "OWNER",
    }),
    UnauthorizedError,
  };
});

vi.mock("@/lib/api-errors", () => ({
  internalError: (_label: string, err: unknown) =>
    NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    ),
}));

const mockLeadFindFirst = vi.fn();
const mockAgentRunFindFirst = vi.fn();
const mockAgentRunUpdateMany = vi.fn();
const mockAgentRunCreate = vi.fn();
const mockLeadFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: (...a: unknown[]) => mockLeadFindFirst(...a),
      findUnique: (...a: unknown[]) => mockLeadFindUnique(...a),
    },
    agentRun: {
      findFirst: (...a: unknown[]) => mockAgentRunFindFirst(...a),
      updateMany: (...a: unknown[]) => mockAgentRunUpdateMany(...a),
      create: (...a: unknown[]) => mockAgentRunCreate(...a),
    },
  },
}));

vi.mock("@/lib/agent-workers/quota", () => ({
  assertWorkerQuota: vi.fn().mockResolvedValue(undefined),
  PlanTooLowError: class extends Error { kind = "X"; minPlan = "PRO"; status = 402; },
  QuotaExceededError: class extends Error { used = 0; limit = 0; kind = "X"; status = 402; },
}));

vi.mock("@/lib/queues", () => ({
  getAgentRunsQueue: () => ({ add: vi.fn().mockResolvedValue({ id: "j1" }) }),
}));

vi.mock("@/lib/agent-workers/execute", () => ({
  executeAgentRun: vi.fn(),
}));

vi.mock("@/lib/agent-workers/registry", () => ({
  getWorker: () => ({
    kind: "WEBSITE_MOCKUP_GENERATOR",
    phase1Enabled: true,
    estimatedDurationMs: 1000,
  }),
}));

import { POST } from "@/app/api/leads/[id]/workers/[kind]/route";

function makeReq() {
  return new Request("http://localhost/api/leads/lead_h8/workers/website_mockup_generator", {
    method: "POST",
  });
}

const params = Promise.resolve({ id: "lead_h8", kind: "website_mockup_generator" });

describe("POST /api/leads/[id]/workers/[kind] - H8 idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeadFindFirst.mockResolvedValue({ id: "lead_h8" });
    mockLeadFindUnique.mockResolvedValue({ subNicheVersion: 0 });
    mockAgentRunUpdateMany.mockResolvedValue({ count: 0 });
    mockAgentRunCreate.mockResolvedValue({
      id: "run_new",
      createdAt: new Date(),
      workerKind: "WEBSITE_MOCKUP_GENERATOR",
      status: "PENDING",
    });
  });

  it("returns 409 with the existing runId when a PENDING run already exists", async () => {
    mockAgentRunFindFirst.mockResolvedValueOnce({
      id: "run_existing",
      status: "PENDING",
      createdAt: new Date(),
    });

    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(409);
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe("duplicate_inflight_run");
    expect(body.runId).toBe("run_existing");
    expect(body.status).toBe("PENDING");
  });

  it("returns 409 with the existing runId when a RUNNING run already exists", async () => {
    mockAgentRunFindFirst.mockResolvedValueOnce({
      id: "run_active",
      status: "RUNNING",
      createdAt: new Date(),
    });

    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(409);
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.runId).toBe("run_active");
  });

  it("creates a new run when no in-flight run exists", async () => {
    mockAgentRunFindFirst.mockResolvedValueOnce(null);

    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(mockAgentRunCreate).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.runId).toBe("run_new");
  });

  it("rapid-fire 5 POSTs with an in-flight run produce 5x 409 + 0 new rows", async () => {
    mockAgentRunFindFirst.mockResolvedValue({
      id: "run_existing",
      status: "PENDING",
      createdAt: new Date(),
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => POST(makeReq(), { params })),
    );
    for (const res of responses) {
      expect(res.status).toBe(409);
    }
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
  });
});
