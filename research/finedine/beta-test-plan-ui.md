# FineDine Beta — Tester Rehberi (UI üzerinden)

> **Kime?** FineDine BD ekibinden 2 tester arkadaş.
> **Amaç:** Sistemi gerçek bir satış temsilcisi gibi kullanmak; bulduğun her tuhaflığı not etmek.
> **Süre:** Tam tur ~90 dakika · Hızlı tur ~25 dakika
> **Kod gerekmez.** Tarayıcı + verilen e-posta + şifre yeter.

---

## Hesap bilgileri

Üç hesap hazır. Tester'lar 2 ve 3 numaralı hesabı kullanır. **Owner** hesabı sadece bir tester'ın "Settings" ve "Billing" gibi yönetici alanlarını görmesi gerekirse kullanılır.

| Rol | E-posta |
|---|---|
| Owner (sadece gerektiğinde) | `finedine-owner@leadac.beta` |
| Tester 1 | `finedine-tester1@leadac.beta` |
| Tester 2 | `finedine-tester2@leadac.beta` |

> **Şifreler:** Önceki seed çıktısında gösterildi. Eğer kayboldularsa PM'e haber ver — script tek satırla şifreyi sıfırlayabilir. Şifreni kimseyle paylaşma; karşılık vermeyen hesap olursa bunun yerine yeni şifre iste.

**Giriş URL'si:** `https://<beta-host>/auth/signin` → e-posta + şifre → "Sign in".

İlk girişte herhangi bir onboarding sihirbazı çıkarsa kapatabilirsin: workspace zaten kurulu ve hazır.

---

## Hızlı sağlık kontrolü (5 dakika)

Tester girdiğinde aşağıdakileri **gözle** görmesi gerekir. Görmüyorsa "Bug 0" olarak raporla.

1. **Sol menü:** "Discovery", "Leads", "Campaigns", "Watchlist", "Settings" gibi başlıklar görünüyor.
2. **Üst sağda:** "FineDine Beta" yazıyor (workspace adı).
3. **Settings → My Offer** sayfasında:
   - **Industry / Niche:** "F&B / Hospitality (Restaurants, Bars, Cafés, Hotels, Ghost Kitchens, Food Trucks…)"
   - **Offer name:** "F&B Digital Stack…" gibi FineDine'a özel bir ifade.
   - **Country:** Turkey · **Language:** Türkçe.
4. **Settings → Service Packages** sayfasında **3 paket** görünüyor:
   - **Base** — $39 / month (billed yearly)
   - **Premium** — $119 / month (billed yearly) · "Most popular" rozetli
   - **Enterprise** — Custom (multi-brand, hotel, chain)

Bu dördü tamamsa: sistem sağlıklı, devam et.

---

## 1. Servis paketlerini incele (10 dakika)

Bu, FineDine'ın gerçek fiyat kartı. AI bu paketlerden hangisinin lead'e en uygun olduğunu önerecek; senin görevin paketlerin doğru ve eksiksiz göründüğünü doğrulamak.

### 1.1. Görsel inceleme

1. Sol menüden **Settings → Service Packages**'e git.
2. **Base** paketinin altındaki özellik listesini oku. Bu özellikler FineDine'ın Base planında gerçekten var mı? (Referans: `finedinemenu.com/pricing`)
3. **Premium** için aynısını yap. "Most popular" rozeti üstte görünüyor mu?
4. **Enterprise** için aynısını yap. Çok-marka, otel, POS entegrasyonu maddeleri burada mı?

✅ **Beklenen:** 3 paket görünür, fiyatlar/özellikler FineDine sitesindekiyle eşleşir.
❌ **Bug raporu:** Bir paket eksik / fiyat yanlış / özellik yanlış / popular rozeti yanlış pakette.

### 1.2. Düzenleme akışı (sadece Owner ile)

> Tester'ların `MEMBER` rolü vardır, yani paket düzenleyemezler — bu beklenen. Eğer "Edit" düğmesi görüyorsan ve bir paketi düzenleyebilen bir MEMBER hesabıyla girdiysen, **bu bir bug — raporla**.

Owner ile giriş yapıp:
1. **Premium**'un yanındaki kalem ikonuna tıkla.
2. Bir özellik ekle → "Save".
3. Sayfayı yenile → eklenen özellik hâlâ orada mı?
4. Eklediğin özelliği geri sil → "Save" → tekrar yenile.

