/**
 * Evidence shelf — the review card's four drawers (Harita / Site / Yorum / Karar).
 *
 * Each drawer is one worker of the automatic chain. Left column is what the
 * worker (or the brief) claims, right column is what that claim stands on.
 * A conflict line sits on a row when the two do not say the same thing:
 *
 *   - Kutup (polarity): the reviews praise it, or mention it once, and the
 *     brief sells it as a frequent complaint.
 *   - Sayı (count): a percentage from fewer than 30 reviews is not a global
 *     problem ("Beş yorum, yüzde yüz küresel sorun olamaz.").
 *   - Kimlik (identity): a quoted review is not in this business's reviews,
 *     or the talk track's branch count is not the account's.
 *   - Tür (type): the talk track states a site observation while the site
 *     drawer has no readable site; a talk-track pain has no review behind it
 *     ("Brief'te var, yorumda yok.").
 *
 * Pure: no Prisma, no model call. The reviews page loads the latest
 * successful run of each worker (workspace scoped) and hands the outputs
 * here. Duration and cost never appear on the shelf — they live in Vaka izi.
 *
 * Spec: docs/superpowers/specs/2026-09-28-inceleme-kanit-rafi-design.md,
 * docs/admin-paneli-son-karar.md Çelişki 2, plan Task 5.
 */
import type { ReviewLens } from "@/generated/prisma/client";
import { moduleLabel, object, strings, type DecisionCard } from "@/lib/control/decision";
import { formatControlDate, packageLabel, packageText, wedgeLabel } from "@/lib/control/labels";
import { normalizePainPhrases } from "@/lib/review-analysis/pain-phrases";

export type ShelfCell = { text: string; muted?: boolean };
export type ShelfRow = { claim: ShelfCell; support: ShelfCell; conflict: string | null };
export type DrawerKey = "map" | "site" | "reviews" | "decision";
export type Drawer = { key: DrawerKey; label: string; rows: ShelfRow[]; empty: boolean };

export type ShelfRun = { workerKind: string; status: string; finishedAt: string | null; output: unknown; errorMsg: string | null };

/** WebsiteAudit row, flattened. `hasQrMenu` / `hasOnlineOrdering` come from rawFeaturesJson (tri-state; undefined on pre-Task-2 audits). */
export type ShelfAudit = {
  url: string;
  reachable: boolean;
  crawlError: string | null;
  crawlAttemptedAt: string | null;
  hasBookingSystem: boolean;
  bookingProvider: string | null;
  hasQrMenu?: boolean | null;
  hasOnlineOrdering?: boolean | null;
  /** Deep-capture coverage (absent on shallow audits and on rows written before the capture). */
  coverage?: {
    status: string;
    opened: number;
    skipped: number;
    failed: number;
    notOpened: Array<{ url: string; type: string; reason: string }>;
  } | null;
  /** Prepayment fact with its scope ("group_or_event" = restricted: groups, private events, seasonal / special days, or stated as uncertain). */
  prepayment?: { scope: string | null; url: string; quote: string | null } | null;
};

/** ReviewAnalysis row, flattened. */
export type ShelfReviewAnalysis = {
  reviewsAnalyzedCount: number;
  analyzedAt: string | null;
  weaknessKpis: unknown;
  painPhrases: unknown;
  strengthPhrases: unknown;
};

export type ShelfLead = { websiteUrl: string | null; googleMapsUri: string | null; address: string | null; rating: number | null; reviewCount: number | null };

export type ShelfInput = {
  runs: ShelfRun[];
  card: DecisionCard;
  lead: ShelfLead;
  locationCount: number;
  /** Optional DB rows behind the run outputs (the run output alone lacks QR / ordering / KPI bars). */
  audit?: ShelfAudit | null;
  reviewAnalysis?: ShelfReviewAnalysis | null;
};

export const DRAWER_LABELS: Record<DrawerKey, string> = { map: "Harita", site: "Site", reviews: "Yorum", decision: "Karar" };

