/**
 * SEO ops worker.
 *
 * Handles three recurring jobs:
 *   - `gsc-ingest`    — pulls yesterday's GSC metrics and caches them in
 *                       Redis for the /app/seo dashboard. Hourly.
 *   - `broken-links`  — weekly scan of every URL in the sitemap index,
 *                       recording any 4xx/5xx responses.
 *   - `indexnow-ping` — forwards a batch of URLs to the IndexNow endpoint
 *                       so Bing + Yandex pick them up within minutes of
 *                       publication. Fired ad-hoc by crawl-completion
 *                       hooks (see src/lib/seo/indexnow.ts).
 *
 * All three are idempotent; a missed run is reconciled on the next tick.
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getRedis } from "../lib/redis";
import { getSeoOpsQueue } from "../lib/queues";
import { logger } from "../lib/logger";
import { fetchSearchAnalytics, isGscConfigured } from "../lib/seo/gsc";
import { pingIndexNow } from "../lib/seo/indexnow";
import { SITE } from "../lib/seo/metadata";
import { refreshGramGoldTRY } from "../lib/external/gold-price";

type SeoOpsJobData =
  | { kind: "gsc-ingest" }
  | { kind: "broken-links" }
  | { kind: "indexnow-ping"; urls: string[] }
  | { kind: "gold-price-refresh" };

const GSC_CACHE_QUERIES = "seo:gsc:queries:latest";
const GSC_CACHE_PAGES = "seo:gsc:pages:latest";
const GSC_CACHE_DAILY = "seo:gsc:daily";
const BROKEN_LINKS_KEY = "seo:broken-links:latest";

async function processJob(job: Job<SeoOpsJobData>) {
  const { kind } = job.data;
  logger.info("worker.seo_ops.starting", { kind });

  if (kind === "gsc-ingest") return runGscIngest();
  if (kind === "broken-links") return runBrokenLinks();
  if (kind === "indexnow-ping") return runIndexNowPing(job.data.urls);
  if (kind === "gold-price-refresh") return runGoldPriceRefresh();

  return null;
}

/**
 * Kuyumcu mockup'larındaki canlı gram altın widget'ı için Redis
 * cache'ini günceller. Her 5 dk'da bir tetiklenir; TTL 10 dk olduğu
 * için tek bir cron miss bile veri kaybına yol açmaz. Renderer
 * tarafı Redis-erişim hatalarında "—" gösterip sessizce geçer, bu
 * yüzden job'un kendisi de sessizce başarısız olabilir.
 */
async function runGoldPriceRefresh() {
  const quote = await refreshGramGoldTRY();
  if (!quote) {
    logger.warn("worker.seo_ops.gold_price_refresh_failed");
    return { ok: false, reason: "no_source_available" };
  }
  logger.info("worker.seo_ops.gold_price_refreshed", {
    buy: quote.buy,
    sell: quote.sell,
    source: quote.source,
  });
  return { ok: true, buy: quote.buy, sell: quote.sell, source: quote.source };
}

