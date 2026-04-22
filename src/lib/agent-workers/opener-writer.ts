/**
 * OPENER_WRITER worker.
 *
 * Writes a personalized cold-email / WhatsApp opener for a lead,
 * grounded in:
 *   1. The lead's SalesOpportunity (pain points, best angle)
 *   2. The workspace "My offer" context
 *   3. Optional mockup URL (if WEBSITE_MOCKUP_GENERATOR ran upstream)
 *   4. **Few-shot retrieval**: up to 5 past OPENER_SUCCESS rows from
 *      SemanticMemory. This is the learning loop: as
 *      INBOX_REPLY_ATTRIBUTOR marks opener outcomes, the next run
 *      picks up the workspace's winning voice automatically.
 *
 * The output is persisted to `SalesOpportunity.personalizedFirstMessage`
 * so the existing UI (mailto copy button, outreach sender, CSV export)
 * picks it up without any further wiring.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { query as memoryQuery } from "@/lib/ai-core/memory";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemorySpec,
} from "./types";

const MODEL = "gemini-2.5-flash";

/**
 * Declarative memory read spec. The executor pre-fetches these but
 * we also re-query directly in the run handler using the lead's
 * pain phrases as the query vector, because the executor's static
 * spec only knows the worker kind, not the specific pain text that
 * makes for the best retrieval query.
 */
export const memoryReads: MemorySpec[] = [
  { kinds: ["OPENER_SUCCESS"], topK: 5, scope: "workspace" },
  { kinds: ["LEAD_PROFILE"], topK: 1, scope: "lead" },
];

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("OPENER_WRITER requires a lead context");
  const lead = ctx.lead;
  const opp = lead.salesOpportunity;

  // Semantically retrieve the most relevant past successes for this
  // lead type. Query vector is built from the lead's pain points so
  // the "dentist with wait-time complaints" gets opener examples
  // from other leads with similar painpoints rather than just the
  // 5 most-recent workspace successes.
  const painPhrases = Array.isArray(opp?.likelyPainPoints)
    ? (opp!.likelyPainPoints as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const painQueryText = painPhrases.length
    ? `${lead.businessName} ${lead.primaryType ?? ""} ${painPhrases.slice(0, 5).join("; ")}`
    : `${lead.businessName} ${lead.primaryType ?? ""} ${opp?.bestSalesAngle ?? ""}`;

  // Few-shot retrieval for opener voice. A failure here would silently
  // degrade output quality (opener generated with zero examples), so
  // we let it throw: executor marks the run FAILED and the retry path
  // (or a human) gets a visible signal. The previous swallow-and-log
  // behaviour is exactly the 'silent quality drift' the P1 audit
  // called out.
  let successExamples: Array<{ text: string; similarity: number }> = [];
  const hits = await memoryQuery({
    workspaceId: ctx.workspaceId,
    kinds: ["OPENER_SUCCESS"],
    text: painQueryText,
    topK: 5,
    minSimilarity: 0.3,
  });
  successExamples = hits.map((h) => ({
    text: h.text,
    // memoryQuery with a text query always returns a real similarity
    // score; the null case only happens for the executor's static
    // pre-fetch path in fetchMemoryReads.
    similarity: h.similarity ?? 0,
  }));

  // Get the mockup slug if one exists, so the opener can embed it.
  const mockup = await prisma.websiteMockup.findFirst({
    where: { leadId: lead.id, isPublic: true },
    select: { slug: true },
    orderBy: { updatedAt: "desc" },
  });

  const prompt = buildOpenerPrompt({
    businessName: lead.businessName,
    primaryType: lead.primaryType,
    borough: lead.borough,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    bestSalesAngle: opp?.bestSalesAngle ?? null,
    painPhrases,
    offerName: ctx.workspace.offerName ?? null,
    valueProposition: ctx.workspace.valueProposition ?? null,
    offerHook: ctx.workspace.offerHook ?? null,
    senderName: ctx.workspace.senderName ?? null,
    conversionLink: ctx.workspace.conversionLink ?? null,
    language: ctx.workspace.language ?? "en",
    mockupUrl: mockup?.slug ? `/m/${mockup.slug}` : null,
    successExamples: successExamples.map((e) => e.text),
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
  });

  const result = await model.generateContent(prompt);
  const message = result.response.text().trim();

  // Before overwriting SalesOpportunity.personalizedFirstMessage, check
  // whether the user manually edited the previously generated opener.
  // We detect this by comparing the currently stored value against the
  // output of the most recent successful OPENER_WRITER run for the same
  // lead: if they differ, the user edited the field since last run and
  // we must not blow away their copy. The newly generated message is
  // still returned in `output` so the UI can offer it as an alternative.
  const existingOpp = opp?.personalizedFirstMessage
    ? { personalizedFirstMessage: opp.personalizedFirstMessage }
    : await prisma.salesOpportunity.findUnique({
        where: { leadId: lead.id },
        select: { personalizedFirstMessage: true },
      });

  let preservedManualEdit = false;
  if (existingOpp?.personalizedFirstMessage) {
    const lastAiRun = await prisma.agentRun.findFirst({
      where: {
        leadId: lead.id,
        workerKind: "OPENER_WRITER",
        status: "SUCCEEDED",
        id: { not: ctx.runId },
      },
      orderBy: { finishedAt: "desc" },
      select: { outputJson: true },
    });
    const lastAiMessage = (lastAiRun?.outputJson as { message?: unknown } | null)?.message;
    const lastAiMessageStr = typeof lastAiMessage === "string" ? lastAiMessage : null;
    if (
      lastAiMessageStr !== null &&
      lastAiMessageStr !== existingOpp.personalizedFirstMessage
    ) {
      preservedManualEdit = true;
    }
  }

  if (preservedManualEdit) {
    logger.info("opener_writer.preserved_manual_edit", {
      leadId: lead.id,
      runId: ctx.runId,
    });
  } else {
    await prisma.salesOpportunity.update({
      where: { leadId: lead.id },
      data: { personalizedFirstMessage: message },
    });
  }

  logger.info("opener_writer.done", {
    leadId: lead.id,
    fewShotCount: successExamples.length,
    charLen: message.length,
    preservedManualEdit,
  });

  return {
    output: {
      message,
      fewShotCount: successExamples.length,
      mockupUrl: mockup?.slug ? `/m/${mockup.slug}` : null,
      preservedManualEdit,
    },
    costTokens: Math.ceil((prompt.length + message.length) / 4),
  };
};

