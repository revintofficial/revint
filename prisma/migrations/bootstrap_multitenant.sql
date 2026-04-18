-- Multi-tenant bootstrap migration
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).
-- Run BEFORE `prisma db push` if you have existing data, or run AFTER if starting fresh.
--
-- This script:
--   1. Creates Plan and Role enums
--   2. Creates users, workspaces, workspace_members tables
--   3. Adds workspace_id columns to leads and team_todos (nullable)
--   4. Backfills a single "Default Workspace" for any existing rows
--   5. Sets workspace_id NOT NULL + adds FK constraints + indexes
--   6. Drops the old single-column unique on leads.place_id and adds (workspace_id, place_id)
--   7. Installs a trigger that syncs Supabase auth.users into public.users automatically

BEGIN;

-- 1. Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'AGENCY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id"          uuid PRIMARY KEY,
  "email"       text NOT NULL UNIQUE,
  "full_name"   text,
  "avatar_url"  text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"                       text PRIMARY KEY,
  "name"                     text NOT NULL,
  "slug"                     text NOT NULL UNIQUE,
  "owner_id"                 uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan"                     "Plan" NOT NULL DEFAULT 'FREE',
  "stripe_customer_id"       text UNIQUE,
  "stripe_subscription_id"   text UNIQUE,
  "current_period_end"       timestamptz,
  "leads_this_cycle"         int NOT NULL DEFAULT 0,
  "ai_credits_this_cycle"    int NOT NULL DEFAULT 0,
  "cycle_reset_at"           timestamptz NOT NULL DEFAULT now(),
  "created_at"               timestamptz NOT NULL DEFAULT now(),
  "updated_at"               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id"           text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"         "Role" NOT NULL DEFAULT 'MEMBER',
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "workspace_members_user_id_idx" ON "workspace_members" ("user_id");

-- 3. Add nullable workspace_id columns to existing tables ---------------------
ALTER TABLE "leads"      ADD COLUMN IF NOT EXISTS "workspace_id" text;
ALTER TABLE "team_todos" ADD COLUMN IF NOT EXISTS "workspace_id" text;

-- 4. Backfill: bootstrap a Legacy workspace + bootstrap user if any rows exist
DO $$
DECLARE
  v_legacy_user_id  uuid;
  v_legacy_ws_id    text := 'ws_legacy_default';
  v_orphan_count    int;
BEGIN
  SELECT count(*) INTO v_orphan_count
  FROM (
    SELECT 1 FROM "leads"      WHERE "workspace_id" IS NULL
    UNION ALL
    SELECT 1 FROM "team_todos" WHERE "workspace_id" IS NULL
  ) s;

  IF v_orphan_count > 0 THEN
    -- Get any existing supabase auth user, or fabricate a placeholder.
    -- Real users sync into public.users via the trigger below; the placeholder
    -- is only ever needed if we have legacy data but no auth user yet.
    SELECT id INTO v_legacy_user_id FROM auth.users LIMIT 1;

    IF v_legacy_user_id IS NULL THEN
      v_legacy_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
      INSERT INTO "users" ("id", "email", "full_name")
        VALUES (v_legacy_user_id, 'legacy@local', 'Legacy Owner')
        ON CONFLICT (id) DO NOTHING;
    ELSE
      -- mirror existing auth user into public.users
      INSERT INTO "users" ("id", "email", "full_name")
        SELECT id, COALESCE(email, id::text || '@legacy'), COALESCE(raw_user_meta_data->>'full_name', email)
        FROM auth.users WHERE id = v_legacy_user_id
        ON CONFLICT (id) DO NOTHING;
    END IF;

    INSERT INTO "workspaces" ("id", "name", "slug", "owner_id")
      VALUES (v_legacy_ws_id, 'My Workspace', 'legacy', v_legacy_user_id)
      ON CONFLICT (id) DO NOTHING;

    INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role")
      VALUES ('wsm_legacy_default', v_legacy_ws_id, v_legacy_user_id, 'OWNER')
      ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

    UPDATE "leads"      SET "workspace_id" = v_legacy_ws_id WHERE "workspace_id" IS NULL;
    UPDATE "team_todos" SET "workspace_id" = v_legacy_ws_id WHERE "workspace_id" IS NULL;
  END IF;
END $$;

-- 5. Enforce NOT NULL + add FKs + indexes -------------------------------------
ALTER TABLE "leads"      ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "team_todos" ALTER COLUMN "workspace_id" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "team_todos" ADD CONSTRAINT "team_todos_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "leads_workspace_id_created_at_idx"  ON "leads" ("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "leads_workspace_id_has_website_idx" ON "leads" ("workspace_id", "has_website");
CREATE INDEX IF NOT EXISTS "leads_workspace_id_borough_idx"     ON "leads" ("workspace_id", "borough");
CREATE INDEX IF NOT EXISTS "team_todos_workspace_id_column_idx" ON "team_todos" ("workspace_id", "column");

-- 6. Replace the global UNIQUE(place_id) with composite UNIQUE(workspace_id, place_id)
DO $$ BEGIN
  ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_place_id_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_place_id_key"
    UNIQUE ("workspace_id", "place_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Sync Supabase auth.users into public.users automatically -----------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users ("id", "email", "full_name", "avatar_url")
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@user.local'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Sync any users that already exist in auth.users
INSERT INTO public.users ("id", "email", "full_name", "avatar_url")
SELECT
  id,
  COALESCE(email, id::text || '@user.local'),
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

COMMIT;
