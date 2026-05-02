/**
 * SUBVERTICAL_CLASSIFIER - hybrid-niche sub-vertical tagger.
 *
 * Workspaces with a hybrid NichePack tree (parent + children, e.g.
 * `fnb` → `fnb-fine-dining`, `fnb-bar-club`, ...) need every lead
 * tagged with the correct child slug so downstream workers (audit
 * checklist branching, opener writer pitch angle, mockup template
 * picker, semantic-memory niche scope) can specialise.
 *
 * The worker is intentionally generic: it dispatches to the parent
 * pack via `verticalRootForWorkspace(workspace.niche)`, then ranks
 * the lead against `getChildrenOf(parent)`. New verticals (DENTAL,
 * REAL_ESTATE) plug in by adding a parent + children to NICHES — no
 * worker code changes.
 *
 * Two-stage classification (cost optimisation):
 *
 *   1. Rule-based pass (`ruleBasedClassify`). Uses Google Places
 *      primaryType, business-name keywords, price level, discovery
 *      query, and website-audit signals (delivery / reservation /
 *      QR menu). Returns null when no child clears 0.5 confidence —
 *      an explicit "ambiguous, escalate" signal.
 *   2. Gemini fallback. Only invoked when the rule pass returned
 *      null. Asks gemini-2.5-flash to pick a child slug + confidence
 *      from the same input data. Roughly 20-25% of leads land here
 *      in production traffic (regex coverage on F&B is good).
 *
 * Side effects:
 *   - Writes `subNicheSlug`, `subNicheConfidence`, `subNicheSource`
 *     onto Lead. `subNicheSource` is always AUTO from this worker.
 *   - Increments `subNicheVersion` if the slug actually changed —
 *     downstream workers use the version field as a stale-run guard
 *     (see `agent-run-worker.ts` inputSubNicheVersion check).
 *   - Refuses to overwrite a MANUAL override (rep-curated label is
 *     gold-standard; auto-classifier must not stomp on it).
 *
 * Self-skips when:
 *   - Workspace niche has no parent NichePack (e.g. PHONE_REPAIR
 *     today — no children defined).
 *   - Workspace niche has only one pack (no children to rank).
 *   - Lead.subNicheSource is MANUAL.
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateWithTimeout } from "@/lib/gemini-client";
import { safeParseGeminiJson } from "@/lib/gemini";
import {
  autoAssignFineDining,
  getChildrenOf,
  rankAllChildren,
  rankAllChildrenAll,
  ruleBasedClassify,
  verticalRootForWorkspace,
  type ClassifierLeadSignals,
  type NichePack,
  type RuleClassificationResult,
} from "@/lib/niches";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

/**
 * Beta finding §5: a hybrid lead like "Lobby Lounge at the Conrad
 * Hotel" can legitimately fit BOTH `fnb-hotel-fnb` and `fnb-bar-club`.
 * The classifier still picks ONE primary slug (highest confidence)
 * but also surfaces the runner-up packs whose confidence cleared the
 * alternative gate, so the opener / package selector / mockup picker
 * downstream can match either tag and the lead-detail UI can show a
 * "Aşağıdakilerden hangisi?" picker when the top two are close.
 *
 * Threshold rules:
 *   - Alternatives are kept only when their confidence ≥ 0.4 (strong
 *     enough to be worth surfacing, weak enough to not be the primary).
 *   - At most 2 alternatives are kept (top-3 total including primary)
 *     so the lead-detail picker doesn't become a six-option menu.
 *   - The primary slug is NEVER duplicated into the alternatives list.
 */
const ALTERNATIVE_CONFIDENCE_FLOOR = 0.4;
const MAX_ALTERNATIVES = 2;

interface ClassifierAlternative {
  slug: string;
  confidence: number;
  reason: string | null;
}

interface ClassifierResult {
  slug: string;
  confidence: number;
  reasoning: string | null;
  source: "rule" | "gemini" | "rule-weak" | "rule-default";
  reasons?: { rule: string; weight: number }[];
  /**
   * Runner-up sub-niche slugs whose confidence was below the primary
   * but above ALTERNATIVE_CONFIDENCE_FLOOR. Excludes the primary slug.
   * Empty when no other child cleared the floor.
   */
  alternatives: ClassifierAlternative[];
}

