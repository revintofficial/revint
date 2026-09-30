-- Additive review-measurement schema change. Idempotent: safe to run twice.
-- Existing rows become source = LENS, rubric_version = 'pre-2026-09-29'. No backfill of review_seconds.
BEGIN;
DO $$ BEGIN
  CREATE TYPE "ReviewSource" AS ENUM ('LENS', 'SDR', 'ADJUDICATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- SDR and ADJUDICATION rows carry lens = NULL and never count toward the triple lens gate.
ALTER TABLE "human_reviews" ADD COLUMN IF NOT EXISTS "rubric_version" TEXT NOT NULL DEFAULT 'pre-2026-09-29';
ALTER TABLE "human_reviews" ADD COLUMN IF NOT EXISTS "review_seconds" INTEGER;
ALTER TABLE "human_reviews" ADD COLUMN IF NOT EXISTS "source" "ReviewSource" NOT NULL DEFAULT 'LENS';
COMMIT;
