/**
 * Head Agent synthesis pass (Faz 2).
 *
 * The "üstten bakan beyin". Runs AFTER the deterministic pipeline has
 * produced the brief substrate (audit checklist, review analysis,
 * scores, triggers, memory). It does NOT gather data or compute the
 * deterministic scores — those stay deterministic so the leads-list
 * ordering + grounding gate are stable. Instead it:
 *
 *   1. Derives F&B signals from the substrate (pure).
 *   2. Runs the deterministic vertical-pack scorer to get a GROUNDED
 *      module-fit shortlist + ranked plays (primary/secondary/excluded).
 *   3. Hands that shortlist + the brief substrate to Claude and asks for
 *      ONE account-level decision: primary angle, talk track, confidence,
 *      which modules to pitch / avoid, and any cross-source conflicts.
 *
 * Claude can only choose from the deterministic shortlist — it cannot
 * invent module fit. Every decision carries `evidenceRefs` (signal keys)
 * so the brief's evidence chain stays grounded.
 *
 * Failure is non-fatal: any error (not configured, timeout, parse fail,
 * over quota) returns `null` and the caller keeps the deterministic v2
 * brief. A Claude hiccup must never block the leads list.
 */
import { logger } from "@/lib/logger";
import {
  runClaudeToolLoop,
  parseClaudeJson,
  getHeadAgentModel,
  isAnthropicConfigured,
  type ClaudeUsage,
} from "./claude";
import { AGENT_TOOLS, executeAgentTool } from "./tools";
import { computeFnbModuleFit, type FnbSignals } from "@/lib/playbook/fnb-module-fit";
import type { FineDineModule } from "@/lib/playbook/vertical-pack";

/** Niche slugs that route to the F&B pack. */
const FNB_NICHES = new Set(["RESTAURANT_TECH", "restaurant", "restaurants", "fnb", "food_beverage"]);

export function isFnbNiche(niche: string | null | undefined): boolean {
  if (!niche) return false;
  return FNB_NICHES.has(niche) || FNB_NICHES.has(niche.toLowerCase());
}

// ---------------------------------------------------------------------------
// Signal derivation (pure) — substrate -> FnbSignals
// ---------------------------------------------------------------------------

const SLOW_SERVICE_KEYWORDS = [
  "slow",
  "wait",
  "waiting",
  "queue",
  "line",
  "understaff",
  "short staff",
  "yavaş",
  "kuyruk",
  "bekle",
  "servis yavaş",
  "geç geldi",
];
const TOURIST_LANGUAGE_KEYWORDS = [
  "english",
  "language",
  "tourist",
  "foreign",
  "translat",
  "no english menu",
  "ingilizce",
  "dil",
  "turist",
  "yabancı",
  "çeviri",
];

function phraseHit(haystack: string[], needles: string[]): boolean {
  if (haystack.length === 0) return false;
  const blob = haystack.join(" \n ").toLowerCase();
  return needles.some((n) => blob.includes(n));
}

