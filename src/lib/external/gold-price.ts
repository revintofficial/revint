/**
 * Gram altın (TRY) fiyat abstraction.
 *
 * Why: Berkay paketinin 1 numaralı satış kozu canlı gram altın widget'ı.
 * Tüm kuyumcu mockup'larında hero altında dar bir şerit halinde "gram
 * altın: ₺X,XXX" gösteriyoruz. Şerit `/m/[slug]` route'unda her serve'de
 * string-replace ile inject ediliyor — htmlCache invalidation gerek YOK,
 * cache stale değil, sadece bir DOM yerine canlı veri sokuluyor.
 *
 * Data source strategy (ucretsiz → ucretli sıralaması):
 *   1. `GOLD_API_KEY` env'de varsa GoldAPI.io (saniyelik güncel, $5/ay)
 *   2. Yoksa truncgil.com'un public JSON endpoint'i (saatlik güncel,
 *      ücretsiz, tarihçesi >5 yıl — stabil)
 *   3. İkisi de patlarsa Redis'teki son geçerli değer (stale-while-
 *      revalidate), o da yoksa null → renderer "—" gösterir.
 *
 * Cache: Redis key `gold:gram:try`, TTL 600s (10 dk). Cron her 5 dk'da
 * bir refresh çağırır; refresh failure'da TTL dolup eski değer
 * süpürülmeden önce bir sonraki cron başarılı olur. TTL'nin cron
 * aralığından uzun olması "redis ölmedi, sadece fetch başarısız" hali
 * için ekstra dakikalık tolerans tanır.
 *
 * Safety: hiçbir fonksiyon throw etmez; her şey null'la döner. Renderer
 * canlı fiyat eksikliğini gracefully ele alıyor (placeholder "—"
 * gösteriyor). Cron job'un başarısızlığı kuyumcu mockup'ını yıkmaz.
 */

