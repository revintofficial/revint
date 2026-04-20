/**
 * Website Mockup Generator - Gemini JSON-mode prompt.
 *
 * Produces structured landing-page content for a single lead. The
 * response schema is strict (see WEBSITE_MOCKUP_SCHEMA below) so the
 * renderer in `src/lib/mockups/renderers/leadac-hero.ts` can map
 * fields to HTML without any Gemini free-text inference.
 *
 * Guardrails:
 *   - All business identity fields (name, phone, address) are
 *     injected by the server BEFORE rendering; the model cannot
 *     change them.
 *   - The model is explicitly told not to invent service hours,
 *     prices, or claims not grounded in the lead input.
 *   - Language is workspace-scoped (`tr` or `en`); the model replies
 *     in the same language the business's customers would read.
 */

export interface WebsiteMockupHero {
  headline: string;
  subline: string;
  cta_primary_text: string;
  trust_line: string | null;
}

export interface WebsiteMockupService {
  title: string;
  body: string;
  icon_hint: string;
}

export interface WebsiteMockupTestimonial {
  body: string;
  attribution: string;
  rating: number;
}

export interface WebsiteMockupTheme {
  mode: "dark" | "light";
  accent_hex: string;
  primary_hex: string;
}

export interface WebsiteMockupSections {
  hero: WebsiteMockupHero;
  services: WebsiteMockupService[];
  testimonial: WebsiteMockupTestimonial | null;
  about: { paragraph: string };
  cta_final: {
    headline: string;
    button_text: string;
  };
  theme: WebsiteMockupTheme;
  section_order: string[];
}

export interface WebsiteMockupPromptInput {
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  primaryType: string | null;
  servicesDetected: string[];
  topReviews: { authorName: string; rating: number; text: string | null }[];
  painPhrases: string[];
  strengthPhrases: string[];
  workspaceOfferName: string | null;
  workspaceValueProposition: string | null;
  language: string; // "tr" | "en"
}

export const WEBSITE_MOCKUP_SYSTEM_CONTEXT = `You are a senior web designer and copywriter building a single-page landing website for a local service business. Your output must be:

1. High-conversion: every section exists to push the visitor toward calling, booking, or requesting a quote.
2. Grounded: use ONLY the facts provided about this business. Do not invent hours, prices, staff count, certifications, or years in business. If a detail is not supplied, keep the copy general.
3. Audience-aware: the reader is a local homeowner or small business owner looking for this service NOW. Copy should feel local, trustworthy, and urgent without being pushy.
4. Design-system-aligned: use Leadac's landing-page aesthetic - dark background, glass panels, single accent gradient, one clear primary CTA. Theme colors should harmonize with the business vertical (plumbing = blue, HVAC = teal, dental = light blue/mint, food = warm amber).

Respond ONLY with valid JSON matching the schema exactly. No markdown, no preface, no trailing prose.`;

export const WEBSITE_MOCKUP_SCHEMA_DESCRIPTION = `Response schema (all fields required unless marked optional):
{
  "hero": {
    "headline": string,              // 5-9 words, active voice, benefit-first
    "subline": string,               // 10-20 words, concrete proof or differentiator
    "cta_primary_text": string,      // 2-4 words, action verb (e.g. "Book now", "Get a quote")
    "trust_line": string | null      // one short line like "4.8★ on Google · 127 reviews"
  },
  "services": [                      // 3 to 6 services
    {
      "title": string,               // 2-5 words
      "body": string,                // 1-2 sentences
      "icon_hint": string            // one word for icon choice: "wrench" "phone" "shield" "clock" "bolt" "leaf" "home" "star" "heart" "tooth"
    }
  ],
  "testimonial": {                   // null if no usable reviews provided
    "body": string,                  // 1-3 sentences, paraphrase one strong review
    "attribution": string,           // first name + initial, e.g. "Sarah M."
    "rating": 4 | 5
  } | null,
  "about": {
    "paragraph": string              // 2-4 sentences, no invented dates or team size
  },
  "cta_final": {
    "headline": string,              // 3-6 words urging action
    "button_text": string            // 2-4 words
  },
  "theme": {
    "mode": "dark" | "light",        // default "dark" for most service businesses
    "accent_hex": "#RRGGBB",         // secondary accent
    "primary_hex": "#RRGGBB"         // primary CTA color
  },
  "section_order": ["hero", "services", "social_proof", "about", "contact"]
}`;

export function buildWebsiteMockupPrompt(input: WebsiteMockupPromptInput): string {
  const langTag = input.language === "tr" ? "Turkish (tr)" : "English (en)";
  const reviewsBlock = input.topReviews.length
    ? input.topReviews
        .slice(0, 3)
        .map(
          (r, i) =>
            `${i + 1}. ${r.authorName} (${r.rating}/5): ${r.text ?? "[no text]"}`,
        )
        .join("\n")
    : "(no reviews provided)";

  const painsBlock = input.painPhrases.length
    ? input.painPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n")
    : "(none identified)";
  const strengthsBlock = input.strengthPhrases.length
    ? input.strengthPhrases.slice(0, 5).map((s) => `- ${s}`).join("\n")
    : "(none identified)";

  const servicesBlock = input.servicesDetected.length
    ? input.servicesDetected.join(", ")
    : "(not detected - infer 3-5 plausible services for this business type)";

  return `${WEBSITE_MOCKUP_SYSTEM_CONTEXT}

${WEBSITE_MOCKUP_SCHEMA_DESCRIPTION}

LANGUAGE FOR ALL COPY: ${langTag}. Every headline, body line, and CTA must be in this language.

BUSINESS CONTEXT:
- Name: ${input.businessName}
- Type: ${input.primaryType ?? "(not specified)"}
- Address: ${input.formattedAddress}
- Neighborhood: ${input.borough ?? "(not specified)"}
- Phone: ${input.phone ?? "(not available)"}
- Current website: ${input.websiteUrl ?? "(none)"}
- Google rating: ${input.rating ?? "(no rating)"} (${input.reviewCount ?? 0} reviews)
- Services detected: ${servicesBlock}

REVIEW SIGNAL:
Top reviews:
${reviewsBlock}

Top customer pains (address these in your copy or counter them):
${painsBlock}

Top customer strengths (lean into these):
${strengthsBlock}

AGENCY OFFER CONTEXT (the agency selling this site):
- Offer name: ${input.workspaceOfferName ?? "(generic)"}
- Value proposition: ${input.workspaceValueProposition ?? "(generic)"}

INSTRUCTIONS:
1. Write a hero headline that promises the single most valuable outcome for THIS business's customers, grounded in the pain/strength signals.
2. Services section: 3-6 services, prefer the ones actually detected. If none detected, infer from the primary_type.
3. Testimonial: paraphrase the strongest review into a single-voice quote. If no review text exists, return null.
4. About: 2-4 sentences. DO NOT invent years in business, number of employees, or awards. Speak to their neighborhood and the trust signals you have.
5. Theme: pick a color scheme that fits the business vertical. Default mode is "dark".
6. Respond with ONLY the JSON object. No prose before or after.`;
}
