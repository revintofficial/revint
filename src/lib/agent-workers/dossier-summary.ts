/**
 * Per-worker output summarisers for the AI Dossier source chips.
 *
 * The dossier prompt cites individual agent runs with `[run:WORKER_KIND]`
 * tokens. The Lead Detail page renders those tokens as interactive
 * chips: hover shows a 3-5 metric preview, click opens a side drawer
 * with the full source detail. Both views need a tiny, hand-rolled
 * summary of each worker's `AgentRun.outputJson` so we don't ship the
 * full (sometimes 60 KB) blob over the wire just to render a chip.
 *
 * This module is server-only — it lives next to the worker
 * implementations so a worker output shape change here forces a
 * matching summariser update in the same file (single source of
 * truth). The `/api/leads/[id]/dossier-sources` route runs each
 * SUCCEEDED run's outputJson through `summarizeForDossier` and ships
 * only the resulting `KeyMetric[]` plus an optional `headline` string
 * to the client.
 *
 * Coverage: the 14 worker kinds the dossier prompt is allowed to cite
 * (`src/lib/gemini.ts` rules block). Anything else falls through to
 * `genericSummary` which counts top-level output keys.
 */
import type { AgentWorkerKind } from "@/generated/prisma/client";

export interface KeyMetric {
  label: string;
  value: string;
}

export interface DossierSourceSummary {
  /** Optional one-liner headline shown above the metric grid. */
  headline?: string;
  /** Up to ~6 metric rows shown in the popover preview. */
  metrics: KeyMetric[];
  /** True when the worker output indicates the run was skipped. */
  skipped?: boolean;
  /** Short reason text from a skipped output (e.g. `apify_not_configured`). */
  skipReason?: string;
}

const EMPTY: DossierSourceSummary = { metrics: [] };

/**
 * Coerces any value into a short, single-line preview string. Strips
 * newlines, limits length, and falls back to JSON for objects.
 */
function shortStr(value: unknown, max = 80): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned || "—";
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > max ? `${json.slice(0, max - 1)}…` : json;
  } catch {
    return String(value);
  }
}

function pickSkip(o: Record<string, unknown>): DossierSourceSummary | null {
  if (o?.skipped === true) {
    return {
      skipped: true,
      skipReason: typeof o.reason === "string" ? o.reason : undefined,
      metrics: [
        { label: "Status", value: "Skipped" },
        ...(typeof o.reason === "string" ? [{ label: "Reason", value: o.reason }] : []),
      ],
    };
  }
  return null;
}

function genericSummary(output: unknown): DossierSourceSummary {
  if (output == null || typeof output !== "object") return EMPTY;
  const o = output as Record<string, unknown>;
  const skip = pickSkip(o);
  if (skip) return skip;
  const keys = Object.keys(o);
  return {
    metrics: [
      { label: "Output keys", value: keys.length === 0 ? "(empty)" : keys.slice(0, 4).join(", ") },
    ],
  };
}

type Summarizer = (output: Record<string, unknown>) => DossierSourceSummary;

