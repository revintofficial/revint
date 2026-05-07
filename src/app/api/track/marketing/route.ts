import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { LIMITS, checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * Marketing analytics ingest.
 *
 * Public, anonymous, IP-rate-limited. The client batches events in
 * /src/components/analytics/marketing-tracker.tsx and POSTs them
 * here every 5 seconds (or on visibilitychange / pagehide via
 * navigator.sendBeacon).
 *
 * Hard rules:
 *   - Never store the raw IP. Hash it with sha256 + a server-side salt.
 *   - Never write form values or arbitrary properties through. We
 *     sanitise the property bag per event type.
 *   - Geo comes from edge headers only (no IP lookup library).
 *   - Idempotent enough: a duplicate batch will just bump the same
 *     session's lastActivityAt + insert duplicate events (cheap).
 *
 * Response: always 200 with {ok: true|false}. We never 4xx the
 * tracker for malformed input — analytics dropping silently is
 * preferable to a marketing page lighting up with red console errors.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENTS_PER_BATCH = 100;

const ALLOWED_EVENT_TYPES = new Set([
  "page_view",
  "page_leave",
  "scroll",
  "click",
  "cta_click",
  "form_focus",
  "form_blur",
  "form_submit",
  "video_play",
  "video_progress",
  "error",
  "signup",
]);

interface IncomingDevice {
  device?: string;
  browser?: string;
  os?: string;
  viewportWidth?: number;
  viewportHeight?: number;
}

interface IncomingUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

interface IncomingEvent {
  type?: string;
  ts?: number;
  path?: string;
  properties?: Record<string, unknown> | null;
}

interface IncomingPayload {
  visitorId?: string;
  sessionId?: string;
  sessionIsNew?: boolean;
  posthogSessionId?: string | null;
  utm?: IncomingUtm;
  referrer?: string | null;
  landingPath?: string;
  device?: IncomingDevice;
  userAgent?: string;
  events?: IncomingEvent[];
}

function safeStr(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function safeInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.trunc(v);
}

function safeIntInRange(v: unknown, min: number, max: number): number | null {
  const n = safeInt(v);
  if (n === null) return null;
  return Math.max(min, Math.min(max, n));
}

function safePath(v: unknown): string | null {
  const s = safeStr(v, 500);
  if (!s) return null;
  if (!s.startsWith("/")) return null;
  return s;
}

function safeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(v)) return null;
  return v;
}

function extractClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim().slice(0, 45);
  return null;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_IP_SALT ?? "leadac-default-salt-rotate-me";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Sanitise the per-type property bag. We trust event TYPE because
 * it's gated by ALLOWED_EVENT_TYPES, but we treat each property as
 * untrusted and only let through known fields. This is the PII
 * firewall — any field not enumerated here is dropped.
 */
