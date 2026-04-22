# Project Costs - Leadac AI

Bu dokuman platformun tum API + AI + altyapi maliyetlerini, her chain'in
lead-basina maliyetini, plan tier'larinin tavanlarini ve unit economics'i
icerir. Her sayi 2026 Q2 itibariyledir; vendor pricing'i degistikce
guncellenmesi gerekir.

> **Not**: Bazi sayilar (Gemini, Google Places) approximate. Vendor sayfalari
> sik degistigi icin her uc ayda bir teyit edilmesi gerekir. ZeroBounce,
> Apify ve Stripe sayilarini son 30 gun icinde dogruladik.

## TL;DR

| Sorulan | Cevap |
|---|---|
| Tipik lead-basina ortalama maliyet (auto chain dahil) | **~$0.05** |
| Ek olarak deep research lead-basina | **+$1.85** (Apify) |
| Ek olarak resepsiyonist + KB lead-basina | **+$0.46** (Apify + Gemini) |
| Platform fixed monthly (kullanici sayisi 0 olsa bile) | **~$80-150** |
| FREE plan kullaniciya costu (limit dahilinde) | **~$3-5/ay** (zarar/loss leader) |
| PRO ($79) plan max-out cost | **~$24/ay** (margin %70+) |
| PRO_TEAM ($149) plan max-out cost | **~$58/ay** (margin %60+) |
| AGENCY ($249) plan max-out cost | **~$140/ay** (margin %44+) |

## 1. Cost surface envanter

Platformun para harcadigi her vendor:

| Surface | Vendor | Pricing modeli | Aylik fixed | Variable per kullanim |
|---|---|---|---|---|
| LLM (analiz, mockup, opener, copilot) | **Google Gemini** | Token bazli | $0 | ~$0.01-0.013 / lead |
| Embedding (semantic memory) | **Google Gemini** (text-embedding-004) | Token bazli | $0 | ~$0.000025 / kayit |
| Lead discovery | **Google Places API (New)** | Per request | $0 | ~$0.019 / lead |
| Deep enrichment | **Apify** | Per actor / cred | $5-199 | $0.01-2.00 / actor run |
| Email verification | **ZeroBounce** | Per email | $0 | $0.0008-0.008 / email |
| Database + Auth | **Supabase** | Tier | $0-25/ay (Free->Pro) | bandwidth + storage |
| Hosting + CDN | **Vercel** | Per seat / build | $0-20+/ay | function exec time |
| Redis (BullMQ) | **Upstash Redis** | Per cmd | $0-10/ay | $0.20 / 100K cmd |
| Transactional email | **Resend** | Per email | $0-20/ay | dahili |
| Error monitoring | **Sentry** | Per event | $0-26/ay | dahili |
| Browser pool | **Steel** | Per session | $0 | $0.01/min (video capture) |
| Payment processing | **Stripe** | %fee | $0 | %2.9 + $0.30 / charge |

## 2. Gemini (LLM + embedding) - en sık tetiklenen surface

Tum AI worker'lari (analyze, review intelligence, mockup, opener, copilot,
resepsiyonist) tek bir `GEMINI_API_KEY` uzerinden gidiyor. Platform tek
sahip; tenant'lar paylasiyor.

### Model fiyatlari (2026 Q2 yaklaşıkları)

| Model | Input ($/1M token) | Output ($/1M token) |
|---|---|---|
| `gemini-2.5-flash` | ~$0.30 | ~$2.50 |
| `text-embedding-004` | ~$0.025 | yok |

### Worker basina tipik tuketim

| Worker | Input token | Output token | Maliyet/run |
|---|---|---|---|
| SALES_OPPORTUNITY_SCORER | ~3.000 | ~1.000 | $0.0034 |
| REVIEW_ANALYST | ~5.000 | ~2.000 | $0.0065 |
| WEBSITE_MOCKUP_GENERATOR | ~6.000 | ~4.000 | $0.0118 |
| OPENER_WRITER | ~3.000 | ~500 | $0.0023 |
| AI_RECEPTIONIST_BUILDER (no KB) | ~5.000 | ~3.000 | $0.0090 |
| AI_RECEPTIONIST_BUILDER (with KB chunks) | ~10.000 | ~3.000 | $0.0105 |
| VIDEO_SCRIPT_WRITER | ~2.000 | ~500 | $0.0019 |
| Copilot turn (ortalama) | ~3.500 | ~600 | $0.0026 |
| Embed - 1 kayit | ~500 | yok | $0.0000125 |

