/**
 * L8 regression - /auth/callback used to put Supabase's raw error
 * message into the redirect URL: `?error=...`. That string is
 * end-user-visible (browser address bar, logs, referrer header) and
 * historically has included project refs, role hints, and JWT
 * validation strings. The fix uses an opaque `oauth_failed` code
 * and logs the real cause server-side.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const exchangeMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: (code: string) => exchangeMock(code) },
  }),
}));

vi.mock("@/lib/safe-redirect", () => ({
  safeNextPath: (next: string | null, fallback: string) => next ?? fallback,
}));

const loggerWarnMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: (...a: unknown[]) => loggerWarnMock(...a),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from "@/app/auth/callback/route";

describe("L8 - /auth/callback uses opaque oauth_failed code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("error response sets ?error=oauth_failed (NOT raw Supabase message)", async () => {
    exchangeMock.mockResolvedValueOnce({
      error: {
        message:
          "JWT expired at project ref leakproj-secret123: invalid signature, role mismatch (auth schema not bootstrapped)",
        status: 401,
      },
    });

    const res = await GET(
      new Request("http://localhost/auth/callback?code=abc&next=/app/dashboard"),
    );
    expect(res.status).toBe(307);

    const loc = res.headers.get("location") ?? "";
    const locUrl = new URL(loc);
    expect(locUrl.pathname).toBe("/login");
    expect(locUrl.searchParams.get("error")).toBe("oauth_failed");

    // Critical: NO raw Supabase detail in the URL the user will see
    // / share / log.
    expect(loc).not.toMatch(/leakproj-secret123/);
    expect(loc).not.toMatch(/JWT expired/);
    expect(loc).not.toMatch(/role mismatch/);
  });

  it("logs the full Supabase error server-side under a greppable scope", async () => {
    exchangeMock.mockResolvedValueOnce({
      error: { message: "JWT expired", status: 401 },
    });

    await GET(new Request("http://localhost/auth/callback?code=abc"));

    expect(loggerWarnMock).toHaveBeenCalledWith(
      "auth.callback.exchange_failed",
      expect.objectContaining({
        err: "JWT expired",
        status: 401,
      }),
    );
  });

  it("happy path: no error -> redirect to next path with no error param", async () => {
    exchangeMock.mockResolvedValueOnce({ error: null });
    const res = await GET(
      new Request("http://localhost/auth/callback?code=abc&next=/app/dashboard"),
    );
    const loc = res.headers.get("location") ?? "";
    const locUrl = new URL(loc);
    expect(locUrl.pathname).toBe("/app/dashboard");
    expect(locUrl.searchParams.get("error")).toBeNull();
  });
});
