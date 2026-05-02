/**
 * H2 regression - subscription.updated with status=unpaid/canceled
 * left Workspace.plan untouched so a customer whose card stopped
 * working continued to receive PRO/AGENCY entitlements indefinitely.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { signedEvent } from "@/__tests__/_helpers/stripe-webhook";

const PRO_USD = "price_test_pro_usd";

const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();
const mockEventLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      update: vi.fn(),
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
    subscriptions: { retrieve: vi.fn() },
  }),
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyBillingEvent: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/billing/webhook/route";

describe("billing webhook - H2 status downgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventLogCreate.mockResolvedValue({});
  });

  it("downgrades to FREE when subscription status flips to unpaid", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ws_h2", plan: "PRO" });

    const { body, signature } = signedEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_h2",
          status: "unpaid",
          customer: "cus_h2",
          metadata: { workspaceId: "ws_h2" },
          current_period_end: 1_900_000_000,
          items: {
            data: [{ price: { id: PRO_USD }, current_period_end: 1_900_000_000 }],
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

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const call = mockUpdateMany.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { plan: string };
    };
    expect(call.where.id).toBe("ws_h2");
    expect(call.data.plan).toBe("FREE");
  });

  it("downgrades to FREE when subscription status flips to canceled", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ws_h2c", plan: "AGENCY" });

    const { body, signature } = signedEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_h2c",
          status: "canceled",
          customer: "cus_h2c",
          metadata: { workspaceId: "ws_h2c" },
          current_period_end: 1_900_000_000,
          items: {
            data: [{ price: { id: PRO_USD }, current_period_end: 1_900_000_000 }],
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
      data: { plan: string };
    };
    expect(call.data.plan).toBe("FREE");
  });

  it("does NOT downgrade on past_due (Stripe smart retries still in flight)", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ws_h2p", plan: "PRO" });

    const { body, signature } = signedEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_h2p",
          status: "past_due",
          customer: "cus_h2p",
          metadata: { workspaceId: "ws_h2p" },
          current_period_end: 1_900_000_000,
          items: {
            data: [{ price: { id: PRO_USD }, current_period_end: 1_900_000_000 }],
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
      data: { plan: string };
    };
    expect(call.data.plan).toBe("PRO");
  });
});