function sanitiseProperties(
  type: string,
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!props || typeof props !== "object") return null;
  const out: Record<string, unknown> = {};
  switch (type) {
    case "click":
    case "cta_click":
      if (typeof props.selector === "string") out.selector = String(props.selector).slice(0, 200);
      if (typeof props.text === "string") out.text = String(props.text).slice(0, 120);
      if (typeof props.ctaId === "string") out.ctaId = String(props.ctaId).slice(0, 100);
      if (typeof props.location === "string")
        out.location = String(props.location).slice(0, 200);
      if (typeof props.x === "number" && Number.isFinite(props.x)) out.x = Math.trunc(props.x);
      if (typeof props.y === "number" && Number.isFinite(props.y)) out.y = Math.trunc(props.y);
      break;
    case "scroll":
      if (typeof props.pct === "number") out.pct = safeIntInRange(props.pct, 0, 100);
      if (typeof props.path === "string") out.path = String(props.path).slice(0, 500);
      break;
    case "form_focus":
    case "form_blur":
    case "form_submit":
      if (typeof props.formName === "string") out.formName = String(props.formName).slice(0, 100);
      if (typeof props.fieldName === "string")
        out.fieldName = String(props.fieldName).slice(0, 100);
      if (typeof props.fieldCount === "number" && Number.isFinite(props.fieldCount))
        out.fieldCount = Math.trunc(props.fieldCount);
      if (typeof props.durationMs === "number" && Number.isFinite(props.durationMs))
        out.durationMs = Math.trunc(props.durationMs);
      break;
    case "page_view":
      if (typeof props.title === "string") out.title = String(props.title).slice(0, 200);
      if (typeof props.url === "string") out.url = String(props.url).slice(0, 1000);
      if (typeof props.referrer === "string") out.referrer = String(props.referrer).slice(0, 1000);
      break;
    case "page_leave":
      if (typeof props.durationMs === "number" && Number.isFinite(props.durationMs))
        out.durationMs = Math.trunc(props.durationMs);
      if (typeof props.maxScrollPct === "number")
        out.maxScrollPct = safeIntInRange(props.maxScrollPct, 0, 100);
      if (Array.isArray(props.milestones)) {
        out.milestones = (props.milestones as unknown[])
          .filter((m): m is number => typeof m === "number")
          .slice(0, 8)
          .map((m) => Math.trunc(m));
      }
      break;
    case "video_play":
    case "video_progress":
      if (typeof props.videoId === "string") out.videoId = String(props.videoId).slice(0, 100);
      if (typeof props.pct === "number") out.pct = safeIntInRange(props.pct, 0, 100);
      break;
    case "error":
      if (typeof props.message === "string") out.message = String(props.message).slice(0, 500);
      if (typeof props.source === "string") out.source = String(props.source).slice(0, 200);
      if (typeof props.lineno === "number" && Number.isFinite(props.lineno))
        out.lineno = Math.trunc(props.lineno);
      if (typeof props.colno === "number" && Number.isFinite(props.colno))
        out.colno = Math.trunc(props.colno);
      break;
    case "signup":
      if (typeof props.method === "string") out.method = String(props.method).slice(0, 50);
      break;
    default:
      // Unknown type — drop all properties.
      break;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req);
  const subject = `mtrack:${ip ?? "anon"}`;
  const rl = await checkRateLimit(subject, LIMITS.marketingTrack);
  if (!rl.ok) return rateLimitResponse(rl);

  let body: IncomingPayload;
  try {
    body = (await req.json()) as IncomingPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const visitorId = safeId(body.visitorId);
  const sessionId = safeId(body.sessionId);
  if (!visitorId || !sessionId) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const eventsIn = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : [];
  if (eventsIn.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Geo from edge headers. Vercel ships these on every request; if
  // we're hosted elsewhere they may be absent and country/city stay
  // null which is fine.
  const country =
    safeStr(req.headers.get("x-vercel-ip-country"), 4) ??
    safeStr(req.headers.get("cf-ipcountry"), 4);
  const region =
    safeStr(req.headers.get("x-vercel-ip-country-region"), 16) ??
    safeStr(req.headers.get("cf-region-code"), 16);
  const city =
    safeStr(req.headers.get("x-vercel-ip-city"), 100) ??
    safeStr(req.headers.get("cf-ipcity"), 100);

  const ipHash = hashIp(ip);

  try {
    // Upsert session. On the first batch we create with full
    // attribution; subsequent batches only bump lastActivityAt and
    // any field we now know that we didn't before (posthogSessionId
    // typically arrives a beat later than the first event).
    const landingPath = safePath(body.landingPath) ?? "/";
    const referrer = safeStr(body.referrer, 1000);
    const userAgent = safeStr(body.userAgent, 1000);
    const device = body.device ?? {};
    const utm = body.utm ?? {};
    const posthogSessionId = safeStr(body.posthogSessionId, 100);

    await prisma.marketingSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorId,
        landingPath,
        referrer,
        userAgent,
        device: safeStr(device.device, 16),
        browser: safeStr(device.browser, 32),
        os: safeStr(device.os, 32),
        viewportWidth: safeIntInRange(device.viewportWidth, 0, 10000),
        viewportHeight: safeIntInRange(device.viewportHeight, 0, 10000),
        utmSource: safeStr(utm.utm_source, 200),
        utmMedium: safeStr(utm.utm_medium, 200),
        utmCampaign: safeStr(utm.utm_campaign, 200),
        utmContent: safeStr(utm.utm_content, 200),
        utmTerm: safeStr(utm.utm_term, 200),
        ipHash,
        country,
        region,
        city,
        posthogSessionId,
      },
      update: {
        // lastActivityAt auto-updates via @updatedAt.
        ...(posthogSessionId ? { posthogSessionId } : {}),
      },
    });

    // Bucket events by type so we can batch-write efficiently and
    // keep aggregate counters consistent.
    type EventRow = {
      sessionId: string;
      ts: Date;
      type: string;
      path: string;
      properties: Record<string, unknown> | null;
    };
    const eventRows: EventRow[] = [];
    let pageViewCount = 0;
    let maxScrollPct = 0;
    let hasEngaged = false;
    let hasConverted = false;
    let exitPath: string | null = null;
    const pageLeaves: Array<{ path: string; durationMs: number | null; maxScrollPct: number; milestones: number[] }> =
      [];
    const pageEntries: Array<{ path: string; ts: Date; title: string | null; referrer: string | null }> = [];

    for (const ev of eventsIn) {
      const type = safeStr(ev.type, 32);
      if (!type || !ALLOWED_EVENT_TYPES.has(type)) continue;
      const path = safePath(ev.path) ?? "/";
      const ts =
        typeof ev.ts === "number" && Number.isFinite(ev.ts) ? new Date(ev.ts) : new Date();
      const props = sanitiseProperties(type, ev.properties ?? null);

      eventRows.push({ sessionId, ts, type, path, properties: props });

      if (type === "page_view") {
        pageViewCount++;
        exitPath = path;
        const title = props && typeof props.title === "string" ? (props.title as string) : null;
        const refp = props && typeof props.referrer === "string" ? (props.referrer as string) : null;
        pageEntries.push({ path, ts, title, referrer: refp });
      }
      if (type === "scroll" && props && typeof props.pct === "number") {
        const pct = props.pct as number;
        if (pct > maxScrollPct) maxScrollPct = pct;
        if (pct >= 25) hasEngaged = true;
      }
      if (type === "click" || type === "cta_click") {
        hasEngaged = true;
      }
      if (type === "signup") {
        hasConverted = true;
      }
      if (type === "page_leave" && props) {
        const p = path;
        const dur = typeof props.durationMs === "number" ? (props.durationMs as number) : null;
        const ms = typeof props.maxScrollPct === "number" ? (props.maxScrollPct as number) : 0;
        if (ms > maxScrollPct) maxScrollPct = ms;
        if ((dur ?? 0) > 10_000) hasEngaged = true;
        const mls = Array.isArray(props.milestones) ? (props.milestones as number[]) : [];
        pageLeaves.push({ path: p, durationMs: dur, maxScrollPct: ms, milestones: mls });
      }
    }

    // Insert page-view rows first so we have ids for the events to
    // reference. We don't bother resolving FK ids on each event row
    // (a join via sessionId + path + ts is plenty fast for the
    // admin queries); pageViewId on MarketingEvent is reserved for
    // future explicit linking.
    if (pageEntries.length > 0) {
      await prisma.marketingPageView.createMany({
        data: pageEntries.map((p) => ({
          sessionId,
          path: p.path,
          enteredAt: p.ts,
          title: p.title,
          referrer: p.referrer,
        })),
      });
    }

    // Apply page_leave updates by closing out the most recent matching
    // page-view row. There can be more than one in pathological cases
    // (rapid SPA back-and-forth), so we update the latest one only.
    for (const pl of pageLeaves) {
      const last = await prisma.marketingPageView.findFirst({
        where: { sessionId, path: pl.path, leftAt: null },
        orderBy: { enteredAt: "desc" },
      });
      if (last) {
        await prisma.marketingPageView.update({
          where: { id: last.id },
          data: {
            leftAt: new Date(),
            durationMs: pl.durationMs,
            maxScrollPct: pl.maxScrollPct,
            scrollMilestones: pl.milestones,
          },
        });
      }
    }

    if (eventRows.length > 0) {
      await prisma.marketingEvent.createMany({
        data: eventRows.map((r) => ({
          sessionId: r.sessionId,
          ts: r.ts,
          type: r.type,
          path: r.path,
          // Prisma's `InputJsonValue` is the union accepted by JSON
          // columns. Our sanitised property bag is a plain record but
          // its `unknown` value type doesn't auto-narrow; cast through
          // a Prisma JSON-input alias so the generated type is happy.
          properties: (r.properties ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      });
    }

    // Bump the denormalised session counters in one update. We use
    // increment for pageCount because two concurrent batches mustn't
    // clobber each other; max-scroll uses a conditional update.
    await prisma.marketingSession.update({
      where: { id: sessionId },
      data: {
        ...(pageViewCount > 0 ? { pageCount: { increment: pageViewCount } } : {}),
        ...(exitPath ? { exitPath } : {}),
        ...(hasEngaged ? { hasEngaged: true } : {}),
        ...(hasConverted ? { hasConverted: true } : {}),
      },
    });
    if (maxScrollPct > 0) {
      // Race-safe max via raw SQL (Prisma doesn't expose `GREATEST`).
      await prisma.$executeRaw`UPDATE marketing_sessions SET max_scroll_pct = GREATEST(max_scroll_pct, ${maxScrollPct}) WHERE id = ${sessionId}`;
    }
  } catch (err) {
    logger.error("track.marketing.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    // Always 200 — failing the beacon makes the client retry on
    // every page nav and doesn't help us debug.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
