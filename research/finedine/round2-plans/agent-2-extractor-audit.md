# Agent 2 — Extractor + Audit Pipeline

> Round 2 (Camden) tester raporundaki extractor / audit kümesinin (§3.4, §3.5, §3.9, §4.1, §4.6, §2.6/Phase 1.2) kod-seviyesi root-cause analizi ve fix planı.
> **Kapsam:** kod değiştirilmemiştir; bu doc sadece analiz + tasarım.
> **Kaynak rapor:** `research/finedine/beta-test-round-2-camden-report.md` (1283 satır, 2026-05-05).
> **İncelenen dosyalar (8 adet):**
> 1. `src/lib/extractor.ts` (598 satır) — `BOOKING_KEYWORDS`, `RESERVATION_PATTERNS`, `QR_MENU_PATTERNS`, `hasBookingSystem` multi-signal, `hasOnlineReservation`/`hasQrMenu` substring path
> 2. `src/lib/crawler.ts` (365 satır) — `crawlWebsite` entrypoint, `classifyError`, social-url-gate çağrısı (line 90), `CrawlError` mapping (line 256-262)
> 3. `src/lib/audit/social-url-gate.ts` (95 satır) — `detectSocialMediaPlatform`, hostname-only check
> 4. `src/lib/audit/booking-detection.ts` (228 satır) — `detectBookingProvider` (Calendly/OpenTable/Resy/...) + `extractContactEmails`
> 5. `src/lib/agent-workers/website-auditor.ts` (255 satır) — Phase 2.6 `lastAuditedWebsiteUrl` stamp (line 156), `null websiteUrl` early return (27-36), social-only branch `metaDescription:null` (61-105)
> 6. `src/lib/agent-workers/apify/gmaps-deep.ts` (396 satır) — `maybeEnqueueWebsiteReAudit` hook (85-178), normalizeWebsiteUrl idempotency
> 7. `src/types/index.ts` (363 satır) — `CrawlError` union (line 129-140) — `WEBSITE_EXPIRED` ekleme noktası
> 8. `prisma/schema.prisma` (line 891-942) — `WebsiteAudit` model (auditor_version yok)

---

## 0. Cover

**Cluster scope:** Crawler input gating + extractor signal extraction + audit row persistence + DB stale-row backfill.

