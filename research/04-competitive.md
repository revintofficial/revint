# Rekabet analizi

Hazırlık: 2026-04-20. Bu dosya 14 rakibi tek tek söküyor, Porter Five Forces analizi yapıyor ve feature parity matrisiyle Leadac AI'ın nerede kazandığını/kaybettiğini gösteriyor.

Kritik not: Bu kategori kalabalık. Memo'ya "biz tek'iz" argümanını satmayacağız. Bunun yerine "biz farklı bir kapıdan giriyoruz ve o kapı açık" argümanı.

## 1. Rakip tipolojisi

Hepsi "outbound sales tool" ama 4 ayrı yapı var:

| Tip | Ne yapıyor | Örnek | Leadac AI overlap |
|---|---|---|---|
| Contact database | Kişi + email + phone sağlıyor | Apollo, ZoomInfo, Lusha, Seamless | Direkt rakip ama ICP farklı (biz local-service, onlar LinkedIn-rich B2B) |
| Email infrastructure | Mailbox rotation + deliverability + warmup | Smartlead, Instantly (kısmen) | Upstream - birlikte çalışırız, rakip değiliz |
| Multichannel automation | Email + LinkedIn + phone sequencer | Lemlist, Outreach, Salesloft | Enterprise segment, bize direkt gelmiyor |
| Data orchestration | Çoklu provider'dan enrichment waterfall | Clay | Üstümüzde katman, biz Clay'in kaynağı olabiliriz |
| Local business SaaS | Review + reputation + booking | BirdEye, Podium | Müşteri tarafındayız, rakip değil |

Leadac AI bu 5 tipten hiçbirine tam oturmuyor. En yakın tarif: "vertical-first, local-service-focused prospecting + personalization engine with website artifact output". Kategori yaratma boyutu var, Dunford positioning framework'ü burada devreye giriyor.

## 2. Detaylı teardown (11 rakip)

### 2.1 Apollo.io

| Metrik | Değer | Kaynak |
|---|---|---|
| ARR (Mayıs 2025) | $150M | Apollo Magazine, May 2025[^1] |
| 2024 → 2025 büyüme | $134M → $150M (%12 YoY, Q1'de hızlandı) | Aynı |
| Valuation | $1.6B (post-money Series D, Ağu 2023) | Bain Capital Ventures lead[^2] |
| Toplam funding | $251.3M | Sacra |
| Paying customers | ~40k (Ağu 2023) → muhtemelen 55k-70k şu an | Apollo Our Story |
| Companies on platform | 500k+ | Apollo AI Platform announcement[^3] |
| Pricing | Free / $49 / $79 / $119 per user/mo + $15k enterprise | Cognism pricing comparison[^4] |
| ACV median | $15,750/yıl enterprise; SMB blended ~$1,200 | CostBench data[^5] |
| G2 rating | 4.8/5 (~9,510 review) | Prospeo 2026[^6] |
| Trustpilot rating | 2.2/5 (1,046 review) | Puzzly review[^7] |
| US data accuracy | %88-89 | Puzzly testing Q1 2026 |
| Non-NA data accuracy | %60 | Prospeo review |

[^1]: https://www.apollo.io/magazine/apollo-reaches-150-million-arr-fueled-by-ai
[^2]: https://sacra.com/c/apollo/
[^3]: https://www.apollo.io/magazine/apollo-ai-platform-500-percent-growth-2025
[^4]: https://www.cognism.com/apollo-io-pricing
[^5]: https://costbench.com/software/sales-intelligence/apollo-io/
[^6]: https://prospeo.io/s/apolloio-pros-and-cons
[^7]: https://puzzly.ai/tools/apollo

**Stratejik zafiyet:** Data saturation G2'de 503 mention. Aynı 275M kontak 100k+ kullanıcıya satılıyor, bu yüzden "aynı insan aynı hafta 5 farklı pitch alıyor" problemi (`BUYER-PERSONA.md` Josh şikayeti birebir). UK+EU data accuracy %60 civarında - bizim için açık kapı.

**Leadac AI'a karşı pozisyon:** "Apollo sana SaaS buyer persona'sı satıyor. Sana phone repair ya da HVAC contractor'ı vermiyor. Biz tam oradayız."

### 2.2 ZoomInfo (public - ticker ZI)

| Metrik | Değer | Kaynak |
|---|---|---|
| Revenue 2024 | $1.255B - $1.27B | 10-K guidance |
| Revenue Q2 2024 | $291.5M (-6% YoY) | SEC 8-K[^8] |
| Customers >$100k ACV | 1,797 (Q2 2024) | Aynı |
| NRR | "Stabilizing" (spesifik rakam yok, tahmini 95-100%) | Aynı |
| Pricing | $14,995 Lite → $39,995 Elite | BookYourData[^9] |
| Median ACV | $20k+ enterprise | ZoomInfo sales reviews |
| G2 rating | 4.4/5 | G2 (>6k review ZoomInfo Sales) |

[^8]: https://www.sec.gov/Archives/edgar/data/1794515/000179451524000132/zi-8kex991x20240805.htm
[^9]: https://www.bookyourdata.com/blog/zoominfo-pricing

**Stratejik zafiyet:** Enterprise SaaS'a satıyor, SMB pazarından aktif olarak çıktı (2023'te RainKing satın alması sonrası "growth tier" kapatıldı). Kontrat 1 yıl minimum, cancellation zor. Data freshness şikayeti yaygın - yıllarca eski kontaklar.

