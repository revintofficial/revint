import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import type { GeminiAnalysis, WebsiteFeatures, AuditChecklistResult } from "@/types";
import { WEBSITE_PLAN_SYSTEM_CONTEXT, WEBSITE_PLAN_TEMPLATE } from "./prompts/website-plan-prompt";
import { REVIEW_ANALYSIS_PROMPT_TEMPLATE, type ReviewAnalysisOutput } from "./prompts/review-analysis-prompt";
import { formatChecklistForPrompt } from "./audit-checklist";
import { languagePreamble } from "./i18n";
import { logger } from "./logger";
import { getNicheBySlug } from "./niches";

/**
 * Best-effort JSON parser for Gemini output.
 *
 * Even with `responseMimeType: "application/json"`, Gemini occasionally
 * emits malformed JSON when user-generated text (review excerpts, KB
 * chunks) is echoed back into string values - typically as raw control
 * characters or trailing commas. This helper:
 *
 * 1. Strips leading/trailing markdown code fences.
 * 2. Replaces unescaped ASCII control chars (0x00-0x1F except \t\n\r)
 *    with spaces - the most common cause of "Expected ',' or ']'" errors.
 * 3. Removes trailing commas before } and ].
 * 4. Falls back to extracting the largest {...} substring.
 *
 * On total failure, throws an Error whose message includes a snippet of
 * the raw output so the worker logs are actionable.
 */
export function safeParseGeminiJson<T = unknown>(raw: string, contextLabel = "gemini"): T {
  let lastError: unknown;
  let lastCandidate = "";
  const tryParse = (s: string): T | undefined => {
    lastCandidate = s;
    try {
      return JSON.parse(s) as T;
    } catch (e) {
      lastError = e;
      return undefined;
    }
  };

  const stripped = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const direct = tryParse(stripped);
  if (direct !== undefined) return direct;

  // Strip ASCII control chars (except the ones JSON allows between tokens)
  // and trailing commas. This rescues the common case where Gemini echoes
  // a review excerpt that ends with \u0000-\u001F bytes.
  const cleaned = stripped
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/,(\s*[}\]])/g, "$1");

  const cleanedParse = tryParse(cleaned);
  if (cleanedParse !== undefined) return cleanedParse;

  // Escape raw \n / \r / \t that appear INSIDE string values (common
  // when a Gemini "summary" includes a real newline).
  const escaped = escapeControlCharsInStrings(cleaned);
  const escapedParse = tryParse(escaped);
  if (escapedParse !== undefined) return escapedParse;

  const match = escaped.match(/\{[\s\S]*\}/);
  if (match) {
    const matched = tryParse(match[0]);
    if (matched !== undefined) return matched;
  }

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  const position = /position (\d+)/.exec(errorMsg)?.[1];
  const posNum = position ? Number(position) : -1;
  const window =
    posNum >= 0
      ? lastCandidate.slice(Math.max(0, posNum - 120), posNum + 120)
      : lastCandidate.slice(0, 400);
  const snippet = raw.length > 2500 ? `${raw.slice(0, 2500)}...[truncated ${raw.length}]` : raw;
  logger.error("gemini.parse_failed", {
    contextLabel,
    parseError: errorMsg,
    errorWindow: window,
    rawLength: raw.length,
    snippet,
  });
  throw new Error(`${contextLabel}: Gemini returned malformed JSON (${errorMsg})`);
}

/**
 * Walk the string and replace raw \n, \r, \t bytes that appear INSIDE a
 * JSON string literal with their escaped equivalents. Ignores control
 * chars outside strings (those are already whitespace-legal).
 */
function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inString = false;
  let prevEscape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (prevEscape) {
        out += ch;
        prevEscape = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        prevEscape = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
    } else {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
    }
  }
  return out;
}

export interface WorkspaceOfferContext {
  offerName: string | null;
  valueProposition: string | null;
  socialProof: string | null;
  offerHook: string | null;
  objective: string | null;
  tone: string | null;
  length: string | null;
  language: string | null;
  senderName: string | null;
  conversionLink: string | null;
}