**Rapor § referansları:**
- §3.4 — Conversion Features (Path A) ↔ Restaurant Tech Signals (Path B) çakışması (4 lead etkilendi: LUMI, Glass, Camden Roastery, Black Sheep + stale 2 lead: Coffee Couch, YBA Brazil)
- §3.5 — Stale audit re-trigger eksikliği (Coffee Couch + YBA Brazil 2026-05-01 audit'leri)
- §3.9 — Instagram audit'leri `meta_description = "Create an account or log in to Instagram..."` (Coffee Couch, YBA Brazil)
- §4.1 — Round 1 #1 "Instagram-as-Website" carryover (kod tarafında ✅ deploy, DB tarafında ❌ stale)
- §4.6 — Audit hiç oluşmamış: S.O.S Coffee + The Drip + Il botanico (`websiteUrl` set ama `website_audits` row yok)
- §2.6 / Phase 1.2 — Yeni `WEBSITE_EXPIRED` crawl_error variant ihtiyacı (Fable and Falcon: 404 + Squarespace-Expired title)

**Etkilenen tester gözlemleri:** Round 2 raporundaki 12/12 lead'in en az birinde bu kümeden bir bug tetiklendi; en kritik vakalar:
- LUMI Camden (§3.4 — aynı kavram, iki path, çelişkili sonuç)
- Coffee Couch + YBA Brazil (§3.5 + §3.9 + §4.1 — stale audit DB'de yaşıyor)
- Glass Coffee + Camden Roastery + Black Sheep (§3.4 — `e-menu` 5-char substring false-pos)
- Fable and Falcon (§3.8 + Phase 1.2 — expired domain "sitenizi inceledim" opener)
- S.O.S Coffee + The Drip (§4.6 — null→non-null geçişi sonrası audit yok)

**Dependency hattı:**
- → `agent-1-ui-mask` (§3.9 UI masking ile bağı, deploy ordering: backfill ÖNCE, UI masking sonra)
- → `agent-4-worker-idempotency` (§3.5 backfill enqueue ile `agent_runs` cleanup koordinasyonu)
- ← `round-1` social-url-gate fix'in retroactive uygulaması

---

## 1. Sorun Inventory

### Bug 2.A — `hasOnlineReservation` substring path Round 1 yamasından muaf

**Tester alıntısı (LUMI Camden):**
> "Restourant tech signals bölümü çok ciddi bir hata yaparak booking feature bölümü olduğunu söylemiş … Booking feature bölümü var demesinin sebebi 'no bookings, walk in welcome' ibaresindeki bookings keyword'ü olabilir"

**DB kanıtı (Ek A.5'ten):**
| Lead | `audit.has_booking_system` (Path A, multi-signal) | `rawFeaturesJson.hasOnlineReservation` (Path B, substring) |
|---|---|---|
| LUMI Camden | `false` ✅ | `true` ❌ |
| Coffee Couch | `true` ❌ (stale) | `false` |
| YBA Brazil | `true` ❌ (stale) | `false` |

**Kod kanıtı:**

`src/lib/extractor.ts:521`:
```ts
const hasOnlineReservation = RESERVATION_PATTERNS.some((p) => fullHtml.includes(p));
```
- `fullHtml = html.toLowerCase()` (line 221) — sayfanın TAMAMI, attribute/CSS/JS dahil.
- `RESERVATION_PATTERNS` (line 23-35): `["opentable","sevenrooms","resy.com","bookatable","quandoo","fork.com","yelp.com/reservations","tablein","tablecheck","eat-app","restobooking"]`.
- `Array.includes` substring; word-boundary yok, hostname kapısı yok, CTA confirmation yok.

Buna karşılık `hasBookingSystem` (Path A) Round 1'de multi-signal'e geçmiş — `extractor.ts:538-540`:
```ts
const hasBookingSystemFinal =
  bookingProvider !== null ||
  (jsonLdReservation && ctaSignalsBooking);
```

**Tutarsızlık (line:col):**
- `extractor.ts:538` — Path A (multi-signal: provider VEYA jsonLd+CTA) ✅
- `extractor.ts:521` — Path B (raw substring `fullHtml.includes(p)`) ❌
- `extractor.ts:506-518` — Path C (QR menu, raw substring; aynı problem) ❌

**Reproduction (LUMI):**
1. LUMI sayfasının HTML'inde herhangi bir `opentable` substring (örn. `<link rel=preconnect href="https://opentable.com">` `<style>.opentable-style{...}</style>`, ya da bir delivery widget'ının third-party JS'inde geçen `opentable` referansı) olduğu ânda `hasOnlineReservation=true` olur.
2. `bookingProvider` (booking-detection.ts:147) ise hem `htmlPatterns: ["opentable.com/widget", "ot-dtp-picker"]` hem `hostnames: ["opentable.com", "opentable.co.uk"]` lookup yapar — yani widget pattern + link href birlikte. LUMI'de bunlardan hiçbiri yok → `bookingProvider=null` → Path A doğru `false` döner. Path B yanlış `true` döner.
3. UI: `RestaurantSignalsSection` (`src/components/app/website-intelligence-panel.tsx:1147-1177`) `features.hasOnlineReservation` doğrudan render → "Reservation system found" yeşil chip; `ConversionSection` (line 802-829) ise `audit.hasBookingSystem=false` → "No booking" kırmızı chip. Aynı sayfada çelişkili iki chip.

---

### Bug 2.B — `QR_MENU_PATTERNS` 5-char "e-menu" / "emenu" substring patlaması

**Tester alıntıları:**
- Glass Coffee: *"Restaurant Tech Signals QR menü bulunduğunu iddia etmiş ancak buna dair bir delil bulunamadı"*
- Camden Coffee Roastery: *"QR menüden var denmiş ancak QR menü ile alakalı bir şeye ulaşamadım, sadece E commerce sayfasında bag coffee var"*

**DB kanıtı:**
| Lead | `rawFeaturesJson.hasQrMenu` | `rawFeaturesJson.detectedMenuTool` | Gerçek site |
|---|---|---|---|
| Glass Coffee | `true` ❌ | `"E-Menu"` | QR menü yok |
| Camden Coffee Roastery | `true` ❌ | `"E-Menu"` | E-commerce coffee bag, QR yok |
| Black Sheep Coffee | `true` ❌ | `"E-Menu"` | Chain app'te QR var ama Camden alt-sayfasında yok |

**Kod kanıtı:** `src/lib/extractor.ts:7-21, 506-518`:

```ts
const QR_MENU_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "finedinemenu", label: "FineDine" },     // 12 char ✅ spesifik
  { pattern: "menutiger",    label: "MenuTiger" },     //  9 char ✅
  { pattern: "flipmenu",     label: "Flipmenu" },      //  8 char ✅
  { pattern: "plumqr",       label: "PlumQR" },        //  6 char ⚠️
  { pattern: "glorifood",    label: "Gloriafood" },    //  9 char ✅
  { pattern: "flipdish",     label: "Flipdish" },      //  8 char ✅
  { pattern: "yoello",       label: "Yoello" },        //  6 char ⚠️
  { pattern: "tableqr",      label: "TableQR" },       //  7 char ⚠️
  { pattern: "qr-menu",      label: "QR Menu" },       //  7 char ⚠️
  { pattern: "qrmenu",       label: "QR Menu" },       //  6 char ⚠️
  { pattern: "digitalmenu",  label: "Digital Menu" },  // 11 char ✅
  { pattern: "e-menu",       label: "E-Menu" },        //  6 char ❌ FALSE-POS
  { pattern: "emenu",        label: "E-Menu" },        //  5 char ❌ FALSE-POS
];

for (const { pattern, label } of QR_MENU_PATTERNS) {
  if (fullHtml.includes(pattern)) {        // ← raw substring
    hasQrMenu = true;
    detectedMenuTool = label;
    ...
  }
}
```

**False-pos çoğaltma (line:col düzeyinde test):**

Aşağıdaki tüm string'ler `fullHtml.includes("e-menu")` veya `fullHtml.includes("emenu")` testini geçer:

1. **CSS class — yaygın nav kalıbı:**
   - `<nav class="the-menu">` → `"the-menu"` substring `"e-menu"` içerir (son 6 char). ✅ FALSE-POS
   - `<div class="site-menu">` → `"site-menu"` substring `"e-menu"` içerir (son 6 char). ✅ FALSE-POS
   - `<ul class="page-menu">` → `"page-menu"` substring `"e-menu"` içerir. ✅ FALSE-POS
   - `<a class="active-menu-item">` → `"active-menu-item"` substring `"e-menu"` içerir. ✅ FALSE-POS

2. **Link href — slug naming:**
   - `<a href="/the-menu">` → ✅ FALSE-POS
   - `<a href="/coffee-menu">` → `"coffee-menu"` substring `"e-menu"` içerir. ✅ FALSE-POS

3. **HTML id/data attribute:**
   - `<section id="the-menu-section">` → ✅ FALSE-POS
   - `<div data-menu="active">` (no — burada match yok)

4. **JS bundle / minified:**
   - `var themenu = ...;` → `"themenu"` substring `"emenu"` içerir (son 5 char). ✅ FALSE-POS (5-char emenu pattern)
   - `class="navItem-themenu_xY3"` → ✅ FALSE-POS

5. **Wordpress / Shopify theme attribute:**
   - `<body class="page-template-the-menu">` → ✅ FALSE-POS
   - `<header data-template="site-menu">` → ✅ FALSE-POS

**Tahmin:** Glass / Camden Roastery / Black Sheep'in gerçek HTML'inde tahminen `"the-menu"`, `"site-menu"`, `"coffee-menu"`, veya benzeri yaygın nav class/id/href var. Bu üç işletmenin ortak özelliği: e-commerce + cafe (menu sayfaları slug üretiyor); o yüzden hepsinde aynı false-pos.

**Düşük-öncelikli yan-risk:** "tableqr" 7-char ve "qrmenu" 6-char da uzun-vadede false-pos riski (örn. `class="page-tableqr-id"` minified bundle). "plumqr" 6-char benzer; ancak bunlar Round 2'de kanıtlanmadı.

**Reproduction:**
```ts
"the-menu".includes("e-menu");       // → true
"themenu".includes("emenu");         // → true
"<div class=\"the-menu\">".includes("e-menu"); // → true
```

---

### Bug 2.C — Stale audit re-trigger eksikliği (Round 1 fix retroactive uygulanmadı)

**Tester alıntıları:**
- Coffee Couch: *"Yapay Zeka Website alanına Instagram girilmesiyle yine çuvallamış … Conversion features olmamasına rağmen E Commerce ve Booking sistema olduğunu söylüyor"*
- YBA Brazil: *"Website yerine Instagram koyulunca yine çuvallamış, bu bug hala düzeltilmemiş"*

**DB kanıtı (Ek A.7):**
```
Lead              | crawl_attempted_at  | crawl_error         | has_booking_system | has_ecommerce
------------------+---------------------+---------------------+--------------------+---------------
One Shot Coffee   | 2026-05-05 20:00:17 | SOCIAL_MEDIA_ONLY ✅ | false ✅           | false ✅
Coffee Couch      | 2026-05-01 17:30:56 | NULL ❌              | true  ❌           | true  ❌
YBA Brazil        | 2026-05-01 17:30:15 | NULL ❌              | true  ❌           | true  ❌
```

**Kod kanıtı:**

Round 1 fix — `src/lib/crawler.ts:90-94` ve `src/lib/audit/social-url-gate.ts:67-89`:
```ts
// crawler.ts:90 — gate, SSRF check'inden ÖNCE
const socialPlatform = detectSocialMediaPlatform(url);
if (socialPlatform) {
  const result = createUnreachableResult(url, "SOCIAL_MEDIA_ONLY", null, socialPlatform);
  return result;
}
```

`src/lib/agent-workers/website-auditor.ts:61-105` — social-only branch:
```ts
if (features.crawlError === "SOCIAL_MEDIA_ONLY") {
  const baseFields = {
    ...
    title: null, metaDescription: null, h1: null,    // ← doğru reset
    hasContactForm: false, hasWhatsappLink: false,
    hasBookingSystem: false, hasEcommerce: false,
    ...
  };
  await prisma.websiteAudit.upsert({ ... });
}
```

**Re-trigger hook:** `src/lib/agent-workers/apify/gmaps-deep.ts:85-178` `maybeEnqueueWebsiteReAudit`. Idempotency anahtarı: `lead.lastAuditedWebsiteUrl === newUrl` ise skip. Coffee Couch + YBA Brazil için `websiteUrl` Round 1'den beri AYNI Instagram URL'si — `lastAuditedWebsiteUrl` da AYNI URL ile stamp'lenmiş (Round 1 öncesi audit başarıyla tamamlandı, line 156 `lastAuditedWebsiteUrl: lead.websiteUrl` çalıştı). Yani:
- `lastAuditedNormalized === newUrl` → **TRUE** → re-audit skip → **stale data forever** ❌

**Root cause:** Hook URL-değişim-tabanlı, kod-versiyon-tabanlı değil. Audit logic değişimi (yama) URL'yi değiştirmediği için backfill tetiklenemiyor.

**Reproduction:**
```sql
SELECT lead_id, url, crawl_attempted_at, crawl_error
FROM website_audits
WHERE url ~ '(instagram|facebook|tiktok|linkedin|twitter|x\.com|youtube|pinterest|threads)\.(com|net|me|tv)'
  AND crawl_error IS NULL                    -- gate fix öncesi
  AND crawl_attempted_at < '2026-05-02';     -- Round 1 deploy tarihi (yaklaşık)
-- Beklenen: en az 2 satır (Coffee Couch, YBA Brazil); muhtemelen daha fazla, başka workspace'lerde
```

---

### Bug 2.D — Instagram default `meta_description` (§3.9, §2.C ile aynı root)

**Tester alıntısı:**
> Coffee Couch: *"Website olmamasına rağmen Instagram baz alındığı için maalesef Identify&Seo bölümü Instagram'ın ana tanıtımını veriyor."*

**DB kanıtı:**
```
Coffee Couch:  meta_description = "Create an account or log in to Instagram - Share what you're into with the people who get you."
YBA Brazil:    meta_description = "Create an account or log in to Instagram - Share what you're into with the people who get you."
```

**Kod kanıtı:** `website-auditor.ts:72` social-only branch artık `metaDescription: null` set ediyor — doğru. Ama 2026-05-01 audit'leri eski path'ten geçmiş (extractor.ts:225 `$('meta[name="description"]').attr("content")` Instagram'ın global default mesajını çekti).

§2.C backfill'i bunu otomatik düzeltir.

---

### Bug 2.E — Audit hiç oluşmamış: `crawl_status=NO_WEBSITE` AMA `website_url IS NOT NULL`

**Tester implicit (UI'da boş Conversion Features):**
- S.O.S Coffee + The Drip için Conversion Features ve Tech Signals bölümleri hiç render edilmiyor (audit row null)

**DB kanıtı:**
| Lead | `website_url` | `crawl_status` | `lastAuditedWebsiteUrl` | `website_audits` row |
|---|---|---|---|---|
| S.O.S Coffee | `https://soscoffee.com/` | `NO_WEBSITE` ❌ | (muhtemelen `null`) | **YOK** |
| The Drip | `https://www.thedrip.net/` | `NO_WEBSITE` ❌ | (muhtemelen `null`) | **YOK** |
| Il botanico | `null` | `NO_WEBSITE` ✅ | `null` | YOK (doğru — URL yok) |

**Kod kanıtı (mismatch oluşum yolları):**

`src/lib/agent-workers/website-auditor.ts:27-36` — null guard:
```ts
if (!lead.websiteUrl) {
  await prisma.lead.update({
    where: { id: lead.id },
    data: { crawlStatus: "NO_WEBSITE" },
  });
  return { output: { skipped: true, reason: "no_website" }, costTokens: 0 };
}
```

`src/lib/agent-workers/apify/gmaps-deep.ts:85-178` — `maybeEnqueueWebsiteReAudit`:
```ts
// line 110-119 — yeni URL bulundu, lead'i update et
await prisma.lead.update({
  where: { id: lead.id },
  data: {
    websiteUrl: discoveredWebsite ?? null,
    hasWebsite: true,
    crawlStatus: currentNormalized === newUrl ? lead.crawlStatus : "PENDING",
    //          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //          ⚠️ BUG: currentNormalized=null, newUrl=non-null durumunda
    //                  PENDING'e geçer (true branch). Ama eğer URL Apify
    //                  çağrısından ÖNCE başka bir yolla (örn. discovery
    //                  worker'ın ikinci pass'i, Google Places enrichment)
    //                  set edildiyse, currentNormalized === newUrl olur ve
    //                  crawlStatus="NO_WEBSITE" KORUNUR.
  },
});
```

**Olası senaryolar:**
1. **Apify bu lead için hiç çalışmadı** (FineDine free tier'i Apify'a hit etmemiş olabilir).
2. **Apify çalıştı ama Phase 2.6 deploy'undan ÖNCE** (re-audit hook yoktu).
3. **Apify çalıştı, place.website döndü, lead.websiteUrl önceden başka bir yolla aynı URL'ye set edildiği için** `currentNormalized === newUrl` → `crawlStatus` korundu ("NO_WEBSITE") → re-audit enqueue oldu ama line 117 `crawlStatus` tutuldu — sonra `lastAuditedNormalized === newUrl` mi? Hayır, ilk audit hiç yapılmadıysa lastAuditedWebsiteUrl null. Line 102 `lastAuditedNormalized === newUrl`'de null !== "https://..." → re-audit enqueue.
4. **Re-audit enqueue oldu ama AgentRun çalışmadı/crash etti** (Round 1 #7 embedding crash döngüsü hâlâ aktif — rapor §0).

**Reproduction sorgusu:**
```sql
SELECT l.id, l.business_name, l.website_url, l.crawl_status, l.last_audited_website_url,
       (SELECT id FROM website_audits WHERE lead_id = l.id) AS audit_id
FROM leads l
WHERE l.website_url IS NOT NULL
  AND l.crawl_status = 'NO_WEBSITE'                -- mantıksal mismatch
  AND NOT EXISTS (SELECT 1 FROM website_audits WHERE lead_id = l.id);
-- Beklenen: S.O.S Coffee + The Drip + benzerleri tüm workspace'lerde
```

---

### Bug 2.F — `WEBSITE_EXPIRED` crawl_error variant eksik

**Tester alıntısı (Fable and Falcon):**
> *"Personalized message geliştirilerek güzelleştirilebilir çünkü, domaini expired olan bir site için sitenizi inceledik diye opener başlamamalı"*

**DB kanıtı:**
```
Lead              | http_status | title                                | crawl_error | reachable
Fable and Falcon  | 404         | "Squarespace - Website Expired"      | "UNKNOWN" ❌ | false
```

**Kod kanıtı:** `src/lib/crawler.ts:256-262`:
```ts
if (status >= 400) {
  features.crawlError = status === 401 || status === 403 ? "BOT_BLOCKED_4XX" : "UNKNOWN";
  //                                                                            ^^^^^^^^^
  //                                                            404 (expired) → "UNKNOWN"
  features.reachable = false;
} else {
  features.crawlError = null;
  features.reachable = true;
}
```

`src/types/index.ts:129-140` — `CrawlError` union:
```ts
export type CrawlError =
  | "TIMEOUT" | "DNS_ERROR" | "TLS_ERROR"
  | "BOT_BLOCKED_4XX" | "SERVER_5XX" | "REDIRECT_LOOP"
  | "PLAYWRIGHT_CRASH" | "EMPTY_RESPONSE"
  | "BLOCKED_BY_GUARD" | "SOCIAL_MEDIA_ONLY"
  | "UNKNOWN";
// ❌ "WEBSITE_EXPIRED" yok
```

**Provider parking patterns (test edilmesi gerekenler):**
- Squarespace expired: `<title>Squarespace - Website Expired</title>` + `<meta name="description" content="This site has expired...">`
- GoDaddy parked: `domaincontrol.com` host veya `Sedo Parking`
- Wix expired: `<title>This site is unavailable</title>` veya `wixsite.com/error/expired`
- Generic: title `/expired|parked|domain.*for sale|unavailable/i` + status 4xx
- Cloudflare error 1003 ("direct IP access not allowed")
- Namecheap parked: `namecheap.com/parked`

---

## 2. Root Cause Analysis

### 2.1 Path A vs Path B asimetrisi (Bug 2.A + 2.B)

`extractor.ts` üç paralel "is feature X present" checki yapıyor:

| Path | Field | Detection | Round 1 Yama | Round 2 Status |
|---|---|---|---|---|
| **A** | `hasBookingSystem` | provider OR (jsonLd + CTA word-boundary) | ✅ Multi-signal | ✅ |
| **B** | `hasOnlineReservation` | `RESERVATION_PATTERNS.some(p => fullHtml.includes(p))` | ❌ Yamalanmadı | ❌ |
| **C** | `hasQrMenu` | `QR_MENU_PATTERNS.some(p => fullHtml.includes(p))` (5-12 char) | ❌ Yamalanmadı | ❌ |

Path A'nın zaten `provider` (booking-detection.ts) içinde OpenTable/Resy/Tablein/TheFork hostnames + html-pattern kontrolü var (line 85-93, 90-93, 124-128, 129-133 booking-detection.ts). Yani **Path B'nin yaptığı her şeyi Path A zaten daha sıkı yapıyor.** Path B'nin var olma sebebi sadece "rezervasyon var mı, ama booking provider tanımadık" gibi çok dar bir kullanım — ve bunu yapmanın doğru yolu provider list'i genişletmek, substring fallback bırakmak değil.

Path C aynı şekilde — `QR_MENU_PATTERNS` aslında bir "provider list"; doğru detection link href hostname OR html-pattern olmalı (booking-detection.ts deseniyle). Substring of `fullHtml` hem CSS class adlarını hem JS bundle'larını hem rastgele template string'lerini yakalayan en gevşek yöntem.

**Asimetri sebebi:** Round 1 yaması spesifik olarak "Facebook → 'book' false-pos" sorunu için yazıldı; sadece `BOOKING_KEYWORDS` body-text path'ini multi-signal'e çevirdi. `RESERVATION_PATTERNS` ve `QR_MENU_PATTERNS` ayrı liste oldukları için yamadan muaf kaldı.

### 2.2 Backfill stratejisi neden yok? (Bug 2.C + 2.D)

Mevcut re-audit hook iki idempotency anahtarı kullanıyor:
1. `gmaps-deep.ts:102` — `lastAuditedNormalized === newUrl` ise skip
2. `gmaps-deep.ts:117` — `currentNormalized === newUrl` ise crawlStatus korunur

Her iki anahtar da **URL-based**. Audit logic değişimi (örn. social-url-gate eklenmesi) URL'yi değiştirmediği için bu hooks asla tetiklenmez. **Versiyon-bazlı bir stale-audit detection mekanizması yok.**

### 2.3 Null→non-null transition kaybedilebilir (Bug 2.E)

`maybeEnqueueWebsiteReAudit` sadece APIFY_GMAPS_DEEP worker'ından çağrılıyor (gmaps-deep.ts:334-338). Eğer:
- Apify hiç çalışmadıysa
- Apify Phase 2.6 deploy'undan önce çalıştıysa
- Apify çalıştı ama enqueue edilen WEBSITE_AUDITOR re-run crash ettiyse (Round 1 #7)
- Apify dışında bir yol websiteUrl set ettiyse (manuel düzenleme, başka bir Apify actor)

→ audit row asla oluşmuyor.

Discovery worker da websiteUrl set ediyor (initial Google Places import'tan); oradan da `maybeEnqueueWebsiteReAudit` benzeri bir hook gerekli. Şu an yok.

### 2.4 `crawl_error` taxonomy zayıf (Bug 2.F)

`crawler.ts:257` HTTP status ve message-based classification yapıyor (`classifyError(message)` line 59). Ama **HTML içeriğine bakmıyor**. Title `"Squarespace - Website Expired"` + status 404 → `"UNKNOWN"` döner. Downstream (opener-writer, sales-opportunity-scorer, lead-intelligence-brief) bu sinyali kullanamadığı için pitch context'i yanlış kalıyor.

---

## 3. Fix Önerisi

### Fix 2.A — `hasOnlineReservation` multi-signal'e geçiş

**Hedef dosya:** `src/lib/extractor.ts`

**Snippet (öneri, kod değiştirilmedi):**
```ts
// extractor.ts:521 — eski
const hasOnlineReservation = RESERVATION_PATTERNS.some((p) => fullHtml.includes(p));

// extractor.ts:521 — yeni (Path A simetrisinde)
function hasReservationHostname(links: { href: string }[], pattern: string): boolean {
  return links.some((l) => {
    try {
      const u = new URL(l.href);
      return u.hostname.toLowerCase().includes(pattern);
    } catch {
      return false;
    }
  });
}

const hasOnlineReservation =
  bookingProvider !== null ||                              // (a) tanınmış provider
  RESERVATION_PATTERNS.some((p) =>                          // (b) link href hostname'inde
    hasReservationHostname(allLinks, p)) ||
  (jsonLdReservation && ctaSignalsBooking);                 // (c) Path A'nın aynı çift-sinyali
```

**Neden:** Round 1'in `hasBookingSystem` yamasının davranışını birebir Path B'ye taşıyor; `bookingProvider !== null` zaten en güçlü sinyal — Path B'nin sıfırdan vermek istediği değer aynı.

**Edge case:** Eğer bir restoran OpenTable'ı sadece body text'inde anlatıyor ve linki yoksa (örn. "We use OpenTable for reservations — call us") → eski path true derdi, yeni path false. **Bu doğru davranış**: link/widget yoksa pratikte rezervasyon "yok".

### Fix 2.B — `QR_MENU_PATTERNS` URL gate + minimum pattern length

**Hedef dosya:** `src/lib/extractor.ts`

**Snippet (öneri):**
```ts
// extractor.ts:7-21 — pattern listesini ayır
const QR_MENU_LONG_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "finedinemenu", label: "FineDine" },
  { pattern: "menutiger",    label: "MenuTiger" },
  { pattern: "flipmenu",     label: "Flipmenu" },
  { pattern: "glorifood",    label: "Gloriafood" },
  { pattern: "flipdish",     label: "Flipdish" },
  { pattern: "digitalmenu",  label: "Digital Menu" },
];

// Kısa pattern'ler — sadece link href hostname'inde aranır
const QR_MENU_SHORT_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "plumqr",       label: "PlumQR" },
  { pattern: "yoello",       label: "Yoello" },
  { pattern: "tableqr",      label: "TableQR" },
  { pattern: "qr-menu",      label: "QR Menu" },
  { pattern: "qrmenu",       label: "QR Menu" },
];

// "e-menu" ve "emenu" tamamen kaldırılır — bağımsız bir QR menu sağlayıcısı
// (ör. e-menu.com.tr) ile substring match arasındaki false-pos oranı çok yüksek.
// Eğer e-menu spesifik provider eklenmek istenirse: { pattern: "e-menu.com",
// label: "E-Menu" } şeklinde HOSTNAME-only ekle.

// extractor.ts:506-518 — yeni detection
let hasQrMenu = false;
let detectedMenuTool: string | null = null;
let menuUrl: string | null = null;

for (const { pattern, label } of QR_MENU_LONG_PATTERNS) {
  if (fullHtml.includes(pattern)) {
    hasQrMenu = true;
    detectedMenuTool = label;
    const menuLink = allLinks.find(
      (l) => l.href.toLowerCase().includes(pattern) ||
             l.text.toLowerCase().includes("menu"),
    );
    if (menuLink) menuUrl = menuLink.href;
    break;
  }
}

if (!hasQrMenu) {
  for (const { pattern, label } of QR_MENU_SHORT_PATTERNS) {
    const linkMatch = allLinks.find((l) => {
      try {
        return new URL(l.href).hostname.toLowerCase().includes(pattern);
      } catch { return false; }
    });
    if (linkMatch) {
      hasQrMenu = true;
      detectedMenuTool = label;
      menuUrl = linkMatch.href;
      break;
    }
  }
}
```

**Neden:**
- `the-menu`, `themenu`, `site-menu`, `coffee-menu` gibi yaygın slug'lar 5-7 char `e-menu` / `emenu` / `qrmenu` substring'ini barındırıyor.
- Hostname check çok daha sıkı: `<a href="https://e-menu.com.tr/x">` gerçek bir provider, `<a href="/the-menu">` değil.
- Long pattern'ler (`finedinemenu`, `menutiger`) kendi başlarına yeterince spesifik — onlarda fullHtml substring çalışsın.

**Edge case:** Bazı sağlayıcılar JS-based widget olarak gömülüyor olabilir (DOM render sonrası bir `<iframe src="...">`). Ama Playwright zaten `waitFor "load"` + `waitForTimeout(2000)` (crawler.ts:191, 233) sonrası HTML çekiyor; bu durumda iframe src link/href olarak görünür ve hostname check yakalar.

### Fix 2.C — Backfill stratejisi (üç alternatif, §7'de trade-off)

**Tercih edilen kombinasyon: A (acil one-shot) + B (gelecek için sürdürülebilir).**

**Adım 1 — Acil one-shot script:** `scripts/backfill-social-url-audits.ts`

```ts
// Pseudocode (kod yazılmadı)
import { prisma } from "@/lib/prisma";
import { getAgentRunsQueue } from "@/lib/queues";
import { isSocialMediaUrl } from "@/lib/audit/social-url-gate";

async function main() {
  const stale = await prisma.websiteAudit.findMany({
    where: {
      crawlError: null,                  // gate fix öncesi
      crawlAttemptedAt: { lt: new Date("2026-05-02T00:00:00Z") }, // Round 1 deploy
    },
    select: { id: true, leadId: true, url: true, lead: { select: { workspaceId: true } } },
  });

  const targets = stale.filter((a) => isSocialMediaUrl(a.url));
  console.log(`Found ${targets.length} stale social-only audits to re-trigger`);

  for (const t of targets) {
    const run = await prisma.agentRun.create({
      data: {
        workspaceId: t.lead.workspaceId,
        leadId: t.leadId,
        userId: null,
        workerKind: "WEBSITE_AUDITOR",
        status: "PENDING",
        inputsJson: { triggeredBy: "round_2_backfill_social_url" } as never,
      },
      select: { id: true },
    });
    await getAgentRunsQueue().add(`agent-run-${run.id}`, { runId: run.id }, {
      attempts: 2, backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500, removeOnFail: 500,
    });
    // Rate-limit — Apify yok, sadece Playwright concurrency kontrolü.
    // BullMQ default concurrency = workers/index.ts kararına bağlı; 100ms gap yeterli.
    await new Promise((r) => setTimeout(r, 100));
  }
}
```

**Çağrı:** `tsx scripts/backfill-social-url-audits.ts` — manuel, prod'da bir kez.

**Etki kapsamı (tahmin):**
- FineDine workspace'inde 2 lead (Coffee Couch, YBA Brazil)
- Tüm aktif workspace'lerde tahminen 5-30 lead (cafe + restaurant niche'lerinde Instagram URL stamping yaygın)

**Maliyet:**
- Apify cost: **$0** (WEBSITE_AUDITOR Playwright/Cheerio, Apify çağırmıyor)
- Gemini cost: **$0** (auditor kendisi Gemini çağırmıyor; downstream re-fan tetiklenmez çünkü auditor `memoryWrites` döndürmüyor social-only kolda)
- Compute: ~50 lead × 25s nav timeout = ~21 dakika seri / Playwright concurrency=4 → ~5 dakika paralel
- Redis queue depth: ~50 job, geçici

**Adım 2 — Sürdürülebilir versiyon damgalama:**

Schema migration:
```prisma
model WebsiteAudit {
  ...
  // Phase 2.7 — extractor / gate logic version. Bumped whenever the
  // audit pipeline's signal interpretation changes in a way that
  // invalidates older rows. A periodic refresh job re-enqueues any
  // row with auditorVersion < AUDITOR_CURRENT_VERSION.
  auditorVersion        Int      @default(1) @map("auditor_version")
  ...
  @@index([auditorVersion])
}
```

`src/lib/agent-workers/website-auditor.ts`:
```ts
// Module-level constant. Bump when:
//   1. social-url-gate semantic değişir
//   2. extractor RESERVATION_PATTERNS / QR_MENU_PATTERNS davranışı değişir
//   3. crawl_error taxonomy genişler (ör. WEBSITE_EXPIRED eklenir)
export const AUDITOR_VERSION = 3;

// upsert payload'larına eklenir:
const baseFields = { ..., auditorVersion: AUDITOR_VERSION };
```

**Cron / periodic refresh** (Adım 3, opsiyonel):
- BullMQ repeat job veya Vercel cron
- 24h'de bir, `WHERE auditorVersion < AUDITOR_VERSION LIMIT 100` enqueue
- Rate-limited; bir gecede tüm prod'u yenilemesin

### Fix 2.D — Identity & SEO Instagram default mask

§3.9 — Backfill (2.C) gerçekleştiğinde `meta_description=null` ile yenilenecek; ek bir kod fix'i gerekmiyor. **Ama** A1 (UI mask agent) `isSocialPlatformDefaultMeta(meta)` regex fallback'i UI tarafına ekleyebilir — backfill bitmeden önce de doğru görünüm sağlanır.

**A1 ile bağı:** Backfill **OLMADAN** UI mask'ı sallarsak (regex `/log in to (Instagram|Facebook|TikTok)/i`), sonra backfill çalışırsa, UI mask gereksiz hale gelir ama zarar vermez. Deploy ordering: UI mask (A1) → ÖNCE, backfill (2.C) → SONRA. Regex daha şüpheli durumları (ör. WhatsApp profil tanıtım) da yakalar; defense-in-depth.

### Fix 2.E — Apify enrichment hook genişletme + discovery worker'a hook ekleme

**Hedef dosyalar:**
1. `src/lib/agent-workers/apify/gmaps-deep.ts` — mevcut `maybeEnqueueWebsiteReAudit`'in `crawlStatus` korunma branch'ini düzelt (line 117)
2. `src/workers/discovery-worker.ts` (ya da ilgili discovery hook) — websiteUrl set edildiğinde aynı helper'ı çağır

**Snippet — gmaps-deep.ts düzeltme:**
```ts
// gmaps-deep.ts:117 — eski
crawlStatus: currentNormalized === newUrl ? lead.crawlStatus : "PENDING",

// yeni — eğer audit row HİÇ yoksa, currentNormalized === newUrl olsa bile
// crawlStatus'u PENDING'e zorla
const auditExists = await prisma.websiteAudit.findUnique({
  where: { leadId: lead.id },
  select: { id: true },
});
const shouldKeepStatus = currentNormalized === newUrl && !!auditExists;
crawlStatus: shouldKeepStatus ? lead.crawlStatus : "PENDING",
```

**Snippet — discovery worker'a hook ekleme:**
```ts
// Pseudocode — discovery worker'ın "websiteUrl bulundu" yolu
// (yeri: Google Places enrichment veya placeUri scrape sonrası)
import { maybeEnqueueWebsiteReAudit } from "@/lib/agent-workers/apify/gmaps-deep";
//                                          ^^^^^^^ helper'ı export etmek gerek

await maybeEnqueueWebsiteReAudit({
  workspaceId: lead.workspaceId,
  lead: { id: lead.id, websiteUrl, lastAuditedWebsiteUrl, crawlStatus },
  discoveredWebsite: newWebsiteUrl,
});
```

**Alternatif — DB trigger:** Postgres trigger `BEFORE UPDATE ON leads WHEN OLD.website_url IS NULL AND NEW.website_url IS NOT NULL` notification yayınlasın. Worker bunu BullMQ'ya enqueue etsin. Daha basit ama Prisma migration history yok bu projede; manuel SQL apply gerekiyor (`prisma/migrations/apply.ts` örüntüsü).

**Tercih edilen:** `maybeEnqueueWebsiteReAudit` helper'ını shared util'e taşı, hem gmaps-deep.ts hem discovery worker'dan çağır.

### Fix 2.F — `WEBSITE_EXPIRED` crawl_error variant

**Hedef dosyalar:**
1. `src/types/index.ts:129-140` — union'a `"WEBSITE_EXPIRED"` ekle
2. `src/lib/crawler.ts:256-262` — title regex + provider pattern detection

**Snippet — types/index.ts:**
```ts
export type CrawlError =
  | "TIMEOUT" | "DNS_ERROR" | "TLS_ERROR"
  | "BOT_BLOCKED_4XX" | "SERVER_5XX" | "REDIRECT_LOOP"
  | "PLAYWRIGHT_CRASH" | "EMPTY_RESPONSE"
  | "BLOCKED_BY_GUARD" | "SOCIAL_MEDIA_ONLY"
  | "WEBSITE_EXPIRED"     // ← yeni: domain expired / parked / unavailable
  | "UNKNOWN";
```

**Snippet — crawler.ts:**
```ts
// crawler.ts:243 (HTML extraction'dan sonra, line 247'den önce eklenir)
const expiredTitleRe = /\b(expired|parked|unavailable|domain (is )?for sale)\b/i;
const expiredHostHints = [
  "domaincontrol.com",     // GoDaddy parking
  "sedoparking.com",       // Sedo
  "bodis.com",             // Bodis parking
  "parkingcrew.net",
  "above.com",
];

let isExpiredOrParked = false;

// Provider-specific patterns first (yüksek precision)
if (status === 404) {
  const lowerHtml = html.toLowerCase();
  if (
    lowerHtml.includes("squarespace - website expired") ||
    lowerHtml.includes("this site has expired") ||
    lowerHtml.includes("domain has expired") ||
    lowerHtml.includes("wixsite.com/error/expired")
  ) {
    isExpiredOrParked = true;
  }
}

// Title regex fallback (daha geniş)
if (!isExpiredOrParked && status >= 400 && status < 500) {
  const titleText = $('title').first().text().trim();
  if (expiredTitleRe.test(titleText)) {
    isExpiredOrParked = true;
  }
}

// Hostname (parked page hostnames don't always 404 — bazıları 200 döner)
if (!isExpiredOrParked) {
  try {
    const finalUrl = response.url();
    const finalHost = new URL(finalUrl).hostname.toLowerCase();
    if (expiredHostHints.some((h) => finalHost.includes(h))) {
      isExpiredOrParked = true;
    }
  } catch { /* ignore */ }
}

// crawler.ts:256-262 — yeni branch'leme
if (isExpiredOrParked) {
  features.crawlError = "WEBSITE_EXPIRED";
  features.reachable = false;
} else if (status >= 400) {
  features.crawlError = status === 401 || status === 403
    ? "BOT_BLOCKED_4XX"
    : "UNKNOWN";
  features.reachable = false;
} else {
  features.crawlError = null;
  features.reachable = true;
}
```

**Downstream tüketim (opener-writer):** Bu fix tek başına UI'ı düzeltmez; opener-writer prompt'una `audit.crawlError === "WEBSITE_EXPIRED"` durumunda "domaini şu an expired durumda" branch'i eklenmeli. Ama bu agent-3 kapsamında (opener-writer); bizim cluster sadece sinyal üretimini düzeltir.

---

## 4. Effort + Risk

| Fix | Effort (saat) | Risk | Blast radius | Test ihtiyacı |
|---|---|---|---|---|
| 2.A — `hasOnlineReservation` multi-signal | 4 | Düşük | extractor unit; tüm restoran lead'leri | unit (snapshot fixture: opentable-text-only-no-link / opentable-link / preconnect-only) |
| 2.B — QR_MENU URL gate + e-menu/emenu kaldır | 4 | Düşük-orta | extractor unit; cafe + restoran lead'leri | unit (the-menu false-pos test, finedinemenu pos test, e-menu.com.tr provider test) |
| 2.C step 1 — One-shot backfill script | 3 | Düşük (idempotent — yeniden çalıştırılabilir) | sadece social-only audit row'ları (~5-30 satır prod-wide) | dry-run mode ile sayım önce |
| 2.C step 2 — `auditor_version` schema + bump | 6 | Orta (db:push + tüm WebsiteAudit row'ları update) | her audit row'a 1 sütun (`auditor_version int default 1`) | schema migration smoke test |
| 2.C step 3 — Periodic refresh cron | 6 | Orta (Apify cost değil ama Playwright queue depth) | tüm workspace'ler, rate-limited | dry-run + soft launch (LIMIT 10/gün) |
| 2.D — Instagram default UI mask | 2 | Çok düşük | Lead detail Identity & SEO bölümü | snapshot (regex match for default copy) |
| 2.E step 1 — gmaps-deep crawlStatus düzeltme | 2 | Düşük | sadece audit-row-yoksa branch | unit (audit yok + URL aynı senaryosu) |
| 2.E step 2 — Discovery worker hook | 4 | Orta (yeni call site) | discovery flow'u; ilk import zamanlaması | integration (discovery → audit handoff) |
| 2.F — WEBSITE_EXPIRED detection | 4 | Düşük | crawler return path; tüm 4xx audit'ler | unit (Squarespace expired fixture, GoDaddy parked fixture, normal 404 fixture) |
| **TOPLAM (P0 alt-küme)** | **35 saat** | — | — | — |

**Risk notları:**
- **2.B kritik regresyon riski:** Eğer mevcut prod cafe lead'lerinden bazıları gerçekten `e-menu.com.tr` veya benzeri kullanıyorsa, hostname-only check eklemek geçersizleştirir. **Mitigation:** Backfill öncesi DB'de `SELECT count(*) FROM website_audits WHERE raw_features_json->>'detectedMenuTool' = 'E-Menu'` çalıştır; sayı ≥ 5 ise her birini manuel review et (büyük olasılıkla hepsi false-pos olduğu için yeni davranış doğru).
- **2.C step 2 schema risk:** `auditor_version int default 1` non-null sütun → tüm mevcut row'lar 1 değerini alır → ilk bump'ta TÜMÜ stale → 2.C step 3 cron mass-enqueue. **Mitigation:** Cron'a günlük LIMIT 100 koyarak yavaş soft-rollout.
- **2.E race condition:** Aynı lead için Apify + discovery worker eşzamanlı websiteUrl update yaparsa, iki re-audit AgentRun oluşur. **Mitigation:** AgentRun create'de `inputsJson.triggeredBy` farklı; en üstteki BullMQ job kazanır, ikinci PENDING idle kalır. agent_runs cleanup (A4 ile koordineli) bunu temizleyecek.

---

## 5. Dependencies

### 5.1 A1 (UI mask agent) ile bağı

**A1 kapsamı (varsayım):** Lead detail Identity & SEO bölümünde `meta_description` Instagram/Facebook default mesajını UI tarafında maskeleyecek (`isSocialPlatformDefaultMeta` regex).

**Bizim kümeyle kesişim:** §3.9 (Bug 2.D). Backfill (2.C) prod'da çalıştığında DB'deki Instagram default meta'lar `null`'a döner; UI mask gereksizleşir ama zarar vermez (defense-in-depth).

**Deploy ordering:**
1. **A1 UI mask DEPLOY** — ÖNCE (regex fallback yapsın). Risk: backfill bekleyen kullanıcılar zaten doğru görünüm görür.
2. **2.C backfill SCRIPT RUN** — SONRA (DB tarafında temizlik). Risk: backfill bitmeden A1 mask devrede; sorun yok.
3. **2.C step 2 (auditor_version)** — A1 deploy + backfill run sonrası. Yeni audit'ler `version=3` ile yazılır; eski `version=1`'ler periodic refresh'le toplanır.

**Ortak commit risk:** Eğer A1 ve 2.C aynı PR'da gelirse, A1'in regex'i 2.C backfill'in tetiklediği yeni `null` meta'lar için zaten doğru çalışır (regex `null`'da match etmez). PR ayrı tutmak hem rollback'i hem de gözlemi kolaylaştırır.

### 5.2 A4 (worker idempotency cleanup) ile bağı

**A4 kapsamı (varsayım):** `agent_runs` tablosunda PENDING/FAILED kalmış orphan satırların temizliği + idempotency key (örn. `runs.dedupKey`) eklenmesi.

**Bizim kümeyle kesişim:** 2.C step 1 backfill script'i 5-30 yeni AgentRun PENDING satırı yaratır. Bunlar bittikçe SUCCEEDED'a döner; ama Round 1 #7 embedding crash döngüsü hâlâ aktif (rapor §0 / §6 P0.7) → bazıları FAILED kalabilir.

**Koordinasyon ihtiyacı:**
1. **Backfill'i A4 öncesi koşturmak güvenli mi?** Evet; AgentRun row'ları normal işlenir, FAILED olanlar A4'ün cleanup'ında alınır.
2. **A4 dedup key kullanırsa**, backfill'in `inputsJson.triggeredBy = "round_2_backfill_social_url"` field'ı **aynı lead için tekrar çalıştırmaya çalışırsa** dedup'a takılır mı? **Tasarım gereksinimi:** A4 dedup key, `(workspaceId, leadId, workerKind, triggeredBy)` tuple'ı yerine sadece `(workspaceId, leadId, workerKind)` üzerinden çalışırsa, backfill ikinci çalıştırması engellenir (idempotency kazancı). Ama eğer triggeredBy farklılığı dedup'tan muafsa, manuel re-run ihlali yaratır. **Öneri:** A4 dedup key TTL = 1 saat ile kısa tutulsun; backfill bir gün önce çalıştırılır, ertesi gün manuel re-run yine mümkün olur.
3. **agent_runs cleanup grace period:** Backfill enqueue ettiği saatten itibaren en az 24h beklenmeli (Playwright nav timeout 25s + retry); sonra A4 stale-PENDING cleanup'ı koşmalı.

**Sıra önerisi:** Backfill (1 gün) → 24h gözlem → A4 cleanup → version stamping (2.C step 2).

---

## 6. Open Questions

1. **`maybeEnqueueWebsiteReAudit` helper'ını export etmek güvenli mi?** Şu an `gmaps-deep.ts:85-178` private function. Discovery worker'a paylaşmak için `src/lib/audit/re-audit-hook.ts` gibi shared util'e taşımak en temizi. Side effect'leri (lead update + AgentRun create + queue add) helper içinde encapsulate; ama transaction sınırı yok — DB write + queue add arası crash → orphan AgentRun. Mevcut hâli aynı; mevcut behavior parity korunur.

2. **`auditor_version` schema bump db:push güvenli mi?** Schema'da `default(1)` Postgres'in mevcut row'ları sessizce backfill etmesini sağlar; tablo lock kısa. Ancak `WebsiteAudit` index'leri var (`@@index([bookingProvider])` line 940); büyük tablolarda `db:push` davranışı (özellikle `prisma db push --accept-data-loss` flag'i) sorulabilir. **Güvenli yol:** Önce `prisma migrate diff` ile SQL üret, manuel apply.

3. **`WEBSITE_EXPIRED` detection HTML provider listesi nereye yazılacak?** `crawler.ts` zaten 365 satır; expired-page detection ayrı dosya (`src/lib/audit/parked-domain-gate.ts`) olarak parçalanırsa daha test edilebilir. Detail karar refactor scope'una bağlı.

4. **Backfill'i tüm workspace'ler için mi, sadece FineDine için mi?** Tüm aktif workspace'ler — Round 1 social-url-gate yaması global'di, retroactive uygulama da global olmalı. FineDine sadece test workspace'i; başka workspace'lerde de stale Instagram audit'leri var olabilir (rapor §1.2 dışı, ama tahmin makul).

5. **`hasOnlineReservation` Path B kaldırılması yerine sıkılaştırma mı?** Tamamen kaldırma — Path A (hasBookingSystem multi-signal) zaten provider list (booking-detection.ts) ile geniş; hasOnlineReservation alanını kaldırmak rawFeaturesJson tüketicilerini (UI website-intelligence-panel.tsx:1147-1177 RestaurantSignalsSection) etkiler. **Tercih edilen:** sıkılaştır, alanı koru. Aynı simetri için Path A'yı UI'ın da single-source-of-truth yapması (§3.4 C alt-fix) ayrı bir değişiklik — **agent-1 (UI mask) kapsamı.**

6. **Periodic cron refresh için BullMQ repeat job mı, Vercel cron mu?** Workspace rule (architecture.mdc): "Don't add new BullMQ queues; extend AI Core". Cron BullMQ repeat olmadan da çözülebilir; Vercel cron route handler `agent_runs` enqueue eder. Daha basit, queue topology'yi büyütmüyor.

---

## 7. Backfill Strategy Trade-off Tablosu (§3.5)

| Kriter | A — One-shot script | B — `auditor_version` field | C — Periodic stale-audit cron (30+ gün) |
|---|---|---|---|
| **Schema migration gerekli mi?** | Hayır | Evet (`auditor_version int default 1` + index) | Hayır (yalnız mevcut `crawl_attempted_at` kullanır) |
| **Hız (deploy → fix)** | ⚡ Aynı gün (30 dk script run) | 🕐 1-2 gün (migration + version stamping) | 📅 30 gün (eski audit'ler doğal yaşlanma sonrası) |
| **İdempotency** | Manuel; aynı script ikinci run'da aynı social audit'leri yine enqueue eder (filter: `crawlError IS NULL`) | Otomatik; `version < CURRENT` koşulu kendiliğinden idempotent | Otomatik; `crawl_attempted_at < now() - 30d` koşulu |
| **Future-proof** | ❌ Her yeni gate / extractor değişimi için yeni script | ✅ Sadece `AUDITOR_VERSION` bump → otomatik retroaktif | ⚠️ Sadece zaman-bazlı; logic değişiminin acil retroaktif uygulanmasını sağlamaz |
| **Apify cost** | $0 (Playwright/Cheerio) | $0 | $0 |
| **Compute cost** | ~5 dk Playwright (50 lead × 25s nav timeout / 4 concurrency) | ~5 dk per bump | Sürekli düşük yük (LIMIT 100/gün) |
| **Gemini cost** | ~$0.13 (50 lead × ~20K token re-fan eğer chain auto-trigger ederse) | ~$0.13 per bump | ~$2.50/ay (1000 lead × $0.0025) |
| **Risk: yanlış audit'leri yeniler** | Düşük (filter precise) | Düşük (version check) | Orta (zaman-bazlı; ada-değişmeyen content gereksiz yenilenir) |
| **Risk: prod queue depth** | ~30 sn'lik enqueue burst | Bump anında ~tüm DB; LIMIT gerekir | Tek seferlik LIMIT 100 batch |
| **Round 1 `social-url-gate` retroaktivitesi** | ✅ TAM çözüm | ✅ TAM çözüm (V2 stamping) | ⚠️ KISMI çözüm (sadece 30+ gün eski audit'ler) |
| **Round 2 fix'leri (2.A, 2.B, 2.F) için kullanım** | ❌ Her fix için yeni script gerekir | ✅ Tek bump kelimesi yeterli | ⚠️ Yavaş; spec değişikliği için uygun değil |
| **Önerilen kullanım** | Acil Round 1 carryover (2 hafta içinde) | Sürdürülebilir altyapı (1 ay içinde) | Uzun vadeli content drift / DNS değişimleri (3 ay içinde) |

**Tercih: A + B (paralel kombo).** A acil hot-fix; B ileride spec değişiminde tekrar tekrar A yazmaktan kurtarır. C opsiyonel (30+ gün stale audit zaten Round 2'de kanıtlanmadı; ileride content drift için).

**Senaryo A+B birleşimi:**
1. Hafta 1: A script — Coffee Couch + YBA Brazil + 5-30 prod-wide social audit yenilendi. Round 1 carryover kapatıldı.
2. Hafta 2: B migration deploy + AUDITOR_VERSION = 2 (mevcut yamalar dahil). Tüm yeni audit row'ları version=2.
3. Hafta 3-4: 2.A + 2.B + 2.F deploy → AUDITOR_VERSION = 3 bump. Periodic refresh (eğer C de eklenirse) stale row'ları toplar; A script gereksiz hale gelir çünkü B+C kombo aynı işi yapar.
4. Aylık: C cron (eğer eklenirse) 30+ gün stale audit'leri yeniler — backstop.

---

## 8. Deploy Sequence Checklist (özet)

1. **Pre-flight (gözlem):**
   - `SELECT count(*) FROM website_audits WHERE raw_features_json->>'detectedMenuTool' = 'E-Menu'` → 2.B regresyon için baseline
   - `SELECT count(*) FROM website_audits WHERE raw_features_json->>'hasOnlineReservation' = 'true'` → 2.A baseline
   - `SELECT count(*) FROM website_audits WHERE url ~ '(instagram|facebook|tiktok)\.(com|net)' AND crawl_error IS NULL` → 2.C scope
   - `SELECT count(*) FROM leads WHERE website_url IS NOT NULL AND crawl_status = 'NO_WEBSITE' AND id NOT IN (SELECT lead_id FROM website_audits)` → 2.E scope

2. **Faz 1 (UI defense):**
   - A1 UI mask deploy (Instagram default meta regex)

3. **Faz 2 (kod fix'leri, single PR — küme: 2.A, 2.B, 2.F):**
   - extractor.ts QR/reservation multi-signal
   - crawler.ts WEBSITE_EXPIRED detection
   - types/index.ts CrawlError union
   - Unit testler (snapshot fixture)
   - PR review + merge

4. **Faz 3 (backfill — 2.C step 1):**
   - `tsx scripts/backfill-social-url-audits.ts --dry-run` → sayım doğrulama
   - `tsx scripts/backfill-social-url-audits.ts` → enqueue
   - 24h gözlem (agent_runs SUCCEEDED rate)

5. **Faz 4 (auditor_version — 2.C step 2):**
   - schema.prisma bump → npm run db:push (off-peak)
   - AUDITOR_VERSION = 3 const'u tüm audit'lere damga (deploy)

6. **Faz 5 (gmaps-deep + discovery hook — 2.E):**
   - gmaps-deep.ts crawlStatus fix
   - discovery worker hook
   - Integration test (yeni lead null→non-null transition)

7. **Faz 6 (opsiyonel — 2.C step 3):**
   - Periodic cron refresh (LIMIT 100/gün) — soft launch
   - 1 hafta gözlem; LIMIT artır

---

**Plan sonu.** Bu doc kapsamı: extractor + audit pipeline. UI rendering (§3.4 C alt-fix `RestaurantSignalsSection` ile `ConversionSection` single-source-of-truth) **agent-1**'de; opener-writer `crawlError` integration **agent-3**'te (varsayım); worker idempotency cleanup **agent-4**'te.