/** Raw substrate the derivation needs. All fields optional / defensive. */
export interface HeadAgentSubstrate {
  hasWebsite?: boolean | null;
  websiteUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  isMultiLocation?: boolean | null;
  /** WebsiteFeatures (rawFeaturesJson). */
  features?: {
    hasQrMenu?: boolean | null;
    hasOnlineReservation?: boolean | null;
    hasBookingSystem?: boolean | null;
    hasDeliveryIntegration?: boolean | null;
    detectedMenuTool?: string | null;
    menuUrl?: string | null;
    bookingProvider?: string | null;
  } | null;
  /** websiteAudit row subset. */
  audit?: {
    reachable?: boolean | null;
    hasBookingSystem?: boolean | null;
    bookingProvider?: string | null;
  } | null;
  /** ReviewAnalysis subset (phrases used for ops/tourist signals). */
  reviewAnalysis?: {
    painPhrases?: unknown;
    weaknessKpis?: unknown;
    strengthPhrases?: unknown;
  } | null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        return String(o.label ?? o.phrase ?? o.text ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

/**
 * Derive deterministic F&B signals from the brief substrate. Booleans
 * are explicit tri-state: `false` only when the audit actually returned
 * false; `null`/`undefined` when unknown (audit absent / not a signal).
 */
export function deriveFnbSignals(s: HeadAgentSubstrate): FnbSignals {
  const f = s.features ?? null;
  const audit = s.audit ?? null;
  const ra = s.reviewAnalysis ?? null;

  const reviewPhrases = ra
    ? [...asStringArray(ra.painPhrases), ...asStringArray(ra.weaknessKpis)]
    : [];
  const strengthPhrases = ra ? asStringArray(ra.strengthPhrases) : [];

  // PDF menu: a menuUrl ending in .pdf with no modern menu tool detected.
  const menuUrl = f?.menuUrl ?? null;
  const pdfMenu =
    menuUrl != null
      ? /\.pdf(\?|#|$)/i.test(menuUrl) && !f?.detectedMenuTool
      : null;

  // Website broken: we believe there's a site but the crawler couldn't
  // render it. Only assert when we have both signals.
  const websiteBroken =
    s.hasWebsite === true && audit?.reachable === false ? true : null;

  return {
    hasWebsite: s.hasWebsite ?? null,
    websiteBroken,
    detectedMenuTool: f?.detectedMenuTool ?? null,
    hasQrMenu: f?.hasQrMenu ?? null,
    pdfMenu,
    hasOnlineReservation: f?.hasOnlineReservation ?? null,
    hasBookingSystem: f?.hasBookingSystem ?? audit?.hasBookingSystem ?? null,
    bookingProvider: f?.bookingProvider ?? audit?.bookingProvider ?? null,
    hasOnlineOrdering: f?.hasDeliveryIntegration ?? null,
    slowServiceSignal: ra ? phraseHit(reviewPhrases, SLOW_SERVICE_KEYWORDS) : null,
    touristLanguageSignal: ra
      ? phraseHit([...reviewPhrases, ...strengthPhrases], TOURIST_LANGUAGE_KEYWORDS)
      : null,
    isMultiLocation: s.isMultiLocation ?? null,
    rating: s.rating ?? null,
    reviewCount: s.reviewCount ?? null,
    priceLevel: s.priceLevel ?? null,
  };
}

// ---------------------------------------------------------------------------
// Head Agent decision shape
// ---------------------------------------------------------------------------

export interface HeadAgentModuleRec {
  module: FineDineModule | string;
  readiness: number;
  why: string;
}

export interface HeadAgentConflict {
  claim: string;
  sources: string[];
  note: string;
}

export interface HeadAgentDecision {
  packId: string;
  /** Deterministic primary module the agent anchored on (may be null). */
  primaryModule: string | null;
  /** Rep-facing one-line angle label. */
  primaryAngle: string;
  /** 2-3 sentence approach the rep should open with. */
  talkTrack: string;
  recommendedModules: HeadAgentModuleRec[];
  excludedModules: { module: string; why: string }[];
  /**
   * Name of a REAL workspace package the agent picked (via get_packages),
   * or null when it couldn't map to one. Lets the rep quote an actual
   * offer instead of a generic module.
   */
  recommendedPackage: string | null;
  /** 0-100 head-agent confidence in the chosen angle. */
  confidence: number;
  sourceConflicts: HeadAgentConflict[];
  /** Short rationale (why this angle over the alternatives). */
  reasoning: string;
  /** Signal keys (FnbSignals fields) the decision leaned on. */
  evidenceRefs: string[];
  model: string;
  usageTokens: number;
  generatedAt: string;
}

/** Raw Claude output (pre-validation). */
interface RawDecision {
  primaryAngle?: unknown;
  talkTrack?: unknown;
  confidence?: unknown;
  recommendedModules?: unknown;
  excludedModules?: unknown;
  recommendedPackage?: unknown;
  sourceConflicts?: unknown;
  reasoning?: unknown;
  evidenceRefs?: unknown;
}

const SYSTEM_PROMPT = `You are the Head Sales Strategist for FineDine, a restaurant growth platform (digital menu, QR menu, Order & Pay, online reservations, AI menu builder, guest CRM/loyalty, multi-language menus, multi-location control).

You receive a DETERMINISTIC, evidence-grounded module-fit shortlist as your starting point. You ALSO have READ-ONLY tools to pull more data on demand. Use them when the shortlist is thin or you need to confirm something before committing:
- get_lead_basics — core facts about the venue
- get_full_reviews — full reviewer language (pain/strength/switch phrases)
- get_website_audit — what the venue already has (booking, menu tool, etc.)
- get_dossier — the long-form AI sales narrative
- get_sales_opportunity — the scorer's rationale + recommended package id
- get_packages — the seller's REAL package catalog (names, prices, features)
- get_memory — prior insights/decisions for this lead

Be efficient: only call tools that change your decision. ALWAYS call get_packages before recommending a package so you quote a real offer. When done, make ONE account-level decision a rep can act on in 30 seconds.

HARD RULES:
- Choose the primary angle from the provided module shortlist. Do NOT invent module fit that is not in the shortlist.
- NEVER recommend a module listed under excludedModules (the lead already has it).
- Ground every recommendation in real evidence (matchedSignals or tool data). If evidence is thin, lower your confidence rather than inventing problems.
- recommendedPackage MUST be an exact name from get_packages, or null if none fits.
- Flag genuine cross-source conflicts (e.g. audit says "no reservation" but reviews mention "I booked online").
- Be concrete and specific to THIS venue. No generic filler.

Your FINAL message must be ONLY a JSON object (no prose, no tool calls), with this exact shape:
{
  "primaryAngle": string,            // short rep-facing label, e.g. "Slow service at peak -> Order & Pay"
  "talkTrack": string,               // 2-3 sentences the rep opens with
  "confidence": number,              // 0-100, your confidence in this angle
  "recommendedModules": [ { "module": string, "readiness": number, "why": string } ],
  "excludedModules": [ { "module": string, "why": string } ],
  "recommendedPackage": string | null, // exact package name from get_packages, or null
  "sourceConflicts": [ { "claim": string, "sources": string[], "note": string } ],
  "reasoning": string,               // 1-2 sentences: why this angle beats the alternatives
  "evidenceRefs": string[]           // signal keys / tool facts you leaned on
}`;

function clampConfidence(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asRecArray(v: unknown): HeadAgentModuleRec[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      if (!o.module) return null;
      return {
        module: String(o.module),
        readiness: clampConfidence(o.readiness, 0),
        why: String(o.why ?? ""),
      };
    })
    .filter((x): x is HeadAgentModuleRec => x !== null);
}

function asConflicts(v: unknown): HeadAgentConflict[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      if (!o.claim) return null;
      return {
        claim: String(o.claim),
        sources: Array.isArray(o.sources) ? o.sources.map(String) : [],
        note: String(o.note ?? ""),
      };
    })
    .filter((x): x is HeadAgentConflict => x !== null);
}

