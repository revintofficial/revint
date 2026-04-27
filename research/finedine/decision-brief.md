# LeadAC v2 — Karar Brifingi (Product Manager için)

**Karar süresi:** 5 dakika okuma · **Karar:** Ship et / Ertele / Kapsamı küçült

---

## TL;DR

LeadAC bugün tüm restoran müşterilerini tek bir kalıba sokuyor. Bu yüzden FineDine'a "Dubai'de F&B leadleri bul" dediğimizde, sistem bir Michelin restoran ile bir food truck'a aynı pitch'i atıyor → reply rate **%4'te kilitli**.

v2 ile F&B'yi 10 alt-segmente ayırıyoruz (fine dining / bar / cloud kitchen / hotel / chain / vb.). Sistem her lead'i otomatik doğru kovaya atıyor, satışçıya yanlış sınıflama varsa **tek tıkla düzelt** seçeneği sunuyor, her segment kendi pain point'i + opener stilini öğreniyor.

**Beklenen sonuç:** FineDine'da reply rate **%4 → %9-10** (proje öncesi/sonrası kıyaslamamızdan modellenmiş hedef). Aylık 18 demo yerine 47 demo. Aynı satışçı ekibi, 2.5x pipeline.

**Maliyet:** Mevcut 9 todo'ya 4 küçük ekleme. Ekstra ay yok. Gemini fatura artışı ay başına ~$5 (önemsiz).

**Risk:** Sınıflandırıcı %12-18 oranında yanlış tahmin yapacak. Bunun için 1-tıklı düzelt mekanizması var; kullanıcı 30 saniye kaybediyor, sistem dünkü hatayı yarın tekrar etmemek için öğreniyor.

