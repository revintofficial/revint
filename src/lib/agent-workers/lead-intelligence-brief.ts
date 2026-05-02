/**
 * LEAD_INTELLIGENCE_BRIEF worker (Phase 0/B5).
 *
 * The canonical "single source of truth" worker. Runs at the END of
 * the `lead_created` chain — after every enrichment + scoring +
 * classification + dossier + mockup has either succeeded or been
 * SKIPPED. Reads every Lead-scoped artifact in one pass and writes:
 *
 *   1. A structured "brief" payload (talking points, next action,
 *      best-time-to-call hint, opener seed, reply objections,
 *      Sales Confidence 0-100). Cached on `AgentRun.outputJson`.
 *   2. Denormalized `Lead.salesConfidence` + `Lead.intelligenceVersion`
 *      so the leads list query can sort/filter on a single number
 *      without joining four tables.
 *
 * Why a separate worker (vs reusing the dossier)?
 *   - The dossier is a long-form Markdown narrative. Reps don't speed-
 *     read 850 words during a cold call.
 *   - The dossier had to be its own author for Gemini-friendliness;
 *     the brief is structured JSON so the UI can render specific
 *     fields ("Open with this line", "Best time to call: weekday lunch")
 *     in dedicated cards.
 *   - The Sales Confidence rollup needs to read every signal AT ONCE
 *     including the dossier; a worker that depends on the dossier
 *     can't BE the dossier.
 *
 * Output shape:
 *   {
 *     salesConfidence: number,            // 0-100
 *     confidenceBreakdown: {
 *       audit: number, reviews: number, opportunity: number, weight: number
 *     },
 *     headline: string,                    // one-line "this is a {x}"
 *     talkingPoints: string[],             // 3-5 short pointers for the call
 *     openerSeed: string,                  // first-line opener for cold email/call
 *     bestTimeToCall: string | null,       // free-text hint, may include local TZ
 *     dnc: boolean,                        // hard block from outbound (e.g. opted-out)
 *     nextAction: { kind: string, due: string | null, note: string },
 *     replyObjections: string[],           // anticipated buyer objections
 *     redFlags: string[],                  // spend-time-elsewhere signals
 *     evidence: { source: string, note: string }[],
 *     generatedAt: string,
 *     intelligenceVersion: number,
 *   }
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { safeParseGeminiJson } from "@/lib/gemini";
import { listByLead as listMemoryByLead } from "@/lib/ai-core/memory";
import { runAuditChecklist } from "@/lib/audit-checklist";
import { getNicheBySlug } from "@/lib/niches";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

interface BriefOutput {
  salesConfidence: number;
  confidenceBreakdown: {
    audit: number;
    reviews: number;
    opportunity: number;
    weight: number;
  };
  headline: string;
  talkingPoints: string[];
  openerSeed: string;
  bestTimeToCall: string | null;
  dnc: boolean;
  nextAction: { kind: string; due: string | null; note: string };
  replyObjections: string[];
  redFlags: string[];
  evidence: { source: string; note: string }[];
  /**
   * Phase 2.5 — Brief-grounded opener guardrail.
   *
   * `confirmedPainPoints` is the SHORTLIST of pain phrases that the
   * brief verified against actual evidence (a quoted review, a
   * concrete audit signal, or a rep voice-note). Distinct from the
   * scorer's `likelyPainPoints` which is allowed to extrapolate —
   * THIS list is what the OPENER may cite in cold outreach. If a
   * pain isn't on this list, the opener may not pitch it (the LLM
   * is told this explicitly).
   *
   * `confirmedMissingFeatures` is the same idea for features /
   * modules: only call out a missing feature in outreach when the
   * audit explicitly returned `false` for it. A `null` audit signal
   * (audit not run, audit timed out, social-media-only URL) does
   * NOT count as confirmation that the feature is missing.
   *
   * Both arrays default to empty when the brief has insufficient
   * grounding — the opener then falls back to a generic-but-safe
   * pitch instead of inventing problems.
   */
  confirmedPainPoints: string[];
  confirmedMissingFeatures: string[];
  generatedAt: string;
  intelligenceVersion: number;
}

