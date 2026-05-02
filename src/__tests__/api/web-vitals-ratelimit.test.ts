/**
 * M26 regression - the public unauthenticated /api/web-vitals
 * endpoint had no rate limit. Anyone could pump arbitrary samples
 * in to pollute the SEO dashboard's per-metric distribution and
 * (cheaply) DoS our Redis writer. The fix buckets per caller IP
 * with `LIMITS.webVitals` (60/min/IP).
 */
import { NextResponse, type NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/ratelimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ratelimit")>(
    "@/lib/ratelimit",
  );
  return {
    ...actual,
    checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
    rateLimitResponse: (rl: { limit: number; remaining: number; resetSec: number }) =>
      NextResponse.json(
        {
          error: "rate_limited",
          limit: rl.limit,
          remaining: rl.remaining,
          resetSec: rl.resetSec,
        },
        { status: 429 },
      ),
  };
});

const zaddMock = vi.fn().mockResolvedValue(1);
const zremMock = vi.fn().mockResolvedValue(1);
const expireMock = vi.fn().mockResolvedValue(1);

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    zadd: zaddMock,
    zremrangebyrank: zremMock,
    expire: expireMock,
  }),
}));

import { POST } from "@/app/api/web-vitals/route";

function makeReq(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/web-vitals", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      name: "CLS",
      value: 0.05,
      rating: "good",
      id: "v3-1234",
    }),
  }) as unknown as NextRequest;
}

describe("M26 - web-vitals rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path (under limit) -> 200 + redis write", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      ok: true,
      limit: 60,
      remaining: 59,
      resetSec: 60,
    });

    const res = await POST(makeReq({ "x-forwarded-for": "1.2.3.4" }));
    expect(res.status).toBe(200);
    expect(zaddMock).toHaveBeenCalledTimes(1);
  });

  it("over limit -> 429 with no redis write", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 60,
      remaining: 0,
      resetSec: 30,
    });

    const res = await POST(makeReq({ "x-forwarded-for": "1.2.3.4" }));
    expect(res.status).toBe(429);
    expect(zaddMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("buckets per caller IP from x-forwarded-for", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      ok: true,
      limit: 60,
      remaining: 59,
      resetSec: 60,
    });

    await POST(makeReq({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }));
    const subject = checkRateLimitMock.mock.calls[0][0];
    expect(subject).toMatch(/^wvit:/);
    expect(subject).toContain("203.0.113.10");
    // The 10.0.0.1 hop is the internal proxy IP, not the caller — we
    // bucket on the FIRST hop in xff.
    expect(subject).not.toContain("10.0.0.1");
  });

  it("falls back to 'anon' subject when no xff is present", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      ok: true,
      limit: 60,
      remaining: 59,
      resetSec: 60,
    });

    await POST(makeReq());
    const subject = checkRateLimitMock.mock.calls[0][0];
    expect(subject).toBe("wvit:anon");
  });

  it("uses x-real-ip when xff is absent", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      ok: true,
      limit: 60,
      remaining: 59,
      resetSec: 60,
    });

    await POST(makeReq({ "x-real-ip": "198.51.100.7" }));
    const subject = checkRateLimitMock.mock.calls[0][0];
    expect(subject).toContain("198.51.100.7");
  });
});
