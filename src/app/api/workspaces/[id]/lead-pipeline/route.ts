/**
 * GET / PUT /api/workspaces/[id]/lead-pipeline
 *
 * Workspace-scoped lead onboarding pipeline configuration. Backs the
 * Settings → Lead Pipeline editor.
 *
 * - GET returns the saved (preset, steps) plus a fresh cost estimate
 *   for 100 leads. The estimate is computed from the workspace's own
 *   30-day SUCCEEDED runs where available, with seed fallback.
 * - PUT writes a new preset / steps tuple. Non-CUSTOM presets ignore
 *   any `steps` payload and regenerate from `getDefaultChain` so a
 *   stale UI state cannot pin a workspace to outdated defaults.
 *   CUSTOM payloads are validated (no cycles, no plan-locked workers,
 *   only allowed kinds) before persisting.
 *
 * Authorization: caller must be a member of the workspace; OWNER /
 * ADMIN are allowed to mutate (`PUT`). MEMBER can only read (`GET`).
 *
 * Multi-tenancy: every prisma read filters by the URL's `id` AND a
 * `workspaceMember` row that matches the caller. Cross-tenant ids
 * therefore return 403 even if the workspace exists.
 */
import { NextResponse } from "next/server";
import type { PipelinePreset, Plan } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  getDefaultChain,
  validateLeadPipelineChain,
  ChainValidationError,
  type Chain,
} from "@/lib/ai-core/chains";
import { estimateChainCost } from "@/lib/agent-workers/cost-estimator";

const VALID_PRESETS: ReadonlySet<PipelinePreset> = new Set<PipelinePreset>([
  "LITE",
  "BALANCED",
  "AGGRESSIVE",
  "CUSTOM",
]);

interface MembershipContext {
  workspaceId: string;
  plan: Plan;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

/**
 * Resolves the caller's membership in the target workspace. Returns
 * null when the workspace doesn't exist OR the caller isn't a member
 * of it — the route translates either to 403 to avoid leaking which
 * workspace ids exist on the platform.
 */
async function loadMembership(
  workspaceId: string,
  userId: string,
): Promise<MembershipContext | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId },
    include: { workspace: { select: { id: true, plan: true } } },
  });
  if (!membership) return null;
  return {
    workspaceId: membership.workspace.id,
    plan: membership.workspace.plan,
    role: membership.role,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const ctx = await loadMembership(id, session.user.id);
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await prisma.workspaceLeadPipeline.findUnique({
      where: { workspaceId: ctx.workspaceId },
      select: { preset: true, steps: true, enabled: true, updatedAt: true },
    });

    const preset: PipelinePreset = row?.preset ?? "BALANCED";
    const enabled = row?.enabled ?? true;

    // For non-CUSTOM presets the UI always shows the freshly derived
    // chain so a plan upgrade visibly unlocks new workers without
    // requiring a save round-trip.
    let resolvedSteps: Chain;
    if (preset === "CUSTOM" && row?.steps) {
      try {
        validateLeadPipelineChain(row.steps as unknown as Chain);
        resolvedSteps = row.steps as unknown as Chain;
      } catch {
        resolvedSteps = getDefaultChain("BALANCED", ctx.plan);
      }
    } else {
      resolvedSteps = getDefaultChain(preset, ctx.plan);
    }

    const estimate = await estimateChainCost({
      workspaceId: ctx.workspaceId,
      plan: ctx.plan,
      chain: resolvedSteps,
      leadCount: 100,
    });

    return NextResponse.json({
      preset,
      enabled,
      steps: resolvedSteps,
      plan: ctx.plan,
      estimate,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.lead_pipeline.get_error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load lead pipeline" },
      { status: 500 },
    );
  }
}

interface PutBody {
  preset?: PipelinePreset;
  steps?: Chain;
  enabled?: boolean;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const ctx = await loadMembership(id, session.user.id);
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (ctx.role === "MEMBER") {
      return NextResponse.json(
        { error: "Only admins or owners can change the pipeline" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as PutBody;
    const preset = body.preset ?? "BALANCED";
    if (!VALID_PRESETS.has(preset)) {
      return NextResponse.json({ error: `Unknown preset "${preset}"` }, { status: 400 });
    }

    let stepsToPersist: Chain;
    if (preset === "CUSTOM") {
      if (!Array.isArray(body.steps)) {
        return NextResponse.json(
          { error: "CUSTOM preset requires a non-empty steps array" },
          { status: 400 },
        );
      }
      try {
        validateLeadPipelineChain(body.steps);
      } catch (err) {
        if (err instanceof ChainValidationError) {
          return NextResponse.json({ error: err.reason }, { status: 400 });
        }
        throw err;
      }
      stepsToPersist = body.steps;
    } else {
      // For preset rows we persist the *derived* steps too. That way
      // the orchestrator can read `steps` directly in the rare case
      // resolveLeadCreatedChain regresses, and the editor UI gets a
      // consistent snapshot regardless of preset / CUSTOM toggle.
      stepsToPersist = getDefaultChain(preset, ctx.plan);
    }

    const enabled = body.enabled ?? true;

    const saved = await prisma.workspaceLeadPipeline.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: {
        workspaceId: ctx.workspaceId,
        preset,
        steps: stepsToPersist as unknown as object,
        enabled,
      },
      update: {
        preset,
        steps: stepsToPersist as unknown as object,
        enabled,
      },
      select: { preset: true, steps: true, enabled: true, updatedAt: true },
    });

    logger.info("api.lead_pipeline.updated", {
      workspaceId: ctx.workspaceId,
      preset,
      enabled,
      stepCount: stepsToPersist.length,
      changedBy: session.user.id,
    });

    const estimate = await estimateChainCost({
      workspaceId: ctx.workspaceId,
      plan: ctx.plan,
      chain: stepsToPersist,
      leadCount: 100,
    });

    return NextResponse.json({
      preset: saved.preset,
      enabled: saved.enabled,
      steps: saved.steps as unknown as Chain,
      plan: ctx.plan,
      estimate,
      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.lead_pipeline.put_error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to update lead pipeline" },
      { status: 500 },
    );
  }
}
