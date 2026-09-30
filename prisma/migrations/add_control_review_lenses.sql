-- Additive decision-loop schema change. No backfill: legacy reviews remain unassigned.
BEGIN;
DO $$ BEGIN
  CREATE TYPE "ReviewLens" AS ENUM ('TECHNICAL', 'DOMAIN', 'SALES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "platform_role_assignments" ADD COLUMN IF NOT EXISTS "lens" "ReviewLens";
ALTER TABLE "human_reviews" ADD COLUMN IF NOT EXISTS "lens" "ReviewLens";
COMMIT;
