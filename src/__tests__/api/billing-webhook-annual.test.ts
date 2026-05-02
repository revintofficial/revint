/**
 * H1 regression - annual price IDs were not detected by the webhook.
 *
 * Before this fix the webhook's `detectPlanFromPriceId` only walked
 * `priceIds.USD/GBP` so anyone who clicked "Annual" on the pricing
 * page got a Stripe subscription against a `STRIPE_PRICE_PRO_ANNUAL_*`
 * SKU but their `Workspace.plan` stayed put. Symptom: paying customer,
 * FREE quota.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { signedEvent } from "@/__tests__/_helpers/stripe-webhook";

// Annual PRO SKU is set by the global test setup so PLANS reads it at
// module load. Don't reassign here; the constant must match
// `PRICE_DEFAULTS.STRIPE_PRICE_PRO_ANNUAL_USD`.
const ANNUAL_PRO_USD = "price_test_pro_annual_usd";

const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();
const mockSubsRetrieve = vi.fn();
const mockEventLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      update: (...a: unknown[]) => mockUpdate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
    stripeEventLog: {
      create: (...a: unknown[]) => mockEventLogCreate(...a),
      delete: async () => undefined,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      // Bypass real signature verification - we already exercised it
      // separately. Here we want to assert the routing/plan-detection
      // path, not the HMAC.
      constructEvent: (body: string) => JSON.parse(body),
    },
    subscriptions: {
      retrieve: (...a: unknown[]) => mockSubsRetrieve(...a),
    },
  }),
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyBillingEvent: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/billing/webhook/route";

describe("billing webhook - H1 annual price detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventLogCreate.mockResolvedValue({});
  });

  it("upgrades workspace.plan to PRO when checkout completes against an annual PRO price ID", async () => {
    mockSubsRetrieve.mockResolvedValueOnce({
      id: "sub_h1",
      customer: "cus_h1",
      current_period_end: 1_900_000_000,
      items: {
        data: [
          {
            price: { id: ANNUAL_PRO_USD },
            current_period_end: 1_900_000_000,
          },
        ],
      },
    });

    const { body, signature } = signedEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_h1",
          metadata: { workspaceId: "ws_h1" },
          subscription: "sub_h1",
          customer: "cus_h1",
        },
      },
    });

    const req = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const call = mockUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { plan?: string };
    };
    expect(call.where.id).toBe("ws_h1");
    expect(call.data.plan).toBe("PRO");
  });
});