function yyyymmdd(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

async function runGscIngest() {
  if (!isGscConfigured()) {
    logger.info("worker.seo_ops.gsc_skipped", { reason: "not_configured" });
    return { skipped: true };
  }
  const start = yyyymmdd(3);
  const end = yyyymmdd(1);

  const [queries, pages, daily] = await Promise.all([
    fetchSearchAnalytics({
      startDate: start,
      endDate: end,
      dimensions: ["query"],
      rowLimit: 1000,
    }),
    fetchSearchAnalytics({
      startDate: start,
      endDate: end,
      dimensions: ["page"],
      rowLimit: 1000,
    }),
    fetchSearchAnalytics({
      startDate: yyyymmdd(28),
      endDate: yyyymmdd(1),
      dimensions: ["date"],
      rowLimit: 90,
    }),
  ]);

  const r = getRedis();
  const ttl = 60 * 60 * 24 * 3;
  await r.set(
    GSC_CACHE_QUERIES,
    JSON.stringify({ updatedAt: Date.now(), range: { start, end }, rows: queries }),
    "EX",
    ttl,
  );
  await r.set(
    GSC_CACHE_PAGES,
    JSON.stringify({ updatedAt: Date.now(), range: { start, end }, rows: pages }),
    "EX",
    ttl,
  );
  await r.set(
    GSC_CACHE_DAILY,
    JSON.stringify({ updatedAt: Date.now(), rows: daily }),
    "EX",
    ttl,
  );

  logger.info("worker.seo_ops.gsc_ingested", {
    queries: queries.length,
    pages: pages.length,
    days: daily.length,
  });

  return { queries: queries.length, pages: pages.length, days: daily.length };
}

async function runBrokenLinks() {
  const indexUrl = `${SITE.url}/sitemap.xml`;
  const urls: string[] = [];
  try {
    const res = await fetch(indexUrl, {
      headers: { "user-agent": "leadac-broken-link-scanner/1.0" },
    });
    if (!res.ok) throw new Error(`sitemap index ${res.status}`);
    const indexBody = await res.text();
    const chunkUrls = [...indexBody.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .slice(0, 20);
    for (const chunkUrl of chunkUrls) {
      try {
        const cRes = await fetch(chunkUrl, {
          headers: { "user-agent": "leadac-broken-link-scanner/1.0" },
        });
        const body = await cRes.text();
        for (const m of body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
          urls.push(m[1]);
        }
      } catch {
        /* ignore individual chunk failures */
      }
    }
  } catch (err) {
    logger.error("worker.seo_ops.broken_links_sitemap_failed", { err });
    return { skipped: true, reason: "sitemap_unreachable" };
  }

  const sample = urls.slice(0, 500);
  const broken: Array<{ url: string; status: number }> = [];
  const concurrency = 10;
  let idx = 0;
  async function worker() {
    while (idx < sample.length) {
      const i = idx++;
      const url = sample[i];
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          headers: { "user-agent": "leadac-broken-link-scanner/1.0" },
        });
        if (!res.ok) broken.push({ url, status: res.status });
      } catch {
        broken.push({ url, status: 0 });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const payload = {
    scannedAt: Date.now(),
    totalUrls: urls.length,
    sampled: sample.length,
    broken,
  };
  await getRedis().set(BROKEN_LINKS_KEY, JSON.stringify(payload), "EX", 60 * 60 * 24 * 14);

  if (broken.length > 0) {
    logger.warn("worker.seo_ops.broken_links_found", {
      count: broken.length,
      sampled: sample.length,
    });
  } else {
    logger.info("worker.seo_ops.broken_links_clean", {
      sampled: sample.length,
    });
  }
  return payload;
}

async function runIndexNowPing(urls: string[]) {
  if (!urls.length) return { skipped: true };
  const ok = await pingIndexNow(urls);
  return { ok, count: urls.length };
}

export function startSeoOpsWorker(): Worker<SeoOpsJobData> {
  // M11 fix - the worker used to share `getRedis()` with the queue
  // producer, but BullMQ's Worker uses blocking BRPOP commands which
  // monopolise the connection. Whenever the producer side issued a
  // GSC cache write (`r.set`) on the same client, the worker's
  // blocking call would race the SET and either time out or wedge.
  // A dedicated IORedis instance for the worker avoids the conflict.
  // `getRedis()` is still used inside the job bodies for caching
  // because the producer-style traffic is fine to share.
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );
  const worker = new Worker<SeoOpsJobData>("seo-ops", processJob, {
    connection,
    concurrency: 2,
  });

  worker.on("failed", (job, err) => {
    logger.error("worker.seo_ops.failed", {
      jobId: job?.id,
      kind: job?.data.kind,
      err: err?.message,
    });
  });

  void registerSchedules();

  return worker;
}

async function registerSchedules() {
  try {
    const q = getSeoOpsQueue();

    await q.add(
      "gsc-ingest",
      { kind: "gsc-ingest" },
      {
        jobId: "cron-gsc-ingest",
        repeat: { pattern: "13 * * * *" },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      },
    );

    await q.add(
      "broken-links",
      { kind: "broken-links" },
      {
        jobId: "cron-broken-links",
        repeat: { pattern: "0 6 * * 1" },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 20 },
      },
    );

    // Kuyumcu mockup'larında her sayfa serve'inde inject edilen canlı
    // gram altın widget'ı için Redis cache refresh. 5 dakikada bir
    // — gram altın saatlik değişimlerini kolaylıkla yakalar, TTL 10 dk
    // olduğundan tek bir miss bile veri boşluğu yaratmaz.
    await q.add(
      "gold-price-refresh",
      { kind: "gold-price-refresh" },
      {
        jobId: "cron-gold-price-refresh",
        repeat: { pattern: "*/5 * * * *" },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 20 },
      },
    );

    logger.info("worker.seo_ops.schedules_registered");
  } catch (err) {
    logger.error("worker.seo_ops.schedule_register_failed", { err });
  }
}