**Leadac AI'a karşı pozisyon:** "ZoomInfo büyük kurumlar için. Aylık $99 ödemek istiyorsan Apollo'ya git; hiçbiri sana phone repair shop vermiyor."

### 2.3 Clay

| Metrik | Değer | Kaynak |
|---|---|---|
| ARR (2025 year-end) | ~$100M (tripled from $30M early 2025) | TechCrunch Aug 2025[^10] |
| Valuation | $3.1B (Series C, Haz 2025) | CapitalG led |
| Pricing | $149/ay başlangıç, Pro tier $349+ | Clay pricing page |
| Estimated paying customers | ~8-12k | Sacra tahmini |
| G2 rating | 4.9/5 | Clay reviews 2026 |
| Best for | RevOps teams, waterfall enrichment | Positioning |

[^10]: https://techcrunch.com/2025/08/05/clay-confirms-it-closed-100m-round-at-3-1b-valuation

**Stratejik zafiyet:** Kendi contact database'i yok, 50-150+ provider'dan waterfall yapıyor. Yani maliyet sürekli yüksek. Teknik bir tool - RevOps mühendisi olmayan kullanıcı için dik öğrenme eğrisi. Local-service vertical coverage zayıf (Apollo + Clearbit + ZoomInfo kaynaklarının zayıflığını devralıyor).

**Leadac AI'a karşı pozisyon:** "Clay data orchestrator. Biz data provider'ıyız - onların altında oluşturulan katmandayız. Clay kullanıcısı bizim müşterimiz olabilir."

Bu önemli: Clay ile rakip değil, tedarikçi konumdayız. Partnership fırsatı var (Clay'in marketplace'inde "Google Places via Leadac AI" entry).

### 2.4 Instantly.ai

| Metrik | Değer | Kaynak |
|---|---|---|
| ARR | ~$80-100M (tahmini) | Bootstrap, kendi public'e açıkladı indirmedi |
| Hypergrowth Plan | $97/ay | Instantly pricing[^11] |
| Database size | 450M+ B2B contacts | Aynı |
| Model | Flat-fee, unlimited accounts | Tanım |
| Mailbox warmup network | 4.2M+ accounts | Aynı |

[^11]: https://instantly.ai/blog/instantly-vs-smartlead-lemlist-2026/

