import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiAnalysis, WebsiteFeatures, AuditChecklistResult } from "@/types";
import { WEBSITE_PLAN_SYSTEM_CONTEXT, WEBSITE_PLAN_TEMPLATE } from "./prompts/website-plan-prompt";
import { REVIEW_ANALYSIS_PROMPT_TEMPLATE, type ReviewAnalysisOutput } from "./prompts/review-analysis-prompt";
import { formatChecklistForPrompt } from "./audit-checklist";
import { languagePreamble } from "./i18n";

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
  // P0.2 Workspace "My offer" context: mockup CTA + hero offer'a göre şekillenir.
  offer?: WorkspaceOfferContext | null;
}

const ANALYSIS_PROMPT = `You are a lead analyst for a web design agency that sells websites to phone repair shops.
Analyze the following phone repair business and produce a JSON assessment.

Business Information:
- Name: {business_name}
- Address: {address}
- Rating: {rating} ({review_count} reviews)
- Website: {website_url}
- Website Analysis: {features_json}

Based on this information, produce a JSON object with these exact fields:
- opportunity_score: number 0-100 (higher = better sales opportunity)
- reason_codes: string[] (e.g. "no_website", "poor_mobile", "no_booking", "no_whatsapp", "weak_seo", "no_https", "slow_site", "no_ecommerce", "high_rating_weak_site")
- why_good_target: string (1-2 sentences explaining why this business is a good target, in Turkish)
- likely_pain_points: string[] (list of likely pain points, in Turkish)
- best_sales_angle: string (the best sales angle for approaching this business, 1 sentence, in Turkish)
- suggested_offer: "starter" | "growth" | "sales" (starter = basic mobile site, growth = site + booking + whatsapp + local SEO, sales = growth + inventory showcase + review embedding + lead capture)
- personalized_first_message: string (a personalized cold outreach message for WhatsApp/email, in Turkish, friendly and professional, max 3 sentences)
- expected_price_band: string (e.g. "£500-800", "£800-1500", "£1500-3000")

Respond ONLY with valid JSON, no markdown, no explanation.`;

