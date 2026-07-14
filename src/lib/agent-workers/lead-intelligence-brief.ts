/**
 * LEAD_INTELLIGENCE_BRIEF worker (Phase 0/B5).
 *
 * The canonical "single source of truth" worker. Runs at the END of
 * the `lead_created` chain — after every enrichment + scoring +
 * classification + dossier + mockup has either succeeded or been
 * SKIPPED. Reads every Lead-scoped artifact in one pass and writes:
 *
 *   1. A structured "brief" payload (talking points, next action,
 *      best-time-to-call hint, opener seed, reply objections,
 *      Sales Confidence 0-100). Cached on `AgentRun.outputJson`.
 *   2. Denormalized `Lead.salesConfidence` + `Lead.intelligenceVersion`
 *      so the leads list query can sort/filter on a single number
 *      without joining four tables.
 *
 * Why a separate worker (vs reusing the dossier)?
 *   - The dossier is a long-form Markdown narrative. Reps don't speed-
 *     read 850 words during a cold call.
 *   - The dossier had to be its own author for Gemini-friendliness;
 *     the brief is structured JSON so the UI can render specific
 *     fields ("Open with this line", "Best time to call: weekday lunch")
 *     in dedicated cards.
 *   - The Sales Confidence rollup needs to read every signal AT ONCE
 *     including the dossier; a worker that depends on the dossier
 *     can't BE the dossier.
 *
 * Output shape:
 *   {
 *     salesConfidence: number,            // 0-100
 *     confidenceBreakdown: {
 *       audit: number, reviews: number, opportunity: number, weight: number
 *     },
 *     headline: string,                    // one-line "this is a {x}"
 *     talkingPoints: string[],             // 3-5 short pointers for the call
 *     openerSeed: string,                  // first-line opener for cold email/call
 *     bestTimeToCall: string | null,       // free-text hint, may include local TZ
 *     dnc: boolean,                        // hard block from outbound (e.g. opted-out)
 *     nextAction: { kind: string, due: string | null, note: string },
 *     replyObjections: string[],           // anticipated buyer objections
 *     redFlags: string[],                  // spend-time-elsewhere signals
 *     evidence: { source: string, note: string }[],
 *     generatedAt: string,
 *     intelligenceVersion: number,
 *     // Truth Layer T-D additions (gated by TRUTH_LAYER_BRIEF_V2):
 *     painPoints: PainPoint[],             // typed grounded shape per pain-point@v1
 *     hypotheses: Hypothesis[],            // model-inferred plausibilities
 *     whyGoodTarget: string | null,        // post-validated against websiteVerificationStatus
 *     websiteClaimBlocked: boolean,        // true when the website-claim gate stripped a sentence
 *     briefMode: "v2" | "legacy",          // pipeline that produced this brief
 *   }
 *
 * Truth Layer T-D — Brief Truth-Grounding (master plan §3 T-D):
 *   - Every `painPoints[i]` is source-grounded; `source` is one of
 *     `"review_quote" | "owner_reply" | "missing_field"`. Inferred
 *     items get promoted to `hypotheses[]`.
 *   - `whyGoodTarget` is post-validated; sentences asserting website
 *     absence are stripped unless `Lead.websiteVerificationStatus`
 *     is `"confirmed_absent"`. The validator emits
 *     `truth.brief.website_claim_blocked` when stripping.
 *   - Telemetry: `truth.brief.pain_quoted`, `truth.brief.hypothesis_count`,
 *     `truth.brief.website_claim_blocked` (server-side via logger.info
 *     `[truth-telemetry]` per the T-A / T-C convention).
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { safeParseGeminiJson } from "@/lib/gemini";
import { listByLead as listMemoryByLead } from "@/lib/ai-core/memory";
import { runAuditChecklist } from "@/lib/audit-checklist";
import { getNicheBySlug } from "@/lib/niches";
import type { WebsiteFeatures } from "@/types";
import type { NextActionKind, Channel, Prisma } from "@/generated/prisma/client";
import {
  ReasoningGraphBuilder,
  type ReasoningGraph,
} from "@/lib/sdr-brain/reasoning-graph";
import { REASONING_SUMMARY_REF_TYPES } from "./reasoning-ref-types";
import {
  detectContradictions,
  type T2Snapshot,
} from "@/lib/sdr-brain/contradictions";
import {
  type Hypothesis,
  type LeadEvidenceField,
  type PainPoint,
  type PainPointEvidenceRef,
  type PainPointSource,
  type WebsiteVerificationStatus,
} from "@/lib/sdr-brain/contracts";
import { isTruthLayerFlagEnabled, getHeadAgentMode } from "@/lib/feature-flags";
import {
  runHeadAgentSynthesis,
  isFnbNiche,
  type HeadAgentDecision,
} from "@/lib/ai-core/agent/head-agent";
import { TruthLayerError } from "@/lib/sdr-brain/error-catalog";
import { getPlaybook, deriveLeadTemperature } from "@/lib/playbook/resolve";
import { enqueueCrmWriteback } from "@/lib/integrations/hubspot/writeback";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

interface BriefOutput {
  salesConfidence: number;
  confidenceBreakdown: {
    audit: number;
    reviews: number;
    opportunity: number;
    weight: number;
  };
  headline: string;
  talkingPoints: string[];
  openerSeed: string;
  bestTimeToCall: string | null;
  dnc: boolean;
  nextAction: { kind: string; due: string | null; note: string };
  replyObjections: string[];
  redFlags: string[];
  evidence: { source: string; note: string }[];
  /**
   * Phase 2.5 — Brief-grounded opener guardrail.
   *
   * `confirmedPainPoints` is the SHORTLIST of pain phrases that the
   * brief verified against actual evidence (a quoted review, a
   * concrete audit signal, or a rep voice-note). Distinct from the
   * scorer's `likelyPainPoints` which is allowed to extrapolate —
   * THIS list is what the OPENER may cite in cold outreach. If a
   * pain isn't on this list, the opener may not pitch it (the LLM
   * is told this explicitly).
   *
   * `confirmedMissingFeatures` is the same idea for features /
   * modules: only call out a missing feature in outreach when the
   * audit explicitly returned `false` for it. A `null` audit signal
   * (audit not run, audit timed out, social-media-only URL) does
   * NOT count as confirmation that the feature is missing.
   *
   * Both arrays default to empty when the brief has insufficient
   * grounding — the opener then falls back to a generic-but-safe
   * pitch instead of inventing problems.
   */
  confirmedPainPoints: string[];
  confirmedMissingFeatures: string[];
  /**
   * Truth Layer T-D — typed grounded pain points. Each entry has a
   * `source` discriminated against `evidenceRef.kind`; the worker
   * post-validator drops/promotes any item whose source is
   * `"inferred"` or whose evidenceRef shape is invalid. The legacy
   * (flag-off) path emits an empty array — the existing
   * `confirmedPainPoints: string[]` shortlist remains the back-compat
   * surface for downstream consumers (opener-writer, FourThingsCard).
   *
   * Optional in the type because the legacy `BriefOutput` shape on
   * cached AgentRun rows pre-dates this contract; readers must treat
   * an absent / empty array as "no grounded pain claims".
   */
  painPoints?: PainPoint[];
  /**
   * Truth Layer T-D — model-inferred plausible pains promoted out of
   * `painPoints` because they could not be ground in a quoted review,
   * an owner reply, or an explicitly-missing field. The UI renders
   * these with a "may be wrong" affordance (lower visual weight,
   * separate bucket) so reps don't pitch them as facts.
   */
  hypotheses?: Hypothesis[];
  /**
   * Truth Layer T-D — the headline rationale paragraph. Post-Gemini
   * validator strips any sentence that asserts website-absence
   * ("no website", "without a website", ...) unless
   * `Lead.websiteVerificationStatus === "confirmed_absent"`. When the
   * stripper runs we set `websiteClaimBlocked = true` and emit
   * `truth.brief.website_claim_blocked` so the dashboard catches the
   * Greenwich Morning class of bug.
   */
  whyGoodTarget?: string | null;
  /** True when the website-claim post-validator stripped a sentence. */
  websiteClaimBlocked?: boolean;
  /**
   * `"v2"` when the new prompt + responseSchema produced this brief,
   * `"legacy"` when the flag-off / fallback path produced it,
   * `"head-agent"` when the Claude Head Agent synthesis pass ran on top
   * of the deterministic v2 brief (canary). Lets downstream telemetry
   * split shadow-run comparisons cleanly.
   */
  briefMode?: "v2" | "legacy" | "head-agent";
  /**
   * Faz 2 — Claude Head Agent decision. Present only when the
   * CLAUDE_HEAD_AGENT flag is on for the workspace, the niche routes to
   * a vertical pack (F&B today), and the synthesis call succeeded. The
   * deterministic fields above are unchanged — this is an additive
   * account-level decision layer (primary angle, talk track, confidence,
   * cross-source conflicts) the UI + CRM write-back consume.
   */
  headAgent?: HeadAgentDecision;
  generatedAt: string;
  intelligenceVersion: number;
}

/**
 * Phase 0/B5 — deterministic "Sales Confidence" rollup. The Gemini
 * call is for the prose (talking points, opener seed) but the SCORE
 * itself is a math.weighted blend of the three upstream signals so
 * we don't depend on Gemini's mood for sorting the leads list.
 *
 * Weights:
 *   - audit checklist scorePercent       40%
 *   - reviewAnalysis.leadScore           30%
 *   - salesOpportunity.opportunityScore  30%
 *
 * Missing signals collapse to 0 and reduce the total weight
 * proportionally so a lead with "no reviews, no website" still gets
 * a usable number rather than NaN.
 */
function computeSalesConfidence(input: {
  auditScorePct: number | null;
  reviewLeadScore: number | null;
  opportunityScore: number | null;
}): { score: number; breakdown: BriefOutput["confidenceBreakdown"] } {
  const components: { value: number | null; weight: number; key: keyof BriefOutput["confidenceBreakdown"] }[] = [
    { value: input.auditScorePct, weight: 0.4, key: "audit" },
    { value: input.reviewLeadScore, weight: 0.3, key: "reviews" },
    { value: input.opportunityScore, weight: 0.3, key: "opportunity" },
  ];
  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown: BriefOutput["confidenceBreakdown"] = {
    audit: 0,
    reviews: 0,
    opportunity: 0,
    weight: 0,
  };
  for (const c of components) {
    if (c.value == null) continue;
    const clamped = Math.max(0, Math.min(100, c.value));
    weightedSum += clamped * c.weight;
    totalWeight += c.weight;
    breakdown[c.key] = clamped;
  }
  breakdown.weight = totalWeight;
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  return { score, breakdown };
}

