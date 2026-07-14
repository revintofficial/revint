/**
 * Head Agent tools (Option B — agentic tool-use loop).
 *
 * Read-only, workspace-scoped data tools the Claude Head Agent can call
 * ON DEMAND during its synthesis loop. This is the "agent can pull
 * whatever data it needs" layer: instead of pre-stuffing the whole
 * substrate into one prompt, Claude decides which slices it actually
 * needs (full reviews, website audit, dossier, the workspace's real
 * package catalog, semantic memory) and fetches them.
 *
 * HARD CONSTRAINTS:
 *   - Every tool is READ-ONLY. No tool mutates state, enqueues work, or
 *     spends external API budget (no re-crawl / web-search here — those
 *     would need quota wiring and are a separate increment).
 *   - Every query is scoped by `workspaceId` (multi-tenant rule). Tools
 *     that read a lead-owned relation first verify the lead belongs to
 *     the workspace, so a leaked leadId can never cross tenants.
 *   - Outputs are size-bounded so a chatty tool can't blow the context.
 */
import { prisma } from "@/lib/prisma";
import { listByLead } from "@/lib/ai-core/memory";
import type { WebsiteFeatures } from "@/types";

export interface AgentToolContext {
  workspaceId: string;
  leadId: string;
}

export interface AgentToolDef {
  name: string;
  description: string;
  /** JSON schema (Anthropic tool input_schema). */
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (ctx: AgentToolContext, input: Record<string, unknown>) => Promise<unknown>;
}

const EMPTY_SCHEMA = { type: "object" as const, properties: {} };

function clampText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  return v.length > max ? `${v.slice(0, max)}…[truncated]` : v;
}

/**
 * Verify the lead is in the caller's workspace. Returns the lead id when
 * valid, null otherwise. Defense-in-depth for every lead-scoped tool.
 */
