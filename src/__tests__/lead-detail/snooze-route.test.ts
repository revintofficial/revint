/**
 * Phase 3 — POST /api/leads/[id]/snooze integration test.
 *
 * Multi-tenant guard (PLAN §6 highest-severity bug class):
 *   Workspace A may not snooze workspace B's lead. We seed two
 *   workspaces and assert cross-tenant requests return 404 (NEVER
 *   200, NEVER 401/403 — we never confirm foreign-workspace existence).
 *
 * Also covers:
 *   - Body validation: invalid duration, missing trigger type, past date.
 *   - "Until trigger" cap to 90 days (PLAN §4 line 244 safety cap).
 *   - Idempotent re-snooze: re-applying the same snooze returns
 *     `{ unchanged: true }` and skips the write transaction.
 *   - LeadActivity row written with kind=SNOOZED and the triggerType.
 *   - 401 surfaces when requireUser throws.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: (...args: unknown[]) => mockRequireUser(...args),
    UnauthorizedError,
  };
});

interface FakeLead {
  id: string;
  workspaceId: string;
  snoozeUntil: Date | null;
  snoozeUntilTriggerType: string | null;
}

let leads: FakeLead[] = [];
let activities: Array<{
  workspaceId: string;
  leadId: string;
  kind: string;
  payload: Record<string, unknown>;
}> = [];
let txCalls = 0;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(
        async (args: { where: { id: string; workspaceId: string } }) =>
          leads.find(
            (l) =>
              l.id === args.where.id && l.workspaceId === args.where.workspaceId,
          ) ?? null,
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: { snoozeUntil: Date | null; snoozeUntilTriggerType: string | null };
        }) => {
          const lead = leads.find((l) => l.id === args.where.id);
          if (!lead) throw new Error("not found");
          lead.snoozeUntil = args.data.snoozeUntil;
          lead.snoozeUntilTriggerType = args.data.snoozeUntilTriggerType;
          return lead;
        },
      ),
    },
    leadActivity: {
      create: vi.fn(
        async (args: {
          data: {
            workspaceId: string;
            leadId: string;
            kind: string;
            payload: Record<string, unknown>;
          };
        }) => {
          activities.push(args.data);
          return { id: `act_${activities.length}` };
        },
      ),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      txCalls += 1;
      return Promise.all(promises);
    }),
  },
}));

import { POST } from "@/app/api/leads/[id]/snooze/route";

const wsA = "ws_a";
const wsB = "ws_b";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/leads/x/snooze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body == null ? null : JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setSession(workspaceId: string) {
  mockRequireUser.mockResolvedValue({
    user: { id: "u1", email: "u@u.com", fullName: null, avatarUrl: null },
    workspaceId,
    workspace: { id: workspaceId, name: "T", slug: "t", plan: "PRO" },
    role: "OWNER",
  });
}

beforeEach(() => {
  leads = [];
  activities = [];
  txCalls = 0;
  mockRequireUser.mockReset();
});

describe("POST /api/leads/[id]/snooze — multi-tenant guard", () => {
  it("returns 404 when workspace A snoozes a workspace B lead", async () => {
    leads.push({
      id: "lead_b",
      workspaceId: wsB,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    setSession(wsA);
    const res = await POST(
      makeReq({ kind: "duration", days: 1 }),
      makeParams("lead_b"),
    );
    expect(res.status).toBe(404);
  });

  it("never confirms foreign-workspace existence (404, not 403)", async () => {
    leads.push({
      id: "lead_b",
      workspaceId: wsB,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    setSession(wsA);
    const res = await POST(
      makeReq({ kind: "duration", days: 3 }),
      makeParams("lead_b"),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/leads/[id]/snooze — body validation", () => {
  beforeEach(() => {
    leads.push({
      id: "lead_a",
      workspaceId: wsA,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    setSession(wsA);
  });

  it("rejects invalid duration days (must be 1, 3, or 7)", async () => {
    const res = await POST(
      makeReq({ kind: "duration", days: 5 }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("invalid_days");
  });

  it("rejects past dates on custom kind", async () => {
    const res = await POST(
      makeReq({ kind: "custom", until: "2020-01-01T00:00:00Z" }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("until_must_be_future");
  });

  it("rejects invalid trigger types", async () => {
    const res = await POST(
      makeReq({ kind: "until_trigger", triggerType: "NOT_A_TRIGGER" }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("invalid_trigger_type");
  });

  it("rejects unknown kind", async () => {
    const res = await POST(
      makeReq({ kind: "forever" }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing body", async () => {
    const res = await POST(makeReq(null), makeParams("lead_a"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/leads/[id]/snooze — until trigger 90-day cap", () => {
  beforeEach(() => {
    leads.push({
      id: "lead_a",
      workspaceId: wsA,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    setSession(wsA);
  });

  it("caps the wake date to 90 days when maxHorizonDays is omitted", async () => {
    const res = await POST(
      makeReq({ kind: "until_trigger", triggerType: "RATING_DROP" }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      snoozeUntil: string;
      snoozeUntilTriggerType: string;
    };
    const wakeMs = new Date(json.snoozeUntil).getTime();
    const expectedMs = Date.now() + 90 * 24 * 60 * 60 * 1000;
    // Within 1500ms tolerance for clock drift between request + assertion.
    expect(Math.abs(wakeMs - expectedMs)).toBeLessThan(2500);
    expect(json.snoozeUntilTriggerType).toBe("RATING_DROP");
  });

  it("clamps a > 90-day requested horizon back to 90 days", async () => {
    const res = await POST(
      makeReq({
        kind: "until_trigger",
        triggerType: "FUNDING_RAISED",
        maxHorizonDays: 365,
      }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { snoozeUntil: string };
    const wakeMs = new Date(json.snoozeUntil).getTime();
    const expectedMs = Date.now() + 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(wakeMs - expectedMs)).toBeLessThan(2500);
  });

  it("respects a smaller requested maxHorizonDays", async () => {
    const res = await POST(
      makeReq({
        kind: "until_trigger",
        triggerType: "HIRING_MARKETING",
        maxHorizonDays: 14,
      }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { snoozeUntil: string };
    const wakeMs = new Date(json.snoozeUntil).getTime();
    const expectedMs = Date.now() + 14 * 24 * 60 * 60 * 1000;
    expect(Math.abs(wakeMs - expectedMs)).toBeLessThan(2500);
  });
});

describe("POST /api/leads/[id]/snooze — idempotent re-snooze", () => {
  it("returns unchanged=true when the same trigger-type+date is reapplied", async () => {
    const wakeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    leads.push({
      id: "lead_a",
      workspaceId: wsA,
      snoozeUntil: wakeAt,
      snoozeUntilTriggerType: "RATING_DROP",
    });
    setSession(wsA);
    const res = await POST(
      makeReq({ kind: "until_trigger", triggerType: "RATING_DROP", maxHorizonDays: 7 }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { unchanged: boolean };
    expect(json.unchanged).toBe(true);
    expect(txCalls).toBe(0);
    expect(activities).toHaveLength(0);
  });

  it("performs the write when the wake-date differs", async () => {
    leads.push({
      id: "lead_a",
      workspaceId: wsA,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    setSession(wsA);
    const res = await POST(
      makeReq({ kind: "duration", days: 3 }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { unchanged: boolean };
    expect(json.unchanged).toBe(false);
    expect(txCalls).toBe(1);
    expect(activities).toHaveLength(1);
    expect(activities[0].kind).toBe("SNOOZED");
  });
});

describe("POST /api/leads/[id]/snooze — Phase 8 review-volume allowlist", () => {
  beforeEach(() => {
    leads.push({
      id: "lead_a",
      workspaceId: wsA,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    setSession(wsA);
  });

  it("accepts REVIEW_VOLUME_SURGE as a valid 'until trigger' type", async () => {
    const res = await POST(
      makeReq({
        kind: "until_trigger",
        triggerType: "REVIEW_VOLUME_SURGE",
        maxHorizonDays: 30,
      }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { snoozeUntilTriggerType: string };
    expect(json.snoozeUntilTriggerType).toBe("REVIEW_VOLUME_SURGE");
  });

  it("accepts REVIEW_VOLUME_DIP as a valid 'until trigger' type", async () => {
    const res = await POST(
      makeReq({
        kind: "until_trigger",
        triggerType: "REVIEW_VOLUME_DIP",
        maxHorizonDays: 30,
      }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { snoozeUntilTriggerType: string };
    expect(json.snoozeUntilTriggerType).toBe("REVIEW_VOLUME_DIP");
  });
});

describe("POST /api/leads/[id]/snooze — auth", () => {
  it("returns 401 when requireUser throws Unauthorized", async () => {
    leads.push({
      id: "lead_a",
      workspaceId: wsA,
      snoozeUntil: null,
      snoozeUntilTriggerType: null,
    });
    const auth = await import("@/lib/auth");
    mockRequireUser.mockRejectedValue(new auth.UnauthorizedError("nope"));
    const res = await POST(
      makeReq({ kind: "duration", days: 1 }),
      makeParams("lead_a"),
    );
    expect(res.status).toBe(401);
  });
});
