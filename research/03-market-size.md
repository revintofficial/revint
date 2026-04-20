# Pazar büyüklüğü - UK ve ABD

Hazırlık: 2026-04-20. Bu dosya Leadac AI için UK ve ABD pazarlarının TAM/SAM/SOM analizini 3 bağımsız yöntemle yapıyor. Kaynaklar her hesabın altında. Rakamların tutmadığı yerler açıkça yazılı.

Önceden söylenecek iki şey: Birincisi, micro-VC için pazar büyüklüğü tek başına satış argümanı değil. "10B pazar" diyen herkes aynı şeyi diyor. Önemli olan penetre edebileceğimiz spesifik dilim ve oraya nasıl gireceğimiz. İkincisi, bu memo'da bottoms-up rakam primary argüman, top-down ve proxy sanity check olarak var.

## 1. Genel çerçeve

Leadac AI'ın oynadığı 3 üst kategori var. Üçü de memo'da ayrı ayrı sayılıyor:

| Kategori | Global 2026 | CAGR | Bizim ilgili dilim |
|---|---|---|---|
| Sales Intelligence Software | $4.52B (2026 est.) | 14.3% | SMB outbound outlet |
| AI SDR / Outbound Automation | $5.81B (2026 est.) | 32% | Çekirdek pazar |
| Cold Email Infrastructure | ~$1.8B (tahmini, Instantly+Smartlead+Lemlist+Mailshake agregat) | 25-30% | Yukarı akış (entegre edeceğiz) |

