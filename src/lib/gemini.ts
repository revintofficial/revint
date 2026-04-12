import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiAnalysis, WebsiteFeatures } from "@/types";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

interface WebsitePlanInput {
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

const WEBSITE_PLAN_PROMPT = `Sen deneyimli bir web tasarım ajansının stratejistisin. Aşağıda sana bir işletme hakkında tüm bilgiler verilecek: 
işletme bilgileri, Google yorumları, mevcut website analizi ve satış fırsat analizi.

Bu bilgileri kullanarak, bu işletme için yapılabilecek DETAYLI bir web sitesi planı yaz. Plan Markdown formatında olmalı.

## İşletme Bilgileri
- Ad: {business_name}
- Adres: {address}
- Telefon: {phone}
- Puan: {rating} ({review_count} yorum)
- Mevcut Website: {website_url}

## Mevcut Website Analizi
{website_analysis}

## Satış Fırsat Analizi
{sales_analysis}

## Google Yorumları (Müşteri Geri Bildirimleri)
{reviews}

---

Yukarıdaki tüm bilgileri analiz ederek aşağıdaki yapıda DETAYLI bir web sitesi planı oluştur:

# 🌐 {business_name} - Web Sitesi Tasarım Planı

## 📊 İşletme Analizi Özeti
(Yorumlardan ve verilerden çıkarılan işletme profili, güçlü/zayıf yönler)

## 🎯 Hedef Kitle
(Yorumlardan analiz edilen müşteri profili, demografik bilgiler)

## 🏗️ Site Yapısı (Sayfa Haritası)
(Her sayfa için detaylı içerik planı - Ana Sayfa, Hakkımızda, Hizmetler, Galeri, İletişim vb.)

## 🎨 Tasarım Önerileri
(Renk paleti, font önerileri, görsel stil, UX/UI önerileri)

## ✨ Öne Çıkan Özellikler
(Online randevu, WhatsApp entegrasyonu, Google Reviews widget, galeri, fiyat listesi vb.)

## 📱 Mobil Uyumluluk Planı
(Responsive tasarım detayları)

## 🔍 SEO Stratejisi
(Anahtar kelimeler, yerel SEO, Google My Business optimizasyonu)

## 💰 Fiyatlandırma ve Paket Önerisi
(Önerilen paket, fiyat aralığı, dahil olan özellikler)

## 📅 Tahmini Zaman Çizelgesi
(Haftalık iş planı)

## 🚀 Sonraki Adımlar
(Müşteriye önerilen aksiyon planı)

IMPORTANT: Yanıtını SADECE Markdown formatında yaz. Hiçbir ek açıklama veya sarmalayıcı ekleme.
Yorumlardaki müşteri geri bildirimlerini dikkatli analiz et - hangi hizmetlerden memnunlar, nelerden şikayet ediyorlar, bu bilgileri siteye nasıl yansıtılmalı detaylıca yaz.`;

export async function generateWebsitePlan(input: WebsitePlanInput): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  const reviewsText = input.reviews.length > 0
    ? input.reviews.map((r, i) => 
        `${i + 1}. ${r.authorName} (${r.rating}⭐): ${r.text || "Yorum metni yok"}`
      ).join("\n")
    : "Henüz Google yorumu bulunamadı.";

  const websiteAnalysisText = input.features
    ? JSON.stringify(input.features, null, 2)
    : "Mevcut web sitesi yok veya analiz yapılmamış.";

  const salesAnalysisText = input.salesOpportunity
    ? `- Fırsat Skoru: ${input.salesOpportunity.opportunityScore}/100
- Neden Kodları: ${(input.salesOpportunity.reasonCodes as string[]).join(", ")}
- Neden İyi Hedef: ${input.salesOpportunity.whyGoodTarget || "N/A"}
- Acı Noktaları: ${(input.salesOpportunity.likelyPainPoints as string[]).join(", ")}
- Önerilen Paket: ${input.salesOpportunity.suggestedOffer}
- Satış Açısı: ${input.salesOpportunity.bestSalesAngle || "N/A"}`
    : "Henüz satış fırsat analizi yapılmamış.";

  const prompt = WEBSITE_PLAN_PROMPT
    .replace("{business_name}", input.businessName)
    .replace("{business_name}", input.businessName)
    .replace("{address}", input.address)
    .replace("{phone}", input.phone || "Belirtilmemiş")
    .replace("{rating}", input.rating?.toString() ?? "N/A")
    .replace("{review_count}", input.reviewCount?.toString() ?? "0")
    .replace("{website_url}", input.websiteUrl ?? "Mevcut website yok")
    .replace("{website_analysis}", websiteAnalysisText)
    .replace("{sales_analysis}", salesAnalysisText)
    .replace("{reviews}", reviewsText);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text.replace(/^```markdown\n?/i, "").replace(/\n?```$/i, "").trim();
}
