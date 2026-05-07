import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getRedis } from "@/lib/redis";

/**
 * Server-side query helpers for the /admin marketing analytics
 * dashboard. These are imported by both the page server components
 * (RSC data fetching) AND the /api/admin/* route handlers (so a
 * future client widget can refetch). Keeping the SQL in one place
 * means the admin index stays cheap and consistent.
 *
 * EVERY function here reads from the marketing_* tables (founder-
 * level, NOT workspace-scoped). They MUST only be called from a
 * server context that has already passed `requireAdminEmail()` —
 * never expose them to a workspace-scoped route.
 */

export type DateRange = {
  start: Date;
  end: Date;
};

export function rangeForPreset(preset: "today" | "7d" | "30d" | "90d"): DateRange {
  const end = new Date();
  const start = new Date();
  if (preset === "today") {
    start.setUTCHours(0, 0, 0, 0);
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 30);
  } else {
    start.setDate(start.getDate() - 90);
  }
  return { start, end };
}

/* ---------------------- Overview KPIs ---------------------- */

export interface OverviewKpis {
  sessions: number;
  uniqueVisitors: number;
  conversions: number;
  conversionRatePct: number;
  avgDurationMs: number;
  avgPagesPerSession: number;
  bounceRatePct: number;
  engagedRatePct: number;
}

export async function getOverviewKpis(range: DateRange): Promise<OverviewKpis> {
  const [agg, uniques] = await Promise.all([
    prisma.marketingSession.aggregate({
      where: { startedAt: { gte: range.start, lte: range.end } },
      _count: { _all: true },
      _avg: { durationMs: true, pageCount: true },
    }),
    prisma.marketingSession.findMany({
      where: { startedAt: { gte: range.start, lte: range.end } },
      select: { visitorId: true, pageCount: true, hasEngaged: true, hasConverted: true },
    }),
  ]);

  const sessions = agg._count._all;
  const uniqueVisitors = new Set(uniques.map((s) => s.visitorId)).size;
  const conversions = uniques.filter((s) => s.hasConverted).length;
  const engaged = uniques.filter((s) => s.hasEngaged).length;
  const bounces = uniques.filter((s) => s.pageCount <= 1 && !s.hasEngaged).length;

  return {
    sessions,
    uniqueVisitors,
    conversions,
    conversionRatePct: sessions > 0 ? (conversions / sessions) * 100 : 0,
    avgDurationMs: Math.round(agg._avg.durationMs ?? 0),
    avgPagesPerSession: Number((agg._avg.pageCount ?? 0).toFixed(2)),
    bounceRatePct: sessions > 0 ? (bounces / sessions) * 100 : 0,
    engagedRatePct: sessions > 0 ? (engaged / sessions) * 100 : 0,
  };
}

/* ---------------------- Sessions list ---------------------- */

export interface SessionListItem {
  id: string;
  visitorId: string;
  startedAt: Date;
  durationMs: number | null;
  country: string | null;
  device: string | null;
  landingPath: string;
  exitPath: string | null;
  pageCount: number;
  maxScrollPct: number;
  hasEngaged: boolean;
  hasConverted: boolean;
  utmSource: string | null;
  utmCampaign: string | null;
  posthogSessionId: string | null;
}

export interface SessionListFilters {
  start?: Date;
  end?: Date;
  country?: string;
  device?: string;
  utmSource?: string;
  hasConverted?: boolean;
  hasEngaged?: boolean;
  visitorId?: string;
}