interface BriefPromptInput {
  businessName: string;
  niche: string | null;
  subNiche: string | null;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  websiteUrl: string | null;
  workspaceLanguage: string;
  workspaceOffer: string | null;
  workspaceValueProp: string | null;
  // P0.5 — workspace-level personalization signals. These shape the
  // BRIEF's prose (talking points, opener seed, next action) but DO
  // NOT change the deterministic salesConfidence rollup.
  workspaceObjective: string | null;
  workspaceTone: string | null;
  workspaceOfferHook: string | null;
  workspaceSocialProof: string | null;
  workspaceSenderName: string | null;
  /** Active sales campaigns (Sequences) with their niche tags + ids. */
  activeCampaigns: { id: string; name: string; niche: string | null }[];
  /**
   * Campaign id matched by the scorer's ICP-fit deterministic check.
   * When set, the brief should recommend `ENROLL_IN_<campaignId>` as
   * the next action so the rep enrols the lead in one click.
   */
  matchedCampaignId: string | null;
  audit: Record<string, unknown> | null;
  auditChecklistText: string;
  reviewAnalysis: Record<string, unknown> | null;
  salesOpportunity: Record<string, unknown> | null;
  socialProfiles: Record<string, string | null> | null;
  voiceNotes: { transcript: string | null; createdAt: string }[];
  dossierMarkdown: string | null;
  memorySnippets: { kind: string; text: string }[];
  agentRunSummaries: { workerKind: string; output: string }[];
  nicheLabel: string | null;
  nichePitchAngle: string | null;
  preComputedConfidence: number;
  /**
   * Truth Layer T-D — multi-source website verification status. The V2
   * prompt + `gateWebsiteClaim` validator both consume this. `null`
   * means T-E never ran for this lead (legacy / new ingest); the V2
   * prompt then refuses to make any "no website" claim at all.
   */
  websiteVerificationStatus: WebsiteVerificationStatus | null;
  /**
   * Subset of `Lead` columns whose null/empty values legitimately
   * count as `"missing_field"` evidence per `pain-point@v1`. The
   * worker pre-computes which ones ARE missing on this lead and
   * exposes the list to the prompt; the validator rejects any
   * `painPoint` claiming `evidenceRef.kind === "missing_field"`
   * whose `field` isn't in this set.
   */
  groundableMissingFields: LeadEvidenceField[];
}

/**
 * Truth Layer T-D — legacy (pre-T-D) brief generator. Preserved as a
 * private function so the `TRUTH_LAYER_BRIEF_V2` flag-off path can
 * fall back to historical behavior and the shadow-run comparison
 * (master plan §4) has a clean baseline.
 */
async function generateBriefLegacy(
  input: BriefPromptInput,
  intelligenceVersion: number,
): Promise<Omit<BriefOutput, "intelligenceVersion" | "generatedAt">> {
  // intelligenceVersion is part of the contract signature shared with
  // generateBriefV2 (callers pass the same monotonic counter to both).
  // The legacy path doesn't use it inside the prompt — kept to keep
  // the call sites symmetric.
  void intelligenceVersion;
  const { getGeminiKey } = await import("@/lib/gemini-keys");
  const client = new GoogleGenerativeAI(getGeminiKey());
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          salesConfidence: { type: SchemaType.NUMBER },
          confidenceBreakdown: {
            type: SchemaType.OBJECT,
            properties: {
              audit: { type: SchemaType.NUMBER },
              reviews: { type: SchemaType.NUMBER },
              opportunity: { type: SchemaType.NUMBER },
              weight: { type: SchemaType.NUMBER },
            },
            required: ["audit", "reviews", "opportunity", "weight"],
          },
          headline: { type: SchemaType.STRING },
          talkingPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          openerSeed: { type: SchemaType.STRING },
          bestTimeToCall: { type: SchemaType.STRING },
          dnc: { type: SchemaType.BOOLEAN },
          nextAction: {
            type: SchemaType.OBJECT,
            properties: {
              kind: { type: SchemaType.STRING },
              due: { type: SchemaType.STRING },
              note: { type: SchemaType.STRING },
            },
            required: ["kind", "due", "note"],
          },
          replyObjections: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          evidence: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                source: { type: SchemaType.STRING },
                note: { type: SchemaType.STRING },
              },
              required: ["source", "note"],
            },
          },
          confirmedPainPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          confirmedMissingFeatures: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: [
          "salesConfidence",
          "confidenceBreakdown",
          "headline",
          "talkingPoints",
          "openerSeed",
          "bestTimeToCall",
          "dnc",
          "nextAction",
          "replyObjections",
          "redFlags",
          "evidence",
          "confirmedPainPoints",
          "confirmedMissingFeatures",
        ],
      },
    },
  });

  const personalizationLines: string[] = [];
  if (input.workspaceObjective)
    personalizationLines.push(`- Campaign objective: ${input.workspaceObjective}`);
  if (input.workspaceTone)
    personalizationLines.push(`- Voice / tone: ${input.workspaceTone}`);
  if (input.workspaceOfferHook)
    personalizationLines.push(`- Rep's signature hook: "${input.workspaceOfferHook}"`);
  if (input.workspaceSocialProof)
    personalizationLines.push(`- Social proof to cite: "${input.workspaceSocialProof}"`);
  if (input.workspaceSenderName)
    personalizationLines.push(`- Sender / signature: ${input.workspaceSenderName}`);
  const personalizationBlock = personalizationLines.length
    ? `\n\nWorkspace personalization (shape the prose to this — voice, hook, proof):\n${personalizationLines.join("\n")}`
    : "";

  const campaignsBlock = input.activeCampaigns.length
    ? `\n\nActive sales campaigns (Sequences this workspace is currently running):\n${input.activeCampaigns
        .map(
          (c) =>
            `- id: ${c.id} | name: "${c.name}" | niche: ${c.niche ? `"${c.niche}"` : "(any)"}`,
        )
        .join("\n")}${
        input.matchedCampaignId
          ? `\n>>> ICP-fit matched campaign id: ${input.matchedCampaignId}. Recommend nextAction.kind = "ENROLL_IN_CAMPAIGN" with note referencing this campaign by name.`
          : ""
      }`
    : "";

  const prompt = `You are the senior SDR enablement analyst at a B2B SaaS for ${input.niche ?? "small businesses"}. The output of this brief is shown to a sales rep DURING a cold call — they need 3-5 talking points, ONE opener line they can read out loud, an honest "should I call?" sales-confidence number, and the realistic objection they will hit.

Write in plain ${input.workspaceLanguage === "tr" ? "Turkish" : "English"}. Avoid marketing fluff. Cite which signal each talking point came from.

Business: ${input.businessName} (${input.subNiche ?? input.niche ?? "unclassified"})
${input.nicheLabel ? `Niche pack: ${input.nicheLabel} — pitch angle: ${input.nichePitchAngle ?? "n/a"}\n` : ""}
Address: ${input.address}
Website: ${input.websiteUrl ?? "n/a"}
Google rating: ${input.rating ?? "n/a"} (${input.reviewCount ?? 0} reviews)

Workspace offer: ${input.workspaceOffer ?? "(not configured)"}
Workspace value prop: ${input.workspaceValueProp ?? "(not configured)"}${personalizationBlock}${campaignsBlock}

PRE-COMPUTED Sales Confidence (use this as your salesConfidence; do not invent a different number): ${input.preComputedConfidence}

## Audit checklist
${input.auditChecklistText}

## Review analysis
${input.reviewAnalysis ? JSON.stringify(input.reviewAnalysis).slice(0, 4000) : "(no review analysis)"}

## Sales opportunity (scorer)
${input.salesOpportunity ? JSON.stringify(input.salesOpportunity).slice(0, 3000) : "(no opportunity row)"}

## Social profiles
${input.socialProfiles ? JSON.stringify(input.socialProfiles) : "(none)"}

## Voice notes (rep-recorded)
${input.voiceNotes.map((v) => `- ${v.transcript ?? ""}`).join("\n") || "(none)"}

## Dossier (long-form analyst narrative)
${input.dossierMarkdown ? input.dossierMarkdown.slice(0, 6000) : "(not generated)"}

## Recent agent-run outputs
${input.agentRunSummaries.map((r) => `- ${r.workerKind}: ${r.output.slice(0, 400)}`).join("\n") || "(none)"}

## Semantic memory (top hits)
${input.memorySnippets.map((m) => `- [${m.kind}] ${m.text.slice(0, 200)}`).join("\n") || "(none)"}

Rules:
- salesConfidence MUST equal ${input.preComputedConfidence}. Use confidenceBreakdown to explain WHY.
- talkingPoints: 3-5 items, each <= 18 words, each anchored in a real signal. No filler.
- openerSeed: ONE sentence the SDR can read aloud — not a full email body. Natural, not salesy.
- bestTimeToCall: brief hint based on niche (e.g. "Restaurants prefer between lunch and dinner rush, ~3-5pm local") or null when uncertain.
- dnc: true ONLY when the data shows explicit opt-out / unsubscribe / "do not call" signals; otherwise false.
- nextAction.kind: one of "CALL_NOW", "EMAIL_FIRST", "WAIT_FOR_REPLY", "DROP_LEAD", "NEEDS_RESEARCH", "ENROLL_IN_CAMPAIGN" (use the last one only when an ICP-fit matched campaign id is provided above; the note must include the campaign name and id).
- nextAction.due: ISO-8601 if a specific time is implied, else null.
- replyObjections: 2-3 anticipated buyer objections, in their voice.
- redFlags: pull from review analysis (low rating + dropping trend), shutdown signals, "permanently closed" indicators. Empty array if none.
- evidence: 3-6 short citations of the actual signals you used.
- confirmedPainPoints: SHORTLIST (0-5 items) of pain phrases that have AT LEAST ONE concrete supporting signal — a direct review quote from the review analysis above, an audit boolean explicitly set to false, or a rep voice-note transcript. If a pain is plausible but unverified, OMIT it. This list is the WHITELIST that downstream cold-email writers may pitch — anything not on it is forbidden.
- confirmedMissingFeatures: SHORTLIST (0-5 items) of features/modules where the audit explicitly returned false (e.g. "no online booking" only when audit.hasBookingSystem === false). A null / unknown audit signal does NOT count as confirmation. Use the same vocabulary as the niche pack's highValueSignals when possible so downstream consumers can match cleanly.
- NO emojis. NO em-dashes. NO marketing buzzwords.

Return ONLY the JSON. No code fences, no preamble.`;

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.LEAD_INTELLIGENCE_BRIEF,
    label: "lead_intelligence_brief",
  });
  const raw = result.response.text();
  const parsed = safeParseGeminiJson<Omit<BriefOutput, "intelligenceVersion" | "generatedAt">>(raw, "lead_intelligence_brief");

  // Hard-clamp salesConfidence to the deterministic value, regardless
  // of what Gemini emitted. The prompt instructs the model to echo
  // the pre-computed number, but bugs happen and we DO NOT want a
  // free-form Gemini number to drive the leads-list ordering.
  parsed.salesConfidence = input.preComputedConfidence;
  parsed.briefMode = "legacy";
  return parsed;
}