const DRAWER_KINDS: Record<DrawerKey, string> = {
  map: "APIFY_GMAPS_DEEP",
  site: "WEBSITE_AUDITOR",
  reviews: "REVIEW_ANALYST",
  decision: "LEAD_INTELLIGENCE_BRIEF",
};

/** Same threshold as REVIEW_ANALYST's MIN_REVIEW_CORPUS (not imported: that module pulls in the model client). */
const MIN_CORPUS = 30;
const STALE_AUDIT_DAYS = 30;

const ORDER: Record<ReviewLens, DrawerKey[]> = {
  TECHNICAL: ["map", "site", "reviews", "decision"],
  DOMAIN: ["site", "decision", "reviews", "map"],
  SALES: ["decision", "reviews", "site", "map"],
};

/** Drawer order per lens. Drawers never disappear; only the order (and which are open) changes. */
export function drawerOrder(lens: ReviewLens | null): DrawerKey[] {
  return lens ? [...ORDER[lens]] : [...ORDER.TECHNICAL];
}

export function orderDrawers(drawers: Drawer[], lens: ReviewLens | null): Drawer[] {
  const order = drawerOrder(lens);
  return [...drawers].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

// ---------------------------------------------------------------- text helpers

const ONES = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** Turkish number words, 0–999 ("beş", "yüz", "otuz iki"). Larger numbers fall back to digits. */
export function turkishNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
  if (n < 10) return ONES[n];
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  if (hundreds) parts.push(hundreds === 1 ? "yüz" : `${ONES[hundreds]} yüz`);
  if (tens) parts.push(TENS[tens]);
  if (ones) parts.push(ONES[ones]);
  return parts.join(" ");
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1) : text;
}

function lower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function date(iso: string | null | undefined): string {
  return iso ? formatControlDate(iso) : "tarih yok";
}

/** Strip anything that reads as money or duration out of free text (worker error messages). */
function clean(text: string): string {
  return text.replace(/\$\s?\d+(\.\d+)?/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Rough language of a quote — enough for "alıntının dili". */
export function quoteLanguage(text: string): string {
  if (/[çğıöşüİ]/i.test(text) || /(^|\s)(ve|bir|çok|için|ama|değil|yok|var)(\s|$|[.,!?])/i.test(text)) return "Türkçe";
  if (/[a-z]/i.test(text)) return "İngilizce";
  return "dil belirsiz";
}

const SOCIAL_HOST = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|twitter\.com|x\.com|linktr\.ee|linkedin\.com|youtube\.com|wa\.me)$/i;

export function isSocialUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return SOCIAL_HOST.test(new URL(url.includes("://") ? url : `https://${url}`).hostname);
  } catch {
    return false;
  }
}

const SKIP_TEXT: Record<string, string> = {
  apify_quota: "Apify kotası doldu; tarama atlandı.",
  apify_not_configured: "Apify ayarlı değil; tarama atlandı.",
  no_place_found: "Haritada bu işletme bulunamadı.",
  thin_corpus: "Yorum sayısı eşiğin altında; analiz yapılmadı.",
  no_reviews: "Yorum yok; analiz yapılmadı.",
  analysis_failed: "Yorum analizi düştü; satır yazılmadı.",
  embedding_unavailable: "Gömme servisi yanıt vermedi; analiz yazılmadı.",
  head_agent_off: "Head agent kapalı; bu brief karar üretmedi.",
  no_website: "Lead kaydında web adresi yok.",
  social_media_only: "Sosyal profil; site değil.",
  crawl_failed: "Site taranamadı.",
};

/** Turkish sentence for a worker's `skipped` reason. */
export function skipReasonText(reason: string): string {
  return SKIP_TEXT[reason] ?? "Atlandı.";
}

const CRAWL_ERROR_TEXT: Record<string, string> = {
  TIMEOUT: "zaman aşımı",
  DNS_ERROR: "alan adı çözülmedi (süresi dolmuş olabilir)",
  TLS_ERROR: "SSL hatası",
  BOT_BLOCKED_4XX: "site botu engelledi; insan açabilir",
  SERVER_5XX: "sunucu hatası",
  REDIRECT_LOOP: "yönlendirme döngüsü",
  PLAYWRIGHT_CRASH: "tarayıcı çöktü",
  EMPTY_RESPONSE: "boş sayfa",
  SOCIAL_MEDIA_ONLY: "sosyal profil",
};