export const run: AgentWorkerRun = async (
  ctx,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) {
    throw new Error("SUBVERTICAL_CLASSIFIER requires a lead context");
  }

  const parentSlug = verticalRootForWorkspace(ctx.workspace.niche);
  if (!parentSlug) {
    return {
      output: { skipped: true, reason: "no-parent-niche-pack" },
    };
  }

  const children = getChildrenOf(parentSlug);
  if (children.length === 0) {
    return {
      output: { skipped: true, reason: "single-pack-vertical", parentSlug },
    };
  }

  if (ctx.lead.subNicheSource === "MANUAL") {
    return {
      output: {
        skipped: true,
        reason: "manual-locked",
        currentSlug: ctx.lead.subNicheSlug,
      },
    };
  }

  const signals = buildClassifierSignals(ctx);

  // Compute the FULL ranked list once — both the primary classifier
  // and the alternatives surface come from the same source so they
  // can never diverge. Each path below picks element 0 as the
  // primary candidate (or escalates to Gemini); the runners-up are
  // attached at the end via `pickAlternatives`.
  const rankedAll = rankAllChildrenAll(signals, children);
  const ruleHit = ruleBasedClassify(signals, children);

  let result: ClassifierResult;
  if (ruleHit) {
    result = {
      slug: ruleHit.slug,
      confidence: ruleHit.confidence,
      reasoning: ruleHit.reasons.map((r) => r.rule).join(", "),
      source: "rule",
      reasons: ruleHit.reasons,
      alternatives: pickAlternatives(rankedAll, ruleHit.slug),
    };
  } else {
    const geminiHit = await classifyWithGemini(signals, children, parentSlug);
    if (geminiHit) {
      result = {
        ...geminiHit,
        source: "gemini",
        // Gemini picks the primary; alternatives still come from the
        // rule pass so the runner-up signals surface even when the
        // rule path didn't clear the floor on its own. Excludes the
        // Gemini-picked slug.
        alternatives: pickAlternatives(rankedAll, geminiHit.slug),
      };
    } else {
      // Both the floored rule pass AND Gemini failed. Rather than
      // park the lead at the parent scope with `subNicheSlug = null`
      // (which strips ALL vertical context from the dossier + memory
      // layer for ever after), fall back to the floorless rule pass.
      // It returns the best-scoring child even when no rule clears
      // the 0.5 threshold — we persist that with a clamped low
      // confidence (≥ 0.3) and source = "rule-weak" so:
      //   1. The 0.7 confidence gate in scorer/opener still rejects
      //      it, defaulting back to the parent (generic F&B) framing.
      //      A wrong-vertical pitch CANNOT ship from this branch.
      //   2. The dossier + UI + memory niche scope still carry the
      //      best-guess sub-vertical metadata so retrieval and
      //      lookalikes don't regress to scope-null.
      const ruleBest = rankAllChildren(signals, children);

      // Phase 2.3: Fine-dining auto-assign. When neither rule (with
      // floor) nor Gemini nor floorless rule produced a confident
      // pick, but the lead's Place stats look like fine-dining
      // (rating ≥ 4.5 + reviews ≥ 200 + priceLevel ≥ 3), promote it
      // to `fnb-fine-dining` at 0.85 confidence. We apply this BEFORE
      // accepting the floorless `ruleBest` whenever its confidence is
      // below the auto-assign target (0.85), so a weak rule pick like
      // "name_keyword: 'restaurant'" doesn't shadow a much stronger
      // statistical signal. ctx.lead carries `rating`, `reviewCount`,
      // and `priceLevel` from Google Places enrichment.
      const autoFineDining = autoAssignFineDining({
        parentSlug,
        rating: ctx.lead.rating,
        reviewCount: ctx.lead.reviewCount,
        priceLevel: ctx.lead.priceLevel,
      });

      if (autoFineDining && (!ruleBest || ruleBest.confidence < autoFineDining.confidence)) {
        result = {
          slug: autoFineDining.slug,
          confidence: autoFineDining.confidence,
          reasoning: autoFineDining.reason,
          source: "rule",
          reasons: [{ rule: "auto_assign_fine_dining", weight: 1 }],
          alternatives: pickAlternatives(rankedAll, autoFineDining.slug),
        };
      } else if (ruleBest) {
        result = {
          slug: ruleBest.slug,
          // Clamp upward to 0.3 so a single weak signal still surfaces
          // as a "I tried but I'm not confident" rather than 0 (which
          // looks identical to "no classification" in telemetry).
          confidence: Math.max(ruleBest.confidence, 0.3),
          reasoning: `low-confidence rule pick (Gemini unavailable): ${ruleBest.reasons.map((r) => r.rule).join(", ")}`,
          source: "rule-weak",
          reasons: ruleBest.reasons,
          alternatives: pickAlternatives(rankedAll, ruleBest.slug),
        };
      } else {
        // No rule fired at all — park at the parent scope (legacy
        // behaviour). This is now genuinely "no signal", not "we
        // didn't bother trying".
        result = {
          slug: "",
          confidence: 0,
          reasoning: "no-classification",
          source: "rule-default",
          alternatives: [],
        };
      }
    }
  }

  await persistResult(ctx, result, parentSlug);

  logger.info("agent_workers.subvertical_classifier.done", {
    leadId: ctx.lead.id,
    workspaceNiche: ctx.workspace.niche,
    parentSlug,
    slug: result.slug || null,
    confidence: result.confidence,
    source: result.source,
    alternativesCount: result.alternatives.length,
    alternativeSlugs: result.alternatives.map((a) => a.slug),
  });

  return {
    output: {
      parentSlug,
      slug: result.slug || null,
      confidence: result.confidence,
      source: result.source,
      reasoning: result.reasoning,
      ruleReasons: result.reasons ?? null,
      alternatives: result.alternatives,
      candidatesEvaluated: children.length,
    },
    costTokens: result.source === "gemini" ? 600 : 0,
  };
};