// ============================================================================
// Truth Layer T-D — V2 brief generation (prompt + responseSchema redesign).
//
// The V2 path carries three invariants the legacy path could not enforce:
//
//   1. Every `painPoints[i]` is grounded — `source` MUST be one of
//      `"review_quote" | "owner_reply" | "missing_field"`. The prompt
//      tells Gemini to skip an item it cannot ground; the post-validator
//      promotes any inferred items into `hypotheses[]`.
//   2. Inferred / model-derived plausibilities live in `hypotheses[]` —
//      a separate array with explicit `confidence` so the UI can render
//      a "may be wrong" affordance distinct from the grounded claims.
//   3. `whyGoodTarget` is post-gated against
//      `Lead.websiteVerificationStatus`. Sentences asserting website
//      absence are stripped unless the multi-source verifier hit
//      `confirmed_absent`. This is the central debugging case for
//      Greenwich Morning (T-E shipped status=uncertain; the V1 brief
//      still hallucinated "no website" from a single Google Places
//      missing field).
//
// `responseSchema` cannot natively express a discriminated union on
// `evidenceRef`, so we declare the fields as a flat object with
// optional members and validate the discriminant + key shape in
// `validateAndPromotePainPoints` after parse.
// ============================================================================

const WEBSITE_ABSENCE_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\bno\s+website\b/i,
  /\bno\s+web\s+site\b/i,
  /\bwithout\s+a?\s*website\b/i,
  /\black\s+of\s+(?:a\s+)?website\b/i,
  /\blacks?\s+a?\s*website\b/i,
  /\bdoesn['’]?t\s+have\s+a?\s*website\b/i,
  /\bdoes\s+not\s+have\s+a?\s*website\b/i,
  /\bmissing\s+(?:a\s+)?website\b/i,
  /\bhas\s+no\s+(?:online\s+presence|website|site)\b/i,
  /\bhasn['’]?t\s+got\s+a?\s*website\b/i,
]);

/** Test surface — exported so the website-gate test can introspect. */
export { WEBSITE_ABSENCE_PATTERNS };

/**
 * Truth Layer T-D — strip any sentence in `whyGoodTarget` that asserts
 * website absence when the multi-source verifier did NOT confirm it.
 * The contract from `website-verification@v1` is strict: only
 * `confirmed_absent` (≥3 negative sources) is sufficient evidence.
 *
 * Conservative semantics:
 *   - We split on ASCII sentence boundaries (`.`, `?`, `!`) and rebuild
 *     only the sentences that survive. We never DROP the entire
 *     `whyGoodTarget` — if every sentence is stripped the function
 *     returns `null` and the worker falls back to its headline.
 *   - We do NOT rewrite text. The original-Gemini paragraph is either
 *     preserved as-is or redacted at sentence granularity. This keeps
 *     the validator easy to reason about and avoids introducing a
 *     second hallucination surface.
 */
function gateWebsiteClaim(
  whyGoodTarget: string | null,
  status: WebsiteVerificationStatus | null,
): { sanitized: string | null; blocked: boolean } {
  if (!whyGoodTarget) return { sanitized: null, blocked: false };
  if (status === "confirmed_absent") {
    return { sanitized: whyGoodTarget, blocked: false };
  }
  // Split at sentence-ending punctuation while preserving the
  // delimiter on the previous chunk (so we can rebuild with original
  // punctuation). The (?<=…) lookbehind keeps `.`, `?`, `!` attached.
  const sentences = whyGoodTarget.split(/(?<=[.!?])\s+/g);
  const kept: string[] = [];
  let blocked = false;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const offends = WEBSITE_ABSENCE_PATTERNS.some((rx) => rx.test(trimmed));
    if (offends) {
      blocked = true;
      continue;
    }
    kept.push(trimmed);
  }
  if (kept.length === 0) {
    return { sanitized: null, blocked };
  }
  return { sanitized: kept.join(" "), blocked };
}
export { gateWebsiteClaim };

/**
 * Truth Layer T-D — discriminated-union validator for raw painPoints
 * coming back from Gemini. Each entry must pass:
 *
 *   - `claim` is a non-empty string;
 *   - `source` is one of the three grounded sources;
 *   - `evidenceRef.kind` matches `source`:
 *       `"review_quote"`  → `kind === "review"` + non-empty `quote`
 *       `"owner_reply"`   → `kind === "owner_reply"` + non-empty `quote`
 *       `"missing_field"` → `kind === "missing_field"` + `field` is in
 *                           the worker's `groundableMissingFields` set;
 *   - `severity` is an integer 1..5 (clamped from any numeric input).
 *
 * Items that fail are bucketed for promotion to `hypotheses[]` (when
 * the model gave us enough metadata) or dropped entirely. The split
 * lets the worker re-prompt ONCE with the unsatisfied items called
 * out before degrading to the legacy fallback.
 */
interface RawPainPoint {
  claim?: unknown;
  source?: unknown;
  severity?: unknown;
  reasoning?: unknown;
  confidence?: unknown;
  evidenceRef?: {
    kind?: unknown;
    reviewId?: unknown;
    replyId?: unknown;
    quote?: unknown;
    field?: unknown;
  } | null;
}

interface RawHypothesis {
  claim?: unknown;
  reasoning?: unknown;
  confidence?: unknown;
}

interface ValidatePainPointsResult {
  grounded: PainPoint[];
  promoted: Hypothesis[];
  dropped: number;
}

function clampSeverity(n: unknown): 1 | 2 | 3 | 4 | 5 {
  const num = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 3;
  if (num <= 1) return 1;
  if (num >= 5) return 5;
  return num as 1 | 2 | 3 | 4 | 5;
}

function clampConfidence(n: unknown, fallback = 0.5): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function isPainPointSource(s: unknown): s is PainPointSource {
  return (
    s === "review_quote" ||
    s === "owner_reply" ||
    s === "missing_field" ||
    s === "inferred"
  );
}

function buildEvidenceRef(
  source: PainPointSource,
  raw: RawPainPoint["evidenceRef"],
  groundable: ReadonlyArray<LeadEvidenceField>,
): PainPointEvidenceRef | "invalid" {
  if (source === "inferred") return null;
  if (!raw || typeof raw !== "object") return "invalid";
  const kind = raw.kind;
  if (source === "review_quote") {
    if (kind !== "review") return "invalid";
    const reviewId = typeof raw.reviewId === "string" ? raw.reviewId.trim() : "";
    const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
    if (!reviewId || !quote) return "invalid";
    return { kind: "review", reviewId, quote };
  }
  if (source === "owner_reply") {
    if (kind !== "owner_reply") return "invalid";
    const replyId = typeof raw.replyId === "string" ? raw.replyId.trim() : "";
    const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
    if (!replyId || !quote) return "invalid";
    return { kind: "owner_reply", replyId, quote };
  }
  // source === "missing_field"
  if (kind !== "missing_field") return "invalid";
  const field = raw.field;
  if (typeof field !== "string") return "invalid";
  if (!groundable.includes(field as LeadEvidenceField)) return "invalid";
  return { kind: "missing_field", field: field as LeadEvidenceField };
}

function validateAndPromotePainPoints(
  raw: ReadonlyArray<RawPainPoint>,
  groundable: ReadonlyArray<LeadEvidenceField>,
): ValidatePainPointsResult {
  const grounded: PainPoint[] = [];
  const promoted: Hypothesis[] = [];
  let dropped = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      dropped++;
      continue;
    }
    const claim = typeof item.claim === "string" ? item.claim.trim() : "";
    if (!claim) {
      dropped++;
      continue;
    }
    const source = isPainPointSource(item.source) ? item.source : "inferred";
    if (source === "inferred") {
      // Promote to hypothesis using whatever reasoning the model
      // supplied (or the claim itself as a stub). This is the
      // central T-D contract: ungrounded claims live in
      // `hypotheses[]`, never in `painPoints[]`.
      promoted.push({
        claim,
        reasoning:
          typeof item.reasoning === "string" && item.reasoning.trim()
            ? item.reasoning.trim()
            : claim,
        confidence: clampConfidence(item.confidence, 0.4),
      });
      continue;
    }
    const evidenceRef = buildEvidenceRef(source, item.evidenceRef, groundable);
    if (evidenceRef === "invalid") {
      // Item claimed a grounded source but the evidenceRef shape is
      // wrong (e.g. review_quote with no reviewId, or missing_field
      // pointing at a column we don't accept as evidence). Treat as
      // an inferred claim and promote — the rep still benefits from
      // seeing it as a hypothesis rather than losing it entirely.
      promoted.push({
        claim,
        reasoning:
          typeof item.reasoning === "string" && item.reasoning.trim()
            ? item.reasoning.trim()
            : `Model could not ground this in a ${source}.`,
        confidence: clampConfidence(item.confidence, 0.35),
      });
      continue;
    }
    grounded.push({
      claim,
      source,
      evidenceRef,
      severity: clampSeverity(item.severity),
    });
  }
  return { grounded, promoted, dropped };
}

function normalizeHypotheses(raw: ReadonlyArray<RawHypothesis>): Hypothesis[] {
  const out: Hypothesis[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const claim = typeof item.claim === "string" ? item.claim.trim() : "";
    if (!claim) continue;
    out.push({
      claim,
      reasoning:
        typeof item.reasoning === "string" && item.reasoning.trim()
          ? item.reasoning.trim()
          : claim,
      confidence: clampConfidence(item.confidence, 0.5),
    });
  }
  return out;
}

export {
  validateAndPromotePainPoints,
  normalizeHypotheses,
  clampConfidence,
  clampSeverity,
};
export type { BriefPromptInput };

