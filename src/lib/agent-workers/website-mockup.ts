/**
 * Website Mockup Generator worker.
 *
 * Given a lead (with audit + review analysis) produces a full
 * landing-page mockup as a `WebsiteMockup` row + rendered HTML,
 * then returns the public URL `/m/{slug}` as artifactUrl.
 *
 * Pipeline:
 *   1. Gather lead + workspace context
 *   2. Call Gemini 2.5 Flash with JSON mode + strict schema
 *   3. Validate + coerce sections
 *   4. Render HTML via `leadac-hero-v1` template
 *   5. Upsert WebsiteMockup row (one slug per lead - regenerate
 *      overwrites sections + html cache, keeps slug + viewCount)
 *   6. Return { output, artifactUrl }
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteMockupPrompt,
  type WebsiteMockupSections,
  type WebsiteMockupPromptInput,
} from "@/lib/prompts/website-mockup-prompt";
import { renderLeadacHero } from "@/lib/mockups/renderers/leadac-hero";
import { parseBranding } from "@/lib/branding";
import { generateMockupSlug } from "@/lib/mockup";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

export const run: AgentWorkerRun = async (ctx) => {
  if (!ctx.lead) {
    throw new Error("WEBSITE_MOCKUP_GENERATOR requires a lead context");
  }
  const lead = ctx.lead;
  const audit = lead.websiteAudit;
  const review = lead.reviewAnalysis;

  // Top 3 Google reviews by rating (we only need a short sample for
  // Gemini grounding - the full set is analyzed elsewhere).
  const topReviews = await prisma.googleReview.findMany({
    where: { leadId: lead.id },
    orderBy: [{ rating: "desc" }, { publishTime: "desc" }],
    take: 3,
    select: { authorName: true, rating: true, text: true },
  });

  const servicesDetected = Array.isArray(audit?.servicesDetected)
    ? (audit.servicesDetected as unknown[]).filter(isString)
    : [];

  const painPhrases = Array.isArray(review?.painPhrases)
    ? (review.painPhrases as unknown[]).filter(isString)
    : [];
  const strengthPhrases = Array.isArray(review?.strengthPhrases)
    ? (review.strengthPhrases as unknown[]).filter(isString)
    : [];

  const promptInput: WebsiteMockupPromptInput = {
    businessName: lead.businessName,
    formattedAddress: lead.formattedAddress,
    borough: lead.borough,
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    primaryType: lead.primaryType,
    servicesDetected,
    topReviews,
    painPhrases,
    strengthPhrases,
    workspaceOfferName: ctx.workspace.offerName ?? null,
    workspaceValueProposition: ctx.workspace.valueProposition ?? null,
    language: ctx.workspace.language ?? "en",
  };

  const prompt = buildWebsiteMockupPrompt(promptInput);

  const { getGeminiKey } = await import("@/lib/gemini-keys");
  const client = new GoogleGenerativeAI(getGeminiKey());
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.55,
      responseMimeType: "application/json",
    },
  });

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.WEBSITE_MOCKUP_GENERATOR,
    label: "website_mockup",
  });
  const text = result.response.text();
  const sections = parseSections(text);

  // Branding only applies for Agency tier (same rule as legacy Mockup).
  const branding =
    ctx.workspace.plan === "AGENCY" ? parseBranding(ctx.workspace.branding) : null;

  const html = renderLeadacHero({
    businessName: lead.businessName,
    formattedAddress: lead.formattedAddress,
    borough: lead.borough,
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    googleMapsUri: lead.googleMapsUri,
    sections,
    workspaceName: ctx.workspace.name,
    branding,
    lang: ctx.workspace.language ?? "en",
  });

  // Upsert a single WebsiteMockup per lead: re-generate overwrites the
  // sections + html cache but keeps the slug (so outbound links stay
  // stable across regens) and increments/keeps viewCount.
  const existing = await prisma.websiteMockup.findFirst({
    where: { leadId: lead.id },
    select: { id: true, slug: true },
  });

  let slug: string;
  if (existing) {
    slug = existing.slug;
    await prisma.websiteMockup.update({
      where: { id: existing.id },
      data: {
        sectionsJson: sections as never,
        themeJson: sections.theme as never,
        htmlCache: html,
      },
    });
  } else {
    slug = generateMockupSlug();
    await prisma.websiteMockup.create({
      data: {
        slug,
        leadId: lead.id,
        workspaceId: ctx.workspaceId,
        sectionsJson: sections as never,
        themeJson: sections.theme as never,
        htmlCache: html,
        templateId: "leadac-hero-v1",
        isPublic: true,
      },
    });
  }

  // Approximate token cost - Gemini 2.5 Flash response text length / 4
  // is a rough token count. Used by the quota meter; accuracy is
  // sufficient for tier enforcement.
  const costTokens = Math.ceil((prompt.length + text.length) / 4);

  const output: WebsiteMockupWorkerOutput = {
    slug,
    sections,
    html: null, // do NOT return the full HTML payload to the run outputJson
    publicUrl: `/m/${slug}`,
  };

  return {
    output,
    artifactUrl: `/m/${slug}`,
    costTokens,
  } satisfies AgentWorkerOutput;
};

/**
 * Shape persisted to `AgentRun.outputJson` for Website Mockup runs.
 * Omits the rendered HTML because the public `/m/{slug}` route reads
 * it from the `WebsiteMockup.htmlCache` column; keeping the run output
 * compact keeps the AgentRun table from ballooning.
 */
