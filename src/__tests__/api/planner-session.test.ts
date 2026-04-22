import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  class NotFoundError extends Error {
    status = 404;
  }
  const requireUser = vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "t@t.com", fullName: null, avatarUrl: null },
    workspaceId: "ws_test",
    workspace: { id: "ws_test", name: "Test", slug: "test", plan: "PRO" },
    role: "OWNER",
  });
  const withAuth =
    (handler: (session: unknown, ...args: unknown[]) => Promise<Response>) =>
    async (...args: unknown[]): Promise<Response> => {
      try {
        const session = await requireUser();
        return await handler(session, ...args);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (err instanceof NotFoundError) {
          return NextResponse.json({ error: err.message }, { status: 404 });
        }
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
    };
  return { requireUser, UnauthorizedError, NotFoundError, withAuth };
});

const mockSessionFindUnique = vi.fn();
const mockAgentRunFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plannerSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
    },
    agentRun: {
      findMany: (...args: unknown[]) => mockAgentRunFindMany(...args),
    },
  },
}));

import { GET } from "@/app/api/planner/[id]/route";
import { requireUser, UnauthorizedError } from "@/lib/auth";

function makeRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/planner/${id}`);
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/planner/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentRunFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(makeRequest("sess_1"), makeCtx("sess_1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the session does not exist", async () => {
    mockSessionFindUnique.mockResolvedValueOnce(null);
    const res = await GET(makeRequest("sess_missing"), makeCtx("sess_missing"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 for a session in another workspace without leaking existence", async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: "sess_other",
      workspaceId: "OTHER_WS",
      leadId: null,
      goal: "x",
      status: "RUNNING",
      plan: {},
      triggeredBy: "user_one_click_pitch",
      errorMsg: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await GET(makeRequest("sess_other"), makeCtx("sess_other"));
    expect(res.status).toBe(404);
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("sess_other");
    expect(serialized).not.toContain("OTHER_WS");
    expect(body).not.toHaveProperty("session");
  });

  it("returns 200 with { session, runs } for an owned session", async () => {
    const session = {
      id: "sess_ok",
      workspaceId: "ws_test",
      leadId: "lead_1",
      goal: "one-click pitch",
      status: "COMPLETED",
      plan: { steps: [] },
      triggeredBy: "user_one_click_pitch",
      errorMsg: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
    };
    const runs = [
      {
        id: "run_1",
        workerKind: "WEBSITE_MOCKUP",
        status: "SUCCEEDED",
        artifactUrl: null,
        errorMsg: null,
        startedAt: new Date(),
        finishedAt: new Date(),
        costTokens: 1234,
        costUsdCents: 5,
      },
    ];
    mockSessionFindUnique.mockResolvedValueOnce(session);
    mockAgentRunFindMany.mockResolvedValueOnce(runs);

    const res = await GET(makeRequest("sess_ok"), makeCtx("sess_ok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe("sess_ok");
    expect(body.session.status).toBe("COMPLETED");
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].id).toBe("run_1");

    expect(mockAgentRunFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plannerSessionId: "sess_ok" },
      }),
    );
  });
});