async function assertLead(ctx: AgentToolContext): Promise<boolean> {
  const lead = await prisma.lead.findFirst({
    where: { id: ctx.leadId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  return Boolean(lead);
}

export const AGENT_TOOLS: AgentToolDef[] = [
  {
    name: "get_lead_basics",
    description:
      "Core facts about the lead: business name, address, rating, review count, price level, website presence, detected sub-niche, multi-location account linkage, business status.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      const lead = await prisma.lead.findFirst({
        where: { id: ctx.leadId, workspaceId: ctx.workspaceId },
        select: {
          businessName: true,
          formattedAddress: true,
          rating: true,
          reviewCount: true,
          priceLevel: true,
          hasWebsite: true,
          websiteUrl: true,
          nicheSlug: true,
          subNicheSlug: true,
          businessStatus: true,
          accountId: true,
        },
      });
      if (!lead) return { error: "lead_not_found" };
      let locationCount = 1;
      if (lead.accountId) {
        locationCount = await prisma.lead.count({
          where: { workspaceId: ctx.workspaceId, accountId: lead.accountId },
        });
      }
      return { ...lead, locationCount, isMultiLocation: locationCount > 1 };
    },
  },
  {
    name: "get_full_reviews",
    description:
      "Full review analysis: pain phrases, strength phrases, switch signals, weakness/strength KPIs, sentiment breakdown, summary and lead score. Use to ground pain points in actual reviewer language.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      if (!(await assertLead(ctx))) return { error: "lead_not_found" };
      const ra = await prisma.reviewAnalysis.findFirst({
        where: { leadId: ctx.leadId },
        select: {
          reviewsAnalyzedCount: true,
          weaknessKpis: true,
          strengthKpis: true,
          sentimentBreakdown: true,
          painPhrases: true,
          strengthPhrases: true,
          switchSignals: true,
          leadScore: true,
          summary: true,
        },
      });
      if (!ra) return { error: "no_review_analysis" };
      return { ...ra, summary: clampText(ra.summary, 1500) };
    },
  },
  {
    name: "get_website_audit",
    description:
      "Full website audit: reachability, HTTP status, detected features (booking, ecommerce, QR menu, online reservation, menu tool, social profiles) and the raw feature flags. Use to confirm what the venue already has before pitching.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      const lead = await prisma.lead.findFirst({
        where: { id: ctx.leadId, workspaceId: ctx.workspaceId },
        select: { hasWebsite: true, websiteUrl: true, websiteAudit: true },
      });
      if (!lead) return { error: "lead_not_found" };
      if (!lead.websiteAudit) return { hasWebsite: lead.hasWebsite, audit: null };
      const a = lead.websiteAudit;
      const features = (a.rawFeaturesJson as WebsiteFeatures | null) ?? null;
      return {
        hasWebsite: lead.hasWebsite,
        websiteUrl: lead.websiteUrl,
        reachable: a.reachable,
        httpStatus: a.httpStatus,
        title: a.title,
        mobileFriendlyGuess: a.mobileFriendlyGuess,
        hasContactForm: a.hasContactForm,
        hasBookingSystem: a.hasBookingSystem,
        hasEcommerce: a.hasEcommerce,
        bookingProvider: a.bookingProvider,
        servicesDetected: a.servicesDetected,
        features: features
          ? {
              hasQrMenu: features.hasQrMenu ?? null,
              hasOnlineReservation: features.hasOnlineReservation ?? null,
              hasDeliveryIntegration: features.hasDeliveryIntegration ?? null,
              detectedMenuTool: features.detectedMenuTool ?? null,
              menuUrl: features.menuUrl ?? null,
              socialProfiles: features.socialProfiles ?? null,
            }
          : null,
      };
    },
  },
  {
    name: "get_dossier",
    description:
      "The long-form AI sales dossier markdown for this lead (synthesised narrative across every agent). Use for deeper context that isn't in the structured signals.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      if (!(await assertLead(ctx))) return { error: "lead_not_found" };
      const run = await prisma.agentRun.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          workerKind: "LEAD_DOSSIER_GENERATOR",
          status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
        },
        orderBy: { finishedAt: "desc" },
        select: { outputJson: true },
      });
      const out = run?.outputJson;
      const md =
        out && typeof out === "object" && "markdown" in (out as Record<string, unknown>)
          ? (out as Record<string, unknown>).markdown
          : null;
      const text = clampText(md, 6000);
      return text ? { markdown: text } : { error: "no_dossier" };
    },
  },
  {
    name: "get_sales_opportunity",
    description:
      "The scorer's sales opportunity: opportunity score, why-good-target rationale, recommended package id and reason, suggested offer. Use to align with the deterministic scorer.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      const lead = await prisma.lead.findFirst({
        where: { id: ctx.leadId, workspaceId: ctx.workspaceId },
        select: { salesOpportunity: true },
      });
      if (!lead) return { error: "lead_not_found" };
      const opp = lead.salesOpportunity as Record<string, unknown> | null;
      if (!opp) return { error: "no_opportunity" };
      return {
        opportunityScore: opp.opportunityScore ?? null,
        whyGoodTarget: clampText(opp.whyGoodTarget, 1500),
        recommendedPackageId: opp.recommendedPackageId ?? null,
        recommendedPackageReason: clampText(opp.recommendedPackageReason, 800),
        suggestedOffer: opp.suggestedOffer ?? null,
      };
    },
  },
  {
    name: "get_packages",
    description:
      "The workspace's REAL product/service package catalog (what this seller actually offers): name, price label, feature list, popularity. Use to recommend an actual package the rep can quote, not a generic module.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      const packages = await prisma.servicePackage.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, priceLabel: true, features: true, isPopular: true },
        take: 20,
      });
      return { packages };
    },
  },
  {
    name: "get_memory",
    description:
      "Semantic memory entries previously stored for this lead (prior insights, outcomes, rep notes). Use to avoid repeating known facts and to respect past decisions.",
    input_schema: EMPTY_SCHEMA,
    execute: async (ctx) => {
      if (!(await assertLead(ctx))) return { error: "lead_not_found" };
      const rows = await listByLead({
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        take: 20,
      });
      return {
        memory: rows.map((r) => ({
          kind: r.kind,
          text: clampText(r.text, 600),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  },
];

export const AGENT_TOOL_MAP: Map<string, AgentToolDef> = new Map(
  AGENT_TOOLS.map((t) => [t.name, t]),
);

/** Execute a tool by name within a workspace-scoped context. */
export async function executeAgentTool(
  ctx: AgentToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const tool = AGENT_TOOL_MAP.get(name);
  if (!tool) return { error: `unknown_tool:${name}` };
  return tool.execute(ctx, input ?? {});
}