export interface ReviewIntelligenceContext {
  weaknessKpis: ReviewAnalysisOutput["weaknessKpis"];
  strengthKpis: ReviewAnalysisOutput["strengthKpis"];
  painPhrases: string[];
  strengthPhrases: string[];
  switchSignals: ReviewAnalysisOutput["switchSignals"];
  sentimentBreakdown: ReviewAnalysisOutput["sentimentBreakdown"];
  leadScore: number;
  summary: string;
}

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export interface WebsitePlanInput {
  businessName: string;
  address: string;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteUrl: string | null;
  features: WebsiteFeatures | null;
  reviews: { authorName: string; rating: number; text: string | null }[];
  salesOpportunity: {
    opportunityScore: number;
    reasonCodes: string[];
    whyGoodTarget: string | null;
    likelyPainPoints: string[];
    suggestedOffer: string;
    bestSalesAngle: string | null;
  } | null;
  auditChecklist: AuditChecklistResult | null;
  // P0.3 Mockup × Review Intelligence sinerjisi: review KPI verilerini handbook prompt'una besle.
  reviewIntelligence?: ReviewIntelligenceContext | null;
  // P0.2 Workspace "My offer" context: mockup CTA + hero are shaped by the offer.
  offer?: WorkspaceOfferContext | null;
}

export interface AnalysisServicePackage {
  id: string;
  name: string;
  priceLabel: string;
  features: string[];
  isPopular: boolean;
}

