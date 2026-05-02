/**
 * M2 regression - parallel checkout requests created duplicate Stripe
 * customers because both requests hit the `if (!customerId)` branch
 * before either could persist the new ID. The fix passes a
 * deterministic `idempotencyKey` to `customers.create` so Stripe
 * collapses retries server-side, and uses a race-safe `updateMany`
 * with `stripeCustomerId: null` guard so only the first race-winning
 * write sticks.
 */
import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// SKU is set by the global test setup before module load.

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    status = 401;
  }
  const requireUser = vi.fn().mockResolvedValue({
    user: { id: "u_m2", email: "m2@test.com", fullName: null, avatarUrl: null },
    workspaceId: "ws_m2",
    workspace: { id: "ws_m2", name: "T", slug: "t", plan: "FREE" },
    role: "OWNER",
  });
  return { requireUser, UnauthorizedError };
});

vi.mock("@/lib/api-errors", () => ({
  internalError: (_label: string, err: unknown) =>
    NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    ),
}));

const mockWorkspaceFindUniqueOrThrow = vi.fn();
const mockWorkspaceUpdate = vi.fn();
const mockWorkspaceUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUniqueOrThrow: (...a: unknown[]) => mockWorkspaceFindUniqueOrThrow(...a),
      update: (...a: unknown[]) => mockWorkspaceUpdate(...a),
      updateMany: (...a: unknown[]) => mockWorkspaceUpdateMany(...a),
    },
  },
}));

const mockCustomersCreate = vi.fn();
const mockCheckoutCreate = vi.fn();

vi.mock("@/lib/stripe", () => ({
  isBillingEnabled: () => true,
  getStripe: () => ({
    customers: {
      retrieve: vi.fn().mockRejectedValue({ code: "resource_missing" }),
      create: (...a: unknown[]) => mockCustomersCreate(...a),
    },
    checkout: {
      sessions: { create: (...a: unknown[]) => mockCheckoutCreate(...a) },
    },
  }),
}));

import { POST } from "@/app/api/billing/checkout/route";

describe("POST /api/billing/checkout - M2 customer create idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckoutCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/123" });
  });

  it("passes a stable idempotency key derived from workspaceId", async () => {
    // No cached customer; race between two parallel requests on the
    // same workspace. Stripe collapses both create() calls to the same
    // customer object because we send the same idempotencyKey.
    mockWorkspaceFindUniqueOrThrow.mockResolvedValue({
      id: "ws_m2",
      name: "T",
      stripeCustomerId: null,
    });
    mockCustomersCreate.mockResolvedValue({ id: "cus_idempotent_m2" });
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    const req = () =>
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "PRO", currency: "USD", cycle: "monthly" }),
      });

    await Promise.all([POST(req()), POST(req()), POST(req()), POST(req()), POST(req())]);

    // Every customers.create call should carry the same idempotency
    // key. Stripe's contract: identical key + identical body -> same
    // customer object.
    expect(mockCustomersCreate.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of mockCustomersCreate.mock.calls) {
      const opts = call[1] as { idempotencyKey?: string };
      expect(opts?.idempotencyKey).toBe("ws-customer-ws_m2");
    }
  });

  it("uses a race-safe updateMany guarded on stripeCustomerId: null", async () => {
    mockWorkspaceFindUniqueOrThrow
      .mockResolvedValueOnce({ id: "ws_m2", name: "T", stripeCustomerId: null })
      .mockResolvedValueOnce({ stripeCustomerId: "cus_winner" });
    mockCustomersCreate.mockResolvedValue({ id: "cus_loser" });
    mockWorkspaceUpdateMany.mockResolvedValue({ count: 0 }); // someone else won

    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "PRO", currency: "USD", cycle: "monthly" }),
      }),
    );
    expect(res.status).toBe(200);

    // The updateMany must include the stripeCustomerId: null guard so
    // that a parallel request which already wrote the row doesn't get
    // its value clobbered.
    const updateManyArgs = mockWorkspaceUpdateMany.mock.calls[0]?.[0] as {
      where: { stripeCustomerId: string | null };
    };
    expect(updateManyArgs.where.stripeCustomerId).toBeNull();

    // The persisted "winner" customer id should be used for checkout,
    // not the local create() result.
    const checkoutArgs = mockCheckoutCreate.mock.calls[0]?.[0] as {
      customer: string;
    };
    expect(checkoutArgs.customer).toBe("cus_winner");
  });
});
