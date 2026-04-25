/**
 * Lead Response Agent worker.
 *
 * Builds a trigger-tree config for inbound lead responses. Output is
 * platform-neutral JSON; the exporter serializes to GHL workflow JSON,
 * n8n workflow JSON, or Make.com scenario JSON on request.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import {
  buildLeadResponsePrompt,
  type LeadResponsePromptInput,
} from "@/lib/prompts/lead-response-prompt";
import type {
  AgentExportFormat,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

// --- Artifact shape --------------------------------------------------

export interface LeadResponseArtifact {
  businessName: string;
  leadId: string;
  language: string;
  trigger_channels: string[];
  initial_response: {
    sms: string;
    email_subject: string;
    email_body: string;
    chat: string;
  };
  qualification_questions: Array<{ label: string; question: string; required: boolean }>;
  branches: Array<{ condition: string; action: string; template: string }>;
  followup_cadence: Array<{ delay_hours: number; channel: "sms" | "email" | "chat"; template: string }>;
  handoff_rules: Array<{ trigger: string; action: string }>;
  tone_spec: { voice_descriptor: string; signature: string };
  setup_markdown: string;
}

// --- Worker run ------------------------------------------------------

export const run: AgentWorkerRun = async (ctx) => {
  if (!ctx.lead) {
    throw new Error("LEAD_RESPONSE_AGENT requires a lead context");
  }
  const lead = ctx.lead;
  const audit = lead.websiteAudit;
  const review = lead.reviewAnalysis;

  const promptInput: LeadResponsePromptInput = {
    businessName: lead.businessName,
    primaryType: lead.primaryType,
    borough: lead.borough,
    painPhrases: toStringArray(review?.painPhrases),
    strengthPhrases: toStringArray(review?.strengthPhrases),
    servicesDetected: toStringArray(audit?.servicesDetected),
    workspaceOfferName: ctx.workspace.offerName ?? null,
    workspaceValueProposition: ctx.workspace.valueProposition ?? null,
    workspaceTone: ctx.workspace.tone,
    language: ctx.workspace.language ?? "en",
  };

  const prompt = buildLeadResponsePrompt(promptInput);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.45,
      responseMimeType: "application/json",
    },
  });

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.LEAD_RESPONSE_AGENT,
    label: "lead_response",
  });
  const text = result.response.text();
  const parsed = parseLeadResponseJson(text);

  const artifact: LeadResponseArtifact = {
    businessName: lead.businessName,
    leadId: lead.id,
    language: ctx.workspace.language ?? "en",
    ...parsed,
    setup_markdown: buildSetupMarkdown(parsed, lead.businessName, ctx.workspace.language ?? "en"),
  };

  const costTokens = Math.ceil((prompt.length + text.length) / 4);
  return {
    output: artifact,
    artifactUrl: null,
    costTokens,
  } satisfies AgentWorkerOutput;
};

// --- Parsing ---------------------------------------------------------

function parseLeadResponseJson(text: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Lead Response prompt returned malformed JSON");
    parsed = JSON.parse(match[0]);
  }

  const init = parsed.initial_response as Record<string, unknown> | undefined;
  const tone = parsed.tone_spec as Record<string, unknown> | undefined;

  return {
    trigger_channels: toStringArray(parsed.trigger_channels),
    initial_response: {
      sms: String(init?.sms ?? ""),
      email_subject: String(init?.email_subject ?? ""),
      email_body: String(init?.email_body ?? ""),
      chat: String(init?.chat ?? ""),
    },
    qualification_questions: Array.isArray(parsed.qualification_questions)
      ? (parsed.qualification_questions as unknown[])
          .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
          .map((q) => ({
            label: String(q.label ?? ""),
            question: String(q.question ?? ""),
            required: !!q.required,
          }))
          .filter((q) => q.question)
      : [],
    branches: Array.isArray(parsed.branches)
      ? (parsed.branches as unknown[])
          .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
          .map((b) => ({
            condition: String(b.condition ?? ""),
            action: String(b.action ?? ""),
            template: String(b.template ?? ""),
          }))
          .filter((b) => b.condition)
      : [],
    followup_cadence: Array.isArray(parsed.followup_cadence)
      ? (parsed.followup_cadence as unknown[])
          .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
          .map((f) => ({
            // Cadence hours are bounded to [0, 720] (30 days). Gemini
            // occasionally emits 9999 or similarly absurd values,
            // which then get exported into GHL/n8n and fire a
            // follow-up in 2027. Cap into a realistic window; values
            // above the cap snap to the cap rather than throw, since
            // the worker artifact is otherwise usable.
            delay_hours: clampDelayHours(f.delay_hours),
            // Only known channels. Unknown strings used to flow into
            // downstream exports producing invalid GHL configs.
            channel: normalizeChannel(f.channel),
            template: String(f.template ?? ""),
          }))
          .filter((f) => f.template)
      : [],
    handoff_rules: Array.isArray(parsed.handoff_rules)
      ? (parsed.handoff_rules as unknown[])
          .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
          .map((h) => ({
            trigger: String(h.trigger ?? ""),
            action: String(h.action ?? ""),
          }))
          .filter((h) => h.trigger)
      : [],
    tone_spec: {
      voice_descriptor: String(tone?.voice_descriptor ?? "warm, fast"),
      signature: String(tone?.signature ?? "- {{owner_first_name}}"),
    },
  };
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).filter((x): x is string => typeof x === "string");
}

const MAX_DELAY_HOURS = 24 * 30; // 30 days

function clampDelayHours(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > MAX_DELAY_HOURS) return MAX_DELAY_HOURS;
  return Math.round(n);
}

const ALLOWED_CHANNELS = new Set(["sms", "email", "chat"]);

function normalizeChannel(v: unknown): "sms" | "email" | "chat" {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  if (ALLOWED_CHANNELS.has(s)) return s as "sms" | "email" | "chat";
  return "sms";
}

// --- Exporters -------------------------------------------------------

export function exportLeadResponseArtifact(
  artifact: LeadResponseArtifact,
  format: AgentExportFormat,
): { body: string; contentType: string; filename: string } {
  const base = `lead-response-${slugify(artifact.businessName)}`;
  switch (format) {
    case "ghl":
      return {
        body: JSON.stringify(toGHLWorkflow(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${base}-ghl.json`,
      };
    case "n8n":
      return {
        body: JSON.stringify(toN8nWorkflow(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${base}-n8n.json`,
      };
    case "make":
      return {
        body: JSON.stringify(toMakeScenario(artifact), null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${base}-make.json`,
      };
    case "json":
    default:
      return {
        body: JSON.stringify(artifact, null, 2),
        contentType: "application/json; charset=utf-8",
        filename: `${base}.json`,
      };
  }
}

/**
 * GHL workflow JSON (simplified). GHL's workflow importer accepts a
 * structured JSON with trigger + steps + actions. We produce a stub
 * that user can refine in the GHL UI after import.
 */