function crawlErrorText(code: string): string {
  return CRAWL_ERROR_TEXT[code] ?? "taranamadı";
}

const COVERAGE_REASON_TEXT: Record<string, string> = {
  limit_type: "tür sınırı",
  limit_total: "sayfa sınırı",
  budget: "süre yetmedi",
  aborted: "iptal edildi",
  duplicate: "yinelenen sayfa",
  robots_disallow: "robots.txt izin vermiyor",
  timeout: "zaman aşımı",
  http_error: "sayfa hata verdi",
  blocked: "bot engeli",
  offsite: "başka siteye yönlendi",
  too_large: "dosya çok büyük",
  not_pdf: "PDF değil",
  nav_error: "açılamadı",
  unsafe_url: "güvenli olmayan adres",
};

function coverageReasonText(reason: string): string {
  return COVERAGE_REASON_TEXT[reason] ?? "okunamadı";
}

function pathLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

/** `skipped` is `true` on some paths and the reason string on others (A's contract). */
function skipReason(output: unknown): string | null {
  const o = object(output);
  if (typeof o.skipped === "string" && o.skipped) return o.skipped;
  if (o.skipped === true) return textOf(o.reason) ?? "unknown";
  return null;
}

function latestRun(runs: ShelfRun[], kind: string): ShelfRun | null {
  const ok = runs
    .filter(r => r.workerKind === kind && (r.status === "SUCCEEDED" || r.status === "SUCCEEDED_NO_MEMORY"))
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  if (ok[0]) return ok[0];
  return runs.filter(r => r.workerKind === kind).sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0] ?? null;
}

function cell(text: string, muted = false): ShelfCell {
  return muted ? { text, muted } : { text };
}

function row(claim: ShelfCell, support: ShelfCell, conflict: string | null = null): ShelfRow {
  return { claim, support, conflict };
}

function noRecord(key: DrawerKey): Drawer {
  const what: Record<DrawerKey, string> = {
    map: "Harita taraması bu lead için hiç çalışmadı.",
    site: "Site denetimi bu lead için hiç çalışmadı.",
    reviews: "Yorum analizi bu lead için hiç çalışmadı.",
    decision: "Brief bu lead için hiç çalışmadı.",
  };
  return { key, label: DRAWER_LABELS[key], empty: true, rows: [row(cell("Kayıt yok", true), cell(what[key], true))] };
}

function failedDrawer(key: DrawerKey, run: ShelfRun): Drawer {
  return {
    key,
    label: DRAWER_LABELS[key],
    empty: false,
    rows: [row(cell("Son çalışma düştü; başarılı kayıt yok", true), cell(`${run.errorMsg ? clean(run.errorMsg) : "Hata mesajı yok"} · ${date(run.finishedAt)}`))],
  };
}

// ---------------------------------------------------------------- drawers

function mapDrawer(input: ShelfInput): Drawer {
  const run = latestRun(input.runs, DRAWER_KINDS.map);
  if (!run) return noRecord("map");
  if (run.status !== "SUCCEEDED" && run.status !== "SUCCEEDED_NO_MEMORY") return failedDrawer("map", run);
  const { rating, reviewCount } = input.lead;
  const claim = cell(`Puan ${rating == null ? "yok" : rating.toLocaleString("tr-TR")} · Google'da ${reviewCount == null ? "yorum sayısı yok" : `${reviewCount} yorum`}`);
  const skipped = skipReason(run.output);
  if (skipped) return { key: "map", label: DRAWER_LABELS.map, empty: false, rows: [row(claim, cell(`${skipReasonText(skipped)} · ${date(run.finishedAt)}`, true))] };
  const pulled = numberOf(object(run.output).reviewsCount);
  const support = cell(`Çekilen yorum: ${pulled ?? "bilinmiyor"} · çekim ${date(run.finishedAt)}`);
  let conflict: string | null = null;
  if (pulled === 0 && (reviewCount ?? 0) > 0) conflict = "Haritada yorum var, tarama hiç yorum çekemedi.";
  else if (pulled != null && pulled > 0 && pulled < MIN_CORPUS) conflict = `Çekilen ${pulled} yorum; bu örneklem yüzde taşımaz.`;
  return { key: "map", label: DRAWER_LABELS.map, empty: false, rows: [row(claim, support, conflict)] };
}

