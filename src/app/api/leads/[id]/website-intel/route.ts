/**
 * GET /api/leads/[id]/website-intel
 *
 * Phase 2.5 — companion endpoint for the v2 lead-detail HISTORY block
 * "full website panel" lazy expand. The aggregator
 * (`/decision-surface`) returns the chip-strip SUMMARY (booking,
 * mobile, https, contact-form booleans + load time). This route
 * returns the FULL `WebsiteAudit` row + the audit-checklist scoring
 * + the latest deep-research / web-crawl run output snippet so the
 * panel can re-skin the legacy `WebsiteIntelligencePanel` without a
 * second refetch.
 *
 * Per PLAN §4 Phase 2.5:
 *   "Returns the full WebsiteAudit shape + the legacy ad-hoc
 *    content-check / website-search bridge. requireUser() then
 *    workspaceId-scoped. Lazy-fired only when WHY NOW or HISTORY's
 *    full website panel expands."
 *
 * MULTI-TENANT SCOPE AUDIT:
 * - `requireUser()` first; workspaceId trusted from session.
 * - Lead pre-check enforces workspace membership.
 * - WebsiteAudit is scoped via the parent leadId (its `Lead` parent
 *   is workspace-owned). The deep-research run is filtered by both
 *   `workspaceId` and `leadId` so direct-DB scoping is enforced
 *   even if the lead pre-check were bypassed.
 *
 * QUERY-COUNT BUDGET: ≤ 4 (PLAN §3 SLOs / §4 Phase 2.5 DoD).
 *   1. lead pre-check (workspace gate; pulls niche + sub-niche to
 *      feed the F&B-aware checklist branches).
 *   2. WebsiteAudit findUnique
 *   3. Latest APIFY_WEB_CRAWL_DEEP / WEBSITE_AUDITOR run for the
 *      "content check / website search bridge" snippet.
 *
 * PERF BUDGET: p95 ≤ 150ms hot DB.
 *
 * PLAN GATING: FREE-friendly — the legacy `WebsiteIntelligencePanel`
 *   was not gated. PRO+ users get the full `rawFeaturesJson` blob
 *   for power-tool deep dives; FREE sees a trimmed projection that
 *   still covers the V1 chip strip + nav / CTA / contact email
 *   arrays + the audit-checklist score.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { runAuditChecklist } from "@/lib/audit-checklist";
import type { WebsiteFeatures, AuditChecklistResult } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuditFull {
  id: string;
  url: string;
  reachable: boolean;
  crawlAttemptedAt: string | null;
  crawlError: string | null;
  httpStatus: number | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasBookingSystem: boolean;
  bookingProvider: string | null;
  hasEcommerce: boolean;
  servicesDetected: unknown;
  navItems: unknown;
  ctaLinks: unknown;
  contactEmails: unknown;
  contactEmailsVerified: unknown;
  socialProfiles: unknown;
  brokenLinksCount: number;
  structuredDataPresent: boolean;
  /** PRO+ only — `rawFeaturesJson` for power-tool deep dives. FREE sees null. */
  rawFeaturesJson: unknown | null;
  createdAt: string;
}

interface DeepResearchSnippet {
  runId: string;
  workerKind: string;
  finishedAt: string;
  /** First 400 chars of the run summary or output title. */
  snippet: string | null;
}

