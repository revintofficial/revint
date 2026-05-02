/**
 * L11 + L12 regression - team invite must:
 *   - L11: re-check seat capacity INSIDE the same transaction as
 *     the member create. The old code did `count -> check -> create`
 *     across separate Prisma calls, so two parallel invites that
 *     each saw the count below the cap could both insert and exceed
 *     the plan's seat limit.
 *   - L12: when the invitee is already a workspace member, return
 *     200 with `code: "invitation_sent_existing_user"` instead of
 *     a 409 error so the UI can show a friendly notice.
 */
import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  return {
    requireUser: vi.fn().mockResolvedValue({
      user: { id: "u_owner", email: "owner@test.com" },
      workspaceId: "ws_l11",
      workspace: { id: "ws_l11", name: "T", slug: "t", plan: "FREE" },
      role: "OWNER",
    }),
    UnauthorizedError,
  };
});

const memberCount = vi.fn();
const userFindUnique = vi.fn();
const memberFindFirst = vi.fn();
const memberCreate = vi.fn();
const workspaceFindUnique = vi.fn();

const txCallback = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: {
      count: (...a: unknown[]) => memberCount(...a),
      findFirst: (...a: unknown[]) => memberFindFirst(...a),
      create: (...a: unknown[]) => memberCreate(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      upsert: vi.fn(),
    },
    workspace: {
      findUnique: (...a: unknown[]) => workspaceFindUnique(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => {
      txCallback(cb);
      return cb({
        workspaceMember: {
          count: memberCount,
          findFirst: memberFindFirst,
          create: memberCreate,
        },
      });
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmailAsync: vi.fn(),
}));

vi.mock("@/lib/api-errors", () => ({
  internalError: (_label: string, err: unknown) =>
    NextResponse.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    ),
}));

import { POST } from "@/app/api/team/invite/route";

function makeReq(email = "newhire@example.com") {
  return new Request("http://localhost/api/team/invite", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

describe("L11 - seat check + create are atomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceFindUnique.mockResolvedValue({ language: "en" });
    userFindUnique.mockResolvedValue({ id: "u_invitee", email: "newhire@example.com" });
  });

  it("seat re-check inside transaction returns 402 when cap was already hit (race-loser)", async () => {
    // Simulate: pre-transaction count says 0/1 (FREE plan), so the
    // upfront check passes. INSIDE the transaction, a sibling invite
    // already inserted, so the count is now 1/1 and the seat cap is
    // hit. The route must return 402, NOT silently create the
    // 2nd member.
    memberCount
      // Upfront check: still has room.
      .mockResolvedValueOnce(0)
      // In-transaction check: cap reached.
      .mockResolvedValueOnce(1);

    const res = await POST(makeReq());
    expect(res.status).toBe(402);
    expect(memberCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe("seat_limit_reached");
  });

  it("happy path: both checks pass, member is created", async () => {
    memberCount.mockResolvedValue(0);
    memberFindFirst.mockResolvedValue(null);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(memberCreate).toHaveBeenCalledTimes(1);
    expect(txCallback).toHaveBeenCalled();
  });
});

describe("L12 - already-member returns 200 invitation_sent_existing_user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceFindUnique.mockResolvedValue({ language: "en" });
    userFindUnique.mockResolvedValue({ id: "u_existing", email: "vet@example.com" });
    memberCount.mockResolvedValue(0);
  });

  it("returns 200 with code invitation_sent_existing_user when user is already a member", async () => {
    memberFindFirst.mockResolvedValue({ id: "wm_existing", role: "MEMBER" });

    const res = await POST(makeReq("vet@example.com"));
    expect(res.status).toBe(200);
    expect(memberCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.code).toBe("invitation_sent_existing_user");
    expect(body.message).toMatch(/already on your team/i);
  });
});
