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
 *
 * Phase 2.2 (V2 Richness Absorption) rewire:
 *   Audit flagged this worker as THIN — it was running off raw
 *   memory crumbs + an audit team snippet only. It never read the
 *   dossier markdown or the brief narrative, which meant Gemini had
 *   to RE-INFER context the upstream workers had already established.
 *   Result: stakeholder names hallucinated when the memory crumbs
 *   were thin (LinkedIn API rate-limited, no team page).
 *
 *   The rewire below:
 *     1. Reads the latest LEAD_INTELLIGENCE_BRIEF + LEAD_DOSSIER_GENERATOR
 *        AgentRun caches (no extra Gemini round-trips).
 *     2. Injects dossier markdown + brief headline + talkingPoints
 *        as extra context blocks in the prompt — Gemini can quote
 *        from them rather than invent.
 *     3. Requests an explicit `confidence` field on every inferred
 *        stakeholder. Rows with `confidence < 0.5` get
 *        `source = "AI_INFERRED_LOW"` so the UI can render them
 *        with a "AI guess" warning chip; high-confidence rows keep
 *        the legacy `Gemini:buying_committee_map` source string so
 *        downstream rendering is unchanged.
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
  /**
   * Phase 2.2 — Gemini-reported confidence in this inference.
   * Range 0-1. We persist it implicitly via the `source` string
   * (`AI_INFERRED_LOW` < 0.5; otherwise the legacy source string)
   * and surface it on the output payload so the UI can render a
   * "low confidence" chip without re-reading the source column.
   */
  confidence: number;
}

/**
 * Phase 2.2 — minimal projection of `LEAD_INTELLIGENCE_BRIEF.outputJson`.
 * Kept narrow on purpose (the schema changes faster than this worker).
 */
interface BriefSlice {
  headline: string | null;
  talkingPoints: string[];
}

function pickString(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const raw = (input as Record<string, unknown>)[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function pickStringArray(input: unknown, key: string): string[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

function projectBriefSlice(raw: unknown): BriefSlice | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    headline: pickString(raw, "headline"),
    talkingPoints: pickStringArray(raw, "talkingPoints"),
  };
}

function projectDossierMarkdown(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const md = (raw as Record<string, unknown>).markdown;
  return typeof md === "string" && md.trim().length > 0 ? md : null;
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

  // Phase 2.2 — pull brief + dossier caches in parallel so Gemini
  // can ground its inferences in upstream-verified narrative
  // instead of guessing from raw memory crumbs.
  const [latestBriefRun, latestDossierRun] = await Promise.all([
    prisma.agentRun.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        leadId: lead.id,
        workerKind: "LEAD_INTELLIGENCE_BRIEF",
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      },
      orderBy: { finishedAt: "desc" },
      select: { outputJson: true },
    }),
    prisma.agentRun.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        leadId: lead.id,
        workerKind: "LEAD_DOSSIER_GENERATOR",
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      },
      orderBy: { finishedAt: "desc" },
      select: { outputJson: true },
    }),
  ]);
  const brief = projectBriefSlice(latestBriefRun?.outputJson ?? null);
  const dossierMarkdown =
    projectDossierMarkdown(latestDossierRun?.outputJson ?? null) ?? null;
  const dossierExcerpt = dossierMarkdown
    ? dossierMarkdown.slice(0, 2000)
    : "(none)";

  if (hints.length === 0 && !crawlSnippet && !brief && !dossierMarkdown) {
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
              confidence: { type: "NUMBER" },
            },
            required: [
              "fullName",
              "role",
              "influence",
              "sentiment",
              "confidence",
            ],
          },
        },
      },
      required: ["stakeholders"],
    };
    const briefBlock = brief
      ? [
          brief.headline ? `Headline: ${brief.headline}` : null,
          brief.talkingPoints.length > 0
            ? `Talking points: ${brief.talkingPoints.slice(0, 5).join(" | ")}`
            : null,
        ]
          .filter((x): x is string => x != null)
          .join("\n")
      : "(none)";
    const prompt = `Map the buying committee for this prospect.
Lead: ${lead.businessName ?? "(no name)"} (${lead.subNicheSlug ?? lead.nicheSlug ?? lead.primaryType ?? "unknown"})

Brief context (LEAD_INTELLIGENCE_BRIEF):
${briefBlock}

Dossier excerpt (LEAD_DOSSIER_GENERATOR — first 2000 chars):
${dossierExcerpt}

Memory hints:
${hints.map((h, i) => `[H${i}] ${h.text.slice(0, 300)}`).join("\n") || "(none)"}

Website team snippets:
${crawlSnippet || "(none)"}

Rules:
- role MUST be one of: DECISION_MAKER, INFLUENCER, BLOCKER, CHAMPION, GATEKEEPER, USER
- influence is 0-100 (executive/owner ~80, manager ~50, FOH staff ~20)
- sentiment ∈ {POSITIVE, NEUTRAL, NEGATIVE, UNKNOWN}; use UNKNOWN when no quote justifies positive/negative.
- Skip duplicates; prefer the strongest evidence per person.
- Do NOT invent emails — leave emailHint blank unless it's literally in a source.
- confidence MUST be 0-1:
    * 0.9-1.0: a memory hint, dossier excerpt, or website snippet contains the person's name + role explicitly.
    * 0.5-0.89: name OR role is concrete but the other is inferred from context.
    * < 0.5: you are GUESSING based on industry norms (no concrete evidence). Be honest — low confidence triggers a UI "AI guess" warning so the rep can vet manually.
- Output is JSON only.`;
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
        confidence: number;
      }>;
    }>({
      prompt,
      schema,
      temperature: 0.2,
      maxTokens: 1024,
      timeoutMs: 30_000,
      label: "buying_committee_map_v2",
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
      .map((s) => {
        const confidence = Math.max(
          0,
          Math.min(1, typeof s.confidence === "number" ? s.confidence : 0.5),
        );
        const sourceTag =
          confidence < 0.5
            ? "AI_INFERRED_LOW"
            : s.source ?? "Gemini:buying_committee_map";
        return {
          fullName: s.fullName.slice(0, 200),
          title: s.title?.slice(0, 200) ?? null,
          role: s.role as StakeholderRole,
          influence: Math.max(0, Math.min(100, Math.round(s.influence))),
          sentiment: [
            "POSITIVE",
            "NEUTRAL",
            "NEGATIVE",
            "UNKNOWN",
          ].includes(s.sentiment)
            ? (s.sentiment as InferredStakeholder["sentiment"])
            : "UNKNOWN",
          linkedinUrl: s.linkedinUrl?.startsWith("http") ? s.linkedinUrl : null,
          emailHint: s.emailHint && s.emailHint.includes("@") ? s.emailHint : null,
          evidence: { source: sourceTag, quote: s.quote ?? "" },
          confidence,
        };
      });
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
