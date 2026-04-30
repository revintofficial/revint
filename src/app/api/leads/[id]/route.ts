import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  extractDiscoveredLinks,
  type AgentRunForLinks,
} from "@/lib/discovered-links";
import { runAuditChecklist } from "@/lib/audit-checklist";
import type { WebsiteFeatures } from "@/types";

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
        workspace: { select: { niche: true } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Resolve the analyst-recommended ServicePackage. Workspace-scoped on
    // purpose: even though `recommendedPackageId` is free-text on the
    // SalesOpportunity row (no FK), we never trust it past the workspace
    // boundary. A package that was deleted/renamed since the analysis
    // ran returns null here, so the UI quietly falls back to the legacy
    // suggestedOffer enum.
    let recommendedPackage: {
      id: string;
      name: string;
      priceLabel: string;
      features: string[];
    } | null = null;
    if (lead.salesOpportunity?.recommendedPackageId) {
      const pkg = await prisma.servicePackage.findFirst({
        where: {
          id: lead.salesOpportunity.recommendedPackageId,
          workspaceId,
        },
        select: { id: true, name: true, priceLabel: true, features: true },
      });
      recommendedPackage = pkg ?? null;
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

    // Phase 0/B2 — single source of truth for "Checks Passed". Use the
    // SAME `runAuditChecklist` logic that the website-plan endpoint and
    // dossier prompt build with, so the rep sees a consistent number
    // regardless of where they look. Falls back to null when the lead
    // has no audit at all (or the audit has no extracted features).
    let auditSummary: ReturnType<typeof runAuditChecklist>["summary"] | null = null;
    if (lead.websiteAudit) {
      const features = lead.websiteAudit.rawFeaturesJson as WebsiteFeatures | null;
      const checklist = runAuditChecklist(
        features,
        lead.hasWebsite,
        lead.workspace?.niche ?? null,
        lead.subNicheSlug,
      );
      auditSummary = checklist.summary;
    }

    return NextResponse.json({
      ...lead,
      discoveredLinks,
      auditSummary,
      salesOpportunity: lead.salesOpportunity
        ? { ...lead.salesOpportunity, recommendedPackage }
        : null,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.detail_fetch_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}
