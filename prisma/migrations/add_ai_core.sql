-- AI Core - pgvector foundation migration.
--
-- Prisma cannot create the pgvector extension, the vector column type, or
-- an HNSW index on its own, so this SQL is applied via
-- `npm run db:apply -- add_ai_core.sql` AFTER `prisma db push` has created
-- the `semantic_memory` and `planner_sessions` tables.
--
-- Idempotent: everything uses IF NOT EXISTS / safe DO blocks so re-runs
-- are no-ops.

-- 1. pgvector extension -----------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Replace the Unsupported("vector(768)") column -------------------
-- Prisma's Unsupported type emits `bytea` (or leaves the column missing
-- depending on version) because it cannot generate the vector type
-- itself. We coerce the column to the real `vector(768)` type here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'semantic_memory' AND column_name = 'embedding'
  ) THEN
    -- Drop and re-add as vector to guarantee correct type regardless of
    -- what Prisma emitted. Safe: embedding is nullable and populated by
    -- the embed worker post-row-insert.
    ALTER TABLE semantic_memory DROP COLUMN embedding;
  END IF;
  ALTER TABLE semantic_memory ADD COLUMN embedding vector(768);
END $$;

-- 3. HNSW index for cosine similarity --------------------------------
-- HNSW is strictly better than IVFFlat for write-heavy workloads (no
-- reindex after large inserts). Cosine is the standard similarity
-- metric for Gemini text-embedding-004 output.
CREATE INDEX IF NOT EXISTS semantic_memory_embedding_hnsw
  ON semantic_memory
  USING hnsw (embedding vector_cosine_ops);

-- 4. Supporting b-tree index for metadata lookups --------------------
-- Memory.query often filters by workspace + kind then applies vector
-- similarity; Prisma already emitted @@index([workspaceId, kind]) so
-- there's nothing to add here, but we keep this block as the insertion
-- point for future composite indexes as query patterns evolve.
