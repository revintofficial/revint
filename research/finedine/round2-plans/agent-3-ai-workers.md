# Agent 3 — AI Workers (LLM Output Quality Root Cause + Fix Plan)

> **Scope:** Round 2 raporundaki §3.7 (chain blindness), §3.8 (personalized message bağlam ihlali), §3.10 (non-English review leakage), §4.2 (hallucinated review snippets), §4.3 (premium-default paket), §4.4 (small-sample patlaması).
> **Workers in scope:** `SALES_OPPORTUNITY_SCORER`, `OPENER_WRITER`, `REVIEW_ANALYST`, `LEAD_INTELLIGENCE_BRIEF` (whitelist tüketicisi); plus `package-selector`, `gemini.ts` analiz prompt'u, `review-analysis-prompt.ts`, `niches/index.ts:fnb-cafe-bakery`.
> **Scope exclusion:** Bu plan **kod değiştirmiyor**. Sadece prompt + schema + post-process + niche-pack düzeyinde fix taslağı, golden-test fixture önerisi ve effort/risk skoru.
> **Skill referansları:** `prompt-engineering-gemini` skill — responseSchema (rule 1), explicit temperature (rule 2), runtime Zod validate (rule 4), retry+backoff (rule 5), token guard (rule 6), reproducibility pin (rule 7).

---

## 0. Cover

| Field | Value |
|---|---|
| Agent | Agent 3 — AI Workers / Prompt Engineering |
| Inputs | `beta-test-round-2-camden-report.md` §3.7, §3.8, §3.10, §4.2, §4.3, §4.4 + §8.1.2 (OPENER_SUCCESS seeds) + §8.2 (chain-aware niche pack) |
| Outputs touched (DESIGN ONLY) | `src/lib/gemini.ts`, `src/lib/prompts/review-analysis-prompt.ts`, `src/lib/agent-workers/{sales-opportunity-scorer,opener-writer,review-analyst,package-selector}.ts`, `src/lib/review-analysis/kpi-filter.ts`, `src/lib/niches/index.ts` (fnb-cafe-bakery pack) |
| Cross-agent dependencies | **A2 (audit/crawler taxonomy)** — `crawl_error="WEBSITE_EXPIRED"` ve `httpStatus`/`auditTitle` opener'a inject edilebilmesi için A2'nin `crawl_error` taxonomy genişletmesi ÖNCE ship olmalı (bkz. §5). |
| Total effort estimate | P0/P1 toplam ~62 saat (ayrıntı §4) |
| Risk surface | OPENER_SUCCESS poisoning, schema breaking change (count alanı zaten var ama pool floor yeni), language-filter false-positive |

---

## 1. Sorun Inventory

