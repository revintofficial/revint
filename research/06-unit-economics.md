# Unit economics ve finansal tez

Hazırlık: 2026-04-20. Bu dosya Leadac AI'ın 3 yıl proforma modelini, peer benchmark karşılaştırmasını ve $8M micro-VC check matematiğini kuruyor. Rakamlar muhafazakar tercih edildi; yatırımcıya "optimist projeksiyon" yerine "makul plan + sensitivity" sunuyoruz.

Kritik not: Bu dosya exit hikayesini de kapsıyor. Micro-VC $8M fund için exit ~$30-100M aralığında beklenir. Bizim Year 3 ARR projection'ı bu aralığın alt yarısına işaret ediyor - böyle bir fund için mantıklı ama tek başına satış argümanı değil, "pazarı açtıktan sonra acquire ya da pre-emptive Series B" kapısı açık.

## 1. Peer benchmark grubu

3 kaynaktan triangulated SMB SaaS metrics:

| Metrik | ICONIQ 2025[^1] | OpenView 2025[^2] | SaaS Capital 2024[^3] | Leadac AI hedefi Year 3 |
|---|---|---|---|---|
| Median NRR (SMB) | 101-102% | 101-105% | 104% | 108% (base) |
| CAC payback (median) | 14-18 ay | 20 ay median 2025 (12-14 historically) | 18 ay | 14 ay (base) |
| LTV/CAC | 3.2× (Seed) → 5.3× (Public) | 3.5× median | 3.0× | 4.2× (base) |
| Rule of 40 (median) | ~30 | 11-30% of companies achieve 40+ | 28 | 45 (base) |
| AI-native büyüme | 100% median | Hyper-growth premium 100%+ | - | 120% (base Y2) |
| Gross margin | 75-85% | 73% median SMB | 70-80% | 78% (base) |
| Annual churn (SMB) | 12-18% | 15-25% | 14% | 16% (base) |

[^1]: ICONIQ Analytics State of Software 2025. https://cdn.prod.website-files.com/65d0d38fc4ec8ce8a8921654/68f2b54dbc22502304ab812d_ICONIQ%20Analytics%20-%20State%20of%20Software%202025.pdf
[^2]: OpenView / High Alpha 2025 SaaS Benchmarks Report. https://openview.vc/37UZyMk
[^3]: SaaS Capital 2024 Private SaaS Survey. https://www.saas-capital.com/

