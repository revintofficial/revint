# LeadAC AI — FineDine Beta Test Kapsamlı Analiz Raporu

**Hesap:** `finedine-owner@leadac.beta`
**Workspace ID:** `5496e39e-cc76-41bd-b18b-f1128fb9e41b` (FineDine Beta, niche=`RESTAURANT_TECH`, language=`tr`)
**Beta tester'lar:** `finedine-tester1@leadac.beta`, `finedine-tester2@leadac.beta`
**Rapor tarihi:** 2 Mayıs 2026
**Rapor kapsamı:** Beta tester'ın 12 işletme üzerinde yaptığı manuel test raporları + Postgres'teki gerçek analiz verisi + AI Core kod tabanı kesişimi.

---

## 0 · Yönetici Özeti (TL;DR)

Beta tester yaklaşık 2 hafta boyunca FineDine senaryosuyla 12 işletme test etti. Bu rapor, tester'ın gözlemlerini **gerçek DB satırlarıyla** ve **kodda bulduğum nedenlerle** çapraz doğrulayarak hangi sistemlerin doğru çalıştığını ve hangilerinin acil müdahale gerektirdiğini ortaya koyuyor.

**Doğru çalışan parçalar (P0 değil):**
1. Google Places ingestion + Apify Gmaps Deep enrichment (350-500 yorum çekiliyor)
2. Sub-niche classifier'ın F&B alt-tipi kararları (cafe-bakery, bar-club doğru atanıyor)
3. Sentiment breakdown'ın yön doğruluğu (pozitif/negatif yüzdeleri makul)
4. Sosyal medya keşfi (Instagram/Facebook/TikTok URL'leri toplanabiliyor)
5. Niche pack mimarisi + sub-niche fallback gate (confidence < 0.7'de parent'a düşme mantığı)

**Sistemi felç eden 6 kök sorun (P0):**
1. **Crawler "Instagram-as-website" hallucination** — Booking + e-commerce her zaman TRUE çıkıyor (Black Eye, Blackheath, Brewed, kısmen Greenwich Nest)
2. **Review Intelligence küçük örneklem patlaması** — 5 yorumlu Pied a Terre'de TÜM KPI bar'ları %100 (4 weakness + 5 strength bar hepsi 100%)
3. **Review Intelligence tek-yorum şişirme** — Tek bir negatif yorum, küresel %86 / %100 KPI'a dönüşüyor (Greenwich Nest "Food Quality 86%", Nina & Dean "Outdated menu 100%")
4. **Package recommendation Premium'a sabit** — 6/6 FineDine lead'inde Premium ($119/ay) önerildi; Base ($39/ay) hiç önerilmedi (paket tasarımı + LLM anchor bias)
5. **Embedding step çökmesi** — `Failed to embed after 3 attempts` 12 worker run'ında. Worker datayı yazıyor ama AgentRun FAILED görünüyor; UI bunu "analiz başarısız" diye gösteriyor.
6. **Gemini API 403 Forbidden** — Coffee & Beyond'da 4 art arda dossier ve scorer çağrısı 403 ile düştü; "Açılış konuşması bölümünü kontrol edemiyorum" şikayetinin teknik kanıtı budur.

---

## 1 · Test Kapsamı ve Veri Doğrulaması

### 1.1 Tester'ın listelediği 12 işletme — DB'deki durum

| # | İşletme | Tester'ın verdiği ID | DB'de bulundu? | Workspace |
|---|---|---|---|---|
| 1 | Bunk Brew History Lucas House | `cmok4iv3500cflb04ss9dqgqb` | **Yok** (silinmiş veya yanlış ID) | — |
| 2 | MC Menamins Old St. Francis | `cmok4iuv000cblb047ffgui35` | **Yok** | — |
| 3 | Haven Point Provisions | `cmok4iuv000cblb047ffgui35` *(2 ile aynı verilmiş)* | **Yok** | — |
| 4 | Society Hotel Bingen | `cmok4iuep00c3lb04ps02cou5` | **Yok** | — |
| 5 | Pied a Terre | `cmok4iuep00c3lb04ps02cou5` *(4 ile aynı verilmiş)* | `cmohy9q7c002djx04ow733rww` (isim ile bulundu) | `Tester` (FineDine Beta DEĞİL) |
| 7 | Coffee & Beyond | `cmon6trrm0013jv04dnh9joxd` | ✅ Var | FineDine Beta |
| 8 | Nina & Dean Coffee (rapor 8 ve 8'in tekrarı) | `cmon6tsy4001njv04njss46zy` | ✅ Var | FineDine Beta |
| 9 | The Greenwich Nest | `cmon6tqlk000jjv04cpcm5ccz` | ✅ Var | FineDine Beta |
| 10 | Black Eye Coffee | `cmon6tqdf000fjv04d8egl07b` | ✅ Var | FineDine Beta |
| 11 | Blackheath Coffee Co. | `cmon6ttn9001zjv04hwigx5ub` | ✅ Var | FineDine Beta |
| 12 | 15grams Coffee House | `cmon6tpwt0007jv04stdr6lon` | ✅ Var | FineDine Beta |

**Veri kalitesi notu:** Tester'ın raporundaki ID'lerin bir kısmı (Bunk Brew, McMenamins, Haven Point, Society Hotel) DB'de bulunamadı. Tester aynı ID'yi farklı işletmelere yapıştırmış (Pied a Terre ve Society Hotel aynı ID; MC Menamins ve Haven Point aynı ID). Bu nedenle ABD/Oregon işletmeleri (1–4) için DB-tarafı doğrulama yapılamadı; o bölümler **sadece tester'ın yazılı gözlemine dayalı** olarak işlenecek. Diğer 7 işletme için tam DB karşılaştırması yapıldı.

### 1.2 FineDine Beta workspace ayarları (DB'den)

```
niche              = RESTAURANT_TECH
language           = tr
offerName          = "F&B Digital Stack (QR menu, ordering, reservations)"
valueProposition   = "FineDine modernises every digital touchpoint F&B operators rely on..."
targetSubNiches    = [fnb-fine-dining, fnb-bar-club, fnb-ghost-kitchen,
                      fnb-cafe-bakery, fnb-food-truck, fnb-hotel-fnb]
servicePackages    = Base ($39/ay) | Premium ($119/ay, isPopular=true) | Enterprise (custom)
```

---

## 2 · Sorun Sınıflandırması — Kategori bazlı kök neden analizi

Tester'ın 12 işletmedeki gözlemlerini **6 sistemik soruna** indirgedim. Her sorun için: (a) kanıt, (b) etkilenen işletmeler, (c) koddaki kök neden, (d) önerilen çözüm.

---

### Sorun #1 · Website Crawler "Instagram-as-Website" Hallucination

**Kanıt (DB'den, doğrudan):**

| Lead | website_url | has_booking_system | has_ecommerce | Doğru durum |
|---|---|---|---|---|
| Black Eye Coffee | `http://instagram.com/blackeyelondon` | **TRUE** ❌ | **TRUE** ❌ | İkisi de YOK (Instagram bio sayfası) |
| Blackheath Coffee Co. | `https://www.instagram.com/blackheathcoffeeco/` | **TRUE** ❌ | **TRUE** ❌ | İkisi de YOK |
| Brewed. (raporda yok ama aynı bug) | `http://www.instagram.com/islandcoffeepoplar` | TRUE ❌ | TRUE ❌ | İkisi de YOK |

**Tester'ın aynı hatayı bağımsız tespiti:**
- Black Eye: *"Conversion Features bölümü booking sistem ve E-commerce olduğu yanılgısına kapılmış, bunun muhtemel sebebi Instagram'ı base site olarak görüyor olması olabilir"*
- Blackheath: aynı şikayet, harfi harfine.
- Greenwich Nest: *"site analizinde sitede booking sistemi olduğunu belirtmiş ancak sitede booking sistemi yok"* (ayrı bir varyant — gerçek site de yanlış pozitif booking veriyor).

**Koddaki kök neden** — `src/lib/extractor.ts` satır 106–184:

```ts
const BOOKING_KEYWORDS = [
  "book", "appointment", "schedule", "reserve", "booking",
  "calendly", "acuity", "setmore", "timely",
];
const ECOMMERCE_KEYWORDS = [
  "add to cart", "add to basket", "buy now", "shop now",
  "checkout", "shopping cart", "shopify", "woocommerce", "price",
];

const hasBookingSystem =
  allLinks.some((l) =>
    BOOKING_KEYWORDS.some((k) =>
      l.text.toLowerCase().includes(k) || l.href.toLowerCase().includes(k)
    )
  ) || BOOKING_KEYWORDS.some((k) => bodyText.includes(k));
```

İki katmanlı bug:
1. **Substring match** — `bodyText.includes("book")` Instagram sayfasındaki "book a table" linki olmadan, sadece "Facebook" / "Instagram" kelimesiyle eşleşmez ama "Facebook" da `"book"` substring'i içerir → **her Facebook linki olan site `hasBookingSystem=true`**.
2. **Ecommerce'ta `"price"` kelimesi tek başına yeterli** — Instagram bio'sunda fiyat geçmesi, hatta `"prices listed"` gibi alakasız satırlar bile ecommerce sayalıyor.
3. **URL'in türü hiç kontrol edilmiyor** — Crawler'a `instagram.com/x` verdiğinizde, sitenin gerçek bir işletme sitesi mi yoksa sosyal medya profili mi olduğu sorgulanmıyor.

**Çözüm stratejisi (P0):**

A. Website URL doğrulama gate'i ekle — `crawlWebsite` çağrısından önce:

```ts
const SOCIAL_DOMAINS = [
  "instagram.com", "facebook.com", "tiktok.com",
  "linkedin.com", "twitter.com", "x.com", "youtube.com"
];
function isSocialMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return SOCIAL_DOMAINS.some(d => host === d || host.endsWith("." + d));
  } catch { return false; }
}
```

Eğer `isSocialMediaUrl(url) === true`:
- `WebsiteAudit.url` = sosyal URL'i, ama `reachable=false` + yeni `crawlError = "SOCIAL_MEDIA_ONLY"` enum değeri set et.
- `Lead.has_website` flag'i gerçek bir website'i temsil etmesi için `false` olarak işaretlenmeli; UI'da "Yalnızca Instagram profili" rozetiyle ayrıca sergilenmeli.
- Sub-niche classifier ve scorer için "no_website" reason_code'unu kullansın.

B. Substring match'i token-bazlı match'e çevir — Mevcut:

```ts
BOOKING_KEYWORDS.some((k) => bodyText.includes(k))
```

Bu şuna benzer bir fonksiyona çevrilmeli:

```ts
function hasKeywordToken(text: string, keyword: string): boolean {
  const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(text);
}
```

Böylece "Facebook" → "book" eşleşmesi kaybolur. Aynısını ecommerce için de uygulanmalı.

C. Yapısal sinyal eşiği — En az 2 farklı sinyal olmadan booking/ecommerce işaretlenmemeli (örn. hem button text hem schema.org tipi hem de mevcut booking provider regex'i):

```ts
const bookingSignals = [
  detectBookingProvider(html),                     // SevenRooms / OpenTable / Resy URL
  schemaTypes.includes("Reservation"),             // ld+json @type
  $('button, a').filter((_, el) =>
     /book\s+a\s+table|reserve\s+a\s+table/i.test($(el).text())).length > 0,
];
const hasBookingSystem = bookingSignals.filter(Boolean).length >= 1;
```

Bu kombo, Instagram bio'sundaki "we book pop-ups" cümlesini elemine eder ama gerçek "Reserve a Table" butonunu veya OpenTable widget'ını yakalar.

**Beklenen etki:** 6 işletmeden 3'ü doğrudan düzelir (Black Eye, Blackheath, Brewed). Greenwich Nest gibi gerçek sitelerde de yanlış-pozitif oranı düşer.

---

### Sorun #2 · Review Intelligence — Küçük Örneklem Yüzde Patlaması

**Kanıt (Pied a Terre — DB'den):**

```json
weaknessKpis: [
  { "label": "Unprofessional staff",         "percent": 100 },
  { "label": "Poor value for money",         "percent": 100 },
  { "label": "Underwhelming food/drinks",    "percent": 100 },
  { "label": "Unexpected costs",             "percent": 100 }
],
strengthKpis: [
  { "label": "Excellent service",            "percent": 100 },
  { "label": "Exceptional food quality",     "percent": 100 },
  { "label": "Beautiful presentation",       "percent":  75 },
  { "label": "Great vegan options",          "percent":  50 },
  { "label": "Beautiful decor/atmosphere",   "percent":  50 }
],
sentimentBreakdown: { positive: 0.8, neutral: 0, negative: 0.2 },
reviewsAnalyzedCount: 5     ← KRİTİK
```

5 yorum ile 4 farklı zayıflık etiketinin hepsi %100 olamaz; ya tek bir yorum 4 farklı şikayeti içeriyor ya da Gemini "share of negative reviews" tanımını "5 review içinde X kez geçti = %100" diye yorumluyor.

**Tester'ın aynı hatayı bağımsız tespiti** (MC Menamins): *"yorumlarda 'Payment or Police' gibi bir ifade taradığım yüzlerce yorumda geçmemesine rağmen 'Most Common Phrases' olarak koyması bir halüsinasyon olduğunu gösteriyor"* — aynı kök bug.

**Koddaki kök neden** — `src/lib/agent-workers/google-places-reviews.ts` satır 39:
- Google Places API yanıtı **maksimum 5 review** veriyor (resmi limit). Workspace Apify'a erişim sahibi değilse (FREE tier veya Apify token yoksa), `reviewsAnalyzedCount = 5` ile kalır.
- Pied a Terre, FineDine Beta'da değil `Tester` workspace'inde, dolayısıyla `APIFY_GMAPS_DEEP` çalışmadı → yalnızca 5 yorum var.

`src/lib/prompts/review-analysis-prompt.ts` satır 67:
```
"sentimentBreakdown": { "positive": <0-1>, "neutral": <0-1>, "negative": <0-1> },
"weaknessKpis": [{ "label": "...", "percent": <0-100 share of negative reviews> }]
```

Prompt yüzdeyi **"share of negative reviews"** olarak tanımlıyor ama **minimum mutlak sayı eşiği koymuyor**. 5 review = 1 negatif review = "100% of negative reviews" → matematiksel olarak doğru ama yorumlanması yanıltıcı.

**Çözüm stratejisi (P0):**

A. **Mutlak count + share çift gösterim** — Schema'ya `count` field'ı ekle:

```ts
weaknessKpis: [
  { label: "Unprofessional staff", count: 1, percent: 20, examples: [...] }
  // 5 yorumdan 1'inde geçti → %20 toplam, %100 of negatives
]
```

UI hem `count`'u hem `percent`'i göstermeli; `count <= 1` olduğunda "tek bir yorum" rozeti basmalı.

B. **Minimum sample gate** — Prompt'a sıkı kural ekle:

```
- weaknessKpis ve strengthKpis: minimum 2 farklı yorum tarafından desteklenmiyorsa ÇIKARMA.
- examples dizisi en az 2 öğe içermelidir; aksi halde label'i atla.
- reviewsAnalyzedCount < 10 ise: percent yerine "1 of 5", "2 of 5" gibi mutlak ifadeler kullan;
  weaknessKpis dizisi maksimum 2 öğe ile sınırlandır.
```

C. **UI tarafında veri görünürlüğü** — `analyzedCount` < 10 olduğunda lead detay sayfasında "⚠️ Az örneklem (5 yorum analiz edildi) — KPI yüzdeleri yanıltıcı olabilir, veriyi yorumlamadan önce ham yorumları kontrol edin" uyarısı bas. Mevcut UI bu eşiği gösterilmiyor.

D. **Apify Deep'i FREE tier'da da bir fallback'e bağla** — Gerçek bir DataForSEO veya ScrapeOps tarayıcısı (~$0.01 per lead) ekleyerek 50+ review hedefine ulaş. Pied a Terre gibi yüksek-puan/yüksek-yorum işletmeler 5 yorumla analiz edilirse müşteriye satılabilir bir analiz çıkmaz.

**Beklenen etki:** Pied a Terre KPI bar'larının %100 değil daha gerçekçi yüzdeler göstermesi; tester'ın "5 yorumdan çıkardığı sonuç gerçekten uzak" şikayetinin kaybolması.

---

### Sorun #3 · Review Intelligence — Tek-Yorum Etiketi Genelleştirme + Hallucination

**Kanıt #1 (Greenwich Nest — DB'den, 50 yorum analiz edildi):**

```json
weaknessKpis: [
  { "label": "Food Quality/Taste",  "percent": 86, "examples": [...] }
]
```

Sentiment breakdown: positive 0.86, negative 0.08. Yani 50 yorumdan ~4 tanesi negatif. "Food Quality/Taste %86" demek "negatif yorumların %86'sı" demek; 4 negatiften 3'ü = aslında toplamın %6'sı. Tester: *"tekil bir yorumu maalesef genel bir alıntı haline çevirilmiş, bu da yorum analizinde yanıltıcı"*

**Kanıt #2 (Nina & Dean — DB'den, 44 yorum analiz):**

```json
weaknessKpis: [
  { "label": "Outdated menu info", "percent": 100, "examples": [
    "advertised in front of the shop", "dont sell them anymore"
  ]}
],
sentimentBreakdown: { positive: 0.977, negative: 0.023 }
```

97.7% pozitif sentiment olan bir mekanda "Outdated menu info %100" kritik bir bug değil **etiketin ne kadar agresif tetiklendiğini** gösteren tipik vakadır. 44 yorumdan 1 tanesi → "%100 of negatives".

**Kanıt #3 (Coffee & Beyond — DB'den, 50 yorum):**

```json
{ "label": "Restrictive Policies", "percent": 12,
  "examples": ["many rules such as wifi access", "asked to leave at 3:30pm"] }
```

Tester: *"Wifi Access bölümünü Restrictive policies olarak bahsetmesi de ayrıca bir hata olarak varsayılır (Kısmi Halüsinasyon dahi sayılabilir çünkü restrictive Access ile alakalı bir konu geçmemekte)"* — Gemini iki ayrı şikayeti ("wifi rules" + "asked to leave at closing") tek "Restrictive Policies" etiketi altında topladı; bu kötü bir kümeleme tercihi (fairly debatable, ama tester açısından hallucination).

**Kanıt #4 (Coffee & Beyond — DB'den):**

```json
strengthKpis: [
  { "label": "Friendly Staff/Service",  "percent": 93 }   // wide
],
weaknessKpis: [
  { "label": "Rude/Aggressive Staff",  "percent": 29 }    // also high
]
```

Tester: *"friendly Staff %67 iken rude staff bölümü de %50 rakam ve review analysislerde tutarsızlık var"* (raporda McMenamins için yazmış, Coffee & Beyond için de aynı kombo var). %93 + %29 hem "of positive reviews" hem "of negative reviews" referansıyla tutarlı (toplama 100% olmaz çünkü farklı denominator) — ama UI'da bu yan yana gösterilince çelişki gibi görünüyor.

**Koddaki kök neden** — `src/lib/agent-workers/review-analyst.ts` satır 119–134:

`isGroundedInCorpus` fonksiyonu yalnızca **3 ardışık kelimenin yorumda geçip geçmediğini** kontrol ediyor (satır 264–275). Bu cluster label'larını değil sadece pain phrase'leri (memory write için) doğruluyor. KPI bar **etiketleri** ("Restrictive Policies", "Outdated menu info") asla doğrulanmıyor — Gemini istediği etiketi yapıştırabiliyor.

`src/lib/prompts/review-analysis-prompt.ts` satır 60–65:
```
"weaknessKpis": [
  { "label": "<2-4 word complaint label>",
    "percent": <0-100 share of negative reviews>,
    "examples": ["<verbatim quote 1>", ...]
  }
]
```

Etiket için mantıksal yapı yok — herhangi bir 2-4 kelimelik label kabul.

**Çözüm stratejisi (P0):**

A. **Etiket standardizasyon listesi** — F&B niche'i için 30-40 standart label tanımla, prompt'a enum olarak ver:

```ts
// src/lib/prompts/fnb-review-labels.ts
export const FNB_WEAKNESS_LABELS = [
  "Slow Service", "Long Wait Times", "Order Errors", "Rude Staff",
  "Untrained Staff", "Unfriendly Staff", "Cold Food", "Food Quality Decline",
  "Stale Pastries", "Bitter Coffee", "Watery Drinks", "Small Portions",
  "High Prices", "Poor Value", "Hidden Fees", "Surprise Charges",
  "Limited Seating", "Crowded Atmosphere", "Loud Environment",
  "WiFi Restrictions", "Time Limits", "No-Pet Policy", "Dirty Tables",
  "Outdated Menu Info", "Limited Vegan Options", "No Allergen Info",
  "Confusing Booking", "Booking System Issues", "Order Ahead Missing", ...
] as const;
```

Prompt'a:
```
weaknessKpis.label MUST be one of: [...listed enum...]
If a complaint doesn't fit any label, omit it.
Do NOT cluster unrelated complaints under a single creative label.
```

B. **Minimum example threshold** — `examples.length >= 2` olmayan KPI'ları drop et (hem prompt'ta hem `review-analyst.ts`'in post-processing'inde):

```ts
const groundedKpis = (analysis.weaknessKpis ?? [])
  .filter(k => k.examples?.length >= 2)
  .filter(k => k.examples.every(ex => isGroundedInCorpus(ex, corpusNormalized)));
```

C. **Friendly/Rude staff overlap detect** — Sentinel kontrol:

```ts
function detectKpiOverlap(weakness: KPI[], strength: KPI[]) {
  const opposites = [
    ["Friendly Staff", "Rude Staff"], ["Friendly Staff", "Unfriendly Staff"],
    ["Quick Service", "Slow Service"], ["Good Coffee", "Bitter Coffee"], ...
  ];
  for (const [pos, neg] of opposites) {
    const w = weakness.find(k => k.label.includes(neg.split(" ")[0]));
    const s = strength.find(k => k.label.includes(pos.split(" ")[0]));
    if (w && s) {
      // Surface as warning in UI: "Mixed signals on staff (67% praise / 29% complaint)"
    }
  }
}
```

D. **Frontend disclaimer** — KPI yüzde tooltip'inde mutlak count + denominator göster:
"Rude Staff %29 — 50 yorumdan 4'ünde geçti (negatif yorumların %29'u)"

**Beklenen etki:** Coffee & Beyond için "Restrictive Policies" gibi creative label'lar önlenebilir; Nina & Dean için tek pain phrase 100% KPI'a dönüşmez (en az 2 example zorunluluğu); tester'ın "tutarsızlık" şikayetinin %80'i çözülür.

---

### Sorun #4 · Package Recommendation — Tüm Lead'lere Premium

**Kanıt (DB'den, 6/6 FineDine lead):**

| Lead | rating | review_count | recommended_package |
|---|---|---|---|
| 15grams Coffee House | 4.6 | 470 | **Premium** ($119/ay) |
| Black Eye Coffee | 4.8 | 649 | **Premium** |
| Greenwich Nest | 4.6 | 69 | **Premium** |
| Coffee & Beyond | 4.2 | 341 (no website) | **Premium** |
| Nina & Dean Coffee | 4.9 | 123 (coming-soon site) | **Premium** |
| Blackheath Coffee Co. | 4.2 | 87 (Instagram only) | **Premium** |

**Pied a Terre** (Tester workspace, paket önerisi farklı): Premium önerildi → tester'a göre doğru çünkü Michelin restoran. Yine de 6/6 FineDine cafe'sine Premium tarifi tester'ın **doğrudan endişesi**:

- Black Eye: *"Önerilen paketin premium olması biraz fazla olabilir ve işletmelerin hepsine premiumdan düşük bir paket üretilmiyor"*
- Blackheath: aynı gözlem.
- 15grams: *"Önerilen Premium paket bence bu işletme için yeterli, 2'den fazla dükkanları olsaydı Enterprise dahi mümkün idi"* (yani 15grams için kabul ama tek-şube cafe'lere fazla).

**Koddaki kök neden** — `src/lib/gemini.ts` satır 410:
```
recommended_package_id: ... Pick the cheapest tier whose features cover this lead's pain points;
only step up if the audit shows multi-location, hotel, or enterprise signals
that justify the higher tier.
```

Talimat doğru ama:

1. **Base tier features yetersiz** — `Base` sadece `[QR menu, Tablet menu, Branded ordering page, Multi-language menu, Basic analytics]`. Hiçbir F&B operasyonel pain'ini (slow service, no order-ahead, no loyalty, no reservations) çözmüyor. Gemini "cheapest tier whose features cover pain" dediğinde Base hiçbir lead için cover etmiyor → Premium "minimum acceptable" oluyor.

2. **`isPopular: true` LLM anchor bias** — Gemini 2.5 Flash'in fine-tuning'i "most popular" tag'ini "default recommendation" olarak yorumlama eğiliminde (well-documented LLM behaviour: anchor effect). 6/6 lead'de aynı tier seçilmesi tesadüf değil.

3. **Pain detection over-aggressive** — Tüm cafe'lere "no order-ahead", "no loyalty program", "menu only on chalkboard photo" pain'leri yapıştırılıyor (DB'deki `likely_pain_points` array'lerine bakın — 5'ten 5'inde aynı liste). Bu pain'ler Premium tier'ı tetikliyor.

**Çözüm stratejisi (P0):**

A. **Service package re-design** — Base tier'ı F&B kafe için satılabilir hale getir:

```
Base Plus ($59/ay) — Cafe / Single-location:
- QR menu + tablet menu + multi-language
- Order ahead (single-channel, walk-in tracking)
- Basic loyalty (10-stamp digital card)
- Walk-in seat tracker
- Basic analytics
```

Eğer paket re-design mümkün değilse, **paket seçim mantığını LLM'den çıkar** ve deterministic kurallarla yap:

B. **Deterministic package selector** — `src/lib/agent-workers/package-selector.ts` (yeni):

```ts
export function selectPackage(input: {
  reviewCount: number;
  rating: number;
  hasMultipleLocations: boolean;
  isHotel: boolean;
  servicePackages: ServicePackage[];
  likelyPainPoints: string[];
}): { id: string; reason: string } {
  // 1. Hotel veya multi-location → Enterprise
  if (input.isHotel || input.hasMultipleLocations) {
    return { id: enterpriseId, reason: "Multi-property / hotel signal triggers Enterprise tier" };
  }
  // 2. Yüksek pain hacmi → Premium
  const heavyPains = input.likelyPainPoints.filter(p =>
    /reservation|order.?ahead|loyalty|delivery|crm/i.test(p)).length;
  if (heavyPains >= 2 || input.reviewCount > 300) {
    return { id: premiumId, reason: `${heavyPains} operational pain points + ${input.reviewCount} review volume` };
  }
  // 3. Default → Base
  return { id: baseId, reason: "Cafe-scale operations, low pain density — start with Base, upsell on call" };
}
```

Sonra LLM'e SADECE `recommended_package_reason` üretmesi için Base'i context olarak ver — id deterministic.

C. **`isPopular` sinyalini prompt'tan kaldır veya tersine çevir** — Pricing page'de UX için kalsın ama LLM prompt'ında bu field'ı gizle:

```ts
servicePackages: servicePackages.map(p => ({
  id: p.id, name: p.name, priceLabel: p.priceLabel, features: p.features
  // isPopular intentionally omitted — anchor bias'a yol açıyor
}))
```

D. **Pain point ground truth gate** — `likely_pain_points` array'i de review-grounded olmalı; "no order-ahead" pain'i ancak 50+ review içinde "wait", "queue", "slow", "ahead" kelimeleri 3+ yorumda geçiyorsa eklenebilir.

**Beklenen etki:** 6 cafe'den ~3-4'ü Base tier ile başlasın; Premium yalnızca yüksek-volume/multi-location veya gerçek operasyonel-pain göstergesi olan lead'lere kalsın. Tester'ın "her lead'e Premium" şikayeti çözülür.

---

### Sorun #5 · Sub-niche Classifier — Hibrit ve Edge-case Tipleri Kaçırıyor

**Kanıt #1 (Pied a Terre — Michelin Fransız restoran):**

```sql
sub_niche_slug:        NULL
sub_niche_source:      AUTO
sub_niche_confidence:  0
```

Yani `fnb-fine-dining` olması gereken bir Michelin restoran sub-niche'siz. Sebep: `src/lib/niches/index.ts` satır 268:

```ts
classifierHints: {
  googlePlacesTypes: ["fine_dining_restaurant", "restaurant"],
  keywordsInName: ["fine dining", "tasting", "chef's", "michelin", "sommelier"],
}
```

Pied a Terre'in `primary_type` = `"french_restaurant"` — listede yok. İsmi de `keywordsInName` listesinde geçen kelimeleri içermiyor. Rule-based pass null → Gemini fallback → Gemini de düşük confidence → fallback gate (0.7 altında) sub-niche'i null'a çekiyor.

**Kanıt #2 (Bunk Brew — DB'de yok ama tester'ın gözlemi):**
Tester: *"yapay zeka önceden de raporladığım gibi Paket önerisi yapmamış, sub-niche bölümünde seçim yapılmamıştı ve bunu Food and Bar olarak güncelledim"*

Bu "Hotel + bar + party-bus" hibrit işletmesi `fnb-hotel-fnb` ve `fnb-bar-club` arasında — classifier hibrit mantığı tek-değer dönüyor.

**Tester'ın sub-niche şikayeti çoklu lead'de tekrarlıyor** (Haven Point: *"Casual Dining olarak işaretlemiş ama aslında 'Hotel and Food' olması gerekiyor"*).

**Çözüm stratejisi (P1):**

A. **`primaryType` listesini genişlet** — `niches/index.ts`'deki her child pack'in `googlePlacesTypes` array'ini genişlet:

```ts
// fnb-fine-dining
googlePlacesTypes: [
  "fine_dining_restaurant", "restaurant",
  // Yeni eklemeler:
  "french_restaurant", "italian_restaurant", "japanese_restaurant",
  "scandinavian_restaurant", "modern_european_restaurant",
],
classifierHints: {
  ...
  // Yeni: Michelin/star indicators
  googleRatingMin: 4.6,
  reviewCountMin: 300,
  priceLevelRange: [3, 4],   // already exists
  // External signals
  websiteKeywords: ["michelin", "tasting menu", "à la carte", "sommelier", "chef's table"],
}
```

B. **Hotel+restaurant hibrit tag'leme** — Lead için MULTIPLE sub-niche tag'i destekle:

```prisma
model Lead {
  ...
  subNicheSlug      String?      // primary
  subNicheSlugs     String[]    // NEW: multi-tag for hybrids
}
```

`fnb-hotel-fnb` + `fnb-bar-club` Bunk Brew gibi mekanlar için: primary slug en spesifik olan (`fnb-hotel-fnb`), `subNicheSlugs` array'ine her ikisi de eklenir. Opener writer ve scorer her ikisini de read eder.

C. **Confidence threshold'u kaldır + multiple proposal** — `subvertical-classifier.ts`'in Gemini fallback'i tek bir slug + confidence dönüyor; iki yerine top-3 alternatif dönsün:

```ts
return {
  primary: { slug: "fnb-fine-dining", confidence: 0.55 },
  alternatives: [
    { slug: "fnb-hotel-fnb", confidence: 0.30 },
    { slug: "fnb-bar-club", confidence: 0.15 }
  ]
}
```

UI'da rep'in "doğruyu seç" deneyimi olur; düşük-confidence durumlarda "Aşağıdakilerden hangisi?" picker basılır. Şu an `null` kalıyor ve sessizce parent F&B fallback'i devreye giriyor — kullanıcı farkında değil.

D. **`french_restaurant` tipi default `fnb-fine-dining` mapping'i** — Hızlı düzeltme: `placesTypeToNicheMap`'te (`niches/index.ts` satır 663):

```ts
const PLACES_TYPE_TO_FINE_DINING = [
  "fine_dining_restaurant", "french_restaurant", "italian_restaurant",
  "japanese_restaurant", "modern_european_restaurant",
];
```

ve rating ≥ 4.5 + reviewCount ≥ 200 + priceLevel ≥ 3 ise auto-assign confidence 0.85.

**Beklenen etki:** Pied a Terre'in `fnb-fine-dining` olarak doğru tag'lenmesi → opener writer'ın "QR menu eksik" anti-pattern'inden vazgeçip "premium reservation + sommelier notes" doğru pitch'ini yazması.

---

### Sorun #6 · Opener Writer — Sub-niche'siz Kalan Lead'ler İçin Yanlış Mesaj

**Kanıt (Pied a Terre — DB'den, `personalized_first_message`):**

> *"Hi Team Pied a Terre, your Michelin-star reputation and exceptional food are truly impressive! We've noticed your current use of PDF menus and OpenTable, and believe we can help you enhance guest experience, increase transparency around 'unexpected costs', and streamline your operations by bringing these digital touchpoints onto one platform..."*

Tester: *"Finedine Michelin yıldızlı bir restoranın Sipariş entegrasyonunun olmaması gerekliyken yapay zeka açılış mesajı olarak Sipariş entegrasyonu yapılması gerektiği gibi yanlış bir açılış mesajıyla yaklaşmış."*

Mesaj OpenTable'ı doğru sezdi ama "online ordering / delivery" iddiasına Michelin tasting-menu restoranını **anti-pattern** olarak konumlandırdı.

**Kanıt #2 (Greenwich Nest):** Opener'da "online rezervasyon" eksikliği iddia ediliyor ama website_audit `has_booking_system=true` (ki bu da yanlış pozitif), aynı zamanda scorer pain points listesinde "Online rezervasyon sisteminin olmaması" var. **Aynı çağrı akışı içinde** kendi audit'iyle çelişiyor.

**Kanıt #3 (Black Eye Coffee):** Opener: *"BLACK EYE COFFEE'nin Instagram sayfasını incelerken, canlı atmosferinize rağmen müşteri yorumlarında '12 dakika beklemeye zorlanma' ve 'yavaş servis' gibi operasyonel sorunlar yaşadığınızı fark ettim."*

İlk cümle dürüst (Instagram sayfasını incelediğini söylüyor) ama az önceki Sorun #1'de gördüğümüz "has_booking_system=true" hallucination'ı opener'a sızıyor: Premium tier (booking dahil) öneriliyor, ki Instagram-only bir lead için "online booking ekleyelim" satışı doğru olabilir ama "sizinki var, biz iyileştirelim" gibi ifadeler tutarsızlığa yol açar.

**Koddaki kök neden** — `src/lib/agent-workers/opener-writer.ts` satır 59-63:

```ts
const subNicheTrusted =
  lead.subNicheSlug != null &&
  (lead.subNicheSource === "MANUAL" ||
    (lead.subNicheConfidence ?? 0) >= 0.7);
```

Pied a Terre'in `subNicheConfidence = 0`, dolayısıyla `subNicheTrusted = false` → `childPack = null` → `parentPack = "fnb"` (generic) — **ve `parentPack.featuredProductModules`** içinde "Online ordering / delivery" var. Opener bu modülü öneriyor.

`parentPack.featuredProductModules` (`niches/index.ts` satır 226-234):
```ts
[
  "QR Mobile Pay", "POS Lite", "Online Reservations",
  "Multi-branch Management", "CRM", "In-App Promotions",
  "Smart Recommendations",
],
```

Burada "Online ordering / delivery" yok ama `nicheFeaturedModules` LLM prompt'una geçtiğinde Gemini "F&B = restaurant = should have ordering" assumption'ı yapıyor. Üstelik kod (satır 367-371):

```ts
if (input.nicheFeaturedModules.length && !input.isParentFallback) {
  lines.push(`Relevant product modules ...`);
}
```

Parent fallback olunca `featuredModules` zaten gönderilmiyor — yine de Gemini valueProposition'dan ("QR menu, ordering, reservations") anti-pattern modülleri çıkarıyor.

**Çözüm stratejisi (P1):**

A. **Negative-list per niche** — Her child pack'e `notApplicableModules` ekle:

```ts
{
  slug: "fnb-fine-dining",
  ...
  notApplicableModules: [
    "Online ordering / delivery",   // Michelin = anti-pattern
    "Tablet ordering",               // service kalitesini bozar
  ]
}
```

Opener prompt'una:
```
NEVER mention or pitch the following modules for this niche:
{notApplicableModules.join(", ")}
```

B. **Audit ↔ scorer ↔ opener tutarlılık katmanı** — `lead-intelligence-brief.ts` zaten "single source of truth" amaçlı. Opener writer çıktısını brief'in `confirmedPainPoints` array'ine bağla — opener sadece bu array'deki pain'leri ve `confirmedMissingFeatures` array'indeki eksiklikleri pitch edebilsin:

```ts
// opener-writer.ts (yeni constraint)
const brief = await prisma.agentRun.findFirst({
  where: { leadId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED" },
  orderBy: { finishedAt: "desc" },
});
const confirmedFeatures = brief?.outputJson?.confirmedFeatures ?? {};
// Eğer audit `has_booking_system: true` diyor ama brief 'unconfirmed' ise
// opener "booking eksik" diyemez.
```

C. **Sub-niche-specific opener template** — Fine dining için sabit opener iskeleti:

```
Hi {senderName} from {workspaceName},

Pied a Terre's Michelin presence and recent {michelinYear} recognition makes
your guest experience the brand. We help fine-dining venues like yours with
a quieter digital layer — premium reservations with sommelier notes, allergen
filters, and a tip flow that protects the white-glove feel without bringing
QR scanners to the table.

If you'd like to see a 60-second mockup tailored to {restaurantName},
just reply with a yes.
```

LLM yalnızca `{...}` placeholder'larını dolduruyor; vertical anti-pattern'i prompt'a sokmuyor.

D. **Tone profile parametreyi gerçekten kullan** — Workspace'in `tone` field'ı zaten var. Şu anki opener'lar hep aynı kalıbı izliyor ("size özel bir demo hazırladık" + "%18 ek satış"). Tester'ın "konuşma tonunda değil" ve "klişe satış" şikayetleri buradan. Tone field'ına "neighbour" / "advisor" / "salesperson" tip değer eklenmeli; her birine özgü opener paragrafı.

**Beklenen etki:** Pied a Terre opener'ından "online ordering / delivery" anti-pattern'i çıkar; Greenwich Nest ve Black Eye opener'larında audit-opener tutarsızlığı kaybolur.

---

### Sorun #7 · İnfrastruktür — Embedding Failure ve Gemini 403

**Kanıt #1 (Embedding step crash):**

`agent_runs` tablosunda 12+ farklı `error_msg = "Failed to embed after 3 attempts"` kaydı:

```
Pied a Terre   - WEBSITE_AUDITOR   FAILED   "Failed to embed after 3 attempts"
Pied a Terre   - REVIEW_ANALYST    FAILED   (data still saved to review_analyses)
15grams        - WEBSITE_AUDITOR   FAILED   (data still in website_audits row)
15grams        - REVIEW_ANALYST    FAILED   (data still saved)
15grams        - APIFY_WEB_CRAWL_DEEP  FAILED
Black Eye      - WEBSITE_AUDITOR   FAILED   (data saved)
Black Eye      - REVIEW_ANALYST    FAILED   (data saved)
Greenwich Nest - WEBSITE_AUDITOR   FAILED   (data saved)
Greenwich Nest - REVIEW_ANALYST    FAILED   (data saved)
Greenwich Nest - APIFY_WEB_CRAWL_DEEP FAILED
... (devamı)
```

**Bu sessiz veri kaybı** — Worker datayı yazıyor (audit, review_analyses tabloları dolu) ama AgentRun status FAILED görünüyor. UI `status` alanını okuduğu için lead'in "analiz başarısız" rozeti basıyor; rep tekrar Re-analyze çalıştırıyor; embedding tekrar düşüyor; halka.

Kök neden: Embedding step'i `persistMemoryWrites` içinde — Gemini text-embedding-004 API'si rate limit / 5xx döndüğünde 3 retry sonrası throw ediyor; executor bütün run'ı FAILED yapıyor.

**Kanıt #2 (Gemini API 403 — Coffee & Beyond):**

```
2026-05-01 18:52:54  SALES_OPPORTUNITY_SCORER  FAILED
   "[GoogleGenerativeAI Error]: ... [403 Forbidden] Your project has been denied access. Please contact support."

2026-05-01 18:29:28  LEAD_DOSSIER_GENERATOR  FAILED  403 Forbidden
2026-05-01 18:20:30  LEAD_DOSSIER_GENERATOR  FAILED  403 Forbidden
2026-05-01 18:08:34  LEAD_DOSSIER_GENERATOR  FAILED  403 Forbidden
```

4 art arda dossier ve 1 scorer çağrısı 403 ile düştü. Bu **Bunk Brew için tester'ın "AI Dossier bu işletme için verimli çalışmadığından maalesef açılış konuşması bölümünü kontrol edemiyorum"** gözleminin kanıtı. Coffee & Beyond için aynısı.

**Çözüm stratejisi (P0):**

A. **Embedding decoupling** — `executor.ts`'te:

```ts
async function persistMemoryWrites(...) {
  try {
    await embedAndUpsert(writes);
  } catch (err) {
    // Worker output zaten kaydedildi; embedding fail "WORKER" status'u
    // değil, ayrı bir status dönsün.
    logger.warn("memory_writes_failed_after_worker_success", { runId, err });
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "SUCCEEDED_NO_MEMORY", errorMsg: `embedding_failed: ${err.message}` }
    });
    return;
  }
}
```

UI `SUCCEEDED_NO_MEMORY` durumunu "✓ Analiz tamamlandı (semantic search devre dışı)" diye göstersin; "FAILED" diye değil.

B. **Embedding queue + lazy retry** — Embedding'i ayrı BullMQ job'ına çıkar (`embedding-backfill` queue). Worker output yazıldığında bir job enqueue et; queue'nun kendi retry mekanizması (exponential backoff) bunu daha sonra yakalar. Lead detail sayfasına etki etmez.

C. **Gemini API gözlemi** — 403 Forbidden genellikle: (1) project quota exceeded, (2) billing account paused, (3) regional restriction. Acil aksiyon:
- Workers servisi başında Gemini health-check ekle: `client.getGenerativeModel(...).generateContent("ping")`. 403 dönüyorsa workers servisi başlamasın, Slack alert.
- API key rotation: Birden fazla `GEMINI_API_KEY_1`, `_2`, `_3` env var; gemini-client.ts round-robin + 403/429 durumda failover.
- Beta test sırasında prod traffic için bağımsız bir GCP projesi kullan; tester'ların 403 yememeleri kritik.

D. **Dossier failure idempotency** — `LEAD_DOSSIER_GENERATOR` 403 alınca `error_msg` setleniyor ama finalize state machine ileriye taşınmıyor. UI "Generate Dossier" butonuna basıldığında cached output yoksa tekrar tekrar deneniyor. Çözüm: 403 alındıktan sonra 5 dakika cooldown; UI'da "Gemini API erişim sorunu — birazdan tekrar deneyin" göster.

**Beklenen etki:** "FAILED" rozeti olan lead'lerin yarısı aslında başarılı; doğru status gösterilmesi rep'lerin gereksiz Re-analyze button'ına basmasını önler. 403 sorunu çözüldükten sonra Coffee & Beyond gibi lead'ler tam dossier alır.

---

### Sorun #8 · Lead Score (`lead_score`) — Kalibrasyon Yanlışlığı

**Kanıt:**

| Lead | Gerçek Google Rating | review_analysis.lead_score | sales_opp.opportunity_score |
|---|---|---|---|
| Pied a Terre (Michelin) | 4.3 | 75 | 56 |
| 15grams Coffee | 4.6 | 75 | 81 |
| Black Eye Coffee | 4.8 | 80 | 79 |
| Greenwich Nest | 4.6 | 75 | 70 |
| Coffee & Beyond | 4.2 | 65 | 85 ← UYUMSUZ |
| Nina & Dean | 4.9 | 85 | 67 ← UYUMSUZ |
| Blackheath Coffee | 4.2 | 80 | 71 |

`review_analyses.lead_score` ve `sales_opportunities.opportunity_score` iki ayrı sayı, iki farklı kaynaktan ve UI'da çok yakın etiketlerle gösteriliyor. Tester (Society Hotel: *"Google puanı 4.7 olmasına rağmen yapay zeka 3.8 puan çıkarmış bunun sebebi son 5 Google yorumun oldukça düşük olması"*) ve (15grams: *"Lead yaklaşık 4.0'lık bir puan çıkarmış bu da gerçek sonuca yakın sayılabilir"*) — bu iki score'un Google rating'ten farklı olduğunu fark ediyor ama aralarındaki farkı çözememiş.

**Coffee & Beyond `lead_score=65` vs `opportunity_score=85`** kafa karıştırıcı: review analizine göre "düşük müşteri", scorer'a göre "yüksek fırsat". Mantıken doğru ("kötü servisi olan popüler kafe = yüksek satış fırsatı") ama UI'da iki farklı sayı yan yana, `sales_confidence=75` üçüncü bir sayı.

**Çözüm stratejisi (P2):**

A. **Single rollup score** — `LEAD_INTELLIGENCE_BRIEF` zaten "single salesConfidence" amaçlı (registry'de yazıyor: *"Replaces the old multi-source scoring confusion with one number the rep can trust"*). Bu worker'ın çıktısı UI'da PRIMARY olarak gösterilmeli; review_score ve opportunity_score "advanced" tab altında.

B. **Score etiketleme** — UI'da:
- "Lead Score 75" yerine "**Sales Fit**: 75/100 (Strong Match)"
- "Review Score 65" yerine "**Customer Health**: 65/100 (Service issues)"
- İki numara ne olduğunu kelimeyle açıklamalı.

C. **Google rating disclaimer** — "Aşağıdaki skorlar Google'ın 4.6 puanını yansıtmaz; satış fırsatına ve operasyonel ihtiyaca dayalıdır" tooltip'i eklenmeli.

---

## 3 · İşletme-bazlı Tester Gözlemi vs DB Verisi Karşılaştırması

| # | İşletme | Tester'ın Şikayeti | DB / Kod Doğrulaması | Verdict |
|---|---|---|---|---|
| 1 | Bunk Brew Lucas House | "QR menü var deniyor ama yorumlarda yok"; "%100 Kirlilik şikayeti yanlış"; "Sub-niche otomatik seçilmemiş"; "AI Dossier verimli çalışmıyor" | DB'de lead bulunamadı (tester ID'sini doğrulayamadı). Sub-niche bug Sorun #5; %100 KPI bug Sorun #2; Dossier bug Sorun #7. | ✅ Hepsi **sistem-seviyesi bug** olarak doğrulandı (başka lead'lerde aynı pattern var). |
| 2 | MC Menamins | "%60/40 yorum oranı yanlış"; "'Payment or Police' phrase halüsinasyon"; "Friendly Staff %67 + Rude Staff %50 çelişki" | DB'de yok. Hallucinated phrase bug Sorun #2 + #3'te kanıtlandı (Coffee & Beyond "Restrictive Policies", Nina & Dean "Outdated menu"). KPI overlap bug Sorun #3'te. | ✅ Sistem-seviyesi bug. |
| 3 | Haven Point | "Casual Dining etiketi yanlış, Hotel and Food olmalı"; "Friendly %76 vs Uninterested %100 çelişki"; "Açıklama bizim çözümle odaklı değil" | DB'de yok. Sub-niche hibrit bug Sorun #5; KPI overlap Sorun #3; opener-vertical bug Sorun #6. | ✅ Sistem-seviyesi bug. |
| 4 | Society Hotel Bingen | "Online order, booking, QR var ama AI hiç görmemiş"; "403 hatası iddiası halüsinasyon"; "4.7 puanlı işletme 3.8 olarak işaretlendi"; "Personalized message tamamen yanlış" | DB'de yok. Crawl 403 mock-error bug — kod `classifyError`'da SSL/TLS bucket'a düşüp rapor "BLOCKED_BY_GUARD" verebilir; lead 5-review limit (Sorun #2) puan etkisi; opener-audit tutarsızlık (Sorun #6). | ✅ Sistem-seviyesi bug + crawler "yanlışlıkla 403 raporu" bug'ı. |
| 5 | Pied a Terre | "QR ve booking doğru tespit edilmiş"; "Açılış mesajı Sipariş entegrasyonu önerisiyle yanlış (Michelin)"; "Delivery işaretli ama yok"; "Personalized Message başarısız" | **DB ile birebir doğrulandı:** has_booking=true, has_ecommerce=true (doğru), services_detected=`["delivery","reservation","menu","lunch","dinner"]` (delivery YANLIŞ POZİTİF — site delivery deneyimi sunmuyor); opener "online ordering" anti-pattern. | ✅ Sub-niche miss (Sorun #5) + opener vertical (Sorun #6) + delivery yanlış pozitif (Sorun #1 token bug) |
| 7 | Coffee & Beyond | "Açılış güzel"; "Internet sitesi yok doğru tespit"; "Wifi'yi Restrictive Policies olarak yanlış"; "Rude staff tek yorumdan alınma" | **DB'de doğrulandı:** Restrictive Policies KPI 12% (1-2 yorumdan), website yok doğru, opener 4 kez 403 ile düştü ama 1 önceki başarılı run'dan output gösteriliyor. | ✅ Sorun #3 (creative cluster label) + Sorun #7 (Gemini 403) |
| 8 | Nina & Dean | "Outdated menü ifadesi halüsinasyon"; "No website kısmen doğru (coming-soon)"; "Pain point doğru"; "Personalized message konuşma tonunda değil"; "Premium paket ok ama düşük de önerilebilir"; "Tek olumsuz yorumdan büyük mesaj" | **DB'de doğrulandı:** weakness_kpi `{"label":"Outdated menu info","percent":100}` — 44 review'dan 1 negatiften %100. crawl_status=NO_WEBSITE rağmen website_url set (Apify enrichment sonradan URL ekledi, audit tekrar çalışmadı). Premium paket recommendation. | ✅ Sorun #2 (small-sample +tek-yorum patlaması) + Sorun #4 (Premium default) + race condition (URL update sonrası audit re-run yok) |
| 9 | Greenwich Nest | "Booking var deniyor ama yok"; "Tek yorum genel alıntıya dönüştü" | **DB'de doğrulandı:** has_booking_system=true (yanlış pozitif, gerçek sitede booking yok); weakness_kpi `{"label":"Food Quality/Taste","percent":86}` — 50 review'da sadece ~4 negatif var, biri food quality. | ✅ Sorun #1 (booking false-pos) + Sorun #3 (tek yorum genelleme) |
| 10 | Black Eye Coffee | "Instagram girdiğinde sistem çuvallıyor"; "Conversion Features booking + ecommerce yanlış"; "Açılış mesajı çok başarılı" | **DB'de doğrulandı:** website_url=`http://instagram.com/blackeyelondon`, has_booking=true, has_ecommerce=true (ikisi de yanlış pozitif — Instagram-as-website bug). | ✅ Sorun #1 (Instagram detection) — direkt kod bug'ı |
| 11 | Blackheath Coffee Co. | Aynı şikayet (Instagram input, booking + ecommerce yanlış); "Competitor Switch'te dog-friendly yanlış kontextte" | **DB'de doğrulandı:** website_url Instagram, audit yanlış pozitif. switch_signals: `[{"to":"Blackheath","from":"Gail's","reason":"dog-friendly, window seats"}]` — gerçek bir review'da Gail's'den dönüş kanıtı var ama "switch_signal" framing'i abartılı. | ✅ Sorun #1 + minor switch_signal threshold (3+'a çıkar) |
| 12 | 15grams Coffee | "QR yok deniyor ama bu işletme için zaten gerek yok"; "Açılışta QR önerisi yanlış (zaten kendi ön sipariş sistemi var)"; "Contact form görülmemiş"; "Loyalty sistemi yok sayılmış"; "Tek olumsuz yorumdan ana sorun çıkarılmış"; "Premium paket yeterli" | **DB'de doğrulandı:** has_contact_form=false (gerçekte var); weakness_kpi unfriendly staff %29 (50 review'da 1-2 negatiften); opener "QR ile sipariş" pitch'i halbuki sitede zaten online order var. | ✅ Sorun #1 (contact form miss) + Sorun #3 (tek yorum patlama) + Sorun #6 (opener-audit tutarsızlık — workspace'in **kendi ürünü** gibi sipariş öneriliyor, mevcut akışı yok sayılıyor) |

**Sayısal özet:**
- 12 işletmeden **11'i** sistem-seviyesi bug'lara takılmış
- En sık bug: **Sorun #1** (crawler hallucination) — 5 işletmede
- En kritik bug: **Sorun #2** (small-sample patlaması) — 2 işletmede %100 KPI bar'ları, 4 işletmede tek-yorum genellemesi
- En zarar verici bug: **Sorun #4** (Premium default) — fiyatlandırma stratejisini doğrudan etkiliyor

---

## 4 · Çözüm Yol Haritası — Öncelik Sıralı

### P0 — 7 gün içinde (acil prod fix)

| # | Aksiyon | Etkilenen sorunlar | Effort |
|---|---|---|---|
| P0.1 | `extractor.ts`'te Instagram-as-website gate + word-boundary regex | #1 | 4 saat |
| P0.2 | `gemini.ts`'te embedding step'i decouple + `SUCCEEDED_NO_MEMORY` status | #7 | 6 saat |
| P0.3 | Gemini API key rotation + 403 health check | #7 | 4 saat |
| P0.4 | `review-analyst.ts`'te min-example=2 filter + `count` field schema | #2, #3 | 6 saat |
| P0.5 | `ServicePackage` re-design VEYA deterministic package selector | #4 | 8 saat |
| P0.6 | UI'da review_count < 10 disclaimer + KPI tooltip absolute count | #2, #3 | 4 saat |

### P1 — 14 gün içinde (kalite ve doğruluk)

| # | Aksiyon | Etkilenen sorunlar | Effort |
|---|---|---|---|
| P1.1 | F&B niche label enum (40-50 standart label) prompt'a injection | #3 | 8 saat |
| P1.2 | `niches/index.ts`: `french_restaurant` + diğer Michelin tipleri eklenmesi | #5 | 4 saat |
| P1.3 | Sub-niche multi-tag schema (`subNicheSlugs[]`) hibritler için | #5 | 12 saat |
| P1.4 | Per-niche `notApplicableModules` listesi, opener'a injection | #6 | 6 saat |
| P1.5 | Audit re-run trigger: Apify enrichment sonrası websiteUrl değişirse WEBSITE_AUDITOR tekrar çalıştır | #1 (Nina & Dean race) | 6 saat |
| P1.6 | Lead-intelligence-brief'i UI'da PRIMARY score olarak göster (Lead detail page) | #8 | 4 saat |

### P2 — 30 gün içinde (uzun vadeli iyileştirme)

| # | Aksiyon | Etkilenen sorunlar | Effort |
|---|---|---|---|
| P2.1 | Workspace `tone` field'ı için 3-5 opener template variant (neighbour/advisor/closer) | #6 | 16 saat |
| P2.2 | Opener constraint katmanı: brief.confirmedFeatures dışında pitch yapamasın | #6 | 12 saat |
| P2.3 | Multi-source scoring confusion → tek score (`salesConfidence`) UI migration | #8 | 8 saat |
| P2.4 | "Manual Override" UI: Sub-niche pick + audit field correction (rep'in 5 saniyede düzeltmesi için) | #5 | 16 saat |
| P2.5 | Beta tester feedback loop'u API: tester `/api/leads/[id]/feedback` ile bug raporlasın, lead-intelligence-brief'in next run'unda data olarak kullansın | global | 24 saat |
| P2.6 | DataForSEO veya alt-tier review scraper FREE tier için (Apify olmadan da 30+ review) | #2 | 16 saat |

---

## 5 · Ne Doğru Çalışıyor? (Sistemi tamamen değiştirme tuzağına düşmeyelim)

Tester'ın raporlarında **olumlu gözlemler** ve DB'de doğruladığım çalışan parçalar:

### 5.1 Kesinlikle çalışıyor

1. **Google Places ingestion + Apify Gmaps Deep enrichment** — FineDine workspace'inde 6/6 lead için 50-500 yorum başarıyla çekildi. Pied a Terre yalnız 5 yorumla kaldı çünkü farklı workspace'te — orada Apify yok.

2. **Sub-niche classifier'ın güvenli alanı** — Cafe / coffee_shop / restaurant gibi yaygın `primary_type` değerleri için doğru sub-niche atanıyor (6/6 cafe lead'i `fnb-cafe-bakery` aldı, confidence 0.6-0.9). **Sadece** edge case'lerde (Michelin, hibrit hotel) takılıyor.

3. **Sentiment breakdown yön doğruluğu** — `sentimentBreakdown.positive/negative` oranları gerçek tester gözlemiyle uyumlu (Pied a Terre 80% positive doğru; Greenwich Nest 86% positive doğru; vs). Sadece KPI bar'lardaki yüzdeler küçük örnekleme problemine düşüyor.

4. **Switch signal detection** — Pied a Terre'de "switched from a few previously" + Nina & Dean'de "Best coffee in London" + Blackheath'te "switched from Gail's" sinyalleri yakalanmış. Bu **ölçülebilir bir kompetitor intelligence** çıktısı.

5. **Workspace customization context** — `offerName`, `valueProposition`, `language=tr`, `targetSubNiches` array'i scorer'a doğru geçiyor; Türkçe opener çıkıyor; targetSubNiches eşleşmesi `icp_fit` reason_code'una dönüşüyor.

6. **Audit grafik veriler** — `loadTimeMs`, `https`, `mobileFriendlyGuess`, `structuredDataPresent` gibi binary/numeric field'lar doğru. 15grams için load_time_ms=3908 (yavaş), Pied a Terre 432 (hızlı), Greenwich Nest 541 — hepsi gerçek.

7. **Pipeline observability** — `agent_runs` tablosu her worker'ın start/finish/error'ını detaylı tutuyor; bug analizi yapmak (bu rapor) sayesinde mümkün oldu.

### 5.2 Tester'ın doğrudan beğendiği parçalar

- 15grams opener (tester düzeltti ama temel akış doğruydu)
- Coffee & Beyond opener (tester'ın yazdığı versiyon AI çıktısına çok yakın)
- Pied a Terre QR + booking + e-commerce binary detection (Michelin restoran için **doğru** binary değerler)
- Black Eye opener (*"Açılış mesajını oldukça başarılı ve güzel şekilde yazmış çok beğendim değiştirmeye dahi ihtiyaç olmadan gönderilebilir vaziyette"*)
- Blackheath opener (aynı geri bildirim)
- Sosyal medya hesabı tespiti (Black Eye, Blackheath, Pied a Terre Instagram/Facebook/TikTok URL'leri doğru)

---

## 6 · Beta Testten Çıkan Stratejik Tavsiyeler

### 6.1 Beta tester süreci — gözlemler

Tester bilinçli olarak teknik bilgi olmadan kullanıma alındı, bu **çok değerli bir avantaj**: kullanım sırasında "Bu sayı niye bu?" sorusunu sorabilen bir kullanıcı, mühendislerin testten kaçırdığı UX problemlerini yakalıyor. Spesifik öneriler:

1. **Tester'a ID copy-paste yerine link veya QR ver** — Raporda 4 işletmede aynı ID birden fazla yere yapıştırılmış; bu DB doğrulamasını engelliyor. Lead detay sayfasında "Bu lead'i raporla" butonu (mailto + ID auto-fill) eklenirse bu hata sıfırlanır.

2. **Tester feedback loop'u sisteme entegre et** — `/api/leads/[id]/feedback` endpoint'i + UI'da her KPI bar'ın altında "👍 / 👎 / Yanlış" butonu. Negatif feedback'ler `BetaFeedback` tablosuna düşer, sonraki review-analyst run'ı bu satırları "previous-run errors" context'i olarak prompt'a alır.

3. **Tester'ın Türkçe iyileştirilmiş opener'ları workspace'in `OPENER_SUCCESS` memory'sine yaz** — Tester her opener için "Güçlendirilmiş AI konuşması" yazdı. Bunlar `SemanticMemory` `OPENER_SUCCESS` rows olarak embed edilirse, opener-writer'ın few-shot retrieval'ı bu örneklere göre öğrenir. Şu an manuel olarak ekleyebilir veya seed script (`scripts/seed-opener-success.ts`) yazabilirsin.

### 6.2 Açıklanabilirlik (Explainability) — sistemin ekonomik değeri

Tester'ın "X niye böyle çıkmış?" sorusu sistem boyunca tekrarlıyor. **Her AI çıktısının yanına "neden" göstermek**:

- KPI bar tıklanınca: **hangi yorumlar bu KPI'ya katkı yaptı** (örn. "Outdated menu info" tıklayınca o tek pain phrase'in geçtiği review pop-up'ı)
- Recommended package için: **hangi pain → hangi feature → hangi tier** mantığı görünür
- Sub-niche kararı için: **Rule-based mi, Gemini fallback mı, hangi sinyaller** açıkça yazılı

Bu, sadece beta tester için değil, **rep'in ileride müşteriye satarken "AI bunu nasıl çıkardı?" sorusuna cevap vermesi için** kritik.

### 6.3 "Bilmiyorum" demek bir özellik

Pied a Terre'de sub-niche null kalmasına rağmen sistem **sessizce parent fallback'e düşüyor**. Bunun yerine:

- Lead detail page'de "**⚠️ Sub-niche belirlenemedi** (confidence 0.3) — Fine dining mi, Hotel restaurant mı? Manuel seçin." sticky banner çıksın.
- Aynı pattern audit, opener, package için: Sistem belirsizse, **"low confidence" rozetiyle birlikte göster**, kullanıcının doğrulamasına izin ver.

Bu, **hallucination'a karşı en güçlü insan-in-the-loop savunmasıdır**.

---

## 7 · Sonuç

LeadAC AI Beta'sı **temel altyapı seviyesinde sağlam** ama **çıktı katmanında 6 ciddi sistemik bug** taşıyor. Bug'ların hepsi:
1. Beta tester tarafından bağımsız olarak fark edildi
2. DB verisinde birebir doğrulandı
3. Koddaki tek bir kök nedene indirgenebildi
4. P0 olarak 7 gün içinde fix edilebilir

En kritik 3 önceliğim:
1. **Crawler Instagram-as-website fix** (P0.1) — En çok etkilenen lead grubu, en kolay fix
2. **Embedding decouple + status ayrıştırma** (P0.2) — Sessiz veri kaybını durdurur, rep güvenini geri getirir
3. **Package recommendation deterministic + Base re-design** (P0.5) — Doğru fiyatlandırma satışın özü, "her lead'e Premium" yapısal bir sorun

Beta tester'ın gözlemleri **product-market fit testi olarak inanılmaz değerli** — bu rapordaki bug'ların yarısı, mühendislerin internal testle yakalayamayacağı UX hassasiyetinde noktalardı. Tester'ın sürecini **resmi bir feedback loop'a** çekmek (Bölüm 6.1) sistemin gelecekteki kalite kontrol mekanizmasıdır.

---

## Ek A · Doğrulama için kullanılan SQL sorguları

```sql
-- Workspace + üyelik
SELECT u.email, w.name, w.niche, w.offer_name, w.value_proposition, w.target_sub_niches
FROM users u
LEFT JOIN workspace_members m ON m.user_id = u.id
LEFT JOIN workspaces w ON w.id = m.workspace_id
WHERE u.email ILIKE '%finedine%';

-- Lead snapshot
SELECT id, business_name, sub_niche_slug, sub_niche_confidence,
       rating, review_count, website_url, crawl_status, analyze_status
FROM leads WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b';

-- Audit anomalileri
SELECT lead_id, has_booking_system, has_ecommerce, has_contact_form,
       services_detected
FROM website_audits WHERE has_booking_system = true
  AND lead_id IN (SELECT id FROM leads
                  WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b'
                  AND website_url ILIKE '%instagram%');

-- Embedding failures
SELECT lead_id, worker_kind, error_msg, finished_at
FROM agent_runs
WHERE error_msg ILIKE '%embed%' OR error_msg ILIKE '%403%'
ORDER BY finished_at DESC;

-- KPI patlaması (≥3 KPI %100)
SELECT lead_id, jsonb_array_length(weakness_kpis::jsonb) as cnt
FROM review_analyses
WHERE weakness_kpis::text ILIKE '%"percent":100%';
```

## Ek B · Bu raporda referans verilen kod dosyaları

- `src/lib/extractor.ts` (booking/ecommerce keyword detection — Sorun #1)
- `src/lib/crawler.ts` (Instagram URL gate eklenecek — Sorun #1)
- `src/lib/agent-workers/google-places-reviews.ts` (5-review limit — Sorun #2)
- `src/lib/agent-workers/review-analyst.ts` (grounding — Sorun #2, #3)
- `src/lib/prompts/review-analysis-prompt.ts` (KPI definition — Sorun #2, #3)
- `src/lib/agent-workers/sales-opportunity-scorer.ts` (package recommendation — Sorun #4)
- `src/lib/gemini.ts` (`analyzeLeadWithGemini`, package prompt block — Sorun #4)
- `src/lib/niches/index.ts` (sub-niche classifier hints — Sorun #5)
- `src/lib/agent-workers/subvertical-classifier.ts` (rule-based + Gemini fallback — Sorun #5)
- `src/lib/agent-workers/opener-writer.ts` (vertical anti-pattern — Sorun #6)
- `src/lib/agent-workers/execute.ts` (embedding step crash — Sorun #7)

