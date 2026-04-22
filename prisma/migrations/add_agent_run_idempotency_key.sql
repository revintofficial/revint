-- Adds AgentRun.idempotencyKey + a unique index per workspace.
--
-- Applied via `npm run db:apply -- add_agent_run_idempotency_key.sql` AFTER
-- `prisma db push` has already added the column and index via the schema
-- change in prisma/schema.prisma. This migration is the DDL-safe version
-- in case `db push` cannot run (e.g. the column exists but the index is
-- missing after a partial rollout).
--
-- Idempotent: IF NOT EXISTS guards so re-runs are no-ops.

-- 1. Column --------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agent_runs' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE agent_runs ADD COLUMN idempotency_key TEXT;
  END IF;
END $$;

-- 2. Unique index (workspace + idempotencyKey, partial on NOT NULL) ------
-- Partial index means legacy rows with NULL idempotency_key do not collide
-- with each other; only new rows (where idempotency_key is set) participate
-- in the uniqueness constraint. This lets us roll out the column without
-- having to backfill every existing agent_runs row.
CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_workspace_idempotency_key
  ON agent_runs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