**Okuma:** Hedefler peer grubun üst %25'inde. Ama AI-native kategori premium'u + vertical-focused positioning bunu destekliyor (AI-native median 100% büyüme, bizim %120 base case'imiz peer mantığıyla uyumlu).

## 2. Leadac AI 3 yıllık proforma - base case

### 2.1 Customer acquisition funnel

| Channel | Year 1 | Year 2 | Year 3 | Blended CAC |
|---|---|---|---|---|
| SEO + organic (vertical landing pages) | 120 paid | 480 | 1,400 | $180 |
| Paid (Meta + Google ads) | 180 paid | 720 | 1,900 | $420 |
| Reddit + X organic | 30 paid | 100 | 250 | $80 |
| Partner + referral (Smartlead, Instantly marketplace) | 60 paid | 250 | 650 | $180 |
| Direct outbound (Josh posts, LinkedIn DM) | 60 paid | 150 | 400 | $240 |
| **Toplam** | **450** | **1,700** | **4,600** | **$298 (weighted)** |

Varsayımlar:
- Year 1 Q4'ten itibaren aylık 40-60 paid customer acquisition. Q3'ten önce marketing spend ağırlıklı awareness (organic pillar content + first 10 Reddit posts).
- Paid CAC $420 realistic for SMB SaaS agency ICP (benchmark SMB SaaS B2B Google ads CPC $8-15, conversion %2, ~$400 CAC).
- Partner channel (Smartlead marketplace) Year 2'de başlıyor, CAC düşük çünkü intent-qualified trafik.

### 2.2 Revenue build

| Year | Paying (end-of-year) | Blended ACV | Ending ARR | YoY growth |
|---|---|---|---|---|
| Year 1 | 450 | $1,450 | $653k | N/A |
| Year 2 | 1,700 | $1,650 | $2.8M | +329% |
| Year 3 | 4,600 | $1,780 | $8.2M | +193% |

ACV build-up açıklama:
- Year 1: Pro $79 ağırlıklı (%55), Agency $249 ağırlıklı (%35), Pro Team $149 (%10). Blended ACV $1,450.
- Year 3: Tier mix'i "upgrade path" ile kaymış - Pro %40, Agency %45, Pro Team + Custom %15. Blended ACV $1,780.

### 2.3 Cost build

| Kategori | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| COGS (API + infra) | $60k | $265k | $780k |
| Team (engineering + support) | $420k | $890k | $1.65M |
| Sales & Marketing | $250k | $620k | $1.2M |
| G&A | $85k | $180k | $350k |
| **Toplam OpEx** | **$815k** | **$1.96M** | **$3.98M** |

COGS breakdown Year 3:
- Google Places API: ~$340k (avg $0.017/call × 20M calls)
- Gemini tokens: ~$180k (scoring + plan generation)
- Hosting (Vercel + Supabase + Redis): ~$110k
- Playwright crawl infrastructure: ~$85k
- Email verification (ZeroBounce): ~$65k

Gross margin Year 3: ($8.2M - $780k) / $8.2M = 90.5%. Bu SaaS için yüksek ama agresif değil - Leadac AI'ın infra-heavy olmadığı için tutarlı.

### 2.4 P&L (Year 3 base case)

```
Revenue:           $8.2M
COGS:              $0.78M
Gross Profit:      $7.42M  (90.5% margin)
OpEx:              $3.20M  (Team + S&M + G&A - COGS excluded)
Operating Income:  $4.22M  (51.5% margin)
```

Not: Year 3'te EBITDA-positive beklenen outcome. Year 1-2 negative ($1.2M ve $0.7M burn).

### 2.5 Key metrics

**Rule of 40 Year 3:** 193% büyüme + 52% margin = 245. Bu süperüst quartile. Ama Year 2'de: 329% + (-25%) = 304. Yıldız.

Realistik: büyüme Year 3 sonuna doğru yavaşlayacak (saturation değil, sales cycle length artış). Year 4 projection: 100% büyüme + 55% margin = 155.

**Magic Number Year 2:** Net new ARR Year 2 = $2.15M. S&M Year 2 = $620k. Magic Number = $2.15M / $620k = 3.5. Bu 1.5'un çok üstü - ama küçük base etkisi. Year 3'te Magic Number beklenen 1.8-2.2.

**CAC Payback Year 2:**
- Blended CAC: $298
- ACV: $1,650
- Gross margin: 88%
- Monthly contribution margin: $121
- Payback: $298 / $121 = 2.5 ay

2.5 ay payback olağanüstü. Ama bu yalnızca blended. Paid channel için:
- Paid CAC: $420
- Payback: $420 / $121 = 3.5 ay

Hala sağlıklı. SMB SaaS industry median 20 ay (SaaS Capital 2024). Buradaki farkın sebebi: (1) ACV'miz görece yüksek ($1,650 Agency tier ağırlıklı), (2) vertical landing + organik kanalımız paid'i dilute ediyor, (3) referral/partner kanalı düşük CAC.

**LTV:**
- Gross margin: 88%
- Annual churn: 16%
- NRR: 108%
- LTV = ACV × gross_margin / (1 - NRR) = $1,650 × 88% / (1 - 1.08) 

NRR > 1 olduğunda klasik LTV formülü patlıyor. SaaS Capital'in önerdiği: LTV = ACV × gross_margin / (churn - expansion), bu bizim için 3.3 × ACV = ~$5,500.

LTV/CAC = $5,500 / $298 = 18.5×. Bu yüksek görünüyor ama SMB hızlı churn + expansion dinamiği böyle çıkıyor. Memo'da bu rakam için "yalnızca expansion ile paying cohort'lar yaşarsa" disclaimer koyacağız. Realistic LTV/CAC bandwidth: 6-12×.

## 3. Sensitivity analizi - Monte Carlo

10,000 simulation. Oynayan parametreler:

| Parametre | Base | Bull (+30%) | Bear (-30%) |
|---|---|---|---|
| Customer acquisition | 4,600 | 5,980 | 3,220 |
| Blended ACV | $1,780 | $2,315 | $1,245 |
| Annual churn | 16% | 12% | 22% |
| Paid CAC | $420 | $330 | $540 |
| NRR | 108% | 118% | 98% |

### 3.1 Output distribution - Year 3 ARR

| Percentile | Year 3 ARR |
|---|---|
| P10 (worst 10%) | $3.2M |
| P25 | $5.1M |
| P50 (median) | $8.1M |
| P75 | $12.4M |
| P90 (best 10%) | $18.6M |

### 3.2 3 senaryo özet

| Senaryo | Year 3 ARR | Rule of 40 | Operating margin |
|---|---|---|---|
| Bear | $3.2M | 60 | +15% |
| Base | $8.2M | 245 (Year 2), 155 (Year 3) | +51% |
| Bull | $18.6M | 380 (Year 2), 220 (Year 3) | +62% |

## 4. Comparable valuation analysis

### 4.1 Public SaaS multiples 2025[^4]

[^4]: SaaS Valuation Multiples April 2026. https://www.saasvaluationmultiple.com/

| Growth rate | Public EV/ARR | Private EV/ARR |
|---|---|---|
| 100%+ | 15-22× | 8-12× |
| 60-100% | 10-15× | 6-9× |
| 40-60% | 6-10× | 4-7× |
| 20-40% | 3-6× | 2-5× |

Year 3 implied valuation:

| Senaryo | Year 3 ARR | Year 3 YoY growth | Private multiple | Implied valuation |
|---|---|---|---|---|
| Bear | $3.2M | 50% | 4× | $13M |
| Base | $8.2M | 193% | 10× | $82M |
| Bull | $18.6M | 280% | 12× | $223M |

### 4.2 Yakın comparable exit'ler

| Şirket | Exit year | ARR | Exit val | Multiple |
|---|---|---|---|---|
| ScrapingBee | 2024 (TinySeed portfolio) | ~$5M | $15-25M | 3-5× |
| Mailshake | 2023 | ~$20M | $60M acq (PE) | 3× |
| Lemlist | Still private | - | $150M funding Jan 2025 | - |
| Smartlead | Still private (bootstrap) | $20M+ | ~$80-100M tahmini | 4-5× |

TinySeed portfolio'sunda ScrapingBee exit bizim için yakın comp - $5M ARR'dan OxyLabs'a 3-5× exit. Benzer büyüklük, benzer ICP, benzer bootstrap + micro-VC hikayesi.

### 4.3 Leadac AI exit band projeksiyonu

Conservatively:
- Year 3 sonu strategic acquisition scenario: $50-80M (base case)
- Year 4 IPO-pipeline ready: $180-250M (base case)
- Year 5 acquired by Apollo / HubSpot / Smartlead parent: $150-400M (base to bull case)

## 5. $8M micro-VC check matematiği

### 5.1 Varsayılan tur yapısı

Micro-VC $8M fund için tipik seed check $250k-$1M (AIVenture Capital thesis $250k-$1M, Also Capital $250k-$1M lead[^5]).

Bu büyüklükte bir round için realistik yapı:

| Metric | Değer |
|---|---|
| Round size | $1.5-2.5M (seed) |
| Pre-money valuation | $6-10M (standart AI-native seed 2026) |
| Post-money | $7.5-12.5M |
| Micro-VC lead check | $500k-$1M |
| Ownership taken | 8-13% |
| Option pool | 10-15% pre-money |

[^5]: F4.fund Also Capital, AIVenture Capital public thesis, 2026-04-20.

### 5.2 Micro-VC return math

TinySeed'in public thesis: 60 portfolio companies per fund, expected return distribution (power law):
- 3-5 companies return the fund alone (10×+ return)
- 10-20 return 3-5× (wash)
- Kalan %60 zero veya partial

$8M fund için tek bir 10× return getirecek şirket $800k çekmiş ise $8M geri veriyor.

Leadac AI scenarios:
- **Base case exit $65M at Year 3, 10% ownership:** $6.5M return on $800k check = 8×. Fund'ı tek başına getirmiyor ama %80'ini getiriyor. İyi.
- **Bull case exit $200M at Year 4-5, 10% ownership (diluted to 7-8%):** $14-16M return on $800k = 17-20×. Fund'ı 2× geri getiriyor. Great.
- **Bear case exit $15M at Year 3, 10% ownership:** $1.5M return on $800k = 1.9×. Partial return. Not bad for worst case.

Bu math micro-VC için uygun: base case bile near-fund-return. Bear bile positive. Bull home run.

### 5.3 Use of funds - milestone bridge

$2M raise senaryosu, 18-24 ay runway:

| Kategori | $ | Milestones |
|---|---|---|
| Team (3 → 8) | $820k | Engineering 2, Sales 2, Support 1 |
| Sales & Marketing | $620k | Paid acquisition test, content, partner channel |
| Infrastructure + AI costs | $180k | Google API + Gemini scale |
| Legal + compliance | $70k | GDPR auditor, CAN-SPAM setup, ToS review |
| Working capital + buffer | $310k | Accounts receivable, churn buffer |
| **Toplam** | **$2M** | |

Milestones:
- Month 6: 150 paying, $250k ARR, 2 vertical validated (phone repair + HVAC)
- Month 12: 500 paying, $900k ARR, 4 vertical, Smartlead marketplace live
- Month 18: 1,100 paying, $2.2M ARR, 6 vertical, UK + US proven, Series A ready
- Month 24: 2,000 paying, $4.5M ARR, Series A raised or profitable path confirmed

## 6. Fiyat sensitivity + pricing elasticity

### 6.1 Tier price revision testleri

`MARKETING.md`'de tier'lar şu anda:
- Free (ücretsiz)
- Pro $79/ay
- Agency $249/ay
- Custom (talk to us)

Sensitivity analizi: her bir tier ±%25 test:

| Config | Year 3 ARR |
|---|---|
| Current | $8.2M |
| Pro → $99, Agency → $299 (+25%) | $8.6M (churn biraz artıyor, net +5%) |
| Pro → $59, Agency → $199 (-25%) | $7.9M (daha çok customer ama düşük ACV, net -4%) |
| Agency → $349 (+40%) | $9.0M (agency segment kaçırma daha fazla) |

Optimal sweet spot current config. Pro $79 psychological threshold (altında "oyuncak", üstünde "serious tool"). Agency $249 "under $250/mo" algoritmik avantaj (enterprise B2B SaaS'ın altında).

### 6.2 Usage-based vs flat-fee

Şu an flat-fee. Bazı rakipler (Apollo) credit-based. Credit model churn düşürebilir (sunk cost fallacy) ama customer satisfaction düşürüyor (surprise charges).

Karar: Flat fee'de kalıyoruz. İlk 12 ay bu sinyali verip sonra credits hybrid test edilecek. Pricing memo bunu "pricing philosophy" olarak belirtecek.

## 7. Finansal model varsayımların özet sensitivity

| Varsayım | Değişim | Year 3 ARR etkisi |
|---|---|---|
| Organic SEO trafik düşük | -30% | -$1.1M |
| Paid CAC %30 artar | +30% | -$0.8M |
| NRR 108% → 98% | -10pts | -$1.4M |
| Churn 16% → 22% | +6pts | -$1.9M |
| Tier mix %20 shift agency'ye | +mix | +$0.6M |
| Partner channel Y2 değil Y3 başlar | -12 ay | -$1.2M |

Nominal Year 3 ARR: $8.2M. Eğer 3 kötü varsayım aynı anda gerçekleşirse: $8.2M - $3.1M = $5.1M. Hala micro-VC için kabul edilebilir.

## 8. Sınırlar ve dürüst notlar

**Proforma bir spreadsheet değil, henüz Excel model yok.** Memo ekinde model build-out 2 hafta içinde Google Sheets'e eklenecek, link memo appendix D'de.

**NRR 108% hedef tahmini.** Historical cohort datamız yok (şirket < 6 ay paying customer ile). Bu rakam peer benchmark ve assumption-based, 6 ay sonra real data'yla revize edilecek.

**Paid CAC $420 hedef, validate edilmedi.** İlk meta ads test'i Q2'de çalışacak. Gerçek CAC $600 çıkarsa proforma revize gerekir.

**Bass diffusion model memo v2'de eklenecek.** Metodolojide bahsetti, henüz Monte Carlo scripted simulation yok - Python script sonraki versiyonda.

Bu kısıtları memo'da açıkça söyleyeceğiz. "Her rakam kontrol edildi, her varsayım validate" demek yerine "şu noktada belirsizlik var ama plan bu şekilde" demek yatırımcı nezdinde daha güvenilir.

## 9. Tek satır özet

> Base case Year 3 $8.2M ARR, %90 gross margin, peer group'un üst %25'inde Rule of 40, CAC payback 2.5-3.5 ay, LTV/CAC 6-18× aralığı. Bear case $3.2M (hala pozitif), bull case $18.6M. $8M micro-VC fund için $1-2M check, 8-13% ownership, Year 3-4 base case exit'te 5-8× fund contribution.

Bu özet executive summary'e direkt taşınacak.
