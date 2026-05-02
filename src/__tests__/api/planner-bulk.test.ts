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

const mockEmit = vi.fn();
vi.mock("@/lib/ai-core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

const mockLeadFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
    },
  },
}));

const mockAssertWorkerQuota = vi.fn();
vi.mock("@/lib/agent-workers/quota", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent-workers/quota")>(
    "@/lib/agent-workers/quota",
  );
  return {
    ...actual,
    assertWorkerQuota: (...args: unknown[]) => mockAssertWorkerQuota(...args),
  };
});

import { POST } from "@/app/api/planner/bulk/route";
import { requireUser, UnauthorizedError } from "@/lib/auth";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/planner/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/planner/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockImplementation(async () => `sess_${Math.random().toString(36).slice(2, 8)}`);
    mockLeadFindMany.mockResolvedValue([]);
    mockAssertWorkerQuota.mockResolvedValue({
      allowed: true,
      used: 0,
      limit: 100,
      remaining: 100,
      resetAt: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());
    const res = await POST(makeRequest({ event: "user_one_click_pitch", leadIds: ["l1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when event is not in the bulk allowlist", async () => {
    const res = await POST(makeRequest({ event: "lead_created", leadIds: ["l1"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("returns 400 when leadIds is missing", async () => {
    const res = await POST(makeRequest({ event: "user_one_click_pitch" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-empty array/i);
  });

  it("returns 400 when leadIds is an empty array", async () => {
    const res = await POST(makeRequest({ event: "user_one_click_pitch", leadIds: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when more than 50 leads are requested", async () => {
    const leadIds = Array.from({ length: 51 }, (_, i) => `lead_${i}`);
    const res = await POST(makeRequest({ event: "user_one_click_pitch", leadIds }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/max 50/i);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("flags leads not in the workspace while still processing owned ones", async () => {
    mockLeadFindMany.mockResolvedValueOnce([{ id: "lead_1" }, { id: "lead_2" }]);
    mockEmit
      .mockResolvedValueOnce("sess_a")
      .mockResolvedValueOnce("sess_b");

    const res = await POST(
      makeRequest({
        event: "user_one_click_pitch",
        leadIds: ["lead_1", "lead_2", "lead_foreign"],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(3);

    const byLead = Object.fromEntries(
      (body.sessions as Array<{ leadId: string; sessionId?: string; error?: string }>).map(
        (s) => [s.leadId, s],
      ),
    );
    expect(byLead.lead_1.sessionId).toBe("sess_a");
    expect(byLead.lead_2.sessionId).toBe("sess_b");
    expect(byLead.lead_foreign.error).toBe("not_in_workspace");
    expect(byLead.lead_foreign.sessionId).toBeUndefined();

    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockLeadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws_test" }),
      }),
    );
  });

  it("one emit failure does not block the other leads", async () => {
    mockLeadFindMany.mockResolvedValueOnce([
      { id: "lead_1" },
      { id: "lead_2" },
      { id: "lead_3" },
    ]);
    mockEmit
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("sess_2")
      .mockResolvedValueOnce("sess_3");

    const res = await POST(
      makeRequest({
        event: "user_one_click_pitch",
        leadIds: ["lead_1", "lead_2", "lead_3"],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const byLead = Object.fromEntries(
      (body.sessions as Array<{ leadId: string; sessionId?: string; error?: string }>).map(
        (s) => [s.leadId, s],
      ),
    );
    expect(byLead.lead_1.error).toMatch(/boom/i);
    expect(byLead.lead_1.sessionId).toBeUndefined();
    expect(byLead.lead_2.sessionId).toBe("sess_2");
    expect(byLead.lead_3.sessionId).toBe("sess_3");
  });
});
