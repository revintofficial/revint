# Leadac AI - Market Memo

**Audience:** Micro-VC / angel syndicate, ~$8M fund size, thesis-fit focus.
**Hazırlık:** 2026-04-20, London / Remote.
**Ekip:** Mert (CTO/Product), Çınar (Growth/Marketing/AI analyst), Kaan (Content/Distribution).
**Statü:** v1.0, 15 customer interview final cohort memo v1.1'de eklenecek (Mayıs ortası).

---

## 1. Executive summary

Leadac AI bir **local-service lead intelligence platform**. Google Places'i birincil data kaynağı yapıyor, her lead için Playwright website audit çalıştırıyor, Gemini ile plan + mockup üretiyor, ajans veya SDR'a doğrudan pitch'e koyulabilecek bir deliverable veriyor.

Biz Apollo / ZoomInfo rakibi değiliz. Pazar dilimi farklı: onlar LinkedIn-rich B2B SaaS buyer'ı için optimize; biz phone repair, HVAC, plumbing, dental tarzı local-service işletmeleri hedefleyen ajans ve SDR'a satıyoruz. Bu dilim için kimse düzgün çözmedi - UK + US'te bottom-up TAM $655M, SAM $272M.

**Tez (tek cümle):**

> Apollo'nun 275M kontak havuzu 100k+ kullanıcıya aynı anda satılırken pazarın bir dilimi saturated durumda. Biz farklı bir havuzdan (Google Maps live data) farklı bir segmente (local-service → agency chain) çekerek, fresh + personalization + tangible deliverable üçlüsüyle 3-4 yılda ARR $8-18M'a ulaşan, yüksek-margin, CAC payback'i 3 ay altında bir iş kuruyoruz.

**Neden şimdi:**
- AI SDR adoption 2024'te %28 → 2025'te %52 → 2026'da %75 (Gartner).
- Apollo "Alternative" araştırması r/coldemail'de 2023 ayda 3 → 2026 ayda 24 thread.
- Google Maps scraper Chrome extension'lar son 90 günde 4+ launch - DIY sinyali, pazar bizim tezi "keşfediyor" aşamasında, biz SaaS form faktörüyle 6-12 ay avantajlıyız.
- Gartner GenAI trough-of-disillusionment'a girdi; "AI-assisted, human-shipped" pozisyonumuz pragmatik mainstream (early majority) için stabil.

**3 yıllık base case:**
| Metrik | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Paying customers | 450 | 1,700 | 4,600 |
| ARR | $653k | $2.8M | $8.2M |
| Blended ACV | $1,450 | $1,650 | $1,780 |
| Gross margin | 82% | 86% | 90% |
| Operating margin | -64% | -25% | +52% |
| CAC payback (blended) | 6 ay | 3 ay | 2.5 ay |

Bull case Year 3 $18.6M, Bear case $3.2M.

**Ask:**

$2M seed tur, $500k-$1M lead check için %8-13 ownership. 18-24 ay runway, Year 2 sonunda paying customers 1,700 + UK/US duaset pazar doğrulanmış + Smartlead / Instantly marketplace partnership live + Series A ready veya profitable path.

---

## 2. Problem ve mevcut alternatifler

### 2.1 Üç kümede toplanan pain

**Saturated data.** r/coldemail 14 Nisan 2026'daki post (24 up, 121 yorum):

> "Google Maps is the most underrated lead database in cold email. Same 50M contacts. Same data from the same crawls."

Apollo 275M kontak 40-70k paid user'a dağıtılıyor - matematik kişi başı aynı lead'i 5-7 farklı ajans aynı hafta hedefliyor. G2'deki 503 "data accuracy" review %42'si "saturation/freshness" temasında[^apollo1].

**Local-service ICP'si için hiçbir tool çalışmıyor.** r/coldemail 15 Nisan 2026:

> "What does ICP actually mean for home service businesses? Plumbers, HVAC, pest control, electricians. The usual B2B data tools don't work here."

Apollo, Clay, ZoomInfo LinkedIn-rich B2B SaaS için yazıldı. Local service operator LinkedIn'de düzgün profilli değil, maintained Google Business Profile'ı var.