type SiteState = { usable: boolean; social: boolean };

function siteDrawer(input: ShelfInput): { drawer: Drawer; state: SiteState } {
  const run = latestRun(input.runs, DRAWER_KINDS.site);
  const unusable = (social = false): SiteState => ({ usable: false, social });
  if (!run) return { drawer: noRecord("site"), state: unusable() };
  if (run.status !== "SUCCEEDED" && run.status !== "SUCCEEDED_NO_MEMORY") return { drawer: failedDrawer("site", run), state: unusable() };
  const output = object(run.output);
  const skipped = skipReason(run.output);
  const url = textOf(output.url) ?? input.audit?.url ?? input.lead.websiteUrl;
  const social = skipped === "social_media_only" || input.audit?.crawlError === "SOCIAL_MEDIA_ONLY" || isSocialUrl(url);

  if (social) {
    return {
      drawer: {
        key: "site", label: DRAWER_LABELS.site, empty: false,
        rows: [row(cell("Rezervasyon / QR / sipariş: okunamadı", true), cell(`Sosyal profil: ${url ?? "adres yok"} — site değil · ${date(run.finishedAt)}`))],
      },
      state: unusable(true),
    };
  }
  if (skipped) {
    const detail = skipped === "crawl_failed" && textOf(output.errorMsg) ? ` (${clean(String(output.errorMsg))})` : "";
    return {
      drawer: {
        key: "site", label: DRAWER_LABELS.site, empty: false,
        rows: [row(cell(skipped === "no_website" ? "Site yok" : "Site okunamadı", true), cell(`${skipReasonText(skipped)}${detail} · ${url ?? "adres yok"} · ${date(run.finishedAt)}`))],
      },
      state: unusable(),
    };
  }

  const audit = input.audit ?? null;
  const reachable = audit ? audit.reachable : output.reachable === true;
  const crawlError = audit?.crawlError ?? null;
  const auditedAt = audit?.crawlAttemptedAt ?? run.finishedAt;
  const support = cell([
    url ?? "adres yok",
    reachable ? "erişilebilir" : "erişilemedi",
    crawlError ? crawlErrorText(crawlError) : null,
    `denetim ${date(auditedAt)}`,
  ].filter(Boolean).join(" · "));

  const booking = audit?.bookingProvider
    ? `Rezervasyon var (${audit.bookingProvider})`
    : (audit ? audit.hasBookingSystem : output.hasBookingSystem === true) ? "Rezervasyon var" : "Rezervasyon görünmüyor";
  const qr = audit?.hasQrMenu === true ? "QR menü var" : audit?.hasQrMenu === false ? "QR menü yok (menü bağlantısı var, QR sağlayıcısı yok)" : "QR menü kontrol edilmedi";
  const order = audit?.hasOnlineOrdering === true ? "Online sipariş var" : audit?.hasOnlineOrdering === false ? "Online sipariş yok" : "Online sipariş kontrol edilmedi";

  let firstConflict: string | null = null;
  if (!reachable && /var/.test(booking)) firstConflict = "Site açılmadı; “var” bulgusu bugünkü siteyi göstermiyor.";
  const briefAt = input.card.finishedAt;
  if (!firstConflict && auditedAt && briefAt) {
    const days = (new Date(briefAt).getTime() - new Date(auditedAt).getTime()) / 86_400_000;
    if (days > STALE_AUDIT_DAYS) firstConflict = `Denetim brief'ten ${Math.floor(days)} gün eski; kaynak bayat olabilir.`;
  }
  const rows = [
    row(cell(booking), support, firstConflict),
    row(cell(qr, audit?.hasQrMenu == null), support),
    row(cell(order, audit?.hasOnlineOrdering == null), support),
  ];
  if (audit?.prepayment) {
    const scoped = audit.prepayment.scope === "group_or_event";
    rows.push(row(
      cell(scoped ? "Kapora: kısıtlı (grup, etkinlik ya da özel gün için)" : "Kapora var"),
      cell(`${audit.prepayment.url}${audit.prepayment.quote ? ` · “${clean(audit.prepayment.quote)}”` : ""}`),
    ));
  }
  if (audit?.coverage) {
    const c = audit.coverage;
    const shown = c.notOpened.slice(0, 4).map(n => `${pathLabel(n.url)} (${coverageReasonText(n.reason)})`);
    const hidden = c.notOpened.length - shown.length;
    const unread = [...shown, ...(hidden > 0 ? [`+${hidden} diğer`] : [])].join(" · ");
    const conflict = c.status === "partial" ? "Yakalama yarıda kaldı; okunmayan sayfalar var."
      : c.status === "blocked" ? "Site botu engelledi; sayfalar okunamadı."
      : c.status === "failed" ? "Yakalama başarısız; sayfalar okunamadı."
      : null;
    // Entries skipped for limit_type / duplicate are counted in `skipped` but left out of `notOpened`.
    const support = unread ? cell(`Okunamayan: ${unread}`)
      : c.skipped + c.failed === 0 ? cell("Keşfedilen her sayfa okundu", true)
      : cell("Atlananlar: tür sınırı ya da yinelenen sayfa");
    rows.push(row(
      cell(`Kapsam: ${c.opened} sayfa açıldı · ${c.skipped} atlandı · ${c.failed} açılamadı`),
      support,
      conflict,
    ));
  }
  return { drawer: { key: "site", label: DRAWER_LABELS.site, empty: false, rows }, state: { usable: reachable, social: false } };
}

