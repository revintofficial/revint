/**
 * M1 regression - bulk planner used to emit chains for every lead in
 * the request without consulting quota first. A workspace at 0
 * remaining mockups could fire 50 emit() calls and pollute the cycle
 * counters with stuck PENDING/RUNNING rows. The route now gates each
 * lead through `assertWorkerQuota` and surfaces 402 / 207 properly.
 */
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
    user: { id: "u_test", email: "t@t.com", fullName: null, avatarUrl: null },
    workspaceId: "ws_test",
    workspace: { id: "ws_test", name: "T", slug: "t", plan: "PRO" },
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
    lead: { findMany: (...args: unknown[]) => mockLeadFindMany(...args) },
  },
}));

const mockAssert = vi.fn();
vi.mock("@/lib/agent-workers/quota", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent-workers/quota")>(
    "@/lib/agent-workers/quota",
  );
  return {
    ...actual,
    assertWorkerQuota: (...args: unknown[]) => mockAssert(...args),
  };
});

import { POST } from "@/app/api/planner/bulk/route";
import { QuotaExceededError } from "@/lib/agent-workers/quota";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/planner/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/planner/bulk - M1 quota gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockImplementation(async () => `sess_${Math.random().toString(36).slice(2, 8)}`);
    mockLeadFindMany.mockResolvedValue([
      { id: "lead_1" },
      { id: "lead_2" },
    ]);
  });

  it("returns 402 when EVERY lead is denied by the headline worker quota", async () => {
    mockAssert.mockRejectedValue(
      new QuotaExceededError(20, 20, "WEBSITE_MOCKUP_GENERATOR"),
    );

    const res = await POST(
      makeRequest({
        event: "user_one_click_pitch",
        leadIds: ["lead_1", "lead_2"],
      }),
    );
    expect(res.status).toBe(402);
    expect(mockEmit).not.toHaveBeenCalled();
    const body = await res.json();
    const sessions = body.sessions as Array<{ leadId: string; error?: string; status?: number }>;
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.status === 402)).toBe(true);
    expect(sessions.every((s) => /quota/i.test(s.error || ""))).toBe(true);
  });

  it("returns 207 when some leads are quota-denied but at least one emits", async () => {
    mockAssert
      .mockResolvedValueOnce({
        allowed: true,
        used: 0,
        limit: 100,
        remaining: 100,
        resetAt: null,
      })
      .mockRejectedValueOnce(
        new QuotaExceededError(100, 100, "WEBSITE_MOCKUP_GENERATOR"),
      );

    const res = await POST(
      makeRequest({
        event: "user_one_click_pitch",
        leadIds: ["lead_1", "lead_2"],
      }),
    );
    expect(res.status).toBe(207);
    expect(mockEmit).toHaveBeenCalledTimes(1);
    const body = await res.json();
    const byLead = Object.fromEntries(
      (body.sessions as Array<{ leadId: string; sessionId?: string; error?: string }>).map(
        (s) => [s.leadId, s],
      ),
    );
    expect(byLead.lead_1.sessionId).toBeDefined();
    expect(byLead.lead_2.error).toMatch(/quota/i);
  });

  it("returns 200 when all leads pass quota and emit succeeds", async () => {
    mockAssert.mockResolvedValue({
      allowed: true,
      used: 0,
      limit: 100,
      remaining: 100,
      resetAt: null,
    });

    const res = await POST(
      makeRequest({
        event: "user_one_click_pitch",
        leadIds: ["lead_1", "lead_2"],
      }),
    );
    expect(res.status).toBe(200);
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });

  it("does not emit a chain whose quota check failed", async () => {
    mockAssert.mockRejectedValue(
      new QuotaExceededError(0, 0, "WEBSITE_MOCKUP_GENERATOR"),
    );

    await POST(
      makeRequest({
        event: "user_one_click_pitch",
        leadIds: ["lead_1", "lead_2"],
      }),
    );
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
