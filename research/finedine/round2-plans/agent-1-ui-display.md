# Agent 1 — UI Display

> Round 2 Camden auditörü görüşlerinin **kod-seviyesinde doğrulanması ve fix planı**. Source code DEĞİŞTİRİLMEDİ — bu doküman sadece markdown plan.

---

## 0 · Cover

### Cluster scope
LeadAC `src/app/app/leads/[id]/page.tsx` ve bağlı componentlerde **rep'in lead detayını gözüyle taradığı** alanlardaki UI display hataları:

1. **§3.1** — Tier ↔ Package badge çelişkisi (12/12 lead'de "Tier: Starter" + "Package: Premium")
2. **§3.2** — `HeroPriorityStrip`'te `wedges[]` ve `reasonCodes[]` dedupe yok (No WhatsApp ×2, No contact form ×2, No website + Weak website)
3. **§3.3** — `lead.primaryType` ham snake_case basılıyor (`coffee_shop`, `food_store`, `acai_shop`)
4. **§3.9** — Identity & SEO Instagram default meta_description sızıyor ("Create an account or log in to Instagram…")
5. **§7.6 (cluster ext.)** — Low-confidence sticky banner katmanı eksik (sub-niche < 0.5, social-only audit, expired domain) — rep yanlış veriyle pitch yapıyor

### Rapor referansları
- `research/finedine/beta-test-round-2-camden-report.md` §3.1 (sat. 133–207), §3.2 (210–296), §3.3 (300–362), §3.9 (770–814), §5 (1023–1046), §6 P0/P1 (1054–1080)

### İncelenen dosyalar (8)
| # | Dosya | Hangi bug için |
|---|---|---|
| 1 | `src/app/app/leads/[id]/page.tsx` | §3.1, §3.2, §3.3, §7.6 |
| 2 | `src/lib/labels.ts` | Humanize util eklenecek yer |
| 3 | `src/components/app/website-intelligence-panel.tsx` | §3.9 (IdentitySection) |
| 4 | `src/components/app/niche-product-fit-card.tsx` | §3.2 / §3.4 ile dolaylı (audit-null path) |
| 5 | `src/lib/agent-workers/sales-opportunity-scorer.ts` | §3.1 (deprecated `suggestedOffer` kanıtı) |
| 6 | `src/app/api/leads/[id]/route.ts` | §3.1 (route fallback yorumu) |
| 7 | `src/components/app/leads/dossier/DossierSourceDrawer.tsx` | §3.3 (4. primaryType render site) |
| 8 | `src/components/public-directory/directory-shell.tsx` | §3.3 (5. primaryType render site, public surface) |

### TL;DR root cause
- **§3.1**: `suggestedOffer` field'ı **resmi olarak deprecated** (sales-opportunity-scorer.ts:336–340 yorumu). Scorer artık yazmıyor; create'te schema default `STARTER` ile başlıyor, update'te dokunulmuyor → 12/12 lead'de `STARTER`. UI hâlâ bu deprecated alanı bağımsız bir badge olarak çiziyor (page.tsx:963–967).
- **§3.2**: `HeroPriorityStrip` `wedges` (deterministic audit) ve `reasonCodes` (Gemini analist) listelerini ayrı ayrı `.map()` ile basıyor (page.tsx:982–1000); aralarında dedupe yok.
- **§3.3**: `lead.primaryType` Google Places'ten gelen ham snake_case değer. 5 farklı render sitesinde (`page.tsx:1052`, `page.tsx:1598`, `DossierSourceDrawer.tsx:251`, `source-registry.tsx:665`, `directory-shell.tsx:171`) hiçbir humanize çağrısı yok.
- **§3.9**: `IdentitySection` `audit.metaDescription || <Muted>Missing</Muted>` mantığı (panel sat. 730–736) sosyal platform default mesajını "missing" saymıyor; literal string render ediyor.
- **§7.6**: SubNicheOverride'da düşük confidence için bir warning kutusu var (page.tsx:2254–2258) ama bu kutu sadece **Website tab'ının altındaki** sub-niche kartında — overview tab'ında **görünmüyor**. Social-only audit ve expired-domain için sticky uyarı **hiç yok**; rep aynı sayfada Instagram bio'sunu işletme tanıtımı, expired site'ı "running website" sanıyor.

---

## 1 · Sorun Inventory

### Bug 1 — §3.1 Tier ↔ Package mismatch

**Tester alıntıları (8 lead'de aynı şikayet, raporda sat. 152–156):**
- One Shot Coffee: *"Tier bölümünde starter gözükmesi doğru ancak bu bölüm enterpriselarda dahi starter olarak gözükmekte"*
- Glass Coffee: *"Tier Starter olmasına rağmen önerilen paket yine premium olarak verilmiş … bu iki analiz de çakışmakta"*
- Il botanico: *"premium bu işletme için oldukça fazla ve aynı zamanda tier bölümünde starter olarak verilmesi de doğru bir analiz ancak bu iki analiz de çakışmakta"*
- Coffee Couch, S.O.S Coffee, Fable and Falcon, Camden Coffee Roastery, The Drip — aynı.

**DB kanıtı (rapor §1.3 sat. 92–105 + §3.1 sat. 137–151):** 12/12 lead'de `sales_opportunities.suggested_offer = 'STARTER'`, `recommended_package_id` ise Premium ($119/ay) veya Enterprise (Black Sheep + Blank Street).

**Kod kanıtı (renderer):**

```963:967:src/app/app/leads/[id]/page.tsx
{opp?.suggestedOffer && (
  <Badge variant="outline" className="text-[11px] font-normal border-white/10 bg-white/5">
    Tier: {OFFER_LABELS[opp.suggestedOffer] ?? opp.suggestedOffer}
  </Badge>
)}
```

Hemen üstündeki Package badge'i (page.tsx:958–962) bağımsız bir kaynaktan (`opp.recommendedPackage.name`) okuyor, dolayısıyla yan yana iki tutarsız etiket çıkıyor.

**Kod kanıtı (writer — smoking gun):**

```336:354:src/lib/agent-workers/sales-opportunity-scorer.ts
// suggestedOffer + expectedPriceBand are deprecated (P0.4). The
// dossier owns the package recommendation now; the column survives
// for legacy data but the write path leaves it at the schema
// default (STARTER) on first create and untouched on update so we
// can't accidentally pin a stale tier on a re-analyze.
await prisma.salesOpportunity.upsert({
  where: { leadId },
  create: {
    leadId,
    opportunityScore: finalScore,
    reasonCodes: mergedReasons,
    // ... NO suggestedOffer field set ...
    recommendedPackageId,
    recommendedPackageReason,
    status: "NEW",
  },
  update: { /* ... NO suggestedOffer ... */ },
});
```

`suggestedOffer` resmen deprecated; sadece **legacy fallback** olarak hâlâ tabloda. UI'da bağımsız badge olarak çizilmesi yanlış. Ayrıca `RecommendedPackageCard` (page.tsx:1677–1736) `pkg` null olduğunda `fallbackOffer` (= `suggestedOffer`) ile geri çekilmek için doğru pattern'i zaten uyguluyor — `HeroPriorityStrip` aynı pattern'i benimsemiyor.

`suggestedOffer` field'ı toplam 5 yerde okunuyor (rapor §referans dışı, kendi grep'imden):
- `page.tsx:730` `RecommendedPackageCard` `fallbackOffer` (✅ doğru kullanım — pkg null ise gösterilir)
- `page.tsx:854` aynı, outreach tab
- `page.tsx:943, 963–967` `HeroPriorityStrip` (❌ yanlış — bağımsız badge)
- `src/lib/agent-workers/dossier-summary.ts`, `opener-writer.ts`, `lib/scoring.ts`, `app/deals/types.ts`, `lookalikes/route.ts`, `watchlist-export.ts`, `useLeadsQuery.ts`, `source-registry.tsx` — tümü read-path; deprecated kullanımları ayrıca audit edilmeli (P2).

**Reproduction steps:**
1. Lead oluştur → SUBVERTICAL_CLASSIFIER + SCORER + PACKAGE_SELECTOR çalışsın.
2. `/app/leads/<id>` aç → "At a glance" stripinde "Package: Premium" + "Tier: Starter" yan yana görünür.
3. SQL: `SELECT suggested_offer, recommended_package_id FROM sales_opportunities WHERE lead_id = '…';` → `STARTER` + Premium UUID döner.

---

### Bug 2 — §3.2 Glance / Wedge duplication

**Tester alıntıları (10/12 lead, raporda sat. 247–256):**
- One Shot Coffee: *"At a glance bölümünde No Contact bölümü yine çakışmakta"*
- Glass Coffee: *"No whatsapp ifadeleri at a glance bölümünde yine çakışmakta"*
- Coffee Couch: *"No Whatsapp ve No contact form ifadesi At a glance bölümünde yine duplication yapmış"*
- Blank Street: *"No contact form bölümündeki duplication sorunu yine devam etmekte … No whatsapp bölümünde de duplication oluşmuş"*
- The Drip: *"at a Glance bölümünde No website, doğru olmasına rağmen aynı zamanda 'Weak website adında başka bir glance var' — bu hem duplication hem hata"*

**Kod kanıtı:**

```936:1000:src/app/app/leads/[id]/page.tsx
const wedges: string[] = [];
if (audit?.hasWhatsappLink === false) wedges.push("No WhatsApp");
if (audit?.hasContactForm === false) wedges.push("No contact form");
if (raw?.hasQrMenu === true) wedges.push("QR menu detected");
// ... (showStrip gating omitted) ...
{wedges.map((w) => (
  <Badge key={w} variant="outline" /* ... */>{w}</Badge>
))}
{reasonCodes.map((code) => (
  <Badge key={code} /* ... */>
    {REASON_LABELS[code] ?? code.replace(/_/g, " ")}
  </Badge>
))}
```

`reasonCodes` Gemini scorer'ından geliyor; içinde `"no_whatsapp"` → `REASON_LABELS["no_whatsapp"]` = `"No WhatsApp"` — yani **birebir** wedges'in ürettiği "No WhatsApp" string'i. `key` değerleri farklı (`"No WhatsApp"` vs `"no_whatsapp"`), dolayısıyla React'in dedupe'i çalışmıyor.

**The Drip vakası (No website + Weak website):** Rapor §3.2 sat. 257–263. `reason_codes` array'inde **hem** `"no_website"` (= "No Website") **hem** `"high_rating_weak_site"` (= "High Rating, Weak Site") var. Mantıksal olarak çelişkili: site yoksa weak olamaz. Yine de iki ayrı reasonCode badge'i basılıyor — UI dedupe katmanı olmadığı için.

**Reasonağı Round 1 sonrası eklenen `reasonCodes` array dedupe'ı (sat. 924–930)** sadece **set içinde tekrar eden string'leri** ele alıyor; aynı semantik kavramın iki ayrı path'ten geldiği durumu örtmüyor:

```924:930:src/app/app/leads/[id]/page.tsx
const reasonCodes = Array.from(
  new Set(
    Array.isArray(opp?.reasonCodes)
      ? (opp.reasonCodes as unknown[]).filter(/* ... */)
      : [],
  ),
).slice(0, 5);
```

**Reproduction steps:**
1. Restoran-tech workspace lead'i scorer'a gönder; audit `hasWhatsappLink=false`, `hasContactForm=false` döndürsün.
2. Gemini reasonCodes içinde `"no_whatsapp"` ve `"no_contact_form"` üretiyor (FineDine'da %100 üretiliyor).
3. Strip'te 4 badge görünür: "No WhatsApp" (wedge) + "No contact form" (wedge) + "No WhatsApp" (reason) + "No Contact Form" (reason).

---

### Bug 3 — §3.3 `primaryType` ham snake_case

**Tester alıntıları (rapor sat. 330–334):**
- Fable and Falcon: *"Coffee Shop ibaresi yine coffee_shop olarak yazılmış"*
- The Drip, Camden Coffee Roastery, YBA Brazil: aynı (acai_shop dahil)
- Black Sheep: *"kafe food_store olarak analiz edilmiş, hem de yanlış text fontuyla yazılmış"*

**DB kanıtı:** 12 lead'in `primary_type` değerleri: `coffee_shop` ×7, `cafe` ×2 (zaten okunaklı), `acai_shop` ×1 (YBA), `food_store` ×1 (Black Sheep — Google Places yanlış sınıflandırması).

**Kod kanıtı (5 render sitesi):**

```1050:1053:src/app/app/leads/[id]/page.tsx
const chips: { label: string; icon?: typeof Star }[] = [];
if (lead.borough) chips.push({ label: lead.borough });
if (lead.primaryType) chips.push({ label: lead.primaryType });  // ← ham
if (lead.businessStatus && lead.businessStatus !== "OPERATIONAL") chips.push({ label: lead.businessStatus });
```

```1597:1599:src/app/app/leads/[id]/page.tsx
<RailRow label="Type">
  <span className="text-[14px] text-white/85 truncate">{lead.primaryType || "—"}</span>
</RailRow>
```

```249:253:src/components/app/leads/dossier/DossierSourceDrawer.tsx
<Field label="Type" value={l.primaryType ?? "—"} />
```

```663:666:src/components/app/leads/dossier/source-registry.tsx
if (sources.lead.primaryType) m.push({ label: "Type", value: sources.lead.primaryType });
```

```169:172:src/components/public-directory/directory-shell.tsx
{item.primaryType && <span>{item.primaryType}</span>}
```

`src/lib/labels.ts` içinde **hiçbir humanize util yok** (grep doğruladı: `humanize|titleCase|isSocialPlatform` → 0 match).

**"Yanlış font" gözlemi (Black Sheep):** Rep monospace görüntüsünden şikayet ediyor — değer ham snake_case olduğu için (`food_store`) okuyucu `<code>` sandı. Aslında her iki render sitesi (chip ve RailRow) `text-[14px] text-white/85` Inter sans-serif kullanıyor; sadece `_` karakteri ve küçük harfli okunuş "kod gibi" görünüyor.

**Reproduction steps:**
1. Google Places'ten `primary_type=food_store` döndüren bir cafe oluştur.
2. Lead detail aç → hero chip'te `food_store`, sağ rail'de `food_store`, dossier drawer'ında `food_store`, public directory shell'inde `food_store` görünür.

---

### Bug 4 — §3.9 Identity & SEO Instagram default meta_description sızması

**Tester alıntısı (rapor sat. 791):**
- Coffee Couch: *"Website olmamasına rağmen Instagram baz alındığı için maalesef Identify&Seo bölümü Instagram'ın ana tanıtımını veriyor."*

**DB kanıtı (rapor §3.9 sat. 773–786):**
- Coffee Couch audit row: `url=https://www.instagram.com/couch_coffee/`, `title="Instagram"`, `meta_description="Create an account or log in to Instagram - Share what you're into with the people who get you."`
- YBA Brazil: aynı pattern, `https://instagram.com/ybabrazil`.

**Kod kanıtı:**

```730:738:src/components/app/website-intelligence-panel.tsx
function IdentitySection({ audit }: { audit: WebsiteAudit }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: "Title", value: audit.title || <Muted>Missing</Muted> },
    {
      label: "Meta description",
      value: audit.metaDescription || <Muted>Missing</Muted>,
    },
    { label: "H1", value: audit.h1 || <Muted>Missing</Muted> },
  ];
```

`||` operatörü yalnızca falsy (null / "") değerleri "Missing" olarak gösteriyor. Sosyal platform default mesajı ham string olduğu için **truthy** kabul ediliyor ve literal basılıyor.

**Round 1 yamasının §3.5 backfill'i ile bağı:** Rapor §3.5 ve §3.9 (sat. 793–797) açıklıyor: `social-url-gate.ts` Round 1'de eklendi → yeni audit'lerde `metaDescription: null` set ediliyor. Coffee Couch + YBA Brazil 2026-05-01 (fix öncesi) audit'leri stale; bu UI mask'i (Bug 4 fix'i) **olmadan** §3.5 backfill'i çalıştırılana kadar eski lead'lerde sorun görünmeye devam eder. Defense-in-depth için UI maske de gerekli.

**Reproduction steps:**
1. Lead'in `websiteUrl`'ini `https://instagram.com/<handle>` yap; **eski crawler** ile audit çalıştır (veya 2026-05-01 öncesi audit row'u import et).
2. Lead detail → Website tab → "Identity & SEO" → "Meta description" satırı: `"Create an account or log in to Instagram…"`

---

### Bug 5 — §7.6 Low-confidence sticky banners

**Bug ailesi:** Üç ayrı low-confidence durumu için rep'in göreceği sticky uyarı eksik. Her birinde rep yanlış veriyle pitch yapıyor.

**5a — Sub-niche confidence < 0.5** (rapor §1.3 sat. 110, "YBA Brazil sub-niche confidence 0.55 — düşük"):
- Tester açıkça şikayet etmedi ama §3.7 Black Sheep "chain blindness" ve §3.5 Coffee Couch / YBA "Instagram-as-website" şikayetleri rep'in low-signal durumunda haberdar olmamasından kaynaklı.
- Mevcut UI: `SubNicheOverride` (page.tsx:2254–2258) sadece `< 0.7` için uyarı veriyor, **ama bu uyarı Website tab'ının altında**, overview tab'ından bakan rep göremiyor.

**5b — Social-only audit** (rapor §3.9, §4.1):
- Coffee Couch + YBA Brazil + One Shot — `crawl_error="SOCIAL_MEDIA_ONLY"` veya stale Instagram audit.
- Rep tetikleyici uyarı görmüyor; Identity & SEO, Conversion Features, Tech Signals bölümleri sanki bir "website" varmış gibi rendered.

**5c — Expired domain** (rapor §3.8 vaka A, Fable and Falcon):
- `audit.title="Squarespace - Website Expired"`, `http_status=404`.
- Rep banner görmediği için opener'ın "sitenizi hızla incelediğimde" lafı yakalanmadan müşteriye gidebiliyor.

**Tester'ın doğrudan bağlı şikayeti:** *"domaini expired olan bir site için sitenizi inceledik diye opener başlamamalı"* (Fable and Falcon).

**Mevcut UI durumu:**
- `audit.crawlError === "BOT_BLOCKED_4XX"` için var olan banner (panel sat. 244–254) → **doğru pattern**, ama sadece bot-block durumu için.
- `SOCIAL_MEDIA_ONLY` ve `WEBSITE_EXPIRED` için banner **yok**.
- Sub-niche low-confidence banner sadece SubNicheOverride card'ında; `HeroBand`'in altında değil.

**Reproduction steps:**
1. Sub-niche confidence 0.45 olan lead → overview tab'ı aç → uyarı yok.
2. Instagram-only lead → aç → Identity & SEO Instagram default mesajı render ediliyor, banner yok.
3. Expired Squarespace lead → aç → Website tab'ında "Website Expired" title gözüküyor ama hero seviyesinde uyarı yok; opener cardında "sitenizi hızla incelediğimde" basılıyor.

---

## 2 · Root Cause Analysis

### RCA 2.1 — §3.1 Tier ↔ Package mismatch

**Data flow:**
1. `SCORER` (`sales-opportunity-scorer.ts:341–365`) `salesOpportunity` row'u upsert ediyor; `suggestedOffer` field'ı `create` blokunda **set edilmiyor** → schema default `STARTER` kalıyor; `update` blokunda da **set edilmiyor** → eski değer (yine STARTER) korunuyor.
2. Kod yorumu (sat. 336–340) "deprecated (P0.4)" diyor; `recommendedPackageId` artık tek doğru kaynak.
3. `/api/leads/[id]/route.ts:36–57` `recommendedPackage` objesini ServicePackage tablosundan çözüyor (workspace-scoped, doğru); `salesOpportunity` row'u `suggestedOffer` ile birlikte response'a alınıyor.
4. `LeadDetailPage` `LeadDetail.salesOpportunity.suggestedOffer: string` tipinde okuyor (page.tsx:253) — required değer.
5. `HeroPriorityStrip` `opp?.suggestedOffer && <Badge>Tier: …</Badge>` ile **bağımsız** çiziyor (page.tsx:963).
6. Aynı strip'te `opp?.recommendedPackage && <Badge>Package: …</Badge>` (page.tsx:958) — başka kaynak.

**Neden mevcut kod bu davranışı üretiyor:**
- `RecommendedPackageCard` (sat. 1677–1736) `pkg` null olduğunda `fallbackOffer` ile geri çekiliyor — **doğru pattern**, çünkü "tier hint" sadece package olmadığında manlandar.
- `HeroPriorityStrip` aynı pattern'i uyarlamıyor; deprecated alanı her zaman gösteriyor.
- Round 1 fix'i (P0.4) backend'de `suggestedOffer` yazımını durdurdu, ama **frontend okumayı durdurmadı** → "yarı yamalı" durum.

**Round 1 fix kapsamı:** Round 1 P0.4 backend `suggestedOffer` yazımını deprecate etti; package selector eklendi. Frontend kalıntıları temizlenmedi.

---

### RCA 2.2 — §3.2 Glance / Wedge duplication

**Data flow:**
1. `WEBSITE_AUDITOR` `audit.hasWhatsappLink`, `audit.hasContactForm` deterministic doldurulur.
2. `SCORER` Gemini'ye full feature snapshot gönderir; Gemini `reason_codes` (`["no_whatsapp", "no_contact_form", ...]`) üretir.
3. UI `HeroPriorityStrip` iki kaynağı **paralel** map'liyor; aralarında **hiç dedupe yok** (sadece `reasonCodes` kendi içinde dedupe var, sat. 924–930).

**Neden mevcut kod bu davranışı üretiyor:**
- `wedges` ve `reasonCodes` farklı string formatlarında ("No WhatsApp" vs "no_whatsapp"); React `key` farklı, dedupe çalışmıyor.
- Gemini scorer prompt'u sosyal/audit deterministic field'ları **bilmiyor**; redundant code'ları üretmesi engellenemiyor.
- `REASON_LABELS` map'i (`labels.ts:51–72`) wedges string'leriyle birebir aynı çıktı veriyor (e.g. `"No WhatsApp"`, `"No Contact Form"`).

**The Drip "No website + Weak website":** Gemini scorer prompt'u mutually-exclusive reasonCodes constraint'i içermiyor. `no_website` set edilirken `high_rating_weak_site` ve `weak_seo` codes hâlâ üretilebiliyor.

**Round 1 fix kapsamı:** Round 1'de `reasonCodes`'a `Set` dedupe + `.slice(0, 5)` cap eklenmiş (sat. 924–930). Bu sadece **iç tekrar**ı engelliyor; çapraz kaynak (wedges ↔ reasonCodes) dedupe yok.

---

### RCA 2.3 — §3.3 `primaryType` ham snake_case

**Data flow:**
1. `lead-creation-worker.ts` (veya discovery flow) Google Places API'sinden `primaryType` çekiyor; raw değer (`coffee_shop`) tabloya yazılıyor.
2. `/api/leads/[id]/route.ts` field'ı olduğu gibi response'a koyuyor (transformation yok).
3. UI 5 farklı componentte string olarak render ediyor.

**Neden mevcut kod bu davranışı üretiyor:**
- Google Places'in `primaryType` enum'u (yaklaşık 200+ değer; `coffee_shop`, `food_store`, `acai_shop`, `bar`, `bakery`, vb.) hiçbir yerde mapping'lenmedi.
- `src/lib/labels.ts` `REASON_LABELS`, `OFFER_LABELS`, `CRAWL_LABELS`, `PIPELINE_STAGE_LABELS` içeriyor ama `PRIMARY_TYPE_LABELS` yok.
- Düzgün okunaklı değerler (`cafe`, `bar`) tek-kelime olduğu için "okunaklı" görünüyor; `_` içerenler gözle hata olarak fark ediliyor.

**Round 1 fix kapsamı:** Round 1 `primaryType` humanize'ı **hiç ele almadı**. Round 2'de yeni bug.

---

### RCA 2.4 — §3.9 Instagram default meta sızması

**Data flow:**
1. Eski crawler (Round 1 fix öncesi) Instagram URL'i bir website gibi çekti; HTML'in `<meta name="description">` etiketi Instagram'ın global default mesajını içerir.
2. Audit row `metaDescription` field'ına bu string yazıldı.
3. UI `IdentitySection` field'ı `||` ile sadece null/empty kontrol ediyor.

**Neden mevcut kod bu davranışı üretiyor:**
- `social-url-gate.ts` (Round 1 P0.1) **yeni** audit'lerde `metaDescription: null` set ediyor — **doğru** davranış.
- Eski audit'ler stale; backfill (rapor P0.5) yapılana kadar yanlış string DB'de kalıyor.
- UI'da hiçbir defensive content-filter yok; Instagram/Facebook/TikTok default messages whitelist edilebilirdi.

**Round 1 fix kapsamı:** Round 1 P0.1 audit-write tarafını yamadı; UI tarafı (defense-in-depth) yapılmadı. §3.5 backfill'i de eklenmedi → `metaDescription` field'ında stale Instagram default mesajı 2 lead'de hâlâ canlı.

---

### RCA 2.5 — §7.6 Low-confidence sticky banner eksikliği

**Mevcut kısmi pattern:**
- `BOT_BLOCKED_4XX` için banner var (panel sat. 244–254) — model olarak kullanılabilir.
- `SubNicheOverride` low-confidence kutusu var (page.tsx:2254–2271) ama Website tab'ının dibinde.

**Eksik durumlar:**
- `audit.crawlError === "SOCIAL_MEDIA_ONLY"` → banner yok.
- `audit.title` regex `/expired/i` veya `httpStatus === 404` → banner yok.
- `subNicheConfidence < 0.5` AND `subNicheSource === "AUTO"` → overview tab'ında banner yok.

**Neden mevcut kod bu davranışı üretiyor:**
- Round 1 crawl error taxonomy'si (sat. 1153) sadece `BOT_BLOCKED_4XX` için UI uyarısı eklemişti; diğer error kodları için iterasyon yapılmadı.
- Sub-niche warning component-level scope'a sıkıştırıldı; "global header banner" pattern'i hiç kurulmadı.
- Expired-domain için ayrı bir `crawl_error` enum değeri (`WEBSITE_EXPIRED`) **yok**; audit row sadece `crawl_error="UNKNOWN"` veya null. Backend taxonomy genişletmesi (rapor P1.2) bu cluster'ın prerequisite'i.

**Round 1 fix kapsamı:** Round 1 P0.1 social-URL-gate, P1.4 not-applicable rule, P1.5 audit re-trigger eksikleri vardı. Rep-facing banner katmanı hiç planlanmadı.

---

## 3 · Fix Önerisi

### Fix 3.1 — §3.1 Tier badge'ini kaldır (KARAR: Alternatif A önerilir)

**Karar matrisi (alternatif analizi):**

| Alternatif | Açıklama | Effort | Risk | Side effect |
|---|---|---|---|---|
| **A · Tier badge'i kaldır (önerilen)** | `HeroPriorityStrip`'ten `opp?.suggestedOffer && <Badge>Tier:…</Badge>` blokunu sil. `RecommendedPackageCard`'ın `fallbackOffer` mantığı zaten doğru fallback sağlıyor. | 30 dk | Düşük — sadece bir UI badge gider | `Tier` etiketi rep'in alıştığı bir UI element; UX değişikliği şeffaf iletilmeli |
| **B · Package'tan derive et** | `deriveTierFromPackage(packageName)` util'i ekle; Tier badge'i Package adından türet. | 2 saat | Orta — string substring matching kırılgan ("Premium Pro" → ?), niche pack'lere özel naming convention dayatır | `dossier-summary.ts` ve `opener-writer.ts` da `suggestedOffer` okuyor; oradaki davranış tutarsız kalır |
| **C · Schema migration** | `suggestedOffer` field'ını DB'den kaldır. | 8 saat | Yüksek — tüm okuma yerlerini düzeltmek + agent-workers + watchlist-export + lookalikes route + tests | Agresif refactor; P2'ye atılabilir |

**Önerilen: A**. Sebep:
- Backend (sat. 336–340) field'ı zaten "deprecated" yorumu ile bekletiyor; **frontend'in eşleşmesi** doğru hareket.
- `RecommendedPackageCard`'ın `fallbackOffer` mantığı (page.tsx:1690 `if (!pkg && !fallbackOffer) return null;`) workspace'lerde `ServicePackage` yapılandırılmadıysa "tier hint" gösterimini koruyor — yani field hiç kullanılmamış olmaz, sadece HeroPriorityStrip'ten temizlenir.
- Alternatif B `Package: Enterprise (Custom)` adlı paketi `ENTERPRISE` tier'a map'leme constraint'i getirir — kullanıcının kendi `ServicePackage` adlandırmasına müdahaledir.

**Kod değişikliği (sözel):**

`src/app/app/leads/[id]/page.tsx:941–967`:
- `showStrip` koşulundan `opp?.suggestedOffer != null ||` ifadesini çıkar.
- `opp?.suggestedOffer && <Badge>Tier:…</Badge>` bloğunu (sat. 963–967) sil.

```tsx
// ANTES (sat. 941-947):
const showStrip =
  opp?.recommendedPackage != null ||
  opp?.suggestedOffer != null ||      // ← KALDIR
  reasonCodes.length > 0 ||
  slowLabel != null ||
  wedges.length > 0 ||
  ra != null;

// DESPUÉS:
const showStrip =
  opp?.recommendedPackage != null ||
  reasonCodes.length > 0 ||
  slowLabel != null ||
  wedges.length > 0 ||
  ra != null;
```

```tsx
// ANTES (sat. 963-967): KALDIR (badge tamamen)
{opp?.suggestedOffer && (
  <Badge variant="outline" /* ... */>
    Tier: {OFFER_LABELS[opp.suggestedOffer] ?? opp.suggestedOffer}
  </Badge>
)}
```

**Etkilenen dosyalar:** `src/app/app/leads/[id]/page.tsx` sat. 941–947, 963–967.

**Schema/migration etkisi:** Yok (Alternatif A). `suggestedOffer` field'ı DB'de kalır (legacy compat); P2.5'te (rapor §6) ayrı schema migration olarak ele alınır.

**Test stratejisi:**
1. Vitest snapshot: `HeroPriorityStrip`'i `opp.suggestedOffer="STARTER"` + `opp.recommendedPackage={name:"Premium",…}` ile render → "Tier:" string'i bulunmamalı.
2. Manual: Coffee Couch lead'inde overview → sadece "Package: Premium" badge görünmeli.
3. RecommendedPackageCard regression: ServicePackage'siz workspace'te lead aç → fallback "Recommended tier" → STARTER chip görünmeli (etkilenmediğinden).

---

### Fix 3.2 — §3.2 Wedge + reasonCode dedupe katmanı

**Kod değişikliği (sözel):**

`src/app/app/leads/[id]/page.tsx:917–1004` `HeroPriorityStrip` içinde:

1. `wedges` ve `reasonCodes`'u **birleşik bir set** üzerinden filtrele.
2. Her iki kaynaktan gelen string'leri normalize et (lowercase + trim) ve dedupe et.
3. Mantıksal olarak çelişen reasonCode'ları sustur (örn. `no_website` set ise `high_rating_weak_site`, `weak_seo`, `poor_mobile`, `site_unreachable` çıkar).

**Sözel snippet:**

```tsx
// HeroPriorityStrip içinde, mevcut wedges + reasonCodes prep'inden sonra
function normalize(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Audit-derived wedges (deterministic source — yüksek güven)
const auditDerivedSet = new Set<string>();
if (audit?.hasWhatsappLink === false) auditDerivedSet.add(normalize("No WhatsApp"));
if (audit?.hasContactForm === false) auditDerivedSet.add(normalize("No contact form"));
if (raw?.hasQrMenu === true) auditDerivedSet.add(normalize("QR menu detected"));

// Mantıksal çakışma suppression
const hasNoWebsite = reasonCodes.includes("no_website");
const SUPPRESS_WHEN_NO_WEBSITE = new Set([
  "high_rating_weak_site", "weak_seo", "poor_mobile", "site_unreachable",
]);

// Final reasonCodes — wedges ile birebir kesişen + suppression listesindekiler atılır
const filteredReasonCodes = reasonCodes.filter((code) => {
  const labelText = REASON_LABELS[code] ?? code.replace(/_/g, " ");
  if (auditDerivedSet.has(normalize(labelText))) return false;
  if (hasNoWebsite && SUPPRESS_WHEN_NO_WEBSITE.has(code)) return false;
  return true;
});

// Render: wedges PLUS filteredReasonCodes
```

**Alternatif B (server-side prune):** `sales-opportunity-scorer.ts` Gemini'den dönen `reason_codes` içinden audit-derived olanları `mergedReasons` öncesi çıkarsın. Avantajı: dossier prompt + email export gibi diğer tüketicilere de yansır. Dezavantajı: Gemini cevabı tek-shot dedupe; UI tarafında hâlâ defense-in-depth gerekli (eski lead'ler için backfill yapılmaz).

**Önerilen:** İkisini birden — UI tarafında dedupe (P0, hızlı, deterministic), backend tarafında prune (P1, dossier/email export'a sızar). Bu plan UI tarafına odaklanıyor; backend prune Agent 2 (Sales Scorer) cluster'ında ele alınmalı.

**Etkilenen dosyalar:** `src/app/app/leads/[id]/page.tsx` sat. 917–1004 (sadece `HeroPriorityStrip`).

**Schema/migration etkisi:** Yok.

**Test stratejisi:**
1. Vitest: `audit.hasWhatsappLink=false`, `reasonCodes=["no_whatsapp", "no_contact_form", "no_website"]` → strip'te yalnızca **3 unique badge**: "No WhatsApp" (wedge), "No contact form" (wedge), "No Website" (reason).
2. The Drip vakası: `crawlStatus="NO_WEBSITE"`, `reasonCodes=["no_website", "high_rating_weak_site"]` → sadece "No Website" badge.
3. Snapshot: One Shot Coffee fixture'ı (rapor sat. 230–237) ile beklenen 7-8 badge → hatasız "no_whatsapp", "no_contact_form" çakışması yok.

---

### Fix 3.3 — §3.3 `humanizePrimaryType` util + 5 site uygula

**Kod değişikliği (sözel):**

`src/lib/labels.ts` sonuna ekle:

```ts
const PRIMARY_TYPE_DISPLAY_OVERRIDE: Record<string, string> = {
  // Google Places yanlış sınıflandırmaları (rapor §4.5):
  food_store: "Coffee Shop / Chain",   // Black Sheep gibi zincir kafeler
  acai_shop: "Açaí & Coffee Shop",     // YBA Brazil
  // İhtiyaç oldukça genişletilebilir; default humanize fallback yine devrede.
};

/**
 * Google Places'ten gelen ham snake_case `primaryType` değerini
 * UI'da gösterilebilecek title-case forma dönüştürür. Bilinen yanlış
 * sınıflandırmalar için override mapping kullanır (rapor §3.3, §4.5).
 */
export function humanizePrimaryType(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string" || !raw.trim()) return "—";
  const trimmed = raw.trim();
  if (PRIMARY_TYPE_DISPLAY_OVERRIDE[trimmed]) {
    return PRIMARY_TYPE_DISPLAY_OVERRIDE[trimmed];
  }
  return trimmed
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
```

5 render sitesini güncelle:

| Dosya | Satır | Değişiklik |
|---|---|---|
| `src/app/app/leads/[id]/page.tsx` | 1052 | `chips.push({ label: humanizePrimaryType(lead.primaryType) })` |
| `src/app/app/leads/[id]/page.tsx` | 1598 | `{humanizePrimaryType(lead.primaryType)}` |
| `src/components/app/leads/dossier/DossierSourceDrawer.tsx` | 251 | `value={humanizePrimaryType(l.primaryType)}` |
| `src/components/app/leads/dossier/source-registry.tsx` | 665 | `value: humanizePrimaryType(sources.lead.primaryType)` |
| `src/components/public-directory/directory-shell.tsx` | 171 | `<span>{humanizePrimaryType(item.primaryType)}</span>` |

**Etkilenen dosyalar:** 6 (1 util + 5 render). Public-directory dahil edildi çünkü SEO indexed sayfada da `coffee_shop` görünüyor (rapor §3.3 kapsamı dışı ama aynı util ile tek seferde temizlenir).

**Schema/migration etkisi:** Yok. Override map kod-tarafında sabit; gerekirse `niches/index.ts:fnb-cafe-bakery.classifierHints.googlePlacesTypes` (rapor P1.7 alanı) ile cross-reference edilebilir — ama o ayrı bir refactor (Agent 3 / niche pack cluster).

**Test stratejisi:**
1. Vitest: `humanizePrimaryType("coffee_shop")` === `"Coffee Shop"`, `"food_store"` === `"Coffee Shop / Chain"`, `"acai_shop"` === `"Açaí & Coffee Shop"`, `"cafe"` === `"Cafe"`, `null` === `"—"`, `""` === `"—"`.
2. Snapshot: Lead detail page Black Sheep fixture'ı → hero chip "Coffee Shop / Chain", rail "Coffee Shop / Chain".
3. Manual: Public directory `/[country]/[city]/[niche]/[business]` sayfasını Black Sheep için aç → "Coffee Shop / Chain" görünmeli.

---

### Fix 3.4 — §3.9 Identity & SEO Instagram default mask

**Kod değişikliği (sözel):**

`src/lib/labels.ts` sonuna ekle:

```ts
/** Sosyal platformların login/signup default meta_description kalıpları.
 * Eski crawler (rapor §3.5 öncesi) bunları işletme tanıtımı sanıp DB'ye yazdı.
 * UI defense-in-depth maskı; backend backfill (rapor P0.5) bittiğinde de korumayı sürdürür. */
const SOCIAL_PLATFORM_DEFAULT_META_PATTERNS: RegExp[] = [
  /^create an account or log in to instagram/i,
  /^create an account or log in to facebook/i,
  /^log in to (instagram|facebook|tiktok|x|twitter|linkedin)\b/i,
  /^see posts, photos and more on facebook$/i,
  /share what you[''’]re into with the people who get you/i,  // IG default
];

export function isSocialPlatformDefaultMeta(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return SOCIAL_PLATFORM_DEFAULT_META_PATTERNS.some((re) => re.test(trimmed));
}
```

`src/components/app/website-intelligence-panel.tsx:730–738` `IdentitySection`:

```tsx
function IdentitySection({ audit }: { audit: WebsiteAudit }) {
  const cleanedTitle = audit.title === "Instagram" || audit.title === "Facebook"
    ? null
    : audit.title;
  const cleanedMeta = isSocialPlatformDefaultMeta(audit.metaDescription)
    ? null
    : audit.metaDescription;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Title", value: cleanedTitle || <Muted>Missing</Muted> },
    { label: "Meta description", value: cleanedMeta || <Muted>Missing</Muted> },
    { label: "H1", value: audit.h1 || <Muted>Missing</Muted> },
  ];
  // ... rest unchanged ...
}
```

**Etkilenen dosyalar:**
- `src/lib/labels.ts` — yeni util ekleme.
- `src/components/app/website-intelligence-panel.tsx` sat. 730–738 — IdentitySection import + render.

**Schema/migration etkisi:** Yok. Bu sadece UI mask. **Backend backfill (rapor P0.5 + §3.5)** ayrı bir cluster (Agent — Audit Pipeline) tarafından paralel yürütülmeli; o tamamlanmadan eski lead'lerde DB'de yine yanlış string kalır ama UI gizler.

**Test stratejisi:**
1. Vitest: `isSocialPlatformDefaultMeta("Create an account or log in to Instagram - Share what you're into with the people who get you.")` === `true`. `isSocialPlatformDefaultMeta("FineDine — modern QR menu for restaurants")` === `false`. `null` === `false`.
2. Snapshot: Coffee Couch fixture (`metaDescription="Create an account or log in to Instagram…"`) → IdentitySection "Meta description" → `<Muted>Missing</Muted>`.
3. Regression: Olağan website audit (`metaDescription="Best coffee in Camden"`) → string aynen render edilmeli.

---

### Fix 3.5 — §7.6 Sticky low-confidence banner katmanı

**Kod değişikliği (sözel):**

Yeni component: `src/app/app/leads/[id]/page.tsx` içinde `LowConfidenceStickyBanner` (page-local, çünkü prop'lar `LeadDetail` shape'inden türetiliyor).

```tsx
function LowConfidenceStickyBanner({ lead }: { lead: LeadDetail }) {
  const audit = lead.websiteAudit;
  const warnings: { tone: "warning" | "error"; icon: LucideIcon; text: string; cta?: string }[] = [];

  // 5a — Sub-niche < 0.5
  if (
    lead.subNicheSource === "AUTO" &&
    typeof lead.subNicheConfidence === "number" &&
    lead.subNicheConfidence < 0.5
  ) {
    warnings.push({
      tone: "warning",
      icon: AlertTriangle,
      text: `Sub-niche otomatik tahmini düşük güvenilirlikte (${Math.round(lead.subNicheConfidence * 100)}%). Opener ve audit generic pitch'e düşüyor.`,
      cta: "Sub-niche'i düzelt",
    });
  }

  // 5b — Social-only audit (Round 1 fix sonrası `crawl_error="SOCIAL_MEDIA_ONLY"`)
  if (audit?.crawlError === "SOCIAL_MEDIA_ONLY") {
    warnings.push({
      tone: "warning",
      icon: Info,
      text: "Bu işletmenin web sitesi yok — sadece sosyal profil. Identity & SEO ve Conversion Features bölümleri bu lead için geçersiz.",
    });
  }

  // 5c — Expired domain — title regex VEYA http_status=404 + auditQRtitle="...Expired"
  const titleSuggestsExpired = audit?.title && /(expired|domain.*sale|website.*coming.*soon|squarespace.*expired|godaddy.*parked)/i.test(audit.title);
  const httpExpired = audit?.httpStatus === 404 && audit?.reachable === false;
  if (titleSuggestsExpired || httpExpired) {
    warnings.push({
      tone: "error",
      icon: AlertTriangle,
      text: `Bu işletmenin domaini süresi dolmuş veya parked durumda${audit?.title ? ` ("${audit.title}")` : ""}. Opener "sitenizi inceledim" lafıyla başlamamalı.`,
    });
  }

  if (warnings.length === 0) return null;

  // Sticky: HeroBand'in HEMEN ALTINDA, HeroPriorityStrip'in ÜSTÜNDE render edilir
  return (
    <div className="mt-4 space-y-2">
      {warnings.map((w, idx) => (
        <div
          key={idx}
          className={`rounded-xl border px-3.5 py-2.5 text-[13px] flex items-start gap-2 ${
            w.tone === "error"
              ? "border-(--leadac-error)/30 bg-(--leadac-error)/8 text-(--leadac-text-1)"
              : "border-(--leadac-warning)/30 bg-(--leadac-warning)/10 text-(--leadac-text-2)"
          }`}
        >
          <w.icon className={`w-4 h-4 mt-0.5 shrink-0 ${
            w.tone === "error" ? "text-(--leadac-error)" : "text-(--leadac-warning)"
          }`} />
          <span className="flex-1">{w.text}</span>
          {w.cta && (
            <a href="#anchor-niche-pack" className="text-[12px] underline hover:no-underline shrink-0">
              {w.cta}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
```

`HeroBand`'i sarmalayan parent JSX'inde (page.tsx ~723-734 bölgesi, `HeroBand` ve sub-content arası), `<LowConfidenceStickyBanner lead={lead} />` ekle. Konum: `<HeroBand />` çıkışından sonra, ilk `<TabsContent>` öncesi (ya da `<HeroPriorityStrip />`'in hemen üstünde — strip overview tab içinde olduğu için).

**Etkilenen dosyalar:**
- `src/app/app/leads/[id]/page.tsx` — yeni component + tek call site.

**Schema/migration etkisi:**
- 5c (expired domain) için **prerequisite**: `crawl_error` taxonomy'sine `WEBSITE_EXPIRED` enum değeri eklenmesi (rapor P1.2). Bu **Agent 5 / Audit-Pipeline** cluster'ında. UI bu taxonomy genişlemesinden bağımsız çalışır (regex + http_status fallback) — backend P1.2 bittiğinde sadece daha temiz `audit.crawlError === "WEBSITE_EXPIRED"` kontrolüne refactor edilir.
- 5b için audit row'larına bakıyor; backend tarafı `social-url-gate` Round 1'de yamandı, prerequisite yok.
- 5a için sub-niche confidence float'ı; backend'de değişiklik gerekmez.

**Test stratejisi:**
1. Vitest: 4 senaryo —
   - `subNicheSource="AUTO"`, `subNicheConfidence=0.45` → warning render.
   - `audit.crawlError="SOCIAL_MEDIA_ONLY"` → social warning render.
   - `audit.title="Squarespace - Website Expired"`, `httpStatus=404` → expired error render.
   - Hepsi temiz lead → component `null` döner.
2. Snapshot: Fable and Falcon fixture (expired) + Coffee Couch fixture (social-only) — banner stack'i + opener'a kadar olan flow.
3. Manual: 3 farklı senaryoyu prod-like data'yla aç; banner görünür ve "Sub-niche'i düzelt" CTA `#anchor-niche-pack` hash'ine scroll ediyor.

---

## 4 · Effort + Risk

### Saat tahminleri ve risk tier'ları

| Bug | Effort | Risk | Tier | Açıklama |
|---|---|---|---|---|
| §3.1 Tier badge kaldır | **30 dk** | Düşük | **P0** | Tek bir badge ve `showStrip` koşulu silinir; backward compat dert değil çünkü `RecommendedPackageCard` zaten `fallbackOffer` ile pre-existing fallback sağlıyor. |
| §3.2 Wedge dedupe + reasonCode suppression | **2 saat** | Düşük | **P0** | Yeni `normalize()` helper + tek `HeroPriorityStrip` içinde dedupe. Vitest fixture eklenince güvenli. |
| §3.3 `humanizePrimaryType` + 5 render site | **1.5 saat** | Düşük | **P0** | Util + 5 small edit. Public-directory render site'ı SEO indexed olduğu için Snapshot regression önemli. |
| §3.9 `isSocialPlatformDefaultMeta` mask | **1 saat** | Düşük | **P0** | Tek util + IdentitySection title/meta filter. UI defense-in-depth, asla yan etki yapmamalı. |
| §7.6 Sticky low-confidence banner | **3 saat** | Orta | **P1** | Yeni component, 3 farklı warning surface, expired-domain regex'i false positive verme riski (örn. SEO başlığı "Coffee shop expired its menu" gibi sıra dışı kelimeler). |

**Toplam tahmini effort:** 8 saat. Tek developer + 1 PR review döngüsü ile 1 iş gününde tamamlanabilir.

### Paketleme önerisi

**PR-1 — UI Display P0 (4.5 saat):** §3.1 + §3.2 + §3.3 + §3.9. Hepsi `lead detail` sayfası ve `labels.ts` üzerinde — review tek seferde mantıklı, regression yüzeyi aynı.

**PR-2 — Sticky Low-Confidence Banner (3 saat):** §7.6 ayrı PR. Yeni component + warning UX kararları gerektirdiği için review odaklı; product owner banner copy / tone'unu onaylasın.

PR-1 ve PR-2 paralel çalışabilir; aralarında dependency yok.

### Risk değerlendirmesi

- **§3.1**: `suggestedOffer`'i hâlâ okuyan **diğer** alanlar (`dossier-summary.ts`, `opener-writer.ts`, `lookalikes/route.ts`, `watchlist-export.ts`, `useLeadsQuery.ts`, `source-registry.tsx`, `app/deals/types.ts`, `lib/scoring.ts`) **bu fix kapsamı dışı**. Sadece HeroPriorityStrip tedavi ediliyor; UI'da başka tier display'i yoktur (grep onayladı: `OFFER_LABELS` sadece labels.ts içinde tanımlı, tek tüketici page.tsx:965). Diğer modüllerin temizlenmesi P2.5 (rapor §6) sırasında ele alınmalı.
- **§3.2**: Suppression listesi yanlış pozitif vermemeli — eğer Gemini "high_rating_weak_site" reasonCode'unu site-yokken doğru bir sebep olarak üretmek istese (saçma ama mümkün), suppression onu kesecek. Kabul edilebilir tradeoff: rapor §3.2 The Drip vakası yanlış-pozitifin maliyeti yüksek (rep'i kafa karıştırıyor) ↔ doğru-negatifin maliyeti düşük (audit row zaten "no website" diyor, ek bilgi vermez).
- **§3.3**: `PRIMARY_TYPE_DISPLAY_OVERRIDE` map'ı manuel; gelecek vakalarda büyür. Risk: Black Sheep gibi `food_store` Google misclassification 12 ay sonra 100 farklı niche için ortaya çıkabilir — uzun vadede rapor P1.7 (`niches/index.ts:classifierHints.googlePlacesTypes`) entegrasyonu daha sürdürülebilir; bu P0 sadece bilinen 2 yanlış sınıflandırmayı kapsıyor (`food_store`, `acai_shop`).
- **§3.9**: Regex liste açık uçlu; gelecekte X (Twitter) veya TikTok login sayfası için ekleme gerekebilir. Defense-in-depth amaçlı kasıtlı liberal — false positive riski neredeyse sıfır (gerçek işletme meta_description'ları "log in to Instagram" lafıyla başlamaz).
- **§7.6**: Expired-domain regex `/expired|squarespace.*expired/i` Squarespace ürün adı içeren bağlamlarda false positive verebilir. Mitigation: regex katı tutuldu (`squarespace.*expired` arada karakter aramayla); ama `httpStatus=404 + reachable=false` AND koşulu daha güvenli — yeterli değilse `crawl_error="WEBSITE_EXPIRED"` taxonomy'sine bağlanmasını P1.2 ile bekle.

---

## 5 · Dependencies

### Diğer cluster'larla overlap

| Bu fix | Bağımlı / Bağıntılı cluster | İlişki | Deploy ordering |
|---|---|---|---|
| **§3.1 Tier badge kaldır** | (yok) | Backend `suggestedOffer` zaten deprecated; bu fix tamamen bağımsız. | — |
| **§3.2 UI dedupe** | Agent 2 / Sales-Scorer cluster — Gemini prompt'una mutually-exclusive reasonCodes constraint'i (rapor §3.2 Çözüm C). | Backend prompt fix complementary; ikisi birden olunca defense-in-depth. UI fix önce gidebilir, sonra backend yamasıyla daha az reasonCode üretilir. | Sırasız OK; UI önce |
| **§3.3 humanizePrimaryType** | Niche-pack cluster — `niches/index.ts:fnb-cafe-bakery.classifierHints.googlePlacesTypes` (rapor P1.7). | Override map'i sürdürülemez büyür → niche pack'e taşı. P0 fix iki bilinen vakayı kapsıyor; sürdürülebilir versiyon P1. | UI önce, niche pack refactor P1'de |
| **§3.9 Instagram meta mask** | **Audit-Pipeline cluster — Round 1 P0.5 backfill (rapor §3.5)**. Coffee Couch + YBA Brazil eski audit satırları re-trigger edilmediği sürece DB'de yanlış string kalır. | UI mask **olmadan** §3.5 backfill'i yapılırsa eski lead'lerin yenilenmesi gerekir; UI mask **olmadan** §3.5 yapılmazsa yanlış string canlı görünür. **UI mask backfill'in retroactive olmadığı durumda safety-net.** | UI mask önce (defense-in-depth), backfill aynı sprint'te |
| **§7.6 Sticky banner — expired domain (5c)** | Audit-Pipeline cluster — `crawl_error="WEBSITE_EXPIRED"` enum eklemesi (rapor P1.2). | UI fix regex + httpStatus fallback ile bağımsız çalışır; backend taxonomy genişlemesi sonrası refactor edilir. | UI önce; backend P1.2 sonrası refactor |
| **§7.6 — social-only (5b)** | Round 1 fix kapsamı — `social-url-gate.ts` zaten deploy edildi. | Mevcut kodla çalışır. Coffee Couch + YBA için eski audit'lerin re-trigger'ı (§3.5) gerekli, ama UI banner yine de tetiklenir çünkü `crawlError` field'ı mevcut. | Bağımsız |
| **§7.6 — sub-niche < 0.5 (5a)** | Sub-niche classifier cluster (Round 1 #5). | Bağımsız UI surface; backend confidence formula değişimi olursa banner threshold (0.5) güncellenmeli. | Bağımsız |

### Deploy ordering kritik mi?

**Evet, §3.9 için.** Sebep: Eğer §3.5 backfill'i **önce** çalışırsa Coffee Couch + YBA Brazil eski audit satırları yenilenir (`metaDescription: null` set edilir), §3.9 UI mask'i hiçbir yerde tetiklenmez. Ama defense-in-depth açısından ikisinin **birlikte** deploy edilmesi rep'in başka workspace'lerin gelecekteki social-only audit'lerinde de korunmasını sağlar.

**§3.9 olmadan §3.5 backfill** = eski lead'ler temizlenir, ama gelecekte aynı vaka tekrar oluşursa (örn. `social-url-gate` bir TikTok URL'sini kaçırırsa) UI yine yanlış string gösterir.

**Diğer fix'ler ordering-agnostic.**

### Multi-tenant scope kontrolü

Tüm fix'ler **client-side render değişiklikleri** (page.tsx, panel.tsx). DB query yok, agent worker yok. `requireUser()` zaten lead-detail route'u tarafından handle ediliyor (`/api/leads/[id]/route.ts` workspaceId scope'u uyguluyor — sat. 49–54 ServicePackage workspace'le scoped okunuyor). UI komponentleri sadece `LeadDetail` prop'u tüketiyor. **Multi-tenant ihlali yok.**

---

## 6 · Open Questions

### Karar bekleyen noktalar

1. **§3.1 Tier badge — Alternatif A vs B vs C kararı.** Bu plan A'yı öneriyor (badge'i sil). Eğer product owner "rep'ler 'Tier' kavramına alışık" derse, B (`deriveTierFromPackage`) düşünülebilir. **Öneri:** A'yı seç; rep'ler Package adına geçsin (zaten daha bilgilendirici — fiyat etiketi de görünüyor). Onay isteniyor.

2. **§3.2 Suppression listesi tamamlığı.** `SUPPRESS_WHEN_NO_WEBSITE` listesi The Drip vakasında `["high_rating_weak_site", "weak_seo", "poor_mobile", "site_unreachable"]` — eksik vakalar olabilir mi? Gemini scorer çıktıları üzerinde ek QA gerekli; product owner / backend reviewer onayı.

3. **§3.3 `food_store → "Coffee Shop / Chain"` mapping doğru mu?** Black Sheep için doğru (zincir kafe), ama gerçekten "food store" olan bir işletme (örn. delicatessen, gıda satış noktası) için bu yanıltıcı olur. **Öneri:** Override sadece **niche=RESTAURANT_TECH** workspace'lerde çalışsın; diğer niche'lerde `humanize` default fallback'i (`"Food Store"`) yeterli. Bu için util'e `workspaceNiche?: string | null` parametresi eklenebilir. Karar: P0 için basit haliyle git, niche-aware mapping P1'de eklenir mi?

4. **§3.9 Title field "Instagram"/"Facebook" literal kontrolü kabul edilebilir mi?** Gerçek bir işletme `<title>Instagram</title>` set edemez ama `<title>Café Instagram | Camden</title>` set edebilir. Mevcut taslak `audit.title === "Instagram"` strict equality kullanıyor — false positive yok. Onay isteniyor.

5. **§7.6 Banner copy dili.** Plan banner metnini Türkçe yazdı (workspace `language="tr"` FineDine için). Ama LeadAC marketing surface bilingual (TR/EN) — i18n key'lere mi taşınmalı yoksa product owner banner'ları İngilizce mi tercih ediyor (rep'ler İngilizce'ye daha alışık olabilir)? `src/i18n/`'i incelemeden bir karar verilmedi.

6. **§7.6 Expired domain regex'in agresifliği.** Regex çok agresif ise false positive verir; çok dar ise gerçek expired durumu kaçırır. **Öneri:** Backend P1.2 (`crawl_error="WEBSITE_EXPIRED"`) önce uygulansın, sonra UI bu enum'a güvenir. Bu durumda §7.6 fix scope'u "5a sub-niche + 5b social-only" ile sınırlandırılıp 5c expired-domain backend P1.2 sonrasına ertelenebilir. Karar isteniyor.

7. **§3.1 fix sonrası `dossier-summary.ts`, `opener-writer.ts`, `email/export` `suggestedOffer` okumaları.** Bu plan UI'a odaklı; backend okuma yerlerinin temizlenmesi (rapor P2.5 schema migration) kapsamı dışı. **Onay:** P2.5 ayrı cluster'a delege edildiğinin sözlü kabulu yeterli mi?

8. **§3.2 backend complementary fix (Gemini prompt mutually-exclusive constraint)** — Bu UI plan kapsamı dışı; Agent 2 / Sales-Scorer cluster sahibi. Kim üstlenecek? PR-1 + scorer fix'inin aynı release'te shipping yapılması garantisi var mı?

---

## Security Findings

**Multi-tenant scope ihlali bulgusu:** YOK.

İncelenen dosyalar (page.tsx, website-intelligence-panel.tsx, niche-product-fit-card.tsx, labels.ts, leads/[id]/route.ts) workspace-scoping kurallarına uygun:
- `/api/leads/[id]/route.ts:48–55` `recommendedPackage` lookup'ı `workspaceId` ile scoped (`prisma.servicePackage.findFirst({ where: { id, workspaceId }})`).
- `/api/leads/[id]/route.ts:13–30` (varsayılan `findFirst` pattern'i) `workspaceId` scope altında.
- UI componentleri salt prop tüketici; doğrudan Prisma query yok.
- `humanizePrimaryType`, `isSocialPlatformDefaultMeta` saf util'ler; DB erişimi yok.
- §7.6 banner componenti `lead` prop'undan field okur; yan etki yok.

**Ek not:** `requireUser()` ve workspace scope'u zaten handler-level'da uygulanmış. Bu UI fix'leri yeni endpoint açmıyor, yeni Prisma query eklemiyor. Tehlike vektörü yok.

---

**Plan sonu.** Yedi dosyanın 8 yerinde toplam ~50 satır değişiklik + 3 yeni util fonksiyonu + 1 yeni page-local component = 8 saat effort, 2 PR. Round 1 fix'lerinin yarı-yamalı bıraktığı kalıntıları (§3.1) ve Round 1'de hiç ele alınmamış 4 yeni bug sınıfını (§3.2, §3.3, §3.9, §7.6) kapatır.
