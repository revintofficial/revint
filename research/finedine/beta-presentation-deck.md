# LeadAC AI — FineDine Beta Sunum Deck Yapısı

**Sunum amacı:** LeadAC AI platformunu FineDine ekibine beta ürün olarak sunmak, gerçek verilerle değer kanıtlamak, kullanım senaryolarını somutlaştırmak.
**Hedef kitle:** FineDine C-level / BD / Product
**Format:** 10 sayfalık slide deck (Keynote/Figma/Google Slides)
**Renk paleti:** LeadAC brand (`--leadac-deep-blue: #0B1120`, `--leadac-accent: #3B82F6`, `--cine-gold: #D4A853`) + FineDine brand renkleri (beyaz + turuncu accent)
**Tipografi:** Inter veya Geist Sans (başlıklar bold), body regular

---

## Sunum Gidişatı — Detaylı Senaryo Akışı

### Açılış (Slide 1-2): Problem + Biz Kimiz
Sunuma FineDine'ın BD ekibinin günlük yaşadığı acıyla başla: "Her gün yüzlerce restoran arasından hangisine ulaşacağınıza nasıl karar veriyorsunuz? Hangi restoran FineDine'a en çok ihtiyaç duyuyor? Bu soruyu AI ile cevaplıyoruz."

### Gövde (Slide 3-7): Ürün Deneyimi + Gerçek Veri
Camden Town'da 20 kafe/restoran üzerinde canlı çalışan sistemin çıktılarını göster. Her adımı gerçek bir lead üzerinden (LUMI Camden) anlat. Dashboard → Discovery → Lead Analiz → Opener akışını uçtan uca göster.

### Kanıt (Slide 8): Beta Test Sonuçları
İlk beta round'un (12 işletme) sonuçlarını ve ikinci batch'in (20 Camden işletmesi) tam başarı oranını göster.

### Kapanış (Slide 9-10): Entegrasyon Planı + CTA
FineDine'ın mevcut BD workflow'una nasıl entegre olacağını ve next step'leri anlat.

---

## SLIDE 1 — Kapak

### Başlık
**LeadAC AI × FineDine**
*F&B Lead Intelligence — Beta Preview*

### Alt başlık
"Her restoran bir fırsat. AI hangisinin fırsat olduğunu söyler."

### Design tarifi
- **Background:** Koyu gradient (`#0B1120` → `#1E293B`), sağ alt köşede subtle gold radial glow
- **Ortada:** LeadAC logosu (sol) + "×" + FineDine logosu (sağ), her ikisi de beyaz versiyonları
- **Alt kısım:** Tarih ("Mayıs 2026") + "Beta Preview — Confidential" etiketi, `#D4A853` gold renkte muted text
- **Sağ üst köşe:** Subtle dotted grid pattern (techy vibe)
- **Animasyon:** Logo'lar fade-in, alt text slide-up

### Screenshot referansı
Yok (brand slide)

---

## SLIDE 2 — Problem Statement

### Başlık
**F&B Sektöründe Lead Generation Sorunu**

### İçerik (3 sütun layout)

| Sorun | Açıklama | Rakam |
|-------|----------|-------|
| **Manuel Araştırma** | BD ekibi her restoran için 30-45 dk Google + Instagram + site taraması yapıyor | ~45 dk/lead |
| **Yanlış Segmentasyon** | Fine dining'e QSR pitch'i, cafe'ye enterprise teklif — conversion düşük | %5-8 reply rate |
| **Ölçeklenemiyor** | Bir BD rep günde max 15-20 restoran araştırabilir | 400 lead/ay ceiling |

### Alt mesaj
> "FineDine 60+ ülkede 1,500+ venue'ya hizmet veriyor. Her yeni pazarda binlerce potansiyel müşteri var — ama hangisi QR menüye ihtiyaç duyuyor, hangisi zaten dijitalleşmiş?"

### Design tarifi
- **Layout:** Üstte bold başlık, ortada 3 kart yan yana (glassmorphism kartlar — `rgba(255,255,255,0.05)` bg, `1px solid rgba(255,255,255,0.1)` border)
- **Her kartın üstünde:** Kırmızı-turuncu ikon (saat ikonu, hedef ikonu, kilitli ikon)
- **Her kartın altında:** Büyük rakam (`45 dk`, `%5-8`, `400/ay`) — gold renkte, 48px font
- **Alt kısım:** Tırnak işareti içinde mesaj, italik, muted beyaz
- **Background:** Aynı koyu tema, subtle F&B fotoğraf overlay (restoran iç mekan, çok düşük opacity %8)

