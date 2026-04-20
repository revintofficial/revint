/**
 * Review Reply Agent prompt.
 *
 * Produces a reusable pool of Google Business Profile reply templates
 * grouped by star rating (1, 2, 3, 4, 5). Each star band gets 8-12
 * templates with variable slots so the deployed agent (Reploi /
 * UseLocalGuide / Zapier / Make) picks one randomly then substitutes
 * reviewer name + specific phrase.
 */

export interface ReviewReplyPromptInput {
  businessName: string;
  primaryType: string | null;
  borough: string | null;
  rating: number | null;
  reviewCount: number | null;
  painPhrases: string[];
  strengthPhrases: string[];
  sampleReviews: { authorName: string; rating: number; text: string | null }[];
  workspaceTone: string | null;
  language: string;
}

export const REVIEW_REPLY_SYSTEM_CONTEXT = `You are writing Google Business Profile review replies for a local service business. Output is a strict JSON pool of templates. Each template has a "body" field with {{variable}} slots that the automation layer fills. Your job is to write human-sounding, specific, brand-consistent replies that would pass a spot-check from a savvy business owner.`;

export const REVIEW_REPLY_SCHEMA = `{
  "tone_spec": {
    "voice_descriptor": string,         // one-line tone summary
    "dos": string[],                    // max 5
    "donts": string[]                   // max 5
  },
  "variables": string[],                // slots the automation fills, e.g. "reviewer_first_name", "service_type"
  "templates": {
    "five_star": [ { "id": string, "body": string } ],       // 8-12
    "four_star": [ { "id": string, "body": string } ],       // 6-10
    "three_star": [ { "id": string, "body": string } ],      // 4-6 (neutral, invite to call)
    "two_star":  [ { "id": string, "body": string } ],       // 3-5 (apology + ownership + contact)
    "one_star":  [ { "id": string, "body": string } ]        // 3-5 (apology + ownership + contact)
  },
  "approval_rule": {
    "auto_post_ratings": number[],       // e.g. [4, 5]
    "require_human_approval_ratings": number[],  // e.g. [1, 2, 3]
    "reasoning": string                  // one sentence
  },
  "escalation_keywords": string[]        // phrases that MUST route to human regardless of star rating
}`;

export function buildReviewReplyPrompt(input: ReviewReplyPromptInput): string {
  const langTag = input.language === "tr" ? "Turkish (tr)" : "English (en)";
  const sample = input.sampleReviews.length
    ? input.sampleReviews
        .slice(0, 6)
        .map((r, i) => `${i + 1}. ${r.authorName} (${r.rating}/5): ${r.text ?? "[no text]"}`)
        .join("\n")
    : "(no sample reviews available)";
  const pains = input.painPhrases.length ? input.painPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n") : "(none)";
  const strengths = input.strengthPhrases.length ? input.strengthPhrases.slice(0, 5).map((s) => `- ${s}`).join("\n") : "(none)";

  return `${REVIEW_REPLY_SYSTEM_CONTEXT}

Respond ONLY with JSON matching this schema:
${REVIEW_REPLY_SCHEMA}

LANGUAGE FOR EVERY REPLY BODY: ${langTag}. The tone_spec, variables, approval_rule.reasoning, and escalation_keywords stay in English (internal fields).

BUSINESS:
- Name: ${input.businessName}
- Type: ${input.primaryType ?? "(not specified)"}
- Area: ${input.borough ?? "(not specified)"}
- Google: ${input.rating ?? "(no rating)"} (${input.reviewCount ?? 0} reviews)
- Tone: ${input.workspaceTone ?? "warm, professional, owner-signed"}

SAMPLE REVIEWS (to ground the tone):
${sample}

PAIN PHRASES (use these exact words in 1-2 lower-star templates):
${pains}

STRENGTH PHRASES (use these exact words in 2-3 high-star templates):
${strengths}

RULES:
1. Replies must NEVER argue with the customer. For 1-2 star reviews always: acknowledge + apologize + offer to make it right + give a contact channel.
2. Use variable slots for anything that would vary per reviewer: {{reviewer_first_name}}, {{service_type}}, {{specific_phrase}}. Do NOT put the business name into the template (Google already shows it).
3. Templates should vary in structure - no two should start with the same word. Rotate between "Thank you for...", "So glad...", "We truly appreciate...", "Wow, thank you..." etc.
4. For 1-2 star: include owner contact - phone or email - in the template using slot {{owner_contact}}.
5. approval_rule: auto_post_ratings should be [4, 5]; require_human_approval_ratings should be [1, 2, 3].
6. escalation_keywords: include phrases that require ALWAYS human review - "lawsuit", "lawyer", "health inspector", "food poisoning", "injured", "police".`;
}