✅ **Beklenen:** Düzenleme anında kaydoluyor; yenilemeden sonra bile değişiklikler kalıyor.

---

## 2. İlk lead'i keşfet (15 dakika)

Şimdi gerçek satış akışına geçelim. Lead bul → analiz et → AI ne öneriyor gör.

### 2.1. Discovery ile lead bul

1. Sol menüden **Discovery**'ye gir.
2. Şehir kutusuna bir şey yaz, örnek: **Istanbul** veya **Dubai**. Listede çıkan birini seç.
3. **Niche / Vertical** alanında "F&B" yazıyor mu? (Workspace ön-yapılandırılmış olduğu için varsayılan F&B olmalı.)
4. **Sub-niche** seçici görünür. Şu beş senaryoyu sırayla dene:
   - **"All F&B"** seçili bırak → 10 alt-segment de taranır (food truck, ghost kitchen, fine dining, vs.).
   - **"Fine dining"** seç → sadece üst-segment restoranlar gelir.
   - **"Bars & clubs"** seç → kokteyl barları, gece kulüpleri gelir.
   - **"Hotel F&B"** seç → otel restoranları öne çıkar.
   - **"Cafés & bakeries"** seç → kafe ve fırınlar gelir.
5. Her seçim için "Find leads" / "Search" düğmesine bas.

✅ **Beklenen:**
- Sonuç sayısı 0'dan büyük (en azından "All F&B" ve "Fine dining" için Istanbul/Dubai gibi büyük şehirlerde).
- "All F&B" sonuçları arasında çeşit görüyorsun: restoran + bar + kafe karışık.
- "Bars & clubs" sonuçları çoğunlukla bar/lounge ismi taşıyor.

❌ **Bug raporu:**
- Tüm aramalar 0 sonuç dönüyor.
- "Hotel F&B" seçtiğinde halı sahalar geliyor.
- "Bars & clubs" sadece restoranlar gösteriyor.

### 2.2. Bir lead'i kaydet

Sonuç listesinden ilgini çeken birinin yanındaki **"Save lead"** veya **"+"** düğmesine tıkla. Üst tarafta "Saved" gibi bir bildirim çıkar.

Sol menüden **Leads**'e geç → kaydettiğin lead listede görünmeli.

---

## 3. AI analizini çalıştır ve önerilen paketi gör (15 dakika)

Bu testin kalbi. AI'nın FineDine paketlerinden birini doğru gerekçeyle önermesi gerekiyor.

### 3.1. Analizi başlat

1. **Leads** listesinden 2.2'de kaydettiğin lead'in adına tıkla.
2. Lead detay sayfası açılır. Üst kısımda işletme adı, adresi, yıldızı görünür.
3. Sağ üstte (veya hero alanında) **"Analyze"** veya **"Run AI analysis"** düğmesi var. Tıkla.
4. Birkaç saniye bekle. Yükleme bitince **opportunity score** (0-100 arası bir sayı) görünür.

### 3.2. Önerilen paketi kontrol et

Sayfayı aşağı kaydır. **"Recommended package"** başlıklı bir kart görmen gerekir. İçinde:

