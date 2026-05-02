/**
 * M9 regression - GET /api/leads accepted any `limit` parseInt
 * could produce. `?limit=999999999` would push that into Prisma's
 * `take`, OOM the planner / serializer, and emit MBs of JSON to a
 * caller that won't even paint it. The fix caps `limit` at 100
 * and `page` at 10_000.
 */
import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  return {
    requireUser: vi.fn().mockResolvedValue({
      workspaceId: "ws_m9",
      user: { id: "u_m9" },
    }),
    UnauthorizedError,
  };
});

const findManyMock = vi.fn().mockResolvedValue([]);
const countMock = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    salesOpportunity: { findMany: vi.fn().mockResolvedValue([]) },
    websiteAudit: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/api-errors", () => ({
  internalError: (_label: string, err: unknown) =>
    NextResponse.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    ),
}));

vi.mock("@/lib/niches", () => ({
  getChildrenOf: () => [],
}));

vi.mock("@/lib/geo", () => ({
  sortByDistance: (rows: unknown) => rows,
  filterWithinMiles: (rows: unknown) => rows,
}));

import { GET } from "@/app/api/leads/route";

describe("M9 - leads route caps page + limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it("?limit=999999 -> capped at 100", async () => {
    await GET(new Request("http://localhost/api/leads?limit=999999"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.take).toBe(100);
  });

  it("?limit=0 -> falls back to default 20 (zero is not a useful page)", async () => {
    await GET(new Request("http://localhost/api/leads?limit=0"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.take).toBe(20);
  });

  it("?limit=-5 -> falls back to default 20 (negative not allowed)", async () => {
    await GET(new Request("http://localhost/api/leads?limit=-5"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.take).toBe(20);
  });

  it("?limit=abc -> falls back to default 20 (NaN not allowed)", async () => {
    await GET(new Request("http://localhost/api/leads?limit=abc"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.take).toBe(20);
  });

  it("?limit=50 (in-range) -> used as-is", async () => {
    await GET(new Request("http://localhost/api/leads?limit=50"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.take).toBe(50);
  });

  it("?page=99999999 -> capped at 10000 (skip = 10000 * limit)", async () => {
    await GET(new Request("http://localhost/api/leads?page=99999999&limit=20"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.skip).toBeLessThanOrEqual(10000 * 100);
  });

  it("?page=0 -> falls back to page 1 (skip = 0)", async () => {
    await GET(new Request("http://localhost/api/leads?page=0&limit=10"));
    const args = findManyMock.mock.calls[0][0];
    expect(args.skip).toBe(0);
  });
});