type Bar = { label: string; pct: number };
type ReviewState = { count: number | null; bars: Bar[]; pains: string[]; strengths: string[]; present: boolean };

function readBars(value: unknown): Bar[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(v => {
    const o = object(v);
    const label = textOf(o.label);
    const pct = numberOf(o.percent) ?? numberOf(o.pct);
    return label && pct != null ? [{ label, pct: Math.round(pct) }] : [];
  });
}

function reviewsDrawer(input: ShelfInput): { drawer: Drawer; state: ReviewState } {
  const run = latestRun(input.runs, DRAWER_KINDS.reviews);
  const none: ReviewState = { count: null, bars: [], pains: [], strengths: [], present: false };
  if (!run) return { drawer: noRecord("reviews"), state: none };
  if (run.status !== "SUCCEEDED" && run.status !== "SUCCEEDED_NO_MEMORY") return { drawer: failedDrawer("reviews", run), state: none };
  const output = object(run.output);
  const skipped = skipReason(run.output);
  if (skipped) {
    const count = numberOf(output.count);
    const detail = skipped === "thin_corpus" && count != null ? ` (${count} yorum, en az ${numberOf(output.min) ?? MIN_CORPUS})` : "";
    return {
      drawer: { key: "reviews", label: DRAWER_LABELS.reviews, empty: false, rows: [row(cell("Acı cümlesi yok", true), cell(`${skipReasonText(skipped)}${detail} · ${date(run.finishedAt)}`))] },
      state: { ...none, count },
    };
  }
  const analysis = input.reviewAnalysis ?? null;
  const count = analysis?.reviewsAnalyzedCount ?? numberOf(output.reviewsAnalyzedCount) ?? numberOf(output.count);
  const bars = readBars(analysis?.weaknessKpis ?? output.weaknessKpis ?? output.bars).sort((a, b) => b.pct - a.pct);
  const pains = normalizePainPhrases(analysis?.painPhrases ?? output.painPhrases);
  const strengths = strings(analysis?.strengthPhrases ?? output.strengthPhrases);
  const analyzedAt = analysis?.analyzedAt ?? run.finishedAt;
  const countText = count == null ? "okunan yorum sayısı yok" : `${count} yorum okundu`;

  const rows: ShelfRow[] = [];
  for (const bar of bars.slice(0, 3)) {
    const conflict = count != null && count < MIN_CORPUS
      ? `${capitalize(turkishNumber(count))} yorum, yüzde ${turkishNumber(bar.pct)} küresel sorun olamaz.`
      : null;
    rows.push(row(
      cell(`${bar.label} · %${bar.pct}${count != null ? ` (${count} yorumda)` : ""}`),
      cell(`${countText} · yüzde olumsuz yorumlar içinde · analiz ${date(analyzedAt)} · alıntı dili: ${quoteLanguage(bar.label)}`),
      conflict,
    ));
  }
  for (const pain of pains.slice(0, 3)) {
    rows.push(row(
      cell(`“${pain.text}”${pain.sellable === false ? " · satılabilir değil" : ""}`),
      cell(`${countText} · analiz ${date(analyzedAt)} · alıntı dili: ${quoteLanguage(pain.text)}`),
    ));
  }
  if (!rows.length) rows.push(row(cell("Acı cümlesi yok", true), cell(`${countText} · analiz ${date(analyzedAt)}`)));
  return {
    drawer: { key: "reviews", label: DRAWER_LABELS.reviews, empty: false, rows },
    state: { count, bars, pains: pains.map(p => p.text), strengths, present: true },
  };
}

