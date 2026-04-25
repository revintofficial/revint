/**
 * Unit tests for POST /api/webhooks/apify.
 *
 * After the move to `mode: "async-apify"` workers, the route's job
 * narrowed to: verify secret -> validate payload -> dedupe terminal
 * runs -> fetch the Apify run -> dispatch into
 * `finalizeApifyAgentRun(runId, payload)`. The actual persistence
 * (status flip, costUsdCents, memoryWrites, orchestrator advance)
 * lives in `finalizeApifyAgentRun` itself; tests for that behavior
 * belong next to the executor.
 *
 * So these tests focus on the routing contract and stub
 * `finalizeApifyAgentRun` to assert it received the right payload.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mockAgentRunFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: {
      findUnique: (...args: unknown[]) => mockAgentRunFindUnique(...args),
    },
  },
}));

const mockFetchRun = vi.fn();
const mockVerifyWebhookSecret = vi.fn();
vi.mock("@/lib/apify", () => ({
  fetchRun: (...args: unknown[]) => mockFetchRun(...args),
  verifyWebhookSecret: (...args: unknown[]) => mockVerifyWebhookSecret(...args),
}));

const mockFinalizeApifyAgentRun = vi.fn();
vi.mock("@/lib/agent-workers/execute", () => ({
  finalizeApifyAgentRun: (...args: unknown[]) => mockFinalizeApifyAgentRun(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "@/app/api/webhooks/apify/route";

function makeRequest(body: unknown, opts: { secret?: string | null } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.secret !== null && opts.secret !== undefined) {
    headers["x-apify-webhook-secret"] = opts.secret;
  }
  return new Request("http://localhost:3000/api/webhooks/apify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/apify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWebhookSecret.mockReturnValue(true);
    mockAgentRunFindUnique.mockResolvedValue(null);
    mockFetchRun.mockResolvedValue({
      runId: "apify_run_1",
      items: [{ foo: "bar" }],
      costUsdCents: 42,
      durationMs: 1234,
      status: "SUCCEEDED",
    });
    mockFinalizeApifyAgentRun.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when the webhook secret is invalid", async () => {
    mockVerifyWebhookSecret.mockReturnValueOnce(false);

    const res = await POST(
      makeRequest({ userData: { agentRunId: "run_1" } }, { secret: "wrong" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid secret/i);
    expect(mockAgentRunFindUnique).not.toHaveBeenCalled();
    expect(mockFinalizeApifyAgentRun).not.toHaveBeenCalled();
  });

  it("returns 400 when userData.agentRunId is missing", async () => {
    const res = await POST(makeRequest({ resource: { id: "apify_run_1" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/agentRunId/);
    expect(mockFinalizeApifyAgentRun).not.toHaveBeenCalled();
  });

  it("returns 400 when resource.id (apifyRunId) is missing", async () => {
    const res = await POST(
      makeRequest({ userData: { agentRunId: "run_1" } }),
    );
    expect(res.status).toBe(400);
    expect(mockFinalizeApifyAgentRun).not.toHaveBeenCalled();
  });

  it("returns 404 when the agentRunId is unknown", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce(null);
    const res = await POST(
      makeRequest({
        userData: { agentRunId: "run_missing" },
        resource: { id: "apify_run_1" },
      }),
    );
    expect(res.status).toBe(404);
    expect(mockFinalizeApifyAgentRun).not.toHaveBeenCalled();
  });

  it("dedupes terminal runs without dispatching to finalize", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_terminal",
      status: "SUCCEEDED",
      plannerSessionId: null,
      workerKind: "APIFY_SERP_RANK",
    });

    const res = await POST(
      makeRequest({
        userData: { agentRunId: "run_terminal" },
        resource: { id: "apify_run_1" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deduped).toBe(true);
    expect(mockFetchRun).not.toHaveBeenCalled();
    expect(mockFinalizeApifyAgentRun).not.toHaveBeenCalled();
  });

  it("returns 202 retryable when fetchRun fails - keeps the run RUNNING for next delivery", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_fetch_fail",
      status: "RUNNING",
      plannerSessionId: null,
      workerKind: "APIFY_SERP_RANK",
    });
    mockFetchRun.mockRejectedValueOnce(new Error("apify 503"));

    const res = await POST(
      makeRequest({
        userData: { agentRunId: "run_fetch_fail" },
        resource: { id: "apify_run_fetch_fail" },
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, retryable: true });
    expect(mockFinalizeApifyAgentRun).not.toHaveBeenCalled();
  });

  it("dispatches to finalizeApifyAgentRun with the Apify run payload on success", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_ok",
      status: "RUNNING",
      plannerSessionId: null,
      workerKind: "APIFY_SERP_RANK",
    });
    mockFetchRun.mockResolvedValueOnce({
      runId: "apify_run_cost",
      items: [{ x: 1 }, { x: 2 }],
      costUsdCents: 137,
      durationMs: 500,
      status: "SUCCEEDED",
    });

    const res = await POST(
      makeRequest({
        userData: { agentRunId: "run_ok" },
        resource: { id: "apify_run_cost" },
      }),
    );
    expect(res.status).toBe(200);

    expect(mockFinalizeApifyAgentRun).toHaveBeenCalledTimes(1);
    const [runId, payload] = mockFinalizeApifyAgentRun.mock.calls[0];
    expect(runId).toBe("run_ok");
    expect(payload).toMatchObject({
      apifyRunId: "apify_run_cost",
      items: [{ x: 1 }, { x: 2 }],
      costUsdCents: 137,
      status: "SUCCEEDED",
    });
  });

  it("forwards a non-succeeded Apify status verbatim to finalizeApifyAgentRun", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_fail",
      status: "RUNNING",
      plannerSessionId: null,
      workerKind: "APIFY_SERP_RANK",
    });
    mockFetchRun.mockResolvedValueOnce({
      runId: "apify_run_fail",
      items: [],
      costUsdCents: 5,
      durationMs: 99,
      status: "FAILED",
    });

    const res = await POST(
      makeRequest({
        userData: { agentRunId: "run_fail" },
        resource: { id: "apify_run_fail" },
      }),
    );
    expect(res.status).toBe(200);

    const [, payload] = mockFinalizeApifyAgentRun.mock.calls[0];
    expect(payload.status).toBe("FAILED");
    expect(payload.costUsdCents).toBe(5);
  });
});