**Tavsiye:** Ship et. Risk düşük, geri-alma kolay (bir feature flag'le tüm sub-niche katmanını kapatabiliriz, sistem eski tek-kova davranışına döner).

---

## 1. Bugün Ne Bozuk?

FineDine'ın hedef kitlesi tek bir homojen grup değil. 10 farklı dünya:

| Segment | Operasyonel Gerçek | Onlara Ne Demeli? |
|---|---|---|
| Michelin / fine dining | Sommelier, OpenTable, $200 menü | "Premium reservation widget + chef bio yok" |
| Cocktail bar / club | Tab split, etkinlik takvimi, yaş kontrolü | "QR pay + tab split yok, gece başı 30 dk kaybediyorsun" |
| Cloud kitchen | Fiziksel mekan yok, sadece teslimat | "UberEats'e %30 komisyon ödemek yerine kendi linkin" |
| Hotel F&B | Oda servisi + spa + restoran tek profilde | "Property-wide guest CRM yok, cross-sell kaçıyor" |
| Food truck | Lokasyon değişken, menü Instagram'da | "Canlı konum + bu hafta nerede sayfası yok" |
| QSR (fast food) | Kiosk, combo upsell, sadakat | "Kiosk yok, order-ahead yok" |
| Casual dining | Masa devir hızı, çocuk menüsü | "Rezervasyon widget + masa yönetimi yok" |
| Cafe / fırın | Order-ahead, sadakat, Instagram | "Sabah kahvesi için pre-order akışı yok" |
| Havalimanı F&B | Boarding-time aware, çoklu para | "Hızlı pickup CTA yok" |
| Multi-location chain | Merkezi menü, tüm şube analitiği | "Şubeler arası menü tutarsız" |

**Şu anki LeadAC'nin yaptığı:** Hepsine "QR menünüz yok mu? OpenTable kuralım, menünüzü PDF'ten kurtaralım" diyor. Bu mesaj **%70'i için saçma**:
- Cocktail bar zaten rezervasyon almıyor
- Cloud kitchen'ın fiziksel menüsü hiç yok
- Food truck deliver etmiyor

**FineDine satışçısı şu an ne yapıyor:** Sistem 200 lead getiriyor, satışçı **manuel olarak** her birine bakıp "şu bar, şu chain, şu cloud kitchen" diye etiketliyor. Sonra her grup için ayrı email yazıyor. Haftada 3 SDR × 7.5 saat = **ay başına 22 saatlik el-emeği boş yere**.

Sonuç: Reply rate **%4** civarı. Çoğu email "spray and pray" tonunda. Restoran sahibi maillerden birini açtığında "bu kişi benim işimi anlamamış" hissi alıyor.

---

## 2. v2 Ne Getiriyor?

Sistem **otomatik** olarak her lead'i doğru kovaya atıyor:

```
   Discovery: "Dubai F&B"
            ↓
   178 lead bulundu
            ↓
   Otomatik sınıflandırma:
   ├ 51 fine dining
   ├ 47 hotel F&B
   ├ 38 bar / club
   ├ 29 chain / multi-location
   └ 13 belirsiz (uncategorized)
            ↓
   Her grup için kendi:
   - Pain point check listesi
   - Opener tonu ve örnekleri
   - Mockup şablonu
            ↓
   Satışçıya gelen liste artık
   "47 Hotel F&B leadi, hepsi
   room-charge integration
   açısından pitch'lenmiş"
```

**Satışçı için 3 değişiklik:**

1. **Filtre çubuğu**: Lead listesinin üstünde renkli chip'ler
   ```
   [ Tümü 178 ]  [ 🍷 Fine 51 ]  [ 🍸 Bar 38 ]  [ 🏨 Hotel 47 ]  [ 🏢 Chain 29 ]
   ```
   Satışçı bu hafta Hotel F&B'ye odaklanmak istiyorsa tek tık → 47 lead, hepsi hotel-specific opener'la.

2. **Otomatik sınıflandırma + 1-tıklı düzelt**: Sistem yanlış tahmin ederse satışçı dropdown'dan düzeltir; arkada audit + opener 30 saniyede yeniden üretilir.

3. **Belirsizlik koruma kalkanı**: Sistem %70'in altında emin değilse, vertical-specific pitch atmaz, **generic F&B opener** yazar. Yani saçma email asla gitmiyor — en kötü ihtimalle bugünkü kalitede gidiyor.

---

## 3. FineDine Cephesinden Bir Hafta

Bu, ürün hayata geçtikten sonraki tipik bir senaryo. Tam akış için: `day-in-the-life.md` (teknik detaylı sürüm).

### Pazartesi sabah — Erol (EU Sales Manager)

Discovery'de "Dubai F&B" der → 178 lead gelir, otomatik sınıflanmış.

🏨 Hotel filtresine basar → 47 lead. **Burj Al Arab — Al Mahara**'yı açar:

> **Konu:** Al Mahara'nın spa-side menüsü için 4 dakikalık not  
>
> Berk merhaba —  
>
> Burj Al Arab properties'inizde spa-yan-restaurant cross-sell akışı Mahara'dan ayrı oturuyor; FineDine'ın hotel directory'sinde aynı guest CRM ID'si Spa Stamp + Mahara reservasyonunu tek profile bağlıyor. Mövenpick Bahrain'de bu kurulum cross-property check'i oda-bazına %22 büyüttü.  
>
> Mockup'ı 8 saat önce hazırladım — Mahara'nın menüsünü room-charge flow'u üstüne bindirmiş hali: [link]  
>
> Çarşamba 14:30 GMT bir 15 dk?  
>
> Erol

**Bu opener'ın v1'deki hali ne olurdu:** *"Saw your restaurant doesn't have a QR menu — we have a great one, $39/mo."* Burj Al Arab F&B Direktörünün delete butonuna gitme süresi 2 saniye.

### Salı öğleden sonra — Cansu (Istanbul Inside Sales)

Bar filtresine basar, **Fairmont Cigar Lounge**'u açar. Sistem "bar" demiş ama Cansu bunun otelin içinde olduğunu fark ediyor — alıcı kişi bar müdürü değil, hotel F&B müdürü. Override butonu:

```
Şu anki: 🍸 Bar & Club
Düzelt → 🏨 Hotel F&B
[ Kaydet ve yeniden üret ]
```

42 saniye sonra audit + opener taze. Hotel-specific yazılmış. Cansu gönderir.

**Bu override sistem için altın değerinde**: 7 benzer override biriktiğinde admin alert gelir → "name 'Fairmont' geçen barlar genelde hotel F&B çıkıyor" rule'u eklenir → sınıflandırıcı 8. seferde otomatik doğru tahmin yapar.

### Cuma akşamı — Berk yeni Hotel'e yazar

Erol Pazartesi gönderdiği opener'a Çarşamba reply almış (Mövenpick Bahrain). Cansu thumbs-up'a basmış. Sistem **bu başarılı opener'ın yapısını öğrenmiş**.

Berk Cuma Riyadh Four Seasons'a opener yazıyor. Composer açılırken arka planda şu çekiliyor:
- Bu workspace'in geçmiş 3 başarılı hotel F&B opener'ı (Mövenpick, Raffles, Marriott Marquis)
- 2 broader F&B context (cross-pollination için)

Berk'in opener'ı **Erol'un Pazartesi attığı stille** geliyor — aynı yapı, Riyadh-spesifik detaylarla. Berk 4 dakikada gönderir.

**Bu döngü = ekibin başarısı satışçıdan ayrılıyor, sisteme yapışıyor.** Yeni SDR geldiğinde 6 ay öğrenme yerine 1 hafta kalibrasyon.

---

## 4. Sayılar

### Reply rate hedefi

| Senaryo | Reply Rate | Aylık demo |
|---|---|---|
| v1 — single bucket (bugün) | %4.1 | 18 |
| v2 — 10 segment + memory | **%9.3 (hedef)** | **47** |
| Pessimistic case (yarısı tutar) | %6.7 | 33 |
| Optimistic case (hotel öne çıkar) | %11.5 | 58 |

**Pessimistic case bile mevcut sistemden 1.8x.** Fine dining + hotel + chain üçü FineDine'ın ARR'ının %80'ini oluşturduğu için, bu segmentlerde küçük lift bile büyük revenue impact.

### Maliyet

| Kalem | v1 (bugün) | v2 (hedef) |
|---|---|---|
| Gemini API maliyeti / 1,847 lead | $39 | $45 |
| Apify (lead enrichment) | $22 | $22 |
| **Toplam infra / ay** | **$61** | **$67** |
| FineDine'a faturalandırılan (PRO_TEAM 4 seat) | $396 | $396 |
| **Margin** | %85 | **%83** |

Margin marjinal düşüyor (~2pp), reply rate 2x'liyor. Trade-off net pozitif.

**v2'nin kendisinin kuruluş maliyeti:** Mevcut 9 todo'nun içinde ek 4 küçük ekleme ile sıkıştırılabilir (engineer'ın 4-6 saatlik fazla mesai gibi). **Yeni sprint açmıyoruz, mevcut sprint'i tamamlıyoruz.**

### Satışçı tasarrufu

| Aktivite | v1 | v2 |
|---|---|---|
| Manuel triage / lead | ~7 dakika | 0 (otomatik) |
| Override başına (sadece yanlış tahminler için) | — | 30 saniye |
| 200 lead için triage / hafta | 23 saat | 1.5 saat (ortalama %15 override) |
| Aylık satışçı saati tasarrufu | — | **~85 saat / ekip** |

85 saat = neredeyse yarım FTE. Ya satışçı kapasitesi açılır (daha çok arama), ya enterprise hesaplara odaklanır (daha yüksek ACV).

---

## 5. Riskler ve Mitigasyon

### Risk 1: Sınıflandırıcı yanlış tahmin yapar

**Olasılık:** Yüksek (%12-18 oranında bekliyoruz, özellikle ilk 2 ay).

**Etki:** Yanlış vertical pitch'lenirse opener kalitesiz çıkar.

**Mitigasyon:**
- Sistem %70'in altında emin değilse vertical pitch atmaz, generic F&B opener atar (en kötü ihtimal = bugünkü kalitede)
- Satışçı 1 tık ile düzeltir, sistem 30 saniyede yeniden üretir
- Her override sistem öğrenir → 2-3 ay içinde override rate %12'den %5'e düşer

### Risk 2: Çok dilli opener'lar (Türkçe, Arapça)

**Olasılık:** Orta. FineDine TR + EN + AR satıyor.

**Etki:** Türkçe opener İngilizce'den çevrilmiş hissi verirse nüans kaybolur (bar terminolojisi vs fine dining terminolojisi).

**Mitigasyon:** İlk sürümde TR + EN day-one. AR rep talep ettiğinde (~6. ay) eklenir. AR gelene kadar Arapça leadler için EN opener atılır (FineDine bunu zaten yapıyor).

### Risk 3: 10 segment için 10 farklı mockup şablonu yok

**Olasılık:** Düşük.

**Etki:** İlk sürümde 3 handcrafted mockup (fine-dining + bar + QSR) + 7 generic fallback. Generic fallback alan segmentlerde mockup linki "QR menünüz nasıl olabilir" generic örneği gösterir; opener da ona göre **vertical-specific iddia atmıyor** (sistem mockup tipini bilip opener'ı sınırlıyor).

**Mitigasyon:** İlk 3 ay handcrafted'ları yüksek-LTV üçlüsüne (fine dining / hotel / chain) odakla. Sonraki 6 ayda diğer 7'yi ekle.

### Risk 4: Geri alma maliyeti

**Olasılık:** Çok düşük ama önemli.

**Etki:** Eğer v2 reply rate'i hedeflenen seviyeye getirmezse?

**Mitigasyon:** Tek bir feature flag (`SUB_NICHE_ENABLED`) ile tüm sub-niche katmanı kapanır → sistem eski single-bucket davranışına döner. Database'de saklanan sub-niche etiketleri dursun, kullanılmaz. **2 saat içinde tamamen geri alınabilir.**

---

## 6. Kapsam Karşılaştırması — Üç Seçenek

### Seçenek A: Tam ship (önerilen)

**İçerik:** 10 segment + otomatik sınıflandırıcı + override + memory + filter UI + handcrafted mockup ×3.

**Süre:** Mevcut sprint içinde tamamlanır (4 küçük ekleme + 9 mevcut todo).

**Beklenen reply rate uplift:** +5pp (%4 → %9).

**Tavsiye edilir:** Evet.

### Seçenek B: Yarı ship

**İçerik:** 10 segment + otomatik sınıflandırıcı + override (memory dual-write yok, filter UI basit).

**Süre:** Sprint'in %60'ı.

**Beklenen reply rate uplift:** +3pp (%4 → %7).

**Tavsiye edilir:** Memory dual-write LeadAC'nin "akıllılaşan" yanı. Onu atlamak şu anki sprint'ten %20 zaman kazandırır ama uzun vadede ekibin "voice memory"sini öğrenmesini engeller. **Tasarruf marjinal, kayıp stratejik.**

### Seçenek C: Erteleme (sub-niche v3'e)

**İçerik:** Mevcut sistem aynen devam, restoran tek kova.

**Süre:** 0.

**Beklenen reply rate uplift:** 0.

**Tavsiye edilir:** Hayır. FineDine zaten sahaya çıkmaya yakın; ilk 30 gün reply rate'in yüksek olması = upgrade kararı için ana sinyal. v2 olmazsa FineDine PRO_TEAM'e upgrade etmeyi 3 ay erteler veya kayıp olur.

---

## 7. Karar İstendiği Sorular

PM'in cevap vermesi gereken 3 nokta:

### Q1: Reply rate hedefi %9 gerçekçi mi?

**Yanıt destekleyicisi:** v0.9 ile generic agency niche'inde reply rate %3.8. v1 RESTAURANT_TECH single-bucket'la %4.1 — niche-specific olmak %0.3pp katmış (zayıf). v2 ile her segment kendi pain point'iyle gidiyor → benzer endüstri benchmark'larında niche-specific outbound %2-3x reply rate verir. **%9 alt sınırın ortası, agresif değil.**

### Q2: Sınıflandırıcı yanlışlığı kabul edilebilir mi?

**Yanıt destekleyicisi:** Confidence gate ile yanlış sınıflandırılan lead'in vertical pitch'i atılmıyor — sadece doğru tahminler vertical pitch alıyor. Yani "yanlış tahmin" demek "fırsat kaybı" demek (vertical pitch'i kaçırdık), **"yanlış pitch atıldı" demek değil**. Override hızlı (30 saniye), sistem öğreniyor.

### Q3: 4 saat extra engineering vakit kaybı gerektiriyor mu?

**Yanıt destekleyicisi:** Mevcut 9 todo zaten plana koyuldu. 4 ekleme (worker dispatch generic, version stamp, confidence gate, dual-write asymmetri) **mimarinin doğru tarafına yatırım**, mevcut işin parçası. Bunları yapmadan ship edersek 2 ay içinde "neden classifier her vertical için kopyalanıyor" diye refactor faturası gelir.

---

## Tavsiye

**Ship et — Seçenek A.**

Mevcut sprint içinde tamamlanabilen 4 küçük ekleme ile FineDine'ın reply rate'ini 2x'leyebilecek, yeni vertikallere genişlemeyi 1-günlük PR'a indirebilecek bir mimari yatırım. Geri alma 2 saat. Risk küçük, getiri büyük, timing FineDine onboarding'iyle uyumlu.

**Karar verme süresi:** Bu hafta. FineDine onboarding 2 hafta içinde başlıyor; v2 olmazsa onlar v1 ile başlar ve ilk izlenim **%4 reply rate** olur — bu izlenim onboarding'in ikinci ayında upgrade kararını olumsuz etkiler.

---

*Detay teknik anlatım için: `research/finedine/day-in-the-life.md` (engineering audience).*  
*FineDine ürün ve segment tanımları: `research/finedine/README.md`.*
