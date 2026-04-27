# Bir FineDine Günü — LeadAC v2 ile Saha Senaryosu

> 11 niche pack + sub-vertical classifier + version-stamped pipeline + dual-scope memory tamamlandığında FineDine satış ekibinin yaşayacağı somut deneyim. Kod referansları gerçek dosya yollarına bağlıdır; senaryo halen v0.9 build üzerinde simule edilebilir.

---

## Cast

| Karakter | Rol | Coğrafya | Workspace seat |
|---|---|---|---|
| **Erol Demirtaş** | Regional Sales Manager (EU & UK) | Londra | OWNER |
| **Cansu Aksoy** | Inside Sales Specialist | Istanbul | MEMBER |
| **Berk Yıldız** | Inside Sales Specialist | Istanbul | MEMBER |
| **Selin Kaya** | KAM (Hotel & Chain segment) | Istanbul | ADMIN |

Workspace adı: **FineDine — Outbound EMEA**, plan: PRO_TEAM, niche: `RESTAURANT_TECH`.

---

## Hafta 1 — Onboarding ve İlk Discovery

### Pazartesi 09:14 — Erol workspace'i kurar

Onboarding wizard'ında niche seçimi: **Restaurant Tech (QR menu / digital ordering)**. Form (`src/components/app/offer-form.tsx`) `RESTAURANT_TECH_DEFAULTS`'tan offer name + hook'u prefill eder.

Eklenen yeni alan: **"Hangi F&B alt-dikeyleriyle ilgileniyorsunuz?"**

Erol seçer:
- ✅ Fine Dining
- ✅ Bar & Club
- ✅ Hotel F&B
- ✅ Multi-location / Chains
- ⬜ Ghost Kitchen (henüz değil)
- ⬜ Food Truck (target değil)
- ⬜ Casual Dining (volume düşük ACV)
- ⬜ QSR (Pizza Hut zaten kapalı)
- ⬜ Cafe & Bakery (Premium plana giremez)
- ⬜ Airport F&B (BD ekibinin alanı)

Bu seçim `Workspace.targetSubNiches: string[]` olarak saklanır. Discovery picker bundan filtrelenir, **classifier prompt scope'u da bu 4 child'a daralır** → confidence yükselir, ambiguity düşer.

### Pazartesi 09:32 — İlk Discovery: "Dubai F&B"

Erol Discovery sayfasında:
- Vertical: **F&B** (parent, otomatik)
- Sub-vertical: **"Tüm seçili (4)"** (auto-classify mode)
- Lokasyon: Dubai, BAE
- Limit: 200 lead

Arka planda olanlar (`src/lib/discovery/fanout.ts` — Faz 9):

```
4 paralel Google Places query (her child'ın searchQueries[0]):
  - "fine dining restaurant" Dubai      → 73 result
  - "cocktail bar" Dubai                → 58 result
  - "hotel restaurant" Dubai            → 61 result
  - "restaurant chain" Dubai            → 44 result
Dedup by Place ID                       → 178 unique lead
```

Discovery UI gerçek zamanlı:
```
✓ fine dining restaurant     [73]
✓ cocktail bar              [58]
✓ hotel restaurant          [61]
✓ restaurant chain          [44]
─────────────────────────────────
Toplam: 178 unique lead (deduped 58)
```

### Pazartesi 09:35 — Pipeline arka planda dönmeye başlar

Her lead için chain (`src/lib/ai-core/chains.ts`):

```
WEBSITE_AUDITOR  →  VERTICAL_SUBVERTICAL_CLASSIFIER  →  OPENER_WRITER  →  WEBSITE_MOCKUP
```

Classifier worker (`src/lib/agent-workers/vertical-subvertical-classifier.ts`) iki katmanlı:

**Katman 1 — Rule-based (deterministic, $0):**

