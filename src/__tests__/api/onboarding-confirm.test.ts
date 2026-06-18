/**
 * Onboarding confirm routes — auth + workspace-scope contract.
 *
 * Verifies that confirm-icp / confirm-packages reject unauthenticated and
 * non-admin callers, write ONLY to the caller's workspaceId, and enforce the
 * packages hard-gate (>=1 package).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: () => requireUser(), UnauthorizedError };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  internalError: () =>
    new Response(JSON.stringify({ error: "Internal error" }), { status: 500 }),
}));

const icpUpsert = vi.fn();
const workspaceFindUnique = vi.fn();
const deleteMany = vi.fn();
const pkgUpsert = vi.fn();
const $transaction = vi.fn(async (ops: unknown[]) => ops);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: (...a: unknown[]) => workspaceFindUnique(...a) },
    idealCustomerProfile: { upsert: (...a: unknown[]) => icpUpsert(...a) },
    servicePackage: {
      deleteMany: (...a: unknown[]) => deleteMany(...a),
      upsert: (...a: unknown[]) => pkgUpsert(...a),
    },
    $transaction: (...a: unknown[]) => $transaction(...(a as [unknown[]])),
  },
}));

import { POST as confirmIcp } from "@/app/api/onboarding/confirm-icp/route";
import { POST as confirmPackages } from "@/app/api/onboarding/confirm-packages/route";
import { UnauthorizedError } from "@/lib/auth";

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/onboarding/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ownerSession = {
  workspaceId: "ws_owner",
  role: "OWNER",
  user: { id: "u1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue(ownerSession);
  workspaceFindUnique.mockResolvedValue({ companyName: "Acme", name: "Acme" });
  icpUpsert.mockResolvedValue({ id: "icp1", version: 2 });
  pkgUpsert.mockReturnValue({ __op: "upsert" });
  deleteMany.mockReturnValue({ __op: "delete" });
});

describe("POST /api/onboarding/confirm-icp", () => {
  it("returns 401 when unauthenticated", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError());
    const res = await confirmIcp(jsonReq({ icp: { description: "x" } }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin roles", async () => {
    requireUser.mockResolvedValueOnce({ ...ownerSession, role: "MEMBER" });
    const res = await confirmIcp(jsonReq({ icp: { description: "x" } }));
    expect(res.status).toBe(403);
    expect(icpUpsert).not.toHaveBeenCalled();
  });

  it("rejects an empty description", async () => {
    const res = await confirmIcp(jsonReq({ icp: { description: "   " } }));
    expect(res.status).toBe(400);
    expect(icpUpsert).not.toHaveBeenCalled();
  });

  it("upserts scoped to the caller workspace and bumps version", async () => {
    const res = await confirmIcp(jsonReq({ icp: { description: "Clinics" } }));
    expect(res.status).toBe(200);
    const args = icpUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ workspaceId: "ws_owner" });
    expect(args.create.workspaceId).toBe("ws_owner");
    expect(args.update.version).toEqual({ increment: 1 });
  });
});

describe("POST /api/onboarding/confirm-packages", () => {
  it("returns 403 for non-admin roles", async () => {
    requireUser.mockResolvedValueOnce({ ...ownerSession, role: "MEMBER" });
    const res = await confirmPackages(jsonReq({ packages: [{ name: "Solo" }] }));
    expect(res.status).toBe(403);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("enforces the >=1 package hard-gate", async () => {
    const res = await confirmPackages(jsonReq({ packages: [] }));
    expect(res.status).toBe(400);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("deletes + upserts scoped to the caller workspace", async () => {
    const res = await confirmPackages(
      jsonReq({ packages: [{ name: "Solo", priceLabel: "$1" }] }),
    );
    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_owner", name: { notIn: ["Solo"] } },
    });
    const upsertArgs = pkgUpsert.mock.calls[0][0];
    expect(upsertArgs.where.workspaceId_name.workspaceId).toBe("ws_owner");
    expect(upsertArgs.create.workspaceId).toBe("ws_owner");
  });
});