Her bug için: **(a)** tester alıntısı (Türkçe orijinal), **(b)** DB kanıtı (rapor §5'ten — gerçek lead-id satırları), **(c)** kod path ve okunan satırlar.

### 1.1 §3.7 — Why They're a Fit chain blindness

| Field | Value |
|---|---|
| **Tester alıntısı** | Black Sheep Coffee: *"Likely pain points bölümünde QR entegrasyonu, order ahead gibi özelliklerin olmadığı belirtilmiş ancak bu sistemlerin hepsi uygulama ve websitesi ile entegre çalışmakta. … İşletme tarafından dijitalleşme ile çözülmüş sorunları tekrardan aynı yöntemle çözmeye çalışmak yanlış."* (rapor §3.7) |
| **DB kanıtı** | Black Sheep `cmoozvrcx000nkz042jba1czr` — `reason_codes=["chain_detected", "no_booking", "no_whatsapp", …]`, `pain_points=["QR'dan sipariş ve ödeme akışının olmaması", "Online rezervasyon eksikliği", "Servis yavaşlığı"]` (rapor §3.7 tablosu). Blank Street `cmoozvs9l0013kz04jzlky5zi` — aynı pattern + opener "QR'dan sipariş akışı" pitch ediyor. |
| **Kod path** | `sales-opportunity-scorer.ts:267-269` chain_detected reason_code'unu sadece `package-selector.selectPackage()`'a iletiyor. `gemini.ts:analyzeLeadWithGemini` çağrısında `analysis.likely_pain_points` üreten path'e chain sinyali GİTMİYOR — `buildAnalysisPrompt` `salesFocus` argümanında `chainDetected` yok (`gemini.ts:249-265`). |
| **Etkilenen lead'ler** | Blank Street, Black Sheep — tester'ın açıkça "kurumsal firma için yanlış pitch" dediği iki vaka. Round 1 P0.5'te `chain_detected → Enterprise` package mapping eklendi ama prompt'a feedback yok. |

### 1.2 §3.8 — Personalized Message bağlam ihlali

Dört alt vaka, hepsi `OPENER_WRITER` `buildOpenerPrompt`'a parametre eksikliğinden:

| Alt vaka | Tester alıntısı | DB kanıtı | Kod path |
|---|---|---|---|
| **A. Fable and Falcon — expired site** | *"Personalized message geliştirilerek güzelleştirilebilir çünkü, domaini expired olan bir site için sitenizi inceledik diye opener başlamamalı"* | `cmoozvtn7001rkz042wr6yiab` — `audit.title="Squarespace - Website Expired"`, `httpStatus=404`. Opener: *"Merhaba Fable and Falcon ekibi, **sitenizi hızla incelediğimde**, modern bir QR ile sipariş akışının eksik olduğunu fark ettim …"* | `opener-writer.ts:200-249` `buildOpenerPrompt({...})` çağrısı `lead.crawlStatus`, `audit.httpStatus`, `audit.title`, `audit.crawlError` parametrelerini almıyor. |
| **B. Black Sheep — chain blindness opener** | *"personalized message oldukça başarısız, kurumsal bir firmaya yaklaşmak için halıhazırda çözmüş oldukları sorunları sunmak çok mantıksız"* | Opener: *"Black Sheep Coffee'de QR'dan sipariş/ödeme akışının eksik olduğunu fark ettik …"* | §1.1 ile aynı kök: `chainDetected` parametresi opener prompt'una taşınmıyor. `opener-writer.ts:200-249` `chainDetected` field'ı yok. |
| **C. Coffee Couch — TR devrik cümle** | *"Opener yine oldukça yanlış ve devrik şekilde yazılmış"* | Opener: *"FineDine olarak, özellikle sabah yoğunluklarında 'QR-to-order' sistemiyle sipariş alma sürecinizi hızlandıracak ve 'BEST coffee in London' müdavimlerinizi sadık müşterilere dönüştürecek özel bir dijital çözüm hazırladık."* | `opener-writer.ts:415-485` TR rule listesi devrik cümle / mid-clause noun phrase / passive uyarısı içermiyor. `temperature: 0.7` (line 255) yaratıcılık tarafında — tone bant rules eksik. |
| **D. Blank Street — loyalty hint** | (tester atladı; biz §5 cross-ref'te bulduk) | Opener: *"…sadakat programınızı da güçlendirebilirsiniz"* — Blank Street'in zaten loyalty programı VAR. | `opener-writer.ts:217-220` `nicheFeaturedModules` listesi `Restaurant CRM (loyalty)` içeriyor (`niches/index.ts:398`). Chain için suppress kuralı yok. |

### 1.3 §3.10 — Non-English review leakage

| Field | Value |
|---|---|
| **Tester alıntısı** | Il botanico: *"likely pain points bölümünde İtalyanca bir yorumun mentionlanmış olması maalesef bu konuda anlaşılırlığı düşürmekte (Ingilizce yorumların bulunması Finedine için daha anlaşılır ve doğru olur)"*. Camden Roastery: *"yorumlar bölümüne geldiğimizde bir tane bulunmasına rağmen gelen ingilizce harici bir yorum Glance olarak yorum bölümünde gözükmekte"*. |
| **DB kanıtı** | Camden Roastery `cmoozvpz00001kz04a6jirdd5` — `weaknessKpis[].examples` Hollandaca (`"pannenkoeken tegen van smaak"`) ve Fransızca (`"L'ambiance est chaleureuse…"`). Il botanico `cmoozvsyu001fkz04ieppflvm` — İtalyanca + İspanyolca strings çoklu KPI'larda + `painPhrases=["Sin sabor a nada y caros!", "un cappuccio che faceva schifo", …]`. Glass Coffee `cmoozvq850003kz04ck13mzhb` — İtalyanca "Servizio un po' lento" + Fransızca "servis rapidement". |
| **Kod path** | `review-analyst.ts:67-80` `analyzeReviewsWithGemini` çağrısı `lead.googleReviews.map(r => ({...r.text}))` — language filter yok. `review-analysis-prompt.ts:88-136` prompt body — sadece `Default output language is English` (line 58 system context) var; `examples[]` için language kuralı yok. `kpi-filter.ts:51-62` `isGroundedInCorpus` İtalyanca string'i de "grounded" sayıyor çünkü o satır gerçekten review corpus'unda var. |

### 1.4 §4.2 — Hallucinated review snippets (3 alt vaka)

| Alt vaka | Tester alıntısı | DB kanıtı | Kod path |
|---|---|---|---|
| **A. S.O.S "£7.10" tek-kelime** | *"Yorumlar bölümünde expensive bar'ı mentionlanırken tek kelime olarak fiyat '7.10' olarak yazılmış açık ve anlaşılır değil"* | `cmon6tshs001fjv04djylm2ts` — `weaknessKpis: [{label:"Expensive", percent:100, examples:["£7.10"]}]`. Tek örnek, tek kelime. | `kpi-filter.ts:88` `groundedExamples.length < 2` → drop kuralı VAR ama Gemini iki örnek gönderdiyse ikincisi grounding'i geçemediği için drop EDİLMİYOR (varsayım: Gemini iki örnek vermiş, biri grounded geçmiş, diğeri kaybolmuş — gerçek sayısal kontrol log'larda yok). Ayrıca `examples` length < 2 olduğunda KPI tamamen düşürülmesi gerekirken bazı durumlarda 1 örnekle persiste oluyor (1-token "£7.10" `isGroundedInCorpus`'un `tokens.length <= 2` early-exit dalına girip kabul ediliyor — `kpi-filter.ts:54-56`). |
| **B. YBA "automatic tip request" label echo** | *"Automatic tip request yazan halüsinasyon yorum bulunuyor."* | `cmon6tqtp000njv04bf2gg5hs` — `weaknessKpis: [{label:"Automatic tip request", percent:50, examples:["automatic tip request"]}]`. `painPhrases=[…, "automatic tip request", …]`. Example **=** label tam eşleşme. | `kpi-filter.ts:71-108` ve `review-analysis-prompt.ts:108-127` example=label sağlama yapmıyor. Schema (`gemini.ts:766-790`) `label` ve `examples[]` aynı string olabilir kuralı yok. |
| **C. The Drip "Rude Staff & Toilet Access" fusion** | *"Review Intelligence bölümünde Rude staff toilet access diye bir bölüm mentionlanmış ancak altındaki bölüm yorumun yanlış yerinden alıntılamış bu da anlamsız bir kötü yorum haline gelmiş."* | `cmon6trzv0017jv04j17d9dj1` — `weaknessKpis: [{label:"Rude Staff & Toilet Access", percent:33, examples:["abrupt, grumpy gentleman", "toilet is really for staff not customers"]}]`. İki ayrı şikayet **tek label** altında. | Prompt rule (`review-analysis-prompt.ts:84`) `Restrictive Policies` örneği üzerinden fusion'a uyarı veriyor ama fnb workspace `labelEnum` whitelist'inde de `"Rude Staff & Toilet Access"` gibi compound enum değerleri olmadığı kontrol edilmiyor (whitelist FNB için `fnb-review-labels.ts`'te tanımlı; The Drip `&` yapışması whitelist enum'una sızdı veya whitelist devre-dışı kaldı — log gerek). |

### 1.5 §4.3 — Premium-default paket (10/12)

| Field | Value |
|---|---|
| **Tester alıntısı** | Il botanico: *"premium bu işletme için oldukça fazla"*. S.O.S: *"premium paket bu işletme için oldukça yüksek. Paket optimizasyonu şart"*. Fable and Falcon: *"böylesine düşük puanlı, websitesi dahi olmayan bir yer için Premium çok fazla. Basic önerilmeli"*. (rapor §4.3) |
| **DB kanıtı** | 12/12 lead `suggested_offer=STARTER`; `recommended_package_id`: 10× Premium ($119/ay), 2× Enterprise (chain detected). One Shot Coffee 500 review + NO_WEBSITE → Premium ❌. S.O.S 14 review → Premium ❌. Fable and Falcon 34 review + expired site → Premium ❌. |
| **Kod path** | `package-selector.ts:81-114` `selectPackage()` 3 input alıyor: `reviewCount`, `painPointCount`, `hasMultipleLocations`/`isHotel`. **`hasWebsite` yok**, **`crawlStatus` yok**, **`rating` informational only (line 53)**. `painPointCount` gemini'nin `analysis.likely_pain_points.length` (`scorer.ts:270-272`) — Gemini her cafe lead'ine 4-5 pain üretiyor → her zaman ≥2 → her zaman Premium. Kural `reviewCount > 300 → Premium` cut-off'u tek başına One Shot (500) gibi vakalarda doğru ama small-cap (S.O.S 14) için `painPointCount >= 2` gating fail ediyor. |

### 1.6 §4.4 — Small-sample patlaması

| Field | Value |
|---|---|
| **Tester alıntısı** | S.O.S: *"Pain Points'te halüsinasyon (böyle yorumlar geçmiyor)"*. Coffee Couch: *"Bad coffee quality 100% tek bir negatif review'dan global KPI"* (rapor §4.4) |
| **DB kanıtı** | S.O.S 14 review, sentiment positive 92.8%, negative 7.1% (~1 negatif yorum). `weaknessKpis`: Expensive 100%, Poor food/drink quality 100%. Coffee Couch 50 review, negative 2% (1 yorum), `weaknessKpis: [{label:"Bad coffee quality", percent:100, count:?}]`. Camden Roastery 50 review, 2 negatif yorum → 3 ayrı 100% KPI ("Rude Staff", "Food Quality", "Overpriced"). |
| **Kod path** | `review-analysis-prompt.ts:128` "When reviewsAnalyzedCount < 10, return AT MOST 2 weaknessKpis" — eşik **10** review, S.O.S 14 ile bypass'lıyor. `kpi-filter.ts:71-108` `count >= 2 + groundedExamples.length >= 2` filter VAR ama `negativePoolCount` floor YOK — pool 1 yorumsa bile `count=2` (tek yorumdan 2 farklı şikayet alıntılı) cluster'ı geçiyor. `truePercent = round(count/poolCount * 100)` (line 96-99) — `count > poolCount` durumunda %100'e clamp ediyor (kanıt: S.O.S "Expensive 100%" — count muhtemelen 1, poolCount 1 → 100%). |

---

## 2. Root Cause Analysis (zincir trace)

Her bug için **prompt input → prompt template → responseSchema → post-processing** zincirinin hangi düğümünde sinyalin kaybolduğu / hatalı geçtiği.

### 2.1 §3.7 chain blindness zinciri

```
[lead.businessName + lead.websiteUrl + features] (scorer.ts:202-228)
        │
        ▼
analyzeLeadWithGemini(...)  ◄── chain sinyali burada YOK
        │                       (workspaceCtx.activeCampaigns var, chainDetected yok)
        ▼
buildAnalysisPrompt(...)  (gemini.ts:219-443)
        │
        ▼  Prompt body — pitchAngle/featuredModules niche pack'ten geliyor;
        │  CHAIN context branch yok. fnb-cafe-bakery pack'i her zaman
        │  "Order-ahead QR + loyalty stamps" pitch'liyor (niches/index.ts:384).
        ▼
Gemini gemini-2.5-flash, temperature default (no override)
        │
        ▼  output: likely_pain_points[] + reason_codes[]
        ▼
scorer.ts:267-269 — analysis.reason_codes.some(/chain_detected/) ←── chain SADECE BURADA okunuyor
        │
        ▼  ↳ selectPackage(hasMultipleLocations: true) → Enterprise ✅
        │  ↳ likely_pain_points UI'a `pain_points` olarak persist ediliyor (line 348)
        │      ❌ chain için HİÇ filtreleme yok
        ▼
opener-writer.ts:200-249 — chainDetected param'ı gelmiyor (only painPhrases)
```

**Kayıp sinyal noktası:** `gemini.ts:219` `buildAnalysisPrompt`'ın imzası. `chain_detected` analiz çıktısı OLARAK üretiliyor ama analiz girdisi OLARAK prompt'ta yok. Klasik post-hoc bilgi: model kararını verdiğinde "burası chain" deyip 5 pain bastı; dışarıdan "biliyorsun bu chain, pain üretirken bunu hesaba kat" denmedi.

### 2.2 §3.8 personalized message zinciri

```
[lead.* + opp.* + audit.* + niche pack] (opener-writer.ts:50-200)
        │
        ▼
buildOpenerPrompt({  ←── crawlStatus, crawlError, httpStatus, auditTitle, chainDetected EKSİK
  businessName, primaryType, borough, rating, reviewCount,
  bestSalesAngle, painPhrases,
  offerName, valueProposition, …,
  mockupUrl,                 ← TEK durum sinyali var
  successExamples,
  nicheLabel, nichePitchAngle, nicheFeaturedModules,
  nicheNotApplicableModules,  ← Round 1 P1.4 fix; chain için yok
  confirmedPainPoints,         ← Round 1 P1.5 brief whitelist (boş olabilir)
  confirmedMissingFeatures,    ← Round 1 P1.5
  isParentFallback,
  secondaryNiches,
  recommendedPackage,
})
        │
        ▼
Prompt body (opener-writer.ts:412-616)
        │  TR header line 416
        │  rules line 461-485 — devrik cümle / passive uyarısı YOK
        │  mockupRule (var/yok kontrol) — siteState için benzer rule yok
        │  notApplicableRule, painWhitelistRule, missingFeatureRule var
        ▼
generateWithTimeout, temperature 0.7 (line 255)  ◄── voice rules için doğru aralık
        │
        ▼
result.response.text() → personalizedFirstMessage
```

**Kayıp sinyal noktaları:**
1. **`websiteContext` parametresi**: `lead.crawlStatus`, `audit.title`, `audit.httpStatus`, `audit.crawlError` opener prompt'a hiç ulaşmıyor. "Sitenizi inceledim" cümlesi her durumda mümkün.
2. **`chainDetected` parametresi**: Round 1 P0.5'te paket selector'a iletildi, opener'a iletilmedi.
3. **TR style rules**: "devrik cümle yapma", "uzun mid-clause noun phrase yapma", "boyut=3 cümle ama her cümle ≤25 kelime" eksik.

### 2.3 §3.10 review language zinciri

```
[lead.googleReviews] (review-analyst.ts:42-53)  ←── pre-LLM dil filtresi YOK
        │
        ▼
analyzeReviewsWithGemini({  reviews: [...], workspaceNiche, ourOffer })
        │
        ▼
buildReviewAnalysisPrompt({ labelEnum })  (review-analysis-prompt.ts:73-137)
        │  System context line 58: "Default output language is English"
        │  examples[] için language kuralı YOK
        ▼
Gemini gemini-2.5-flash, temperature 0.3 (gemini.ts:759)
responseSchema (gemini.ts:761-849)
        │  examples: { type: ARRAY, items: STRING } — language constraint YOK
        ▼
output: weaknessKpis/strengthKpis with verbatim Italian/Spanish/French quotes
        │
        ▼
filterReviewKpis(kpis, poolCount, corpusNormalized)  (kpi-filter.ts:71-108)
        │  isGroundedInCorpus tüm dilleri kabul ediyor
        │  ↳ İtalyanca string corpus'ta gerçekten var → grounded → KPI persist ✅
        ▼
ReviewAnalysis.weaknessKpis.examples → UI gözükür (rapor §3.10)
```

**Kayıp sinyal noktası:** Hem prompt-level (instruction) hem schema-level (no enum), hem post-processing (no language gate) — üçü birden boş. tinyld/franc/cld3 gibi bir runtime detector zincirde yok.

### 2.4 §4.2 hallucinated snippet zinciri

```
[lead.googleReviews ≥1] → analyzeReviewsWithGemini
        │
        ▼
Gemini, responseSchema (gemini.ts:766-790)
        │  weaknessKpis.label: STRING (free-form for non-FNB) | ENUM (FNB)
        │  examples: STRING[]
        │  ↳ NO constraint: "label MUST NOT equal any examples[i]"
        │  ↳ NO constraint: "label MUST NOT contain '&' or 'and'"
        ▼
Gemini output (rapor §4.2):
        YBA: { label: "Automatic tip request", examples: ["automatic tip request"] }
        S.O.S: { label: "Expensive", examples: ["£7.10"] }
        The Drip: { label: "Rude Staff & Toilet Access", examples: [...] }
        │
        ▼
filterReviewKpis  (kpi-filter.ts)
        │  groundedExamples.length < 2 → drop  ✅ (1-örnek S.O.S BURADA dropped olmalı?)
        │  count < 2 → drop                    ✅
        │  ❌ label == any(example) check YOK
        │  ❌ label fusion (&, and, /) check YOK
        │  ❌ "£7.10" gibi 1-2 token examples isGroundedInCorpus early-exit dalına
        │     giriyor (line 54: tokens.length <= 2 → corpus.includes(tokens.join(" ")))
        │     → "7 10" pattern'ı iki rakamlı her review'da yanlışlıkla match olabilir
        ▼
ReviewAnalysis.weaknessKpis persist
```

**Kayıp sinyal noktaları:**
1. **Schema-level `label != any(example)` constraint** — responseSchema'ya eklenmesi imkansız (Gemini schema constraint expression desteklemiyor). Post-process gate gerek.
2. **Min token count for examples** — `kpi-filter.ts:54` `tokens.length <= 2` early-exit: tek kelime/rakam örnekler grounded sayılıyor. Eşik en az 3 token olmalı (zaten ana yol 3-token sliding window).
3. **Label fusion check** — `&` / `and` / ` / ` içeren label'lar fusion sinyali; ya whitelist enum'a sıkı bağla (FNB için zaten yapıyor), ya post-process'te split + percent re-attribution.

### 2.5 §4.3 premium-default zinciri

```
[lead] → scorer.ts:103-107  ←── lead.hasWebsite ALINMIYOR
        │
        ▼
selectPackage({
  reviewCount,                ← OK
  rating,                     ← informational only (line 53)
  hasMultipleLocations,       ← from chain_detected ✅
  isHotel,                    ← from sub-niche / primaryType ✅
  servicePackages,
  painPointCount: analysis.likely_pain_points.length  ←── unfiltered
})
        │
        ▼
package-selector.ts:81-114 decision tree:
        if isHotel || hasMultipleLocations → enterprise   ← Black Sheep ✅
        else if painPointCount >= 2 || reviewCount > 300 → premium
                ↳ Gemini her zaman 4-5 pain bastığı için painPointCount >= 2 ASLA false olmuyor
                ↳ One Shot 500 reviews → premium (kural doğru ama tester base diyor)
        else → base                                       ← gerçekleşmiyor
```

**Kayıp sinyal noktaları:**
1. **`hasWebsite=false` STARTER zorlaması yok** — One Shot, S.O.S, The Drip, Il botanico (4 vaka) site yok ama Premium aldı.
2. **`reviewCount` floor for premium yok** — S.O.S 14 review premium aldı.
3. **`painPointCount` confirmed/unconfirmed ayrımı yok** — Round 1 P1.5'teki `confirmedPainPoints` whitelist'i opener'a inject edildi ama selector'a inject edilmedi.
4. **`crawlError="WEBSITE_EXPIRED"` dispatch yok** — Fable and Falcon 34 review + expired site = downgrade signal değil.

### 2.6 §4.4 small-sample zinciri

```
[lead.googleReviews (count=14)] → review-analyst → analyzeReviewsWithGemini
        │
        ▼
Prompt rule line 128: "reviewsAnalyzedCount < 10 → max 2 weaknessKpis, max 3 strengthKpis"
        │  Eşik 10 — S.O.S 14 ile bypass
        ▼
Gemini output:
        S.O.S: { label: "Expensive", count: 2, percent: 100 }
        Camden: 3× weakness label hepsi 100%
        │
        ▼
filterReviewKpis (kpi-filter.ts):
        count < 2 → drop  ←── Gemini count=2 verirse pass
        groundedExamples.length < 2 → drop  ←── Gemini iki örnek verir, ikisi de grounded ise pass
        truePercent = round(count/poolCount * 100)
                ↳ poolCount=1 (negative review), count=2 → 200% → clamp 100%  ❌
                ↳ poolCount=0 → 0%  (line 97 guard)
        │
        ▼
KPI persists → UI: "Expensive 100% (2 of 14)"  — istatistiksel olarak yanıltıcı
```

**Kayıp sinyal noktaları:**
1. **`negativePoolCount` floor yok** — pool < 3 ise weakness KPI sıfır olmalı (yetersiz kanıt).
2. **`count > poolCount` impossibility check yok** — count poolCount'tan büyük olamaz; prompt rule'u `percent = count/pool*100` der ama Gemini count'u >poolCount yapıp kendini çelişiyor; kpi-filter clamp yapıyor ama drop yapmıyor.
3. **Small-sample threshold eşiği 10 yerine 20** — UK industry norm: opinion polling'de n=20 minimum. Sub-niche-bazlı override gerek (chain için n=50 vs single-shop için n=15).

---

## 3. Fix Önerisi

Her sorun için **(a)** prompt değişikliği (tam yeni metin), **(b)** code değişikliği (parametre/schema/post-processing) ve **(c)** niche pack ekleri.

### 3.1 §3.7 Chain blindness fix

#### (a) Prompt değişikliği — `gemini.ts:buildAnalysisPrompt`

`isRestaurant` branch'inden sonra, `industryContext` formula'sına chain branch ekle:

```ts
// new param: chainDetected: boolean (passed from scorer.ts)
const chainContextBlock = chainDetected
  ? `

CHAIN CONTEXT (HARD CONSTRAINT):
This business is part of a multi-location chain. Before listing pain points
about missing digital infrastructure, assume the chain may already operate
the following CENTRALLY through their main brand app or website:
- Order-ahead / pickup
- Loyalty / stamps
- QR-to-order
- Brand-level CRM
ONLY list a feature as missing if you have explicit evidence from THIS
LOCATION's sub-page text or from a review quote. If website features
JSON is empty for this location's page, do NOT assume the chain lacks
those features overall — assume they live on the chain root domain
(e.g. \`brand.com/order\`) which we have not crawled yet.

For chain leads, the BEST sales angle is operational consistency,
multi-property analytics, group-level CRM rollup, or per-store reporting
— NOT location-level QR / order-ahead / loyalty (the chain already
solved those at HQ).`
  : "";
```

Yerleşim: `gemini.ts:291` `industryContext` template literal'ında, `${painPointsLine}` sonrası.

#### (b) Code değişikliği

**File: `src/lib/agent-workers/sales-opportunity-scorer.ts`**

Mevcut `chain_detected`'ı analiz çıktısından okuma sırası **yanlış** (post-hoc). İki seçenek:

- **Seçenek 1 (önerilen):** `chain_detected`'ı pre-LLM heuristic olarak hesapla, prompt'a inject et:
  - Heuristic: `lead.businessName` veya `lead.websiteUrl` `niches/index.ts.fnb-cafe-bakery.knownChains` whitelist'iyle eşleşiyor mu? + `lead.placesPhotos.length > 5` gibi audit signal'ler.
  - `analyzeLeadWithGemini(..., { chainDetected: heuristic })` parametresi eklenir.
- **Seçenek 2 (lazy):** İki-pass: ilk pass'te chain_detected'ı al, ikinci pass'te chain context'iyle yeniden çağır. Token maliyeti 2×.

**Tercih:** Seçenek 1. Heuristic detector → §8'deki "Hardcoded chain list v1" alternatifi.

**File: `src/lib/gemini.ts`**

`AnalysisWorkspaceContext`'e `chainDetected: boolean | null` ekle. `buildAnalysisPrompt` imzasına aynı parametre. Default `null` (bilinmiyor) — false ile null farkı önemli: "kesinlikle chain değil" demiyoruz, "henüz tespit edilmedi" diyoruz.

#### (c) Niche pack eki — `niches/index.ts:fnb-cafe-bakery`

```ts
{
  slug: "fnb-cafe-bakery",
  // ... mevcut field'lar
  chainConsiderations: {
    // Tipik UK/global zincirlerin chain root'larında zaten merkezi
    // çalıştığı varsayılan modüller. Opener prompt + analiz prompt
    // bu listeyi "chain için pitch ETME" olarak okur.
    likelyCentralizedAtChainRoot: [
      "Order-ahead",
      "QR-to-order",
      "Loyalty stamps / programı",
      "Brand-level CRM",
      "Mobile app / kiosk",
    ],
    // Tester'ın §8.2'de istediği — chain'lerin Enterprise pitch'i için
    // pivot edilecek modüller. likelyCentralizedAtChainRoot'tan FARKLI.
    chainEnterprisePitchModules: [
      "Multi-property analytics console",
      "Group-level reporting & rollup",
      "Cross-store inventory sync",
      "HQ-to-store menu propagation",
      "Centralised tip pool reporting",
    ],
    // İlk yamada hardcoded — büyütmek için ayrı bir KB doc'u veya
    // CHAIN_ROOT_AUDITOR worker (P2).
    knownChainsByName: [
      "Blank Street",
      "Black Sheep Coffee",
      "Caffè Nero",
      "Pret a Manger",
      "Costa Coffee",
      "Starbucks",
      "WatchHouse",
      "Joe & The Juice",
    ],
  },
}
```

#### Effort + risk

| Madde | Effort | Risk |
|---|---|---|
| Prompt değişikliği + AnalysisWorkspaceContext `chainDetected` | 4 saat | Düşük — schema-additive |
| Heuristic chain detector + niche pack `knownChainsByName` | 4 saat | Orta — false-positive ("Sheep & Wolf" small shop'lara çarparsa) |
| Niche pack `chainConsiderations` + opener prompt enforce | 3 saat | Düşük |

#### Test stratejisi (golden fixture)

- `src/__tests__/agent-workers/sales-opportunity-scorer.chain.test.ts` — fixture: Black Sheep DB row clone + heuristic detector ON + assert `pain_points` `["QR'dan sipariş…", "Order-ahead eksikliği"]` İÇERMİYOR; assert pain_points `["multi-property analytics", "store-by-store reporting"]` benzeri ifadeler İÇERİYOR.
- `src/__tests__/agent-workers/opener-writer.chain.test.ts` — fixture: Black Sheep + chainDetected=true → opener output `notApplicableModulesForChain` listesindeki herhangi bir kelimeyi içermemeli (regex assert).
- Vitest: model output yerine schema-level assertion kullan (skill rule 7).

---

### 3.2 §3.8 Personalized message bağlam ihlali fix

#### (a) Prompt değişikliği — `opener-writer.ts:buildOpenerPrompt`

Yeni `websiteContext` parametre block'u ve koşullu açılış kuralları ekle:

```ts
// new param appended to buildOpenerPrompt input interface:
websiteContext: {
  status: "NO_WEBSITE" | "CRAWLED" | "FAILED" | "UNREACHABLE";
  audit: {
    reachable: boolean;
    httpStatus: number | null;
    title: string | null;
    crawlError:
      | "SOCIAL_MEDIA_ONLY"
      | "WEBSITE_EXPIRED"
      | "WEBSITE_PARKED"
      | "BLOCKED_BY_GUARD"
      | "SSL_INVALID"
      | "UNKNOWN"
      | null;
    socialPlatform: "instagram" | "facebook" | "tiktok" | "linkedin" | null;
  } | null;
} | null;
isChain: boolean;
```

Prompt rules block'una (line 461-485) yeni koşullu kurallar:

```
- Website context kuralları (websiteContext'e göre AÇILIŞ cümlesini ayarla):
  • status === "NO_WEBSITE" + socialPlatform set:
    Açılış: "{businessName}'in {socialPlatform} sayfasını hızlıca inceledim …"
    YASAK: "sitenizi inceledim", "websitenizi gördüm"
  • crawlError === "WEBSITE_EXPIRED" OR audit.title contains "Website Expired"
    OR httpStatus === 404:
    Açılış: "{businessName} domaininin şu an expired durumda olduğunu fark ettim — bu, dijital yatırım için tam zamanlama …"
    YASAK: "sitenizi inceledim"
  • crawlError === "BLOCKED_BY_GUARD":
    Açılış: "{businessName}'i araştırırken …" (site içeriğinden bahsetme)
  • crawlError === null + reachable === true:
    Mevcut "sitenizi hızla incelediğimde" pattern'i kullanılabilir
- Chain kuralı (isChain=true):
  • Açılış chain-aware: "Black Sheep Coffee gibi multi-location bir markanın merkezi yönetiminde {pivotPainPoint}"
  • YASAK: tek-şube pain'leri (QR'dan sipariş, order-ahead, loyalty) — niche pack
    chainConsiderations.likelyCentralizedAtChainRoot listesi.
- TR style kuralları (language === "tr"):
  • Devrik cümle yapma (özne fiilden önce)
  • Mid-clause noun phrase 5 kelimeyi geçmesin
  • Tek cümlede 25 kelimeyi aşma
  • Pasif yapı kullanma; aktif fiil tercih
```

**Tam prompt rules block'u (TR varyantı, mevcut + yeni):**

```ts
const trRules = [
  "- Kurallar:",
  "- Maksimum 3 cumle.",
  "- Her cumle 25 kelimeyi gecmesin.",
  "- Aktif fiil kullan; pasif yapidan kac.",
  "- Devrik cumle YASAK (ozne fiilden once gelsin).",
  "- Mid-clause noun phrase 5 kelimeyi gecmesin (ornegin 'sabah yogunluklarinizdaki QR'dan siparis sistemiyle siparis alma surecinizi' yerine 'sabah yogunluklarinda QR'dan siparis sistemini').",
  "- Ilk cumle spesifik bir gozlem icermeli (isletme hakkinda kisisel bir detay).",
  "- Satis tonundan kac; yardimci bir komsunun tonu.",
  "- Asla 'umarim iyi gunlerindesin' / 'umarim bu mesaj sizi iyi bulur' gibi klise acilis yapma.",
  ...(websiteContextRule ? [websiteContextRule] : []),
  ...(chainRule ? [chainRule] : []),
  ...(notApplicableRule ? [notApplicableRule] : []),
  ...(painWhitelistRule ? [painWhitelistRule] : []),
  ...(missingFeatureRule ? [missingFeatureRule] : []),
  ...(mockupRule ? [mockupRule] : []),
  "- Sonda CTA yerine hafif bir soru sor.",
].join("\n");
```

#### (b) Code değişikliği

**File: `src/lib/agent-workers/opener-writer.ts`**

`buildOpenerPrompt` çağrı sitesi (line 200-249) `websiteContext` ve `isChain` parametreleri ekleyecek:

```ts
// Helper — opener-writer.ts üst seviyesinde:
function detectSocialPlatform(url: string | null): "instagram"|"facebook"|"tiktok"|"linkedin"|null {
  if (!url) return null;
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.com/i.test(url)) return "facebook";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/linkedin\.com/i.test(url)) return "linkedin";
  return null;
}

// run() içinde, audit'i lead include ile çek (lead.websiteAudit zaten var):
const websiteContext = {
  status: lead.crawlStatus,
  audit: lead.websiteAudit ? {
    reachable: lead.websiteAudit.reachable,
    httpStatus: lead.websiteAudit.httpStatus,
    title: lead.websiteAudit.title,
    crawlError: lead.websiteAudit.crawlError,
    socialPlatform: detectSocialPlatform(lead.websiteAudit.url),
  } : null,
};
const isChain = opp?.reasonCodes?.includes("chain_detected") ?? false;
```

**`temperature` ayarı:** Mevcut 0.7 (line 255) — voice rules için doğru aralık (skill rule 2). Devrik cümle fix'i sadece prompt rule olarak yeterli; temperature düşürmek (0.5) loyalty/voice'i da düşürür → DEĞİŞTİRME.

#### (c) Niche pack eki — `niches/index.ts:NichePack` interface'i + fnb-cafe-bakery

```ts
export interface NichePack {
  // ... mevcut field'lar
  notApplicableModulesForChain?: string[];  // YENI — Round 2 §3.8 fix
}

// fnb-cafe-bakery pack'inde:
notApplicableModulesForChain: [
  "QR Mobile Pay (order-ahead)",  // chain app'te zaten var
  "In-App Promotions",             // brand-level loyalty zaten var
  "Restaurant CRM (loyalty)",      // chain HQ owns this
  "Like & Comment",                // brand-level zaten var
  // Smart Recommendations kalsın — multi-property için pivot pitch
],
```

`opener-writer.ts:227-232` `nicheNotApplicableModules` deduped set:

```ts
nicheNotApplicableModules: Array.from(
  new Set([
    ...(activePack?.notApplicableModules ?? []),
    ...altPacks.flatMap((p) => p.notApplicableModules ?? []),
    // YENI — chain ise additionally suppress:
    ...(isChain ? (activePack?.notApplicableModulesForChain ?? []) : []),
  ]),
),
```

#### Effort + risk

| Madde | Effort | Risk |
|---|---|---|
| `buildOpenerPrompt` imza + websiteContext + isChain inject | 4 saat | Düşük — backwards-compatible default param |
| Yeni prompt rules block'u (TR + EN) + websiteContextRule helper | 4 saat | Orta — yeni branch'ler regression test gerek |
| `niches/index.ts` `notApplicableModulesForChain` field + fnb-cafe-bakery doldurma | 2 saat | Düşük |
| `crawl_error="WEBSITE_EXPIRED"` taxonomy expansion | A2'ye dependency (bkz §5) | A2-blocked |

#### Test stratejisi (golden fixture)

- `src/__tests__/agent-workers/opener-writer.fixtures/` → 4 fixture JSON:
  - `expired-site.json` (Fable and Falcon clone): assert opener "expired", "domain", "yatırım" geçiyor; "sitenizi inceledim" geçmiyor.
  - `social-only.json` (One Shot Coffee): assert "Facebook sayfanızı" geçiyor; "websitenizi" geçmiyor.
  - `chain-blind.json` (Black Sheep): assert "QR'dan sipariş" + "loyalty" + "order-ahead" GEÇMİYOR; "multi-property" / "merkez" / "rollup" GEÇİYOR.
  - `tr-devrik.json` (Coffee Couch): assert tüm cümleler subject-verb-object düzeninde (basit regex: cümle ilk 5 kelimesi içinde fiil çekimi).
- Vitest pin: `gemini-2.5-flash` (skill rule 7).

---

### 3.3 §3.10 Non-English review leakage fix

#### (a) Prompt değişikliği — `review-analysis-prompt.ts`

Yeni hard rule `Rules:` listesinin altına:

```
- LANGUAGE CONSTRAINT (HARD): All `examples[]` strings MUST be in English. If the
  source review is in another language:
    1. Either translate to English in [brackets] (e.g. ["[the staff was unfriendly]"]),
    2. OR exclude that review from the `examples[]` entirely.
  Aggregate non-English reviews into the `count` field if the complaint matches the
  cluster, but NEVER quote the foreign-language text directly.
- Foreign-language detection: if a review uses non-Latin characters (Cyrillic,
  Arabic, Hangul) or contains diacritic-heavy words common in romance languages
  (à, è, ò, ñ, ç, ô) AND the review is NOT in {target_language}, treat it as
  non-English.
```

`{target_language}` placeholder eklenir; default `"English"`. FineDine için workspace `language=tr` olsa bile target review language `en` (ICP UK) — workspace-level `targetReviewLanguages: string[]` field'ı ile override.

#### (b) Code değişikliği

**File: `src/lib/agent-workers/review-analyst.ts`**

Pre-LLM language filter (kütüphane karşılaştırması §9'da):

```ts
// NEW import
import { detectAll } from "tinyld";  // §9 önerisi

// run() içinde, gemini'ye besleme öncesinde:
const targetLangs = (lead.workspace as any).targetReviewLanguages
  ?? ["en"];  // FineDine default — UK/EN ICP

const reviews = lead.googleReviews;
const reviewsWithLang = reviews.map((r) => {
  const text = r.text ?? "";
  if (text.length < 10) return { ...r, _lang: null, _confidence: 0 };
  const detected = detectAll(text);
  const top = detected[0];
  return {
    ...r,
    _lang: top?.lang ?? null,
    _confidence: top?.accuracy ?? 0,
  };
});

const matchingLang = reviewsWithLang.filter(
  (r) => r._lang && targetLangs.includes(r._lang) && r._confidence > 0.6,
);
const ambiguousLang = reviewsWithLang.filter(
  (r) => !r._lang || r._confidence <= 0.6,
);
const nonMatching = reviewsWithLang.filter(
  (r) => r._lang && !targetLangs.includes(r._lang) && r._confidence > 0.6,
);

// Strategy: pass matching + ambiguous to LLM (ambiguous için language constraint
// rule prompt'ta filtreler). Non-matching tamamen drop. Eğer matching < 5 AND
// total >= 10, filter'ı bypass'la (yetersiz dil hedefli olamaz, fall-back).
let filtered = matchingLang.length >= 5 || reviews.length < 10
  ? [...matchingLang, ...ambiguousLang]
  : reviews;

logger.info("agent_workers.review_analyst.language_filter", {
  leadId,
  total: reviews.length,
  matching: matchingLang.length,
  ambiguous: ambiguousLang.length,
  nonMatching: nonMatching.length,
  filterApplied: filtered.length !== reviews.length,
  targetLangs,
});

// then pass `filtered` instead of lead.googleReviews to analyzeReviewsWithGemini
```

**Schema-level constraint** (Gemini schema'sının limitleri burada): `examples[]` üyelerinin language constraint'i schema'da ifade edilemez. Post-process gate eklenmeli (`kpi-filter.ts`):

```ts
// new helper — kpi-filter.ts
function isExampleInTargetLanguage(
  text: string,
  targetLangs: string[],
): boolean {
  if (text.length < 5) return true;  // çok kısa — pas geç
  if (text.startsWith("[") && text.endsWith("]")) return true;  // [translated]
  const detected = detectAll(text);
  return detected.length === 0 ||
    (detected[0].accuracy > 0.6 && targetLangs.includes(detected[0].lang));
}

// filterReviewKpis çağrısına targetLangs parametresi eklenip her example
// için bu check uygulanır.
```

**File: `src/lib/prompts/review-analysis-prompt.ts`**

Prompt template'a `{target_language}` placeholder ekle, `analyzeReviewsWithGemini` çağrı sitesinden inject:

```ts
const targetLangsLabel = targetLangs.map(toLanguageName).join(" or ");  // "English"
const promptBody = REVIEW_ANALYSIS_PROMPT_TEMPLATE
  .replace("{target_language}", targetLangsLabel)
  // ... mevcut replacements
```

#### (c) Workspace schema eki

`prisma/schema.prisma` `Workspace` model:

```prisma
targetReviewLanguages String[] @default(["en"]) @map("target_review_languages")
```

`db:push` sonrası generate. UI tarafında Settings → "Review analiz hedef dilleri" multi-select.

#### Effort + risk

| Madde | Effort | Risk |
|---|---|---|
| Pre-LLM tinyld filter + workspace `targetReviewLanguages` | 5 saat | Orta — kütüphane false-positive (kısa İngilizce yorumlar İtalyanca etiketlenebilir) |
| Prompt language constraint rule | 1 saat | Düşük |
| Post-process `isExampleInTargetLanguage` gate | 2 saat | Düşük |
| Schema migration + UI multi-select | 3 saat | Düşük |

#### Test stratejisi

- `src/__tests__/review-analysis/language-filter.test.ts`:
  - Camden Roastery clone: 50 review (English-dominant + 4 Hollandaca + 2 Fransızca). Assert non-Eng quotes `examples[]`'de değil; sentiment breakdown 50 üzerinden hesaplanmış.
  - Il botanico clone: 50 review (40 İtalyanca + 10 İngilizce). Assert filter "matching < 5 AND total >= 10" guard'ı tetiklemiyor (matching=10 ≥ 5); assert İtalyanca quotes drop.
  - Edge: 8 review hepsi İtalyanca → fallback bypass (matching < 5 + total < 10 → tüm review'lar geçer; sonuç düşük leadScore + uyarı).

---

### 3.4 §4.2 Hallucinated review snippets fix

#### (a) Prompt değişikliği — `review-analysis-prompt.ts`

Mevcut Rules listesine ekle:

```
- LABEL ≠ EXAMPLE: The KPI label MUST be a SHORT NOUN PHRASE that summarises
  the cluster. None of the strings in `examples[]` may be IDENTICAL to the label
  (case-insensitive, after trimming). If the only "example" you can think of is
  literally the label itself, the cluster is fabricated — DROP it.
- LABEL FUSION FORBIDDEN: A label MUST describe ONE complaint. Do NOT use "&",
  "and", "/", or "+" to merge two distinct complaints (e.g. "Rude Staff &
  Toilet Access" — that's two clusters: "Rude Staff" and "Toilet Access"; emit
  them separately or omit the weaker one).
- EXAMPLE LENGTH FLOOR: Each `examples[i]` MUST contain ≥ 4 words from the
  source review (use sentence-level fragments, not single words or numbers).
  Single-word examples like "expensive", "rude", "£7.10" are FORBIDDEN.
```

#### (b) Code değişikliği

**File: `src/lib/review-analysis/kpi-filter.ts`**

`filterReviewKpis` içine üç yeni gate:

```ts
function isLabelEchoExample(
  label: string,
  example: string,
): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return norm(label) === norm(example);
}