// ---------------------------------------------------------------- talk-track checks

const PAIN_WORDS = /(şikay|şikâyet|sorun|dert|complain|problem|issue|frustrat|mutsuz|bekle|wait|yavaş|slow)/i;
const FREQUENCY_WORDS = /(^|[\s,.;:])(sık|sıklıkla|sürekli|hep|çoğu|çoğunlukla|genellikle|always|constantly|often|frequently|most)([\s,.;:!?]|$)/i;
const SITE_OBSERVATION = /(sitenizi|sitenizde|sitenize|web sitenizi|websitenizi|your (web)?site|on your website)/i;
const STOP_STEMS = new Set(["müşte", "misaf", "şikay", "şikây", "sorun", "yorum", "insan", "sizin", "sizde", "işlet", "resto", "resta", "custo", "guest", "revie", "compl", "probl", "issue", "frust", "mutsu", "değil", "olara", "çünkü", "about", "their", "there", "which", "dertl"]);

function stems(text: string): string[] {
  return lower(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 4)
    .map(w => w.slice(0, 5))
    .filter(s => !STOP_STEMS.has(s));
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? []).map(s => s.trim()).filter(Boolean);
}

const NUMBER_WORDS: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function branchCount(sentence: string): number | null {
  const m = lower(sentence).match(/(\d+|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|one|two|three|four|five|six)\s+(şube|lokasyon|location|branch)/u);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]] ?? null;
}

function quotesFrom(lines: string[]): string[] {
  return lines.flatMap(line => {
    const m = line.match(/yorum:\s*["“](.+?)["”]/i);
    return m ? [m[1].trim()] : [];
  });
}

function containsLoosely(haystack: string[], needle: string): boolean {
  const n = lower(needle);
  return haystack.some(h => {
    const l = lower(h);
    return l.includes(n) || n.includes(l);
  });
}

