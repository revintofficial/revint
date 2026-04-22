/**
 * Unit tests for the AI Workers registry + Phase 1 workers.
 *
 * Coverage:
 *   - Registry exhaustiveness (every AgentWorkerKind has a registry entry)
 *   - Plan gating (planMeetsMinimum)
 *   - Quota limits match the plan matrix expectations
 *   - leadac-hero renderer produces safe HTML (no script injection,
 *     required sections, escapes untrusted user-controlled fields)
 *   - Exporters for receptionist / review-reply / lead-response
 *     produce the platform-specific JSON shape
 */

import { describe, it, expect } from "vitest";
import {
  WORKERS,
  listWorkers,
  planMeetsMinimum,
  getWorker,
} from "@/lib/agent-workers/registry";
import { getLimit, UNLIMITED } from "@/lib/agent-workers/quota";
import { renderLeadacHero } from "@/lib/mockups/renderers/leadac-hero";
import type { WebsiteMockupSections } from "@/lib/prompts/website-mockup-prompt";
import {
  exportReceptionistArtifact,
  type ReceptionistArtifact,
} from "@/lib/agent-workers/ai-receptionist";
import {
  exportReviewReplyArtifact,
  type ReviewReplyArtifact,
} from "@/lib/agent-workers/review-reply";
import {
  exportLeadResponseArtifact,
  type LeadResponseArtifact,
} from "@/lib/agent-workers/lead-response";

describe("AI Workers - registry", () => {
  it("has 28 workers registered (19 core + 9 Apify enrichment)", () => {
    expect(listWorkers()).toHaveLength(28);
  });

  it("every registered worker has both EN and TR labels", () => {
    for (const w of listWorkers()) {
      expect(w.displayName.length).toBeGreaterThan(0);
      expect(w.displayNameTr.length).toBeGreaterThan(0);
      expect(w.description.length).toBeGreaterThan(0);
      expect(w.descriptionTr.length).toBeGreaterThan(0);
    }
  });

  it("phase1Enabled covers every AI Core-registered worker", () => {
    // After AI Core migration every worker with an implModule is
    // phase1Enabled. The four original deliverables are still here
    // alongside legacy intelligence wrappers and Apify enrichment.
    const enabled = listWorkers().filter((w) => w.phase1Enabled).map((w) => w.kind);
    // Core deliverables must stay enabled:
    expect(enabled).toContain("AI_RECEPTIONIST_BUILDER");
    expect(enabled).toContain("REVIEW_REPLY_AGENT");
    expect(enabled).toContain("LEAD_RESPONSE_AGENT");
    expect(enabled).toContain("WEBSITE_MOCKUP_GENERATOR");
    // Intelligence wrappers migrated in Faz C:
    expect(enabled).toContain("WEBSITE_AUDITOR");
    expect(enabled).toContain("REVIEW_ANALYST");
    expect(enabled).toContain("SALES_OPPORTUNITY_SCORER");
    // Apify enrichment (Faz G):
    expect(enabled).toContain("APIFY_GMAPS_DEEP");
    expect(enabled).toContain("APIFY_WEB_CRAWL_DEEP");
  });

  it("planMeetsMinimum respects plan ordering", () => {
    expect(planMeetsMinimum("AGENCY", "PRO")).toBe(true);
    expect(planMeetsMinimum("PRO_TEAM", "PRO")).toBe(true);
    expect(planMeetsMinimum("PRO", "PRO_TEAM")).toBe(false);
    expect(planMeetsMinimum("FREE", "PRO")).toBe(false);
    expect(planMeetsMinimum("FREE", "FREE")).toBe(true);
  });

  it("getWorker returns undefined for unknown kind", () => {
    expect(getWorker("NOT_A_KIND" as never)).toBeUndefined();
  });
});

describe("AI Workers - quota matrix", () => {
  // Launch policy (temporary): FREE tier has graduated access to
  // every worker so new users can test the feature. Conservative
  // matrix (FREE = 0 for deliverables) is kept in quota.ts behind
  // LAUNCH_POLICY=false and re-applied after first 30 days.
  it("FREE tier has non-zero limits under launch policy", () => {
    expect(getLimit("AI_RECEPTIONIST_BUILDER", "FREE")).toBeGreaterThan(0);
    expect(getLimit("REVIEW_REPLY_AGENT", "FREE")).toBeGreaterThan(0);
    expect(getLimit("LEAD_RESPONSE_AGENT", "FREE")).toBeGreaterThan(0);
  });

  it("PRO tier has higher limits than FREE for every Phase 1 worker", () => {
    const phase1: Array<"AI_RECEPTIONIST_BUILDER" | "REVIEW_REPLY_AGENT" | "LEAD_RESPONSE_AGENT" | "WEBSITE_MOCKUP_GENERATOR"> = [
      "AI_RECEPTIONIST_BUILDER",
      "REVIEW_REPLY_AGENT",
      "LEAD_RESPONSE_AGENT",
      "WEBSITE_MOCKUP_GENERATOR",
    ];
    for (const kind of phase1) {
      expect(getLimit(kind, "PRO")).toBeGreaterThan(getLimit(kind, "FREE"));
    }
  });

  it("AGENCY tier is unlimited (hits soft cap)", () => {
    const cap = getLimit("WEBSITE_MOCKUP_GENERATOR", "AGENCY");
    expect(cap).toBeGreaterThan(1000);
  });

  it("UNLIMITED sentinel is negative", () => {
    expect(UNLIMITED).toBe(-1);
  });
});