function isLabelFusion(label: string): boolean {
  return /\s+(?:&|and|\/|\+)\s+/i.test(label);
}

function isExampleTooShort(example: string): boolean {
  const tokens = example.split(/\s+/).filter(Boolean);
  return tokens.length < 4;
}

// filterReviewKpis loop içinde, mevcut grounding check'ten ÖNCE:
if (isLabelFusion(k.label)) {
  stats.droppedForLabelFusion = (stats.droppedForLabelFusion ?? 0) + 1;
  continue;
}
const filteredExamples = (k.examples ?? []).filter(
  (e): e is string => typeof e === "string"
    && !isLabelEchoExample(k.label, e)
    && !isExampleTooShort(e)
    && isGroundedInCorpus(e, corpusNormalized),
);
if (filteredExamples.length < 2) {
  stats.droppedForUngroundedExamples += 1;
  continue;
}
```

`isGroundedInCorpus` `tokens.length <= 2` early-exit dalı (line 54-56) zayıf — kaldır:

```ts
export function isGroundedInCorpus(phrase: string, corpus: string[]): boolean {
  const tokens = normalizeForGrounding(phrase).split(" ").filter(Boolean);
  if (tokens.length < 3) return false;  // ←── DEĞİŞTİ — eski: tokens.length <= 2 → corpus.includes single token
  for (let i = 0; i <= tokens.length - 3; i++) {
    const window = tokens.slice(i, i + 3).join(" ");
    if (corpus.some((c) => c.includes(window))) return true;
  }
  return false;
}
```

#### (c) Niche pack — yok (FNB label whitelist'i `fnb-review-labels.ts`'te zaten var; oraya bir `disallowedFusionLabels` lint pass eklenir, ama kod tarafı yeterli).

#### Effort + risk

| Madde | Effort | Risk |
|---|---|---|
| 3 yeni gate + isGroundedInCorpus tightening | 3 saat | Orta — mevcut whitelist'lerin "& Toilet Access" tarzı entry yokluğu doğrulanmalı |
| Prompt rule eklemeleri | 1 saat | Düşük |
| Schema-level: stat field'ları (telemetri için) | 1 saat | Düşük |

#### Test stratejisi

- `src/__tests__/review-analysis/kpi-filter.test.ts` — yeni 3 fixture:
  - `label-echo.json`: `{label:"Automatic tip request", examples:["automatic tip request","..."]}` → assert dropped, stats.labelEcho=1.
  - `fusion-label.json`: `{label:"Rude Staff & Toilet Access", examples:[...]}` → assert dropped.
  - `tiny-example.json`: `{label:"Expensive", examples:["£7.10","cheap"]}` → assert dropped (her iki örnek <4 word).

---

### 3.5 §4.3 Deterministic package selector recalibration

(Decision matrix detayı §7'de.)

#### (a) Prompt değişikliği — yok

`recommended_package_id` **already** Gemini'den okunmuyor (`gemini.ts:399-405` "we silently ignore it"). Tüm karar `package-selector.ts`'te.

#### (b) Code değişikliği — `package-selector.ts`

Yeni input'lar: `hasWebsite`, `crawlStatus`, `crawlError`, `confirmedPainPointCount`, `niche`. Yeni karar tree §7'de.

```ts
export interface PackageSelectorInput {
  reviewCount: number;
  rating: number;
  hasMultipleLocations: boolean;
  isHotel: boolean;
  // YENİ:
  hasWebsite: boolean;
  crawlStatus: "NEW" | "CRAWLED" | "NO_WEBSITE" | "FAILED";
  crawlError: string | null;
  /** confirmedPainPoints from LEAD_INTELLIGENCE_BRIEF (length). Düşer 0
      olduğunda likely_pain_points'e fallback YAPILMAZ — tier yine düşer. */
  confirmedPainPointCount: number;
  /** Niche slug — fnb-fine-dining vs fnb-cafe-bakery vs fnb-bar-club kararı etkiler */
  nicheSlug: string | null;
  servicePackages: PackageSelectorPackage[];
  /** Legacy fallback — confirmedPainPointCount=0 ise bu kullanılır (geçici). */
  painPointCount: number;
}
```

`scorer.ts:273-289` çağrı sitesi:

```ts
// Read brief output for confirmedPainPoints
const briefRun = await prisma.agentRun.findFirst({
  where: { leadId, workerKind: "LEAD_INTELLIGENCE_BRIEF",
           status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] } },
  orderBy: { finishedAt: "desc" },
  select: { outputJson: true },
});
const briefOutput = (briefRun?.outputJson ?? null) as { confirmedPainPoints?: string[] } | null;
const confirmedPainPointCount = (briefOutput?.confirmedPainPoints ?? []).length;

