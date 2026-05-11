/**
 * TRIGGER_DETECTOR worker (T2 light Gemini + deterministic rules).
 *
 * Walks the lead's enrichment substrate (review analysis, social
 * scrape, hiring signals from APIFY_LINKEDIN_COMPANY, SERP results,
 * audit features) and writes `LeadTrigger` rows for the patterns that
 * fire. A short Gemini call ranks ambiguous candidates; deterministic
 * rules handle the obvious wins.
 *
 * Idempotency: each `LeadTrigger` has `@@unique([workspaceId, leadId,
 * type, detectedAt])` so re-running the detector within the same
 * minute produces no duplicates.
 *
 * Pure-rules-first design — Gemini is only used to bucket free-form
 * evidence (e.g. "is this Indeed posting actually a marketing role?")
 * into one of the existing LeadTriggerType enum values.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type {
  LeadTriggerType,
  Prisma,
} from "@/generated/prisma/client";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import {
  classifyVelocityTrigger,
  computeReviewVelocity,
} from "@/lib/lead-detail/review-velocity";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

interface DetectedTrigger {
  type: LeadTriggerType;
  severity: number;
  confidence: number;
  evidence: {
    source: string;
    refId?: string;
    quote?: string;
    url?: string;
    /** Free-form auxiliary fields the rule wants to surface for
     *  the opener writer / reasoning graph (sample phrases,
     *  rolling-window math, age in days, etc.). Schema-less by
     *  design — the writer's prompt picks whatever it needs. */
    [key: string]: unknown;
  };
  impactPrediction?: string;
  urgencyWindowDays: number;
}

/**
 * Hard-coded tourism-hotspot boroughs (Phase 2 deterministic rule
 * for SEASONAL_TOURISM). When more locales onboard, move this to a
 * `WorkspaceLeadPipeline.tourismBoroughs` JSON column so the list
 * is workspace-tunable without a code change. London bias is
 * intentional — that's where the design-partner Glass Coffee + Brick
 * Lane fixtures live.
 */
const TOURISM_BOROUGHS: ReadonlySet<string> = new Set([
  // London
  "westminster",
  "camden",
  "kensington-and-chelsea",
  "city-of-london",
  "tower-hamlets",
  "southwark",
  "lambeth",
  // Istanbul tourism districts (FineDine pilot)
  "fatih",
  "beyoglu",
  "sisli",
  "besiktas",
  "kadikoy",
  // Paris (future)
  "paris-1",
  "paris-2",
  "paris-4",
  "paris-6",
  "paris-8",
]);

function isTourismSeason(now: Date): boolean {
  // Northern-hemisphere May–September window. Workspaces targeting
  // ski-season businesses would need a different range; gate this
  // off via the upcoming `tourismBoroughs` column when that lands.
  const month = now.getUTCMonth(); // 0-indexed
  return month >= 4 && month <= 8;
}

/**
 * Coarse name similarity for the REBRANDING rule. Returns a 0-1
 * Jaccard ratio over lower-cased word tokens. We deliberately
 * avoid a Levenshtein dep — the rule fires on `<= 0.5` which is
 * loose enough to tolerate "The Glass Coffee" vs "Glass" without
 * being so loose it false-positives on every site that mentions
 * the brand in its title alongside taglines.
 */
function nameSimilarity(a: string, b: string): number {
  const tokens = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3),
    );
  const aTok = tokens(a);
  const bTok = tokens(b);
  if (aTok.size === 0 || bTok.size === 0) return 1; // can't decide
  let intersection = 0;
  for (const tok of aTok) if (bTok.has(tok)) intersection += 1;
  const union = aTok.size + bTok.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** `ReviewAnalysis.weaknessKpis` shape — see schema comment. */
interface WeaknessKpi {
  label: string;
  count?: number;
  percent?: number;
}

function weaknessHits(
  kpis: WeaknessKpi[],
  patterns: RegExp,
): WeaknessKpi[] {
  return kpis.filter((k) => patterns.test(k.label.toLowerCase()));
}

