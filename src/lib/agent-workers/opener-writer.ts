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
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { queryWithNicheUnion } from "@/lib/ai-core/memory";
import {
  getNicheBySlug,
  getParentOf,
  defaultNicheForWorkspaceNiche,
} from "@/lib/niches";
import { isHandcraftedMockupTemplate } from "@/lib/mockups/templates";
import type {
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

  // Resolve the niche pack the opener should pitch to. Confidence
  // gate (P0.4): for AUTO classifications below 0.7 we ignore the
  // child slug and fall back to the parent (generic-but-correct
  // F&B angle) instead of writing a wrong-vertical email. MANUAL
  // overrides skip the gate — the rep is gold-standard.
  const subNicheTrusted =
    lead.subNicheSlug != null &&
    (lead.subNicheSource === "MANUAL" ||
      (lead.subNicheConfidence ?? 0) >= 0.7);

  const childSlug = subNicheTrusted ? lead.subNicheSlug : null;
  const parentSlug =
    lead.nicheSlug ??
    (childSlug ? getParentOf(childSlug) || null : null) ??
    defaultNicheForWorkspaceNiche(ctx.workspace.niche);

  const childPack = childSlug ? getNicheBySlug(childSlug) ?? null : null;
  const parentPack = parentSlug ? getNicheBySlug(parentSlug) ?? null : null;
  const activePack = childPack ?? parentPack;

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

  // Few-shot retrieval. We use the niche-aware union retrieval so the
  // child scope (e.g. "fnb-bar-club") is preferred (weight 1.0) while
  // the parent scope ("fnb") still contributes (weight 0.5). This
  // matches the asymmetric write strategy: positive successes are
  // dual-written to child + parent, so a brand-new child niche with
  // no own history still gets useful examples. A failure here would
  // silently degrade output quality, so we let it throw and the
  // executor marks the run FAILED.
  const hits = await queryWithNicheUnion({
    workspaceId: ctx.workspaceId,
    kinds: ["OPENER_SUCCESS"],
    text: painQueryText,
    topK: 5,
    minSimilarity: 0.3,
    childSlug,
    parentSlug: parentSlug ?? null,
    parentWeight: 0.5,
  });
  const successExamples = hits.map((h) => ({
    text: h.text,
    similarity: h.similarity ?? 0,
  }));

  // Get the mockup slug if one exists, so the opener can embed it.
  // Read the actual rendered template id (NOT the niche pack's
  // intended id) so the email's specificity matches what the prospect
  // will see when they open the link. If the mockup row was rendered
  // with a generic template, the email must use generic language even
  // when the niche pack would otherwise advertise a handcrafted UI.
  const mockup = await prisma.websiteMockup.findFirst({
    where: { leadId: lead.id, isPublic: true },
    select: { slug: true, templateId: true },
    orderBy: { updatedAt: "desc" },
  });
  const isHandcraftedMockup = isHandcraftedMockupTemplate(mockup?.templateId ?? null);

  // Resolve the analyst-recommended ServicePackage. The id is workspace-
  // scoped free-text (no FK), so we must scope by workspaceId on lookup
  // to prevent cross-tenant package leakage if a row was somehow
  // tagged with another workspace's id. When the package no longer
  // exists (renamed/deleted since the analysis ran), we drop the
  // recommendation rather than re-trigger the scorer here — the rep
  // can hit "Re-analyze" from the lead detail view.
  const recommendedPackage =
    opp?.recommendedPackageId
      ? await prisma.servicePackage.findFirst({
          where: {
            id: opp.recommendedPackageId,
            workspaceId: ctx.workspaceId,
          },
          select: { id: true, name: true, priceLabel: true, features: true },
        })
      : null;

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
    isHandcraftedMockup,
    successExamples: successExamples.map((e) => e.text),
    nicheLabel: activePack?.label ?? null,
    nichePitchAngle: activePack?.pitchAngle ?? null,
    nicheHighValueSignals: activePack?.highValueSignals ?? [],
    nicheFeaturedModules: activePack?.featuredProductModules ?? [],
    isParentFallback: childSlug == null && parentPack != null,
    recommendedPackage: recommendedPackage
      ? {
          name: recommendedPackage.name,
          priceLabel: recommendedPackage.priceLabel,
          features: recommendedPackage.features.slice(0, 4),
          reason: opp?.recommendedPackageReason ?? null,
        }
      : null,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
  });

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.OPENER_WRITER,
    label: "opener_writer",
  });
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
  isHandcraftedMockup: boolean;
  successExamples: string[];
  nicheLabel: string | null;
  nichePitchAngle: string | null;
  nicheHighValueSignals: string[];
  nicheFeaturedModules: string[];
  isParentFallback: boolean;
  /**
   * Analyst-picked ServicePackage tier (resolved from
   * SalesOpportunity.recommendedPackageId). When present, the opener
   * is allowed to subtly hint at the price point ("starts at $39/mo")
   * or feature ("QR menu setup") in the closing question — but only
   * IF it ties to a real pain phrase. Pushy "buy our $X plan" copy
   * is forbidden by the rule list below.
   */
  recommendedPackage: {
    name: string;
    priceLabel: string;
    features: string[];
    reason: string | null;
  } | null;
}): string {
  const tr = input.language === "tr";

  const header = tr
    ? "Sen deneyimli bir ajans SDR'isin. Turkce ve kisisel bir cold-email acilisi yaziyorsun."
    : "You are an experienced agency SDR writing a personalized cold-email opener in natural English.";

  // Mockup constraint flips based on whether a niche-specific (handcrafted)
  // template renders the mock or the generic markdown renderer does.
  // Promising "tab-split UI" in the email when the mockup is just a generic
  // page is exactly the inconsistency the P1 audit flagged.
  const mockupRule = input.mockupUrl
    ? input.isHandcraftedMockup
      ? tr
        ? "- Mockup link'i bu sektore ozel UI elemanlari (orn. tab-split, oda-faturasi entegrasyonu) gosteriyor — bunlardan SPESIFIK olarak bahsedebilirsin."
        : "- The mockup link shows a niche-specific UI (it actually contains the vertical-specific UI elements). You MAY reference one specific UI element shown in it."
      : tr
        ? "- Mockup link'i jenerik bir on-izleme. 'Hizli bir taslak hazirladim' gibi GENEL ifade kullan; spesifik UI bilesenleri (rezervasyon widget'i, oda-faturasi gibi) iddia ETME."
        : "- The mockup link is a generic preview. Refer to it generically (e.g. 'put together a quick scoped pass'). Do NOT name vertical-specific UI elements (no 'tab-split UI', 'room-charge integration', 'reservation widget' claims) — the mock does not contain them."
    : null;

  const rules = tr
    ? [
        "- Kurallar:",
        "- Maksimum 3 cumle",
        "- Ilk cumle spesifik bir gozlem icermeli (isletme hakkinda kisisel bir detay)",
        "- Satis tonundan kac; yardimci bir komsunun tonu",
        "- Asla 'umarim iyi gunlerindesin' gibi klise acilis yapma",
        ...(mockupRule ? [mockupRule] : []),
        "- Sonda CTA yerine hafif bir soru sor",
      ].join("\n")
    : [
        "Rules:",
        "- Maximum 3 sentences.",
        "- Open with a specific observation about this business, not a generic greeting.",
        "- Sound like a helpful neighbor, not a salesperson.",
        "- Avoid cliches like 'hope this finds you well' or 'I came across your business'.",
        ...(mockupRule ? [mockupRule] : []),
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

  // Niche pack context. When we fell back to the parent (low confidence
  // child or unclassified), tell the model so it picks a generic angle
  // rather than naming a sub-vertical it doesn't know is right.
  if (input.nicheLabel) {
    lines.push("");
    lines.push(
      input.isParentFallback
        ? `Niche (broad — sub-vertical not yet confirmed, keep angle general): ${input.nicheLabel}`
        : `Niche: ${input.nicheLabel}`,
    );
    if (input.nichePitchAngle) lines.push(`Pitch angle: ${input.nichePitchAngle}`);
    if (input.nicheHighValueSignals.length) {
      lines.push(
        `High-value signals to look for: ${input.nicheHighValueSignals.slice(0, 6).join(", ")}`,
      );
    }
    if (input.nicheFeaturedModules.length && !input.isParentFallback) {
      lines.push(
        `Relevant product modules (mention at most one, only if it ties to a real pain phrase): ${input.nicheFeaturedModules.slice(0, 5).join(", ")}`,
      );
    }
  }

  lines.push("");
  lines.push("Workspace offer context:");
  if (input.offerName) lines.push(`- Offer: ${input.offerName}`);
  if (input.valueProposition) lines.push(`- Value: ${input.valueProposition}`);
  if (input.offerHook) lines.push(`- Hook: ${input.offerHook}`);
  if (input.senderName) lines.push(`- From: ${input.senderName}`);
  if (input.conversionLink) lines.push(`- CTA link: ${input.conversionLink}`);
  if (input.mockupUrl) {
    lines.push(
      `- Mockup to embed (${input.isHandcraftedMockup ? "handcrafted, niche-specific UI" : "generic preview"}): ${input.mockupUrl}`,
    );
  }

  // Recommended package block: passed to the model as INFORMATION, with
  // explicit guardrails. We do NOT want the email to read like a
  // sales-page paste ("Our Premium plan, $119/mo, includes ..."); the
  // tier exists so the rep can quote a specific number on the call,
  // not so the email becomes a billboard. The rule below tells the
  // model to mention the tier name + price at most ONCE, in the soft
  // CTA, and only if the lead's pain phrase actually maps to the
  // included features.
  if (input.recommendedPackage) {
    lines.push("");
    lines.push(
      tr
        ? `Onerilen paket (analiz sonucunda bu lead icin secildi): "${input.recommendedPackage.name}" ${input.recommendedPackage.priceLabel}`
        : `Analyst-recommended package for this lead: "${input.recommendedPackage.name}" ${input.recommendedPackage.priceLabel}`,
    );
    if (input.recommendedPackage.features.length) {
      lines.push(
        tr
          ? `- Paket icerigi: ${input.recommendedPackage.features.join("; ")}`
          : `- Tier covers: ${input.recommendedPackage.features.join("; ")}`,
      );
    }
    if (input.recommendedPackage.reason) {
      lines.push(
        tr
          ? `- Bu tier'in gerekcesi: ${input.recommendedPackage.reason}`
          : `- Why this tier fits: ${input.recommendedPackage.reason}`,
      );
    }
    lines.push(
      tr
        ? `- Paket kullanim kurali: Tier'in ismini ve fiyatini en fazla BIR kere, kapanis sorusunda gectirebilirsin (orn. "${input.recommendedPackage.name} planimiz ${input.recommendedPackage.priceLabel}'dan basliyor — sizin akisiniza uyar mi?"). Ozellik listesi YAPMA, satis sayfasi gibi okutma.`
        : `- Package usage rule: You may name the tier + price AT MOST ONCE, in the soft closing question (e.g. "our ${input.recommendedPackage.name} plan starts at ${input.recommendedPackage.priceLabel} — would something like that fit?"). Do NOT list features or read like a pricing page.`,
    );
  }

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