```ts
// 178 lead'in 134'ü buradan çıkar (75%)
if (hasOnlineReservation && bookingProvider === "OpenTable" && priceLevel >= 4)
  → fnb-fine-dining (conf 0.92)

if (name.match(/\b(bar|club|lounge|tavern|speakeasy)\b/i))
  → fnb-bar-club (conf 0.88)

if (name.match(/\b(hotel|resort|suites|grand)\b/i))
  → fnb-hotel-fnb (conf 0.95)

if (chainCount >= 3 || name in knownChains)
  → fnb-multi-location (conf 0.85)

// confidence < 0.85 → katman 2'ye düş
```

**Katman 2 — Gemini (44 ambiguous lead):**

Workspace.targetSubNiches'e scope'lu, structured output `{ subNicheSlug, confidence, reasoning }`. Toplam cost: **$0.18**.

Sonuç dağılımı 09:47'de:

| Sub-niche | Count | Avg confidence | Source mix |
|---|---|---|---|
| 🍷 Fine Dining | 51 | 0.89 | rule 42 / gemini 9 |
| 🍸 Bar & Club | 38 | 0.86 | rule 31 / gemini 7 |
| 🏨 Hotel F&B | 47 | 0.91 | rule 39 / gemini 8 |
| 🏢 Multi-location | 29 | 0.81 | rule 22 / gemini 7 |
| ⚠️ Uncategorized | 13 | <0.7 | gemini hepsi |

13 "uncategorized" lead düşük confidence → pipeline **generic F&B opener** ile gider, yanlış vertical pitch atılmaz (`P0.4 confidence gate`).

### Pazartesi 09:51 — Erol lead listesini açar

Filter chip'leri:
```
[ Tümü 178 ]  [ 🍷 Fine 51 ]  [ 🍸 Bar 38 ]  [ 🏨 Hotel 47 ]  [ 🏢 Chain 29 ]  [ ⚠️ Uncat 13 ]
```

🏨 Hotel filtresine basar — 47 lead. İlk lead: **Burj Al Arab — Al Mahara**.

```
Burj Al Arab — Al Mahara                    [ 🏨 Hotel F&B  •  auto  •  0.94 ]

Audit (sub-niche specific):
  ✗ No in-room ordering CTA           [critical]
  ✗ No room-charge integration         [critical]
  ✗ Spa+restaurant siloed pages        [important]
  ✗ Single-property menu (no group)    [important]
  ✓ Has OpenTable reservation
  ✓ Has Instagram embed

Opener (Gemini, EN, ChainContext: hotel-fnb):
  Subject: Al Mahara'nın spa-side menüsü için 4 dakikalık not

  Berk merhaba —

  Burj Al Arab properties'inizde spa-yan-restaurant cross-sell akışı 
  Mahara'dan ayrı oturuyor; FineDine'ın hotel directory'sinde aynı 
  guest CRM ID'si Spa Stamp + Mahara reservasyonunu tek profile 
  bağlıyor. Mövenpick Bahrain'de bu kurulum cross-property check'i 
  oda-bazına %22 büyüttü.

  Mockup'ı 8 saat önce hazırladım — Mahara'nın menüsünü room-charge 
  flow'u üstüne bindirmiş hali: [link]

  Çarşamba 14:30 GMT bir 15 dk?

  Erol
```

Mockup linki `templates/hotel-fnb-roomcharge.html` (Faz 11 handcrafted üçlünün sonra eklenenlerinden) — gerçek Mahara menüsü Gemini ile doldurulmuş, room-charge button'ı belirgin. Email içeriği mockup'ın gerçekten gösterdiği şeyle **uyumlu** (`P1.3 template-aware constraint`).

---

## Hafta 2 — Override + Memory Birikmesi

### Salı 14:08 — Cansu (Istanbul) bir bar üzerinde sallanır

Cansu Istanbul ofisinden aynı workspace'e bağlanır. Filtresini 🍸 Bar'a çevirir, **Fairmont Cigar Lounge** lead'ini açar.

```
Fairmont Cigar Lounge                     [ 🍸 Bar & Club  •  auto  •  0.78 ]

Audit:
  ✗ No QR pay + tab split
  ✗ No event calendar  
  ✗ No age verification

Opener writes about:
  - tab-split UX
  - event calendar (cigar tasting nights)
  - age verification at entry
```

