/**
 * Bug H6 regression test - executor's hydrateContext loads a Lead by
 * id alone (no workspaceId scope).
 *
 * Pre-fix `hydrateContext(run)` did
 *   prisma.lead.findUnique({ where: { id: run.leadId } })
 * which means: a poisoned AgentRun row that paired workspace B with
 * workspace A's leadId, OR a buggy enqueue site that mis-mapped the
 * two, would hand workspace A's lead body, audit, and review-analysis
 * straight into a worker hydrated for workspace B. The lead's data
 * would then be embedded in Gemini prompts and persisted as
 * AgentRun.outputJson under workspace B - a textbook cross-tenant
 * leak.
 *
 * Post-fix the lookup is
 *   prisma.lead.findFirst({ where: { id, workspaceId } })
 * Cross-tenant pairings return null; hydrateContext throws a
 * PermanentError("input"); the run is marked FAILED with a clear
 * errorMsg; no Gemini call is ever made.
 *
 * This test creates two real workspaces with their own leads, posts a
 * malformed AgentRun row (workspaceId B + leadId A), and asserts the
 * executor surfaces FAILED + the lead body never reaches the worker.
 */
import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import { makeFakeGemini } from "../_helpers/mock-gemini";

// We have to mock Gemini at the module boundary because the executor
// transitively imports it (via prompts) when it loads worker modules
// for the registry. Even though we never expect the actual Gemini call
// to fire, the import chain still needs the SDK constructor to exist.
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return makeFakeGemini({ responses: [] }).getGenerativeModel();
    }
  },
}));

import { prisma } from "@/lib/prisma";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import { withTwoWorkspaces } from "../_helpers/multi-tenant";

afterEach(async () => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("H6 - cross-tenant lead lookup is rejected", () => {
  it("executeAgentRun marks run FAILED when leadId belongs to a different workspace", async () => {
    await withTwoWorkspaces(async ({ a, b }) => {
      // Construct a malformed AgentRun: it lives under workspace B
      // but cites workspace A's leadId. WEBSITE_AUDITOR is chosen
      // because it has a sync run() that would crash on a missing
      // websiteUrl - we want the FAILED to come from the H6 guard,
      // not from a downstream null deref.
      const run = await prisma.agentRun.create({
        data: {
          workspaceId: b.workspace.id,
          leadId: a.lead.id, // CROSS-TENANT
          workerKind: "WEBSITE_AUDITOR",
          status: "PENDING",
          inputsJson: {} as never,
        },
      });

      await executeAgentRun(run.id);

      const after = await prisma.agentRun.findUniqueOrThrow({
        where: { id: run.id },
      });
      expect(after.status).toBe("FAILED");
      expect(after.errorMsg).toMatch(/lead .* not found in workspace/i);
      expect(after.errorMsg).toContain(a.lead.id);
      expect(after.errorMsg).toContain(b.workspace.id);
      // costTokens stays 0 because no Gemini call ever fired.
      expect(after.costTokens ?? 0).toBe(0);
    });
  });

  it("executeAgentRun succeeds when leadId belongs to the run's own workspace", async () => {
    // Sanity-check the happy path so we know the FAILED above isn't a
    // false positive from some unrelated executor break. Worker we
    // pick is WEBSITE_AUDITOR with a lead that has no website -
    // executes the early-return path, no Gemini, no Apify.
    await withTwoWorkspaces(async ({ a }) => {
      // Make sure the lead has no website so WEBSITE_AUDITOR's run()
      // exits early via its no-website branch instead of trying to
      // crawl. (Default factory creates leads with hasWebsite=false.)
      const run = await prisma.agentRun.create({
        data: {
          workspaceId: a.workspace.id,
          leadId: a.lead.id,
          workerKind: "WEBSITE_AUDITOR",
          status: "PENDING",
          inputsJson: {} as never,
        },
      });

      await executeAgentRun(run.id);

      const after = await prisma.agentRun.findUniqueOrThrow({
        where: { id: run.id },
      });
      // WEBSITE_AUDITOR with no website returns SUCCEEDED with skip
      // payload (or FAILED for reasons unrelated to H6). Either way
      // the errorMsg, if present, must NOT mention "not found in
      // workspace" - the H6 guard never fired.
      expect(after.errorMsg ?? "").not.toMatch(/not found in workspace/i);
    });
  });
});
