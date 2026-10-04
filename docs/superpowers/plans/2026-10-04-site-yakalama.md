# Site yakalama (website worker, alt proje 1) — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `WEBSITE_AUDITOR` bir sitenin ilgili her sayfasını (40 sayfaya kadar) yakalar, bulguları kanıtıyla çıkarır, neye bakıp neye bakamadığını deftere yazar; plan bittiğinde worker 12 sitelik ayrı kümede son insan testine hazırdır.

**Architecture:** Önce yakala, sonra oku. `src/lib/site-capture/` altında saf parçalar (sınıflandırma, keşif, indirgeme, defter, köprü) ve bir Playwright açıcı; `crawlWebsiteDeep` ana sayfa denetimini bugünkü koddan alır, alt sayfaları yakalar, `mergeSiteFacts`'i aynı üç sayfayla çalıştırır, sonra yalnızca `null` kalan bulguları doldurur. Zincir, kuyruk ve worker türü değişmez; yürütücüye iptal sinyali, erteleme ve worker'a özel dış sınır eklenir.

**Tech Stack:** Next.js 16.2.3, TypeScript, Prisma 6 + Postgres, BullMQ 5 (`agent-runs`), Playwright 1.59, cheerio, `unpdf` (yeni bağımlılık, PDF metni), Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-03-site-yakalama-design.md` (4 Ekim 2026 güncellemesi). Uygulayıcı her görevden önce spec'in ilgili bölümünü okur.

## Global Constraints

- Her Prisma sorgusu workspace verisinde `workspaceId` taşır (`SiteCapture`, `SiteCapturePage` dahil).
- Prisma tipleri `@/generated/prisma/client`'tan gelir, `@prisma/client`'tan değil.
- Yeni BullMQ kuyruğu yok; yeni worker türü yok; yeni Gemini çağrısı yok. Zincirler (`src/lib/ai-core/chains.ts`) değişmez.
- `null` = bilinmiyor. Hiçbir alan "görmedim" için `false` yazmaz.
- Köprü yalnızca `null` bulguları doldurur; `mergeSiteFacts`'in cevabını ezmez; `bookingChecked`, `menuPageSeen`, `orderPageSeen` alanlarına dokunmaz.
- `crawlWebsite(url, type)` imzası ve davranışı değişmez.
- Sınırlar (spec'ten birebir): site başına en fazla 40 sayfa (ana sayfa dahil), 150 sn yakalama bütçesi, sayfa başına 15 sn, aynı siteye 3 eşzamanlı sayfa, süreç başına 2 eşzamanlı site (`SITE_CAPTURE_MAX_CONCURRENT`), en fazla 5 PDF, PDF başına 15 MB, sayfa başına metin 60.000 karakter, site haritasından en fazla 150 aday, dış sağlayıcı sayfası en fazla 5.
- Tür sınırları: rezervasyon 4, dış sağlayıcı 5, menü 6, sipariş 3, etkinlik/grup 3, SSS 3, şubeler 6, iletişim 2, hakkında 2, diğer 3.
- `WEBSITE_AUDITOR` dış sınırı 300 sn (`deadlineMs`); diğer worker'ların sınırı değişmez.
- Ham HTML veritabanına yazılmaz.
- Her dış istek SSRF korumasından geçer (`assertSafeFetchUrl` / `safeFetchFollow`).
- `APIFY_WEB_CRAWL_DEEP`'e dokunulmaz (kapsam dışı).
- Dal: `prod/i-site-yakalama` (`main`'den). Çalışma ağacında bu işle ilgisiz, commit edilmemiş dosyalar var (`src/lib/safe-redirect.ts`, `src/app/admin/(marketing)/layout.tsx` ve testleri); `git add` her zaman dosya adıyla yapılır, `git add -A` kullanılmaz.
- Commit mesajları repodaki biçimde: `feat(site-capture): …`, `fix: …`, `test: …`.
- Regex içeren dosyalar Write/Edit aracıyla yazılır; bash heredoc ters eğik çizgileri yarıya indirir.

## Review Focus

Spec'in ima ettiği ama kendiliğinden test edilmeyecek, kullanıcıyı ısırma olasılığı en yüksek beş durum. Her birinin testi sahibi olan görevde yazılıdır.

1. **Her yola ana sayfayı döndüren site (SPA / yumuşak 404).** Bilinen yol denemeleri (`/faq`, `/reservations`) ana sayfanın aynısını döndürür. Beklenen: sayfa türlü sayfa olarak kaydedilmez, defterde `duplicate` olur. → Task 6.
2. **Binlerce adresli site haritası.** Zincir restoranların site haritasında binlerce adres olur. Beklenen: en fazla 150 aday alınır, defter sınırlı kalır, yakalama bütçe içinde biter. → Task 3 ve Task 6.
3. **Yalnızca gruplar için kapora.** "8 kişi ve üzeri için kart bilgisi" cümlesi genel "kapora var" iddiasına dönüşürse SDR yanlış konuşur. Beklenen: bulgu `group_or_event` kapsamı taşır, Oda 1 `hasPrepayment`'ı `null` bırakır. → Task 7.
4. **Dış sınır yakalamanın ortasında dolar.** Beklenen: tarayıcı bağlamı kapanır, slot bırakılır, yeniden deneme ikinci bir taramayla üst üste binmez. → Task 6 (iptal), Task 10 (sinyal), Task 12 (slot).
5. **PDF ya da sayfa metninde NUL baytı.** Postgres `text` alanı `\u0000` kabul etmez; tek bir bozuk PDF bütün kaydı düşürür. Beklenen: metin yazılmadan önce temizlenir. → Task 2 ve Task 5.

## Dosya haritası

Yeni dosyalar (`src/lib/site-capture/`):

| Dosya | Sorumluluk |
|---|---|
| `types.ts` | Paylaşılan tipler: `PageType`, `Candidate`, `ReducedPage`, `CapturedPage`, `LedgerEntry`, `SiteCaptureResult`, `PageOpener`, `SiteCoverage`. |
| `url.ts` | `urlKey` (tekilleştirme anahtarı). |
| `classify.ts` | `classifyUrl`, `isKnownVendorUrl`. |
| `reduce.ts` | `reducePage`: HTML → metin, linkler, gömülü adresler, JSON-LD. |
| `discover.ts` | `parseRobots`, `isDisallowed`, `parseSitemap`, `sitemapCandidates`, `knownPathCandidates`, `Frontier`. |
| `ledger.ts` | `CoverageLedger`, `summarizeLedger`, `missingFromLedger`. |
| `documents.ts` | `fetchPdfText`, `extractPdfText`. |
| `capture.ts` | `captureSite`: bütçeli yakalama döngüsü (açıcı dışarıdan verilir). |
| `bridge.ts` | `visitedFromCapture`, `bridgeSiteFacts`, `coverageOf`, `siteFactsFromCapture`. |
| `requests.ts` | `recordThirdPartyRequests`: bir Playwright sayfasının üçüncü taraf isteklerini toplar. |
| `opener.ts` | `createPlaywrightOpener`, `fetchTextSafe`. |
| `deep.ts` | `crawlWebsiteDeep`. |
| `store.ts` | `saveSiteCapture`. |
| `slots.ts` | `tryAcquireCaptureSlot`, `deferDelayMs`, `MAX_DEFER_WAIT_MS`, `deepCaptureEnabled`. |

Değişen dosyalar: `src/lib/site-facts.ts`, `src/lib/crawler.ts`, `src/lib/ai-core/agent/room-one-audit.ts`, `src/lib/agent-workers/{types,registry,errors,execute,website-auditor}.ts`, yeni `src/lib/agent-workers/deadline.ts`, `src/workers/agent-run-worker.ts`, `src/app/api/agent-runs/[id]/route.ts`, `src/app/api/leads/[id]/workers/route.ts`, `src/components/app/ai-workers-panel.tsx`, `src/lib/control/evidence-shelf.ts`, `prisma/schema.prisma`, `package.json` (`unpdf`), `scripts/website-audit-eval/{run-eval,score}.ts`, yeni `scripts/website-audit-eval/{capture-url,pick-holdout,human-sheet}.ts`.

Testler: `src/__tests__/lib/site-capture/*.test.ts`, `src/__tests__/agent-workers/{execute-defer,watchdog-verdict,website-auditor-deep}.test.ts`, `src/__tests__/workers/agent-run-defer.test.ts`, mevcut `src/__tests__/control/evidence-shelf.test.ts`, `src/__tests__/agent-workers/website-auditor.test.ts` ve `src/__tests__/workers/agent-run-hubspot-writeback.test.ts` içinde değişiklikler.

Görev sırası ve bağımlılık: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14. Task 1–7 saf parçalardır ve yalnızca birbirine dayanır; Task 10–11 yakalamadan bağımsızdır; Task 12, Task 8–10'u birleştirir; Task 14 hepsini ister.

---

### Task 0: Dal

- [ ] **Step 1: Dalı aç**

```bash
git checkout -b prod/i-site-yakalama
git status --short
```

Expected: ilgisiz dört dosya (`M src/app/admin/(marketing)/layout.tsx`, `M src/lib/safe-redirect.ts`, iki `??` test dosyası, `?? video/.env.example`) ve bu planla spec. Onlara dokunma.

- [ ] **Step 2: Spec ve planı commit et**

```bash
git add docs/superpowers/specs/2026-10-03-site-yakalama-design.md docs/superpowers/plans/2026-10-04-site-yakalama.md
git commit -m "docs: site capture spec (review folded in) and implementation plan"
```

---

### Task 1: Tipler, adres anahtarı, sınıflandırma

**Files:**
- Create: `src/lib/site-capture/types.ts`
- Create: `src/lib/site-capture/url.ts`
- Create: `src/lib/site-capture/classify.ts`
- Modify: `src/lib/site-facts.ts:85-149` (yalnızca `export` ekleme)
- Test: `src/__tests__/lib/site-capture/classify.test.ts`

**Interfaces:**
- Consumes: `site-facts.ts`'teki `RES_TEXT`, `RES_PATH`, `MENU_TEXT`, `MENU_PATH`, `ORDER_TEXT`, `ORDER_PATH`, `bare`; `siteKey` (`@/lib/site-signals`); `menuVendorFor` (`@/lib/restaurant-vendors`); `isDirectOrderingHost` (`@/lib/delivery-platforms`); `detectBookingProviderEvidence` (`@/lib/audit/booking-detection`).
- Produces:
  - `types.ts`: aşağıdaki tiplerin tamamı.
  - `urlKey(raw: string): string | null`
  - `classifyUrl(url: URL, linkText: string | null, home: URL): PageType | null` (`null` = aday değil)
  - `isKnownVendorUrl(url: URL): boolean`
  - `site-facts.ts`'ten yeni dışa aktarımlar: `RES_TEXT`, `RES_PATH`, `MENU_TEXT`, `MENU_PATH`, `ORDER_TEXT`, `ORDER_PATH`, `PREPAY`, `TASTING`, `Link`, `linksOf`, `menuPdf`.

- [ ] **Step 1: `site-facts.ts`'te sabitleri dışa aç**

`src/lib/site-facts.ts` içinde şu bildirimlerin başına yalnızca `export` ekle (gövdeler değişmez): `RES_TEXT`, `RES_PATH`, `MENU_TEXT`, `MENU_PATH`, `ORDER_TEXT`, `ORDER_PATH`, `PREPAY`, `TASTING`, `interface Link`, `function linksOf`, `function menuPdf`. Örnek:

```ts
export const RES_TEXT = /\b(reserv\w*|book(ing|ings)?|book a table|rezervasyon)\b/i;
```

```ts
export interface Link {
  text: string;
  url: URL;
}

export function linksOf(html: string, pageUrl: string): Link[] {
```

```ts
/** A PDF whose link text or file name says it is a menu (not allergens or policies). */
export function menuPdf(l: Link): boolean {
```

Run: `npx vitest run src/__tests__/lib/site-facts.test.ts src/__tests__/lib/site-facts-real-sites.test.ts`
Expected: PASS (davranış değişmedi).

- [ ] **Step 2: Tipleri yaz**

```ts
// src/lib/site-capture/types.ts
/**
 * Shared shapes of the site capture: what a page is, what was kept of it,
 * and what happened to every address that was discovered.
 * Spec: docs/superpowers/specs/2026-10-03-site-yakalama-design.md
 */

export type PageType =
  | "home"
  | "menu"
  | "reservation"
  | "order"
  | "faq"
  | "events"
  | "locations"
  | "contact"
  | "about"
  | "other"
  | "external";

export type CandidateSource = "home_link" | "page_link" | "sitemap" | "known_path";

export interface Candidate {
  url: string;
  type: PageType;
  source: CandidateSource;
  /** 1 = linked from the homepage (or sitemap / known path); 2 = linked from a depth-1 page. */
  depth: number;
  linkText: string | null;
  /** One of today's three subpages (pickSubpages): opened first, exempt from type caps and robots. */
  pinned?: boolean;
}

/** What is kept of a page. Raw HTML is never stored. */
export interface ReducedPage {
  title: string | null;
  /** Visible text, at most 60,000 characters, no NUL bytes. */
  text: string;
  links: Array<{ text: string; href: string }>;
  /** Absolute iframe / script / embed addresses. */
  embeds: string[];
  jsonLd: unknown[];
}

export type PageSource = "browser" | "http" | "pdf";

export interface CapturedPage extends ReducedPage {
  /** The address that was asked for. */
  url: string;
  /** Where the navigation ended. */
  finalUrl: string;
  type: PageType;
  httpStatus: number | null;
  /** origin + path of third-party script / xhr / fetch / sub-frame requests. */
  thirdPartyRequests: string[];
  source: PageSource;
  /** A PDF without a text layer. */
  needsOcr: boolean;
  /** In memory only (pinned, locations, contact, about pages); never persisted. */
  html: string | null;
}

export type LedgerOutcome = "opened" | "skipped" | "failed";

export type LedgerReason =
  | "limit_type"
  | "limit_total"
  | "budget"
  | "aborted"
  | "duplicate"
  | "robots_disallow"
  | "timeout"
  | "http_error"
  | "blocked"
  | "offsite"
  | "too_large"
  | "not_pdf"
  | "nav_error"
  | "unsafe_url";

export interface LedgerEntry {
  url: string;
  finalUrl: string | null;
  type: PageType;
  source: CandidateSource | "pdf_link";
  outcome: LedgerOutcome;
  /** `null` only when `outcome` is "opened". */
  reason: LedgerReason | null;
  httpStatus: number | null;
}

export type CaptureStatus = "complete" | "partial" | "blocked" | "failed";

export interface SiteCaptureResult {
  rootUrl: string;
  status: CaptureStatus;
  /** ISO timestamp. */
  startedAt: string;
  durationMs: number;
  pages: CapturedPage[];
  ledger: LedgerEntry[];
  /** How many addresses the sitemap listed (only the first 150 by priority become candidates). */
  sitemapUrlCount: number;
}

export interface OpenedPage {
  finalUrl: string;
  status: number | null;
  /** `null` when the page could not be read. */
  html: string | null;
  thirdPartyRequests: string[];
  source: PageSource;
  error: LedgerReason | null;
}

export interface PageOpener {
  open(url: string, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<OpenedPage>;
  close(): Promise<void>;
}

/** Compact ledger summary carried on SiteFacts (the full ledger lives on SiteCapture). */
export interface SiteCoverage {
  status: CaptureStatus;
  opened: number;
  skipped: number;
  failed: number;
  durationMs: number;
  /** Up to 15 addresses that were not read, failures first. */
  notOpened: Array<{ url: string; type: PageType; reason: LedgerReason }>;
}
```

- [ ] **Step 3: Adres anahtarını yaz**

```ts
// src/lib/site-capture/url.ts
import { bare } from "@/lib/site-facts";

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

/**
 * One key per page: scheme, `www.`, fragment, trailing slash and tracking
 * parameters do not make a different page. `null` for anything that is not
 * an http(s) address.
 */
export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "/";
  const query = u.searchParams.toString();
  return `${bare(u.hostname)}${path || "/"}${query ? `?${query}` : ""}`;
}
```

- [ ] **Step 4: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/classify.test.ts
import { describe, expect, it } from "vitest";
import { classifyUrl, isKnownVendorUrl } from "@/lib/site-capture/classify";
import { urlKey } from "@/lib/site-capture/url";

const HOME = new URL("https://www.example-bistro.co.uk/");
const c = (href: string, text: string | null = null) => classifyUrl(new URL(href, HOME), text, HOME);

describe("classifyUrl: page types", () => {
  it.each([
    ["/menu", null, "menu"],
    ["/our-menu/", null, "menu"],
    ["/x", "Menü", "menu"],
    ["/book-a-table", null, "reservation"],
    ["/x", "Reservations", "reservation"],
    ["/order-online", null, "order"],
    ["/faq", null, "faq"],
    ["/x", "Frequently asked questions", "faq"],
    ["/private-dining", null, "events"],
    ["/group-bookings", "Group bookings", "events"],
    ["/x", "Private hire", "events"],
    ["/locations", null, "locations"],
    ["/store-locator", null, "locations"],
    ["/x", "Şubelerimiz", "locations"],
    ["/contact-us", null, "contact"],
    ["/x", "İletişim", "contact"],
    ["/about", null, "about"],
    ["/our-suppliers", "Suppliers", "other"],
  ] as const)("%s (%s) -> %s", (href, text, type) => {
    expect(c(href, text)).toBe(type);
  });

  it("recognises the homepage with or without www and trailing slash", () => {
    expect(c("/")).toBe("home");
    expect(c("https://example-bistro.co.uk")).toBe("home");
  });

  it("types a booking or ordering subdomain of the venue's own domain", () => {
    expect(c("https://booking.example-bistro.co.uk/")).toBe("reservation");
    expect(c("https://order.example-bistro.co.uk/")).toBe("order");
  });
});

describe("classifyUrl: never a candidate", () => {
  it.each([
    "/privacy-policy",
    "/terms-and-conditions",
    "/cart",
    "/my-account",
    "/wp-admin/",
    "/blog/best-brunch-in-town",
    "/careers",
    "/gift-cards",
    "/images/hero.jpg",
    "/menu.pdf",
    "https://www.instagram.com/examplebistro",
    "https://deliveroo.co.uk/menu/london/example-bistro",
    "https://www.opentable.com/legal/privacy-policy",
  ])("%s", (href) => {
    expect(c(href)).toBeNull();
  });

  it("hard noise stays out even when the link text looks like a guest page", () => {
    expect(c("/terms", "Booking terms")).toBeNull();
    expect(c("/login", "Menu")).toBeNull();
  });
});

describe("classifyUrl: one hop off the site", () => {
  it("a known booking provider page is external", () => {
    expect(c("https://www.sevenrooms.com/reservations/examplebistro", "Book")).toBe("external");
    expect(isKnownVendorUrl(new URL("https://web.dojo.app/create_booking/vendor/abc"))).toBe(true);
  });
  it("a white-label ordering vendor page is external", () => {
    expect(c("https://examplebistro.orderswift.com/", "Click & collect")).toBe("external");
  });
});

describe("urlKey", () => {
  it("ignores scheme, www, fragment, trailing slash and tracking parameters", () => {
    const a = urlKey("http://www.example-bistro.co.uk/menu/?utm_source=ig#lunch");
    const b = urlKey("https://example-bistro.co.uk/menu");
    expect(a).toBe(b);
  });
  it("keeps meaningful query strings apart", () => {
    expect(urlKey("https://x.test/menu?id=1")).not.toBe(urlKey("https://x.test/menu?id=2"));
  });
  it("returns null for non-http addresses", () => {
    expect(urlKey("mailto:hi@x.test")).toBeNull();
    expect(urlKey("not a url")).toBeNull();
  });
});
```

- [ ] **Step 5: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/classify.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/classify'`.

- [ ] **Step 6: Sınıflandırmayı yaz**

```ts
// src/lib/site-capture/classify.ts
/**
 * Assigns an address to a page type, or to nothing at all. Noise pages
 * (privacy, cart, login, blog posts, careers) and files never become
 * candidates; a page off the venue's site is a candidate only when it is
 * a known booking / ordering / menu vendor (one hop).
 */
import { detectBookingProviderEvidence } from "@/lib/audit/booking-detection";
import { isDirectOrderingHost } from "@/lib/delivery-platforms";
import { menuVendorFor } from "@/lib/restaurant-vendors";
import { bare, MENU_PATH, MENU_TEXT, ORDER_PATH, ORDER_TEXT, RES_PATH, RES_TEXT } from "@/lib/site-facts";
import { siteKey } from "@/lib/site-signals";
import type { PageType } from "./types";

/** Whole-word match that also works for words starting or ending with a non-ASCII letter. */
function word(alts: string): RegExp {
  return new RegExp(`(^|[^\\p{L}])(${alts})($|[^\\p{L}])`, "iu");
}

const FILE =
  /\.(pdf|png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|json|xml|txt|zip|mp4|mp3|mov|woff2?|ttf|eot|ics|vcf|docx?|xlsx?)$/i;

/** Never opened, whatever the link text says. */
const HARD_NOISE =
  /(^|\/)(privacy|terms|cookies?|legal|gdpr|accessibility|cart|basket|checkout|login|log-in|signin|sign-in|register|account|my-account|wp-admin|wp-login|wp-json|feed|search|unsubscribe|modern-slavery)(\/|$|\.|-)/i;

/** Not a guest surface; only checked after the positive types. */
const SOFT_NOISE =
  /(^|\/)(blog|news|journal|stories|press|media|careers?|jobs|vacancies|recruitment|gift-?cards?|gift-?vouchers?|vouchers?|shop|store|merch|products?|newsletter|subscribe|tags?|category|author|allergens?)(\/|$|\.|-)/i;

const EVENTS_PATH =
  /(^|\/)(private-[\w-]+|group-[\w-]+|events?|parties|celebrations?|functions?|weddings?|christmas[\w-]*|feasts?|ozel-[\w-]+|grup-[\w-]+)(\/|$|\.)/i;
const EVENTS_TEXT = word(
  "private (dining|hire|events?|parties)|group (bookings?|dining|feasts?|reservations?)|large (parties|groups)|events?|parties|celebrations?|weddings?|özel (etkinlik|davet)\\p{L}*|grup\\p{L}*",
);
const FAQ_PATH = /(^|\/)(faqs?|frequently-asked[\w-]*|help|sss|sikca-sorulan[\w-]*)(\/|$|\.)/i;
const FAQ_TEXT = word("faqs?|frequently asked( questions)?|sıkça sorulan\\p{L}*( sorular)?|sss");
const LOC_PATH =
  /(^|\/)(locations?|restaurants|our-restaurants|find-us|find-a-restaurant|store-locator|branches|venues|subeler|subelerimiz|restoranlar)(\/|$|\.)/i;
const LOC_TEXT = word("locations?|our restaurants|find us|find a restaurant|branches|venues|şubeler\\p{L}*|restoranlarımız");
const CONTACT_PATH = /(^|\/)(contact|contact-us|get-in-touch|iletisim|bize-ulasin)(\/|$|\.)/i;
const CONTACT_TEXT = word("contact( us)?|get in touch|[iİ]letişim|bize ulaşın");
const ABOUT_PATH = /(^|\/)(about|about-us|our-story|story|hakkimizda|hikayemiz)(\/|$|\.)/i;
const ABOUT_TEXT = word("about( us)?|our story|hakkımızda|hikayemiz");

const BOOKING_SUBDOMAIN = /^(book|booking|bookings|reservations?|reserve)$/i;
const ORDER_SUBDOMAIN = /^(order|orders|ordering|delivery|takeaway)$/i;

function pathOf(url: URL): string {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}

/** A booking, white-label ordering or digital-menu vendor (delivery marketplaces are not opened). */
export function isKnownVendorUrl(url: URL): boolean {
  return (
    menuVendorFor(url.hostname) !== null ||
    isDirectOrderingHost(url.hostname) ||
    detectBookingProviderEvidence({ html: "", links: [{ href: url.href }] }) !== null
  );
}

export function classifyUrl(url: URL, linkText: string | null, home: URL): PageType | null {
  if (!/^https?:$/.test(url.protocol)) return null;
  const path = pathOf(url);
  const text = (linkText ?? "").replace(/\s+/g, " ").trim();
  if (FILE.test(path)) return null;
  if (HARD_NOISE.test(path)) return null;

  if (siteKey(url.hostname) !== siteKey(home.hostname)) return isKnownVendorUrl(url) ? "external" : null;

  const sameHost = bare(url.hostname) === bare(home.hostname);
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : "/") || "/";
  if (sameHost && trim(url.pathname) === trim(home.pathname) && !url.search) return "home";
  if (!sameHost) {
    const label = bare(url.hostname).split(".")[0];
    if (BOOKING_SUBDOMAIN.test(label)) return "reservation";
    if (ORDER_SUBDOMAIN.test(label)) return "order";
  }

  if (EVENTS_PATH.test(path) || EVENTS_TEXT.test(text)) return "events";
  if (RES_PATH.test(path) || RES_TEXT.test(text)) return "reservation";
  if (MENU_PATH.test(path) || MENU_TEXT.test(text)) return "menu";
  if (ORDER_PATH.test(path) || ORDER_TEXT.test(text)) return "order";
  if (FAQ_PATH.test(path) || FAQ_TEXT.test(text)) return "faq";
  if (LOC_PATH.test(path) || LOC_TEXT.test(text)) return "locations";
  if (CONTACT_PATH.test(path) || CONTACT_TEXT.test(text)) return "contact";
  if (SOFT_NOISE.test(path)) return null;
  if (ABOUT_PATH.test(path) || ABOUT_TEXT.test(text)) return "about";
  return "other";
}
```

- [ ] **Step 7: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/classify.test.ts`
Expected: PASS. Bir satır düşerse (örneğin bir sağlayıcı host'u `booking-detection.ts` kurallarında yoksa) regex'i değil test verisini o dosyadaki gerçek host'la değiştir; `booking-detection.ts`'e bu görevde dokunma.

- [ ] **Step 8: Commit**

```bash
git add src/lib/site-capture/types.ts src/lib/site-capture/url.ts src/lib/site-capture/classify.ts src/lib/site-facts.ts src/__tests__/lib/site-capture/classify.test.ts
git commit -m "feat(site-capture): page types, url key and address classification"
```

---

### Task 2: İndirgeme

**Files:**
- Create: `src/lib/site-capture/reduce.ts`
- Test: `src/__tests__/lib/site-capture/reduce.test.ts`

**Interfaces:**
- Consumes: `linksOf` (`@/lib/site-facts`), `visibleText` (`@/lib/site-signals`), `ReducedPage` (`./types`).
- Produces: `reducePage(html: string, pageUrl: string): ReducedPage`, `cleanText(text: string): string`, `MAX_TEXT_CHARS = 60_000`.

- [ ] **Step 1: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/reduce.test.ts
import { describe, expect, it } from "vitest";
import { cleanText, MAX_TEXT_CHARS, reducePage } from "@/lib/site-capture/reduce";

const URL_ = "https://bistro.test/reservations";

describe("reducePage", () => {
  it("keeps the title, visible text, links, embeds and JSON-LD", () => {
    const html = `<html><head><title> Book  a table </title>
      <script type="application/ld+json">{"@type":"Restaurant","name":"Bistro"}</script>
      <script src="https://widget.vendor.test/loader.js"></script></head>
      <body><p>Card details are required for groups.</p>
      <script>var hidden = "deposit";</script>
      <a href="/menu">Our menu</a><a href="mailto:a@b.c">mail</a>
      <iframe src="//book.vendor.test/embed?id=1"></iframe></body></html>`;
    const r = reducePage(html, URL_);
    expect(r.title).toBe("Book a table");
    expect(r.text).toContain("Card details are required for groups.");
    expect(r.text).not.toContain("hidden");
    expect(r.links).toEqual([{ text: "Our menu", href: "https://bistro.test/menu" }]);
    expect(r.embeds).toEqual(["https://widget.vendor.test/loader.js", "https://book.vendor.test/embed?id=1"]);
    expect(r.jsonLd).toEqual([{ "@type": "Restaurant", name: "Bistro" }]);
  });

  it("caps the text at 60,000 characters", () => {
    const html = `<body><p>${"word ".repeat(20_000)}</p></body>`;
    expect(reducePage(html, URL_).text.length).toBe(MAX_TEXT_CHARS);
  });

  it("drops duplicate links and malformed JSON-LD", () => {
    const html = `<body><a href="/menu">Menu</a><a href="/menu">Menu</a>
      <script type="application/ld+json">{not json}</script></body>`;
    const r = reducePage(html, URL_);
    expect(r.links).toHaveLength(1);
    expect(r.jsonLd).toEqual([]);
  });

  // Review Focus 5: Postgres text columns reject NUL bytes.
  it("strips NUL bytes from text", () => {
    expect(cleanText("tasting\u0000 menu")).toBe("tasting menu");
    expect(reducePage("<body><p>a\u0000b</p></body>", URL_).text).toBe("ab");
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/reduce.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/reduce'`.

- [ ] **Step 3: İndirgemeyi yaz**

```ts
// src/lib/site-capture/reduce.ts
/**
 * Reduces a page to what the readers need: visible text, links, embedded
 * script / iframe addresses and JSON-LD. Raw HTML is not kept.
 */
import * as cheerio from "cheerio";
import { linksOf } from "@/lib/site-facts";
import { visibleText } from "@/lib/site-signals";
import type { ReducedPage } from "./types";

export const MAX_TEXT_CHARS = 60_000;
const MAX_LINKS = 400;
const MAX_EMBEDS = 150;
const MAX_JSONLD_BLOCKS = 20;
const MAX_JSONLD_CHARS = 20_000;

/** Postgres text columns reject NUL bytes (PDF text and some CMS output carry them). */
export function cleanText(text: string): string {
  return text.replace(/\u0000/g, "");
}

export function reducePage(html: string, pageUrl: string): ReducedPage {
  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text()).replace(/\s+/g, " ").trim() || null;
  const text = cleanText(visibleText(html)).slice(0, MAX_TEXT_CHARS);

  const links: ReducedPage["links"] = [];
  const seenLinks = new Set<string>();
  for (const l of linksOf(html, pageUrl)) {
    const href = l.url.href;
    const key = `${href}\n${l.text}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    links.push({ text: cleanText(l.text).slice(0, 200), href });
    if (links.length >= MAX_LINKS) break;
  }

  const embeds: string[] = [];
  $("script[src], iframe[src], iframe[data-src], embed[src]").each((_, el) => {
    if (embeds.length >= MAX_EMBEDS) return;
    const raw = ($(el).attr("src") ?? $(el).attr("data-src") ?? "").trim();
    if (!raw) return;
    try {
      const u = new URL(raw, pageUrl);
      if (/^https?:$/.test(u.protocol) && !embeds.includes(u.href)) embeds.push(u.href);
    } catch {
      // malformed src: nothing to record
    }
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLd.length >= MAX_JSONLD_BLOCKS) return;
    const raw = $(el).text();
    if (!raw || raw.length > MAX_JSONLD_CHARS) return;
    try {
      jsonLd.push(JSON.parse(cleanText(raw)));
    } catch {
      // malformed JSON-LD: skip
    }
  });

  return { title, text, links, embeds, jsonLd };
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/reduce.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-capture/reduce.ts src/__tests__/lib/site-capture/reduce.test.ts
git commit -m "feat(site-capture): reduce a page to text, links, embeds and JSON-LD"
```

---

### Task 3: Keşif (robots, site haritası, bilinen yollar, sıra)

**Files:**
- Create: `src/lib/site-capture/discover.ts`
- Test: `src/__tests__/lib/site-capture/discover.test.ts`

**Interfaces:**
- Consumes: `classifyUrl` (`./classify`), `urlKey` (`./url`), `siteKey` (`@/lib/site-signals`), `Candidate`, `PageType` (`./types`).
- Produces:
  - `interface RobotsRules { sitemaps: string[]; disallow: string[]; allow: string[] }`, `EMPTY_ROBOTS`
  - `parseRobots(txt: string): RobotsRules`
  - `isDisallowed(pathAndQuery: string, rules: RobotsRules): boolean`
  - `parseSitemap(xml: string): { urls: string[]; sitemaps: string[] }`
  - `sitemapCandidates(urls: string[], home: URL, max?: number): Candidate[]`
  - `knownPathCandidates(home: URL, hasType: (t: PageType) => boolean): Candidate[]`
  - `TYPE_PRIORITY`, `TYPE_CAPS`, `MAX_SITEMAP_CANDIDATES = 150`
  - `class Frontier { constructor(maxPages: number); markSeen(url): void; add(c: Candidate[]): Candidate[]; hasType(t): boolean; next(): Candidate | null; refund(c): void; rest(): Array<{ candidate: Candidate; reason: "limit_total" | "limit_type" | "budget" }> }`

- [ ] **Step 1: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/discover.test.ts
import { describe, expect, it } from "vitest";
import {
  Frontier,
  isDisallowed,
  knownPathCandidates,
  MAX_SITEMAP_CANDIDATES,
  parseRobots,
  parseSitemap,
  sitemapCandidates,
} from "@/lib/site-capture/discover";
import type { Candidate, PageType } from "@/lib/site-capture/types";

const HOME = new URL("https://bistro.test/");
const cand = (path: string, type: PageType, extra: Partial<Candidate> = {}): Candidate => ({
  url: `https://bistro.test${path}`,
  type,
  source: "home_link",
  depth: 1,
  linkText: null,
  ...extra,
});