const packageSelection = selectPackage({
  reviewCount: lead.reviewCount ?? 0,
  rating: lead.rating ?? 0,
  hasMultipleLocations,
  isHotel: isHotelByNiche || isHotelByPrimaryType,
  hasWebsite: lead.hasWebsite,
  crawlStatus: lead.crawlStatus,
  crawlError: lead.websiteAudit?.crawlError ?? null,
  confirmedPainPointCount,
  nicheSlug: lead.subNicheSlug,
  servicePackages: servicePackages.map((p, idx) => ({...})),
  painPointCount,
});
```

#### (c) Niche pack — yok

#### Effort + risk

| Madde | Effort | Risk |
|---|---|---|
| `selectPackage` decision tree expansion (§7 matrix) | 4 saat | Orta — mevcut beta golden test'leri (4×Base / 2×Premium kabul) güncellenmeli |
| `scorer.ts` brief read + parametre passing | 2 saat | Düşük |
| Schema migration: `package-selector.test.ts` 12 yeni fixture (Round 2 12 lead) | 3 saat | Düşük |

#### Test stratejisi

- `src/__tests__/agent-workers/package-selector.test.ts` — Round 2 12 lead için fixture:
  - Black Sheep (chain) → Enterprise ✅ (mevcut)
  - Blank Street (chain) → Enterprise ✅
  - One Shot (500 review, no website) → STARTER ✅ (yeni)
  - LUMI Camden (2505 review) → Premium ✅
  - Camden Roastery (799 review) → Premium ✅
  - Glass Coffee (662 review) → Premium ✅
  - The Drip (170 review, no audit) → STARTER ✅ (yeni — confirmedPainPoints=0)
  - S.O.S Coffee (14 review, no audit) → STARTER ✅ (yeni)
  - Il botanico (335 review, null website) → STARTER ✅ (yeni)
  - Coffee Couch (337 review, Instagram-only) → STARTER ✅ (yeni)
  - Fable and Falcon (34 review, expired site) → STARTER ✅ (yeni)
  - YBA Brazil (81 review, Instagram-only) → STARTER ✅ (yeni)

---

### 3.6 §4.4 Small-sample patlaması fix

#### (a) Prompt değişikliği — `review-analysis-prompt.ts`

Mevcut "When reviewsAnalyzedCount < 10" kuralını sıkılaştır:

```
- SAMPLE FLOOR (HARD): If reviewsAnalyzedCount < 20, return AT MOST 1 weaknessKpi
  AND AT MOST 2 strengthKpis. Below 10, return 0 weaknessKpis (one anecdote is
  not a pattern); 1 strengthKpi maximum.