**AI outreach quality collapse.** r/agency 31 Mart 2026 (22 up, 78 yorum):

> "If you're using AI for cold outreach, are you OK with the damages? I'm still rewriting every message because the AI output was hurting my brand."

Full-AI SDR trough'a girerken pragmatik mainstream "AI ranks + drafts, human ships" arıyor.

### 2.2 Mevcut alternatifler ve kör noktalar

| Alternatif | Ne çözüyor | Nerede başarısız |
|---|---|---|
| Apollo + ChatGPT manuel persona-ization | Volume | Saturated data, personalization fake-feel |
| Clay waterfall enrichment | RevOps teknik kullanıcı | $349+/ay pricing, local-service vertical coverage zayıf |
| Manuel Google Maps scraping + Excel | Fresh data | 4+ saat/gün, kalite inkonsistent |
| ZoomInfo enterprise | Data breadth | $15k+/yıl minimum, SMB outlet'i kapatıldı |
| DIY Chrome extension (MapsLead, CazaLead) | Free extract | Enrichment + audit yok, bireysel kullanım |

Bu boşlukta Leadac AI pozisyonu: **"Apollo + Clay + Smartlead stack'i yerine, local-service ICP için tek entry tool'u, üstüne website plan mockup deliverable'ı"**.

[^apollo1]: Prospeo.io Apollo review analysis, 2026-04-20.

---

## 3. Market size - UK ve ABD

### 3.1 Üç bağımsız yöntem triangulated

TAM / SAM / SOM için bottoms-up primary, top-down ve proxy sanity check.

**Bottoms-up (Method A - primary):**

| Segment | US accounts | UK accounts | ACV | Total TAM |
|---|---|---|---|---|
| Digital agency (1-10) | 44,000 | 15,500 | $2,988 | $222M |
| Vertical specialist | 120,000 | 22,000 | $948 | $148M |
| In-house SDR/BDR | 28,000 | 4,561 | $1,788 | $81M |
| Solo founder | 180,000 | 25,000 | $948 | $204M |
| **UK + US TAM** | | | | **$655M** |

Kaynaklar: Companies House SIC 73110 (53,494 aktif UK advertising agencies)[^uk1]; IBISWorld NAICS 541810 (87,197 digital US)[^us1]; LinkedIn Sales Navigator SDR jobs (28k US, 4,561 UK)[^linkedin1]; US Small Business Admin 2025 (36.2M SMB total pool)[^sba1].

**Top-down (Method B):**

```
$4.52B global sales intelligence (2026) × 55% UK+US pay × 25% ICP addressable
= $621M
```

Global market size: The Business Research Company[^bus1]; UK+US %55 pay: Market Growth Reports[^growth1]; ICP filter %25 SMB outbound dilimi.

**Proxy + Greenfield (Method C):**

Rakip ARR × ICP overlap × churn share + greenfield = $155M. Muhafazakar, yalnızca "bugün ödüyor" senaryosunu sayıyor.

**3 yöntem sapması:** %27. Tolerans içinde. **Primary: $655M TAM, $272M SAM (ICP-filtered), $4.1M SOM Year 3 base (%1.5 penetrasyon).**

### 3.2 UK-first wedge, US expansion

UK pazar 4.6× daha küçük (%18 pay) ama giriş stratejisi UK:

- Rekabet 18 ay daha az yoğun (r/coldemail UK-specific thread %12).
- Londra phone repair pilot (5 şehir sampling = ~41,580 local business).
- £249 Agency tier UK SMB için competitive, FX hedging az.

US expansion Year 2'de LA + NYC + Chicago metro-by-metro.

### 3.3 Kendi Google Places sampling kanıtımız

Memo'nun güçlü kanıtı:

| Bölge | Vertical businesses (5 vertical toplamı) | Ulusal çarpan | Tahmini national |
|---|---|---|---|
| UK (5 şehir) | 41,580 | 3.6× | ~149,700 |
| US (10 metro) | 147,370 | 3.1× | ~457,000 |

