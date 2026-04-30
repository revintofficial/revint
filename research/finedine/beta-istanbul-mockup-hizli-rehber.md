# LeadAC — İstanbul betası (5 kişi) · Website mockup hızlı rehber

**Kime?** İstanbul’da, belirli nişlere (ör. restoran, kafe, otel vb.) site satışı deneyecek 5 beta test kullanıcısı.  
**Ücret:** Bu beta süresince erişim bedava.  
**Odak:** Uygulamada **website mockup** üretip müşteriye gösterebileceğin **paylaşılabilir bir önizleme linki** almak.

Aşağıdaki anlatım bilerek sade: sanki 17 yaşındaki birine tarif ediyormuş gibi. Teknik jargon yok; “tıkla, bekle, linki kopyala” seviyesinde.

---

## Uygulama ne işe yarıyor? (çok kısa)

LeadAC, hedef işletme hakkında internetten toplayabildiği kadar bilgiyi derleyen bir araç. Senin satış oyununda önemli olan kısım şu: işletmenin adı, adresi, yorumları, mevcut sitesi gibi veriler toplanınca tek tuşla **o işletmeye özel, taslak bir landing sayfası** (mockup) çıkarabiliyorsun. Bu sayfa gerçek bir site gibi görünür; müşteriye “bak, senin markana böyle bir şey yapılabilir” demek için kullanılır.

**[EKRAN GÖRÜNTÜSÜ: Giriş yaptıktan sonra ana panel / sol menü — Discovery, Leads, Watchlist, Settings görünsün]**

---

## Başlamadan

| Ne | Nereden |
|----|--------|
| Site adresi | Sana ayrıca yazılacak (örnek: `https://...` veya test için `http://localhost:3000`) |
| E-posta + şifre | Proje sahibinden gelir; buraya yazılmaz |

Tarayıcıdan giriş yap. İlk açılışta workspace ve dil zaten kurulu olabilir; “FineDine Beta” veya sana atanmış workspace adını üstte görürsen tamam.

**[EKRAN GÖRÜNTÜSÜ: Sign-in sayfası — e-posta/şifre alanı]**

---

## Adım 1 — Nişine uygun lead bul

İki yol var, hangisi sende açıksa:

1. **Discovery:** Soldan Discovery’ye gir, ülke/şehir ve arama (ör. “İstanbul fine dining”) ile işletme listesi çek.
2. **Leads:** Zaten listede kayıtlı işletmeler varsa doğrudan **Leads**’e gir.

Mockup’un düzgün çıkması için lead’in mümkün olduğunca dolu olması iyidir: site linki, Google bilgisi, yorum özeti gibi şeyler zaten işlendiyse mockup daha isabetli olur.

**[EKRAN GÖRÜNTÜSÜ: Discovery veya Leads listesi — bir satır seçili]**

---

## Adım 2 — Bir işletmeyi aç (lead detay)

Listeden bir işletmeye tıkla. Üstte sekmeler görürsün: Overview, Website, Workers, Reviews, Outreach vb.

- **Website** sekmesi: Robotun mevcut siteyi nasıl okuduğunu gösterir; mockup “bu verilere dayanıyor” demek için faydalı.
- Asıl mockup üretimi için bir sonraki adıma geç.

**[EKRAN GÖRÜNTÜSÜ: Lead detay — üstte sekmeler (Overview / Website / Workers …)]**

---

## Adım 3 — Mockup’u üret (AI Workers)

1. **Workers** (veya ekranda “AI Workers” denilen panel) sekmesine geç.
2. **Pitch** grubunda **Website Mockup Generator** (Türkçe arayüzde “Website Mockup Üretici” benzeri) kartını bul.
3. **Generate** / oluştur tuşuna bas.

İşlem arka planda çalışır; genelde onlarca saniye sürebilir. Ekranda “running” veya yükleme göstergesi görürsen normal: bitene kadar sayfayı kapama.

**[EKRAN GÖRÜNTÜSÜ: Workers panelinde Website Mockup Generator — Generate öncesi/sonrası]**

---

## Adım 4 — Linki al ve aç

Bittiğinde kartta **Open** (dış link) veya benzeri bir seçenek çıkar. Tıklayınca tarayıcıda `/m/...` ile başlayan bir adres açılır: bu, müşteriye atacağın **herkese açık önizleme**.

- Linki kopyalayıp kendi telefonundan da aç: müşteri “telefonda nasıl duruyor” diye bakacak.
- Link aynı kalabilir; mockup’u yeniden üretirsen içerik güncellenir, slug çoğu durumda sabit kalır (yeniden paylaşım kolay olsun diye).

**[EKRAN GÖRÜNTÜSÜ: Başarılı mockup sonrası — Open / External link veya kopyalanan URL]**

