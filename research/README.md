# Leadac AI - UK & US Pazar Araştırması

Hazırlık: 2026-04-20. Micro-VC / angel syndicate ~$8M fund size için standalone market memo (15-30 sayfa, data-room grade).

## Dosya yapısı

| Dosya | İçerik | Rol |
|---|---|---|
| [`MEMO.md`](./MEMO.md) | **Ana memo** - 10 bölüm + 6 appendix | Investor'a gönderilecek çıktı |
| [`00-framework.md`](./00-framework.md) | Araştırma framework seçimi (Bessemer TAM, Porter, JTBD, Dunford, ICONIQ, Moore) | Metodoloji gerekçesi |
| [`01-sources.md`](./01-sources.md) | Kaynak × sorgu × maliyet tablosu | Veri kaynakları envanter |
| [`02-methodology.md`](./02-methodology.md) | Her algoritmanın formülü + varsayımlar | Rakam üretim metodolojisi |
| [`03-market-size.md`](./03-market-size.md) | TAM/SAM/SOM 3 yöntem + Google Places sampling | Memo §3 kaynak |
| [`04-competitive.md`](./04-competitive.md) | 14 rakip teardown + Porter Five Forces + feature matrix | Memo §4 kaynak |
| [`05-voc.md`](./05-voc.md) | 25 quote bank + 3 pilot JTBD Switch Interview | Memo §5 kaynak |
| [`06-unit-economics.md`](./06-unit-economics.md) | Peer benchmark + 3-yıl proforma + Monte Carlo + comparable exits | Memo §7 kaynak |
| [`07-risk-timing.md`](./07-risk-timing.md) | Risk register + regulation (GDPR/CAN-SPAM/CCPA/ToS) + why-now 6 kanıt | Memo §8 kaynak |
| [`08-redteam.md`](./08-redteam.md) | 3 internal + 2 external pre-read + humanizer pass + revision list | Memo kalite kontrol |

## Ana bulgular (3 dakikalık özet)

**TAM:** UK + US toplam $655M bottoms-up, SAM $272M ICP-filtered. 3 yöntem üçgenleme %27 sapma içinde (kabul edilebilir).

**Wedge:** Local-service vertical (phone repair, HVAC, plumbing, dental) için fresh Google Places data + Playwright website audit + AI-grounded website plan generator. Kimse bu dörtlüyü birlikte yapmıyor.

**Neden şimdi:** Gartner AI SDR adoption %28 (2024) → %52 (2025) → %75 (2026). Apollo saturation zirvesinde (G2 şikayetlerin %42'si data freshness). GenAI trough'ta, "AI-assisted human-shipped" pozisyon stabil.

**Unit economics Year 3 base:** ARR $8.2M, gross margin %90, operating margin +52%, CAC payback 2.5-3.5 ay, LTV/CAC 6-12×. Peer grubunun üst %25'inde.

**Ask:** $1.5-2.5M seed, $500k-$1M lead check, %8-13 ownership. Year 3-4 exit base case $65M (8× return), bull $200M (20×), bear $15M (1.9×).

## Memo versiyonlama

**v1.0 (2026-04-20)** - Bu versiyon. "Conditional send" - pre-read için hazır, full data-room için v1.1 bekleniyor.

**v1.1 (beklenen: Mayıs ortası)** - Red-team'in 20 revizyon noktası + 15 customer interview full cohort + Monte Carlo scripted simulation + Google Sheets proforma model link.

**v1.2 (beklenen: Haziran sonu)** - İlk 90 gün paying customer cohort data + real CAC validate + tier mix cohort analysis.

## Bağlı dokümanlar

- [`../MARKETING.md`](../MARKETING.md) - Pozisyonlama, messaging, GTM
- [`../BUYER-PERSONA.md`](../BUYER-PERSONA.md) - Josh persona derin analizi
- [`../DECISIONS.md`](../DECISIONS.md) - Ürün kararları ve implementation durumu
- [`../README.md`](../README.md) - Ürün overview + tech stack

## Kaynaklar özet

Veriler şu kaynaklardan çapraz doğrulandı:

- **Market size:** The Business Research Company, MarketsandMarkets, Market Growth Reports, IBISWorld
- **Competitor intelligence:** Crunchbase, Pitchbook, SEC EDGAR (ZoomInfo 10-K), Sacra, G2, Trustpilot, Apollo/Clay official announcements
- **Business counts:** US Census Bureau CBP (NAICS), UK ONS + Companies House (SIC), SBA 2025 Small Business Report
- **SaaS benchmarks:** ICONIQ Growth State of Software 2025, OpenView/High Alpha 2025 SaaS Benchmarks, SaaS Capital 2024 Private SaaS Survey
- **Regulation:** ICO UK (GDPR/PECR), FTC US (CAN-SPAM), state AG sites (CCPA/CPRA etc.), Google Maps Platform ToS
- **VoC:** Reddit (r/coldemail, r/agency, r/SMMA, r/SaaS) son 90 gün, last30days skill aggregasyon, 3 pilot customer interview

Her rakam en az 2 bağımsız kaynaktan triangulated. Tek-kaynak bağımlılık olduğu yerler memo'da açıkça işaretli.

## Kullanım önerisi

**Yatırımcıya ilk gönderim:**
1. [`MEMO.md`](./MEMO.md) tek PDF/print çıktısı
2. One-pager teaser (hazırlanacak) - 1 sayfa
3. Pitch deck 15 slide (hazırlanacak) - canlı sunum

**Follow-up data room:**
1. Tüm `0*-*.md` dosyaları (detaylı supporting research)
2. Google Sheets proforma model (v1.1)
3. Customer reference list (3-5 kişi)
4. Product demo video (3 dk)