describe("parseRobots / isDisallowed", () => {
  const rules = parseRobots(
    [
      "User-agent: Googlebot",
      "Disallow: /google-only",
      "",
      "User-agent: *",
      "Disallow: /private/",
      "Disallow: /*.json$",
      "Allow: /private/menu",
      "# a comment",
      "Sitemap: https://bistro.test/sitemap.xml",
    ].join("\n"),
  );

  it("reads only the * group and every Sitemap line", () => {
    expect(rules.disallow).toEqual(["/private/", "/*.json$"]);
    expect(rules.allow).toEqual(["/private/menu"]);
    expect(rules.sitemaps).toEqual(["https://bistro.test/sitemap.xml"]);
  });

  it("applies prefix rules, wildcards and end anchors; the longest match wins", () => {
    expect(isDisallowed("/private/staff", rules)).toBe(true);
    expect(isDisallowed("/private/menu", rules)).toBe(false);
    expect(isDisallowed("/data/feed.json", rules)).toBe(true);
    expect(isDisallowed("/data/feed.json?x=1", rules)).toBe(false);
    expect(isDisallowed("/google-only", rules)).toBe(false);
    expect(isDisallowed("/menu", rules)).toBe(false);
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(isDisallowed("/menu", parseRobots("User-agent: *\nDisallow:"))).toBe(false);
  });
});

describe("parseSitemap", () => {
  it("reads <loc> entries from a url set, including CDATA and &amp;", () => {
    const xml = `<urlset><url><loc>https://bistro.test/menu</loc></url>
      <url><loc><![CDATA[https://bistro.test/faq?a=1&b=2]]></loc></url>
      <url><loc> https://bistro.test/x?a=1&amp;b=2 </loc></url></urlset>`;
    expect(parseSitemap(xml)).toEqual({
      urls: ["https://bistro.test/menu", "https://bistro.test/faq?a=1&b=2", "https://bistro.test/x?a=1&b=2"],
      sitemaps: [],
    });
  });
  it("returns nested sitemaps from an index", () => {
    const xml = `<sitemapindex><sitemap><loc>https://bistro.test/pages.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({ urls: [], sitemaps: ["https://bistro.test/pages.xml"] });
  });
});

describe("sitemapCandidates", () => {
  it("keeps typed same-site pages, drops noise and foreign hosts", () => {
    const out = sitemapCandidates(
      ["https://bistro.test/faq", "https://bistro.test/blog/post", "https://other.test/menu", "https://bistro.test/"],
      HOME,
    );
    expect(out.map((c) => [c.url, c.type, c.source])).toEqual([["https://bistro.test/faq", "faq", "sitemap"]]);
  });

  // Review Focus 2: a chain's sitemap lists thousands of addresses.
  it("admits at most 150 candidates, highest-priority types first", () => {
    const urls = [
      ...Array.from({ length: 3000 }, (_, i) => `https://bistro.test/dish-${i}`),
      "https://bistro.test/reservations",
    ];
    const out = sitemapCandidates(urls, HOME);
    expect(out).toHaveLength(MAX_SITEMAP_CANDIDATES);
    expect(out[0].type).toBe("reservation");
  });
});

describe("knownPathCandidates", () => {
  it("probes only the types nothing was found for", () => {
    const out = knownPathCandidates(HOME, (t) => t === "menu" || t === "reservation");
    expect(out.every((c) => c.source === "known_path")).toBe(true);
    expect(out.map((c) => c.type)).not.toContain("menu");
    expect(out.map((c) => c.type)).not.toContain("reservation");
    expect(out.map((c) => new URL(c.url).pathname)).toEqual(
      expect.arrayContaining(["/faq", "/private-dining", "/locations", "/contact"]),
    );
  });
});

describe("Frontier", () => {
  it("hands out pinned pages first, then by type priority, depth and source", () => {
    const f = new Frontier(39);
    f.add([
      cand("/about", "about"),
      cand("/menu", "menu", { pinned: true }),
      cand("/faq", "faq"),
      cand("/book", "reservation", { depth: 2, source: "page_link" }),
      cand("/reserve", "reservation"),
    ]);
    const order = [f.next(), f.next(), f.next(), f.next(), f.next()].map((c) => new URL(c!.url).pathname);
    expect(order).toEqual(["/menu", "/reserve", "/book", "/faq", "/about"]);
    expect(f.next()).toBeNull();
  });

  it("drops an address it has already seen, whatever its scheme or trailing slash", () => {
    const f = new Frontier(39);
    f.markSeen("https://bistro.test/");
    const added = f.add([cand("/", "other"), cand("/faq", "faq"), cand("/faq/", "faq")]);
    expect(added.map((c) => c.url)).toEqual(["https://bistro.test/faq"]);
  });

  it("enforces the per-type cap and reports why the rest was left", () => {
    const f = new Frontier(39);
    f.add(Array.from({ length: 10 }, (_, i) => cand(`/menu-${i}`, "menu")));
    const taken: Candidate[] = [];
    for (let c = f.next(); c; c = f.next()) taken.push(c);
    expect(taken).toHaveLength(6);
    const rest = f.rest();
    expect(rest).toHaveLength(4);
    expect(rest.every((r) => r.reason === "limit_type")).toBe(true);
  });

  it("stops at the total cap and gives a slot back on refund", () => {
    const f = new Frontier(2);
    f.add([cand("/a", "faq"), cand("/b", "faq"), cand("/c", "faq")]);
    const first = f.next()!;
    f.next();
    expect(f.next()).toBeNull();
    f.refund(first);
    expect(new URL(f.next()!.url).pathname).toBe("/c");
    expect(f.rest()).toEqual([]);
  });

  it("labels leftovers as limit_total once the total cap is reached", () => {
    const f = new Frontier(1);
    f.add([cand("/a", "faq"), cand("/b", "contact")]);
    f.next();
    expect(f.rest().map((r) => r.reason)).toEqual(["limit_total"]);
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/discover.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/discover'`.

- [ ] **Step 3: Keşfi yaz**

```ts
// src/lib/site-capture/discover.ts
/**
 * Where candidate pages come from (robots.txt + sitemap, known paths) and
 * the order they are opened in. Pure: fetching happens in capture.ts.
 */
import { siteKey } from "@/lib/site-signals";
import { classifyUrl } from "./classify";
import type { Candidate, CandidateSource, PageType } from "./types";
import { urlKey } from "./url";

export interface RobotsRules {
  sitemaps: string[];
  disallow: string[];
  allow: string[];
}
export const EMPTY_ROBOTS: RobotsRules = { sitemaps: [], disallow: [], allow: [] };

/** Rules of the `User-agent: *` group, plus every `Sitemap:` line. */
export function parseRobots(txt: string): RobotsRules {
  const rules: RobotsRules = { sitemaps: [], disallow: [], allow: [] };
  let applies = false;
  let inAgentBlock = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") {
      if (value) rules.sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      // Consecutive User-agent lines share one group.
      applies = inAgentBlock ? applies || value === "*" : value === "*";
      inAgentBlock = true;
      continue;
    }
    inAgentBlock = false;
    if (!applies || !value) continue;
    if (key === "disallow") rules.disallow.push(value);
    else if (key === "allow") rules.allow.push(value);
  }
  return rules;
}

function ruleRegex(rule: string): RegExp {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; a tie goes to Allow. */
export function isDisallowed(pathAndQuery: string, rules: RobotsRules): boolean {
  const longest = (list: string[]) =>
    list.reduce((best, r) => (r.length > best && ruleRegex(r).test(pathAndQuery) ? r.length : best), -1);
  const d = longest(rules.disallow);
  return d >= 0 && d > longest(rules.allow);
}

export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  return /<sitemapindex[\s>]/i.test(xml) ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}

/** Opening order. `external` sits right after reservation: a booking vendor page states the deposit policy. */
export const TYPE_PRIORITY: PageType[] = [
  "reservation",
  "external",
  "menu",
  "order",
  "events",
  "faq",
  "locations",
  "contact",
  "about",
  "other",
];

export const TYPE_CAPS: Record<string, number> = {
  reservation: 4,
  external: 5,
  menu: 6,
  order: 3,
  events: 3,
  faq: 3,
  locations: 6,
  contact: 2,
  about: 2,
  other: 3,
};

export const MAX_SITEMAP_CANDIDATES = 150;

export function sitemapCandidates(urls: string[], home: URL, max = MAX_SITEMAP_CANDIDATES): Candidate[] {
  const out: Candidate[] = [];
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (siteKey(u.hostname) !== siteKey(home.hostname)) continue;
    const type = classifyUrl(u, null, home);
    if (!type || type === "home" || type === "external") continue;
    out.push({ url: u.href, type, source: "sitemap", depth: 1, linkText: null });
  }
  out.sort((a, b) => TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type));
  return out.slice(0, max);
}

const KNOWN_PATHS: Array<[PageType, string[]]> = [
  ["reservation", ["/reservations", "/book"]],
  ["menu", ["/menu", "/menus"]],
  ["faq", ["/faq", "/faqs"]],
  ["events", ["/private-dining", "/group-bookings"]],
  ["locations", ["/locations"]],
  ["contact", ["/contact"]],
];

/** Probe the usual paths, but only for types no link or sitemap entry was found for. */
export function knownPathCandidates(home: URL, hasType: (t: PageType) => boolean): Candidate[] {
  const out: Candidate[] = [];
  for (const [type, paths] of KNOWN_PATHS) {
    if (hasType(type)) continue;
    for (const p of paths) out.push({ url: new URL(p, home).href, type, source: "known_path", depth: 1, linkText: null });
  }
  return out;
}

const SOURCE_RANK: Record<CandidateSource, number> = { home_link: 0, page_link: 1, sitemap: 2, known_path: 3 };

function rank(c: Candidate): number {
  const type = TYPE_PRIORITY.indexOf(c.type);
  return (c.pinned ? 0 : 1) * 1_000_000 + (type === -1 ? 99 : type) * 10_000 + c.depth * 100 + SOURCE_RANK[c.source];
}

/** The queue of addresses still to open, with the per-type and total caps. */
export class Frontier {
  private readonly queue: Candidate[] = [];
  private readonly seen = new Set<string>();
  private readonly taken = new Map<PageType, number>();
  private total = 0;

  /** `maxPages` excludes the homepage (the caller already has it). */
  constructor(private readonly maxPages: number) {}

  markSeen(url: string): void {
    const k = urlKey(url);
    if (k) this.seen.add(k);
  }

  /** Queues the candidates not seen before and returns them. */
  add(candidates: Candidate[]): Candidate[] {
    const added: Candidate[] = [];
    for (const c of candidates) {
      const k = urlKey(c.url);
      if (!k || this.seen.has(k)) continue;
      this.seen.add(k);
      this.queue.push(c);
      added.push(c);
    }
    return added;
  }

  hasType(type: PageType): boolean {
    return (this.taken.get(type) ?? 0) > 0 || this.queue.some((c) => c.type === type);
  }

  private capReached(c: Candidate): boolean {
    return !c.pinned && (this.taken.get(c.type) ?? 0) >= (TYPE_CAPS[c.type] ?? 0);
  }

  next(): Candidate | null {
    if (this.total >= this.maxPages) return null;
    let best = -1;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.capReached(this.queue[i])) continue;
      if (best === -1 || rank(this.queue[i]) < rank(this.queue[best])) best = i;
    }
    if (best === -1) return null;
    const [c] = this.queue.splice(best, 1);
    this.taken.set(c.type, (this.taken.get(c.type) ?? 0) + 1);
    this.total++;
    return c;
  }

  /** A page that was not read (failed, duplicate, disallowed) does not use up a slot. */
  refund(c: Candidate): void {
    this.taken.set(c.type, Math.max(0, (this.taken.get(c.type) ?? 0) - 1));
    this.total = Math.max(0, this.total - 1);
  }

  /** Empties the queue; every leftover gets the reason it was not opened. */
  rest(): Array<{ candidate: Candidate; reason: "limit_total" | "limit_type" | "budget" }> {
    const out = this.queue.map((candidate) => ({
      candidate,
      reason:
        this.total >= this.maxPages
          ? ("limit_total" as const)
          : this.capReached(candidate)
            ? ("limit_type" as const)
            : ("budget" as const),
    }));
    this.queue.length = 0;
    return out;
  }
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/discover.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-capture/discover.ts src/__tests__/lib/site-capture/discover.test.ts
git commit -m "feat(site-capture): robots, sitemap, known paths and the candidate frontier"
```

---

### Task 4: Kapsam defteri

**Files:**
- Create: `src/lib/site-capture/ledger.ts`
- Test: `src/__tests__/lib/site-capture/ledger.test.ts`

**Interfaces:**
- Consumes: `urlKey` (`./url`), `LedgerEntry`, `LedgerReason` (`./types`).
- Produces:
  - `class CoverageLedger { record(entry: LedgerEntry): void; has(url: string): boolean; entries(): LedgerEntry[] }` (aynı adres için ilk kayıt geçerlidir)
  - `summarizeLedger(entries: LedgerEntry[]): { opened: number; skipped: number; failed: number; byReason: Partial<Record<LedgerReason, number>> }`
  - `missingFromLedger(discovered: string[], entries: LedgerEntry[]): string[]`

- [ ] **Step 1: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/ledger.test.ts
import { describe, expect, it } from "vitest";
import { CoverageLedger, missingFromLedger, summarizeLedger } from "@/lib/site-capture/ledger";
import type { LedgerEntry } from "@/lib/site-capture/types";

const entry = (url: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  url,
  finalUrl: url,
  type: "menu",
  source: "home_link",
  outcome: "opened",
  reason: null,
  httpStatus: 200,
  ...extra,
});

describe("CoverageLedger", () => {
  it("keeps exactly one result per address; the first one stands", () => {
    const l = new CoverageLedger();
    l.record(entry("https://bistro.test/menu"));
    l.record(entry("http://www.bistro.test/menu/", { outcome: "failed", reason: "timeout" }));
    expect(l.entries()).toHaveLength(1);
    expect(l.entries()[0].outcome).toBe("opened");
    expect(l.has("https://bistro.test/menu#lunch")).toBe(true);
  });
});

describe("summarizeLedger", () => {
  it("counts outcomes and reasons", () => {
    const s = summarizeLedger([
      entry("https://bistro.test/menu"),
      entry("https://bistro.test/faq", { outcome: "failed", reason: "timeout", httpStatus: null }),
      entry("https://bistro.test/a", { outcome: "skipped", reason: "limit_type" }),
      entry("https://bistro.test/b", { outcome: "skipped", reason: "limit_type" }),
    ]);
    expect(s).toEqual({ opened: 1, skipped: 2, failed: 1, byReason: { timeout: 1, limit_type: 2 } });
  });
});

describe("missingFromLedger", () => {
  it("lists discovered addresses that have no result", () => {
    const entries = [entry("https://bistro.test/menu")];
    expect(missingFromLedger(["https://bistro.test/menu/", "https://bistro.test/faq"], entries)).toEqual([
      "https://bistro.test/faq",
    ]);
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/ledger.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/ledger'`.

- [ ] **Step 3: Defteri yaz**

```ts
// src/lib/site-capture/ledger.ts
/**
 * Coverage ledger: every discovered address ends with exactly one result
 * (opened, skipped with a reason, failed with a reason). This is what lets
 * the audit say "looked and not there" instead of a bare "no".
 */
import type { LedgerEntry, LedgerReason } from "./types";
import { urlKey } from "./url";

export class CoverageLedger {
  private readonly byKey = new Map<string, LedgerEntry>();

  /** The first result recorded for an address stands. */
  record(entry: LedgerEntry): void {
    const key = urlKey(entry.url) ?? entry.url;
    if (!this.byKey.has(key)) this.byKey.set(key, entry);
  }

  has(url: string): boolean {
    return this.byKey.has(urlKey(url) ?? url);
  }

  entries(): LedgerEntry[] {
    return [...this.byKey.values()];
  }
}

export function summarizeLedger(entries: LedgerEntry[]): {
  opened: number;
  skipped: number;
  failed: number;
  byReason: Partial<Record<LedgerReason, number>>;
} {
  const out = { opened: 0, skipped: 0, failed: 0, byReason: {} as Partial<Record<LedgerReason, number>> };
  for (const e of entries) {
    out[e.outcome]++;
    if (e.reason) out.byReason[e.reason] = (out.byReason[e.reason] ?? 0) + 1;
  }
  return out;
}

/** Discovered addresses without a ledger result (must be empty at the end of a capture). */
export function missingFromLedger(discovered: string[], entries: LedgerEntry[]): string[] {
  const keys = new Set(entries.map((e) => urlKey(e.url) ?? e.url));
  return discovered.filter((u) => !keys.has(urlKey(u) ?? u));
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-capture/ledger.ts src/__tests__/lib/site-capture/ledger.test.ts
git commit -m "feat(site-capture): coverage ledger with one result per address"
```

---

### Task 5: Belgeler (menü PDF'i)

**Files:**
- Modify: `package.json` (`unpdf` bağımlılığı)
- Create: `src/lib/site-capture/documents.ts`
- Test: `src/__tests__/lib/site-capture/documents.test.ts`

**Interfaces:**
- Consumes: `safeFetchFollow`, `UrlGuardError`, `SafeFetchResult` (`@/lib/safe-fetch`); `cleanText`, `MAX_TEXT_CHARS` (`./reduce`); `LedgerReason` (`./types`).
- Produces:
  - `MAX_PDF_BYTES = 15 * 1024 * 1024`
  - `type PdfTextResult = { ok: true; text: string; pageCount: number; needsOcr: boolean } | { ok: false; reason: LedgerReason; httpStatus: number | null }`
  - `interface PdfDeps { fetch(url: string, timeoutMs: number): Promise<SafeFetchResult>; extract(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> }`
  - `extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }>`
  - `fetchPdfText(url: string, opts?: { timeoutMs?: number; maxBytes?: number; userAgent?: string; deps?: Partial<PdfDeps> }): Promise<PdfTextResult>`

- [ ] **Step 1: Bağımlılığı ekle**

```bash
npm install unpdf
```

Expected: `package.json` `dependencies` içinde `unpdf` görünür. (`unpdf`, pdf.js'in sunucu derlemesini taşır; ek yerel bağımlılık istemez.)

- [ ] **Step 2: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/documents.test.ts
import { describe, expect, it } from "vitest";
import { extractPdfText, fetchPdfText, type PdfDeps } from "@/lib/site-capture/documents";
import { UrlGuardError } from "@/lib/safe-fetch";

const PDF_HEAD = new TextEncoder().encode("%PDF-1.7\n");
const URL_ = "https://bistro.test/files/menu.pdf";

function deps(body: Uint8Array | string, init: { status?: number; headers?: Record<string, string> } = {}, text = "Tasting menu 85"): PdfDeps {
  return {
    fetch: async () => ({
      response: new Response(body, { status: init.status ?? 200, headers: init.headers }),
      finalUrl: URL_,
      redirectCount: 0,
    }),
    extract: async () => ({ text, pageCount: 1 }),
  };
}

describe("fetchPdfText", () => {
  it("returns the text of a PDF", async () => {
    const r = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, {}, "Tasting menu 85 per person, seven courses, wine pairing 60") });
    expect(r).toEqual({
      ok: true,
      text: "Tasting menu 85 per person, seven courses, wine pairing 60",
      pageCount: 1,
      needsOcr: false,
    });
  });

  it("flags a PDF without a text layer", async () => {
    const r = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, {}, "  \n ") });
    expect(r).toMatchObject({ ok: true, needsOcr: true });
  });

  // Review Focus 5: NUL bytes from PDF text must not reach Postgres.
  it("strips NUL bytes from the extracted text", async () => {
    const r = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, {}, "Tasting\u0000 menu with enough words to count as a text layer") });
    expect(r.ok && r.text).toBe("Tasting menu with enough words to count as a text layer");
  });

  it("refuses a file over the size limit, by header or by stream", async () => {
    const byHeader = await fetchPdfText(URL_, { deps: deps(PDF_HEAD, { headers: { "content-length": "99999999" } }) });
    expect(byHeader).toEqual({ ok: false, reason: "too_large", httpStatus: 200 });
    const big = new Uint8Array(2_000);
    big.set(PDF_HEAD);
    const byStream = await fetchPdfText(URL_, { maxBytes: 1_000, deps: deps(big) });
    expect(byStream).toEqual({ ok: false, reason: "too_large", httpStatus: 200 });
  });

  it("refuses a body that is not a PDF", async () => {
    const r = await fetchPdfText(URL_, { deps: deps("<html>not found</html>") });
    expect(r).toEqual({ ok: false, reason: "not_pdf", httpStatus: 200 });
  });

  it("reports blocked and http errors", async () => {
    expect(await fetchPdfText(URL_, { deps: deps("", { status: 403 }) })).toEqual({ ok: false, reason: "blocked", httpStatus: 403 });
    expect(await fetchPdfText(URL_, { deps: deps("", { status: 404 }) })).toEqual({ ok: false, reason: "http_error", httpStatus: 404 });
  });

  it("reports an address the SSRF guard rejects", async () => {
    const r = await fetchPdfText(URL_, {
      deps: {
        fetch: async () => {
          throw new UrlGuardError("Private addresses are not allowed");
        },
      },
    });
    expect(r).toEqual({ ok: false, reason: "unsafe_url", httpStatus: null });
  });
});

describe("extractPdfText (real extractor)", () => {
  it("reads the text layer of a generated PDF", async () => {
    const mod = (await import("jspdf")) as unknown as Record<string, unknown>;
    const JsPdf = (mod.jsPDF ?? (mod.default as Record<string, unknown> | undefined)?.jsPDF ?? mod.default) as new () => {
      text(t: string, x: number, y: number): void;
      output(kind: "arraybuffer"): ArrayBuffer;
    };
    const doc = new JsPdf();
    doc.text("Tasting menu 85", 10, 10);
    const out = await extractPdfText(new Uint8Array(doc.output("arraybuffer")));
    expect(out.pageCount).toBe(1);
    expect(out.text).toContain("Tasting menu 85");
  });
});
```

- [ ] **Step 3: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/documents.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/documents'`.

- [ ] **Step 4: Belgeleri yaz**

```ts
// src/lib/site-capture/documents.ts
/**
 * Menu PDFs: downloaded through the SSRF-safe fetch, size-capped, and
 * reduced to their text layer. A PDF without one is flagged `needsOcr`
 * (OCR is out of scope).
 */
import { safeFetchFollow, UrlGuardError, type SafeFetchResult } from "@/lib/safe-fetch";
import { cleanText, MAX_TEXT_CHARS } from "./reduce";
import type { LedgerReason } from "./types";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
/** Fewer characters per page than this means there is no usable text layer. */
const MIN_CHARS_PER_PAGE = 40;

export type PdfTextResult =
  | { ok: true; text: string; pageCount: number; needsOcr: boolean }
  | { ok: false; reason: LedgerReason; httpStatus: number | null };

export interface PdfDeps {
  fetch(url: string, timeoutMs: number): Promise<SafeFetchResult>;
  extract(bytes: Uint8Array): Promise<{ text: string; pageCount: number }>;
}

export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text, pageCount: totalPages };
}

/** `null` = over the limit. */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) {
    const all = new Uint8Array(await response.arrayBuffer());
    return all.byteLength > maxBytes ? null : all;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

export async function fetchPdfText(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; userAgent?: string; deps?: Partial<PdfDeps> } = {},
): Promise<PdfTextResult> {
  const headers: Record<string, string> = { accept: "application/pdf,*/*" };
  if (opts.userAgent) headers["user-agent"] = opts.userAgent;
  const deps: PdfDeps = {
    fetch: (u, timeoutMs) => safeFetchFollow(u, { perHopTimeoutMs: timeoutMs, init: { headers } }),
    extract: extractPdfText,
    ...opts.deps,
  };

  let fetched: SafeFetchResult;
  try {
    fetched = await deps.fetch(url, opts.timeoutMs ?? 15_000);
  } catch (err) {
    if (err instanceof UrlGuardError) return { ok: false, reason: "unsafe_url", httpStatus: null };
    const name = err instanceof Error ? err.name : "";
    return { ok: false, reason: name === "AbortError" || name === "TimeoutError" ? "timeout" : "nav_error", httpStatus: null };
  }

  const status = fetched.response.status;
  if (status >= 400) {
    const blocked = status === 401 || status === 403 || status === 429;
    return { ok: false, reason: blocked ? "blocked" : "http_error", httpStatus: status };
  }

  let bytes: Uint8Array | null;
  try {
    bytes = await readCapped(fetched.response, opts.maxBytes ?? MAX_PDF_BYTES);
  } catch {
    return { ok: false, reason: "nav_error", httpStatus: status };
  }
  if (bytes === null) return { ok: false, reason: "too_large", httpStatus: status };
  if (!looksLikePdf(bytes)) return { ok: false, reason: "not_pdf", httpStatus: status };

  try {
    const { text, pageCount } = await deps.extract(bytes);
    const clean = cleanText(text).replace(/[ \t]+/g, " ").trim();
    const needsOcr = clean.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE * Math.max(1, pageCount);
    return { ok: true, text: clean.slice(0, MAX_TEXT_CHARS), pageCount, needsOcr };
  } catch {
    return { ok: false, reason: "not_pdf", httpStatus: status };
  }
}
```