/**
 * Deterministic QA gate. Returns `passed: false` on a HARD failure that
 * makes the decision unsafe to surface (no usable angle / recommendation,
 * empty talk track, out-of-range confidence). Soft anomalies (already
 * auto-corrected, e.g. a hallucinated module we dropped) go to
 * `warnings` and DON'T block attaching.
 */
function validateDecision(d: HeadAgentDecision, warnings: string[]): HeadAgentQa {
  const issues: string[] = [];
  if (!d.primaryAngle || d.primaryAngle === "(no angle)") issues.push("missing_primary_angle");
  if (!d.talkTrack || d.talkTrack.trim().length < 20) issues.push("thin_talk_track");
  if (!Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence > 100) {
    issues.push("confidence_out_of_range");
  }
  if (d.recommendedModules.length === 0) issues.push("no_recommended_modules");
  return { passed: issues.length === 0, issues, warnings };
}

export interface HeadAgentInput {
  /** Workspace + lead scope for the agent's read-only tools. */
  workspaceId: string;
  leadId: string;
  businessName: string;
  niche: string | null;
  address?: string | null;
  substrate: HeadAgentSubstrate;
  /** Brief talking points / confirmed pains for extra context. */
  briefContext?: {
    headline?: string | null;
    talkingPoints?: string[];
    confirmedPainPoints?: string[];
    salesConfidence?: number | null;
  };
  timeoutMs?: number;
}

export interface HeadAgentQa {
  passed: boolean;
  /** Hard failures that block attaching the decision. */
  issues: string[];
  /** Soft anomalies we auto-corrected (e.g. cleaned hallucinated module). */
  warnings: string[];
}

export interface HeadAgentRunResult {
  decision: HeadAgentDecision;
  usage: ClaudeUsage;
  qa: HeadAgentQa;
  /** Deterministic primary module (baseline) for shadow comparison. */
  deterministicPrimary: string | null;
  /** Agent's top recommended module. */
  agentPrimary: string | null;
  /** Tool-loop telemetry. */
  rounds: number;
  toolCalls: string[];
}

/**
 * Run the Head Agent synthesis pass. Returns `null` (never throws) when
 * Claude is unavailable or the call fails — the caller keeps the
 * deterministic brief.
 */
