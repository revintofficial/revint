/**
 * Website Mockup Generator worker.
 *
 * Given a lead (with audit + review analysis + sales opportunity)
 * produces a full landing-page showcase as a `WebsiteMockup` row +
 * rendered HTML, then returns the public URL `/m/{slug}` as
 * artifactUrl.
 *
 * Pipeline:
 *   1. Gather lead + workspace context + SalesOpportunity +
 *      ServicePackage rows
 *   2. Resolve the recommended package (id → row) if the analyst
 *      wrote one
 *   3. Call Gemini 2.5 Flash with JSON mode + strict v2 schema
 *      (hero/stats/process/courses/trust/testimonials/faq/booking/
 *       about/map/contact/cta — see website-mockup-prompt.ts)
 *   4. Validate + coerce sections (gracefully tolerates missing
 *      v2 fields; back-compat with v1 rows for the /m/<slug> route)
 *   5. Render HTML via `leadac-showcase-v1` template
 *   6. Upsert WebsiteMockup row (one slug per lead — regenerate
 *      overwrites sections + html cache, keeps slug + viewCount)
 *   7. Return { output, artifactUrl }
 *
 * The `user_one_click_pitch` chain now scores BEFORE this worker so
 * `SalesOpportunity` is reliably present at run time; legacy ad-hoc
 * triggers (no scorer upstream) still work but skip the sales-aware
 * prompt fields.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteMockupPrompt,
  type WebsiteMockupSections,
  type WebsiteMockupPromptInput,
  type WorkspaceServicePackage,
  type RecommendedPackageInput,
} from "@/lib/prompts/website-mockup-prompt";
import { renderLeadacShowcase } from "@/lib/mockups/renderers/leadac-showcase";
import { parseBranding } from "@/lib/branding";
import { generateMockupSlug } from "@/lib/mockup";
import { getVisualIdentityForLead, getNicheBySlug } from "@/lib/niches";
import { resolveRecommendedPackage } from "@/lib/lead-detail/recommended-package";
import type { AgentWorkerOutput, AgentWorkerRun } from "./types";

export const SHOWCASE_TEMPLATE_ID = "leadac-showcase-v1";

export const run: AgentWorkerRun = async (ctx) => {
  if (!ctx.lead) {
    throw new Error("WEBSITE_MOCKUP_GENERATOR requires a lead context");
  }
  const lead = ctx.lead;
  const audit = lead.websiteAudit;
  const review = lead.reviewAnalysis;

  // Top 3 Google reviews by rating (we only need a short sample for
  // Gemini grounding — the full set is analyzed elsewhere).
  // Parallel-load the workspace's priced packages + the lead's
  // SalesOpportunity so the prompt has everything it needs in one
  // round-trip.
  const [topReviews, salesOp, workspacePackages] = await Promise.all([
    prisma.googleReview.findMany({
      where: { leadId: lead.id },
      orderBy: [{ rating: "desc" }, { publishTime: "desc" }],
      take: 3,
      select: { authorName: true, rating: true, text: true },
    }),
    prisma.salesOpportunity.findUnique({
      where: { leadId: lead.id },
      select: {
        likelyPainPoints: true,
        bestSalesAngle: true,
        whyGoodTarget: true,
        recommendedPackageId: true,
        recommendedPackageReason: true,
      },
    }),
    prisma.servicePackage.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { name: true, priceLabel: true, features: true, isPopular: true },
    }),
  ]);

  const servicesDetected = Array.isArray(audit?.servicesDetected)
    ? (audit.servicesDetected as unknown[]).filter(isString)
    : [];

  const painPhrases = Array.isArray(review?.painPhrases)
    ? (review.painPhrases as unknown[]).filter(isString)
    : [];
  const strengthPhrases = Array.isArray(review?.strengthPhrases)
    ? (review.strengthPhrases as unknown[]).filter(isString)
    : [];

  const salesPainPoints = Array.isArray(salesOp?.likelyPainPoints)
    ? (salesOp.likelyPainPoints as unknown[]).filter(isString)
    : [];

  // Resolve the recommended package row (or null when the analyst
  // didn't write one, or the row was deleted since). The helper
  // already enforces workspace scope.
  const recommendedPackage: RecommendedPackageInput | null =
    salesOp?.recommendedPackageId
      ? await (async () => {
          const resolved = await resolveRecommendedPackage({
            workspaceId: ctx.workspaceId,
            recommendedPackageId: salesOp.recommendedPackageId,
            recommendedPackageReason: salesOp.recommendedPackageReason,
          });
          if (!resolved) return null;
          return {
            name: resolved.name,
            priceLabel: resolved.priceLabel,
            features: resolved.features,
            reason: resolved.reason,
          };
        })()
      : null;

  const workspaceServicePackages: WorkspaceServicePackage[] = workspacePackages.map(
    (p) => ({
      name: p.name,
      priceLabel: p.priceLabel,
      features: p.features,
      isPopular: p.isPopular,
    }),
  );

  // Look up the niche pack for richer prompt context. Prefer child
  // slug (more specific pitch) then parent. Falls back to no metadata
  // when the lead has neither — the prompt copes with a null niche.
  const nichePack =
    (lead.subNicheSlug ? getNicheBySlug(lead.subNicheSlug) : null) ??
    (lead.nicheSlug ? getNicheBySlug(lead.nicheSlug) : null) ??
    null;

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
    nicheLabel: nichePack?.label ?? null,
    nichePitchAngle: nichePack?.pitchAngle ?? null,
    nicheHighValueSignals: nichePack?.highValueSignals ?? [],
    salesPainPoints,
    salesBestAngle: salesOp?.bestSalesAngle ?? null,
    salesWhyGoodTarget: salesOp?.whyGoodTarget ?? null,
    recommendedPackage,
    workspaceServicePackages,
    language: ctx.workspace.language ?? "en",
  };

  const prompt = buildWebsiteMockupPrompt(promptInput);

  const { getGeminiKey } = await import("@/lib/gemini-keys");
  const client = new GoogleGenerativeAI(getGeminiKey());
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      // Roomier budget than v1 because the schema now carries up to
      // 6 FAQs + 3 priced courses + booking + contact + map. 8K
      // tokens is a comfortable ceiling for the strict JSON-mode
      // response without ever bumping into the model's hard cap.
      maxOutputTokens: 8192,
      temperature: 0.55,
      responseMimeType: "application/json",
    },
  });

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.WEBSITE_MOCKUP_GENERATOR,
    label: "website_mockup",
  });
  const text = result.response.text();
  const sections = parseSections(text, workspaceServicePackages);

  // Resolve niche-specific palette + photos. Niche pack is the source
  // of truth for visual identity; Gemini's `theme` block is advisory.
  // Same subNiche → niche → generic fallback chain as the template
  // registry.
  const visual = getVisualIdentityForLead({
    subNicheSlug: lead.subNicheSlug ?? null,
    nicheSlug: lead.nicheSlug ?? null,
    primaryType: lead.primaryType ?? null,
    businessName: lead.businessName,
  });
  sections.theme = {
    mode: visual.theme.mode,
    accent_hex: visual.theme.accentHex,
    primary_hex: visual.theme.primaryHex,
  };

  // Branding only applies for Agency tier (same rule as legacy
  // Mockup). When an agency has set its own brand colors we let those
  // win over the niche palette — the agency reseller's identity comes
  // first.
  const branding =
    ctx.workspace.plan === "AGENCY" ? parseBranding(ctx.workspace.branding) : null;

  const html = renderLeadacShowcase({
    businessName: lead.businessName,
    formattedAddress: lead.formattedAddress,
    borough: lead.borough,
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    googleMapsUri: lead.googleMapsUri,
    sections,
    imagery: visual.imagery,
    secondaryHex: visual.theme.secondaryHex ?? null,
    workspaceName: ctx.workspace.name,
    branding,
    lang: ctx.workspace.language ?? "en",
    nicheLabel: nichePack?.label ?? null,
  });

  // Upsert a single WebsiteMockup per lead: re-generate overwrites
  // the sections + html cache but keeps the slug (so outbound links
  // stay stable across regens) and keeps viewCount.
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
        templateId: SHOWCASE_TEMPLATE_ID,
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
        templateId: SHOWCASE_TEMPLATE_ID,
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
    html: null,
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
 * it from the `WebsiteMockup.htmlCache` column; keeping the run
 * output compact keeps the AgentRun table from ballooning.
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

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * Parses + validates the Gemini JSON response. Falls back to safe
 * defaults for any v2 field that comes back missing or malformed so
 * the renderer always has a valid object to chew on; the price card
 * is rebuilt server-side from the workspace's ServicePackage rows
 * regardless of what Gemini emits so an invented price can never
 * land in the public /m/<slug> page.
 */