- **Paket adı** (Base / Premium / Enterprise'dan biri).
- **Fiyat** (örn. "$119 / month (billed yearly)").
- **Gerekçe** — 1-2 cümlelik bir açıklama; bu lead için neden bu tier'in seçildiğini söyler. Örnek beklenen ifadeler:
  - "Çok şubeli bir restoran zinciri olduğu için Premium'un CRM ve rezervasyon modülü en uygun…"
  - "Tek lokasyonlu bir kafe; Base paketi QR menü ihtiyacını yeterince karşılar…"
- **Özellik etiketleri** — paket içeriğindeki ilk 6 özellik bullet pill olarak.

✅ **Beklenen:**
- Önerilen paket lead'in karakteriyle uyumlu (zincir → Premium veya Enterprise; tek şube küçük kafe → Base).
- Gerekçe kısa, akıcı, lead'e referans veriyor.
- Önerilen paketin adı tam olarak Settings → Service Packages'taki bir paketle eşleşiyor.

❌ **Bug raporu:**
- "Recommended package" kartı hiç görünmüyor.
- Gerekçe yazılmamış / "N/A" / İngilizce halbuki dil Türkçe seçili.
- Önerilen paket adı listenedekilerden farklı (örn. "Pro" diye bir paket önerilmiş ama biz hiç eklemedik).
- Tek şubeli küçük kafeye Enterprise önerilmiş gibi anlamsız bir eşleşme.

### 3.3. Pain points & sales angle

Aynı sayfada **"Sales Opportunity"** veya **"Why good target"** alanında:

- **Likely pain points** (muhtemel sorunlar): Lead'in muhtemel acı noktaları liste halinde.
- **Best sales angle** (en iyi satış açısı): 1 cümlelik kanca.

✅ **Beklenen:** Pain point'ler genel "no website" değil, F&B dünyasına özgü. Örn: "PDF menü kullanıyor, mobilde okunmuyor", "Online rezervasyon yok", "Çoklu şube ama merkezi menü kontrolü yok".
❌ **Bug raporu:** Pain point'ler bir avukat/diş hekimi için yazılmış gibi genel.

---

## 4. Kişiselleştirilmiş mesajı kontrol et (15 dakika)

AI bu lead için bir e-posta açılışı (opener) yazar. Önerdiği paketin adı + fiyatı **tek bir yerde, soft kapanış sorusunda** geçmelidir — broşür gibi okunmamalı.

### 4.1. Mesajı oluştur

1. Lead detay sayfasında **"Generate opener"** veya **"Personalized message"** kartını bul.
2. Eğer otomatik gelmediyse **"Run AI workers"** veya benzeri düğme ile mesajı tetikle.
3. Mesaj görününce kopyala ikonuyla panoya kopyalayıp Notepad'e yapıştır.

### 4.2. Mesajı oku ve değerlendir

Aşağıdaki kriterlere göre mesajı puanla (her madde için ✅ / ❌ koy):

| Kriter | Beklenen |
|---|---|
| Açılış ilgi çekici | İlk cümle "Umarım iyisinizdir" gibi klişe değil, lead'e özel bir gözlem var. |
| Türkçe doğal | Cümleler doğal Türkçe; çevirice gibi durmuyor. |
| Maksimum 3 cümle | Cümle sayısı 3 veya daha az. |
| Paket adı + fiyat 1 kez geçiyor | "Premium planımız $119/ay'dan başlıyor — sizin akışa uyar mı?" gibi soft kapanış. **Tüm özellik listesi yapıyorsa bug.** |
| Paket önerisi mantıklı | Yine: küçük kafe → Base'e referans, otel zinciri → Premium veya Enterprise. |
| Mockup linki varsa eşleşiyor | Bahsedilen UI öğesi mockup'ta gerçekten var mı? (Eğer "tab-split UI" diyorsa, mockup linki gerçekten tab-split mi gösteriyor?) |
| CTA satış-baskısı yok | "Hemen alın!" yerine "Bir 15 dk konuşalım mı?" tonu. |

✅ **Beklenen toplam:** 6/7 veya 7/7 ✅.
❌ **Bug raporu:** Birden fazla ❌. Örn: paketin tüm özellik listesini sayıyorsa, paketi 3 farklı yerde tekrar ediyorsa, fiyatı yanlış söylüyorsa.

---

## 5. Aynı testi farklı sub-niche'lerde tekrarla (20 dakika)

Adım 2-4'ü iki farklı alt-segment için tekrarla. Önerinin **lead'in karakterine** göre değişip değişmediğini gör.

| Senaryo | Discovery sub-niche | Beklenen önerilen paket |
|---|---|---|
| A | Fine dining (Istanbul) | **Premium** (rezervasyon, AI upsell, CRM bunlara hitap eder) |
| B | Cafés & bakeries (Istanbul, küçük tek-şube) | **Base** (QR menü yeter; Premium/Enterprise overkill) |
| C | Hotel F&B (Dubai veya Antalya) | **Enterprise** (otel direktörü + multi-property + POS entegrasyonu) |
| D | Multi-location (zincir markaları) | **Enterprise** veya **Premium** |

Her senaryoda en az 1 lead seç → analiz et → önerilen paketi yaz.

✅ **Beklenen:** Önerilen paket beklenenin civarında. Tam eşleşme şart değil, ama **küçük tek-şube kafeye Enterprise** öneriyorsa veya **5 yıldızlı uluslararası otel zincirine Base** öneriyorsa, mantık çalışmıyor demektir → bug.

Sonuçları şöyle bir tabloda topla:

| Senaryo | Lead adı | Önerilen paket | Gerekçe doğru mu? | Mesajda paket geçiyor mu? |
|---|---|---|---|---|
| A | Mikla Restaurant | Premium | ✅ "Multi-course dining + reservations" | ✅ |
| B | Petra Roasting Co. | Base | ❌ "Çok şubeli zincir" demiş ama tek şube | ❌ |
| ... | ... | ... | ... | ... |

---

## 6. Manuel sub-niche override (10 dakika)

Bazen AI yanlış sınıflandırır. Senin bunu manuel düzeltebilmen gerekir, ve düzeltme sonrası önerilen paketin de güncellenmesi lazım.

1. Sınıflandırması yanlış görünen bir lead seç (örn. AI "Casual dining" demiş ama lead aslında bir bar).
2. Lead detay sayfasında **Website** sekmesinde **"Sub-niche"** etiketini bul. Yanında bir kalem ya da dropdown ikonu olmalı.
3. Doğru sub-niche'i seç (örn. "Bars & clubs").
4. Onayla.
5. Sayfa kendini yeniler veya bir bildirim çıkar: **"Re-analysis queued"** gibi.
6. Birkaç dakika bekle. Sayfayı yenile.
7. **"Recommended package"** kartı şimdi farklı olmalı (veya gerekçesi farklı kelimelerle).

✅ **Beklenen:** Override sonrası eski analiz sonucu **"stale"** durumdan çıkıp yeniden çalışıyor; pain point'ler / önerilen paket ilgili sub-niche'e göre değişiyor.
❌ **Bug raporu:** Override sonrası hiçbir şey değişmiyor; ya da analiz "Failed" oluyor.

---

## 7. Discovery → kaydet → analiz E2E süresi (10 dakika)

Bu, satış temsilcisinin günlük "ne kadar hızlı çalışıyorum" deneyimi.

Stoper başlat:
1. Discovery'ye gir, sub-niche seç.
2. 1 lead bul → "Save".
3. Lead detayına git → "Analyze".
4. Önerilen paket görünene kadar bekle. **Süre = ?**

✅ **Beklenen:** 60-90 saniye altı.
❌ **Bug raporu:** 5+ dakika. (Bu durumda PM'e bildir, AI worker'larda bir tıkanma olabilir.)

---

## 8. İçerik kontrolü ve son hisler (5 dakika)

Sayfayı kapatmadan önce, lead detay sayfasının iki sekmesine daha bak:

- **Reviews** — Google reviews varsa otomatik analiz oluyor mu?
- **Outreach** — "Recommended package" kartı burada da görünüyor mu? (Overview ve Outreach sekmelerinin ikisinde de görünmesi gerekiyor.)

Genel sorular:
- Bir gün boyunca bu UI'ı kullansaydın, hangi 3 buton/etiket en kafa karıştırıcı olurdu?
- Hangi 3 nokta bir SDR'ın gözünden hızlandırıcı / akıllı görünür?
- "Bu beni satış görüşmesinde yalnız bırakmaz" duygusu ver(d/m)i mi?

---

## Bug raporu şablonu

Bug bulduğunda lütfen aşağıdaki kalıpla raporla. (Slack/Linear/E-posta — PM nereyi seçtiyse oraya.)

```
[Bug] Bir cümle özet
Bölüm: 3.2 (Önerilen paket)
Tester: tester1@finedine.beta
Tarayıcı: Chrome 134 / Safari 18 / Firefox …
Adımlar:
  1. Discovery → Hotel F&B → Dubai → ilk lead
  2. Lead detay → Analyze
  3. "Recommended package" kartına bak
Beklenen: Enterprise önerisi
Görülen: Base önerisi, gerekçe boş
Ekran görüntüsü: (ekle)
```

---

## Bittikten sonra

1. Bulduğun bug'ları yukardaki şablonla topla.
2. Adım 5'in tablosunu (4 senaryo, hangi paket, doğru muydu) PM'e gönder.
3. Süre testi (Adım 7) sonucunu da iletmeyi unutma.

Test bittikten sonra hesap kapatılmaz; istediğin zaman tekrar girip "live" gibi kullanabilirsin. Workspace **AGENCY** planında ve 100 yıllık trial'da, yani limit endişesi yok.

Soru / takıldığın yer olursa PM'e Slack'ten yaz. Engineering team test sırasında stand-by'da olur.

Teşekkürler — bu beta turunun çıktısı, FineDine'ın 500-kişilik satış ekibi sisteme girmeden önceki son güvenlik kontrolü olacak.
