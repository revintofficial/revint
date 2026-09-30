// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  users: new Map<string, { id: string; email: string; fullName: string | null; isPlatformAdmin: boolean }>(),
  assignments: new Map<string, { id: string; userId: string; role: string; lens: string | null }>(),
  audits: [] as Array<Record<string, unknown>>,
  humanReviewWrites: 0,
}));

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  class ForbiddenError extends Error {
    status = 403;
  }
  class NotFoundError extends Error {
    status = 404;
  }
  return { requireUser: vi.fn(), UnauthorizedError, ForbiddenError, NotFoundError };
});

vi.mock("@/lib/prisma", () => {
  const db = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const user = store.users.get(where.id);
        if (!user) return null;
        return { ...user, platformRole: store.assignments.get(where.id) ?? null };
      }),
      findMany: vi.fn(async () => []),
    },
    platformRoleAssignment: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
        const row = store.assignments.get(where.userId);
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: { data: { userId: string; role: string; lens: string | null } }) => {
        if (store.assignments.has(data.userId)) throw new Error("Unique constraint failed");
        const row = { id: "assign-1", userId: data.userId, role: data.role, lens: data.lens ?? null };
        store.assignments.set(data.userId, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { userId: string }; data: { lens?: string | null; role?: string } }) => {
        const row = store.assignments.get(where.userId);
        if (!row) throw new Error("not found");
        if ("lens" in data) row.lens = data.lens ?? null;
        if ("role" in data) row.role = data.role ?? row.role;
        return row;
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { userId: string }; create: { userId: string; role: string; lens: string | null }; update: { lens?: string | null; role?: string } }) => {
        const existing = store.assignments.get(where.userId);
        if (!existing) {
          const row = { id: "assign-1", userId: create.userId, role: create.role, lens: create.lens ?? null };
          store.assignments.set(where.userId, row);
          return row;
        }
        if ("lens" in update) existing.lens = update.lens ?? null;
        if ("role" in update && update.role) existing.role = update.role;
        return existing;
      }),
    },
    adminAuditEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `audit-${store.audits.length + 1}`, ...data };
        store.audits.push(row);
        return row;
      }),
    },
    humanReview: {
      create: vi.fn(async () => {
        store.humanReviewWrites += 1;
        return { id: "review" };
      }),
      update: vi.fn(async () => {
        store.humanReviewWrites += 1;
        return { id: "review" };
      }),
      updateMany: vi.fn(async () => {
        store.humanReviewWrites += 1;
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return { prisma: db };
});

import { requireUser } from "@/lib/auth";
import { POST } from "@/app/api/admin/control/lenses/route";

const session = vi.mocked(requireUser);

function post(body: unknown) {
  return POST(new Request("http://localhost/api/admin/control/lenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  store.users.clear();
  store.assignments.clear();
  store.audits.length = 0;
  store.humanReviewWrites = 0;
  vi.clearAllMocks();
  delete process.env.ADMIN_DASHBOARD_EMAILS;
});

it("an admin upsert sets TECHNICAL and writes one audit event", async () => {
  store.users.set("admin-1", { id: "admin-1", email: "admin@example.com", fullName: "Yönetici", isPlatformAdmin: true });
  session.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } } as never);

  const response = await post({ workspaceId: "ws-1", userId: "admin-1", lens: "TECHNICAL" });

  expect(response.status).toBe(200);
  expect(store.assignments.size).toBe(1);
  expect(store.assignments.get("admin-1")).toMatchObject({ role: "ADMIN", lens: "TECHNICAL" });
  expect(store.audits).toHaveLength(1);
  expect(store.audits[0]).toMatchObject({
    action: "lens.assign",
    actorUserId: "admin-1",
    actorRole: "ADMIN",
    targetType: "User",
    targetId: "admin-1",
    workspaceId: "ws-1",
    outcome: "SUCCEEDED",
  });
  expect(store.humanReviewWrites).toBe(0);
});

it("a second save changes the same row to DOMAIN", async () => {
  store.users.set("admin-1", { id: "admin-1", email: "admin@example.com", fullName: "Yönetici", isPlatformAdmin: true });
  session.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } } as never);

  expect((await post({ workspaceId: "ws-1", userId: "admin-1", lens: "TECHNICAL" })).status).toBe(200);
  expect((await post({ workspaceId: "ws-1", userId: "admin-1", lens: "DOMAIN" })).status).toBe(200);

  expect(store.assignments.size).toBe(1);
  expect(store.assignments.get("admin-1")).toMatchObject({ role: "ADMIN", lens: "DOMAIN" });
  expect(store.audits).toHaveLength(2);
  expect(store.humanReviewWrites).toBe(0);
});

it("a reviewer receives 403 and the lens stays unchanged", async () => {
  store.users.set("rev-1", { id: "rev-1", email: "reviewer@example.com", fullName: "İnceleyen", isPlatformAdmin: false });
  store.assignments.set("rev-1", { id: "assign-rev", userId: "rev-1", role: "REVIEWER", lens: null });
  session.mockResolvedValue({ user: { id: "rev-1", email: "reviewer@example.com" } } as never);

  const response = await post({ workspaceId: "ws-1", userId: "rev-1", lens: "SALES" });

  expect(response.status).toBe(403);
  expect(store.assignments.get("rev-1")?.lens).toBeNull();
  expect(store.audits).toHaveLength(0);
  expect(store.humanReviewWrites).toBe(0);
});