/** Builds a niche-aware analysis prompt. Defaults to WEB_AGENCY behaviour. */
function buildAnalysisPrompt(
  niche: string | null,
  offerName: string | null,
  valueProposition: string | null,
  subNicheSlug: string | null = null,
  /**
   * 0..1 classifier confidence for `subNicheSlug`. Caller sets this
   * to 1.0 for MANUAL-sourced (rep-overridden) slugs and to the
   * classifier's score for AUTO-sourced. The prompt builder appends
   * a "low-confidence" caveat below 0.7 so Gemini doesn't write
   * over-specific vertical claims when the classifier wasn't sure.
   * The caller is responsible for the harder gate (passing
   * `subNicheSlug = null` and falling back to the parent niche)
   * when confidence is too low to trust the child at all.
   */
  subNicheConfidence: number | null = null,
  /**
   * Workspace's configured ServicePackage menu (priced tiers /
   * service packages the team actually sells). When non-empty, the
   * prompt presents them to Gemini and asks for `recommended_package_id`
   * + `recommended_package_reason`, replacing the generic
   * STARTER/GROWTH/SALES heuristic. When empty, the legacy enum
   * behaviour is preserved.
   */
  servicePackages: AnalysisServicePackage[] = [],
): string {
  const isRestaurant = niche === "RESTAURANT_TECH";

  // Resolve the most specific niche pack we can: child > parent > none.
  // The pack provides the F&B sub-vertical's pitch angle, featured product
  // modules, and the high-value audit signals so the analyst doesn't pitch
  // a sommelier note to a food truck or commission-free delivery to a
  // fine-dining room. When subNicheSlug is null we fall back to the parent
  // `fnb` pack so analysis stays niche-aware even before the classifier
  // tags the lead.
  const nichePack = isRestaurant
    ? getNicheBySlug(subNicheSlug ?? "fnb")
    : null;
  const usingChildPack = !!subNicheSlug && !!nichePack && nichePack.parentSlug !== undefined;

  const subVerticalLine = nichePack
    ? ` This specific lead is a ${nichePack.label} — ${nichePack.tagline}`
    : "";
  const featuredModulesLine = nichePack?.featuredProductModules?.length
    ? ` Focus the pitch on these product modules: ${nichePack.featuredProductModules.join(", ")}.`
    : "";
  const painPointsLine = nichePack?.highValueSignals?.length
    ? ` Common pain points for this format: ${nichePack.highValueSignals.join("; ")}.`
    : "";

  const industryContext = isRestaurant
    ? `You are a lead analyst for an F&B platform (FineDine-class) that sells digital menu, payment, reservations, table management, kiosk, delivery, and CRM tools to food and beverage venues — replacing paper menus and disconnected POS stacks with one platform.${subVerticalLine}${featuredModulesLine}${painPointsLine}`
    : `You are a lead analyst for a web design agency that sells websites and digital marketing to local service businesses.`;

  const offerContext =
    offerName || valueProposition
      ? `\nYour offer: ${[offerName, valueProposition].filter(Boolean).join(" — ")}`
      : "";

  // Low-confidence caveat: when the sub-niche came from an AUTO
  // classification with score < 0.7, soften the language so we don't
  // ship "we'll set up your <wrong-vertical>" messaging that the rep
  // then has to apologise for. The caller's harder gate (passing
  // `subNicheSlug = null` below 0.7) catches the worst case; this is
  // a belt-and-braces in-prompt warning.
  const confidenceCaveat =
    usingChildPack &&
    typeof subNicheConfidence === "number" &&
    subNicheConfidence < 0.7
      ? `\nNote: the sub-vertical above was inferred with low confidence (${subNicheConfidence.toFixed(2)}). Keep claims conservative — do not write "we'll set up X for your <vertical>" with too much specificity unless the audit clearly supports it.`
      : "";

  const reasonCodesGuidance = isRestaurant
    ? `- reason_codes: string[] — use restaurant-specific codes:
  "no_qr_menu" (no QR / digital menu detected),
  "pdf_menu_only" (PDF menu found but no interactive QR menu),
  "no_reservation" (no online reservation system),
  "no_delivery_integration" (no delivery platform embed),
  "chain_detected" (part of a chain — may already have central tech),
  "hotel_property" (hotel restaurant — higher deal value),
  "high_review_volume" (many reviews = high footfall = strong ROI case),
  "no_website" (no site at all),
  "poor_mobile" (poor mobile UX),
  "no_whatsapp" (no WhatsApp contact)`
    : `- reason_codes: string[] — e.g. "no_website", "poor_mobile", "no_booking", "no_whatsapp", "weak_seo", "no_https", "slow_site", "no_ecommerce", "high_rating_weak_site"`;

  const offerLevels = isRestaurant
    ? `- suggested_offer: "starter" | "growth" | "sales"
  (starter = basic QR menu setup,
   growth = QR menu + online reservation + delivery integration,
   sales = growth + loyalty program + table management + analytics dashboard)`
    : `- suggested_offer: "starter" | "growth" | "sales"
  (starter = basic mobile site,
   growth = site + booking + whatsapp + local SEO,
   sales = growth + inventory showcase + review embedding + lead capture)`;

  // ServicePackage block: only emitted when the workspace has
  // explicitly configured priced tiers (Settings -> "Service
  // packages"). Without this, Gemini hallucinates plan names that
  // don't exist in the rep's deck and price bands that don't match
  // the actual price card. Empty workspaces fall through to the
  // legacy STARTER/GROWTH/SALES enum so the v1 behaviour stays
  // unchanged for non-FineDine tenants that haven't set packages up.
  const hasPackages = servicePackages.length > 0;
  const packagesMenu = hasPackages
    ? `\nWorkspace service packages (the actual tiers the rep sells - ALWAYS pick one of these IDs verbatim, do NOT invent a new tier):\n${servicePackages
        .map(
          (p, i) =>
            `${i + 1}. id: "${p.id}" | name: "${p.name}" | price: ${p.priceLabel}${p.isPopular ? " (most popular)" : ""}${
              p.features.length
                ? `\n   features: ${p.features.slice(0, 6).join("; ")}`
                : ""
            }`,
        )
        .join("\n")}`
    : "";
  const packageFields = hasPackages
    ? `
- recommended_package_id: string — the EXACT id of one of the packages above. Pick the cheapest tier whose features cover this lead's pain points; only step up if the audit shows multi-location, hotel, or enterprise signals that justify the higher tier.
- recommended_package_reason: string (1-2 sentences explaining why this specific tier fits this specific lead — reference an audit signal or pain point so the rep can quote it on the discovery call)`
    : "";

  return `${industryContext}${offerContext}${confidenceCaveat}${packagesMenu}
Analyze the following business and produce a JSON assessment.

Business Information:
- Name: {business_name}
- Address: {address}
- Rating: {rating} ({review_count} reviews)
- Website: {website_url}
- Website Analysis: {features_json}

Based on this information, produce a JSON object with these exact fields:
- opportunity_score: number 0-100 (higher = better sales opportunity)
${reasonCodesGuidance}
- why_good_target: string (1-2 sentences explaining why this business is a good target for YOUR offer)
- likely_pain_points: string[] (list of likely pain points relevant to your offer)
- best_sales_angle: string (the best sales angle for approaching this business, 1 sentence)
${offerLevels}
- personalized_first_message: string (a personalized cold outreach message for WhatsApp/email, friendly and professional, max 3 sentences)
- expected_price_band: string (e.g. "£500-800", "£800-1500", "£1500-3000")${packageFields}

Respond ONLY with valid JSON, no markdown, no explanation.`;
}

