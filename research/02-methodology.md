# Metodoloji ve algoritma seti

Hazırlık: 2026-04-20. Bu dosya her hesabın arkasındaki formülü, varsayımlarını ve doğrulama kriterini tutar. Memo'da rakam geçtiğinde footnote buraya pointer verir.

Niye gerekli: VC partner'ının en sevdiği soru "bu %12.5 nereden geldi?" Bu dosya o sorunun cevabıdır.

## 1. TAM / SAM / SOM üçgenleme

Tek yöntemle market sizing yapan kimse yanılıyordur. Üç yöntemi paralel yürütüp sapmayı raporluyoruz. Üçü de aynı cevabı verdiyse argüman güçlü, farklıysa varsayımlarımızı tekrar okuyoruz.

### Yöntem A - Bottoms-up (Bessemer)

Formül:

```
TAM = Σ_segmentler ( qualified_accounts × ACV × expansion_multiplier )
SAM = TAM × coğrafi_filtre × ICP_uyum_yüzdesi
SOM = SAM × 3_yıllık_penetrasyon × tier_mix
```

Segmentler (`BUYER-PERSONA.md` + `MARKETING.md` §8 sentezi):

| Segment | ACV hedefi | Expansion multiplier | Tier eşleme |
|---|---|---|---|
| Digital agency (1-10 kişi) | $2,988/yıl ($249 × 12) | 1.25× | Agency tier |
| Vertical specialist (solo/freelance) | $948/yıl ($79 × 12) | 1.10× | Pro tier |
| In-house SDR/BDR team | $1,788/yıl ($149 × 12) | 1.40× | Pro Team tier |
| Solo founder | $948/yıl ($79 × 12) | 1.05× | Pro tier |

Expansion multiplier: ilk yıl ACV üstüne NRR-kaynaklı büyüme. SMB SaaS için 105-115% range standart (ICONIQ 2024).

Qualified accounts sayımı: her segment için 3 kaynaklı çapraz doğrulama (US Census + LinkedIn Sales Nav + Google Places API kendi sampling).

ICP uyum yüzdesi: `BUYER-PERSONA.md`'deki disqualification kriterlerini çıkarınca kalan addressable. Örnek: agency segmentinde "B2B SaaS only" olanlar ICP dışı, agency'lerin yaklaşık %40'ı local-service müşteriye sahip (Clutch.co breakdown verisi).

3-yıllık penetrasyon: SaaS kategorisinde kategoriye yeni giren oyuncular için %0.5-%3 aralığı realistic (OpenView "State of SaaS" 2024). Base: %1.5, Bull: %3.0, Bear: %0.5.

### Yöntem B - Top-down

Formül:

```
TAM_topdown = Global_sales_intelligence_market × coğrafi_pay × ICP_fit_oranı
```

Kaynaklar:
- Gartner / IDC: Worldwide Sales Intelligence Applications Market Size (2025 tahmini: $4.2B-$4.9B aralığı, CAGR 10-12%)
- UK pay: toplam B2B SaaS harcamasının yaklaşık %6-7'si (UK Tech Nation 2024 raporu)
- US pay: yaklaşık %55-60 (global SaaS revenue coğrafi breakdown)
- ICP fit: SMB + mid-market outbound segmentinin toplam pazar içindeki payı ~%30-35 (Forrester Wave SEP breakdown)

Kritik uyarı: bu yöntem sıklıkla %50 şişirilmiş oluyor çünkü "sales intelligence" kategorisi Salesforce, HubSpot gibi devleri de içeriyor. Fakat onlar bizim TAM'imizde değil. Bu yüzden top-down rakamına sadece sanity check olarak bakıyoruz, bottoms-up'ın 2-4 katından fazla olmaması bekleniyor.

### Yöntem C - Proxy / comparable

Formül:

```
TAM_proxy = Σ (rakip_ARR × ICP_overlap × potential_churn_share) + greenfield
```

Rakipler: Apollo.io, ZoomInfo (SMB segment), Clay, Instantly, Smartlead, Lemlist, Lusha.

ICP overlap: rakibin müşteri tabanının ne kadarı bizim ICP'mizle kesişiyor. Örnek: Apollo'nun %65+ müşterisi SMB outbound yapıyor ama local-service vertical'e odaklı değil, bu yüzden overlap %10-15.

Potential churn share: rakibin müşterilerinin yıllık yüzde kaçı "yeni bir tool'a açığız" durumunda. SMB SaaS churn rate %15-25 (ProfitWell 2024), bunun yarısı proaktif olarak alternatif arıyor, yani ~%10.

Greenfield: henüz hiç cold outbound tool'u kullanmayan ICP segmenti (özellikle vertical specialist ve çekirdek SMMA başlangıçları).

### Sapma toleransı

Üç yöntem birbirinden %30'dan fazla sapıyorsa:

