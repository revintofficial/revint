# Lead pipeline sadeleştirme — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her lead için otomatik çalışan işi beş veri toplayıcısı ve tek brief kararına indirmek. Kalan worker'lar FineDine hesaplarındaki gerçek analiz boşluklarına göre geliştirilir.

**Architecture:** `getDefaultChain` BALANCED ve AGGRESSIVE aynı kısa zinciri üretir. Yorumlayan worker'lar (skor, dossier, why-now, tetikleyici, ICP) otomatik zincirden çıkar. Karar yalnızca `LEAD_INTELLIGENCE_BRIEF` içindeki head agent'tedir. Veri worker'ı başarısız olursa `optional: true` ile brief yine çalışır ve eksik kaynağı `evidence` içinde "yok" diye yazar. `preset !== "CUSTOM"` olan workspace'ler `planner.ts` içinde her seferinde `getDefaultChain` çağırır. Kayıtlı `steps` JSON'u yeniden yazmaya gerek yoktur. FineDine Beta preset'i `BALANCED` olduğu için fonksiyon değişince bir sonraki lead yeni zinciri kullanır.

**Tech Stack:** Next.js 16.2.3, Prisma 6, BullMQ `agent-runs` kuyruğu, Gemini, Claude head agent (`src/lib/ai-core/agent/head-agent.ts`), Apify, Playwright, Vitest.

## Global Constraints

- Her Prisma sorgusu workspace verisinde `workspaceId` taşır.
- Yeni BullMQ kuyruğu yok. AI işi `agent-runs` üzerinde kalır.
- Yeni Gemini çağrısı worker modülü dışında yok.
- Semantic memory yalnızca `src/lib/ai-core/memory.ts` üzerinden yazılır.
- Embed hatası veri adımını `FAILED` yapmaz. Satır embeddingsiz yazılır, yeniden embed kuyruğa gider.
- Head agent modül uyduramaz. `computeFnbModuleFit` shortlist'i dışına çıkan modül QA'da düşer.
- `typescript.ignoreBuildErrors` false kalır.
- M1 kapsamı: FineDine gerçek lead, brief, HubSpot writeback. Outcome learning (OI) bu planda yok.

---

## 1. Veritabanı bulgusu (28 Eylül 2026)

Sorgu Supabase Postgres üzerinde `workspaces`, `leads`, `website_audits`, `review_analyses`, `sales_opportunities`, `agent_runs` tablolarına bakıldı. Restoran teknolojisi nişi beş hesap.

| Hesap | Lead | Ulaşılabilen site | 20+ yorum analizi | SERP başarılı | Head-agent brief |
|---|---:|---:|---:|---:|---:|
| sekersoft | 40 | 0 | 0 | 0 | 0 |
| kkj | 39 | 10 | 5 | 0 | 0 |
| FineDine Beta | 28 | 8 | 0 | 0 | 0 |
| Tester | 24 | 20 | 3 | 0 | 0 |
| deneme | 20 | 0 | 0 | 0 | 0 |

Tüm `LEAD_INTELLIGENCE_BRIEF` başarıları: 83. `briefMode = head-agent`: 0. `legacy`: 70. Mod alanı yok: 13. Ortalama `salesConfidence`: 58.5. FineDine Beta'da brief satırı yok.

FineDine Beta'da skoru olan sekiz restoran (Dishoom Covent Garden, Flat Iron, Hawksmoor Seven Dials, Padella, Pizza Pilgrims, Honest Burgers Dalston, The Wolseley, Andrew Edmunds):

- Google yorum sayısı 381 ile 29.744 arasında. `review_analyses.reviews_analyzed_count` hepsinde 5. `google_reviews` satır sayısı hepsi 5.
- Özet metni aynen şunu söylüyor: "Places returned 5 reviews for this listing, not the full Google corpus. Treat the bars as a sample, not a measure."
- Yedisinde `lead_score` 20. Honest Burgers 52, çünkü beş yorumdan biri düşük yıldız.
- `best_sales_angle` altısında "Multi-location", ikisinde "CRM / Loyalty". Hepsi `GROWTH`.
- Hepsinin `has_booking_system = true` ve dolu bir `booking_provider` var (Dishoom reservations, Hawksmoor book-a-table, Padella direct). Rezervasyon modülünü satmak bu hesaplarda yanlış. Skor yine de büyüme paketi basıyor.
- `raw_features_json.hasQrMenu` sekizinde de `false`. `hasOnlineOrdering` hepsinde `null`. Honest Burgers ve Pizza Pilgrims'te `has_ecommerce = true` ama sipariş sinyali beyne gitmiyor.
- Sosyal scraper FineDine kahve lead'lerinde `{"count": 0, "profiles": {}}` döndü. Platform genelinde 245 başarılı sosyal koşunun 170'i boş profil.