export interface AnalysisWorkspaceContext {
  niche?: string | null;
  offerName?: string | null;
  valueProposition?: string | null;
  language?: string | null;
  /**
   * Hybrid-niche child slug (e.g. "fnb-bar-club"). When set, the
   * prompt swaps the generic F&B framing for a sub-niche-specific
   * one that names FineDine modules and pain points relevant to that
   * format. Pass `null` when the lead is unclassified or when the
   * confidence gate (below) wants to fall back to the parent.
   */
  subNicheSlug?: string | null;
  /**
   * Classifier confidence (0..1). Pass 1.0 for MANUAL overrides.
   * The caller is expected to have already applied the hard gate
   * (passing `subNicheSlug = null` when confidence is too low for
   * AUTO source); this field powers a softer in-prompt caveat.
   */
  subNicheConfidence?: number | null;
  /**
   * Workspace-defined ServicePackage tiers (Settings -> Service
   * Packages). Caller pre-loads them with prisma.servicePackage.findMany.
   * When non-empty, the prompt asks Gemini for a `recommended_package_id`
   * pinned to one of these ids. Empty list = falls back to the legacy
   * STARTER/GROWTH/SALES enum recommendation, preserving v1 behaviour
   * for tenants that haven't configured priced tiers yet.
   */
  servicePackages?: AnalysisServicePackage[] | null;
}

/**
 * Grounded review evidence the scorer feeds into Gemini so its
 * `likely_pain_points` and `best_sales_angle` are based on actual
 * customer voice instead of the model fabricating "50 reviews say..."
 * from the rating count alone (the previous failure mode).
 *
 * Supplied by SALES_OPPORTUNITY_SCORER when ReviewAnalysis exists for
 * the lead. Empty arrays / null summary are tolerated upstream and
 * trigger the "no review data" branch in the prompt builder.
 */
export interface ReviewContextForAnalysis {
  summary: string | null;
  painPhrases: string[];
  strengthPhrases: string[];
  reviewsAnalyzedCount: number;
}

function formatReviewContextForAnalysis(rc: ReviewContextForAnalysis | null): string {
  if (!rc || (rc.painPhrases.length === 0 && rc.strengthPhrases.length === 0 && !rc.summary)) {
    return "Review data is not yet available for this lead. Base your analysis on the audit and Place metadata only; do NOT invent quotes or claims attributed to reviewers.";
  }
  const lines: string[] = [];
  lines.push(`Review evidence (REVIEW_ANALYST output, ${rc.reviewsAnalyzedCount} reviews analysed):`);
  if (rc.summary) lines.push(`- Summary: ${rc.summary}`);
  if (rc.painPhrases.length > 0) {
    const sample = rc.painPhrases.slice(0, 6).map((p) => `"${p}"`).join("; ");
    lines.push(`- Pain phrases (negative signal): ${sample}`);
  }
  if (rc.strengthPhrases.length > 0) {
    const sample = rc.strengthPhrases.slice(0, 4).map((p) => `"${p}"`).join("; ");
    lines.push(`- Strength phrases (positive signal): ${sample}`);
  }
  lines.push(
    "Use these phrases verbatim (or close paraphrase) in best_sales_angle and likely_pain_points so the personalised_first_message references real customer language. Do NOT add pain points that aren't supported by the evidence.",
  );
  return lines.join("\n");
}