1. Varsayımları tek tek kontrol ediyoruz (özellikle ICP_fit_oranı ve qualified_accounts)
2. Üçünün ortalaması değil, bottoms-up'ı primary kabul edip diğer ikisini yanında sunuyoruz
3. Sapmanın tablosunu memo appendix A'ya koyuyoruz

## 2. Unit economics benchmark algoritması

Her metrik için peer benchmark kaynağı + Leadac AI hedefi + gap analizi yapılır.

### Rule of 40

```
Rule40 = YoY_growth_% + FCF_margin_%
```

Benchmark: ICONIQ 2024'te top-quartile SMB SaaS Rule of 40 skoru ~50, median ~30. Büyüme ağırlıklı (SMB için).

Leadac AI Year 3 hedefi:
- Base: büyüme %120, margin -%20 → Rule 40 = 100
- Bull: büyüme %200, margin -%10 → Rule 40 = 190
- Bear: büyüme %60, margin -%40 → Rule 40 = 20

### Magic Number

```
MagicNumber = (current_Q_ARR - previous_Q_ARR) × 4 / previous_Q_S&M_spend
```

Benchmark: 0.75+ sağlıklı, 1.0+ accelerate edilebilir, 1.5+ olağanüstü (OpenView SaaS Benchmarks 2024).

Leadac AI Year 2 hedefi: base 1.0, bull 1.8, bear 0.5.

### CAC Payback

```
CAC_Payback_months = CAC / (ACV × gross_margin / 12)
```

Benchmark:
- PLG SMB SaaS: 6-12 ay
- Sales-led SMB: 12-18 ay
- Mid-market: 18-24 ay

Leadac AI ACV $948-$2,988, gross margin SaaS için tipik %75-85. Hedef CAC < $400 (SMB) ve < $900 (agency).

### LTV / CAC

```
LTV = ACV × gross_margin / (1 - NRR_decimal) × (1 - churn_rate_annual)
LTV/CAC ratio = LTV / CAC
```

Benchmark: 3.0+ sağlıklı, 5.0+ olağanüstü (ICONIQ).

Leadac AI Year 3 hedefi: base 3.5, bull 6.0, bear 1.5.

### Net Revenue Retention

```
NRR = (Starting_ARR + Expansion + Reactivation - Contraction - Churn) / Starting_ARR
```

Benchmark:
- SMB SaaS: 95-105% median (SaaS Capital 2024)
- Mid-market: 105-115%
- Enterprise: 115-125%

Leadac AI hedefi: SMB tier için 100-110%, Agency tier için 110-120% (expansion dinamik yüksek çünkü agency kendi müşterisine sattıkça seat kullanımı artıyor).

## 3. Rekabet yoğunluğu algoritması

### Porter Five Forces skorlaması

Her force için 0-5 skoru, her skor için 3 kanıt gerekli:

| Force | 0 = ideal bizim için | 5 = kötü bizim için |
|---|---|---|
| Rakipler arası rekabet | Parçalı, küçük oyuncular | Few dominant, ilan savaşı |
| Yeni giriş tehdidi | Yüksek bariyer | Düşük bariyer, herkes girer |
| İkame tehdidi | İkame yok | Bedava alternatif var |
| Alıcı pazarlık gücü | Fragmented SMB | Konsolide enterprise |
| Tedarikçi pazarlık gücü | Çok seçenek | Tek kaynak, lock-in |

Her force için skor + 3 kanıt → memo §4 Porter analizi.

### Review mining algoritması

Amaç: G2 + Capterra'dan "saturation", "freshness", "personalization" şikayet sinyallerinin frekansını çıkarmak.

Pipeline:
1. G2 API veya scraper ile Apollo/Clay/ZoomInfo/Instantly için son 500 review al (rating ≤ 3 filtresiyle)
2. Her review'u kısa span'lara böl (cümle bazlı)
3. Keyword + embedding matching ile 5 kategoriye ata:
   - "data_freshness": ["outdated", "old data", "stale", "6 months old"]
   - "saturation": ["same contacts", "everyone has this", "burnt", "oversaturated"]
   - "personalization": ["generic", "template", "no context", "copy paste"]
   - "pricing": ["expensive", "overpriced", "credits ran out", "charges"]
   - "deliverability": ["spam", "bounced", "blocked", "reputation"]
4. Kategori başına yüzde çıkar, Leadac AI pozisyonuyla karşılaştır

Doğrulama: 50 review manuel etiketlenir, automated pipeline ≥ 80% accuracy göstermezse topic tanımı yeniden yazılır.

## 4. JTBD Switch Interview

Re-Wired Group'un "When Coffee and Kale Compete" kitabındaki Bob Moesta metodolojisi. 5 soru grubu:

### Group 1 - İlk düşünce
"En son X tool'unu/alternatifini satın aldın. O tool'u almak aklına ilk ne zaman geldi? Nerdeydin? Ne yapıyordun?"