export async function listSessions(
  filters: SessionListFilters,
  page: number,
  pageSize: number,
): Promise<{ items: SessionListItem[]; total: number; hasNext: boolean }> {
  const where: Prisma.MarketingSessionWhereInput = {};
  if (filters.start || filters.end) {
    where.startedAt = {
      ...(filters.start ? { gte: filters.start } : {}),
      ...(filters.end ? { lte: filters.end } : {}),
    };
  }
  if (filters.country) where.country = filters.country;
  if (filters.device) where.device = filters.device;
  if (filters.utmSource) where.utmSource = filters.utmSource;
  if (filters.visitorId) where.visitorId = filters.visitorId;
  if (typeof filters.hasConverted === "boolean") where.hasConverted = filters.hasConverted;
  if (typeof filters.hasEngaged === "boolean") where.hasEngaged = filters.hasEngaged;

  const safePageSize = Math.max(1, Math.min(200, pageSize));
  const safePage = Math.max(0, page);

  const [items, total] = await Promise.all([
    prisma.marketingSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: safePage * safePageSize,
      take: safePageSize,
      select: {
        id: true,
        visitorId: true,
        startedAt: true,
        durationMs: true,
        country: true,
        device: true,
        landingPath: true,
        exitPath: true,
        pageCount: true,
        maxScrollPct: true,
        hasEngaged: true,
        hasConverted: true,
        utmSource: true,
        utmCampaign: true,
        posthogSessionId: true,
      },
    }),
    prisma.marketingSession.count({ where }),
  ]);

  return {
    items,
    total,
    hasNext: (safePage + 1) * safePageSize < total,
  };
}

/* ---------------------- Session detail ---------------------- */

export async function getSessionDetail(id: string) {
  const session = await prisma.marketingSession.findUnique({ where: { id } });
  if (!session) return null;

  const [pageViews, events] = await Promise.all([
    prisma.marketingPageView.findMany({
      where: { sessionId: id },
      orderBy: { enteredAt: "asc" },
    }),
    prisma.marketingEvent.findMany({
      where: { sessionId: id },
      orderBy: { ts: "asc" },
      take: 2_000,
    }),
  ]);

  return { session, pageViews, events };
}

/* ---------------------- Pages aggregate ---------------------- */

export interface PageAggregateRow {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgDurationMs: number;
  avgScrollPct: number;
  bucketLt25: number;
  bucket25to50: number;
  bucket50to75: number;
  bucket75to100: number;
  exits: number;
  exitRatePct: number;
}

export async function getPageAggregates(range: DateRange): Promise<PageAggregateRow[]> {
  // Pull all the page-view rows in range. For low-traffic this is
  // fine; if traffic explodes we'll revisit with a materialised view.
  const rows = await prisma.marketingPageView.findMany({
    where: { enteredAt: { gte: range.start, lte: range.end } },
    select: {
      path: true,
      sessionId: true,
      durationMs: true,
      maxScrollPct: true,
    },
  });

  const exitsByPath = await prisma.marketingSession.groupBy({
    by: ["exitPath"],
    where: {
      startedAt: { gte: range.start, lte: range.end },
      exitPath: { not: null },
    },
    _count: { _all: true },
  });
  const exitMap = new Map<string, number>();
  for (const e of exitsByPath) {
    if (e.exitPath) exitMap.set(e.exitPath, e._count._all);
  }

  const byPath = new Map<
    string,
    {
      views: number;
      durations: number[];
      scrolls: number[];
      sessions: Set<string>;
    }
  >();

  for (const r of rows) {
    let bucket = byPath.get(r.path);
    if (!bucket) {
      bucket = { views: 0, durations: [], scrolls: [], sessions: new Set() };
      byPath.set(r.path, bucket);
    }
    bucket.views++;
    bucket.sessions.add(r.sessionId);
    if (typeof r.durationMs === "number") bucket.durations.push(r.durationMs);
    bucket.scrolls.push(r.maxScrollPct);
  }

  const result: PageAggregateRow[] = [];
  for (const [path, b] of byPath) {
    const avgDur = b.durations.length
      ? b.durations.reduce((a, c) => a + c, 0) / b.durations.length
      : 0;
    const avgScroll = b.scrolls.length
      ? b.scrolls.reduce((a, c) => a + c, 0) / b.scrolls.length
      : 0;
    let lt25 = 0;
    let b25 = 0;
    let b50 = 0;
    let b75 = 0;
    for (const s of b.scrolls) {
      if (s < 25) lt25++;
      else if (s < 50) b25++;
      else if (s < 75) b50++;
      else b75++;
    }
    const exits = exitMap.get(path) ?? 0;
    result.push({
      path,
      views: b.views,
      uniqueVisitors: b.sessions.size,
      avgDurationMs: Math.round(avgDur),
      avgScrollPct: Math.round(avgScroll),
      bucketLt25: lt25,
      bucket25to50: b25,
      bucket50to75: b50,
      bucket75to100: b75,
      exits,
      exitRatePct: b.views > 0 ? (exits / b.views) * 100 : 0,
    });
  }

  result.sort((a, b) => b.views - a.views);
  return result;
}