export async function analyzeLeadWithGemini(
  businessName: string,
  address: string,
  rating: number | null,
  reviewCount: number | null,
  websiteUrl: string | null,
  features: WebsiteFeatures | null,
  /** P2.3 - workspace.language injection. Defaults to 'en'; explicit TR workspaces still get TR output via languagePreamble. */
  language: string | null = "en",
  /** Niche + offer context for targeted analysis. Defaults to WEB_AGENCY behaviour. */
  workspaceCtx: AnalysisWorkspaceContext = {},
  /**
   * Grounded review context (pain + strength phrases) from
   * REVIEW_ANALYST. When present, the prompt instructs Gemini to
   * derive sales angles from these phrases instead of inventing
   * generic complaints. When null/empty, Gemini is told explicitly
   * not to fabricate review-derived claims.
   */
  reviewContext: ReviewContextForAnalysis | null = null,
): Promise<GeminiAnalysis> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  const effectiveLanguage = workspaceCtx.language ?? language;
  const analysisPrompt = buildAnalysisPrompt(
    workspaceCtx.niche ?? null,
    workspaceCtx.offerName ?? null,
    workspaceCtx.valueProposition ?? null,
    workspaceCtx.subNicheSlug ?? null,
    workspaceCtx.subNicheConfidence ?? null,
    workspaceCtx.servicePackages ?? [],
  );

  const reviewBlock = formatReviewContextForAnalysis(reviewContext);

  const prompt = `${languagePreamble(effectiveLanguage)}

${analysisPrompt}

${reviewBlock}`
    .replace("{business_name}", businessName)
    .replace("{address}", address)
    .replace("{rating}", rating?.toString() ?? "N/A")
    .replace("{review_count}", reviewCount?.toString() ?? "0")
    .replace("{website_url}", websiteUrl ?? "NONE - No website found")
    .replace(
      "{features_json}",
      features ? JSON.stringify(features, null, 2) : "No website to analyze"
    );

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.SALES_OPPORTUNITY_SCORER,
    label: "analyze_lead",
  });
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini did not return valid JSON");
  }

  const analysis: GeminiAnalysis = JSON.parse(jsonMatch[0]);

  if (
    typeof analysis.opportunity_score !== "number" ||
    !Array.isArray(analysis.reason_codes)
  ) {
    throw new Error("Gemini returned malformed analysis");
  }

  return analysis;
}

export async function generateWebsitePlan(input: WebsitePlanInput): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 16384,
      temperature: 0.7,
    },
  });

  const reviewsText = input.reviews.length > 0
    ? input.reviews.map((r, i) =>
        `${i + 1}. ${r.authorName} (${r.rating}/5): ${r.text || "No review text"}`
      ).join("\n")
    : "No Google reviews available yet.";

  const websiteAnalysisText = input.features
    ? JSON.stringify(input.features, null, 2)
    : "No existing website, or not yet analysed.";

  const salesAnalysisText = input.salesOpportunity
    ? `- Opportunity score: ${input.salesOpportunity.opportunityScore}/100
- Reason codes: ${(input.salesOpportunity.reasonCodes as string[]).join(", ")}
- Why good target: ${input.salesOpportunity.whyGoodTarget || "N/A"}
- Likely pain points: ${(input.salesOpportunity.likelyPainPoints as string[]).join(", ")}
- Suggested package: ${input.salesOpportunity.suggestedOffer}
- Best sales angle: ${input.salesOpportunity.bestSalesAngle || "N/A"}`
    : "No sales opportunity analysis yet.";

  const auditChecklistText = input.auditChecklist
    ? formatChecklistForPrompt(input.auditChecklist)
    : "No automated audit yet - either no existing website or not yet crawled.";

  const reviewIntelligenceText = input.reviewIntelligence
    ? formatReviewIntelligenceForPrompt(input.reviewIntelligence)
    : "No Review Intelligence analysis yet - falling back to generic prompt.";

  const offerText = input.offer
    ? formatOfferForPrompt(input.offer)
    : "Workspace 'My Offer' context not defined - falling back to a generic offer.";

  const prompt = WEBSITE_PLAN_TEMPLATE
    .replace("{system_context}", WEBSITE_PLAN_SYSTEM_CONTEXT)
    .replace("{business_name}", input.businessName)
    .replace("{business_name}", input.businessName)
    .replace("{address}", input.address)
    .replace("{phone}", input.phone || "Not specified")
    .replace("{rating}", input.rating?.toString() ?? "N/A")
    .replace("{review_count}", input.reviewCount?.toString() ?? "0")
    .replace("{website_url}", input.websiteUrl ?? "No existing website")
    .replace("{audit_checklist}", auditChecklistText)
    .replace("{website_analysis}", websiteAnalysisText)
    .replace("{sales_analysis}", salesAnalysisText)
    .replace("{reviews}", reviewsText)
    .replace("{review_intelligence}", reviewIntelligenceText)
    .replace("{my_offer}", offerText);

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.WEBSITE_PLAN_GENERATOR,
    label: "website_plan",
  });
  const text = result.response.text();

  return text.replace(/^```markdown\n?/i, "").replace(/\n?```$/i, "").trim();
}