function talkTrackRows(input: ShelfInput, site: SiteState, reviews: ReviewState): ShelfRow[] {
  const card = input.card;
  const out: ShelfRow[] = [];
  const reviewStems = new Set([...reviews.bars.map(b => b.label), ...reviews.pains].flatMap(stems));
  const reviewSupport = reviews.present
    ? `Yorum çekmecesi: ${[...reviews.bars.map(b => `${b.label} %${b.pct}`), ...reviews.pains.map(p => `“${p}”`)].slice(0, 3).join(" · ") || "acı cümlesi yok"}`
    : "Yorum çekmecesinde analiz yok";

  for (const sentence of sentences(card.talkTrack ?? "")) {
    if (PAIN_WORDS.test(sentence)) {
      const own = stems(sentence);
      const matched = own.filter(s => reviewStems.has(s));
      if (!reviews.present || matched.length === 0) {
        out.push(row(cell(sentence), cell(reviewSupport, true), "Brief'te var, yorumda yok."));
        continue;
      }
      if (FREQUENCY_WORDS.test(sentence)) {
        const bar = reviews.bars.find(b => stems(b.label).some(s => matched.includes(s)));
        if ((reviews.count ?? 0) < MIN_CORPUS || !bar || bar.pct < MIN_CORPUS) {
          out.push(row(cell(sentence), cell(reviewSupport), "Yorum seyrek söylüyor, brief “sık şikayet” diyor."));
          continue;
        }
      }
    }
    if (SITE_OBSERVATION.test(sentence) && !site.usable) {
      out.push(row(cell(sentence), cell(site.social ? "Site çekmecesi: sosyal profil, site değil" : "Site çekmecesi: okunabilir site yok", true), "Konuşma site gözlemi gibi konuşuyor, site açık değil."));
      continue;
    }
    const branches = branchCount(sentence);
    if (branches != null && branches !== input.locationCount) {
      out.push(row(cell(sentence), cell(`Hesapta ${input.locationCount} lokasyon`), `Konuşmada ${branches} şube, hesapta ${input.locationCount} lokasyon.`));
    }
  }

  const quoteLines = [...(card.roomOne?.evidence ?? []), ...card.evidenceRefs];
  for (const quote of new Set(quotesFrom(quoteLines))) {
    if (reviews.strengths.length && containsLoosely(reviews.strengths, quote) && !containsLoosely(reviews.pains, quote)) {
      out.push(row(cell(`Alıntı: “${quote}”`), cell("Yorum çekmecesinde olumlu cümle olarak duruyor"), "Yorum övüyor, brief şikayet diye kullanıyor."));
    } else if (!containsLoosely([...reviews.pains, ...reviews.strengths], quote)) {
      out.push(row(cell(`Alıntı: “${quote}”`), cell(reviews.present ? "Yorum çekmecesinde bu cümle yok" : "Yorum çekmecesinde analiz yok", true), "Alıntı yorum çekmecesinde yok; haritadaki yorumlardan doğrula."));
    }
  }
  return out;
}

const SOURCE_LABEL: Record<string, string> = { map: "Harita", website: "Site", reviews: "Yorum" };

function decisionDrawer(input: ShelfInput, site: SiteState, reviews: ReviewState): Drawer {
  const run = latestRun(input.runs, DRAWER_KINDS.decision);
  if (!run) return noRecord("decision");
  if (run.status !== "SUCCEEDED" && run.status !== "SUCCEEDED_NO_MEMORY") return failedDrawer("decision", run);
  const skipped = skipReason(run.output);
  if (skipped) return { key: "decision", label: DRAWER_LABELS.decision, empty: false, rows: [row(cell("Karar yok", true), cell(`${skipReasonText(skipped)} · ${date(run.finishedAt)}`))] };

  const card = input.card;
  if (!card.hasHeadAgent) {
    return { key: "decision", label: DRAWER_LABELS.decision, empty: false, rows: [row(cell("Head agent kararı yok", true), cell("Bu brief eski modda üretildi; Oda 1 çıktısı yok.", true))] };
  }
  const room = card.roomOne;
  const rows: ShelfRow[] = [];

  const plan = card.recommendedPackage;
  rows.push(row(
    cell(`Paket: ${plan ? packageText(plan) : "yok"}`, !plan),
    room ? cell(`Oda 1 paketi: ${packageLabel(room.plan)}`) : cell("Oda 1 çıktısı yok", true),
    room && plan && plan !== room.plan ? "Kart ile Oda 1 farklı paket söylüyor." : null,
  ));
  rows.push(row(
    cell(`Kaçak: ${card.wedge ? wedgeLabel(card.wedge) : "yok"}`, !card.wedge),
    room ? cell(`Oda 1 kaçağı: ${wedgeLabel(room.wedge)} · yedek: ${room.backup ? wedgeLabel(room.backup) : "yok"}`) : cell("Oda 1 çıktısı yok", true),
    room && card.wedge && card.wedge !== room.wedge ? "Kart ile Oda 1 farklı kaçak söylüyor." : null,
  ));
  rows.push(row(
    card.talkTrack ? cell(`Konuşma: ${card.talkTrack}`) : cell(`Konuşma yok${card.roomTwoStatus ? ` (Oda 2: ${roomTwoText(card.roomTwoStatus)})` : ""}`, true),
    room?.evidence.length ? cell(`Oda 1 kanıtı: ${room.evidence.join(" · ")}`) : cell("Oda 1 kanıt satırı yok", true),
  ));
  rows.push(...talkTrackRows(input, site, reviews));
  rows.push(row(
    cell(`Modül sırası: ${card.recommendedModules.map((m, i) => `${i + 1}. ${moduleLabel(m)}`).join(" · ") || "modül yok"}`, card.recommendedModules.length === 0),
    card.excludedModules.length
      ? cell(`Hariç: ${card.excludedModules.map(m => `${moduleLabel(m.module)} — ${m.why || "gerekçe yok"}`).join(" · ")}`)
      : cell("Hariç tutulan modül yok", true),
  ));
  rows.push(row(
    cell(`Açı: ${card.primaryAngle ?? "yok"}`, !card.primaryAngle),
    room?.bans.length ? cell(`Yasaklar: ${room.bans.join(" · ")}`) : cell("Oda 1 yasak yazmadı", true),
  ));
  if (card.missingSources.length) {
    rows.push(row(cell("Eksik kaynakla karar verildi", true), cell(`Eksik: ${card.missingSources.map(s => SOURCE_LABEL[s] ?? s).join(", ")}`)));
  }
  return { key: "decision", label: DRAWER_LABELS.decision, empty: false, rows };
}