Cansu hata sezer: bu Fairmont **otelinin içinde**, bağımsız bar gibi pitch'lemek yanlış — hotel F&B yöneticisi tek karar mercii. Override butonuna basar:

```
Override sub-niche:
  ⬜ 🍷 Fine Dining
  ⬜ 🍸 Bar & Club  (current)
  ✅ 🏨 Hotel F&B
  ⬜ 🏢 Multi-location
  ⬜ ⚠️ Uncategorized
  
  [ Save & re-run pipeline ]
```

Save'e bastığı an arka planda olanlar:

```
1. PATCH /api/leads/[id]/sub-niche
   → Lead.subNicheSlug = "fnb-hotel-fnb"
   → Lead.subNicheSource = MANUAL
   → Lead.subNicheVersion: 0 → 1   (P0.3)

2. Stale-check: AgentRun.inputSubNicheVersion = 0 olan in-flight runlar 
   bayrak görür, run() başında early-exit (kaynak yakmıyor, 
   yanlış sonuç DB'ye yazılmıyor)

3. Yeni audit + opener + mockup runs enqueue (inputSubNicheVersion = 1)

4. Memory: önceki yanlış subniche için OPENER_FAILURE writeMemory 
   tetiklenmedi çünkü daha email atılmadı. Pipeline silinir.

5. (v1.1 backlog) ClassifierTrainingExample row yazılır:
   { predicted: bar-club, corrected: hotel-fnb, conf: 0.78, source: "rule" }
```

42 saniye sonra Cansu refresh eder:

```
Fairmont Cigar Lounge                  [ 🏨 Hotel F&B  •  manual  •  edited 09:32 ]

Audit (yenilendi):
  ✗ No in-room ordering
  ✗ No room-charge integration
  ✗ Spa+lounge cross-sell missing

Opener (yenilendi):
  Berk hocam —
  
  Fairmont'ta lounge → spa → room-service üçgeni şu an 3 farklı 
  sistemde duruyor; FineDine'ın property-wide guest ID'si bu 
  3 nokta arasında preference taşıyor. Lounge'da puro tercih 
  eden misafir spa rezervasyonunda da o profil...
  ...
```

Cansu içeriği okur, 30 saniye edit eder, gönderir.

### Çarşamba 11:20 — Selin (KAM) Mövenpick Bahrain reply'ı alır

Erol'un Pazartesi gönderdiği opener'a **F&B Director Mövenpick Bahrain reply atar**: "Çarşamba 14:30 müsait."

Cansu reply'ı gördü, dashboardda thumbs-up'a basar → `OPENER_SUCCESS` write tetiklenir (`src/lib/ai-core/memory.ts` — Faz 7).

Memory dual-write semantiği (`P1.2`):

```ts
// POSITIVE signal → child + parent
INSERT INTO semantic_memory (kind, niche_scope, content, embedding, ...)
  VALUES ('OPENER_SUCCESS', 'fnb-hotel-fnb', '<opener content>', vec, ...);
INSERT INTO semantic_memory (kind, niche_scope, content, embedding, ...)
  VALUES ('OPENER_SUCCESS', 'fnb', '<opener content>', vec, ...);
```

Child + parent ikisinde de bulunur. Parent (`fnb`) cross-niche havuz olarak servis eder.

### Cuma 16:50 — Berk yeni hotel'e yazıyor — memory devreye giriyor

Berk Riyadh'da bir Four Seasons property'sine yazacak. Lead detayda **Composer** sekmesi:

```
Generating opener...
Pre-fetched memory:
  - Top 3 OPENER_SUCCESS in scope=fnb-hotel-fnb (child priority, weight 1.0)
    [Mövenpick Bahrain ✓, Raffles Istanbul ✓, Marriott Marquis Dubai ✓]
  - Top 2 OPENER_SUCCESS in scope=fnb (parent broad, weight 0.5)
    [Hilton Garden Inn — fine-dining context, deduped from above]
```