/* ---------------------- Funnels ---------------------- */

export interface FunnelStep {
  label: string;
  match: { path?: string; eventType?: string };
  count: number;
  dropoffPct: number;
}

const DEFAULT_FUNNEL: Array<{ label: string; match: FunnelStep["match"] }> = [
  { label: "Visited home", match: { path: "/" } },
  { label: "Visited pricing", match: { path: "/pricing" } },
  { label: "Visited signup", match: { path: "/signup" } },
  { label: "Completed signup", match: { eventType: "signup" } },
];

export async function getDefaultFunnel(range: DateRange): Promise<FunnelStep[]> {
  // Strategy: for each step, find the set of session IDs that match
  // the step's filter AND already matched all prior steps. Sequence
  // is enforced by timestamp (event/page must occur >= prior
  // step's timestamp for that session).
  type SessionTs = Map<string, Date>; // sessionId -> earliest matching ts

  const stepSessions: SessionTs[] = [];
  for (const step of DEFAULT_FUNNEL) {
    const sessions = new Map<string, Date>();
    if (step.match.path) {
      const rows = await prisma.marketingPageView.findMany({
        where: {
          path: step.match.path,
          enteredAt: { gte: range.start, lte: range.end },
        },
        select: { sessionId: true, enteredAt: true },
      });
      for (const r of rows) {
        const prev = sessions.get(r.sessionId);
        if (!prev || r.enteredAt < prev) sessions.set(r.sessionId, r.enteredAt);
      }
    } else if (step.match.eventType) {
      const rows = await prisma.marketingEvent.findMany({
        where: {
          type: step.match.eventType,
          ts: { gte: range.start, lte: range.end },
        },
        select: { sessionId: true, ts: true },
      });
      for (const r of rows) {
        const prev = sessions.get(r.sessionId);
        if (!prev || r.ts < prev) sessions.set(r.sessionId, r.ts);
      }
    }
    stepSessions.push(sessions);
  }

  // Apply ordering: a session is "at step N" only if it matched
  // step N at a timestamp >= its match for step N-1.
  let prev: Map<string, Date> | null = null;
  const stepCounts: number[] = [];
  for (let i = 0; i < stepSessions.length; i++) {
    const cur = stepSessions[i];
    if (!prev) {
      stepCounts.push(cur.size);
      prev = cur;
      continue;
    }
    const filtered = new Map<string, Date>();
    for (const [sid, ts] of cur) {
      const prior = prev.get(sid);
      if (prior && ts >= prior) filtered.set(sid, ts);
    }
    stepCounts.push(filtered.size);
    prev = filtered;
  }

  return DEFAULT_FUNNEL.map((s, i) => ({
    label: s.label,
    match: s.match,
    count: stepCounts[i] ?? 0,
    dropoffPct:
      i === 0 || (stepCounts[i - 1] ?? 0) === 0
        ? 0
        : ((stepCounts[i - 1]! - stepCounts[i]!) / stepCounts[i - 1]!) * 100,
  }));
}

/* ---------------------- Errors + Web Vitals ---------------------- */

export interface ErrorRow {
  message: string;
  source: string | null;
  count: number;
  sessions: number;
  lastSeen: Date;
  exampleSessionId: string;
}