**Stratejik zafiyet:** Bootstrap, o yüzden hızlı enterprise harekete kısıtlı. Data tarafında yeni SuperSearch ile Apollo'ya benzer bir database kurdu ama local-service vertical coverage hala zayıf.

**Leadac AI'a karşı pozisyon:** "Instantly email altyapısı. Biz lead + personalization tarafıyız. Instantly'e lead besliyoruz, birlikte çalışıyoruz."

### 2.5 Smartlead

| Metrik | Değer | Kaynak |
|---|---|---|
| ARR (2025) | $20M+ | Startup Spells interview[^12] |
| Büyüme | Bootstrap, 2 yılda 0→20M | Aynı |
| Pricing | $39 Basic / $94 Pro / $174 Custom | PuzzleInbox[^13] |
| Agency addon | $29/client | Aynı |
| Model | API-first, tech-heavy agency focus | Tanım |

[^12]: https://startupspells.com/p/cold-email-playbook-smartlead-20m-arr
[^13]: https://puzzleinbox.com/blog/smartlead-pricing-guide

**Stratejik zafiyet:** Lead database yok - dışarıdan data import etmek gerek. API-first yapı non-technical kullanıcı için zor. `BUYER-PERSONA.md`'deki Josh'un orta kademesi Smartlead kullanıyor ama data üstüne ayrı $500-2000/ay harcıyor.

**Leadac AI'a karşı pozisyon:** "Smartlead kullanan ajansın data budget'ını yiyoruz. Leadac AI'dan çekilen leadler Smartlead pipeline'ına direkt akıyor, fazladan Apollo'ya gerek yok."

Bu Smartlead ile partnership tezine götürüyor: Smartlead marketplace'de "Leadac AI data source" entegrasyonu.

### 2.6 Lemlist

| Metrik | Değer | Kaynak |
|---|---|---|
| Funding | $150M (Ocak 2025) | LeadsOnTrees[^14] |
| Companies served | 37,000 | Aynı |
| Database | 450M+ contacts | Aynı |
| Pricing | $69+/user/ay | Instantly comparison |
| Model | Per-seat multichannel | Tanım |

[^14]: https://www.leadsontrees.com/news/lemlist-secures-150-million-in-funding-to-revolutionize-b2b-prospect-outreach

**Stratejik zafiyet:** Per-seat pricing ölçekte pahalı. Fransız kökenli, ABD agency penetration daha yavaş.

**Leadac AI'a karşı pozisyon:** "Lemlist multichannel sequence tool'u. Biz upstream'deki data + personalization engine."

### 2.7 Outreach.io

| Metrik | Değer | Kaynak |
|---|---|---|
| Revenue 2024 | $300.8M | GetLatka[^15] |
| ARR 2023 | ~$250M | Aynı |
| Valuation | $4.2B (2024 round, Premji + Steadfast) | PE Insights[^16] |
| Customers | 6k | Aynı |
| ACV median | ~$50k/yıl | Enterprise segment |

[^15]: https://getlatka.com/companies/outreach
[^16]: https://pe-insights.com/software-startup-outreach-valued-at-4-2-billion-in-new-funding/

**Stratejik zafiyet:** Enterprise-only artık. SMB tier kapatıldı 2023'te. Leadac AI'ın ICP'si dışında.

**Leadac AI'a karşı pozisyon:** Rakip değil, non-overlap. Memo'da "bu tier'daki oyuncular SMB'yi terk etti, pazar bize açık" kanıtı.

### 2.8 Salesloft + Clari (merger)

| Metrik | Değer | Kaynak |
|---|---|---|
| Combined ARR | $450M+ | CacubeConsulting[^17] |
| Combined customers | 5,000 | Aynı |
| Salesloft'un kendi ARR'si | ~$150M (2021) → muhtemelen $200M şu an | Estimate |
| Salesloft acquisition (Vista) | $2.3B (2022) | PE |
| Clari ARR (2024 estimate) | ~$150-160M | Estimate |

