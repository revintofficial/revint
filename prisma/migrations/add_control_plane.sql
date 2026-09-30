BEGIN;
-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('VIEWER', 'REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('PASS', 'FAIL', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "EvalRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "platform_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_events" (
    "id" TEXT NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_role" "PlatformRole" NOT NULL,
    "workspace_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "approval_user_id" UUID,
    "outcome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_calibration_versions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'DRAFT',
    "icp_json" JSONB NOT NULL,
    "packages_json" JSONB NOT NULL,
    "claims_json" JSONB NOT NULL,
    "playbook_json" JSONB NOT NULL,
    "pipeline_json" JSONB NOT NULL,
    "base_version_id" TEXT,
    "reason" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "activated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),

    CONSTRAINT "workspace_calibration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_datasets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_cases" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "source_lead_id" TEXT,
    "source_run_id" TEXT,
    "title" TEXT NOT NULL,
    "segment" TEXT,
    "country" TEXT,
    "language" TEXT,
    "input_snapshot" JSONB NOT NULL,
    "output_snapshot" JSONB NOT NULL,
    "expected_json" JSONB NOT NULL,
    "severity" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approved_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_reviews" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "agent_run_id" TEXT,
    "eval_case_id" TEXT,
    "verdict" "ReviewVerdict" NOT NULL,
    "error_class" TEXT,
    "severity" TEXT,
    "note" TEXT,
    "reviewer_user_id" UUID NOT NULL,
    "second_reviewer_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "calibration_version_id" TEXT,
    "status" "EvalRunStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_user_id" UUID NOT NULL,
    "summary_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_case_results" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "eval_run_id" TEXT NOT NULL,
    "eval_case_id" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "failures" JSONB NOT NULL,
    "output_json" JSONB NOT NULL,

    CONSTRAINT "eval_case_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_assignments_user_id_key" ON "platform_role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "admin_audit_events_workspace_id_created_at_idx" ON "admin_audit_events"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_events_target_type_target_id_idx" ON "admin_audit_events"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "workspace_calibration_versions_workspace_id_status_idx" ON "workspace_calibration_versions"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_calibration_versions_workspace_id_version_key" ON "workspace_calibration_versions"("workspace_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "eval_datasets_workspace_id_name_key" ON "eval_datasets"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "eval_cases_workspace_id_dataset_id_idx" ON "eval_cases"("workspace_id", "dataset_id");

-- CreateIndex
CREATE INDEX "human_reviews_workspace_id_created_at_idx" ON "human_reviews"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "human_reviews_workspace_id_lead_id_idx" ON "human_reviews"("workspace_id", "lead_id");

-- CreateIndex
CREATE INDEX "eval_runs_workspace_id_dataset_id_created_at_idx" ON "eval_runs"("workspace_id", "dataset_id", "created_at");

-- CreateIndex
CREATE INDEX "eval_case_results_workspace_id_eval_run_id_idx" ON "eval_case_results"("workspace_id", "eval_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "eval_case_results_eval_run_id_eval_case_id_key" ON "eval_case_results"("eval_run_id", "eval_case_id");

-- AddForeignKey
ALTER TABLE "platform_role_assignments" ADD CONSTRAINT "platform_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_calibration_versions" ADD CONSTRAINT "workspace_calibration_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_datasets" ADD CONSTRAINT "eval_datasets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "eval_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_case_results" ADD CONSTRAINT "eval_case_results_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_case_results" ADD CONSTRAINT "eval_case_results_eval_run_id_fkey" FOREIGN KEY ("eval_run_id") REFERENCES "eval_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only control-plane data; Prisma connects as owner.
ALTER TABLE "platform_role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_calibration_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eval_datasets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eval_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "human_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eval_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eval_case_results" ENABLE ROW LEVEL SECURITY;
COMMIT;

