/**
 * Review Reply Agent worker.
 *
 * Produces a Google Business Profile reply template pool (~40 total
 * templates across 1-5 stars), tone spec, and approval rule. The
 * exporter packages the output as:
 *   - `json`: raw normalized artifact
 *   - `zip`: folder per star rating + README.md setup guide
 *
 * Deployment path: the agency's client either installs Reploi /
 * UseLocalGuide / Gracia AI and pastes the template pool, or sets
 * up a Zapier / Make flow that posts approved replies via the GBP
 * API. Our output is platform-neutral JSON so it works with any of
 * those.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { prisma } from "@/lib/prisma";
import {
  buildReviewReplyPrompt,
  type ReviewReplyPromptInput,
} from "@/lib/prompts/review-reply-prompt";
import type {
  AgentExportFormat,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

// --- Artifact shape --------------------------------------------------

export interface ReviewReplyToneSpec {
  voice_descriptor: string;
  dos: string[];
  donts: string[];
}

export interface ReviewReplyTemplate {
  id: string;
  body: string;
}

export interface ReviewReplyApprovalRule {
  auto_post_ratings: number[];
  require_human_approval_ratings: number[];
  reasoning: string;
}

export interface ReviewReplyTemplates {
  five_star: ReviewReplyTemplate[];
  four_star: ReviewReplyTemplate[];
  three_star: ReviewReplyTemplate[];
  two_star: ReviewReplyTemplate[];
  one_star: ReviewReplyTemplate[];
}

export interface ReviewReplyArtifact {
  businessName: string;
  leadId: string;
  language: string;
  tone_spec: ReviewReplyToneSpec;
  variables: string[];
  templates: ReviewReplyTemplates;
  approval_rule: ReviewReplyApprovalRule;
  escalation_keywords: string[];
  setup_markdown: string;
}

// --- Worker run ------------------------------------------------------

export const run: AgentWorkerRun = async (ctx) => {
  if (!ctx.lead) {
    throw new Error("REVIEW_REPLY_AGENT requires a lead context");
  }
  const lead = ctx.lead;
  const review = lead.reviewAnalysis;

  const sampleReviews = await prisma.googleReview.findMany({
    where: { leadId: lead.id },
    orderBy: { publishTime: "desc" },
    take: 6,
    select: { authorName: true, rating: true, text: true },
  });

  const painPhrases = toStringArray(review?.painPhrases);
  const strengthPhrases = toStringArray(review?.strengthPhrases);

  const promptInput: ReviewReplyPromptInput = {
    businessName: lead.businessName,
    primaryType: lead.primaryType,
    borough: lead.borough,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    painPhrases,
    strengthPhrases,
    sampleReviews,
    workspaceTone: ctx.workspace.tone,
    language: ctx.workspace.language ?? "en",
  };

  const prompt = buildReviewReplyPrompt(promptInput);
  const { getGeminiKey } = await import("@/lib/gemini-keys");
  const client = new GoogleGenerativeAI(getGeminiKey());
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.REVIEW_REPLY_AGENT,
    label: "review_reply",
  });
  const text = result.response.text();
  const parsed = parseReviewReplyJson(text);

  const artifact: ReviewReplyArtifact = {
    businessName: lead.businessName,
    leadId: lead.id,
    language: ctx.workspace.language ?? "en",
    tone_spec: parsed.tone_spec,
    variables: parsed.variables,
    templates: parsed.templates,
    approval_rule: parsed.approval_rule,
    escalation_keywords: parsed.escalation_keywords,
    setup_markdown: buildSetupMarkdown(parsed, lead.businessName, ctx.workspace.language ?? "en"),
  };

  const costTokens = Math.ceil((prompt.length + text.length) / 4);
  return {
    output: artifact,
    artifactUrl: null,
    costTokens,
  } satisfies AgentWorkerOutput;
};

// --- Parsing ---------------------------------------------------------

function parseReviewReplyJson(text: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Review Reply prompt returned malformed JSON");
    parsed = JSON.parse(match[0]);
  }

  const tone = parsed.tone_spec as Record<string, unknown> | undefined;
  const tpls = parsed.templates as Record<string, unknown> | undefined;
  const approval = parsed.approval_rule as Record<string, unknown> | undefined;

  return {
    tone_spec: {
      voice_descriptor: String(tone?.voice_descriptor ?? "warm, owner-signed"),
      dos: toStringArray(tone?.dos).slice(0, 8),
      donts: toStringArray(tone?.donts).slice(0, 8),
    },
    variables: toStringArray(parsed.variables).slice(0, 12),
    templates: {
      five_star: extractTemplates(tpls?.five_star, "5"),
      four_star: extractTemplates(tpls?.four_star, "4"),
      three_star: extractTemplates(tpls?.three_star, "3"),
      two_star: extractTemplates(tpls?.two_star, "2"),
      one_star: extractTemplates(tpls?.one_star, "1"),
    },
    approval_rule: {
      auto_post_ratings: toNumberArray(approval?.auto_post_ratings) ?? [4, 5],
      require_human_approval_ratings:
        toNumberArray(approval?.require_human_approval_ratings) ?? [1, 2, 3],
      reasoning: String(approval?.reasoning ?? "Negative reviews must get a human read before posting."),
    },
    escalation_keywords: toStringArray(parsed.escalation_keywords).slice(0, 20),
  };
}

function extractTemplates(v: unknown, band: string): ReviewReplyTemplate[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t, i) => ({
      id: String(t.id ?? `${band}star-${i + 1}`),
      body: String(t.body ?? ""),
    }))
    .filter((t) => t.body.length > 0);
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).filter((x): x is string => typeof x === "string");
}

function toNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const nums = (v as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n));
  return nums.length ? nums : null;
}

// --- Exporters -------------------------------------------------------

export function exportReviewReplyArtifact(
  artifact: ReviewReplyArtifact,
  format: AgentExportFormat,
): { body: string; contentType: string; filename: string } {
  const base = `review-reply-${slugify(artifact.businessName)}`;
  switch (format) {
    case "zip":
      return {
        // We ship the zip as a concatenated multi-file markdown bundle
        // rather than a real zip to keep zero native deps. Users get
        // one .md file per star rating with copy-paste blocks.
        body: buildMarkdownBundle(artifact),
        contentType: "text/markdown; charset=utf-8",
        filename: `${base}.md`,
      };
    case "json":
    default:
      return {
        body: JSON.stringify(artifact, null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${base}.json`,
      };
  }
}

function buildMarkdownBundle(a: ReviewReplyArtifact): string {
  const lines: string[] = [];
  lines.push(`# Review Reply Templates - ${a.businessName}`);
  lines.push("");
  lines.push(`Voice: ${a.tone_spec.voice_descriptor}`);
  lines.push("");
  lines.push(`## Variables`);
  lines.push("");
  for (const v of a.variables) lines.push(`- \`{{${v}}}\``);
  lines.push("");
  lines.push(`## Approval rule`);
  lines.push("");
  lines.push(`- Auto-post: ${a.approval_rule.auto_post_ratings.join(", ")} star ratings`);
  lines.push(`- Human approval required: ${a.approval_rule.require_human_approval_ratings.join(", ")} star ratings`);
  lines.push(`- Reason: ${a.approval_rule.reasoning}`);
  lines.push("");
  lines.push(`## Escalation keywords (always human)`);
  lines.push("");
  for (const k of a.escalation_keywords) lines.push(`- ${k}`);
  lines.push("");
  const bands: Array<[keyof ReviewReplyTemplates, string]> = [
    ["five_star", "5-star replies"],
    ["four_star", "4-star replies"],
    ["three_star", "3-star replies"],
    ["two_star", "2-star replies (require approval)"],
    ["one_star", "1-star replies (require approval)"],
  ];
  for (const [key, title] of bands) {
    lines.push(`## ${title}`);
    lines.push("");
    for (const t of a.templates[key]) {
      lines.push(`### ${t.id}`);
      lines.push("");
      lines.push(t.body);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function buildSetupMarkdown(
  a: {
    tone_spec: ReviewReplyToneSpec;
    variables: string[];
    templates: ReviewReplyTemplates;
    approval_rule: ReviewReplyApprovalRule;
    escalation_keywords: string[];
  },
  businessName: string,
  language: string,
): string {
  const tr = language === "tr";
  const head = tr
    ? `# Yorum Cevap Ajani Kurulum Rehberi - ${businessName}`
    : `# Review Reply Agent Setup Guide - ${businessName}`;
  const intro = tr
    ? "Bu paket Google Business Profile icin otomatik yorum cevabi sistemine takilir. Iki yol var:"
    : "This pack plugs into any Google Business Profile auto-reply system. Two paths:";
  const pathA = tr
    ? [
        "**Yol A: Reploi / UseLocalGuide / Gracia AI kullan**",
        "1. GBP'yi OAuth ile bagla.",
        "2. Bu paketten `templates` JSON'unu ayarlar bolumune yapistir.",
        `3. Onay kurali: otomatik post ${a.approval_rule.auto_post_ratings.join(", ")} yildiz; ${a.approval_rule.require_human_approval_ratings.join(", ")} yildiz insan onayi.`,
        "4. Escalation kelimelerini aynen aktar.",
      ]
    : [
        "**Path A: Use Reploi / UseLocalGuide / Gracia AI**",
        "1. Connect GBP via OAuth.",
        "2. Paste the `templates` JSON into the settings.",
        `3. Approval rule: auto-post ${a.approval_rule.auto_post_ratings.join(", ")} stars; require human approval for ${a.approval_rule.require_human_approval_ratings.join(", ")} stars.`,
        "4. Import the escalation keywords verbatim.",
      ];
  const pathB = tr
    ? [
        "**Yol B: Zapier / Make + Google Business Profile API**",
        "1. Trigger: New Review on GBP.",
        "2. Branch yildiz sayisina gore: 5-4 otomatik, 3-2-1 bekleme havuzu.",
        "3. Template secimi: yildiz basina havuzdan rastgele secim.",
        "4. Variable substitution: {{reviewer_first_name}}, {{specific_phrase}} alanlari.",
      ]
    : [
        "**Path B: Zapier / Make + Google Business Profile API**",
        "1. Trigger: New Review on GBP.",
        "2. Branch by star count: 5-4 auto, 3-2-1 to approval queue.",
        "3. Template selection: random pick from the star-matched pool.",
        "4. Variable substitution on {{reviewer_first_name}}, {{specific_phrase}}.",
      ];
  return [
    head,
    "",
    intro,
    "",
    ...pathA,
    "",
    ...pathB,
    "",
    tr ? "## Template sayilari" : "## Template counts",
    "",
    `- 5 star: ${a.templates.five_star.length}`,
    `- 4 star: ${a.templates.four_star.length}`,
    `- 3 star: ${a.templates.three_star.length}`,
    `- 2 star: ${a.templates.two_star.length}`,
    `- 1 star: ${a.templates.one_star.length}`,
    "",
    tr
      ? `## Ton\n\n${a.tone_spec.voice_descriptor}`
      : `## Tone\n\n${a.tone_spec.voice_descriptor}`,
  ].join("\n");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "business";
}
