# Kaynak envanteri

Hazırlık: 2026-04-20. Bu dosya memo'yu yazarken hangi kaynağa hangi soruyu sorduğumuzun kaydı. Her satır bir tool + amaç + maliyet + alternatif içeriyor. Paid kaynak elimize geçmezse hangi ikinci en iyi yolla aynı sayıya ulaşırız yazılı.

Araştırma boyunca tekrar tekrar dönülecek tek kaynak listesi. Yeni bir soru geldiğinde önce buraya bakıp "bu zaten araştırıldı mı?" kontrol edilecek.

## Önerilen toplam harcama ve kararlar

| Kalem | Maliyet | Zorunlu? |
|---|---|---|
| SimilarWeb Pro 1 ay | ~$200 | Evet - rakip traffic için temel |
| Statista 1 rapor download | ~$500 | Hayır - Gartner/IBISWorld ile ikame edilebilir |
| Interview teşviki (20 × $75) | $1,500 | Evet - birincil VoC delili olmadan memo güvenilir değil |
| Datawrapper / Flourish | $0 | Evet - chart için |
| Pitchbook trial | $0 (1 aylık trial) | Tercihli - yoksa Crunchbase + LinkedIn |
| Chart designer (Fiverr) | ~$200 | Hayır - kendimiz de yapabiliriz |
| **Toplam beklenen** | **~$2,400** | |