Few-shot olarak Mövenpick'in başarılı yapısı + property-wide guest ID açısı çıkar. Berk'in Riyadh emaili 4 dakikada ready, F&B Director'a Erol'un yazdığı stille gider.

**Bu döngü = ekip büyüdükçe LeadAC akıllılaşır.** 4 satışçı 6 ay içinde:

```
fnb-hotel-fnb scope:    47 OPENER_SUCCESS, 12 OPENER_FAILURE
fnb-fine-dining scope:  31 OPENER_SUCCESS,  8 OPENER_FAILURE
fnb-bar-club scope:     22 OPENER_SUCCESS,  6 OPENER_FAILURE
fnb (parent):           100 OPENER_SUCCESS  (cross-pollination)
                          0 OPENER_FAILURE  (negative dual-write yok!)
```

Negative dual-write engelli olduğu için bar'da işlemeyen bir pattern, hotel few-shot'larına sızmaz.

---

## Ay 1 Sonu — Kullanıcı Metrikleri Cephesi

### Erol'un PRO_TEAM dashboard'u

```
FineDine — Outbound EMEA  •  Period: Apr 1-30, 2026

Leads created                     1,847
  ├ fnb-fine-dining                 421
  ├ fnb-hotel-fnb                   562
  ├ fnb-bar-club                    389
  ├ fnb-multi-location              298
  └ uncategorized                   177

Classifier accuracy (override rate)
  ├ Rule-based source              4.2%   ← healthy, regex tightened twice
  └ Gemini fallback source         11.8%  ← within target

Sub-niche source mix
  ├ AUTO                          92.4%
  └ MANUAL (override)              7.6%

Outreach
  ├ Emails sent                   1,124
  ├ Reply rate (overall)           9.3%   ← v1: 4.1%, v2: 9.3%
  ├ Reply rate by sub-niche
  │   - hotel-fnb                 12.4%
  │   - fine-dining               10.1%
  │   - bar-club                   7.8%
  │   - multi-location            10.6%
  │   - uncategorized              4.2%   ← generic fallback, expected
  └ Meetings booked                  47
       (target: 35)

Memory growth
  ├ OPENER_SUCCESS                 152   (+152 vs Mar)
  ├ OPENER_FAILURE                  39   (child-only, +39)
  └ LEAD_PROFILE                 1,847
```

Reply rate Mart ayında v0.9 ile **4.1%** idi (single restaurant pack). Nisan v2 ile **9.3%** — sub-niche specific pitching netice verdi. Hotel F&B en yüksek (12.4%) çünkü Mövenpick reply'ı ile başlayan memory zinciri artık 47 OPENER_SUCCESS biriktirmiş, her yeni hotel emaili o havuzdan few-shot çekiyor.

### Cost cephesi

```
Gemini token usage (1,847 lead)
  ├ WEBSITE_AUDITOR              ~$8.20
  ├ CLASSIFIER (rule + gemini)   ~$1.15   ← 75% rule-only saved $4
  ├ OPENER_WRITER                ~$11.40
  └ WEBSITE_MOCKUP               ~$24.30
                          Toplam: $45.05
                                 
Apify (Google Places + audit)   ~$22
Total infrastructure:            ~$67/ay
```

Plan: PRO_TEAM = $99/seat × 4 = $396/ay → **margin %83**, healthy.

---

## Ay 3 — Selin Enterprise Pitch'i Veriyor

Selin (KAM) **Land of Legends Antalya** ile ilgileniyor — resort grup, 5 restoran, 2 bar, 3 havuz-yan snack noktası. Discovery'de single lead olarak girilemiyordu çünkü "resort F&B" tek lokasyon değil.

v1.1 backlog'undaki **multi-property aggregator** açıldığında:

```
Resort Group Discovery: "Land of Legends Antalya"
  → Google Places returns 1 parent + 9 child venues
  → Classifier: parent=fnb-multi-location, children individual sub-niches
  → Aggregated audit: cross-property gaps surfaced
```

Selin demo'da 9 venue'nun **single dashboard**'da görüldüğünü gösterir → resort GM "evet, bizim de hep bunu istiyorduk" der → Enterprise contract $2,400/ay × 12 ay imzalanır.