**[EKRAN GÖRÜNTÜSÜ: `/m/...` sayfası — mobil görünüm tercihen]**

---

## Adım 5 — Toplu mockup (isteğe bağlı)

**Leads** listesinde birden fazla satırı işaretleyince altta bir aksiyon çubuğu belirir. Orada **Generate mockup** gibi bir toplu işlem varsa aynı işlemi birden fazla lead için kuyruğa atarsın. Toast bildirimi “kaç lead sıraya girdi” diye yazar.

**[EKRAN GÖRÜNTÜSÜ: Leads listesi — çoklu seçim + alttaki Generate mockup çubuğu]**

---

## Adım 6 — Satış tarafında nasıl kullanırsın?

1. Nişine göre 3–5 işletme seç (ör. sadece butik oteller veya sadece steakhouse).
2. Her biri için mockup üret.
3. İlk mesajı (genelde Overview / Outreach veya Opener Writer ile) mockup linkiyle birleştir: “Sitenizi inceledim, size özel bir taslak hazırladım: [link]” gibi kendi dilinde yaz.

Gerçek müşteriye mail/WhatsApp atmadan önce beta kuralına uy: test hesabında **spam gönderme**, sadece kendi pipeline’ını veya ikna edeceğin gerçek görüşmeleri düşün.

**[EKRAN GÖRÜNTÜSÜ: İsteğe bağlı — Opener / ilk mesaj kutusu ve mockup linkinin yan yana göründüğü yer]**

---

## Takılırsan

- Mockup **FAILED** olursa Workers kartındaki hata mesajını not et (ekran görüntüsü al).
- Lead çok boşsa önce ana analizlerin (site denetimi, yorum özeti) tamamlanmış olması gerekir; yoksa mockup ince kalabilir.
- **Settings → My Offer** bölümünde “neyi satıyorsun” (teklif adı, ton, dil) doluysa mockup ve mesajlar buna daha çok uyum sağlar.

**[EKRAN GÖRÜNTÜSÜ: Settings — My Offer özeti]**

---

## Settings → My Offer — doldurulmuş örnek (İstanbul betası, profesyonel ajans dili)

Aşağıdaki metinleri **My Offer** formuna aynen yapıştır. Açılır listelerde (**Message goal**, **Tone**, **Length**) yazan İngilizce ifadeler uygulamanın kaydettiği değerler; Türkçe seçenek yok, ekranda öyle görünecek.

| Alan | Ne yazacaksın |
|------|----------------|
| **Niche** | `Web / Marketing Agency (default)` |
| **Offer name** | `Performans Odaklı Tek Sayfa Web ve Dönüşüm Paketi` |
| **Value proposition** | `Yerel hizmet ve perakende markaları için mobil öncelikli, hız optimizasyonlu tek sayfa deneyimi: marka uyumlu arayüz, net CTA katmanı ve randevu / WhatsApp yönlendirmesi. Kapsam ve içerik onayı sonrası go-live SLA: 10–14 iş günü.` |
| **Social proof** | `İstanbul ve Marmara bölgesinde 50+ yerel marka web projesi; ortalama go-live 12 iş günü; müşteri içgörüleri ve referans özeti talep üzerine paylaşılır.` |
| **Hook / opening line** | `Mevcut sitenizde mobil tarafta yükleme ve üst fold CTA düzeninde net bir iyileştirme alanı görüyorum; rezervasyon veya tek adımda iletişim akışı henüz öne çıkmıyor. Markanıza özel, üretime yakın tek sayfalık bir taslak hazırladım — önizleme bağlantısını aşağıda iletiyorum.` |
| **Message goal** | `Send the mockup link` |
| **Tone** | `professional` |
| **Length** | `medium` |
| **Language** | `Türkçe` |
| **Sender name** | Ajans adı + ad soyad veya sadece ad soyad (ör. `Studio X — Ahmet Yılmaz` veya `Ahmet Yılmaz`) |
| **Conversion link** | Kurumsal teklif / brief sayfan veya 15 dk. keşif takvimi (ör. `https://cal.com/...`), kurumsal iletişim için `https://wa.me/90555...` |

Kaydettikten sonra yeni ürettiğin mockup ve açılış mesajları bu bağlamı kullanır.

---

## Senden beklenen geri bildirim

Kısa not yeter:

- Hangi adımda kafan karıştı?
- Mockup müşteri gözünde “inandırıcı” mıydı, nerede saçma kaldı?
- Türkçe/İstanbul verisinde yanlış yer, yanlış isim, kırık link gördün mü?

Bu rehberdeki `[EKRAN GÖRÜNTÜSÜ: ...]` satırlarını sen kendi çektiğin görsellerle değiştirebilir veya hemen altına yapıştırabilirsin.