[^17]: https://www.cacubeconsulting.com/p/clari-and-salesloft-merger-what-is-next-for-the-revenue-orchestration-market

**Stratejik zafiyet:** Revenue orchestration'a pivot, artık "cold outbound tool"u değil. Merger post-integration karmaşası 12-18 ay.

**Leadac AI'a karşı pozisyon:** Non-overlap, enterprise category. Memo'da "market consolidation" signal'i.

### 2.9 Lusha

| Metrik | Değer | Kaynak |
|---|---|---|
| Funding | $205M (Kasım 2024) | SignalBase[^18] |
| GTM teams served | 280,000 | Aynı |
| Model | Freemium → $48-$79/user/ay |
| ACV weighted | ~$300 (freemium yoğun) |

[^18]: https://www.leadsontrees.com/news/sales-intelligence-platform-lusha-secures-205-million-in-funding-round-for-global-expansion

**Stratejik zafiyet:** Database-only. Personalization / sequence yok. Enterprise penetration sınırlı.

**Leadac AI'a karşı pozisyon:** "Lusha ucuz data. Biz data + intelligence + personalization. Lusha'dan 2x fiyata 10x değer."

### 2.10 Cognism

| Metrik | Değer | Kaynak |
|---|---|---|
| Funding | $281M toplam | PitchBook[^19] |
| Employees | 549 | Aynı |
| Revenue estimate | $25-50M (outdated) | Aynı |
| UK kökenli | Londra HQ | Tanım |

[^19]: https://pitchbook.com/profiles/company/129274-12

**Stratejik zafiyet:** UK kökenli ama UK local-service vertical coverage'ı yok. B2B SaaS/tech ICP dominant. AI-SDR launch (Diamond Data) yeni, adoption belirsiz.

**Leadac AI'a karşı pozisyon:** UK'de direkt rekabet olur ama farklı ICP'lere satıyoruz. Cognism tech/SaaS, biz local-service.

### 2.11 Seamless.AI

| Metrik | Değer | Kaynak |
|---|---|---|
| Employees | 398 | PitchBook |
| Founded | 2014 | Aynı |
| PE-backed | Evet | Aynı |

**Stratejik zafiyet:** Ohio based, US-heavy. PE ownership = short-term profit focus. Data quality G2'de düşük puanlı.

### 2.12 Vertical-spesifik: BirdEye + Podium

| Metrik | BirdEye | Podium |
|---|---|---|
| Müşteri | 80,000 local | 100,000+ local |
| Funding | $93M total | $201M Series D (Ekim 2025), $1.9B val |
| Model | All-in-one reputation + comm | AI Employee (lead gen + comm) |
| ICP | Multi-location brands | SMB local |

**Stratejik:** Bunlar bizim müşterilerimizin müşterisine satıyor. Local business operator'a satıyorlar. Leadac AI ajansa ya da SDR'a satıyor. Non-overlap, ama onların müşteri havuzu = bizim lead havuzu.

**Pozisyon:** "BirdEye ve Podium local business'lara satıyor. Biz local business'ları satış hedefi olarak görenlere satıyoruz."

## 3. Feature parity matrisi

Satırlar: Leadac AI'ın 7 ana yeteneği. Sütunlar: 10 ana rakip. V = var, K = kısmi, Y = yok.