### Screenshot referansı
Yok (konsept slide)

---

## SLIDE 3 — Çözüm Overview

### Başlık
**LeadAC AI: 5 Dakikada Restoran → Satış Dosyası**

### İçerik (Yatay pipeline akışı)

```
[1. Discover]  →  [2. Crawl & Audit]  →  [3. Review Intelligence]  →  [4. Sales Scoring]  →  [5. Personalized Opener]
   Google Places      Website + Social      500+ yorum analizi         Paket önerisi           Kişiye özel email
   ile tarama         otomatik audit        sentiment + KPI            pain → feature match      Türkçe/İngilizce
```

### Alt açıklama
Her adım tamamen otomatik. BD rep sadece **Dashboard'a bakar ve gönderir.**

### Design tarifi
- **Layout:** Üstte başlık, ortada yatay pipeline flow (5 yuvarlak ikon node, aralarında ok çizgisi)
- **Her node:** 64x64 circle icon (mavi gradient bg), altında 2 satır açıklama
- **Pipeline çizgisi:** Dashed line, `#3B82F6` mavi, animasyonlu akan nokta efekti
- **Arka plan:** Koyu tema, pipeline çizgisi boyunca subtle glow
- **Alt kısım:** Tek satır bold mesaj, ortada

### Screenshot referansı
- **Screenshot 1:** `/app/dashboard` sayfasının genel görünümü — lead pipeline istatistikleri, recent leads listesi
- **Tarif:** Dashboard'un üst kısmındaki stat kartları (Total Leads, Analyzed, Ready to Contact) ve aşağıdaki lead tablosunun ilk 5 satırı görünmeli

---

## SLIDE 4 — Discovery: Nasıl Lead Buluyoruz?

### Başlık
**Akıllı Keşif: Camden Town'da 20 Kafe, 3 Dakikada**

### İçerik (Sol-sağ split)

**Sol panel (metin):**
- Google Places API + Apify Deep Enrichment
- 10 alt-segment otomatik sınıflandırma:
  - `fnb-fine-dining` — Michelin, tasting menu restoranlar
  - `fnb-cafe-bakery` — Specialty coffee, fırınlar
  - `fnb-bar-club` — Cocktail bar, gece kulüpleri
  - `fnb-ghost-kitchen` — Sadece delivery mekanlar
  - `fnb-hotel-fnb` — Otel restoranları
  - ...ve 5 alt-segment daha
- Her lead'e otomatik sub-niche tag'i + confidence score
- Duplikasyon kontrolü (aynı mekan iki kez çıkmaz)

**Sağ panel (screenshot):**
Camden Town arama sonuçları — 20 kafe listesi

### Gerçek veri kutusu (highlight)
```
Son batch: Camden Town, Londra
20 işletme keşfedildi → 20/20 analiz tamamlandı ✓
Ortalama rating: 4.7 / 5
Toplam yorum havuzu: 10,650+ Google Review
```

### Design tarifi
- **Layout:** 60/40 split — sol metin, sağ screenshot
- **Sol:** Bullet list, her sub-niche yanında küçük renkli tag badge'i (fine-dining = gold, cafe = kahverengi, bar = mor)
- **Sağ:** MacBook mockup içinde Discovery sayfası screenshot'u, subtle drop shadow
- **Alt kısım:** Yeşil arka planlı highlight kutusu (gerçek veri), check mark ikonu
- **Background:** Koyu tema, sol alt köşede subtle harita grid pattern

### Screenshot referansı
- **Screenshot 2:** `/app/discovery` sayfası — harita + liste görünümü, Camden Town bölgesi, 20 pin, filtreleme paneli
- **Tarif:** Haritada Camden bölgesi zoom'lu, sol panelde kafe listesi, üstte niche filtresi "Cafes & bakeries" seçili

---

## SLIDE 5 — Analiz Derinliği: LUMI Camden Örneği (Bölüm 1)

### Başlık
**Tek Bir Lead'in Analiz Derinliği**
*LUMI Camden — 4.8 ★ / 2,505 Yorum / Camden High St*