function roomTwoText(status: string): string {
  const map: Record<string, string> = { attached: "eklendi", shadow: "gölge mod", qa_failed: "kalite kontrolünden geçmedi", unavailable: "model yanıt vermedi", skipped: "atlandı" };
  return map[status] ?? "durum yok";
}

/** Four drawers in canonical order (map, site, reviews, decision). Use `orderDrawers` for a lens. */
export function buildShelf(input: ShelfInput): Drawer[] {
  const map = mapDrawer(input);
  const site = siteDrawer(input);
  const reviews = reviewsDrawer(input);
  const decision = decisionDrawer(input, site.state, reviews.state);
  return [map, site.drawer, reviews.drawer, decision];
}

/** Flatten a WebsiteAudit row for the shelf (rawFeaturesJson carries the tri-state menu signals). */
export function shelfAuditFromRow(row: {
  url: string; reachable: boolean; crawlError: string | null; crawlAttemptedAt: Date | null;
  hasBookingSystem: boolean; bookingProvider: string | null; rawFeaturesJson: unknown;
} | null): ShelfAudit | null {
  if (!row) return null;
  const raw = object(row.rawFeaturesJson);
  const tri = (v: unknown): boolean | null | undefined => (v === true || v === false || v === null ? v : undefined);
  const facts = object(raw.siteFacts);
  const cov = object(facts.coverage);
  const pre = object(facts.hasPrepayment);
  const preUrl = textOf(pre.url);
  return {
    url: row.url,
    reachable: row.reachable,
    crawlError: row.crawlError,
    crawlAttemptedAt: row.crawlAttemptedAt?.toISOString() ?? null,
    hasBookingSystem: row.hasBookingSystem,
    bookingProvider: row.bookingProvider,
    hasQrMenu: tri(raw.hasQrMenu),
    hasOnlineOrdering: tri(raw.hasOnlineOrdering),
    coverage: numberOf(cov.opened) == null ? null : {
      status: textOf(cov.status) ?? "complete",
      opened: numberOf(cov.opened) ?? 0,
      skipped: numberOf(cov.skipped) ?? 0,
      failed: numberOf(cov.failed) ?? 0,
      notOpened: Array.isArray(cov.notOpened)
        ? cov.notOpened.flatMap(v => {
            const o = object(v);
            const url = textOf(o.url);
            return url ? [{ url, type: textOf(o.type) ?? "other", reason: textOf(o.reason) ?? "budget" }] : [];
          })
        : [],
    },
    prepayment: preUrl ? { scope: textOf(pre.scope), url: preUrl, quote: textOf(pre.quote) } : null,
  };
}