export interface WebsiteIntelResponse {
  hasWebsite: boolean;
  audit: AuditFull | null;
  /** Re-runs the same checklist used by the website-plan / IcpDimensions bar.
   * Null when there's no audit (lead has no website OR never crawled).  */
  checklist: AuditChecklistResult | null;
  /** Latest deep-research / website-auditor run summary. Null when never run. */
  deepResearch: DeepResearchSnippet | null;
  /** Plan tier of the caller — UI uses this to conditionally render PRO+ panels. */
  planGate: { plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY"; rawFeaturesUnlocked: boolean };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { workspaceId } = session;
    const plan = session.workspace.plan;
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        websiteUrl: true,
        hasWebsite: true,
        primaryType: true,
        subNicheSlug: true,
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // The audit + deep-research fan out in one transaction so we
    // never pay 2× round-trip latency. The deep-research filter
    // includes `workspaceId` (belt + braces — the lead pre-check
    // already gates this).
    const [audit, deepRun] = await prisma.$transaction([
      prisma.websiteAudit.findUnique({
        where: { leadId: id },
      }),
      prisma.agentRun.findFirst({
        where: {
          workspaceId,
          leadId: id,
          status: "SUCCEEDED",
          workerKind: { in: ["APIFY_WEB_CRAWL_DEEP", "WEBSITE_AUDITOR"] },
        },
        orderBy: { finishedAt: "desc" },
        select: {
          id: true,
          workerKind: true,
          finishedAt: true,
          outputJson: true,
        },
      }),
    ]);

    const rawFeaturesUnlocked = plan !== "FREE";

    const auditFull: AuditFull | null = audit
      ? {
          id: audit.id,
          url: audit.url,
          reachable: audit.reachable,
          crawlAttemptedAt: audit.crawlAttemptedAt?.toISOString() ?? null,
          crawlError: audit.crawlError,
          httpStatus: audit.httpStatus,
          loadTimeMs: audit.loadTimeMs,
          https: audit.https,
          mobileFriendlyGuess: audit.mobileFriendlyGuess,
          title: audit.title,
          metaDescription: audit.metaDescription,
          h1: audit.h1,
          hasContactForm: audit.hasContactForm,
          hasWhatsappLink: audit.hasWhatsappLink,
          hasBookingSystem: audit.hasBookingSystem,
          bookingProvider: audit.bookingProvider,
          hasEcommerce: audit.hasEcommerce,
          servicesDetected: audit.servicesDetected,
          navItems: audit.navItems,
          ctaLinks: audit.ctaLinks,
          contactEmails: audit.contactEmails,
          contactEmailsVerified: audit.contactEmailsVerified,
          socialProfiles: audit.socialProfiles,
          brokenLinksCount: audit.brokenLinksCount,
          structuredDataPresent: audit.structuredDataPresent,
          rawFeaturesJson: rawFeaturesUnlocked ? audit.rawFeaturesJson : null,
          createdAt: audit.createdAt.toISOString(),
        }
      : null;

    // Re-run the checklist against the cached `rawFeaturesJson` blob
    // (the crawler stores a complete `WebsiteFeatures` snapshot
    // here). Re-running on read keeps the panel self-healing when
    // the checklist rules evolve — vs caching a stale `scorePercent`
    // column.
    let checklist: AuditChecklistResult | null = null;
    if (audit) {
      const features =
        audit.rawFeaturesJson && typeof audit.rawFeaturesJson === "object"
          ? (audit.rawFeaturesJson as unknown as WebsiteFeatures)
          : null;
      checklist = runAuditChecklist(
        features,
        lead.hasWebsite,
        lead.primaryType,
        lead.subNicheSlug,
      );
    }

    const deepResearch: DeepResearchSnippet | null = deepRun
      ? {
          runId: deepRun.id,
          workerKind: deepRun.workerKind,
          finishedAt: (deepRun.finishedAt ?? new Date()).toISOString(),
          snippet: pickRunSnippet(deepRun.outputJson),
        }
      : null;

    const response: WebsiteIntelResponse = {
      hasWebsite: lead.hasWebsite,
      audit: auditFull,
      checklist,
      deepResearch,
      planGate: { plan, rawFeaturesUnlocked },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.website-intel.GET", err);
  }
}

function toSnippet(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (!oneLine) return null;
  return oneLine.length > 400 ? `${oneLine.slice(0, 399)}…` : oneLine;
}

function pickRunSnippet(out: unknown): string | null {
  if (!out || typeof out !== "object") return null;
  const o = out as Record<string, unknown>;
  return (
    toSnippet(o.summary) ??
    toSnippet(o.title) ??
    toSnippet(o.body) ??
    toSnippet(o.markdown) ??
    null
  );
}
