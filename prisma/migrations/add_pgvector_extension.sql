-- AI Core - pgvector extension bootstrap.
--
-- Prisma's `Unsupported("vector(768)")` column type requires the
-- pgvector extension to already exist at push time. This SQL must be
-- applied BEFORE `prisma db push` creates the `semantic_memory` table.
--
-- Run order:
--   1. npm run db:apply -- add_pgvector_extension.sql
--   2. npx prisma db push
--   3. npm run db:apply -- add_ai_core.sql     (HNSW index + column coerce)

CREATE EXTENSION IF NOT EXISTS vector;