/**
 * Phase 0/B5 — deterministic "Sales Confidence" rollup. The Gemini
 * call is for the prose (talking points, opener seed) but the SCORE
 * itself is a math.weighted blend of the three upstream signals so
 * we don't depend on Gemini's mood for sorting the leads list.
 *
 * Weights:
 *   - audit checklist scorePercent       40%
 *   - reviewAnalysis.leadScore           30%
 *   - salesOpportunity.opportunityScore  30%
 *
 * Missing signals collapse to 0 and reduce the total weight
 * proportionally so a lead with "no reviews, no website" still gets
 * a usable number rather than NaN.
 */
function computeSalesConfidence(input: {
  auditScorePct: number | null;
  reviewLeadScore: number | null;
  opportunityScore: number | null;
}): { score: number; breakdown: BriefOutput["confidenceBreakdown"] } {
  const components: { value: number | null; weight: number; key: keyof BriefOutput["confidenceBreakdown"] }[] = [
    { value: input.auditScorePct, weight: 0.4, key: "audit" },
    { value: input.reviewLeadScore, weight: 0.3, key: "reviews" },
    { value: input.opportunityScore, weight: 0.3, key: "opportunity" },
  ];
  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown: BriefOutput["confidenceBreakdown"] = {
    audit: 0,
    reviews: 0,
    opportunity: 0,
    weight: 0,
  };
  for (const c of components) {
    if (c.value == null) continue;
    const clamped = Math.max(0, Math.min(100, c.value));
    weightedSum += clamped * c.weight;
    totalWeight += c.weight;
    breakdown[c.key] = clamped;
  }
  breakdown.weight = totalWeight;
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  return { score, breakdown };
}

interface BriefPromptInput {
  businessName: string;
  niche: string | null;
  subNiche: string | null;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  websiteUrl: string | null;
  workspaceLanguage: string;
  workspaceOffer: string | null;
  workspaceValueProp: string | null;
  // P0.5 — workspace-level personalization signals. These shape the
  // BRIEF's prose (talking points, opener seed, next action) but DO
  // NOT change the deterministic salesConfidence rollup.
  workspaceObjective: string | null;
  workspaceTone: string | null;
  workspaceOfferHook: string | null;
  workspaceSocialProof: string | null;
  workspaceSenderName: string | null;
  /** Active sales campaigns (Sequences) with their niche tags + ids. */
  activeCampaigns: { id: string; name: string; niche: string | null }[];
  /**
   * Campaign id matched by the scorer's ICP-fit deterministic check.
   * When set, the brief should recommend `ENROLL_IN_<campaignId>` as
   * the next action so the rep enrols the lead in one click.
   */
  matchedCampaignId: string | null;
  audit: Record<string, unknown> | null;
  auditChecklistText: string;
  reviewAnalysis: Record<string, unknown> | null;
  salesOpportunity: Record<string, unknown> | null;
  socialProfiles: Record<string, string | null> | null;
  voiceNotes: { transcript: string | null; createdAt: string }[];
  dossierMarkdown: string | null;
  memorySnippets: { kind: string; text: string }[];
  agentRunSummaries: { workerKind: string; output: string }[];
  nicheLabel: string | null;
  nichePitchAngle: string | null;
  preComputedConfidence: number;
}