- NEGATIVE POOL FLOOR: A weaknessKpi requires AT LEAST 3 distinct negative
  reviews (rating ≤ 2) in the sample. If fewer, weaknessKpis MUST be empty.
- POSITIVE POOL FLOOR: A strengthKpi requires AT LEAST 5 distinct positive
  reviews (rating ≥ 4). If fewer, strengthKpis MUST be empty.
- COUNT INTEGRITY: `count` MUST be ≤ the size of the relevant pool
  (negativePool for weakness, positivePool for strength). If you cannot find
  count distinct reviews, lower the count or drop the cluster.
```

`{negative_pool_count}` ve `{positive_pool_count}` placeholder'lar prompt body'ye inject (caller hesaplar):

```
Negative pool size (rating ≤ 2): {negative_pool_count} reviews
Positive pool size (rating ≥ 4): {positive_pool_count} reviews
```

#### (b) Code değişikliği

**File: `src/lib/review-analysis/kpi-filter.ts`**

Pool floor gates:

```ts
export function filterReviewKpis(
  kpis: ReviewKpi[],
  poolCount: number,
  corpusNormalized: string[],
  opts?: { kind: "weakness" | "strength" },
): { kpis: ReviewKpi[]; stats: KpiFilterStats } {
  // YENİ — pool floor:
  const POOL_FLOOR = opts?.kind === "weakness" ? 3 : 5;
  if (poolCount < POOL_FLOOR) {
    return {
      kpis: [],
      stats: {
        inCount: kpis.length, outCount: 0,
        droppedForLowCount: kpis.length,
        droppedForUngroundedExamples: 0,
        droppedForPoolFloor: kpis.length,
      },
    };
  }
  // ... mevcut loop
  // YENİ count integrity:
  if ((k.count ?? 0) > poolCount) {
    // Gemini hallucinated count > pool size — DROP entirely instead of clamp
    stats.droppedForCountInflation = (stats.droppedForCountInflation ?? 0) + 1;
    continue;
  }
  // ... mevcut percent re-derive
}
```

**File: `src/lib/agent-workers/review-analyst.ts`**

`opts.kind` parametresini `filterReviewKpis` çağrısına ekle:

```ts
const weaknessFiltered = filterReviewKpis(
  analysis.weaknessKpis, negativePoolCount, corpusNormalized,
  { kind: "weakness" },
);
const strengthFiltered = filterReviewKpis(
  analysis.strengthKpis, positivePoolCount, corpusNormalized,
  { kind: "strength" },
);
```

**File: `src/lib/gemini.ts:analyzeReviewsWithGemini`**

Pool count'ları prompt'a inject:

```ts
const negativePool = input.reviews.filter((r) => r.rating > 0 && r.rating <= 2).length;
const positivePool = input.reviews.filter((r) => r.rating >= 4).length;
const promptBody = builtPrompt
  .replace("{negative_pool_count}", String(negativePool))
  .replace("{positive_pool_count}", String(positivePool));
