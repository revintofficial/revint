/**
 * AI Receptionist Builder worker.
 *
 * Generates a normalized voice-agent config from the lead + review
 * intelligence, plus a platform-specific export (Synthflow, Retell,
 * Vapi, or GHL) and a markdown setup guide the agency can forward to
 * their client. The output is stored in `AgentRun.outputJson`; the
 * `/api/agent-runs/:id/export?format=...` endpoint serializes it into
 * the per-platform JSON shape on demand.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import {
  buildReceptionistPrompt,
  type ReceptionistPromptInput,
} from "@/lib/prompts/ai-receptionist-prompt";
import type {
  AgentExportFormat,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

// --- Normalized artifact shape (stored in AgentRun.outputJson) -------

export interface ReceptionistAgentConfig {
  name: string;
  voice_hint: string;
  language: string;
}

export interface ReceptionistGreeting {
  initial: string;
  followup: string;
}

export interface ReceptionistHoursPolicy {
  statement: string;
  after_hours_line: string;
}

export interface ReceptionistFaq {
  question: string;
  answer: string;
}

export interface ReceptionistService {
  name: string;
  short_description: string;
}

export interface ReceptionistIntakeStep {
  label: string;
  prompt: string;
  required: boolean;
}

export interface ReceptionistBookingFlow {
  enabled: boolean;
  calendar_prompt: string;
  handoff_rule: string;
}

export interface ReceptionistEscalationRule {
  trigger: string;
  action: string;
}

export interface ReceptionistArtifact {
  businessName: string;
  businessPhone: string | null;
  leadId: string;
  leadSlug?: string;
  language: string;
  agent: ReceptionistAgentConfig;
  greeting: ReceptionistGreeting;
  business_summary: string;
  hours_policy: ReceptionistHoursPolicy;
  faqs: ReceptionistFaq[];
  services: ReceptionistService[];
  intake_flow: { steps: ReceptionistIntakeStep[] };
  booking_flow: ReceptionistBookingFlow;
  escalation_rules: ReceptionistEscalationRule[];
  voicemail_fallback: string;
  guardrails: string[];
  setup_markdown: string;
}

// --- Worker run ------------------------------------------------------

export const run: AgentWorkerRun = async (ctx) => {
  if (!ctx.lead) {
    throw new Error("AI_RECEPTIONIST_BUILDER requires a lead context");
  }
  const lead = ctx.lead;
  const audit = lead.websiteAudit;
  const review = lead.reviewAnalysis;

  const servicesDetected = toStringArray(audit?.servicesDetected);
  const painPhrases = toStringArray(review?.painPhrases);
  const strengthPhrases = toStringArray(review?.strengthPhrases);

  const promptInput: ReceptionistPromptInput = {
    businessName: lead.businessName,
    primaryType: lead.primaryType,
    formattedAddress: lead.formattedAddress,
    borough: lead.borough,
    phone: lead.phone,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    servicesDetected,
    painPhrases,
    strengthPhrases,
    workspaceTone: ctx.workspace.tone,
    language: ctx.workspace.language ?? "tr",
  };

  const prompt = buildReceptionistPrompt(promptInput);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 3072,
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = parseReceptionistJson(text);

  // Attach the existing WebsiteMockup slug (if any) so the agent's
  // business_summary can reference the draft URL the agency sent.
  const mockup = await prisma.websiteMockup.findFirst({
    where: { leadId: lead.id, isPublic: true },
    select: { slug: true },
    orderBy: { updatedAt: "desc" },
  });

  const artifact: ReceptionistArtifact = {
    businessName: lead.businessName,
    businessPhone: lead.phone,
    leadId: lead.id,
    leadSlug: mockup?.slug,
    language: ctx.workspace.language ?? "tr",
    agent: parsed.agent,
    greeting: parsed.greeting,
    business_summary: parsed.business_summary,
    hours_policy: parsed.hours_policy,
    faqs: parsed.faqs,
    services: parsed.services,
    intake_flow: parsed.intake_flow,
    booking_flow: parsed.booking_flow,
    escalation_rules: parsed.escalation_rules,
    voicemail_fallback: parsed.voicemail_fallback,
    guardrails: parsed.guardrails,
    setup_markdown: buildSetupMarkdown(parsed, lead, ctx.workspace.language ?? "tr"),
  };

  const costTokens = Math.ceil((prompt.length + text.length) / 4);
  return {
    output: artifact,
    artifactUrl: null,
    costTokens,
  } satisfies AgentWorkerOutput;
};

// --- Parsing ---------------------------------------------------------

function parseReceptionistJson(text: string): Omit<ReceptionistArtifact, "businessName" | "businessPhone" | "leadId" | "language" | "setup_markdown"> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI Receptionist prompt returned malformed JSON");
    parsed = JSON.parse(match[0]);
  }

  const agent = parsed.agent as Record<string, unknown> | undefined;
  const greeting = parsed.greeting as Record<string, unknown> | undefined;
  const hours = parsed.hours_policy as Record<string, unknown> | undefined;
  const booking = parsed.booking_flow as Record<string, unknown> | undefined;
  const intake = parsed.intake_flow as Record<string, unknown> | undefined;

  return {
    agent: {
      name: String(agent?.name ?? "Receptionist"),
      voice_hint: String(agent?.voice_hint ?? "friendly, professional"),
      language: String(agent?.language ?? "tr"),
    },
    greeting: {
      initial: String(greeting?.initial ?? ""),
      followup: String(greeting?.followup ?? ""),
    },
    business_summary: String(parsed.business_summary ?? ""),
    hours_policy: {
      statement: String(hours?.statement ?? ""),
      after_hours_line: String(hours?.after_hours_line ?? ""),
    },
    faqs: Array.isArray(parsed.faqs)
      ? (parsed.faqs as unknown[])
          .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
          .map((f) => ({
            question: String(f.question ?? ""),
            answer: String(f.answer ?? ""),
          }))
          .filter((f) => f.question && f.answer)
      : [],
    services: Array.isArray(parsed.services)
      ? (parsed.services as unknown[])
          .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
          .map((s) => ({
            name: String(s.name ?? ""),
            short_description: String(s.short_description ?? ""),
          }))
          .filter((s) => s.name)
      : [],
    intake_flow: {
      steps: Array.isArray(intake?.steps)
        ? (intake.steps as unknown[])
            .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
            .map((s) => ({
              label: String(s.label ?? ""),
              prompt: String(s.prompt ?? ""),
              required: !!s.required,
            }))
            .filter((s) => s.label)
        : [],
    },
    booking_flow: {
      enabled: !!booking?.enabled,
      calendar_prompt: String(booking?.calendar_prompt ?? ""),
      handoff_rule: String(booking?.handoff_rule ?? ""),
    },
    escalation_rules: Array.isArray(parsed.escalation_rules)
      ? (parsed.escalation_rules as unknown[])
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({
            trigger: String(r.trigger ?? ""),
            action: String(r.action ?? ""),
          }))
          .filter((r) => r.trigger)
      : [],
    voicemail_fallback: String(parsed.voicemail_fallback ?? ""),
    guardrails: Array.isArray(parsed.guardrails)
      ? (parsed.guardrails as unknown[]).filter((g): g is string => typeof g === "string")
      : [],
  };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).filter((x): x is string => typeof x === "string");
}

// --- Platform exporters ----------------------------------------------

/**
 * Per-platform serializers. Each returns `{ body, contentType, filename }`.
 * The API export route hands these to the browser as a download.
 */
