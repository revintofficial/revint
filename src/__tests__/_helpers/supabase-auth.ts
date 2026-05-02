/**
 * Supabase auth mocking helper for tests.
 *
 * `requireUser()` calls `createSupabaseServer().auth.getUser()` to
 * resolve the active session, then upserts the User row, then resolves
 * the active workspace via the `leadac_active_workspace_id` cookie.
 *
 * Tests that exercise an API route through `withAuth(...)` have two
 * options:
 *   1. Mock the supabase server client wholesale (`mockSession(...)`)
 *      so getUser() returns a fake user. The route still hits Prisma
 *      (use the integration runner + factories for those tests).
 *   2. Mock requireUser() itself by stubbing `@/lib/auth` (`mockRequireUser(...)`).
 *      Cheaper, no DB needed - prefer for pure validation/branching tests.
 *
 * Both helpers are vitest-aware (call inside a `describe` block) and
 * auto-restore on `afterEach` if you call `restoreAuthMocks()`.
 */
import { vi, type Mock } from "vitest";

export interface MockSessionInput {
  /** Workspace id the resolved session should land on. */
  workspaceId: string;
  /** Active member's role inside that workspace. */
  role?: "OWNER" | "ADMIN" | "MEMBER";
  /** User id (defaults to a deterministic stable id). */
  userId?: string;
  /** Email to put on the User row. */
  email?: string;
  /** Workspace plan returned by `requireUser()`. */
  plan?: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  /** Optional workspace fields needed by callers. */
  workspaceName?: string;
  workspaceSlug?: string;
}

export interface MockedAuthSession {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  workspaceId: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
    country: string | null;
    onboardingCompletedAt: Date | null;
  };
  role: "OWNER" | "ADMIN" | "MEMBER";
}

const restoreCallbacks: Array<() => void> = [];

/**
 * Stubs `requireUser()` (and the `withAuth(...)` wrapper that calls
 * it) with a synthetic session. Use for unit-level route tests where
 * you don't care about the Supabase ↔ Prisma upsert handshake.
 *
 * Returns the synthetic session object for assertion convenience.
 */
export function mockRequireUser(input: MockSessionInput): MockedAuthSession {
  const session: MockedAuthSession = buildSession(input);

  // vi.doMock ensures every subsequent dynamic import of `@/lib/auth`
  // (e.g. inside route handlers wrapped by `withAuth`) gets the
  // stubbed module. Static imports already evaluated before the call
  // are not re-bound; tests should put `mockRequireUser` BEFORE
  // importing the route under test, or use `await import("...")`
  // inside the test body.
  vi.doMock("@/lib/auth", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    return {
      ...actual,
      requireUser: vi.fn(async () => session),
      getOptionalUser: vi.fn(async () => session),
      withAuth:
        <T extends unknown[]>(handler: (s: MockedAuthSession, ...args: T) => Promise<Response>) =>
        async (...args: T) =>
          handler(session, ...args),
    };
  });

  restoreCallbacks.push(() => vi.doUnmock("@/lib/auth"));
  return session;
}

/**
 * Stubs `createSupabaseServer()` so `requireUser()` resolves the
 * passed-in user without hitting Supabase. Use for integration tests
 * that DO want to go through the real Prisma upsert + workspace
 * resolution but skip the network round-trip to Supabase.
 *
 * The caller is responsible for seeding the matching User +
 * WorkspaceMember rows via the factories before invoking the route.
 */
export function mockSupabaseServer(input: { userId: string; email: string }): Mock {
  const getUser = vi.fn(async () => ({
    data: {
      user: {
        id: input.userId,
        email: input.email,
        user_metadata: {},
      },
    },
    error: null,
  }));

  vi.doMock("@/lib/supabase/server", async () => ({
    createSupabaseServer: vi.fn(async () => ({ auth: { getUser } })),
  }));

  restoreCallbacks.push(() => vi.doUnmock("@/lib/supabase/server"));
  return getUser;
}

/**
 * Returns an unauthenticated stub. requireUser() throws
 * UnauthorizedError → route returns 401.
 */
export function mockUnauthenticated(): void {
  vi.doMock("@/lib/supabase/server", async () => ({
    createSupabaseServer: vi.fn(async () => ({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
    })),
  }));
  restoreCallbacks.push(() => vi.doUnmock("@/lib/supabase/server"));
}

/**
 * Restores every auth mock applied during the current test. Call
 * inside an `afterEach` block.
 */
export function restoreAuthMocks(): void {
  while (restoreCallbacks.length) {
    const cb = restoreCallbacks.pop();
    try {
      cb?.();
    } catch {
      // best-effort
    }
  }
}

function buildSession(input: MockSessionInput): MockedAuthSession {
  const userId = input.userId ?? "00000000-0000-0000-0000-000000000001";
  const email = input.email ?? "test-user@leadac.test";
  return {
    user: {
      id: userId,
      email,
      fullName: "Test User",
      avatarUrl: null,
    },
    workspaceId: input.workspaceId,
    workspace: {
      id: input.workspaceId,
      name: input.workspaceName ?? "Test Workspace",
      slug: input.workspaceSlug ?? `test-ws-${input.workspaceId.slice(0, 8)}`,
      plan: input.plan ?? "PRO",
      country: null,
      onboardingCompletedAt: null,
    },
    role: input.role ?? "OWNER",
  };
}