### Group 2 - Arayış
"Tool'u bulana kadar neye baktın? Hangi alternatifleri denedin? Her birinden neden vazgeçtin?"

### Group 3 - Karar
"Satın almayı nihai verdiğin gün neydi? O gün ne oldu?"

### Group 4 - Anxiety + Habit
"Almadan önce endişelendiğin şey var mıydı? Geri dönüp değiştirmek istediğin bir karar oldu mu?"

### Group 5 - Kullanım sonrası
"Tool'u şu an kaldırırsam ne yaparsın? Hangi özelliği en çok kullanıyorsun?"

Çıktı: 4 kuvvet haritası her persona için:
- **Push** (mevcut durumdan iten): ne oldu da arayışa girdi?
- **Pull** (yeni çözümün çektiği): ne vaat eden tool'u seçti?
- **Anxiety** (yeni çözüme karşı direnç): neyden korktu?
- **Habit** (mevcut davranışın çekimi): hangi alışkanlıktan kopamadı?

## 5. Penetrasyon modelleme - Bass diffusion

Frank Bass'ın 1969 modeli, yeni kategori adoption'ında standart. Formül:

```
dN(t)/dt = (p + q × N(t)/M) × (M - N(t))

p = innovation coefficient (bağımsız karar verenler)
q = imitation coefficient (sosyal etkiyle gelenler)
M = ultimate market size (toplam kabul potansiyeli)
N(t) = t zamanına kadar adopt edenler
```

SaaS kategori default parametreleri (Bass literature review, Mahajan 2010):
- p = 0.03 (innovators tipik %2-5)
- q = 0.38 (imitators SaaS için yüksek çünkü sosyal kanıt güçlü)

Uygulama: M = SAM (yöntem A'dan), 5 yıllık N(t) curve çizilir. Year 3 adoption = 3 yıllık SOM hesabı.

Sensitivity: p ve q değerlerini ±%50 oynatıp Monte Carlo (10,000 simulation) çalıştırıyoruz. Year 3 MRR output distribution'ının P10-P50-P90 aralığı memo'ya giriyor.

## 6. Proforma cohort modeli

3 yıllık cohort-based revenue forecast. Her aylık cohort:

```
Cohort_month_i_MRR(t) = Initial_paying_customers × (1 - monthly_churn)^t × (1 + monthly_expansion)^t × ARPU
```

Variables:
- New customers / month: paid acquisition + organic + referral breakdown
- CAC per channel: meta ads $X, Google ads $Y, content $Z, partnerships
- Monthly churn: base %4, bull %3, bear %6
- Monthly expansion: base %1.5, bull %2.5, bear %0.5
- ARPU: segment mix weighted average

Çıktı: 36 ay boyunca MRR kohort tablosu + Monte Carlo sensitivity grid.

## 7. Comparable company valuation

Formül:

```
Implied_valuation = Year_3_ARR × EV/ARR_multiple
```

EV/ARR multiples (2025 transaction comps):
- Public SaaS median: 6-8×
- High-growth (50%+) SaaS: 10-15×
- Strategic M&A premium: 1.3-1.8×

Comparable exit'ler:
- Apollo.io 2024 round: ~$1.6B post-money, ~$50M ARR tahmini → 32× (büyüme primi)
- ZoomInfo post-IPO: ~7× (matured)
- Salesloft 2024 PE recap: $2.3B, ARR ~$250M → 9.2×
- Outreach 2022: $4.4B, ARR tahmini ~$250M → 17.6× (ZIRP tavan)

Leadac AI Year 3 base scenario ARR projection × realistic multiple (6-10×) → implied exit range.

## 8. Doğrulama kriterleri

Memo'ya girecek her rakam aşağıdakilerden en az üçünü geçmek zorunda:

1. En az 2 bağımsız kaynaktan aynı mertebeden rakam
2. Kaynak tarihi son 18 ay
3. Formül açıkça yazılı, okuyucu tekrar hesaplayabilir
4. Sensitivity analizi yapıldı, %20 parametre sapmasında output %30'dan az değişiyor
5. Peer benchmark ile karşılaştırıldı

Geçemeyen rakam memo'dan çıkar veya "tahmin" olarak işaretlenir.

## 9. Bilinçli kısıtlamalar

Bu memo'da aşağıdaki analizleri yapmıyoruz:

- Cohort LTV regression (cohort data yok, 6 ay sonra yapılacak)
- Customer concentration analysis (mevcut müşteri 50+'den az, anlamsız)
- Market share time-series (kategori yeni, 3 yıldan eski veri yok)
- Seasonality decomposition (yeterli veri yok)

Bu eksiklikler memo'nun "bilinçli sınırları" appendix'inde yazılı. Yatırımcı sormadan söylüyoruz.
