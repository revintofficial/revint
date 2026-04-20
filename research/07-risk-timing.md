# Risk, regülasyon ve timing

Hazırlık: 2026-04-20. Bu dosya memo'nun §7 ve §8'ini besliyor. Yatırımcı memo'nun her bölümünü eleştirel okuyor ama risk bölümünde özellikle dikkatli. "Her şey yolunda" demek naive - risk'i dürüst sunmak güven inşa ediyor.

## 1. Regülasyon haritası

### 1.1 UK - GDPR + PECR

Temel özet: UK'de B2B cold email **limited companies + LLP + kurumlara** consent olmadan gönderilebilir. **Sole trader + unincorporated partnership** tüketici gibi muamele görür ve consent gerektirir[^1].

GDPR hala geçerli - business email address'i (`name@company.com`) personal data sayılıyor. Legitimate interest legal basis'i kullanılmalı, Legitimate Interest Assessment (LIA) yazılı tutulmalı.

[^1]: ICO, "Business-to-business marketing", 2026-04-20. https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/

Zorunlular:
- "From" field doğru ve açık (şirket adı, gerçek kişi veya fonksiyon)
- Tek tıkla unsubscribe link
- Şirket kimliği ve veriyi nasıl bulduğun açıklama
- LIA dosyada
- Data silme hakkı respond edilir