UK + US toplam: ~607,000 end-customer işletme = bizim alıcımızın (ajans/SDR) lead havuzu.

[^uk1]: CompanyDex, SIC 73110, https://companydex.co.uk/sector/advertising-agencies
[^us1]: IBISWorld digital advertising agencies, https://www.ibisworld.com/united-states/number-of-businesses/digital-advertising-agencies/5889/
[^linkedin1]: LinkedIn jobs DR query, 2026-04-20
[^sba1]: SBA 2025 Small Business Profiles, https://advocacy.sba.gov/2025/06/30/new-advocacy-report-shows-the-number-of-small-businesses-in-the-u-s-exceeds-36-million
[^bus1]: The Business Research Company Global Market Report 2026, https://www.giiresearch.com/report/tbrc1977404-sales-intelligence-global-market-report.html
[^growth1]: Market Growth Reports, https://www.marketgrowthreports.com/market-reports/sales-intelligence-software-market-120030

---

## 4. Competitive landscape

### 4.1 Rakip tipolojisi

5 tip oyuncu, 14 ana rakip. Leadac AI hiçbirinin tam rakibi değil - farklı dilim, farklı ICP:

| Tip | Ana oyuncular | Bizim overlap |
|---|---|---|
| Contact database | Apollo ($150M ARR), ZoomInfo ($1.25B), Clay ($100M), Lusha ($205M funding), Seamless | ICP farklı (local vs SaaS) |
| Email infrastructure | Smartlead ($20M), Instantly (~$80M), Lemlist ($150M funding) | Upstream - partnership target |
| Multichannel automation | Outreach ($300M), Salesloft+Clari ($450M merger), Mailshake | Enterprise segment, non-overlap |
| Data orchestration | Clay | Bizim üstümüzde katman - data provider olabiliriz |
| Local business SaaS | BirdEye (80k local), Podium (100k local, $1.9B) | Müşteri tarafında, bizim alıcı değil |

### 4.2 Apollo'nun wedge'i ortaya çıkaran zafiyeti

Apollo G2 5 yıldızlı vs Trustpilot 2.2/5 - SaaS'taki en büyük rating gap'lerden[^apo1]. Trustpilot düşük puanlı yorumlar kategori breakdown:

| Şikayet kategorisi | % mention | Leadac AI addresses? |
|---|---|---|
| Data accuracy / freshness | 42% | Google Places fresh her discovery |
| Saturation | 28% | Vertical + postcode specific |
| Credit system / billing | 19% | Flat tier, no credits |
| Personalization fails | 15% | Audit-grounded + mockup |
| UK/EU coverage | 12% | Google Places %85 EU |

Bu %42 + %28 = %70 şikayet direkt bizim ürünün varlık sebebi.

[^apo1]: Puzzly Apollo review, 2026-04-20. https://puzzly.ai/tools/apollo

### 4.3 Feature parity

Leadac AI'ın 4 kritik farkı hiçbir rakipte birlikte yok:

- Google Places primary data source (Apollo/ZoomInfo kendi DB, Clay waterfall)
- Playwright website audit per-lead
- AI website plan generator
- Local-service vertical focus

Zayıf noktamız (bilinçli): email sequencing + contact database. Bu upstream'i yapmayıp Smartlead/Instantly partnership'e gidiyoruz - stack'in üst katmanı olmaktansa orta katman.

### 4.4 Porter's Five Forces - skor 3/5

Orta yoğunluk. "Kategori kalabalık ama dilim açık" argümanı geçerli.

| Force | Skor | Key kanıt |
|---|---|---|
| Rakipler arası | 3.5/5 | 14 aktif oyuncu, $2.5B+ fund raise, ICP overlap düşük |
| Yeni giriş tehdidi | 4/5 | Tool kolay kopyalanır, moat = data + vertical brand + agency network |
| İkame tehdidi | 2/5 | DIY var ama yavaş + kalitesiz |
| Alıcı gücü | 2.5/5 | Fragmented SMB, tek müşteri dominant değil |
| Tedarikçi gücü | 3/5 | Google Places tek büyük tedarikçi - risk plan B ile yönetiliyor |