async function generateBrief(
  input: BriefPromptInput,
  intelligenceVersion: number,
): Promise<Omit<BriefOutput, "intelligenceVersion" | "generatedAt">> {
  const { getGeminiKey } = await import("@/lib/gemini-keys");
  const client = new GoogleGenerativeAI(getGeminiKey());
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          salesConfidence: { type: SchemaType.NUMBER },
          confidenceBreakdown: {
            type: SchemaType.OBJECT,
            properties: {
              audit: { type: SchemaType.NUMBER },
              reviews: { type: SchemaType.NUMBER },
              opportunity: { type: SchemaType.NUMBER },
              weight: { type: SchemaType.NUMBER },
            },
            required: ["audit", "reviews", "opportunity", "weight"],
          },
          headline: { type: SchemaType.STRING },
          talkingPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          openerSeed: { type: SchemaType.STRING },
          bestTimeToCall: { type: SchemaType.STRING },
          dnc: { type: SchemaType.BOOLEAN },
          nextAction: {
            type: SchemaType.OBJECT,
            properties: {
              kind: { type: SchemaType.STRING },
              due: { type: SchemaType.STRING },
              note: { type: SchemaType.STRING },
            },
            required: ["kind", "due", "note"],
          },
          replyObjections: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          evidence: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                source: { type: SchemaType.STRING },
                note: { type: SchemaType.STRING },
              },
              required: ["source", "note"],
            },
          },
          confirmedPainPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          confirmedMissingFeatures: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: [
          "salesConfidence",
          "confidenceBreakdown",
          "headline",
          "talkingPoints",
          "openerSeed",
          "bestTimeToCall",
          "dnc",
          "nextAction",
          "replyObjections",
          "redFlags",
          "evidence",
          "confirmedPainPoints",
          "confirmedMissingFeatures",
        ],
      },
    },
  });

  const personalizationLines: string[] = [];
  if (input.workspaceObjective)
    personalizationLines.push(`- Campaign objective: ${input.workspaceObjective}`);
  if (input.workspaceTone)
    personalizationLines.push(`- Voice / tone: ${input.workspaceTone}`);
  if (input.workspaceOfferHook)
    personalizationLines.push(`- Rep's signature hook: "${input.workspaceOfferHook}"`);
  if (input.workspaceSocialProof)
    personalizationLines.push(`- Social proof to cite: "${input.workspaceSocialProof}"`);
  if (input.workspaceSenderName)
    personalizationLines.push(`- Sender / signature: ${input.workspaceSenderName}`);
  const personalizationBlock = personalizationLines.length
    ? `\n\nWorkspace personalization (shape the prose to this — voice, hook, proof):\n${personalizationLines.join("\n")}`
    : "";

  const campaignsBlock = input.activeCampaigns.length
    ? `\n\nActive sales campaigns (Sequences this workspace is currently running):\n${input.activeCampaigns
        .map(
          (c) =>
            `- id: ${c.id} | name: "${c.name}" | niche: ${c.niche ? `"${c.niche}"` : "(any)"}`,
        )
        .join("\n")}${
        input.matchedCampaignId
          ? `\n>>> ICP-fit matched campaign id: ${input.matchedCampaignId}. Recommend nextAction.kind = "ENROLL_IN_CAMPAIGN" with note referencing this campaign by name.`
          : ""
      }`
    : "";

  const prompt = `You are the senior SDR enablement analyst at a B2B SaaS for ${input.niche ?? "small businesses"}. The output of this brief is shown to a sales rep DURING a cold call — they need 3-5 talking points, ONE opener line they can read out loud, an honest "should I call?" sales-confidence number, and the realistic objection they will hit.

Write in plain ${input.workspaceLanguage === "tr" ? "Turkish" : "English"}. Avoid marketing fluff. Cite which signal each talking point came from.

Business: ${input.businessName} (${input.subNiche ?? input.niche ?? "unclassified"})
${input.nicheLabel ? `Niche pack: ${input.nicheLabel} — pitch angle: ${input.nichePitchAngle ?? "n/a"}\n` : ""}
Address: ${input.address}
Website: ${input.websiteUrl ?? "n/a"}
Google rating: ${input.rating ?? "n/a"} (${input.reviewCount ?? 0} reviews)

Workspace offer: ${input.workspaceOffer ?? "(not configured)"}
Workspace value prop: ${input.workspaceValueProp ?? "(not configured)"}${personalizationBlock}${campaignsBlock}

PRE-COMPUTED Sales Confidence (use this as your salesConfidence; do not invent a different number): ${input.preComputedConfidence}

## Audit checklist
${input.auditChecklistText}

## Review analysis
${input.reviewAnalysis ? JSON.stringify(input.reviewAnalysis).slice(0, 4000) : "(no review analysis)"}

## Sales opportunity (scorer)
${input.salesOpportunity ? JSON.stringify(input.salesOpportunity).slice(0, 3000) : "(no opportunity row)"}

## Social profiles
${input.socialProfiles ? JSON.stringify(input.socialProfiles) : "(none)"}

## Voice notes (rep-recorded)
${input.voiceNotes.map((v) => `- ${v.transcript ?? ""}`).join("\n") || "(none)"}

## Dossier (long-form analyst narrative)
${input.dossierMarkdown ? input.dossierMarkdown.slice(0, 6000) : "(not generated)"}

## Recent agent-run outputs
${input.agentRunSummaries.map((r) => `- ${r.workerKind}: ${r.output.slice(0, 400)}`).join("\n") || "(none)"}

## Semantic memory (top hits)
${input.memorySnippets.map((m) => `- [${m.kind}] ${m.text.slice(0, 200)}`).join("\n") || "(none)"}

Rules:
- salesConfidence MUST equal ${input.preComputedConfidence}. Use confidenceBreakdown to explain WHY.
- talkingPoints: 3-5 items, each <= 18 words, each anchored in a real signal. No filler.
- openerSeed: ONE sentence the SDR can read aloud — not a full email body. Natural, not salesy.
- bestTimeToCall: brief hint based on niche (e.g. "Restaurants prefer between lunch and dinner rush, ~3-5pm local") or null when uncertain.
- dnc: true ONLY when the data shows explicit opt-out / unsubscribe / "do not call" signals; otherwise false.
- nextAction.kind: one of "CALL_NOW", "EMAIL_FIRST", "WAIT_FOR_REPLY", "DROP_LEAD", "NEEDS_RESEARCH", "ENROLL_IN_CAMPAIGN" (use the last one only when an ICP-fit matched campaign id is provided above; the note must include the campaign name and id).
- nextAction.due: ISO-8601 if a specific time is implied, else null.
- replyObjections: 2-3 anticipated buyer objections, in their voice.
- redFlags: pull from review analysis (low rating + dropping trend), shutdown signals, "permanently closed" indicators. Empty array if none.
- evidence: 3-6 short citations of the actual signals you used.
- confirmedPainPoints: SHORTLIST (0-5 items) of pain phrases that have AT LEAST ONE concrete supporting signal — a direct review quote from the review analysis above, an audit boolean explicitly set to false, or a rep voice-note transcript. If a pain is plausible but unverified, OMIT it. This list is the WHITELIST that downstream cold-email writers may pitch — anything not on it is forbidden.
- confirmedMissingFeatures: SHORTLIST (0-5 items) of features/modules where the audit explicitly returned false (e.g. "no online booking" only when audit.hasBookingSystem === false). A null / unknown audit signal does NOT count as confirmation. Use the same vocabulary as the niche pack's highValueSignals when possible so downstream consumers can match cleanly.
- NO emojis. NO em-dashes. NO marketing buzzwords.

Return ONLY the JSON. No code fences, no preamble.`;

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.LEAD_INTELLIGENCE_BRIEF,
    label: "lead_intelligence_brief",
  });
  const raw = result.response.text();
  const parsed = safeParseGeminiJson<Omit<BriefOutput, "intelligenceVersion" | "generatedAt">>(raw, "lead_intelligence_brief");

  // Hard-clamp salesConfidence to the deterministic value, regardless
  // of what Gemini emitted. The prompt instructs the model to echo
  // the pre-computed number, but bugs happen and we DO NOT want a
  // free-form Gemini number to drive the leads-list ordering.
  parsed.salesConfidence = input.preComputedConfidence;
  return parsed;
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) {
    throw new Error("LEAD_INTELLIGENCE_BRIEF requires a lead context");
  }
  const lead = ctx.lead;
  const leadId = lead.id;
  const workspaceId = ctx.workspaceId;

  // Pull the latest dossier markdown if any (for prompt context).
  const dossierRun = await prisma.agentRun.findFirst({
    where: {
      workspaceId,
      leadId,
      workerKind: "LEAD_DOSSIER_GENERATOR",
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  const dossierMarkdown =
    dossierRun?.outputJson && typeof dossierRun.outputJson === "object" &&
    "markdown" in (dossierRun.outputJson as Record<string, unknown>)
      ? String((dossierRun.outputJson as Record<string, unknown>).markdown ?? "")
      : null;

  const recentRuns = await prisma.agentRun.findMany({
    where: {
      workspaceId,
      leadId,
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      workerKind: { notIn: ["LEAD_INTELLIGENCE_BRIEF", "LEAD_DOSSIER_GENERATOR"] },
    },
    orderBy: { finishedAt: "desc" },
    take: 12,
    select: { workerKind: true, outputJson: true },
  });

  // Pre-load active campaigns so the brief can recommend an enrollment
  // and mention the campaign by name in the talking points / next
  // action. Limit to the 8 most-recently-updated active sequences;
  // workspaces that have more should rely on the ICP-fit matchedCampaignId
  // signal coming from the scorer to pick the right one.
  const activeSequences = await prisma.sequence.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, name: true, niche: true },
  });

  // Resolve the ICP-fit matched campaign id from the most recent
  // SALES_OPPORTUNITY_SCORER run so the brief knows which campaign
  // (if any) the lead actually fits. Falls back to null when scorer
  // output predates the icpFit field.
  const scorerRun = await prisma.agentRun.findFirst({
    where: {
      workspaceId,
      leadId,
      workerKind: "SALES_OPPORTUNITY_SCORER",
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  const matchedCampaignId =
    scorerRun?.outputJson &&
    typeof scorerRun.outputJson === "object" &&
    "icpFit" in (scorerRun.outputJson as Record<string, unknown>) &&
    typeof (scorerRun.outputJson as Record<string, unknown>).icpFit === "object" &&
    (scorerRun.outputJson as Record<string, { matchedCampaignId?: string | null }>)
      .icpFit?.matchedCampaignId
      ? String(
          (scorerRun.outputJson as Record<string, { matchedCampaignId?: string | null }>)
            .icpFit.matchedCampaignId,
        )
      : null;

  const memoryRows = await listMemoryByLead({ workspaceId, leadId, take: 12 });

  const features = (lead.websiteAudit?.rawFeaturesJson as WebsiteFeatures | null) ?? null;
  const checklist = runAuditChecklist(
    features,
    lead.hasWebsite,
    ctx.workspace.niche,
    lead.subNicheSlug,
  );

  const reviewAnalysis = lead.reviewAnalysis;
  const auditScorePct = features ? checklist.summary.scorePercent : null;
  const reviewLeadScore = reviewAnalysis ? reviewAnalysis.leadScore : null;
  const opportunityScore = lead.salesOpportunity?.opportunityScore ?? null;

  const { score: salesConfidence, breakdown } = computeSalesConfidence({
    auditScorePct,
    reviewLeadScore,
    opportunityScore,
  });

  const subNicheSlug = lead.subNicheSlug as string | null;
  const nicheSlug = lead.nicheSlug as string | null;
  const resolvedSlug = subNicheSlug ?? nicheSlug ?? null;
  const nichePack = resolvedSlug ? getNicheBySlug(resolvedSlug) ?? null : null;

  const auditFeaturesForPrompt = lead.websiteAudit
    ? {
        reachable: lead.websiteAudit.reachable,
        crawlError: lead.websiteAudit.crawlError,
        httpStatus: lead.websiteAudit.httpStatus,
        title: lead.websiteAudit.title,
        loadTimeMs: lead.websiteAudit.loadTimeMs,
        mobileFriendlyGuess: lead.websiteAudit.mobileFriendlyGuess,
        hasContactForm: lead.websiteAudit.hasContactForm,
        hasBookingSystem: lead.websiteAudit.hasBookingSystem,
        hasEcommerce: lead.websiteAudit.hasEcommerce,
        servicesDetected: lead.websiteAudit.servicesDetected,
        bookingProvider: lead.websiteAudit.bookingProvider,
      }
    : null;

  const newVersion = (lead.intelligenceVersion ?? 0) + 1;

  // Pull a short voice-note transcript bag for the prompt.
  const voiceNotes = await prisma.voiceNote.findMany({
    where: { leadId, workspaceId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { transcript: true, createdAt: true },
  });

  let brief: Omit<BriefOutput, "intelligenceVersion" | "generatedAt">;
  try {
    brief = await generateBrief(
      {
        businessName: lead.businessName,
        niche: ctx.workspace.niche,
        subNiche: subNicheSlug,
        address: lead.formattedAddress,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        websiteUrl: lead.websiteUrl,
        workspaceLanguage: ctx.workspace.language ?? "en",
        workspaceOffer: ctx.workspace.offerName,
        workspaceValueProp: ctx.workspace.valueProposition,
        workspaceObjective: ctx.workspace.objective ?? null,
        workspaceTone: ctx.workspace.tone ?? null,
        workspaceOfferHook: ctx.workspace.offerHook ?? null,
        workspaceSocialProof: ctx.workspace.socialProof ?? null,
        workspaceSenderName: ctx.workspace.senderName ?? null,
        activeCampaigns: activeSequences.map((s) => ({
          id: s.id,
          name: s.name,
          niche: s.niche ?? null,
        })),
        matchedCampaignId,
        audit: auditFeaturesForPrompt,
        auditChecklistText: `Audit summary: ${checklist.summary.passed}/${checklist.summary.totalChecks - checklist.summary.unknown} checks passed (${checklist.summary.scorePercent}%).`,
        reviewAnalysis: (reviewAnalysis as unknown) as Record<string, unknown> | null,
        salesOpportunity: (lead.salesOpportunity as unknown) as Record<string, unknown> | null,
        socialProfiles:
          (lead.websiteAudit?.socialProfiles as Record<string, string | null> | null) ?? null,
        voiceNotes: voiceNotes.map((v) => ({
          transcript: v.transcript,
          createdAt: v.createdAt.toISOString(),
        })),
        dossierMarkdown,
        memorySnippets: memoryRows.map((m) => ({ kind: m.kind, text: m.text })),
        agentRunSummaries: recentRuns.map((r) => ({
          workerKind: r.workerKind,
          output: typeof r.outputJson === "string"
            ? r.outputJson
            : JSON.stringify(r.outputJson ?? {}),
        })),
        nicheLabel: nichePack?.label ?? null,
        nichePitchAngle: nichePack?.pitchAngle ?? null,
        preComputedConfidence: salesConfidence,
      },
      newVersion,
    );
  } catch (err) {
    // Fall back to a deterministic brief — Gemini hiccups should not
    // block the salesConfidence rollup landing on the leads list.
    logger.warn("agent_workers.lead_intelligence_brief.gemini_failed_fallback", {
      leadId,
      err: err instanceof Error ? err.message : String(err),
    });
    brief = {
      salesConfidence,
      confidenceBreakdown: breakdown,
      headline: `${lead.businessName} (${lead.subNicheSlug ?? lead.nicheSlug ?? "lead"})`,
      talkingPoints: [
        ...(opportunityScore != null ? [`Sales opportunity score: ${opportunityScore}/100.`] : []),
        ...(auditScorePct != null ? [`Website audit score: ${auditScorePct}%.`] : []),
        ...(reviewLeadScore != null ? [`Review lead score: ${reviewLeadScore}/100.`] : []),
      ],
      openerSeed: `Hi, I work with ${ctx.workspace.niche === "RESTAURANT_TECH" ? "restaurants" : "businesses"} like ${lead.businessName} on improving their booking flow.`,
      bestTimeToCall: null,
      dnc: lead.dnc ?? false,
      nextAction: { kind: "NEEDS_RESEARCH", due: null, note: "AI brief unavailable; rep should review manually." },
      replyObjections: [],
      redFlags: [],
      evidence: [],
      // Fallback brief has no LLM-grounded pain analysis, so we
      // intentionally leave both arrays empty. The opener-writer
      // treats empty arrays as "no whitelist" and falls back to its
      // generic-but-safe pitch path rather than fabricating pains.
      confirmedPainPoints: [],
      confirmedMissingFeatures: [],
    };
  }

  // Phase 0/B5 — write the rollup back onto the Lead so the leads
  // list query and Today's Queue can sort/filter on a single column.
  await prisma.lead.updateMany({
    where: { id: leadId, workspaceId },
    data: {
      salesConfidence: brief.salesConfidence,
      intelligenceVersion: newVersion,
    },
  });

  const output: BriefOutput = {
    ...brief,
    intelligenceVersion: newVersion,
    generatedAt: new Date().toISOString(),
  };

  logger.info("agent_workers.lead_intelligence_brief.done", {
    leadId,
    intelligenceVersion: newVersion,
    salesConfidence: brief.salesConfidence,
    hasDossier: dossierMarkdown != null,
  });

  return {
    output,
    costTokens: 0,
  };
};
