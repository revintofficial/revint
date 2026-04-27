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
  getChildrenOf,
  ruleBasedClassify,
  verticalRootForWorkspace,
  type ClassifierLeadSignals,
  type NichePack,
} from "@/lib/niches";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

interface ClassifierResult {
  slug: string;
  confidence: number;
  reasoning: string | null;
  source: "rule" | "gemini" | "rule-default";
  reasons?: { rule: string; weight: number }[];
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
  const ruleHit = ruleBasedClassify(signals, children);

  let result: ClassifierResult;
  if (ruleHit) {
    result = {
      slug: ruleHit.slug,
      confidence: ruleHit.confidence,
      reasoning: ruleHit.reasons.map((r) => r.rule).join(", "),
      source: "rule",
      reasons: ruleHit.reasons,
    };
  } else {
    const geminiHit = await classifyWithGemini(signals, children, parentSlug);
    if (geminiHit) {
      result = { ...geminiHit, source: "gemini" };
    } else {
      // Last-resort default: park the lead at the parent scope
      // (no child slug). The opener writer's confidence gate will
      // pick the parent (generic F&B) angle.
      result = {
        slug: "",
        confidence: 0,
        reasoning: "no-classification",
        source: "rule-default",
      };
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
  });

  return {
    output: {
      parentSlug,
      slug: result.slug || null,
      confidence: result.confidence,
      source: result.source,
      reasoning: result.reasoning,
      ruleReasons: result.reasons ?? null,
      candidatesEvaluated: children.length,
    },
    costTokens: result.source === "gemini" ? 600 : 0,
  };
};

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      // Always set parent niche slug for hybrid workspaces — the
      // memory layer's parent-scope read fans out from this column.
      nicheSlug: lead.nicheSlug ?? parentSlug,
      subNicheSlug: newSlug,
      subNicheConfidence: result.confidence,
      subNicheSource: "AUTO",
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