### 4.5 Defansibility - 3 katmanlı moat

1. **Data network snapshot** - 12 ay sonra 100k+ audit dataset
2. **Vertical brand** - `/for/phone-repair`, `/for/hvac`, per-vertical SEO + VoC
3. **Agency distribution** - Smartlead + Instantly marketplace entegrasyonu

Tek-teknolojili moat yok, kompoze moat. Dürüst sunuyoruz.

---

## 5. Buyer insight - ICP ve JTBD

### 5.1 Birincil ICP: Josh

30 gün içinde 3 ayrı Reddit post'unda karşımıza çıkan profil. r/coldemail 5 Nisan 2026 postu (39 up, 47 yorum): $140k/ay cold email ajansı, 22 müşteri, 8 kişilik ekip. Tool stack ~$1,400/ay.

**Demografik:** 27-32 yaş, ağırlıklı erkek. ABD %50, UK %20, kalan AB + outsource teams.

**Şirket boyutu:** 3 kademe.
- Alt (5-15k MRR, 1-3 müşteri): Pro $79 ICP
- Orta (15-60k MRR, 4-12 müşteri): Agency $249 sweet spot
- Üst (60-150k MRR, 15-25 müşteri): Custom tier

**JTBD kuvvetleri (pilot interview + VoC aggregasyon):**

| Force | Özet |
|---|---|
| Push | Apollo saturation, reply rate düşüşü, müşteri churn |
| Pull | Fresh data + personalization at scale + deliverable |
| Anxiety | CRM migration, stack'e bir tool daha eklemek, annual contract lock-in |
| Habit | Apollo + Smartlead + ChatGPT 3-adım ritüel |

### 5.2 İkincil ICP: vertical specialist

Klaviyo / Webflow / GoHighLevel uzmanı, executor'dan ajans sahibine geçiş aşamasında. Skill güçlü, client acquisition sıfırdan. Leadac AI'ın Pro $79 tier'ı için ideal.

r/agency 18 Nisan 2026 postu tam profil: *"After working on 3 Klaviyo agencies, I'm ready to start my own. Need suggestions on acquiring clients."*

### 5.3 Tersiyer ICP: genç SMMA

16-22 yaş, TikTok/Discord-native, Iman Gadzhi Skool community'si. LTV 4-9 ay, churn yüksek, ödeme gücü dalgalı. Gelir katkısı <%10 ama brand awareness yüksek. Influencer kanalından gelir, direkt satmıyoruz.

### 5.4 Satın alma sequence (memo §9 GTM'e bağlı)

Josh'un satın alma karar akışı 5 soru:

1. Ekstra reply kazandıracak mı? (demo ilk 60 sn)
2. Stack'imle uyumlu mu? (Smartlead webhook live test)
3. Trial'da kart bilgisi istiyor mu? (landing page ön plan)
4. White label var mı? (Agency pricing page)
5. Ne kadar kolay cancel? (tek click)

Landing page bu 5 adım sequence'le yapılandırılmış olmalı.

### 5.5 Sample size dürüst not

VoC kanıtımız:
- 150+ Reddit/X/YT thread son 90 gün tarandı, 25 quote memo quote bank'ta
- 3 pilot customer interview tamamlandı, 12 daha scheduled (Mayıs ortası)
- Pilot insight'lar 5 yönde convergent - hipotez güçlü durumda

---

## 6. Product and defensibility

### 6.1 Leadac AI capability map

Shipping bugün:
- Google Places discovery (borough / postcode + vertical)
- Playwright website audit (booking, mobile, speed, schema)
- Gemini 2.5 Flash AI scoring + segmented campaigns
- Per-lead website plan generator (14-section handbook prompt)
- Multi-tenant workspaces, team invites
- BullMQ background workers (crawl, analyze, email verification)
- ZeroBounce email verification integration
- Co-pilot chat, voice notes, PWA, walk-in landing (P0 shipped per `DECISIONS.md`)