/**
 * Compute the subset of `LeadEvidenceField` that legitimately count
 * as `"missing_field"` evidence on this specific lead. Only these
 * fields are accepted by the post-validator.
 *
 * - `phone`            → null/empty string
 * - `websiteUrl`       → null/empty AND `websiteVerificationStatus`
 *                        is `confirmed_absent` (we don't claim a
 *                        missing website on `uncertain` leads, that's
 *                        the whole T-E + T-D contract)
 * - `googleMapsUri`    → null/empty (rare — usually present)
 * - `rating`           → null
 * - `reviewCount`      → null or 0
 * - `businessStatus`   → null/empty
 */
function computeGroundableMissingFields(input: {
  phone: string | null;
  websiteUrl: string | null;
  websiteVerificationStatus: WebsiteVerificationStatus | null;
  googleMapsUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
}): LeadEvidenceField[] {
  const out: LeadEvidenceField[] = [];
  if (!input.phone || input.phone.trim() === "") out.push("phone");
  if (
    (!input.websiteUrl || input.websiteUrl.trim() === "") &&
    input.websiteVerificationStatus === "confirmed_absent"
  ) {
    out.push("websiteUrl");
  }
  if (!input.googleMapsUri || input.googleMapsUri.trim() === "") {
    out.push("googleMapsUri");
  }
  if (input.rating == null) out.push("rating");
  if (input.reviewCount == null || input.reviewCount === 0) {
    out.push("reviewCount");
  }
  if (!input.businessStatus || input.businessStatus.trim() === "") {
    out.push("businessStatus");
  }
  return out;
}
export { computeGroundableMissingFields };

/**
 * Build the V2 system + user prompt. The system instruction carries
 * the persistent role + evidence rules; per-call data lives in the
 * user content (per the prompt-engineering-gemini skill rule §3).
 */
function buildBriefV2Prompt(input: BriefPromptInput): string {
  const personalizationLines: string[] = [];
  if (input.workspaceObjective)
    personalizationLines.push(`- Campaign objective: ${input.workspaceObjective}`);
  if (input.workspaceTone)
    personalizationLines.push(`- Voice / tone: ${input.workspaceTone}`);
  if (input.workspaceOfferHook)
    personalizationLines.push(`- Rep's signature hook: "${input.workspaceOfferHook}"`);
  if (input.workspaceSocialProof)
    personalizationLines.push(`- Social proof to cite: "${input.workspaceSocialProof}"`);
  if (input.workspaceSenderName)
    personalizationLines.push(`- Sender / signature: ${input.workspaceSenderName}`);
  const personalizationBlock = personalizationLines.length
    ? `\n\nWorkspace personalization (shape the prose to this — voice, hook, proof):\n${personalizationLines.join("\n")}`
    : "";

  const campaignsBlock = input.activeCampaigns.length
    ? `\n\nActive sales campaigns:\n${input.activeCampaigns
        .map(
          (c) =>
            `- id: ${c.id} | name: "${c.name}" | niche: ${c.niche ? `"${c.niche}"` : "(any)"}`,
        )
        .join("\n")}${
        input.matchedCampaignId
          ? `\n>>> ICP-fit matched campaign id: ${input.matchedCampaignId}.`
          : ""
      }`
    : "";

  const websiteStatusLine = (() => {
    switch (input.websiteVerificationStatus) {
      case "confirmed_present":
        return `Website verification: CONFIRMED PRESENT — the multi-source verifier resolved a website. You MUST NOT claim "no website" anywhere in the brief.`;
      case "confirmed_absent":
        return `Website verification: CONFIRMED ABSENT — at least 3 independent sources returned "no website found". You MAY assert website absence in whyGoodTarget when the rep's offer is website-related.`;
      case "uncertain":
        return `Website verification: UNCERTAIN — fewer than 3 negative sources. You MUST NOT claim "no website" / "without a website" / "lacks a website" anywhere in the brief; the verifier cannot confirm absence yet.`;
      default:
        return `Website verification: UNKNOWN (T-E never ran). You MUST NOT claim website absence in this brief.`;
    }
  })();

  const groundableFieldsLine = input.groundableMissingFields.length
    ? `Missing-field evidence is acceptable ONLY for these Lead columns (use the exact identifier in evidenceRef.field): ${input.groundableMissingFields
        .map((f) => `"${f}"`)
        .join(", ")}.`
    : `Missing-field evidence: NONE — every relevant Lead column is populated. Do not emit any painPoint with source="missing_field".`;

  return `You are the senior SDR enablement analyst at a B2B SaaS for ${input.niche ?? "small businesses"}. The output of this brief is shown to a sales rep DURING a cold call. Reps need 3-5 talking points, ONE opener line, an honest "should I call?" sales-confidence number, and the realistic objection they will hit.

Write in plain ${input.workspaceLanguage === "tr" ? "Turkish" : "English"}. Avoid marketing fluff. NO emojis. NO em-dashes. NO marketing buzzwords (leverage, synergy, unlock, elevate, game-changer, ...).

# Truth Layer v1 — grounded evidence rules (HARD)

Every \`painPoints[i]\` MUST be grounded in a specific piece of evidence. Allowed sources are:
  - \`"review_quote"\`     — quote a phrase that appears in one of the review snippets supplied below. Set evidenceRef = { kind: "review", reviewId: "<the supplied id>", quote: "<the quoted phrase>" }.
  - \`"owner_reply"\`      — quote a phrase from an owner-reply snippet supplied below. Set evidenceRef = { kind: "owner_reply", replyId: "<the supplied id>", quote: "<the quoted phrase>" }.
  - \`"missing_field"\`    — cite a specific Lead column whose value is null/empty. Set evidenceRef = { kind: "missing_field", field: "<one of the allowed identifiers below>" }.

If you cannot ground a pain claim in one of the three above, DO NOT put it in \`painPoints\`. Instead put it in \`hypotheses\` with a short \`reasoning\` and a \`confidence\` between 0 and 1. The hypotheses surface to the rep with a "may be wrong" label so they don't pitch it as a fact.

${groundableFieldsLine}

${websiteStatusLine}

# Business

Business: ${input.businessName} (${input.subNiche ?? input.niche ?? "unclassified"})
${input.nicheLabel ? `Niche pack: ${input.nicheLabel} — pitch angle: ${input.nichePitchAngle ?? "n/a"}\n` : ""}
Address: ${input.address}
Website (Place row): ${input.websiteUrl ?? "n/a"}
Google rating: ${input.rating ?? "n/a"} (${input.reviewCount ?? 0} reviews)

Workspace offer: ${input.workspaceOffer ?? "(not configured)"}
Workspace value prop: ${input.workspaceValueProp ?? "(not configured)"}${personalizationBlock}${campaignsBlock}

PRE-COMPUTED Sales Confidence (use this as your salesConfidence; do not invent a different number): ${input.preComputedConfidence}

## Audit checklist
${input.auditChecklistText}

## Review analysis (T-C calibrated; KPIs carry severity + percentBase)
${input.reviewAnalysis ? JSON.stringify(input.reviewAnalysis).slice(0, 4000) : "(no review analysis)"}

## Sales opportunity (scorer)
${input.salesOpportunity ? JSON.stringify(input.salesOpportunity).slice(0, 3000) : "(no opportunity row)"}

## Social profiles
${input.socialProfiles ? JSON.stringify(input.socialProfiles) : "(none)"}

## Voice notes (rep-recorded)
${input.voiceNotes.map((v) => `- ${v.transcript ?? ""}`).join("\n") || "(none)"}

## Dossier (long-form analyst narrative)
${input.dossierMarkdown ? input.dossierMarkdown.slice(0, 6000) : "(not generated)"}

## Recent agent-run outputs
${input.agentRunSummaries.map((r) => `- ${r.workerKind}: ${r.output.slice(0, 400)}`).join("\n") || "(none)"}

## Semantic memory (top hits)
${input.memorySnippets.map((m) => `- [${m.kind}] ${m.text.slice(0, 200)}`).join("\n") || "(none)"}

# Required JSON shape (the responseSchema enforces it)

salesConfidence MUST equal ${input.preComputedConfidence}. Use confidenceBreakdown to explain WHY.
talkingPoints: 3-5 items, each <= 18 words, each anchored in a real signal. No filler.
openerSeed: ONE sentence the SDR can read aloud. Natural, not salesy.
bestTimeToCall: brief hint based on niche, or null when uncertain.
dnc: true ONLY when the data shows explicit opt-out / unsubscribe / "do not call" signals.
nextAction.kind: one of "CALL_NOW", "EMAIL_FIRST", "WAIT_FOR_REPLY", "DROP_LEAD", "NEEDS_RESEARCH", "ENROLL_IN_CAMPAIGN".
nextAction.due: ISO-8601 if a specific time is implied, else null.
replyObjections: 2-3 anticipated buyer objections, in their voice.
redFlags: pull from review analysis (low rating + dropping trend), shutdown signals, "permanently closed" indicators.
evidence: 3-6 short citations of the actual signals you used.
confirmedPainPoints: SHORTLIST (0-5 items) of pain phrases (strings) that downstream cold-email writers may pitch. MUST be a strict subset of \`painPoints[].claim\`.
confirmedMissingFeatures: SHORTLIST (0-5 items) of features/modules where the audit explicitly returned false.
painPoints: 0-5 GROUNDED items. Each MUST carry source + evidenceRef as defined above.
hypotheses: 0-3 plausible-but-ungrounded claims. Each MUST carry reasoning + confidence (0..1).
whyGoodTarget: 1-3 sentences explaining why this lead is worth a call. Subject to the website-claim gate above.

Return ONLY the JSON. No code fences, no preamble.`;
}