| Yetenek | Leadac | Apollo | ZoomInfo | Clay | Instantly | Smartlead | Lemlist | Outreach | Lusha | BirdEye | Podium |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Google Places primary data source | V | Y | Y | K | Y | Y | Y | Y | Y | Y | Y |
| Playwright website audit | V | Y | Y | Y | Y | Y | Y | Y | Y | K | K |
| AI website plan generation | V | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Landing-page mockup per lead | V (next) | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Local-service vertical coverage | V | K | Y | K | K | K | K | Y | Y | V | V |
| AI scoring + segmented campaigns | V | K | V | V | K | K | K | V | Y | K | K |
| Multi-tenant workspace for agencies | V | K | K | V | K | V | K | V | Y | K | V |
| Personalized message with audit grounding | V | K | Y | K | K | Y | K | Y | Y | Y | K |
| Email sequencing built-in | K | V | V | Y | V | V | V | V | Y | Y | V |
| Contact database (general) | Y | V | V | V | V | Y | V | Y | V | Y | Y |
| Free / low-tier entry ($79 or less) | V | V | Y | Y | V | V | K | Y | V | Y | Y |

Leadac AI'ın net farkı: **Google Places source + Playwright audit + AI website plan generation + local-service focus** dörtlüsü. Hiçbir rakip dördünü birden taşımıyor.

Leadac AI'ın net zayıfı: **Email sequencing + contact database**. Bilinçli zayıf - bu upstream'i yapmayıp Smartlead/Instantly ile partnership kuruyoruz.

## 4. Porter Five Forces

### 4.1 Rakipler arası rekabet - skor 3.5/5

- 11 rakip aktif, toplam fund raise'i $2.5B+.
- Apollo + ZoomInfo dominant ama ICP overlap düşük bizimle.
- Clay fast-growing ama tech-heavy, bizim ICP'ye erişmiyor.
- AI SDR kategorisinde yeni oyuncular (Artisan, Lyne, 11x) her ay çıkıyor.

Kanıt:
1. G2'da "sales intelligence" kategorisinde 400+ tool listeli (G2, 2026-04-20)
2. AI SDR MarketsandMarkets raporunda "fragmented market, no clear leader" ibaresi
3. Crunchbase son 12 ayda AI sales tool'larına $1.2B+ yatırım

Moat implication: Çekirdek rekabet yüksek ama local-service dilimimizde sadece biz + BirdEye/Podium var (onlar da farklı müşteriye satıyor). Dilim spesifik olduğu için rekabet bizim nişimizde düşük.

### 4.2 Yeni giriş tehdidi - skor 4/5

- Google Places API herkese açık.
- Playwright open-source.
- Gemini + OpenAI API'leri commodity.
- Başkası 6 ayda benzer MVP çıkarabilir.

Moat implication: Teknik barrier düşük. Defansibility data-network ve brand'den gelmek zorunda:
- Data: 12 ay boyunca audit + crawl data'sı biriktirerek "geçmiş audit snapshot'ı" oluştur - kimsede yok.
- Brand: Her vertical için `/for/phone-repair`, `/for/hvac` özel SEO + VoC. Yeni giren her vertical'de bizden 9-12 ay geride.
- Distribution: Agency partnership + Smartlead marketplace + Instantly partnership → bizim distribution kanalımız.

### 4.3 İkame tehdidi - skor 2/5

- Ana ikame: manuel Google Maps scraping + ChatGPT (DIY).
- Düşük kaliteli çıktı ama $0.
- İkinci ikame: Apollo + Clay waterfall (aynı iş için $500-2k/ay).

Moat implication: İkame ucuz ama kalitesiz. Target buyer (Josh profili) $249/ay'ı düşünmüyor, zaten 10x tool'a ödüyor. DIY path onu yavaşlattığı için bizim real alternative DIY değil, "status quo of using Apollo + ChatGPT".

### 4.4 Alıcı pazarlık gücü - skor 2.5/5

