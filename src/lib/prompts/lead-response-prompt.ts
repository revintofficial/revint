/**
 * Lead Response Agent prompt.
 *
 * Produces a trigger-tree config that replies to inbound leads
 * (website form / GMB message / SMS) within 60 seconds. The output
 * includes the branch logic + message templates per channel + a
 * followup cadence if the lead goes quiet.
 *
 * The prompt is small on purpose - most of the intelligence comes
 * from the agency's "My Offer" context and the lead's detected
 * pain points.
 */

export interface LeadResponsePromptInput {
  businessName: string;
  primaryType: string | null;
  borough: string | null;
  painPhrases: string[];
  strengthPhrases: string[];
  servicesDetected: string[];
  workspaceOfferName: string | null;
  workspaceValueProposition: string | null;
  workspaceTone: string | null;
  language: string;
}

export const LEAD_RESPONSE_SYSTEM_CONTEXT = `You are designing a lead-response automation that replies to every inbound lead (website form, Facebook message, SMS, GMB message, phone miss) within 60 seconds. The automation runs on GHL / n8n / Make. You output strict JSON defining the branches, templates, and followup cadence. Do not invent a discount, a technician name, or a delivery guarantee that the business has not explicitly stated. Every message should read like a real owner tapped it from their phone, not like a bot.`;

export const LEAD_RESPONSE_SCHEMA = `{
  "trigger_channels": string[],             // e.g. ["website_form", "sms", "gmb_message", "facebook_message"]
  "initial_response": {
    "sms": string,                          // first-touch SMS message, <=160 chars
    "email_subject": string,
    "email_body": string,                   // 3-5 short paragraphs, friendly owner tone
    "chat": string                          // very short chat-first reply
  },
  "qualification_questions": [              // 3-5 questions the agent asks in order
    { "label": string, "question": string, "required": boolean }
  ],
  "branches": [                             // conditional branches
    { "condition": string, "action": string, "template": string }
  ],
  "followup_cadence": [                     // if the lead goes quiet
    { "delay_hours": number, "channel": "sms" | "email" | "chat", "template": string }
  ],
  "handoff_rules": [                        // when to route to a human
    { "trigger": string, "action": string }
  ],
  "tone_spec": {
    "voice_descriptor": string,
    "signature": string                     // single-line signoff
  }
}`;

export function buildLeadResponsePrompt(input: LeadResponsePromptInput): string {
  const lang = input.language === "tr" ? "Turkish (tr)" : "English (en)";
  const pains = input.painPhrases.length ? input.painPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n") : "(none)";
  const strengths = input.strengthPhrases.length ? input.strengthPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n") : "(none)";
  const services = input.servicesDetected.length ? input.servicesDetected.join(", ") : "(infer from business type)";

  return `${LEAD_RESPONSE_SYSTEM_CONTEXT}

Respond ONLY with JSON matching this schema:
${LEAD_RESPONSE_SCHEMA}

LANGUAGE FOR ALL CUSTOMER-FACING MESSAGES (initial_response, qualification_questions, branches.template, followup_cadence.template): ${lang}. Other fields stay in English.

BUSINESS:
- Name: ${input.businessName}
- Type: ${input.primaryType ?? "(not specified)"}
- Area: ${input.borough ?? "(not specified)"}
- Services: ${services}

CUSTOMER PAIN PHRASES (address one of these in the first-touch SMS):
${pains}

STRENGTH PHRASES (reinforce one in the followup):
${strengths}

AGENCY OFFER CONTEXT:
- Offer: ${input.workspaceOfferName ?? "(generic service)"}
- Value prop: ${input.workspaceValueProposition ?? "(generic)"}
- Tone: ${input.workspaceTone ?? "warm, fast, helpful"}

RULES:
1. Initial SMS must be under 160 chars so it fits a single segment.
2. First qualification question must capture the service interest; second captures the address/postcode; third captures preferred contact time.
3. Followup cadence: 2h, 24h, 72h - not more. After 72h the agent stops and hands off.
4. Handoff: any of ("emergency", "no heat", "burst pipe", "urgent", "can't wait") -> route to human immediately.
5. Signature line should include the owner's first name (use {{owner_first_name}} slot - the automation fills it).`;
}
