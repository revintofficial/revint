import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { emit } from "@/lib/ai-core/events";

/**
 * Phase 0/B4 — DEPRECATED.
 *
 * The legacy `crawl` queue + `crawl-worker.ts` ran in parallel with
 * AI Core's `WEBSITE_AUDITOR` step inside the `lead_created` chain,
 * so two writers raced on the same `WebsiteAudit` row and FineDine
 * SDRs occasionally saw the older crawl's output overwrite the newer
 * AI Core output (or vice versa).
 *
 * This endpoint is retained for backwards compatibility but no longer
 * enqueues into the legacy `crawl` queue. Instead it kicks off the
 * canonical `lead_created` AI Core chain (which includes WEBSITE_AUDITOR
 * as its first step + classifier, scorer, dossier, mockup, intelligence
 * brief). Callers see the same 202 envelope and can poll
 * `/api/leads/[id]` for `crawlStatus` updates.
 *
 * The `Deprecation` and `Sunset` headers signal to API consumers that
 * this surface will be replaced with a 410 in a future release. The
 * dashboard "Scan websites" button is being renamed to "Re-analyze"
 * in Phase 1 and will hit `POST /api/leads/[id]/pipeline-rerun` directly.
 */
export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const rl = await checkRateLimit(workspaceId, LIMITS.crawl);
    if (!rl.ok) return rateLimitResponse(rl);
    const body = await request.json().catch(() => ({}));
    const { leadId, crawlAll = false } = (body ?? {}) as {
      leadId?: string;
      crawlAll?: boolean;
    };

    logger.info("api.crawl.deprecated_call", { workspaceId, leadId, crawlAll });

    if (crawlAll) {
      const pendingLeads = await prisma.lead.findMany({
        where: {
          workspaceId,
          crawlStatus: "PENDING",
          hasWebsite: true,
          websiteUrl: { not: null },
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
          deprecated: "Use POST /api/leads/[id]/pipeline-rerun for individual rebuilds.",
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
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true, websiteUrl: true },
    });
    if (!lead || !lead.websiteUrl) {
      return NextResponse.json(
        { error: "Lead not found or has no website" },
        { status: 404 },
      );
    }

    await emit("lead_created", { workspaceId, leadId: lead.id });

    return new NextResponse(
      JSON.stringify({
        success: true,
        enqueued: 1,
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
    logger.error("api.crawl.error", { err: error });
    return NextResponse.json(
      { error: "Crawl enqueue failed", details: String(error) },
      { status: 500 },
    );
  }
}
