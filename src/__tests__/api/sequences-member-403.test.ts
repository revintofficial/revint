/**
 * H5 regression - GET/POST /api/sequences and POST
 * /api/sequences/inbox-sync used to call `requireWorkspaceAdmin()`,
 * which throws Next's `NEXT_REDIRECT` for MEMBER roles. The catch
 * block then mapped that to a generic 500 because it's not a
 * recognized error class. The fix uses `requireWorkspaceAdminApi()`
 * which throws `ForbiddenError` -> the catch block maps that to a
 * clean JSON 403 with no leaked detail.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireWorkspaceAdminApi: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sequence: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/sequence-engine/inbox-sync", () => ({
  syncWorkspaceInbox: vi.fn().mockResolvedValue({ scanned: 0 }),
}));

vi.mock("@/lib/api-errors", () => ({
  internalError: (_label: string, err: unknown) =>
    NextResponse.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    ),
}));

import { GET as sequencesGet, POST as sequencesPost } from "@/app/api/sequences/route";
import { POST as inboxSyncPost } from "@/app/api/sequences/inbox-sync/route";
import {
  ForbiddenError,
  UnauthorizedError,
  requireWorkspaceAdminApi,
} from "@/lib/auth";

describe("H5 - sequence routes return 403 JSON for MEMBER role (not 500)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/sequences -> 403 JSON when ForbiddenError is thrown", async () => {
    (requireWorkspaceAdminApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ForbiddenError("Workspace admin access required"),
    );

    const res = await sequencesGet();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Workspace admin access required");
    // Critical: NO 500-shaped Internal-error envelope.
    expect(body.error).not.toBe("Internal error");
    expect(body.detail).toBeUndefined();
  });

  it("POST /api/sequences -> 403 JSON when ForbiddenError is thrown", async () => {
    (requireWorkspaceAdminApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ForbiddenError("nope"),
    );

    const req = new Request("http://localhost/api/sequences", {
      method: "POST",
      body: JSON.stringify({ name: "x", steps: [] }),
    });
    const res = await sequencesPost(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/sequences/inbox-sync -> 403 JSON when ForbiddenError is thrown", async () => {
    (requireWorkspaceAdminApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ForbiddenError("nope"),
    );

    const res = await inboxSyncPost();
    expect(res.status).toBe(403);
  });

  it("GET /api/sequences -> 401 JSON when UnauthorizedError is thrown (no session)", async () => {
    (requireWorkspaceAdminApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new UnauthorizedError(),
    );

    const res = await sequencesGet();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});
