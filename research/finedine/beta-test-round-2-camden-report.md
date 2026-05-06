# LeadAC AI — FineDine Beta Round 2 (Camden) Hallucination ve Doğruluk Auditi

**Hesap:** `finedine-owner@leadac.beta`
**Workspace ID:** `5496e39e-cc76-41bd-b18b-f1128fb9e41b` (FineDine Beta, niche=`RESTAURANT_TECH`, language=`tr`)
**Beta tester:** Round 1'de raporlayan tester ile aynı kişi (yeni Camden / North London cafe segmenti)
**Rapor tarihi:** 5 Mayıs 2026
**Rapor kapsamı:** Tester'ın 13 işletme raporundaki gözlemler + Postgres'teki gerçek analiz verisi + AI Core kod tabanı kesişimi. (3 ID copy-paste hatası nedeniyle gerçek lead sayısı 12.)
**Önceki rapor:** [research/finedine/beta-test-analysis-report.md](beta-test-analysis-report.md) (Round 1, 940 satır, 2 Mayıs 2026).

---

## 0 · Yönetici Özeti (TL;DR)

Round 1 raporundan üç gün sonra aynı tester, FineDine senaryosuyla 13 Camden / North London cafe işletmesini gözden geçirdi. Bu raporda tester'ın gözlemlerini DB satırlarıyla ve koddaki kök nedenlerle çapraz doğrulayarak Round 1'in 8 sorununun hangilerinin **çözüldüğünü**, hangilerinin **hâlâ canlı** olduğunu ve Round 2'de **YENİ** ortaya çıkan bug sınıflarını ortaya koyuyorum.

### Round 1 fix durumu (3 gün sonra)

| Round 1 Sorunu | Fix uygulandı mı? | Round 2'de hâlâ var mı? |
|---|---|---|
| #1 — Crawler "Instagram-as-Website" | ✅ KISMEN — kod yamandı (`social-url-gate.ts` deploy edildi, bkz. § 4.1) | ⚠️ HÂLÂ ETKİSİ VAR — eski audit satırları re-trigger edilmedi (Coffee Couch, YBA Brazil) |
| #2 — Review small-sample patlaması | ❌ FIX YOK | ✅ DEVAM (S.O.S "Expensive 100%" 14 review, Coffee Couch "Bad coffee 100%") |
| #3 — Hallucinated review snippet | ❌ FIX YOK | ✅ DEVAM (YBA "Automatic tip request" label echo) |
| #4 — Premium-default paket | ❌ FIX YOK | ✅ DEVAM (10/12 lead'de Premium önerildi) |
| #5 — Sub-niche edge case | ⚠️ KISMEN | ✅ DEVAM (Black Sheep `primary_type=food_store`) |
| #6 — Opener vertical anti-pattern | ⚠️ KISMEN — `confirmedPainPoints` whitelist eklendi (`opener-writer.ts:142–167`) | ✅ DEVAM (Fable and Falcon expired-site, Blank Street chain-blindness) |
| #7 — Embedding crash + 403 | ❌ FIX YOK | ✅ HÂLÂ AKTİF — One Shot Coffee 8 ardışık `Failed to embed after 3 attempts`, LUMI Camden 2× 403 |
| #8 — Lead score kalibrasyonu | ❌ FIX YOK | ⚠️ Tester yorum yapmadı |

### Round 2'de tespit edilen 10 YENİ bug sınıfı

1. **Tier ↔ Package mismatch (UI bug)** — 12/12 lead'de `suggested_offer="STARTER"` hard-coded; UI'da "Tier: Starter" + "Package: Premium/Enterprise" çelişkili gözüküyor.
2. **Glance/Wedge duplication (UI bug)** — `wedges[]` ve `reasonCodes[]` aynı sinyali iki kez render ediyor (No WhatsApp × 2, No contact form × 2, No website + Weak website).
3. **`primaryType` ham snake_case gösterim (UI bug)** — `coffee_shop`, `food_store`, `acai_shop` doğrudan basılıyor; humanize/title-case yok.
4. **Conversion Features ↔ Restaurant Tech Signals çakışması** — Aynı sinyal iki ayrı extractor path'ten geçip farklı sonuçlar veriyor (LUMI booking-keyword hatası, Glass + Camden Roastery + Black Sheep'te `e-menu` substring false-positive).
5. **Stale audit re-trigger eksikliği** — Round 1'de yamalan `social-url-gate` Coffee Couch + YBA Brazil'in 2026-05-01 tarihli audit satırlarını yeniden çalıştırmadı; eski `has_booking=true` veriler hâlâ canlı.
6. **Quota error message yanıltıcılığı (NEW)** — One Shot Coffee için `"Quota exceeded for SALES_OPPORTUNITY_SCORER: 44/50000"` mesajı: gerçek blok per-lead daily cap (50/24h) ama UI'a worker quota mesajı sızıyor.
7. **Why They're a Fit zincir körlüğü (NEW)** — Blank Street + Black Sheep kendi mobil app'lerinde order-ahead + loyalty + dijital menü sunuyor; pain_points listesi bunları yok sayıyor.
8. **Personalized Message expired-site bağlam ihlali** — Fable and Falcon sitesi 404 + `title="Squarespace - Website Expired"` halde, opener "sitenizi hızla incelediğimde" diye başlıyor.
9. **Identity & SEO Instagram fallback (Coffee Couch)** — Audit Instagram URL'i için `meta_description="Create an account or log in to Instagram"` çekti; Identity & SEO bölümü Instagram'ın global default açıklamasını işletme tanıtımı sanıyor.
10. **Non-English review leakage** — Camden Coffee Roastery (Hollandaca + Fransızca KPI alıntıları), Il botanico (Italyanca + İspanyolca), Glass Coffee (Italyanca) — `english_only` filtresi yok; FineDine'ın İngilizce konuşan ICP'sini kafa karıştırıyor.

### Sayısal özet

