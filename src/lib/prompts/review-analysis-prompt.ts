/**
 * P0.1 - Review Intelligence v1 prompt.
 *
 * Reads up to 50 GoogleReview rows for a single business and returns a
 * structured JSON aggregation with KPI bars (weakness % / strength %),
 * sentiment breakdown, top pain phrases, top strength phrases, switch
 * signals (positive reviews mentioning prior tools they abandoned), and a
 * 0-100 lead score.
 *
 * Beta finding §3 — for F&B workspaces (RESTAURANT_TECH today) the prompt
 * appends a hard label whitelist so Gemini cannot invent labels that fuse
 * unrelated complaints (e.g. Coffee & Beyond's "Restrictive Policies"
 * collapsing "no laptops past 2pm" with "WiFi only with purchase" into
 * one bar). The whitelist is also enforced at the responseSchema level
 * via `enum:` in `gemini.ts`, so an off-vocabulary emission is rejected
 * by the API itself, not just discouraged in the instructions.
 *
 * Mapped to Mapileads' "Review Intelligence" feature - the differentiator
 * commenters called out repeatedly in the Reddit thread (REDDIT-MAPILEADS.md).
 *
 * Output shape (REVIEW_ANALYSIS_RESPONSE_SCHEMA):
 *   {
 *     reviewsAnalyzedCount: number,
 *     weaknessKpis: [{ label, count, percent, examples }],
 *     strengthKpis: [{ label, count, percent, examples }],
 *     sentimentBreakdown: { positive, neutral, negative },
 *     painPhrases: string[],         // 3-5 short pain phrases
 *     strengthPhrases: string[],     // 3-5 short strength phrases
 *     switchSignals: [{ from, to, reason }],
 *     leadScore: number,             // 0-100
 *     summary: string                // 1-2 sentence narrative
 *   }
 *
 * Beta finding §2/§3:
 *   - `count` is the integer number of distinct reviews mentioning the
 *     KPI. We need this in the UI so a user can see "3 of 50 reviews"
 *     instead of just "50%". Without count, a single reviewer
 *     complaining about "rude staff" in a 10-review sample appears as
 *     "Rude Staff 30%" which is statistically meaningless.
 *   - The prompt also enforces a min-example threshold: KPI must have
 *     ≥2 verbatim examples and count ≥2 to make the cut. Single-review
 *     KPIs are dropped before the model returns.
 *   - `percent = round(count / pool * 100)` where pool is the negative
 *     pool for weakness, positive pool for strength. The post-process
 *     filter in `review-analyst.ts` re-derives this once it knows the
 *     true pool size, so a Gemini hallucinated percent is overwritten.
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

/**
 * Builds the review-analysis prompt body. When a label whitelist is
 * supplied (F&B workspaces today, see `fnb-review-labels.ts`), the
 * prompt appends a hard "labels MUST be exactly one of:" block so
 * Gemini's clustering converges on the canonical names. The same
 * whitelist is also injected as `enum: [...]` on the responseSchema in
 * `gemini.ts`, so the API itself rejects off-vocabulary emissions —
 * the prompt-level instruction exists so the model picks the right
 * label rather than failing closed (no KPI emitted at all).
 *
 * Pass `null` for `labelEnum` when the workspace is not F&B; the
 * legacy free-form clustering applies in that case.
 */
