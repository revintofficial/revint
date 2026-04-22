import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  extractDiscoveredLinks,
  type AgentRunForLinks,
} from "@/lib/discovered-links";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        watchlistItem: true,
        googleReviews: { orderBy: { publishTime: "desc" } },
        reviewAnalysis: true,
        voiceNotes: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Pull the most recent SUCCEEDED output per worker kind. Multiple runs
    // of the same actor (e.g. SERP snapshot before and after publishing the
    // new site) would otherwise inflate the discovered-links list; the
    // latest run is the freshest truth.
    const runs = await prisma.agentRun.findMany({
      where: { workspaceId, leadId: id, status: "SUCCEEDED" },
      orderBy: { finishedAt: "desc" },
      select: {
        id: true,
        workerKind: true,
        outputJson: true,
        finishedAt: true,
      },
      take: 100,
    });
    const latestByKind = new Map<string, AgentRunForLinks>();
    for (const r of runs) {
      if (!latestByKind.has(r.workerKind)) {
        latestByKind.set(r.workerKind, {
          workerKind: r.workerKind,
          outputJson: r.outputJson,
        });
      }
    }

    const socials = lead.websiteAudit?.socialProfiles as
      | Record<string, unknown>
      | null
      | undefined;
    const ignoreUrls = [
      lead.websiteUrl,
      ...(socials
        ? Object.values(socials).filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          )
        : []),
    ].filter((v): v is string => typeof v === "string" && v.length > 0);

    const discoveredLinks = extractDiscoveredLinks({
      agentRuns: Array.from(latestByKind.values()),
      ignoreUrls,
      maxPerPlatform: 3,
    });

    return NextResponse.json({ ...lead, discoveredLinks });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.detail_fetch_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}
