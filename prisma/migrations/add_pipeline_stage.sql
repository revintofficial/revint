-- Adds PipelineStage enum + watchlist_items.pipeline_stage / stage_order columns.
-- Backfills pipeline_stage from the existing meeting_result signal so we don't
-- lose the user's current categorization. Safe to run multiple times.

BEGIN;

-- 1. Enum ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'REACHED_OUT', 'IN_TALKS', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columns ------------------------------------------------------------------
ALTER TABLE "watchlist_items"
  ADD COLUMN IF NOT EXISTS "pipeline_stage" "PipelineStage" NOT NULL DEFAULT 'NEW';

ALTER TABLE "watchlist_items"
  ADD COLUMN IF NOT EXISTS "stage_order" integer NOT NULL DEFAULT 0;

-- 3. Backfill from meeting_result --------------------------------------------
-- Only touch rows that still hold the default (NEW) to avoid clobbering any
-- user-set stage on re-runs.
UPDATE "watchlist_items"
SET "pipeline_stage" = 'WON'
WHERE "meeting_result" = 'POSITIVE' AND "pipeline_stage" = 'NEW';

UPDATE "watchlist_items"
SET "pipeline_stage" = 'LOST'
WHERE "meeting_result" = 'NEGATIVE' AND "pipeline_stage" = 'NEW';

UPDATE "watchlist_items"
SET "pipeline_stage" = 'IN_TALKS'
WHERE "meeting_result" = 'IN_PROGRESS' AND "pipeline_stage" = 'NEW';

-- 4. Index for fast kanban queries -------------------------------------------
CREATE INDEX IF NOT EXISTS "watchlist_items_pipeline_stage_idx"
  ON "watchlist_items" ("pipeline_stage", "stage_order");

COMMIT;