Koşu hacmi ve kırılma (tüm workspace'ler):

| Worker | Başarılı | Düşen | Asıl hata |
|---|---:|---:|---|
| WEBSITE_AUDITOR | 225 | 277 | 231 Playwright binary yok, 44 embed |
| REVIEW_ANALYST | 378 | 88 | 79 embed, birkaçı 60s deadline |
| APIFY_GMAPS_DEEP | 57 | 66 | 15 eşzamanlı çalışma limiti (5), 24 aylık limit, 22 bellek |
| APIFY_WEB_CRAWL_DEEP | 52 | 85 | aynı Apify limitleri |
| APIFY_SERP_RANK | 12 | 80 | 77 tanesi kota `0/0` |
| EMAIL_VERIFIER | 2 | 78 | kota `0/0` |
| SOCIAL_SCRAPER | 245 | 1 | 170 boş profil |
| LEAD_DOSSIER_GENERATOR | 158 | 3 | ortalama 6513 token |
| SALES_OPPORTUNITY_SCORER | 229 | 9 | ortalama 417 token, ikinci satış açısı |
| LEAD_INTELLIGENCE_BRIEF | 83 | 5 | head agent hiç yazılmamış. 3 düşüş lead başına 50 koşu tavanı |

Son legacy brief (Morleys Lewisham, 21 Haziran 2026) yemek zehirlenmesi ve kaba personeli konuşma noktası yapıp eksik özellik olarak "iletişim formu, WhatsApp, Google Analytics, zayıf security header" yazıyor. `briefMode` `legacy`. `sdrBrain.confidence` 43. Bu, restoran yazılımı satan bir SDR'ın arayacağı cümle değil.

`agent-runs` worker concurrency 10. Apify hesabının eşzamanlı koşu tavanı 5. Zincir gmaps ve web crawl'u kökte paralel açtığı için FineDine kahve lead'leri `concurrent-runs-limit-exceeded` ile düşmüş.

## 2. Otomatik zincirden çıkanlar

Bunlar tıklanınca çalışmaya devam eder. `user_one_click_pitch`, `user_deep_research`, `user_receptionist_with_kb` zincirleri durur. Varsayılan `lead_created` onları çağırmaz.

| Worker | Neden çıktı | Kanıt |
|---|---|---|
| SALES_OPPORTUNITY_SCORER | İkinci satış açısı. Brief ile çelişiyor. | FineDine'da rezervasyonu olan restorana "Multi-location / GROWTH" |
| LEAD_DOSSIER_GENERATOR | Uzun anlatı. Brief'in işi. | 158 koşu, ortalama 6513 token, FineDine brief'i yokken dossier da yok |
| WHY_NOW_SYNTHESIZER | Karar cümlesini brief yazar | Son 30 günde 0 koşu |
| TRIGGER_DETECTOR | Aynı | Zincirde web crawl'a bağlı, crawl çoğunlukla düşüyor |
| ICP_SCORER | Uyum puanı pack shortlist'inden gelir | Ayrı satır brief'e yeni cümle eklemiyor |
| APIFY_WEB_CRAWL_DEEP | Tüketicisi dossier ve tetikleyiciydi | 85 düşüş, Apify kotasını audit ile paylaşıyor |
| GOOGLE_PLACES_REVIEWS | 5 yorumluk örnek, analizciyi zehirliyor | FineDine'da 29.744 yorumluk Dishoom 5 satırla analiz edilmiş |
| OBJECTION_PREDICTOR, BANT, ACCOUNT_TIER, BUYING_COMMITTEE, COMMERCIAL_INSIGHT | Zincirden zaten düşmüş, enum'da duruyor | 72–142 eski başarılı koşu, son 30 günde 0 |
| WEBSITE_MOCKUP, OPENER, VIDEO, resepsiyonist, review reply, booking widget | SDR tıklayınca | Mockup ortalama 2619 token. Her lead'de yanması kapatılmış, öyle kalsın |

Eski kuyruklar boot'tan iner. Dosyalar ikinci turda silinir, bu planda yalnızca supervisor import'u kapanır:

- `review-analysis` kuyruğu `REVIEW_ANALYST` ile aynı `ReviewAnalysis` satırına yazar.
- `email-verification` kuyruğu `EMAIL_VERIFIER` ile aynı `contactEmailsVerified` alanına yazar.
- `crawl-worker` ve `analyze-worker` zaten yorum satırı. Import kapalı kalsın.
- `seo-ops` lead zinciri değil. Kendi sürecinde kalır. Bu plan ona dokunmaz.

## 3. Kalacak worker'lar ve geliştirme açıları

Hedef `lead_created` sırası. Site yoksa website audit adımı kendini `skipped` yazar, SERP ve yorum devam eder.

```text
WEBSITE_AUDITOR
  ├─ SUBVERTICAL_CLASSIFIER
  ├─ APIFY_SERP_RANK
  ├─ SOCIAL_SCRAPER
  └─ EMAIL_VERIFIER          (yalnız e-posta varsa)
APIFY_GMAPS_DEEP             (yorum corpus'u, kökte, kilitli)
  └─ REVIEW_ANALYST          (corpus < 30 ise yazmaz)
LEAD_INTELLIGENCE_BRIEF      (hepsine bağlı, optional upstream)
```

### 3.1 WEBSITE_AUDITOR

Bugün Playwright ile siteyi açıyor. Rezervasyon sağlayıcısını FineDine flama restoranlarında doğru yazmış. Geliştirme açısı modül sinyali, "yok" ile "görmedim" ayrımı.

`src/lib/extractor.ts` `hasQrMenu` değişkenini `false` ile başlatıyor. Desen tutmazsa `false` yazıyor. `fnb.ts` `hasQrMenu === false` değerini "dijital menü yok, QR sat" diye okuyor. Dishoom dahil sekiz restoranda alan `false`. Bu, "anasayfada QR sağlayıcısı geçmedi" demek. "QR menü yok" demek değil.

Yapılacak:

- `hasQrMenu` ve `hasOnlineOrdering` üç durumlu olur: `true`, `false`, `null`.
- `null`: anasayfada menü linki yok veya menü sayfası açılmadı.
- `false`: menü URL'si açıldı ve QR / online order sağlayıcısı yok.
- `has_ecommerce = true` online sipariş sayılmaz. Sipariş, sepet veya Deliveroo/UberEats/kendi checkout linki varsa `hasOnlineOrdering: true`.
- `bookingProvider` doluysa `hasOnlineReservation: true`. Bu bugün kısmen çalışıyor. Brief'e "rezervasyon satma" exclusion'ı olarak gidecek.
- Embed hatası (`Failed to embed after 3 attempts`, 44 düşüş) audit satırını düşürmez.
- Worker imajında Playwright chromium yoksa boot log'u `FATAL` yazar. 231 koşu bu yüzden düşmüş (`chromium_headless_shell` yok).

Test: menü linki olmayan HTML `hasQrMenu === null` döner. Menü sayfası olup QR sağlayıcısı olmayan HTML `false` döner. `qr.menu` geçen HTML `true` döner. Mevcut `src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts` güncellenir.

### 3.2 APIFY_GMAPS_DEEP

Bu bir analizci değil. Yorum corpus'unu `google_reviews` tablosuna yazar. FineDine'da çoğu lead `concurrent-runs-limit-exceeded` ile düşmüş, bu yüzden analizci Places'ın 5 yorumuna mahkum kalmış.

Yapılacak:

- Süreç içi kilit: aynı anda en fazla 2 Apify koşusu. `agent-run-worker.ts` concurrency 10 kalır. Apify kind'leri `src/lib/apify.ts` içinde paylaşılan bir sayaçla bekler.
- Aylık limit veya 402 gelirse koşu `SUCCEEDED` + `output.skipped = "apify_quota"` olur. Zincir review adımına "corpus yok" diye gider. On deneme ile kuyruğu şişirmez.
- Hedef corpus 80 yorum, tavan 200. 500 çekmek Apify bellek limitine çarpıyor (22 gmaps 402 bellek).

### 3.3 REVIEW_ANALYST

Yorumları KPI'ya çevirir. Satış açısı yazmaz. `leadScore` alanına 0–100 fırsat puanı basmayı bırakır. O puan brief'in işi. Bugün 5 yıldızlı örneklem `lead_score = 20` üretip skora "yorumlar zayıf" diye akıyor.

Yapılacak:

- `google_reviews` sayısı 30'un altındaysa `ReviewAnalysis` bar'larını yazmaz. Çıktı `{ skipped: "thin_corpus", count }`. FineDine'daki "5 yorum, hepsi 5 yıldız, sample not a measure" satırları bir daha oluşmaz.
- Gemini'den istenen KPI etiketleri operasyoneldir: bekleme, rezervasyon, sipariş hatası, hesap, personel hızı, menü. Yemek lezzeti ve "poisoning" pain phrase olarak saklanır ama brief'in pitch listesine girmez. `painPhrases[].sellable: boolean` alanı eklenir. Lezzet `false`.
- Embed hatası analizi düşürmez (79 düşüş).
- 60s deadline: girdi en fazla 80 yorum. 200 yorumluk pencere ve 90s bütçe bu planda yok. Corpus zaten 80'e kesilir.

### 3.4 APIFY_SERP_RANK

Notion'da birincil dış sinyal. Kodda varsayılan zincirde yok. 12 başarılı, 80 düşen. 77'si kota `0/0`, yani worker çağrılmış ve plan kapısı onu fail saymış.

Yapılacak:

- BALANCED zincire girer. Kota 0 ise `skipped: "quota"`, status `SUCCEEDED`. `FAILED` yalnızca actor gerçekten hata dönerse.
- Tek sorgu: `"{businessName}" {city}`. Çıktı alanları: ilk 5 organik sonuç (başlık, url, snippet), markanın kendi sitesinin sırası, snippet içinde rezervasyon / sipariş / rakip yazılım adı.
- Rakip reklam actor'ü (`APIFY_COMPETITOR_ADS`) bu zincire girmez. Bir başarılı koşusu var.

### 3.5 SOCIAL_SCRAPER

Birincil marka kaynağı olması gerekirken 170/245 boş. FineDine kahvelerinde profil objesi `{}`.

Yapılacak:

- Sıra: audit'in `socialProfiles` alanı, yoksa anasayfa linkleri, yoksa SERP snippet'lerinde `instagram.com` / `facebook.com` host'u.
- Çıktı: `{ instagram, facebook, tiktok, linkedin }` her biri `{ url, foundOn: "audit" | "homepage" | "serp" } | null`.
- Takipçi sayısı ve derin post için `APIFY_INSTAGRAM_DEEP` ve kardeşleri varsayılan zincire girmez. SDR deep research'e basarsa çalışırlar.
- Boş obje başarı sayılmaz. Hiç profil yoksa `count: 0` ve `skipped: "no_profile"` yazılır. Brief bunu "sosyal kanıt yok" diye okur, uydurma takipçi yazmaz.

### 3.6 EMAIL_VERIFIER

78/80 koşu kota `0/0` ile `FAILED`. Enrichment veri adımıdır. Brief'i bloklamaz.

Yapılacak:

- Audit'te e-posta yoksa hiç kuyruğa girmez. Orchestrator adımı `optional` ve worker `{ skipped: "no_email" }` döner.
- ZeroBounce anahtarı veya kota yoksa `{ skipped: "not_configured" }`, status `SUCCEEDED`.
- Doğrulama sonucu `WebsiteAudit.contactEmailsVerified` içinde kalır. Ayrı kuyruk (`email-verification-worker`) boot etmez.

### 3.7 SUBVERTICAL_CLASSIFIER

Kalır. Gemini'ye ancak kural çözemezse gider. FineDine'da kahve ile fine dining aynı modül sırasını hak etmez. Çıktı lead üzerinde bir slug'dır (`fnb-cafe`, `fnb-fine-dining`). Satış açısı yazmaz. Audit `optional` olduğu için audit atlanırsa Places tipi ve isimle karar verir, kendisi de `optional`.

### 3.8 LEAD_INTELLIGENCE_BRIEF

Tek karar. Bugün 83 başarılı koşunun hiçbiri `headAgent` yazmamış. Hepsi legacy: headline, talkingPoints, salesConfidence ağırlık ortalaması.

Yapılacak:

- Restoran teknolojisi workspace'lerinde `briefMode` yalnızca `head-agent`. Legacy dal bu niche için kapanır. Anahtar: mevcut `CLAUDE_HEAD_AGENT` ve `CLAUDE_HEAD_AGENT_WORKSPACES`. Yeni flag yok.
- Girdi substratı: audit tri-state, review KPI (varsa), SERP ilk 5, sosyal url'ler, classifier slug, pack shortlist. Dossier, skor, why-now okunmaz.
- Çıktı: `headAgent.primaryAngle`, `talkTrack`, `recommendedModules` (pack sırası), `excludedModules`, `recommendedPackage`, `confidence`, `evidenceRefs`, `sourceConflicts`.
- Exclusion kuralı testte kilitlenir: `bookingProvider` doluysa `reservation` `excludedModules` içindedir. Dishoom fixture'ı bunu kırarsa test kırmızıdır.
- `salesConfidence` pack uyum puanıdır, 5 yorumluk `lead_score` ortalaması değil.
- Evidence ref'i olmayan cümle QA'da düşer. Morleys brief'indeki "add Google Analytics" cümlesi bu kapıdan geçmez. Website modülü yalnızca `websiteBroken === true` ise shortlist'e girer.
- Upstream hepsi skipped olsa bile brief yazılır. Modüller boş, confidence düşük, `missingSources` içinde `"reviews"`, `"serp"`, `"social"` durur.

## 4. Admin

`/admin/control` kalır. Pazarlama analitiği (`/admin` oturum, coğrafya, huni) bu planın dışında.

Vaka izi grupları `docs/superpowers/specs/2026-09-27-finedine-decision-loop-design.md` tablosundaki eski grupların yerine şunlar olur:

| Grup | Worker |
|---|---|
| Site | `WEBSITE_AUDITOR` |
| Sınıf | `SUBVERTICAL_CLASSIFIER` |
| SERP | `APIFY_SERP_RANK` |
| Sosyal | `SOCIAL_SCRAPER` |
| Yorum corpus | `APIFY_GMAPS_DEEP` |
| Yorum | `REVIEW_ANALYST` |
| İletişim | `EMAIL_VERIFIER` |
| Karar | `LEAD_INTELLIGENCE_BRIEF` |

Genel bakış sayacı "analiz tamamlandı" yerine "brief'e ulaşan lead" sayar. `skipped` bir düşüş değildir.

## 5. Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `src/lib/ai-core/chains.ts` | `getDefaultChain` kısa zincir. `LEAD_PIPELINE_ALLOWED_WORKERS` aynı liste. |
| `src/__tests__/ai-core/lead-pipeline-presets.test.ts` | Zincir iddiaları. |
| `src/workers/index.ts` | `review-analysis` ve `email-verification` boot'u kalkar. |
| `src/lib/extractor.ts` | QR ve online order üç durum. |
| `src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts` | Üç durum testleri. |
| `src/lib/apify.ts` | 2'lik eşzamanlılık kilidi. Kota 402 `skipped`. |
| `src/lib/agent-workers/review-analyst.ts` | 30 yorum eşiği, `sellable` bayrağı, embed yutmaz. |
| `src/lib/agent-workers/apify/serp-rank.ts` | Tek sorgu, kota skip. |
| `src/lib/agent-workers/social-scraper.ts` | audit → homepage → SERP sırası. |
| `src/lib/agent-workers/email-verifier.ts` | e-posta yok / kota yok → skipped. |
| `src/lib/agent-workers/lead-intelligence-brief.ts` | Restoran niche'te legacy kapalı. |
| `src/lib/ai-core/agent/head-agent.ts` | Exclusion ve evidence zorunluluğu. |
| `src/lib/control/trace-groups.ts` | Sekiz iz grubu. |
| `src/app/admin/control/trace/[leadId]/page.tsx` | Koşuları grup sırasıyla basar. |
| `src/lib/control/overview.ts` | `completed24h` yalnızca head-agent brief sayar. |

---

### Task 1: Varsayılan zinciri kısalt

**Files:**
- Modify: `src/lib/ai-core/chains.ts` (`getDefaultChain`, `LEAD_PIPELINE_ALLOWED_WORKERS`)
- Test: `src/__tests__/ai-core/lead-pipeline-presets.test.ts`

**Interfaces:**
- Consumes: `getDefaultChain(preset, plan)` imzası aynı kalır.
- Produces: BALANCED ve AGGRESSIVE için aynı step id listesi: `audit`, `classifier`, `serp`, `social`, `email`, `apify_gmaps`, `review_refresh`, `intelligence_brief`.

- [ ] **Step 1: Kırılacak testi yaz**

`lead-pipeline-presets.test.ts` içindeki LITE `describe` bloğunu ve "retains WHY_NOW_SYNTHESIZER and dossier in BALANCED" testini sil. Yerine şunları koy. AGENCY planı SERP, e-posta ve gmaps adımlarını düşürmez (`minPlan: PRO`). FREE planda `filterByPlan` o üçünü atar. LITE assertion'ı FREE üzerinde yazılır.

```ts
it("BALANCED is the short data-plus-brief chain", () => {
  const ids = stepIdsIn(getDefaultChainForUi("BALANCED", "AGENCY"));
  expect(ids).toEqual([
    "audit",
    "classifier",
    "serp",
    "social",
    "email",
    "apify_gmaps",
    "review_refresh",
    "intelligence_brief",
  ]);
});

it("LITE on FREE keeps audit, classifier, social, and brief", () => {
  expect(stepIdsIn(getDefaultChainForUi("LITE", "FREE"))).toEqual([
    "audit",
    "classifier",
    "social",
    "intelligence_brief",
  ]);
});

it("AGGRESSIVE matches BALANCED", () => {
  expect(stepIdsIn(getDefaultChainForUi("AGGRESSIVE", "AGENCY"))).toEqual(
    stepIdsIn(getDefaultChainForUi("BALANCED", "AGENCY")),
  );
});

it("brief waits for every data step", () => {
  const brief = stepById(getDefaultChainForUi("BALANCED", "AGENCY"), "intelligence_brief");
  expect(brief?.dependsOn.sort()).toEqual(
    ["audit", "classifier", "serp", "social", "email", "review_refresh"].sort(),
  );
});
```

`REMOVED_V2_WORKERS` listesine şunları ekle: `SALES_OPPORTUNITY_SCORER`, `LEAD_DOSSIER_GENERATOR`, `WHY_NOW_SYNTHESIZER`, `TRIGGER_DETECTOR`, `ICP_SCORER`, `APIFY_WEB_CRAWL_DEEP`, `GOOGLE_PLACES_REVIEWS`, `OPENER_WRITER`, `WEBSITE_MOCKUP_GENERATOR`.

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run src/__tests__/ai-core/lead-pipeline-presets.test.ts`

Expected: FAIL. Mevcut BALANCED hâlâ dossier ve why-now içerir.

- [ ] **Step 3: `getDefaultChain` gövdesini değiştir**

`LITE` aynı kısa listenin Apify'siz hali olur: `audit`, `classifier`, `social`, `email`, `intelligence_brief`. SERP ve gmaps `minPlan` PRO ise `filterByPlan` onları zaten atar. FREE workspace'te review adımı da düşer.

BALANCED ve AGGRESSIVE gövdesi:

```ts
const balanced: Chain = [
  { stepId: "audit", workerKind: "WEBSITE_AUDITOR", dependsOn: [], optional: true },
  { stepId: "classifier", workerKind: "SUBVERTICAL_CLASSIFIER", dependsOn: ["audit"], optional: true },
  { stepId: "serp", workerKind: "APIFY_SERP_RANK", dependsOn: ["audit"], optional: true },
  { stepId: "social", workerKind: "SOCIAL_SCRAPER", dependsOn: ["audit"], optional: true },
  { stepId: "email", workerKind: "EMAIL_VERIFIER", dependsOn: ["audit"], optional: true },
  { stepId: "apify_gmaps", workerKind: "APIFY_GMAPS_DEEP", dependsOn: [], optional: true },
  { stepId: "review_refresh", workerKind: "REVIEW_ANALYST", dependsOn: ["apify_gmaps"], optional: true },
  {
    stepId: "intelligence_brief",
    workerKind: "LEAD_INTELLIGENCE_BRIEF",
    dependsOn: ["audit", "classifier", "serp", "social", "email", "review_refresh"],
    optional: true,
  },
];
```

`LEAD_PIPELINE_ALLOWED_WORKERS` bu sekiz kind ile sınırlanır. `filterByPlan` davranışı durur.

- [ ] **Step 4: Test yeşil**

Run: `npx vitest run src/__tests__/ai-core/lead-pipeline-presets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-core/chains.ts src/__tests__/ai-core/lead-pipeline-presets.test.ts
git commit -m "fix: default lead chain is data collection plus one brief"
```

### Task 2: Çift kuyrukları sustur

**Files:**
- Modify: `src/workers/index.ts`
- Test: `src/__tests__/workers/supervisor-boot.test.ts` (yoksa oluştur)

**Interfaces:**
- Consumes: yok.
- Produces: supervisor yalnızca `discovery`, `agent-runs`, `seo-ops` worker'larını ve mevcut sequence / stuck-status cron'larını başlatır.

- [ ] **Step 1: Test**

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("does not boot the legacy review and email queues", () => {
  const src = readFileSync("src/workers/index.ts", "utf8");
  expect(src).not.toMatch(/startReviewAnalysisWorker\(/);
  expect(src).not.toMatch(/startEmailVerificationWorker\(/);
  expect(src).toMatch(/startAgentRunWorker\(/);
  expect(src).toMatch(/startDiscoveryWorker\(/);
});
```

- [ ] **Step 2: Test kırmızı**

Run: `npx vitest run src/__tests__/workers/supervisor-boot.test.ts`

- [ ] **Step 3: `index.ts` içinden iki start çağrısını ve shutdown `close` çağrılarını sil**

Import satırlarını da sil. `crawl-worker` ve `analyze-worker` yorumları kalsın.

- [ ] **Step 4: Test yeşil**

- [ ] **Step 5: Commit**

```bash
git add src/workers/index.ts src/__tests__/workers/supervisor-boot.test.ts
git commit -m "fix: stop booting duplicate review and email queues"
```

### Task 3: Website audit üç durumlu menü sinyali

**Files:**
- Modify: `src/lib/extractor.ts` (`hasQrMenu` başlangıcı ve online order)
- Test: `src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts`

**Interfaces:**
- Consumes: ham HTML string, sayfa URL'si.
- Produces: `extractFeatures()` dönüşünde `hasQrMenu: boolean | null`, `hasOnlineOrdering: boolean | null`.

- [ ] **Step 1: Testleri ekle**

Mevcut "QR vendor sets true" testleri durur. Şunları ekle:

```ts
it("returns null QR when the page has no menu link", () => {
  const f = extractFeatures("<html><body><h1>Cafe</h1></body></html>", "https://cafe.example");
  expect(f.hasQrMenu).toBeNull();
  expect(f.hasOnlineOrdering).toBeNull();
});

it("returns false QR when a menu link exists and no vendor matches", () => {
  const html = `<a href="https://cafe.example/menu">Menu</a>`;
  expect(extractFeatures(html, "https://cafe.example").hasQrMenu).toBe(false);
});

it("does not treat a shop link as online ordering", () => {
  const html = `<a href="https://cafe.example/shop">Shop</a>`;
  expect(extractFeatures(html, "https://cafe.example").hasOnlineOrdering).toBeNull();
});
```

Online order `true` için mevcut checkout / deliveroo deseninden bir fixture kullan. Desen yoksa `hasOnlineOrdering` `null` kalır, `false` yazılmaz.

- [ ] **Step 2: Test kırmızı**

Run: `npx vitest run src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts`

- [ ] **Step 3: `let hasQrMenu = false` satırını `let hasQrMenu: boolean | null = null` yap**

Menü linki bulunup vendor tutmazsa `false` ata. Vendor tutarsa `true`. Online order için aynı üç durum. Genel e-ticaret bayrağı bu alanı doldurmaz.

- [ ] **Step 4: Test yeşil**

- [ ] **Step 5: Commit**

```bash
git add src/lib/extractor.ts src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts
git commit -m "fix: website audit distinguishes unseen menu signals from absent ones"
```

### Task 4: Yorum corpus eşiği ve Apify kilidi

**Files:**
- Modify: `src/lib/agent-workers/review-analyst.ts`
- Modify: `src/lib/apify.ts`
- Test: `src/__tests__/agent-workers/review-analyst-corpus.test.ts`
- Test: `src/__tests__/lib/apify-limiter.test.ts`

**Interfaces:**
- Consumes: `google_reviews` satır sayısı, Apify HTTP yanıt kodu.
- Produces: `run()` `{ skipped: "thin_corpus", count: number }` when count < 30. Apify 402/403 quota `{ skipped: "apify_quota" }` ve status başarı yolu (worker `FAILED` fırlatmaz). `withApifySlot(fn)` aynı anda 2 çağrı.

- [ ] **Step 1: Corpus testi**

```ts
it("does not write KPI bars below 30 reviews", async () => {
  const out = await runReviewAnalyst({ reviewCount: 5, reviews: fiveStarSample });
  expect(out.skipped).toBe("thin_corpus");
  expect(out.leadScore).toBeUndefined();
});
```

`runReviewAnalyst` testte gerçek Gemini çağırmaz. Modülün saf karar fonksiyonunu ayır: `shouldAnalyzeReviews(count: number): boolean` eşik 30.

- [ ] **Step 2: Test kırmızı, sonra eşiği koy**

`review-analyst.ts` başında:

```ts
export const MIN_REVIEW_CORPUS = 30;

export function shouldAnalyzeReviews(count: number): boolean {
  return count >= MIN_REVIEW_CORPUS;
}
```

`run` içinde `shouldAnalyzeReviews` false ise Gemini çağrılmaz, `ReviewAnalysis` upsert edilmez, dönüş `{ skipped: "thin_corpus", count }`.

Pain phrase şemasına `sellable: boolean` ekle. Prompt'ta lezzet ve food poisoning `sellable: false`, bekleme / rezervasyon / sipariş hatası `true`.

Embed hatasını yutan mevcut website-auditor dalının aynısını kullan: `EmbeddingError` loglanır, koşu başarılı biter.

- [ ] **Step 3: Apify kilidi testi**

```ts
it("runs at most two apify calls at once", async () => {
  let active = 0;
  let max = 0;
  const jobs = Array.from({ length: 5 }, () =>
    withApifySlot(async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
    }),
  );
  await Promise.all(jobs);
  expect(max).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 4: `withApifySlot` ve kota**

`src/lib/apify.ts` içinde söz verilen sayaç. Gmaps actor `maxReviews` 80. HTTP 402 ve 403 `platform-feature-disabled` / `actor-memory-limit-exceeded` / `concurrent-runs-limit-exceeded` için throw yok, `{ skipped: "apify_quota", statusCode }` dön.

- [ ] **Step 5: Testler yeşil, commit**

```bash
git add src/lib/agent-workers/review-analyst.ts src/lib/apify.ts src/__tests__/agent-workers/review-analyst-corpus.test.ts src/__tests__/lib/apify-limiter.test.ts
git commit -m "fix: skip thin review samples and cap Apify concurrency"
```

### Task 5: SERP, sosyal ve e-posta veri adımları

**Files:**
- Modify: `src/lib/agent-workers/apify/serp-rank.ts`
- Modify: `src/lib/agent-workers/social-scraper.ts`
- Modify: `src/lib/agent-workers/email-verifier.ts`
- Test: `src/__tests__/agent-workers/data-steps.test.ts`

**Interfaces:**
- Consumes: audit `socialProfiles`, SERP organik sonuçları, `contactEmails`.
- Produces: SERP `{ results: { title, url, snippet }[], ownRank: number | null, skipped?: "quota" }`. Sosyal `{ count, profiles, skipped?: "no_profile" }`. E-posta `{ skipped?: "no_email" | "not_configured" }`.

- [ ] **Step 1: Testler**

```ts
it("marks email verifier skipped when the audit has no address", async () => {
  const out = await decideEmailStep({ emails: [] });
  expect(out.skipped).toBe("no_email");
});

it("fills social from serp when the homepage has no profile", () => {
  const profiles = resolveSocialProfiles({
    audit: {},
    homepage: [],
    serpSnippets: ["https://instagram.com/dishoom"],
  });
  expect(profiles.instagram?.foundOn).toBe("serp");
});

it("returns quota skip instead of throwing when serp quota is zero", async () => {
  const out = await decideSerp({ quotaRemaining: 0 });
  expect(out.skipped).toBe("quota");
});
```

- [ ] **Step 2: Test kırmızı**

- [ ] **Step 3: Üç saf fonksiyonu ilgili modüllere koy ve `run` onları kullansın**

`decideEmailStep`, `resolveSocialProfiles`, `decideSerp`. SERP sorgusu tek string: işletme adı + şehir. Kota 0 ve anahtar yok `skipped`. Sosyal sıra audit, homepage, SERP. Üçü de boşsa `skipped: "no_profile"`.

- [ ] **Step 4: Test yeşil, commit**

```bash
git add src/lib/agent-workers/apify/serp-rank.ts src/lib/agent-workers/social-scraper.ts src/lib/agent-workers/email-verifier.ts src/__tests__/agent-workers/data-steps.test.ts
git commit -m "fix: serp, social, and email steps skip cleanly when data is missing"
```

### Task 6: Brief yalnızca head agent kararı

**Files:**
- Modify: `src/lib/agent-workers/lead-intelligence-brief.ts`
- Modify: `src/lib/ai-core/agent/head-agent.ts`
- Test: `src/__tests__/agent-workers/lead-intelligence-brief-grounding.test.ts`

**Interfaces:**
- Consumes: audit tri-state, review KPI (`sellable`), SERP, sosyal, classifier slug, `computeFnbModuleFit` shortlist.
- Produces: `briefMode: "head-agent"`, `headAgent.excludedModules` içinde `reservation` when `bookingProvider` dolu, `missingSources: string[]`. `salesConfidence` pack puanı. `headAgent.sourceConflicts` yalnızca çelişen iddia cümleleridir. Eksik kaynak oraya yazılmaz.

- [ ] **Step 1: Dishoom fixture testi**

```ts
it("excludes reservation when a booking provider is already present", async () => {
  const out = await buildBriefDecision({
    niche: "RESTAURANT_TECH",
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Dishoom reservations",
      hasQrMenu: null,
      hasOnlineOrdering: null,
    },
    reviewCount: 29744,
    reviewAnalysis: null,
  });
  expect(out.briefMode).toBe("head-agent");
  expect(out.headAgent.excludedModules).toContain("reservation");
  expect(out.headAgent.evidenceRefs.length).toBeGreaterThan(0);
});