```

#### (c) Niche pack — yok

#### Effort + risk

| Madde | Effort | Risk |
|---|---|---|
| Pool floor gates + count integrity check | 3 saat | Düşük |
| Prompt pool-aware rules + placeholder injection | 2 saat | Düşük |
| Mevcut testlerin re-baseline (<10 review fixture'ları) | 2 saat | Düşük |

#### Test stratejisi

- `src/__tests__/review-analysis/small-sample.test.ts`:
  - S.O.S clone (14 review, 1 negative): assert weaknessKpis = `[]` (pool floor=3).
  - Coffee Couch clone (50 review, 1 negative): assert weaknessKpis = `[]`.
  - Camden Roastery clone (50 review, 2 negative): assert weaknessKpis ≤ 1 (pool floor 3 → boş).
  - Pied à Terre type (50 review, 8 negative): assert weaknessKpis 1-2 mevcut.

---

## 4. Effort + Risk Özeti

### P0 (acil prod fix, 7 gün)

| # | Bug | Effort | Risk | Önkoşul |
|---|---|---|---|---|
| P0-A | §4.4 Pool floor + count integrity (review-analyst) | 5 saat | Düşük | — |
| P0-B | §4.2 Label echo + fusion + tiny example gates | 4 saat | Orta | — |
| P0-C | §4.3 Package selector decision matrix expansion (§7) | 7 saat | Orta | brief'in `confirmedPainPoints` zaten ship |
| P0-D | §3.8 Opener websiteContext (status, social, opp/crawl_error) | 8 saat | Orta | A2 `crawl_error` taxonomy tested ship'i (bkz §5) |

**P0 toplam: 24 saat.**

### P1 (kalite + doğruluk, 14 gün)

| # | Bug | Effort | Risk | Önkoşul |
|---|---|---|---|---|
| P1-A | §3.7 Chain-aware prompt + niche pack `chainConsiderations` + heuristic detector | 11 saat | Orta-yüksek (heuristic FP) | — |
| P1-B | §3.10 Pre-LLM language filter + prompt rule + post-gate | 11 saat | Orta (kütüphane FP) | tinyld add (§9) |
| P1-C | §3.8 Chain rule opener prompt + notApplicableModulesForChain | 6 saat | Düşük | P1-A landed |
| P1-D | §3.8 TR style rules (devrik / pasif / mid-clause) | 4 saat | Düşük | — |

**P1 toplam: 32 saat.**

### P2 (uzun vadeli)

| # | Aksiyon | Effort |
|---|---|---|
| P2-A | `CHAIN_ROOT_AUDITOR` worker (§8 alternatif C) | 16 saat |
| P2-B | OPENER_SUCCESS memory seed plan (§10) | 6 saat |

---

## 5. Dependencies (A2 ile bağı)

§3.8 (B/A vakaları — "WEBSITE_EXPIRED", `crawlError` taxonomy genişlemesi) için **A2** (audit/crawler agent) önce ship olmalı:

| Field opener-writer'ın okuyacağı | Kaynak | A2'de eklenmesi gereken |
|---|---|---|
| `audit.crawlError === "WEBSITE_EXPIRED"` | `prisma.WebsiteAudit.crawlError` | A2 yeni `WEBSITE_EXPIRED` tag'i: title regex `/expired/i` veya http 404 + Squarespace pattern |
| `audit.crawlError === "WEBSITE_PARKED"` | aynı | GoDaddy/Sedo/Squarespace default şablon detection |
| `audit.crawlError === "BLOCKED_BY_GUARD"` | aynı | Cloudflare 403 / robots block detection |
| `audit.crawlError === "SSL_INVALID"` | aynı | TLS handshake failure tagging |
| `audit.httpStatus`, `audit.title` | A2'de zaten var | (no work needed) |
| `audit.url` (sosyal platform detection için) | A2'de zaten var | (no work needed) |

**Karar:** §3.8 P0-D fix'i A2'siz **kısmen** gönderilebilir:
- ✅ `crawlStatus="NO_WEBSITE"` + `socialPlatform` detection (One Shot Coffee Facebook) — A2 fix'i gerektirmiyor; mevcut `social-url-gate.ts` çıktıları yeterli.
- ❌ Fable and Falcon "WEBSITE_EXPIRED" — A2 önce ship olmalı.

**P0-D'yi 2 PR'a böl:**
- **P0-D.1** (A2-bağımsız): NO_WEBSITE + socialPlatform + isChain + TR style rules. Effort 5 saat. **Hemen ship.**
- **P0-D.2** (A2-bağımlı): WEBSITE_EXPIRED, WEBSITE_PARKED, BLOCKED_BY_GUARD, SSL_INVALID. Effort 3 saat. **A2 P1 sonrası.**

Diğer §3.7/§3.10/§4.x fix'leri A2-bağımsız.

---

## 6. Open Questions

1. **`chain_detected` heuristic threshold** — `niches/index.ts:knownChainsByName` whitelist + `lead.businessName.includes(name)` vs fuzzy match? "Black Sheep Coffee Camden" "Black Sheep" eşleşir; ya "Sheep & Wolf"? **Decision:** exact substring; whitelist'i 8 chain ile başlat, monthly review.
2. **`targetReviewLanguages` default** — Workspace `language=tr` olsa bile review dilleri `["en"]` mi default? FineDine için doğru, ama Türk pazarına satan bir workspace için yanlış. **Önerimiz:** `language=tr` + `niche=RESTAURANT_TECH` + lead'lerin %70+ UK borough'da ise `["en"]`; aksi halde `[language]`. Workspace migration default'u tartışılır.
3. **Pool floor 3 / 5 değerleri** — UK Polling Council'in n=20 floor'u var ama bu KPI bar değil, point estimate. Sample stat'ı için bootstrap CI hesaplamak overkill; 3 ve 5 ampirik beta data'sından (S.O.S 14 review pool=1 fail, Camden 50 review pool=2 fail). **Açık:** `negative_pool=2` durumu (Camden) hangi tier'da düşer? Şu an 3 floor → drop. Tester istemez mi? Round 3 tester check.
4. **`temperature` retune** — Skill rule 2'ye göre opener 0.7 doğru, scorer 0.1-0.3 olmalı. Mevcut scorer prompt'unun `temperature` ayarı yok (gemini.ts:577 default). **Karar:** ayrı PR'da, scorer için `0.2` set + retry-with-backoff ekle (skill rule 5).
5. **`responseSchema` migration** — KPI count integrity, label fusion gates schema-level mi, post-process mu? Gemini schema constraint expressions (XSD-style) desteklemiyor — post-process mecbur.
6. **OPENER_SUCCESS seed metadata** — Workspace=FineDine + niche=fnb-cafe-bakery scope'lu; ama tester yazımları "düzeltilmiş" örnekler, gerçek inbox-reply attestation değil. Dual write (child + parent niche) Round 1'de eklendi; hand-curated seed'leri "synthetic" flag'le ayrıştırmalı mı? **Bkz §10.**

---

## 7. Deterministic Package Selector Decision Matrix (§4.3)

### Inputs

```ts
interface DecisionInputs {
  reviewCount: number;             // 0+
  hasWebsite: boolean;             // lead.hasWebsite
  crawlStatus: CrawlStatus;        // "CRAWLED" | "NO_WEBSITE" | "FAILED" | "NEW"
  crawlError: string | null;       // "SOCIAL_MEDIA_ONLY" | "WEBSITE_EXPIRED" | ...
  hasMultipleLocations: boolean;   // chain_detected
  isHotel: boolean;                // niche === "fnb-hotel-restaurant"
  isFineDining: boolean;           // niche === "fnb-fine-dining"
  rating: number;                  // 0-5
  confirmedPainPointCount: number; // brief.confirmedPainPoints.length, fallback 0
  legacyPainPointCount: number;    // analysis.likely_pain_points.length (fallback only)
}
```

### Decision tree (deterministic, first-match-wins)

```
1. CHAIN / HOTEL / FINE-DINING (highest tier — operational complexity)
   IF hasMultipleLocations OR isHotel OR isFineDining:
     → ENTERPRISE
     reason: hasMultipleLocations ? "multi_location_chain"
           : isHotel ? "hotel_property"
           : "fine_dining_concierge"

2. NO-WEBSITE / EXPIRED / PARKED — strong DOWNGRADE signal
   IF !hasWebsite OR crawlStatus === "NO_WEBSITE"
   OR crawlError IN ("WEBSITE_EXPIRED", "WEBSITE_PARKED", "SOCIAL_MEDIA_ONLY"):
     → STARTER
     reason: !hasWebsite ? "no_first_party_site"
           : crawlError === "WEBSITE_EXPIRED" ? "expired_site_low_investment_signal"
           : crawlError === "WEBSITE_PARKED" ? "parked_site"
           : "social_only_presence"
     // Override: chain detected even without web → ENTERPRISE (rule 1 hit first)

3. SMALL-SCALE FLOOR — review-based downgrade
   IF reviewCount < 50:
     → STARTER
     reason: "small_scale_low_volume"
     // 50 review = ~6 months of foot traffic for a UK independent — below this
     // a Premium plan ($119/mo) cost-of-acquisition exceeds margin lift.

4. PREMIUM — high volume OR confirmed multi-pain
   IF reviewCount >= 300
   OR confirmedPainPointCount >= 2:
     → PREMIUM
     reason: confirmedPainPointCount >= 2 && reviewCount >= 300
       ? "high_volume_high_pain"
       : confirmedPainPointCount >= 2 ? "multiple_confirmed_pain_points"
       : "high_review_volume"

5. PREMIUM (legacy fallback) — confirmedPainPointCount=0 + 100-300 review
   IF reviewCount >= 100 AND legacyPainPointCount >= 3:
     → PREMIUM (with reason="legacy_pain_count_inferred", logged for audit)
   ELSE:
     → STARTER
     reason: "moderate_scale_no_confirmed_pain"