- 12 unique lead'in **12'sinde** en az bir Round 2 yeni bug sınıfı tetiklendi.
- 12'sinin **10'unda** Premium paket önerildi (Round 1 #4 değişmedi).
- 12'sinin **6'sında** Tier-Package mismatch görüldü (3-4 lead'de tester `suggested_offer = STARTER` UI çakışmasını isim isim yazdı).
- 5 lead'de eski Round 1 #1 (Instagram-as-website) varyantı kalıntı veri olarak yansıdı.
- 2 lead'in (S.O.S Coffee, The Drip) `crawl_status=NO_WEBSITE` olmasına rağmen `website_url` set; audit satırı hiç oluşturulmamış (re-audit hook çalışmamış).

---

## 1 · Test Kapsamı ve Veri Doğrulaması

### 1.1 Tester'ın 13 raporu → 12 unique lead

Tester Round 1'deki gibi bazı işletmeler için **yanlış ID yapıştırmış** (Round 1'de 4 farklı lead aynı ID'yi taşıyordu; Round 2'de 3 işletme bu hataya düştü). DB'de `business_name` araması ile her birini düzelttim:

| # (tester) | İşletme | Tester'ın verdiği ID | DB'de gerçek ID | Lokasyon |
|---|---|---|---|---|
| 25 | One Shot Coffee | `cmoozvrl2000rkz044funhtgf` | ✅ Aynı | North London |
| 24 | Glass Coffee | `cmoozvq850003kz04ck13mzhb` | ✅ Aynı | Camden |
| 23 | Il botanico Pasticceria E Gelateria | `cmon6tr1s000rjv04x4pa7ump` | ❌ Yanlış (= Coffee Couch) → gerçek: `cmoozvsyu001fkz04ieppflvm` | Camden High St |
| 22 | Coffee Couch | `cmon6tr1s000rjv04x4pa7ump` | ✅ Aynı (Il botanico'ya yapıştırılan ID aslında bu) | North Greenwich |
| 21 | S.O.S Coffee | `cmon6tshs001fjv04djylm2ts` | ✅ Aynı | New Cross Rd |
| 20 | Fable and Falcon | `cmoozvtn7001rkz042wr6yiab` | ✅ Aynı | Chalk Farm |
| 19 | Blank Street Coffee Camden | `cmon6tqtp000njv04bf2gg5hs` | ❌ Yanlış (= YBA Brazil) → gerçek: `cmoozvs9l0013kz04jzlky5zi` | Camden |
| 18 | YBA Brazil — Acai & Coffee | `cmon6tqtp000njv04bf2gg5hs` | ✅ Aynı (Blank Street'e yapıştırılan ID aslında bu) | Greenwich |
| 16 | The Drip | `cmon6trzv0017jv04j17d9dj1` | ✅ Aynı | Deptford Bridge |
| 15 | Camden Coffee Roastery | `cmoozvr4t000jkz043baocw6m` | ❌ Yanlış (= LUMI Camden) → gerçek: `cmoozvpz00001kz04a6jirdd5` | Camden |
| 14 | LUMI Camden | `cmoozvr4t000jkz043baocw6m` | ✅ Aynı (Camden Roastery'ye yapıştırılan ID aslında bu) | Camden High St |
| 13 | Black Sheep Coffee – Camden Town | `cmoozvrcx000nkz042jba1czr` | ✅ Aynı | Camden Town |

> **Not:** ID copy-paste hatası Round 1'de de raporlanmıştı (raporda § 1.1, 4 lead aynı ID'yi taşıyordu). Tester aynı hatayı tekrar yaptı; UI'dan kolayca kopyalanabilir bir "Lead URL" / "Lead ID" copy-button eklenmesi önerimiz Round 1 P2.5'ten beri açık.

### 1.2 FineDine Beta workspace ayarları (DB'den)

```
niche              = RESTAURANT_TECH
language           = tr
offerName          = "F&B Digital Stack (QR menu, ordering, reservations)"
valueProposition   = "FineDine modernises every digital touchpoint F&B operators rely on
                      — QR menu, table-side ordering, online reservations, and guest CRM —
                      so every cover spends more, comes back more often, and stays
                      reachable for marketing."
targetSubNiches    = [fnb-fine-dining, fnb-bar-club, fnb-ghost-kitchen,
                      fnb-cafe-bakery, fnb-food-truck, fnb-hotel-fnb]
tone               = professional
```

### 1.3 12 lead'in DB snapshot'ı (özet)

| # | İşletme | website_url | primary_type | crawl_status | rating / review_count | suggested_offer | recommended_package |
|---|---|---|---|---|---|---|---|
| 25 | One Shot Coffee | `…/facebook.com/One-Shot-Coffee-London…` | `coffee_shop` | NO_WEBSITE | 4.6 / 500 | **STARTER** | **Premium** |
| 24 | Glass Coffee | `https://glasscoffee.co.uk/` | `coffee_shop` | CRAWLED | 4.9 / 662 | **STARTER** | **Premium** |
| 23 | Il botanico | `null` | `coffee_shop` | NO_WEBSITE | 4.6 / 335 | **STARTER** | **Premium** |
| 22 | Coffee Couch | `https://www.instagram.com/couch_coffee/` | `cafe` | CRAWLED | 4.5 / 337 | **STARTER** | **Premium** |
| 21 | S.O.S Coffee | `https://soscoffee.com/` | `coffee_shop` | NO_WEBSITE *(audit yok)* | 4.8 / 14 | **STARTER** | **Premium** |
| 20 | Fable and Falcon | `https://www.fableandfalcon.com/` *(404 / expired)* | `coffee_shop` | CRAWLED | 4.3 / 34 | **STARTER** | **Premium** |
| 19 | Blank Street Coffee | `https://www.blankstreet.com/` | `coffee_shop` | CRAWLED | 4.6 / 535 | **STARTER** | **Enterprise** |
| 18 | YBA Brazil | `https://instagram.com/ybabrazil` | `acai_shop` | CRAWLED | 4.9 / 81 | **STARTER** | **Premium** |
| 16 | The Drip | `https://www.thedrip.net/` | `coffee_shop` | NO_WEBSITE *(audit yok)* | 4.8 / 170 | **STARTER** | **Premium** |
| 15 | Camden Coffee Roastery | `http://camdencoffeeroastery.com/` | `coffee_shop` | CRAWLED | 4.6 / 799 | **STARTER** | **Premium** |
| 14 | LUMI Camden | `https://www.lumilondon.co.uk/` | `cafe` | CRAWLED | 4.8 / 2505 | **STARTER** | **Premium** |
| 13 | Black Sheep Coffee | `https://blacksheepcoffee.co.uk/blogs/locations/camden…` | **`food_store`** | CRAWLED | 4.7 / 513 | **STARTER** | **Enterprise** |

**Anomaliler:**
- **Tüm 12 lead'de `suggested_offer = STARTER`** (Round 2 yeni bug #1 kanıtı, bkz. § 3.1).
- **Black Sheep `primary_type = food_store`** (Round 1 #5'in zincir varyantı, bkz. § 4.5).
- **YBA Brazil `primary_type = acai_shop`** — Google Places'in döndürdüğü doğru tip; sub-niche'e iletilmiş (`fnb-cafe-bakery` confidence 0.55 — düşük).
- **S.O.S Coffee + The Drip + Il botanico**'da `crawl_status = NO_WEBSITE` ama `website_url` set — `website_audits` tablosunda satır YOK; audit hiç oluşturulmamış (bkz. § 4.6).
- **One Shot Coffee `opportunity_score = 100`** halbuki `crawl_status = NO_WEBSITE` ve `audit.crawl_error = SOCIAL_MEDIA_ONLY`; site yok ama "fırsat skoru" tavan değer.

---

## 2 · Round 1 → Round 2 Statü Tablosu

| Round 1 Sorun | Fix Durumu | Round 2'deki Vakalar | Kod Path |
|---|---|---|---|
| **#1 Instagram-as-Website** | ✅ Yeni audit'lerde fix uygulandı (`social-url-gate.ts` mevcut, `crawler.ts:90` çağırıyor). One Shot Coffee'nin Facebook URL'i `crawl_error="SOCIAL_MEDIA_ONLY"` döndürdü. ❌ Eski audit satırları re-trigger edilmedi. | Coffee Couch + YBA Brazil 2026-05-01 audit'leri hâlâ `has_booking=true`, `has_ecommerce=true` | [src/lib/audit/social-url-gate.ts](../../src/lib/audit/social-url-gate.ts), [src/lib/crawler.ts:90](../../src/lib/crawler.ts#L90) |
| **#2 Small-sample patlaması** | ❌ Fix yok | S.O.S Coffee 14 review → "Expensive 100%" + "Poor food/drink quality 100%"; Coffee Couch 50 review → "Bad coffee quality 100%" (sadece 1-2 yorumdan); Camden Coffee Roastery 50 review → 3 weakness KPI aynı anda %100 | [src/lib/agent-workers/review-analyst.ts](../../src/lib/agent-workers/review-analyst.ts), [src/lib/prompts/review-analysis-prompt.ts](../../src/lib/prompts/review-analysis-prompt.ts) |
| **#3 Hallucinated review label** | ❌ Fix yok | YBA Brazil "Automatic tip request" 50% — example sadece `"automatic tip request"` (label = pain_phrase echo); S.O.S Coffee "Expensive 100%" example sadece `"£7.10"` (kontekst yok); The Drip "Rude Staff & Toilet Access" tek bir label altında iki ayrı şikayet birleştirilmiş | [src/lib/agent-workers/review-analyst.ts](../../src/lib/agent-workers/review-analyst.ts) `isGroundedInCorpus` |
| **#4 Premium default paket** | ❌ Fix yok | 10/12 lead'de Premium önerildi (sadece chain-detected Black Sheep + Blank Street → Enterprise). One Shot (no website) ve S.O.S Coffee (14 review, küçük dükkan) hâlâ Premium alıyor. | [src/lib/agent-workers/sales-opportunity-scorer.ts:267-307](../../src/lib/agent-workers/sales-opportunity-scorer.ts#L267-L307), [src/lib/agent-workers/package-selector.ts](../../src/lib/agent-workers/package-selector.ts) |
| **#5 Sub-niche edge case** | ⚠️ Kısmen — `fnb-cafe-bakery` cafe lead'lerinde 0.6-1.0 confidence ile çalışıyor | Black Sheep zincir kafenin `primary_type` Google Places tarafından `food_store` olarak işaretlenmiş; UI'da bu raw değer rendered (§ 3.3) | [src/lib/agent-workers/subvertical-classifier.ts](../../src/lib/agent-workers/subvertical-classifier.ts) |
| **#6 Opener vertical anti-pattern** | ⚠️ Kısmen — `confirmedPainPoints` whitelist + `notApplicableModules` hard-rule eklendi ([opener-writer.ts:439-459](../../src/lib/agent-workers/opener-writer.ts#L439-L459)) | Hâlâ canlı: Fable and Falcon (expired site, opener "sitenizi inceledim"), Blank Street + Black Sheep (chain blindness — kendi app'lerine rağmen QR-to-order pitch ediliyor) | [src/lib/agent-workers/opener-writer.ts:200-249](../../src/lib/agent-workers/opener-writer.ts#L200-L249) |
| **#7 Embedding crash + 403** | ❌ Fix yok | `agent_runs` tablosu Round 2'de hâlâ aktif crash döngüsü gösteriyor: One Shot Coffee 8 ardışık `Failed to embed after 3 attempts` (`APIFY_WEB_CRAWL_DEEP`, 2026-05-02 23:51-23:58); LUMI Camden 2 × Gemini 403 (`LEAD_DOSSIER_GENERATOR`, 2026-05-03); Camden Coffee Roastery / Black Sheep / Glass Coffee / Il botanico / Fable and Falcon `WEBSITE_AUDITOR` ve `REVIEW_ANALYST` tarihinde `Failed to embed` | [src/lib/ai-core/memory.ts](../../src/lib/ai-core/memory.ts), [src/lib/ai-core/executor.ts](../../src/lib/ai-core/executor.ts) |
| **#8 Lead score kalibrasyon** | ❌ Fix yok | One Shot `opportunity_score=100` (no website), `lead_score=20`, `sales_confidence=35` — üç sayı arası 65 puanlık fark. Tester yorum yapmadı; bu rapor için P2'de bırakıyoruz. | [src/lib/agent-workers/sales-opportunity-scorer.ts](../../src/lib/agent-workers/sales-opportunity-scorer.ts), [src/lib/agent-workers/lead-intelligence-brief.ts](../../src/lib/agent-workers/lead-intelligence-brief.ts) |

---

## 3 · Round 2'de Tespit Edilen YENİ Bug Sınıfları

### Sorun 3.1 · Tier ↔ Package Mismatch (UI, kritik, YENİ)

**Kanıt — DB'den, doğrudan:**

| Lead | `recommended_package_id` | Package adı | `suggested_offer` | UI'da görünüm |
|---|---|---|---|---|
| One Shot Coffee | `2f6c135e-…` | **Premium** ($119/ay) | `STARTER` | "Package: Premium" + "Tier: Starter" → çelişki |
| Glass Coffee | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| Il botanico | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| Coffee Couch | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| S.O.S Coffee | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| Fable and Falcon | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| Blank Street Coffee | `2a133bc8-…` | **Enterprise** (custom) | `STARTER` | "Package: Enterprise" + "Tier: Starter" → daha da kötü |
| YBA Brazil | `2f6c135e-…` | **Premium** | `STARTER` | "Package: Premium" + "Tier: Starter" |
| The Drip | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| Camden Coffee Roastery | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| LUMI Camden | `2f6c135e-…` | **Premium** | `STARTER` | aynı |
| Black Sheep Coffee | `2a133bc8-…` | **Enterprise** | `STARTER` | "Package: Enterprise" + "Tier: Starter" |

**Tester'ın bağımsız tespiti (8 lead'de aynı şikayet):**
- One Shot: *"Tier bölümünde starter gözükmesi doğru ancak bu bölüm enterpriselarda dahi starter olarak gözükmekte"*
- Glass Coffee: *"Tier Starter olmasına rağmen önerilen paket yine premium olarak verilmiş … bu iki analiz de çakışmakta"*
- Il botanico: *"premium bu işletme için oldukça fazla ve aynı zamanda tier bölümünde starter olarak verilmesi de doğru bir analiz ancak bu iki analiz de çakışmakta"*
- Coffee Couch, S.O.S Coffee, Fable and Falcon, Camden Coffee Roastery, The Drip — aynı.
- Blank Street Coffee Camden: tester paket=Enterprise için "doğru" demiş ama Tier=Starter çakışmasını fark etmemiş. **Tester bu lead'i atladı, biz bulduk.**

**Koddaki kök neden** — [src/app/app/leads/[id]/page.tsx:958-967](../../src/app/app/leads/[id]/page.tsx#L958-L967):

```tsx
{opp?.recommendedPackage && (
  <Badge variant="success" className="text-[11px] font-normal">
    Package: {opp.recommendedPackage.name}
  </Badge>
)}
{opp?.suggestedOffer && (
  <Badge variant="outline" className="text-[11px] font-normal border-white/10 bg-white/5">
    Tier: {OFFER_LABELS[opp.suggestedOffer] ?? opp.suggestedOffer}
  </Badge>
)}
```

UI iki **bağımsız field**'i yan yana basıyor:
- `Package: opp.recommendedPackage.name` → `ServicePackage` tablosundan; analiz tarafından dinamik seçiliyor.
- `Tier: OFFER_LABELS[opp.suggestedOffer]` → `STARTER | GROWTH | SALES` enum'u; `sales-opportunity-scorer.ts` tarafından **ayrı** mantıkla atanıyor.

DB tarafında 12/12 lead'de `suggested_offer = STARTER`. Bu, scorer'ın `suggestedOffer` çıktısının ya tüm leadlerde aynı kararı veriyor ya da default'a düşüyor olduğunu gösteriyor. Round 1'de eklenen `recommendedPackageId` field'i, eski `suggestedOffer` enum'unu **güncelle­medi**; eski field hâlâ persist ediliyor ve UI ikisini birden gösteriyor.

**Çözüm stratejisi (P0):**

A. **Tier alanını kaldır VEYA package'tan derive et:**

```ts
function deriveTierFromPackage(packageName: string | null): "STARTER" | "GROWTH" | "ENTERPRISE" {
  if (!packageName) return "STARTER";
  const lc = packageName.toLowerCase();
  if (lc.includes("enterprise") || lc.includes("custom")) return "ENTERPRISE";
  if (lc.includes("premium") || lc.includes("pro")) return "GROWTH";
  return "STARTER";
}
```

UI'da:

```tsx
const tier = opp.recommendedPackage
  ? deriveTierFromPackage(opp.recommendedPackage.name)
  : opp.suggestedOffer;
```

B. **`suggestedOffer` field'ını migrate et:** Mevcut field'i kaldırıp `recommendedPackage` tek doğru kaynak yap. AI Core scorer'ında `suggestedOffer` üreten satırları sil; `package-selector.ts` kararı `recommendedPackageId`'ye yazsın, başka bir yere yazmasın.

C. **Geçici fix (1 saat):** UI'da iki badge'den birini kaldır ya da ikisini tek badge'e birleştir: `"Package: Premium ($119/ay)"`.

**Beklenen etki:** 12/12 lead'de görünen "Tier Starter ama Package Premium" çelişkisi kaybolur; rep'ler tek tutarlı paket önerisi görür.

---

### Sorun 3.2 · Glance / Wedge Duplication (UI, YENİ)

**Kanıt — Kod ve DB doğrulaması:**

[src/app/app/leads/[id]/page.tsx:936-1000](../../src/app/app/leads/[id]/page.tsx#L936-L1000) `HeroPriorityStrip` aynı strip içinde **iki ayrı array**'i dedupe etmeden render ediyor:

```tsx
// Path A — wedges (deterministic audit'ten)
const wedges: string[] = [];
if (audit?.hasWhatsappLink === false) wedges.push("No WhatsApp");
if (audit?.hasContactForm === false) wedges.push("No contact form");
if (raw?.hasQrMenu === true) wedges.push("QR menu detected");

// Path B — reasonCodes (Gemini scorer çıktısı)
{reasonCodes.map((code) => (
  <Badge key={code}>{REASON_LABELS[code] ?? code.replace(/_/g, " ")}</Badge>
))}
```

`reasonCodes` kaynağı Gemini `sales-opportunity-scorer`. DB'den One Shot Coffee'nin `reason_codes`:

```
["no_website","poor_mobile","weak_seo","site_unreachable","no_contact_form",
 "no_analytics","weak_security_headers","no_booking","no_whatsapp",
 "no_open_graph","no_structured_data","no_pwa","no_ecommerce",
 "services_unclear","high_rating_weak_site","no_qr_menu","no_reservation",
 "high_review_volume","icp_fit"]
```

[src/lib/labels.ts:51-72](../../src/lib/labels.ts#L51-L72) `REASON_LABELS`:
```
"no_whatsapp"     → "No WhatsApp"
"no_contact_form" → "No Contact Form"
```

Aynı sinyal hem deterministic audit'ten ("No WhatsApp" wedge) hem Gemini reason_codes'tan ("No WhatsApp" badge) **iki kez** çıkıyor.

**Tester'ın bağımsız tespiti (10 lead'de):**
- One Shot Coffee: *"At a glance bölümünde No Contact bölümü yine çakışmakta"*
- Glass Coffee: *"No whatsapp ifadeleri at a glance bölümünde yine çakışmakta"*
- Coffee Couch: *"No Whatsapp ve No contact form ifadesi At a glance bölümünde yine duplication yapmış"*
- S.O.S Coffee: aynı
- Fable and Falcon: *"No Whatsapp form ibaresi yine at a glance alanında duplication'a uğraşmış"*
- Blank Street: *"No contact form bölümündeki duplication sorunu yine devam etmekte … No whatsapp bölümünde de duplication oluşmuş"*
- YBA Brazil: *"No whatsapp number ifadesi duplicate ediyor … No contact form ifadesi duplicate ediyor"*
- Camden Coffee Roastery: *"İki adet no whatsapp yine duplication durumunda"*

**Özel varyant — The Drip "No website + Weak website":**

The Drip için DB'de:
- `crawl_status = NO_WEBSITE` (lead seviyesi)
- `reason_codes` içinde **hem** `"no_website"` (= "No Website") **hem** `"high_rating_weak_site"` (= "High Rating, Weak Site") var.

Tester: *"at a Glance bölümünde No website, doğru olmasına rağmen aynı zamanda 'Weak website adında başka bir glance var' — bu hem duplication hem hata"*. Mantıken çelişkili: site **yoksa** "weak" olamaz, "yok"tur. Gemini her iki reason_code'u da üretiyor, UI dedupe etmiyor.

**Çözüm stratejisi (P0):**

A. **UI dedupe katmanı** — `HeroPriorityStrip` içinde:

```tsx
const allBadges = new Set<string>();
const wedges: string[] = [];
if (audit?.hasWhatsappLink === false) wedges.push("No WhatsApp");
// …

// reasonCodes ayrı bir set
const reasonCodeLabels = reasonCodes.map(c => REASON_LABELS[c] ?? c.replace(/_/g, " "));

// final dedupe
const finalBadges = Array.from(new Set([...wedges, ...reasonCodeLabels]));
```

B. **Reason-code prune layer** — `sales-opportunity-scorer.ts` Gemini'den `reason_codes` aldıktan sonra deterministic audit field'larıyla çelişen ya da redundant olanları çıkarsın:

```ts
// Eğer audit deterministic olarak hasWhatsappLink=false set ettiyse,
// Gemini'nin "no_whatsapp" reason_code'u redundant — at.
const auditDerivedCodes = new Set<string>();
if (audit.hasWhatsappLink === false) auditDerivedCodes.add("no_whatsapp");
if (audit.hasContactForm === false) auditDerivedCodes.add("no_contact_form");

const filteredReasonCodes = analysis.reason_codes.filter(c => !auditDerivedCodes.has(c));
```

C. **Mutually-exclusive reason_codes** — `gemini.ts`'in scorer prompt'una ekle: `"no_website"` set edildiğinde `"high_rating_weak_site"`, `"weak_seo"`, `"poor_mobile"`, `"site_unreachable"` çıkar (site yok zaten).

**Beklenen etki:** "No WhatsApp × 2", "No contact form × 2", "No website + Weak website" duplikasyonları kaybolur; strip okunabilir hale gelir.

---

### Sorun 3.3 · `primaryType` Ham snake_case Gösterim (UI, YENİ)

**Kanıt — DB ve kod:**

DB'de `lead.primary_type` Google Places API'sinden olduğu gibi geliyor:

| Lead | primary_type (DB) | UI'da gözüken |
|---|---|---|
| One Shot Coffee | `coffee_shop` | "coffee_shop" (raw) |
| Glass Coffee | `coffee_shop` | "coffee_shop" |
| Fable and Falcon | `coffee_shop` | "coffee_shop" |
| YBA Brazil | `acai_shop` | "acai_shop" |
| Black Sheep Coffee | `food_store` | "food_store" |
| Coffee Couch | `cafe` | "cafe" (zaten okunaklı) |
| LUMI Camden | `cafe` | "cafe" |

[src/app/app/leads/[id]/page.tsx:1052](../../src/app/app/leads/[id]/page.tsx#L1052):
```tsx
if (lead.primaryType) chips.push({ label: lead.primaryType });
```

[src/app/app/leads/[id]/page.tsx:1598](../../src/app/app/leads/[id]/page.tsx#L1598):
```tsx
<RailRow label="Type">
  <span className="text-[14px] text-white/85 truncate">{lead.primaryType || "—"}</span>
</RailRow>
```

İki yerde de humanize / title-case yok.

**Tester'ın gözlemi:**
- Fable and Falcon: *"Coffee Shop ibaresi yine coffee_shop olarak yazılmış"*
- The Drip, Camden Coffee Roastery, YBA Brazil: aynı
- Black Sheep: *"kafe food_store olarak analiz edilmiş, hem de yanlış text fontuyla yazılmış"*
- One Shot Coffee, Fable and Falcon: tester aynı bug'ı yorumluyor

**Çözüm stratejisi (P0):**

A. **Humanize util ekle** — `src/lib/labels.ts`'e:

```ts
export function humanizePrimaryType(raw: string | null): string {
  if (!raw) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bShop\b/, "Shop")
    .replace(/\bCafe\b/, "Café"); // optional
}
```

B. **Yanlış primary_type override** — Black Sheep `food_store` Google Places'in döndürdüğü teknik tip; `niches/index.ts`'in `primaryType` görünümünde override edilebilir bir mapping ekle:

```ts
const PRIMARY_TYPE_DISPLAY_OVERRIDE: Record<string, string> = {
  food_store: "Coffee Shop / Chain", // Black Sheep gibi zincir kafeler
  acai_shop: "Açaí & Coffee Shop",
};
```

C. **Sub-niche label'ı kullan** — `lead.subNicheSlug` (`fnb-cafe-bakery`) ile niche pack'in `label` field'ını çek (`"Cafes & bakeries"`); UI'da `primary_type` yerine onu göster.

**Beklenen etki:** Tüm cafe lead'lerinde "coffee_shop" yerine "Coffee Shop", Black Sheep'te "food_store" yerine "Coffee Shop / Chain" gösterilir.

---

### Sorun 3.4 · Conversion Features ↔ Restaurant Tech Signals Çakışması (YENİ kategori)

**Kanıt — DB'den, lead bazında:**

| Lead | `audit.has_booking_system` (Conversion Features chip) | `rawFeaturesJson.hasOnlineReservation` (Tech Signals chip) | `rawFeaturesJson.hasQrMenu` (Tech Signals chip) | Gerçek site |
|---|---|---|---|---|
| LUMI Camden | **false** | **true** ❌ | false | Site açıkça "no bookings, walk-in welcome" diyor — ikisi de yanlış |
| Coffee Couch | **true** ❌ | false | false | Instagram URL — ikisi de yanlış (eski audit) |
| YBA Brazil | **true** ❌ | false | false | Instagram URL — ikisi de yanlış (eski audit) |
| Glass Coffee | false | false | **true** ❌ (`detectedMenuTool="E-Menu"`) | Sitede QR menü yok — false-positive |
| Camden Coffee Roastery | false | false | **true** ❌ (`detectedMenuTool="E-Menu"`) | E-commerce coffee bag satışı var, QR menü yok |
| Black Sheep Coffee | false | false | **true** ❌ (`detectedMenuTool="E-Menu"`) | Chain app'te QR var ama Camden şube sitesinde yok |
| Blank Street Coffee | false | false | false | OK |

**Tester'ın bağımsız tespiti:**
- LUMI Camden: *"Restourant tech signals bölümü çok ciddi bir hata yaparak booking feature bölümü olduğunu söylemiş … Booking feature bölümü var demesinin sebebi 'no bookings, walk in welcome' ibaresindeki bookings keyword'ü olabilir"*
- Coffee Couch: *"Conversion features olmamasına rağmen E Commerce ve Booking sistema olduğunu söylüyor … Conversion features ve Restaurant tech signals çakışıyor"*
- Glass Coffee: *"Restaurant Tech Signals QR menü bulunduğunu iddia etmiş ancak buna dair bir delil bulunamadı"*
- Camden Coffee Roastery: *"QR menüden var denmiş ancak QR menü ile alakalı bir şeye ulaşamadım, sadece E commerce sayfasında bag coffee var"*

**Koddaki kök neden — iki ayrı extractor path'i:**

[src/lib/extractor.ts:106-119](../../src/lib/extractor.ts#L106-L119) — **Path A (Conversion Features)**:

```ts
const BOOKING_KEYWORDS = [
  "appointment", "schedule", "reserve", "reservation", "booking",
  "calendly", "acuity", "setmore", "timely", "opentable", "resy",
];
// Multi-signal final decision (Round 1 yaması):
const hasBookingSystemFinal =
  bookingProvider !== null ||
  (jsonLdReservation && ctaSignalsBooking);
```

[src/lib/extractor.ts:23-35, 506-521](../../src/lib/extractor.ts#L23-L35) — **Path B (Tech Signals)**:

```ts
const RESERVATION_PATTERNS = [
  "opentable", "sevenrooms", "resy.com", "bookatable", "quandoo",
  "fork.com", "yelp.com/reservations", "tablein", "tablecheck",
  "eat-app", "restobooking",
];
const QR_MENU_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "finedinemenu", label: "FineDine" },
  { pattern: "menutiger", label: "MenuTiger" },
  // ...
  { pattern: "e-menu", label: "E-Menu" },         // ← çok kısa, false-pos riski yüksek
  { pattern: "digitalmenu", label: "Digital Menu" },
];
const hasOnlineReservation = RESERVATION_PATTERNS.some((p) => fullHtml.includes(p));
// ↑ Substring match — Round 1 §1'in yamalanmamış halı.
const hasQrMenu = QR_MENU_PATTERNS.find(({ pattern }) => fullHtml.includes(pattern));
```

**İki sorun:**

1. **Round 1 yaması sadece Path A'ya uygulandı** — `hasBookingSystem` artık multi-signal (provider VEYA jsonLd+CTA). Ama `hasOnlineReservation` hâlâ ham `fullHtml.includes("opentable")` → e.g. `<a>We're not on OpenTable, please call us</a>` → true.
2. **`"e-menu"` pattern'i çok kısa** — Glass Coffee, Camden Coffee Roastery, Black Sheep'te HTML içinde `e-menu` substring'i (örn. `<a class="e-menu-link">` veya `<div data-e-menu>` veya bir CSS sınıf adı) eşleşip QR menu false-pos veriyor. Detected tool olarak `"E-Menu"` etiketi basılıyor.

**UI'da yan yana:**
- [src/components/app/website-intelligence-panel.tsx:802-829](../../src/components/app/website-intelligence-panel.tsx#L802-L829) `ConversionSection` → Booking chip = `audit.hasBookingSystem` (strict)
- [src/components/app/website-intelligence-panel.tsx:1147-1177](../../src/components/app/website-intelligence-panel.tsx#L1147-L1177) `RestaurantSignalsSection` → Online reservation chip = `rawFeaturesJson.hasOnlineReservation` (loose substring)

İki bölüm aynı sayfada, aynı kavram (rezervasyon) hakkında **çelişkili** chip'ler basabiliyor.

**Çözüm stratejisi (P0):**

A. **`hasOnlineReservation` ve `hasQrMenu` aynı multi-signal kapısından geçsin:**

```ts
// extractor.ts
const hasOnlineReservation =
  bookingProvider !== null ||                              // strong signal
  (RESERVATION_PATTERNS.some((p) => fullHtml.includes(p))  // substring
    && ctaSignalsBooking);                                 // + CTA confirmation

const hasQrMenu =
  QR_MENU_PATTERNS.some(({ pattern }) =>
    pattern.length >= 8                                    // sadece spesifik pattern'ler
      ? fullHtml.includes(pattern)
      : hasMenuToolHostname(allLinks, pattern)             // kısa pattern → URL/href check
  );
```

B. **`"e-menu"` pattern'ini kaldır VEYA URL gate'i ekle** — `e-menu` 5 char çok kısa; sadece bir provider hostname (`finedinemenu.com`, `e-menu.com.tr` gibi) eşleştiğinde positive say:

```ts
function hasMenuToolHostname(links: { href: string }[], pattern: string): boolean {
  return links.some((l) => {
    try {
      const u = new URL(l.href);
      return u.hostname.includes(pattern);
    } catch {
      return false;
    }
  });
}
```

C. **UI'da tek tutarlı chip katmanı** — `ConversionSection` ve `RestaurantSignalsSection` aynı `audit.hasBookingSystem` field'ını paylaşsın; `rawFeaturesJson.hasOnlineReservation` direkt UI'a sızdırılmasın. Single source of truth.

**Beklenen etki:** LUMI'de Tech Signals reservation chip'i kaybolur; Glass / Camden Roastery / Black Sheep'te yanlış QR menu detection'ı düzelir; iki bölüm arası çelişki ortadan kalkar.

---

### Sorun 3.5 · Stale Audit Re-trigger Eksikliği (YENİ kategori, kritik)

**Kanıt — DB timestamp'larından:**

```
Lead              | audit.crawl_attempted_at | audit.crawl_error    | has_booking_system
------------------|--------------------------|----------------------|-------------------
One Shot Coffee   | 2026-05-05 20:00:17     | SOCIAL_MEDIA_ONLY    | false ✅
Coffee Couch      | 2026-05-01 17:30:56     | null                 | true  ❌
YBA Brazil        | 2026-05-01 17:30:15     | null                 | true  ❌
```

**Yorumlama:**
- One Shot Coffee'nin Facebook URL'i 2026-05-05'te (Round 1 fix sonrası) re-audit edildi → `social-url-gate` doğru çalıştı, `crawl_error="SOCIAL_MEDIA_ONLY"` set edildi.
- Coffee Couch ve YBA Brazil'in Instagram URL'leri 2026-05-01'de (Round 1 fix öncesi) audit edildi; `has_booking=true`, `has_ecommerce=true` o zamanki broken extractor mantığıyla yazıldı.
- Round 1 fix ([src/lib/audit/social-url-gate.ts](../../src/lib/audit/social-url-gate.ts)) kod tarafında deploy edildi **ama eski audit satırları için backfill / re-trigger çalışmadı**. Bu iki lead hâlâ yanlış DB verisi taşıyor.

**Tester'ın gözlemi (Round 1 bug'ının hâlâ canlı görünmesi):**
- Coffee Couch: *"Yapay Zeka Website alanına Instagram girilmesiyle yine çuvallamış … Conversion features olmamasına rağmen E Commerce ve Booking sistema olduğunu söylüyor"*
- YBA Brazil: *"Website yerine Instagram koyulunca yine çuvallamış, bu bug hala düzeltilmemiş"*

Tester'ın "bug fix edilmemiş" izlenimi mantıklı çünkü UI'da yanlış field'lar görünüyor; ama gerçek sebep, yamanın retroactive uygulanmaması.

**Koddaki kök neden** — Audit re-trigger için var olan hook ([src/lib/agent-workers/website-auditor.ts](../../src/lib/agent-workers/website-auditor.ts) "Phase 2.6: stamp the audited URL"):

```ts
// crawl_status = "CRAWLED", lastAuditedWebsiteUrl: lead.websiteUrl
```

Bu hook **websiteUrl değiştiğinde** re-audit fırlatıyor. Ama `social-url-gate`'in eklenmesi `websiteUrl`'i değiştirmediği için (URL aynı kaldı) tetiklenmedi.

**Çözüm stratejisi (P0):**

A. **Bir kez çalışacak backfill script'i** — `scripts/backfill-social-url-audits.ts`:

```ts
// Tüm aktif workspace'lerde:
//   website_audits where reachable=true AND (
//     url ~ 'instagram\\.com' OR
//     url ~ 'facebook\\.com'  OR
//     url ~ 'tiktok\\.com'
//   )
// için WEBSITE_AUDITOR'ı tekrar enqueue et.
```

B. **Audit version stamping** — `website_audits` tablosuna `auditor_version` kolonu ekle. Yeni gate landing'inde version 2 yaz; başlangıçta tüm satırları re-trigger et:

```ts
const AUDITOR_VERSION = 2;
if (audit.auditorVersion < AUDITOR_VERSION) await enqueueAudit(lead.id);
```

C. **Periodic stale-audit refresh** — Cron job: 30+ gün önce audit edilmiş lead'leri re-audit et (zaten "Phase 2.6" `lastAuditedWebsiteUrl` mantığının doğal uzantısı).

**Beklenen etki:** Coffee Couch, YBA Brazil ve diğer pre-fix audit satırları yenilenir; UI'da tutarlı veri gösterilir. Round 1 bug'ı "fix edilmiş ama hâlâ görünüyor" durumu ortadan kalkar.

---

### Sorun 3.6 · Quota Error Message Yanıltıcılığı (YENİ)

**Kanıt — `agent_runs` tablosundan, One Shot Coffee:**

```
2026-05-05 20:29:18  SALES_OPPORTUNITY_SCORER  FAILED  "Quota exceeded for SALES_OPPORTUNITY_SCORER: 44/50000"
2026-05-05 20:20:20  SALES_OPPORTUNITY_SCORER  FAILED  "Quota exceeded for SALES_OPPORTUNITY_SCORER: 44/50000"
2026-05-05 20:20:18  REVIEW_ANALYST            FAILED  "Quota exceeded for REVIEW_ANALYST: 26/50000"
2026-05-05 20:19:18  LEAD_INTELLIGENCE_BRIEF   FAILED  "Quota exceeded for LEAD_INTELLIGENCE_BRIEF: 42/50000"
2026-05-05 20:18:18  SUBVERTICAL_CLASSIFIER    FAILED  "Quota exceeded for SUBVERTICAL_CLASSIFIER: 76/50000"
… (15 ardışık FAILED run)
```

**Mantık problemi:** Mesaj `"44/50000"` yani 44 kullanılmış / 50000 kotalı. Matematik olarak `44 < 50000` → quota dolu değil. Yine de FAILED dönüyor. Mesaj yanıltıcı.

**Koddaki kök neden** — [src/lib/agent-workers/quota.ts:377-389, 442-474](../../src/lib/agent-workers/quota.ts#L377-L389):

```ts
// checkWorkerQuota — LİNE 377
if (args.leadId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const leadUsed = await prisma.agentRun.count({
    where: {
      workspaceId: args.workspaceId,
      leadId: args.leadId,
      status: { in: ["PENDING", "RUNNING", "SUCCEEDED"] },
      createdAt: { gte: since },
    },
  });
  if (leadUsed >= PER_LEAD_DAILY_CAP) {  // = 50
    base.allowed = false;
  }
}
// QuotaCheckResult'ta `used` ve `limit` HÂLÂ worker-quota değerleri (44/50000)
```

Sonra `assertWorkerQuota`:

```ts
// LİNE 442 — eğer allowed=false ise:
//   1) Apify budget mi kontrol et
//   2) Per-lead daily cap'i TEKRAR sorgula
//   3) leadUsed >= 50 ise → PerLeadDailyCapExceededError fırlat (DOĞRU)
//   4) ELSE → QuotaExceededError(44, 50000) fırlat ← YANILTICI
```

**İki olasılık** (her ikisi de zararlı):

1. **Race condition:** İlk check'te leadUsed=51 (yasaklı), `assertWorkerQuota`'nın ikinci sorgusunda bir RUNNING row FAILED'a geçti → leadUsed=50 → fall-through → yanlış error.
2. **Status filtering tutarsızlığı:** Per-lead cap PENDING+RUNNING+SUCCEEDED sayar ama FAILED saymaz. One Shot'ın 8+ FAILED retry'ı olduğu için actual lead activity 50'nin üstünde ama count düşüyor.

**Tester etkisi:** Rep "Re-analyze" butonuna basıyor; UI "Quota exceeded 44/50000" diyor; rep "ama henüz çok kullanmadım" diye baştan başlıyor; sonsuz döngü. Bu durum One Shot'ın detay sayfasını "her şey FAILED" gösteriyor olabilir.

**Çözüm stratejisi (P0):**

A. **QuotaCheckResult'a "block reason" alanı ekle:**

```ts
interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  blockReason: "WORKER_QUOTA" | "PER_LEAD_DAILY_CAP" | "APIFY_BUDGET" | null;
  // …
}
```

`assertWorkerQuota` block reason'a göre doğru error fırlatsın; race olsa bile tutarlı.

B. **Per-lead cap tek bir transaction'da değerlendirilsin** — `checkWorkerQuota` ve `assertWorkerQuota` aynı snapshot'tan beslensin (Postgres'in `SERIALIZABLE` izolasyonu veya tek bir aggregate query).

C. **One Shot Coffee için manuel müdahale** — Tester'ın 7 saatte 15+ retry yapmış olması, UI'ın yanlış error message'ı sebebiyle. Bu rep'lerin gereksiz kotayı yakmasına sebep oluyor.

**Beklenen etki:** "44/50000" gibi anlamsız error'lar yerine `"Bu lead için günlük 50 AI çalıştırması sınırına ulaştınız — yarın tekrar deneyin"` doğru mesajı çıkar.

---

### Sorun 3.7 · Why They're a Fit — Zincir Körlüğü (YENİ kategori)

**Kanıt — DB ve site:**

| Lead | Chain mı? | `reason_codes` chain detect | `pain_points` (ilk 3) | Gerçek durum |
|---|---|---|---|---|
| Blank Street Coffee | ✅ Evet (UK chain, kendi mobil app'i, loyalty + order ahead) | `["chain_detected"]` ✅ | "Sipariş öncesi veya masadan sipariş sistemi olmaması", "isteklerine göre kişiselleştirme yapamama", "manuel sipariş almaktan kaynaklanan kötü tutum" | App'te zaten order-ahead VAR, loyalty VAR, kişiselleştirme app içinden mevcut |
| Black Sheep Coffee | ✅ Evet (UK-wide, kendi app'i + order ahead + loyalty) | `["chain_detected", "no_booking", "no_whatsapp", …]` ✅ | "QR'dan sipariş ve ödeme akışının olmaması", "Online rezervasyon eksikliği", "Servis yavaşlığı" | App'te QR'dan sipariş VAR, order-ahead VAR; rezervasyon kahveci için zaten gereksiz |

**Tester'ın gözlemi:**
- Blank Street: tester yorum yapmadı (atlamış) ama AI dossier'in benzer pain point'leri ürettiği görülüyor.
- Black Sheep: *"Likely pain points bölümünde QR entegrasyonu, order ahead gibi özelliklerin olmadığı belirtilmiş ancak bu sistemlerin hepsi uygulama ve websitesi ile entegre çalışmakta. … İşletme tarafından dijitalleşme ile çözülmüş sorunları tekrardan aynı yöntemle çözmeye çalışmak yanlış."*

**Koddaki kök neden:**

[src/lib/agent-workers/sales-opportunity-scorer.ts:265-269](../../src/lib/agent-workers/sales-opportunity-scorer.ts#L265-L269):

```ts
const hasMultipleLocations = analysis.reason_codes.some(
  (c) => typeof c === "string" && /chain_detected/i.test(c),
);
```

Chain detection package selector'a `Enterprise` paket önermek için **kullanılıyor** ✅ — ama **pain_points üretimine girmiyor**. Gemini scorer prompt'una "bu chain'in zaten X özelliği olabilir" sinyali iletilmiyor; LLM her cafe lead'ine aynı pain template'ini uyguluyor:
- "Sabah yoğunluğu / order-ahead eksikliği"
- "QR menü eksikliği"
- "Loyalty programı eksikliği"

Site crawl'ı **Camden şubesi sayfasını** (`/blogs/locations/camden`) görüyor; chain'in ana app'i veya `/order` flow'unu görmüyor; "no QR menu, no order ahead" diye işaretliyor.

**Çözüm stratejisi (P1):**

A. **Chain-aware prompt branching** — `gemini.ts`'in scorer prompt'una `chain_detected` reason_code'u set edildiğinde özel bir constraint blok'u ekle:

```
This business is part of a chain (chain_detected = true). Before listing
pain points about missing digital infrastructure (QR menu, order ahead,
loyalty), assume the chain may already operate these CENTRALLY through
their main brand app or website. Only list a pain point as missing if you
have explicit evidence from THIS LOCATION's sub-page or reviews.
```

B. **Chain root crawl** — Yeni bir agent worker (`CHAIN_ROOT_AUDITOR`): Chain detected lead için, lead'in `websiteUrl`'inden chain root domain'i çıkarıp (`blacksheepcoffee.co.uk`) onu da crawl et; `app store url`, `loyalty page`, `order ahead page` var mı kontrol et. Sonuçları lead'in `confirmedFeatures` array'ine ekle (lead-intelligence-brief whitelist).

C. **Chain-aware niche pack:** `niches/index.ts`'e chain'lere özel `chainConsiderations` field'ı ekle:

```ts
{
  slug: "fnb-cafe-bakery",
  // ...
  chainConsiderations: {
    likelyHasOrderAhead: ["Blank Street", "Black Sheep", "Caffè Nero", "Pret"],
    // ...
  }
}
```

`sales-opportunity-scorer` chain detect edildiğinde businessName'i bu listeyle eşleştirip pain_points'i suppres etsin.

**Beklenen etki:** Black Sheep / Blank Street pain_points'ten "no order-ahead, no loyalty" çıkar; pitch zincir-merkez yönetim, multi-property analytics gibi gerçekten Enterprise konularına döner.

---

### Sorun 3.8 · Personalized Message Bağlam İhlali — Yeni Varyantlar

**Kanıt:**

**Vaka A — Fable and Falcon (expired site):**
- DB: `audit.title="Squarespace - Website Expired"`, `http_status=404`, `reachable=false`
- Opener (DB'den): *"Merhaba Fable and Falcon ekibi, **sitenizi hızla incelediğimde**, modern bir QR ile sipariş akışının eksik olduğunu fark ettim ve size özel bir taslak hazırladım."*
- Tester: *"Personalized message geliştirilerek güzelleştirilebilir çünkü, domaini expired olan bir site için sitenizi inceledik diye opener başlamamalı"*

Site 404 + expired durumda iken opener "sitenizi hızla incelediğimde" diye başlıyor → bağlam ihlali.

**Vaka B — Black Sheep (chain blindness'ın opener'a sızması):**
- Opener: *"Black Sheep Coffee'de QR'dan sipariş/ödeme akışının eksik olduğunu fark ettik. Misafirlerinizin '20 dakika kahve bekleme' gibi sorunlarını çözmek ve ek satışları %18 artırmak için …"*
- Black Sheep app'te QR-to-order zaten var; pitch çoktan çözülmüş bir soruna.
- Tester: *"personalized message oldukça başarısız, kurumsal bir firmaya yaklaşmak için halıhazırda çözmüş oldukları sorunları sunmak çok mantıksız"*

**Vaka C — Coffee Couch (Türkçe-İngilizce kalitesi):**
- Tester: *"Opener yine oldukça yanlış ve devrik şekilde yazılmış"*
- Opener: *"FineDine olarak, özellikle sabah yoğunluklarında 'QR-to-order' sistemiyle sipariş alma sürecinizi hızlandıracak ve 'BEST coffee in London' müdavimlerinizi sadık müşterilere dönüştürecek özel bir dijital çözüm hazırladık."*
- "Sabah yoğunluklarında … sipariş alma sürecinizi hızlandıracak … sistemle sürecinizi" — gramer bozuk, devrik cümle.

**Vaka D — Blank Street (chain blindness opener'a sızıyor):**
- Opener: *"sitenizi hızlıca inceledik ve sizin için özel olarak hazırlanmış bir QR'dan sipariş akışı taslağı oluşturduk. … operasyonel verimliliği artırıp sabah yoğunluğunu yönetirken, sadakat programınızı da güçlendirebilirsiniz."*
- "Sadakat programınızı güçlendirebilirsiniz" — Blank Street'in zaten loyalty programı var; pitch yanıltıcı.

**Koddaki kök neden:**

[src/lib/agent-workers/opener-writer.ts:200-249](../../src/lib/agent-workers/opener-writer.ts#L200-L249) `buildOpenerPrompt`:

Opener'a aktarılan parametreler:
- `businessName`, `primaryType`, `borough`, `rating`, `reviewCount`
- `bestSalesAngle`, `painPhrases`
- `nicheLabel`, `nichePitchAngle`, `nicheFeaturedModules`
- `confirmedPainPoints`, `confirmedMissingFeatures` (brief whitelist)
- `recommendedPackage`

**Eksik parametreler:**
- ❌ `crawlStatus` (NO_WEBSITE / CRAWLED / FAILED)
- ❌ `crawlError` (`SOCIAL_MEDIA_ONLY`, `UNKNOWN`, `BLOCKED_BY_GUARD`)
- ❌ `httpStatus` (404 = expired)
- ❌ `auditTitle` (`"Squarespace - Website Expired"` gibi sinyaller)
- ❌ `chainDetected` (Round 1 P1 fix'inde paket selector'a iletildi ama opener'a iletilmedi)

Opener prompt'u sitenin durumunu bilmiyor — sadece `mockupUrl` var/yok kontrolü yapıyor. "Sitenizi inceledim" diyebilmesi için site state'i prompt'ta olmalı.

**Çözüm stratejisi (P1):**

A. **Crawl context'i opener'a aktar:**

```ts
// opener-writer.ts:200
const prompt = buildOpenerPrompt({
  // ... mevcut field'lar
  websiteContext: {
    status: lead.crawlStatus,                    // NO_WEBSITE / CRAWLED / FAILED
    audit: audit ? {
      reachable: audit.reachable,
      title: audit.title,
      httpStatus: audit.httpStatus,
      crawlError: audit.crawlError,             // SOCIAL_MEDIA_ONLY, UNKNOWN
      socialPlatform: detectSocialMediaPlatform(audit.url),
    } : null,
  },
  isChain: opp?.reasonCodes?.includes("chain_detected") ?? false,
});
```

B. **Opener prompt'una koşullu açılış kuralları ekle:**

```
- If websiteContext.status === "NO_WEBSITE":
  Open with "{businessName}'in [Instagram/Facebook] üzerinden …"
  rather than "your website".
- If websiteContext.audit.title contains "Website Expired" OR
  audit.httpStatus === 404:
  Open with "{businessName}'in domaini şu an expired durumda — bu, dijital
  yatırım için tam zamanlama" rather than "sitenizi inceledim".
- If isChain === true:
  Open with chain-aware angle (multi-location console, group analytics)
  rather than location-level QR/order pitch.
```

C. **Round 1 P1.4 (`notApplicableModules`) cafe chain için genişlet:**

`niches/index.ts:fnb-cafe-bakery` pack'ine ekle:

```ts
notApplicableModulesForChain: [
  "Online Reservations",  // kahveci için zaten gereksiz
  "QR Menu",              // chain app'te zaten var
  "Order-ahead",          // chain app'te zaten var
  "Loyalty programı",     // chain app'te zaten var
],
```

**Beklenen etki:** Fable and Falcon opener'ı "sitenizi inceledim" yerine "domaini expired durumda" der; Blank Street + Black Sheep opener'ı QR pitch'i yerine "multi-property analytics" pitch'ine geçer.

---

### Sorun 3.9 · Identity & SEO — Instagram Bio Default Sızması (YENİ)

**Kanıt:**

DB'de Coffee Couch'un audit'i:
```
url:              https://www.instagram.com/couch_coffee/
title:            "Instagram"
meta_description: "Create an account or log in to Instagram - Share what you're into with the people who get you."
h1:               null
```

YBA Brazil:
```
url:              https://instagram.com/ybabrazil
title:            "Instagram"
meta_description: "Create an account or log in to Instagram - Share what you're into with the people who get you."
```

UI'da `meta_description` field'ı Identity & SEO bölümünde "İşletmenin SEO açıklaması" olarak gösteriliyor. Kullanıcı işletme tanıtımı bekliyor; Instagram'ın global default sayfa açıklaması geliyor.

**Tester'ın gözlemi:**
- Coffee Couch: *"Website olmamasına rağmen Instagram baz alındığı için maalesef Identify&Seo bölümü Instagram'ın ana tanıtımını veriyor."*

**Koddaki kök neden:**

[src/lib/agent-workers/website-auditor.ts:61-105](../../src/lib/agent-workers/website-auditor.ts#L61-L105) — sosyal URL gate'i çalıştığında audit row'u `meta_description: null`, `title: null`, `h1: null` ile yazıyor (ki bu **doğru** davranış). Ama **bu fix Round 1'de eklendi**; Coffee Couch + YBA Brazil'in audit'leri 2026-05-01'den (fix öncesi) kalma → eski crawler Instagram sayfasının raw HTML'inden meta_description çekti.

§ 3.5 ile aynı kök neden: stale audit'ler re-trigger olmadığı için eski yanlış field'lar görünüyor.

**Çözüm stratejisi (P0):**

A. **§ 3.5'in backfill'i bunu da çözer.** `social-url-gate` çalıştığında zaten `metaDescription: null, title: null, h1: null` set edilecek. Eski audit'ler re-trigger edildiğinde bu field'lar temizlenir.

B. **UI'da fallback** — `meta_description` `null` veya Instagram/Facebook default mesajı içeriyorsa (regex match: `/log in to (Instagram|Facebook)/i`) UI'da boş göster:

```tsx
const cleanedDesc = isSocialPlatformDefaultMeta(audit.metaDescription)
  ? null
  : audit.metaDescription;
```

C. **Identity & SEO bölümü social-only flag'i konuşur** — Audit `crawlError === "SOCIAL_MEDIA_ONLY"` ise "Identity & SEO" yerine "Social Profile Snapshot" göster, Instagram bio'yu özet olarak sun.

**Beklenen etki:** Coffee Couch ve YBA Brazil'de Identity & SEO bölümü Instagram default mesajı yerine "Social-only — no first-party SEO data" der.

---

### Sorun 3.10 · Non-English Review Leakage (YENİ)

**Kanıt — review_analyses'tan:**

**Camden Coffee Roastery (50 review):**

```
weakness_kpis:
  - Rude Staff 100% — examples include "always has this careless energy",
    "a really rude barista just ruined it for me"
  - Food Quality 100% — examples: "pannenkoeken tegen van smaak"  ← Hollandaca
                                  "food was disappointing"
  - Overpriced 100% — examples: "charge 50p for alternative milks", "little bit pricey"

strength_kpis:
  - Cozy Atmosphere — "L'ambiance est chaleureuse et l'endroit est vraiment bien décoré." ← Fransızca
```

**Il botanico (50 review):**

```
weakness_kpis:
  - Rude Staff 80% — examples: "Staff member behaviour like they are on top of the universe!",
                                "la ragazza antipatica",            ← İtalyanca
                                "la ragazza antipaticissima"        ← İtalyanca
  - Food Quality 80% — examples: "El peor helado que me he comido en años.", ← İspanyolca
                                  "un cappuccio che faceva schifo",          ← İtalyanca
                                  "il caffè lasciato lì, non si poteva bere" ← İtalyanca
  - Overpriced 60% — examples: "il compte les articles beaucoup plus chers aux étrangers", ← Fransızca
                               "caros!",                              ← İspanyolca
                               "Prices felt very high"
  - Bland Taste 60% — examples: "Sin sabor a nada"                   ← İspanyolca

pain_phrases: ["Big attitude and without manners!",
               "Sin sabor a nada y caros!",                          ← İspanyolca
               "un cappuccio che faceva schifo",                     ← İtalyanca
               "Prices felt very high",
               "toilet had a long queue and was unloved!"]
```

**Glass Coffee (50 review):**

```
weakness_kpis:
  - Slow Service 100% — examples: "Servizio un po' lento",           ← İtalyanca
                                  "Painfully slow service",
                                  "Ridiculously slow."
strength_kpis:
  - Fast Service 4% — examples: "Quick service",
                                "servis rapidement"                  ← Fransızca
```

**Tester'ın gözlemi:**
- Il botanico: *"likely pain points bölümünde İtalyanca bir yorumun mentionlanmış olması maalesef bu konuda anlaşılırlığı düşürmekte (Ingilizce yorumların bulunması Finedine için daha anlaşılır ve doğru olur)"*
- Camden Coffee Roastery: *"yorumlar bölümüne geldiğimizde bir tane bulunmasına rağmen gelen ingilizce harici bir yorum Glance olarak yorum bölümünde gözükmekte"*

**Koddaki kök neden:**

[src/lib/agent-workers/review-analyst.ts](../../src/lib/agent-workers/review-analyst.ts) ve [src/lib/prompts/review-analysis-prompt.ts](../../src/lib/prompts/review-analysis-prompt.ts) İngilizce-only filtre uygulamıyor. Apify Gmaps Deep Türkiye/UK lokasyon ayrımı yapmadan tüm review'ları çekiyor; review_analyst Gemini'ye tümünü besliyor; Gemini İngilizce KPI label'larını oluştururken yabancı dilde örnekleri de aynen alıntılıyor.

Workspace `language="tr"` olsa bile FineDine'ın ICP'si İngilizce konuşan UK işletmeleri; Türkçe rapor istesek bile İtalyanca/Fransızca/Hollandaca review'lar pitching için bağlam dışı.

**Çözüm stratejisi (P1):**

A. **Pre-LLM language filter** — `review-analyst.ts`'te Gemini'ye besleme adımı öncesinde:

```ts
import { detectAll } from "tinyld";  // veya benzeri lightweight library

const englishReviews = reviews.filter(r => {
  const detected = detectAll(r.text || "");
  return detected[0]?.lang === "en" && detected[0]?.accuracy > 0.8;
});

if (englishReviews.length < 5 && reviews.length >= 10) {
  // Workspace target dili mi yoksa "any" mi sorgulansın?
  // FineDine için İngilizce mecbur; başka workspace'ler için tone-based switch.
  englishReviews = workspaceTargetLang === "en"
    ? englishReviews
    : reviews; // İngilizce yoksa fallback
}
```

B. **Workspace-level target review language** — Workspace tablosuna `targetReviewLanguages: string[]` field'ı (default `["en"]` workspace `language === "tr"` olsa bile). Review_analyst sadece bu dillere filtrelesin.

C. **Prompt-level constraint** — Gemini prompt'a:

```
ALL example phrases in `examples[]` MUST be in English. If the source review
is in another language, do NOT cite it directly; either translate to English
in [brackets] OR exclude it entirely. Aggregate non-English reviews into the
percent count but never quote them.
```

**Beklenen etki:** FineDine için İngilizce konuşan ICP'ye daha temiz pitch context'i; Camden Coffee Roastery, Il botanico, Glass Coffee'de KPI alıntılarında Türk/İtalyan/Fransız/İspanyol kelimeleri görünmez.

---

## 4 · Round 1 Bug'larının Round 2'deki Devamı

### 4.1 · Instagram-as-Website (Round 1 #1) — yeni 2 vaka, yamalı 1 vaka

**Yamalı varyant:**
- One Shot Coffee (Facebook URL): 2026-05-05 audit `crawl_error="SOCIAL_MEDIA_ONLY"` ✅. `social-url-gate.ts` Facebook için çalıştı. **Round 1 fix burada başarılı.**

**Hâlâ aktif varyantlar (stale audit, § 3.5 ile aynı kök):**
- Coffee Couch (Instagram URL): 2026-05-01 audit hâlâ `has_booking=true`, `has_ecommerce=true`. ❌
- YBA Brazil (Instagram URL): 2026-05-01 audit hâlâ `has_booking=true`, `has_ecommerce=true`. ❌

**Tester impression:** "bu bug hâlâ düzeltilmemiş" — kod açısından yanlış (yama yapıldı), DB açısından doğru (eski satırlar kaldı).

### 4.2 · Hallucinated Review Snippets (Round 1 #3) — devam

**S.O.S Coffee:**
- weakness_kpi: `{"label":"Expensive","percent":100,"examples":["£7.10"]}`
- 14 review, 1 örnek, kontekst yok ("£7.10" nedir? — fiyat string'i; review değil).
- Tester: *"Yorumlar bölümünde expensive bar'ı mentionlanırken tek kelime olarak fiyat '7.10' olarak yazılmış açık ve anlaşılır değil"*

**YBA Brazil:**
- weakness_kpi: `{"label":"Automatic tip request","percent":50,"examples":["automatic tip request"]}`
- Bu klasik **label-as-example echo** bug'ı — Gemini KPI label'ını kendi olarak example olarak yapıştırıyor. Kanıt yok, gerçek review yok.
- pain_phrases: `["acai bowls a little pricey","automatic tip request",…]` — pain_phrase olarak da aynı string.
- Tester: *"Automatic tip request yazan halüsinasyon yorum bulunuyor."*

**The Drip:**
- weakness_kpi: `{"label":"Rude Staff & Toilet Access","percent":33,"examples":["abrupt, grumpy gentleman","toilet is really for staff not customers"]}`
- İki ayrı şikayet (kötü personel + tuvalet erişimi) **tek bir cluster label** altında. Birleşik label semantik olarak yanlış.
- Tester: *"Review Intelligence bölümünde Rude staff toilet access diye bir bölüm mentionlanmış ancak altındaki bölüm yorumun yanlış yerinden alıntılamış bu da anlamsız bir kötü yorum haline gelmiş."*

**Koddaki kök neden** (Round 1 § 2.3 ile aynı):
- `review-analyst.ts`'in `isGroundedInCorpus` cluster label'ları kontrol etmiyor (sadece pain_phrases'ı kontrol ediyor)
- Cluster label'ı LLM tarafından yaratılıyor; "rude staff" + "no toilet access" gibi farklı kategorileri tek bir cümlede birleştirmesini engelleyen kural yok

**Çözüm:** Round 1'in Sorun #3 fix'ini uygula (P0.4 — `min-example=2 filter + count field schema`).

### 4.3 · Premium-Default Paket (Round 1 #4) — devam, hatta kötüleşmiş

| Lead | Review count | Beklenen ideal | Önerilen | Tester değerlendirmesi |
|---|---|---|---|---|
| One Shot Coffee | 500 (no website) | Base / Starter | **Premium** | "Starter bir paketle ilerlenmesi daha doğru olacaktır" |
| Glass Coffee | 662 | Premium | **Premium** | "Premium paket tercih edilebilir" ✅ |
| Il botanico | 335 | Base | **Premium** | "premium bu işletme için oldukça fazla" |
| Coffee Couch | 337 | Base | **Premium** | "Premium paket bu işletme için oldukça gereksiz (Yanlış ve verimsiz paket önerisi)" |
| S.O.S Coffee | **14** | Base | **Premium** | "premium paket bu işletme için oldukça yüksek. Paket optimizasyonu şart" |
| Fable and Falcon | 34 | Base | **Premium** | "böylesine düşük puanlı, websitesi dahi olmayan bir yer için Premium çok fazla. Basic önerilmeli" |
| Blank Street | 535 (chain) | **Enterprise** ✅ | Enterprise | tester atladı; doğru |
| YBA Brazil | 81 | Base | **Premium** | "premium çok fazla" |
| The Drip | 170 | Premium veya Base | **Premium** | tester yorum yapmadı |
| Camden Roastery | 799 | Premium | **Premium** | "Premium paket mutlaka tercih edilmeli" ✅ |
| LUMI Camden | 2505 | Premium | **Premium** | "Premium çok doğru" ✅ |
| Black Sheep | 513 (chain) | **Enterprise** ✅ | Enterprise | "Enterprise paket çok doğru" ✅ |

**Verdict:** 4/12 paket önerisi tester onayladı; 6/12 lead'de "Premium çok fazla" şikayeti; 2/12 chain doğru Enterprise'a düştü.

**Round 1'den fark:** Chain detection için Enterprise atama Round 1'den sonra eklendi ✅ (sales-opportunity-scorer.ts:267-307). Ama küçük cafe / no-website lead'ler için Base / Starter düşürme eklenmedi ❌. Round 1 P0.5 (deterministic package selector with revenue floor) yapılmadı.

### 4.4 · Tek-Yorum Genelleme (Round 1 #2 + #3 birleşimi) — devam

**S.O.S Coffee (14 review):**
- Sentiment: positive 92.8%, negative 7.1% (yani ~1 negatif yorum)
- Yine de iki adet 100% weakness KPI: "Poor food/drink quality 100%" + "Expensive 100%"
- 14 review → ~1 negatif → "100% şikayet" → Round 1 #2 small-sample patlaması.

**Coffee Couch (50 review):**
- Sentiment: positive 98%, negative 2% (yani 1 yorum negatif)
- Weakness KPI: "Bad coffee quality 100%" — tek bir negatif review'dan global KPI.

**Camden Coffee Roastery (50 review):**
- 3 weakness KPI aynı anda 100%: "Rude Staff", "Food Quality", "Overpriced" — her biri count=2.
- 2 negatif yorum → 3 farklı kategoride %100 → Gemini "her negative example bir cluster" yapıyor.

**Çözüm:** Round 1'in P0.4 fix'ini uygula. Hâlâ açık.

### 4.5 · Sub-Niche Yanlış Atama (Round 1 #5) — yeni varyant

**Black Sheep Coffee:**
- Google Places `primary_type = "food_store"` (yanlış; doğrusu `coffee_shop` olmalı)
- Sub-niche classifier `fnb-cafe-bakery` confidence 0.65 ile atadı (doğru)
- UI `primary_type` raw göstereyor (§ 3.3) — kullanıcı "food_store" ham gösterimini görüyor

**Round 1'den fark:** Round 1'de Pied a Terre'de Michelin sub-niche miss vardı (`french_restaurant` primary_type tanınmıyordu). Round 2'de zincir kafenin Google'ın yanlış primary_type'ı sızıyor. Sub-niche classifier doğru kararı veriyor ama UI primary_type'ı override etmiyor.

**Çözüm:** § 3.3 P0 fix + Round 1 P1.2 (`niches/index.ts: classifierHints.googlePlacesTypes`).

### 4.6 · Yeni Varyant — Audit Hiç Çalıştırılmamış (S.O.S Coffee, The Drip, Il botanico)

**Kanıt:**

| Lead | website_url | crawl_status | website_audits row | İlk fail |
|---|---|---|---|---|
| S.O.S Coffee | `https://soscoffee.com/` | NO_WEBSITE | **YOK** | – |
| The Drip | `https://www.thedrip.net/` | NO_WEBSITE | **YOK** | – |
| Il botanico | `null` | NO_WEBSITE | **YOK** | – (URL yok zaten) |

S.O.S Coffee ve The Drip'in `website_url` set ama audit hiç oluşturulmamış. `crawl_status="NO_WEBSITE"` `WEBSITE_AUDITOR` worker'ının `lead.websiteUrl` boş geldiğinde (bkz. [src/lib/agent-workers/website-auditor.ts:27-36](../../src/lib/agent-workers/website-auditor.ts#L27-L36)) verdiği status. Bir noktada websiteUrl null'du, sonra Apify enrichment URL ekledi, ama audit re-trigger yapılmadı (Round 1 P1.5 fix'i hâlâ açık).

**Round 1 §1.5 fix önerisiydi:** *"Apify enrichment sonrası websiteUrl değişirse WEBSITE_AUDITOR tekrar çalıştır"*. Yapılmamış.

**Tester etkisi:** S.O.S Coffee ve The Drip için Conversion Features ve Tech Signals bölümleri hiç gösterilmiyor (audit yok); reps "neden boş?" diye düşünüyor.

**Çözüm:** Round 1 P1.5 fix'ini uygula — `maybeEnqueueWebsiteReAudit` hook'una "websiteUrl was null and is now non-null" durumunu ekle.

---

## 5 · İşletme-Bazlı Cross-Reference Tablosu

Tester'ın 12 lead için raporladığı her şikayet, DB satırı + kod kanıtıyla işaretlendi. Verdict: ✅ doğrulandı / ⚠️ kısmen / ❌ tester yanılmış / 🆕 tester'ın yakaladığı yeni bir bug.

| # | İşletme | Tester'ın ana şikayeti | DB / Kod doğrulama | Verdict |
|---|---|---|---|---|
| 25 | One Shot Coffee | "Premium yerine Starter paket; Tier ↔ Package çakışıyor; No Contact duplication; Website analizi 0 puan (Facebook girildi); Product Fit boş; Loyalty sistemi var ama opener görmemiş" | DB: package=Premium ✅, suggested_offer=STARTER ✅ (mismatch); reasonCodes "no_contact_form" + audit hasContactForm=false → duplication ✅; audit crawl_error="SOCIAL_MEDIA_ONLY" (Facebook gate çalıştı) ✅ — ama sayfa yine de pitch yapıyor; Product Fit boş çünkü features=null tüm modüller "Run a website audit to detect status" dedi ✅; loyalty hint kodu yok — opener loyalty mention etmiyor (likely_pain_points'te "Sadakat programının olmaması" listeli) | ✅ **Tüm 5 ana şikayet sistem-seviyesi**: § 3.1, § 3.2, § 4.3, Round 1 #1 partial, niche-product-fit-card.tsx feature-null path |
| 24 | Glass Coffee | "Tier Starter ama Package Premium çakışıyor; No WhatsApp duplication; Restaurant Tech Signals QR menü bulunduğunu iddia etmiş ama sitede yok; Product Fit'te sadece In-App Promotions sarı, gerisi boş" | DB: suggested_offer=STARTER + package=Premium ✅; reasonCodes "no_whatsapp" duplikasyonu ✅; rawFeaturesJson.hasQrMenu=true + detectedMenuTool="E-Menu" ❌ (sitede QR yok — `e-menu` substring false-pos); Product Fit `In-App Promotions` matches `/promotion/` regex, hasContactForm=true → "weak" yellow chip; diğer 4 modül hiç `qr menu`, `loyalty`, `recommendation` regex'lerine matchlemediği için "opportunity" gray ✅ | ✅ Tüm şikayetler doğru: § 3.1, § 3.2, § 3.4 (e-menu false-pos), niche-product-fit-card classifyModule fragility |
| 23 | Il botanico | "Likely pain points'te İtalyanca yorum mention'u; Premium paket çok fazla, Tier-Package çakışması; At a glance bölümü çakışmamış (tebrik); Personalized Message başarılı" | DB: pain_points'te `"'Sin sabor a nada y caros!' ve 'un cappuccio che faceva schifo'"` (İspanyolca + İtalyanca) ✅; package=Premium + offer=STARTER ✅; review_analyses weakness_kpis examples Italian/Spanish phrases ile dolu ✅; opener'da businessName + niche pitch standart, "delicious the pastries were" + "Il migliore caffè di Londra" (İtalyanca!) cite ediliyor — opener bile İtalyanca review alıntılamış | ✅ § 3.1, § 3.10, § 4.3 + opener İtalyanca review alıntısı ek olarak yakalandı |
| 22 | Coffee Couch | "Instagram girilince çuvallıyor (booking + ecommerce true); Premium yanlış paket; No WhatsApp + No contact form duplication; Opener devrik; Identity & SEO Instagram tanıtımı veriyor; Conversion vs Tech Signals çakışıyor" | DB: audit url=Instagram, has_booking=true ❌, has_ecommerce=true ❌ (stale audit, § 3.5); meta_description Instagram default ❌ ✅ (§ 3.9); package=Premium + offer=STARTER ✅; opener Türkçesi devrik ✅ (yapay sentaks); rawFeaturesJson.hasOnlineReservation=false ama audit.has_booking=true → çakışma ✅ | ✅ § 3.5 (stale audit), § 3.1, § 3.2, § 3.8, § 3.9, § 3.4 |
| 21 | S.O.S Coffee | "Pain Points'te halüsinasyon (böyle yorumlar geçmiyor); Premium paket çok yüksek, paket optimizasyonu şart; Yorumlarda fiyat tek kelime '£7.10' kontekst yok; Tier Starter ama Package Premium çakışması" | DB: 14 review → "Expensive 100% example=£7.10" ✅ (small-sample); package=Premium + offer=STARTER ✅; pain_points'te `"Bazı ürünlerde '£7.10' gibi yüksek fiyat algısı"` ✅ (yüklendi); audit row YOK (§ 4.6 — site has URL ama crawl_status=NO_WEBSITE, audit hiç enqueue edilmemiş gibi) | ✅ § 3.1, § 4.2, § 4.3, § 4.4, § 4.6 (audit missing) |
| 20 | Fable and Falcon | "Coffee Shop ibaresi coffee_shop olarak yazılmış; Premium paket düşük puanlı + websitesi olmayan yer için fazla; Personalized message expired site için 'sitenizi inceledik' yanlış; No Whatsapp duplication" | DB: primary_type="coffee_shop" raw ✅; package=Premium + offer=STARTER ✅; audit.title="Squarespace - Website Expired", http_status=404, crawl_error="UNKNOWN" — crawl başarısız ama audit row oluşmuş (Round 2'nin yeni varyantı: `expired site` durumu için ayrı `crawl_error` yok); opener "sitenizi hızla incelediğimde" ✅ ihlali; reasonCodes duplikasyonu ✅ | ✅ § 3.3, § 3.8, § 4.3, § 3.2 + yeni: `crawl_error="UNKNOWN"` expired-site için yetersiz; "WEBSITE_EXPIRED" ayrı status olmalı |
| 19 | Blank Street Coffee Camden | tester atladı (yanlış ID) ama DB'de var | Chain detected ✅ → package=Enterprise ✅ (Round 1 düzeltmesi başarılı); ancak pain_points'te "no order-ahead, no QR-to-order" listelenmiş — chain app'te zaten var (§ 3.7); opener "QR'dan sipariş akışı" pitch ediyor — chain app'te var ✅ ihlal | ✅ § 3.7, § 3.8 — bu lead'i tester atladı ama biz yakaladık. Round 1 fix'in **kısmen** başarılı + uzantı bug'ı |
| 18 | YBA Brazil | "Instagram girilince çuvallamış (Booking + E-commerce true); At a glance duplication; Premium çok fazla; Coffee Shop yine coffee_shop; Halüsinasyon yorum (automatic tip)" | DB: audit url=Instagram, has_booking=true ❌, has_ecommerce=true ❌ (stale, 2026-05-01); reasonCodes duplikasyonu ✅; primary_type="acai_shop" raw (Coffee Shop değil ama yine raw snake_case → § 3.3); package=Premium + offer=STARTER ✅; weakness_kpis "Automatic tip request 50% example=automatic tip request" ✅ label echo halüsinasyonu | ✅ § 3.5 (stale audit, en kritik vaka), § 3.2, § 3.3 (acai_shop varyantı), § 3.1, § 4.2 (en bariz hallucination) |
| 16 | The Drip | "At a Glance: No website + Weak website duplication ve hata; Tier Starter ama Package Premium çakışması; Review Intelligence 'Rude staff toilet access' label'ı yanlış alıntılı; Coffee Shop yine coffee_shop" | DB: crawl_status=NO_WEBSITE ✅, reasonCodes ["no_website", "high_rating_weak_site"] iki kez ✅ (§ 3.2 'No website + Weak website' duplikasyonu); package=Premium + offer=STARTER ✅; weakness_kpis `"Rude Staff & Toilet Access" 33% examples=["abrupt, grumpy gentleman","toilet is really for staff not customers"]` — iki ayrı şikayet tek cluster'da ✅ (Round 1 #3); primary_type="coffee_shop" raw ✅; audit row YOK (§ 4.6) | ✅ § 3.2 (en kritik kanıt), § 3.1, § 4.2, § 3.3, § 4.6 |
| 15 | Camden Coffee Roastery | "İki adet no whatsapp duplication; Coffee Shop yine coffee_shop; Yorumlar bölümünde İngilizce harici tek bir yorum Glance olarak gözüküyor; QR menü var demiş ama yok" | DB: reasonCodes "no_whatsapp" duplikasyonu ✅; primary_type=coffee_shop raw ✅; review_analyses weakness_kpis examples include Hollandaca ("pannenkoeken tegen van smaak") ve Fransızca strength ("L'ambiance est chaleureuse…") ✅; rawFeaturesJson.hasQrMenu=true + detectedMenuTool="E-Menu" ❌ (`e-menu` substring false-pos, e-commerce sayfasında bag-coffee var) ✅ | ✅ § 3.2, § 3.3, § 3.10, § 3.4 (e-menu false-pos en bariz örnek) |
| 14 | LUMI Camden | "Conversion Features'ta sitede communication form var ama AI görmemiş; Restaurant Tech Signals booking feature var demiş (yanlış); ikisi çakışıyor; Booking key word'ünden tetiklenmiş olabilir; Premium paket doğru; Açılış cümlesi güzel" | DB: audit.has_contact_form=false ❌ (sitede form var, "questions as different label" yanlış-negatif); audit.has_booking_system=false ✅ ama rawFeaturesJson.hasOnlineReservation=true ❌ (substring "no bookings, walk-in welcome" tetiklemiş — Round 1 yamasının Path B'ye uygulanmaması § 3.4); package=Premium + offer=STARTER ✅ | ✅ § 3.4 (en kritik kanıt: aynı kavram, iki path, çelişkili sonuç), § 3.1, contact form detection bug (Round 1 #1'in başka varyantı) |
| 13 | Black Sheep Coffee | "Likely pain points'te QR / order ahead eksikliği listelenmiş ama chain app'te zaten var; food_store olarak analiz edilmiş + yanlış font; Personalized message kurumsal firmaya yaklaşmak için yanlış (çoktan çözülmüş sorunlar); Enterprise paket doğru" | DB: chain_detected reason_code ✅ → package=Enterprise ✅ (Round 1 partial fix); pain_points'te "QR'dan sipariş ve ödeme akışının olmaması", "Online rezervasyon eksikliği" ✅ chain blindness; primary_type="food_store" raw ✅ § 3.3; opener "Black Sheep Coffee'de QR'dan sipariş/ödeme akışının eksik olduğunu fark ettik" ✅ chain blindness opener'a sızıyor; rawFeaturesJson.hasQrMenu=true ❌ (`e-menu` substring false-pos); audit.title=`"Camden\n – Black Sheep Coffee"` (newline char title'da) | ✅ § 3.7, § 3.8, § 3.3, § 3.4 + ek: title newline rendering bug |

**Özet:**
- 12/12 lead'in en az **2** Round 2 yeni bug'ı tetiklediği doğrulandı.
- En sık tetiklenen yeni bug: **§ 3.1 Tier-Package mismatch** (12/12 lead).
- En sık tetiklenen yeni bug #2: **§ 3.2 Glance/Wedge duplication** (10/12 lead).
- Tester'ın atladığı 1 lead'de (Blank Street) chain blindness (§ 3.7) bug'ını ek olarak DB'den keşfettik.
- En kritik yeni bulgu: **§ 3.4 Conversion ↔ Tech Signals** kavramsal çakışması — Round 1 yamasının yarı uygulaması.
- **Round 1 #7 (embedding + 403)**'in hâlâ aktif olması Round 2 raporlarına en büyük altyapı tehdidi.

---

## 6 · Çözüm Yol Haritası

### P0 — 7 gün içinde (acil prod fix)

| # | Aksiyon | Etkilenen sorunlar | Effort |
|---|---|---|---|
| P0.1 | UI'da Tier badge'ini kaldır VEYA package'tan derive et (`page.tsx:958-967`) | § 3.1 | 2 saat |
| P0.2 | `HeroPriorityStrip`'te wedges + reasonCodes dedupe katmanı | § 3.2 | 3 saat |
| P0.3 | `humanizePrimaryType` util + UI'a uygula (`page.tsx:1052,1598`) | § 3.3 | 2 saat |
| P0.4 | `extractor.ts`'te `hasOnlineReservation` ve `hasQrMenu` aynı multi-signal kapısından geçirilsin; `"e-menu"` pattern'i kaldır VEYA URL gate ekle | § 3.4 | 6 saat |
| P0.5 | Tüm aktif workspace'lerde stale social-URL audit'leri için backfill script'i çalıştır | § 3.5, § 4.1 (Coffee Couch + YBA Brazil) | 4 saat |
| P0.6 | Quota error message — `QuotaCheckResult.blockReason` field'ı + `assertWorkerQuota` doğru error fırlatsın | § 3.6 | 4 saat |
| P0.7 | Round 1 #7 fix — embedding decoupling (`SUCCEEDED_NO_MEMORY` status) + Gemini API key rotation | Round 1 #7, hâlâ aktif | 12 saat |
| P0.8 | Round 1 P0.4 — review-analyst min-example=2 filter + `count` schema | Round 1 #2/#3, § 4.2, § 4.4 | 6 saat |
| P0.9 | Round 1 P0.5 — deterministic package selector (review_count, has_website, chain → mapping) | Round 1 #4, § 4.3 | 8 saat |
| P0.10 | `WEBSITE_AUDITOR` re-enqueue: lead.websiteUrl null → non-null geçişinde tetiklensin | Round 1 P1.5, § 4.6 (S.O.S, The Drip) | 4 saat |

### P1 — 14 gün içinde (kalite ve doğruluk)

| # | Aksiyon | Etkilenen sorunlar | Effort |
|---|---|---|---|
| P1.1 | Opener prompt'una `websiteContext` (crawlStatus, audit.title, httpStatus, crawlError) inject et + koşullu açılış kuralları | § 3.8 | 8 saat |
| P1.2 | `crawl_error="WEBSITE_EXPIRED"` ayrı status: title regex `/expired/i` veya http 404 + Squarespace pattern → `WEBSITE_EXPIRED` set et | § 3.8 (Fable and Falcon) | 4 saat |
| P1.3 | Chain-aware Gemini scorer prompt branching — `chain_detected` set ise pain_points'te "no order-ahead, no QR" muhtemel false → suppress | § 3.7 | 8 saat |
| P1.4 | `niches/index.ts:fnb-cafe-bakery`'e `notApplicableModulesForChain` field'ı ekle; opener prompt'ta enforce | § 3.7, § 3.8 | 4 saat |
| P1.5 | Review-analyst pre-LLM language filter (tinyld vs benzeri) + workspace `targetReviewLanguages: string[]` | § 3.10 | 8 saat |
| P1.6 | UI'da Identity & SEO bölümü social-only flag'i konuşur (`isSocialPlatformDefaultMeta` regex fallback) | § 3.9 | 3 saat |
| P1.7 | Round 1 P1.2 — `niches/index.ts:classifierHints.googlePlacesTypes`'a `"food_store"` Black Sheep gibi zincir kafe için override ekle | § 4.5 | 3 saat |
| P1.8 | `audit.title` newline / whitespace cleaning (Black Sheep `"Camden\n – Black Sheep Coffee"` → `"Camden – Black Sheep Coffee"`) | § 5 ek | 2 saat |
| P1.9 | `auditor_version` kolonu + version bump'ta auto re-trigger | § 3.5 sürdürülebilir çözüm | 6 saat |
| P1.10 | Lead detail page Product Fit'te audit=null durumunda "No website detected — pitch all modules as opportunities" daha iyi mesaj | § 3 vakaları (One Shot Coffee) | 3 saat |

### P2 — 30 gün içinde (uzun vadeli iyileştirme)

| # | Aksiyon | Etkilenen sorunlar | Effort |
|---|---|---|---|
| P2.1 | `CHAIN_ROOT_AUDITOR` worker — chain_detected lead için root domain crawl'ı, app store url + loyalty page tespiti | § 3.7 | 16 saat |
| P2.2 | Round 1 P2.5 — Beta tester feedback API loop'u | Tüm sürekli iyileştirme | 24 saat |
| P2.3 | Tester'ın "düzeltilmiş opener"larını OPENER_SUCCESS memory'sine seed et — Blank Street Coffee opener (tester 10/10), Black Sheep'in tester düzeltmesi | Round 1'den uzantı | 8 saat |
| P2.4 | Multi-source scoring confusion (lead_score vs opportunity_score vs sales_confidence) tek score migration | Round 1 #8 | 12 saat |
| P2.5 | `suggestedOffer` field'ını schema migration ile kaldır; sadece `recommendedPackageId` kalsın | § 3.1 | 8 saat |
| P2.6 | Cron job: 30+ gün stale audit refresh | § 3.5 sürdürülebilir | 6 saat |

---

## 7 · Doğru Çalışan Parçalar (Sistemi tamamen değiştirme tuzağı)

Tester Round 2'de **sürekli olumlu gözlemler** de kaydetti. Bunlar Round 1 fix'lerinin başarılı olduğu yerler veya zaten doğru çalışan sistemler. Bunları korumak P0/P1/P2 yol haritasının dışında bırakmak için listeliyorum.

### 7.1 Mükemmel çalışan parçalar

1. **Round 1 #1 (Instagram-as-Website) — Facebook URL gate'i** — One Shot Coffee'nin Facebook URL'i 2026-05-05 audit'inde `crawl_error="SOCIAL_MEDIA_ONLY"` ile durduruldu. Round 1 fix'i kod tarafında %100 başarılı; sadece eski audit satırlarının re-trigger'ı eksik (§ 3.5).

2. **Chain detection → Enterprise paket atama** — Round 1'den sonra eklenen logic Black Sheep ve Blank Street Coffee için doğru kararı verdi (`chain_detected` reason_code → `Enterprise` paket). Tester *"Kullanılan Enterprise paketi çok doğru böylesine büyük bir işletme için kaçınılmaz"* dedi.

3. **Apify Gmaps Deep enrichment** — 12 lead'in 9'unda 50 review başarıyla çekildi. S.O.S Coffee 14 review (gerçek count 14, sentiment doğru), Fable and Falcon 34 review.

4. **Sub-niche classifier confidence** — Cafe lead'lerinin %80'i `fnb-cafe-bakery` 0.6-1.0 confidence aldı. Doğru kararlar.

5. **Sentiment breakdown yön doğruluğu** — Tester *"sentiment analizleri çok doğru"* gözlemini birden fazla lead'de tekrar etti. Pozitif / negatif yüzdeleri makul (örn. Coffee Couch 98% positive, gerçeğe yakın).

### 7.2 Tester'ın çok övdüğü vakalar

| Lead | Tester yorumu | Kanıt |
|---|---|---|
| Blank Street Coffee | *"AI Opener 10/10. Lütfen Mert bey buradaki örnek yazıyı Enterprise Promptları eğitimi için kullanınız. Kullanılan Enterprise paketi çok doğru"* | Opener'ın chain blindness sızması var ama tonu profesyonel. Tester chain bug'ını fark etmemiş ama opener yapısını övüyor. |
| Black Sheep Coffee | *"Önerilen paketin kurumsal bir şirket için enterprise olarak verilmesi doğru ve güzel"* | Chain detection + Enterprise eşleşmesi doğru. |
| LUMI Camden | *"Açılış cümlesi oldukça güzel ve değiştirilmeden dahi yayınlanabilir. AI dossier da verimli çalışmış"*, *"Önerilen paketin premium olarak seçilmesi oldukça doğru"* | LUMI'nin opener'ı "menüleriniz çok eski" review'una directly bağlanıyor — pain → pitch geçişi doğru. |
| Coffee & Beyond (Round 1) → Camden Coffee Roastery (Round 2) | "AI dossier çok doğru çalışmış" | Doğru pain points + doğru üst seviye işletme analizi. |
| Il botanico | *"Personalized Message büyük ölçüde başarılı"* | Sade, kişisel, satış tonu yok. |
| One Shot Coffee | *"Personalized Message oldukça başarılı ve ilerlemeye açık"* | Facebook context'i opener'a girmiş ("Facebook sayfanızı hızlıca inceledik"). |

### 7.3 Round 1 fix'lerin Round 2'de doğrulandığı yerler

- **`social-url-gate.ts`** (Round 1 P0.1 fix'i) — One Shot Facebook için çalıştı.
- **`opener-writer.ts:439-459` `notApplicableRule`** (Round 1 P1.4 fix'i) — Opener artık niche pack'in `notApplicableModules`'larından kaçınıyor; tester opener'lardaki vertical-mismatch şikayetini Round 2'de **çok daha az** raporladı (Round 1'de Pied a Terre Michelin'a "online ordering" pitch'i; Round 2'de bu sınıfa hiç düşmedik).
- **Chain detection → Enterprise mapping** (Round 1 P0.5 partial) — Black Sheep + Blank Street'te doğru.

---

## 8 · Stratejik Tavsiyeler

### 8.1 Round 1'de önerildi, Round 2'de hâlâ açık

1. **Tester feedback API loop'u** (Round 1 P2.5) — Tester'ın aynı 12 lead'i 3 gün arayla iki kez incelemesi sayesinde "Round 1 fix'i yapıldı mı?" sorusu netleşti. Bu lateral data çok değerli; programatik hale getirmek lazım. Lead detail page'de "Bug bildir / Pitch'i düzelt" butonu, lead-intelligence-brief'in bir sonraki çalışmasına input olarak girer.

2. **Tester'ın "düzeltilmiş opener"ları OPENER_SUCCESS memory'sine seed** — Round 2 raporunda tester en az 2 lead için "doğru opener şöyle olmalıydı" örnek yazılar verdi:

   - **Fable and Falcon (tester yazımı):** *"Merhaba Fable and Falcon ekibi, işletmenizi incelediğimizde dijital kaynak entegrasyonunun satışlarınızı %80'e varan şekilde arttıracağını tespit ettik, modern bir QR ile sipariş akışının eksik olduğunu fark ettim ve size özel bir taslak hazırladım. FineDine olarak, hem bu dijital boşluğu doldurarak müşteri geri bildirimlerini çözerek operasyonel verimliliğinizi artırabiliriz."*
   - **YBA Brazil (tester yazımı):** *"Merhaba Yba Brazil ekibi, (Instagram profilinizi) incelerken, müthiş açaí kaseleri ve kahvelerinizle 4.9 yıldızlık harika yorumlar aldığınızı gördüm! Ancak müşterilerinizin masadan kolayca sipariş verebileceği bir QR menü akışının eksik olduğunu fark ettim; size özel bir demo hazırladık."*
   - **Black Sheep (tester yazımı):** *"Merhaba, FineDine olarak sitenizi hızlıca inceledik ve Black Sheep Coffee'de. Misafirlerinizin '20 dakika kahve bekleme' gibi sorunlarını çözmek ve ek satışları %18 artırmak için size özel bir çözüm hazırladık."*

   Bunlar `SemanticMemory.OPENER_SUCCESS` kindine workspace=FineDine + niche=`fnb-cafe-bakery` etiketiyle yazılmalı; OPENER_WRITER'ın few-shot retrieval'ı bunları örnek olarak kullansın.

3. **Çakışan badge dedupe pattern'i tüm UI'da** — § 3.2'nin fix'i sadece HeroPriorityStrip için değil; benzer pattern Conversion Features (§ 3.4), Identity & SEO sıkışmış field'ları, Likely Pain Points + Reason Codes karşılaştırmasında da geçerli. Genel UI util: `dedupedSignalChips({ paths: [...] })`.

### 8.2 Round 2'de yeni öneriler

4. **Stale audit detection telemetri** — `auditor_version` field'ı eklendiğinde admin dashboard'da "X% audit'leri version Y" göstergesi; backfill ilerlemesi takip edilebilir. Lead detail sayfasının altına "Audit'iniz X gün önce çekildi — `[Re-run]`" CTA'sı eklenmeli.

5. **Quota error UX overhaul** — § 3.6'nın çözümü `blockReason` ekleme, ama UI'da bu bilgi rep'in göreceği şekilde göstermeli. Toast mesajı: `"Bu lead için günlük limitiniz doldu (50 koşum / 24 saat)"` ve `"Worker quota: PRO planında ayda 500/500"`. Yanıltıcı `"44/50000 exceeded"` mesajı bir daha asla.

6. **Chain-aware niche pack** — § 3.7 gerçekten önemli çünkü FineDine'ın gerçek satış fırsatı zincir kafelerde Enterprise multi-property analytics + group-level CRM. Pitch'i şube-seviyesi pain'lerinden ayırıp chain-seviyesine çıkarmak FineDine'ın ARR'ını ciddi etkileyecek.

7. **`crawl_error` taxonomy genişletme** — Şu an: `null`, `SOCIAL_MEDIA_ONLY`, `UNKNOWN`. Eklenmesi gerekenler: `WEBSITE_EXPIRED` (404 + "expired" pattern), `WEBSITE_PARKED` (Squarespace/GoDaddy default), `BLOCKED_BY_GUARD` (rate limit / Cloudflare), `SSL_INVALID`. Her biri için spesifik UI mesajı + opener context.

8. **Round 1 ile Round 2 testleri arasında dataset version pinning** — Tester'ın 3 gün sonraki ikinci geçişinde "fix yapıldı mı?" sorusu zor cevaplandı çünkü hangi fix hangi audit timestamp'ına denk geliyor takip edilemedi. Workspace'e `aiCorePipelineVersion` field'ı + `agent_runs.pipelineVersion` kolonu — beta turlarında "v3.0 pipeline ile çekilen audit'ler" filter'ı eklenebilir.

### 8.3 Tester'ın gözlemine **karşı çıktığımız** durumlar

Tester hep haklı değil; bilim için karşı çıktığımız 2 nokta:

- **Glass Coffee — package=Premium şikayeti:** Tester *"Premium paket tercih edilebilir"* dedi ama "tier Starter çakışması" diye attı. DB'den 662 review + 4.9 rating + e-commerce var → Premium tam doğru. Tier mismatch sorunu ayrı.
- **One Shot Coffee — opportunity_score=100:** Tester atladı ama bu skor anomalisi kritik. No-website, social-media-only bir lead için 100/100 fırsat skoru kalibrasyon hatası. Round 1 #8'in canlı bir vakası.

---

## Ek A — SQL Doğrulama Sorguları

### A.1 Workspace tespit
```sql
SELECT u.id, u.email, m.workspace_id, m.role,
       w.name, w.niche, w.language, w.offer_name,
       w.value_proposition, w.target_sub_niches, w.tone
FROM users u
LEFT JOIN workspace_members m ON m.user_id = u.id
LEFT JOIN workspaces w ON w.id = m.workspace_id
WHERE u.email = 'finedine-owner@leadac.beta';
```

Sonuç: 2 workspace bulundu (`5496e39e-cc76-41bd-b18b-f1128fb9e41b` = FineDine Beta, `cmok7vnr20001l604wz1rv4rp` = web). Round 2 kapsamında sadece FineDine Beta kullanıldı.

### A.2 12 lead snapshot
```sql
SELECT id, business_name, website_url, primary_type,
       sub_niche_slug, sub_niche_source, sub_niche_confidence,
       rating, review_count, crawl_status, analyze_status,
       has_website, borough, sales_confidence
FROM leads
WHERE id IN (
  'cmoozvrl2000rkz044funhtgf','cmoozvq850003kz04ck13mzhb',
  'cmoozvsyu001fkz04ieppflvm','cmon6tr1s000rjv04x4pa7ump',
  'cmon6tshs001fjv04djylm2ts','cmoozvtn7001rkz042wr6yiab',
  'cmoozvs9l0013kz04jzlky5zi','cmon6tqtp000njv04bf2gg5hs',
  'cmon6trzv0017jv04j17d9dj1','cmoozvpz00001kz04a6jirdd5',
  'cmoozvr4t000jkz043baocw6m','cmoozvrcx000nkz042jba1czr'
)
ORDER BY business_name;
```

### A.3 Audit anomalileri
```sql
SELECT lead_id, url, reachable, http_status, https,
       has_booking_system, has_ecommerce, has_contact_form,
       has_whatsapp_link, structured_data_present,
       services_detected, meta_description, title, h1,
       crawl_error
FROM website_audits
WHERE lead_id IN (...12 ID...);
```

### A.4 Tier-Package mismatch tespit
```sql
SELECT so.lead_id, l.business_name, so.suggested_offer,
       so.recommended_package_id, sp.name AS package_name, sp.price_label
FROM sales_opportunities so
LEFT JOIN leads l ON l.id = so.lead_id
LEFT JOIN service_packages sp ON sp.id = so.recommended_package_id
WHERE so.lead_id IN (...12 ID...) ORDER BY l.business_name;
```

Sonuç: 12/12 satırda `suggested_offer = STARTER`, ama `package_name` Premium / Enterprise dağılımı.

### A.5 Tech Signals çakışması
```sql
SELECT lead_id, has_booking_system,
       raw_features_json->>'hasQrMenu' AS has_qr_menu,
       raw_features_json->>'hasOnlineReservation' AS has_online_reservation,
       raw_features_json->>'hasDeliveryIntegration' AS has_delivery,
       raw_features_json->>'detectedMenuTool' AS menu_tool
FROM website_audits
WHERE lead_id IN (...7 lead...);
```

### A.6 Embedding crash + 403 (Round 1 #7 hâlâ canlı)
```sql
SELECT lead_id, worker_kind, status, error_msg, finished_at
FROM agent_runs
WHERE lead_id IN (...12 ID...)
  AND (status = 'FAILED' OR error_msg IS NOT NULL)
ORDER BY finished_at DESC LIMIT 50;
```

Çıktıda `Failed to embed after 3 attempts` 17 satır + `[403 Forbidden] Your project has been denied access` 2 satır + `Quota exceeded for SALES_OPPORTUNITY_SCORER: 44/50000` 15 satır.

### A.7 Stale audit timestamp doğrulama
```sql
SELECT lead_id, url, crawl_attempted_at, created_at, crawl_error
FROM website_audits
WHERE lead_id IN ('cmoozvrl2000rkz044funhtgf',  -- One Shot (Facebook)
                  'cmon6tr1s000rjv04x4pa7ump',  -- Coffee Couch (Instagram)
                  'cmon6tqtp000njv04bf2gg5hs')  -- YBA Brazil (Instagram)
ORDER BY crawl_attempted_at DESC;
```

Sonuç: One Shot 2026-05-05 (Round 1 fix sonrası, doğru), Coffee Couch + YBA 2026-05-01 (fix öncesi, stale).

---

## Ek B — Referans Verilen Kod Dosyaları

Round 2 raporunda bahsi geçen veya kod düzeyinde incelenen 16 dosya:

1. [src/app/app/leads/[id]/page.tsx](../../src/app/app/leads/[id]/page.tsx) — Lead detail UI, HeroPriorityStrip (`At a Glance`), Tier-Package badge'leri.
2. [src/lib/labels.ts](../../src/lib/labels.ts) — `REASON_LABELS`, `OFFER_LABELS`. Humanize util eklenecek yer.
3. [src/components/app/website-intelligence-panel.tsx](../../src/components/app/website-intelligence-panel.tsx) — `ConversionSection` ve `RestaurantSignalsSection` ayrı renderları, `NicheProductFitSection`.
4. [src/components/app/niche-product-fit-card.tsx](../../src/components/app/niche-product-fit-card.tsx) — `classifyModule` regex pattern matching; null-features path.
5. [src/lib/extractor.ts](../../src/lib/extractor.ts) — `BOOKING_KEYWORDS`, `RESERVATION_PATTERNS`, `QR_MENU_PATTERNS`, `hasBookingSystem` multi-signal logic, `hasOnlineReservation` substring match.
6. [src/lib/audit/social-url-gate.ts](../../src/lib/audit/social-url-gate.ts) — Round 1 P0.1 fix'i (Facebook/Instagram domain detection).
7. [src/lib/crawler.ts](../../src/lib/crawler.ts) — `crawlWebsite` ana entry; line 90'da social-url-gate çağırıyor.
8. [src/lib/agent-workers/website-auditor.ts](../../src/lib/agent-workers/website-auditor.ts) — `SOCIAL_MEDIA_ONLY` durumunda `metaDescription: null` set, `lastAuditedWebsiteUrl` stamp'i.
9. [src/lib/agent-workers/sales-opportunity-scorer.ts](../../src/lib/agent-workers/sales-opportunity-scorer.ts) — `hasMultipleLocations` chain detect, `package-selector` çağrısı.
10. [src/lib/agent-workers/package-selector.ts](../../src/lib/agent-workers/package-selector.ts) — Paket seçim algoritması (Round 1 P0.5 hâlâ kapsamda).
11. [src/lib/agent-workers/opener-writer.ts](../../src/lib/agent-workers/opener-writer.ts) — `buildOpenerPrompt` parametreleri (crawlStatus eksik), `notApplicableRule` ve `painWhitelistRule`.
12. [src/lib/agent-workers/review-analyst.ts](../../src/lib/agent-workers/review-analyst.ts) — Review KPI clustering, `isGroundedInCorpus`.
13. [src/lib/prompts/review-analysis-prompt.ts](../../src/lib/prompts/review-analysis-prompt.ts) — Review analysis Gemini prompt'u (English-only filter eklenecek).
14. [src/lib/agent-workers/quota.ts](../../src/lib/agent-workers/quota.ts) — `assertWorkerQuota`, `PER_LEAD_DAILY_CAP=50`, `QuotaExceededError` mesajı.
15. [src/lib/niches/index.ts](../../src/lib/niches/index.ts) — `fnb-cafe-bakery` pack (`featuredProductModules`, `pitchAngle`, `highValueSignals`), classifierHints.
16. [src/lib/gemini.ts](../../src/lib/gemini.ts) — Sales-opportunity-scorer prompt template ve `chain_detected` reason_code tanımı.

---

**Rapor sonu** — Bu rapor `research/finedine/beta-test-round-2-camden-report.md` olarak workspace'e yazıldı. Mevcut Round 1 raporu ([beta-test-analysis-report.md](beta-test-analysis-report.md)) bağımsız korunmaktadır. Kod fix'leri **bu görev kapsamında uygulanmamıştır**; her P0 / P1 / P2 maddesi ayrı bir PR olarak işlenmelidir.
