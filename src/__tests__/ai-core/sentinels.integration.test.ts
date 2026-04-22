/**
 * Integration tests for sentinel implementations.
 *
 * Exercises `embedLeadProfile` and `writeOpenerOutcome` directly
 * (bypassing the orchestrator) so the DB-facing invariants can be
 * asserted in isolation: one row per lead, cross-workspace guard,
 * outcome kind selection by SalesOpportunity.status, refId format.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { makeFakeGemini } from "../_helpers/mock-gemini";

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return makeFakeGemini({ responses: [] }).getGenerativeModel();
    }
  },
}));

import { prisma } from "@/lib/prisma";
import { embedLeadProfile, writeOpenerOutcome } from "@/lib/ai-core/sentinels";
import {
  makeWorkspaceWithOwner,
  makeLead,
  cleanupWorkspace,
  cleanupUser,
} from "../_helpers/factories";

const createdWorkspaceIds = new Set<string>();
const createdUserIds = new Set<string>();

beforeAll(() => {
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(async () => {
  for (const id of createdWorkspaceIds) await cleanupWorkspace(id);
  createdWorkspaceIds.clear();
  for (const id of createdUserIds) await cleanupUser(id);
  createdUserIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seed() {
  const { workspace, user } = await makeWorkspaceWithOwner();
  createdWorkspaceIds.add(workspace.id);
  createdUserIds.add(user.id);
  return { workspace, user };
}

describe("embedLeadProfile", () => {
  it("writes exactly one LEAD_PROFILE row, idempotent across re-runs", async () => {
    const { workspace } = await seed();
    const lead = await makeLead(workspace.id);
    await embedLeadProfile({ workspaceId: workspace.id, leadId: lead.id });
    await embedLeadProfile({ workspaceId: workspace.id, leadId: lead.id });
    const count = await prisma.semanticMemory.count({
      where: {
        workspaceId: workspace.id,
        kind: "LEAD_PROFILE",
        leadId: lead.id,
      },
    });
    expect(count).toBe(1);
  });

  it("silently skips a lead from a different workspace", async () => {
    const a = await seed();
    const b = await seed();
    const leadInA = await makeLead(a.workspace.id);
    await embedLeadProfile({ workspaceId: b.workspace.id, leadId: leadInA.id });
    const rows = await prisma.semanticMemory.count({
      where: { workspaceId: b.workspace.id, leadId: leadInA.id },
    });
    expect(rows).toBe(0);
  });
});

describe("writeOpenerOutcome", () => {
  const openerText = "Selam, cabuk bir one-click pitch.";

  async function setupOpportunity(
    workspaceId: string,
    status: "INTERESTED" | "MEETING" | "WON" | "LOST" | "NEW" | "CONTACTED",
    withOpener = true,
  ) {
    const lead = await makeLead(workspaceId);
    await prisma.salesOpportunity.create({
      data: {
        leadId: lead.id,
        opportunityScore: 70,
        status,
        personalizedFirstMessage: withOpener ? openerText : null,
      },
    });
    return lead;
  }

  it.each(["INTERESTED", "MEETING", "WON"] as const)(
    "writes OPENER_SUCCESS when status is %s",
    async (status) => {
      const { workspace } = await seed();
      const lead = await setupOpportunity(workspace.id, status);
      await writeOpenerOutcome({ workspaceId: workspace.id, leadId: lead.id });
      const rows = await prisma.semanticMemory.findMany({
        where: { workspaceId: workspace.id, leadId: lead.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("OPENER_SUCCESS");
      expect(rows[0].refId).toBe(`${lead.id}:${status}`);
      expect(rows[0].refType).toBe("opener_outcome");
    },
  );

  it("writes OPENER_FAILURE for LOST", async () => {
    const { workspace } = await seed();
    const lead = await setupOpportunity(workspace.id, "LOST");
    await writeOpenerOutcome({ workspaceId: workspace.id, leadId: lead.id });
    const rows = await prisma.semanticMemory.findMany({
      where: { workspaceId: workspace.id, leadId: lead.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("OPENER_FAILURE");
    expect(rows[0].refId).toBe(`${lead.id}:LOST`);
  });

  it.each(["NEW", "CONTACTED"] as const)(
    "writes nothing when status is %s",
    async (status) => {
      const { workspace } = await seed();
      const lead = await setupOpportunity(workspace.id, status);
      await writeOpenerOutcome({ workspaceId: workspace.id, leadId: lead.id });
      const rows = await prisma.semanticMemory.count({
        where: { workspaceId: workspace.id, leadId: lead.id },
      });
      expect(rows).toBe(0);
    },
  );

  it("writes nothing when personalizedFirstMessage is missing", async () => {
    const { workspace } = await seed();
    const lead = await setupOpportunity(workspace.id, "WON", /*withOpener*/ false);
    await writeOpenerOutcome({ workspaceId: workspace.id, leadId: lead.id });
    const rows = await prisma.semanticMemory.count({
      where: { workspaceId: workspace.id, leadId: lead.id },
    });
    expect(rows).toBe(0);
  });
});