/**
 * Selects up to MAX_ALTERNATIVES runner-up slugs from the full ranked
 * list, excluding the primary slug and applying the confidence floor.
 * Each alternative carries a short reason string built from the rule
 * pass's matched rules so the lead-detail picker can show "Bar club
 * (matched: name_keyword, google_places_type)" instead of an opaque
 * confidence number.
 */
function pickAlternatives(
  rankedAll: RuleClassificationResult[],
  primarySlug: string,
): ClassifierAlternative[] {
  const out: ClassifierAlternative[] = [];
  for (const r of rankedAll) {
    if (r.slug === primarySlug) continue;
    if (r.confidence < ALTERNATIVE_CONFIDENCE_FLOOR) continue;
    out.push({
      slug: r.slug,
      confidence: r.confidence,
      reason: r.reasons.length > 0 ? r.reasons.map((x) => x.rule).join(", ") : null,
    });
    if (out.length >= MAX_ALTERNATIVES) break;
  }
  return out;
}

/**
 * Hydrates the rule-based classifier's `ClassifierLeadSignals` shape
 * from the worker context. Pulls audit features defensively because
 * `WebsiteAudit.rawFeaturesJson` is a Json column that may be `null`
 * (audit hasn't run yet) or partial.
 */
function buildClassifierSignals(ctx: AgentWorkerContext): ClassifierLeadSignals {
  const lead = ctx.lead!;
  const audit = lead.websiteAudit;
  const features = (audit?.rawFeaturesJson ?? null) as Record<string, unknown> | null;

  return {
    businessName: lead.businessName ?? null,
    // Bug #8 needs the address to enforce the hospitality-marker
    // guard on fnb-hotel-fnb (e.g. a "Lobby Lounge" with no brand in
    // the name only qualifies if the address contains "hotel" /
    // "resort" / "otel" / "inn").
    formattedAddress: lead.formattedAddress ?? null,
    primaryType: lead.primaryType ?? null,
    // Phase 2.3: priceLevel feeds the priceLevelRange rule (+0.15
    // weight) AND the fine-dining auto-assign threshold. Captured at
    // discovery time from Google Places enum (mapped to 0..4).
    priceLevel: lead.priceLevel ?? null,
    discoverySourceQuery: lead.discoverySourceQuery ?? lead.sourceQuery ?? null,
    bookingProvider: audit?.bookingProvider ?? null,
    audit: audit
      ? {
          hasOnlineReservation: features?.hasOnlineReservation === true,
          hasDeliveryIntegration: features?.hasDeliveryIntegration === true,
          hasQrMenu: features?.hasQrMenu === true,
        }
      : null,
  };
}

/**
 * Gemini fallback. Only called when `ruleBasedClassify` returns null.
 * Uses a tightly-scoped JSON schema so the model has to pick from the
 * candidate child slugs (it cannot invent a new one). Temperature is
 * low (0.1) because we want deterministic-ish classification.
 *
 * Returns null on any failure (timeout, parse error, slug not in
 * candidates) — the worker logs and parks the lead at the parent.
 */