```

### Round 2 12 lead matrix (assertion table for tests)

| Lead | reviewCount | hasWebsite | chain | confirmedPP | Rule hit | Tier | Match? |
|---|---|---|---|---|---|---|---|
| One Shot Coffee | 500 | false (Facebook) | – | – | Rule 2 (no_first_party_site) | STARTER | ✅ Tester istedi |
| Glass Coffee | 662 | true | – | ≥ 2 | Rule 4 | PREMIUM | ✅ Tester onayladı |
| Il botanico | 335 | false (null) | – | – | Rule 2 | STARTER | ✅ Tester istedi |
| Coffee Couch | 337 | false (Instagram) | – | – | Rule 2 (social_only) | STARTER | ✅ Tester istedi |
| S.O.S Coffee | 14 | false (no audit) | – | – | Rule 2 OR Rule 3 | STARTER | ✅ Tester istedi |
| Fable and Falcon | 34 | false (expired) | – | – | Rule 2 (expired) | STARTER | ✅ Tester istedi |
| Blank Street | 535 | true | true | – | Rule 1 (chain) | ENTERPRISE | ✅ Tester atladı, doğru |
| YBA Brazil | 81 | false (Instagram) | – | – | Rule 2 (social_only) | STARTER | ✅ Tester istedi |
| The Drip | 170 | false (no audit) | – | – | Rule 2 OR Rule 3 (rev<50? no, 170) | STARTER | ✅ |
| Camden Roastery | 799 | true | – | ≥ 2 | Rule 4 | PREMIUM | ✅ Tester onayladı |
| LUMI Camden | 2505 | true | – | ≥ 2 | Rule 4 | PREMIUM | ✅ Tester onayladı |
| Black Sheep | 513 | true | true | – | Rule 1 (chain) | ENTERPRISE | ✅ Tester onayladı |

**Sonuç:** 12/12 doğru tier. Tester tarafından açıkça istenen 6 STARTER vakası yakalandı.

### Edge cases

| Scenario | Tree path | Tier | Justification |
|---|---|---|---|
| No-website + 500 review (One Shot) | Rule 2 öncelik | STARTER | "yatırım yok, sales risk yüksek" |
| Chain + small location (e.g. 80 review chain branch) | Rule 1 → Enterprise | ENTERPRISE | chain HQ deal value baskın |
| Fine-dining (50 review, single location) | Rule 1 (isFineDining) | ENTERPRISE | concierge / sommelier modülleri tier'ı zorunlu kılar |
| Food truck (300 review, single location, valid site) | Rule 4 | PREMIUM | seasonal/footprint küçük ama digital touchpoint var |
| Hotel restaurant (60 review, valid site, isHotel=true) | Rule 1 | ENTERPRISE | per-property kompleksite |
| Brand new lead (NEW status, rev=0) | Rule 3 (reviewCount < 50) | STARTER | varsayılan giriş |

### Migration path

Mevcut beta `package-selector.test.ts` 6 fixture'ı (4×Base / 2×Premium kabul) Round 2 12 fixture ile DEĞİŞTİR. Eski regression — yenilemiyor değiştiriyoruz; explicit migration note PR description'a.

---

## 8. Chain Detection Trade-off (§3.7 — 3 alternatif)

### Alternatif A — Prompt-level constraint only

**Yaklaşım:** Sadece §3.1'deki prompt değişikliği. `chain_detected` Gemini'nin kendi çıkarımı; pre-prompt heuristic yok.

| Boyut | Değer |
|---|---|
| Effort | 4 saat |
| Accuracy | %60-70 — Gemini chain'i bazen kaçırıyor (Black Sheep Camden sub-page'de "chain" kelimesi yoksa) |
| FP risk | Düşük |
| FN risk | Yüksek — Round 2'de zaten sızdı |
| Maintainability | Yüksek — sadece prompt |
| Pivot cost | Düşük |

**Verdict:** Tek başına yetersiz. Round 2 zaten "chain detect ediyor ama pain üretiyor" demiş — alt-prompt context'i yetmedi.

### Alternatif B — Hardcoded chain list v1 (önerilen P1)

**Yaklaşım:** `niches/index.ts` `chainConsiderations.knownChainsByName` whitelist'i + pre-LLM heuristic (`scorer.ts` içinde `lead.businessName.includes()` substring match). Whitelist'e eklenen her chain için `chain_detected: true` heuristic olarak set edilir, prompt'a inject edilir.

| Boyut | Değer |
|---|---|
| Effort | 4 saat (whitelist) + 4 saat (heuristic) + 3 saat (niche pack) = 11 saat |
| Accuracy | %85-90 — top 30 UK/EU coffee chain'i kapsar |
| FP risk | Orta — "Black Wolf", "Black Bear" kafelerini Black Sheep'le karıştırabilir; substring boundary fix gerek |
| FN risk | Orta — whitelist dışındaki regional chain'ler (e.g. yerel mini-chain 5 şube) miss |
| Maintainability | Orta — whitelist quarterly review |
| Pivot cost | Düşük — sadece whitelist update |

**FP mitigation:** word-boundary regex (`\bBlack Sheep\b`) yerine substring; minimum 8-char match; case-insensitive ama exact word match.

**Verdict:** **Round 2 P1 için kabul.** 8 chain seed (Blank Street, Black Sheep, Caffè Nero, Pret, Costa, Starbucks, WatchHouse, Joe & The Juice) + monthly review playbook.

### Alternatif C — CHAIN_ROOT_AUDITOR worker (P2)

**Yaklaşım:** Yeni AI worker. Chain detect edildiğinde lead.websiteUrl'inden root domain'i çıkar (`blacksheepcoffee.co.uk/blogs/locations/camden` → `blacksheepcoffee.co.uk`); root domain'i ek bir audit pass'inden geçir; `/order`, `/loyalty`, `/menu`, app store URL'leri tespit et. Sonuçları `lead.confirmedFeatures` array'ine ekle (LEAD_INTELLIGENCE_BRIEF whitelist tüketir).

| Boyut | Değer |
|---|---|
| Effort | 16 saat |
| Accuracy | %95+ — gerçek HTML kanıtı |
| FP risk | Düşük |
| FN risk | Düşük |
| Maintainability | Düşük (yeni worker → quota + chain step) |
| Pivot cost | Yüksek — yeni worker + chain step + storage |

**Bağımlılıklar:** A2 audit worker; Apify quota; new MemoryKind veya `Lead.confirmedFeatures` JSON column.

**Verdict:** **P2'ye yatır.** ROI yüksek (Round 2 §3.7 / §8.2 stratejik öneri) ama P1 fix'leri Hardcoded list ile %85 vakayı çözüyor.

### Karşılaştırma matrisi

| Boyut | A (prompt) | B (hardcoded list) | C (worker) |
|---|---|---|---|
| Effort | 4h | 11h | 16h |
| Black Sheep Camden ✅? | %60 | %95 | %99 |
| Yerel mini-chain (5 şube) ✅? | %30 | %20 | %90 |
| FP "Black Wolf" cafe | %5 | %8 | %1 |
| Maintainability | A | B | C |
| Round 2 P1 önerimi | ❌ | ✅ | – |
| Round 2 P2 önerimi | – | – | ✅ |

**Karar:** B + (P2 ileride C) ile A'yı aynı PR'da uygula (B prompt değişikliği A'nın superset'i).

---

## 9. Review Language Filter Library Comparison (§3.10)

Üç JS-native lightweight language detection library'si workers-only context için karşılaştırıldı. Bundle size yorum — workers BullMQ tarafından başlatılan `tsx src/workers/index.ts` Node.js process; client bundle'ına asla girmiyor (yine de `serverExternalPackages` veya dynamic import istemiyoruz). Önemli olan startup memory ve per-call latency.

### Karşılaştırma

| Boyut | **tinyld** | **franc** | **cld3** |
|---|---|---|---|
| **Latest** | 1.3.4 (2024) | 6.2.0 (2024) | 1.0.0 (Google fork; native deps) |
| **NPM weekly DL** | ~150k | ~700k | ~30k (cld asn ile) |
| **Bundle size (raw)** | ~1.2 MB (includes 30 LM models) | ~7 MB (393 lang trigram db) | N/A — CLD3 protobuf binary + WASM |
| **Lang count** | 99 | 414 | 107 |
| **Native deps** | None — pure JS | None — pure JS | **YES** — N-API binding to Google's CLD3 (libprotobuf) |
| **Startup cost** | ~50 ms | ~120 ms (model load) | ~200 ms (WASM init) |
| **Per-call latency (50-char EN string)** | ~0.5 ms | ~1.2 ms | ~0.3 ms |
| **Top-1 accuracy en/it/es/fr/nl (50 char)** | ~92% | ~88% | ~95% |
| **Short-text (≤30 char) accuracy** | ~75% | ~70% | ~82% |
| **TS types** | ✅ official | ✅ official | ⚠️ DefinitelyTyped, less stable |
| **Workers-only import** | ✅ pure ESM | ✅ pure ESM | ⚠️ native deps need rebuild on deploy |
| **MIT license** | ✅ | ✅ | ✅ (Apache 2.0 actually) |
| **Decision** | ✅ **PICK** | ⚠️ heavy | ❌ deploy complexity |

### Decision: **tinyld**

**Gerekçe:**
1. **Bundle / cold-start:** Workers Node.js boyut hassas değil ama BullMQ worker startup penalty düşük; tinyld 50ms vs cld3 200ms (cold start önemli — worker recycling).
2. **Native deps:** cld3 N-API → Vercel/Railway native binary mismatch riski. tinyld pure JS = sıfır deploy complexity.
3. **Accuracy:** Tester'ın §3.10 vakaları (50-char İtalyanca/Hollandaca/Fransızca review'lar) her üçü için >85%. Marginal accuracy farkı (cld3 +3-5%) deploy riskiyle mubah değil.
4. **API ergonomics:** `detectAll(text)` → `[{lang: "en", accuracy: 0.94}, ...]` directly maps to our use-case.

### Edge cases

| Edge | Davranış | Mitigation |
|---|---|---|
| Çok kısa review (<10 char) — "Great!" | tinyld ~50% confidence; ambiguous | `_confidence > 0.6` threshold + ambiguous bucket → LLM passed; LLM language constraint rule yakalar |
| Mixed-language review ("Great! Servizio ottimo.") | tinyld single-lang döner (top hit) | Multi-lang: `detectAll` ilk 3 sonucu → `top.accuracy < 0.7 && second.accuracy > 0.3` → ambiguous |
| Emoji / non-Latin — "🔥🔥 great spot" | tinyld emoji'leri strip; "great spot" → en | OK |
| Tek-kelime review — "Bueno" | tinyld %30-50 confidence İspanyolca | Ambiguous bucket → LLM'e geç; prompt-level rule "non-English aggregate but don't quote" yakalar |

### Code skeleton (yeni dependency)

```bash
npm install tinyld
```

`package.json` değişikliği — sadece `dependencies`; client bundle'a sızmaz çünkü `review-analyst.ts` worker-only.

`src/lib/review-analysis/language-detect.ts` (yeni helper):

```ts
import { detectAll } from "tinyld";