const SUMMARIZERS: Partial<Record<AgentWorkerKind, Summarizer>> = {
  WEBSITE_AUDITOR: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    // The auditor doesn't have a single canonical output shape (the
    // full audit is persisted to the WebsiteAudit row, not the run
    // outputJson). Surface whatever stats the run captured.
    const metrics: KeyMetric[] = [];
    if (typeof o.checksTotal === "number") {
      metrics.push({ label: "Checks", value: `${o.checksPassed ?? "?"}/${o.checksTotal}` });
    }
    if (typeof o.scorePercent === "number") {
      metrics.push({ label: "Score", value: `${o.scorePercent}%` });
    }
    if (typeof o.loadTimeMs === "number") {
      metrics.push({ label: "Load", value: `${o.loadTimeMs} ms` });
    }
    return metrics.length > 0 ? { metrics } : genericSummary(o);
  },

  REVIEW_ANALYST: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const metrics: KeyMetric[] = [];
    if (typeof o.leadScore === "number") metrics.push({ label: "Lead score", value: `${o.leadScore}/100` });
    if (typeof o.reviewsAnalyzedCount === "number") {
      metrics.push({ label: "Reviews analysed", value: String(o.reviewsAnalyzedCount) });
    }
    if (Array.isArray(o.painPhrases) && o.painPhrases.length > 0) {
      metrics.push({ label: "Top pain", value: shortStr(o.painPhrases[0], 70) });
    }
    if (Array.isArray(o.strengthPhrases) && o.strengthPhrases.length > 0) {
      metrics.push({ label: "Top strength", value: shortStr(o.strengthPhrases[0], 70) });
    }
    return {
      headline: typeof o.summary === "string" ? shortStr(o.summary, 110) : undefined,
      metrics,
    };
  },

  SALES_OPPORTUNITY_SCORER: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const metrics: KeyMetric[] = [];
    if (typeof o.opportunityScore === "number") {
      metrics.push({ label: "Score", value: `${o.opportunityScore}/100` });
    }
    if (typeof o.confidence === "number") {
      metrics.push({ label: "Confidence", value: `${Math.round(o.confidence * 100)}%` });
    }
    if (typeof o.suggestedOffer === "string") metrics.push({ label: "Offer", value: shortStr(o.suggestedOffer) });
    if (typeof o.expectedPriceBand === "string") metrics.push({ label: "Price band", value: shortStr(o.expectedPriceBand) });
    return { metrics };
  },

  SOCIAL_SCRAPER: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const profiles = (o.profiles ?? {}) as Record<string, string | null>;
    const found = Object.entries(profiles).filter(([, v]) => !!v);
    return {
      metrics: [
        { label: "Profiles found", value: String(o.count ?? found.length) },
        ...(found.length > 0
          ? [{ label: "Platforms", value: found.map(([k]) => k).slice(0, 6).join(", ") }]
          : []),
      ],
    };
  },

  GOOGLE_PLACES_REVIEWS: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const metrics: KeyMetric[] = [];
    if (typeof o.imported === "number") metrics.push({ label: "Reviews imported", value: String(o.imported) });
    if (typeof o.skipped === "number") metrics.push({ label: "Skipped (existing)", value: String(o.skipped) });
    return metrics.length > 0 ? { metrics } : genericSummary(o);
  },

  SUBVERTICAL_CLASSIFIER: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const metrics: KeyMetric[] = [];
    if (typeof o.subNicheSlug === "string") metrics.push({ label: "Sub-niche", value: o.subNicheSlug });
    if (typeof o.confidence === "number") metrics.push({ label: "Confidence", value: `${Math.round(o.confidence * 100)}%` });
    if (typeof o.reasoning === "string") {
      return { headline: shortStr(o.reasoning, 110), metrics };
    }
    return { metrics };
  },

  APIFY_FACEBOOK_DEEP: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const posts = Array.isArray(o.posts) ? (o.posts as Array<Record<string, unknown>>) : [];
    const top = posts.reduce<Record<string, unknown> | null>((best, p) => {
      const eng = ((p.likes as number) ?? 0) + ((p.comments as number) ?? 0) + ((p.shares as number) ?? 0);
      const bestEng = best
        ? ((best.likes as number) ?? 0) + ((best.comments as number) ?? 0) + ((best.shares as number) ?? 0)
        : -1;
      return eng > bestEng ? p : best;
    }, null);
    return {
      metrics: [
        { label: "Posts scraped", value: String(o.count ?? posts.length) },
        ...(top
          ? [
              { label: "Top engagement", value: String(((top.likes as number) ?? 0) + ((top.comments as number) ?? 0) + ((top.shares as number) ?? 0)) },
              { label: "Latest text", value: shortStr(top.text, 90) },
            ]
          : []),
      ],
    };
  },

  APIFY_INSTAGRAM_DEEP: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const posts = Array.isArray(o.posts) ? (o.posts as Array<Record<string, unknown>>) : [];
    const top = posts.reduce<Record<string, unknown> | null>((best, p) => {
      const eng = ((p.likes as number) ?? 0) + ((p.comments as number) ?? 0);
      const bestEng = best ? ((best.likes as number) ?? 0) + ((best.comments as number) ?? 0) : -1;
      return eng > bestEng ? p : best;
    }, null);
    return {
      metrics: [
        { label: "Posts scraped", value: String(o.count ?? posts.length) },
        ...(top
          ? [
              { label: "Top engagement", value: String(((top.likes as number) ?? 0) + ((top.comments as number) ?? 0)) },
              { label: "Latest caption", value: shortStr(top.caption, 90) },
            ]
          : []),
      ],
    };
  },

  APIFY_TIKTOK_DEEP: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const videos = Array.isArray(o.videos) ? (o.videos as Array<Record<string, unknown>>) : [];
    const top = videos.reduce<Record<string, unknown> | null>((best, v) => {
      const eng = ((v.likes as number) ?? 0) + ((v.comments as number) ?? 0) + ((v.shares as number) ?? 0);
      const bestEng = best
        ? ((best.likes as number) ?? 0) + ((best.comments as number) ?? 0) + ((best.shares as number) ?? 0)
        : -1;
      return eng > bestEng ? v : best;
    }, null);
    return {
      metrics: [
        { label: "Videos scraped", value: String(o.count ?? videos.length) },
        ...(top
          ? [
              { label: "Top engagement", value: String(((top.likes as number) ?? 0) + ((top.comments as number) ?? 0) + ((top.shares as number) ?? 0)) },
              { label: "Latest text", value: shortStr(top.text, 90) },
            ]
          : []),
      ],
    };
  },

  APIFY_LINKEDIN_COMPANY: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const jobs = Array.isArray(o.jobs) ? (o.jobs as Array<Record<string, unknown>>) : [];
    return {
      metrics: [
        { label: "Open roles", value: String(o.count ?? jobs.length) },
        ...(typeof o.companySlug === "string" ? [{ label: "Company", value: o.companySlug as string }] : []),
        ...(jobs[0]
          ? [{ label: "Latest job", value: shortStr((jobs[0] as Record<string, unknown>).title, 90) }]
          : []),
      ],
    };
  },

  APIFY_REDDIT_MENTIONS: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const mentions = Array.isArray(o.mentions) ? (o.mentions as Array<Record<string, unknown>>) : [];
    const top = mentions.reduce<Record<string, unknown> | null>((best, m) => {
      const score = (m.score as number) ?? 0;
      const bestScore = best ? ((best.score as number) ?? 0) : -1;
      return score > bestScore ? m : best;
    }, null);
    return {
      metrics: [
        { label: "Mentions", value: String(o.count ?? mentions.length) },
        ...(top
          ? [
              { label: "Top score", value: String((top.score as number) ?? 0) },
              { label: "Top thread", value: shortStr(top.title ?? top.body, 90) },
            ]
          : []),
      ],
    };
  },

  APIFY_SERP_RANK: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const snaps = Array.isArray(o.snapshots) ? (o.snapshots as Array<Record<string, unknown>>) : [];
    const ranked = snaps.filter((s) => typeof s.rank === "number" && s.rank !== null);
    const best = ranked.reduce<Record<string, unknown> | null>((b, s) => {
      const r = s.rank as number;
      const br = b ? (b.rank as number) : Number.POSITIVE_INFINITY;
      return r < br ? s : b;
    }, null);
    return {
      metrics: [
        { label: "Queries", value: String(snaps.length) },
        { label: "Ranked queries", value: String(ranked.length) },
        ...(best
          ? [
              { label: "Best rank", value: `#${best.rank}` },
              { label: "On query", value: shortStr(best.query, 60) },
            ]
          : []),
      ],
    };
  },

  APIFY_COMPETITOR_ADS: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const ads = Array.isArray(o.ads) ? (o.ads as Array<Record<string, unknown>>) : [];
    return {
      metrics: [
        { label: "Ads in market", value: String(o.count ?? ads.length) },
        ...(typeof o.country === "string" ? [{ label: "Country", value: o.country as string }] : []),
        ...(typeof o.searchText === "string" ? [{ label: "Query", value: shortStr(o.searchText) }] : []),
        ...(ads[0]
          ? [{ label: "Latest headline", value: shortStr((ads[0] as Record<string, unknown>).title ?? (ads[0] as Record<string, unknown>).body, 90) }]
          : []),
      ],
    };
  },

  APIFY_GMAPS_DEEP: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    return {
      metrics: [
        ...(typeof o.reviewsCount === "number" ? [{ label: "Reviews ingested", value: String(o.reviewsCount) }] : []),
        ...(typeof o.emailsFound === "number" ? [{ label: "Emails found", value: String(o.emailsFound) }] : []),
        ...(typeof o.socialsFound === "number" ? [{ label: "Socials found", value: String(o.socialsFound) }] : []),
      ],
    };
  },

  APIFY_WEB_CRAWL_DEEP: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const pages = Array.isArray(o.pages) ? (o.pages as Array<Record<string, unknown>>) : [];
    return {
      metrics: [
        { label: "Pages crawled", value: String(o.pageCount ?? pages.length) },
        ...(pages[0]
          ? [{ label: "Sample page", value: shortStr((pages[0] as Record<string, unknown>).title ?? (pages[0] as Record<string, unknown>).url, 90) }]
          : []),
      ],
    };
  },

  WEBSITE_MOCKUP_GENERATOR: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const sections = Array.isArray(o.sections) ? (o.sections as Array<Record<string, unknown>>) : [];
    return {
      metrics: [
        { label: "Sections", value: String(sections.length) },
        ...(typeof o.publicUrl === "string" ? [{ label: "Public URL", value: o.publicUrl as string }] : []),
        ...(typeof o.slug === "string" ? [{ label: "Slug", value: o.slug as string }] : []),
      ],
    };
  },

  OPENER_WRITER: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    return {
      headline: typeof o.message === "string" ? shortStr(o.message, 110) : undefined,
      metrics: [
        ...(typeof o.fewShotCount === "number" ? [{ label: "Few-shot examples", value: String(o.fewShotCount) }] : []),
        ...(typeof o.preservedManualEdit === "boolean"
          ? [{ label: "Manual edit kept", value: o.preservedManualEdit ? "yes" : "no" }]
          : []),
        ...(typeof o.mockupUrl === "string" && o.mockupUrl
          ? [{ label: "Linked mockup", value: o.mockupUrl as string }]
          : []),
      ],
    };
  },

  VIDEO_SCRIPT_WRITER: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const scenes = Array.isArray(o.scenes) ? (o.scenes as unknown[]) : [];
    return {
      metrics: [
        { label: "Scenes", value: String(scenes.length) },
        ...(typeof o.durationSec === "number" ? [{ label: "Duration", value: `${o.durationSec}s` }] : []),
        ...(typeof o.hook === "string" ? [{ label: "Hook", value: shortStr(o.hook) }] : []),
      ],
    };
  },

  EMAIL_VERIFIER: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    return {
      metrics: [
        ...(typeof o.total === "number" ? [{ label: "Verified", value: String(o.total) }] : []),
        ...(typeof o.valid === "number" ? [{ label: "Valid", value: String(o.valid) }] : []),
      ],
    };
  },

  LEAD_INTELLIGENCE_BRIEF: (o) => {
    const skip = pickSkip(o);
    if (skip) return skip;
    const points = Array.isArray(o.talkingPoints) ? (o.talkingPoints as unknown[]) : [];
    return {
      headline: typeof o.headline === "string" ? shortStr(o.headline, 110) : undefined,
      metrics: [
        ...(typeof o.salesConfidence === "number"
          ? [{ label: "Sales confidence", value: `${o.salesConfidence}/100` }]
          : []),
        { label: "Talking points", value: String(points.length) },
        ...(typeof o.bestTimeToCall === "string" && o.bestTimeToCall
          ? [{ label: "Best time", value: o.bestTimeToCall as string }]
          : []),
      ],
    };
  },
};

/**
 * Builds a tiny preview summary of an `AgentRun.outputJson` for the
 * dossier source-chip popover. Falls back to a generic key-listing
 * summary when the worker kind is not explicitly handled (so a newly
 * added worker still renders something useful instead of an empty
 * chip).
 *
 * Always safe to call — never throws on malformed input.
 */
export function summarizeForDossier(
  kind: AgentWorkerKind,
  output: unknown,
): DossierSourceSummary {
  if (output == null) return EMPTY;
  if (typeof output !== "object") {
    return { metrics: [{ label: "Output", value: shortStr(output) }] };
  }
  const o = output as Record<string, unknown>;
  const summarizer = SUMMARIZERS[kind];
  try {
    if (summarizer) return summarizer(o);
  } catch {
    // Defensive: a malformed output should never crash the API route.
  }
  return genericSummary(o);
}