function parseSections(
  text: string,
  workspacePackages: WorkspaceServicePackage[],
): WebsiteMockupSections {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return valid JSON for website mockup");
    parsed = JSON.parse(match[0]);
  }

  const hero = parsed.hero as Record<string, unknown> | undefined;
  if (!hero || typeof hero.headline !== "string") {
    throw new Error("Gemini returned malformed website-mockup JSON (missing hero.headline)");
  }

  const services = Array.isArray(parsed.services) ? (parsed.services as unknown[]) : [];
  const stats = Array.isArray(parsed.stats) ? (parsed.stats as unknown[]) : [];
  const features = Array.isArray(parsed.features) ? (parsed.features as unknown[]) : [];
  const coursesRaw = Array.isArray(parsed.courses) ? (parsed.courses as unknown[]) : [];
  const trustPoints = Array.isArray(parsed.trust_points)
    ? (parsed.trust_points as unknown[])
    : [];
  const testimonials = Array.isArray(parsed.testimonials)
    ? (parsed.testimonials as unknown[])
    : [];
  const faqs = Array.isArray(parsed.faqs) ? (parsed.faqs as unknown[]) : [];
  const about = (parsed.about as Record<string, unknown> | undefined) ?? {};
  const ctaFinal = (parsed.cta_final as Record<string, unknown> | undefined) ?? {};
  const theme = (parsed.theme as Record<string, unknown> | undefined) ?? {};
  const testimonial = parsed.testimonial as Record<string, unknown> | null | undefined;
  const sectionOrder = Array.isArray(parsed.section_order)
    ? (parsed.section_order as unknown[]).filter(isString)
    : [];

  const heroStatStripRaw = Array.isArray(hero.stat_strip)
    ? (hero.stat_strip as unknown[])
    : [];

  // Reconcile courses against the workspace's actual price card. The
  // prompt is asked to title-match + price-match verbatim; we enforce
  // it here so an invented price (e.g. Gemini writing "10.000 TL"
  // when the workspace's tier is "7.000 TL") cannot ship to the
  // public page. When a Gemini course title doesn't match any
  // workspace package, we keep the Gemini-supplied price_label
  // verbatim (back-compat with workspaces that have ZERO
  // ServicePackages configured — fine-dining-tier workspaces). If
  // workspacePackages is non-empty and Gemini's title doesn't match,
  // we substitute the closest workspace package by index.
  const pkgByName = new Map(
    workspacePackages.map((p) => [p.name.toLowerCase().trim(), p]),
  );
  let popularSeen = false;
  const courses = coursesRaw
    .slice(0, 3)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c, idx) => {
      const title = String(c.title ?? "");
      const matched = pkgByName.get(title.toLowerCase().trim()) ??
        (workspacePackages.length > 0 ? workspacePackages[idx % workspacePackages.length] : null);
      const priceLabel = matched ? matched.priceLabel : String(c.price_label ?? "");
      const isPopularInput = matched ? matched.isPopular : c.is_popular === true;
      const isPopular = isPopularInput && !popularSeen;
      if (isPopular) popularSeen = true;
      return {
        title: matched ? matched.name : title,
        body: String(c.body ?? ""),
        price_label: priceLabel,
        duration: typeof c.duration === "string" ? c.duration : null,
        feature_list: isStringArray(c.feature_list)
          ? c.feature_list
          : matched
            ? matched.features
            : [],
        is_popular: isPopular,
        icon_hint: String(c.icon_hint ?? "star"),
      };
    });

  // When no Gemini courses survived but the workspace has packages
  // configured, synthesise a courses card per package so the showcase
  // never ships without the pricing block (workspaces that paid for
  // the v2 mockup should always see their tiers on the page).
  const finalCourses =
    courses.length === 0 && workspacePackages.length > 0
      ? workspacePackages.slice(0, 3).map((p, idx) => ({
          title: p.name,
          body: "",
          price_label: p.priceLabel,
          duration: null,
          feature_list: p.features,
          is_popular: p.isPopular || idx === 1,
          icon_hint: "star",
        }))
      : courses;

  const booking = parsed.booking_widget as Record<string, unknown> | null | undefined;
  const contact = parsed.contact_form as Record<string, unknown> | null | undefined;
  const map = parsed.map as Record<string, unknown> | null | undefined;

  return {
    hero: {
      headline: String(hero.headline),
      subline: String(hero.subline ?? ""),
      cta_primary_text: String(hero.cta_primary_text ?? "Contact"),
      cta_secondary_text:
        typeof hero.cta_secondary_text === "string" ? hero.cta_secondary_text : null,
      trust_line: typeof hero.trust_line === "string" ? hero.trust_line : null,
      stat_strip: heroStatStripRaw
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .map((c) => ({
          value: String(c.value ?? ""),
          label: String(c.label ?? ""),
        }))
        .filter((c) => c.value && c.label)
        .slice(0, 3),
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
    stats: stats
      .slice(0, 4)
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        value: String(s.value ?? ""),
        label: String(s.label ?? ""),
        icon_hint: String(s.icon_hint ?? "star"),
      }))
      .filter((s) => s.value && s.label),
    features: features
      .slice(0, 4)
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        title: String(s.title ?? ""),
        body: String(s.body ?? ""),
        icon_hint: String(s.icon_hint ?? "check"),
      }))
      .filter((s) => s.title.length > 0),
    courses: finalCourses,
    trust_points: trustPoints
      .slice(0, 3)
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        title: String(s.title ?? ""),
        body: String(s.body ?? ""),
      }))
      .filter((s) => s.title.length > 0),
    testimonials: testimonials
      .slice(0, 3)
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .filter((t) => typeof t.body === "string" && t.body.length > 0)
      .map((t) => ({
        body: String(t.body),
        attribution: String(t.attribution ?? ""),
        rating: clampRating(t.rating),
      })),
    testimonial:
      testimonial && typeof testimonial === "object" && typeof testimonial.body === "string"
        ? {
            body: String(testimonial.body),
            attribution: String(testimonial.attribution ?? ""),
            rating: clampRating(testimonial.rating),
          }
        : null,
    faqs: faqs
      .slice(0, 6)
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        question: String(s.question ?? ""),
        answer: String(s.answer ?? ""),
      }))
      .filter((s) => s.question.length > 0 && s.answer.length > 0),
    about: {
      paragraph: String(about.paragraph ?? ""),
      instructors: Array.isArray(about.instructors)
        ? (about.instructors as unknown[])
            .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
            .map((i) => ({
              name: String(i.name ?? ""),
              role: String(i.role ?? ""),
            }))
            .filter((i) => i.name.length > 0)
            .slice(0, 3)
        : [],
    },
    booking_widget:
      booking && typeof booking === "object" && typeof booking.title === "string"
        ? {
            title: String(booking.title),
            subtitle: String(booking.subtitle ?? ""),
            slot_label_today: String(booking.slot_label_today ?? ""),
            slot_label_tomorrow: String(booking.slot_label_tomorrow ?? ""),
            slot_label_day3: String(booking.slot_label_day3 ?? ""),
            time_slots: isStringArray(booking.time_slots)
              ? booking.time_slots.slice(0, 5)
              : [],
          }
        : null,
    contact_form:
      contact && typeof contact === "object" && typeof contact.title === "string"
        ? {
            title: String(contact.title),
            subtitle: String(contact.subtitle ?? ""),
            name_label: String(contact.name_label ?? ""),
            phone_label: String(contact.phone_label ?? ""),
            class_label: String(contact.class_label ?? ""),
            message_label: String(contact.message_label ?? ""),
            submit_text: String(contact.submit_text ?? "Send"),
            privacy_note: String(contact.privacy_note ?? ""),
          }
        : null,
    map:
      map && typeof map === "object" && typeof map.iframe_query === "string"
        ? { iframe_query: String(map.iframe_query) }
        : null,
    cta_final: {
      headline: String(ctaFinal.headline ?? "Get in touch"),
      subline: typeof ctaFinal.subline === "string" ? ctaFinal.subline : null,
      button_text: String(ctaFinal.button_text ?? "Contact us"),
      secondary_button_text:
        typeof ctaFinal.secondary_button_text === "string"
          ? ctaFinal.secondary_button_text
          : null,
    },
    theme: {
      mode: theme.mode === "light" ? "light" : "dark",
      accent_hex: String(theme.accent_hex ?? "#a5b4fc"),
      primary_hex: String(theme.primary_hex ?? "#5e6ad2"),
    },
    section_order:
      sectionOrder.length > 0
        ? (sectionOrder as string[])
        : [
            "nav",
            "hero",
            "stats",
            "process",
            "courses",
            "trust",
            "testimonials",
            "faq",
            "booking",
            "about",
            "map",
            "contact",
            "cta",
            "footer",
          ],
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
