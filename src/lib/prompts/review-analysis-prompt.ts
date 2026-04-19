/**
 * P0.1 - Review Intelligence v1 prompt.
 *
 * Reads up to 50 GoogleReview rows for a single business and returns a
 * structured JSON aggregation with KPI bars (weakness % / strength %),
 * sentiment breakdown, top pain phrases, top strength phrases, switch
 * signals (positive reviews mentioning prior tools they abandoned), and a
 * 0-100 lead score.
 *
 * Mapped to Mapileads' "Review Intelligence" feature - the differentiator
 * commenters called out repeatedly in the Reddit thread (REDDIT-MAPILEADS.md).
 *
 * Output shape (REVIEW_ANALYSIS_RESPONSE_SCHEMA):
 *   {
 *     reviewsAnalyzedCount: number,
 *     weaknessKpis: [{ label: string, percent: number, examples: string[] }],
 *     strengthKpis: [{ label: string, percent: number, examples: string[] }],
 *     sentimentBreakdown: { positive: number, neutral: number, negative: number },
 *     painPhrases: string[],         // 3-5 short pain phrases
 *     strengthPhrases: string[],     // 3-5 short strength phrases
 *     switchSignals: [{ from: string, to: string, reason: string }],
 *     leadScore: number,             // 0-100
 *     summary: string                // 1-2 sentence narrative
 *   }
 *
 * The percent fields are share-of-reviews (0-100), not absolute counts.
 * "wait time 90%" means 90% of negative reviews mention wait time.
 */

export const REVIEW_ANALYSIS_SYSTEM_CONTEXT = `Sen profesyonel bir Customer Insight analistisin. Yerel hizmet işletmelerinin Google Maps yorumlarını okuyup, satış ekibi için hızlıca aksiyona dönüştürülebilir KPI bar formatında özet çıkarıyorsun.

Çalışma prensipleri:
- Her zaman ham yorumlardan kanıt göster, hayal etme
- Tekrarlayan şikayetleri grupla (örn: "wait time", "rude staff", "expensive")
- Tekrarlayan övgüleri grupla (örn: "fast service", "friendly staff", "good prices")
- Pozitif yorumlardan SWITCH SIGNAL ara: "X yıllarca kullandık ama Y, Z'ye geçtik" pattern'i. Bu rakipten kaçan müşteri sinyalidir
- Lead score = bu işletmenin satış için sıcaklığı (yüksek skor = bizim çözümümüz onların problemini çözer)
- Asla %100 vermek için sayıyı şişirme, %30 ise %30 yaz
- Türkçe konuşan işletme yorumları için Türkçe çıktı, İngilizce için İngilizce`;

export const REVIEW_ANALYSIS_PROMPT_TEMPLATE = `${REVIEW_ANALYSIS_SYSTEM_CONTEXT}

---

İşletme: {business_name}
Adres: {address}
Genel Puan: {rating}/5 ({review_count} yorum)
Bizim ürünümüz: {our_offer}

Aşağıda en güncel {reviews_count} Google Maps yorumu var. Bunları analiz et.

---
{reviews}
---

Çıktıyı SADECE GEÇERLİ JSON formatında ver. Markdown blokları yok, açıklama yok, sadece JSON.

Şema:
{
  "reviewsAnalyzedCount": <integer, kaç yorum analiz ettin>,
  "weaknessKpis": [
    { "label": "<2-4 kelime şikayet etiketi>", "percent": <0-100 negatif yorumlardaki payı>, "examples": ["<gerçek alıntı 1>", "<gerçek alıntı 2>"] }
  ],
  "strengthKpis": [
    { "label": "<2-4 kelime övgü etiketi>", "percent": <0-100 pozitif yorumlardaki payı>, "examples": ["<gerçek alıntı 1>", "<gerçek alıntı 2>"] }
  ],
  "sentimentBreakdown": { "positive": <0-1>, "neutral": <0-1>, "negative": <0-1> },
  "painPhrases": ["<3-5 kısa pain phrase, müşterinin ağzından>"],
  "strengthPhrases": ["<3-5 kısa övgü phrase>"],
  "switchSignals": [
    { "from": "<önceki rakip / çözüm>", "to": "<bu işletme>", "reason": "<neden değişti>" }
  ],
  "leadScore": <0-100, bu işletme bizim ürünümüz için ne kadar sıcak prospect>,
  "summary": "<1-2 cümle, satış ekibi için hızlı özet>"
}

Kurallar:
- weaknessKpis maksimum 5 madde, en sık tekrarlayanlar önde
- strengthKpis maksimum 5 madde, en sık tekrarlayanlar önde
- examples gerçek yorum alıntısı olmalı, 80 karakteri geçmemeli
- sentimentBreakdown toplamı 1.0 olmalı (yuvarlamada ufak sapma kabul)
- switchSignals boş array olabilir, zorla pattern üretme
- leadScore: bizim "{our_offer}" tarif ettiğimiz çözümün adresleyebileceği sorunlar yüksekse skor yüksek
- summary Türkçe işletme için Türkçe, İngilizce için İngilizce`;

export interface ReviewAnalysisOutput {
  reviewsAnalyzedCount: number;
  weaknessKpis: Array<{ label: string; percent: number; examples: string[] }>;
  strengthKpis: Array<{ label: string; percent: number; examples: string[] }>;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  painPhrases: string[];
  strengthPhrases: string[];
  switchSignals: Array<{ from: string; to: string; reason: string }>;
  leadScore: number;
  summary: string;
}