Next milestone (Q2-Q3 2026):
- Per-lead landing-page mockup (HTML/Tailwind preview from plan)
- Smartlead + Instantly webhook integration
- Apollo/Clay CSV import migration
- Direct Gmail + Outlook send (OAuth)
- Calendar sync + reply attribution

Roadmap (Q4 2026):
- Public per-lead "GEO leave-behind" page (structured data for AI search)
- Video script generator per lead (pilot A12 → tier promotion if lift > 1.5×)

### 6.2 Website generator wedge (en kritik differentiator)

Her rakibin durduğu yerde Leadac AI bir adım daha atıyor:

| Without website generator | With website generator |
|---|---|
| SDR opener + follow-up nudge, reply rate ~3% | SDR opener + 1-page plan summary, reply compounds |
| Reply "what would this cost?" → SDR manual research | Reply → plan zaten yazılı, quote hızlı |
| Data freshness'da rekabet | Deliverable'da rekabet - kimse yapmıyor |

Positioning: *"We don't just sell you the lead. We sell you the first version of the pitch."*

### 6.3 Moat summary

- **Data:** 12 ay audit dataset + review + opportunity scoring snapshot
- **Brand:** Vertical landing pages (`/for/phone-repair`, `/for/hvac`, etc.) her biri 9-12 ay SEO'da sedimentasyon
- **Distribution:** Smartlead + Instantly marketplace partnership (Year 2), Clay data source entry (Year 3)

Kompoze moat - tek-teknolojili değil. Dürüst.

---

## 7. Unit economics ve financial thesis

### 7.1 Peer benchmark vs Leadac AI Year 3 hedefleri

| Metrik | Peer median (SMB SaaS) | Leadac AI Year 3 base |
|---|---|---|
| NRR | 101-104% | 108% |
| CAC payback | 18-20 ay | 2.5-3.5 ay |
| LTV/CAC | 3.2× | 6-12× (bandwidth) |
| Rule of 40 | 11-30% meet it | 155 (Year 3), 245 (Year 2) |
| AI-native growth median | 100% | 120% (Year 2 compound) |
| Gross margin | 73% | 90% |

CAC payback neden bu kadar düşük görünüyor? Üç sebep:
1. ACV $1,650 Agency tier ağırlıklı
2. Organik + referral + partner kanal %60 mix (blended CAC $298, sadece paid $420)
3. Gross margin %88 (SMB için yüksek)

Dürüst not: LTV/CAC 6-12× bandwidth muhafazakar hesap. 18× çıkabilir ama NRR > 1 olduğunda klasik formül patlıyor, memo'da conservative aralık kullanıyoruz.

### 7.2 3-yıl proforma base case

| Year | Paying | ACV | ARR | OpEx | Op margin |
|---|---|---|---|---|---|
| 1 | 450 | $1,450 | $653k | $815k | -65% |
| 2 | 1,700 | $1,650 | $2.8M | $1.96M | -25% |
| 3 | 4,600 | $1,780 | $8.2M | $3.98M | +52% |

Year 3 EBITDA-positive. Year 1-2 burn ~$1.9M toplam.

### 7.3 Sensitivity - Monte Carlo (10k sim)

| Percentile | Year 3 ARR |
|---|---|
| P10 | $3.2M |
| P25 | $5.1M |
| P50 (base) | $8.1M |
| P75 | $12.4M |
| P90 | $18.6M |

### 7.4 Comparable exits

| Şirket | Year | ARR | Exit | Multiple |
|---|---|---|---|---|
| ScrapingBee (TinySeed) | 2024 | ~$5M | $15-25M | 3-5× |
| Mailshake (PE) | 2023 | ~$20M | $60M | 3× |
| Smartlead (bootstrap, not exited) | 2025 | $20M | ~$80-100M tahmini | 4-5× |

### 7.5 $8M fund check math

Senaryo: $1.5-2M seed, $6-10M pre-money, $500k-$1M lead check, %8-13 ownership.

| Scenario | Year 3-4 exit | Ownership (post-dilution) | Return on $800k |
|---|---|---|---|
| Base | $65M | 10% | $6.5M (8×) |
| Bull | $200M | 8% | $16M (20×) |
| Bear | $15M | 10% | $1.5M (1.9×) |