- [ ] **Step 5: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/documents.test.ts`
Expected: PASS. `extractPdfText (real extractor)` testi `jspdf`'in Node derlemesini kullanır; `unpdf` sürümü `extractText` imzasını değiştirdiyse (`node_modules/unpdf/README.md`'ye bak) yalnızca `extractPdfText` gövdesini uyarlayıp aynı dönüş şeklini koru.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/site-capture/documents.ts src/__tests__/lib/site-capture/documents.test.ts
git commit -m "feat(site-capture): SSRF-safe menu PDF download and text extraction"
```

---

### Task 6: Yakalama döngüsü

**Files:**
- Create: `src/lib/site-capture/capture.ts`
- Test: `src/__tests__/lib/site-capture/capture.test.ts`

**Interfaces:**
- Consumes: `menuPdf` (`@/lib/site-facts`), `siteKey`, `classifyUrl`, `isKnownVendorUrl`, `Frontier`, `parseRobots`, `isDisallowed`, `parseSitemap`, `sitemapCandidates`, `knownPathCandidates`, `EMPTY_ROBOTS`, `CoverageLedger`, `reducePage`, `MAX_TEXT_CHARS`, `urlKey`, `PdfTextResult` (yalnızca tip), `PageOpener`.
- Produces:
  - `interface CaptureLimits { maxPages; budgetMs; pageTimeoutMs; concurrency; maxPdfs; maxDepth; maxSitemapFiles; maxAttempts }` (hepsi `number`) ve `DEFAULT_LIMITS`
  - `interface CaptureInput { homeUrl: string; homeHtml: string; homeRequests?: string[]; pinned: Array<{ kind: "menu" | "reservation" | "order"; url: string }>; opener: PageOpener; fetchText(url: string): Promise<string | null>; fetchPdf(url: string, timeoutMs: number): Promise<PdfTextResult>; signal?: AbortSignal; now?: () => number; limits?: Partial<CaptureLimits> }`
  - `captureSite(input: CaptureInput): Promise<SiteCaptureResult>`

Davranış özeti: ana sayfa dışarıdan gelir (yeniden açılmaz). Sıra: sabitlenmiş üç sayfa → ana sayfa linkleri → robots + site haritası → bilinen yollar. Okunamayan, yinelenen ya da robots'un yasakladığı sayfa slot harcamaz. Derinlik 2'deki sayfanın linkleri izlenmez. Dış sağlayıcı sayfasının linkleri izlenmez.

- [ ] **Step 1: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/capture.test.ts
import { describe, expect, it } from "vitest";
import { captureSite, type CaptureInput } from "@/lib/site-capture/capture";
import { missingFromLedger } from "@/lib/site-capture/ledger";
import type { LedgerReason, PageOpener } from "@/lib/site-capture/types";
import { urlKey } from "@/lib/site-capture/url";

const HOME = "https://bistro.test/";
const html = (body: string) => `<html><head><title>Bistro</title></head><body>${body}</body></html>`;
const LONG = "Welcome to Bistro, a neighbourhood restaurant serving seasonal plates. ".repeat(5);

type Fake = string | { html?: string; status?: number; finalUrl?: string; error?: LedgerReason; requests?: string[] };

function fakeOpener(pages: Record<string, Fake>, opts: { fallback?: (url: string) => Fake | null; onOpen?: (url: string) => void } = {}) {
  const opened: string[] = [];
  const opener: PageOpener = {
    async open(url) {
      opened.push(url);
      opts.onOpen?.(url);
      const hit = pages[url] ?? pages[new URL(url).pathname] ?? opts.fallback?.(url) ?? null;
      if (hit === null) {
        return { finalUrl: url, status: 404, html: null, thirdPartyRequests: [], source: "browser", error: "http_error" };
      }
      const f = typeof hit === "string" ? { html: hit } : hit;
      return {
        finalUrl: f.finalUrl ?? url,
        status: f.status ?? 200,
        html: f.error ? null : (f.html ?? html("")),
        thirdPartyRequests: f.requests ?? [],
        source: "browser",
        error: f.error ?? null,
      };
    },
    async close() {},
  };
  return { opener, opened };
}

async function run(
  homeBody: string,
  pages: Record<string, Fake>,
  extra: Partial<CaptureInput> = {},
  fake: Parameters<typeof fakeOpener>[1] = {},
) {
  const f = fakeOpener(pages, fake);
  const result = await captureSite({
    homeUrl: HOME,
    homeHtml: html(homeBody),
    pinned: [],
    opener: f.opener,
    fetchText: async () => null,
    fetchPdf: async () => ({ ok: false, reason: "not_pdf", httpStatus: 200 }),
    ...extra,
    // One page at a time keeps the order of `pages` deterministic.
    limits: { concurrency: 1, ...extra.limits },
  });
  return { result, opened: f.opened };
}

const paths = (urls: string[]) => urls.map((u) => new URL(u).pathname);
const entryFor = (ledger: Array<{ url: string }>, path: string) => ledger.find((e) => new URL(e.url).pathname === path);

describe("captureSite", () => {
  it("opens the typed pages linked from the homepage, highest priority first", async () => {
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/reservations">Book a table</a><a href="/faq">FAQ</a><a href="/privacy-policy">Privacy</a>`,
      { "/menu": html("Starters and mains"), "/reservations": html("Book online"), "/faq": html("Questions") },
    );
    expect(result.pages.map((p) => p.type)).toEqual(["home", "reservation", "menu", "faq"]);
    expect(paths(opened)).not.toContain("/privacy-policy");
    expect(result.status).toBe("complete");
  });

  it("ends with exactly one ledger result for every address it discovered", async () => {
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/contact">Contact</a>`,
      { "/menu": html("Menu"), "/faq": { error: "timeout" } },
    );
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
    const keys = result.ledger.map((e) => urlKey(e.url));
    expect(new Set(keys).size).toBe(keys.length);
    expect(entryFor(result.ledger, "/faq")).toMatchObject({ outcome: "failed", reason: "timeout" });
    expect(entryFor(result.ledger, "/contact")).toMatchObject({ outcome: "failed", reason: "http_error", httpStatus: 404 });
    for (const e of result.ledger) expect(e.outcome === "opened" ? e.reason === null : e.reason !== null).toBe(true);
  });

  it("obeys robots.txt for discovered pages but still opens the pinned pages", async () => {
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ") },
      {
        pinned: [{ kind: "menu", url: `${HOME}menu` }],
        fetchText: async (url) => (url.endsWith("/robots.txt") ? "User-agent: *\nDisallow: /menu\nDisallow: /faq" : null),
      },
    );
    expect(paths(opened)).toContain("/menu");
    expect(paths(opened)).not.toContain("/faq");
    expect(entryFor(result.ledger, "/faq")).toMatchObject({ outcome: "skipped", reason: "robots_disallow" });
  });

  it("stops at the time budget and says so for every page it did not reach", async () => {
    let t = 0;
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/contact">Contact</a><a href="/about">About</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ"), "/contact": html("Contact"), "/about": html("About") },
      { now: () => t, limits: { budgetMs: 150_000 } },
      { onOpen: () => { t += 100_000; } },
    );
    expect(opened).toHaveLength(2);
    expect(result.status).toBe("partial");
    const left = result.ledger.filter((e) => e.outcome === "skipped");
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((e) => e.reason === "budget")).toBe(true);
  });

  // Review Focus 4: the outer deadline aborts the capture mid-run.
  it("stops when the signal is aborted and marks the rest as aborted", async () => {
    const controller = new AbortController();
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/contact">Contact</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ"), "/contact": html("Contact") },
      { signal: controller.signal },
      { onOpen: () => controller.abort() },
    );
    expect(opened).toHaveLength(1);
    expect(result.status).toBe("partial");
    expect(result.ledger.filter((e) => e.outcome === "skipped").every((e) => e.reason === "aborted")).toBe(true);
  });

  // Review Focus 1: a single-page app answers every path with the homepage.
  it("records a page identical to the homepage as a duplicate, not as a typed page", async () => {
    const { result } = await run(LONG, {}, {}, { fallback: () => html(LONG) });
    expect(result.pages.map((p) => p.type)).toEqual(["home"]);
    const probes = result.ledger.filter((e) => e.source === "known_path");
    expect(probes.length).toBeGreaterThan(0);
    expect(probes.every((e) => e.outcome === "skipped" && e.reason === "duplicate")).toBe(true);
  });

  it("keeps a known vendor page a link redirects to, and reports any other off-site landing", async () => {
    const { result } = await run(`<a href="/book">Book a table</a><a href="/order">Order online</a>`, {
      "/book": { finalUrl: "https://www.sevenrooms.com/reservations/bistro", html: html("A deposit is required") },
      "/order": { finalUrl: "https://somewhere-else.test/shop", html: html("Shop") },
    });
    const vendor = result.pages.find((p) => p.type === "external");
    expect(vendor).toMatchObject({ url: `${HOME}book`, finalUrl: "https://www.sevenrooms.com/reservations/bistro" });
    expect(entryFor(result.ledger, "/order")).toMatchObject({
      outcome: "failed",
      reason: "offsite",
      finalUrl: "https://somewhere-else.test/shop",
    });
  });

  it("opens at most six menu pages and lists the rest as over the type limit", async () => {
    const links = Array.from({ length: 10 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const pages = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`/menu-${i}`, html(`Menu number ${i}`)]));
    const { result } = await run(links, pages);
    expect(result.pages.filter((p) => p.type === "menu")).toHaveLength(6);
    const over = result.ledger.filter((e) => e.reason === "limit_type");
    expect(over).toHaveLength(4);
  });

  it("follows links one level below the homepage's links and no further", async () => {
    const { result, opened } = await run(`<a href="/locations">Locations</a>`, {
      "/locations": html(`<a href="/locations/soho">Soho</a>`),
      "/locations/soho": html(`<a href="/locations/soho/team">Team</a>`),
      "/locations/soho/team": html("Team"),
    });
    expect(paths(opened)).toContain("/locations/soho");
    expect(paths(opened)).not.toContain("/locations/soho/team");
    expect(entryFor(result.ledger, "/locations/soho/team")).toBeUndefined();
  });

  // Review Focus 2: thousands of sitemap addresses must not blow up the ledger.
  it("takes at most 150 sitemap candidates and opens only three untyped pages", async () => {
    const sitemap = `<urlset>${Array.from({ length: 3000 }, (_, i) => `<url><loc>${HOME}dish-${i}</loc></url>`).join("")}</urlset>`;
    const { result, opened } = await run(
      "",
      {},
      { fetchText: async (url) => (url.endsWith("/sitemap.xml") ? sitemap : null) },
      { fallback: (url) => (new URL(url).pathname.startsWith("/dish-") ? html(`Dish page ${url}`) : null) },
    );
    expect(result.sitemapUrlCount).toBe(3000);
    expect(result.pages.filter((p) => p.type === "other")).toHaveLength(3);
    expect(result.ledger.length).toBeLessThanOrEqual(170);
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
  });

  it("downloads menu PDFs linked from the homepage, five at most", async () => {
    const links = [
      ...Array.from({ length: 7 }, (_, i) => `<a href="/files/menu-${i}.pdf">Menu ${i}</a>`),
      `<a href="/files/allergens.pdf">Allergens</a>`,
    ].join("");
    const fetched: string[] = [];
    const { result } = await run(links, {}, {
      fetchPdf: async (url) => {
        fetched.push(url);
        return url.endsWith("menu-1.pdf")
          ? { ok: false, reason: "too_large", httpStatus: 200 }
          : { ok: true, text: "Tasting menu 85", pageCount: 1, needsOcr: false };
      },
    });
    expect(fetched).toHaveLength(5);
    expect(fetched.some((u) => u.includes("allergens"))).toBe(false);
    const pdfPages = result.pages.filter((p) => p.source === "pdf");
    expect(pdfPages).toHaveLength(4);
    expect(pdfPages[0]).toMatchObject({ type: "menu", text: "Tasting menu 85", html: null });
    expect(entryFor(result.ledger, "/files/menu-1.pdf")).toMatchObject({ outcome: "failed", reason: "too_large" });
    expect(result.ledger.filter((e) => e.source === "pdf_link" && e.reason === "limit_type")).toHaveLength(2);
  });

  it("keeps going when the opener throws on one page", async () => {
    const f = fakeOpener({ "/faq": html("FAQ") });
    const open = f.opener.open.bind(f.opener);
    f.opener.open = async (url, o) => {
      if (url.endsWith("/menu")) throw new Error("browser crashed");
      return open(url, o);
    };
    const result = await captureSite({
      homeUrl: HOME,
      homeHtml: html(`<a href="/menu">Menu</a><a href="/faq">FAQ</a>`),
      pinned: [],
      opener: f.opener,
      fetchText: async () => null,
      fetchPdf: async () => ({ ok: false, reason: "not_pdf", httpStatus: 200 }),
      limits: { concurrency: 1 },
    });
    expect(entryFor(result.ledger, "/menu")).toMatchObject({ outcome: "failed", reason: "nav_error" });
    expect(result.pages.map((p) => p.type)).toContain("faq");
  });

  it("keeps raw HTML only for the pinned pages and the pages location signals read", async () => {
    const { result } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/locations">Locations</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ"), "/locations": html("Soho, Camden") },
      { pinned: [{ kind: "menu", url: `${HOME}menu` }] },
    );
    const byType = Object.fromEntries(result.pages.map((p) => [p.type, p.html !== null]));
    expect(byType).toMatchObject({ home: true, menu: true, locations: true, faq: false });
  });
});
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/capture.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/capture'`.

- [ ] **Step 3: Yakalama döngüsünü yaz**

```ts
// src/lib/site-capture/capture.ts
/**
 * The capture loop: opens the relevant pages of one site inside a page and
 * time budget and writes down what happened to every address it found.
 * The page opener is injected (Playwright in production, a fake in tests).
 */
import { menuPdf } from "@/lib/site-facts";
import { siteKey } from "@/lib/site-signals";
import { classifyUrl, isKnownVendorUrl } from "./classify";
import {
  EMPTY_ROBOTS,
  Frontier,
  isDisallowed,
  knownPathCandidates,
  parseRobots,
  parseSitemap,
  sitemapCandidates,
  type RobotsRules,
} from "./discover";
import type { PdfTextResult } from "./documents";
import { CoverageLedger } from "./ledger";
import { MAX_TEXT_CHARS, reducePage } from "./reduce";
import type { Candidate, CapturedPage, LedgerEntry, PageOpener, PageType, SiteCaptureResult } from "./types";
import { urlKey } from "./url";

export interface CaptureLimits {
  /** Including the homepage. */
  maxPages: number;
  budgetMs: number;
  pageTimeoutMs: number;
  /** Pages open at once on the same site. */
  concurrency: number;
  maxPdfs: number;
  maxDepth: number;
  maxSitemapFiles: number;
  /** Navigations tried in total (failed pages do not use up a page slot). */
  maxAttempts: number;
}

export const DEFAULT_LIMITS: CaptureLimits = {
  maxPages: 40,
  budgetMs: 150_000,
  pageTimeoutMs: 15_000,
  concurrency: 3,
  maxPdfs: 5,
  maxDepth: 2,
  maxSitemapFiles: 3,
  maxAttempts: 80,
};

export interface CaptureInput {
  /** Where the homepage navigation ended. */
  homeUrl: string;
  homeHtml: string;
  /** Third-party requests the homepage made (recorded by the homepage audit). */
  homeRequests?: string[];
  /** Today's three subpages (pickSubpages targets). */
  pinned: Array<{ kind: "menu" | "reservation" | "order"; url: string }>;
  opener: PageOpener;
  /** SSRF-safe text fetch for robots.txt and sitemaps; `null` when unavailable. */
  fetchText(url: string): Promise<string | null>;
  fetchPdf(url: string, timeoutMs: number): Promise<PdfTextResult>;
  signal?: AbortSignal;
  now?: () => number;
  limits?: Partial<CaptureLimits>;
}

/** Location and hotel signals read raw HTML (JSON-LD, address markup). */
const KEEP_HTML_TYPES = new Set<PageType>(["locations", "contact", "about"]);
const MAX_KEPT_HTML = 8;
/** Below this length two pages can share their text without being the same page. */
const MIN_DUPLICATE_TEXT = 200;

function textKey(text: string): string {
  return `${text.length}:${text.slice(0, 500)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(onTimeout);
      },
    );
  });
}

export async function captureSite(input: CaptureInput): Promise<SiteCaptureResult> {
  const limits: CaptureLimits = { ...DEFAULT_LIMITS, ...input.limits };
  const now = input.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + limits.budgetMs;
  const home = new URL(input.homeUrl);

  const ledger = new CoverageLedger();
  const frontier = new Frontier(limits.maxPages - 1);
  const pages: CapturedPage[] = [];
  const seenFinal = new Set<string>();
  const seenText = new Set<string>();
  const pdfUrls: string[] = [];
  // An object, not `let`s: the values are assigned inside closures.
  const state = { stop: null as "budget" | "aborted" | null, keptHtml: 0, attempts: 0, inFlight: 0 };

  const stopped = (): boolean => {
    if (state.stop) return true;
    if (input.signal?.aborted) state.stop = "aborted";
    else if (now() >= deadline) state.stop = "budget";
    return state.stop !== null;
  };

  const record = (
    c: Pick<LedgerEntry, "url" | "type" | "source">,
    e: Pick<LedgerEntry, "outcome" | "reason"> & Partial<Pick<LedgerEntry, "finalUrl" | "httpStatus">>,
  ): void => {
    ledger.record({
      url: c.url,
      type: c.type,
      source: c.source,
      finalUrl: e.finalUrl ?? null,
      httpStatus: e.httpStatus ?? null,
      outcome: e.outcome,
      reason: e.reason,
    });
  };

  const admitLinks = (page: CapturedPage, depth: number): void => {
    const found: Candidate[] = [];
    for (const l of page.links) {
      let u: URL;
      try {
        u = new URL(l.href);
      } catch {
        continue;
      }
      if (/\.pdf$/i.test(u.pathname)) {
        const isMenu = (page.type === "home" || page.type === "menu") && menuPdf({ text: l.text, url: u });
        if (isMenu && !pdfUrls.includes(u.href)) pdfUrls.push(u.href);
        continue;
      }
      const type = classifyUrl(u, l.text, home);
      if (!type || type === "home") continue;
      u.hash = "";
      found.push({ url: u.href, type, source: depth === 1 ? "home_link" : "page_link", depth, linkText: l.text || null });
    }
    frontier.add(found);
  };

  // The homepage was already opened by the homepage audit.
  const homePage: CapturedPage = {
    ...reducePage(input.homeHtml, input.homeUrl),
    url: input.homeUrl,
    finalUrl: input.homeUrl,
    type: "home",
    httpStatus: 200,
    thirdPartyRequests: input.homeRequests ?? [],
    source: "browser",
    needsOcr: false,
    html: input.homeHtml,
  };
  pages.push(homePage);
  frontier.markSeen(input.homeUrl);
  seenFinal.add(urlKey(input.homeUrl) ?? input.homeUrl);
  seenText.add(textKey(homePage.text));
  record({ url: input.homeUrl, type: "home", source: "home_link" }, { outcome: "opened", reason: null, finalUrl: input.homeUrl, httpStatus: 200 });

  // Pinned pages go in first so they win the de-duplication against plain links.
  frontier.add(
    input.pinned.map((t) => ({ url: t.url, type: t.kind, source: "home_link" as const, depth: 1, linkText: null, pinned: true })),
  );
  admitLinks(homePage, 1);

  let robots: RobotsRules = EMPTY_ROBOTS;
  let sitemapUrlCount = 0;
  if (!stopped()) {
    const robotsTxt = await input.fetchText(new URL("/robots.txt", home).href).catch(() => null);
    if (robotsTxt) robots = parseRobots(robotsTxt);
    const files = robots.sitemaps.length > 0 ? [...robots.sitemaps] : [new URL("/sitemap.xml", home).href];
    const urls: string[] = [];
    for (let i = 0; i < files.length && i < limits.maxSitemapFiles && !stopped(); i++) {
      const xml = await input.fetchText(files[i]).catch(() => null);
      if (!xml) continue;
      const parsed = parseSitemap(xml);
      urls.push(...parsed.urls);
      files.push(...parsed.sitemaps);
    }
    sitemapUrlCount = urls.length;
    frontier.add(sitemapCandidates(urls, home));
    frontier.add(knownPathCandidates(home, (t) => frontier.hasType(t)));
  }

  const visit = async (c: Candidate): Promise<void> => {
    const requested = new URL(c.url);
    if (!c.pinned && c.type !== "external" && isDisallowed(requested.pathname + requested.search, robots)) {
      record(c, { outcome: "skipped", reason: "robots_disallow" });
      frontier.refund(c);
      return;
    }
    state.attempts++;
    const timeoutMs = Math.max(1_000, Math.min(limits.pageTimeoutMs, deadline - now()));
    const opened = await input.opener.open(c.url, { timeoutMs, signal: input.signal });
    if (opened.error || opened.html === null || (opened.status !== null && opened.status >= 400)) {
      const blocked = opened.status === 401 || opened.status === 403 || opened.status === 429;
      record(c, {
        outcome: "failed",
        reason: opened.error ?? (blocked ? "blocked" : "http_error"),
        finalUrl: opened.finalUrl,
        httpStatus: opened.status,
      });
      frontier.refund(c);
      return;
    }

    let landed: URL;
    try {
      landed = new URL(opened.finalUrl);
    } catch {
      record(c, { outcome: "failed", reason: "nav_error", httpStatus: opened.status });
      frontier.refund(c);
      return;
    }
    let type = c.type;
    if (c.type !== "external" && siteKey(landed.hostname) !== siteKey(home.hostname)) {
      // The link left the venue's site. A known vendor page is the one hop we keep.
      if (!isKnownVendorUrl(landed)) {
        record(c, { outcome: "failed", reason: "offsite", finalUrl: opened.finalUrl, httpStatus: opened.status });
        frontier.refund(c);
        return;
      }
      type = "external";
    }

    const reduced = reducePage(opened.html, opened.finalUrl);
    const finalKey = urlKey(opened.finalUrl) ?? opened.finalUrl;
    const sameText = reduced.text.length >= MIN_DUPLICATE_TEXT && seenText.has(textKey(reduced.text));
    if (!c.pinned && (seenFinal.has(finalKey) || sameText)) {
      record(c, { outcome: "skipped", reason: "duplicate", finalUrl: opened.finalUrl, httpStatus: opened.status });
      frontier.refund(c);
      return;
    }
    seenFinal.add(finalKey);
    seenText.add(textKey(reduced.text));

    const keep = (c.pinned === true || KEEP_HTML_TYPES.has(type)) && state.keptHtml < MAX_KEPT_HTML;
    if (keep) state.keptHtml++;
    const page: CapturedPage = {
      ...reduced,
      url: c.url,
      finalUrl: opened.finalUrl,
      type,
      httpStatus: opened.status,
      thirdPartyRequests: opened.thirdPartyRequests,
      source: opened.source,
      needsOcr: false,
      html: keep ? opened.html : null,
    };
    pages.push(page);
    record({ url: c.url, type, source: c.source }, { outcome: "opened", reason: null, finalUrl: opened.finalUrl, httpStatus: opened.status });
    if (type !== "external" && c.depth < limits.maxDepth) admitLinks(page, c.depth + 1);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (stopped() || state.attempts >= limits.maxAttempts) return;
      const c = frontier.next();
      if (!c) {
        // Another worker may still be reading a page whose links refill the queue.
        if (state.inFlight === 0) return;
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }
      state.inFlight++;
      try {
        await visit(c);
      } catch {
        record(c, { outcome: "failed", reason: "nav_error" });
        frontier.refund(c);
      } finally {
        state.inFlight--;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, limits.concurrency) }, () => worker()));

  for (let i = 0; i < pdfUrls.length; i++) {
    const pdf = { url: pdfUrls[i], type: "menu" as const, source: "pdf_link" as const };
    if (i >= limits.maxPdfs) {
      record(pdf, { outcome: "skipped", reason: "limit_type" });
      continue;
    }
    if (stopped()) {
      record(pdf, { outcome: "skipped", reason: state.stop ?? "budget" });
      continue;
    }
    const timeoutMs = Math.max(1_000, Math.min(20_000, deadline - now()));
    const timedOut: PdfTextResult = { ok: false, reason: "timeout", httpStatus: null };
    const r = await withTimeout(input.fetchPdf(pdf.url, timeoutMs), timeoutMs + 1_000, timedOut);
    if (!r.ok) {
      record(pdf, { outcome: "failed", reason: r.reason, httpStatus: r.httpStatus });
      continue;
    }
    pages.push({
      title: null,
      text: r.text.slice(0, MAX_TEXT_CHARS),
      links: [],
      embeds: [],
      jsonLd: [],
      url: pdf.url,
      finalUrl: pdf.url,
      type: "menu",
      httpStatus: 200,
      thirdPartyRequests: [],
      source: "pdf",
      needsOcr: r.needsOcr,
      html: null,
    });
    record(pdf, { outcome: "opened", reason: null, finalUrl: pdf.url, httpStatus: 200 });
  }

  stopped();
  const leftovers = frontier.rest();
  for (const { candidate, reason } of leftovers) record(candidate, { outcome: "skipped", reason: state.stop ?? reason });
  const cutShort = state.stop !== null || leftovers.some((l) => l.reason === "budget");

  return {
    rootUrl: input.homeUrl,
    status: cutShort ? "partial" : "complete",
    startedAt: new Date(startedAt).toISOString(),
    durationMs: now() - startedAt,
    pages,
    ledger: ledger.entries(),
    sitemapUrlCount,
  };
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/capture.test.ts`
Expected: PASS (13 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-capture/capture.ts src/__tests__/lib/site-capture/capture.test.ts
git commit -m "feat(site-capture): budgeted capture loop with a full coverage ledger"
```

---

### Task 7: Bulgu köprüsü, bulgu kapsamı, Oda 1 koruması

**Files:**
- Modify: `src/lib/site-facts.ts:49-83` (`SiteFact`, `SiteFacts` tiplerine isteğe bağlı alanlar)
- Create: `src/lib/site-capture/bridge.ts`
- Modify: `src/lib/ai-core/agent/room-one-audit.ts:97`
- Test: `src/__tests__/lib/site-capture/bridge.test.ts`

**Interfaces:**
- Consumes: `mergeSiteFacts`, `pickSubpages`, `PREPAY`, `TASTING`, `menuPdf`, `bare`, `SiteFacts`, `SiteFact`, `SubpagePick`, `VisitedPage` (`@/lib/site-facts`); `detectBookingProviderEvidence`; `deliveryPlatformFor`, `isDirectOrderingHost`; `menuVendorFor`; `detectLocations`, `detectHotelOperator`, `SignalPage`; `summarizeLedger`; `urlKey`; `SiteCaptureResult`, `CapturedPage`, `SiteCoverage`.
- Produces:
  - `SiteFact<T>` üzerinde `source?: "page" | "network" | "pdf"` ve `scope?: "general" | "group_or_event"`; `SiteFacts` üzerinde `coverage?: SiteCoverage`.
  - `visitedFromCapture(pick: SubpagePick, capture: SiteCaptureResult, homeUrl: string): VisitedPage[]`
  - `coverageOf(capture: SiteCaptureResult): SiteCoverage`
  - `bridgeSiteFacts(base: SiteFacts, capture: SiteCaptureResult): SiteFacts`
  - `siteFactsFromCapture(home: { url: string; html: string }, capture: SiteCaptureResult, pick: SubpagePick): SiteFacts`

- [ ] **Step 1: `SiteFact` ve `SiteFacts` tiplerini genişlet**

`src/lib/site-facts.ts` içinde `SiteFact` arayüzünü şununla değiştir:

```ts
export interface SiteFact<T> {
  value: T;
  url: string;
  quote: string | null;
  /** Where a bridged fact was read. Absent on facts read by mergeSiteFacts (always a page). */
  source?: "page" | "network" | "pdf";
  /**
   * "group_or_event": stated only for groups or private events (a group-booking,
   * events or FAQ page), not for an ordinary booking. Absent = general.
   */
  scope?: "general" | "group_or_event";
}
```

