/**
 * POST /api/workspaces/[id]/lead-pipeline/dry-run
 *
 * Returns the cost / duration estimate for an *unsaved* pipeline
 * configuration. The editor UI uses this to live-update the
 * "100 lead için tahmini X token + $Y" footer as the user toggles
 * presets or individual workers without committing changes.
 *
 * Body shape:
 *   { preset: PipelinePreset; steps?: Chain; leadCount?: number }
 *
 *   - preset !== CUSTOM: `steps` is ignored; the canonical chain for
 *     the (preset, workspace plan) tuple is used.
 *   - preset === CUSTOM: `steps` is validated and the estimate runs
 *     against the user-supplied chain.
 *
 * Authorization: workspace member only. No mutation; MEMBER role is
 * sufficient.
 *
 * Multi-tenancy: identical guard as `lead-pipeline/route.ts`.
 */
import { NextResponse } from "next/server";
import type { PipelinePreset } from "@/generated/prisma/client";
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

interface DryRunBody {
  preset?: PipelinePreset;
  steps?: Chain;
  leadCount?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id, workspaceId: id },
      include: { workspace: { select: { plan: true, id: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as DryRunBody;
    const preset = body.preset ?? "BALANCED";
    if (!VALID_PRESETS.has(preset)) {
      return NextResponse.json(
        { error: `Unknown preset "${preset}"` },
        { status: 400 },
      );
    }

    const leadCount = clampLeadCount(body.leadCount);

    let chain: Chain;
    if (preset === "CUSTOM") {
      if (!Array.isArray(body.steps) || body.steps.length === 0) {
        return NextResponse.json(
          { error: "CUSTOM dry-run requires a non-empty steps array" },
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
      chain = body.steps;
    } else {
      chain = getDefaultChain(preset, membership.workspace.plan);
    }

    const estimate = await estimateChainCost({
      workspaceId: membership.workspace.id,
      plan: membership.workspace.plan,
      chain,
      leadCount,
    });

    return NextResponse.json({
      preset,
      plan: membership.workspace.plan,
      leadCount,
      steps: chain,
      estimate,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.lead_pipeline.dry_run_error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to run dry-run estimate" },
      { status: 500 },
    );
  }
}

/**
 * Clamps the user-supplied leadCount so a runaway number can't make
 * the cost calculation slow. 1..10000 covers every realistic preset
 * footer ("show me cost for 100 / 500 / 1000 leads").
 */
function clampLeadCount(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 100;
  if (n < 1) return 1;
  if (n > 10_000) return 10_000;
  return n;
}