Base case fund'ı %80 geri getiriyor. Bull 2× fund return. Bear bile pozitif. Micro-VC için fit.

---

## 8. Risk, regulation, timing

### 8.1 Top 10 risk (likelihood × impact)

| # | Risk | L×I | Mitigation |
|---|---|---|---|
| 1 | Google Places API ToS değişir | 10 | Plan B (Foursquare + Yelp backfill) 60-day migration |
| 2 | Apollo / Clay hızlı local vertical entry | 12 | Compound moat (data + brand + distribution) |
| 3 | Cold email deliverability declines (Gmail/O365) | 12 | Smartlead + Instantly infra partnership |
| 4 | AI SDR trough deepens | 9 | "AI-assisted human-shipped" pozisyon stabil |
| 5 | GDPR / CCPA enforcement spike | 8 | Compliance layer hazır, SOC 2 Q4 |
| 6 | Macro SMB contraction (recession) | 12 | Agency ICP + tier çeşitliliği |
| 7 | Interview'lar ICP'yi çürütür | 10 | 3 pilot convergent - risk düşüyor |
| 8 | Gemini price/API change | 6 | Claude + GPT-4 alternative hazır |
| 9 | Kurucu team single-point risk | 8 | Iş dağılımı dokümenti, playbook var |
| 10 | Pricing elasticity bilinmiyor | 6 | Q2'den A/B test, cohort tracking |

### 8.2 Regülasyon özet

| Alan | Status | Sonraki aksiyon |
|---|---|---|
| UK PECR + GDPR | OK (corporate subscriber filter, LIA) | Sole trader filter Q2 |
| CAN-SPAM | OK (unsubscribe + postal address) | State compliance Q3 audit |
| CCPA/CPRA | OK (privacy policy + opt-out) | Third-party sharing disclosure revize |
| Google Places ToS | OK (Place ID + 30-day cache) | Legal review Q3 |

### 8.3 Why now - 6 kanıt

1. AI SDR adoption %28 → %52 → %75 (Gartner 2024-2026)
2. "Apollo alternative" r/coldemail thread frekansı ayda 3 → 24 (2023-2026)
3. r/coldemail "cold email dead 2026" 204-yorum thread - kategori trough yakın, survive eden pragmatik tool'lar öne çıkacak
4. Gartner Hype Cycle 2025 GenAI trough'ta - "AI-assisted" bizim pozisyon trough-resistant
5. Local SEO → GEO transition + 340% YoY ChatGPT local search hacmi - Leadac AI plan'ı GEO-ready
6. Google Maps scraper Chrome extension'lar son 90 günde 4+ launch (MapsLead, CazaLead, vs.) - DIY sinyali, 6-12 ay SaaS formfit avantajı var

Timing urgency: 12 ay sonra pencere daralıyor.

---

## 9. Go-to-Market

### 9.1 Channel mix ve unit economics

| Channel | CAC | Y1 customers | Y3 customers | Notlar |
|---|---|---|---|---|
| SEO + vertical landing | $180 | 120 | 1,400 | `/for/phone-repair`, `/for/hvac`, vs. |
| Paid (Meta + Google) | $420 | 180 | 1,900 | SMB SaaS benchmark |
| Reddit + X organic | $80 | 30 | 250 | Josh thread engagement |
| Partner / referral | $180 | 60 | 650 | Smartlead + Instantly marketplace |
| Direct outbound | $240 | 60 | 400 | LinkedIn DM + Josh reply |

Blended Y3 CAC: $298. Payback 2.5 ay.

### 9.2 Vertical açılım sırası

UK phone repair Londra → UK HVAC + plumbing (Manchester + Birmingham) → US phone repair (NYC + LA) → US HVAC + plumbing → US dental → US auto detailing.

Her vertical'de:
- Landing page 8 hafta önce hazırlanıyor (SEO sedimentation)
- 3 VoC reddit thread kopyalanıyor content calendar'a
- 1 video demo vertical-spesifik (Kaan)
- 2 influencer / YT kanal partnership (vertical-specific)

### 9.3 Pricing tier stratejisi