/**
 * P0.1 - Review Intelligence v1.
 * Aggregates up to 50 raw GoogleReview rows into a structured KPI bar
 * analysis (Mapileads-style). Returns weakness/strength bars, sentiment,
 * pain phrases, switch signals, and a 0-100 lead score.
 */
export async function analyzeReviewsWithGemini(input: {
  businessName: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  reviews: { authorName: string; rating: number; text: string | null; relativeTime: string }[];
  ourOffer: string | null;
}): Promise<ReviewAnalysisOutput> {
  if (input.reviews.length === 0) {
    throw new Error("Cannot analyze reviews: no reviews provided");
  }

  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      // gemini-2.5-flash spends a chunk of its output budget on internal
      // "thinking" tokens that the legacy @google/generative-ai SDK
      // (v0.24.x) cannot disable via thinkingConfig. We need ~3-4k
      // tokens of actual JSON; 16k leaves enough headroom for the
      // model's reasoning pass on top of that.
      maxOutputTokens: 16384,
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          reviewsAnalyzedCount: { type: SchemaType.NUMBER },
          weaknessKpis: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING },
                percent: { type: SchemaType.NUMBER },
                examples: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ["label", "percent", "examples"],
            },
          },
          strengthKpis: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING },
                percent: { type: SchemaType.NUMBER },
                examples: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ["label", "percent", "examples"],
            },
          },
          sentimentBreakdown: {
            type: SchemaType.OBJECT,
            properties: {
              positive: { type: SchemaType.NUMBER },
              neutral: { type: SchemaType.NUMBER },
              negative: { type: SchemaType.NUMBER },
            },
            required: ["positive", "neutral", "negative"],
          },
          painPhrases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          strengthPhrases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          switchSignals: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                from: { type: SchemaType.STRING },
                to: { type: SchemaType.STRING },
                reason: { type: SchemaType.STRING },
              },
              required: ["from", "to", "reason"],
            },
          },
          leadScore: { type: SchemaType.NUMBER },
          summary: { type: SchemaType.STRING },
        },
        required: [
          "reviewsAnalyzedCount",
          "weaknessKpis",
          "strengthKpis",
          "sentimentBreakdown",
          "painPhrases",
          "strengthPhrases",
          "switchSignals",
          "leadScore",
          "summary",
        ],
      },
    },
  });

  const reviewsText = input.reviews
    .slice(0, 50)
    .map(
      (r, i) =>
        `${i + 1}. ${r.authorName} (${r.rating}/5, ${r.relativeTime}): ${r.text || "[No review text, star rating only]"}`,
    )
    .join("\n");

  const prompt = REVIEW_ANALYSIS_PROMPT_TEMPLATE
    .replace("{business_name}", input.businessName)
    .replace("{address}", input.address)
    .replace("{rating}", input.rating?.toString() ?? "N/A")
    .replace("{review_count}", input.reviewCount?.toString() ?? input.reviews.length.toString())
    .replace("{reviews_count}", input.reviews.length.toString())
    .replace("{our_offer}", input.ourOffer || "Our offer: AI-assisted appointment-setting SaaS for local service businesses.")
    .replace("{reviews}", reviewsText);

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.REVIEW_ANALYST,
    label: "review_analyst",
  });
  const finishReason = result.response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    logger.warn("review_analyst.gemini_finish_reason", { finishReason });
  }
  const text = result.response.text();

  const parsed = safeParseGeminiJson<ReviewAnalysisOutput>(text, "review_analyst");

  if (typeof parsed.leadScore !== "number" || !Array.isArray(parsed.weaknessKpis)) {
    throw new Error("Gemini returned malformed review analysis");
  }

  parsed.weaknessKpis = (parsed.weaknessKpis || []).slice(0, 5);
  parsed.strengthKpis = (parsed.strengthKpis || []).slice(0, 5);
  parsed.painPhrases = (parsed.painPhrases || []).slice(0, 5);
  parsed.strengthPhrases = (parsed.strengthPhrases || []).slice(0, 5);
  parsed.switchSignals = (parsed.switchSignals || []).slice(0, 3);
  parsed.leadScore = Math.max(0, Math.min(100, Math.round(parsed.leadScore)));

  return parsed;
}