export async function analyzeLeadWithGemini(
  businessName: string,
  address: string,
  rating: number | null,
  reviewCount: number | null,
  websiteUrl: string | null,
  features: WebsiteFeatures | null,
  /** P2.3 - workspace.language injection. Defaults to 'tr' to preserve old behavior. */
  language: string | null = "tr"
): Promise<GeminiAnalysis> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `${languagePreamble(language)}

${ANALYSIS_PROMPT}`
    .replace("{business_name}", businessName)
    .replace("{address}", address)
    .replace("{rating}", rating?.toString() ?? "N/A")
    .replace("{review_count}", reviewCount?.toString() ?? "0")
    .replace("{website_url}", websiteUrl ?? "NONE - No website found")
    .replace(
      "{features_json}",
      features ? JSON.stringify(features, null, 2) : "No website to analyze"
    );

  const result = await model.generateContent(prompt);
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
        `${i + 1}. ${r.authorName} (${r.rating}/5): ${r.text || "Yorum metni yok"}`
      ).join("\n")
    : "Henuz Google yorumu bulunamadi.";

  const websiteAnalysisText = input.features
    ? JSON.stringify(input.features, null, 2)
    : "Mevcut web sitesi yok veya analiz yapilmamis.";

  const salesAnalysisText = input.salesOpportunity
    ? `- Firsat Skoru: ${input.salesOpportunity.opportunityScore}/100
- Neden Kodlari: ${(input.salesOpportunity.reasonCodes as string[]).join(", ")}
- Neden Iyi Hedef: ${input.salesOpportunity.whyGoodTarget || "N/A"}
- Aci Noktalari: ${(input.salesOpportunity.likelyPainPoints as string[]).join(", ")}
- Onerilen Paket: ${input.salesOpportunity.suggestedOffer}
- Satis Acisi: ${input.salesOpportunity.bestSalesAngle || "N/A"}`
    : "Henuz satis firsat analizi yapilmamis.";

  const auditChecklistText = input.auditChecklist
    ? formatChecklistForPrompt(input.auditChecklist)
    : "Otomatik audit yapilmamis - mevcut website yok veya taranmamis.";

  const reviewIntelligenceText = input.reviewIntelligence
    ? formatReviewIntelligenceForPrompt(input.reviewIntelligence)
    : "Henuz Review Intelligence analizi yapilmamis - jenerik prompt kullaniliyor.";

  const offerText = input.offer
    ? formatOfferForPrompt(input.offer)
    : "Workspace 'My Offer' context tanimlanmamis - jenerik teklif kullaniliyor.";

  const prompt = WEBSITE_PLAN_TEMPLATE
    .replace("{system_context}", WEBSITE_PLAN_SYSTEM_CONTEXT)
    .replace("{business_name}", input.businessName)
    .replace("{business_name}", input.businessName)
    .replace("{address}", input.address)
    .replace("{phone}", input.phone || "Belirtilmemis")
    .replace("{rating}", input.rating?.toString() ?? "N/A")
    .replace("{review_count}", input.reviewCount?.toString() ?? "0")
    .replace("{website_url}", input.websiteUrl ?? "Mevcut website yok")
    .replace("{audit_checklist}", auditChecklistText)
    .replace("{website_analysis}", websiteAnalysisText)
    .replace("{sales_analysis}", salesAnalysisText)
    .replace("{reviews}", reviewsText)
    .replace("{review_intelligence}", reviewIntelligenceText)
    .replace("{my_offer}", offerText);

  const result = await model.generateContent(prompt);
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
      maxOutputTokens: 4096,
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const reviewsText = input.reviews
    .slice(0, 50)
    .map(
      (r, i) =>
        `${i + 1}. ${r.authorName} (${r.rating}/5, ${r.relativeTime}): ${r.text || "[Yorum metni yok, sadece yildiz]"}`,
    )
    .join("\n");

  const prompt = REVIEW_ANALYSIS_PROMPT_TEMPLATE
    .replace("{business_name}", input.businessName)
    .replace("{address}", input.address)
    .replace("{rating}", input.rating?.toString() ?? "N/A")
    .replace("{review_count}", input.reviewCount?.toString() ?? input.reviews.length.toString())
    .replace("{reviews_count}", input.reviews.length.toString())
    .replace("{our_offer}", input.ourOffer || "Yerel hizmet işletmelerine modern, mobil-uyumlu, online randevu özellikli web sitesi satıyoruz.")
    .replace("{reviews}", reviewsText);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: ReviewAnalysisOutput;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return valid JSON for review analysis");
    parsed = JSON.parse(match[0]);
  }

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
  lines.push(`Lead Score: ${ri.leadScore}/100`);
  if (ri.summary) lines.push(`Ozet: ${ri.summary}`);
  lines.push(
    `Sentiment: pozitif %${Math.round(ri.sentimentBreakdown.positive * 100)}, notr %${Math.round(ri.sentimentBreakdown.neutral * 100)}, negatif %${Math.round(ri.sentimentBreakdown.negative * 100)}`,
  );
  if (ri.weaknessKpis.length > 0) {
    lines.push("\nMUSTERILERIN EN COK SIKAYET ETTIGI KONULAR (mockup'ta cozulmesi gereken):");
    ri.weaknessKpis.forEach((k) => {
      lines.push(`  - ${k.label} (%${k.percent}): ${(k.examples || []).slice(0, 2).join(" | ")}`);
    });
  }
  if (ri.strengthKpis.length > 0) {
    lines.push("\nMUSTERILERIN EN COK BEGENDIGI KONULAR (mockup'ta one cikarilmasi gereken):");
    ri.strengthKpis.forEach((k) => {
      lines.push(`  - ${k.label} (%${k.percent}): ${(k.examples || []).slice(0, 2).join(" | ")}`);
    });
  }
  if (ri.switchSignals.length > 0) {
    lines.push("\nRAKIPTEN GECIS SINYALLERI (mockup'ta vurgulanabilir):");
    ri.switchSignals.forEach((s) => {
      lines.push(`  - ${s.from} -> ${s.to}: ${s.reason}`);
    });
  }
  return lines.join("\n");
}

function formatOfferForPrompt(o: WorkspaceOfferContext): string {
  const lines: string[] = [];
  if (o.offerName) lines.push(`Teklif Adi: ${o.offerName}`);
  if (o.valueProposition) lines.push(`Deger Onerisi: ${o.valueProposition}`);
  if (o.offerHook) lines.push(`Mesaj Hook: ${o.offerHook}`);
  if (o.socialProof) lines.push(`Sosyal Kanit: ${o.socialProof}`);
  if (o.objective) lines.push(`Mesaj Hedefi: ${o.objective}`);
  if (o.tone) lines.push(`Ton: ${o.tone}`);
  if (o.length) lines.push(`Uzunluk: ${o.length}`);
  if (o.language) lines.push(`Dil: ${o.language}`);
  if (o.senderName) lines.push(`Gonderen Adi: ${o.senderName}`);
  if (o.conversionLink) lines.push(`Donusum Linki: ${o.conversionLink}`);
  return lines.length > 0 ? lines.join("\n") : "Workspace 'My Offer' bos.";
}
