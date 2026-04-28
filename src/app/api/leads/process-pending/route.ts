/**
 * POST /api/leads/process-pending
 *
 * Re-emits `lead_created` for every lead in the caller's workspace
 * that was deferred by the ServicePackage gate (P0.4) — i.e.
 * `pipelineStatus = BLOCKED_NEEDS_PACKAGES`. Triggered from the
 * Settings → Service Packages CTA after the workspace adds at least
 * one package, so all the leads that arrived during the empty-package
 * window now run through the proper pipeline.
 *
 * Idempotent: leads that were already processed (status flipped back
 * to OK by `events.emit`) are skipped on the next call. Leads whose
 * planner refuses to start again (workspace pipeline disabled, etc.)
 * stay BLOCKED_NEEDS_PACKAGES so the rep can see what's still
 * waiting.
 *
 * Multi-tenant scope: every read/write is scoped by `workspaceId`
 * from `requireUser()`. Cross-tenant leak via this route would let
 * one tenant kick off pipeline runs against another tenant's leads —
 * highest-severity bug class, hence the explicit composite filter on
 * every query.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { emit } from "@/lib/ai-core/events";
import { workspaceHasServicePackages } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PENDING_BATCH = 500;

export async function POST() {
  try {
    const session = await requireUser();
    const { workspaceId } = session;

    // Bail early if the workspace still has zero packages — the
    // gate would block every emit and we'd burn a round-trip per
    // lead for nothing.
    const ok = await workspaceHasServicePackages(workspaceId);
    if (!ok) {
      return NextResponse.json(
        {
          error: "no_service_packages",
          message:
            "Configure at least one service package before processing pending leads.",
        },
        { status: 400 },
      );
    }

    // Snapshot the blocked queue. We cap at MAX_PENDING_BATCH so a
    // workspace that's been collecting leads for weeks doesn't hang
    // the response on a single click — they can re-call to drain.
    const blocked = await prisma.lead.findMany({
      where: {
        workspaceId,
        pipelineStatus: "BLOCKED_NEEDS_PACKAGES",
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: MAX_PENDING_BATCH,
    });

    if (blocked.length === 0) {
      return NextResponse.json({
        ok: true,
        requested: 0,
        processed: 0,
        message: "No leads waiting for service packages.",
      });
    }

    // Flip the status BEFORE emitting so the gate inside `emit` sees
    // an OK lead and doesn't immediately re-block it. If `emit`
    // fails downstream, the catch path re-blocks the affected lead
    // so the operator can retry on the next click.
    await prisma.lead.updateMany({
      where: {
        id: { in: blocked.map((l) => l.id) },
        workspaceId,
      },
      data: { pipelineStatus: "OK" },
    });

    let succeeded = 0;
    let failed = 0;
    for (const lead of blocked) {
      try {
        const sessionId = await emit("lead_created", {
          workspaceId,
          leadId: lead.id,
          userId: session.user.id,
          inputs: { source: "process-pending" },
        });
        if (sessionId) {
          succeeded += 1;
        } else {
          // emit() returned "" → planner declined (pipeline disabled,
          // or the gate re-fired because packages disappeared between
          // the pre-check and the loop). Re-mark as blocked so the UI
          // doesn't lie about the count.
          failed += 1;
          await prisma.lead.updateMany({
            where: { id: lead.id, workspaceId },
            data: { pipelineStatus: "BLOCKED_NEEDS_PACKAGES" },
          });
        }
      } catch (err) {
        failed += 1;
        logger.warn("api.leads.process_pending.emit_failed", {
          workspaceId,
          leadId: lead.id,
          err: err instanceof Error ? err.message : String(err),
        });
        await prisma.lead.updateMany({
          where: { id: lead.id, workspaceId },
          data: { pipelineStatus: "BLOCKED_NEEDS_PACKAGES" },
        });
      }
    }

    logger.info("api.leads.process_pending.done", {
      workspaceId,
      requested: blocked.length,
      succeeded,
      failed,
    });

    return NextResponse.json({
      ok: true,
      requested: blocked.length,
      processed: succeeded,
      failed,
      cappedAtBatch: blocked.length === MAX_PENDING_BATCH,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.process_pending.error", error);
  }
}

/**
 * GET /api/leads/process-pending
 *
 * Lightweight count for the dashboard banner / Settings page so we
 * can render "X leads waiting" without forcing the operator to
 * actually trigger the batch.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const count = await prisma.lead.count({
      where: { workspaceId, pipelineStatus: "BLOCKED_NEEDS_PACKAGES" },
    });
    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.process_pending.count_error", error);
  }
}
