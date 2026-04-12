import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiAnalysis, WebsiteFeatures, AuditChecklistResult } from "@/types";
import { WEBSITE_PLAN_SYSTEM_CONTEXT, WEBSITE_PLAN_TEMPLATE } from "./prompts/website-plan-prompt";
import { formatChecklistForPrompt } from "./audit-checklist";

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
  features: WebsiteFeatures | null
): Promise<GeminiAnalysis> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = ANALYSIS_PROMPT
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
    .replace("{reviews}", reviewsText);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text.replace(/^```markdown\n?/i, "").replace(/\n?```$/i, "").trim();
}