`SiteFacts` arayüzünün sonuna (`declaredLanguage` satırından sonra) ekle:

```ts
  /** What the deep capture opened and what it could not. Absent on shallow audits and older rows. */
  coverage?: import("./site-capture/types").SiteCoverage;
```

- [ ] **Step 2: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/bridge.test.ts
import { describe, expect, it } from "vitest";
import { buildRoomOneAudit } from "@/lib/ai-core/agent/room-one-audit";
import { bridgeSiteFacts, coverageOf, visitedFromCapture } from "@/lib/site-capture/bridge";
import type { CapturedPage, LedgerEntry, PageType, SiteCaptureResult } from "@/lib/site-capture/types";
import { mergeSiteFacts, pickSubpages, type SiteFacts } from "@/lib/site-facts";

const HOME = "https://bistro.test/";
const EMPTY_HOME = "<html><body></body></html>";

function baseFacts(): SiteFacts {
  return mergeSiteFacts({ url: HOME, html: EMPTY_HOME }, [], pickSubpages(EMPTY_HOME, HOME));
}

function pg(type: PageType, path: string, extra: Partial<CapturedPage> = {}): CapturedPage {
  const url = path.startsWith("http") ? path : `https://bistro.test${path}`;
  return {
    title: null,
    text: "",
    links: [],
    embeds: [],
    jsonLd: [],
    url,
    finalUrl: url,
    type,
    httpStatus: 200,
    thirdPartyRequests: [],
    source: "browser",
    needsOcr: false,
    html: null,
    ...extra,
  };
}

function cap(pages: CapturedPage[], ledger: LedgerEntry[] = []): SiteCaptureResult {
  return {
    rootUrl: HOME,
    status: "complete",
    startedAt: "2026-10-04T10:00:00.000Z",
    durationMs: 12_000,
    pages: [pg("home", "/"), ...pages],
    ledger,
    sitemapUrlCount: 0,
  };
}

const led = (path: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  url: `https://bistro.test${path}`,
  finalUrl: `https://bistro.test${path}`,
  type: "menu",
  source: "home_link",
  outcome: "opened",
  reason: null,
  httpStatus: 200,
  ...extra,
});

describe("bridgeSiteFacts: booking provider", () => {
  it("fills an unknown provider from a link on a captured page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("events", "/private-dining", { links: [{ text: "Enquire", href: "https://www.sevenrooms.com/reservations/bistro" }] })]),
    );
    expect(facts.bookingProvider).toMatchObject({ value: "SevenRooms", url: "https://bistro.test/private-dining", source: "page" });
  });

  it("fills it from a third-party request when no link names the provider", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/book", { thirdPartyRequests: ["https://www.sevenrooms.com/widget/embed.js"] })]),
    );
    expect(facts.bookingProvider).toMatchObject({ value: "SevenRooms", source: "network" });
    expect(facts.bookingProvider!.quote).toContain("request to");
  });

  it("never replaces an answer mergeSiteFacts already gave", () => {
    const base = { ...baseFacts(), bookingProvider: { value: "OpenTable", url: HOME, quote: "opentable.com/r/bistro" } };
    const facts = bridgeSiteFacts(
      base,
      cap([pg("reservation", "/book", { links: [{ text: "Book", href: "https://www.sevenrooms.com/reservations/bistro" }] })]),
    );
    expect(facts.bookingProvider).toEqual(base.bookingProvider);
  });

  it("does not turn 'not read' into 'read and absent'", () => {
    const base = baseFacts();
    const facts = bridgeSiteFacts(base, cap([pg("reservation", "/book"), pg("menu", "/menu"), pg("order", "/order")]));
    expect(facts.bookingChecked).toBe(base.bookingChecked);
    expect(facts.menuPageSeen).toBe(false);
    expect(facts.orderPageSeen).toBe(false);
  });
});

describe("bridgeSiteFacts: prepayment and its scope", () => {
  it("a deposit on the reservation page is a general fact", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/book", { text: "A deposit of £10 per person is required to confirm your booking." })]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "general", url: "https://bistro.test/book" });
  });

  // Review Focus 3: a groups-only deposit must not read as "this venue takes deposits".
  it("a deposit stated on a group page is scoped to groups", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("events", "/group-feasts", { text: "For groups of 8 or more, we ask for debit or credit card details to secure your table." })]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "group_or_event", url: "https://bistro.test/group-feasts" });
  });

  it("group wording next to the deposit scopes it even on a reservation page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/book", { text: "Walk in any time. For parties of 10 or more a deposit is taken at the time of booking." })]),
    );
    expect(facts.hasPrepayment?.scope).toBe("group_or_event");
  });

  it("prefers a general statement over a group one", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("events", "/private-hire", { text: "Private hire requires a deposit." }),
        pg("faq", "/faq", { text: "Every booking is secured with a deposit of £5 per guest." }),
      ]),
    );
    expect(facts.hasPrepayment).toMatchObject({ scope: "general", url: "https://bistro.test/faq" });
  });

  it("stays unknown when the page says there is no deposit", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("faq", "/faq", { text: "Do I need to pay a deposit? No, we don't take deposits for any booking." })]),
    );
    expect(facts.hasPrepayment).toBeNull();
  });

  it("reads a no-show fee on the booking vendor's page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("external", "https://bistro.test/book", {
          finalUrl: "https://web.dojo.app/create_booking/vendor/abc",
          text: "Card details are requested for groups over four. A no-show fee of £10 per person applies.",
        }),
      ]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "group_or_event" });
    expect(facts.bookingProvider).toMatchObject({ value: "Dojo" });
  });

  it("Room 1 claims prepayment only from a general fact", () => {
    const audit = (hasPrepayment: SiteFacts["hasPrepayment"]) =>
      buildRoomOneAudit({
        hasWebsite: true,
        websiteUrl: HOME,
        audit: { reachable: true, url: HOME, hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { siteFacts: { ...baseFacts(), hasPrepayment } } },
        mapFacts: null,
        venueType: null,
      })!;
    expect(audit({ value: true, url: HOME, quote: "deposit", scope: "group_or_event" }).hasPrepayment).toBeNull();
    expect(audit({ value: true, url: HOME, quote: "deposit", scope: "general" }).hasPrepayment).toBe(true);
    expect(audit({ value: true, url: HOME, quote: "deposit" }).hasPrepayment).toBe(true);
  });
});

describe("bridgeSiteFacts: menu, ordering, PDFs", () => {
  it("reads a tasting menu from a menu PDF and names the source", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("menu", "/files/menu.pdf", { source: "pdf", text: "Seven-course tasting menu 85 per person" })]),
    );
    expect(facts.tastingMenu).toMatchObject({ value: true, source: "pdf", url: "https://bistro.test/files/menu.pdf" });
    expect(facts.menuPdfUrl).toBe("https://bistro.test/files/menu.pdf");
  });

  it("ignores a PDF that has no text layer", () => {
    const facts = bridgeSiteFacts(baseFacts(), cap([pg("menu", "/files/menu.pdf", { source: "pdf", needsOcr: true, text: "" })]));
    expect(facts.tastingMenu).toBeNull();
  });

  it("names a digital-menu vendor and a white-label ordering vendor from deeper pages", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("menu", "/menu", { embeds: ["https://app.menutiger.com/embed/bistro"] }),
        pg("order", "/order", { links: [{ text: "Start order", href: "https://bistro.orderswift.com/" }] }),
      ]),
    );
    expect(facts.qrMenuTool).toMatchObject({ value: "MenuTiger", url: "https://bistro.test/menu" });
    expect(facts.directOrdering).toMatchObject({ value: true, url: "https://bistro.test/order" });
  });

  it("collects delivery marketplaces linked from the order page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("order", "/order", { links: [{ text: "Deliveroo", href: "https://deliveroo.co.uk/menu/london/bistro" }, { text: "Uber Eats", href: "https://www.ubereats.com/store/bistro" }] })]),
    );
    expect(facts.deliveryPlatforms?.value).toEqual(["Deliveroo", "Uber Eats"]);
  });
});

describe("coverageOf", () => {
  it("summarises the ledger and lists what was not read, failures first", () => {
    const capture = cap(
      [],
      [
        led("/"),
        led("/menu"),
        led("/a", { outcome: "skipped", reason: "limit_type" }),
        led("/b", { outcome: "skipped", reason: "budget" }),
        led("/faq", { outcome: "failed", reason: "timeout", httpStatus: null, type: "faq" }),
      ],
    );
    expect(coverageOf(capture)).toEqual({
      status: "complete",
      opened: 2,
      skipped: 2,
      failed: 1,
      durationMs: 12_000,
      notOpened: [
        { url: "https://bistro.test/faq", type: "faq", reason: "timeout" },
        { url: "https://bistro.test/b", type: "menu", reason: "budget" },
      ],
    });
  });

  it("is attached to the bridged facts", () => {
    expect(bridgeSiteFacts(baseFacts(), cap([], [led("/")])).coverage).toMatchObject({ opened: 1 });
  });
});

describe("visitedFromCapture", () => {
  const pick = {
    targets: [
      { kind: "reservation" as const, url: "https://bistro.test/book" },
      { kind: "menu" as const, url: "https://bistro.test/menu" },
      { kind: "order" as const, url: "https://bistro.test/order" },
    ],
    menuPdfUrl: null,
    hasBookingLink: true,
  };

  it("maps captured pinned pages back to what mergeSiteFacts expects", () => {
    const capture = cap(
      [
        pg("menu", "/menu", { html: "<body>Menu</body>" }),
        pg("external", "/book", { finalUrl: "https://www.sevenrooms.com/reservations/bistro", html: "<body>Vendor</body>" }),
      ],
      [led("/order", { outcome: "failed", reason: "timeout", finalUrl: "https://bistro.test/order", httpStatus: null })],
    );
    expect(visitedFromCapture(pick, capture, HOME)).toEqual([
      { kind: "reservation", url: "https://bistro.test/book", html: null, landedUrl: "https://www.sevenrooms.com/reservations/bistro" },
      { kind: "menu", url: "https://bistro.test/menu", html: "<body>Menu</body>" },
      { kind: "order", url: "https://bistro.test/order", html: null },
    ]);
  });

  it("carries an unknown off-site landing from the ledger", () => {
    const capture = cap([], [led("/order", { outcome: "failed", reason: "offsite", finalUrl: "https://shop.other.test/" })]);
    expect(visitedFromCapture(pick, capture, HOME)[2]).toEqual({
      kind: "order",
      url: "https://bistro.test/order",
      html: null,
      landedUrl: "https://shop.other.test/",
    });
  });
});
```

- [ ] **Step 3: Testin düştüğünü gör**

Run: `npx vitest run src/__tests__/lib/site-capture/bridge.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/bridge'`.

- [ ] **Step 4: Köprüyü yaz**

```ts
// src/lib/site-capture/bridge.ts
/**
 * From a capture to SiteFacts. mergeSiteFacts runs on the same three pages
 * it reads today; the bridge then fills only what is still `null` from the
 * other captured pages, third-party requests and menu PDFs. It never
 * replaces an answer and never turns "not read" into "read and absent".
 */
import { detectBookingProviderEvidence } from "@/lib/audit/booking-detection";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";
import { menuVendorFor } from "@/lib/restaurant-vendors";
import {
  bare,
  menuPdf,
  mergeSiteFacts,
  PREPAY,
  TASTING,
  type SiteFact,
  type SiteFacts,
  type SubpagePick,
  type VisitedPage,
} from "@/lib/site-facts";
import { detectHotelOperator, detectLocations, type SignalPage } from "@/lib/site-signals";
import { summarizeLedger } from "./ledger";
import type { CapturedPage, PageType, SiteCaptureResult, SiteCoverage } from "./types";
import { urlKey } from "./url";

/** A card guarantee is a prepayment commitment even when the word "deposit" is absent. */
const CARD_GUARANTEE =
  /((?<!\bno )(?<!\bwithout (a |any )?)(no[- ]show|late cancellation|cancellation) (fee|charge)s?\b|card details (are |will be )?(requested|required|needed|taken))/i;
/** The statement applies to groups or private events, not to an ordinary booking. */
const GROUP_NEAR =
  /(groups?|parties|party of|large (tables?|bookings?|parties)|private (dining|hire|events?)|exclusive hire|\b(?:[6-9]|[1-9]\d)\s*(\+|or more|guests|people|persons|kişi)|(more than|over) (four|five|six|seven|eight|nine|ten|\d+)|grup|kalabalık)/i;
/** "Do I need a deposit? No." / "we don't take deposits": not a positive statement. */
const NEGATED =
  /((deposit|pre-?payment|card details)[^.!?]{0,80}\?\s*(no\b|we (do not|don't|never))|(don't|do not|never|not) (take|require|ask for|need|charge)[^.!?]{0,40}(deposit|card|pre-?pay))/i;

const NOT_OPENED_MAX = 15;

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname;
  } catch {
    return null;
  }
}

function matchWindow(text: string, re: RegExp, radius: number): { quote: string; window: string } | null {
  const m = re.exec(text);
  if (!m) return null;
  const end = m.index + m[0].length;
  return {
    quote: text.slice(Math.max(0, m.index - 80), end + 80).trim(),
    window: text.slice(Math.max(0, m.index - radius), end + radius),
  };
}

/** Captured pages of the given types, in that type order (the homepage is mergeSiteFacts' job). */
function ofTypes(pages: CapturedPage[], types: PageType[]): CapturedPage[] {
  return types.flatMap((t) => pages.filter((p) => p.type === t));
}

function isBookingVendorPage(p: CapturedPage): boolean {
  return detectBookingProviderEvidence({ html: "", links: [{ href: p.finalUrl }] }) !== null;
}

/** Every address a page points at or talks to. */
function hrefsOf(p: CapturedPage, withRequests: boolean): string[] {
  return [
    ...p.links.map((l) => l.href),
    ...p.embeds,
    ...(withRequests ? p.thirdPartyRequests : []),
    ...(p.type === "external" ? [p.finalUrl] : []),
  ];
}

/** Rebuilds mergeSiteFacts' input for today's three subpages from the capture. */
export function visitedFromCapture(pick: SubpagePick, capture: SiteCaptureResult, homeUrl: string): VisitedPage[] {
  const homeHost = bare(new URL(homeUrl).hostname);
  return pick.targets.map((t) => {
    const key = urlKey(t.url);
    const page = capture.pages.find((p) => p.source !== "pdf" && urlKey(p.url) === key);
    const entry = capture.ledger.find((e) => urlKey(e.url) === key);
    const finalUrl = page?.finalUrl ?? entry?.finalUrl ?? null;
    const landedHost = finalUrl ? hostOf(finalUrl) : null;
    // A redirect to another host is not the venue's page; the landing host is still evidence.
    if (finalUrl && landedHost && bare(landedHost) !== homeHost) return { ...t, html: null, landedUrl: finalUrl };
    if (!page || page.html === null) return { ...t, html: null };
    return { ...t, html: page.html };
  });
}

export function coverageOf(capture: SiteCaptureResult): SiteCoverage {
  const s = summarizeLedger(capture.ledger);
  const unread = capture.ledger.filter((e) => e.outcome !== "opened" && e.reason !== "limit_type" && e.reason !== "duplicate");
  const failuresFirst = [...unread.filter((e) => e.outcome === "failed"), ...unread.filter((e) => e.outcome === "skipped")];
  return {
    status: capture.status,
    opened: s.opened,
    skipped: s.skipped,
    failed: s.failed,
    durationMs: capture.durationMs,
    notOpened: failuresFirst.slice(0, NOT_OPENED_MAX).map((e) => ({ url: e.url, type: e.type, reason: e.reason ?? "budget" })),
  };
}

function bridgeBooking(pages: CapturedPage[]): SiteFact<string> | null {
  const ordered = ofTypes(pages, ["reservation", "external", "events", "locations", "contact", "faq", "menu", "order"]);
  for (const p of ordered) {
    const ev = detectBookingProviderEvidence({
      html: p.embeds.join("\n"),
      links: hrefsOf(p, false).map((href) => ({ href })),
    });
    if (ev) return { value: ev.provider, url: p.url, quote: ev.evidence, source: "page" };
  }
  // A widget that loads late shows up only as a request to the provider's host.
  for (const p of [...pages.filter((x) => x.type === "home"), ...ordered]) {
    if (p.thirdPartyRequests.length === 0) continue;
    const ev = detectBookingProviderEvidence({ html: "", links: p.thirdPartyRequests.map((href) => ({ href })) });
    if (ev) return { value: ev.provider, url: p.url, quote: `request to ${ev.evidence}`, source: "network" };
  }
  return null;
}

function bridgePrepayment(pages: CapturedPage[]): SiteFact<true> | null {
  let scoped: SiteFact<true> | null = null;
  for (const p of ofTypes(pages, ["reservation", "external", "faq", "events"])) {
    if (p.source === "pdf") continue;
    if (p.type === "external" && !isBookingVendorPage(p)) continue;
    const hit = matchWindow(p.text, PREPAY, 200) ?? matchWindow(p.text, CARD_GUARANTEE, 200);
    if (!hit || NEGATED.test(hit.window)) continue;
    const group = p.type === "events" || GROUP_NEAR.test(hit.window);
    const fact: SiteFact<true> = { value: true, url: p.url, quote: hit.quote, source: "page", scope: group ? "group_or_event" : "general" };
    if (!group) return fact;
    scoped ??= fact;
  }
  return scoped;
}

function bridgeTasting(pages: CapturedPage[]): SiteFact<true> | null {
  for (const p of ofTypes(pages, ["menu"])) {
    if (p.needsOcr) continue;
    const hit = matchWindow(p.text, TASTING, 0);
    if (hit) return { value: true, url: p.url, quote: hit.quote, source: p.source === "pdf" ? "pdf" : "page" };
  }
  return null;
}

function bridgeMenuVendor(pages: CapturedPage[]): SiteFact<string> | null {
  for (const p of ofTypes(pages, ["menu", "external"])) {
    for (const href of hrefsOf(p, true)) {
      const host = hostOf(href);
      const vendor = host ? menuVendorFor(host) : null;
      if (vendor) return { value: vendor, url: p.url, quote: href, source: p.thirdPartyRequests.includes(href) ? "network" : "page" };
    }
  }
  return null;
}

function bridgeDirectOrdering(pages: CapturedPage[]): SiteFact<true> | null {
  for (const p of ofTypes(pages, ["order", "menu", "external"])) {
    for (const href of hrefsOf(p, true)) {
      const host = hostOf(href);
      if (host && isDirectOrderingHost(host)) {
        return { value: true, url: p.url, quote: href, source: p.thirdPartyRequests.includes(href) ? "network" : "page" };
      }
    }
  }
  return null;
}

function bridgeDelivery(pages: CapturedPage[]): SiteFact<string[]> | null {
  const names: string[] = [];
  let url: string | null = null;
  let quote: string | null = null;
  for (const p of ofTypes(pages, ["order", "menu", "contact", "locations"])) {
    for (const l of p.links) {
      const host = hostOf(l.href);
      const platform = host ? deliveryPlatformFor(host) : null;
      if (!platform) continue;
      if (!names.includes(platform)) names.push(platform);
      url ??= p.url;
      quote ??= l.href;
    }
  }
  return names.length > 0 && url ? { value: names, url, quote, source: "page" } : null;
}

function bridgeMenuPdf(pages: CapturedPage[]): string | null {
  const pdf = pages.find((p) => p.source === "pdf");
  if (pdf) return pdf.url;
  for (const p of ofTypes(pages, ["menu"])) {
    for (const l of p.links) {
      try {
        const u = new URL(l.href);
        if (menuPdf({ text: l.text, url: u })) return u.href;
      } catch {
        // malformed href
      }
    }
  }
  return null;
}

/** Fills only what is still `null`. Language facts and the "page seen" flags are left alone. */
export function bridgeSiteFacts(base: SiteFacts, capture: SiteCaptureResult): SiteFacts {
  const pages = capture.pages;
  const out: SiteFacts = { ...base, coverage: coverageOf(capture) };

  out.bookingProvider ??= bridgeBooking(pages);
  out.hasPrepayment ??= bridgePrepayment(pages);
  out.tastingMenu ??= bridgeTasting(pages);
  out.qrMenuTool ??= bridgeMenuVendor(pages);
  out.directOrdering ??= bridgeDirectOrdering(pages);
  out.deliveryPlatforms ??= bridgeDelivery(pages);
  out.menuPdfUrl ??= bridgeMenuPdf(pages);

  // Location and hotel signals read raw HTML; it is kept for these page types only.
  const signalPages: SignalPage[] = pages
    .filter((p) => p.html !== null && (p.type === "home" || p.type === "locations" || p.type === "contact" || p.type === "about"))
    .map((p) => ({ url: p.finalUrl, html: p.html as string, kind: p.type }));
  if (signalPages.length > 1) {
    if (!out.locationCount || !out.locationHints) {
      const loc = detectLocations(signalPages);
      out.locationCount ??= loc.locationCount;
      out.locationHints ??= loc.locationHints;
    }
    out.hotelOperator ??= detectHotelOperator(signalPages);
  }
  return out;
}

export function siteFactsFromCapture(
  home: { url: string; html: string },
  capture: SiteCaptureResult,
  pick: SubpagePick,
): SiteFacts {
  return bridgeSiteFacts(mergeSiteFacts(home, visitedFromCapture(pick, capture, home.url), pick), capture);
}
```

- [ ] **Step 5: Oda 1'i kapsamdan haberdar et**

`src/lib/ai-core/agent/room-one-audit.ts` satır 97:

```ts
    hasPrepayment: sf?.hasPrepayment ? true : null,
```

şununla değişir:

```ts
    // A deposit stated only for groups / private events is evidence, not a
    // general "this venue takes deposits" signal.
    hasPrepayment: sf?.hasPrepayment && sf.hasPrepayment.scope !== "group_or_event" ? true : null,
```

- [ ] **Step 6: Testlerin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/bridge.test.ts src/__tests__/lib/site-facts.test.ts src/__tests__/lib/site-facts-real-sites.test.ts`
Expected: PASS. Bir satıcı adı testi düşerse (`MenuTiger`, `Orderswift` host'ları `src/lib/restaurant-vendors.ts`'te tanımlı; `Uber Eats` / `Deliveroo` `src/lib/delivery-platforms.ts`'te) test verisini o dosyadaki gerçek host'a göre düzelt; satıcı listelerini bu görevde değiştirme.

- [ ] **Step 7: Commit**

```bash
git add src/lib/site-facts.ts src/lib/site-capture/bridge.ts src/lib/ai-core/agent/room-one-audit.ts src/__tests__/lib/site-capture/bridge.test.ts
git commit -m "feat(site-capture): bridge fills unknown facts with scope and source; Room 1 ignores group-only deposits"
```

---

### Task 8: Playwright açıcı ve `crawlWebsiteDeep`

**Files:**
- Create: `src/lib/site-capture/requests.ts`
- Create: `src/lib/site-capture/opener.ts`
- Create: `src/lib/site-capture/deep.ts`
- Modify: `src/lib/crawler.ts` (`getBrowser` dışa açılır; `crawlOnce` seçenek alır; `crawlHomepage` eklenir; `crawlWebsite` davranışı aynı kalır)
- Test: `src/__tests__/lib/site-capture/requests.test.ts`
- Test: `src/__tests__/lib/site-capture/deep.test.ts`

**Interfaces:**
- Consumes: `captureSite`, `CaptureLimits` (Task 6); `siteFactsFromCapture` (Task 7); `fetchPdfText` (Task 5); `pickSubpages`; `extractFeatures` (`@/lib/extractor`); `safeFetchFollow`; `assertSafeFetchUrl`; `siteKey`.
- Produces:
  - `recordThirdPartyRequests(page: Page, homeUrl: string): () => string[]`
  - `crawler.ts`: `export async function getBrowser(): Promise<Browser>`, `export interface HomeSnapshot { finalUrl: string; html: string; thirdPartyRequests: string[] }`, `export async function crawlHomepage(url: string, businessType?: string | null): Promise<{ features: WebsiteFeatures; home: HomeSnapshot | null }>`
  - `createPlaywrightOpener(browser: Browser, homeUrl: string, signal?: AbortSignal): Promise<PageOpener>`
  - `fetchTextSafe(url: string): Promise<string | null>`
  - `interface DeepCrawlResult { features: WebsiteFeatures; capture: SiteCaptureResult | null }`
  - `crawlWebsiteDeep(url: string, businessType?: string | null, opts?: { signal?: AbortSignal; limits?: Partial<CaptureLimits> }): Promise<DeepCrawlResult>`

Açıcının kendisi (gerçek Chromium) birim testle değil Task 14'teki canlı ölçümle sınanır; spec böyle söylüyor. Bu görevin birim testleri istek kaydını ve `crawlWebsiteDeep` akışını (sahte açıcıyla) kapsar.

- [ ] **Step 1: İstek kaydı için başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/requests.test.ts
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { recordThirdPartyRequests } from "@/lib/site-capture/requests";

function fakePage() {
  const main = { id: "main" };
  let handler: ((req: unknown) => void) | null = null;
  const page = {
    on: (_event: string, cb: (req: unknown) => void) => {
      handler = cb;
    },
    mainFrame: () => main,
  } as unknown as Page;
  const emit = (url: string, type: string, frame: unknown = main) =>
    handler?.({ url: () => url, resourceType: () => type, frame: () => frame });
  return { page, emit };
}

describe("recordThirdPartyRequests", () => {
  it("keeps third-party script, xhr, fetch and sub-frame requests as origin + path", () => {
    const { page, emit } = fakePage();
    const read = recordThirdPartyRequests(page, "https://www.bistro.co.uk/");
    emit("https://www.sevenrooms.com/widget/embed.js?venue=bistro", "script");
    emit("https://api.vendor.test/v1/slots?date=1", "xhr");
    emit("https://book.vendor.test/embed", "document", { id: "child" });
    emit("https://www.sevenrooms.com/widget/embed.js?venue=other", "script");
    expect(read()).toEqual([
      "https://www.sevenrooms.com/widget/embed.js",
      "https://api.vendor.test/v1/slots",
      "https://book.vendor.test/embed",
    ]);
  });

  it("ignores the venue's own hosts, images and the main document", () => {
    const { page, emit } = fakePage();
    const read = recordThirdPartyRequests(page, "https://www.bistro.co.uk/");
    emit("https://cdn.bistro.co.uk/app.js", "script");
    emit("https://images.vendor.test/hero.jpg", "image");
    emit("https://other.test/", "document");
    emit("data:text/plain,hi", "fetch");
    expect(read()).toEqual([]);
  });
});
```

Run: `npx vitest run src/__tests__/lib/site-capture/requests.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/requests'`.

- [ ] **Step 2: İstek kaydını yaz**

```ts
// src/lib/site-capture/requests.ts
/**
 * Third-party requests a page makes while it renders. A booking or ordering
 * widget that loads late never shows up in the final HTML; its requests do.
 * Resource hints (preconnect / dns-prefetch) make no request, so they are
 * not evidence here.
 */
import type { Page } from "playwright";
import { siteKey } from "@/lib/site-signals";

const MAX_REQUESTS = 200;
const KEPT_TYPES = new Set(["script", "xhr", "fetch"]);

/** Starts recording; call the returned function to read `origin + path` of each request. */
export function recordThirdPartyRequests(page: Page, homeUrl: string): () => string[] {
  let homeKey = "";
  try {
    homeKey = siteKey(new URL(homeUrl).hostname);
  } catch {
    // unparsable home URL: every host counts as third party
  }
  const seen = new Set<string>();
  page.on("request", (req) => {
    try {
      const type = req.resourceType();
      const subFrame = type === "document" && req.frame() !== page.mainFrame();
      if (!KEPT_TYPES.has(type) && !subFrame) return;
      const u = new URL(req.url());
      if (!/^https?:$/.test(u.protocol) || siteKey(u.hostname) === homeKey) return;
      if (seen.size < MAX_REQUESTS) seen.add(u.origin + u.pathname);
    } catch {
      // detached frame or unparsable URL: nothing to record
    }
  });
  return () => [...seen];
}
```

Run: `npx vitest run src/__tests__/lib/site-capture/requests.test.ts`
Expected: PASS.

- [ ] **Step 3: `crawler.ts`'i ana sayfayı dışarı verecek şekilde böl**

`src/lib/crawler.ts` içinde beş değişiklik; `crawlWebsite`'ın davranışı aynı kalır.

(a) İçe aktarımlara ekle:

```ts
import { recordThirdPartyRequests } from "./site-capture/requests";
```

(b) `async function getBrowser()` → `export async function getBrowser()`.

(c) `export async function crawlWebsite(` bildiriminin hemen üstüne ekle:

