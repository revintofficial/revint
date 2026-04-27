/**
 * AI Core - semantic memory facade.
 *
 * Single entry point for reading and writing `SemanticMemory` rows.
 * Every AI worker in the registry interacts with memory through this
 * module; callers must never touch the `semantic_memory` table
 * directly. That rule is what lets us change the storage engine (e.g.
 * swap to Pinecone) by rewriting just this file.
 *
 * Storage shape:
 *   - `semantic_memory` table, pgvector `embedding vector(768)` column.
 *   - Per-workspace scoping is enforced on every read/write. Passing a
 *     workspaceId is mandatory; cross-workspace retrieval is impossible
 *     by construction.
 *   - Upserts via `refType+refId` when present: e.g. re-ingesting a
 *     lead profile overwrites the existing row. When no refId is
 *     provided (copilot turns, social posts), a new row is always
 *     inserted.
 *
 * Embedding strategy:
 *   - `upsert` accepts `{ text, embedding? }`; if no embedding is
 *     given, the row is inserted with a NULL embedding and the caller
 *     is expected to enqueue an embed job. In practice `upsertAndEmbed`
 *     is the common path and it handles both steps synchronously.
 *   - `query` with `text` produces the query embedding on the fly and
 *     reuses it across the cosine-similarity scan. Prefer this over
 *     manual embed + query because it keeps the token count in sync
 *     with the memory read.
 */
import type { MemoryKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { embed, EMBEDDING_DIM, toPgVectorLiteral } from "./embed";

export interface MemoryUpsertInput {
  workspaceId: string;
  kind: MemoryKind;
  text: string;
  leadId?: string | null;
  refType?: string | null;
  refId?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Pre-computed embedding. When omitted, the row is written with a
   * NULL vector and the caller must schedule an embed job (or use
   * `upsertAndEmbed`).
   */
  embedding?: number[];
}

export interface MemoryHit {
  id: string;
  kind: MemoryKind;
  leadId: string | null;
  refType: string | null;
  refId: string | null;
  text: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

export interface MemoryQueryInput {
  workspaceId: string;
  kinds?: MemoryKind[];
  /**
   * Pre-computed query vector. Mutually exclusive with `text`.
   */
  vector?: number[];
  /**
   * Free-text query. When provided, this module embeds it before
   * running the cosine-similarity scan.
   */
  text?: string;
  topK?: number;
  /**
   * Restricts retrieval to memories attached to a specific lead.
   * Useful for lead-scoped reads like PROSPECT_KB_CHUNK.
   */
  leadId?: string | null;
  /**
   * Minimum cosine similarity to include. pgvector returns rows as
   * `1 - distance`, so values near 1 are the strongest matches.
   */
  minSimilarity?: number;
}

export class MemoryError extends Error {}

/**
 * Writes a memory row. If `refType` + `refId` are present and a row
 * with that pair already exists (within the same workspace), its
 * text/embedding/metadata are overwritten. Returns the row id.
 */
export async function upsert(input: MemoryUpsertInput): Promise<string> {
  if (input.embedding && input.embedding.length !== EMBEDDING_DIM) {
    throw new MemoryError(
      `Embedding dim mismatch: got ${input.embedding.length}, expected ${EMBEDDING_DIM}`,
    );
  }
  if (!input.text || !input.text.trim()) {
    throw new MemoryError("SemanticMemory.text cannot be empty");
  }

  const metadata = (input.metadata ?? {}) as Record<string, unknown>;

  // Upsert path for rows with refType+refId: look up an existing row
  // in the same workspace and replace its content. The DB has a
  // unique constraint on (workspaceId, refType, refId) so two
  // concurrent callers never end up with duplicate rows; the loser
  // retries the lookup and updates the winner's row.
  if (input.refType && input.refId) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await prisma.semanticMemory.findFirst({
        where: {
          workspaceId: input.workspaceId,
          refType: input.refType,
          refId: input.refId,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.semanticMemory.update({
          where: { id: existing.id },
          data: {
            kind: input.kind,
            leadId: input.leadId ?? null,
            text: input.text,
            metadata: metadata as never,
          },
        });
        if (input.embedding) {
          await writeEmbedding(existing.id, input.embedding);
        }
        return existing.id;
      }

      try {
        const created = await prisma.semanticMemory.create({
          data: {
            workspaceId: input.workspaceId,
            kind: input.kind,
            leadId: input.leadId ?? null,
            refType: input.refType,
            refId: input.refId,
            text: input.text,
            metadata: metadata as never,
          },
          select: { id: true },
        });
        if (input.embedding) {
          await writeEmbedding(created.id, input.embedding);
        }
        return created.id;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002" && attempt === 0) {
          // Lost the race - the row was created between findFirst
          // and create. Loop once and update the winner.
          continue;
        }
        throw err;
      }
    }
    throw new MemoryError("SemanticMemory upsert failed after retry");
  }

  const created = await prisma.semanticMemory.create({
    data: {
      workspaceId: input.workspaceId,
      kind: input.kind,
      leadId: input.leadId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      text: input.text,
      metadata: metadata as never,
    },
    select: { id: true },
  });

  if (input.embedding) {
    await writeEmbedding(created.id, input.embedding);
  }
  return created.id;
}

/**
 * Convenience path for the common case: embed the text first, then
 * upsert the row with the vector in a single call.
 */
export async function upsertAndEmbed(
  input: Omit<MemoryUpsertInput, "embedding">,
): Promise<string> {
  const vector = await embed(input.text);
  return upsert({ ...input, embedding: vector });
}

/**
 * Sets the embedding column on an existing row. Used by the async
 * embed job path (memory row inserted first, embedding written when
 * the embed worker runs).
 */
export async function writeEmbedding(
  memoryId: string,
  vector: number[],
): Promise<void> {
  if (vector.length !== EMBEDDING_DIM) {
    throw new MemoryError(
      `Embedding dim mismatch: got ${vector.length}, expected ${EMBEDDING_DIM}`,
    );
  }
  const literal = toPgVectorLiteral(vector);
  await prisma.$executeRawUnsafe(
    `UPDATE semantic_memory SET embedding = $1::vector WHERE id = $2`,
    literal,
    memoryId,
  );
}

/**
 * Cosine-similarity search. Scoped to the caller's workspace; optional
 * filters for kind(s) and leadId. Returns results sorted by similarity
 * descending (best match first).
 */
export async function query(input: MemoryQueryInput): Promise<MemoryHit[]> {
  const topK = input.topK ?? 10;
  const minSim = input.minSimilarity ?? 0;

  if (!input.vector && !input.text) {
    throw new MemoryError("memory.query requires either `vector` or `text`");
  }

  const vector =
    input.vector ?? (await embed(input.text!));
  if (vector.length !== EMBEDDING_DIM) {
    throw new MemoryError(
      `Query vector dim mismatch: got ${vector.length}, expected ${EMBEDDING_DIM}`,
    );
  }

  const literal = toPgVectorLiteral(vector);

  // We build the WHERE clause inline (safe: all values pass through
  // parameterised query except the vector literal which is cast via
  // ::vector). Prisma's `$queryRaw` interpolation is used so the pgvector
  // operator stays readable.
  const whereParts: string[] = [`workspace_id = $1`];
  const params: unknown[] = [input.workspaceId];

  if (input.kinds && input.kinds.length > 0) {
    const placeholders = input.kinds.map((_, i) => `$${params.length + i + 1}`);
    whereParts.push(`kind IN (${placeholders.join(", ")})`);
    params.push(...input.kinds);
  }

  if (input.leadId) {
    params.push(input.leadId);
    whereParts.push(`lead_id = $${params.length}`);
  }

  // embedding IS NOT NULL prevents rows whose embed job hasn't yet
  // completed from polluting results with zero-similarity matches.
  whereParts.push(`embedding IS NOT NULL`);

  params.push(literal);
  const vectorParamIdx = params.length;
  params.push(topK);
  const limitParamIdx = params.length;

  const sql = `
    SELECT
      id,
      kind,
      lead_id      AS "leadId",
      ref_type     AS "refType",
      ref_id       AS "refId",
      text,
      metadata,
      created_at   AS "createdAt",
      1 - (embedding <=> $${vectorParamIdx}::vector) AS similarity
    FROM semantic_memory
    WHERE ${whereParts.join(" AND ")}
    ORDER BY embedding <=> $${vectorParamIdx}::vector ASC
    LIMIT $${limitParamIdx}
  `;

  const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as Array<{
    id: string;
    kind: MemoryKind;
    leadId: string | null;
    refType: string | null;
    refId: string | null;
    text: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    similarity: number;
  }>;

  return rows
    .filter((r) => r.similarity >= minSim)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      leadId: r.leadId,
      refType: r.refType,
      refId: r.refId,
      text: r.text,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      similarity: Number(r.similarity),
      createdAt: r.createdAt,
    }));
}