it("does not pitch website rebuild from a thin five-review sample", async () => {
  const out = await buildBriefDecision({
    niche: "RESTAURANT_TECH",
    audit: { hasQrMenu: null, websiteBroken: false },
    reviewCount: 5,
    reviewAnalysis: null,
  });
  expect(out.headAgent.recommendedModules).not.toContain("website");
  expect(out.missingSources).toContain("reviews");
});
```

- [ ] **Step 2: Test kırmızı**

Mevcut grounding testi `briefMode === "v2"` bekliyorsa onu `head-agent` ile güncelle. Legacy dalın testi `niche !== RESTAURANT_TECH` ise durur.

- [ ] **Step 3: Uygulama**

`lead-intelligence-brief.ts`: workspace niche `RESTAURANT_TECH` ise legacy üreticiyi çağırma. `getHeadAgentMode` `off` ise brief `{ skipped: "head_agent_off" }` döner, legacy'ye düşmez.

`head-agent.ts`: shortlist'e `reservation` eklemeden önce `bookingProvider` doluysa exclusion listesine yaz. `website` modülü yalnızca `websiteBroken === true`. Evidence ref'i olmayan talk track cümlesi QA'da atılır. `salesConfidence` için `reviewAnalysis.leadScore` okunmaz.

- [ ] **Step 4: Test yeşil**

Run: `npx vitest run src/__tests__/agent-workers/lead-intelligence-brief-grounding.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-workers/lead-intelligence-brief.ts src/lib/ai-core/agent/head-agent.ts src/__tests__/agent-workers/lead-intelligence-brief-grounding.test.ts
git commit -m "fix: restaurant briefs come from the head agent, not a second score"
```

### Task 7: Kontrol odası iz grupları

**Files:**
- Create: `src/lib/control/trace-groups.ts`
- Modify: `src/app/admin/control/trace/[leadId]/page.tsx`
- Modify: `src/lib/control/overview.ts` (`completed24h` sayacı, satır 29–36)
- Test: `src/__tests__/control/trace-groups.test.ts`

**Interfaces:**
- Consumes: Task 1 worker kind listesi.
- Produces: `TRACE_GROUPS: { label: string; kinds: AgentWorkerKind[] }[]`.

- [ ] **Step 1: Test**

```ts
import { TRACE_GROUPS } from "@/lib/control/trace-groups";

