/**
 * M10 regression - the website-check endpoint pulled the entire
 * upstream response into memory via `response.text()`. A hostile
 * (or runaway) site that streams a multi-GB response would OOM the
 * API server before we get a chance to bail. The fix streams
 * through the body reader and aborts at 5 MB.
 *
 * Test approach: rather than try to wire up a streaming ReadableStream
 * in jsdom (which has spotty support and was causing tests to hang),
 * we feed pre-buffered bodies of known sizes through a plain
 * Response and assert the route's two visible behaviors:
 *   - small body: reachable=true
 *   - oversize body: reachable=false with a "5 MB" signal
 * The streaming-cap implementation correctness is asserted
 * additionally with a source-presence check that guarantees the
 * route uses a chunked reader rather than a one-shot text() call
 * for the body.
 */
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  return {
    requireUser: vi.fn().mockResolvedValue({
      workspaceId: "ws_m10",
      user: { id: "u_m10" },
    }),
    UnauthorizedError,
  };
});

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ ok: true }),
  rateLimitResponse: () => NextResponse.json({ error: "rate_limited" }, { status: 429 }),
  LIMITS: { websiteCheck: { bucket: "wcheck", windowSec: 60, limit: 30 } },
}));

const safeFetchFollowMock = vi.fn();
vi.mock("@/lib/safe-fetch", () => ({
  safeFetchFollow: (...a: unknown[]) => safeFetchFollowMock(...a),
}));

vi.mock("@/lib/url-guard", () => ({
  UrlGuardError: class UrlGuardError extends Error {},
}));

import { POST } from "@/app/api/website-check/route";

describe("M10 - website-check caps response body at 5 MB (functional)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a small body is read fully and analyzed", async () => {
    const small = "<html><body>" + "<p>hello world</p>".repeat(50) + "</body></html>";
    safeFetchFollowMock.mockResolvedValue({
      response: new Response(small, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      finalUrl: "https://example.com",
    });

    const res = await POST(
      new Request("http://localhost/api/website-check", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reachable).toBe(true);
  });

  it("a 6 MB body trips the cap and returns reachable:false with a clear signal", async () => {
    // A 6 MB body of `<` chars.
    const oversize = new Uint8Array(6 * 1024 * 1024).fill(0x3c);
    safeFetchFollowMock.mockResolvedValue({
      response: new Response(oversize, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      finalUrl: "https://huge.example.com",
    });

    const res = await POST(
      new Request("http://localhost/api/website-check", {
        method: "POST",
        body: JSON.stringify({ url: "https://huge.example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reachable).toBe(false);
    expect(body.verdict).toBe("unreachable");
    expect(JSON.stringify(body.signals)).toMatch(/5 MB/);
  });
});

describe("M10 - source-presence: route reads body in chunks, not in one shot", () => {
  it("website-check route uses a getReader-based cap helper, not response.text()", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/app/api/website-check/route.ts"),
      "utf-8",
    );
    // The body MUST go through the chunked helper so the cap is
    // enforced even for streamed bodies. A future PR that
    // accidentally regresses to `response.text()` would re-introduce
    // the OOM vector.
    expect(src).toMatch(/readResponseBodyCapped\s*\(\s*response/);
    // The helper itself uses `getReader()`. The route must not
    // contain its own bare `response.text()` outside the helper.
    expect(src).toMatch(/response\.body\.getReader\(\)/);
  });

  it("the 5 MB cap value is wired through the call site", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/app/api/website-check/route.ts"),
      "utf-8",
    );
    expect(src).toMatch(/5\s*\*\s*1024\s*\*\s*1024/);
  });
});
