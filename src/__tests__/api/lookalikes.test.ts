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

// L6 fix - the route migrated from `lead.findUnique({id})` +
// post-check to `lead.findFirst({id, workspaceId})`. The mock now
// exposes the new method.
const mockLeadFindFirst = vi.fn();
const mockLeadFindMany = vi.fn();
const mockSemanticMemoryFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: (...args: unknown[]) => mockLeadFindFirst(...args),
      findUnique: vi.fn(),
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
    },
    semanticMemory: {
      findFirst: (...args: unknown[]) => mockSemanticMemoryFindFirst(...args),
    },
  },
}));

const mockQuery = vi.fn();
vi.mock("@/lib/ai-core/memory", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import { GET } from "@/app/api/leads/[id]/lookalikes/route";
import { requireUser, UnauthorizedError } from "@/lib/auth";

function makeRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/leads/${id}/lookalikes`);
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/leads/[id]/lookalikes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeadFindFirst.mockResolvedValue({ workspaceId: "ws_test" });
    mockLeadFindMany.mockResolvedValue([]);
    mockSemanticMemoryFindFirst.mockResolvedValue(null);
    mockQuery.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(makeRequest("lead_1"), makeCtx("lead_1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the source lead is in another workspace", async () => {
    // L6 - findFirst({id, workspaceId}) returns null directly when
    // the row is in another tenant. The mock mirrors that.
    mockLeadFindFirst.mockResolvedValueOnce(null);
    const res = await GET(makeRequest("lead_other"), makeCtx("lead_other"));
    expect(res.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockLeadFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "lead_other",
          workspaceId: "ws_test",
        }),
      }),
    );
  });

  it("returns empty array when the source lead has no LEAD_PROFILE memory", async () => {
    mockLeadFindFirst.mockResolvedValueOnce({ workspaceId: "ws_test" });
    mockSemanticMemoryFindFirst.mockResolvedValueOnce(null);

    const res = await GET(makeRequest("lead_noprofile"), makeCtx("lead_noprofile"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lookalikes).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("excludes the source lead from results and hydrates the rest", async () => {
    mockLeadFindFirst.mockResolvedValueOnce({ workspaceId: "ws_test" });
    mockSemanticMemoryFindFirst.mockResolvedValueOnce({
      id: "mem_src",
      text: "source lead profile text",
    });
    mockQuery.mockResolvedValueOnce([
      {
        id: "m_src",
        kind: "LEAD_PROFILE",
        leadId: "lead_src",
        refType: "lead",
        refId: "lead_src",
        text: "",
        metadata: {},
        similarity: 1.0,
        createdAt: new Date(),
      },
      {
        id: "m_a",
        kind: "LEAD_PROFILE",
        leadId: "lead_a",
        refType: "lead",
        refId: "lead_a",
        text: "",
        metadata: { tier: "gold" },
        similarity: 0.9,
        createdAt: new Date(),
      },
      {
        id: "m_b",
        kind: "LEAD_PROFILE",
        leadId: "lead_b",
        refType: "lead",
        refId: "lead_b",
        text: "",
        metadata: {},
        similarity: 0.8,
        createdAt: new Date(),
      },
      {
        id: "m_c",
        kind: "LEAD_PROFILE",
        leadId: "lead_c",
        refType: "lead",
        refId: "lead_c",
        text: "",
        metadata: {},
        similarity: 0.7,
        createdAt: new Date(),
      },
    ]);
    mockLeadFindMany.mockResolvedValueOnce([
      {
        id: "lead_a",
        businessName: "Alpha Repair",
        borough: "Camden",
        rating: 4.6,
        reviewCount: 120,
        hasWebsite: true,
        salesOpportunity: { opportunityScore: 70, status: "NEW", suggestedOffer: "GROWTH" },
      },
      {
        id: "lead_b",
        businessName: "Bravo Fix",
        borough: "Greenwich",
        rating: 4.2,
        reviewCount: 60,
        hasWebsite: false,
        salesOpportunity: null,
      },
      {
        id: "lead_c",
        businessName: "Charlie Tech",
        borough: null,
        rating: null,
        reviewCount: null,
        hasWebsite: false,
        salesOpportunity: null,
      },
    ]);

    const res = await GET(makeRequest("lead_src"), makeCtx("lead_src"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.lookalikes).toHaveLength(3);
    const returnedLeadIds = body.lookalikes.map(
      (l: { leadId: string }) => l.leadId,
    );
    expect(returnedLeadIds).not.toContain("lead_src");
    expect(returnedLeadIds).toEqual(["lead_a", "lead_b", "lead_c"]);

    expect(body.lookalikes[0].lead.businessName).toBe("Alpha Repair");
    expect(body.lookalikes[0].lead.rating).toBe(4.6);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryArg = mockQuery.mock.calls[0][0];
    expect(queryArg.workspaceId).toBe("ws_test");
    expect(queryArg.kinds).toEqual(["LEAD_PROFILE"]);
  });
});