export function exportReceptionistArtifact(
  artifact: ReceptionistArtifact,
  format: AgentExportFormat,
): { body: string; contentType: string; filename: string } {
  const baseFilename = `ai-receptionist-${slugify(artifact.businessName)}`;

  switch (format) {
    case "synthflow":
      return {
        body: JSON.stringify(toSynthflow(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${baseFilename}-synthflow.json`,
      };
    case "retell":
      return {
        body: JSON.stringify(toRetell(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${baseFilename}-retell.json`,
      };
    case "vapi":
      return {
        body: JSON.stringify(toVapi(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${baseFilename}-vapi.json`,
      };
    case "ghl":
      return {
        body: JSON.stringify(toGHL(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${baseFilename}-ghl.json`,
      };
    case "json":
    default:
      return {
        body: JSON.stringify(artifact, null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${baseFilename}.json`,
      };
  }
}

/**
 * Synthflow import shape. Synthflow's no-code builder accepts a JSON
 * definition with `name`, `initial_message`, `prompt` (system), `llm`,
 * `voice`, `tools`, and `language`. We flatten our normalized artifact
 * into their expected shape; agency user can edit after import.
 */
function toSynthflow(a: ReceptionistArtifact) {
  return {
    version: "v1",
    name: `${a.businessName} - AI Receptionist`,
    language: a.language,
    voice: { provider: "elevenlabs", voice_id: null, hint: a.agent.voice_hint },
    llm: { provider: "openai", model: "gpt-4o-mini" },
    initial_message: a.greeting.initial,
    system_prompt: buildSystemPrompt(a),
    faqs: a.faqs,
    tools: {
      booking: a.booking_flow.enabled
        ? { type: "calendar", prompt: a.booking_flow.calendar_prompt }
        : null,
      escalation: a.escalation_rules,
    },
    voicemail_fallback: a.voicemail_fallback,
    metadata: { business_phone: a.businessPhone, lead_id: a.leadId, generator: "leadac" },
  };
}

function toRetell(a: ReceptionistArtifact) {
  return {
    agent_name: `${a.businessName} - AI Receptionist`,
    response_engine: { type: "retell-llm", llm_id: null },
    voice_id: null,
    language: a.language,
    begin_message: a.greeting.initial,
    general_prompt: buildSystemPrompt(a),
    general_tools: buildRetellTools(a),
    voicemail_message: a.voicemail_fallback,
    metadata: { leadac_lead_id: a.leadId },
  };
}

function toVapi(a: ReceptionistArtifact) {
  return {
    name: `${a.businessName} - AI Receptionist`,
    firstMessage: a.greeting.initial,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: buildSystemPrompt(a) }],
      tools: buildVapiTools(a),
    },
    voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
    language: a.language,
    metadata: { leadacLeadId: a.leadId },
  };
}

function toGHL(a: ReceptionistArtifact) {
  // GHL Voice AI / Conversation AI config shape. The user imports via
  // GHL's AI Employee snapshot; keys are what their snapshot importer
  // expects (simplified - user tunes in the GHL UI).
  return {
    type: "voice_ai_agent",
    name: `${a.businessName} - AI Receptionist`,
    language: a.language,
    greeting: a.greeting.initial,
    followup_greeting: a.greeting.followup,
    knowledge_base: {
      business_summary: a.business_summary,
      hours: a.hours_policy,
      faqs: a.faqs,
      services: a.services,
      guardrails: a.guardrails,
    },
    intake: a.intake_flow.steps,
    booking: a.booking_flow,
    escalation: a.escalation_rules,
    voicemail: a.voicemail_fallback,
  };
}

function buildSystemPrompt(a: ReceptionistArtifact): string {
  const lines: string[] = [];
  lines.push(`You are "${a.agent.name}", the AI receptionist for ${a.businessName}. ${a.agent.voice_hint}.`);
  lines.push("");
  lines.push(`BUSINESS CONTEXT: ${a.business_summary}`);
  lines.push("");
  lines.push(`HOURS: ${a.hours_policy.statement}`);
  lines.push(`AFTER HOURS: ${a.hours_policy.after_hours_line}`);
  lines.push("");
  if (a.services.length) {
    lines.push("SERVICES YOU CAN DISCUSS:");
    for (const s of a.services) {
      lines.push(`- ${s.name}: ${s.short_description}`);
    }
    lines.push("");
  }
  if (a.faqs.length) {
    lines.push("FAQS (use these answers when matched):");
    for (const f of a.faqs) {
      lines.push(`Q: ${f.question}`);
      lines.push(`A: ${f.answer}`);
    }
    lines.push("");
  }
  if (a.intake_flow.steps.length) {
    lines.push("INTAKE FLOW (capture in this order):");
    for (const step of a.intake_flow.steps) {
      lines.push(`- ${step.label}${step.required ? " (required)" : ""}: ${step.prompt}`);
    }
    lines.push("");
  }
  if (a.escalation_rules.length) {
    lines.push("ESCALATION:");
    for (const rule of a.escalation_rules) {
      lines.push(`- If ${rule.trigger} -> ${rule.action}`);
    }
    lines.push("");
  }
  if (a.guardrails.length) {
    lines.push("HARD RULES:");
    for (const g of a.guardrails) {
      lines.push(`- ${g}`);
    }
  }
  return lines.join("\n");
}

function buildRetellTools(a: ReceptionistArtifact) {
  const tools: unknown[] = [];
  if (a.booking_flow.enabled) {
    tools.push({
      type: "book_appointment",
      name: "book_appointment",
      description: a.booking_flow.calendar_prompt,
    });
  }
  tools.push({
    type: "end_call",
    name: "end_call",
    description: "Politely end the call after confirmation.",
  });
  return tools;
}

function buildVapiTools(a: ReceptionistArtifact) {
  return a.booking_flow.enabled
    ? [
        {
          type: "function",
          function: {
            name: "book_appointment",
            description: a.booking_flow.calendar_prompt,
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                phone: { type: "string" },
                service: { type: "string" },
                preferred_time: { type: "string" },
              },
              required: ["name", "phone"],
            },
          },
        },
      ]
    : [];
}

/**
 * Markdown setup guide - the agency forwards this to their client with
 * the config JSON. Keeps the "what do I do with this file?" question
 * out of support tickets.
 */
function buildSetupMarkdown(
  a: Omit<ReceptionistArtifact, "businessName" | "businessPhone" | "leadId" | "language" | "setup_markdown">,
  lead: { businessName: string; phone: string | null },
  language: string,
): string {
  const tr = language === "tr";
  const head = tr
    ? `# AI Resepsiyonist Kurulum Rehberi - ${lead.businessName}`
    : `# AI Receptionist Setup Guide - ${lead.businessName}`;
  const intro = tr
    ? "Bu paketi Synthflow, Retell, Vapi veya GHL hesabinda 3 dakikada canliya alabilirsin. Adimlar:"
    : "You can have this pack live on Synthflow, Retell, Vapi or GHL in under 3 minutes. Steps:";

  const steps = tr
    ? [
        "1. AI Resepsiyonist platformunda yeni agent olustur.",
        "2. Bu paketten `config` bolumunu yapistir.",
        "3. Voice ID ve telefon numarasini sec.",
        "4. Test aramasi yap; ilk 30 saniyede karsilamanin dogru calismasini dogrula.",
        "5. Isletme telefonu forwardingini AI numarasina yonlendir.",
      ]
    : [
        "1. Create a new agent in your AI receptionist platform.",
        "2. Paste the `config` section from this pack.",
        "3. Pick a voice and phone number.",
        "4. Run a test call and verify the opening 30 seconds.",
        "5. Forward the business line to the AI number.",
      ];

  return [
    head,
    "",
    intro,
    "",
    ...steps,
    "",
    tr ? "## Onemli notlar" : "## Important notes",
    "",
    tr
      ? `- Agent persona: ${a.agent.name}, ton: ${a.agent.voice_hint}`
      : `- Agent persona: ${a.agent.name}, tone: ${a.agent.voice_hint}`,
    tr
      ? `- Calisma saatleri: ${a.hours_policy.statement}`
      : `- Hours: ${a.hours_policy.statement}`,
    tr ? `- SSS sayisi: ${a.faqs.length}` : `- FAQ count: ${a.faqs.length}`,
    tr
      ? `- Booking acik mi: ${a.booking_flow.enabled ? "evet" : "hayir"}`
      : `- Booking enabled: ${a.booking_flow.enabled ? "yes" : "no"}`,
    "",
    tr
      ? "Her seye destek: support@leadac.ai"
      : "Any help: support@leadac.ai",
  ].join("\n");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "business";
}