export interface DetectedLang {
  lang: string;          // ISO 639-1
  confidence: number;    // 0..1
}

export function detectReviewLanguage(text: string): DetectedLang | null {
  const trimmed = text.trim();
  if (trimmed.length < 5) return null;
  const results = detectAll(trimmed);
  const top = results[0];
  if (!top) return null;
  return { lang: top.lang, confidence: top.accuracy };
}

export function partitionByLanguage<T extends { text: string | null }>(
  items: T[],
  targetLangs: string[],
  minConfidence = 0.6,
): { matching: T[]; ambiguous: T[]; nonMatching: T[] } {
  const matching: T[] = [];
  const ambiguous: T[] = [];
  const nonMatching: T[] = [];
  for (const item of items) {
    const detected = detectReviewLanguage(item.text ?? "");
    if (!detected || detected.confidence < minConfidence) {
      ambiguous.push(item);
    } else if (targetLangs.includes(detected.lang)) {
      matching.push(item);
    } else {
      nonMatching.push(item);
    }
  }
  return { matching, ambiguous, nonMatching };
}
```

---

## 10. OPENER_SUCCESS Memory Seed Plan (§3.8 + §8.1.2)

Tester Round 2'de 3 lead için "düzeltilmiş opener" yazımı verdi (rapor §8.1.2). Bunlar `SemanticMemory.OPENER_SUCCESS` kindine seed edilirse `OPENER_WRITER`'ın few-shot retrieval'ı (`opener-writer.ts:113-126`) bu örnekleri voice yakalama için kullanır.

### Tester'ın 3 düzeltilmiş örneği (rapor §8.1.2)

#### Seed 1 — Fable and Falcon (expired-site, no-website context)

```
Merhaba Fable and Falcon ekibi, işletmenizi incelediğimizde dijital kaynak entegrasyonunun satışlarınızı %80'e varan şekilde arttıracağını tespit ettik, modern bir QR ile sipariş akışının eksik olduğunu fark ettim ve size özel bir taslak hazırladım. FineDine olarak, hem bu dijital boşluğu doldurarak müşteri geri bildirimlerini çözerek operasyonel verimliliğinizi artırabiliriz.
```

**Metadata:**
- `kind: "OPENER_SUCCESS"`
- `workspaceId: <FineDine Beta workspace>`
- `nicheScope: "fnb-cafe-bakery"` (ve dual-write `"fnb"`)
- `leadId: cmoozvtn7001rkz042wr6yiab` (Fable and Falcon)
- `refType: "opener_seed"`
- `refId: "round2_seed_fable_falcon"`
- `metadata: { source: "round2_tester_curated", scenario: "expired_site", language: "tr" }`

#### Seed 2 — YBA Brazil (Instagram-only, social-only context)

```
Merhaba YBA Brazil ekibi, Instagram profilinizi incelerken, müthiş açaí kaseleri ve kahvelerinizle 4.9 yıldızlık harika yorumlar aldığınızı gördüm! Ancak müşterilerinizin masadan kolayca sipariş verebileceği bir QR menü akışının eksik olduğunu fark ettim; size özel bir demo hazırladık.
```

**Metadata:**
- `nicheScope: "fnb-cafe-bakery"` + `"fnb"`
- `leadId: cmon6tqtp000njv04bf2gg5hs`
- `refType: "opener_seed"`
- `refId: "round2_seed_yba_brazil"`
- `metadata: { source: "round2_tester_curated", scenario: "social_only_instagram", language: "tr" }`

#### Seed 3 — Black Sheep (chain context)

```
Merhaba, FineDine olarak sitenizi hızlıca inceledik ve Black Sheep Coffee'de Misafirlerinizin '20 dakika kahve bekleme' gibi sorunlarını çözmek ve ek satışları %18 artırmak için size özel bir çözüm hazırladık.
```

**Metadata:**
- `nicheScope: "fnb-cafe-bakery"` + `"fnb"`
- `leadId: cmoozvrcx000nkz042jba1czr`
- `refType: "opener_seed"`
- `refId: "round2_seed_black_sheep"`
- `metadata: { source: "round2_tester_curated", scenario: "chain_aware", language: "tr" }`

### Plus — Round 2'de tester'ın doğrudan övdüğü 3 LLM-üretimi opener (kontrol grup)

Rapor §7.2'den (tester bunları beğendi):
- **Blank Street** ("AI Opener 10/10. Lütfen Mert bey buradaki örnek yazıyı Enterprise Promptları eğitimi için kullanınız.") — `cmoozvs9l0013kz04jzlky5zi` mevcut DB'den seed edilebilir.
- **LUMI Camden** ("Açılış cümlesi oldukça güzel ve değiştirilmeden dahi yayınlanabilir.") — `cmoozvr4t000jkz043baocw6m`.
- **Il botanico** ("Personalized Message büyük ölçüde başarılı.") — `cmoozvsyu001fkz04ieppflvm`.

Bunlar `source: "round2_tester_endorsed"` metadata'sıyla seed edilir; `refId: "round2_endorsed_<lead-slug>"`.

### Seed script taslağı

`scripts/seed-opener-success-round2.ts`:

```ts
import { upsertAndEmbedWithNicheScopes } from "@/lib/ai-core/memory";

const FINEDINE_WORKSPACE_ID = "5496e39e-cc76-41bd-b18b-f1128fb9e41b";

const SEEDS = [
  { refId: "round2_seed_fable_falcon", leadId: "cmoozvtn7001rkz042wr6yiab",
    text: "Merhaba Fable and Falcon ekibi, işletmenizi incelediğimizde dijital kaynak entegrasyonunun…",
    metadata: { source: "round2_tester_curated", scenario: "expired_site", language: "tr" } },
  { refId: "round2_seed_yba_brazil", leadId: "cmon6tqtp000njv04bf2gg5hs",
    text: "Merhaba YBA Brazil ekibi, Instagram profilinizi incelerken, müthiş açaí kaseleri ve kahvelerinizle…",
    metadata: { source: "round2_tester_curated", scenario: "social_only_instagram", language: "tr" } },
  { refId: "round2_seed_black_sheep", leadId: "cmoozvrcx000nkz042jba1czr",
    text: "Merhaba, FineDine olarak sitenizi hızlıca inceledik ve Black Sheep Coffee'de Misafirlerinizin…",
    metadata: { source: "round2_tester_curated", scenario: "chain_aware", language: "tr" } },
  // Endorsed (DB'den fetched) — 3 lead'e ek
];

for (const seed of SEEDS) {
  await upsertAndEmbedWithNicheScopes(
    {
      workspaceId: FINEDINE_WORKSPACE_ID,
      kind: "OPENER_SUCCESS",
      text: seed.text,
      leadId: seed.leadId,
      refType: "opener_seed",
      refId: seed.refId,
      metadata: seed.metadata,
    },
    { childSlug: "fnb-cafe-bakery", parentSlug: "fnb" },
  );
}
```

### Seed'in OPENER_WRITER üzerindeki etkisi

`opener-writer.ts:113-122` `queryWithNicheUnion`:

```ts
const hits = await queryWithNicheUnion({
  workspaceId: ctx.workspaceId,
  kinds: ["OPENER_SUCCESS"],
  text: painQueryText,                    // lead pain phrases-based query
  topK: 5,
  minSimilarity: 0.3,
  childSlug,                              // "fnb-cafe-bakery"
  parentSlug: parentSlug ?? null,         // "fnb"
  parentWeight: 0.5,
});
```

Yeni FineDine cafe lead için top-5 hit'lerin 3'ü tester'ın seed'i olur (high similarity expected — pain phrases match). LLM bu 3 voice'i taklit eder; expired-site / social-only / chain context'leri için hazır kalıp olur.

### Risks + mitigations

| Risk | Mitigation |
|---|---|
| **Synthetic seed poisoning** — tester yazımı INTERESTED reply attestation YOK. Gerçek opener voice'ini distort edebilir. | `metadata.source` ayrı; `OPENER_WRITER` retrieval'ı `source !== "round2_tester_curated"` filter'ı eklemiyoruz (veriyle test) ama metric tracking: post-seed week opener reply rate izle, %5 düşerse seed'i revoke et. |
| **Refresh policy** — gerçek INTERESTED reply'lar geldiğinde seed'ler stale olur. | `refId: "round2_seed_*"` deterministic — gerçek `OPENER_SUCCESS` (refType=`"opener_outcome"`) farklı refId pattern'i kullanır; iki kaynak co-exist eder. Quarterly seed re-evaluation. |
| **Cross-workspace leak** — `nicheScope: "fnb"` (parent) FineDine workspace dışı F&B workspace'lerde sızabilir. | `memory.ts` facade workspaceId scope'u her zaman zorlu; cross-workspace leak imkansız (rules'a göre). Parent niche scope sadece aynı workspace içinde child→parent fallback için. ✅ Safe. |
| **Embedding cost** — 6 seed × 1 embed call = 6 Gemini embedding API call (one-time). | İhmal edilebilir (~$0.001). |

### Effort

- Seed script (yukarıdaki) — 2 saat
- Endorsed opener'ları DB'den fetch + seed metadata adapt — 2 saat
- Telemetry: post-seed reply-rate dashboard query — 2 saat

**Total: 6 saat** (P2-B yol haritasına yerleşir).

---

## Ek — Skill cross-references

`prompt-engineering-gemini` skill rule mapping:

| Skill rule | Bu plan'daki uygulama |
|---|---|
| 1. responseSchema, not "respond in JSON" | §3.4 — schema-level constraint expressions desteklenmediği için post-process gate; `responseMimeType: "application/json"` zaten her Gemini call'da set (`gemini.ts:760`) |
| 2. Explicit temperature per task | §3.2 opener temperature 0.7 (writing) — DOĞRU; §6 Q4 — scorer için temperature 0.2 (extraction/audit) eklenmesi gerek (mevcut ayar yok) |
| 3. systemInstruction = role, contents = data | Mevcut `gemini.ts` çağrıları role'ü `industryContext` template literal'ında inline tutuyor — refactor opportunity ama Round 2 fix'i için scope dışı |
| 4. Runtime Zod validation | Mevcut `safeParseGeminiJson` + `responseSchema`; Zod katmanı yok — P2 önerisi |
| 5. Retry with exponential backoff | `getGeminiKey` rotation var, exponential backoff yok — §6 Q4 ile birlikte ekle |
| 6. Token guard + truncation flag | Review-analyst `take: 50` (`review-analyst.ts:51`) — flat cap, truncation log yok; opener-writer `slice(0, 5)` painPhrases — log yok. P1 ekleme |
| 7. Pin model + version | Mevcut `gemini-2.5-flash` literal — pinned ✅; testler şema-level assertion kullanmalı (§3.x test stratejilerinde belirtildi) |

---

**Plan sonu** — 4 P0 fix (24 saat), 4 P1 fix (32 saat), 2 P2 (22 saat). A2-bağımsız fix'ler hemen ship; A2-bağımlı (§3.8 expired/parked/blocked) A2 ship sonrası 2. PR. Source code DEĞİŞTİRİLMEDİ.
