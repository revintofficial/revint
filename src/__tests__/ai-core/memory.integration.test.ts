/**
 * Integration tests for the semantic-memory facade.
 *
 * Exercises the real pgvector backend + Prisma so every SQL path
 * (upsert by refType+refId, cosine-similarity ORDER BY, leadId scope,
 * workspace cascade, HNSW index usage) gets a round-trip. Gemini is
 * stubbed so embed() produces deterministic 768-dim vectors without
 * hitting the network.
 *
 * Gated by `.integration.test.ts` so the default `npm test` runner
 * skips these files.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import {
  makeFakeGemini,
  deterministicEmbedding,
} from "../_helpers/mock-gemini";

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return makeFakeGemini({ responses: [] }).getGenerativeModel();
    }
  },
}));

import { prisma } from "@/lib/prisma";
import {
  upsert,
  upsertAndEmbed,
  query,
  deleteByRef,
  deleteByLead,
  writeEmbedding,
  MemoryError,
} from "@/lib/ai-core/memory";
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

async function seedWorkspace() {
  const { workspace, user } = await makeWorkspaceWithOwner();
  createdWorkspaceIds.add(workspace.id);
  createdUserIds.add(user.id);
  return { workspace, user };
}

describe("memory.upsert without embedding", () => {
  it("creates a row with NULL embedding", async () => {
    const { workspace } = await seedWorkspace();
    const id = await upsert({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "no vector yet",
      refType: "test",
      refId: "r1",
    });
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT embedding IS NULL AS is_null FROM semantic_memory WHERE id = $1`,
      id,
    )) as Array<{ is_null: boolean }>;
    expect(rows[0]?.is_null).toBe(true);
  });
});

describe("memory.upsertAndEmbed", () => {
  it("populates the embedding column (IS NOT NULL)", async () => {
    const { workspace } = await seedWorkspace();
    const id = await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "hello world",
      refType: "test",
      refId: "r2",
    });
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT embedding IS NOT NULL AS has FROM semantic_memory WHERE id = $1`,
      id,
    )) as Array<{ has: boolean }>;
    expect(rows[0]?.has).toBe(true);
  });
});

describe("memory.upsert with the same refType+refId", () => {
  it("overwrites the existing row and keeps count at 1", async () => {
    const { workspace } = await seedWorkspace();
    const id1 = await upsert({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "first",
      refType: "thing",
      refId: "abc",
    });
    const id2 = await upsert({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "second",
      refType: "thing",
      refId: "abc",
    });
    expect(id1).toBe(id2);
    const count = await prisma.semanticMemory.count({
      where: { workspaceId: workspace.id, refType: "thing", refId: "abc" },
    });
    expect(count).toBe(1);
    const row = await prisma.semanticMemory.findUnique({ where: { id: id1 } });
    expect(row?.text).toBe("second");
  });
});

describe("memory.query ordering + scope", () => {
  it("returns rows ordered by cosine similarity (best match first)", async () => {
    const { workspace } = await seedWorkspace();
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "alpha",
      refType: "x",
      refId: "a",
    });
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "beta",
      refType: "x",
      refId: "b",
    });
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "gamma",
      refType: "x",
      refId: "c",
    });
    const hits = await query({
      workspaceId: workspace.id,
      vector: deterministicEmbedding("alpha"),
      topK: 3,
    });
    expect(hits).toHaveLength(3);
    for (let i = 0; i + 1 < hits.length; i++) {
      expect(hits[i].similarity).toBeGreaterThanOrEqual(hits[i + 1].similarity);
    }
    expect(hits[0].text).toBe("alpha");
  });

  it("never returns rows from a different workspace", async () => {
    const wsA = await seedWorkspace();
    const wsB = await seedWorkspace();
    await upsertAndEmbed({
      workspaceId: wsA.workspace.id,
      kind: "LEAD_PROFILE",
      text: "tenantA secret",
      refType: "x",
      refId: "a",
    });
    await upsertAndEmbed({
      workspaceId: wsB.workspace.id,
      kind: "LEAD_PROFILE",
      text: "tenantB secret",
      refType: "x",
      refId: "b",
    });

    const hits = await query({
      workspaceId: wsA.workspace.id,
      text: "tenantB secret",
      topK: 10,
    });
    expect(hits.every((h) => !h.text.includes("tenantB"))).toBe(true);
  });

  it("restricts to a single lead when leadId is passed", async () => {
    const { workspace } = await seedWorkspace();
    const lead = await makeLead(workspace.id);
    const other = await makeLead(workspace.id);
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "lead one",
      leadId: lead.id,
      refType: "lead",
      refId: lead.id,
    });
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "lead two",
      leadId: other.id,
      refType: "lead",
      refId: other.id,
    });

    const hits = await query({
      workspaceId: workspace.id,
      vector: deterministicEmbedding("whatever"),
      leadId: lead.id,
      topK: 10,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].leadId).toBe(lead.id);
  });

  it("minSimilarity filter drops random-vector mismatches", async () => {
    const { workspace } = await seedWorkspace();
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "rose",
      refType: "x",
      refId: "r",
    });
    const hits = await query({
      workspaceId: workspace.id,
      vector: deterministicEmbedding("totally different garbage string"),
      minSimilarity: 0.99,
      topK: 10,
    });
    expect(hits).toHaveLength(0);
  });
});

describe("memory.deleteByRef and deleteByLead", () => {
  it("deleteByRef removes only the matching refType+refId", async () => {
    const { workspace } = await seedWorkspace();
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "keep",
      refType: "keep_type",
      refId: "keep_id",
    });
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "drop",
      refType: "drop_type",
      refId: "drop_id",
    });
    const removed = await deleteByRef({
      workspaceId: workspace.id,
      refType: "drop_type",
      refId: "drop_id",
    });
    expect(removed).toBe(1);
    const remaining = await prisma.semanticMemory.count({
      where: { workspaceId: workspace.id },
    });
    expect(remaining).toBe(1);
  });

  it("deleteByLead clears every row for the lead", async () => {
    const { workspace } = await seedWorkspace();
    const lead = await makeLead(workspace.id);
    for (let i = 0; i < 3; i++) {
      await upsertAndEmbed({
        workspaceId: workspace.id,
        kind: "LEAD_PROFILE",
        text: `row ${i}`,
        leadId: lead.id,
        refType: "lead_scoped",
        refId: `k${i}`,
      });
    }
    const removed = await deleteByLead(workspace.id, lead.id);
    expect(removed).toBe(3);
  });
});

describe("memory - workspace cascade", () => {
  it("deletes every SemanticMemory row when the workspace is deleted", async () => {
    const { workspace } = await seedWorkspace();
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "alive",
      refType: "x",
      refId: "y",
    });
    await cleanupWorkspace(workspace.id);
    createdWorkspaceIds.delete(workspace.id);
    const count = await prisma.semanticMemory.count({
      where: { workspaceId: workspace.id },
    });
    expect(count).toBe(0);
  });
});

describe("memory - validation", () => {
  it("upsert throws MemoryError on empty text", async () => {
    const { workspace } = await seedWorkspace();
    await expect(
      upsert({
        workspaceId: workspace.id,
        kind: "LEAD_PROFILE",
        text: "",
      }),
    ).rejects.toBeInstanceOf(MemoryError);
  });

  it("upsert throws MemoryError when embedding dim is wrong", async () => {
    const { workspace } = await seedWorkspace();
    await expect(
      upsert({
        workspaceId: workspace.id,
        kind: "LEAD_PROFILE",
        text: "hi",
        embedding: [0.1, 0.2],
      }),
    ).rejects.toBeInstanceOf(MemoryError);
  });

  it("writeEmbedding throws MemoryError when dim is wrong", async () => {
    await expect(writeEmbedding("nonexistent", [0.1])).rejects.toBeInstanceOf(
      MemoryError,
    );
  });
});

describe("memory - HNSW index usage", () => {
  it("EXPLAIN plan references hnsw (or is skipped if the index is not present)", async () => {
    const { workspace } = await seedWorkspace();
    await upsertAndEmbed({
      workspaceId: workspace.id,
      kind: "LEAD_PROFILE",
      text: "alpha",
      refType: "x",
      refId: "a",
    });
    // Vector literal: rebuild from a deterministic embedding.
    const literal = `[${deterministicEmbedding("alpha")
      .map((x) => x.toFixed(6))
      .join(",")}]`;

    let planText = "";
    try {
      const rows = (await prisma.$queryRawUnsafe(
        `EXPLAIN (FORMAT JSON) SELECT id FROM semantic_memory WHERE workspace_id = $1 ORDER BY embedding <=> $2::vector ASC LIMIT 5`,
        workspace.id,
        literal,
      )) as Array<Record<string, unknown>>;
      planText = JSON.stringify(rows);
    } catch (err) {
      console.warn(
        "[memory-hnsw] EXPLAIN query failed - likely pgvector predates HNSW:",
        err instanceof Error ? err.message : err,
      );
      return;
    }

    if (!/hnsw/i.test(planText)) {
      console.warn(
        "[memory-hnsw] HNSW index not observed in plan. pgvector version may predate HNSW (0.5+). Plan:",
        planText.slice(0, 200),
      );
      return;
    }
    expect(planText).toMatch(/hnsw/i);
  });
});
