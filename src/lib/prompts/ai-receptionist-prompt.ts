/**
 * AI Receptionist Builder prompt. Produces a voice-agent config that
 * the agency pastes into Synthflow, Retell, Vapi, or GHL. The output
 * is platform-agnostic; a per-platform exporter (see ai-receptionist.ts)
 * serializes it into the shape each vendor expects.
 */

export interface ReceptionistPromptInput {
  businessName: string;
  primaryType: string | null;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  servicesDetected: string[];
  painPhrases: string[];
  strengthPhrases: string[];
  workspaceTone: string | null;
  language: string;
}

export const RECEPTIONIST_SYSTEM_CONTEXT = `You are designing the behavior for an AI phone receptionist that answers inbound calls 24/7 for a local service business. Your output is strict JSON matching the schema. The agent's goal is simple: qualify the caller, capture contact details, and book an appointment or take a message. Do not invent prices, technician names, or hours the caller needs to hear. Keep every script line under 25 words so it sounds like a real human picking up the phone.`;

export const RECEPTIONIST_SCHEMA = `{
  "agent": {
    "name": string,                   // persona name, e.g. "Sam"
    "voice_hint": string,             // one-line description of tone
    "language": string                // ISO code
  },
  "greeting": {
    "initial": string,                // the first line the caller hears
    "followup": string                // after the caller speaks
  },
  "business_summary": string,         // 2 sentences the agent uses as context
  "hours_policy": {
    "statement": string,              // e.g. "We're open Mon-Fri 8am to 6pm"
    "after_hours_line": string        // what the agent says after hours
  },
  "faqs": [                           // 5-8 FAQs
    { "question": string, "answer": string }
  ],
  "services": [                       // the services this receptionist can discuss
    { "name": string, "short_description": string }
  ],
  "intake_flow": {                    // the qualification + capture flow
    "steps": [
      { "label": string, "prompt": string, "required": boolean }
    ]
  },
  "booking_flow": {
    "enabled": boolean,
    "calendar_prompt": string,        // what the agent says when offering a time
    "handoff_rule": string            // when to route to a human
  },
  "escalation_rules": [               // when to escalate
    { "trigger": string, "action": string }
  ],
  "voicemail_fallback": string,       // message played if booking fails
  "guardrails": string[]              // short rules the agent must obey
}`;

export function buildReceptionistPrompt(input: ReceptionistPromptInput): string {
  const lang = input.language === "tr" ? "Turkish (tr)" : "English (en)";
  const services = input.servicesDetected.length
    ? input.servicesDetected.join(", ")
    : "(infer from business type)";
  const pains = input.painPhrases.length
    ? input.painPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n")
    : "(none identified)";
  const strengths = input.strengthPhrases.length
    ? input.strengthPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n")
    : "(none identified)";

  return `${RECEPTIONIST_SYSTEM_CONTEXT}

Respond ONLY with JSON matching this schema:
${RECEPTIONIST_SCHEMA}

LANGUAGE FOR EVERY CUSTOMER-FACING STRING: ${lang}. The FAQ questions, greeting lines, hours statement, and voicemail message must all be in this language. Non-customer-facing fields (labels, keys) stay in English.

BUSINESS:
- Name: ${input.businessName}
- Type: ${input.primaryType ?? "(not specified)"}
- Address: ${input.formattedAddress}
- Neighborhood: ${input.borough ?? "(not specified)"}
- Phone: ${input.phone ?? "(not available)"}
- Google rating: ${input.rating ?? "(no rating)"} (${input.reviewCount ?? 0} reviews)
- Services: ${services}

PAIN POINTS from reviews (the agent should be ready to address):
${pains}

STRENGTHS from reviews (the agent can lean into):
${strengths}

AGENT TONE: ${input.workspaceTone ?? "friendly, professional, warm"}

RULES:
1. The agent's job is to qualify then book or take a message. Never quote a price.
2. FAQs must cover: hours (vague unless caller asks), service area, emergency policy, payment methods, what to expect on the first visit, pet/safety policy (if relevant).
3. intake_flow.steps should capture: caller's full name, phone number, address (if service is on-site), a one-sentence description of the need.
4. If the business has emergency service (HVAC / plumbing / locksmith), add an escalation_rule that routes "emergency" or "burst pipe" / "no heat" / similar keywords to a human.
5. Guardrails MUST include: "never quote a price", "never promise a technician by name", "always confirm the caller's phone before ending the call".`;
}