/**
 * No memoryWrites callback: OPENER_WRITER does NOT write OPENER_SUCCESS
 * on generation. That memory is written only AFTER an inbox reply
 * confirms the opener worked (see sentinels.ts writeOpenerOutcome).
 * Writing every generated opener as OPENER_SUCCESS would poison the
 * few-shot pool with unvalidated examples.
 */

function buildOpenerPrompt(input: {
  businessName: string;
  primaryType: string | null;
  borough: string | null;
  rating: number | null;
  reviewCount: number | null;
  bestSalesAngle: string | null;
  painPhrases: string[];
  offerName: string | null;
  valueProposition: string | null;
  offerHook: string | null;
  senderName: string | null;
  conversionLink: string | null;
  language: string;
  mockupUrl: string | null;
  successExamples: string[];
}): string {
  const tr = input.language === "tr";

  const header = tr
    ? "Sen deneyimli bir ajans SDR'isin. Turkce ve kisisel bir cold-email acilisi yaziyorsun."
    : "You are an experienced agency SDR writing a personalized cold-email opener in natural English.";

  const rules = tr
    ? [
        "- Kurallar:",
        "- Maksimum 3 cumle",
        "- Ilk cumle spesifik bir gozlem icermeli (isletme hakkinda kisisel bir detay)",
        "- Satis tonundan kac; yardimci bir komsunun tonu",
        "- Asla 'umarim iyi gunlerindesin' gibi klise acilis yapma",
        "- Mockup URL'si varsa onu link olarak dogal sekilde iste",
        "- Sonda CTA yerine hafif bir soru sor",
      ].join("\n")
    : [
        "Rules:",
        "- Maximum 3 sentences.",
        "- Open with a specific observation about this business, not a generic greeting.",
        "- Sound like a helpful neighbor, not a salesperson.",
        "- Avoid cliches like 'hope this finds you well' or 'I came across your business'.",
        "- If a mockup URL is provided, weave it into the message naturally (e.g. 'put together a quick mock at ...').",
        "- Close with a soft question, not a hard CTA.",
      ].join("\n");

  const lines: string[] = [];
  lines.push(header);
  lines.push("");
  lines.push(rules);
  lines.push("");
  lines.push(`Lead: ${input.businessName}`);
  if (input.primaryType) lines.push(`Type: ${input.primaryType}`);
  if (input.borough) lines.push(`Area: ${input.borough}`);
  if (input.rating !== null) lines.push(`Rating: ${input.rating} (${input.reviewCount ?? 0} reviews)`);
  if (input.bestSalesAngle) lines.push(`Angle: ${input.bestSalesAngle}`);
  if (input.painPhrases.length) {
    lines.push(`Pain phrases: ${input.painPhrases.slice(0, 5).join("; ")}`);
  }
  lines.push("");
  lines.push("Workspace offer context:");
  if (input.offerName) lines.push(`- Offer: ${input.offerName}`);
  if (input.valueProposition) lines.push(`- Value: ${input.valueProposition}`);
  if (input.offerHook) lines.push(`- Hook: ${input.offerHook}`);
  if (input.senderName) lines.push(`- From: ${input.senderName}`);
  if (input.conversionLink) lines.push(`- CTA link: ${input.conversionLink}`);
  if (input.mockupUrl) lines.push(`- Mockup to embed: ${input.mockupUrl}`);

  if (input.successExamples.length > 0) {
    lines.push("");
    lines.push(
      tr
        ? "Bu workspace'te gecmiste cevap almis opener ornekleri (BU tarzi yakala):"
        : "Past openers from this workspace that got replies (match THIS voice exactly):",
    );
    input.successExamples.forEach((ex, i) => {
      lines.push(`--- ${i + 1}`);
      lines.push(ex.trim());
    });
    lines.push("---");
  }

  lines.push("");
  lines.push(
    tr
      ? "Simdi bu lead icin ONE acilis mesajini yaz. Sadece metni don, ekstra aciklama yok."
      : "Now write the single opener message for this lead. Output the message body only - no subject line, no preamble, no commentary.",
  );

  return lines.join("\n");
}
