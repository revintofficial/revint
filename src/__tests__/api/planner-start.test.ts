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
        return NextResponse.json(
          { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
          { status: 500 },
        );
      }
    };
  return { requireUser, UnauthorizedError, NotFoundError, withAuth };
});

const mockEmit = vi.fn();
vi.mock("@/lib/ai-core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

const mockLeadFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
    },
  },
}));

import { POST } from "@/app/api/planner/start/route";
import { requireUser, UnauthorizedError } from "@/lib/auth";

function makeRequest(body: unknown | string): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
  return new Request("http://localhost:3000/api/planner/start", init);
}

describe("POST /api/planner/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockResolvedValue("session_123");
    mockLeadFindUnique.mockResolvedValue({ workspaceId: "ws_test" });
  });

  it("returns 401 when requireUser throws UnauthorizedError", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());

    const res = await POST(makeRequest({ event: "user_one_click_pitch", leadId: "lead_1" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(makeRequest("{ not valid json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 for unknown event", async () => {
    const res = await POST(makeRequest({ event: "not_a_real_event", leadId: "lead_1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown or disallowed/i);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("rejects internal event 'lead_created' from the API", async () => {
    const res = await POST(makeRequest({ event: "lead_created", leadId: "lead_1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed/i);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("returns 403 for a cross-workspace lead without leaking data", async () => {
    mockLeadFindUnique.mockResolvedValueOnce({ workspaceId: "OTHER_WS" });

    const res = await POST(makeRequest({ event: "user_one_click_pitch", leadId: "lead_other" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
    expect(body).not.toHaveProperty("workspaceId");
    expect(JSON.stringify(body)).not.toContain("OTHER_WS");
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("returns 400 when leadId is missing for a lead-scoped event", async () => {
    const res = await POST(makeRequest({ event: "user_one_click_pitch" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/leadid/i);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("returns 200 and a sessionId for user_one_click_pitch", async () => {
    mockEmit.mockResolvedValueOnce("session_abc");
    const res = await POST(makeRequest({ event: "user_one_click_pitch", leadId: "lead_1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.sessionId).toBe("string");
    expect(body.sessionId).toBe("session_abc");

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const [eventArg, payload] = mockEmit.mock.calls[0];
    expect(eventArg).toBe("user_one_click_pitch");
    expect(payload).toEqual(
      expect.objectContaining({
        workspaceId: "ws_test",
        leadId: "lead_1",
      }),
    );
  });

  it("user_bulk_pitch does NOT require leadId at the top level", async () => {
    mockEmit.mockResolvedValueOnce("session_bulk");
    const res = await POST(
      makeRequest({ event: "user_bulk_pitch", inputs: { leadIds: ["l1", "l2"] } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe("session_bulk");
    expect(mockLeadFindUnique).not.toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });
});