```ts
/** The rendered homepage, handed to the deep capture so it is not opened twice. */
export interface HomeSnapshot {
  finalUrl: string;
  html: string;
  thirdPartyRequests: string[];
}

interface CrawlOptions {
  /** Open the menu / reservation / order pages and merge their facts (today's behaviour). */
  subpages: boolean;
  /** Called with the rendered homepage when it is reachable. */
  onHome?: (home: HomeSnapshot) => void;
}
```

(d) `crawlWebsite`'ın bugünkü gövdesini `crawlGuarded` adlı iç fonksiyona taşı ve iki `crawlOnce(url, businessType)` çağrısını `crawlOnce(url, businessType, opts)` yap. Sonuç:

```ts
export async function crawlWebsite(
  url: string,
  businessType?: string | null,
): Promise<WebsiteFeatures> {
  return crawlGuarded(url, businessType, { subpages: true });
}

/**
 * Homepage audit only: same guards and retry as crawlWebsite, but the
 * subpages are left to the deep capture (src/lib/site-capture/deep.ts).
 * `home` is null when the homepage was not reachable.
 */
export async function crawlHomepage(
  url: string,
  businessType?: string | null,
): Promise<{ features: WebsiteFeatures; home: HomeSnapshot | null }> {
  const holder: { home: HomeSnapshot | null } = { home: null };
  const features = await crawlGuarded(url, businessType, {
    subpages: false,
    onHome: (h) => {
      holder.home = h;
    },
  });
  return { features, home: features.reachable ? holder.home : null };
}

async function crawlGuarded(
  url: string,
  businessType: string | null | undefined,
  opts: CrawlOptions,
): Promise<WebsiteFeatures> {
  // ... the existing body of crawlWebsite, unchanged, with both
  // `crawlOnce(url, businessType)` calls becoming `crawlOnce(url, businessType, opts)`.
}
```

(Yukarıdaki `// ...` satırı "bugünkü gövde buraya taşınır" demektir: sosyal profil kapısı, SSRF kapısı, `crawlOnce` çağrısı, geçici hata için bir yeniden deneme. Yorumlarıyla birlikte olduğu gibi taşı.)

(e) `crawlOnce` imzasını ve iki yerini değiştir:

```ts
async function crawlOnce(url: string, businessType: string | null | undefined, opts: CrawlOptions): Promise<WebsiteFeatures> {
```

`page = await browser.newPage({ ... });` çağrısından hemen sonra:

```ts
    const homeRequests = opts.onHome ? recordThirdPartyRequests(page, url) : null;
```

Dosyanın sonuna doğru şu blok:

```ts
    if (features.reachable) {
      try {
        features.siteFacts = await collectSiteFacts(page, finalUrl, html);
      } catch (err) {
        // The homepage audit stands on its own; subpages are extra evidence.
        console.error(`Subpage crawl failed for ${url}:`, err instanceof Error ? err.message : String(err));
      }
    }
```

şununla değişir:

```ts
    if (features.reachable) {
      opts.onHome?.({ finalUrl, html, thirdPartyRequests: homeRequests ? homeRequests() : [] });
      if (opts.subpages) {
        try {
          features.siteFacts = await collectSiteFacts(page, finalUrl, html);
        } catch (err) {
          // The homepage audit stands on its own; subpages are extra evidence.
          console.error(`Subpage crawl failed for ${url}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }
```

Run: `npx vitest run src/__tests__/lib/crawler-ssrf.test.ts src/__tests__/agent-workers/website-auditor.test.ts && npx tsc --noEmit`
Expected: PASS ve tip hatası yok.

- [ ] **Step 4: Playwright açıcıyı yaz**

```ts
// src/lib/site-capture/opener.ts
/**
 * Opens pages for the capture in one browser context per site. Every
 * navigation goes through the SSRF guard. A page that answers 401 / 403 /
 * 429 is retried with a mobile identity, then with a plain HTTP fetch;
 * after that it is "blocked" (no proxy).
 */
import type { Browser, BrowserContext } from "playwright";
import { CRAWLER_USER_AGENT } from "@/lib/crawler";
import { safeFetchFollow } from "@/lib/safe-fetch";
import { assertSafeFetchUrl } from "@/lib/url-guard";
import { recordThirdPartyRequests } from "./requests";
import type { OpenedPage, PageOpener } from "./types";

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAX_HTML_CHARS = 1_500_000;
const MAX_TEXT_FILE_CHARS = 2_000_000;
const BLOCKED_STATUS = new Set([401, 403, 429]);
const COOKIE_BUTTON =
  /^(accept( all)?( cookies)?|allow all( cookies)?|i agree|agree|got it|ok(ay)?|kabul et|tümünü kabul et|tamam)$/i;
/** Scrolls down in steps so lazy sections and widgets load, then back to the top. Capped at ~2 s. */
const SCROLL_SCRIPT = `(async () => {
  const step = 800;
  const max = Math.min(document.body ? document.body.scrollHeight : 0, 12800);
  for (let y = 0; y < max; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
})()`;

async function newContext(browser: Browser, mobile: boolean): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: mobile ? MOBILE_USER_AGENT : CRAWLER_USER_AGENT,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    acceptDownloads: false,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    locale: "en-US",
  });
  await context.route("**/*", async (route, request) => {
    const type = request.resourceType();
    // The capture keeps text and addresses; pictures, video and fonts only cost time and memory.
    if (type === "image" || type === "media" || type === "font") return route.abort();
    if (!request.isNavigationRequest()) return route.continue();
    try {
      await assertSafeFetchUrl(request.url());
    } catch {
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return context;
}

function failure(url: string, error: OpenedPage["error"], status: number | null = null): OpenedPage {
  return { finalUrl: url, status, html: null, thirdPartyRequests: [], source: "browser", error };
}

async function openOnce(context: BrowserContext, url: string, timeoutMs: number, homeUrl: string): Promise<OpenedPage> {
  const page = await context.newPage();
  const requests = recordThirdPartyRequests(page, homeUrl);
  // Leave ~5 s of the page budget for load, cookie banner, scroll and settle.
  const gotoTimeout = timeoutMs > 8_000 ? timeoutMs - 5_000 : timeoutMs;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: gotoTimeout });
    const status = res?.status() ?? null;
    if (status !== null && status >= 400) {
      return { ...failure(page.url(), BLOCKED_STATUS.has(status) ? "blocked" : "http_error", status) };
    }
    await page.waitForLoadState("load", { timeout: 2_000 }).catch(() => {});
    await page.getByRole("button", { name: COOKIE_BUTTON }).first().click({ timeout: 700 }).catch(() => {});
    await page.evaluate(SCROLL_SCRIPT).catch(() => {});
    await page.waitForTimeout(400);
    const html = (await page.content()).slice(0, MAX_HTML_CHARS);
    return { finalUrl: page.url(), status, html, thirdPartyRequests: requests(), source: "browser", error: null };
  } catch (err) {
    const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (m.includes("timeout")) return failure(url, "timeout");
    if (m.includes("blockedbyclient")) return failure(url, "unsafe_url");
    if (m.includes("closed")) return failure(url, "aborted");
    return failure(url, "nav_error");
  } finally {
    await page.close().catch(() => {});
  }
}

async function openViaHttp(url: string, timeoutMs: number): Promise<OpenedPage | null> {
  try {
    const { response, finalUrl } = await safeFetchFollow(url, {
      perHopTimeoutMs: timeoutMs,
      init: { headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/html,application/xhtml+xml" } },
    });
    if (response.status >= 400) return null;
    if (!/html/i.test(response.headers.get("content-type") ?? "")) return null;
    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    return { finalUrl, status: response.status, html, thirdPartyRequests: [], source: "http", error: null };
  } catch {
    return null;
  }
}

/** robots.txt and sitemaps: SSRF-safe, 8 s, 200 only. `null` when unavailable. */
export async function fetchTextSafe(url: string): Promise<string | null> {
  try {
    const { response } = await safeFetchFollow(url, {
      perHopTimeoutMs: 8_000,
      init: { headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/plain,application/xml,text/xml,*/*" } },
    });
    if (response.status !== 200) return null;
    return (await response.text()).slice(0, MAX_TEXT_FILE_CHARS);
  } catch {
    return null;
  }
}

export async function createPlaywrightOpener(browser: Browser, homeUrl: string, signal?: AbortSignal): Promise<PageOpener> {
  const desktop = await newContext(browser, false);
  let mobile: BrowserContext | null = null;
  let closed = false;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await desktop.close().catch(() => {});
    if (mobile) await mobile.close().catch(() => {});
  };
  // Closing the contexts rejects every in-flight navigation: the work stops, not just the wait.
  signal?.addEventListener("abort", () => void close(), { once: true });
  if (signal?.aborted) await close();

  return {
    async open(url, { timeoutMs }) {
      if (closed) return failure(url, "aborted");
      const started = Date.now();
      const left = () => timeoutMs - (Date.now() - started);
      let result = await openOnce(desktop, url, timeoutMs, homeUrl);
      if (result.error !== "blocked" || closed) return result;
      if (left() > 3_000) {
        mobile ??= await newContext(browser, true);
        result = await openOnce(mobile, url, left(), homeUrl);
        if (result.error !== "blocked" || closed) return result;
      }
      if (left() > 1_000) {
        const viaHttp = await openViaHttp(url, left());
        if (viaHttp) return viaHttp;
      }
      return result;
    },
    close,
  };
}
```

- [ ] **Step 5: `crawlWebsiteDeep` için başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/deep.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenedPage } from "@/lib/site-capture/types";
import type { WebsiteFeatures } from "@/types";

const mocks = vi.hoisted(() => ({
  crawlHomepage: vi.fn(),
  createOpener: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/lib/crawler", () => ({
  crawlHomepage: mocks.crawlHomepage,
  getBrowser: async () => ({}),
  CRAWLER_USER_AGENT: "test-agent",
}));
vi.mock("@/lib/site-capture/opener", () => ({
  createPlaywrightOpener: mocks.createOpener,
  fetchTextSafe: async () => null,
}));
vi.mock("@/lib/site-capture/documents", () => ({
  fetchPdfText: async () => ({ ok: false, reason: "not_pdf", httpStatus: 200 }),
}));

import { crawlWebsiteDeep } from "@/lib/site-capture/deep";

const HOME = "https://bistro.test/";
const html = (body: string) => `<html><head><title>Bistro</title></head><body>${body}</body></html>`;

function feat(overrides: Partial<WebsiteFeatures> = {}): WebsiteFeatures {
  return {
    url: HOME,
    reachable: true,
    crawlError: null,
    httpStatus: 200,
    loadTimeMs: 900,
    securityHeaders: {},
    consoleErrors: [],
    ...overrides,
  } as unknown as WebsiteFeatures;
}

const opened = (url: string, body: string, source: OpenedPage["source"] = "browser"): OpenedPage => ({
  finalUrl: url,
  status: 200,
  html: html(body),
  thirdPartyRequests: [],
  source,
  error: null,
});
const notFound = (url: string): OpenedPage => ({ finalUrl: url, status: 404, html: null, thirdPartyRequests: [], source: "browser", error: "http_error" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue(undefined);
  mocks.createOpener.mockResolvedValue({ open: mocks.open, close: mocks.close });
  mocks.open.mockImplementation(async (url: string) => notFound(url));
});

describe("crawlWebsiteDeep", () => {
  it("captures the site, reads today's subpages from the capture and attaches coverage", async () => {
    mocks.crawlHomepage.mockResolvedValue({
      features: feat(),
      home: { finalUrl: HOME, html: html(`<a href="/menu">Menu</a>`), thirdPartyRequests: [] },
    });
    mocks.open.mockImplementation(async (url: string) => (url.endsWith("/menu") ? opened(url, "Starters and mains") : notFound(url)));

    const { features, capture } = await crawlWebsiteDeep(HOME, "restaurant");

    expect(capture?.status).toBe("complete");
    expect(features.siteFacts?.menuPageSeen).toBe(true);
    expect(features.siteFacts?.coverage?.opened).toBe(2);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("does not capture a social profile", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "SOCIAL_MEDIA_ONLY" }), home: null });
    const { capture } = await crawlWebsiteDeep("https://instagram.com/bistro");
    expect(capture).toBeNull();
    expect(mocks.createOpener).not.toHaveBeenCalled();
  });

  it("recovers a bot-blocked homepage through the opener's fallbacks", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "BOT_BLOCKED_4XX", httpStatus: 403 }), home: null });
    mocks.open.mockImplementation(async (url: string) => (url === HOME ? opened(url, "Welcome to Bistro", "http") : notFound(url)));

    const { features, capture } = await crawlWebsiteDeep(HOME, "restaurant");

    expect(features.reachable).toBe(true);
    expect(features.crawlError).toBeNull();
    expect(features.loadTimeMs).toBe(900);
    expect(capture?.status).toBe("complete");
    expect(features.siteFacts?.coverage).toBeDefined();
  });

  it("records a homepage that stays blocked", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "BOT_BLOCKED_4XX", httpStatus: 403 }), home: null });
    mocks.open.mockResolvedValue({ finalUrl: HOME, status: 403, html: null, thirdPartyRequests: [], source: "browser", error: "blocked" });

    const { features, capture } = await crawlWebsiteDeep(HOME);

    expect(features.reachable).toBe(false);
    expect(capture).toMatchObject({ status: "blocked", pages: [] });
    expect(capture?.ledger).toEqual([
      { url: HOME, finalUrl: null, type: "home", source: "home_link", outcome: "failed", reason: "blocked", httpStatus: 403 },
    ]);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("records an unreachable homepage without opening anything", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "TIMEOUT", httpStatus: null }), home: null });
    const { capture } = await crawlWebsiteDeep(HOME);
    expect(capture).toMatchObject({ status: "failed" });
    expect(capture?.ledger[0]).toMatchObject({ outcome: "failed", reason: "timeout" });
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run src/__tests__/lib/site-capture/deep.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/deep'`.

- [ ] **Step 6: `crawlWebsiteDeep`'i yaz**

```ts
// src/lib/site-capture/deep.ts
/**
 * Deep website audit: today's homepage audit, then a capture of the site's
 * relevant pages, then the facts read from that capture. `crawlWebsite`
 * (shallow) stays as it is for the legacy path and the capacity fallback.
 */
import { CRAWLER_USER_AGENT, crawlHomepage, getBrowser, type HomeSnapshot } from "@/lib/crawler";
import { extractFeatures } from "@/lib/extractor";
import { pickSubpages } from "@/lib/site-facts";
import type { WebsiteFeatures } from "@/types";
import { siteFactsFromCapture } from "./bridge";
import { captureSite, type CaptureLimits } from "./capture";
import { fetchPdfText } from "./documents";
import { createPlaywrightOpener, fetchTextSafe } from "./opener";
import type { LedgerReason, SiteCaptureResult } from "./types";

export interface DeepCrawlResult {
  features: WebsiteFeatures;
  /** `null` when there was nothing to capture (social profile, URL refused by the guard, aborted before start). */
  capture: SiteCaptureResult | null;
}

const HOME_FAILURE_REASON: Record<string, LedgerReason> = {
  TIMEOUT: "timeout",
  BOT_BLOCKED_4XX: "blocked",
  SERVER_5XX: "http_error",
};

function homeOnlyCapture(url: string, features: WebsiteFeatures, startedAt: number): SiteCaptureResult {
  const blocked = features.crawlError === "BOT_BLOCKED_4XX";
  return {
    rootUrl: url,
    status: blocked ? "blocked" : "failed",
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    pages: [],
    ledger: [
      {
        url,
        finalUrl: null,
        type: "home",
        source: "home_link",
        outcome: "failed",
        reason: HOME_FAILURE_REASON[features.crawlError ?? ""] ?? "nav_error",
        httpStatus: features.httpStatus ?? null,
      },
    ],
    sitemapUrlCount: 0,
  };
}

export async function crawlWebsiteDeep(
  url: string,
  businessType?: string | null,
  opts: { signal?: AbortSignal; limits?: Partial<CaptureLimits> } = {},
): Promise<DeepCrawlResult> {
  const startedAt = Date.now();
  const first = await crawlHomepage(url, businessType);
  let features = first.features;
  let home: HomeSnapshot | null = first.home;

  if (features.crawlError === "SOCIAL_MEDIA_ONLY" || features.crawlError === "BLOCKED_BY_GUARD") {
    return { features, capture: null };
  }
  if (opts.signal?.aborted) return { features, capture: null };

  const opener = await createPlaywrightOpener(await getBrowser(), url, opts.signal);
  try {
    if (!home && features.crawlError === "BOT_BLOCKED_4XX") {
      // Desktop Chromium was refused. The opener retries with a mobile identity, then plain HTTP.
      const retry = await opener.open(url, { timeoutMs: 20_000, signal: opts.signal });
      if (retry.html && !retry.error) {
        home = { finalUrl: retry.finalUrl, html: retry.html, thirdPartyRequests: retry.thirdPartyRequests };
        features = {
          ...extractFeatures(retry.html, url, businessType),
          loadTimeMs: features.loadTimeMs,
          securityHeaders: features.securityHeaders,
          consoleErrors: features.consoleErrors,
          mobileFriendlyGuess: /<meta[^>]+name=["']viewport["']/i.test(retry.html),
          httpStatus: retry.status ?? 200,
          reachable: true,
          crawlError: null,
        };
      }
    }
    if (!home) return { features, capture: homeOnlyCapture(url, features, startedAt) };

    const pick = pickSubpages(home.html, home.finalUrl);
    const capture = await captureSite({
      homeUrl: home.finalUrl,
      homeHtml: home.html,
      homeRequests: home.thirdPartyRequests,
      pinned: pick.targets,
      opener,
      fetchText: fetchTextSafe,
      fetchPdf: (pdfUrl, timeoutMs) => fetchPdfText(pdfUrl, { timeoutMs, userAgent: CRAWLER_USER_AGENT }),
      signal: opts.signal,
      limits: opts.limits,
    });
    features.siteFacts = siteFactsFromCapture({ url: home.finalUrl, html: home.html }, capture, pick);
    return { features, capture };
  } finally {
    await opener.close();
  }
}
```

- [ ] **Step 7: Testlerin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture && npx tsc --noEmit`
Expected: PASS, tip hatası yok.

- [ ] **Step 8: Gerçek tarayıcıyla duman testi (elle)**

```bash
npx tsx -e "import('./src/lib/site-capture/deep').then(async (m) => { const r = await m.crawlWebsiteDeep('https://www.padella.co/soho/', 'restaurant'); console.log(r.capture?.status, r.capture?.pages.map(p => p.type + ':' + p.url)); console.log(r.features.siteFacts?.coverage); const c = await import('./src/lib/crawler'); await c.closeBrowser(); })"
```

Expected: `complete` ya da `partial`; birden fazla sayfa; `coverage.opened >= 2`. Çıktıyı commit mesajına değil görev notuna yaz. Komut `@/` takma adını çözemezse `scripts/website-audit-eval/capture-url.ts` (Task 14) ile dene; bu adımı o zamana bırak.

- [ ] **Step 9: Commit**

```bash
git add src/lib/site-capture/requests.ts src/lib/site-capture/opener.ts src/lib/site-capture/deep.ts src/lib/crawler.ts src/__tests__/lib/site-capture/requests.test.ts src/__tests__/lib/site-capture/deep.test.ts
git commit -m "feat(site-capture): Playwright opener with blocked-site fallbacks and crawlWebsiteDeep"
```

---

### Task 9: Saklama (`SiteCapture`, `SiteCapturePage`)

**Files:**
- Modify: `prisma/schema.prisma` (iki model; `Lead` ve `Workspace`'e ters ilişki)
- Create: `src/lib/site-capture/store.ts`
- Test: `src/__tests__/lib/site-capture/store.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `SiteCaptureResult`.
- Produces: `saveSiteCapture(args: { workspaceId: string; leadId: string; capture: SiteCaptureResult }): Promise<void>` (lead'in eski kaydını silip yenisini tek işlemde yazar).

- [ ] **Step 1: Şemayı düzenle**

`prisma/schema.prisma` içinde `model WebsiteAudit { ... }` bloğunun hemen altına ekle:

```prisma
// One deep capture per lead (src/lib/site-capture). Replaced on every audit;
// no history. Raw HTML is never stored. Spec:
// docs/superpowers/specs/2026-10-03-site-yakalama-design.md
model SiteCapture {
  id              String   @id @default(cuid())
  workspaceId     String   @map("workspace_id")
  leadId          String   @unique @map("lead_id")
  rootUrl         String   @map("root_url")
  // "complete" | "partial" | "blocked" | "failed"
  status          String
  startedAt       DateTime @map("started_at")
  durationMs      Int      @map("duration_ms")
  pageCount       Int      @default(0) @map("page_count")
  sitemapUrlCount Int      @default(0) @map("sitemap_url_count")
  // LedgerEntry[]: exactly one result per discovered address.
  ledger          Json     @default("[]")
  createdAt       DateTime @default(now()) @map("created_at")

  workspace Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  lead      Lead              @relation(fields: [leadId], references: [id], onDelete: Cascade)
  pages     SiteCapturePage[]

  @@index([workspaceId])
  @@map("site_captures")
}

model SiteCapturePage {
  id                 String  @id @default(cuid())
  captureId          String  @map("capture_id")
  workspaceId        String  @map("workspace_id")
  url                String
  finalUrl           String  @map("final_url")
  // PageType
  type               String
  // "browser" | "http" | "pdf"
  source             String
  httpStatus         Int?    @map("http_status")
  title              String?
  // Visible text, at most 60,000 characters.
  text               String  @db.Text
  links              Json    @default("[]")
  embeds             Json    @default("[]")
  jsonLd             Json    @default("[]") @map("json_ld")
  thirdPartyRequests Json    @default("[]") @map("third_party_requests")
  needsOcr           Boolean @default(false) @map("needs_ocr")

  capture SiteCapture @relation(fields: [captureId], references: [id], onDelete: Cascade)

  @@index([captureId])
  @@index([workspaceId])
  @@map("site_capture_pages")
}
```

`model Lead` içinde `websiteAudit        WebsiteAudit?` satırının altına:

```prisma
  siteCapture         SiteCapture?
```

`model Workspace` içinde `agentRuns            AgentRun[]` satırının altına:

```prisma
  siteCaptures         SiteCapture[]
```

- [ ] **Step 2: İstemciyi üret (veritabanına dokunmaz)**

```bash
npm run db:generate
```

Expected: `Generated Prisma Client` çıktısı; `src/generated/prisma` altında `SiteCapture` tipleri. **`npm run db:push` bu görevde çalıştırılmaz**: şemayı gerçek veritabanına yazar ve `.env`'deki `DATABASE_URL`'in hangi veritabanını gösterdiği kullanıcıyla doğrulanmadan yapılmaz. Bu adım Task 14'te, kullanıcı onayıyla atılır.

- [ ] **Step 3: Başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/store.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteCaptureResult } from "@/lib/site-capture/types";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteCapture: { deleteMany: mocks.deleteMany, create: mocks.create },
    $transaction: mocks.transaction,
  },
}));

import { saveSiteCapture } from "@/lib/site-capture/store";

const capture: SiteCaptureResult = {
  rootUrl: "https://bistro.test/",
  status: "complete",
  startedAt: "2026-10-04T10:00:00.000Z",
  durationMs: 12_345.6,
  sitemapUrlCount: 7,
  ledger: [{ url: "https://bistro.test/", finalUrl: "https://bistro.test/", type: "home", source: "home_link", outcome: "opened", reason: null, httpStatus: 200 }],
  pages: [
    {
      url: "https://bistro.test/",
      finalUrl: "https://bistro.test/",
      type: "home",
      httpStatus: 200,
      title: "Bistro",
      text: "Welcome",
      links: [{ text: "Menu", href: "https://bistro.test/menu" }],
      embeds: [],
      jsonLd: [{ name: "Bis\u0000tro" }],
      thirdPartyRequests: ["https://www.sevenrooms.com/widget/embed.js"],
      source: "browser",
      needsOcr: false,
      html: "<html>raw</html>",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteMany.mockReturnValue("delete-op");
  mocks.create.mockReturnValue("create-op");
  mocks.transaction.mockResolvedValue([]);
});

describe("saveSiteCapture", () => {
  it("replaces the lead's capture in one transaction, scoped by workspace", async () => {
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture });

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { leadId: "lead_1", workspaceId: "ws_1" } });
    expect(mocks.transaction).toHaveBeenCalledWith(["delete-op", "create-op"]);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      workspaceId: "ws_1",
      leadId: "lead_1",
      rootUrl: "https://bistro.test/",
      status: "complete",
      durationMs: 12_346,
      pageCount: 1,
      sitemapUrlCount: 7,
    });
    expect(data.startedAt).toEqual(new Date("2026-10-04T10:00:00.000Z"));
    expect(data.ledger).toHaveLength(1);
  });

  it("stores every page with the workspace id and without raw HTML", async () => {
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture });
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page).toMatchObject({ workspaceId: "ws_1", url: "https://bistro.test/", type: "home", source: "browser", text: "Welcome" });
    expect(page).not.toHaveProperty("html");
  });

  // Review Focus 5: jsonb rejects \u0000 just like text does.
  it("strips NUL characters from JSON values", async () => {
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture });
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page.jsonLd).toEqual([{ name: "Bistro" }]);
  });
});
```

Run: `npx vitest run src/__tests__/lib/site-capture/store.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/store'`.

- [ ] **Step 4: Saklamayı yaz**

```ts
// src/lib/site-capture/store.ts
/**
 * Persists a capture: one row per lead, replaced on every audit. Every
 * query carries the workspace id. Raw HTML is never written.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SiteCaptureResult } from "./types";

/** Plain JSON without NUL characters (Postgres jsonb rejects \u0000). */
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value).replace(/\\u0000/g, "")) as Prisma.InputJsonValue;
}

export async function saveSiteCapture(args: {
  workspaceId: string;
  leadId: string;
  capture: SiteCaptureResult;
}): Promise<void> {
  const { workspaceId, leadId, capture } = args;
  await prisma.$transaction([
    // Cascades to the pages of the previous capture.
    prisma.siteCapture.deleteMany({ where: { leadId, workspaceId } }),
    prisma.siteCapture.create({
      data: {
        workspaceId,
        leadId,
        rootUrl: capture.rootUrl,
        status: capture.status,
        startedAt: new Date(capture.startedAt),
        durationMs: Math.round(capture.durationMs),
        pageCount: capture.pages.length,
        sitemapUrlCount: capture.sitemapUrlCount,
        ledger: json(capture.ledger),
        pages: {
          create: capture.pages.map((p) => ({
            workspaceId,
            url: p.url,
            finalUrl: p.finalUrl,
            type: p.type,
            source: p.source,
            httpStatus: p.httpStatus,
            title: p.title,
            text: p.text,
            links: json(p.links),
            embeds: json(p.embeds),
            jsonLd: json(p.jsonLd),
            thirdPartyRequests: json(p.thirdPartyRequests),
            needsOcr: p.needsOcr,
          })),
        },
      },
    }),
  ]);
}
```

- [ ] **Step 5: Testin geçtiğini gör**

Run: `npx vitest run src/__tests__/lib/site-capture/store.test.ts && npx tsc --noEmit`
Expected: PASS, tip hatası yok.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/site-capture/store.ts src/__tests__/lib/site-capture/store.test.ts
git commit -m "feat(site-capture): SiteCapture tables and workspace-scoped store"
```

(`src/generated/prisma` git'te izleniyorsa üretilen dosyaları da ekle: `git status --short src/generated` ile bak.)

---

### Task 10: Süre modeli (dış sınır, iptal sinyali, erteleme, slotlar)

**Files:**
- Create: `src/lib/agent-workers/deadline.ts`
- Create: `src/lib/site-capture/slots.ts`
- Modify: `src/lib/agent-workers/types.ts` (`AgentWorkerContext`, `AgentWorker`)
- Modify: `src/lib/agent-workers/errors.ts` (`DeferError`)
- Modify: `src/lib/agent-workers/registry.ts:54-69` (`WEBSITE_AUDITOR`)
- Modify: `src/lib/agent-workers/execute.ts:82-85, 119-121, 266-287, 372` 
- Modify: `src/workers/agent-run-worker.ts:18, 22, 57, 75-89, 321-327`
- Modify: `src/__tests__/workers/agent-run-hubspot-writeback.test.ts:18` (hata modülü taklidi)
- Test: `src/__tests__/agent-workers/execute-defer.test.ts`
- Test: `src/__tests__/workers/agent-run-defer.test.ts`
- Test: `src/__tests__/lib/site-capture/slots.test.ts`

**Interfaces:**
- Produces:
  - `workerDeadlineMsFor(meta: { estimatedDurationMs?: number; deadlineMs?: number } | null | undefined): number`
  - `class DeferError extends Error { readonly delayMs: number }` (`constructor(delayMs: number, message?: string)`)
  - `AgentWorker.deadlineMs?: number`
  - `AgentWorkerContext.signal?: AbortSignal`, `.canDefer?: boolean`, `.deferCount?: number`, `.queuedAt?: Date`
  - `executeAgentRun(runId: string, opts?: { isRetry?: boolean; canDefer?: boolean }): Promise<void>`: `DeferError`'da koşuyu `PENDING`'e çevirir, `inputsJson.deferredAt` ve `inputsJson.deferCount` yazar, hatayı yeniden fırlatır.
  - `processJob(job, token?)`: `DeferError`'da `job.moveToDelayed(Date.now() + delayMs, token)` çağırır ve `DelayedError` fırlatır.
  - `slots.ts`: `tryAcquireCaptureSlot(): (() => void) | null`, `deferDelayMs(deferCount: number, random?: () => number): number`, `MAX_DEFER_WAIT_MS = 30 * 60_000`, `deepCaptureEnabled(): boolean`, `maxCaptureSlots(): number`

- [ ] **Step 1: Slotlar için başarısız testi yaz**

```ts
// src/__tests__/lib/site-capture/slots.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { deepCaptureEnabled, deferDelayMs, maxCaptureSlots, tryAcquireCaptureSlot } from "@/lib/site-capture/slots";

afterEach(() => {
  delete process.env.SITE_CAPTURE_MAX_CONCURRENT;
  delete process.env.SITE_CAPTURE_DEEP;
});

describe("capture slots", () => {
  it("allows two captures at once by default and frees a slot on release", () => {
    const a = tryAcquireCaptureSlot();
    const b = tryAcquireCaptureSlot();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(tryAcquireCaptureSlot()).toBeNull();
    a!();
    a!(); // releasing twice must not free a second slot
    const c = tryAcquireCaptureSlot();
    expect(c).not.toBeNull();
    expect(tryAcquireCaptureSlot()).toBeNull();
    b!();
    c!();
  });

  it("reads the limit from SITE_CAPTURE_MAX_CONCURRENT", () => {
    process.env.SITE_CAPTURE_MAX_CONCURRENT = "1";
    expect(maxCaptureSlots()).toBe(1);
    const a = tryAcquireCaptureSlot();
    expect(tryAcquireCaptureSlot()).toBeNull();
    a!();
    process.env.SITE_CAPTURE_MAX_CONCURRENT = "nonsense";
    expect(maxCaptureSlots()).toBe(2);
  });
});

describe("deferDelayMs", () => {
  it("backs off from 20 s to a 120 s ceiling, plus jitter", () => {
    const noJitter = () => 0;
    expect([0, 1, 2, 3, 9].map((n) => deferDelayMs(n, noJitter))).toEqual([20_000, 40_000, 80_000, 120_000, 120_000]);
    expect(deferDelayMs(0, () => 0.999)).toBeLessThan(25_000);
  });
});

describe("deepCaptureEnabled", () => {
  it("is on unless SITE_CAPTURE_DEEP is 0", () => {
    expect(deepCaptureEnabled()).toBe(true);
    process.env.SITE_CAPTURE_DEEP = "0";
    expect(deepCaptureEnabled()).toBe(false);
  });
});
```

Run: `npx vitest run src/__tests__/lib/site-capture/slots.test.ts`
Expected: FAIL, `Cannot find module '@/lib/site-capture/slots'`.

- [ ] **Step 2: Slotları yaz**

```ts
// src/lib/site-capture/slots.ts
/**
 * How many sites one process captures at once. A capture holds a browser
 * context with up to three pages, so the limit protects memory; a run that
 * finds no slot is deferred (see DeferError), it does not wait.
 */

let active = 0;

export function maxCaptureSlots(): number {
  const n = Number(process.env.SITE_CAPTURE_MAX_CONCURRENT);
  return Number.isInteger(n) && n > 0 ? n : 2;
}

/** A release function, or `null` when every slot is taken. Releasing twice is harmless. */
export function tryAcquireCaptureSlot(): (() => void) | null {
  if (active >= maxCaptureSlots()) return null;
  active++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active--;
  };
}

/** 20 s, 40 s, 80 s, then 120 s between attempts, plus up to 5 s of jitter. */
export function deferDelayMs(deferCount: number, random: () => number = Math.random): number {
  return Math.min(120_000, 20_000 * 2 ** Math.min(Math.max(deferCount, 0), 3)) + Math.floor(random() * 5_000);
}

/** After this long in the queue the audit runs shallow instead of waiting for a slot. */
export const MAX_DEFER_WAIT_MS = 30 * 60_000;

/** Kill switch: SITE_CAPTURE_DEEP=0 returns the auditor to the shallow crawl. */
export function deepCaptureEnabled(): boolean {
  return process.env.SITE_CAPTURE_DEEP !== "0";
}
```

Run: `npx vitest run src/__tests__/lib/site-capture/slots.test.ts`
Expected: PASS.

- [ ] **Step 3: Tipleri, hatayı ve dış sınır yardımcısını ekle**

`src/lib/agent-workers/deadline.ts` (yeni; `registry.ts`'e değil ayrı dosyaya konur, çünkü yürütücü testleri `registry` modülünü taklit ediyor):

```ts
// src/lib/agent-workers/deadline.ts
/**
 * Outer deadline of one worker execution. Default: three times the
 * estimated duration, capped at 180 s. A worker that is legitimately
 * long-running in-process declares its own `deadlineMs` in the registry.
 */
export function workerDeadlineMsFor(
  meta: { estimatedDurationMs?: number; deadlineMs?: number } | null | undefined,
): number {
  if (meta?.deadlineMs && meta.deadlineMs > 0) return meta.deadlineMs;
  return Math.min((meta?.estimatedDurationMs ?? 60_000) * 3, 180_000);
}
```

`src/lib/agent-workers/errors.ts` içinde `PermanentError` sınıfının altına:

```ts
/**
 * "Not now": the worker has no capacity (e.g. every site-capture slot is
 * taken). Not a failure and not a retry: the executor puts the run back to
 * PENDING and the queue worker re-queues the job after `delayMs` without
 * spending an attempt. Only thrown when `ctx.canDefer` is true.
 */
export class DeferError extends Error {
  constructor(
    public readonly delayMs: number,
    message = "deferred: no capacity",
  ) {
    super(message);
    this.name = "DeferError";
  }
}
```

`src/lib/agent-workers/types.ts` içinde `AgentWorker` arayüzünde `estimatedDurationMs: number;` satırının altına:

```ts
  /**
   * Outer deadline of one execution in ms. Omitted = min(estimatedDurationMs × 3, 180 s).
   * Set only for workers that are legitimately long-running in-process.
   */
  deadlineMs?: number;
```

Aynı dosyada `AgentWorkerContext` arayüzünün başına (`userId: string | null;` satırının altına):

```ts
  /** Aborted by the executor when the outer deadline fires. Long-running workers must stop on it. */
  signal?: AbortSignal;
  /** True only inside the BullMQ worker: the run may throw DeferError to be re-queued later. */
  canDefer?: boolean;
  /** How many times this run has been deferred so far. */
  deferCount?: number;
  /** When the run row was created; bounds the total time a run may wait for capacity. */
  queuedAt?: Date;
```

`src/lib/agent-workers/registry.ts` içinde `WEBSITE_AUDITOR` kaydında:

```ts
    estimatedDurationMs: 30000,
```

şununla değişir:

```ts
    // Deep capture: median well under a minute, capped by a 150 s capture budget.
    estimatedDurationMs: 60000,
    // Homepage audit (≤ 60 s with one retry) + capture (150 s) + PDFs and writes.
    deadlineMs: 300_000,
```

- [ ] **Step 4: Yürütücü için başarısız testi yaz**

```ts
// src/__tests__/agent-workers/execute-defer.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRun: vi.fn(),
  findWorkspace: vi.fn(),
  createTelemetry: vi.fn(),
  getWorker: vi.fn(),
  runWorker: vi.fn(),
  enqueueAdvance: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: { findUnique: mocks.findRun, update: mocks.updateRun },
    workspace: { findUniqueOrThrow: mocks.findWorkspace },
    chainTelemetry: { create: mocks.createTelemetry },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/agent-workers/registry", () => ({
  getWorker: mocks.getWorker,
  runWorker: (...args: unknown[]) => mocks.runWorker(...args),
  resolveMemoryWrites: () => Promise.resolve(null),
  resolveWorkerStart: vi.fn(),
  resolveWorkerFinalize: vi.fn(),
}));
vi.mock("@/lib/agent-workers/quota", () => ({ assertWorkerQuota: vi.fn() }));
vi.mock("@/lib/email/from", () => ({ getAppBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/ai-core/orchestrator", () => ({ enqueueAdvance: mocks.enqueueAdvance }));

import { workerDeadlineMsFor } from "@/lib/agent-workers/deadline";
import { DeferError, RetryableError } from "@/lib/agent-workers/errors";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const CREATED = new Date("2026-10-04T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRun.mockResolvedValue({
    id: "run_1",
    workspaceId: "ws_1",
    plannerSessionId: "session_1",
    workerKind: "WEBSITE_AUDITOR",
    status: "PENDING",
    leadId: null,
    startedAt: null,
    createdAt: CREATED,
    inputsJson: { deferCount: 2, keep: "me" },
    costTokens: 0,
    costUsdCents: 0,
  });
  mocks.findWorkspace.mockResolvedValue({ id: "ws_1", plan: "PRO" });
  mocks.getWorker.mockReturnValue({ mode: "sync", memoryReads: [], estimatedDurationMs: 60_000 });
  mocks.updateRun.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...(await mocks.findRun()),
    ...data,
  }));
});

describe("workerDeadlineMsFor", () => {
  it("keeps today's rule unless the worker declares a deadline", () => {
    expect(workerDeadlineMsFor(undefined)).toBe(180_000);
    expect(workerDeadlineMsFor({ estimatedDurationMs: 30_000 })).toBe(90_000);
    expect(workerDeadlineMsFor({ estimatedDurationMs: 120_000 })).toBe(180_000);
    expect(workerDeadlineMsFor({ estimatedDurationMs: 60_000, deadlineMs: 300_000 })).toBe(300_000);
  });
});

describe("executeAgentRun: context for long-running workers", () => {
  it("hands the worker a signal, the defer permission, the defer count and the queue time", async () => {
    let seen: AgentWorkerContext | null = null;
    mocks.runWorker.mockImplementation(async (_kind: string, ctx: AgentWorkerContext) => {
      seen = ctx;
      return { output: { ok: true } };
    });
    await executeAgentRun("run_1", { canDefer: true });
    const ctx = seen as unknown as AgentWorkerContext;
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
    expect(ctx.signal!.aborted).toBe(false);
    expect(ctx.canDefer).toBe(true);
    expect(ctx.deferCount).toBe(2);
    expect(ctx.queuedAt).toEqual(CREATED);
  });

  it("does not allow deferral on the inline path", async () => {
    let seen: AgentWorkerContext | null = null;
    mocks.runWorker.mockImplementation(async (_kind: string, ctx: AgentWorkerContext) => {
      seen = ctx;
      return { output: {} };
    });
    await executeAgentRun("run_1");
    expect((seen as unknown as AgentWorkerContext).canDefer).toBe(false);
  });
});

describe("executeAgentRun: deferral", () => {
  it("puts the run back to PENDING, records the deferral and rethrows", async () => {
    mocks.runWorker.mockRejectedValue(new DeferError(20_000));

    await expect(executeAgentRun("run_1", { canDefer: true })).rejects.toBeInstanceOf(DeferError);

    const last = mocks.updateRun.mock.calls.at(-1)![0];
    expect(last.where).toEqual({ id: "run_1", workspaceId: "ws_1" });
    expect(last.data).toMatchObject({ status: "PENDING", startedAt: null });
    expect(last.data.inputsJson).toMatchObject({ keep: "me", deferCount: 3 });
    expect(typeof last.data.inputsJson.deferredAt).toBe("string");
    expect(mocks.enqueueAdvance).not.toHaveBeenCalled();
    expect(mocks.createTelemetry).not.toHaveBeenCalled();
  });
});

describe("executeAgentRun: outer deadline", () => {
  // Review Focus 4: the deadline must stop the work, not just the wait.
  it("uses the worker's own deadline and aborts the signal when it fires", async () => {
    mocks.getWorker.mockReturnValue({ mode: "sync", memoryReads: [], estimatedDurationMs: 1, deadlineMs: 40 });
    let aborted = false;
    mocks.runWorker.mockImplementation(
      (_kind: string, ctx: AgentWorkerContext) =>
        new Promise(() => {
          ctx.signal!.addEventListener("abort", () => {
            aborted = true;
          });
        }),
    );

    await expect(executeAgentRun("run_1")).rejects.toBeInstanceOf(RetryableError);

    expect(aborted).toBe(true);
    const last = mocks.updateRun.mock.calls.at(-1)![0];
    expect(last.data.status).toBe("FAILED");
    expect(String(last.data.errorMsg)).toContain("worker_deadline_exceeded");
  });
});
```

Run: `npx vitest run src/__tests__/agent-workers/execute-defer.test.ts`
Expected: `workerDeadlineMsFor` testi PASS; diğerleri FAIL (`ctx.signal` tanımsız, erteleme `FAILED` yazıyor).

- [ ] **Step 5: Yürütücüyü değiştir**

`src/lib/agent-workers/execute.ts` içinde:

(a) İçe aktarımlar:

```ts
import { RetryableError } from "./errors";
```

şununla değişir:

```ts
import { workerDeadlineMsFor } from "./deadline";
import { DeferError, RetryableError } from "./errors";
```

ve tip içe aktarım listesine `AgentWorkerOutput` eklenir:

```ts
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  ApifyFinalizePayload,
  EventKind,
  MemoryHit,
  MemorySpec,
  MemoryWrite,
} from "./types";
```

(b) İmza:

```ts
export async function executeAgentRun(
  runId: string,
  opts?: { isRetry?: boolean; canDefer?: boolean },
): Promise<void> {
```

(c) `const ctx = await hydrateContext(run);` satırının hemen altına:

```ts
    // Long-running workers (site capture) stop on this signal and may ask to
    // be deferred instead of waiting for capacity inside a queue slot.
    const abort = new AbortController();
    const runInputs = (run.inputsJson ?? {}) as Record<string, unknown>;
    ctx.signal = abort.signal;
    ctx.canDefer = opts?.canDefer === true;
    ctx.deferCount = typeof runInputs.deferCount === "number" ? runInputs.deferCount : 0;
    ctx.queuedAt = run.createdAt;
```

(d) Dış sınır bloğu. Şu satırlar:

```ts
    const workerDeadlineMs = Math.min(
      (workerMeta?.estimatedDurationMs ?? 60_000) * 3,
      180_000,
    );
    const deadlinePromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new RetryableError(
              `worker_deadline_exceeded: ${run.workerKind} exceeded ${workerDeadlineMs}ms outer deadline`,
            ),
          ),
        workerDeadlineMs,
      ),
    );
    const result = await Promise.race([runWorker(run.workerKind, ctx), deadlinePromise]);