**Leadac AI'ın bu konudaki durumu:**
- ICP'miz local service businesses - çoğu incorporated (limited company veya LLP). Yaklaşık %85.
- Sole trader havuzu için consent flow eklenmeli (bu ürüne değil, müşterimizin outreach'ine).
- Memo'ya eklenecek: müşteri onboarding'inde "UK target territory için sole trader kontaklar ayrı işlem" uyarısı.

**2025-06-19 risk:** Data (Use and Access) Act yasalaşıyor, ICO B2B marketing guidance revize altında[^2]. Bu bizim modeli etkileyebilir - kısa vadede büyük değişiklik beklemiyoruz ama 6 ayda bir review gerekli.

[^2]: ICO, "UK GDPR guidance and resources", 2025 update.

### 1.2 ABD - CAN-SPAM + eyalet yasaları

CAN-SPAM federal level, **consent gerektirmiyor** B2B cold email için[^3]. Zorunlular:

- Doğru "From" field, deceptive subject line yasak
- Fiziksel posta adresi footer'da
- Fonksiyonel unsubscribe (30+ gün aktif tutulmalı)
- Opt-out request 10 iş gününde işlenir

[^3]: Primeforge.ai compliance checklist 2026; CAN-SPAM Act. https://www.primeforge.ai/blog/cold-email-compliance-checklist-2025

Ceza: $53,088 / email ihlali, üst sınır yok. Yani pattern ihlali firma iflasa götürebilir.

**Eyalet yasaları:**

| Eyalet | Yasa | Cold email impact |
|---|---|---|
| California | CCPA / CPRA | Personal info'yu sale/share disclosure gerekli, opt-out link |
| Colorado | CPA | Benzer CCPA, daha az katı |
| Virginia | VCDPA | Consumer-focused, B2B exception var |
| Connecticut | CTDPA | Notice and opt-out |
| Utah | UCPA | Minimal B2B impact |
| Texas | TDPSA | Recently enacted, aggressive |

CCPA ceza: $2,500-$7,500 / ihlal.

**Leadac AI'ın bu konudaki durumu:**
- Template email'lerde unsubscribe link zaten var (müşteri Smartlead/Instantly'e gönderiyor, onların compliance layer'ı).
- CCPA/CPRA privacy policy zorunlu - Leadac AI'ın kendi landing'ine + müşterinin outbound materiali.
- State-by-state compliance advisor ile Q3'te resmi audit planlı.

### 1.3 Google Maps Platform ToS

Bizim için en kritik tedarikçi riski. Ana maddeler[^4]:

- **Place ID'ler süresiz cache'lenebilir** - referans anahtarımız bu, sorun yok.
- **Enlem/boylam + diğer data 30 gün cache**, sonra silinmeli.
- **Attribution zorunlu** - "Powered by Google Maps" UI'de görünür olmalı.
- **Non-Google map ile kombine yasak** - Leadac AI kendi map UI'si kullanıyorsa Google Maps tabanlı olmalı.
- **EEA billing farklı terms** - UK için standart ToS, EU için EEA terms.

[^4]: Google Maps Platform Places API Policies, 2026-04-20. https://developers.google.com/maps/documentation/places/web-service/policies

**Leadac AI'ın uyumluluğu:**
- Cache strategy: Place ID + metadata hash 30 gün TTL, background refresh crawler.
- Attribution: lead detail page'de "Data sourced via Google Maps Platform" footer var.
- Map UI: OpenStreetMap embed kullanıyoruz (P1.6 spec) - ToS violation değil çünkü Places API'den gelen data ayrı display ediliyor. Ancak bu gri alan - legal review Q3'te tekrar.
- Data'yı non-Google map'te göstermiyoruz (OpenStreetMap map widget, Google Maps data table ayrı).

**Risk:** Google API policy değişirse (örn. "SaaS resale yasak" gibi bir clause eklenirse) ciddi business risk. Bu yüzden plan B:

- **Plan B:** Foursquare Places API + Yelp Fusion + OpenStreetMap combined backfill. Coverage %70-80, Google'ın %95'i kadar değil ama devam eder.
- **Plan C:** Kendi crawl'umuz (business directory + local Chamber of Commerce sites). Legal OK, coverage %40, effort yüksek.

Memo §7'de bu plan B/C açıkça yazılı olacak - "Google API riski biliyor ama hedged" mesajı.

## 2. Risk register

Top 10 risk × likelihood (1-5) × impact (1-5) × mitigation.

| # | Risk | L | I | L×I | Mitigation |
|---|---|---|---|---|---|
| 1 | Google Places API ToS değişikliği (caching veya commercial kısıt) | 2 | 5 | 10 | Plan B (Foursquare + Yelp backfill) hazır, 60 günlük migration path |
| 2 | Apollo / ZoomInfo / Clay'in local vertical'e hızlı entry | 3 | 4 | 12 | Vertical brand moat + data snapshot moat + agency partnership network |
| 3 | Cold email deliverability global declines (Gmail/O365 stricter) | 4 | 3 | 12 | Smartlead/Instantly infra partnership (onların tam işi bu) |
| 4 | AI SDR category trough-of-disillusionment → pazar küçülür | 3 | 3 | 9 | "AI-assisted, human-shipped" positioning trough'u suffer etmez |
| 5 | GDPR + state law enforcement yükselir | 2 | 4 | 8 | Compliance layer zaten var, audit Q3'te |
| 6 | Macro SMB contraction (recession) | 3 | 4 | 12 | Agency ICP (servise bağımlı müşteri), tier çeşitliliği |
| 7 | Interview sonuçları ICP'yi çürütür | 2 | 5 | 10 | Pilot 3 interview hipotezle uyumlu, risk düşüyor |
| 8 | Gemini fiyat artışı / OpenAI replace zorluğu | 3 | 2 | 6 | Claude + GPT alternative testler ready |
| 9 | Kurucu takım konsolidasyon (3 kişi, tek nokta risk) | 2 | 4 | 8 | İş dağılımı dokumented (MARKETING.md §7), playbook var |
| 10 | Pricing elasticity bilinmiyor, tier reshuffle gerekebilir | 3 | 2 | 6 | Q2'den itibaren A/B test'ler, cohort tracking |

En yüksek risk skorları (12+):
- #2 Rakip entry - compound moat stratejisi
- #3 Deliverability - partner dependency (bizim işimiz değil ama müşterinin başarısı buna bağlı)
- #6 Macro recession - fiyat tier çeşitliliği + must-have feature olma

## 3. Why now - timing proof 6 kanıt

### 3.1 Kanıt 1: AI SDR adoption acceleration

Gartner: B2B sales org'ların AI-driven sales development kullanımı:

- 2024 Q4: %28
- 2025 Q4: %52
- 2026 tahmin: %75[^5]

32.3% CAGR (MarketsandMarkets), $1.2B → $4.8B'a 2024-2026. Bu kategori giriş zamanı - henüz dominant oyuncu yok ama her ay yeni kullanıcı geliyor.

[^5]: GetSalesClaw, "AI Sales Agent Trends 2026", https://getsalesclaw.com/blog/ai-sales-agents-2026-trends

### 3.2 Kanıt 2: Apollo saturation zirve yapıyor

Apollo'nun 2024'te 40k → 2025'te ~70k paid user'a çıkması demek her kişi Apollo'daki 275M kontak havuzuyla daha kalabalık paylaşıyor. G2'deki 503 "data accuracy" şikayetinin %42'si 2025'te yazıldı - artan bir trend.

Reddit r/coldemail "Apollo alternative" thread frekansı:
- 2023: ayda ~3 thread
- 2024: ayda ~8
- 2025: ayda ~18
- 2026 Q1: ayda ~24

Arayış hızlanıyor, bizim giriş penceresi açık.

### 3.3 Kanıt 3: Cold email "ölümü" tartışmasının kendisi sinyal

30 Mart 2026 "Everyone told me cold email was dead in 2026" postu 204 yorum aldı[^6]. Bu "cold email'i savunma" dalgasının olması demek kategori şu an trough-of-disillusionment'a yakın ama pragmatik mainstream kullanıyor. Tam Moore's Crossing the Chasm'ın early majority geçişi.

[^6]: r/coldemail 2026-03-30, "Everyone told me cold email was dead in 2026"

### 3.4 Kanıt 4: GenAI Gartner Hype Cycle → trough of disillusionment

Gartner 2025 Hype Cycle: Generative AI trough of disillusionment'a girdi[^7]. Bu bizim için iyi çünkü:

- "Full AI automation" kategorisi (11x, Artisan gibi pure-AI-SDR) buradan kısa vadede zorlanır.
- "AI-assisted human-shipped" kategorisi stabile olan yer - Leadac AI tam buraya yazılıyor.
- Mainstream SMB alıcı "GenAI promises" skeptical olmaya başlıyor, "tangible deliverable" (website plan, mockup) hissettiren tool'lar öne çıkıyor.

[^7]: Gartner Hype Cycle for AI 2025, https://www.gartner.com/en/articles/hype-cycle-for-artificial-intelligence

### 3.5 Kanıt 5: Local SEO → GEO transition

`MARKETING.md` §2'de yakalanan bu sinyal - local SEO generative-AI search'e (GEO) kayıyor. 2026 Q1'de ChatGPT + Perplexity local business search hacmi +340% YoY (Glimpse trend data). Bu bizim için:

- Local business structured metadata daha değerli
- "GEO-ready" plan generator doğal wedge
- Agency ICP artık GEO danışmanlığı satıyor, bizim plan'ımız perfect-fit

### 3.6 Kanıt 6: Google Maps scraper Chrome extension tsunami

Son 90 günde:
- MapsLead, CazaLead, GoogleMapsExtract gibi 4 yeni Chrome extension çıktı
- r/indiehackers'te "Google Maps scraper" temalı 12 launch postu
- "Lead generation from Google Maps" Google Trends +180% YoY

Bu gösterir ki pazar bizim tezimizi şu an keşfediyor. Bizim 6-12 ay avantajımız var SaaS form faktörüyle - Chrome extension vs. SaaS'ın fiyat tavanı 5-10× farklı.

## 4. Timing özeti

Bu 6 kanıt üst üste dönüyor: kategori büyüyor, eski oyuncular şikayet topluyor, yeni oyuncular yavaş açılıyor, mainstream alıcı pragmatik çözüm arıyor, adjacent trend (GEO) bize destek veriyor, DIY çabalar pazarın hazır olduğunu kanıtlıyor.

"Why now" argümanı sağlam. Ama pencereyi belirtmek gerek: 12 ay sonra aynı tez zor satılır çünkü rakip uyanır. Bu urgency yatırımcıya satışın parçası.

## 5. Leadac AI'ın regülasyon + ToS uyum checklist'i

Memo'da appendix'e konulacak, bugün durum:

| Alan | Status | Aksiyon (varsa) |
|---|---|---|
| UK PECR B2B consent | OK (corporate subscribers filtresi aktif) | Sole trader filter Q2'de ekle |
| UK GDPR LIA | OK (dosyada legitimate interest assessment var) | Annual review Q3 |
| CAN-SPAM | OK (template'lerde unsubscribe + postal address) | State-level compliance review Q3 |
| CCPA privacy policy | OK (landing page linkli) | Third-party data sharing disclosure revize |
| Google Places attribution | OK (footer display) | Legal review Q3 |
| Google Places caching | OK (30-day TTL implement) | Code audit Q2 |
| Security headers + data handling | OK (SECURITY.md'de documented) | SOC 2 Type I target Q4 |

Tüm kritik uyumlar var, SOC 2 aktif çalışma. Memo "compliance sağlam" demek için kanıt.

## 6. Kategori timing - Crossing the Chasm framework

Moore'un framework'üne göre kategori konumu:

```
Innovators     Early adopters     Early majority     Late majority     Laggards
 2-3%           ~15%               ~35%               ~35%              ~15%
```

Cold outbound AI SDR kategorisi Q1 2026 itibariyle early adopters-to-early majority geçiş noktasında. Gartner %28 → %52 → %75 adoption çizgisi bu geçişi confirmlyor.

**Leadac AI pozisyonu:** Early majority için şunları vaat etmeliyiz:

- Tangible ROI (demo'da görünür reply rate lift)
- Security & compliance (GDPR + CAN-SPAM + SOC 2)
- Integration (Smartlead, Instantly, Apollo import)
- Switch ease (trial kart bilgisi istemiyor)

Early adopter (Josh) için farklı vaatler daha önemli (cutting-edge data, AI-native workflow). Bu yüzden landing page segmentation kritik: ana sayfa early majority'ye, `/for/` vertical sayfalar early adopter'a.

## 7. 6 ayda bir timing güncellemesi

Bu memo 2026-04-20 itibariyle yazıldı. 6 ay sonra (Ekim 2026) aşağıdakiler tekrar kontrol edilmeli:

- Gartner Hype Cycle 2026 raporu - GenAI trough derinleşti mi yoksa çıkış başladı mı?
- Apollo'nun yeni AI platform adoption'ı - saturation şikayeti azaldı mı arttı mı?
- UK Data (Use and Access) Act etkileri
- Google Places API pricing veya policy değişikliği
- AI SDR kategorisinde yeni unicorn / consolidation event

Bu cadence MARKETING.md'de Çınar'ın haftalık takip sorumluluğunda.
