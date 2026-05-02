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

// L5 fix - the route migrated from `lead.findUnique({id})` +
// post-check to `lead.findFirst({id, workspaceId})`, and from
// `salesOpportunity.update({where:{leadId}})` to a scoped
// `updateMany({leadId, workspaceId})`. The mocks below mirror the
// new surface; the old method names are kept as no-ops to surface
// any accidental call regression.
const mockLeadFindFirst = vi.fn();
const mockSalesOppUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: (...args: unknown[]) => mockLeadFindFirst(...args),
      findUnique: vi.fn(),
    },
    salesOpportunity: {
      updateMany: (...args: unknown[]) => mockSalesOppUpdateMany(...args),
      update: vi.fn(),
    },
  },
}));

const mockEmit = vi.fn();
vi.mock("@/lib/ai-core/events", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

import { POST } from "@/app/api/leads/[id]/mark-outcome/route";
import { requireUser, UnauthorizedError } from "@/lib/auth";

function makeRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/leads/${id}/mark-outcome`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/leads/[id]/mark-outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockResolvedValue("sess_mark_1");
    mockSalesOppUpdateMany.mockResolvedValue({ count: 1 });
    mockLeadFindFirst.mockResolvedValue({
      workspaceId: "ws_test",
      salesOpportunity: { id: "opp_1" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());
    const res = await POST(makeRequest("lead_1", { status: "WON" }), makeCtx("lead_1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    const res = await POST(
      makeRequest("lead_1", { status: "BANANA" }),
      makeCtx("lead_1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/INTERESTED.*MEETING.*WON.*LOST/);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockSalesOppUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the lead belongs to another workspace", async () => {
    // L5 - findFirst({id, workspaceId}) returns null directly when
    // the row is in another tenant. The mock mirrors that.
    mockLeadFindFirst.mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest("lead_other", { status: "WON" }),
      makeCtx("lead_other"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("OTHER_WS");
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockLeadFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "lead_other",
          workspaceId: "ws_test",
        }),
      }),
    );
  });

  it("returns 409 when the lead has no SalesOpportunity row", async () => {
    mockLeadFindFirst.mockResolvedValueOnce({
      workspaceId: "ws_test",
      salesOpportunity: null,
    });

    const res = await POST(
      makeRequest("lead_no_opp", { status: "WON" }),
      makeCtx("lead_no_opp"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/sales opportunity|intelligence chain/i);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockSalesOppUpdateMany).not.toHaveBeenCalled();
  });

  it("updates status and emits inbox_reply_received on success", async () => {
    mockEmit.mockResolvedValueOnce("sess_reply_1");

    const res = await POST(
      makeRequest("lead_1", { status: "WON" }),
      makeCtx("lead_1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("WON");
    expect(body.sessionId).toBe("sess_reply_1");

    // L5 - updateMany now scopes by both leadId AND workspaceId.
    expect(mockSalesOppUpdateMany).toHaveBeenCalledWith({
      where: { leadId: "lead_1", workspaceId: "ws_test" },
      data: { status: "WON" },
    });

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const [eventArg, payload] = mockEmit.mock.calls[0];
    expect(eventArg).toBe("inbox_reply_received");
    expect(payload).toEqual(
      expect.objectContaining({
        workspaceId: "ws_test",
        leadId: "lead_1",
        userId: "test-user",
      }),
    );
  });
});