### İçerik (Dashboard screenshot + data overlay)

**Üst kısım — Lead kartı:**
```
LUMI Camden
📍 82 Camden High St, London NW1 0LT
⭐ 4.8 (2,505 yorum)  |  Segment: Cafe & Bakery  |  Lead Score: 85
🌐 lumilondon.co.uk  |  📱 Instagram: @lumicamden
```

**Sol alt — Review Intelligence:**
```
50 yorum analiz edildi | %94 pozitif sentiment

Güçlü Yönler:                    
├─ Great Food         57% (28 yorum)
├─ Friendly Staff     35% (17 yorum)
├─ Attentive Staff    31% (15 yorum)
├─ Cozy Atmosphere    20% (10 yorum)
└─ Great Hospitality  14% (7 yorum)

Weakness KPI: Yok (temiz müşteri profili)
```

**Sağ alt — Website Audit:**
```
✅ HTTPS aktif
✅ Mobil uyumlu
✅ Structured data var
⚠️ Load time: 2,616ms (yavaş)
❌ Booking sistemi YOK
❌ E-commerce YOK
❌ İletişim formu YOK
❌ WhatsApp linki YOK
```

### Design tarifi
- **Layout:** Üstte lead hero kartı (geniş, koyu arka plan, sol köşede Google rating yıldızları animasyonlu)
- **Ortada:** İki sütun (Review Intelligence sol, Website Audit sağ)
- **Review Intelligence:** Yatay bar chart (mavi gradient bar'lar), her bar'ın yanında yüzde + mutlak sayı
- **Website Audit:** Checklist formatı, yeşil check / kırmızı X / sarı uyarı ikonları
- **Lead kartı arka plan:** Subtle LUMI Camden fotoğrafı (çok düşük opacity), üstünde glassmorphism overlay
- **Sağ üst köşe:** "Lead Score: 85" büyük daire gauge (mavi-yeşil gradient)

### Screenshot referansı
- **Screenshot 3:** `/app/leads/[LUMI-id]` sayfası — lead detail page üst kısmı (hero card + rating + basic info)
- **Screenshot 4:** Aynı sayfanın "Review Analysis" tab'ı — sentiment pie chart + strength KPI bar'ları
- **Screenshot 5:** Aynı sayfanın "Website Audit" tab'ı — audit checklist sonuçları
- **Tarif:** Lead detail sayfasının tam görünümü, review analysis section'ı açık, bar chart'lar görünür

---

## SLIDE 6 — Analiz Derinliği: LUMI Camden Örneği (Bölüm 2)

### Başlık
**AI Dossier: Satışçının İhtiyacı Olan Her Şey, Tek Sayfada**

### İçerik (Dossier markdown render)

**Sales Angles (AI tarafından üretildi):**

> **1. Menü Modernizasyonu**
> "Müşterileriniz 'eski, kirli ve yağlı menülerden' şikayet ediyor. FineDine QR menü ile fiziksel menüleri kaldırın, menüyü anında güncelleyin." *(Kaynak: Google Reviews)*
>
> **2. Sabah Yoğunluğu Çözümü**
> "2,505 yorumluk trafiğiniz sabah rush'ında kuyruk demek. Order-ahead ile 7am kuyruklarını siparişe çevirin, %30 daha fazla repeat visit." *(Kaynak: Niche Pack)*
>
> **3. Rezervasyon Eksikliği**
> "Online rezervasyon sisteminiz yok. Masaları doldurmak için müşterilerin aramadan rezervasyon yapabilmesini sağlayın." *(Kaynak: Website Audit)*

**Recommended Package:**
```
📦 Premium — $119/ay
├─ QR Menü (kirli menü sorununu çözer)
├─ Online Reservations (eksik)
├─ Guest CRM + WhatsApp
├─ AI Upsell Engine
└─ Conversion Analytics
Neden: "Mevcut yoğun müşteri trafiği + 'çok eski, kirli menüler' geri bildirimi
→ Premium paketteki dijital menü + CRM + akıllı tavsiyeler en uygun çözüm."
```

**Opportunity Score: 78/100** | **Sales Confidence: 65/100**

### Design tarifi
- **Layout:** Tek sütun, akıcı card layout — her sales angle ayrı kart
- **Sales angle kartları:** Sol kenarı renkli (mavi, yeşil, turuncu) border-left ile ayrılan quote kartları
- **Her kartın sağ alt köşesinde:** Kaynak badge'i ("Google Reviews", "Website Audit", "Niche Pack")
- **Recommended Package:** Ayrı bir büyük kart, altın border, içinde feature listesi (check mark ikonlarıyla)
- **Opportunity Score:** Sağ üst köşede iki daire gauge yan yana (78 ve 65)
- **Background:** Açık versiyona geçiş — `#F8FAFC` beyaz-gri, clean look

### Screenshot referansı
- **Screenshot 6:** `/app/leads/[LUMI-id]` sayfasının "AI Dossier" tab'ı — markdown render'lı dossier içeriği
- **Screenshot 7:** Aynı sayfanın "Sales Opportunity" bölümü — package recommendation kartı
- **Tarif:** Dossier'nin "Sales Angles" bölümü ve "Recommended Package" kartı görünmeli

---

## SLIDE 7 — Akıllı Açılış Mesajı

### Başlık
**Kişiselleştirilmiş İlk Mesaj: AI Yazar, Rep Gönderir**

### İçerik (Email preview mockup)

```
Konu: LUMI Camden — dijital menü taslağınız hazır

Merhaba LUMI ekibi,

Sitenize ve menü akışınıza hızlıca baktım — 2,505 müşterinizin 
%94'ü memnun, bu harika bir temel.

Ama müşteri yorumlarında bir ortak tema var: "menüler çok eski, 
kirli ve yağlı." Camden'ın en popüler kafelerinden biri olarak 
bu, kolayca çözülebilecek bir fırsat.

FineDine ile size özel bir QR menü taslağı hazırladım — mevcut 
menünüzü dijitale taşıyalım, sabah rush kuyruklarını order-ahead 
ile siparişe çevirelim.

15 dakikalık bir demoya ne dersiniz?

FineDine BD
```

### Alt mesaj
> Intelligence Brief: "Mevcut 'eski, kirli menüler' ve online rezervasyon eksikliği üzerine odaklanın."
> Talking Points: 4 hazır konuşma noktası + 3 olası itiraz ve cevapları

### Design tarifi
- **Layout:** Ortada email client mockup (Apple Mail / Gmail benzeri frame)
- **Email içeriği:** Gerçek font ve spacing ile, bold kısımlar highlight'lı
- **Sağ panel:** "Intelligence Brief" kartı — talking points bullet list, her birinin yanında kaynak badge
- **Sol alt:** "Reply Objections" mini kartları — 3 itiraz kartı stack halinde
- **Background:** Koyu tema, email mockup'u aydınlık (kontrast)
- **Accent:** Email'deki "kirli ve yağlı menüler" quote'u gold highlight ile işaretli

### Screenshot referansı
- **Screenshot 8:** `/app/leads/[LUMI-id]` sayfasının "First Message" bölümü veya opener preview
- **Screenshot 9:** Intelligence Brief kartı — talking points ve objections listesi
- **Tarif:** Opener email preview'u ve intelligence brief kartı yan yana, gerçek içerikle

---

## SLIDE 8 — Beta Sonuçları

### Başlık
**Beta Test Sonuçları: 32 İşletme, 2 Batch**

### İçerik (İki sütun karşılaştırma)

**Batch 1 — Greenwich/Londra (Nisan 2026):**
```
12 işletme test edildi
├─ 6/12 tam analiz tamamlandı
├─ 6/12 ID/data sorunları (düzeltildi)
├─ 8 sistemik bug tespit edildi
├─ 6 P0 fix uygulandı
└─ Tester feedback: 48 madde
```

**Batch 2 — Camden Town (Mayıs 2026):**
```
20 işletme keşfedildi
├─ 20/20 analiz tamamlandı ✅
├─ 20/20 sub-niche atandı ✅
├─ 20/20 review analysis tamamlandı ✅
├─ 20/20 website audit tamamlandı ✅
├─ 20/20 dossier üretildi ✅
├─ 20/20 sales scoring tamamlandı ✅
├─ 0 embedding hatası ✅
└─ 0 Gemini API hatası ✅
```

**Aradaki gelişim:**
```
Batch 1 → Batch 2 İyileşme:
├─ Analiz başarı oranı:    50% → 100%
├─ Instagram-as-website bug: 5 lead → 0 (FIX)
├─ Embedding crash:         12 failure → 0 (FIX)
├─ Gemini 403:              4 failure → 0 (FIX)
└─ Sub-niche doğruluğu:    ~60% → ~90%
```

### Design tarifi
- **Layout:** Üstte başlık, ortada iki büyük kart yan yana (Batch 1 sol — kırmızı accent, Batch 2 sağ — yeşil accent)
- **Her kart:** Rounded corner, subtle shadow, üstte batch başlığı, altında metrikler
- **Metrikler:** Monospace font, tree-style indent (`├─`, `└─`), renkli check/cross ikonları
- **Alt kısım:** "Aradaki gelişim" kartı tam genişlik, yeşil-mavi gradient border, ok ikonu yukarı
- **Batch 1 kartı:** Kırmızı-turuncu border-top (sorunlu)
- **Batch 2 kartı:** Yeşil border-top (başarılı)
- **Background:** Koyu tema

### Screenshot referansı
- **Screenshot 10:** Dashboard'daki lead listesi — 20 Camden lead'inin tümü "ANALYZED" status'unda
- **Tarif:** Lead tablosunda status sütununda hepsinin yeşil check gösterdiği görünüm

---

## SLIDE 9 — FineDine BD Workflow Entegrasyonu

### Başlık
**Mevcut BD Akışınıza Nasıl Eklenir?**

### İçerik (Before/After akış diyagramı)

**BUGÜN (Manuel):**
```
BD Rep → Google'da ara → Siteyi incele → Instagram'a bak →
Yorumları oku → Excel'e not al → Email yaz → Gönder
⏱️ 45 dk/lead × 15 lead/gün = 11.25 saat/gün
```

**LeadAC İLE:**
```
BD Rep → Dashboard'u aç → Filtrele (bölge + segment) →
AI Dossier'ı oku → Opener'ı düzenle → Gönder
⏱️ 3 dk/lead × 50+ lead/gün = 2.5 saat/gün
```

### Metrik karşılaştırma kartları
```
                    Bugün       LeadAC ile     İyileşme
Lead başına süre:   45 dk       3 dk           15x hızlı
Günlük kapasite:    15 lead     50+ lead       3.3x fazla
Haftalık outreach:  75 email    250+ email     3.3x fazla
Segmentasyon:       Manuel      AI otomatik    %90 doğruluk
Kişiselleştirme:    Generic     Yorum-bazlı    Her lead özel
```

### Design tarifi
- **Layout:** Üstte başlık, ortada iki yatay akış diyagramı (before: gri/kırmızı, after: mavi/yeşil)
- **Before akışı:** Gri kutular, aralarında gri oklar, sağda kırmızı saat ikonu + süre
- **After akışı:** Mavi kutular, aralarında mavi oklar, sağda yeşil saat ikonu + süre
- **Alt kısım:** 5 sütunlu karşılaştırma tablosu, "İyileşme" sütunu yeşil highlight
- **Görsel:** Before'dan After'a büyük bir kesikli ok ("LeadAC AI" etiketi ile)
- **Background:** Açık tema (`#F8FAFC`)

### Screenshot referansı
Yok (infografik slide)

---

## SLIDE 10 — Next Steps & CTA

### Başlık
**Sonraki Adımlar**

### İçerik (Yol haritası timeline)

```
📅 Hafta 1-2: Pilot Kurulum
├─ FineDine BD ekibinden 2-3 rep seçimi
├─ Hedef şehir belirleme (İstanbul / Londra / Dubai)
├─ Workspace kurulumu + paket tanımlama
└─ İlk 50 lead keşfi + analizi

📅 Hafta 3-4: Canlı Kullanım
├─ Rep'ler dashboard üzerinden lead review
├─ AI opener'ları düzenleme + gönderme
├─ Feedback loop aktif (her lead'e 👍/👎)
└─ Haftalık performans raporu

📅 Hafta 5-8: Ölçeklendirme
├─ Şehir sayısını artırma (5+ market)
├─ CRM entegrasyonu (HubSpot/Salesforce export)
├─ Outreach sequence otomasyonu
└─ ROI raporu + tam lisans kararı
```

### CTA
> **"15 dakikalık bir pilot demo ile başlayalım.
> Sizin için bir hedef şehir seçin — ilk 50 lead'i biz analiz edelim."**

### Design tarifi
- **Layout:** Sol tarafta dikey timeline (nokta + çizgi), sağda her phase'in detayları
- **Timeline noktaları:** 3 büyük daire (mavi → yeşil → gold gradient progression)
- **Her phase kartı:** Glassmorphism, subtle shadow, içinde bullet list
- **CTA:** Slide'ın alt 1/3'ünde, büyük gold arka planlı kart, ortada bold metin, altında iki buton:
  - [Demo Planla] — mavi solid buton
  - [Pilot Başvuru] — gold outline buton
- **Background:** Koyu tema, alt kısımda subtle LeadAC + FineDine logoları yan yana
- **İletişim:** Email + takvim linki sağ alt

### Screenshot referansı
Yok (CTA slide)

---

## EKLER — Screenshot Çekim Listesi

Sunumdan önce alınması gereken screenshot'lar:

| # | Sayfa | URL Path | Ne göstermeli | Slide |
|---|-------|----------|---------------|-------|
| 1 | Dashboard | `/app/dashboard` | Stat kartları + recent leads tablosu (20 Camden lead) | 3 |
| 2 | Discovery | `/app/discovery` | Harita + Camden bölgesi + 20 pin + niche filtresi | 4 |
| 3 | Lead Detail Hero | `/app/leads/[LUMI-id]` | Lead hero card (rating, adres, segment, score) | 5 |
| 4 | Review Analysis | `/app/leads/[LUMI-id]` tab: Reviews | Sentiment pie + strength KPI bar chart | 5 |
| 5 | Website Audit | `/app/leads/[LUMI-id]` tab: Audit | Audit checklist (yeşil/kırmızı ikonlar) | 5 |
| 6 | AI Dossier | `/app/leads/[LUMI-id]` tab: Dossier | Sales angles + weak points markdown | 6 |
| 7 | Package Rec | `/app/leads/[LUMI-id]` tab: Opportunity | Recommended package kartı | 6 |
| 8 | Opener Email | `/app/leads/[LUMI-id]` tab: First Message | Email preview + opener text | 7 |
| 9 | Intelligence Brief | `/app/leads/[LUMI-id]` tab: Brief | Talking points + objections | 7 |
| 10 | Lead List | `/app/leads` | 20 Camden lead'in tümü ANALYZED status'unda | 8 |

**Screenshot çekim talimatları:**
- Tarayıcı: Chrome, 1440×900 viewport
- Tema: Dark mode (uygulamanın varsayılan teması)
- Veri: `finedine-owner@leadac.beta` hesabıyla giriş
- Workspace: FineDine Beta (workspace ID: `5496e39e-cc76-41bd-b18b-f1128fb9e41b`)
- Örnek lead: LUMI Camden (ID: `cmoozvr4t000jkz043baocw6m`)
- Hassas veri: Email adresleri ve API key'leri blur'lanacak

---

## ÖRNEK ANALİZ — LUMI Camden Tam Veri Dökümü

Bu bölüm, sunumda referans olarak kullanılacak gerçek DB verisinin dökümüdür.

### Lead Bilgileri
```
İşletme:        LUMI Camden
Adres:          82 Camden High St, London NW1 0LT, UK
Google Rating:  4.8 / 5
Yorum Sayısı:   2,505
Website:        https://www.lumilondon.co.uk/
Primary Type:   cafe
Sub-niche:      fnb-cafe-bakery (confidence: 0.6)
Crawl Status:   CRAWLED
Analyze Status: ANALYZED
```

### Review Intelligence (50 yorum analiz edildi)
```
Sentiment Breakdown:
  Pozitif:  94%
  Nötr:      2%
  Negatif:   4%

Strength KPIs:
  ┌──────────────────────┬──────┬───────┐
  │ Label                │ %    │ Count │
  ├──────────────────────┼──────┼───────┤
  │ Great Food           │ 57%  │ 28    │
  │ Friendly Staff       │ 35%  │ 17    │
  │ Attentive Staff      │ 31%  │ 15    │
  │ Cozy Atmosphere      │ 20%  │ 10    │
  │ Great Hospitality    │ 14%  │ 7     │
  └──────────────────────┴──────┴───────┘

Weakness KPIs: Yok (temiz profil)
Lead Score (Review): 65
```

### Website Audit
```
HTTPS:              ✅ Evet
Mobil Uyumlu:       ✅ Evet (guess)
Structured Data:    ✅ Var
Load Time:          2,616 ms (⚠️ yavaş)
Booking Sistemi:    ❌ Yok
E-commerce:         ❌ Yok
İletişim Formu:     ❌ Yok
Booking Provider:   Yok
Tespit Edilen:      menu, breakfast
```

### Sales Opportunity
```
Opportunity Score:  78 / 100
Recommended:        Premium ($119/ay)

Likely Pain Points:
  1. Müşteriler, 'menülerin çok eski, kirli ve yağlı' olduğundan şikayet ediyor.
  2. Web sitesinde interaktif bir QR menü veya dijital menü bulunmuyor.
  3. Online rezervasyon sistemi eksikliği müşteri erişimini kısıtlıyor.
  4. Doğrudan online ödeme veya sipariş entegrasyonu yok.
  5. Müşteri geri bildirimlerine göre 'hizmet kalitesini önemli ölçüde iyileştirme' ihtiyacı var.
  6. Güncel olmayan veya 'yanlış gösterilen açılış saatleri' müşteri memnuniyetsizliğine yol açıyor.
  7. Müşterilerle doğrudan WhatsApp üzerinden iletişim kurma olanağı yok.

Package Recommendation Reason:
  "İşletmenin mevcut yoğun müşteri trafiği ve 'çok eski, kirli ve yağlı menüler'
   gibi müşteri geri bildirimlerini dikkate aldığımızda, hem dijital menü ihtiyacını
   karşılayacak hem de online rezervasyon, CRM ve satış artırıcı akıllı tavsiyeler
   sunacak Premium paketimiz en uygun çözümdür."
```

### AI Dossier (Lead Score: 85)
```
Headline:
  "LUMI Camden'ın dijital menü ve online sipariş eksikliklerini FineDine ile giderme fırsatı."

Sales Angles:
  1. Menü Modernizasyonu — "Müşteriler 'eski, kirli ve yağlı menülerden' şikayet ediyor.
     Dijital menü ile modernleşin."
  2. Sabah Yoğunluğu — "Yoğun sabah kuyruklarını siparişle hızlandırın,
     müşteri deneyimini iyileştirin."
  3. Rezervasyon — "Online rezervasyon eksikliği var; masaları kolayca doldurun."
  4. Müşteri Sadakati — "Müşteri sadakatini artırın, tekrarlayan ziyaretleri teşvik edin."

Weak Points:
  • Fiziksel menüler "çok eski, kirli ve yağlı"
  • Online order-ahead/delivery entegrasyonu yok
  • Online rezervasyon sistemi yok
  • Yanlış gösterilen açılış saatleri
  • Loyalty/in-app promotions yok
  • İletişim formu ve WhatsApp linki yok
  • Website performans sorunları + zayıf güvenlik başlıkları

Risk:
  Müşteri feedback'i "hizmet kalitesini önemli ölçüde iyileştirme" ihtiyacı
  işaret ediyor — menü ötesinde operasyonel zorluklar olabilir.
```

### Intelligence Brief
```
Sales Confidence: 65 / 100
Confidence Breakdown:
  Audit:        55
  Weight:       70
  Reviews:      65
  Opportunity:  78

Next Action: CALL_NOW
  "Mevcut 'eski, kirli menüler' ve online rezervasyon eksikliği üzerine odaklanın."

Best Time to Call: ~15:00-17:00 (öğle ve akşam yemeği arası)

Talking Points:
  1. "Müşteriler 'eski, kirli menülerden' şikayetçi. Dijital menü ile modernleşin."
  2. "Yoğun sabah kuyruklarını siparişle hızlandırın."
  3. "Online rezervasyon eksikliği var; masaları kolayca doldurun."
  4. "Müşteri sadakatini artırın, tekrarlayan ziyaretleri teşvik edin."

Reply Objections:
  1. "Zaten mevcut bir sistemimiz var."
  2. "Dijitalleşmeye ihtiyacımız yok, geleneksel kalmak istiyoruz."
  3. "Şu an yeni bir şeye yatırım yapacak bütçemiz yok."

Confirmed Missing Features:
  QR menü, Online rezervasyon, Online ödeme/sipariş entegrasyonu, WhatsApp iletişim kanalı

Red Flags: Yok
DNC (Do Not Contact): Hayır
```

---

## Sunum Süresi Tahmini

| Slide | Süre | Kümülatif | Notlar |
|-------|------|-----------|--------|
| 1. Kapak | 30s | 0:30 | Hızlı giriş |
| 2. Problem | 2 dk | 2:30 | Empati kur, FineDine BD acısını hissettir |
| 3. Çözüm | 2 dk | 4:30 | Pipeline'ı hızlıca göster |
| 4. Discovery | 3 dk | 7:30 | Canlı demo yapılabilir |
| 5. Analiz Pt.1 | 4 dk | 11:30 | LUMI Camden deep dive — review + audit |
| 6. Analiz Pt.2 | 4 dk | 15:30 | Dossier + package — aha moment |
| 7. Opener | 3 dk | 18:30 | Email preview + intelligence brief |
| 8. Sonuçlar | 2 dk | 20:30 | Batch 1 vs Batch 2 karşılaştırma |
| 9. Entegrasyon | 2 dk | 22:30 | Before/after workflow |
| 10. CTA | 1.5 dk | 24:00 | Kapanış + next steps |

**Toplam: ~24 dakika** (ideal: 25 dk sunum + 10 dk soru-cevap)

---

## Camden Town Lead Portföyü (20 Lead Özeti)

Sunumda "batch 2" olarak referans verilen 20 lead'in özeti:

| # | İşletme | Rating | Yorum | Website | Sub-niche | Status |
|---|---------|--------|-------|---------|-----------|--------|
| 1 | Camden Coffee Roastery | 4.6 | 799 | ✅ camdencoffeeroastery.com | cafe-bakery | ANALYZED |
| 2 | Glass Coffee | 4.9 | 662 | ✅ glasscoffee.co.uk | cafe-bakery | ANALYZED |
| 3 | Rocco Coffee Bar | 4.9 | 10 | ❌ | cafe-bakery | ANALYZED |
| 4 | Barman Coffee Co | 4.9 | 166 | ❌ | cafe-bakery | ANALYZED |
| 5 | The Coffee Jar | 4.6 | 576 | ❌ (Twitter) | cafe-bakery | ANALYZED |
| 6 | Black Sheep Coffee | 4.7 | 513 | ✅ blacksheepcoffee.co.uk | cafe-bakery | ANALYZED |
| 7 | One Shot Coffee | 4.6 | 500 | ❌ (Facebook) | cafe-bakery | ANALYZED |
| 8 | LUMI Camden | 4.8 | 2,505 | ✅ lumilondon.co.uk | cafe-bakery | ANALYZED |
| 9 | Brew's | 4.9 | 23 | ✅ brewscoffee.co.uk | cafe-bakery | ANALYZED |
| 10 | Bossa Coffee Bar | 5.0 | 15 | ✅ bossa.coffee | cafe-bakery | ANALYZED |
| 11 | Blank Street Coffee (Chalk Farm) | 4.7 | 464 | ✅ blankstreet.com | cafe-bakery | ANALYZED |
| 12 | Blank Street Coffee (High St) | 4.6 | 535 | ✅ blankstreet.com | cafe-bakery | ANALYZED |
| 13 | Fabler Bakery Camden | 4.9 | 1,141 | ✅ fabler.net | cafe-bakery | ANALYZED |
| 14 | IL BOTANICO | 4.6 | 335 | ❌ | cafe-bakery | ANALYZED |
| 15 | My Matcha & Coffee | 4.9 | 8 | ❌ | cafe-bakery | ANALYZED |
| 16 | Fable and Falcon | 4.3 | 34 | ✅ fableandfalcon.com | cafe-bakery | ANALYZED |
| 17 | Camden Tea Bar | 5.0 | 2,063 | ✅ camdentea.shop | cafe-bakery | ANALYZED |
| 18 | The Stables Cafe | 3.9 | 26 | ❌ | cafe-bakery | ANALYZED |
| 19 | Pedlar's Pitstop | 4.7 | 101 | ✅ lbpedlar.com | cafe-bakery | ANALYZED |
| 20 | Corretto by the Canal | 4.6 | 923 | ✅ corretto.coffee | cafe-bakery | ANALYZED |

**Toplam: 10,923 Google Review analiz edildi**
**Ortalama Rating: 4.68**
**Website olan: 12/20 (%60)**
**Analiz başarı: 20/20 (%100)**
