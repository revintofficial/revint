/**
 * H4 regression - `withAuth(handler)` used to put `err.message` (and
 * sometimes `String(err)`) into the response body under `detail` even
 * in production. That leaked Prisma constraint strings, ORM hints,
 * Supabase project refs, and stack fragments to anyone who could
 * trigger a 500. The fix routes through `internalError()` which
 * suppresses `detail` outside of dev.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// vi.stubEnv mutates process.env in a way that survives module
// boundaries and restores on `vi.unstubAllEnvs()`. Direct assignment
// or Object.defineProperty trips Node's non-configurable
// `NODE_ENV` descriptor in vitest 4.x.

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u_h4", email: "h4@test.com", user_metadata: {} } },
      }),
    },
  }),
}));

const upsertMock = vi.fn();
const memberFindFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: (...a: unknown[]) => upsertMock(...a) },
    workspaceMember: {
      findFirst: (...a: unknown[]) => memberFindFirstMock(...a),
      findFirstOrThrow: vi.fn(),
    },
    workspace: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

import { withAuth } from "@/lib/auth";

describe("H4 - withAuth never leaks detail in production", () => {
  beforeEach(() => {
    upsertMock.mockResolvedValue({
      id: "u_h4",
      email: "h4@test.com",
      fullName: null,
      avatarUrl: null,
    });
    memberFindFirstMock.mockResolvedValue({
      workspaceId: "ws_h4",
      role: "OWNER",
      workspace: {
        id: "ws_h4",
        name: "T",
        slug: "t",
        plan: "FREE",
        country: null,
        onboardingCompletedAt: null,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns Internal error with NO detail field when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const handler = withAuth(async () => {
      throw new Error(
        "PrismaClientKnownRequestError: secret hint inside connection string postgresql://leak:hint@db",
      );
    });

    const res = await handler();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error");
    expect(body.detail).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/postgresql:/);
    expect(JSON.stringify(body)).not.toMatch(/leak:hint/);
  });

  it("returns Internal error WITH detail when NODE_ENV is development (DX)", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const handler = withAuth(async () => {
      throw new Error("dev-friendly stack fragment");
    });

    const res = await handler();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error");
    expect(body.detail).toBe("dev-friendly stack fragment");
  });
});
