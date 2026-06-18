/**
 * WORKSPACE_CONTEXT_EXTRACTOR worker.
 *
 * Mocks Prisma, the SSRF-safe fetcher, and the inference provider so the
 * worker runs pure-in-memory. Covers: graceful skip when no domain, graceful
 * skip when the crawl yields nothing, and the happy path that writes a READY
 * draft with sanitized ICP + packages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface DraftUpsertArgs {
  where: { workspaceId: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

const drafts: DraftUpsertArgs[] = [];
let workspaceRow: Record<string, unknown> | null = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(async () => workspaceRow),
    },
    workspaceOnboardingDraft: {
      upsert: vi.fn(async (args: DraftUpsertArgs) => {
        drafts.push(args);
        return { workspaceId: args.where.workspaceId };
      }),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const fetchMock = vi.fn();
vi.mock("@/lib/safe-fetch", () => ({
  safeFetchFollow: (url: string) => fetchMock(url),
}));

const inferMock = vi.fn();
vi.mock("@/lib/ai-core/providers", () => ({
  getStructuredInferenceProvider: () => ({ structuredInfer: inferMock }),
}));

function htmlResponse(body: string) {
  return {
    response: {
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => body,
    },
    finalUrl: "https://example.com",
    redirectCount: 0,
  };
}

const ctx = {
  workspaceId: "ws-1",
  workspacePlan: "FREE",
  leadId: null,
  userId: "u-1",
} as never;

beforeEach(() => {
  drafts.length = 0;
  workspaceRow = null;
  fetchMock.mockReset();
  inferMock.mockReset();
});

describe("workspace-context-extractor", () => {
  it("skips and marks FAILED when no company domain", async () => {
    workspaceRow = { companyName: null, companyDomain: null, pricingPageUrl: null, name: "Acme" };
    const { run } = await import("@/lib/agent-workers/workspace-context-extractor");
    const out = await run(ctx);
    expect((out.output as { skipped: boolean; reason: string }).reason).toBe("no_company_domain");
    expect(drafts.at(-1)?.update.status).toBe("FAILED");
  });

  it("skips when crawl yields no content", async () => {
    workspaceRow = {
      companyName: "Acme",
      companyDomain: "https://example.com",
      pricingPageUrl: null,
      name: "Acme",
    };
    fetchMock.mockResolvedValue({
      response: { ok: false, headers: { get: () => "text/html" }, text: async () => "" },
      finalUrl: "https://example.com",
      redirectCount: 0,
    });
    const { run } = await import("@/lib/agent-workers/workspace-context-extractor");
    const out = await run(ctx);
    expect((out.output as { reason: string }).reason).toBe("crawl_failed");
    expect(drafts.at(-1)?.update.status).toBe("FAILED");
  });

  it("writes a READY draft on the happy path", async () => {
    workspaceRow = {
      companyName: "Acme",
      companyDomain: "https://example.com",
      pricingPageUrl: "https://example.com/pricing",
      name: "Acme",
    };
    fetchMock.mockResolvedValue(htmlResponse("<h1>We build sites for clinics</h1>"));
    inferMock.mockResolvedValue({
      data: {
        company: { summary: "Web agency", valueProposition: "Fast sites" },
        icp: {
          description: "Clinics needing modern sites",
          highValueSignals: ["legacy site"],
          negativeSignals: ["no budget"],
          confidence: 0.7,
        },
        packages: [
          { name: "Starter", priceLabel: "$499", features: ["1 page"], isPopular: false },
          { name: "Pro", priceLabel: "$1499", features: ["10 pages"], isPopular: true },
        ],
      },
      tokensIn: 100,
      tokensOut: 50,
      modelVersion: "test",
    });

    const { run } = await import("@/lib/agent-workers/workspace-context-extractor");
    const out = await run(ctx);

    const last = drafts.at(-1)!;
    expect(last.update.status).toBe("READY");
    const icp = last.update.icpDraftJson as { description: string; highValueSignals: string[] };
    expect(icp.description).toBe("Clinics needing modern sites");
    expect(icp.highValueSignals).toContain("legacy site");
    const pkgs = last.update.packagesDraftJson as Array<{ name: string }>;
    expect(pkgs.map((p) => p.name)).toEqual(["Starter", "Pro"]);
    expect((out.output as { packagesFound: number }).packagesFound).toBe(2);
    expect(out.costTokens).toBe(150);
  });
});