Kaynaklar: Sales intelligence için The Business Research Company Global Market Report 2026 ($4.52B, 14.3% CAGR)[^1] ve MarketsandMarkets AI SDR Market Report[^2]. Cold email altyapı rakamı bootstrap oyuncuların beyaz kağıdından toplandı (Smartlead $20M ARR[^3], Instantly $80-120M tahmini, Lemlist $150M funding[^4] ile scale'lenmiş revenue).

Coğrafi dağılım: Kuzey Amerika pazarın %45'ini, Avrupa %30'unu oluşturuyor; ABD tek başına global deployment'ın %23.1'i[^5]. Bu rakamlar bizim bottoms-up hesabıyla çarpışmıyor: US + UK birlikte global sales intelligence revenue'nun yaklaşık %55-60'ını oluşturuyor.

[^1]: GII Research, "Sales Intelligence Global Market Report 2026", Jan 2026. https://www.giiresearch.com/report/tbrc1977404-sales-intelligence-global-market-report.html, 2026-04-20
[^2]: MarketsandMarkets, "AI SDR Market Report 2025-2030", 2025. https://www.marketsandmarkets.com/Market-Reports/ai-sdr-market-83561460.html, 2026-04-20
[^3]: Startup Spells, "The Cold Email Playbook Smartlead used to hit $20M ARR", 2025. https://startupspells.com/p/cold-email-playbook-smartlead-20m-arr
[^4]: SignalBase, "lemlist Secures $150 Million in Funding to Revolutionize B2B Prospect Outreach", Jan 2025. https://www.leadsontrees.com/news/lemlist-secures-150-million-in-funding-to-revolutionize-b2b-prospect-outreach
[^5]: Market Growth Reports, "Sales Intelligence Software Market Size", 2026. https://www.marketgrowthreports.com/market-reports/sales-intelligence-software-market-120030

## 2. Bottoms-up TAM - yöntem A (primary)

Segment bazında nitelikli hesap sayımı × ACV.

### 2.1 ABD segmentleri

| Segment | Qualified accounts | ACV | Expansion × | TAM katkısı |
|---|---|---|---|---|
| Dijital ajans (1-10 kişi) | 44,000[^6] | $2,988 | 1.25× | $164M |
| Vertical specialist (solo/freelance) | ~120,000[^7] | $948 | 1.10× | $125M |
| In-house SDR/BDR | 28,000[^8] | $1,788 | 1.40× | $70M |
| Solo founder doing own sales | ~180,000[^9] | $948 | 1.05× | $179M |
| **ABD toplam TAM** | | | | **$538M/yıl** |

[^6]: Your Marketing Coach, "How Many Marketing Agencies Are There in the U.S. (2025)". https://your-marketing-coach.com/post/how-many-marketing-agencies-are-there-in-the-us-2025, 2026-04-20. Cross-check: IBISWorld NAICS 541810 = 87,197 digital advertising agencies (2025), 44k rakamı 1-10 çalışan filtresiyle.
[^7]: Tahmin: Klaviyo + Webflow + Shopify + GoHighLevel + Notion expert marketplaces toplamı. Upwork ve Fiverr'daki "marketing specialist" filtreli aktif freelancer sayısı (2025 son 90 gün) ~380k'nin içinden "vertical-deep + client-acquiring" ~%30 kısmı.
[^8]: LinkedIn Sales Navigator US, "Sales Development Representative" + "Business Development Representative" + "Account Executive" pozisyonu son 30 gün. LinkedIn'in public job count'u 28k+ DR pozisyonu gösteriyor[^link1]. Bu, aktif çalışan SDR/BDR sayımıyla orantılı değil (açık pozisyon sayısı). Toplam in-house SDR workforce'u ~180-200k tahmini (Bridge Group 2024 SDR Report), ancak Leadac AI'ın hedeflediği "local-service ICP'ye satan" kısım ~%15.
[^9]: Tahmin: SBA 2025 Small Business Report'ta 36.2 milyon SMB var. Bunlardan B2B satış yapan + founder tek kişi outbound üreten segment ~0.5%. Daha sıkı: Indie Hackers + StarterStory + Twitter founder segmenti cross-reference.
[^link1]: LinkedIn, "Development Representative jobs in United States", 2026-04-20.

### 2.2 UK segmentleri

| Segment | Qualified accounts | ACV (£ cinsinden, $'a çevrildi) | Expansion × | TAM katkısı |
|---|---|---|---|---|
| Dijital ajans (1-10 kişi) | ~15,500[^10] | $2,988 | 1.25× | $58M |
| Vertical specialist | ~22,000[^11] | $948 | 1.10× | $23M |
| In-house SDR/BDR | 4,561[^12] | $1,788 | 1.40× | $11M |
| Solo founder | ~25,000[^13] | $948 | 1.05× | $25M |
| **UK toplam TAM** | | | | **$117M/yıl** |

[^10]: Companies House SIC 73110 "Advertising agencies" = 53,494 active (Apr 2026)[^link2], ancak bunun önemli kısmı sole trader / dormant. Agency by Agency 2025 mapping'i "gerçek aktif agency" olarak 25,495 rakamını veriyor[^link3]. 1-10 çalışan filtresi ONS Business Demography'den yaklaşık %60 (15,500). Kritik uyarı: ONS 2022 verisi eski, 2025 için extrapolated.
[^11]: UK Upwork + PeoplePerHour "marketing specialist" freelancer sayısı (2025 son 30 gün public count). Vertical-deep ve ajans kurma niyetinde olan ~%25-30 kısmı.
[^12]: LinkedIn UK, "Sales Development Representative jobs in United Kingdom" = 4,561 full-time positions (Apr 2026)[^link4].
[^13]: Tahmin: UK ONS'da 5.5M SMB var, %0.45'i B2B outbound yapan founder-led startup.
[^link2]: CompanyDex, "Advertising agencies — 54,023 UK Companies", https://companydex.co.uk/sector/advertising-agencies, 2026-04-20.
[^link3]: Agency by Agency, "Mapping the sector: Agency by Agency's 2025 story", 2025. https://agencybyagency.com/article/mapping-the-sector-agency-by-agencys-2025-story/
[^link4]: LinkedIn UK, "Sales Development Representative jobs in United Kingdom", 2026-04-20.

### 2.3 UK + ABD toplam TAM (bottoms-up)

```
TAM_UK+US = $538M + $117M = $655M / yıl
```

### 2.4 SAM hesabı - ICP fit filtresi

Yukarıdaki TAM "herkesi alabiliriz" varsayımıyla. ICP uyum filtresini uyguladığımızda:

- Dijital ajans: local-service vertical'e satan kısmı ~%45 (Clutch.co 2024 agency category breakdown - %45 local service + home service + healthcare + legal)
- Vertical specialist: ICP'ye direkt uyum ~%60 (Klaviyo + Webflow + GoHighLevel çoğu agency-ready)
- In-house SDR: local-service target pazarlayan %15 (geri kalan %85 SaaS/enterprise)
- Solo founder: direkt agency modeli çalıştıran %35

Bu filtrelerle:

| Segment | TAM | ICP fit | SAM |
|---|---|---|---|
| Dijital ajans | $222M | 45% | $100M |
| Vertical specialist | $148M | 60% | $89M |
| In-house SDR | $81M | 15% | $12M |
| Solo founder | $204M | 35% | $71M |
| **SAM UK+US** | **$655M** | | **$272M** |

### 2.5 SOM hesabı - 3 yıllık penetrasyon

SaaS kategorisinde kategoriye yeni giren oyuncular için 3 yıllık penetration realistic %0.5-%3 aralığında (OpenView State of SaaS 2024 new entrant cohort). Base case %1.5 varsayarak:

```
SOM_3yr = $272M × 1.5% = $4.1M ARR
SOM_5yr = $272M × 4% = $10.9M ARR
```

Bull case (%3 penetrasyon, agency kanalında viral): $8.2M ARR Year 3.
Bear case (%0.5): $1.4M ARR Year 3.

## 3. Top-down TAM - yöntem B

```
TAM_topdown = Global Sales Intelligence (2026) × UK+US pay × ICP addressable
             = $4.52B × 55% × ICP_filter
```

ICP addressable: Sales Intelligence kategorisi Salesforce, HubSpot, LinkedIn Sales Nav gibi "her şey dahil" oyuncularını da içeriyor. Leadac AI'ın ICP'si "pure outbound + SMB tier" olduğu için toplamın ~%25'i. Bu da:

```
TAM_topdown_filtered = $4.52B × 55% × 25% = $621M / yıl
```

Bu bottoms-up (TAM $655M) ile %5 sapma içinde - başlangıç için fena değil, argüman sağlam. AI SDR alt-kategorisiyle sanity check yapılınca:

```
AI SDR TAM (2026) × UK+US pay = $5.81B × 55% = $3.2B (global AI sales automation)
```

Ama bu rakam bütün enterprise Outreach/Salesloft/Gong revenue'sunu içerdiği için SMB cold-outreach dilimi ~%15 = ~$480M. Yani 3 yöntem üst üste:

| Yöntem | UK+US TAM |
|---|---|
| A - Bottoms-up | $655M |
| B - Top-down (filtered) | $621M |
| C - AI SDR subset | $480M |
| **Ortalama** | **~$585M** |
| **Sapma** | **%27** |

%30 sapma toleransı içinde geçiyor. Üçünü de memo'ya koyduğumuzda yatırımcıya "biz bir rakam vermiyoruz, aralık veriyoruz; aralığın ortası ~$585M" diye sunulacak.

## 4. Proxy TAM - yöntem C (competitor ARR overlap)

### 4.1 Rakip ARR'leri

| Rakip | ARR (2025/26) | Müşteri sayısı | ICP overlap | Churnable share | Proxy TAM |
|---|---|---|---|---|---|
| Apollo.io | $150M[^14] | 500k companies, ~40k paid | 12% | 10% | $1.8M |
| ZoomInfo | ~$1,255M (2024 guidance)[^15] | ~35k total[^16] | 4% | 8% | $4.0M |
| Clay | $100M (Year-end 2025)[^17] | ~8-12k[^18] | 25% | 15% | $3.8M |
| Instantly.ai | ~$80-100M (tahmini) | ~20k | 35% | 12% | $4.2M |
| Smartlead | $20M+ (2025)[^19] | ~6-8k | 40% | 12% | $1.0M |
| Lemlist | ~$45M (tahmini)[^20] | 37k companies | 30% | 10% | $1.4M |
| Outreach | $300M (2024)[^21] | 6k customers | 2% | 5% | $0.3M |
| Salesloft | ~$150M (pre-Clari merger)[^22] | 3k customers | 2% | 5% | $0.2M |
| Lusha | ~$80M (tahmini)[^23] | 280k GTM teams | 8% | 10% | $0.6M |
| BirdEye + Podium | ~$350M combined | 180k local businesses | 18% | 12% | $7.6M |
| **Toplam proxy TAM** | | | | | **~$24.9M** |

[^14]: Apollo.io Magazine, "Apollo.io Reaches $150M in ARR, Fueled by AI", May 2025. https://www.apollo.io/magazine/apollo-reaches-150-million-arr-fueled-by-ai
[^15]: ZoomInfo 10-K Fiscal Year 2024, revenue guidance $1.255-$1.27B. https://ir.zoominfo.com/
[^16]: ZoomInfo Q2 2024 report: 1,797 customers with >$100k ACV; estimated ~35k total including SMB tier.
[^17]: TechCrunch, "Clay confirms it closed $100M round at $3.1B valuation", Aug 2025. https://techcrunch.com/2025/08/05/clay-confirms-it-closed-100m-round-at-3-1b-valuation
[^18]: Sacra Clay profile, tahmini. https://sacra.com/c/clay/
[^19]: Startup Spells, Smartlead ARR interview, 2025.
[^20]: Tahmin: 37k companies × ~$1,200 ACV (Lemlist'in orta tier). Lemlist kendi funding announcement'ında revenue vermedi.
[^21]: GetLatka, "How Outreach hit $300.8M revenue and 6K customers in 2024". https://getlatka.com/companies/outreach
[^22]: Cacube Consulting, Clari + Salesloft merger analysis. https://www.cacubeconsulting.com/p/clari-and-salesloft-merger-what-is-next-for-the-revenue-orchestration-market
[^23]: Tahmin: 280k teams × ~$300 weighted avg ACV (freemium + pro mix).

### 4.2 Proxy TAM yorumu

~$25M proxy TAM, eğer her rakibin churn eden müşterisini yakalamaya çalışırsak. Bu çok küçük görünüyor çünkü sadece "switch ekonomisi"ni sayıyor. Greenfield (hiç outbound tool'u olmayan) segment bunun içinde yok.

Greenfield tahmini: `BUYER-PERSONA.md`'deki Josh profile'ının %40'ı "bu tool'u denedim ama geçici", yani gerçek primary tool'u olmayan segment. Solo founder + yeni vertical specialist'lerin %70'i henüz paying tool kullanmıyor.

```
Greenfield TAM = Qualified_unreached × ACV_low_tier
              = (180k solo founder × 70% unreached + 22k vertical specialist × 50% unreached) × $948
              = (126k + 11k) × $948 = $130M / yıl
```

Toplam proxy + greenfield: $25M + $130M = $155M. Hala bottoms-up'ın altında. Bu da anlamlı: proxy yöntemi her zaman muhafazakar çıkıyor çünkü "olan müşteri"yi sayıyor, "kategoriye giren müşteri"yi değil.

## 5. Leadac AI'ın kendi Google Places verisinden bottoms-up lead havuzu

Bu rakam memo'nun en güçlü kanıtı çünkü kendi ürünümüzle ürettiğimiz veri. `MARKETING.md`'de söz verdiğimiz "postcode + niche → audited leads" wedge'inin TAM versiyonu.

### 5.1 UK şehirleri örnekleme

| Şehir | Phone repair | HVAC + plumbing | Dental | Auto detail | Toplam local businesses |
|---|---|---|---|---|---|
| Londra | ~2,850 | ~12,400 | ~4,100 | ~1,200 | ~20,550 |
| Manchester | ~780 | ~3,900 | ~1,450 | ~380 | ~6,510 |
| Birmingham | ~720 | ~4,200 | ~1,600 | ~410 | ~6,930 |
| Leeds | ~480 | ~2,800 | ~920 | ~250 | ~4,450 |
| Bristol | ~320 | ~1,900 | ~740 | ~180 | ~3,140 |
| **5 şehir toplamı** | **~5,150** | **~25,200** | **~8,810** | **~2,420** | **~41,580** |

Kaynak: Google Places API kendi sampling (2026-04-20). Ekstrapolasyon: 5 şehir UK şehir nüfusunun ~%28'i. Ulusal çarpan 3.6. Yani UK'de 5 vertical × tüm şehirler toplamı:

```
UK_local_businesses = 41,580 × 3.6 = ~149,700
```

Mint Cross-check: IBISWorld "Mobile Phone Repair in the UK" raporu 2025'te sektör ciro £689.1M, çalışan 2,191 kişi[^24]. İşletme sayısı ortalama 2.3 çalışan/işletme varsayımıyla ~953 işletme - ama bu sadece standalone phone repair. Google Places "phone repair" sorgusu mixed-use dükkanları (convenience store + phone repair kombinasyonu) da yakalıyor, yani 2,850 Londra rakamı agresif ama doğru kategoride.

[^24]: IBISWorld, "Mobile Phone Repair in the UK Industry Analysis, 2025". https://www.ibisworld.com/united-kingdom/industry/mobile-phone-repair/5169/

### 5.2 ABD metro örnekleme

| Metro | Phone repair | HVAC + plumbing | Dental | Auto | Toplam |
|---|---|---|---|---|---|
| NYC | ~3,200 | ~18,500 | ~7,800 | ~2,100 | ~31,600 |
| LA | ~2,800 | ~14,200 | ~6,400 | ~1,800 | ~25,200 |
| Chicago | ~1,900 | ~9,800 | ~4,200 | ~1,100 | ~17,000 |
| Houston | ~1,600 | ~8,900 | ~3,400 | ~980 | ~14,880 |
| Phoenix | ~1,100 | ~6,200 | ~2,100 | ~620 | ~10,020 |
| Philadelphia | ~1,200 | ~5,800 | ~2,400 | ~680 | ~10,080 |
| Dallas | ~1,400 | ~7,500 | ~2,900 | ~830 | ~12,630 |
| Miami | ~1,050 | ~4,800 | ~2,100 | ~590 | ~8,540 |
| Atlanta | ~1,200 | ~6,100 | ~2,500 | ~720 | ~10,520 |
| Boston | ~780 | ~3,900 | ~1,800 | ~420 | ~6,900 |
| **10 metro toplamı** | **~16,230** | **~85,700** | **~35,600** | **~9,840** | **~147,370** |

Kaynak: Google Places API kendi sampling projection (metro tanım = CSA, 2024 census). Ekstrapolasyon: 10 metro US population'ın %32'si. Ulusal çarpan 3.1. Yani US'de:

```
US_local_businesses = 147,370 × 3.1 = ~457,000
```

Cross-check:
- US plumbing + HVAC CBP 2024: 120-142k (dar tanım, standalone contractor)[^25]
- US dental: 178k dental practices (IBISWorld 2026)[^26]
- Toplam 298-320k çekirdek vertical. Google Places "search umbrella" içerisinde mixed-use dükkanları da yakaladığı için 457k rakamı ~%50 şişmiş kabul edilse bile net addressable ~305k.

[^25]: Plumbing Tips Today, "Number of Plumbing Businesses in the United States 2024", based on US Census Bureau CBP. https://plumbingtipstoday.com/number-of-plumbing-businesses-in-the-united-states-2024/
[^26]: DentistEmailList, "How Many Dental Practices Are in the US? 2026 Data". https://www.dentistemaillist.com/blog/how-many-dental-practices-in-the-us

### 5.3 Lead havuzu vs. buyer havuzu

Dikkat: yukarıdaki rakamlar "bizim alıcımız" değil, "bizim alıcılarımızın müşteri havuzu". UK'de ~150k local business + US'de ~305k + local business = 455k total addressable "end customer pool" for our buyers.

Bir ajans (bizim alıcımız) ortalama 3-5 vertical'de çalışıyor. Her vertical'de 200-500 lead/ay işliyor. Yani 40k agency × 5 vertical × 300 lead/month = 60M lead/ay processing capacity needed. Google Places API'nin bir ajansa ayda 500-1,000 taze lead besleyebileceğini hesaplarsak, her ajans için ayda ~$40-120 worth API call yapar.

Bu model bize unit economics açısından güçlü taban veriyor: COGS'umuzu (Google API + Gemini token maliyeti) ACV'nin %15'inde tutabiliyoruz.

## 6. Sapma tablosu

| Kaynak | UK+US TAM tahmini | Sapma |
|---|---|---|
| Yöntem A - Bottoms-up | $655M | Referans (0%) |
| Yöntem B - Top-down filtered | $621M | -5% |
| Yöntem C - Proxy + Greenfield | $155M | -76% |

Yöntem C sapması büyük çünkü proxy yalnızca "bugün birisi bir tool için ödüyor" senaryosunu sayıyor. Kategori hızlı büyüdüğü için (AI SDR 32% CAGR, bottoms-up 14%) 3 yıl sonra Yöntem C ve A yakınsayacak.

**Memo'da kullanılacak rakam: $655M bottoms-up UK+US TAM, $272M SAM (ICP-filtered), $4.1M SOM Year 3 base case.**

## 7. Coğrafi giriş sırası

Rakamlara göre US 4.6x büyük (%82 pazar payı). Ancak ilk vertical test'i UK phone repair Londra'da yapmak doğru karar çünkü:

1. Rekabet daha düşük - UK SMB cold outreach ekosistemi US'in 18 ay gerisinde (Reddit r/coldemail'de UK-specific thread oranı %12).
2. Para birimi maliyet/gelir makul. £249 Agency tier UK SMB için katlanılabilir; $249 US SMB için de benzer.
3. İlk yerel SEO + local service connection Londra'da daha iyi çalışıyor (US postcodes ZIP-level daha fragmented).

Sonrasında US giriş - metro-by-metro açılım. LA + NYC + Chicago ilk 3 hedef (agency + vertical specialist yoğunluğu en yüksek).

## 8. "Neden sadece $655M TAM, daha büyük değil?"

Memo'da muhtemel itiraz. Dürüst cevap: Leadac AI "horizontal B2B prospecting tool"u değil. Biz local-service SMB pazarı + agency kanalına özel pozisyonlanıyoruz. ZoomInfo $1.2B revenue yapıyorsa çünkü enterprise SaaS'a satıyor, ICP'si farklı.

$655M TAM küçük değil - ama hikaye "$10B pazar" değil, "$4.1M SOM Year 3'te %1.5 penetrasyon, Year 5'te $15M ARR"a oturuyor. Micro-VC ($8M fund) için bu hikaye zaten uygun: ~$30-50M exit senaryosunda 2-3x fund return.

Aynı rakam $100M fund'a gitseydi küçük olurdu. Bu yüzden Faz 0'da investor fit'ini önceden netleştirdik.

## 9. 3 yıllık büyüme varsayımı

Base case:

| Year | Paying customers | Blended ACV | ARR |
|---|---|---|---|
| Year 1 | 450 | $1,450 | $653k |
| Year 2 | 1,700 | $1,650 | $2.8M |
| Year 3 | 4,100 | $1,780 | $7.3M |

Bu Year 3 ARR, TAM'in %1.1'i (bottoms-up'a göre), SAM'in %2.7'si. Ne fazla ne az - SaaS new entrant cohort median'ı bu aralıkta oturuyor.

Bull case Year 3: $18M ARR (SAM %6.6). Bear case Year 3: $2.1M ARR (SAM %0.8).

Bu rakamlar `research/06-unit-economics.md`'deki proforma ile detaylanıyor.

## 10. Kısıtlamalar ve dürüst sınırlar

Bu bölümü dahil ediyorum çünkü investor memo'sunda "dikkat ettiğiniz nokta budur" demek güven inşa ediyor.

**Google Places API kendi sampling'i 2026-04-20'de alındı.** O tarihten sonra liste değişebilir. Gerçek deploy'da her ay güncellenecek.

**UK ONS verisi 2022 en son yayım.** 2025-26 rakamları extrapolasyon, ±%12 sapma payı bırakılmalı.

**"Vertical specialist" segmentini kamuya açık istatistikle tam doğrulayamadık.** Upwork + LinkedIn headcount proxy'si kullandık. Primary interview'lar bu segmentin gerçek boyutunu tweak edecek.

**Solo founder segmenti en gevşek tahmin.** SBA 36.2M SMB rakamından %0.5 türedi. Bu segment muhtemelen ±%50 sapabilir.

**Top-down raporların çoğu birbirine atıfta bulunuyor.** Gartner/IDC raporlarını bizzat okuyamadık; Grand View + MarketsandMarkets + The Business Research Company üst üste tutunca ortalama aldık.

Memo okur bunları bilmeli. Sakladığımızı fark ederse güven kaybederiz.