async function generateBriefV2(
  input: BriefPromptInput,
  intelligenceVersion: number,
  opts: { reprompt?: { reason: string; ungroundedClaims: string[] } } = {},
): Promise<Omit<BriefOutput, "intelligenceVersion" | "generatedAt">> {
  const { getGeminiKey } = await import("@/lib/gemini-keys");
  const client = new GoogleGenerativeAI(getGeminiKey());
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      // Lower temperature than v1 (0.5 → 0.2) — extraction-class prompts
      // converge faster + more deterministically when we want the model
      // to ground in supplied evidence rather than free-associate. The
      // prompt-engineering-gemini skill rule §2 puts this in the
      // 0.0–0.3 "extraction" band.
      maxOutputTokens: 4096,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          salesConfidence: { type: SchemaType.NUMBER },
          confidenceBreakdown: {
            type: SchemaType.OBJECT,
            properties: {
              audit: { type: SchemaType.NUMBER },
              reviews: { type: SchemaType.NUMBER },
              opportunity: { type: SchemaType.NUMBER },
              weight: { type: SchemaType.NUMBER },
            },
            required: ["audit", "reviews", "opportunity", "weight"],
          },
          headline: { type: SchemaType.STRING },
          whyGoodTarget: { type: SchemaType.STRING },
          talkingPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          openerSeed: { type: SchemaType.STRING },
          bestTimeToCall: { type: SchemaType.STRING },
          dnc: { type: SchemaType.BOOLEAN },
          nextAction: {
            type: SchemaType.OBJECT,
            properties: {
              kind: { type: SchemaType.STRING },
              due: { type: SchemaType.STRING },
              note: { type: SchemaType.STRING },
            },
            required: ["kind", "due", "note"],
          },
          replyObjections: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          evidence: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                source: { type: SchemaType.STRING },
                note: { type: SchemaType.STRING },
              },
              required: ["source", "note"],
            },
          },
          confirmedPainPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          confirmedMissingFeatures: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          // T-D — typed pain point shape. The Gemini SchemaType API
          // does not natively support `oneOf` on `evidenceRef`, so we
          // declare every possible field as optional and validate the
          // discriminant + key shape post-parse in
          // `validateAndPromotePainPoints`.
          painPoints: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                claim: { type: SchemaType.STRING },
                source: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: [
                    "review_quote",
                    "owner_reply",
                    "missing_field",
                    "inferred",
                  ] as unknown as string[],
                },
                severity: { type: SchemaType.NUMBER },
                evidenceRef: {
                  type: SchemaType.OBJECT,
                  properties: {
                    kind: {
                      type: SchemaType.STRING,
                      format: "enum",
                      enum: [
                        "review",
                        "owner_reply",
                        "missing_field",
                      ] as unknown as string[],
                    },
                    reviewId: { type: SchemaType.STRING },
                    replyId: { type: SchemaType.STRING },
                    quote: { type: SchemaType.STRING },
                    field: { type: SchemaType.STRING },
                  },
                  required: ["kind"],
                },
              },
              required: ["claim", "source", "severity"],
            },
          },
          hypotheses: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                claim: { type: SchemaType.STRING },
                reasoning: { type: SchemaType.STRING },
                confidence: { type: SchemaType.NUMBER },
              },
              required: ["claim", "reasoning", "confidence"],
            },
          },
        },
        required: [
          "salesConfidence",
          "confidenceBreakdown",
          "headline",
          "whyGoodTarget",
          "talkingPoints",
          "openerSeed",
          "bestTimeToCall",
          "dnc",
          "nextAction",
          "replyObjections",
          "redFlags",
          "evidence",
          "confirmedPainPoints",
          "confirmedMissingFeatures",
          "painPoints",
          "hypotheses",
        ],
      },
    },
  });

  const repromptBlock = opts.reprompt
    ? `\n\n# Re-prompt — first attempt produced ungrounded claims\n\nReason: ${opts.reprompt.reason}\nThe following claims were not grounded; either drop them or move them to \`hypotheses\` with reasoning + confidence:\n${opts.reprompt.ungroundedClaims
        .map((c) => `- "${c}"`)
        .join("\n")}\nDo NOT repeat the same ungrounded claims in \`painPoints\` this time.`
    : "";

  const prompt = `${buildBriefV2Prompt(input)}${repromptBlock}`;

  const result = await generateWithTimeout(model, prompt, {
    timeoutMs: WORKER_TIMEOUTS.LEAD_INTELLIGENCE_BRIEF,
    label: "lead_intelligence_brief_v2",
  });
  const raw = result.response.text();
  type RawV2 = Omit<BriefOutput, "intelligenceVersion" | "generatedAt"> & {
    painPoints?: RawPainPoint[];
    hypotheses?: RawHypothesis[];
  };
  const parsed = safeParseGeminiJson<RawV2>(raw, "lead_intelligence_brief_v2");

  // Hard-clamp salesConfidence to the deterministic value, regardless
  // of what Gemini emitted. (Same rule as legacy.)
  parsed.salesConfidence = input.preComputedConfidence;
  parsed.briefMode = "v2";
  return parsed;
}

/**
 * Truth Layer T-D — full V2 pipeline: generate → validate → optionally
 * re-prompt once if every painPoint came back ungrounded → website
 * claim gate → emit telemetry → degrade to legacy on terminal failure.
 *
 * "Conservative degradation": on any uncaught Gemini / parse error
 * the caller's outer try/catch falls back to the deterministic stub
 * brief. On the soft failure path (Gemini emitted only ungrounded
 * pain claims even after re-prompt) we log `E_BRIEF_PAINPOINT_UNGROUNDED`
 * via `TruthLayerError` and SHIP THE LEGACY OUTPUT for that lead so
 * the rep still gets talking points + an opener seed; the typed
 * `painPoints[]` array stays empty rather than poisoning the rep
 * with hallucinated grounded claims.
 */
