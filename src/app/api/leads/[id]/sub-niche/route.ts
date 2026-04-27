/**
 * PATCH /api/leads/[id]/sub-niche
 *
 * Manual sub-niche override by a sales rep. Replaces the classifier's
 * `subNicheSlug` with the rep's pick, marks the row as MANUAL (so the
 * classifier worker self-skips on subsequent runs), and bumps
 * `subNicheVersion` so any in-flight worker scheduled with the old
 * snapshot exits early via the stale-version guard in `execute.ts`.
 *
 * After the bump the route re-emits `lead_created` so the AI Core
 * pipeline (audit → classifier (no-op for MANUAL) → score → opener →
 * mockup) re-runs with the corrected sub-niche. The classifier worker
 * detects MANUAL leads and skips the override step itself, so this
 * does NOT trigger a classification battle with the rep's pick.
 *
 * Multi-tenant scope: every read + write filters on the caller's
 * workspaceId. Cross-workspace lead ids return 404 with no side-channel
 * signal.
 *
 * Body: `{ subNicheSlug: string | null }`. `null` clears the override
 * (the next classifier run is free to re-pick a slug).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";
import { getChildrenOf, getNicheBySlug } from "@/lib/niches";
import { emit } from "@/lib/ai-core/events";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const body = (await request.json().catch(() => ({}))) as {
      subNicheSlug?: string | null;
    };
    const requestedSlug =
      typeof body.subNicheSlug === "string" && body.subNicheSlug.length > 0
        ? body.subNicheSlug
        : null;

    // Workspace-scoped lookup. findFirst means cross-workspace leadIds
    // surface as 404, never as a row leak.
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId: session.workspaceId },
      select: {
        id: true,
        nicheSlug: true,
        subNicheSlug: true,
        subNicheVersion: true,
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Validation: when a slug is provided it must exist in the niche
    // registry AND be a child of the lead's parent niche. Cross-parent
    // overrides (e.g. tagging a fnb lead as "dental-something") are
    // refused — they almost always indicate a UI bug, not an intent.
    if (requestedSlug) {
      const pack = getNicheBySlug(requestedSlug);
      if (!pack) {
        return NextResponse.json(
          { error: `Unknown niche slug: ${requestedSlug}` },
          { status: 400 },
        );
      }
      if (!pack.parentSlug) {
        return NextResponse.json(
          {
            error:
              "Provided slug is a parent niche, not a sub-niche. Pass null to clear the override instead.",
          },
          { status: 400 },
        );
      }
      if (lead.nicheSlug && pack.parentSlug !== lead.nicheSlug) {
        return NextResponse.json(
          {
            error: `Sub-niche "${requestedSlug}" belongs to "${pack.parentSlug}" but this lead is under "${lead.nicheSlug}".`,
          },
          { status: 400 },
        );
      }
    }

    // No-op short-circuit: if the rep's pick matches what the row
    // already says AND it's already MANUAL there's nothing to do.
    // (We still allow a re-emit on identical AUTO→MANUAL upgrades so
    // the rep's confirmation fixes the source field even when the
    // slug doesn't change.)
    if (
      requestedSlug === lead.subNicheSlug &&
      requestedSlug !== null
    ) {
      const sourceCheck = await prisma.lead.findUnique({
        where: { id: lead.id },
        select: { subNicheSource: true, subNicheVersion: true },
      });
      if (sourceCheck?.subNicheSource === "MANUAL") {
        return NextResponse.json({
          ok: true,
          changed: false,
          subNicheSlug: requestedSlug,
          subNicheSource: "MANUAL",
          subNicheVersion: sourceCheck.subNicheVersion,
        });
      }
    }

    // Single transaction: bump version + flip source. The version
    // increment is the only thing the stale-run guard in
    // `agent-workers/execute.ts` reads, so it MUST land in the same
    // write that updates the slug.
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        subNicheSlug: requestedSlug,
        // Manual overrides are gold-standard; the confidence gate in
        // opener/audit prompts checks for MANUAL specifically and
        // skips the >=0.7 threshold, so this value is mostly cosmetic.
        // Setting it to 1 makes telemetry / sorting cleaner.
        subNicheConfidence: requestedSlug ? 1 : null,
        subNicheSource: requestedSlug ? "MANUAL" : null,
        subNicheVersion: { increment: 1 },
      },
      select: {
        subNicheSlug: true,
        subNicheSource: true,
        subNicheConfidence: true,
        subNicheVersion: true,
      },
    });

    logger.info("api.leads.sub_niche_override", {
      workspaceId: session.workspaceId,
      leadId: lead.id,
      previous: lead.subNicheSlug,
      next: requestedSlug,
      version: updated.subNicheVersion,
    });

    // Fire-and-forget re-pipeline. The classifier worker self-skips
    // when subNicheSource === "MANUAL", so this won't fight the rep's
    // pick. Audit, scorer, opener, and mockup workers will pick up
    // the new sub-niche from the lead row when they run.
    try {
      await emit("lead_created", {
        workspaceId: session.workspaceId,
        leadId: lead.id,
        userId: session.user.id,
        inputs: { reason: "sub_niche_override" },
      });
    } catch (err) {
      logger.error("api.leads.sub_niche_override_emit_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
      // Non-fatal: the override row itself is committed; the rep can
      // re-trigger downstream workers from the UI if needed.
    }

    return NextResponse.json({
      ok: true,
      changed: true,
      subNicheSlug: updated.subNicheSlug,
      subNicheSource: updated.subNicheSource,
      subNicheConfidence: updated.subNicheConfidence,
      subNicheVersion: updated.subNicheVersion,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.sub_niche_override_error", err);
  }
}

/**
 * GET /api/leads/[id]/sub-niche
 *
 * Returns the list of valid child slugs for the lead's parent niche,
 * the current assignment, and metadata the override UI needs to render
 * its dropdown. Kept on the same route so the page can call a single
 * endpoint instead of also reading the niche registry on the client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId: session.workspaceId },
      select: {
        nicheSlug: true,
        subNicheSlug: true,
        subNicheSource: true,
        subNicheConfidence: true,
        subNicheVersion: true,
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const children = lead.nicheSlug ? getChildrenOf(lead.nicheSlug) : [];
    return NextResponse.json({
      nicheSlug: lead.nicheSlug,
      subNicheSlug: lead.subNicheSlug,
      subNicheSource: lead.subNicheSource,
      subNicheConfidence: lead.subNicheConfidence,
      subNicheVersion: lead.subNicheVersion,
      // We expose a slim shape the dropdown needs; full NichePack
      // (includes regex literals etc.) is a server-only construct.
      options: children.map((c) => ({
        slug: c.slug,
        label: c.label,
        tagline: c.tagline,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.sub_niche_get_error", err);
  }
}
