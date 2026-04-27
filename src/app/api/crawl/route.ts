import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { getCrawlQueue } from "@/lib/queues";
import { logger } from "@/lib/logger";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";

/**
 * Crawl is long-running (headless browser, network fetches per site) and
 * must run out-of-band. This endpoint only enqueues BullMQ jobs; the
 * crawl-worker processes them and updates lead.crawlStatus. The UI polls
 * /api/leads/[id] to see progress.
 */
export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    // Crawl jobs touch the headless browser pool; rate-limit per workspace so
    // a single tenant cannot starve the worker queue with bulk enqueues.
    const rl = await checkRateLimit(workspaceId, LIMITS.crawl);
    if (!rl.ok) return rateLimitResponse(rl);
    const body = await request.json().catch(() => ({}));
    const { leadId, crawlAll = false } = (body ?? {}) as {
      leadId?: string;
      crawlAll?: boolean;
    };

    const queue = getCrawlQueue();

    if (crawlAll) {
      const pendingLeads = await prisma.lead.findMany({
        where: {
          workspaceId,
          crawlStatus: "PENDING",
          hasWebsite: true,
          websiteUrl: { not: null },
        },
        select: { id: true, websiteUrl: true },
        take: 200,
      });

      let enqueued = 0;
      for (const lead of pendingLeads) {
        if (!lead.websiteUrl) continue;
        await queue.add(
          "crawl",
          { leadId: lead.id, websiteUrl: lead.websiteUrl },
          { removeOnComplete: 100, removeOnFail: 50, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
        );
        enqueued++;
      }
      return NextResponse.json(
        { success: true, enqueued, total: pendingLeads.length },
        { status: 202 },
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
        { status: 404 }
      );
    }

    await queue.add(
      "crawl",
      { leadId: lead.id, websiteUrl: lead.websiteUrl },
      { removeOnComplete: 100, removeOnFail: 50, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );

    return NextResponse.json(
      { success: true, enqueued: 1, leadId: lead.id },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.crawl.error", { err: error });
    return NextResponse.json(
      { error: "Crawl enqueue failed", details: String(error) },
      { status: 500 }
    );
  }
}
