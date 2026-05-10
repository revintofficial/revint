/**
 * BUYING_COMMITTEE_MAPPER worker.
 *
 * Builds a Stakeholder map for the lead's account based on:
 *   - LinkedIn company enrichment (APIFY_LINKEDIN_COMPANY) — captured
 *     into semantic memory as STAKEHOLDER_HINT.
 *   - Website team page hints from WebsiteAudit.crawlText.
 *   - Google Maps owner/manager fields when present.
 *
 * For Phase 1 we infer SDR-relevant roles (decision-maker,
 * influencer, blocker, champion, gatekeeper) using a short Gemini
 * prompt. The output is upserted as Stakeholder rows scoped to the
 * lead/account so the SDR_BRAIN can pick the right opener angle.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";
import { REASONING_SUMMARY_REF_TYPES } from "./reasoning-ref-types";

type StakeholderRole =
  | "DECISION_MAKER"
  | "INFLUENCER"
  | "BLOCKER"
  | "CHAMPION"
  | "GATEKEEPER"
  | "USER";

interface InferredStakeholder {
  fullName: string;
  title: string | null;
  role: StakeholderRole;
  influence: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "UNKNOWN";
  linkedinUrl: string | null;
  emailHint: string | null;
  evidence: { source: string; quote?: string };
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("BUYING_COMMITTEE_MAPPER requires a lead context");
  const lead = ctx.lead;

  // Pull stakeholder hints from semantic memory (pre-fetched by executor).
  // SOCIAL_POST + SERP_SNAPSHOT carry LinkedIn / company-page bios that
  // the LinkedIn-company Apify worker writes into memory.
  const hints = ctx.memory.filter(
    (m) => m.kind === "SOCIAL_POST" || m.kind === "SERP_SNAPSHOT" || m.kind === "HIRING_SIGNAL",
  );

  // Lightweight team page parse from the website audit. We don't store
  // raw page HTML on WebsiteAudit; instead use rawFeaturesJson which the
  // crawler dumps with `aboutSnippet` / `teamSnippet` keys when found.
  const audit = lead.websiteAudit;
  const auditFeatures =
    (audit?.rawFeaturesJson as { aboutSnippet?: string; teamSnippet?: string } | null) ?? null;
  const crawlSnippet = [auditFeatures?.aboutSnippet, auditFeatures?.teamSnippet]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n")
    .slice(0, 1200);

  if (hints.length === 0 && !crawlSnippet) {
    logger.info("agent_workers.buying_committee.empty", { leadId: lead.id });
    return { output: { stakeholders: [] }, costTokens: 0 };
  }

  let inferred: InferredStakeholder[] = [];
  try {
    const provider = getStructuredInferenceProvider();
    const schema: SchemaDefinition = {
      type: "OBJECT",
      properties: {
        stakeholders: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              fullName: { type: "STRING" },
              title: { type: "STRING" },
              role: { type: "STRING" },
              influence: { type: "NUMBER" },
              sentiment: { type: "STRING" },
              linkedinUrl: { type: "STRING" },
              emailHint: { type: "STRING" },
              quote: { type: "STRING" },
              source: { type: "STRING" },
            },
            required: ["fullName", "role", "influence", "sentiment"],
          },
        },
      },
      required: ["stakeholders"],
    };
    const prompt = `Map the buying committee for this restaurant tech prospect.
Lead: ${lead.businessName ?? "(no name)"} (${lead.subNicheSlug ?? lead.nicheSlug ?? lead.primaryType ?? "unknown"})

Sources:
${hints.map((h, i) => `[H${i}] ${h.text.slice(0, 300)}`).join("\n")}

Website team snippets:
${crawlSnippet || "(none)"}

Rules:
- role MUST be one of: DECISION_MAKER, INFLUENCER, BLOCKER, CHAMPION, GATEKEEPER, USER
- influence is 0-100 (executive/owner ~80, manager ~50, FOH staff ~20)
- sentiment ∈ {POSITIVE, NEUTRAL, NEGATIVE, UNKNOWN}
- Use UNKNOWN when no quote justifies positive/negative
- Skip duplicates; prefer the strongest evidence per person
- Do NOT invent emails — leave emailHint blank unless it's literally in the source

Return JSON only.`;
    const result = await provider.structuredInfer<{
      stakeholders: Array<{
        fullName: string;
        title?: string;
        role: string;
        influence: number;
        sentiment: string;
        linkedinUrl?: string;
        emailHint?: string;
        quote?: string;
        source?: string;
      }>;
    }>({
      prompt,
      schema,
      temperature: 0.2,
      maxTokens: 1024,
      timeoutMs: 30_000,
      label: "buying_committee_map",
    });

    const allowedRoles: StakeholderRole[] = [
      "DECISION_MAKER",
      "INFLUENCER",
      "BLOCKER",
      "CHAMPION",
      "GATEKEEPER",
      "USER",
    ];
    inferred = result.data.stakeholders
      .filter((s) => allowedRoles.includes(s.role as StakeholderRole))
      .map((s) => ({
        fullName: s.fullName.slice(0, 200),
        title: s.title?.slice(0, 200) ?? null,
        role: s.role as StakeholderRole,
        influence: Math.max(0, Math.min(100, Math.round(s.influence))),
        sentiment: ["POSITIVE", "NEUTRAL", "NEGATIVE", "UNKNOWN"].includes(s.sentiment)
          ? (s.sentiment as InferredStakeholder["sentiment"])
          : "UNKNOWN",
        linkedinUrl: s.linkedinUrl?.startsWith("http") ? s.linkedinUrl : null,
        emailHint: s.emailHint && s.emailHint.includes("@") ? s.emailHint : null,
        evidence: { source: s.source ?? "Gemini:buying_committee_map", quote: s.quote ?? "" },
      }));
  } catch (err) {
    logger.warn("agent_workers.buying_committee.gemini_failed", {
      leadId: lead.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Upsert as Stakeholder rows. We dedup on (workspaceId, leadId, name).
  let writtenCount = 0;
  for (const s of inferred) {
    try {
      // Find existing for upsert (no compound unique on this triple
      // because names are messy; do an explicit findFirst + create/update).
      const existing = await prisma.stakeholder.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          leadId: lead.id,
          name: s.fullName,
        },
      });
      // Map Challenger-style role enum onto the schema's free-form
      // role string + boolean flags + championLikelihood. Keeps the
      // worker output expressive while persisting with the available
      // columns.
      const roleLabel = s.title ? `${s.role} · ${s.title}` : s.role;
      const isEconomicBuyer = s.role === "DECISION_MAKER";
      const isBlocker = s.role === "BLOCKER";
      const championLikelihood =
        s.role === "CHAMPION" ? Math.max(60, s.influence) : s.role === "INFLUENCER" ? 40 : 20;
      if (existing) {
        await prisma.stakeholder.update({
          where: { id: existing.id },
          data: {
            role: roleLabel,
            influence: s.influence,
            sentiment: s.sentiment,
            linkedinUrl: s.linkedinUrl,
            email: s.emailHint,
            isEconomicBuyer,
            isBlocker,
            championLikelihood,
          },
        });
      } else {
        await prisma.stakeholder.create({
          data: {
            workspaceId: ctx.workspaceId,
            leadId: lead.id,
            accountId: lead.accountId,
            name: s.fullName,
            role: roleLabel,
            influence: s.influence,
            sentiment: s.sentiment,
            linkedinUrl: s.linkedinUrl,
            email: s.emailHint,
            isEconomicBuyer,
            isBlocker,
            championLikelihood,
            source: s.evidence.source,
          },
        });
      }
      writtenCount += 1;
    } catch (err) {
      logger.warn("agent_workers.buying_committee.persist_failed", {
        leadId: lead.id,
        fullName: s.fullName,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("agent_workers.buying_committee.done", {
    leadId: lead.id,
    workspaceId: ctx.workspaceId,
    inferredCount: inferred.length,
    writtenCount,
  });

  return {
    output: { stakeholders: inferred, writtenCount },
    costTokens: 1024,
  };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as { stakeholders: InferredStakeholder[] };
  if (o.stakeholders.length === 0) return [];
  return [
    {
      kind: "REASONING_SUMMARY",
      text: `BUYING_COMMITTEE: ${o.stakeholders
        .slice(0, 4)
        .map((s) => `${s.fullName}(${s.role})`)
        .join(", ")}`,
      leadId: ctx.leadId,
      refType: REASONING_SUMMARY_REF_TYPES.BuyingCommitteeMapper,
      metadata: {
        roles: o.stakeholders.map((s) => s.role),
        topInfluence: o.stakeholders[0]?.influence ?? 0,
      },
    },
  ];
}
