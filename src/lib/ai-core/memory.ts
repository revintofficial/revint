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
  /**
   * Niche pack slug this row belongs to. For hybrid niches we tag with
   * the most specific slug available — typically the lead's
   * `subNicheSlug` ("fnb-bar-club") or its parent ("fnb"). For
   * niche-agnostic rows (WORKSPACE_OFFER, COPILOT_TURN) leave null.
   *
   * The DB unique key is (workspaceId, refType, refId, nicheScope), so
   * the same `(refType, refId)` pair can co-exist under multiple
   * scopes. That is what powers the asymmetric dual-write of positive
   * signals into both child and parent — see `upsertWithNicheScopes`.
   */
  nicheScope?: string | null;
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
  nicheScope: string | null;
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
  /**
   * Restricts retrieval to a specific niche pack scope (e.g.
   * "fnb-bar-club" or "fnb"). When omitted, all scopes are searched —
   * including null-scope rows. Use `queryWithNicheUnion` for the
   * common child + parent weighted blend.
   */
  nicheScope?: string | null;
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
  // in the same workspace + scope and replace its content. The DB has
  // a unique constraint on (workspaceId, refType, refId, nicheScope)
  // so concurrent callers within the same scope never produce
  // duplicates; cross-scope writes (child vs parent) coexist as
  // separate rows by design — see `upsertWithNicheScopes`.
  if (input.refType && input.refId) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await prisma.semanticMemory.findFirst({
        where: {
          workspaceId: input.workspaceId,
          refType: input.refType,
          refId: input.refId,
          // findFirst with `null` here matches scope-null rows; with a
          // string it matches that exact scope. Either way we are
          // matching the unique key for this specific scope only.
          nicheScope: input.nicheScope ?? null,
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
            nicheScope: input.nicheScope ?? null,
          },
        });
        if (input.embedding) {
          await writeEmbedding(existing.id, input.embedding, input.workspaceId);
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
            nicheScope: input.nicheScope ?? null,
          },
          select: { id: true },
        });
        if (input.embedding) {
          await writeEmbedding(created.id, input.embedding, input.workspaceId);
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
      nicheScope: input.nicheScope ?? null,
    },
    select: { id: true },
  });

  if (input.embedding) {
    await writeEmbedding(created.id, input.embedding, input.workspaceId);
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
 * Enqueues an `embed` job on the unified `agent-runs` queue so the
 * background worker backfills the missing vector for an existing
 * SemanticMemory row. Used by the degraded write path (sentinel +
 * post-run memory writes) when Gemini's embedding endpoint is
 * unavailable: the row is persisted text-only first, then this helper
 * schedules the vector to be written when Gemini recovers.
 *
 * `workspaceId` MUST be the workspace that owns the row. The worker
 * uses it as the second tenant guard when writing the embedding back
 * (defense in depth — a poisoned job payload pointing at someone
 * else's memoryId no-ops instead of overwriting).
 *
 * Best-effort: a Redis outage at enqueue time logs a warning and the
 * embedding stays null. The orchestrator's stuck-session watchdog and
 * the per-AgentRun lazy watchdog don't cover memory rows, so we rely
 * on a periodic backfill scan (or a manual re-trigger) when Redis is
 * the failure mode. Silent here is acceptable because the row already
 * exists in the DB — the worst case is that retrieval doesn't see the
 * text until the next embed job lands.
 */
export async function enqueueReembed(
  memoryId: string,
  workspaceId: string,
): Promise<void> {
  if (!workspaceId) {
    throw new MemoryError("enqueueReembed requires workspaceId");
  }
  try {
    const { getAgentRunsQueue } = await import("@/lib/queues");
    const queue = getAgentRunsQueue();
    await queue.add(
      `embed:${memoryId}`,
      { type: "embed", memoryId, workspaceId },
      {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
      },
    );
  } catch (err) {
    const { logger } = await import("@/lib/logger");
    logger.warn("memory.enqueue_reembed_failed", {
      memoryId,
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Sets the embedding column on an existing row. Used by the async
 * embed job path (memory row inserted first, embedding written when
 * the embed worker runs).
 *
 * `workspaceId` is REQUIRED and is enforced inside the SQL `WHERE`
 * clause. If the row does not belong to that workspace (or no longer
 * exists), zero rows are updated and a `MemoryError` is thrown so the
 * caller can surface the cross-tenant attempt or stale row instead of
 * silently overwriting a victim workspace's vector.
 *
 * This guard pairs with `enqueueReembed`'s payload contract: every
 * embed job carries the workspaceId of the row that owns the memory,
 * and this function refuses to honour any other.
 */
export async function writeEmbedding(
  memoryId: string,
  vector: number[],
  workspaceId: string,
): Promise<void> {
  if (vector.length !== EMBEDDING_DIM) {
    throw new MemoryError(
      `Embedding dim mismatch: got ${vector.length}, expected ${EMBEDDING_DIM}`,
    );
  }
  if (!workspaceId) {
    throw new MemoryError("writeEmbedding requires workspaceId");
  }
  const literal = toPgVectorLiteral(vector);
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE semantic_memory SET embedding = $1::vector WHERE id = $2 AND workspace_id = $3`,
    literal,
    memoryId,
    workspaceId,
  );
  if (updated === 0) {
    throw new MemoryError(
      `writeEmbedding: row ${memoryId} not found in workspace ${workspaceId} (deleted or cross-tenant write attempt)`,
    );
  }
}

/**
 * Workspace-scoped lookup for a single memory row. Returns `null`
 * when the row does not exist OR belongs to a different workspace —
 * the caller cannot distinguish the two by design (both are bugs from
 * the worker's point of view).
 *
 * The selectable fields are intentionally restrictive: the embedding
 * column is excluded because pgvector cannot be returned by the
 * Prisma client (raw SQL only) and callers never need it here.
 */
export async function findScopedMemoryRow(args: {
  workspaceId: string;
  memoryId: string;
}): Promise<{
  id: string;
  workspaceId: string;
  kind: MemoryKind;
  leadId: string | null;
  refType: string | null;
  refId: string | null;
  text: string;
} | null> {
  if (!args.workspaceId || !args.memoryId) return null;
  const row = await prisma.semanticMemory.findFirst({
    where: { id: args.memoryId, workspaceId: args.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      kind: true,
      leadId: true,
      refType: true,
      refId: true,
      text: true,
    },
  });
  return row;
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

  // Filter by nicheScope when supplied. We accept the value `null`
  // explicitly to mean "rows with no scope" (e.g. WORKSPACE_OFFER).
  if (input.nicheScope !== undefined) {
    if (input.nicheScope === null) {
      whereParts.push(`niche_scope IS NULL`);
    } else {
      params.push(input.nicheScope);
      whereParts.push(`niche_scope = $${params.length}`);
    }
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
      niche_scope  AS "nicheScope",
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
    nicheScope: string | null;
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
      nicheScope: r.nicheScope,
      text: r.text,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      similarity: Number(r.similarity),
      createdAt: r.createdAt,
    }));
}

/**
 * Positive memory kinds — written to BOTH child and parent niche
 * scopes when the lead has a sub-niche tagged. Day-one of a brand-new
 * sub-niche the child bucket is empty; weighted union retrieval
 * blends in successful patterns from sibling sub-niches via the
 * parent scope so the opener writer / mockup composer has fuel.
 */
const POSITIVE_DUAL_WRITE_KINDS: ReadonlySet<MemoryKind> = new Set<MemoryKind>([
  "OPENER_SUCCESS",
  "MOCKUP_SECTION",
  "LEAD_PROFILE",
]);

/**
 * Negative memory kinds — written to the CHILD scope only. A failure
 * in fnb-bar-club isn't necessarily a failure in fnb-cafe-bakery, so
 * we don't pollute the parent retrieval pool with it. The retrieval
 * helper still surfaces these failures within the originating sub-
 * niche so its own future runs learn from the mistake.
 */
const NEGATIVE_CHILD_ONLY_KINDS: ReadonlySet<MemoryKind> = new Set<MemoryKind>([
  "OPENER_FAILURE",
]);

/**
 * Asymmetric dual-write helper. Given the lead's child slug + parent
 * slug, picks the right scope set based on the memory kind:
 *
 *   - Positive kind + child + parent → writes 2 rows (child, parent)
 *   - Positive kind + only parent (lead unclassified) → writes 1 (parent)
 *   - Negative kind + child → writes 1 (child) — no parent pollution
 *   - Negative kind + no child → writes 1 (parent) as a soft fallback
 *   - Niche-agnostic kind (callers pass nicheScopes empty) → writes 1
 *     row with `nicheScope = null`.
 *
 * Each scope row is upserted independently; if one write fails the
 * others still complete. Returns the set of memory ids written.
 */
export async function upsertWithNicheScopes(
  base: Omit<MemoryUpsertInput, "nicheScope">,
  scopes: { childSlug?: string | null; parentSlug?: string | null },
): Promise<string[]> {
  const targets: Array<string | null> = [];
  const child = scopes.childSlug ?? null;
  const parent = scopes.parentSlug ?? null;

  if (POSITIVE_DUAL_WRITE_KINDS.has(base.kind)) {
    if (child) targets.push(child);
    if (parent && parent !== child) targets.push(parent);
  } else if (NEGATIVE_CHILD_ONLY_KINDS.has(base.kind)) {
    if (child) targets.push(child);
    else if (parent) targets.push(parent);
  } else {
    // Generic kind (LEAD_PROFILE non-niche, COPILOT_TURN, etc.) —
    // write into the most specific scope the caller provided. Falls
    // back to scope-null when the lead has neither.
    if (child) targets.push(child);
    else if (parent) targets.push(parent);
    else targets.push(null);
  }

  if (targets.length === 0) targets.push(null);

  const ids: string[] = [];
  for (const scope of targets) {
    const id = await upsert({ ...base, nicheScope: scope });
    ids.push(id);
  }
  return ids;
}

/**
 * Embed-then-dual-write convenience for the asymmetric strategy. Same
 * scope semantics as `upsertWithNicheScopes`; embeds the text once
 * and reuses the vector across all scope-rows.
 */
export async function upsertAndEmbedWithNicheScopes(
  base: Omit<MemoryUpsertInput, "embedding" | "nicheScope">,
  scopes: { childSlug?: string | null; parentSlug?: string | null },
): Promise<string[]> {
  const vector = await embed(base.text);
  return upsertWithNicheScopes({ ...base, embedding: vector }, scopes);
}

/**
 * Weighted-union retrieval across child + parent niche scopes. Runs
 * two cosine-similarity scans (one per scope), multiplies the parent
 * scores by `parentWeight` (default 0.5 — child wins ties), de-dupes
 * by row id (the same row can show up if a positive signal was
 * dual-written and matches both queries), and returns the top-K
 * blend.
 *
 * Use this for vertical-aware retrieval (opener writer, mockup
 * composer) where the child scope is the source of truth but you
 * want graceful degradation when the child is sparse.
 */
export async function queryWithNicheUnion(input: {
  workspaceId: string;
  kinds?: MemoryKind[];
  text?: string;
  vector?: number[];
  childSlug: string | null;
  parentSlug: string | null;
  topK?: number;
  parentWeight?: number;
  leadId?: string | null;
  minSimilarity?: number;
}): Promise<MemoryHit[]> {
  const topK = input.topK ?? 10;
  const parentWeight = input.parentWeight ?? 0.5;

  // Embed once and reuse — the second scope query gets the same
  // vector for free.
  let vector = input.vector;
  if (!vector) {
    if (!input.text) {
      throw new MemoryError(
        "queryWithNicheUnion requires either `vector` or `text`",
      );
    }
    vector = await embed(input.text);
  }

  const baseQuery: Omit<MemoryQueryInput, "nicheScope"> = {
    workspaceId: input.workspaceId,
    kinds: input.kinds,
    vector,
    topK,
    leadId: input.leadId,
    minSimilarity: input.minSimilarity,
  };

  const childHits = input.childSlug
    ? await query({ ...baseQuery, nicheScope: input.childSlug })
    : [];
  const parentHits = input.parentSlug && input.parentSlug !== input.childSlug
    ? await query({ ...baseQuery, nicheScope: input.parentSlug })
    : [];

  const merged = new Map<string, MemoryHit>();
  for (const hit of childHits) {
    merged.set(hit.id, hit);
  }
  for (const hit of parentHits) {
    if (merged.has(hit.id)) continue; // dual-written row already counted at full weight
    merged.set(hit.id, { ...hit, similarity: hit.similarity * parentWeight });
  }

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
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
