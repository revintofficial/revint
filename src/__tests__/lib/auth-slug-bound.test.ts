/**
 * M14 regression - the slug collision loop in `requireUser()` was
 * unbounded. A signup with a common email prefix ("admin", "info",
 * "contact") that hits dozens of existing rows would hammer the DB
 * with sequential `findUnique({slug: "admin-1"})`, `"admin-2"`, ...
 * and the latency would spike linearly with the existing-row count.
 *
 * The fix caps sequential attempts at 50 then falls back to a 6-char
 * random suffix. Past that, it throws (instead of looping forever).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

let collisionsLeft = 0;
const findUniqueMock = vi.fn(async () => {
  if (collisionsLeft > 0) {
    collisionsLeft -= 1;
    return { id: "ws_existing", slug: "taken" };
  }
  return null;
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({
        id: "u_m14",
        email: "admin@example.com",
        fullName: null,
        avatarUrl: null,
      }),
    },
    workspaceMember: {
      findFirst: vi
        .fn()
        // First lookup -> no membership (so the slug loop runs).
        .mockResolvedValueOnce(null)
        // Subsequent lookup after creation -> the freshly-made membership.
        .mockResolvedValue({
          workspaceId: "ws_new",
          role: "OWNER",
          workspace: {
            id: "ws_new",
            name: "n",
            slug: "admin-some",
            plan: "FREE",
            country: null,
            onboardingCompletedAt: null,
          },
        }),
      findFirstOrThrow: vi.fn().mockResolvedValue({
        workspaceId: "ws_new",
        role: "OWNER",
        workspace: {
          id: "ws_new",
          name: "n",
          slug: "admin-some",
          plan: "FREE",
          country: null,
          onboardingCompletedAt: null,
        },
      }),
    },
    workspace: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      create: vi.fn().mockResolvedValue({
        id: "ws_new",
        slug: "admin-some",
      }),
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "u_m14",
            email: "admin@example.com",
            user_metadata: {},
          },
        },
      }),
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmailAsync: vi.fn(),
}));

import { requireUser } from "@/lib/auth";

describe("M14 - slug collision loop is bounded", () => {
  beforeEach(() => {
    findUniqueMock.mockClear();
  });

  it("fewer than 50 collisions still resolves with a sequential suffix", async () => {
    collisionsLeft = 5;
    const session = await requireUser();
    expect(session.workspaceId).toBe("ws_new");
    // 5 collisions + 1 successful empty result + 1 final post-create lookup
    // bound the call count to a single-digit number.
    expect(findUniqueMock.mock.calls.length).toBeLessThan(20);
  });

  it("100 collisions still terminates (does not hammer DB indefinitely)", async () => {
    collisionsLeft = 100;
    // The 50-attempt cap kicks in, then the random suffix path either
    // succeeds (collision-free with overwhelming probability) or
    // throws. Either way, total findUnique calls stay bounded.
    const start = Date.now();
    try {
      await requireUser();
    } catch {
      // Random-suffix exhaustion throw is acceptable under
      // pathological mock conditions; the contract here is that
      // the call terminates quickly rather than spinning.
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5_000);
    // At most: 50 sequential + 1 random-suffix probe + final
    // post-create lookup = ~52 calls. Hard cap at 60 to leave
    // headroom for incidental lookups in createWorkspace flow.
    expect(findUniqueMock.mock.calls.length).toBeLessThanOrEqual(60);
  });
});
