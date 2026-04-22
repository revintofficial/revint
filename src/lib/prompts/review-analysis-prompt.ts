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

export const REVIEW_ANALYSIS_SYSTEM_CONTEXT = `You are a professional Customer Insight analyst. You read Google Maps reviews of local service businesses and produce an actionable KPI-bar summary that a sales team can act on in seconds.

Working principles:
- Always ground every finding in the raw reviews. Never invent anything.
- Cluster repeated complaints into short labels (e.g. "wait time", "rude staff", "expensive").
- Cluster repeated praise into short labels (e.g. "fast service", "friendly staff", "good prices").
- In positive reviews, look for SWITCH SIGNALS — patterns like "we used X for years but then moved to Y/Z". Those mark customers who have defected from a competitor.
- leadScore = how hot this business is as a sales prospect (higher = our offer clearly solves their pain).
- Do not inflate percentages. If something appears in 30% of negative reviews, write 30, not 100.
- Follow the language instruction at the top of the prompt. Default output language is English.`;

export const REVIEW_ANALYSIS_PROMPT_TEMPLATE = `${REVIEW_ANALYSIS_SYSTEM_CONTEXT}

---

Business: {business_name}
Address: {address}
Overall rating: {rating}/5 ({review_count} reviews)
Our product/offer: {our_offer}

Below are the {reviews_count} most recent Google Maps reviews. Analyse them.

---
{reviews}
---

Return ONLY valid JSON. No markdown fences, no commentary, just JSON.

Schema:
{
  "reviewsAnalyzedCount": <integer, how many reviews you actually analysed>,
  "weaknessKpis": [
    { "label": "<2-4 word complaint label>", "percent": <0-100 share of negative reviews>, "examples": ["<verbatim quote 1>", "<verbatim quote 2>"] }
  ],
  "strengthKpis": [
    { "label": "<2-4 word praise label>", "percent": <0-100 share of positive reviews>, "examples": ["<verbatim quote 1>", "<verbatim quote 2>"] }
  ],
  "sentimentBreakdown": { "positive": <0-1>, "neutral": <0-1>, "negative": <0-1> },
  "painPhrases": ["<3-5 short pain phrases, in the customer's own voice>"],
  "strengthPhrases": ["<3-5 short praise phrases>"],
  "switchSignals": [
    { "from": "<previous competitor / solution>", "to": "<this business>", "reason": "<why they switched>" }
  ],
  "leadScore": <0-100, how hot this business is as a prospect for our offer>,
  "summary": "<1-2 sentences, a quick brief for the sales team>"
}

Rules:
- weaknessKpis: max 5 items, most frequent first.
- strengthKpis: max 5 items, most frequent first.
- examples must be real verbatim quotes, each under 80 characters.
- sentimentBreakdown values must sum to ~1.0 (minor rounding is fine).
- switchSignals may be an empty array — do not force a pattern that is not there.
- leadScore: if "{our_offer}" can plausibly address the complaints we see, score higher.
- summary stays in the output language specified at the top of the prompt.`;

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
