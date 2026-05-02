/**
 * H3 regression - Stripe v22 split current_period_end between
 * `Subscription.current_period_end` (legacy) and
 * `Subscription.items.data[0].current_period_end` (new). The webhook
 * was only reading the parent field, so newer subscriptions that only
 * populate the item-level field landed `currentPeriodEnd = null` and
 * cycle reset never fired.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { signedEvent } from "@/__tests__/_helpers/stripe-webhook";

const PRO_USD = "price_test_pro_usd";

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
    webhooks: { constructEvent: (body: string) => JSON.parse(body) },
    subscriptions: { retrieve: (...a: unknown[]) => mockSubsRetrieve(...a) },
  }),
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyBillingEvent: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/billing/webhook/route";

describe("billing webhook - H3 period_end fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventLogCreate.mockResolvedValue({});
  });

  it("uses items.data[0].current_period_end when parent is null", async () => {
    const itemEnd = 1_950_000_000;
    mockSubsRetrieve.mockResolvedValueOnce({
      id: "sub_h3",
      customer: "cus_h3",
      // Parent is null - newer Stripe behaviour.
      current_period_end: null,
      items: {
        data: [
          {
            price: { id: PRO_USD },
            current_period_end: itemEnd,
          },
        ],
      },
    });

    const { body, signature } = signedEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_h3",
          metadata: { workspaceId: "ws_h3" },
          subscription: "sub_h3",
          customer: "cus_h3",
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

    const call = mockUpdate.mock.calls[0]?.[0] as {
      data: { currentPeriodEnd: Date | null };
    };
    expect(call.data.currentPeriodEnd).toBeInstanceOf(Date);
    expect((call.data.currentPeriodEnd as Date).getTime()).toBe(itemEnd * 1000);
  });

  it("subscription.updated reads item-level period_end too", async () => {
    const itemEnd = 1_960_000_000;
    mockFindFirst.mockResolvedValueOnce({ id: "ws_h3u", plan: "PRO" });

    const { body, signature } = signedEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_h3u",
          status: "active",
          customer: "cus_h3u",
          metadata: { workspaceId: "ws_h3u" },
          current_period_end: null,
          items: {
            data: [{ price: { id: PRO_USD }, current_period_end: itemEnd }],
          },
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

    const call = mockUpdateMany.mock.calls[0]?.[0] as {
      data: { currentPeriodEnd: Date; cycleResetAt: Date };
    };
    expect(call.data.currentPeriodEnd.getTime()).toBe(itemEnd * 1000);
    // M3 - cycleResetAt should also be in sync
    expect(call.data.cycleResetAt.getTime()).toBe(itemEnd * 1000);
  });
});