import { getRequestRedis, getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export interface GoldPriceQuote {
  /** Gram altın alış fiyatı (TRY). */
  buy: number;
  /** Gram altın satış fiyatı (TRY). */
  sell: number;
  /** UTC timestamp ms when this quote was fetched from source. */
  fetchedAt: number;
  /** Telemetry — which source produced this number. */
  source: "goldapi" | "truncgil" | "cache" | "manual";
}

const REDIS_KEY = "gold:gram:try";
const TTL_SECONDS = 600;

/**
 * Read the latest cached gram altın price from Redis. Returns null
 * when:
 *   - Redis is unreachable (HTTP-path client gives up fast)
 *   - The key has expired (cron failed and TTL ran out)
 *   - The cached blob is malformed (manual edit, schema drift)
 *
 * Renderer is the primary caller. Cron worker calls `refreshGramGoldTRY`
 * which writes fresh data; this read path is keyed off the same row.
 *
 * The HTTP-path Redis client (`getRequestRedis`) is used here so a
 * Redis outage can't wedge `/m/[slug]` — a ~800ms commandTimeout
 * surfaces as a thrown error in <1s, we catch and return null, the
 * route serves the page with "—" in the price slot.
 */
export async function readGramGoldTRYCached(): Promise<GoldPriceQuote | null> {
  let raw: string | null = null;
  try {
    raw = await getRequestRedis().get(REDIS_KEY);
  } catch (err) {
    logger.warn("gold_price.cache_read_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoldPriceQuote>;
    if (
      typeof parsed.buy !== "number" ||
      typeof parsed.sell !== "number" ||
      typeof parsed.fetchedAt !== "number" ||
      parsed.buy <= 0 ||
      parsed.sell <= 0
    ) {
      return null;
    }
    return {
      buy: parsed.buy,
      sell: parsed.sell,
      fetchedAt: parsed.fetchedAt,
      source: "cache",
    };
  } catch {
    return null;
  }
}

/**
 * Force-fetch a fresh gram altın quote, persist it to Redis with a
 * 10-minute TTL, and return it. Called by the seo-ops cron every 5
 * minutes. Returns null when every configured source fails — caller
 * (the cron handler) logs and tries again next tick.
 *
 * Order:
 *   1. GoldAPI.io if `GOLD_API_KEY` set (paid; saniyelik güncel)
 *   2. truncgil.com (free; saatlik güncel)
 *
 * The cron worker uses `getRedis()` (BullMQ-class client) for the
 * write because it's already inside a worker process with the
 * "hang until reachable" semantics — fast-failing here is wrong
 * (we'd silently lose data on transient blips).
 */
export async function refreshGramGoldTRY(): Promise<GoldPriceQuote | null> {
  // GoldAPI first when the key is configured. Returns USD/oz by
  // default; we'd need to convert to TRY/gram — skip USD endpoint
  // and use their direct XAU/TRY endpoint instead.
  if (process.env.GOLD_API_KEY) {
    const quote = await fetchFromGoldApi();
    if (quote) {
      await persistQuote(quote);
      return quote;
    }
  }

  const quote = await fetchFromTruncgil();
  if (quote) {
    await persistQuote(quote);
    return quote;
  }

  logger.warn("gold_price.refresh_no_source_succeeded");
  return null;
}

/**
 * GoldAPI.io fetcher. Endpoint: `https://www.goldapi.io/api/XAU/TRY`.
 * Returns ounce price; we convert to gram (1 troy ounce = 31.1035
 * grams). buy/sell spread approximated as ±0.5% because the public
 * spot endpoint doesn't carry separate bid/ask.
 */
async function fetchFromGoldApi(): Promise<GoldPriceQuote | null> {
  const key = process.env.GOLD_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://www.goldapi.io/api/XAU/TRY", {
      method: "GET",
      headers: { "x-access-token": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      logger.warn("gold_price.goldapi_http_error", { status: res.status });
      return null;
    }
    const json = (await res.json()) as { price?: number };
    if (typeof json.price !== "number" || json.price <= 0) return null;
    const pricePerGram = json.price / 31.1035;
    return {
      // Use saf altın (24 ayar) as the reference — buy/sell spread
      // ~%0.5 (kuyumcu marjı genelde bunun üstünde, ama referans
      // değer olarak yazıyoruz; "tam fiyat için WhatsApp" CTA'sı
      // marj farkını kapatıyor).
      buy: Math.round(pricePerGram * 0.995 * 100) / 100,
      sell: Math.round(pricePerGram * 1.005 * 100) / 100,
      fetchedAt: Date.now(),
      source: "goldapi",
    };
  } catch (err) {
    logger.warn("gold_price.goldapi_fetch_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * truncgil.com'un /v4/today.json endpoint'i TR finans verileri
 * sağlıyor (gram altın, dolar, euro). Saatlik güncellenir; "ücretsiz
 * + güvenilir + uzun ömürlü" üçlüsü için bizim için en iyi default
 * kaynak.
 *
 * Shape (Mart 2026 itibariyle):
 *   {
 *     "Meta_Data": { ... },
 *     "Rates": {
 *       "GRA": { "Buying": 2845.50, "Selling": 2848.20, "Type": "...", ... },
 *       ...
 *     }
 *   }
 *
 * Schema değişirse fetcher null döner, cron bir sonraki tick'te
 * tekrar dener, ve TTL içinde son geçerli cache servis edilmeye
 * devam eder.
 */
async function fetchFromTruncgil(): Promise<GoldPriceQuote | null> {
  try {
    const res = await fetch("https://finans.truncgil.com/v4/today.json", {
      method: "GET",
      headers: { "user-agent": "leadac-gold-price-refresh/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn("gold_price.truncgil_http_error", { status: res.status });
      return null;
    }
    const json = (await res.json()) as {
      Rates?: Record<string, { Buying?: number; Selling?: number; Type?: string }>;
    };
    const gram = json.Rates?.["GRA"] ?? json.Rates?.["gram-altin"];
    if (!gram) {
      logger.warn("gold_price.truncgil_missing_gram_key");
      return null;
    }
    const buy = typeof gram.Buying === "number" ? gram.Buying : null;
    const sell = typeof gram.Selling === "number" ? gram.Selling : null;
    if (!buy || !sell || buy <= 0 || sell <= 0) return null;
    return {
      buy: Math.round(buy * 100) / 100,
      sell: Math.round(sell * 100) / 100,
      fetchedAt: Date.now(),
      source: "truncgil",
    };
  } catch (err) {
    logger.warn("gold_price.truncgil_fetch_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Persist the quote to Redis with TTL. Uses the worker-class client
 * because the cron caller is always in a worker process. If Redis
 * is unreachable we log but don't throw — the next cron tick will
 * retry, and meanwhile the renderer falls back to "—".
 */
async function persistQuote(quote: GoldPriceQuote): Promise<void> {
  try {
    const r = getRedis();
    await r.set(REDIS_KEY, JSON.stringify(quote), "EX", TTL_SECONDS);
  } catch (err) {
    logger.warn("gold_price.persist_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Format a TRY gram altın price for HTML injection. Renderer uses
 * this from the `/m/[slug]` route's response-string-replace path so
 * the format is identical across every served mockup.
 *
 * Output examples:
 *   - `₺2.845,50` for tr locale
 *   - `₺2,845.50` for en locale
 *
 * We always show 2 decimals; gram altın hareketleri kuruş düzeyinde
 * gözlemleniyor, tam sayı yuvarlama yapay durur.
 */
export function formatGramGoldTRY(value: number, lang: "tr" | "en" = "tr"): string {
  const formatter = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}