describe("AI Workers - leadac-hero renderer", () => {
  const sections: WebsiteMockupSections = {
    hero: {
      headline: "Fast, honest HVAC in Brooklyn",
      subline: "Same-day service, upfront pricing, no surprises.",
      cta_primary_text: "Book now",
      trust_line: "4.8 on Google - 127 reviews",
    },
    services: [
      { title: "Emergency Repair", body: "24/7 response.", icon_hint: "bolt" },
      { title: "Installs", body: "We size it right.", icon_hint: "shield" },
      { title: "Maintenance", body: "Annual tune-ups.", icon_hint: "clock" },
    ],
    testimonial: {
      body: "They showed up within the hour and fixed the leak.",
      attribution: "Sarah M.",
      rating: 5,
    },
    about: { paragraph: "Family-run shop serving Brooklyn since forever." },
    cta_final: { headline: "Got a problem? We're close.", button_text: "Call now" },
    theme: { mode: "dark", accent_hex: "#a5b4fc", primary_hex: "#5e6ad2" },
    section_order: ["hero", "services", "social_proof", "about", "contact"],
  };

  it("renders required sections and primary CTA", () => {
    const html = renderLeadacHero({
      businessName: "Acme HVAC",
      formattedAddress: "123 Main St, Brooklyn, NY",
      borough: "Brooklyn",
      phone: "+1 555 123 4567",
      websiteUrl: null,
      rating: 4.8,
      reviewCount: 127,
      googleMapsUri: "https://maps.google.com/?q=Acme+HVAC",
      sections,
      workspaceName: "Leadac Demo",
      lang: "en",
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Acme HVAC");
    expect(html).toContain("Fast, honest HVAC");
    expect(html).toContain("Emergency Repair");
    expect(html).toContain("Sarah M.");
    expect(html).toContain("tel:+15551234567");
    expect(html).toContain("https://wa.me/15551234567");
    expect(html).toContain("noindex");
  });

  it("escapes untrusted content", () => {
    const malicious = {
      ...sections,
      hero: {
        ...sections.hero,
        headline: "<script>alert(1)</script>",
      },
    };
    const html = renderLeadacHero({
      businessName: "<img src=x onerror=alert(1) />",
      formattedAddress: "1 Main",
      borough: null,
      phone: null,
      websiteUrl: null,
      rating: null,
      reviewCount: null,
      googleMapsUri: null,
      sections: malicious,
      lang: "en",
    });
    expect(html).not.toMatch(/<script>alert/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x");
  });

  it("renders tr labels when lang=tr", () => {
    const html = renderLeadacHero({
      businessName: "Demo",
      formattedAddress: "A",
      borough: null,
      phone: "+9053312345",
      websiteUrl: null,
      rating: null,
      reviewCount: null,
      googleMapsUri: null,
      sections,
      lang: "tr",
    });
    expect(html).toContain("Hizmetler");
    expect(html).toContain("Simdi Ara");
  });
});

describe("AI Workers - receptionist exporters", () => {
  const artifact: ReceptionistArtifact = {
    businessName: "Acme HVAC",
    businessPhone: "+15551234567",
    leadId: "lead_1",
    language: "en",
    agent: { name: "Sam", voice_hint: "friendly", language: "en" },
    greeting: { initial: "Hi, Acme HVAC.", followup: "How can I help?" },
    business_summary: "HVAC shop.",
    hours_policy: { statement: "Mon-Fri 8-6", after_hours_line: "Leave a message." },
    faqs: [{ question: "Hours?", answer: "Mon-Fri 8-6" }],
    services: [{ name: "Repair", short_description: "Fix it fast." }],
    intake_flow: { steps: [{ label: "name", prompt: "Name?", required: true }] },
    booking_flow: { enabled: true, calendar_prompt: "When works?", handoff_rule: "emergency->human" },
    escalation_rules: [{ trigger: "emergency", action: "transfer" }],
    voicemail_fallback: "Leave a message.",
    guardrails: ["never quote a price"],
    setup_markdown: "# setup",
  };

  it("Synthflow export shape contains required keys", () => {
    const out = exportReceptionistArtifact(artifact, "synthflow");
    const parsed = JSON.parse(out.body);
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("initial_message");
    expect(parsed).toHaveProperty("system_prompt");
    expect(parsed).toHaveProperty("faqs");
    expect(parsed.system_prompt).toContain("Acme HVAC");
    expect(out.contentType).toContain("application/json");
    expect(out.filename).toContain("synthflow");
  });

  it("Retell export uses begin_message + general_prompt", () => {
    const out = exportReceptionistArtifact(artifact, "retell");
    const parsed = JSON.parse(out.body);
    expect(parsed).toHaveProperty("begin_message", "Hi, Acme HVAC.");
    expect(parsed).toHaveProperty("general_prompt");
    expect(parsed).toHaveProperty("general_tools");
  });

  it("Vapi export uses firstMessage + model.tools", () => {
    const out = exportReceptionistArtifact(artifact, "vapi");
    const parsed = JSON.parse(out.body);
    expect(parsed.firstMessage).toBe("Hi, Acme HVAC.");
    expect(parsed.model.tools).toBeDefined();
  });

  it("GHL export preserves knowledge_base shape", () => {
    const out = exportReceptionistArtifact(artifact, "ghl");
    const parsed = JSON.parse(out.body);
    expect(parsed.type).toBe("voice_ai_agent");
    expect(parsed.knowledge_base.faqs[0].question).toBe("Hours?");
  });

  it("default (json) returns the raw artifact", () => {
    const out = exportReceptionistArtifact(artifact, "json");
    const parsed = JSON.parse(out.body);
    expect(parsed.businessName).toBe("Acme HVAC");
  });
});

describe("AI Workers - review reply exporters", () => {
  const artifact: ReviewReplyArtifact = {
    businessName: "Acme",
    leadId: "lead_1",
    language: "en",
    tone_spec: { voice_descriptor: "warm", dos: ["be specific"], donts: ["never apologize"] },
    variables: ["reviewer_first_name"],
    templates: {
      five_star: [{ id: "5-1", body: "Thank you!" }],
      four_star: [],
      three_star: [],
      two_star: [],
      one_star: [],
    },
    approval_rule: { auto_post_ratings: [4, 5], require_human_approval_ratings: [1, 2, 3], reasoning: "ok" },
    escalation_keywords: ["lawsuit"],
    setup_markdown: "",
  };

  it("json format returns artifact", () => {
    const out = exportReviewReplyArtifact(artifact, "json");
    const parsed = JSON.parse(out.body);
    expect(parsed.businessName).toBe("Acme");
  });

  it("zip format returns a markdown bundle", () => {
    const out = exportReviewReplyArtifact(artifact, "zip");
    expect(out.contentType).toContain("markdown");
    expect(out.body).toContain("5-star replies");
    expect(out.body).toContain("Thank you!");
  });
});

describe("AI Workers - lead response exporters", () => {
  const artifact: LeadResponseArtifact = {
    businessName: "Acme",
    leadId: "lead_1",
    language: "en",
    trigger_channels: ["website_form", "sms"],
    initial_response: {
      sms: "Thanks for reaching out.",
      email_subject: "Hi",
      email_body: "Hi there.",
      chat: "Hello!",
    },
    qualification_questions: [{ label: "service", question: "Which service?", required: true }],
    branches: [{ condition: "urgent", action: "page_owner", template: "We're on it." }],
    followup_cadence: [{ delay_hours: 2, channel: "sms", template: "Still there?" }],
    handoff_rules: [{ trigger: "emergency", action: "transfer" }],
    tone_spec: { voice_descriptor: "warm", signature: "- {{owner}}" },
    setup_markdown: "",
  };

  it("GHL export has triggers + steps", () => {
    const out = exportLeadResponseArtifact(artifact, "ghl");
    const parsed = JSON.parse(out.body);
    expect(parsed.triggers.length).toBe(2);
    expect(parsed.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("n8n export has nodes + connections", () => {
    const out = exportLeadResponseArtifact(artifact, "n8n");
    const parsed = JSON.parse(out.body);
    expect(parsed.nodes).toBeInstanceOf(Array);
    expect(parsed.connections).toBeDefined();
  });

  it("make export has modules", () => {
    const out = exportLeadResponseArtifact(artifact, "make");
    const parsed = JSON.parse(out.body);
    expect(parsed.modules).toBeInstanceOf(Array);
  });
});
