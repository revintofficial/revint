/**
 * Bug C1 regression test - cross-tenant SemanticMemory write.
 *
 * Before the fix, `writeEmbedding(memoryId, vector)` performed a raw
 * `UPDATE semantic_memory SET embedding = ... WHERE id = $1` with no
 * tenant filter. Any worker context that knew (or guessed) a memory
 * row id from another workspace could overwrite that row's vector,
 * corrupting the victim workspace's retrieval.
 *
 * Post-fix: workspaceId is a required argument, the SQL WHERE clause
 * includes `AND workspace_id = $3`, and a zero-row update raises
 * `MemoryError` so the cross-tenant attempt is loud instead of
 * silent. The same payload contract is enforced on the embed BullMQ
 * job (worker-side); see `embed-job-tenant.test.ts` for that half.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { makeFakeGemini, deterministicEmbedding } from "../_helpers/mock-gemini";

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
  writeEmbedding,
  enqueueReembed,
  findScopedMemoryRow,
  MemoryError,
} from "@/lib/ai-core/memory";
import {
  cleanupUser,
  cleanupWorkspace,
  makeWorkspaceWithOwner,
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

describe("C1 - writeEmbedding tenant scoping", () => {
  it("rejects writing into a memory row that belongs to another workspace", async () => {
    const { workspace: a } = await seedWorkspace();
    const { workspace: b } = await seedWorkspace();

    // Workspace A creates a memory row with NO embedding (the
    // degraded write path that schedules an embed job).
    const memId = await upsert({
      workspaceId: a.id,
      kind: "LEAD_PROFILE",
      text: "tenant A profile",
      refType: "lead",
      refId: "lead_a_1",
    });

    // Confirm the embedding starts NULL.
    const beforeRows = (await prisma.$queryRawUnsafe(
      `SELECT embedding IS NULL AS is_null FROM semantic_memory WHERE id = $1`,
      memId,
    )) as Array<{ is_null: boolean }>;
    expect(beforeRows[0]?.is_null).toBe(true);

    // Workspace B (an attacker context, OR a buggy worker that
    // misrouted) tries to write an embedding into A's row using B's
    // workspaceId. The fix must reject this with MemoryError and the
    // row must remain NULL.
    const vec = deterministicEmbedding("malicious-overwrite");
    await expect(writeEmbedding(memId, vec, b.id)).rejects.toBeInstanceOf(
      MemoryError,
    );

    const afterRows = (await prisma.$queryRawUnsafe(
      `SELECT embedding IS NULL AS is_null FROM semantic_memory WHERE id = $1`,
      memId,
    )) as Array<{ is_null: boolean }>;
    expect(afterRows[0]?.is_null).toBe(true);
  });

  it("allows writing when workspaceId matches", async () => {
    const { workspace: a } = await seedWorkspace();
    const memId = await upsert({
      workspaceId: a.id,
      kind: "LEAD_PROFILE",
      text: "legit",
      refType: "lead",
      refId: "lead_a_2",
    });

    const vec = deterministicEmbedding("legit-vector");
    await expect(writeEmbedding(memId, vec, a.id)).resolves.toBeUndefined();

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT embedding IS NULL AS is_null FROM semantic_memory WHERE id = $1`,
      memId,
    )) as Array<{ is_null: boolean }>;
    expect(rows[0]?.is_null).toBe(false);
  });

  it("rejects empty workspaceId outright (defence in depth)", async () => {
    const vec = deterministicEmbedding("anything");
    await expect(writeEmbedding("any_id", vec, "")).rejects.toBeInstanceOf(
      MemoryError,
    );
  });
});

describe("C1 - enqueueReembed tenant payload contract", () => {
  it("rejects empty workspaceId", async () => {
    await expect(enqueueReembed("memId_x", "")).rejects.toBeInstanceOf(
      MemoryError,
    );
  });
});

describe("C1 - findScopedMemoryRow", () => {
  it("returns the row when workspaceId matches", async () => {
    const { workspace: a } = await seedWorkspace();
    const id = await upsert({
      workspaceId: a.id,
      kind: "COPILOT_TURN",
      text: "hello",
    });
    const row = await findScopedMemoryRow({ workspaceId: a.id, memoryId: id });
    expect(row?.id).toBe(id);
    expect(row?.workspaceId).toBe(a.id);
  });

  it("returns null when workspaceId does not match", async () => {
    const { workspace: a } = await seedWorkspace();
    const { workspace: b } = await seedWorkspace();
    const id = await upsert({
      workspaceId: a.id,
      kind: "COPILOT_TURN",
      text: "hi",
    });
    const row = await findScopedMemoryRow({ workspaceId: b.id, memoryId: id });
    expect(row).toBeNull();
  });

  it("returns null on empty inputs", async () => {
    expect(await findScopedMemoryRow({ workspaceId: "", memoryId: "x" })).toBeNull();
    expect(await findScopedMemoryRow({ workspaceId: "x", memoryId: "" })).toBeNull();
  });
});
