/**
 * M12 + M13 regression - telephony webhook tenant scoping and
 * idempotency.
 *
 * M12: the OLD impl trusted a single shared TELEPHONY_WEBHOOK_TOKEN
 *      env var + an attacker-controlled `?workspaceId=...` query
 *      param. Anyone with the global token could write activities
 *      into any tenant. The NEW impl resolves the workspace by
 *      looking up the per-workspace `Workspace.telephonyWebhookSecret`
 *      and refuses any token that doesn't match a row.
 *
 * M13: the OLD impl pre-checked dedup via JSON-path findFirst on
 *      `payload.externalCallId`, then created. Two parallel
 *      webhook deliveries could both pass the pre-check and double
 *      insert. The NEW impl relies on the @@unique([workspaceId,
 *      leadId, kind, externalCallId]) DB constraint and maps P2002
 *      to a 200 deduped response.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const workspaceFindFirstMock = vi.fn();
const leadFindFirstMock = vi.fn();
const leadActivityCreateMock = vi.fn();
const leadUpdateMock = vi.fn();
const txMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findFirst: (...a: unknown[]) => workspaceFindFirstMock(...a),
    },
    lead: {
      findFirst: (...a: unknown[]) => leadFindFirstMock(...a),
      update: (...a: unknown[]) => leadUpdateMock(...a),
    },
    leadActivity: {
      create: (...a: unknown[]) => leadActivityCreateMock(...a),
    },
    $transaction: (...a: unknown[]) => txMock(...a),
  },
}));

vi.mock("@/lib/telephony/normalize", () => ({
  normalizeByProvider: vi.fn((_provider: string, _payload: unknown) => ({
    disposition: "ANSWERED_INTERESTED",
    externalCallId: "twilio_call_abc",
    toNumber: "+15555551212",
    fromNumber: null,
    durationSec: 120,
    recordingUrl: null,
    agentExternalId: "agent_1",
    notes: null,
  })),
}));

import { POST } from "@/app/api/webhooks/telephony/[provider]/route";

function makeReq(token: string, body: object = {}) {
  return new Request(
    `http://localhost/api/webhooks/telephony/twilio?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("M12 - telephony webhook resolves workspace from per-workspace secret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadFindFirstMock.mockResolvedValue({ id: "lead_x", dnc: false });
    txMock.mockResolvedValue([{}, { id: "act_1" }]);
  });

  it("rejects a request with no token", async () => {
    const req = new Request("http://localhost/api/webhooks/telephony/twilio", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ provider: "twilio" }) });
    expect(res.status).toBe(401);
    expect(workspaceFindFirstMock).not.toHaveBeenCalled();
  });

  it("rejects a token that doesn't resolve to a workspace", async () => {
    workspaceFindFirstMock.mockResolvedValueOnce(null);

    const res = await POST(makeReq("not-a-real-secret"), {
      params: Promise.resolve({ provider: "twilio" }),
    });
    expect(res.status).toBe(401);
    expect(leadFindFirstMock).not.toHaveBeenCalled();
  });

  it("resolves workspace from token and ignores any caller-supplied workspaceId", async () => {
    workspaceFindFirstMock.mockResolvedValueOnce({ id: "ws_legit_owner" });

    // Caller tries to claim a different workspace via query param.
    const req = new Request(
      "http://localhost/api/webhooks/telephony/twilio?token=secret_for_owner&workspaceId=ws_attacker_target",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    await POST(req, { params: Promise.resolve({ provider: "twilio" }) });

    // The lead lookup MUST use the workspace resolved from the
    // token, NOT the workspaceId from the query string.
    expect(leadFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws_legit_owner" }),
      }),
    );
  });

  it("rejects an unknown provider with 404", async () => {
    const res = await POST(makeReq("anything"), {
      params: Promise.resolve({ provider: "evilprov" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("M13 - telephony webhook idempotency via DB constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceFindFirstMock.mockResolvedValue({ id: "ws_dedup" });
    leadFindFirstMock.mockResolvedValue({ id: "lead_dedup", dnc: false });
  });

  it("happy path: P2002 -> 200 deduped (idempotent retry)", async () => {
    txMock.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint violated"), { code: "P2002" }),
    );

    const res = await POST(makeReq("ws_secret"), {
      params: Promise.resolve({ provider: "twilio" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deduped).toBe(true);
  });

  it("first delivery: tx succeeds -> 200 with leadId/disposition", async () => {
    txMock.mockResolvedValueOnce([{}, { id: "act_first" }]);

    const res = await POST(makeReq("ws_secret"), {
      params: Promise.resolve({ provider: "twilio" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leadId).toBe("lead_dedup");
    expect(body.disposition).toBe("ANSWERED_INTERESTED");
    expect(body.deduped).toBeUndefined();
  });

  it("non-P2002 error (e.g. DB connection lost) -> 500 (not silently swallowed)", async () => {
    txMock.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await POST(makeReq("ws_secret"), {
      params: Promise.resolve({ provider: "twilio" }),
    });
    expect(res.status).toBe(500);
  });
});
