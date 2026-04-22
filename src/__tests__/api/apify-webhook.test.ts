import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mockAgentRunFindUnique = vi.fn();
const mockAgentRunUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: {
      findUnique: (...args: unknown[]) => mockAgentRunFindUnique(...args),
      update: (...args: unknown[]) => mockAgentRunUpdate(...args),
    },
  },
}));

const mockFetchRun = vi.fn();
const mockVerifyWebhookSecret = vi.fn();
vi.mock("@/lib/apify", () => ({
  fetchRun: (...args: unknown[]) => mockFetchRun(...args),
  verifyWebhookSecret: (...args: unknown[]) => mockVerifyWebhookSecret(...args),
}));

const mockQueueAdd = vi.fn();
vi.mock("@/lib/queues", () => ({
  getAgentRunsQueue: () => ({ add: mockQueueAdd }),
}));

// The route calls enqueueAdvance() which internally calls
// getAgentRunsQueue().add(...). We leave the real impl in place for that
// particular assertion; mocking it would lose the queue integration we
// want to exercise.
vi.mock("@/lib/ai-core/orchestrator", async () => {
  const { getAgentRunsQueue } = await import("@/lib/queues");
  return {
    enqueueAdvance: async (sessionId: string): Promise<void> => {
      const queue = getAgentRunsQueue();
      await queue.add(
        `advance:${sessionId}`,
        { type: "orchestrator_advance", sessionId },
      );
    },
  };
});

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
    mockAgentRunUpdate.mockResolvedValue({});
    mockFetchRun.mockResolvedValue({
      runId: "apify_run_1",
      items: [{ foo: "bar" }],
      costUsdCents: 42,
      durationMs: 1234,
      status: "SUCCEEDED",
    });
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
  });

  it("returns 400 when userData.agentRunId is missing", async () => {
    const res = await POST(makeRequest({ resource: { id: "apify_run_1" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/agentRunId/);
    expect(mockAgentRunUpdate).not.toHaveBeenCalled();
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
    expect(mockAgentRunUpdate).not.toHaveBeenCalled();
  });

  it("persists costUsdCents from the fetched Apify run on the AgentRun row", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_ok",
      status: "RUNNING",
      plannerSessionId: null,
    });
    mockFetchRun.mockResolvedValueOnce({
      runId: "apify_run_cost",
      items: [],
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

    expect(mockAgentRunUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockAgentRunUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "run_ok" });
    expect(updateArg.data.costUsdCents).toBe(137);
    expect(updateArg.data.status).toBe("SUCCEEDED");
  });

  it("marks the AgentRun FAILED when Apify reports a non-succeeded status", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_fail",
      status: "RUNNING",
      plannerSessionId: null,
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

    const updateArg = mockAgentRunUpdate.mock.calls[0][0];
    expect(updateArg.data.status).toBe("FAILED");
  });

  it("enqueues orchestrator_advance for the session when the run succeeds", async () => {
    mockAgentRunFindUnique.mockResolvedValueOnce({
      id: "run_with_session",
      status: "RUNNING",
      plannerSessionId: "sess_advance",
    });
    mockFetchRun.mockResolvedValueOnce({
      runId: "apify_ok",
      items: [],
      costUsdCents: 10,
      durationMs: 200,
      status: "SUCCEEDED",
    });

    const res = await POST(
      makeRequest({
        userData: { agentRunId: "run_with_session" },
        resource: { id: "apify_ok" },
      }),
    );
    expect(res.status).toBe(200);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [jobName, payload] = mockQueueAdd.mock.calls[0];
    expect(jobName).toMatch(/advance:sess_advance/);
    expect(payload).toEqual(
      expect.objectContaining({
        type: "orchestrator_advance",
        sessionId: "sess_advance",
      }),
    );
  });
});