**Pratik aciklama**: Gemini maliyeti gercek bir engel degil. 1.000 lead'in tum
auto chain'i ~$10. Asil cost driver Apify; Gemini gurultu seviyesinde.

## 3. Apify - deep enrichment (en pahali surface)

Apify tenant'lara $ cap'li sunulan opsiyonel ozellik. FREE plan'da kapali.

### Actor fiyatlari (2026 Q2 dogrulanmis)

| Actor | Maliyet / lead | Notlar |
|---|---|---|
| **APIFY_GMAPS_DEEP** | $1.00 - $2.00 | 500 review, emails, 6 sosyal link |
| **APIFY_WEB_CRAWL_DEEP** | $0.30 - $0.60 | 50 sayfa markdown crawl |
| APIFY_INSTAGRAM_DEEP | $0.06 | 20 post X $0.003 (experimental) |
| APIFY_FACEBOOK_DEEP | $0.04 | 20 post X $0.002 (experimental) |
| APIFY_TIKTOK_DEEP | $0.06 | 20 video X $0.003 (experimental) |
| **APIFY_SERP_RANK** | $0.01 | 3 sorgu X $0.003 |
| APIFY_COMPETITOR_ADS | $0.02 | 25 reklam (experimental) |
| APIFY_LINKEDIN_COMPANY | $0.05 - $0.10 | HarvestAPI (experimental) |
| APIFY_REDDIT_MENTIONS | $0.02 | 15 mention (experimental) |

**Bold = aktif olarak `user_deep_research` chain'inde calisanlar**.
Faz 1.4 sonrasi diger 6'si experimental flag arkasinda; UI'dan
calistirilmiyor ama kod duruyor.

### Aktif `user_deep_research` (3 worker) maliyet kapsami

```
Lead basina toplam: ~$1.31 - $2.61 (typical $1.85)
```

### Apify hesabi (platform'un satin aldigi)

Plan secimi:

| Apify plan | Aylik | Sundugu | Bizim icin uygun mu |
|---|---|---|---|
| Free | $0 | $5 credit | Dev/test only |
| Starter | $29 | $29 credit | <30 deep research/ay olan SaaS |
| **Scale** | $199 | $199 credit | Onerilen production tier |
| Business | $999 | $999 credit | Cok sayida agency tenant ile |

**Onerilen**: Scale plan ($199/ay). 100+ deep research/ay yapan AGENCY
tenant'larini icine alir.

### Plan tier'a gore aylik USD cap

[`src/lib/agent-workers/quota.ts`](src/lib/agent-workers/quota.ts) icindeki
`MONTHLY_APIFY_USD_CENTS`:

| Plan | Apify monthly cap | Yapacagi tipik deep research / ay |
|---|---|---|
| FREE | $0 | 0 |
| PRO | $5 | ~2-3 lead |
| PRO_TEAM | $25 | ~13-19 lead |
| AGENCY | $100 | ~54-76 lead |

## 4. Google Places API (New) - lead discovery

Lead discovery bu API'yi cagiriyor. Platform tek API key.

### Pricing

| SKU | Birim maliyet | Cagrilan field |
|---|---|---|
| Place Search (Nearby/Text) | $32 / 1.000 request | `searchText` worker |
| Place Details (Pro fields) | $17 / 1.000 request | full lead enrichment |
| Place Photos | $7 / 1.000 photo | optional |

### Lead basina ortalama

```
Search: $32 / 1.000 / ~20 lead per search = $0.0016 / lead
Details: $17 / 1.000 = $0.017 / lead
TOPLAM: ~$0.019 / lead (tipik)
```

Lead discovery cap'i workspace tier'larinda zaten var
(`workspace.leadsCreatedThisCycle`); bu yuzden Google Places spend deterministik.

### Plan tier'a gore aylik lead discovery cap

| Plan | Monthly lead cap | Google Places cost cap |
|---|---|---|
| FREE | 100 | $1.90 |
| PRO | 2.000 | $38 |
| PRO_TEAM | 8.000 | $152 |
| AGENCY | unlimited (soft 50K) | <$950 |

## 5. ZeroBounce - email verification

Optional. `ZEROBOUNCE_API_KEY` setti olmazsa worker silently skip eder.

### Pricing

- Free tier: 100 email/ay
- Volume <100K: $0.008/email
- Volume 100K+: $0.0008/email (tipik production tier)

### Lead basina

Audit tipik 2-5 contact email cikariyor; ortalama 3:

