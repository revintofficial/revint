import { NextResponse, type NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

/**
 * Core Web Vitals ingestion.
 *
 * Client posts one metric at a time via `navigator.sendBeacon`. We persist
 * the last N samples per metric in Redis sorted sets so the internal
 * /app/seo dashboard can render them quickly without round-tripping to the
 * analytics warehouse.
 *
 * Storage model:
 *   ZSET  web-vitals:{metric}   score=timestamp  member=JSON blob
 *   We cap each set to MAX_SAMPLES entries (ZREMRANGEBYRANK).
 *
 * Throughput expectation: 1 write per metric per pageview, dedup by sample
 * id so a single navigation only emits each metric once.
 */

const MAX_SAMPLES = 5_000;
const VALID_METRICS = new Set([
  "CLS",
  "FCP",
  "FID",
  "INP",
  "LCP",
  "TTFB",
]);

type VitalsPayload = {
  name?: string;
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
  id?: string;
  path?: string;
  ts?: number;
};

export async function POST(req: NextRequest) {
  let body: VitalsPayload;
  try {
    body = (await req.json()) as VitalsPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = (body.name ?? "").toUpperCase();
  if (!VALID_METRICS.has(name)) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const value =
    typeof body.value === "number" && Number.isFinite(body.value)
      ? body.value
      : null;
  if (value == null) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const sample = {
    name,
    value,
    rating: body.rating ?? null,
    id: body.id ?? null,
    path: typeof body.path === "string" ? body.path.slice(0, 256) : null,
    ts: typeof body.ts === "number" ? body.ts : Date.now(),
    ua: req.headers.get("user-agent")?.slice(0, 256) ?? null,
  };

  try {
    const r = getRedis();
    const key = `web-vitals:${name}`;
    await r.zadd(key, sample.ts, JSON.stringify(sample));
    await r.zremrangebyrank(key, 0, -(MAX_SAMPLES + 1));
    await r.expire(key, 60 * 60 * 24 * 30);
  } catch (err) {
    console.error("[web-vitals] redis write failed", err);
  }

  return NextResponse.json({ ok: true });
}