it("trace groups match the short chain", () => {
  const kinds = TRACE_GROUPS.flatMap((g) => g.kinds);
  expect(kinds).toEqual([
    "WEBSITE_AUDITOR",
    "SUBVERTICAL_CLASSIFIER",
    "APIFY_SERP_RANK",
    "SOCIAL_SCRAPER",
    "APIFY_GMAPS_DEEP",
    "REVIEW_ANALYST",
    "EMAIL_VERIFIER",
    "LEAD_INTELLIGENCE_BRIEF",
  ]);
});
```

- [ ] **Step 2: Test kırmızı**

Run: `npx vitest run src/__tests__/control/trace-groups.test.ts`

- [ ] **Step 3: Sabiti yaz ve iki yüzeye bağla**

`trace-groups.ts` etiketleri: Site, Sınıf, SERP, Sosyal, Yorum corpus, Yorum, İletişim, Karar. Sıra testteki kind sırasıdır.

`trace/[leadId]/page.tsx` düz `runs.map` yerine `TRACE_GROUPS` sırasında basar. Gruptaki kind için koşu yoksa satır "çalışmadı" der.

`overview.ts` içindeki `completed24h` sorgusuna ekle:

```ts
workerKind: "LEAD_INTELLIGENCE_BRIEF",
outputJson: { path: ["briefMode"], equals: "head-agent" },
```

Mevcut `status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] }` filtresi durur. Üstüne şu iki alan eklenir. `skipped` brief'ler `briefMode` taşımaz, sayıma girmez.

- [ ] **Step 4: Test yeşil**

- [ ] **Step 5: Commit**

```bash
git add src/lib/control/trace-groups.ts src/lib/control/overview.ts src/app/admin/control/trace/[leadId]/page.tsx src/__tests__/control/trace-groups.test.ts
git commit -m "fix: control trace shows the eight lead-analysis steps"
```

## 6. Kabul

FineDine Beta'da yeni bir lead (site'i olan bir restoran) şu izi bırakır:

1. Audit `reachable` ya da `crawlError`. `hasQrMenu` Dishoom benzeri anasayfada `null` olabilir, `false` yalnızca menü sayfası açıldıysa.
2. SERP ya beş sonuç ya da `skipped: quota`. `FAILED` değil.
3. Sosyal ya url ya `skipped: no_profile`.
4. Gmaps 80 yoruma kadar yazar ya da `skipped: apify_quota`. 30'un altındaysa review analizcisi bar yazmaz.
5. Brief `briefMode = head-agent`. Rezervasyon sağlayıcısı doluysa `reservation` hariç listededir. `website` modülü ancak site kırıkssa listede.
6. Aynı lead için `SALES_OPPORTUNITY_SCORER`, `LEAD_DOSSIER_GENERATOR`, `WHY_NOW_SYNTHESIZER` yeni `agent_runs` satırı açmaz.
7. Supervisor log'unda `review-analysis` ve `email-verification` worker started satırı yok.

Eski lead'ler yeniden koşmaz. Kabul yeni bir lead ile yapılır.

## 7. Bu planın dışında

- Outcome learning, playbook kalibrasyon editörü, HubSpot writeback boşlukları (`docs/superpowers/specs/2026-09-27-finedine-decision-loop-design.md` ve M1 restart notu).
- Enum'dan ölü worker silmek. Zincirden çıkarmak davranışı keser. Enum silmek ayrı bir şema turu.
- `seo-ops` ve discovery.
- Mockup / opener tıklama zincirleri.