function formatReviewIntelligenceForPrompt(ri: ReviewIntelligenceContext): string {
  const lines: string[] = [];
  lines.push(`Lead score: ${ri.leadScore}/100`);
  if (ri.summary) lines.push(`Summary: ${ri.summary}`);
  lines.push(
    `Sentiment: positive ${Math.round(ri.sentimentBreakdown.positive * 100)}%, neutral ${Math.round(ri.sentimentBreakdown.neutral * 100)}%, negative ${Math.round(ri.sentimentBreakdown.negative * 100)}%`,
  );
  if (ri.weaknessKpis.length > 0) {
    lines.push("\nTop customer complaints (the mockup must address these):");
    ri.weaknessKpis.forEach((k) => {
      lines.push(`  - ${k.label} (${k.percent}%): ${(k.examples || []).slice(0, 2).join(" | ")}`);
    });
  }
  if (ri.strengthKpis.length > 0) {
    lines.push("\nTop customer praises (the mockup should highlight these):");
    ri.strengthKpis.forEach((k) => {
      lines.push(`  - ${k.label} (${k.percent}%): ${(k.examples || []).slice(0, 2).join(" | ")}`);
    });
  }
  if (ri.switchSignals.length > 0) {
    lines.push("\nCompetitor switch signals (worth highlighting in the mockup):");
    ri.switchSignals.forEach((s) => {
      lines.push(`  - ${s.from} -> ${s.to}: ${s.reason}`);
    });
  }
  return lines.join("\n");
}

/**
 * Lead Dossier - synthesises every collected signal about a lead
 * (website audit, sales opportunity, review analysis, voice notes,
 * every SUCCEEDED AgentRun output and semantic memory rows) into a
 * human-readable Turkish markdown brief.
 *
 * Not a registered agent-worker: the request is fire-and-forget,
 * uncached, and triggered from the lead detail hero band on demand.
 * No BullMQ, no quota, no memory writes. See plan doc for rationale.
 */