/**
 * Deletes memory rows by refType+refId. Used when a Lead or
 * WebsiteMockup is deleted so we do not accrue orphaned vectors.
 * Workspace cascade already handles the nuclear case.
 */
export async function deleteByRef(input: {
  workspaceId: string;
  refType: string;
  refId: string;
}): Promise<number> {
  const res = await prisma.semanticMemory.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      refType: input.refType,
      refId: input.refId,
    },
  });
  return res.count;
}

/**
 * Non-embedding read: returns all memory rows for a lead (workspace
 * scoped), newest first. Used by the lead dossier endpoint that
 * synthesises every collected signal into a prose brief - it needs
 * the raw text/metadata/kind, not cosine similarity ranking. Safe to
 * skip the vector column because this helper never exposes embeddings.
 */
export async function listByLead(input: {
  workspaceId: string;
  leadId: string;
  take?: number;
}): Promise<Array<{
  id: string;
  kind: MemoryKind;
  refType: string | null;
  refId: string | null;
  text: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}>> {
  const rows = await prisma.semanticMemory.findMany({
    where: { workspaceId: input.workspaceId, leadId: input.leadId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 100,
    select: {
      id: true,
      kind: true,
      refType: true,
      refId: true,
      text: true,
      metadata: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    refType: r.refType,
    refId: r.refId,
    text: r.text,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}

/**
 * Clears all memory for a lead. Called when a Lead is permanently
 * deleted; complements Prisma cascade which only fires on workspace
 * deletion.
 */
export async function deleteByLead(workspaceId: string, leadId: string): Promise<number> {
  const res = await prisma.semanticMemory.deleteMany({
    where: { workspaceId, leadId },
  });
  return res.count;
}