export async function runBriefV2Pipeline(args: {
  input: BriefPromptInput;
  intelligenceVersion: number;
  leadId: string;
  workspaceId: string;
}): Promise<Omit<BriefOutput, "intelligenceVersion" | "generatedAt">> {
  const { input, intelligenceVersion, leadId, workspaceId } = args;

  const firstPass = await generateBriefV2(input, intelligenceVersion);
  const firstValidated = validateAndPromotePainPoints(
    Array.isArray(firstPass.painPoints)
      ? (firstPass.painPoints as unknown as RawPainPoint[])
      : [],
    input.groundableMissingFields,
  );

  let chosenPass = firstPass;
  let chosenValidated = firstValidated;

  // Re-prompt ONCE when the first pass produced any painPoints but
  // ALL of them failed the grounding check. Skipping zero-painPoint
  // cases (cold leads with no review evidence have nothing to ground)
  // and skipping cases where SOME items were grounded (the model
  // converged enough; the post-validator already promoted the rest).
  const everyPainPointFailedGrounding =
    firstValidated.grounded.length === 0 &&
    firstValidated.promoted.length + firstValidated.dropped > 0;
  if (everyPainPointFailedGrounding) {
    const ungroundedClaims = firstValidated.promoted
      .map((h) => h.claim)
      .filter((c) => c.length > 0)
      .slice(0, 5);
    logger.warn("agent_workers.lead_intelligence_brief.reprompt", {
      leadId,
      workspaceId,
      ungroundedCount: ungroundedClaims.length,
    });
    try {
      const secondPass = await generateBriefV2(input, intelligenceVersion, {
        reprompt: {
          reason:
            "First pass produced 0 grounded painPoints; every claim failed the source/evidenceRef check.",
          ungroundedClaims,
        },
      });
      const secondValidated = validateAndPromotePainPoints(
        Array.isArray(secondPass.painPoints)
          ? (secondPass.painPoints as unknown as RawPainPoint[])
          : [],
        input.groundableMissingFields,
      );
      // Only adopt the second pass when it actually improved things.
      // Otherwise stick with the first so we don't overwrite a richer
      // hypotheses[] with a worse one.
      if (secondValidated.grounded.length > 0) {
        chosenPass = secondPass;
        chosenValidated = secondValidated;
      }
    } catch (rerr) {
      logger.warn("agent_workers.lead_intelligence_brief.reprompt_failed", {
        leadId,
        workspaceId,
        err: rerr instanceof Error ? rerr.message : String(rerr),
      });
    }
  }

  // If even the second pass produced zero grounded painPoints AND the
  // first pass also produced none AND the model emitted any pain
  // claims at all, log the typed error so the dashboard catches the
  // pattern. We do NOT crash — the brief output stays usable; the
  // typed painPoints[] just stays empty.
  if (
    chosenValidated.grounded.length === 0 &&
    chosenValidated.promoted.length + chosenValidated.dropped > 0
  ) {
    const err = new TruthLayerError("E_BRIEF_PAINPOINT_UNGROUNDED", {
      leadId,
      workspaceId,
      promoted: chosenValidated.promoted.length,
      dropped: chosenValidated.dropped,
    });
    logger.warn("[truth] E_BRIEF_PAINPOINT_UNGROUNDED", {
      leadId,
      workspaceId,
      promoted: chosenValidated.promoted.length,
      dropped: chosenValidated.dropped,
      message: err.message,
    });
  }

  // Apply the website-claim gate AFTER painPoints validation so the
  // telemetry events fire in a stable order in the test logs.
  const wgt = gateWebsiteClaim(
    chosenPass.whyGoodTarget ?? null,
    input.websiteVerificationStatus,
  );

  // Merge model-emitted hypotheses with the auto-promoted ones from
  // the painPoints validator. De-duplicate by claim (case-insensitive)
  // so a model that emitted the same claim in both arrays doesn't
  // double-render in the UI.
  const modelHypotheses = normalizeHypotheses(
    Array.isArray(chosenPass.hypotheses)
      ? (chosenPass.hypotheses as unknown as RawHypothesis[])
      : [],
  );
  const merged: Hypothesis[] = [];
  const seen = new Set<string>();
  for (const h of [...modelHypotheses, ...chosenValidated.promoted]) {
    const key = h.claim.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(h);
  }

  // Re-derive `confirmedPainPoints` from the validated grounded set
  // so the legacy back-compat surface (opener-writer whitelist,
  // FourThingsCard) cannot ship a claim that didn't survive the
  // grounding check. If the model already supplied a tighter list
  // (subset of grounded.claim), keep that — the rep's whitelist is
  // never WIDER than the validated grounded set.
  const groundedClaims = new Set(
    chosenValidated.grounded.map((p) => p.claim.toLowerCase().trim()),
  );
  const modelConfirmed = Array.isArray(chosenPass.confirmedPainPoints)
    ? chosenPass.confirmedPainPoints.filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const confirmedPainPoints =
    modelConfirmed.length > 0
      ? modelConfirmed.filter((s) =>
          groundedClaims.has(s.toLowerCase().trim()),
        )
      : chosenValidated.grounded.map((p) => p.claim);

  // ---- Telemetry (master plan §3 T-D) ----
  logger.info("[truth-telemetry]", {
    event: "truth.brief.pain_quoted",
    leadId,
    workspaceId,
    count: chosenValidated.grounded.length,
  });
  logger.info("[truth-telemetry]", {
    event: "truth.brief.hypothesis_count",
    leadId,
    workspaceId,
    count: merged.length,
  });
  if (wgt.blocked) {
    logger.info("[truth-telemetry]", {
      event: "truth.brief.website_claim_blocked",
      leadId,
      workspaceId,
    });
  }

  return {
    ...chosenPass,
    painPoints: chosenValidated.grounded,
    hypotheses: merged,
    whyGoodTarget: wgt.sanitized,
    websiteClaimBlocked: wgt.blocked,
    confirmedPainPoints,
    briefMode: "v2",
  };
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) {
    throw new Error("LEAD_INTELLIGENCE_BRIEF requires a lead context");
  }
  const lead = ctx.lead;
  const leadId = lead.id;
  const workspaceId = ctx.workspaceId;

  // Pull the latest dossier markdown if any (for prompt context).
  const dossierRun = await prisma.agentRun.findFirst({
    where: {
      workspaceId,
      leadId,
      workerKind: "LEAD_DOSSIER_GENERATOR",
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  const dossierMarkdown =
    dossierRun?.outputJson && typeof dossierRun.outputJson === "object" &&
    "markdown" in (dossierRun.outputJson as Record<string, unknown>)
      ? String((dossierRun.outputJson as Record<string, unknown>).markdown ?? "")
      : null;

  const recentRuns = await prisma.agentRun.findMany({
    where: {
      workspaceId,
      leadId,
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      workerKind: { notIn: ["LEAD_INTELLIGENCE_BRIEF", "LEAD_DOSSIER_GENERATOR"] },
    },
    orderBy: { finishedAt: "desc" },
    take: 12,
    select: { workerKind: true, outputJson: true },
  });

  // Pre-load active campaigns so the brief can recommend an enrollment
  // and mention the campaign by name in the talking points / next
  // action. Limit to the 8 most-recently-updated active sequences;
  // workspaces that have more should rely on the ICP-fit matchedCampaignId
  // signal coming from the scorer to pick the right one.
  const activeSequences = await prisma.sequence.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, name: true, niche: true },
  });

  // Resolve the ICP-fit matched campaign id from the most recent
  // SALES_OPPORTUNITY_SCORER run so the brief knows which campaign
  // (if any) the lead actually fits. Falls back to null when scorer
  // output predates the icpFit field.
  const scorerRun = await prisma.agentRun.findFirst({
    where: {
      workspaceId,
      leadId,
      workerKind: "SALES_OPPORTUNITY_SCORER",
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  const matchedCampaignId =
    scorerRun?.outputJson &&
    typeof scorerRun.outputJson === "object" &&
    "icpFit" in (scorerRun.outputJson as Record<string, unknown>) &&
    typeof (scorerRun.outputJson as Record<string, unknown>).icpFit === "object" &&
    (scorerRun.outputJson as Record<string, { matchedCampaignId?: string | null }>)
      .icpFit?.matchedCampaignId
      ? String(
          (scorerRun.outputJson as Record<string, { matchedCampaignId?: string | null }>)
            .icpFit.matchedCampaignId,
        )
      : null;

  const memoryRows = await listMemoryByLead({ workspaceId, leadId, take: 12 });

  const features = (lead.websiteAudit?.rawFeaturesJson as WebsiteFeatures | null) ?? null;
  const checklist = runAuditChecklist(
    features,
    lead.hasWebsite,
    ctx.workspace.niche,
    lead.subNicheSlug,
  );

  const reviewAnalysis = lead.reviewAnalysis;
  const auditScorePct = features ? checklist.summary.scorePercent : null;
  const reviewLeadScore = reviewAnalysis ? reviewAnalysis.leadScore : null;
  const opportunityScore = lead.salesOpportunity?.opportunityScore ?? null;

  const { score: salesConfidence, breakdown } = computeSalesConfidence({
    auditScorePct,
    reviewLeadScore,
    opportunityScore,
  });

  const subNicheSlug = lead.subNicheSlug as string | null;
  const nicheSlug = lead.nicheSlug as string | null;
  const resolvedSlug = subNicheSlug ?? nicheSlug ?? null;
  const nichePack = resolvedSlug ? getNicheBySlug(resolvedSlug) ?? null : null;

  const auditFeaturesForPrompt = lead.websiteAudit
    ? {
        reachable: lead.websiteAudit.reachable,
        crawlError: lead.websiteAudit.crawlError,
        httpStatus: lead.websiteAudit.httpStatus,
        title: lead.websiteAudit.title,
        loadTimeMs: lead.websiteAudit.loadTimeMs,
        mobileFriendlyGuess: lead.websiteAudit.mobileFriendlyGuess,
        hasContactForm: lead.websiteAudit.hasContactForm,
        hasBookingSystem: lead.websiteAudit.hasBookingSystem,
        hasEcommerce: lead.websiteAudit.hasEcommerce,
        servicesDetected: lead.websiteAudit.servicesDetected,
        bookingProvider: lead.websiteAudit.bookingProvider,
      }
    : null;

  const newVersion = (lead.intelligenceVersion ?? 0) + 1;

  // Pull a short voice-note transcript bag for the prompt.
  const voiceNotes = await prisma.voiceNote.findMany({
    where: { leadId, workspaceId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { transcript: true, createdAt: true },
  });

  // Truth Layer T-D — derive workspace-scope inputs for the V2 path
  // BEFORE the try/catch so the post-validators can still run on the
  // legacy fallback if needed.
  const websiteVerificationStatus =
    (lead.websiteVerificationStatus as WebsiteVerificationStatus | null) ?? null;
  const groundableMissingFields = computeGroundableMissingFields({
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
    websiteVerificationStatus,
    googleMapsUri: lead.googleMapsUri ?? null,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    businessStatus: lead.businessStatus,
  });
  const briefV2Enabled = isTruthLayerFlagEnabled("TRUTH_LAYER_BRIEF_V2", {
    workspaceId,
  });

  const promptInput: BriefPromptInput = {
    businessName: lead.businessName,
    niche: ctx.workspace.niche,
    subNiche: subNicheSlug,
    address: lead.formattedAddress,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    websiteUrl: lead.websiteUrl,
    workspaceLanguage: ctx.workspace.language ?? "en",
    workspaceOffer: ctx.workspace.offerName,
    workspaceValueProp: ctx.workspace.valueProposition,
    workspaceObjective: ctx.workspace.objective ?? null,
    workspaceTone: ctx.workspace.tone ?? null,
    workspaceOfferHook: ctx.workspace.offerHook ?? null,
    workspaceSocialProof: ctx.workspace.socialProof ?? null,
    workspaceSenderName: ctx.workspace.senderName ?? null,
    activeCampaigns: activeSequences.map((s) => ({
      id: s.id,
      name: s.name,
      niche: s.niche ?? null,
    })),
    matchedCampaignId,
    audit: auditFeaturesForPrompt,
    auditChecklistText: `Audit summary: ${checklist.summary.passed}/${checklist.summary.totalChecks - checklist.summary.unknown} checks passed (${checklist.summary.scorePercent}%).`,
    reviewAnalysis: (reviewAnalysis as unknown) as Record<string, unknown> | null,
    salesOpportunity: (lead.salesOpportunity as unknown) as Record<string, unknown> | null,
    socialProfiles:
      (lead.websiteAudit?.socialProfiles as Record<string, string | null> | null) ?? null,
    voiceNotes: voiceNotes.map((v) => ({
      transcript: v.transcript,
      createdAt: v.createdAt.toISOString(),
    })),
    dossierMarkdown,
    memorySnippets: memoryRows.map((m) => ({ kind: m.kind, text: m.text })),
    agentRunSummaries: recentRuns.map((r) => ({
      workerKind: r.workerKind,
      output: typeof r.outputJson === "string"
        ? r.outputJson
        : JSON.stringify(r.outputJson ?? {}),
    })),
    nicheLabel: nichePack?.label ?? null,
    nichePitchAngle: nichePack?.pitchAngle ?? null,
    preComputedConfidence: salesConfidence,
    websiteVerificationStatus,
    groundableMissingFields,
  };

  let brief: Omit<BriefOutput, "intelligenceVersion" | "generatedAt">;
  try {
    if (briefV2Enabled) {
      brief = await runBriefV2Pipeline({
        input: promptInput,
        intelligenceVersion: newVersion,
        leadId,
        workspaceId,
      });
    } else {
      brief = await generateBriefLegacy(promptInput, newVersion);
      // Telemetry parity (master plan §4 shadow-run rule): even on
      // the flag-OFF path we run the post-validators in non-mutating
      // mode so the dashboard sees the same `truth.brief.*` events
      // and the Release Manager has a baseline to A/B against.
      const validated = validateAndPromotePainPoints(
        Array.isArray(brief.painPoints)
          ? (brief.painPoints as unknown as RawPainPoint[])
          : [],
        groundableMissingFields,
      );
      const wgt = gateWebsiteClaim(brief.whyGoodTarget ?? null, websiteVerificationStatus);
      logger.info("[truth-telemetry]", {
        event: "truth.brief.pain_quoted",
        leadId,
        workspaceId,
        count: validated.grounded.length,
        shadow: true,
      });
      logger.info("[truth-telemetry]", {
        event: "truth.brief.hypothesis_count",
        leadId,
        workspaceId,
        count: validated.promoted.length + (brief.hypotheses?.length ?? 0),
        shadow: true,
      });
      if (wgt.blocked) {
        logger.info("[truth-telemetry]", {
          event: "truth.brief.website_claim_blocked",
          leadId,
          workspaceId,
          shadow: true,
        });
      }
    }
  } catch (err) {
    // Fall back to a deterministic brief — Gemini hiccups should not
    // block the salesConfidence rollup landing on the leads list.
    logger.warn("agent_workers.lead_intelligence_brief.gemini_failed_fallback", {
      leadId,
      err: err instanceof Error ? err.message : String(err),
    });
    brief = {
      salesConfidence,
      confidenceBreakdown: breakdown,
      headline: `${lead.businessName} (${lead.subNicheSlug ?? lead.nicheSlug ?? "lead"})`,
      talkingPoints: [
        ...(opportunityScore != null ? [`Sales opportunity score: ${opportunityScore}/100.`] : []),
        ...(auditScorePct != null ? [`Website audit score: ${auditScorePct}%.`] : []),
        ...(reviewLeadScore != null ? [`Review lead score: ${reviewLeadScore}/100.`] : []),
      ],
      openerSeed: `Hi, I work with ${ctx.workspace.niche === "RESTAURANT_TECH" ? "restaurants" : "businesses"} like ${lead.businessName} on improving their booking flow.`,
      bestTimeToCall: null,
      dnc: lead.dnc ?? false,
      nextAction: { kind: "NEEDS_RESEARCH", due: null, note: "AI brief unavailable; rep should review manually." },
      replyObjections: [],
      redFlags: [],
      evidence: [],
      // Fallback brief has no LLM-grounded pain analysis, so we
      // intentionally leave both arrays empty. The opener-writer
      // treats empty arrays as "no whitelist" and falls back to its
      // generic-but-safe pitch path rather than fabricating pains.
      confirmedPainPoints: [],
      confirmedMissingFeatures: [],
      painPoints: [],
      hypotheses: [],
      whyGoodTarget: null,
      websiteClaimBlocked: false,
      briefMode: "legacy",
    };
  }

  // ----- Faz 2/4 — Claude Head Agent synthesis pass (shadow + canary) -----
  // Runs ON TOP of the deterministic v2 brief, only when the flag is on
  // for this workspace, Claude is configured, and the niche routes to a
  // vertical pack (F&B today). It never throws and never mutates the
  // deterministic scores. In "shadow" mode it runs for telemetry ONLY
  // (no attach, no write-back); in "live" mode it attaches an additive
  // account-level decision — but only after the deterministic QA gate
  // passes. A QA-failed decision is logged and discarded.
  let headAgentTokens = 0;
  const headAgentMode = getHeadAgentMode({ workspaceId });
  if (headAgentMode !== "off" && isFnbNiche(ctx.workspace.niche)) {
    // Multi-location context: a lead whose account spans >1 location.
    let isMultiLocation: boolean | null = null;
    if (lead.accountId) {
      const siblingCount = await prisma.lead.count({
        where: { workspaceId, accountId: lead.accountId },
      });
      isMultiLocation = siblingCount > 1 ? true : null;
    }

    const headAgent = await runHeadAgentSynthesis({
      workspaceId,
      leadId,
      businessName: lead.businessName,
      niche: ctx.workspace.niche,
      address: lead.formattedAddress,
      substrate: {
        hasWebsite: lead.hasWebsite,
        websiteUrl: lead.websiteUrl,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        priceLevel: lead.priceLevel ?? null,
        isMultiLocation,
        features,
        audit: lead.websiteAudit
          ? {
              reachable: lead.websiteAudit.reachable,
              hasBookingSystem: lead.websiteAudit.hasBookingSystem,
              bookingProvider: lead.websiteAudit.bookingProvider,
            }
          : null,
        reviewAnalysis: reviewAnalysis
          ? {
              painPhrases: (reviewAnalysis as unknown as Record<string, unknown>).painPhrases,
              weaknessKpis: (reviewAnalysis as unknown as Record<string, unknown>).weaknessKpis,
              strengthPhrases: (reviewAnalysis as unknown as Record<string, unknown>).strengthPhrases,
            }
          : null,
      },
      briefContext: {
        headline: brief.headline,
        talkingPoints: brief.talkingPoints,
        confirmedPainPoints: brief.confirmedPainPoints,
        salesConfidence: brief.salesConfidence,
      },
    });

    if (headAgent) {
      headAgentTokens = headAgent.usage.totalTokens;
      const agree = headAgent.deterministicPrimary === headAgent.agentPrimary;
      const attached = headAgentMode === "live" && headAgent.qa.passed;

      // Shadow-run telemetry — emitted in BOTH shadow and live so the
      // dashboard can compare the Claude decision against the
      // deterministic baseline (agree rate, QA pass rate) before a tenant
      // is flipped live, and audit attach decisions once live.
      logger.info("[head-agent-telemetry]", {
        event: "head_agent.synthesis",
        leadId,
        workspaceId,
        mode: headAgentMode,
        attached,
        qaPassed: headAgent.qa.passed,
        qaIssues: headAgent.qa.issues,
        qaWarnings: headAgent.qa.warnings,
        deterministicPrimary: headAgent.deterministicPrimary,
        agentPrimary: headAgent.agentPrimary,
        agree,
        confidence: headAgent.decision.confidence,
        conflicts: headAgent.decision.sourceConflicts.length,
        recommendedPackage: headAgent.decision.recommendedPackage,
        rounds: headAgent.rounds,
        toolCalls: headAgent.toolCalls,
        tokens: headAgentTokens,
      });

      // Attach ONLY when live AND QA passed. Shadow never attaches, so
      // write-back + UI stay on the deterministic baseline while we
      // evaluate the agent.
      if (attached) {
        brief.headAgent = headAgent.decision;
        brief.briefMode = "head-agent";
      }
    }
  }

  // Derive a deterministic lead temperature from the freshly computed
  // sales confidence + inbound SLA so the leads list, the
  // `revint_lead_temperature` HubSpot property and the App Card stay
  // consistent. The qualification flow later refines this with real call
  // signals (disposition / qualified stage) via `computeTemperature`.
  const playbook = await getPlaybook(prisma, workspaceId);
  const currentStage = playbook.stages.find(
    (s) => s.key === lead.playbookStageKey,
  );
  const hoursSinceInbound = lead.inboundReceivedAt
    ? (Date.now() - lead.inboundReceivedAt.getTime()) / 3_600_000
    : null;
  const leadTemperature = deriveLeadTemperature(playbook, {
    hoursSinceInbound,
    lastDisposition: lead.lastDisposition,
    qualified: !!currentStage?.isQualified,
    salesConfidence: brief.salesConfidence,
  });

  // Phase 0/B5 — write the rollup back onto the Lead so the leads
  // list query and Today's Queue can sort/filter on a single column.
  await prisma.lead.updateMany({
    where: { id: leadId, workspaceId },
    data: {
      salesConfidence: brief.salesConfidence,
      leadTemperature,
      intelligenceVersion: newVersion,
    },
  });

  // Phase 2 — push the refreshed intelligence to HubSpot (best-effort
  // outbox). `enqueueCrmWriteback` safely SKIPs when the workspace has no
  // CRM connection or the lead has no contact/deal linkage, so this is a
  // no-op for non-HubSpot workspaces and never blocks the brief.
  void enqueueCrmWriteback(prisma, {
    workspaceId,
    leadId,
    reason: "analysis",
  }).catch((err) =>
    logger.warn("hubspot.writeback.analysis_failed", {
      leadId,
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    }),
  );

  // ----- SDR Brain v2 — reasoning + arbitration + final NBA upsert -----
  // Reads the T1 + T2 substrate from semantic memory and active
  // LeadTrigger rows, runs the deterministic contradiction pre-pass,
  // and persists the final LeadNextAction with a typed reasoningGraph.
  const sdrBrainResult = await runSdrBrainPass({
    workspaceId,
    leadId,
    lead,
    brief,
    auditScorePct,
    reviewLeadScore,
    opportunityScore,
  });

  // Emit the brain-completed event so the UI cache + downstream
  // listeners (analytics, Slack notifications) can react, and the
  // dedicated `sdr_brain_completed` chain (chains.ts) refreshes the
  // opener + objection list against the locked decision.
  //
  // Phase 0 hot-fix — the previous try/catch swallowed every emit
  // failure because the chain itself was unregistered. Now that the
  // chain exists in CHAINS, emit must succeed; a failure here is a
  // real degradation (worker plan/quota issue, DB outage) and should
  // surface as an AgentRun warning instead of being silently dropped.
  // We still don't fail the brief itself — the brief output is the
  // primary rep-facing artifact — but we log at warn level with the
  // operational context so the SDR Brain v2 Health dashboard (Faz 7)
  // can alert on it.
  if (sdrBrainResult) {
    try {
      await ctx.emit("sdr_brain_completed", {
        leadActionId: sdrBrainResult.leadActionId,
        confidence: sdrBrainResult.confidence,
      });
    } catch (err) {
      logger.warn("agent_workers.lead_intelligence_brief.sdr_brain_emit_failed", {
        leadId,
        workspaceId,
        leadActionId: sdrBrainResult.leadActionId,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  }

  const output: BriefOutput & { sdrBrain?: typeof sdrBrainResult } = {
    ...brief,
    intelligenceVersion: newVersion,
    generatedAt: new Date().toISOString(),
    sdrBrain: sdrBrainResult,
  };

  logger.info("agent_workers.lead_intelligence_brief.done", {
    leadId,
    intelligenceVersion: newVersion,
    salesConfidence: brief.salesConfidence,
    hasDossier: dossierMarkdown != null,
    sdrBrainContradictionCount: sdrBrainResult?.contradictionCount ?? 0,
  });

  return {
    output,
    costTokens: headAgentTokens,
  };
};

/**
 * Maps a free-form `BriefOutput.nextAction.kind` string to the
 * `NextActionKind` enum used by `LeadNextAction.actionKind`. Unknown
 * values fall back to `WAIT_FOR_REPLY` (the safe default — we don't
 * want a typo in Gemini output to escalate every lead to AE).
 */
function mapNextActionKind(raw: string | undefined | null): NextActionKind {
  const allowed: NextActionKind[] = [
    "CALL_NOW",
    "CALL_AT_WINDOW",
    "EMAIL_FIRST",
    "WHATSAPP",
    "WAIT_FOR_REPLY",
    "DROP_LEAD",
    "RE_ENGAGE",
    "BOOK_DISCOVERY",
    "ENROLL_IN_CAMPAIGN",
    "ESCALATE_TO_AE",
  ];
  if (raw && allowed.includes(raw as NextActionKind)) return raw as NextActionKind;
  return "WAIT_FOR_REPLY";
}

function inferChannel(actionKind: NextActionKind): Channel | null {
  switch (actionKind) {
    case "CALL_NOW":
    case "CALL_AT_WINDOW":
      return "PHONE";
    case "EMAIL_FIRST":
      return "EMAIL";
    case "WHATSAPP":
      return "WHATSAPP";
    case "BOOK_DISCOVERY":
    case "RE_ENGAGE":
    case "ENROLL_IN_CAMPAIGN":
      return "EMAIL";
    case "WAIT_FOR_REPLY":
    case "DROP_LEAD":
    case "ESCALATE_TO_AE":
    default:
      return null;
  }
}

/**
 * Builds the SDR Brain reasoning graph + persists the final
 * LeadNextAction. Returns null when the brain has nothing to write
 * (no triggers, no T2 substrate) — the brief alone is enough.
 *
 * Side effects:
 *   - Supersedes any `isPreliminary = true` LeadNextAction rows.
 *   - Inserts a new `isPreliminary = false` row with the reasoning
 *     graph + arbitration log.
 *   - Inserts InsightApplication rows for each insight that the
 *     brain selected (top 1 by Wilson lower-bound).
 */
async function runSdrBrainPass(args: {
  workspaceId: string;
  leadId: string;
  lead: AgentWorkerContext["lead"];
  brief: Omit<BriefOutput, "intelligenceVersion" | "generatedAt">;
  auditScorePct: number | null;
  reviewLeadScore: number | null;
  opportunityScore: number | null;
}): Promise<{
  leadActionId: string;
  actionKind: NextActionKind;
  confidence: number;
  contradictionCount: number;
  insightApplied: string | null;
} | null> {
  const { workspaceId, leadId, lead, brief } = args;
  if (!lead) return null;

  // Pull active triggers and T2 reasoning summaries written by
  // WHY_NOW / INSIGHT_MATCH / COMMITTEE / OBJECTIONS / BANT.
  //
  // Phase 0 hot-fix — `LeadTrigger` has no `isActive` column; the
  // schema uses `decayedAt IS NULL` to mean "currently active". The
  // previous `isActive: true` filter blew up at runtime (caught by the
  // outer try/catch), which silently dropped every trigger from the
  // T2 snapshot and starved the contradiction detector + reasoning
  // graph. Match `bant-inferrer.ts:38` exactly.
  const [triggers, summaryMemory] = await Promise.all([
    prisma.leadTrigger.findMany({
      where: { workspaceId, leadId, decayedAt: null },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      take: 12,
    }),
    prisma.semanticMemory.findMany({
      where: { workspaceId, leadId, kind: "REASONING_SUMMARY" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        text: true,
        refType: true,
        metadata: true,
      },
    }),
  ]);

  // Bucket the T2 reasoning summaries by the worker that wrote them.
  // refType keys come from `REASONING_SUMMARY_REF_TYPES` — every
  // writer + reader shares the same constant so casing cannot drift.
  //
  // V2-cleanup — only WHY_NOW_SYNTHESIZER survives. BANT_INFERRER,
  // COMMERCIAL_INSIGHT_MATCHER, BUYING_COMMITTEE_MAPPER, and
  // OBJECTION_PREDICTOR were removed (enterprise framework workers
  // that produced empty or copy-paste output for SMB restaurants).
  const whyNow = summaryMemory.find(
    (m) => m.refType === REASONING_SUMMARY_REF_TYPES.WhyNowSynthesizer,
  );

  const whyNowMeta = (whyNow?.metadata as { urgencyScore?: number; recommendedTimingDays?: number } | null) ?? null;

  // Bail when we have literally nothing to reason about — the brief
  // alone is the rep-facing artifact.
  if (triggers.length === 0 && !whyNow) {
    return null;
  }

  // Build the T2 snapshot in the shape the contradiction detector wants.
  const t2Snapshot: T2Snapshot = {
    whyNow: whyNowMeta
      ? {
          urgency: whyNowMeta.urgencyScore ?? 0,
          headline: whyNow?.text ?? "",
        }
      : null,
    scorer:
      args.opportunityScore != null
        ? {
            opportunityScore: args.opportunityScore,
            icpFit: lead.icpFitScore ?? null,
          }
        : null,
    triggers: triggers.map((t) => ({
      id: t.id,
      type: t.type,
      severity: t.severity,
      confidence: t.confidence,
    })),
    audit: lead.websiteAudit
      ? {
          checklistScorePct: args.auditScorePct,
          hasBookingSystem: lead.websiteAudit.hasBookingSystem,
          hasEcommerce: lead.websiteAudit.hasEcommerce,
        }
      : null,
    lead: {
      priceLevel: lead.priceLevel ?? null,
      reviewCount: lead.reviewCount ?? null,
      rating: lead.rating ?? null,
    },
  };

  // Run the deterministic contradiction detector pre-pass.
  const contradictionResults = detectContradictions(t2Snapshot);

  // Build the reasoning graph using the actual builder API. Node ids
  // follow the conventions documented in `reasoning-graph.ts`:
  //   trigger.<id>, audit.checklist, ev.review.<id>, whyNow.*, decision.
  // (BANT, insight-match, committee, and objection-predict nodes were
  // dropped along with their workers in the V2 cleanup.)
  const builder = new ReasoningGraphBuilder("sdr-brain-v2");
  const declaredNodeIds = new Set<string>();
  const declare = (id: string): string => {
    declaredNodeIds.add(id);
    return id;
  };

  const evidenceIds: string[] = [];
  for (const trig of triggers.slice(0, 6)) {
    const id = declare(`trigger.${trig.id}`);
    builder.addEvidence(
      id,
      `${trig.type} severity=${trig.severity} confidence=${Math.round(trig.confidence * 100)}%`,
      trig.severity / 100,
      trig.confidence,
      { workerKind: "TRIGGER_DETECTOR", refType: "LeadTrigger", refId: trig.id },
    );
    evidenceIds.push(id);
  }
  if (args.auditScorePct != null) {
    const id = declare("audit.checklist");
    builder.addEvidence(id, `${args.auditScorePct}% audit checks passed`, 0.4, 0.9, {
      workerKind: "WEBSITE_AUDITOR",
    });
    evidenceIds.push(id);
  }
  if (args.reviewLeadScore != null) {
    const id = declare("ev.reviews");
    builder.addEvidence(id, `Review lead score ${args.reviewLeadScore}/100`, 0.3, 0.85, {
      workerKind: "REVIEW_ANALYST",
    });
    evidenceIds.push(id);
  }
  if (args.opportunityScore != null) {
    const id = declare("scorer.opportunity");
    builder.addEvidence(id, `Opportunity score ${args.opportunityScore}/100`, 0.3, 0.8, {
      workerKind: "SALES_OPPORTUNITY_SCORER",
    });
    evidenceIds.push(id);
  }

  // Inference nodes per T2 reasoner. Map each to a stable id so
  // contradiction edges can reference them. Only WHY_NOW_SYNTHESIZER
  // survived the V2 cleanup, so this is now a single optional branch.
  const inferenceIds: string[] = [];
  if (whyNow) {
    const id = declare("whyNow.urgency");
    builder.addInference(id, whyNow.text.slice(0, 200), 0.7, 0.75);
    inferenceIds.push(id);
    for (const ev of evidenceIds.slice(0, 3)) builder.link(ev, id, "SUPPORTS");
  }

  // Apply the contradiction detector results: each becomes a record
  // on the graph + a CONTRADICTS edge (the builder mirrors it
  // automatically inside addContradiction). Contradictions referencing
  // node ids we didn't declare still surface in the arbitration log
  // but are NOT mirrored as graph edges (assertGraphIntegrity guard).
  const contradictionRecords: import("@/lib/sdr-brain/reasoning-graph").ContradictionRecord[] = [];
  for (const c of contradictionResults) {
    const record: import("@/lib/sdr-brain/reasoning-graph").ContradictionRecord = {
      code: c.code,
      fromNodeId: c.fromNodeId,
      toNodeId: c.toNodeId,
      reason: c.reason,
      // Default to BLEND so the brief presents both sides of the
      // contradiction. BANT-precedence resolution was dropped with
      // the BANT_INFERRER worker (V2 cleanup).
      resolution: "BLEND",
      resolverNote: "Deterministic policy; Gemini arbitration is future work.",
    };
    if (declaredNodeIds.has(c.fromNodeId) && declaredNodeIds.has(c.toNodeId)) {
      builder.addContradiction(record);
    }
    contradictionRecords.push(record);
  }

  // Decision node — the final NBA.
  const actionKind = mapNextActionKind(brief.nextAction.kind);
  const channel = inferChannel(actionKind);
  const decisionConfidence = brief.salesConfidence;
  declare("decision");
  builder.addDecision(
    "decision",
    `NBA=${actionKind}: ${brief.nextAction.note.slice(0, 160)}`,
    1,
    decisionConfidence / 100,
  );
  for (const inf of inferenceIds) builder.link(inf, "decision", "DERIVES");
  for (const ev of evidenceIds.slice(0, 4)) builder.link(ev, "decision", "SUPPORTS");

  const reasoningGraph: ReasoningGraph = builder.build();

  // Compute timing window.
  const recommendedDays = whyNowMeta?.recommendedTimingDays ?? 14;
  const timingWindowEnd = new Date(Date.now() + recommendedDays * 24 * 60 * 60 * 1000);

  // Supersede any preliminary NBA + insert the final one.
  const nextVersion = await nextLeadActionVersion(workspaceId, leadId);

  await prisma.leadNextAction.updateMany({
    where: {
      workspaceId,
      leadId,
      isPreliminary: true,
      supersededAt: null,
    },
    data: { supersededAt: new Date() },
  });

  // Also supersede any prior FINAL NBA so only the latest version is
  // the "active" recommendation. The OUTCOME_ATTRIBUTOR queries
  // `supersededAt IS NULL` to attach outcomes — we don't want a stale
  // recommendation to absorb the credit / blame for a fresh reply.
  await prisma.leadNextAction.updateMany({
    where: {
      workspaceId,
      leadId,
      isPreliminary: false,
      supersededAt: null,
    },
    data: { supersededAt: new Date() },
  });

  const created = await prisma.leadNextAction.create({
    data: {
      workspaceId,
      leadId,
      version: nextVersion,
      isPreliminary: false,
      actionKind,
      timingWindowStart: new Date(),
      timingWindowEnd,
      channel,
      // V2-cleanup — primaryAngleId nulled. The CommercialInsightMatcher
      // worker that populated it was removed; SalesOpportunityScorer's
      // `bestSalesAngle` is the canonical angle source going forward.
      primaryAngleId: null,
      triggerIds: triggers.slice(0, 6).map((t) => t.id),
      openingHook: brief.openerSeed.slice(0, 800),
      whatNotToPitch: brief.confirmedMissingFeatures.slice(0, 5),
      qualificationGap: [],
      predictedObjections: brief.replyObjections.slice(0, 5),
      recommendedFramework: "AIDA",
      confidence: decisionConfidence,
      reasoning: brief.headline.slice(0, 4000),
      reasoningGraph: reasoningGraph as unknown as Prisma.InputJsonValue,
      arbitrationRecords: contradictionRecords as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    leadActionId: created.id,
    actionKind,
    confidence: decisionConfidence,
    contradictionCount: contradictionRecords.length,
    insightApplied: null,
  };
}

async function nextLeadActionVersion(workspaceId: string, leadId: string): Promise<number> {
  const latest = await prisma.leadNextAction.findFirst({
    where: { workspaceId, leadId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}
