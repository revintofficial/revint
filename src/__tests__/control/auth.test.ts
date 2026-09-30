// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/lib/control/roles", () => ({ requireControlRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("@/lib/auth", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));
vi.mock("@/lib/api-errors", () => ({ internalError: () => Response.json({ error: "Internal error" }, { status: 500 }) }));

describe("withControlAuth", () => {
  it("returns 401 before the handler for an anonymous caller", async () => {
    const { withControlAuth } = await import("@/lib/control/api");
    const { UnauthorizedError } = await import("@/lib/auth");
    requireRole.mockRejectedValueOnce(new UnauthorizedError());
    const handler = vi.fn();
    const response = await withControlAuth("ADMIN", handler)();
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 before the handler for a reviewer", async () => {
    const { withControlAuth } = await import("@/lib/control/api");
    const { ForbiddenError } = await import("@/lib/auth");
    requireRole.mockRejectedValueOnce(new ForbiddenError("Control access required"));
    const handler = vi.fn();
    const response = await withControlAuth("ADMIN", handler)();
    expect(response.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith("ADMIN");
    expect(handler).not.toHaveBeenCalled();
  });
});