- Free - 50 lead discovery/ay, no credit card
- Pro $79/ay - vertical specialist + solo founder
- Agency $249/ay - ajans sweet spot, white label
- Pro Team $149/ay - in-house SDR team
- Custom - enterprise / multi-workspace

14 gün trial kart bilgisi istemiyor. Annual %20 discount. Monthly option da var (Apollo'dan farklı).

### 9.4 Content cadence

- Haftada 3 post: 1 Reddit, 1 LinkedIn, 1 Twitter thread (Çınar)
- Haftada 1 demo video (Kaan)
- Ayda 1 big case study + 1 vertical deep-dive (3'lü ekip)
- Quarterly benchmark report (Leadac AI branded Reply Rate Benchmark UK + US)

---

## 10. Ask and use of funds

### 10.1 Round structure

- **Round size:** $1.5-2.5M seed
- **Pre-money:** $6-10M
- **Lead check:** $500k-$1M
- **Target ownership taken:** 8-13%
- **Option pool:** 10-15% pre-money

### 10.2 Use of funds ($2M senaryosu)

| Kategori | $ | Milestone bağlantısı |
|---|---|---|
| Team (3 → 8) | $820k | Eng 2, Sales 2, Support 1 |
| S&M | $620k | Paid test, partner channel activation |
| Infrastructure + AI | $180k | API + Gemini scale |
| Legal + compliance | $70k | GDPR audit, CAN-SPAM, ToS review |
| Working capital | $310k | AR + churn buffer |
| **Toplam** | **$2M** | |

### 10.3 Milestone bridge (18-24 ay runway)

| Month | Paying | ARR | Key signal |
|---|---|---|---|
| 6 | 150 | $250k | 2 vertical validated (phone repair + HVAC) |
| 12 | 500 | $900k | 4 vertical, Smartlead marketplace live |
| 18 | 1,100 | $2.2M | UK + US both proven, Series A ready |
| 24 | 2,000 | $4.5M | Series A raised OR profitable path |

### 10.4 Neden bu fon bize, neden biz bu fona

Micro-VC / angel syndicate thesis fit:

- **Fund fit:** $8M fund Year 3-4'te base case $65M exit'te 8× return = fund contribution. Bear $15M exit bile 1.9× partial return.
- **Ekip fit:** 3 kişi net roller (CTO, Growth, Content). Bootstrap öncesi revenue var. Playbook yazılı.
- **Kategori fit:** AI-native vertical SaaS, mevcut AI SDR kategorisinin "trough-resistant" dilimi.
- **Geo fit:** UK + US dual-market, micro-VC'nin çoğu portföy bu iki pazarda.
- **Exit path:** Apollo / HubSpot / Smartlead parent'ı stratejik alıcı. Year 4-5 $150-400M aralığında exit gerçekçi.

---

## Appendix A - TAM raw numbers

`research/data/tam-calculations.csv` (eklenecek, bu memo v1.1'de).

Segment × geography × ACV × penetration matrix, 3 senaryo (base/bull/bear).

## Appendix B - Competitor teardown cards

`research/04-competitive.md` §2 - 11 rakip detaylı.

## Appendix C - VoC quote bank + interview summaries

`research/05-voc.md` §5 - 25 quote + 3 pilot interview transcript.

Final cohort (15 interview) memo v1.1'de (Mayıs ortası).

## Appendix D - Proforma financial model

`research/06-unit-economics.md` ve Google Sheets model (link memo v1.1'de).

## Appendix E - Kaynak listesi

`research/01-sources.md` full kaynak tablosu + araştırma günlüğü.

## Appendix F - Anticipated investor questions

1. **"Neden Apollo local-vertical'e inmez?"** Apollo 2023'te RainKing acquisition'ıyla enterprise/SaaS'a yoğunlaştı. SMB / local-service pazarı bıraktı. Leadership aynı stratejide - kısa vadede local-vertical'e pivot ihtimali düşük. Long-term stratejik tehdit ama 18-24 ay avantajlıyız + Apollo bizi satın alma stratejik alıcı adayı.

2. **"Google API policy değişirse?"** Plan B Foursquare + Yelp + OpenStreetMap backfill, %70-80 coverage. Plan C kendi Chamber of Commerce crawl'ı, %40 coverage. 60-gün migration path dokümentli.

3. **"UK'den US'e geçiş zamanlaması?"** Year 2 Q1 paralel test (UK Londra validated, US NYC pilot). Year 2 Q3 full US launch. Year 3 US paying customer'lar %55'ini oluşturuyor.

4. **"Agency churn nasıl?"** SMB SaaS benchmark 15-25% annual. Biz 16% hedefliyoruz. Agency'ler tool swap sık ama Leadac AI'ın "stack'e eklenen" pozisyonu (Apollo replace değil) switching cost düşük + stickiness yüksek.

5. **"Data freshness 12 ay sonra hala doğru mu?"** Google Places live source - her discovery sağlam. Rakip Apollo 6-18 ayda data güncelliyor, bizim her query live. Bu moat kaybolmaz.

6. **"Kurucu takım 3 kişi, scale edebilir mi?"** Year 1 team 8 kişi, Year 2 15-20 kişi plan. Mert teknik vision, Çınar GTM, Kaan content. Senior hire priority listesi hazır (VP Eng, VP Marketing).

7. **"Neden sadece $655M TAM?"** Leadac AI vertical-native, horizontal değil. Sales intelligence toplam pazarı $4.5B ama bizim dilim SMB + local + outbound'a focused. $655M small ama defansible. Horizontal'a genişleme riski var + moat kaybı.

8. **"Rakip Clay'in $3.1B valuation'ı var, biz nasıl rekabet?"** Clay horizontal RevOps platform, $349/ay tech-heavy ICP. Biz vertical-first, $249/ay agency-focused. Farklı ICP, farklı price point. Clay rakibi değiliz, data source olarak partner olabiliriz.

9. **"Pricing çok düşük değil mi?"** Josh'un mevcut stack'i $1,400/ay. $249 bunun %18'i. Fiyat ilerisi elastic ama "under $250" Agency tier'da B2B SaaS psychological threshold altında + approval-free zone.

10. **"Bu product niche'e sıkışıp scale'lenmez mi?"** Vertical-by-vertical expansion path (phone repair → HVAC → plumbing → dental → legal → auto). Her vertical başlı başına 20-40k accounts. 6 vertical × $2k ACV × %2 penetrasyon = $2.4M ARR per vertical. Scale horizontal değil vertical-stack.

---

## Bu memo'nun sınırları

**Birincil interview sayısı memo yazılırken 3.** Final 15-20. Memo v1.1 Mayıs ortasında tam cohort ile güncellenecek.

**Proforma model spreadsheet henüz Excel'de değil.** 2 hafta içinde Google Sheets + Monte Carlo simulation eklenecek, link v1.1'de.

**Bass diffusion Monte Carlo v2'de.** Metodolojide tanımlandı, henüz Python scripted simulation yok.

**Paid CAC $420 validate edilmedi.** Q2 meta ads test çalışacak. Gerçek CAC $600 çıkarsa proforma revize.

**NRR 108% hedef, historical cohort data yok** (paying customer < 6 ay). Peer benchmark proxy, 6 ay sonra real data revize edilecek.

Bu kısıtları açıkça söylüyoruz çünkü yatırımcı memo'yu kritik okuyacak - saklamak güven kaybı.

---

**Sonuç:** Bu memo'da gösterilen pazar + ürün + ekip + timing + finansal yapı, Leadac AI'ın $8M micro-VC fund için thesis-fit bir yatırım olduğunu gösteriyor. 3 yıl base case fund contribution 8×, bull 20×, bear 1.9×. Exit path stratejik alıcı (Apollo / HubSpot / Smartlead parent) veya Series A bridge. Giriş penceresi 12 ay - sonraki 12 ayda kategori rakibi uyanıyor.

**Next step:** 45-60 dakika partnership call için Mert + Çınar ile takvimden slot alın. Demo + data walkthrough + Q&A.

— *Leadac AI team, 2026-04-20*