export async function getErrorAggregates(range: DateRange): Promise<ErrorRow[]> {
  const rows = await prisma.marketingEvent.findMany({
    where: {
      type: "error",
      ts: { gte: range.start, lte: range.end },
    },
    orderBy: { ts: "desc" },
    take: 5_000,
    select: {
      sessionId: true,
      ts: true,
      properties: true,
    },
  });

  const byMessage = new Map<
    string,
    {
      message: string;
      source: string | null;
      count: number;
      sessions: Set<string>;
      lastSeen: Date;
      exampleSessionId: string;
    }
  >();

  for (const r of rows) {
    const props = (r.properties as Record<string, unknown> | null) ?? {};
    const message = (typeof props.message === "string" ? (props.message as string) : "(unknown)").slice(
      0,
      200,
    );
    const source = typeof props.source === "string" ? (props.source as string) : null;
    const key = `${message}::${source ?? ""}`;
    let bucket = byMessage.get(key);
    if (!bucket) {
      bucket = {
        message,
        source,
        count: 0,
        sessions: new Set(),
        lastSeen: r.ts,
        exampleSessionId: r.sessionId,
      };
      byMessage.set(key, bucket);
    }
    bucket.count++;
    bucket.sessions.add(r.sessionId);
    if (r.ts > bucket.lastSeen) bucket.lastSeen = r.ts;
  }

  return Array.from(byMessage.values())
    .map((b) => ({
      message: b.message,
      source: b.source,
      count: b.count,
      sessions: b.sessions.size,
      lastSeen: b.lastSeen,
      exampleSessionId: b.exampleSessionId,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface VitalsSummary {
  metric: string;
  count: number;
  p50: number;
  p75: number;
  p95: number;
  goodPct: number;
}

export async function getWebVitalsSummary(): Promise<VitalsSummary[]> {
  // Reuse the existing Redis ZSETs maintained by /api/web-vitals.
  const metrics = ["LCP", "INP", "CLS", "FCP", "TTFB"];
  const out: VitalsSummary[] = [];
  let r: ReturnType<typeof getRedis>;
  try {
    r = getRedis();
  } catch {
    return [];
  }
  for (const m of metrics) {
    const raw = await r.zrange(`web-vitals:${m}`, 0, -1).catch(() => [] as string[]);
    if (!raw.length) {
      out.push({ metric: m, count: 0, p50: 0, p75: 0, p95: 0, goodPct: 0 });
      continue;
    }
    const samples: Array<{ value: number; rating: string | null }> = [];
    for (const s of raw) {
      try {
        const j = JSON.parse(s) as { value?: number; rating?: string };
        if (typeof j.value === "number" && Number.isFinite(j.value)) {
          samples.push({ value: j.value, rating: j.rating ?? null });
        }
      } catch {
        // skip malformed
      }
    }
    if (!samples.length) {
      out.push({ metric: m, count: 0, p50: 0, p75: 0, p95: 0, goodPct: 0 });
      continue;
    }
    const sorted = samples.map((s) => s.value).sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
    const good = samples.filter((s) => s.rating === "good").length;
    out.push({
      metric: m,
      count: samples.length,
      p50: at(0.5),
      p75: at(0.75),
      p95: at(0.95),
      goodPct: (good / samples.length) * 100,
    });
  }
  return out;
}

/* ---------------------- Sources / UTM ---------------------- */

export interface SourceRow {
  source: string;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  conversions: number;
  conversionRatePct: number;
  topLandingPath: string | null;
}

export async function getSourceMatrix(range: DateRange): Promise<SourceRow[]> {
  const sessions = await prisma.marketingSession.findMany({
    where: { startedAt: { gte: range.start, lte: range.end } },
    select: {
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      hasConverted: true,
      landingPath: true,
      referrer: true,
    },
  });

  const buckets = new Map<
    string,
    {
      source: string;
      medium: string | null;
      campaign: string | null;
      sessions: number;
      conversions: number;
      landings: Map<string, number>;
    }
  >();

  for (const s of sessions) {
    let source = s.utmSource;
    if (!source && s.referrer) {
      try {
        source = `(referral) ${new URL(s.referrer).hostname}`;
      } catch {
        source = "(referral)";
      }
    }
    if (!source) source = "(direct)";
    const key = `${source}::${s.utmMedium ?? ""}::${s.utmCampaign ?? ""}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        source,
        medium: s.utmMedium,
        campaign: s.utmCampaign,
        sessions: 0,
        conversions: 0,
        landings: new Map(),
      };
      buckets.set(key, b);
    }
    b.sessions++;
    if (s.hasConverted) b.conversions++;
    b.landings.set(s.landingPath, (b.landings.get(s.landingPath) ?? 0) + 1);
  }

  const rows: SourceRow[] = [];
  for (const b of buckets.values()) {
    let topLanding: string | null = null;
    let topCount = 0;
    for (const [path, count] of b.landings) {
      if (count > topCount) {
        topCount = count;
        topLanding = path;
      }
    }
    rows.push({
      source: b.source,
      medium: b.medium,
      campaign: b.campaign,
      sessions: b.sessions,
      conversions: b.conversions,
      conversionRatePct: b.sessions > 0 ? (b.conversions / b.sessions) * 100 : 0,
      topLandingPath: topLanding,
    });
  }
  rows.sort((a, b) => b.sessions - a.sessions);
  return rows;
}

/* ---------------------- Live counter ---------------------- */

const LIVE_CACHE_KEY = "admin:live-counter";
const LIVE_CACHE_TTL_S = 10;

export async function getLiveCounter(): Promise<{ active: number; cached: boolean }> {
  let r: ReturnType<typeof getRedis> | null = null;
  try {
    r = getRedis();
    const cached = await r.get(LIVE_CACHE_KEY);
    if (cached) {
      return { active: Number(cached) || 0, cached: true };
    }
  } catch {
    // Redis down — fall through to DB.
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const active = await prisma.marketingSession.count({
    where: { lastActivityAt: { gte: fiveMinAgo } },
  });

  if (r) {
    try {
      await r.set(LIVE_CACHE_KEY, String(active), "EX", LIVE_CACHE_TTL_S);
    } catch {
      // non-fatal
    }
  }
  return { active, cached: false };
}

/* ---------------------- Top pages / sources for overview ---------------------- */

export async function getTopPages(range: DateRange, limit = 10) {
  const grouped = await prisma.marketingPageView.groupBy({
    by: ["path"],
    where: { enteredAt: { gte: range.start, lte: range.end } },
    _count: { _all: true },
    orderBy: { _count: { sessionId: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({ path: g.path, views: g._count._all }));
}

export async function getTopSources(range: DateRange, limit = 10) {
  const grouped = await prisma.marketingSession.groupBy({
    by: ["utmSource"],
    where: { startedAt: { gte: range.start, lte: range.end } },
    _count: { _all: true },
    orderBy: { _count: { utmSource: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({
    source: g.utmSource ?? "(direct)",
    sessions: g._count._all,
  }));
}

/* ---------------------- Time series ---------------------- */

export interface TimeSeriesPoint {
  bucket: string; // ISO timestamp at the start of the bucket
  sessions: number;
  visitors: number;
  conversions: number;
}

/**
 * Sessions / visitors / conversions over time. Bucket size auto-picks
 * based on the requested range:
 *   - today      -> hourly buckets
 *   - 7d / 30d   -> daily buckets
 *   - 90d        -> daily buckets (could move to weekly later)
 * Returns one row per bucket including empty buckets so the chart
 * draws a continuous line.
 */
export async function getTimeSeries(
  range: DateRange,
  granularity: "hour" | "day",
): Promise<TimeSeriesPoint[]> {
  const sessions = await prisma.marketingSession.findMany({
    where: { startedAt: { gte: range.start, lte: range.end } },
    select: { startedAt: true, visitorId: true, hasConverted: true },
  });

  // Pre-fill all buckets so empty ones still render.
  const buckets = new Map<
    string,
    { sessions: number; visitors: Set<string>; conversions: number }
  >();

  const stepMs = granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const startMs = floorToBucket(range.start, granularity).getTime();
  const endMs = floorToBucket(range.end, granularity).getTime();
  for (let t = startMs; t <= endMs; t += stepMs) {
    buckets.set(new Date(t).toISOString(), {
      sessions: 0,
      visitors: new Set(),
      conversions: 0,
    });
  }

  for (const s of sessions) {
    const key = floorToBucket(s.startedAt, granularity).toISOString();
    const b = buckets.get(key);
    if (!b) continue;
    b.sessions++;
    b.visitors.add(s.visitorId);
    if (s.hasConverted) b.conversions++;
  }

  return Array.from(buckets.entries())
    .map(([bucket, b]) => ({
      bucket,
      sessions: b.sessions,
      visitors: b.visitors.size,
      conversions: b.conversions,
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function floorToBucket(d: Date, gran: "hour" | "day"): Date {
  const out = new Date(d);
  out.setUTCSeconds(0, 0);
  out.setUTCMinutes(0);
  if (gran === "day") out.setUTCHours(0);
  return out;
}

export function pickGranularity(preset: "today" | "7d" | "30d" | "90d"): "hour" | "day" {
  return preset === "today" ? "hour" : "day";
}

/* ---------------------- Geography ---------------------- */

export interface CountryRow {
  country: string | null;
  sessions: number;
  uniqueVisitors: number;
  conversions: number;
  conversionRatePct: number;
  avgDurationMs: number;
  topCity: string | null;
}

export interface CityRow {
  country: string | null;
  region: string | null;
  city: string | null;
  sessions: number;
  uniqueVisitors: number;
  conversions: number;
}

export async function getCountryBreakdown(range: DateRange): Promise<CountryRow[]> {
  const rows = await prisma.marketingSession.findMany({
    where: { startedAt: { gte: range.start, lte: range.end } },
    select: {
      country: true,
      city: true,
      visitorId: true,
      durationMs: true,
      hasConverted: true,
    },
  });

  const byCountry = new Map<
    string,
    {
      country: string | null;
      sessions: number;
      visitors: Set<string>;
      conversions: number;
      durations: number[];
      cityCounts: Map<string, number>;
    }
  >();

  for (const r of rows) {
    const key = r.country ?? "__unknown__";
    let b = byCountry.get(key);
    if (!b) {
      b = {
        country: r.country,
        sessions: 0,
        visitors: new Set(),
        conversions: 0,
        durations: [],
        cityCounts: new Map(),
      };
      byCountry.set(key, b);
    }
    b.sessions++;
    b.visitors.add(r.visitorId);
    if (r.hasConverted) b.conversions++;
    if (typeof r.durationMs === "number") b.durations.push(r.durationMs);
    if (r.city) b.cityCounts.set(r.city, (b.cityCounts.get(r.city) ?? 0) + 1);
  }

  const out: CountryRow[] = [];
  for (const b of byCountry.values()) {
    let topCity: string | null = null;
    let topCount = 0;
    for (const [c, n] of b.cityCounts) {
      if (n > topCount) {
        topCount = n;
        topCity = c;
      }
    }
    const avgDur =
      b.durations.length > 0
        ? b.durations.reduce((a, c) => a + c, 0) / b.durations.length
        : 0;
    out.push({
      country: b.country,
      sessions: b.sessions,
      uniqueVisitors: b.visitors.size,
      conversions: b.conversions,
      conversionRatePct: b.sessions > 0 ? (b.conversions / b.sessions) * 100 : 0,
      avgDurationMs: Math.round(avgDur),
      topCity,
    });
  }
  out.sort((a, b) => b.sessions - a.sessions);
  return out;
}

export async function getCityBreakdown(
  range: DateRange,
  limit = 100,
): Promise<CityRow[]> {
  const rows = await prisma.marketingSession.findMany({
    where: { startedAt: { gte: range.start, lte: range.end } },
    select: {
      country: true,
      region: true,
      city: true,
      visitorId: true,
      hasConverted: true,
    },
  });

  const map = new Map<
    string,
    {
      country: string | null;
      region: string | null;
      city: string | null;
      sessions: number;
      visitors: Set<string>;
      conversions: number;
    }
  >();
  for (const r of rows) {
    if (!r.city) continue;
    const key = `${r.country ?? ""}::${r.region ?? ""}::${r.city}`;
    let b = map.get(key);
    if (!b) {
      b = {
        country: r.country,
        region: r.region,
        city: r.city,
        sessions: 0,
        visitors: new Set(),
        conversions: 0,
      };
      map.set(key, b);
    }
    b.sessions++;
    b.visitors.add(r.visitorId);
    if (r.hasConverted) b.conversions++;
  }

  return Array.from(map.values())
    .map((b) => ({
      country: b.country,
      region: b.region,
      city: b.city,
      sessions: b.sessions,
      uniqueVisitors: b.visitors.size,
      conversions: b.conversions,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

/* ---------------------- Devices / Browsers / OS ---------------------- */

export interface BreakdownRow {
  key: string;
  label: string;
  sessions: number;
  conversions: number;
  conversionRatePct: number;
  avgDurationMs: number;
}

async function getBucketBreakdown(
  range: DateRange,
  field: "device" | "browser" | "os",
): Promise<BreakdownRow[]> {
  const rows = await prisma.marketingSession.findMany({
    where: { startedAt: { gte: range.start, lte: range.end } },
    select: {
      device: true,
      browser: true,
      os: true,
      durationMs: true,
      hasConverted: true,
    },
  });

  const map = new Map<
    string,
    { sessions: number; conversions: number; durations: number[] }
  >();
  for (const r of rows) {
    const v = r[field] ?? "(unknown)";
    let b = map.get(v);
    if (!b) {
      b = { sessions: 0, conversions: 0, durations: [] };
      map.set(v, b);
    }
    b.sessions++;
    if (r.hasConverted) b.conversions++;
    if (typeof r.durationMs === "number") b.durations.push(r.durationMs);
  }
  return Array.from(map.entries())
    .map(([key, b]) => ({
      key,
      label: key,
      sessions: b.sessions,
      conversions: b.conversions,
      conversionRatePct: b.sessions > 0 ? (b.conversions / b.sessions) * 100 : 0,
      avgDurationMs:
        b.durations.length > 0
          ? Math.round(b.durations.reduce((a, c) => a + c, 0) / b.durations.length)
          : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export const getDeviceBreakdown = (range: DateRange) => getBucketBreakdown(range, "device");
export const getBrowserBreakdown = (range: DateRange) => getBucketBreakdown(range, "browser");
export const getOsBreakdown = (range: DateRange) => getBucketBreakdown(range, "os");

/* ---------------------- Realtime feed ---------------------- */

export interface RealtimeSession {
  id: string;
  visitorId: string;
  startedAt: Date;
  lastActivityAt: Date;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  utmSource: string | null;
  pageCount: number;
  hasConverted: boolean;
  currentPath: string | null;
  currentPageEnteredAt: Date | null;
}

/**
 * Live activity feed: every session whose lastActivityAt is within the
 * last 5 minutes, plus the most recent open page-view (the one that
 * has not yet been closed with leftAt). Sorted most-recent first.
 *
 * Cost: two scoped reads. We keep the limit modest (50) — even at
 * peak only a handful are realistically active for low-traffic
 * marketing.
 */
export async function getRealtimeSessions(limit = 50): Promise<RealtimeSession[]> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const sessions = await prisma.marketingSession.findMany({
    where: { lastActivityAt: { gte: fiveMinAgo } },
    orderBy: { lastActivityAt: "desc" },
    take: limit,
    select: {
      id: true,
      visitorId: true,
      startedAt: true,
      lastActivityAt: true,
      country: true,
      city: true,
      device: true,
      browser: true,
      utmSource: true,
      pageCount: true,
      hasConverted: true,
    },
  });

  if (sessions.length === 0) return [];

  // Find the latest still-open page view per session in one query.
  const sessionIds = sessions.map((s) => s.id);
  const openPages = await prisma.marketingPageView.findMany({
    where: { sessionId: { in: sessionIds }, leftAt: null },
    orderBy: { enteredAt: "desc" },
    select: { sessionId: true, path: true, enteredAt: true },
  });
  const currentByS = new Map<string, { path: string; enteredAt: Date }>();
  for (const p of openPages) {
    if (!currentByS.has(p.sessionId)) {
      currentByS.set(p.sessionId, { path: p.path, enteredAt: p.enteredAt });
    }
  }

  return sessions.map((s) => {
    const cur = currentByS.get(s.id);
    return {
      ...s,
      currentPath: cur?.path ?? null,
      currentPageEnteredAt: cur?.enteredAt ?? null,
    };
  });
}
