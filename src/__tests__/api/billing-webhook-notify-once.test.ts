/**
 * H9 regression - subscription.updated fires for many no-op reasons
 * (cancel_at_period_end toggles, default payment method, metadata
 * edits). The webhook used to email "Your plan was updated to PRO"
 * every single time. We now only notify when Workspace.plan actually
 * changed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { signedEvent } from "@/__tests__/_helpers/stripe-webhook";

const PRO_USD = "price_test_pro_usd";

const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();
const mockEventLogCreate = vi.fn();
const notifyMock = vi.fn().mockResolvedValue(undefined);

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
  notifyBillingEvent: (...a: unknown[]) => notifyMock(...a),
}));

import { POST } from "@/app/api/billing/webhook/route";

function buildEvent(eventId: string) {
  return signedEvent(
    {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_h9",
          status: "active",
          customer: "cus_h9",
          metadata: { workspaceId: "ws_h9" },
          current_period_end: 1_900_000_000,
          items: {
            data: [{ price: { id: PRO_USD }, current_period_end: 1_900_000_000 }],
          },
        },
      },
    },
    { id: eventId },
  );
}

describe("billing webhook - H9 notify only on plan change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventLogCreate.mockResolvedValue({});
  });

  it("does NOT notify when the plan is already PRO and the price is still PRO", async () => {
    // Pre-update lookup says we're already on PRO.
    mockFindFirst.mockResolvedValue({ id: "ws_h9", plan: "PRO" });

    const { body, signature } = buildEvent("evt_h9_noop_1");
    const req = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("notifies exactly once when the plan transitions FREE -> PRO", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "ws_h9", plan: "FREE" });

    const { body, signature } = buildEvent("evt_h9_change");
    const req = new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });
});