export interface WebsiteMockupWorkerOutput {
  slug: string;
  sections: WebsiteMockupSections;
  html: null;
  publicUrl: string;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

/**
 * Parses + validates the Gemini JSON response. Falls back to a
 * minimal template if the model returns garbage so the user never
 * sees a total failure; the UI can re-trigger via the Regenerate
 * button.
 */
function parseSections(text: string): WebsiteMockupSections {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return valid JSON for website mockup");
    parsed = JSON.parse(match[0]);
  }

  const hero = parsed.hero as Record<string, unknown> | undefined;
  const services = Array.isArray(parsed.services) ? (parsed.services as unknown[]) : [];
  const about = (parsed.about as Record<string, unknown> | undefined) ?? {};
  const cta_final = (parsed.cta_final as Record<string, unknown> | undefined) ?? {};
  const theme = (parsed.theme as Record<string, unknown> | undefined) ?? {};
  const testimonial = parsed.testimonial as Record<string, unknown> | null | undefined;
  const section_order = Array.isArray(parsed.section_order) ? (parsed.section_order as unknown[]).filter(isString) : [];

  if (!hero || typeof hero.headline !== "string") {
    throw new Error("Gemini returned malformed website-mockup JSON (missing hero.headline)");
  }

  return {
    hero: {
      headline: String(hero.headline),
      subline: String(hero.subline ?? ""),
      cta_primary_text: String(hero.cta_primary_text ?? "Contact"),
      trust_line: typeof hero.trust_line === "string" ? hero.trust_line : null,
    },
    services: services
      .slice(0, 6)
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        title: String(s.title ?? ""),
        body: String(s.body ?? ""),
        icon_hint: String(s.icon_hint ?? "star"),
      }))
      .filter((s) => s.title.length > 0),
    testimonial:
      testimonial && typeof testimonial === "object" && typeof testimonial.body === "string"
        ? {
            body: String(testimonial.body),
            attribution: String(testimonial.attribution ?? ""),
            // Rating may be null when Gemini returned a non-numeric or
            // out-of-range value; the template renders no stars in
            // that case rather than inventing a fake 5-star rating.
            rating: clampRating(testimonial.rating),
          }
        : null,
    about: {
      paragraph: String(about.paragraph ?? ""),
    },
    cta_final: {
      headline: String(cta_final.headline ?? "Get in touch"),
      button_text: String(cta_final.button_text ?? "Contact us"),
    },
    theme: {
      mode: theme.mode === "light" ? "light" : "dark",
      accent_hex: String(theme.accent_hex ?? "#a5b4fc"),
      primary_hex: String(theme.primary_hex ?? "#5e6ad2"),
    },
    section_order:
      section_order.length > 0
        ? (section_order as string[])
        : ["hero", "services", "social_proof", "about", "contact"],
  };
}

/**
 * Accepts only a numeric rating in [1, 5]. Garbage / missing values
 * return null rather than silently snapping to 5 - a fake 5-star
 * testimonial rendered on the prospect's /m/{slug} page is a trust
 * issue (they'll notice their real rating differs). Returns integer
 * stars; callers that want decimals can substitute their own clamp.
 */
function clampRating(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}