Alternatif, $0 senaryo: Pitchbook yerine Crunchbase public profiles + SEC filings + SimilarWeb web verisi + LinkedIn headcount manuel sayımıyla %80 kapsama. Kritik eksik: NRR ve net new ARR rakamları (bunlar sadece Pitchbook/Gartner'da). Memo'da bu eksikliği "peer benchmark proxy" olarak işaretleriz.

## 2.1 Pazar büyüklüğü ve sektör raporları

| Kaynak | Sorgu | Format | Maliyet | Notlar |
|---|---|---|---|---|
| Statista | "Sales Intelligence Software UK / US market size 2025" | Rapor indirme | $500/rapor (öğrenci $39) | Top-down triangulation'da tek başına güvenilmez - kaynak olarak başka raporları sayıyor |
| IBISWorld | "Advertising Agencies in the UK" (SIC 73110), "Digital Advertising Agencies in the US" (NAICS 541810) | Industry report | $495 veya kütüphane | Agency ICP sayımı için güçlü, revenue size breakdown veriyor |
| Gartner | "Market Guide for B2B Marketing Data Providers", "Magic Quadrant for Sales Engagement" | Client raporu | Erişim yoksa analyst call | Summary bazen public press release'de çıkıyor |
| Forrester | "Wave: Sales Engagement Platforms Q4 2025" | Client raporu | Research seat $3k+ | Freepdf arşivlerinde genelde buluyor |
| IDC | "Worldwide Sales Intelligence Applications Forecast 2024-2028" | Rapor | $4.5k | Rakam için Apollo/ZoomInfo 10-K çoğu zaman yeterli |
| Grand View Research | "AI in Sales Market Size 2023-2030" | Public summary | $0 (free summary) | Yaklaşık rakam verir, footnote'da belirtilir |
| MarketsandMarkets | Aynı pazarın paralel raporu | Public abstract | $0 | Üçgenleme için |

Kritik: bu "pazar araştırma firması" raporları birbirine atıfta bulunduğu için %30-%40 kolaylıkla sapabiliyor. Memo'da üç kaynak üst üste tutunca ortalama alınır, her biri tek başına verilmez.

## 2.2 Rakip ve şirket intelligence

| Kaynak | Sorgu | Format | Maliyet | Notlar |
|---|---|---|---|---|
| Pitchbook | Apollo, ZoomInfo, Clay, Instantly, Smartlead, Lemlist, Outreach, Salesloft, Lusha, Seamless funding + valuation | Platform | Trial 14 gün veya $3k+/yıl | En güvenilir kaynak |
| Crunchbase Pro | Aynı | Platform | $49/ay | Public alternatif, funding rounds kapsaması iyi |
| SEC EDGAR | ZoomInfo (ZI) 10-K/10-Q, HubSpot (HUBS), Salesforce (CRM) relevant segmentler | Public filing | $0 | NRR, revenue growth, customer count kamuya açık |
| SimilarWeb | Rakip traffic, geo breakdown, brand search | Platform | $200/ay | Rakip momentum proxy'si |
| Semrush / Ahrefs | Organik keyword share, backlink profile | Platform | $129/ay | İçerik pazarlama momentum'u |
| BuiltWith | Apollo JS tag kullanıcı sayısı | Platform | $295/ay Pro, free basic | Apollo tag tarayıcı embed eden şirket sayısı = paying customer proxy |
| Wappalyzer | Aynı | Extension + API | $99/ay | BuiltWith ile cross-check |
| G2 | Apollo, ZoomInfo, Clay rating + review count + son 500 review | Public | $0 | Review mining için temel |
| Capterra | Aynı | Public | $0 | G2 ile cross-check |
| TrustRadius | Aynı | Public | $0 | Enterprise segment review'ları daha iyi |
| Gartner Peer Insights | Aynı | Public | $0 | 500+ employee müşteri segmenti için |

## 2.3 Voice of Customer - birincil araştırma

| Kaynak | Amaç | Zaman | Notlar |
|---|---|---|---|
| Reddit (r/coldemail, r/agency, r/SMMA, r/sales, r/SaaS, r/Entrepreneur, r/smallbusiness, r/DigitalMarketing) | Son 90 gün thread'leri, top 50 post/subreddit | 1 gün otomasyon + 1 gün okuma | Proje içinde `last30days` skill'i zaten çalışıyor, sorguları genişletecez |
| Twitter/X | Sales-AI community (Alex Berman, Eddie Shleyner, Jordan Crawford, Cole Gordon, Will Allred, Nick Abraham) son 90 gün | 1 gün | Ücretsiz web search ile erişilebilir |
| YouTube transcripts | Alex Berman, Charlie Morgan, Robb Bailey, Lead-Gen-Jay, Sales-Engineer kanalları | 1 gün | yt-dlp + whisper ile offline transcription |
| LinkedIn Sales Navigator | "Agency owner" + "BDR/SDR" UK/US headcount filtresi | 0.5 gün | $99/ay trial |
| Product Hunt | Son 12 ay rakip launch'ları + yorum tonu | 0.5 gün | Public |
| Indie Hackers | Solo founder revenue reports filtresi | 0.5 gün | Public |
| Customer discovery interview | 15-20 ICP × 30 dk Zoom | 14 gün takvim, ~8 saat interview + 8 saat synthesis | $1.5k teşvik bütçesi |

Interview recruitment kanalları:
- Reddit DM (`BUYER-PERSONA.md`'deki Josh thread'i dahil): hedef 5 yanıt → 3 interview
- LinkedIn Sales Nav outbound: hedef 50 mesaj → 10 yanıt → 6 interview
- Twitter DM: hedef 20 mesaj → 5 yanıt → 3 interview
- Mevcut beta kullanıcıları: 8 kişi → 5 interview

Toplam hedef 20-25 recruited, 15-20 tamamlanmış. Her bir interview 45-60 dakika.

## 2.4 Pazar büyüklüğü taban sayımları

| Kaynak | Sorgu | Format | Maliyet |
|---|---|---|---|
| US Census Bureau County Business Patterns | NAICS 811212 (phone repair), 238220 (HVAC/plumbing), 621210 (dental), 541810 (advertising agencies), 541613 (marketing consulting) | CSV download | $0 (api.census.gov) |
| US BLS QCEW | NAICS 5418 employment | CSV | $0 |
| UK ONS Business Demography | UK SIC 73110, 95120, 86230, 43220 | CSV | $0 |
| Companies House | UK SIC code by active company | Bulk API | $0 |
| OpenCorporates | Cross-border doğrulama | Public + API | Free tier 500/ay |
| Google Places API | 5 UK şehri + 10 US metro × 5 vertical sampling | Leadac AI'ın kendi ürünü | Mevcut quota |

## 2.5 Trend ve timing kanıtı

| Kaynak | Sorgu | Maliyet |
|---|---|---|
| Google Trends | "cold email AI", "apollo alternative", "ai sdr", "local lead generation", "google maps lead generation" son 5 yıl | $0 |
| Glimpse (Chrome extension) | Trends breakout deltaları | $0 free tier |
| Exploding Topics | "ai sdr", "ai cold email", "lead enrichment" | $0 free tier |
| GitHub | Açık kaynak cold-email repolarının star velocity'si (örn. `instantly-clone`, `ai-sdr-*`) | $0 |
| Hacker News Algolia | "cold email", "outbound AI" son 2 yıl hikaye + puan | $0 |
| Crunchbase Funding Tracker | AI sales tools kategori yatırım hacmi son 12 ay | $0 public |

## 2.6 Regülasyon ve risk

| Kaynak | Sorgu | Maliyet |
|---|---|---|
| ICO UK | PECR Regulation 22 cold email kuralları | $0 |
| ICO UK | GDPR Article 6 legitimate interest cold outreach | $0 |
| FTC US | CAN-SPAM Act compliance requirements | $0 |
| State AG siteleri | CCPA (CA), CPA (CO), VCDPA (VA), CTDPA (CT), UCPA (UT), TDPSA (TX) cold email notification requirements | $0 |
| Google Maps Platform ToS | Places API terms, caching (30 gün), attribution | $0 |
| Apollo.io Terms of Service | Commercial use and scraping clauses | $0 |
| ZoomInfo Terms of Service | Aynı | $0 |

## Kaynak kalite kriterleri

Bir kaynaktan gelen rakam memo'ya girecekse şu sorulardan geçmek zorunda:

1. Kaynak tarihi 18 aydan eski mi? Eskiyse 2026-04 için güncelleme yok mu?
2. Kaynağın kendisi nereye atıfta bulunuyor? Zincirin ucunda birincil veri var mı yoksa rapor-rapora atıf mı?
3. Başka bir kaynakla cross-check edilebilir mi?
4. Metodoloji açıklanmış mı? Örnek: "Digital agency sayısı X" diyorsa hangi tanımı kullanıyor?

Bu testleri geçemeyen kaynak footnote'ta "tahmin" etiketiyle konur veya atılır.

## Araştırma günlüğü

Bu dosyaya her önemli bulgu tarihle eklenir. Format:

```
2026-04-20 - Apollo ARR: $195M (Crunchbase, April 2025 funding round pre-money 1.6B) - cross-check: Forbes "Next Billion-Dollar Startups 2024" listesi
```

Memo yazarken footnote bu günlüğe pointer verir, dosya kaybolmaz.