export async function runHeadAgentSynthesis(
  input: HeadAgentInput,
): Promise<HeadAgentRunResult | null> {
  if (!isAnthropicConfigured()) return null;
  if (!isFnbNiche(input.niche)) return null;

  const signals = deriveFnbSignals(input.substrate);
  const fit = computeFnbModuleFit(signals);

  // Nothing actionable + no exclusions -> skip the spend.
  if (fit.fits.length === 0 && fit.plays.length === 0) return null;

  const shortlist = {
    packId: fit.packId,
    primaryModule: fit.primaryModule,
    secondaryModules: fit.secondaryModules,
    excludedModules: fit.excludedModules,
    fits: fit.fits.map((f) => ({
      module: f.module,
      readiness: f.readiness,
      reason: f.reason,
      matchedSignals: f.matchedSignals,
      doNotPitch: f.doNotPitch ?? false,
      doNotPitchReason: f.doNotPitchReason ?? null,
    })),
    plays: fit.plays.map((p) => ({
      id: p.id,
      label: p.label,
      module: p.module,
      score: p.score,
      pitch: p.pitch,
      dontPitch: p.dontPitch,
    })),
  };

  const userPayload = {
    business: {
      name: input.businessName,
      niche: input.niche,
      address: input.address ?? null,
      rating: input.substrate.rating ?? null,
      reviewCount: input.substrate.reviewCount ?? null,
    },
    derivedSignals: signals,
    moduleFitShortlist: shortlist,
    brief: input.briefContext ?? {},
  };

  const user = `Lead intelligence substrate (JSON):\n${JSON.stringify(userPayload, null, 2)}\n\nUse tools if you need more data, then return the decision JSON.`;

  try {
    const ctx = { workspaceId: input.workspaceId, leadId: input.leadId };
    const loop = await runClaudeToolLoop({
      system: SYSTEM_PROMPT,
      initialUser: user,
      tools: AGENT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      executeTool: (name, toolInput) => executeAgentTool(ctx, name, toolInput),
      label: "head_agent.fnb_synthesis",
      timeoutMs: input.timeoutMs,
      temperature: 0.2,
      maxTokens: 2048,
      maxRounds: 5,
    });
    const res = { usage: loop.usage };
    const raw = parseClaudeJson<RawDecision>(loop.finalText, "head_agent.fnb_synthesis");

    // QA gate — clean the model output against the deterministic shortlist
    // and collect hard issues (block attach) vs soft warnings (corrected).
    const warnings: string[] = [];
    const excludedSet = new Set(fit.excludedModules.map(String));
    const shortlistModules = new Set(fit.fits.map((f) => String(f.module)));

    const rawRecommended = asRecArray(raw.recommendedModules);
    const recommended = rawRecommended.filter((r) => {
      const mod = String(r.module);
      if (excludedSet.has(mod)) {
        warnings.push(`dropped_excluded:${mod}`);
        return false;
      }
      if (!shortlistModules.has(mod)) {
        warnings.push(`dropped_hallucinated:${mod}`);
        return false;
      }
      return true;
    });

    const finalRecommended =
      recommended.length > 0
        ? recommended
        : fit.fits
            .filter((f) => !f.doNotPitch && f.readiness > 0)
            .slice(0, 3)
            .map((f) => ({ module: f.module, readiness: f.readiness, why: f.reason }));

    const decision: HeadAgentDecision = {
      packId: fit.packId,
      primaryModule: fit.primaryModule,
      primaryAngle: String(raw.primaryAngle ?? "").trim() || "(no angle)",
      talkTrack: String(raw.talkTrack ?? "").trim(),
      recommendedModules: finalRecommended,
      excludedModules: fit.fits
        .filter((f) => f.doNotPitch)
        .map((f) => ({ module: f.module, why: f.doNotPitchReason ?? "Already in place." })),
      recommendedPackage:
        typeof raw.recommendedPackage === "string" && raw.recommendedPackage.trim()
          ? raw.recommendedPackage.trim()
          : null,
      confidence: clampConfidence(raw.confidence, input.briefContext?.salesConfidence ?? 50),
      sourceConflicts: asConflicts(raw.sourceConflicts),
      reasoning: String(raw.reasoning ?? "").trim(),
      evidenceRefs: Array.isArray(raw.evidenceRefs)
        ? raw.evidenceRefs.map(String)
        : fit.fits.flatMap((f) => f.matchedSignals),
      model: getHeadAgentModel(),
      usageTokens: res.usage.totalTokens,
      generatedAt: new Date().toISOString(),
    };

    const qa = validateDecision(decision, warnings);

    return {
      decision,
      usage: res.usage,
      qa,
      deterministicPrimary: fit.primaryModule,
      agentPrimary: finalRecommended[0]?.module ?? null,
      rounds: loop.rounds,
      toolCalls: loop.toolCalls,
    };
  } catch (err) {
    logger.warn("ai_core.head_agent.synthesis_failed", {
      business: input.businessName,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