export function buildReviewAnalysisPrompt(opts: {
  labelEnum: { weakness: readonly string[]; strength: readonly string[] } | null;
}): string {
  const labelBlock = opts.labelEnum
    ? `

LABEL WHITELIST (HARD CONSTRAINT — F&B vertical):
- weaknessKpis.label MUST be EXACTLY one of these (verbatim, case-sensitive):
${opts.labelEnum.weakness.map((l) => `  - "${l}"`).join("\n")}
- strengthKpis.label MUST be EXACTLY one of these (verbatim, case-sensitive):
${opts.labelEnum.strength.map((l) => `  - "${l}"`).join("\n")}
- If a complaint or praise does NOT fit any whitelisted label exactly, OMIT the KPI entirely. Do NOT cluster two unrelated complaints into the closest-fitting label (e.g. "no laptops past 2pm" and "WiFi only with purchase" are TWO different labels: "Time Limits" and "WiFi Restrictions" — never merge them into a single "Restrictive Policies" bar).
- The label is the cluster identity. If you can't find ≥2 reviews that fit ONE specific whitelisted label, you have no KPI for that complaint — the post-process filter will drop it anyway.`
    : "";

  return `${REVIEW_ANALYSIS_SYSTEM_CONTEXT}

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
    { "label": "<2-4 word complaint label>", "count": <integer, how many DISTINCT reviews mention this>, "percent": <0-100 share of negative reviews>, "examples": ["<verbatim quote 1>", "<verbatim quote 2>"] }
  ],
  "strengthKpis": [
    { "label": "<2-4 word praise label>", "count": <integer, how many DISTINCT reviews mention this>, "percent": <0-100 share of positive reviews>, "examples": ["<verbatim quote 1>", "<verbatim quote 2>"] }
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
- For each KPI, set "count" = the integer number of DISTINCT reviews that mention it. Two complaints from the same reviewer count as 1.
- DROP any KPI whose count < 2. A label needs ≥2 supporting reviews; a single complaint is anecdote, not a pattern.
- "examples" array MUST contain ≥2 verbatim quotes from DIFFERENT reviews. If you can only find 1 supporting quote, DROP the KPI entirely.
- When reviewsAnalyzedCount < 10, return AT MOST 2 weaknessKpis and AT MOST 3 strengthKpis. Small samples cannot support more than that without overfitting.
- "percent" = (count / negativeReviewCount * 100) for weaknessKpis, (count / positiveReviewCount * 100) for strengthKpis. Round to integer 0-100.
- weaknessKpis: max 5 items overall, most frequent first. Apply the small-sample cap above.
- strengthKpis: max 5 items overall, most frequent first. Apply the small-sample cap above.
- examples must be real verbatim quotes from the supplied reviews, each under 80 characters. Do NOT paraphrase or invent.
- sentimentBreakdown values must sum to ~1.0 (minor rounding is fine).
- switchSignals may be an empty array — do not force a pattern that is not there.
- leadScore: if "{our_offer}" can plausibly address the complaints we see, score higher.
- summary stays in the output language specified at the top of the prompt.${labelBlock}`;
}

/**
 * Legacy default template for callers that don't pass a label enum.
 * New callers should call `buildReviewAnalysisPrompt({ labelEnum })`
 * directly so the F&B whitelist is applied when applicable.
 */
export const REVIEW_ANALYSIS_PROMPT_TEMPLATE = buildReviewAnalysisPrompt({
  labelEnum: null,
});

/**
 * Declared as a `type` (not `interface`) so it satisfies Prisma's
 * `InputJsonValue` index-signature constraint on the
 * `prisma.reviewAnalysis.upsert({ data: { weaknessKpis, … } })` call —
 * interfaces with named members aren't assignable to
 * `{ [k: string]: InputJsonValue }` by default in strict mode.
 */
export type ReviewKpi = {
  label: string;
  /**
   * Number of distinct reviews that mention this KPI. Beta finding §2:
   * required so the UI can render "3 of 50 reviews" instead of just
   * "X%", which is misleading on small samples. Always ≥2 after the
   * post-process filter in `review-analyst.ts`.
   */
  count: number;
  /**
   * Share of the negative pool (weakness) or positive pool (strength)
   * mentioning this KPI, rounded to an integer 0-100. Re-derived from
   * `count` and the actual pool size during post-processing so a model
   * hallucination cannot leak through.
   */
  percent: number;
  /**
   * ≥2 verbatim quotes from DIFFERENT reviews. Single-example KPIs
   * are dropped at post-process time; the UI is allowed to show only
   * `examples.slice(0, 3)` even though more may be present.
   */
  examples: string[];
};

export interface ReviewAnalysisOutput {
  reviewsAnalyzedCount: number;
  weaknessKpis: ReviewKpi[];
  strengthKpis: ReviewKpi[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  painPhrases: string[];
  strengthPhrases: string[];
  switchSignals: Array<{ from: string; to: string; reason: string }>;
  leadScore: number;
  summary: string;
}