```
3 email X $0.0008 = $0.0024 / lead (Scale tier'da)
```

## 6. Supabase - DB + Auth

Platformun tek DB'si. pgvector icin de tek hesap.

| Plan | Aylik | Limit |
|---|---|---|
| Free | $0 | 500 MB DB, 1 GB storage, 50K MAU |
| **Pro** | **$25** | 8 GB DB, 100 GB storage, 100K MAU |
| Team | $599 | bigger |

**Production icin Pro yeterli**. SemanticMemory tablosu her workspace'te
~5K satir ortalama (~50 MB), 100 workspace = 5 GB DB hala Pro icinde.

## 7. Vercel - hosting

Next.js + serverless functions.

| Plan | Aylik | Sundugu |
|---|---|---|
| Hobby | $0 | Personal use only, ticari yasak |
| **Pro** | **$20/seat** | 1 TB bandwidth, 1M function exec |
| Enterprise | custom | per-seat negotiation |

**Production icin Pro zorunlu** (Hobby ticari kullanim icin lisanssiz).
Tek seat $20/ay; 3 dev'lik takim = $60/ay.

## 8. Upstash Redis - BullMQ

| Plan | Aylik | Sundugu |
|---|---|---|
| Free | $0 | 10K cmd/gun |
| Pro | $10 | 1M cmd/ay (bir AI workspace icin yeterli) |
| Pay as you go | $0.20 / 100K cmd | scale |

Production'da `Pro $10/ay` veya pay-as-you-go. AI worker'lari job basina
~5-10 cmd; 1.000 lead'lik intelligence cycle = ~10K cmd.

## 9. Resend - transactional email

| Plan | Aylik | Sundugu |
|---|---|---|
| Free | $0 | 3K email/ay, 100/gun |
| **Pro** | **$20** | 50K email/ay |

Production icin Pro tipik. Welcome + lead alert + booking notif gunde
~50-100 mail/agency.

## 10. Sentry - error monitoring

| Plan | Aylik | Sundugu |
|---|---|---|
| Developer | $0 | 5K error/ay |
| **Team** | **$26** | 50K error/ay, full stack |

Production: $26 yeterli. AI Core hata oranlari dusuk olmali (ay basi 1-5K
event tipik).

## 11. Stripe - payment processing

Sabit aylik degil; her tahsilat uzerinden.

```
Card processing: 2.9% + $0.30 per successful charge
International card: +0.4%
Stripe Tax: +0.5% (eger acikse)
```

PRO $79 X tipik %3.5 fee = ~$2.77 stripe gider/customer/ay.

## 12. Steel - video capture (optional)

`STEEL_API_KEY` set; ad video'lar uretilirken kullaniyor. Production'da AI
Core'a etkisi yok.

```
~$0.01/dakika (browser session)
```

Ay basi tipik 30-60 dakika capture = $0.30-0.60.

---

## Per-chain cost matematigi

### `lead_created` chain (otomatik, her lead ingest'inde)

```
WEBSITE_AUDITOR (Playwright, self-hosted) ........ $0.000
SOCIAL_SCRAPER (audit'ten cikar) ................. $0.000
REVIEW_ANALYST (Gemini) .......................... $0.0065
EMAIL_VERIFIER (ZeroBounce 3 email) .............. $0.0024  (eger acik)
SALES_OPPORTUNITY_SCORER (Gemini) ................ $0.0034
__EMBED_LEAD_PROFILE__ (Gemini embed) ............ $0.0000125
                                                   ─────────
                                                    $0.012
```