function toGHLWorkflow(a: LeadResponseArtifact) {
  return {
    version: "v1",
    name: `${a.businessName} - Lead Response Agent`,
    triggers: a.trigger_channels.map((ch) => ({ type: "inbound_message", channel: ch })),
    steps: [
      {
        type: "send_sms",
        template: a.initial_response.sms,
        delay_sec: 30,
      },
      {
        type: "send_email",
        subject: a.initial_response.email_subject,
        body: a.initial_response.email_body,
        delay_sec: 60,
      },
      ...a.followup_cadence.map((f) => ({
        type: `send_${f.channel}`,
        template: f.template,
        delay_sec: f.delay_hours * 3600,
      })),
    ],
    branches: a.branches,
    handoff: a.handoff_rules,
  };
}

/**
 * n8n workflow JSON (simplified template).
 */
function toN8nWorkflow(a: LeadResponseArtifact) {
  return {
    name: `${a.businessName} - Lead Response Agent`,
    nodes: [
      { id: "webhook", type: "n8n-nodes-base.webhook", name: "Inbound Lead" },
      { id: "classify", type: "n8n-nodes-base.if", name: "Classify Intent" },
      { id: "sms_reply", type: "n8n-nodes-base.twilio", name: "Send SMS Reply", parameters: { message: a.initial_response.sms } },
      { id: "email_reply", type: "n8n-nodes-base.emailSend", name: "Send Email Reply", parameters: { subject: a.initial_response.email_subject, text: a.initial_response.email_body } },
    ],
    connections: { webhook: { main: [[{ node: "classify", type: "main", index: 0 }]] } },
    followup: a.followup_cadence,
    handoff: a.handoff_rules,
    meta: { generator: "leadac-lead-response", leadId: a.leadId },
  };
}

/**
 * Make.com scenario blueprint (simplified).
 */
function toMakeScenario(a: LeadResponseArtifact) {
  return {
    name: `${a.businessName} - Lead Response`,
    modules: [
      { type: "webhook", label: "Inbound lead" },
      { type: "router" },
      { type: "twilio.sms", params: { body: a.initial_response.sms } },
      { type: "gmail.send", params: { subject: a.initial_response.email_subject, text: a.initial_response.email_body } },
    ],
    branches: a.branches,
    followup: a.followup_cadence,
    handoff: a.handoff_rules,
  };
}

function buildSetupMarkdown(
  a: Omit<LeadResponseArtifact, "businessName" | "leadId" | "language" | "setup_markdown">,
  businessName: string,
  language: string,
): string {
  const tr = language === "tr";
  const head = tr
    ? `# Lead Cevap Ajani Kurulum - ${businessName}`
    : `# Lead Response Agent Setup - ${businessName}`;
  const body = tr
    ? [
        "Bu ajani 3 platformdan birine kurabilirsin:",
        "",
        "1. **GoHighLevel** - Workflows > Import JSON. Export formati: `ghl`.",
        "2. **n8n** - New workflow > Import from JSON. Export formati: `n8n`.",
        "3. **Make.com** - New scenario > Import blueprint. Export formati: `make`.",
        "",
        "## Tetikleyici kanallar",
        "",
        ...a.trigger_channels.map((c) => `- ${c}`),
        "",
        "## Ilk cevap gecikme sureleri",
        "",
        "- SMS: 30 saniye icinde",
        "- Email: 60 saniye icinde",
        "- Takip: 2h, 24h, 72h",
        "",
        "## Escalation kurallari",
        "",
        ...a.handoff_rules.map((h) => `- Eger ${h.trigger} -> ${h.action}`),
      ]
    : [
        "Install this agent in one of three platforms:",
        "",
        "1. **GoHighLevel** - Workflows > Import JSON. Use format `ghl`.",
        "2. **n8n** - New workflow > Import from JSON. Use format `n8n`.",
        "3. **Make.com** - New scenario > Import blueprint. Use format `make`.",
        "",
        "## Trigger channels",
        "",
        ...a.trigger_channels.map((c) => `- ${c}`),
        "",
        "## Response timing",
        "",
        "- SMS: within 30 seconds",
        "- Email: within 60 seconds",
        "- Followups: 2h, 24h, 72h",
        "",
        "## Escalation rules",
        "",
        ...a.handoff_rules.map((h) => `- If ${h.trigger} -> ${h.action}`),
      ];
  return [head, "", ...body].join("\n");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "business";
}