export interface LeadDossierPayload {
  lead: Record<string, unknown>;
  websiteAudit: Record<string, unknown> | null;
  salesOpportunity: Record<string, unknown> | null;
  reviewAnalysis: Record<string, unknown> | null;
  googleReviews: Array<Record<string, unknown>>;
  voiceNotes: Array<Record<string, unknown>>;
  agentRuns: Array<{
    workerKind: string;
    status: string;
    finishedAt: string | null;
    inputs: unknown;
    output: unknown;
    artifactUrl: string | null;
  }>;
  semanticMemory: Array<{
    kind: string;
    refType: string | null;
    refId: string | null;
    text: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

export async function generateLeadDossier(
  payload: LeadDossierPayload,
  // language kept in the signature for future i18n; output is always
  // English regardless of workspace language per product requirement.
  _language: string | null = "en",
): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.4,
    },
  });

  const prompt = `You are a senior B2B sales / research analyst working for a web design agency that sells websites and lead-gen add-ons to local service businesses. Below is ALL the raw intelligence different AI agents have collected about ONE business (a lead), provided as JSON: business metadata, website audit, sales-opportunity scoring, review analysis, raw Google reviews, voice notes, successful agent-run outputs (Apify social scrapers, SERP rank, competitor ads, Facebook/Instagram/TikTok/LinkedIn/Reddit, website mockup, opener writer, video script, etc.) and semantic memory rows.

Task: Synthesise this raw data into a clean "Lead Dossier" that a salesperson seeing this lead for the first time can read in under 2 minutes and act on. You own the scoring and the package selection: do not defer to the sales_opportunity row — form your own judgement from the full evidence set. Write in English.

Required sections (use Markdown ## headings, keep the exact order):
1. Lead Score — a single integer 0-100 (higher = better target) on its own line prefixed with "Score: ", then a short label ("High", "Medium" or "Low" potential), then 1-2 sentences justifying the score from the evidence. Re-compute from scratch; if the JSON contains an existing salesOpportunity.opportunityScore note it only as a cross-check.
2. Recommended Package — choose exactly one of "Starter", "Growth" or "Sales":
     - Starter: basic mobile-friendly marketing site, minimal forms, for leads with no site or a placeholder.
     - Growth: site + online booking + WhatsApp + local SEO, for leads with a basic site or missing conversion paths.
     - Sales: Growth + inventory/showcase + review embedding + lead-capture automation, for leads already generating demand that leaks.
   Also quote a price band in GBP (e.g. £600–£900, £1.2k–£2k, £2.5k–£4k) and justify the fit in 1-2 sentences referencing concrete audit / review findings.
3. Business Overview — what they do, where, size signals.
4. Web Presence — website audit findings, performance/security/mobile summary, technical weaknesses.
5. Social & SERP Signals — posts, trends, competitors, ads, Reddit mentions from the social agents; if none, write "no data".
6. Customer Feedback — star average, review volume, review_analyst KPIs (weaknesses/strengths), common complaints, common praise, any switch signals.
7. Weak Points — concrete pains at the intersection of website + reviews + SERP (bullet list).
8. Sales Angles — 2-3 short angles, each grounded in the data.
9. Risk / Notes — red flags from sales_opportunity reasonCodes and negative review signals.
10. Recommended First Action — one sentence: how to open the first message or call with this lead.

Rules:
- Cite the source for every meaningful claim in square brackets, e.g. "[review_analyst]", "[APIFY_FACEBOOK_DEEP]", "[website_audit]", "[semantic_memory:SOCIAL_POST]".
- If a section has no data, write "no data" there. Do not fabricate or hallucinate.
- Numbers and strings may be quoted verbatim from the JSON; for prose use an analytical, non-marketing tone.
- Do not use emojis. Avoid promotional vocabulary (game-changer, unlock, elevate, seamless, etc.).
- Long reviews, social posts or memory texts should be summarised in 1-2 sentences, not pasted in full.
- Maximum 850 words.

Raw JSON (LEAD_DOSSIER_INPUT):
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

Return Markdown only. No code fences, no preamble, no commentary.`;

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.LEAD_DOSSIER,
    label: "lead_dossier",
  });
  const text = result.response.text();
  return text
    .replace(/^\s*```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function formatOfferForPrompt(o: WorkspaceOfferContext): string {
  const lines: string[] = [];
  if (o.offerName) lines.push(`Offer name: ${o.offerName}`);
  if (o.valueProposition) lines.push(`Value proposition: ${o.valueProposition}`);
  if (o.offerHook) lines.push(`Message hook: ${o.offerHook}`);
  if (o.socialProof) lines.push(`Social proof: ${o.socialProof}`);
  if (o.objective) lines.push(`Message objective: ${o.objective}`);
  if (o.tone) lines.push(`Tone: ${o.tone}`);
  if (o.length) lines.push(`Length: ${o.length}`);
  if (o.language) lines.push(`Language: ${o.language}`);
  if (o.senderName) lines.push(`Sender name: ${o.senderName}`);
  if (o.conversionLink) lines.push(`Conversion link: ${o.conversionLink}`);
  return lines.length > 0 ? lines.join("\n") : "Workspace 'My Offer' is empty.";
}