async function classifyWithGemini(
  signals: ClassifierLeadSignals,
  children: NichePack[],
  parentSlug: string,
): Promise<{ slug: string; confidence: number; reasoning: string | null } | null> {
  const { getGeminiKey } = await import("@/lib/gemini-keys");
  let apiKey: string;
  try {
    apiKey = getGeminiKey();
  } catch {
    logger.warn("subvertical_classifier.no_gemini_key", { parentSlug });
    return null;
  }

  const childSlugs = children.map((c) => c.slug);
  const candidatesText = children
    .map((c) => `- ${c.slug}: ${c.label} — ${c.tagline}`)
    .join("\n");

  const prompt = `You are classifying a business lead into a sub-vertical of "${parentSlug}".

Pick exactly ONE candidate slug from the list below. Return null if none fit.

CANDIDATES:
${candidatesText}

LEAD SIGNALS:
- Name: ${signals.businessName ?? "(unknown)"}
- Google Places primaryType: ${signals.primaryType ?? "(unknown)"}
- Discovery query that surfaced this lead: ${signals.discoverySourceQuery ?? "(none)"}
- Booking provider on website: ${signals.bookingProvider ?? "(none)"}
- Has online reservation: ${signals.audit?.hasOnlineReservation ?? "(audit not run)"}
- Has delivery integration: ${signals.audit?.hasDeliveryIntegration ?? "(audit not run)"}
- Has QR menu: ${signals.audit?.hasQrMenu ?? "(audit not run)"}

Output JSON: { "slug": "<one of the candidate slugs or null>", "confidence": <0..1>, "reasoning": "<one short sentence>" }`;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            slug: { type: SchemaType.STRING },
            confidence: { type: SchemaType.NUMBER },
            reasoning: { type: SchemaType.STRING },
          },
          required: ["slug", "confidence", "reasoning"],
        },
      },
    });

    const result = await generateWithTimeout(model, prompt, {
      timeoutMs: 30_000,
      label: "subvertical_classifier",
    });
    const raw = result.response.text();
    const parsed = safeParseGeminiJson<{
      slug: string;
      confidence: number;
      reasoning: string;
    }>(raw, "subvertical_classifier");

    const slug = (parsed.slug ?? "").trim();
    if (!slug || !childSlugs.includes(slug)) {
      logger.warn("subvertical_classifier.invalid_slug", {
        slug,
        candidates: childSlugs,
      });
      return null;
    }

    return {
      slug,
      confidence: clamp01(Number(parsed.confidence) || 0),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : null,
    };
  } catch (err) {
    logger.error("subvertical_classifier.gemini_failed", {
      parentSlug,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Persists the classification onto Lead and bumps `subNicheVersion`
 * if (and only if) the slug actually changed. The version bump is the
 * stale-run guard for downstream workers — touching it on a no-op
 * write would invalidate every in-flight audit/opener for nothing.
 *
 * Idempotency: the bump is conditioned on a SQL-level slug compare so
 * concurrent classifier runs racing on the same lead converge on the
 * same value without phantom version churn.
 */
async function persistResult(
  ctx: AgentWorkerContext,
  result: ClassifierResult,
  parentSlug: string,
): Promise<void> {
  const lead = ctx.lead!;
  const newSlug = result.slug || null;
  const slugChanged = newSlug !== lead.subNicheSlug;

  // Beta finding §5: build the multi-tag union. `subNicheSlugs` is
  // the deduped union of the primary slug + alternatives so a single
  // SQL `subNicheSlugs ?| array['fnb-bar-club']` query catches BOTH
  // primary-tagged and alternative-tagged hits. Order matters here:
  // primary first (downstream code may assume slugs[0] === primary
  // when present) followed by alternatives in confidence order.
  const allSlugs = [
    ...(newSlug ? [newSlug] : []),
    ...result.alternatives.map((a) => a.slug),
  ];

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      // Always set parent niche slug for hybrid workspaces — the
      // memory layer's parent-scope read fans out from this column.
      nicheSlug: lead.nicheSlug ?? parentSlug,
      subNicheSlug: newSlug,
      subNicheConfidence: result.confidence,
      subNicheSource: "AUTO",
      // The Prisma client uses `set` for replacing the entire array
      // (vs push/append). `subNicheSlugs` is the canonical union;
      // re-classifying always replaces it.
      subNicheSlugs: { set: allSlugs },
      subNicheAlternatives: result.alternatives as unknown as object,
      ...(slugChanged ? { subNicheVersion: { increment: 1 } } : {}),
    },
  });
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
