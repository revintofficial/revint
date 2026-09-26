// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    platformRoleAssignment: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  class ForbiddenError extends Error {
    status = 403;
  }
  return { requireUser: vi.fn(), UnauthorizedError, ForbiddenError };
});

import { prisma } from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError, requireUser } from "@/lib/auth";
import { requireControlRole, resolveControlRole, roleAtLeast } from "@/lib/control/roles";

const adminFlag = vi.mocked(prisma.user.findUnique);
const assignment = vi.mocked(prisma.platformRoleAssignment.findUnique);
const session = vi.mocked(requireUser);
const originalAllowlist = process.env.ADMIN_DASHBOARD_EMAILS;

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.ADMIN_DASHBOARD_EMAILS;
  adminFlag.mockResolvedValue({ isPlatformAdmin: false } as never);
  assignment.mockResolvedValue(null);
});

afterEach(() => {
  if (originalAllowlist === undefined) delete process.env.ADMIN_DASHBOARD_EMAILS;
  else process.env.ADMIN_DASHBOARD_EMAILS = originalAllowlist;
});

describe("resolveControlRole", () => {
  it("treats isPlatformAdmin as ADMIN ahead of an assignment", async () => {
    adminFlag.mockResolvedValue({ isPlatformAdmin: true } as never);
    assignment.mockResolvedValue({ role: "VIEWER" } as never);
    await expect(resolveControlRole("user-1", "a@b.co")).resolves.toBe("ADMIN");
    expect(assignment).not.toHaveBeenCalled();
  });

  it("treats an allowlisted email as ADMIN ahead of an assignment", async () => {
    process.env.ADMIN_DASHBOARD_EMAILS = " other@x.co, Founder@Example.com ";
    assignment.mockResolvedValue({ role: "REVIEWER" } as never);
    await expect(resolveControlRole("user-2", "FOUNDER@example.com")).resolves.toBe("ADMIN");
    expect(assignment).not.toHaveBeenCalled();
  });

  it("returns the assignment when the user is not a bootstrap admin", async () => {
    assignment.mockResolvedValue({ role: "REVIEWER" } as never);
    await expect(resolveControlRole("user-3", "c@d.co")).resolves.toBe("REVIEWER");
    expect(assignment).toHaveBeenCalledWith({ where: { userId: "user-3" }, select: { role: true } });
  });

  it("returns null when there is no assignment or allowlist", async () => {
    await expect(resolveControlRole("user-4", "nobody@example.com")).resolves.toBeNull();
  });
});

describe("roleAtLeast", () => {
  it("orders VIEWER, REVIEWER, ADMIN", () => {
    expect(roleAtLeast("VIEWER", "VIEWER")).toBe(true);
    expect(roleAtLeast("VIEWER", "REVIEWER")).toBe(false);
    expect(roleAtLeast("REVIEWER", "ADMIN")).toBe(false);
    expect(roleAtLeast("ADMIN", "REVIEWER")).toBe(true);
  });
});

describe("requireControlRole", () => {
  it("preserves UnauthorizedError when there is no session", async () => {
    session.mockRejectedValue(new UnauthorizedError("Unauthorized"));
    await expect(requireControlRole("VIEWER")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(adminFlag).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user with no role", async () => {
    session.mockResolvedValue({ user: { id: "user-5", email: "nobody@example.com" } } as never);
    await expect(requireControlRole("VIEWER")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a role below the minimum", async () => {
    session.mockResolvedValue({ user: { id: "user-6", email: "viewer@example.com" } } as never);
    assignment.mockResolvedValue({ role: "VIEWER" } as never);
    await expect(requireControlRole("REVIEWER")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns user details and the resolved role when authorized", async () => {
    session.mockResolvedValue({ user: { id: "user-7", email: "reviewer@example.com" } } as never);
    assignment.mockResolvedValue({ role: "REVIEWER" } as never);
    await expect(requireControlRole("VIEWER")).resolves.toEqual({
      userId: "user-7", email: "reviewer@example.com", role: "REVIEWER",
    });
  });
});