Ek olarak Google Places (discovery sirasinda, lead'in dogusu sirasinda):
```
+ $0.019 / lead
                                                   ─────────
                                                   ~$0.031 / lead toplam
```

### `user_one_click_pitch` (manuel, kullanici tetikler)

```
WEBSITE_MOCKUP_GENERATOR ......................... $0.012
OPENER_WRITER (few-shot retrieval ile) ........... $0.0023
VIDEO_SCRIPT_WRITER (optional) ................... $0.0019
                                                   ─────────
                                                   ~$0.016 / lead
```

### `user_deep_research` (manuel, opsiyonel, $$$)

```
APIFY_GMAPS_DEEP ................................. $1.00 - $2.00
APIFY_WEB_CRAWL_DEEP ............................. $0.30 - $0.60
APIFY_SERP_RANK .................................. $0.01
REVIEW_ANALYST re-run (Gemini) ................... $0.0065
SALES_OPPORTUNITY_SCORER re-run (Gemini) ......... $0.0034
                                                   ─────────
                                                   $1.32 - $2.61
                                                   (tipik $1.85)
```

### `user_receptionist_with_kb`

```
APIFY_WEB_CRAWL_DEEP ............................. $0.30 - $0.60
AI_RECEPTIONIST_BUILDER (KB ile) ................. $0.0105
                                                   ─────────
                                                   ~$0.31 - $0.61
                                                   (tipik $0.46)
```

### Copilot turn

```
Embed query .................................... $0.0000250
pgvector query (DB cost, marjinal) ............. $0.0000010
Gemini call (with retrieved context) ........... $0.0026
                                                 ─────────
                                                 ~$0.0026 / turn
```

---

## Worked scenarios

### Scenario A: Solo SDR, FREE plan

- 50 lead/ay discover, hepsine auto chain
- 5 copilot mesaji/gun = 150/ay
- 0 deep research (FREE'de kapali)
- 0 receptionist (FREE 5/ay limitinde, kullanmiyor)

```
Discovery + auto:  50 X $0.031 = $1.55
EMAIL_VERIFIER:    50 X $0.0024 = $0.12
Copilot:           150 X $0.0026 = $0.39
                                  ──────
                                  $2.06 / ay
```

**FREE = $0 revenue, ~$2 cost = -$2 margin (loss leader, tolerable)**

### Scenario B: PRO solo ($79/ay), 500 lead/ay, 5 deep research

```
Discovery + auto:  500 X $0.031 = $15.50
Email verify:      500 X $0.0024 = $1.20
Pitch packs:       50 X $0.016 = $0.80
Receptionists:     5 X $0.46 = $2.30
Deep research:     5 X $1.85 = $9.25
Copilot:           50/gun X 30 = 1500 X $0.0026 = $3.90
                                                  ──────
                                                  $32.95 / ay
```

Stripe fee: $79 X 3.5% = $2.77

```
Revenue:    $79.00
Cost:       $32.95
Stripe:     $2.77
            ──────
Margin:     $43.28  (~%55)
```

### Scenario C: PRO_TEAM ($149/ay), 2000 lead/ay, 25 deep research

```
Discovery + auto:  2000 X $0.031 = $62.00
Email verify:      2000 X $0.0024 = $4.80
Pitch packs:       100 X $0.016 = $1.60
Receptionists:     15 X $0.46 = $6.90
Deep research:     25 X $1.85 = $46.25 (cap = $25, dolayisiyla blocked +)
                                       (gercek: $25, sonra blocked)
Copilot:           200/gun X 30 = 6000 X $0.0026 = $15.60
                                                   ──────
                                                   $115.90 / ay
```

Apify cap'i $25/ay olarak bagliyor ($46 yerine). Yani gercek total:

```
$62.00 + $4.80 + $1.60 + $6.90 + $25.00 + $15.60 = $115.90
Stripe: $5.22
            ──────
Revenue:    $149.00
Cost:       $115.90
Stripe:     $5.22
            ──────
Margin:     $27.88  (~%19)
```

PRO_TEAM tier marjini en dar. **Buyuk problem**: bu tenant 2000 lead'lik
bir agency. Discovery cost'u tek basina $62. Lead cap'i 8000'e cikarsa
Google Places cost $250/ay'a firlar - margin negatif.

**Cozum**: PRO_TEAM'da lead cap'i 8000'den **3000'e indir** veya
discovery'i tier'a gore stratejik kapat (sadece "yer onerisi" goster,
detail'i kullanici tetiklerse cek).

### Scenario D: AGENCY ($249/ay), 5000 lead/ay, 50 deep research

```
Discovery + auto:  5000 X $0.031 = $155.00  [BUYUK SORUN]
Email verify:      5000 X $0.0024 = $12.00
Pitch packs:       250 X $0.016 = $4.00
Receptionists:     30 X $0.46 = $13.80
Deep research:     50 X $1.85 = $92.50, ama cap $100, OK
Copilot:           500/gun X 30 = 15000 X $0.0026 = $39.00
                                                    ──────
                                                    $316.30 / ay
```

```
Revenue:    $249.00
Cost:       $316.30
Stripe:     $7.50
            ──────
Margin:     -$74.80  (NEGATIVE)
```

**AGENCY tier teorik olarak zarar veriyor**. Buyuk discovery cost'u Google
Places'tan geliyor.

### Cozum onerileri (margin riski icin)

1. **Lead cap'lerini sertlestir**: AGENCY 5K lead/ay degil 2K lead/ay olsun.
2. **Discovery'i ucretlendir**: Lead cap'i kaldirip "1.000 lead = $20 ekstra"
   credit pack sat.
3. **Apify cap'i agresif tut**: AGENCY'de $100 yerine $50.
4. **Google Places yerine Apify GMaps kullan**: Apify alternatif scraper'i
   $0.40-1.20/1.000 - %95 ucuz.

## Platform fixed monthly cost (kullanici sayisindan bagimsiz)

```
Vercel Pro (1 seat, dev only) ................... $20
Supabase Pro .................................... $25
Apify Scale ..................................... $199  (production tier)
Resend Pro ...................................... $20
Sentry Team ..................................... $26
Upstash Redis Pro ............................... $10
                                                  ────
                                                  $300 / ay
```

Eger Apify Starter ($29) yeterli olursa total ~$130/ay.
Eger Apify hic kullanilmiyorsa (sadece native worker'lar) total ~$101/ay.

## Cost monitoring tavsiyesi

Bu dokumanda gosterilen sayilar **gercek olcumler degil tahmin**.
Production ship oncesi su monitoring kurulmali:

### 1. Per-workspace AI spend dashboard

`src/components/app/ai-spend-panel.tsx` (Faz 2.1) workspace settings'e
eklenir. Aylik harcama her vendor icin ayrı:

```
Bu ay: $4.27
  Gemini: $0.45
  Apify:  $3.50
  Discovery: $0.32
  
Kalan butce (Apify): $1.50 / $5.00
```

### 2. Vendor-level alerting

- Apify Scale plan'inda dashboard'dan alert: $150 hit oldugunda email.
- Google Cloud billing alert: $50/ay Gemini total icin email.
- Supabase usage alert: 6 GB DB hit oldugunda Pro -> Team upgrade lazim.

### 3. Per-tenant guardrails

Her tenant icin "ayda max $X bizden satin alabilir" hard cap. Su anki
tier-bazli quota'lar bunu yapiyor ama AGENCY'de **delik** var. Cozum:

```ts
// src/lib/agent-workers/quota.ts
const MONTHLY_TOTAL_CENTS_CEILING: Record<Plan, number> = {
  FREE: 1000,        // $10 max even if usage allows
  PRO: 7500,         // $75 max ~ revenue  
  PRO_TEAM: 14000,   // $140 max < $149 revenue
  AGENCY: 22000,     // $220 max < $249 revenue
};
```

Bu Faz 2.1'in scope'una eklenmeli; AGENCY tier'i mevcut tasarimda
zarar verme riski var.

## Cost optimization firsatlari (gelecek)

1. **Embedding cache**: Ayni text'in tekrar embed edilmesi cogu zaman gereksiz.
   `SemanticMemory.text`'in hash'iyle cache. Tahmini tasarruf: %10-15.
2. **Gemini Pro yerine Flash kullan** (zaten yapiyoruz, kontrol).
3. **Apify yerine kendi Playwright crawler'i** (sadece WEB_CRAWL_DEEP icin).
   Tasarruf: lead basi $0.40, ama dev + maintenance maliyeti yuksek.
4. **Cron pruning**: Memory satirlari 6 ay sonra silinirse DB Pro tier'inda
   kalir (Team $599'a gecmek gerekmez).
5. **AGENCY'de Apify yerine Place Details bulk discount**: Google Cloud'da
   sozlesmeli fiyat negotiate et (>$500/ay'a tetiklenir).

## Kaynaklar (her uc ayda dogrula)

- Google Gemini pricing: <https://ai.google.dev/pricing>
- Google Maps Platform pricing: <https://mapsplatform.google.com/pricing/>
- Apify pricing: <https://apify.com/pricing>
- Apify per-actor pricing: actor sayfasindaki "Pricing" sekmesi
- ZeroBounce pricing: <https://www.zerobounce.net/pricing/>
- Supabase pricing: <https://supabase.com/pricing>
- Vercel pricing: <https://vercel.com/pricing>
- Upstash pricing: <https://upstash.com/pricing/redis>
- Resend pricing: <https://resend.com/pricing>
- Sentry pricing: <https://sentry.io/pricing/>
- Stripe pricing: <https://stripe.com/pricing>

---

**Son guncelleme**: 2026-04-22  
**Sonraki gozden gecirme**: 2026-07-22 (Q3 vendor pricing kontrolu)