/**
 * Default urgency windows per trigger type (days).
 *
 * Phase 8 — `REVIEW_VOLUME_SURGE` / `REVIEW_VOLUME_DIP` join the map
 * with a 30-day window (same as `RATING_DROP` — both fire off the
 * 30/30 rolling-review buckets so the SDR shouldn't sit on either
 * for longer than the window the math is built on).
 *
 * The Record key type is widened to a union with the two new
 * literals so this file type-checks before `npm run db:generate`
 * picks up the schema enum addition. After regen the union is
 * redundant but harmless.
 */
const URGENCY_WINDOW: Record<
  LeadTriggerType | "REVIEW_VOLUME_SURGE" | "REVIEW_VOLUME_DIP",
  number
> = {
  NEW_LOCATION_OPENING: 90,
  CHAIN_EXPANSION: 90,
  HIRING_MARKETING: 90,
  HIRING_OPS: 60,
  HIRING_TECH: 60,
  BAD_SERVICE_REVIEWS: 30,
  RATING_DROP: 30,
  MENU_REDESIGN_SIGNAL: 60,
  BOOKING_PROVIDER_CHANGE: 60,
  DELIVERY_EXPANSION: 60,
  INTERNATIONAL_AUDIENCE_GROWTH: 90,
  SEASONAL_TOURISM: 30,
  COMPETITOR_PRESSURE: 60,
  REBRANDING: 90,
  FUNDING_RAISED: 180,
  EXEC_CHANGE: 90,
  REVIEW_VOLUME_SURGE: 30,
  REVIEW_VOLUME_DIP: 30,
};

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("TRIGGER_DETECTOR requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;

  const detected: DetectedTrigger[] = [];

  // ---- Rule 1: rating drop / bad reviews from ReviewAnalysis ----
  if (lead.reviewAnalysis) {
    const ra = lead.reviewAnalysis;
    const sentiment = (ra.sentimentBreakdown as { negative?: number } | null) ?? null;
    const negativePct = sentiment?.negative ?? 0;
    const painPhrases = Array.isArray(ra.painPhrases) ? (ra.painPhrases as string[]) : [];
    if (negativePct > 0.25 && painPhrases.length >= 3) {
      detected.push({
        type: "BAD_SERVICE_REVIEWS",
        severity: Math.round(Math.min(100, negativePct * 250)),
        confidence: 0.7,
        evidence: {
          source: "ReviewAnalysis",
          refId: ra.id,
          quote: painPhrases.slice(0, 2).join(" / "),
        },
        impactPrediction: "Customer churn risk — opener should lead with retention angle.",
        urgencyWindowDays: URGENCY_WINDOW.BAD_SERVICE_REVIEWS,
      });
    }
    if (lead.rating != null && lead.rating < 4 && (lead.reviewCount ?? 0) >= 30) {
      detected.push({
        type: "RATING_DROP",
        severity: Math.round((4.5 - lead.rating) * 30),
        confidence: 0.55,
        evidence: { source: "Lead.rating", quote: `Rating ${lead.rating} below 4.0` },
        urgencyWindowDays: URGENCY_WINDOW.RATING_DROP,
      });
    }
  }

  // ---- Rule 2: booking provider change signal from audit ----
  if (lead.websiteAudit) {
    const a = lead.websiteAudit;
    if (a.bookingProvider && a.hasBookingSystem === false) {
      detected.push({
        type: "BOOKING_PROVIDER_CHANGE",
        severity: 60,
        confidence: 0.6,
        evidence: {
          source: "WebsiteAudit",
          refId: a.id,
          quote: `Detected booking provider "${a.bookingProvider}" but live system not present.`,
        },
        urgencyWindowDays: URGENCY_WINDOW.BOOKING_PROVIDER_CHANGE,
      });
    }
  }

  // ---- Rule 3: hiring signals from LinkedIn / SERP semantic memory ----
  // Pre-loaded by the executor via memoryReads (HIRING_SIGNAL kind).
  const hiringHits = ctx.memory.filter((m) => m.kind === "HIRING_SIGNAL");
  if (hiringHits.length > 0) {
    // Bucket into MARKETING / OPS / TECH using simple keyword rules; for
    // ambiguous cases we'd ask Gemini, but the cheap rule covers ~80%.
    for (const hit of hiringHits.slice(0, 5)) {
      const text = hit.text.toLowerCase();
      let type: LeadTriggerType | null = null;
      if (/(marketing|brand|growth|content)/.test(text)) type = "HIRING_MARKETING";
      else if (/(operations|operator|ops|fulfillment|delivery)/.test(text)) type = "HIRING_OPS";
      else if (/(engineer|developer|tech|software|cto|cio|data)/.test(text)) type = "HIRING_TECH";
      if (!type) continue;
      detected.push({
        type,
        severity: 55,
        confidence: 0.6,
        evidence: { source: "SemanticMemory:HIRING_SIGNAL", refId: hit.id, quote: hit.text.slice(0, 200) },
        urgencyWindowDays: URGENCY_WINDOW[type],
      });
    }
  }

  // ---- Rule 4: SERP-detected expansion signals (new locations, intl) ----
  const serpHits = ctx.memory.filter((m) => m.kind === "SERP_SNAPSHOT");
  for (const hit of serpHits.slice(0, 3)) {
    const text = hit.text.toLowerCase();
    if (/(new location|opening|grand opening|now open)/.test(text)) {
      detected.push({
        type: "NEW_LOCATION_OPENING",
        severity: 70,
        confidence: 0.55,
        evidence: { source: "SemanticMemory:SERP_SNAPSHOT", refId: hit.id, quote: hit.text.slice(0, 200) },
        urgencyWindowDays: URGENCY_WINDOW.NEW_LOCATION_OPENING,
      });
    }
    if (/(international|expand abroad|new country|launching in)/.test(text)) {
      detected.push({
        type: "INTERNATIONAL_AUDIENCE_GROWTH",
        severity: 50,
        confidence: 0.5,
        evidence: { source: "SemanticMemory:SERP_SNAPSHOT", refId: hit.id, quote: hit.text.slice(0, 200) },
        urgencyWindowDays: URGENCY_WINDOW.INTERNATIONAL_AUDIENCE_GROWTH,
      });
    }
  }

  // ============================================================
  // SDR-Brain v2 Phase 2 — 8 additional deterministic rules. Each
  // reads a v1 intel source the pre-Phase-2 detector ignored. Rules
  // are ordered cheapest-first; every block self-checks for input
  // presence so missing data is a no-op rather than a crash.
  // ============================================================

  // ---- Rule A: rating drop via 30-day rolling window ----
  // Compares recent-30d avg rating against the prior-30d window
  // (days 31-60). Fires when the drop is >= 0.4 stars and there are
  // at least 3 reviews in each bucket so a single 1-star outlier
  // doesn't trigger. Reads the optional `googleReviews` include
  // declared in the registry (`requiredIncludes.googleReviews`).
  const recentReviews = lead.googleReviews;
  if (recentReviews && recentReviews.length >= 6) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const last30 = recentReviews.filter(
      (r) => now - r.publishTime.getTime() <= 30 * day,
    );
    const prior30 = recentReviews.filter((r) => {
      const age = now - r.publishTime.getTime();
      return age > 30 * day && age <= 60 * day;
    });
    if (last30.length >= 3 && prior30.length >= 3) {
      const avg = (rs: typeof recentReviews) =>
        rs.reduce((s, r) => s + r.rating, 0) / rs.length;
      const drop = avg(prior30) - avg(last30);
      if (drop >= 0.4) {
        detected.push({
          type: "RATING_DROP",
          severity: Math.round(Math.min(100, drop * 60)),
          confidence: 0.78,
          evidence: {
            source: "GoogleReview.windowed",
            quote: `Last 30d avg ${avg(last30).toFixed(2)} vs prior 30d avg ${avg(prior30).toFixed(2)}`,
            windowDropStars: Number(drop.toFixed(2)),
            recentCount: last30.length,
            priorCount: prior30.length,
          },
          impactPrediction:
            "Rating slope is negative — opener should preempt the implicit objection ('we know reviews have been rougher than usual').",
          urgencyWindowDays: URGENCY_WINDOW.RATING_DROP,
        });
      }
    }
  }

  // ---- Rule J (Phase 8): REVIEW_VOLUME_SURGE / REVIEW_VOLUME_DIP ----
  // Reads the same `googleReviews` corpus Rule A consumed and pipes
  // it through the SHARED `computeReviewVelocity` /
  // `classifyVelocityTrigger` helpers (`src/lib/lead-detail/
  // review-velocity.ts`). The Phase 3 `ReviewVelocityBadge` calls the
  // same helpers, so by construction the badge UI and the trigger
  // row never disagree on the same lead (PLAN §6 risk #20).
  //
  // Thresholds (defined in the helper, NOT here, so the badge and
  // detector share one source of truth):
  //   - SURGE: deltaPct >= +50% AND recent30dCount >= 8
  //   - DIP:   deltaPct <= -30% AND prior30dCount >= 5
  //   - both:  recent + prior < 6 → no fire (micro-volume guard)
  //
  // Severity comes back from the helper so the surge/dip math lives
  // in one place; we only translate the kind into a `LeadTrigger` row.
  if (recentReviews && recentReviews.length >= 6) {
    const velocity = computeReviewVelocity(
      recentReviews.map((r) => ({
        rating: r.rating,
        publishTime: r.publishTime,
      })),
    );
    const trig = classifyVelocityTrigger(velocity);
    if (trig) {
      const isSurge = trig.kind === "REVIEW_VOLUME_SURGE";
      detected.push({
        // Cast: until `npm run db:generate` runs against the updated
        // schema, the generated `LeadTriggerType` union doesn't carry
        // the two new values. The DB enum DOES once `db:push` runs;
        // the cast is the bridge between the two regen steps.
        type: trig.kind as LeadTriggerType,
        severity: trig.severity,
        // Surge gets a slightly lower confidence (a +50% delta over
        // a small 30d window can be a single-event spike). Dip is
        // higher because operations gaps tend to persist long enough
        // to be a durable buying signal.
        confidence: isSurge ? 0.7 : 0.8,
        evidence: {
          source: "GoogleReview.velocity",
          quote: isSurge
            ? `Review surge +${velocity.deltaPct}% / 30d (recent ${velocity.recentCount30d}, prior ${velocity.priorCount30d})`
            : `Review dip ${velocity.deltaPct}% / 30d (recent ${velocity.recentCount30d}, prior ${velocity.priorCount30d})`,
          recentCount: velocity.recentCount30d,
          priorCount: velocity.priorCount30d,
          deltaPct: velocity.deltaPct,
          recent30dAvgRating: velocity.recent30dAvgRating,
          prior30dAvgRating: velocity.prior30dAvgRating,
          ratingDelta: velocity.ratingDelta,
        },
        impactPrediction: isSurge
          ? "Momentum window — strike before competitor catches up."
          : "Operations stretched / coverage gap — high-leverage SDR opening.",
        urgencyWindowDays: isSurge
          ? URGENCY_WINDOW.REVIEW_VOLUME_SURGE
          : URGENCY_WINDOW.REVIEW_VOLUME_DIP,
      });
    }
  }

  // ---- Rule B: COMPETITOR_PRESSURE from SalesOpportunity.reasonCodes ----
  if (lead.salesOpportunity) {
    const codes = Array.isArray(lead.salesOpportunity.reasonCodes)
      ? (lead.salesOpportunity.reasonCodes as string[])
      : [];
    const competitorPatterns = /(HIGH_RATING_WEAK_SITE|COMPETITOR|MARKET_PRESSURE|LOW_DIFFERENTIATION)/i;
    const matched = codes.filter((c) => competitorPatterns.test(c));
    if (matched.length > 0) {
      detected.push({
        type: "COMPETITOR_PRESSURE",
        severity: 65,
        confidence: 0.7,
        evidence: {
          source: "SalesOpportunity.reasonCodes",
          refId: lead.salesOpportunity.id,
          quote: matched.join(", "),
          matchedCodes: matched,
        },
        impactPrediction:
          "Operator likely benchmarking against a stronger neighbour — lead with differentiation angle.",
        urgencyWindowDays: URGENCY_WINDOW.COMPETITOR_PRESSURE,
      });
    }
  }

  // ---- Rules C-E: weakness-KPI driven triggers ----
  // The pre-Phase-2 detector read `painPhrases` (free-form quotes)
  // and ignored the structured `weaknessKpis` array. Each KPI carries
  // a `label` (e.g. "Slow service") + `count` + `percent`, which is
  // far better signal for the rule engine than raw phrase matching.
  if (lead.reviewAnalysis) {
    const ra = lead.reviewAnalysis;
    const kpis: WeaknessKpi[] = Array.isArray(ra.weaknessKpis)
      ? (ra.weaknessKpis as WeaknessKpi[])
      : [];

    // ---- Rule C: BAD_SERVICE_REVIEWS via structured KPIs ----
    // Augments the existing painPhrases rule above. Fires when the
    // structured analysis itself flagged a service/wait/slow KPI
    // with count >= 3 — independent of the negative-sentiment check
    // that gates the painPhrases path.
    const serviceHits = weaknessHits(kpis, /service|slow|wait|rude|staff/);
    const serviceHitCount = serviceHits.reduce(
      (s, k) => s + (k.count ?? 0),
      0,
    );
    if (
      serviceHitCount >= 3 &&
      // Don't double-emit if the painPhrases branch already wrote one.
      !detected.some((d) => d.type === "BAD_SERVICE_REVIEWS")
    ) {
      const topKpi = serviceHits.sort(
        (a, b) => (b.count ?? 0) - (a.count ?? 0),
      )[0];
      detected.push({
        type: "BAD_SERVICE_REVIEWS",
        severity: Math.min(85, 50 + serviceHitCount * 4),
        confidence: 0.75,
        evidence: {
          source: "ReviewAnalysis.weaknessKpis",
          refId: ra.id,
          quote: topKpi
            ? `${topKpi.label} (${topKpi.count} mentions)`
            : "service complaints flagged",
          kpis: serviceHits.slice(0, 3),
        },
        impactPrediction:
          "Service-quality complaints are quantified — loyalty / training angle is the strongest hook.",
        urgencyWindowDays: URGENCY_WINDOW.BAD_SERVICE_REVIEWS,
      });
    }

    // ---- Rule D: MENU_REDESIGN_SIGNAL ----
    const menuHits = weaknessHits(kpis, /menu|pricing|portion|value/);
    if (menuHits.length > 0) {
      // Bonus weight when the website audit confirms the menu page
      // hasn't been touched in a while. `rawFeaturesJson` is opaque
      // by design — guard every property access.
      const features = (lead.websiteAudit?.rawFeaturesJson ??
        null) as { menuPdfLastUpdated?: string } | null;
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      const menuStale =
        features?.menuPdfLastUpdated != null &&
        Date.parse(features.menuPdfLastUpdated) < sixMonthsAgo;
      const topMenuKpi = menuHits[0];
      detected.push({
        type: "MENU_REDESIGN_SIGNAL",
        severity: menuStale ? 70 : 50,
        confidence: menuStale ? 0.7 : 0.55,
        evidence: {
          source: "ReviewAnalysis.weaknessKpis+WebsiteAudit",
          refId: ra.id,
          quote: topMenuKpi
            ? `${topMenuKpi.label} (${topMenuKpi.count ?? 0} mentions)`
            : "menu/pricing complaints flagged",
          menuStale,
        },
        impactPrediction: menuStale
          ? "Menu hasn't been refreshed in 6+ months and customers are noticing — redesign hook lands."
          : "Pricing / portion complaints surfacing — menu engineering angle has natural fit.",
        urgencyWindowDays: URGENCY_WINDOW.MENU_REDESIGN_SIGNAL,
      });
    }

    // ---- Rule E: DELIVERY_EXPANSION ----
    // Customers complaining about delivery / wait when the site
    // doesn't even advertise a delivery channel = greenfield revenue.
    const deliveryHits = weaknessHits(
      kpis,
      /delivery|takeout|takeaway|wait time/,
    );
    const services = Array.isArray(lead.websiteAudit?.servicesDetected)
      ? (lead.websiteAudit!.servicesDetected as string[]).map((s) =>
          s.toLowerCase(),
        )
      : [];
    const hasDelivery = services.some((s) =>
      /(deliver|takeout|takeaway|courier)/.test(s),
    );
    if (deliveryHits.length > 0 && !hasDelivery) {
      detected.push({
        type: "DELIVERY_EXPANSION",
        severity: 60,
        confidence: 0.65,
        evidence: {
          source: "ReviewAnalysis.weaknessKpis+WebsiteAudit.servicesDetected",
          refId: ra.id,
          quote: deliveryHits.map((k) => k.label).join(", "),
          servicesDetected: services,
        },
        impactPrediction:
          "Customer-facing demand for delivery exists but the site offers no channel — opportunity for a pilot rollout.",
        urgencyWindowDays: URGENCY_WINDOW.DELIVERY_EXPANSION,
      });
    }
  }

  // ---- Rule F: SEASONAL_TOURISM ----
  // Fires when the lead lives in a tourism-zone borough during the
  // May–September window. Pure deterministic — no Gemini needed.
  if (lead.borough) {
    const boroughSlug = lead.borough
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (TOURISM_BOROUGHS.has(boroughSlug) && isTourismSeason(new Date())) {
      detected.push({
        type: "SEASONAL_TOURISM",
        severity: 55,
        confidence: 0.85,
        evidence: {
          source: "Lead.borough+date",
          quote: `${lead.borough} is in the tourism-hotspot list and we're in the May–September window`,
          boroughSlug,
        },
        impactPrediction:
          "Tourist-season foot-traffic spike likely — package the upgrade against the high-season revenue window.",
        urgencyWindowDays: URGENCY_WINDOW.SEASONAL_TOURISM,
      });
    }
  }

  // ---- Rule G: REBRANDING ----
  // Site title diverges from the business name we discovered =
  // signal the operator either rebranded, runs multiple concepts, or
  // we mis-grouped. Below 0.5 similarity is the trigger threshold.
  if (lead.websiteAudit?.title && lead.businessName) {
    const sim = nameSimilarity(lead.websiteAudit.title, lead.businessName);
    if (sim < 0.5) {
      detected.push({
        type: "REBRANDING",
        severity: 60,
        confidence: 0.6,
        evidence: {
          source: "WebsiteAudit.title vs Lead.businessName",
          refId: lead.websiteAudit.id,
          quote: `Site title "${lead.websiteAudit.title}" vs business name "${lead.businessName}" (similarity ${sim.toFixed(2)})`,
          similarity: Number(sim.toFixed(2)),
        },
        impactPrediction:
          "Brand-identity shift in flight — opener should reference the new positioning rather than the legacy name.",
        urgencyWindowDays: URGENCY_WINDOW.REBRANDING,
      });
    }
  }

  // ---- Rule H: NEW_LOCATION_OPENING via Account ----
  // Multi-location accounts where the current lead row is < 90 days
  // old usually means a fresh branch. Stronger signal than the
  // existing SERP-derived rule because it doesn't depend on Apify.
  // We only emit when account is opted-in (registry flag) AND
  // present (not every lead is grouped into an account).
  if (lead.account && (lead.account.locationsCount ?? 0) > 1) {
    const ageDays = Math.floor(
      (Date.now() - lead.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (ageDays < 90) {
      const skipForDup = detected.some(
        (d) => d.type === "NEW_LOCATION_OPENING",
      );
      if (!skipForDup) {
        detected.push({
          type: "NEW_LOCATION_OPENING",
          severity: 70,
          confidence: 0.75,
          evidence: {
            source: "Account.locationsCount+Lead.createdAt",
            refId: lead.account.id,
            quote: `Account has ${lead.account.locationsCount} locations and this lead was added ${ageDays}d ago`,
            ageDays,
            locationsCount: lead.account.locationsCount,
          },
          impactPrediction:
            "Likely a fresh branch — pre-opening playbook (menu rollout, online ordering, review-velocity push) lands.",
          urgencyWindowDays: URGENCY_WINDOW.NEW_LOCATION_OPENING,
        });
      }
    }

    // ---- Rule I: CHAIN_EXPANSION ----
    // 3+ locations qualifies as a chain operator. Different
    // playbook (multi-site rollout pricing, group-level approval
    // path) than a single new branch.
    if ((lead.account.locationsCount ?? 0) >= 3) {
      detected.push({
        type: "CHAIN_EXPANSION",
        severity: 60,
        confidence: 0.8,
        evidence: {
          source: "Account.locationsCount",
          refId: lead.account.id,
          quote: `Account spans ${lead.account.locationsCount} locations (chain operator)`,
          locationsCount: lead.account.locationsCount,
          accountTier: lead.account.tier,
        },
        impactPrediction:
          "Chain-level economic buyer almost certainly required — opener should request the multi-site stakeholder.",
        urgencyWindowDays: URGENCY_WINDOW.CHAIN_EXPANSION,
      });
    }
  }

  // ---- Optional Gemini bucketing for ambiguous evidence ----
  // For Phase 1 we only call Gemini when there's interesting Reddit /
  // social text but no rule fired — keeps token spend low.
  //
  // SDR-Brain v2 Phase 2 — the prompt now carries the v1 intel
  // narrative (`whyGoodTarget`, `reasonCodes`, review summary,
  // detected services) so Gemini can disambiguate signal that the
  // deterministic rules couldn't. The new context section is
  // length-capped (whyGoodTarget@400, reasonCodes@8, services@10)
  // so token spend per call stays comparable to the pre-Phase-2
  // bucketer (~700 input tokens).
  const ambiguousTexts = ctx.memory
    .filter((m) => m.kind === "REDDIT_MENTION" || m.kind === "SOCIAL_POST")
    .slice(0, 5);
  if (ambiguousTexts.length > 0 && detected.length === 0) {
    try {
      const provider = getStructuredInferenceProvider();
      const schema: SchemaDefinition = {
        type: "OBJECT",
        properties: {
          triggers: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING" },
                severity: { type: "NUMBER" },
                confidence: { type: "NUMBER" },
                quote: { type: "STRING" },
              },
              required: ["type", "severity", "confidence", "quote"],
            },
          },
        },
        required: ["triggers"],
      };
      const allowedTypes: LeadTriggerType[] = Object.keys(URGENCY_WINDOW) as LeadTriggerType[];

      // ---- Build the v1-intel context block ----
      const opp = lead.salesOpportunity;
      const ra = lead.reviewAnalysis;
      const audit = lead.websiteAudit;
      const whyGoodTarget = opp?.whyGoodTarget?.slice(0, 400) ?? null;
      const reasonCodes = Array.isArray(opp?.reasonCodes)
        ? (opp!.reasonCodes as string[]).slice(0, 8)
        : [];
      const reviewSummary =
        ra?.weaknessKpis && Array.isArray(ra.weaknessKpis)
          ? (ra.weaknessKpis as WeaknessKpi[])
              .slice(0, 5)
              .map((k) => `${k.label} (${k.count ?? 0})`)
              .join(", ")
          : null;
      const servicesList = Array.isArray(audit?.servicesDetected)
        ? (audit!.servicesDetected as string[]).slice(0, 10)
        : [];

      const contextLines: string[] = [];
      if (whyGoodTarget) {
        contextLines.push(`WHY THIS IS A GOOD TARGET (analyst's prior writeup):\n${whyGoodTarget}`);
      }
      if (reasonCodes.length > 0) {
        contextLines.push(`SCORER REASON CODES: ${reasonCodes.join(", ")}`);
      }
      if (reviewSummary) {
        contextLines.push(`REVIEW WEAKNESS KPIS: ${reviewSummary}`);
      }
      if (servicesList.length > 0) {
        contextLines.push(`DETECTED SERVICES ON SITE: ${servicesList.join(", ")}`);
      }
      const contextBlock = contextLines.length > 0
        ? `\n--- LEAD CONTEXT ---\n${contextLines.join("\n\n")}\n\n--- AMBIGUOUS EVIDENCE TO CLASSIFY ---\n`
        : "";

      const result = await provider.structuredInfer<{
        triggers: Array<{ type: string; severity: number; confidence: number; quote: string }>;
      }>({
        prompt: `Classify each ambiguous evidence item below into ONE of: ${allowedTypes.join(", ")}, or skip with type="SKIP". Severity 0-100, confidence 0-1. Use the LEAD CONTEXT to disambiguate similar-looking quotes (e.g. a Reddit post about a competitor's new branch is COMPETITOR_PRESSURE not NEW_LOCATION_OPENING).
${contextBlock}
${ambiguousTexts.map((t, i) => `[${i}] ${t.text.slice(0, 400)}`).join("\n\n")}

Return JSON only.`,
        schema,
        temperature: 0.2,
        maxTokens: 1024,
        timeoutMs: 30_000,
        label: "trigger_detector_bucket",
      });
      for (const t of result.data.triggers) {
        if (!allowedTypes.includes(t.type as LeadTriggerType)) continue;
        detected.push({
          type: t.type as LeadTriggerType,
          severity: Math.max(0, Math.min(100, Math.round(t.severity))),
          confidence: Math.max(0, Math.min(1, t.confidence)),
          evidence: { source: "Gemini:trigger_detector_bucket", quote: t.quote.slice(0, 200) },
          urgencyWindowDays: URGENCY_WINDOW[t.type as LeadTriggerType],
        });
      }
    } catch (err) {
      logger.warn("agent_workers.trigger_detector.gemini_bucket_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---- Persist detected triggers (idempotent on the unique key) ----
  let writtenCount = 0;
  const writtenTypes = new Set<LeadTriggerType>();
  for (const t of detected) {
    try {
      await prisma.leadTrigger.create({
        data: {
          workspaceId,
          leadId: lead.id,
          type: t.type,
          severity: t.severity,
          confidence: t.confidence,
          evidence: t.evidence as unknown as Prisma.InputJsonValue,
          impactPrediction: t.impactPrediction ?? null,
          urgencyWindowDays: t.urgencyWindowDays,
        },
      });
      writtenCount += 1;
      writtenTypes.add(t.type);
    } catch {
      // Unique constraint collision = same trigger detected within
      // the same minute (detectedAt is the dedup axis). Safe to ignore.
    }
  }

  // ---- Phase 3 (PLAN §6 risk #8): clear "snooze until trigger" rows
  // for any lead in the workspace whose `snoozeUntilTriggerType` matches
  // a freshly-written trigger type. Workspace-scoped — never crosses
  // tenant boundaries. The trigger-detector runs per-lead, so in
  // practice the only matching lead is `lead.id`, but the query is
  // written to also catch sister leads that the rep snoozed to wait
  // for the same trigger family. Idempotent: leads whose snooze is
  // already cleared are a no-op via the predicate below.
  let snoozesCleared = 0;
  if (writtenTypes.size > 0) {
    try {
      const cleared = await prisma.lead.updateMany({
        where: {
          workspaceId,
          snoozeUntilTriggerType: { in: Array.from(writtenTypes) },
        },
        data: {
          snoozeUntil: null,
          snoozeUntilTriggerType: null,
        },
      });
      snoozesCleared = cleared.count;
    } catch (err) {
      logger.warn("agent_workers.trigger_detector.snooze_clear_failed", {
        workspaceId,
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("agent_workers.trigger_detector.done", {
    leadId: lead.id,
    workspaceId,
    detectedCount: detected.length,
    writtenCount,
    snoozesCleared,
  });

  return {
    output: {
      detected,
      writtenCount,
      snoozesCleared,
    },
    costTokens: 0,
  };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as { detected: DetectedTrigger[] };
  return o.detected.slice(0, 6).map((t) => ({
    kind: "TRIGGER_EVIDENCE",
    text: `${t.type}: ${t.evidence.quote ?? ""}`.slice(0, 400),
    leadId: ctx.leadId!,
    refType: "LeadTrigger",
    refId: undefined, // we don't have the new id back from create() in batch
    metadata: { type: t.type, severity: t.severity, confidence: t.confidence },
  }));
}
