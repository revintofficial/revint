import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { emit } from "@/lib/ai-core/events";

/**
 * Phase 0/B4 — DEPRECATED.
 *
 * The legacy `analyze-worker.ts` upserted SalesOpportunity rows while
 * AI Core's `SALES_OPPORTUNITY_SCORER` did the same thing in the
 * `lead_created` chain. Both used very similar Gemini logic but
 * different cost-tracking semantics, and the two paths could race on
 * the same SalesOpportunity row.
 *
 * This route is now a thin facade that re-emits `lead_created` so the
 * AI Core chain (audit → classifier → scorer → dossier → mockup →
 * intelligence brief) is the single source of truth. The 202 response
 * carries a `Deprecation: true` header so legacy callers can be
 * migrated to `POST /api/leads/[id]/pipeline-rerun` ahead of the
 * Sunset window.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    const rl = await checkRateLimit(workspaceId, LIMITS.analyze);
    if (!rl.ok) return rateLimitResponse(rl);

    const body = await request.json().catch(() => ({}));
    const { leadId, analyzeAll = false } = body ?? {};

    logger.info("api.analyze.deprecated_call", {
      workspaceId,
      leadId,
      analyzeAll,
    });

    if (analyzeAll) {
      const pendingLeads = await prisma.lead.findMany({
        where: {
          workspaceId,
          analyzeStatus: "PENDING",
          OR: [
            { crawlStatus: "CRAWLED" },
            { crawlStatus: "NO_WEBSITE" },
            { crawlStatus: "FAILED" },
          ],
        },
        select: { id: true },
        take: 200,
      });
      for (const lead of pendingLeads) {
        await emit("lead_created", { workspaceId, leadId: lead.id });
      }
      return new NextResponse(
        JSON.stringify({
          success: true,
          enqueued: pendingLeads.length,
          total: pendingLeads.length,
          deprecated: "Use POST /api/leads/[id]/pipeline-rerun.",
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
            Deprecation: "true",
            Sunset: "Mon, 01 Sep 2026 00:00:00 GMT",
            Link: '</api/leads/[id]/pipeline-rerun>; rel="successor-version"',
          },
        },
      );
    }

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await emit("lead_created", { workspaceId, leadId: lead.id });

    return new NextResponse(
      JSON.stringify({
        success: true,
        leadId: lead.id,
        deprecated: "Use POST /api/leads/[id]/pipeline-rerun.",
      }),
      {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          Deprecation: "true",
          Sunset: "Mon, 01 Sep 2026 00:00:00 GMT",
        },
      },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.analyze.error", { err: error });
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 },
    );
  }
}