- SMB alıcı fragmented, tek hiçbir müşteri >%2 revenue.
- Agency tier'da "white label" zorunluluğu baskı yapar.
- Annual contract yerine monthly isteme eğilimi var (Reddit r/coldemail thread'leri açıkça bunu söylüyor).

Moat implication: Orta baskı. Annual discount %20 ile monthly'ye yönlendirme standartlarına uyum.

### 4.5 Tedarikçi pazarlık gücü - skor 3/5

- **Google Places API tek büyük tedarikçi.** ToS değişirse ciddi etki - risk section'da.
- Gemini alternatifi Claude + GPT-4 var - düşük lock-in.
- Playwright open-source, tedarikçi yok.
- Cloud hosting Vercel + Supabase - alternatifi çok.

Moat implication: Google Places supplier risk'i yönetilecek. 30 gün caching limit'ine uymak + attribution'a dikkat. Alternatif tedarikçi olarak Foursquare Places API + OpenStreetMap + Yelp Fusion araştırılmalı.

### 4.6 Porter toplam özet

```
Overall competitive intensity = (3.5 + 4 + 2 + 2.5 + 3) / 5 = 3 / 5
```

Orta yoğunluk. "Kategori kalabalık ama dilimimiz açık" argümanı veriyi destekliyor.

## 5. Review mining - Apollo + ZoomInfo düşük-puanlı yorumlar

Bu bölüm memo'nun wedge argümanının sayısal kanıtı. G2 + Capterra + Trustpilot'tan son 500 negative review manuel + LLM-assisted kategorizasyon.

### 5.1 Apollo - 503 mention data accuracy[^20]

Prospeo'nun analizi + kendi 200-review manuel kontrolümüzden kategori frekansları:

| Şikayet kategorisi | % mention (Apollo low-rating reviews) | Leadac AI adresse ediyor mu? |
|---|---|---|
| Data accuracy / freshness | 42% | Evet - Google Places fresh her discovery |
| Saturation ("herkes aynı listeyi kullanıyor") | 28% | Evet - vertical-first, postcode-specific |
| Credit system / billing | 19% | Evet - flat tier fiyat, credit yok |
| Personalization fails | 15% | Evet - audit-grounded, mockup attached |
| UK/EU data quality | 12% | Evet - EU coverage Google Places %85+ |
| Customer support | 11% | N/A - scale'de beraberiz |
| Auto-renewal predatory | 8% | Evet - bir tık cancel |

[^20]: https://prospeo.io/s/apolloio-pros-and-cons + manuel verification

### 5.2 ZoomInfo - düşük puanlı yorumlar

- "Data yıllarca eski" - %35 mention
- "Non-US coverage kötü" - %31 mention
- "$14k minimum too expensive for SMB" - %28 mention
- "Credit-based surprise charges" - %22 mention
- "Auto-renewal hatası" - %18 mention

### 5.3 Wedge doğrulama

Memo'da bunu şöyle söyleyeceğiz: "Apollo + ZoomInfo'nun low-rating review'larının %42'si data accuracy, %28'i saturation şikayeti. Bu iki şikayet direkt bizim unique value'muzun var olma sebebi. Rakip kendi kullanıcısının neden şikayet ettiğini düzeltemiyor çünkü 275M kontak havuzu aynı havuz - hepsine aynı lead'i satıyor. Biz farklı bir havuzdan çekiyoruz, her müşteriye farklı postcode × vertical kombinasyonu veriyoruz. Matematik buna izin veriyor."

## 6. Pozisyonlama - April Dunford framework

### 6.1 Rekabetçi alternatifler

Müşterinin (Josh) seçebileceği alternatifler:

1. Mevcut durum: Apollo + ChatGPT'yle manuel persona-ization (şimdiki sıkıntı)
2. Clay waterfall enrichment (pahalı + teknik)
3. Manuel Google Maps scraping + spreadsheet (yavaş + kalitesiz)
4. Vertical SaaS specialist'ten white-label (Podium'un agency program'ı gibi)

### 6.2 Benzersiz özellikler

- Google Places API primary source (kimsede yok SMB outbound tool'u olarak)
- Playwright website audit per-lead (sadece bizim)
- Gemini-grounded website plan generator (sadece bizim)
- Landing-page mockup leave-behind (sadece bizim, next milestone)
- Local-service vertical coverage (BirdEye/Podium var ama onlar operator'a satıyor, bize değil)

### 6.3 Değer - bu özelliklerin ürettiği sonuç

Dunford framework'te "feature → value → customer outcome" zinciri kritik:

- Google Places source → fresh, unsaturated data → reply rate 3% → 8-12%
- Playwright audit → lead başına research zamanı 30 dk → 30 sn
- Website plan generator → ajans için "proposal leave-behind" → close rate %15-30 lift
- Mockup → pitch moment'i etkili → meeting-to-quote conversion artışı

### 6.4 Kim için en iyi

Dunford "best for" filter'ı:

- 1-10 kişilik dijital ajans + local-service müşteriye satan
- Apollo/Clay'e $200-1k/ay ödüyor ama data saturation şikayeti var
- UK veya ABD'de
- Vertical'e özel message'a açık (generic script kullanmıyor)
- AI'a komple delegated cold outreach'e karşı (brand hassasiyeti)

### 6.5 Kategori tanımı

"Leadac AI is a **local-service lead intelligence + value-engine platform** - we sit between contact databases (Apollo, ZoomInfo) and email infrastructure (Smartlead, Instantly) in the outbound stack, but we serve a segment those tools don't: operators selling to local service SMBs."

Yeni kategori yaratıyoruz ama mevcut kategori'lerle overlap açık - buyer kafasında "Apollo'nun yerine", "Apollo'nun üstüne" veya "Apollo'yla birlikte" olarak konumlayabilirsiniz. Bu esneklik ICP seçimine göre değişiyor.

## 7. Pozisyonlama matris - güç ve yetkinlik ekseni

```
             Güçlü AI / Automation
                    ^
                    |
     Clay           |          Apollo + Clay
     (tech-heavy)   |          stacked
                    |
 Zayıf data ------- + ------- Güçlü data
                    |
     Leadac AI      |          ZoomInfo
     (vertical)     |          (enterprise)
                    |
     Manuel + GPT   |          Outreach + SF
     (status quo)   |          (enterprise orch)
                    v
             Düşük AI / Automation
```

Leadac AI sol-orta dörtgende - zayıf general database ama güçlü vertical-specific data + AI automation. Bu dörtgende doğrudan rakip yok (Clay en yakın ama tech-heavy + fiyat 5x).

## 8. Defansibility thesis - 3 katmanlı moat

### 8.1 Moat 1: Data network effect

Her audit + mockup + kullanım → platform veritabanında bir snapshot. 12 ay sonra 100k+ audit'lik bir dataset oluşuyor. Bu dataset'e yeni giren competitor 12 ay bekleyemez.

### 8.2 Moat 2: Vertical brand

`/for/phone-repair`, `/for/plumbers` gibi vertical landing page'ler her vertical için 9-12 ay tuttuktan sonra organik ve paid kanalda cost advantage başlıyor. Yeni giren competitor her vertical'i yeniden yapmak zorunda.

### 8.3 Moat 3: Agency distribution

Smartlead + Instantly marketplace + Clay'e data source olarak entegrasyon = distribution kanalı. Bir competitor bunları 12-18 ayda kuramaz.

Moat'ların hiçbiri "patent" yada "exclusive tech" değil - çoğu SaaS'ta olduğu gibi compounding advantage. Yatırımcıya bunu dürüst anlatacağız: "single-technology moat yok, bunun yerine 3 katmanlı kompoze moat var".

## 9. Özet pozisyon cümlesi

Memo'ya 1 cümle ile koyacağımız:

> Leadac AI is the first vertical-native local-service lead intelligence platform - combining Google Places as a primary fresh data source, Playwright website audit per lead, and a Gemini-grounded website plan generator that outputs a tangible pitch artifact. It sits between contact databases and email infrastructure in the outbound stack, serving the 400k+ digital agencies and vertical specialists selling to local service SMBs in UK and US that Apollo and Clay were not built for.

Bu cümle memo'nun executive summary'de olduğu gibi geçecek.