LeadAC tarafında bu deal'ın LeadAC'ye dönüş yansıması:
- 1 OPENER_SUCCESS (high-value enterprise tag)
- ClassifierTrainingExample 9 satır (her venue subniche)
- Memory parent scope'a güçlü bir resort-context kalıbı yazar → bir sonraki resort'ta pitch hazır

---

## Saha Hikayeleri — Niche Pack Kazanç Anekdotları

### "Speakeasy edge case" — sub-niche dictionary genişler

Cansu Şubat'ta Berlin'de **Buck and Breck** (gizli speakeasy) lead'ini açar. Classifier "fnb-bar-club" der (confidence 0.81). Ama bu yer reservation-only, 14 koltuk, $300 menü — operasyonel olarak fine dining gibi.

Cansu override'lar → fnb-fine-dining. 3 hafta sonra 4 benzer speakeasy override'ı birikince:

```
Admin dashboard alert:
  classifier_training_examples
  WHERE predicted = fnb-bar-club AND corrected = fnb-fine-dining
  Count: 7 (last 30d)
  
  Common predictor: name contains "speakeasy" OR "cocktail bar"
  Suggested rule: if priceLevel >= 3 AND seats < 30 → fine-dining override
```

Engineering rule'u tightener — 7 satışçı saatlik el-emeği LeadAC'nin kendi prompt'una geri besler.

### "Cloud kitchen wave" — yeni sub-niche'in market gücü