```

şununla değişir (üstteki "Outer deadline: 3× ..." yorumu, ilk cümlesi "Outer deadline: the worker's own `deadlineMs`, or 3× its estimated duration capped at 180 seconds." olacak şekilde güncellenir):

```ts
    const workerDeadlineMs = workerDeadlineMsFor(workerMeta);
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadlinePromise = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => {
        // Stop the work, not just the wait: a worker that honours ctx.signal
        // closes its browser pages and frees its capture slot here, so the
        // retry does not run on top of a still-running first attempt.
        abort.abort();
        reject(
          new RetryableError(
            `worker_deadline_exceeded: ${run.workerKind} exceeded ${workerDeadlineMs}ms outer deadline`,
          ),
        );
      }, workerDeadlineMs);
    });
    let result: AgentWorkerOutput;
    try {
      result = await Promise.race([runWorker(run.workerKind, ctx), deadlinePromise]);
    } finally {
      clearTimeout(deadlineTimer);
    }
```

(e) `catch (err)` bloğunda `if (err instanceof RetryableError) {` satırının hemen üstüne:

```ts
    if (err instanceof DeferError) {
      // Not a failure: the worker had no capacity. Back to PENDING so the
      // run reads as queued; the queue worker re-queues the job after
      // err.delayMs. No orchestrator notify (the step is not terminal) and
      // no telemetry (nothing ran).
      const existingInputs = (run.inputsJson ?? {}) as Record<string, unknown>;
      const deferCount = (typeof existingInputs.deferCount === "number" ? existingInputs.deferCount : 0) + 1;
      await prisma.agentRun.update({
        where: { id: runId, workspaceId: run.workspaceId },
        data: {
          status: "PENDING",
          startedAt: null,
          inputsJson: { ...existingInputs, deferredAt: new Date().toISOString(), deferCount } as never,
        },
      });
      logger.info("agent_run.execute.deferred", { runId, kind: run.workerKind, delayMs: err.delayMs, deferCount });
      throw err;
    }
```

Run: `npx vitest run src/__tests__/agent-workers/execute-defer.test.ts src/__tests__/agent-workers/execute-telemetry.test.ts src/__tests__/agent-workers/execute-apify-quota.test.ts src/__tests__/agent-workers/execute-embedding-degrade.test.ts`
Expected: PASS (yeni testler ve yürütücünün mevcut testleri).

- [ ] **Step 6: Kuyruk worker'ı için başarısız testi yaz**

```ts
// src/__tests__/workers/agent-run-defer.test.ts
/**
 * A run with no capacity is handed back to the queue without holding a
 * worker slot and without spending an attempt.
 */
import { DelayedError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeAgentRun: vi.fn(),
  writebackAfterBriefRun: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../../lib/agent-workers/execute", () => ({ executeAgentRun: mocks.executeAgentRun }));
vi.mock("../../lib/control/telemetry", () => ({ recordChainTelemetry: vi.fn() }));
vi.mock("../../lib/integrations/hubspot/brief-hook", () => ({ writebackAfterBriefRun: mocks.writebackAfterBriefRun }));
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { DeferError } from "../../lib/agent-workers/errors";
import { processJob } from "../../workers/agent-run-worker";

function job(attemptsMade = 0) {
  return { id: "job_1", data: { type: "agent_run", runId: "run_1" }, attemptsMade, opts: {}, moveToDelayed: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeAgentRun.mockResolvedValue(undefined);
});

describe("agent-run worker: deferral", () => {
  it("lets the run defer", async () => {
    await processJob(job() as never, "token_1");
    expect(mocks.executeAgentRun).toHaveBeenCalledWith("run_1", { isRetry: false, canDefer: true });
  });

  it("moves a deferred job to delayed with the worker's token and stops processing it", async () => {
    mocks.executeAgentRun.mockRejectedValue(new DeferError(20_000));
    const j = job();
    const before = Date.now();

    await expect(processJob(j as never, "token_1")).rejects.toBeInstanceOf(DelayedError);

    expect(j.moveToDelayed).toHaveBeenCalledTimes(1);
    const [timestamp, token] = j.moveToDelayed.mock.calls[0];
    expect(timestamp).toBeGreaterThanOrEqual(before + 20_000);
    expect(token).toBe("token_1");
    expect(mocks.writebackAfterBriefRun).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run src/__tests__/workers/agent-run-defer.test.ts`
Expected: FAIL (`canDefer` gönderilmiyor; `DeferError` `UnrecoverableError`'a ya da yeniden denemeye dönüyor).

- [ ] **Step 7: Kuyruk worker'ını değiştir**

`src/workers/agent-run-worker.ts` içinde:

(a) İçe aktarımlar:

```ts
import { Worker, type Job, UnrecoverableError, DelayedError } from "bullmq";
```

```ts
import { DeferError, isRetryable } from "../lib/agent-workers/errors";
```

(b) İmza:

```ts
export async function processJob(job: Job<AgentRunJob>, token?: string) {
```

(c) `agent_run` dalında:

```ts
      await executeAgentRun(runId, { isRetry: job.attemptsMade > 0 });
    } catch (err) {
      if (!isRetryable(err)) {
```

şununla değişir:

```ts
      await executeAgentRun(runId, { isRetry: job.attemptsMade > 0, canDefer: true });
    } catch (err) {
      if (err instanceof DeferError) {
        // No capacity (every site-capture slot is taken). Hand the job back
        // to the queue for later: it does not hold one of the 10 worker
        // slots while it waits and it does not spend an attempt. The run row
        // is already back to PENDING (executeAgentRun did that).
        await job.moveToDelayed(Date.now() + err.delayMs, token);
        throw new DelayedError();
      }
      if (!isRetryable(err)) {
```

(d) `lockDuration` üstündeki yorum ("Must be > the longest possible job duration (180s outer deadline). 240s = 4 min gives 60s buffer.") şununla değişir; değer aynı kalır:

```ts
    // Lock duration: how long BullMQ waits before treating a silent
    // worker as dead. BullMQ renews the lock every lockDuration / 2
    // while the process is alive, so a job may run longer than this
    // (WEBSITE_AUDITOR's deep capture has a 300 s outer deadline); the
    // value bounds how fast a crashed process is detected, not how
    // long a job may take.
    lockDuration: 240_000,
```

(e) `src/__tests__/workers/agent-run-hubspot-writeback.test.ts` içinde hata modülü taklidi artık `DeferError`'ı da taşımalı. Şu satır:

```ts
vi.mock("../../lib/agent-workers/errors", () => ({ isRetryable: () => false }));
```

şununla değişir:

```ts
vi.mock("../../lib/agent-workers/errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/agent-workers/errors")>()),
  isRetryable: () => false,
}));
```

- [ ] **Step 8: Testlerin ve tiplerin geçtiğini gör**

Run: `npx vitest run src/__tests__/workers src/__tests__/agent-workers && npx tsc --noEmit`
Expected: PASS. `tsc` `DelayedError` ya da `moveToDelayed` bulunamadığını söylerse etkin tip yüzeyi `src/types/shims.d.ts` içindeki `declare module "bullmq"` bloğudur; o bloğa şunları ekle ve yeniden çalıştır:

```ts
  export interface Job<T = unknown> {
    attemptsMade: number;
    moveToDelayed(timestamp: number, token?: string): Promise<void>;
  }

  export class DelayedError extends Error {}
```

Kayıt değeri değiştiği için `estimatedDurationMs` bekleyen bir test düşerse (`grep -rn "30000\|30_000" src/__tests__ | grep -i audit`), beklenen değeri `60000` yap.

- [ ] **Step 9: Commit**

```bash
git add src/lib/agent-workers/deadline.ts src/lib/agent-workers/errors.ts src/lib/agent-workers/types.ts src/lib/agent-workers/registry.ts src/lib/agent-workers/execute.ts src/workers/agent-run-worker.ts src/lib/site-capture/slots.ts src/__tests__/agent-workers/execute-defer.test.ts src/__tests__/workers/agent-run-defer.test.ts src/__tests__/workers/agent-run-hubspot-writeback.test.ts src/__tests__/lib/site-capture/slots.test.ts
git commit -m "feat(agent-runs): per-worker outer deadline, abort signal on deadline, and deferral without holding a queue slot"
```

(`shims.d.ts`'e dokunduysan onu da ekle.)

---

### Task 11: Bekçi ve "takıldı" etiketi

**Files:**
- Modify: `src/lib/agent-workers/deadline.ts` (`watchdogVerdict` eklenir)
- Modify: `src/app/api/agent-runs/[id]/route.ts:18-35, 86-93`
- Modify: `src/app/api/leads/[id]/workers/route.ts:177`
- Modify: `src/components/app/ai-workers-panel.tsx:94, 490-497`
- Test: `src/__tests__/agent-workers/watchdog-verdict.test.ts`

**Interfaces:**
- Consumes: `workerDeadlineMsFor` (Task 10), `getWorker` (`@/lib/agent-workers/registry`).
- Produces: `watchdogVerdict(run: { createdAt: Date | string; startedAt: Date | string | null; inputsJson: unknown }, meta: { estimatedDurationMs?: number; deadlineMs?: number } | null | undefined, nowMs?: number): { expired: boolean; limitMs: number; ageMs: number; isAsync: boolean }`

Kural: async-apify koşusu bugünkü gibi `createdAt`'ten 10 dakika. Senkron koşuda sınır, worker `deadlineMs` bildirdiyse `deadlineMs + 60 sn`, bildirmediyse bugünkü 3 dakika; süre `createdAt`, `startedAt` ve `inputsJson.deferredAt`'in en geçinden sayılır. Böylece ertelenen `PENDING` koşu ve yeniden denenen koşu çalışırken öldürülmez; hiç alınmamış bir iş yine 3 dakikada düşer.

- [ ] **Step 1: Başarısız testi yaz**

```ts
// src/__tests__/agent-workers/watchdog-verdict.test.ts
import { describe, expect, it } from "vitest";
import { watchdogVerdict } from "@/lib/agent-workers/deadline";

const T0 = Date.parse("2026-10-04T10:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const AUDITOR = { estimatedDurationMs: 60_000, deadlineMs: 300_000 };
const DEFAULT = { estimatedDurationMs: 30_000 };

describe("watchdogVerdict", () => {
  it("keeps the 3-minute rule for a worker without its own deadline", () => {
    const run = { createdAt: at(0), startedAt: at(0), inputsJson: null };
    expect(watchdogVerdict(run, DEFAULT, T0 + 2 * 60_000).expired).toBe(false);
    expect(watchdogVerdict(run, DEFAULT, T0 + 4 * 60_000)).toMatchObject({ expired: true, limitMs: 180_000, isAsync: false });
  });

  it("gives a worker with a 300 s deadline six minutes", () => {
    const run = { createdAt: at(0), startedAt: at(0), inputsJson: null };
    expect(watchdogVerdict(run, AUDITOR, T0 + 4 * 60_000).expired).toBe(false);
    expect(watchdogVerdict(run, AUDITOR, T0 + 7 * 60_000)).toMatchObject({ expired: true, limitMs: 360_000 });
  });

  it("counts from the last start, not from creation", () => {
    const run = { createdAt: at(0), startedAt: at(10), inputsJson: null };
    expect(watchdogVerdict(run, DEFAULT, T0 + 11 * 60_000).expired).toBe(false);
  });

  it("does not kill a run that was deferred a moment ago", () => {
    const run = { createdAt: at(0), startedAt: null, inputsJson: { deferCount: 4, deferredAt: at(19).toISOString() } };
    expect(watchdogVerdict(run, AUDITOR, T0 + 20 * 60_000).expired).toBe(false);
  });

  it("still fails a job that was never picked up", () => {
    const run = { createdAt: at(0), startedAt: null, inputsJson: {} };
    expect(watchdogVerdict(run, DEFAULT, T0 + 4 * 60_000).expired).toBe(true);
  });

  it("keeps ten minutes from creation for async Apify runs", () => {
    const run = { createdAt: at(0), startedAt: at(0), inputsJson: { mode: "async-apify", apifyRunId: "abc" } };
    expect(watchdogVerdict(run, DEFAULT, T0 + 9 * 60_000)).toMatchObject({ expired: false, isAsync: true, limitMs: 600_000 });
    expect(watchdogVerdict(run, DEFAULT, T0 + 11 * 60_000).expired).toBe(true);
  });

  it("accepts ISO strings for the timestamps", () => {
    const run = { createdAt: at(0).toISOString(), startedAt: at(0).toISOString(), inputsJson: null };
    expect(watchdogVerdict(run, DEFAULT, T0 + 4 * 60_000).expired).toBe(true);
  });
});
```

Run: `npx vitest run src/__tests__/agent-workers/watchdog-verdict.test.ts`
Expected: FAIL, `watchdogVerdict is not a function`.

- [ ] **Step 2: `watchdogVerdict`'i yaz**

`src/lib/agent-workers/deadline.ts` dosyasının sonuna ekle:

```ts
const SYNC_WATCHDOG_MS = 3 * 60_000;
const ASYNC_WATCHDOG_MS = 10 * 60_000;
const DEADLINE_GRACE_MS = 60_000;

function ms(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Lazy watchdog verdict for a PENDING / RUNNING run (GET /api/agent-runs/[id]).
 * Async Apify runs: ten minutes from creation (a webhook is expected).
 * Sync runs: the worker's own deadline plus a minute when it declares one,
 * otherwise three minutes, counted from the latest of creation, start and
 * deferral, so a run that is waiting for capacity or being retried is not
 * declared dead while it is alive.
 */
export function watchdogVerdict(
  run: { createdAt: Date | string; startedAt: Date | string | null; inputsJson: unknown },
  meta: { estimatedDurationMs?: number; deadlineMs?: number } | null | undefined,
  nowMs: number = Date.now(),
): { expired: boolean; limitMs: number; ageMs: number; isAsync: boolean } {
  const inputs =
    run.inputsJson && typeof run.inputsJson === "object" && !Array.isArray(run.inputsJson)
      ? (run.inputsJson as Record<string, unknown>)
      : {};
  const isAsync = inputs.mode === "async-apify" && typeof inputs.apifyRunId === "string";
  if (isAsync) {
    const ageMs = nowMs - ms(run.createdAt);
    return { expired: ageMs > ASYNC_WATCHDOG_MS, limitMs: ASYNC_WATCHDOG_MS, ageMs, isAsync };
  }
  const limitMs = meta?.deadlineMs && meta.deadlineMs > 0 ? meta.deadlineMs + DEADLINE_GRACE_MS : SYNC_WATCHDOG_MS;
  const deferredAt = typeof inputs.deferredAt === "string" ? inputs.deferredAt : null;
  const base = Math.max(ms(run.createdAt), ms(run.startedAt), ms(deferredAt));
  const ageMs = nowMs - base;
  return { expired: ageMs > limitMs, limitMs, ageMs, isAsync };
}
```

Run: `npx vitest run src/__tests__/agent-workers/watchdog-verdict.test.ts`
Expected: PASS.

- [ ] **Step 3: Rotayı yeni karara bağla**

`src/app/api/agent-runs/[id]/route.ts` içinde:

(a) İçe aktarımlara ekle:

```ts
import { watchdogVerdict } from "@/lib/agent-workers/deadline";
import { getWorker } from "@/lib/agent-workers/registry";
```

(b) Dosyadaki yerel `isAsyncRun` fonksiyonunu (üstündeki yorum bloğuyla birlikte) sil; `Prisma` tipi başka yerde kullanılmıyorsa `import type { Prisma } from "@/generated/prisma/client";` satırını da sil.

(c) Şu blok:

```ts
    if (run.status === "PENDING" || run.status === "RUNNING") {
      const ageMs = Date.now() - new Date(run.createdAt).getTime();
      const isAsync = isAsyncRun(run.inputsJson);
      const deadlineMs = isAsync ? 10 * 60 * 1000 : 3 * 60 * 1000;
      if (ageMs > deadlineMs) {
        const errorMsg = isAsync
          ? "watchdog: async Apify run exceeded 10-minute deadline without webhook callback"
          : "watchdog: run exceeded 3-minute deadline without completing";
```

şununla değişir (devamındaki `prisma.agentRun.update(...)` ve log aynı kalır; `ageMs`, `isAsync`, `deadlineMs` adları korunur):

```ts
    if (run.status === "PENDING" || run.status === "RUNNING") {
      // Sync runs get the worker's own deadline (+60 s) when it declares one,
      // counted from the latest of creation, start and deferral; see
      // watchdogVerdict. WEBSITE_AUDITOR's deep capture runs up to 300 s and
      // may wait for a capture slot before it starts.
      const verdict = watchdogVerdict(run, getWorker(run.workerKind));
      const { ageMs, isAsync } = verdict;
      const deadlineMs = verdict.limitMs;
      if (verdict.expired) {
        const errorMsg = isAsync
          ? "watchdog: async Apify run exceeded 10-minute deadline without webhook callback"
          : `watchdog: run exceeded ${Math.round(deadlineMs / 60_000)}-minute deadline without completing`;
```

Bloğun üstündeki uzun yorumda "3 minutes is a comfortable ceiling" cümlesinin sonuna şu cümleyi ekle: `Workers that declare deadlineMs in the registry get that deadline plus one minute instead.`

- [ ] **Step 4: Arayüzdeki "takıldı" eşiğini bağla**

`src/app/api/leads/[id]/workers/route.ts` içinde `estimatedDurationMs: w.estimatedDurationMs,` satırının altına:

```ts
        deadlineMs: w.deadlineMs ?? null,
```

`src/components/app/ai-workers-panel.tsx` içinde `WorkerItem` arayüzünde `estimatedDurationMs: number;` satırının altına:

```ts
  /** Outer deadline when the worker declares one (deep site audit); otherwise null. */
  deadlineMs?: number | null;
```

ve şu satırlar:

```ts
  // A run is considered "stuck" if it's been inflight past 2x its
  // estimated duration (server auto-cancels at 3 minutes). In that
  // window the UI surfaces a "Force retry" button so the user can
  // bypass the disable without waiting for the server timeout.
  const ageMs = latest && pendingStatus
    ? now - new Date(latest.createdAt).getTime()
    : 0;
  const stuck = pendingStatus && ageMs > Math.max(worker.estimatedDurationMs * 2, 60_000);
```

şununla değişir:

```ts
  // A run is considered "stuck" if it's been inflight past its own
  // deadline when the worker declares one (the deep site audit runs up
  // to 5 minutes), otherwise past 2x its estimated duration (the server
  // auto-cancels those at 3 minutes). In that window the UI surfaces a
  // "Force retry" button so the user can bypass the disable without
  // waiting for the server timeout.
  const ageMs = latest && pendingStatus
    ? now - new Date(latest.createdAt).getTime()
    : 0;
  const stuckAfterMs = worker.deadlineMs ?? Math.max(worker.estimatedDurationMs * 2, 60_000);
  const stuck = pendingStatus && ageMs > stuckAfterMs;
```

Bilinen sınır: panel yaşı `createdAt`'ten sayar; toplu keşifte slot bekleyen bir denetim 5 dakikadan sonra panelde "takıldı" görünebilir. Sunucu koşuyu öldürmez; bu yalnızca etiket. Düzeltmesi (yanıta `startedAt` / `deferredAt` taşımak) bu planın dışında.

- [ ] **Step 5: Testlerin ve tiplerin geçtiğini gör**

Run: `npx vitest run src/__tests__/agent-workers src/__tests__/api && npx tsc --noEmit`
Expected: PASS. Eski bekçi mesajını ("3-minute deadline") bekleyen bir test varsa mesaj 180 sn'lik sınırda aynı kaldığı için geçer.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent-workers/deadline.ts "src/app/api/agent-runs/[id]/route.ts" "src/app/api/leads/[id]/workers/route.ts" src/components/app/ai-workers-panel.tsx src/__tests__/agent-workers/watchdog-verdict.test.ts
git commit -m "fix(agent-runs): the lazy watchdog and the stuck label respect a worker's own deadline and deferrals"
```

---

### Task 12: `WEBSITE_AUDITOR` bağlantısı

**Files:**
- Modify: `src/lib/agent-workers/website-auditor.ts`
- Modify: `src/__tests__/agent-workers/website-auditor.test.ts` (sığ yolu sabitlemek için kapatma anahtarı)
- Test: `src/__tests__/agent-workers/website-auditor-deep.test.ts`

**Interfaces:**
- Consumes: `crawlWebsiteDeep` (Task 8, tembel içe aktarım), `saveSiteCapture` (Task 9), `tryAcquireCaptureSlot`, `deferDelayMs`, `MAX_DEFER_WAIT_MS`, `deepCaptureEnabled` (Task 10), `DeferError` (Task 10), `ctx.signal` / `ctx.canDefer` / `ctx.deferCount` / `ctx.queuedAt` (Task 10), `detectSocialMediaPlatform` (`@/lib/audit/social-url-gate`).
- Produces: `run` davranışı:
  - Slot yok, `ctx.canDefer` doğru ve bekleme 30 dakikanın altında → hiçbir şey yazmadan `DeferError`.
  - Slot yok ve erteleme mümkün değil, ya da `SITE_CAPTURE_DEEP=0` → bugünkü `crawlWebsite`.
  - Slot var → `crawlWebsiteDeep(url, type, { signal })`, sonra `saveSiteCapture`; slot her durumda bırakılır.
  - Çıktıya `coverage` eklenir.

- [ ] **Step 1: Mevcut testi sığ yola sabitle**

`src/__tests__/agent-workers/website-auditor.test.ts` içindeki `beforeEach` bloğunun başına bir satır ekle ve dosyanın sonuna bir `afterAll` koy (`afterAll`'u `vitest` içe aktarımına ekle). Bu dosya bugünkü sığ davranışı test etmeye devam eder:

```ts
beforeEach(() => {
  // This file pins the shallow path; the deep path has its own test file.
  process.env.SITE_CAPTURE_DEEP = "0";
  crawlWebsiteMock.mockReset();
  prismaMock.lead.update.mockReset().mockResolvedValue({});
  prismaMock.websiteAudit.upsert.mockReset().mockResolvedValue({});
});
```

```ts
afterAll(() => {
  delete process.env.SITE_CAPTURE_DEEP;
});
```

- [ ] **Step 2: Derin yol için başarısız testi yaz**

```ts
// src/__tests__/agent-workers/website-auditor-deep.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";
import type { SiteCaptureResult } from "@/lib/site-capture/types";
import type { WebsiteFeatures } from "@/types";

const mocks = vi.hoisted(() => ({
  crawlWebsite: vi.fn(),
  crawlWebsiteDeep: vi.fn(),
  saveSiteCapture: vi.fn(),
  leadUpdate: vi.fn(),
  auditUpsert: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/crawler", () => ({ crawlWebsite: mocks.crawlWebsite }));
vi.mock("@/lib/site-capture/deep", () => ({ crawlWebsiteDeep: mocks.crawlWebsiteDeep }));
vi.mock("@/lib/site-capture/store", () => ({ saveSiteCapture: mocks.saveSiteCapture }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { update: mocks.leadUpdate, updateMany: vi.fn() }, websiteAudit: { upsert: mocks.auditUpsert } },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: mocks.warn, error: vi.fn(), debug: vi.fn() } }));

import { DeferError } from "@/lib/agent-workers/errors";
import { run } from "@/lib/agent-workers/website-auditor";
import { tryAcquireCaptureSlot } from "@/lib/site-capture/slots";

const URL_ = "https://acme.example";
const COVERAGE = { status: "complete", opened: 6, skipped: 1, failed: 0, durationMs: 21_000, notOpened: [] };

function features(overrides: Record<string, unknown> = {}): WebsiteFeatures {
  return {
    url: URL_,
    reachable: true,
    crawlError: null,
    httpStatus: 200,
    loadTimeMs: 900,
    https: true,
    mobileFriendlyGuess: true,
    title: "Acme",
    metaDescription: null,
    h1: null,
    hasContactForm: true,
    hasWhatsappLink: false,
    hasBookingSystem: false,
    hasEcommerce: false,
    servicesDetected: [],
    navItems: [],
    ctaLinks: [],
    brokenLinksCount: 0,
    structuredDataPresent: false,
    siteFacts: { coverage: COVERAGE },
    ...overrides,
  } as unknown as WebsiteFeatures;
}

const CAPTURE: SiteCaptureResult = {
  rootUrl: URL_,
  status: "complete",
  startedAt: "2026-10-04T10:00:00.000Z",
  durationMs: 21_000,
  pages: [],
  ledger: [],
  sitemapUrlCount: 0,
};

function ctx(overrides: Partial<AgentWorkerContext> = {}, leadOverrides: Record<string, unknown> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: {
      id: "lead_1",
      workspaceId: "ws_1",
      businessName: "Acme",
      formattedAddress: "1 Main St",
      primaryType: null,
      websiteUrl: URL_,
      websiteAudit: null,
      salesOpportunity: null,
      reviewAnalysis: null,
      ...leadOverrides,
    },
    workspace: { id: "ws_1", name: "Test", slug: "test", plan: "PRO" },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AgentWorkerContext;
}

/** Takes every free capture slot; returns a function that gives them back. */
function occupyAllSlots(): () => void {
  const held: Array<() => void> = [];
  for (let r = tryAcquireCaptureSlot(); r; r = tryAcquireCaptureSlot()) held.push(r);
  return () => held.forEach((release) => release());
}
function freeSlots(): number {
  const held: Array<() => void> = [];
  for (let r = tryAcquireCaptureSlot(); r; r = tryAcquireCaptureSlot()) held.push(r);
  held.forEach((release) => release());
  return held.length;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SITE_CAPTURE_DEEP;
  mocks.leadUpdate.mockResolvedValue({});
  mocks.auditUpsert.mockResolvedValue({});
  mocks.saveSiteCapture.mockResolvedValue(undefined);
  mocks.crawlWebsite.mockResolvedValue(features({ siteFacts: undefined }));
  mocks.crawlWebsiteDeep.mockResolvedValue({ features: features(), capture: CAPTURE });
});

afterEach(() => {
  delete process.env.SITE_CAPTURE_DEEP;
});

describe("WEBSITE_AUDITOR: deep capture", () => {
  it("runs the deep crawl with the run's abort signal and stores the capture under the lead's workspace", async () => {
    const signal = new AbortController().signal;
    const result = await run(ctx({ signal }));

    expect(mocks.crawlWebsiteDeep).toHaveBeenCalledWith(URL_, undefined, { signal });
    expect(mocks.crawlWebsite).not.toHaveBeenCalled();
    expect(mocks.saveSiteCapture).toHaveBeenCalledWith({ workspaceId: "ws_1", leadId: "lead_1", capture: CAPTURE });
    expect(mocks.auditUpsert).toHaveBeenCalledTimes(1);
    expect(result.output).toMatchObject({ reachable: true, coverage: COVERAGE });
    expect(freeSlots()).toBe(2);
  });

  it("defers without writing anything when every capture slot is taken", async () => {
    const release = occupyAllSlots();
    try {
      const attempt = run(ctx({ canDefer: true, deferCount: 1, queuedAt: new Date() }));
      await expect(attempt).rejects.toBeInstanceOf(DeferError);
      await attempt.catch((err: DeferError) => {
        expect(err.delayMs).toBeGreaterThanOrEqual(40_000);
        expect(err.delayMs).toBeLessThan(45_000);
      });
      expect(mocks.leadUpdate).not.toHaveBeenCalled();
      expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
      expect(mocks.crawlWebsite).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });

  it("falls back to the shallow crawl once the run has waited thirty minutes", async () => {
    const release = occupyAllSlots();
    try {
      const queuedAt = new Date(Date.now() - 31 * 60_000);
      const result = await run(ctx({ canDefer: true, deferCount: 9, queuedAt }));
      expect(mocks.crawlWebsite).toHaveBeenCalledWith(URL_, undefined);
      expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
      expect(mocks.saveSiteCapture).not.toHaveBeenCalled();
      expect(result.output).toMatchObject({ reachable: true });
      expect(mocks.warn).toHaveBeenCalledWith("agent_workers.website_auditor.deep_skipped_capacity", expect.any(Object));
    } finally {
      release();
    }
  });

  it("runs shallow instead of deferring on the inline path", async () => {
    const release = occupyAllSlots();
    try {
      await run(ctx({ canDefer: false }));
      expect(mocks.crawlWebsite).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
  });

  it("honours the kill switch", async () => {
    process.env.SITE_CAPTURE_DEEP = "0";
    await run(ctx());
    expect(mocks.crawlWebsite).toHaveBeenCalledTimes(1);
    expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
  });

  it("does not take a slot for a social profile", async () => {
    mocks.crawlWebsite.mockResolvedValue(features({ reachable: false, crawlError: "SOCIAL_MEDIA_ONLY", siteFacts: undefined }));
    await run(ctx({}, { websiteUrl: "https://www.instagram.com/acme" }));
    expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
    expect(mocks.crawlWebsite).toHaveBeenCalledTimes(1);
  });

  // Review Focus 4: a failed or aborted capture must give its slot back.
  it("frees the slot when the deep crawl throws", async () => {
    mocks.crawlWebsiteDeep.mockRejectedValue(new Error("browser crashed"));
    const result = await run(ctx());
    expect(result.output).toMatchObject({ skipped: true, reason: "crawl_failed" });
    expect(freeSlots()).toBe(2);
  });

  it("writes nothing after the executor's deadline aborted the run", async () => {
    const controller = new AbortController();
    mocks.crawlWebsiteDeep.mockImplementation(async () => {
      controller.abort();
      return { features: features(), capture: { ...CAPTURE, status: "partial" } };
    });
    const result = await run(ctx({ signal: controller.signal }));
    expect(result.output).toEqual({ skipped: true, reason: "deadline_aborted" });
    expect(mocks.auditUpsert).not.toHaveBeenCalled();
    expect(mocks.saveSiteCapture).not.toHaveBeenCalled();
    expect(mocks.leadUpdate).toHaveBeenCalledTimes(1); // only the CRAWLING stamp before the crawl
    expect(freeSlots()).toBe(2);
  });

  it("keeps the audit when storing the capture fails", async () => {
    mocks.saveSiteCapture.mockRejectedValue(new Error("db down"));
    const result = await run(ctx());
    expect(mocks.auditUpsert).toHaveBeenCalledTimes(1);
    expect(result.output).toMatchObject({ reachable: true });
    expect(mocks.warn).toHaveBeenCalledWith("agent_workers.website_auditor.capture_save_failed", expect.any(Object));
  });
});
```

Run: `npx vitest run src/__tests__/agent-workers/website-auditor-deep.test.ts`
Expected: FAIL (derin yol henüz yok: `crawlWebsiteDeep` hiç çağrılmıyor).

- [ ] **Step 3: Worker'ı bağla**

`src/lib/agent-workers/website-auditor.ts` içinde:

(a) İçe aktarımlara ekle:

```ts
import { detectSocialMediaPlatform } from "@/lib/audit/social-url-gate";
import { saveSiteCapture } from "@/lib/site-capture/store";
import {
  deepCaptureEnabled,
  deferDelayMs,
  MAX_DEFER_WAIT_MS,
  tryAcquireCaptureSlot,
} from "@/lib/site-capture/slots";
import type { SiteCaptureResult } from "@/lib/site-capture/types";
import type { WebsiteFeatures } from "@/types";
import { DeferError } from "./errors";
```

ve `./types` içe aktarımına `AgentWorkerContext` ekle (yoksa).

(b) Bugünkü `export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {` fonksiyonunu `runAudit` adlı iç fonksiyona çevir ve yeni bir `run` yaz. Bugünkü gövde `runAudit`'e taşınır; ilk iki satırı (`if (!ctx.lead) throw ...` ve `const lead = ctx.lead;`) orada da kalır:

```ts
export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("WEBSITE_AUDITOR requires a lead context");
  const lead = ctx.lead;

  // The deep capture needs one of this process's capture slots. Decide
  // before any write, so a deferred run leaves no trace behind (no
  // CRAWLING status, no verification spend).
  const wantsDeep =
    typeof lead.websiteUrl === "string" &&
    lead.websiteUrl.length > 0 &&
    deepCaptureEnabled() &&
    !detectSocialMediaPlatform(lead.websiteUrl);
  let releaseSlot: (() => void) | null = null;
  if (wantsDeep) {
    releaseSlot = tryAcquireCaptureSlot();
    if (!releaseSlot) {
      const waitedMs = ctx.queuedAt ? Date.now() - ctx.queuedAt.getTime() : 0;
      if (ctx.canDefer && waitedMs < MAX_DEFER_WAIT_MS) {
        throw new DeferError(deferDelayMs(ctx.deferCount ?? 0));
      }
      // Inline execution, or the run has waited long enough: finish with
      // today's shallow audit so the chain moves on.
      logger.warn("agent_workers.website_auditor.deep_skipped_capacity", { leadId: lead.id, waitedMs });
    }
  }

  try {
    return await runAudit(ctx, releaseSlot !== null);
  } finally {
    releaseSlot?.();
  }
};

async function runAudit(ctx: AgentWorkerContext, deep: boolean): Promise<AgentWorkerOutput> {
  if (!ctx.lead) throw new Error("WEBSITE_AUDITOR requires a lead context");
  const lead = ctx.lead;
  // ... the existing body of `run`, with the three changes below.
}
```

(c) `runAudit` içinde şu satır:

```ts
    const features = await crawlWebsite(lead.websiteUrl, lead.primaryType ?? undefined);
```

şununla değişir:

```ts
    let features: WebsiteFeatures;
    let capture: SiteCaptureResult | null = null;
    if (deep) {
      // Lazy: the deep path pulls in the capture modules only when it runs.
      const { crawlWebsiteDeep } = await import("@/lib/site-capture/deep");
      const crawled = await crawlWebsiteDeep(lead.websiteUrl, lead.primaryType ?? undefined, { signal: ctx.signal });
      features = crawled.features;
      capture = crawled.capture;
    } else {
      features = await crawlWebsite(lead.websiteUrl, lead.primaryType ?? undefined);
    }
    if (ctx.signal?.aborted) {
      // The executor's outer deadline fired and a retry owns this lead now.
      // Writing a late result (or a late FAILED status) would race it.
      return { output: { skipped: true, reason: "deadline_aborted" }, costTokens: 0 };
    }
```

(d) `runAudit` içinde, sosyal profil dalından sonraki olağan yolda, `await prisma.websiteAudit.upsert({ where: { leadId: lead.id }, create: { leadId: lead.id, ...baseFields }, update: baseFields });` çağrısının hemen altına:

```ts
    if (capture) {
      try {
        await saveSiteCapture({ workspaceId: lead.workspaceId, leadId: lead.id, capture });
      } catch (err) {
        // The audit row is the result; the capture record is supporting evidence.
        logger.warn("agent_workers.website_auditor.capture_save_failed", {
          leadId: lead.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
```

(e) `runAudit`'in olağan yoldaki dönüş değerinde, `socialProfiles,` satırının altına:

```ts
        ...(features.siteFacts?.coverage ? { coverage: features.siteFacts.coverage } : {}),
```

(f) `runAudit`'in `catch (error)` bloğunun başına, `await prisma.lead.update({ ... crawlStatus: "FAILED" ... })` çağrısından önce:

```ts
    if (ctx.signal?.aborted) {
      return { output: { skipped: true, reason: "deadline_aborted" }, costTokens: 0 };
    }
```

Dosya başındaki modül yorumuna bir paragraf ekle:

```ts
 * Deep capture: when a capture slot is free the audit goes through
 * `crawlWebsiteDeep` (src/lib/site-capture) and stores a SiteCapture row;
 * with no slot the run is deferred (DeferError) or, on the inline path or
 * after thirty minutes of waiting, finishes with the shallow `crawlWebsite`.
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/__tests__/agent-workers/website-auditor-deep.test.ts src/__tests__/agent-workers/website-auditor.test.ts src/__tests__/agent-workers/website-verification-status.test.ts && npx tsc --noEmit`
Expected: PASS, tip hatası yok.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-workers/website-auditor.ts src/__tests__/agent-workers/website-auditor.test.ts src/__tests__/agent-workers/website-auditor-deep.test.ts
git commit -m "feat(website-auditor): deep capture behind a capture slot, deferred when the process is full"
```

---

### Task 13: Kanıt rafında kapsam ve kapsamlı kapora

**Files:**
- Modify: `src/lib/control/evidence-shelf.ts:37-47, 180-194, 313-318, 531-548`
- Test: `src/__tests__/control/evidence-shelf.test.ts` (eklemeler)

**Interfaces:**
- Consumes: `rawFeaturesJson.siteFacts.coverage` (`SiteCoverage`, Task 1) ve `rawFeaturesJson.siteFacts.hasPrepayment` (`SiteFact<true>`, Task 7). Raf saf kalır: `site-capture` modüllerini içe aktarmaz, alanları `unknown`'dan okur.
- Produces: `ShelfAudit.coverage?`, `ShelfAudit.prepayment?`; Site çekmecesinde iki yeni satır (yalnızca veri varsa).

- [ ] **Step 1: Başarısız testleri ekle**

`src/__tests__/control/evidence-shelf.test.ts` dosyasının sonuna ekle:

```ts
describe("site drawer: capture coverage", () => {
  const auditRow = (siteFacts: Record<string, unknown>) =>
    shelfAuditFromRow({
      url: "https://dishoom.com",
      reachable: true,
      crawlError: null,
      crawlAttemptedAt: new Date(FINISHED),
      hasBookingSystem: true,
      bookingProvider: "SevenRooms",
      rawFeaturesJson: { siteFacts },
    });
  const siteRows = (siteFacts: Record<string, unknown>) =>
    drawer(
      buildShelf(input({ runs: [auditRunWith({ reachable: true, url: "https://dishoom.com" })], audit: auditRow(siteFacts) })),
      "site",
    ).rows;

  it("shows how many pages were read and which were not, with the reason", () => {
    const rows = siteRows({
      coverage: {
        status: "complete",
        opened: 9,
        skipped: 2,
        failed: 1,
        durationMs: 31_000,
        notOpened: [{ url: "https://dishoom.com/faq", type: "faq", reason: "timeout" }],
      },
    });
    const row = rows.find((r) => r.claim.text.startsWith("Kapsam"))!;
    expect(row.claim.text).toBe("Kapsam: 9 sayfa açıldı · 2 atlandı · 1 açılamadı");
    expect(row.support.text).toBe("Okunamayan: /faq (zaman aşımı)");
    expect(row.conflict).toBeNull();
  });

  it("warns when the capture ran out of budget", () => {
    const rows = siteRows({
      coverage: { status: "partial", opened: 12, skipped: 20, failed: 0, durationMs: 150_000, notOpened: [{ url: "https://dishoom.com/group-feasts", type: "events", reason: "budget" }] },
    });
    const row = rows.find((r) => r.claim.text.startsWith("Kapsam"))!;
    expect(row.support.text).toContain("/group-feasts (süre yetmedi)");
    expect(row.conflict).toBe("Yakalama süre bütçesinde bitmedi; okunmayan sayfalar var.");
  });

  it("says so when every discovered page was read", () => {
    const rows = siteRows({ coverage: { status: "complete", opened: 5, skipped: 0, failed: 0, durationMs: 9_000, notOpened: [] } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapsam"))!.support.text).toBe("Keşfedilen her sayfa okundu");
  });

  it("states a group-only deposit as group-only, with its source", () => {
    const rows = siteRows({
      hasPrepayment: { value: true, url: "https://dishoom.com/group-feasts", quote: "For groups of 8 or more, we ask for card details", scope: "group_or_event" },
    });
    const row = rows.find((r) => r.claim.text.startsWith("Kapora"))!;
    expect(row.claim.text).toBe("Kapora: yalnızca grup / etkinlik için");
    expect(row.support.text).toContain("https://dishoom.com/group-feasts");
    expect(row.support.text).toContain("For groups of 8 or more");
  });

  it("states a general deposit plainly", () => {
    const rows = siteRows({ hasPrepayment: { value: true, url: "https://dishoom.com/reservations", quote: "A deposit is required" } });
    expect(rows.find((r) => r.claim.text.startsWith("Kapora"))!.claim.text).toBe("Kapora var");
  });

  it("adds no rows for an audit without capture data", () => {
    expect(siteRows({})).toHaveLength(3);
  });
});
```

Run: `npx vitest run src/__tests__/control/evidence-shelf.test.ts`
Expected: yeni testler FAIL (`Kapsam` / `Kapora` satırı yok), eskiler PASS.

- [ ] **Step 2: Rafı genişlet**

`src/lib/control/evidence-shelf.ts` içinde:

(a) `ShelfAudit` tipine iki alan ekle (`hasOnlineOrdering?: boolean | null;` satırının altına):

```ts
  /** Deep-capture coverage (absent on shallow audits and on rows written before the capture). */
  coverage?: {
    status: string;
    opened: number;
    skipped: number;
    failed: number;
    notOpened: Array<{ url: string; type: string; reason: string }>;
  } | null;
  /** Prepayment fact with its scope ("group_or_event" = only for groups / private events). */
  prepayment?: { scope: string | null; url: string; quote: string | null } | null;
```

(b) `crawlErrorText` fonksiyonunun altına:

```ts
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
```

(c) `siteDrawer` içinde `const rows = [ ... ];` bildiriminden sonra, `return` satırından önce:

```ts
  if (audit?.prepayment) {
    const scoped = audit.prepayment.scope === "group_or_event";
    rows.push(row(
      cell(scoped ? "Kapora: yalnızca grup / etkinlik için" : "Kapora var"),
      cell(`${audit.prepayment.url}${audit.prepayment.quote ? ` · “${clean(audit.prepayment.quote)}”` : ""}`),
    ));
  }
  if (audit?.coverage) {
    const c = audit.coverage;
    const unread = c.notOpened.slice(0, 4).map(n => `${pathLabel(n.url)} (${coverageReasonText(n.reason)})`).join(" · ");
    const conflict = c.status === "partial" ? "Yakalama süre bütçesinde bitmedi; okunmayan sayfalar var."
      : c.status === "blocked" ? "Site botu engelledi; sayfalar okunamadı."
      : null;
    rows.push(row(
      cell(`Kapsam: ${c.opened} sayfa açıldı · ${c.skipped} atlandı · ${c.failed} açılamadı`),
      cell(unread ? `Okunamayan: ${unread}` : "Keşfedilen her sayfa okundu", !unread),
      conflict,
    ));
  }
```

(d) `shelfAuditFromRow` içinde `const tri = ...` satırının altına:

```ts
  const facts = object(raw.siteFacts);
  const cov = object(facts.coverage);
  const pre = object(facts.hasPrepayment);
  const preUrl = textOf(pre.url);
```

ve dönen nesneye `hasOnlineOrdering: tri(raw.hasOnlineOrdering),` satırının altına:

```ts
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
```

- [ ] **Step 3: Testlerin geçtiğini gör**

Run: `npx vitest run src/__tests__/control && npx tsc --noEmit`
Expected: PASS. Mevcut bir test Site çekmecesinin satır listesini birebir karşılaştırıyorsa etkilenmez: yeni satırlar yalnızca `coverage` / `hasPrepayment` verisi varken eklenir.

- [ ] **Step 4: Commit**

```bash
git add src/lib/control/evidence-shelf.ts src/__tests__/control/evidence-shelf.test.ts
git commit -m "feat(control): the site drawer shows capture coverage and the scope of a deposit"
```

---

### Task 14: Ölçüm düzeneği, canlı ölçüm, insan testi paketi

**Files:**
- Modify: `scripts/website-audit-eval/run-eval.ts`
- Modify: `scripts/website-audit-eval/score.ts`
- Create: `scripts/website-audit-eval/capture-url.ts`
- Create: `scripts/website-audit-eval/pick-holdout.ts`
- Create: `scripts/website-audit-eval/human-sheet.ts`
- Create: `scripts/website-audit-eval/sites-holdout.json` (çalıştırınca üretilir)
- Create: `docs/research/2026-10-04-site-capture-eval.md` (ölçüm sonucu)
- Create: `docs/research/2026-10-04-site-yakalama-insan-testi.md` (insan testi yönergesi)

**Interfaces:**
- Consumes: `crawlWebsiteDeep`, `closeBrowser`, `buildRoomOneAudit`, `summarizeLedger`.
- Produces: komut satırı araçları (aşağıda), ölçüm notu ve insan testi kağıdı.

Ölçüm çıktıları `tmp/site-capture-eval/` altına yazılır ve **commit edilmez**.

- [ ] **Step 1: `run-eval.ts`'e derin modu ve site dosyası seçimini ekle**

`scripts/website-audit-eval/run-eval.ts` içinde:

(a) İçe aktarımlara ekle:

```ts
import { crawlWebsiteDeep } from "@/lib/site-capture/deep";
import type { SiteCaptureResult } from "@/lib/site-capture/types";
```

(b) Dosya başındaki kullanım satırını güncelle:

```ts
 *   npx tsx scripts/website-audit-eval/run-eval.ts <outDir> [--deep] [--sites sites-holdout.json] [--snapshot] [--only id1,id2] [--resume]
 *
 * --deep runs crawlWebsiteDeep (site capture) instead of crawlWebsite and
 * keeps the coverage ledger of every site next to its facts.
```

(c) `main` içinde `const doSnap = ...` satırının altına:

```ts
  const deep = process.argv.includes("--deep");
  const sitesAt = process.argv.indexOf("--sites");
  const sitesFile = sitesAt > 0 ? process.argv[sitesAt + 1] : "sites.json";
```

ve `const sites: Site[] = JSON.parse(readFileSync(path.join(__dirname, "sites.json"), "utf8"));` satırını şununla değiştir:

```ts
  const sites: Site[] = JSON.parse(readFileSync(path.join(__dirname, sitesFile), "utf8"));
```

(d) Döngüde `const f = await crawlWebsite(site.url, "restaurant");` satırını şununla değiştir:

```ts
    let capture: SiteCaptureResult | null = null;
    let f: Awaited<ReturnType<typeof crawlWebsite>>;
    if (deep) {
      const crawled = await crawlWebsiteDeep(site.url, "restaurant");
      f = crawled.features;
      capture = crawled.capture;
    } else {
      f = await crawlWebsite(site.url, "restaurant");
    }
```

ve `results[site.id] = { ... }` nesnesine `ms: Date.now() - t0,` satırının altına:

```ts
      // Deep runs only: what was opened and what was not (no page text).
      capture: capture
        ? {
            status: capture.status,
            sitemapUrlCount: capture.sitemapUrlCount,
            ledger: capture.ledger,
            pages: capture.pages.map((p) => ({
              url: p.url,
              finalUrl: p.finalUrl,
              type: p.type,
              source: p.source,
              needsOcr: p.needsOcr,
              thirdPartyRequests: p.thirdPartyRequests,
            })),
          }
        : null,
```

- [ ] **Step 2: `score.ts`'e kapsamdan bağımsız kapora sütununu, karşılaştırmayı ve süreyi ekle**

`scripts/website-audit-eval/score.ts` içinde:

(a) `scoreSite` içinde `v.prepayment = tri(audit.hasPrepayment, t.prepayment);` satırının altına:

```ts
  // Any scope: Room 1 only asserts a general deposit, but a deposit that is
  // found with its group scope and evidence still counts as found.
  const anyPrepayment = sf != null && sf.hasPrepayment != null;
  v.prepaymentAny = t.prepayment === null ? "na" : !anyPrepayment ? "unknown" : t.prepayment ? "correct" : "wrong";
```

(b) `main` içindeki `fields` listesinde `"prepayment",` satırının altına `"prepaymentAny",` ekle ve "missed" hesabındaki şu satırı:

```ts
        const tv = (t as unknown as Record<string, unknown>)[f === "directOrdering" ? "directOrdering" : f];
```

şununla değiştir:

```ts
        const tv = (t as unknown as Record<string, unknown>)[f === "prepaymentAny" ? "prepayment" : f];
```

(c) `main`'in sonuna (`--rows` bloğundan sonra) ekle:

```ts
  const times = Object.values(results)
    .map((r) => r.ms)
    .filter((x): x is number => typeof x === "number")
    .sort((a, b) => a - b);
  if (times.length > 0) {
    const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
    console.log(`\ntime per site: median ${Math.round(at(0.5) / 1000)} s, p95 ${Math.round(at(0.95) / 1000)} s (n=${times.length})`);
  }

  // --compare <before.json>: what got worse. Exit code 1 when anything did.
  const compareAt = process.argv.indexOf("--compare");
  if (compareAt > 0) {
    const before = JSON.parse(readFileSync(process.argv[compareAt + 1], "utf8")) as Record<string, Record<string, unknown>>;
    const regressions: string[] = [];
    const newWrong: string[] = [];
    let missedBefore = 0;
    let missedAfter = 0;
    for (const [id, t] of Object.entries(truth)) {
      if (!results[id] || !before[id]) continue;
      const a = scoreSite(before[id], t);
      const b = scoreSite(results[id], t);
      for (const f of fields) {
        if (a[f] === "correct" && b[f] !== "correct") regressions.push(`${id}.${f}: correct -> ${b[f] ?? "na"}`);
        if (a[f] !== "wrong" && b[f] === "wrong") newWrong.push(`${id}.${f}: ${a[f] ?? "na"} -> wrong`);
        if (a[f] === "unknown") missedBefore++;
        if (b[f] === "unknown") missedAfter++;
      }
    }
    console.log(`\ncompare: ${regressions.length} regression(s), ${newWrong.length} new wrong answer(s), unknown cells ${missedBefore} -> ${missedAfter}`);
    for (const line of [...regressions, ...newWrong]) console.log(`  ${line}`);
    if (regressions.length > 0 || newWrong.length > 0) process.exitCode = 1;
  }
```

- [ ] **Step 3: Tek adres aracı yaz**

```ts
// scripts/website-audit-eval/capture-url.ts
/**
 * Deep-capture one site and print what was opened, what was not, and the
 * facts that came out. For debugging a single site and for the human test.
 *
 *   npx tsx scripts/website-audit-eval/capture-url.ts <url> [--json out.json]
 *
 * Never touches the database or Redis.
 */
import { writeFileSync } from "node:fs";
import { closeBrowser } from "@/lib/crawler";
import { crawlWebsiteDeep } from "@/lib/site-capture/deep";
import { summarizeLedger } from "@/lib/site-capture/ledger";

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error("usage: capture-url.ts <url> [--json out.json]");
  const t0 = Date.now();
  const { features, capture } = await crawlWebsiteDeep(url, "restaurant");
  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(`reachable=${features.reachable} crawlError=${features.crawlError ?? "-"} in ${seconds} s`);

  if (capture) {
    const s = summarizeLedger(capture.ledger);
    console.log(`capture: ${capture.status}; opened ${s.opened}, skipped ${s.skipped}, failed ${s.failed}; sitemap listed ${capture.sitemapUrlCount}`);
    for (const e of capture.ledger) {
      const landed = e.finalUrl && e.finalUrl !== e.url ? ` -> ${e.finalUrl}` : "";
      console.log(`  ${e.outcome.padEnd(7)} ${e.type.padEnd(11)} ${(e.reason ?? "").padEnd(15)} ${e.url}${landed}`);
    }
    for (const p of capture.pages) {
      if (p.thirdPartyRequests.length > 0) console.log(`  requests on ${p.url}: ${p.thirdPartyRequests.slice(0, 12).join(", ")}`);
    }
  }

  const sf = features.siteFacts;
  if (sf) {
    const facts: Array<[string, unknown]> = [
      ["bookingProvider", sf.bookingProvider],
      ["hasPrepayment", sf.hasPrepayment],
      ["tastingMenu", sf.tastingMenu],
      ["qrMenuTool", sf.qrMenuTool],
      ["directOrdering", sf.directOrdering],
      ["deliveryPlatforms", sf.deliveryPlatforms],
      ["languageCount", sf.languageCount],
      ["locationCount", sf.locationCount],
      ["locationHints", sf.locationHints],
      ["hotelOperator", sf.hotelOperator],
      ["menuPdfUrl", sf.menuPdfUrl],
    ];
    console.log("facts:");
    for (const [name, fact] of facts) console.log(`  ${name.padEnd(18)} ${fact == null ? "-" : JSON.stringify(fact)}`);
    console.log(`  bookingChecked=${sf.bookingChecked} menuPageSeen=${sf.menuPageSeen} orderPageSeen=${sf.orderPageSeen}`);
  }

  const jsonAt = process.argv.indexOf("--json");
  if (jsonAt > 0) {
    const pages = capture?.pages.map(({ html: _html, ...rest }) => rest) ?? [];
    writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ features, capture: capture ? { ...capture, pages } : null }, null, 2));
  }
  await closeBrowser();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

Run: `npx tsx scripts/website-audit-eval/capture-url.ts https://www.padella.co/soho/`
Expected: `capture: complete` ya da `partial`; birden fazla `opened` satırı; `bookingProvider` satırında `Dojo`. (Task 8 Step 8 ertelendiyse bu çıktı onun da yerini tutar.)

- [ ] **Step 4: 40 sitede önce / sonra ölçümü**

```bash
mkdir -p tmp/site-capture-eval
npx tsx scripts/website-audit-eval/run-eval.ts tmp/site-capture-eval/before
npx tsx scripts/website-audit-eval/run-eval.ts tmp/site-capture-eval/after --deep
npx tsx scripts/website-audit-eval/score.ts tmp/site-capture-eval/after/results.json scripts/website-audit-eval/truth.json --rows --compare tmp/site-capture-eval/before/results.json
```

(Her koşu canlı sitelere gider; derin koşu 40 site için yaklaşık 30–60 dakika sürer. Yarıda kesilirse aynı komutu `--resume` ile yeniden çalıştır.)

Geçme koşulları (spec, "Test ve başarı ölçütü"):

| Ölçüt | Nasıl okunur |
|---|---|
| Bugünkü doğrular bozulmaz | `compare:` satırında `0 regression(s)` |
| Eskiden `null` olan hücre yanlışa dönmez; toplam yanlış ≤ 1 | `0 new wrong answer(s)`; tabloda `wrong` sütunlarının toplamı ≤ 1 |
| Kaçırılan pozitif azalır | `unknown cells X -> Y`, Y < X; hiçbir alanın `missed` sayısı artmaz |
| Süre | `time per site: median ≤ 60 s, p95 ≤ 180 s` |
| Dishoom, Lokanta kaporası | `--rows` çıktısında `dishoom` ve `lokanta` satırlarının `prepaymentAny` sütunu `ok` |
| Zizzi, Gaucho | `capture-url.ts` ile bak: `bookingProvider` dolu mu, değilse defterde rezervasyon sayfası `opened` ve `requests on …` satırı var mı; hangisi olduğunu ölçüm notuna yaz |
| Four Seasons (Avlu) | `after/results.json` içinde `avlu.capture.status` = `blocked` |

Bir ölçüt tutmazsa: ilgili siteyi `capture-url.ts <url> --json tmp/site-capture-eval/<id>.json` ile aç, nedeni bul (yanlış tür, kaçan regex, erken biten bütçe), düzeltmeyi sahibi olan görevin test dosyasına o siteden kesilmiş küçük bir örnekle sabitle (`bridge.test.ts`, `classify.test.ts` ya da `capture.test.ts`), düzelt, `npm run test` çalıştır, ölçümü yalnızca o site için `--only <id>` ile yenile. Düzeltme `mergeSiteFacts`'in bugünkü regex'lerine (`PREPAY`, `TASTING`) dokunuyorsa 40 sitenin tamamını yeniden ölç. Süre ölçütü tutmazsa önce `DEFAULT_LIMITS.pageTimeoutMs`'i ve açıcıdaki bekleme sürelerini değil, en yavaş beş sitenin defterini incele: hangi tür gereksiz sayfa açtırıyor.

- [ ] **Step 5: Ölçüm notunu yaz**

`docs/research/2026-10-04-site-capture-eval.md` dosyasını oluştur. `docs/research/2026-10-03-website-audit-accuracy.md` ile aynı yapıda: "How it was measured" (40 site, önce = sığ `crawlWebsite`, sonra = `crawlWebsiteDeep`, tarih), `score.ts` çıktısındaki alan tablosu (önce / sonra), `compare:` satırı, süre satırı, beş bilinen kaçağın her biri için bir satır (çözüldü / defterde nedeniyle görünüyor, kanıt adresi), "What I could not verify". Sayılar Step 4'ün çıktısından birebir alınır; tahmin yazılmaz.

- [ ] **Step 6: Ayrı kümeyi seç**

```ts
// scripts/website-audit-eval/pick-holdout.ts
/**
 * Pick hold-out sites for the human test: real leads whose site is not in
 * sites.json (the 40 sites the extractor was tuned on).
 *
 *   npx tsx scripts/website-audit-eval/pick-holdout.ts <leads.json> [more.json ...] [--count 12]
 *
 * Input files are pull-leads.ts outputs. Writes sites-holdout.json next to
 * this script. Reads no database.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isSocialUrl } from "@/lib/control/evidence-shelf";

interface PulledLead {
  id: string;
  name: string;
  url: string | null;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const countAt = args.indexOf("--count");
  const count = countAt >= 0 ? Number(args[countAt + 1]) : 12;
  const files = args.filter((a, i) => !a.startsWith("--") && (countAt < 0 || i !== countAt + 1));
  if (files.length === 0) throw new Error("usage: pick-holdout.ts <leads.json> [more.json ...] [--count 12]");

  const tuned = JSON.parse(readFileSync(path.join(__dirname, "sites.json"), "utf8")) as Array<{ url: string }>;
  const taken = new Set(tuned.map((s) => host(s.url)).filter((h): h is string => h !== null));
  const picked: Array<{ id: string; name: string; url: string }> = [];

  for (const file of files) {
    const { leads } = JSON.parse(readFileSync(file, "utf8")) as { leads: PulledLead[] };
    for (const lead of leads) {
      if (picked.length >= count) break;
      if (!lead.url || isSocialUrl(lead.url)) continue;
      const h = host(lead.url);
      if (!h || taken.has(h)) continue;
      taken.add(h);
      const id = h.replace(/\.(co\.uk|com\.tr|com|net|org|co)$/i, "").replace(/[^a-z0-9]+/g, "-");
      picked.push({ id, name: lead.name, url: lead.url });
    }
  }

  writeFileSync(path.join(__dirname, "sites-holdout.json"), `${JSON.stringify(picked, null, 2)}\n`);
  console.log(`picked ${picked.length} of ${count}: ${picked.map((p) => p.id).join(", ")}`);
  if (picked.length < count) process.exitCode = 1;
}

main();
```

```bash
npx tsx scripts/website-audit-eval/pull-leads.ts "FineDine Beta" 80 --any > tmp/site-capture-eval/leads-finedine.json
npx tsx scripts/website-audit-eval/pick-holdout.ts tmp/site-capture-eval/leads-finedine.json --count 12
```

`pull-leads.ts` üretim veritabanını **salt okunur** okur (sorgular `workspaceId` ile kapsamlı; hiçbir şey yazmaz). 12 site çıkmazsa (`picked N of 12`, çıkış kodu 1) ilk ölçümde kullanılan diğer iki workspace için de `pull-leads.ts` çalıştır (adları `npx tsx scripts/website-audit-eval/list-workspaces.ts` verir) ve dosyalarını `pick-holdout.ts`'e birlikte ver. Kümede en az iki İstanbul mekânı ve en az bir otel restoranı yoksa kullanıcıya sor; kümeyi elle değiştirme.

- [ ] **Step 7: İnsan testi kağıdını üreten aracı yaz**

```ts
// scripts/website-audit-eval/human-sheet.ts
/**
 * Turn a deep eval run into a sheet a person fills in while opening each
 * site: every asserted fact with its evidence, every page the capture says
 * it read, every page it could not read.
 *
 *   npx tsx scripts/website-audit-eval/human-sheet.ts <results.json> <out.md>
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Fact {
  value: unknown;
  url?: string;
  quote?: string | null;
  scope?: string;
  source?: string;
}
interface LedgerRow {
  url: string;
  finalUrl: string | null;
  type: string;
  outcome: string;
  reason: string | null;
}
interface SiteResult {
  name: string;
  url: string;
  reachable: boolean;
  crawlError: string | null;
  ms: number;
  siteFacts: Record<string, unknown> | null;
  capture: { status: string; ledger: LedgerRow[] } | null;
}

const FACTS: Array<[string, string]> = [
  ["bookingProvider", "Rezervasyon sağlayıcısı"],
  ["hasPrepayment", "Kapora / kart güvencesi"],
  ["tastingMenu", "Tadım menüsü"],
  ["qrMenuTool", "Dijital / QR menü aracı"],
  ["directOrdering", "Kendi online siparişi"],
  ["deliveryPlatforms", "Teslimat platformları"],
  ["languageCount", "Dil sayısı"],
  ["locationCount", "Şube sayısı"],
  ["locationHints", "Çok şube ipucu"],
  ["hotelOperator", "Otel işletmecisi"],
];

const cell = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function main() {
  const [resultsPath, outPath] = process.argv.slice(2);
  if (!resultsPath || !outPath) throw new Error("usage: human-sheet.ts <results.json> <out.md>");
  const results = JSON.parse(readFileSync(resultsPath, "utf8")) as Record<string, SiteResult>;
  const out: string[] = [
    "# Site yakalama — insan testi kağıdı",
    "",
    "Her site için: siteyi tarayıcıda aç, her satırı kontrol et, son sütuna `D` (doğru), `Y` (yanlış) ya da `?` (karar veremedim) yaz. Yönerge: `docs/research/2026-10-04-site-yakalama-insan-testi.md`.",
    "",
  ];

  for (const [id, r] of Object.entries(results)) {
    out.push(`## ${cell(r.name)} (${id})`, "", `Adres: ${r.url} · erişim: ${r.reachable ? "var" : `yok (${r.crawlError ?? "neden yok"})`} · süre: ${Math.round(r.ms / 1000)} sn · yakalama: ${r.capture?.status ?? "yok"}`, "");

    out.push("**Bulgular** (sistem bunları iddia ediyor)", "", "| Bulgu | Değer | Kapsam | Kaynak | Kanıt adresi | Alıntı | D / Y / ? |", "|---|---|---|---|---|---|---|");
    const sf = r.siteFacts ?? {};
    let asserted = 0;
    for (const [key, label] of FACTS) {
      const fact = sf[key] as Fact | null | undefined;
      if (fact == null) continue;
      asserted++;
      const value = Array.isArray(fact.value) ? fact.value.join(", ") : fact.value === true ? "var" : fact.value;
      const scope = fact.scope === "group_or_event" ? "yalnızca grup / etkinlik" : "genel";
      out.push(`| ${label} | ${cell(value)} | ${scope} | ${fact.source ?? "sayfa"} | ${cell(fact.url)} | ${cell(fact.quote).slice(0, 220)} | |`);
    }
    if (typeof sf.menuPdfUrl === "string") {
      asserted++;
      out.push(`| Menü PDF'i | var | genel | sayfa | ${cell(sf.menuPdfUrl)} | | |`);
    }
    if (asserted === 0) out.push("| (iddia edilen bulgu yok) | | | | | | |");

    out.push("", "**Sistemin bilmediği** (boş bıraktığı; sitede açıkça varsa `KAÇAK` yaz)", "", "| Bulgu | Sitede var mı? |", "|---|---|");
    for (const [key, label] of FACTS) if (sf[key] == null) out.push(`| ${label} | |`);

    const ledger = r.capture?.ledger ?? [];
    out.push("", "**Okunan sayfalar** (tür doğru mu?)", "", "| Tür | Adres | D / Y |", "|---|---|---|");
    for (const e of ledger.filter((x) => x.outcome === "opened")) {
      const landed = e.finalUrl && e.finalUrl !== e.url ? ` → ${e.finalUrl}` : "";
      out.push(`| ${e.type} | ${cell(e.url + landed)} | |`);
    }
    const unread = ledger.filter((x) => x.outcome !== "opened" && x.reason !== "limit_type" && x.reason !== "duplicate");
    out.push("", "**Okunamayan sayfalar** (önemli bir sayfa kaçmış mı?)", "", "| Tür | Adres | Neden | Önemli mi? |", "|---|---|---|---|");
    if (unread.length === 0) out.push("| (yok) | | | |");
    for (const e of unread.slice(0, 25)) out.push(`| ${e.type} | ${cell(e.url)} | ${e.reason ?? ""} | |`);
    out.push("");
  }

  writeFileSync(outPath, `${out.join("\n")}\n`);
  console.log(`wrote ${outPath} (${Object.keys(results).length} sites)`);
}

main();
```

- [ ] **Step 8: Ayrı kümeyi çalıştır ve kağıdı üret**

```bash
npx tsx scripts/website-audit-eval/run-eval.ts tmp/site-capture-eval/holdout --deep --sites sites-holdout.json
npx tsx scripts/website-audit-eval/human-sheet.ts tmp/site-capture-eval/holdout/results.json docs/research/2026-10-04-site-yakalama-test-kagidi.md
```

Expected: `wrote docs/research/2026-10-04-site-yakalama-test-kagidi.md (12 sites)`. Kağıdı aç; her sitenin en az bir "Okunan sayfalar" satırı ya da erişim satırında neden olmalı.

- [ ] **Step 9: İnsan testi yönergesini yaz**

`docs/research/2026-10-04-site-yakalama-insan-testi.md`:

```markdown
# Site yakalama — son insan testi

Amaç: `WEBSITE_AUDITOR`'ın derin yakalamasının, ayar yapılırken hiç kullanılmamış 12 gerçek sitede doğru konuştuğunu ve neye bakamadığını dürüstçe söylediğini bir insanın doğrulaması.

## A. Kağıt testi (12 site, yaklaşık 60–90 dakika)

Kağıt: `docs/research/2026-10-04-site-yakalama-test-kagidi.md`.

Her site için:

1. Siteyi kendi tarayıcında aç.
2. **Bulgular** tablosu: her satırda kanıt adresine git, alıntıyı bul. Bulgu sitede öyleyse `D`, değilse `Y`, karar veremediysen `?`. "Kapsam" sütunu `yalnızca grup / etkinlik` diyorsa, kaporanın gerçekten yalnızca gruplar için geçerli olduğunu kontrol et; her rezervasyonda isteniyorsa `Y`.
3. **Sistemin bilmediği** tablosu: boş bırakılan bulgu sitede açıkça varsa (ör. rezervasyon düğmesi OpenTable'a gidiyor) `KAÇAK` yaz ve sayfanın adresini ekle. Bulamadıysan boş bırak.
4. **Okunan sayfalar**: tür sütunu sayfayla uyuşuyor mu (`menu` gerçekten menü mü)?
5. **Okunamayan sayfalar**: listede rezervasyon, menü, sipariş, SSS ya da grup sayfası varsa "Önemli mi?" sütununa `evet` yaz.

## B. Uygulama içi test (3 lead, yaklaşık 15 dakika)

1. Worker süreci çalışıyor olmalı (`npm run workers`).
2. Bir lead'in detay sayfasında "Website Analizcisi"ni yeniden çalıştır. Koşu 5 dakikaya kadar sürebilir; "takıldı" etiketi 5 dakikadan önce çıkmamalı.
3. Yönetim panelinde İnceleme sayfasında aynı lead'in **Site** çekmecesini aç: "Kapsam: N sayfa açıldı · …" satırı görünmeli; okunamayan sayfa varsa nedeniyle yazmalı.
4. Aynı anda üç lead için denetimi başlat: üçü de tamamlanmalı (üçüncüsü slot bekler, düşmez).

## Geçme koşulu

- A.2: `Y` sayısı **0**. (`?` satırları tek tek konuşulur.)
- A.3: `KAÇAK` sayısı not edilir; engel değildir, ama rezervasyon sağlayıcısında 2'den fazla kaçak varsa yayına çıkmadan konuşulur.
- A.4: yanlış türlü sayfa en fazla 2.
- A.5: `evet` yazılan her satırın nedeni (`timeout`, `blocked`, `budget`, `robots_disallow`) makul olmalı; `budget` nedeniyle kaçan önemli sayfa varsa bildirilir.
- B: dört adım da beklendiği gibi.

## Bilinen sınırlar (hata değil)

- Bot korumalı siteler (Akamai vb.) `blocked` olarak görünür; proxy yok.
- Metin katmanı olmayan menü PDF'leri okunmaz (`needsOcr`).
- Tıklayınca açılan rezervasyon pencereleri (modal) yalnızca sayfa yüklenirken istek atıyorsa yakalanır.
- Toplu keşifte denetim aşaması eskisinden yavaştır (süreç başına 2 eşzamanlı site).
```

- [ ] **Step 10: Tam doğrulama**

```bash
npm run test
npx tsc --noEmit
npm run lint
```

Expected: üçü de temiz. Lint, bu planın dokunmadığı dosyalarda zaten var olan uyarıları gösterirse onlara dokunma; yalnızca bu dalda eklenen dosyalardaki uyarıları düzelt.

- [ ] **Step 11: Commit**

```bash
git add scripts/website-audit-eval/run-eval.ts scripts/website-audit-eval/score.ts scripts/website-audit-eval/capture-url.ts scripts/website-audit-eval/pick-holdout.ts scripts/website-audit-eval/human-sheet.ts scripts/website-audit-eval/sites-holdout.json docs/research/2026-10-04-site-capture-eval.md docs/research/2026-10-04-site-yakalama-insan-testi.md docs/research/2026-10-04-site-yakalama-test-kagidi.md
git commit -m "chore(eval): deep-capture eval, hold-out set and the human test sheet"
```

- [ ] **Step 12: Veritabanı şeması (kullanıcı onayıyla)**

Uygulama içi test (yönergenin B bölümü) `site_captures` ve `site_capture_pages` tablolarını ister. **Bu adımı kullanıcıya sormadan çalıştırma.** Kullanıcıya şunu sor: "`npm run db:push` iki yeni tablo ekleyecek (`site_captures`, `site_capture_pages`); `.env`'deki `DATABASE_URL` hangi veritabanını gösteriyor ve buna yazmamı onaylıyor musun?" Onay gelince:

```bash
npm run db:push
```

Expected: yalnızca iki tablonun eklendiğini söyleyen çıktı; veri kaybı uyarısı çıkarsa **durdur** ve kullanıcıya göster. Tablolar yokken worker çökmez: `saveSiteCapture` hatası loglanır ve denetim sonucu yine yazılır (Task 12), ama kapsam kaydı saklanmaz.

- [ ] **Step 13: Teslim**

Kullanıcıya şunları ver: ölçüm notu (`docs/research/2026-10-04-site-capture-eval.md`) ve içindeki geçme / kalma tablosu, test kağıdı, insan testi yönergesi, `db:push`'un yapılıp yapılmadığı. Dal `prod/i-site-yakalama` üzerinde kalır; `main`'e birleştirme ve push kullanıcının kararıdır.

---

## Kapsam dışı (bu planda yok)

- `APIFY_WEB_CRAWL_DEEP`'in `SiteCapture` okuması (ayrı spec).
- Bing / Companies House / Instagram doğrulama yardımcıları.
- Gemini ile okuma, menü zekâsı, teknik denetim (alt projeler 2–4).
- Proxy, OCR, giriş gerektiren sayfalar, ekran görüntüsü.
- Panelde "takıldı" etiketinin erteleme süresini bilmesi (Task 11'de not edildi).
- Kayıttan çevrimdışı yeniden okuma aracı. Kayıt bunu mümkün kılar (`capture-url.ts --json` sayfa metinlerini yazar, `SiteCapturePage` satırları veritabanında durur), ama `offline-eval.ts`'in köprüyü kayıt üzerinden yeniden koşturması bu planda yok; alt proje 2 (Gemini okuması) bu kaydı okuyacağı için orada yazılır.