Ekim 2026: BAE'de **Kitchen United** model 30+ ghost kitchen markası açar. Erol Discovery'de *"ghost kitchen Dubai"* der → 67 lead. Hepsi `fnb-ghost-kitchen` (workspace.targetSubNiches'e eklemek için Erol Settings → Niche scope'a girer, "Ghost Kitchen" check'ler).

Audit checklist'i o gün sub-niche dallanmasındaki ghost-kitchen branch'ini kullanır:
- ✗ "Delivery only via UberEats/Deliveroo (paying 30% commission)"
- ✗ "No own ordering site"
- ✗ "No commission-free CTA"

Opener pitch açısı: **"FineDine'ın komisyonsuz ordering linki UberEats'e ödediğin %30'u cebinde tutar — bir markanın aylık $4,800 net kazancı."**

Bu pitch fine dining'a saçma, hotel F&B'ye irrelevant — ama ghost kitchen için ekonomik damarın tam ortası. 67 lead'den **14 reply** (%21).

---

## Negatif Senaryolar — Sistem Nerede Yumuşak Yer Hisseder

### Edge case 1: Çok dilli lead, opener writer Türkçe-İngilizce karışık

Berk **Bodrum Mandarin Oriental** için Türkçe opener yazsın istiyor (workspace.language = `en` default ama lead `country=TR`). Şu an Faz 6'da Gemini prompt sub-niche injection var ama dil per-lead override yok.

**Çözüm v1.1 (Localized<T> refactor):**

```ts
const lang = lead.country === "TR" ? "tr" : workspace.language;
const niche = getNicheBySlug(lead.subNicheSlug);
const pitchAngle = localized(niche.pitchAngle, lang);
const signals = localized(niche.highValueSignals, lang);
```

Day-one'da Berk manuel Settings → Language değiştirir, opener Türkçe çıkar. Mağdur olmaz ama tek-lead-için-language-toggle backlog'a düşer.

### Edge case 2: Override sonrası mockup invalidate yapmadı

Cansu Şubat'ta override yaptığında Faz 11 mockup template chain henüz fine-dining + bar + qsr handcrafted — Fairmont hotel-fnb için generic fallback. Mockup re-render olur ama görsel olarak öncekiyle aynıdır (generic template).

Cansu manuel olarak Composer'da "Mockup linki dahil etme" checkbox'ı açar, link'siz email atar. Mockup-template parity backlog'da, hotel-fnb handcrafted templating Mart'ta gelir.

### Edge case 3: Workspace 4 seat ama discovery quota PRO_TEAM cap'inde

Aylık 1,847 lead = PRO_TEAM cap'inin (3,000) %62'si. Ekim'de Erol agresif Riyadh push'una girdi → 850 lead/hafta atmaya kalktı, 3,200 cap'i aştı. UI **"Plan: PRO_TEAM, 3,200/3,000 used — soft cap, additional leads queue overnight"** banner gösterir, AGENCY upsell prompt'u Selin'e KAM olarak ATAĞA dönüşür.

---

## Kapanış — FineDine'ın Cüzdan ve Voice Tarafı

**6 ayın sonunda LeadAC FineDine için ne demek:**

| Boyut | v0.9 (single restaurant pack) | v2 (sub-niche aware) |
|---|---|---|
| Reply rate (overall) | 4.1% | 9.3% |
| Meetings/month | 18 | 47 |
| Manuel triage saatı/ay | ~22 saat (3 SDR × 7.5 saat) | ~3 saat (sadece override) |
| Opener voice tutarlılığı | ekip-içi sapma yüksek | memory dual-write ile homojen |
| Yeni satışçı onboarding | 2-3 hafta voice öğrenme | 3 gün (memory'den few-shot çıkıyor) |
| Cost/lead | $0.05 | $0.04 (rule-based classifier saving) |
| Yeni vertical eklemek | 1 ekip × 2 hafta | 1 PR × 1 gün (NICHES dizisine satır) |

**Voice cephesi en görünmez kazanç**: 4 satışçı 6 ay içinde memory havuzuna 152 OPENER_SUCCESS bıraktı. Yeni katılan SDR (örn. Polonya pazarı için Eylül'de gelen Tomek) ilk gününde geçmiş 152 başarının few-shot'larıyla yazıyor → 1 haftada Erol kalibrasyonuna ulaşıyor. Bu, eski LeadAC'de 6 hafta sürerdi.

**FineDine CEO'nun yıllık review sunumunda LeadAC'ye 1 cümle:**

> *"Saha ekibi büyüdükçe email reply rate'imizin düşmesi gerekirdi — eskiden öyleydi. LeadAC v2 ile tam tersi oldu: 4 SDR'dan 7'ye çıkarken reply rate 9.3%'ten 11.1%'e tırmandı, çünkü her yeni SDR ekibin 6 aylık başarı havuzunu hazır miras aldı."*

Bu, plan v2'nin gerçek değer önermesi.

---

## Ek — Kalan v1.1 Backlog'unun FineDine Üzerindeki Net Etkisi

| Backlog item | FineDine için ay-içi etki |
|---|---|
| `SubNicheSlug` Prisma enum | Görünmez, type-safety internal |
| `Localized<T>` refactor | Türkçe pitch'ler nüansını kaybetmez (özellikle Antalya/Bodrum hotel için) |
| `ClassifierTrainingExample` tablosu | Speakeasy override'ları rule'a dönüşür → Cansu'nun el-emeği azalır |
| Multi-property aggregator | Resort/chain enterprise pitch'leri tek dashboard, $2k+ ACV deal'lar açılır |
| Per-subniche eval cron | Override > 25% sub-niche'lerde admin alert → classifier tuning |
| Handcrafted template parity (10 template) | Mockup linkindeki vertical-spesifik UI tutarlılığı; reply rate'e ek 1-2pp |

İlk 4 zaten v1 ship oldu (schema + niches + audit + classifier + opener + memory + version + discovery fan-out). Kalan 6 backlog item, FineDine'ın 3.-6. ayına yayılır, her biri reply rate'e veya margin'e ekstra 1-2pp katar.

---

*Senaryo, mevcut `src/lib/agent-workers/registry.ts`, `src/lib/ai-core/chains.ts`, `src/lib/niches/index.ts` ve `prisma/schema.prisma` üzerinde simule edilebilir. Gerçek FineDine credentials gerektiren tek adım: `OFFER` ayarına Mövenpick + Burj Al Arab gibi opener success örneklerini onboarding wizard'ında manuel paste etmek (cold-start için memory seed).*
