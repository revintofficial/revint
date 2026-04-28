# LeadAC — Beta Tester Talimatları

Selam! Bu yazı seni LeadAC'i test etmen için hazırladık. Hiç teknik bilgine ihtiyacın yok — internet kullanabiliyorsan tamam.

## Olay nedir?

LeadAC bir robot gibi düşün. Bu robotun işi şu: bir kafe, restoran ya da otel hakkında **internette bulabileceği her şeyi toplayıp** bir not defteri çıkarmak. "Bu kafenin sitesi şöyle, müşterileri şunu seviyor, sitesinde şu eksik, satış ekibi şöyle bir mesaj atabilir…" gibi.

Senin işin: **Robot iyi mi araştırma yapmış, yoksa atmış mı tutturmuş**, ona bakmak. Sen de aynı kafeyi internette araştıracaksın, robotun söylediğiyle senin gördüğünü karşılaştıracaksın, sonra kısa bir not yazacaksın.

Kısacası: robot dedektif olmuş, sen onun ödevini kontrol eden öğretmen olacaksın.

---

## Başlamadan önce

| Şey | Bilgi |
|---|---|
| Site | (sana ayrıca verilecek — `localhost:3000` veya canlı URL) |
| E-posta | `finedine-owner@leadac.beta` |
| Şifre | (proje sahibi sana ayrıca atacak) |

Tarayıcını aç, giriş yap, sol menüden **Leads** sekmesine tıkla. Listeden sana atanan kafeyi/restoranı aç.

> Test sırasında **silme**, **arşivleme**, **gerçek mesaj gönderme**. Sadece bakacaksın, kontrol edeceksin, sonra rapor yazacaksın.

---

## Ekranda göreceğin 5 sekme

Bir lead'i (yani bir işletmeyi) açtığında üst tarafta şu 5 buton var:

1. **Overview** → Robotun yazdığı özet rapor. "Bu işletme ne, neden iyi bir hedef, ne mesaj atılabilir."
2. **Website** → Robotun siteye girip baktıkları. "Site açılıyor mu, mobile uyumlu mu, online rezervasyon var mı, vs."
3. **Workers** → Robotun yaptığı 7 ayrı küçük iş. Her biri farklı şey topluyor — burada hangisi başardı, hangisi bok etti onu göreceksin.
4. **Reviews** → Google'daki müşteri yorumlarından çıkardığı şeyler. "İnsanlar yemekleri seviyor, manzaradan etkileniyor, fiyatları yüksek buluyor."
5. **Outreach** → Hangi aşamada, sosyal hesapları nerede.

Sırayla bunlara bakacaksın. Her sekmede iki şey yapacaksın:

- (1) **UI'da oku** — robot ne demiş?
- (2) **Yeni sekmede aç ve kontrol et** — gerçekte böyle mi?

İşte bu kadar. Tek cümle: **"Robot ne dedi" vs "ben gerçekte ne gördüm".**

---

## Sekme sekme ne yapacaksın

### 1. Overview sekmesi (özet rapor)

Burada uzun bir yazı göreceksin. "Lead Score: 80", "Önerilen paket: …", "Önerilen ilk mesaj: …" gibi şeyler.

**Sen şunu yap:**
- Yazıyı oku.
- Önemli iddialara bak — örnek: "muhteşem deniz manzarası", "3000+ yorum", "aile dostu".
- **Yeni sekme aç → Google'a işletmenin adını yaz → Maps'te aç.** Maps'teki fotoğraflara, açıklamaya, yorumlara bak. Robot atmış mı, yoksa gerçekten öyle mi?
- "Önerilen ilk mesaj" kutusunu oku. Sen olsan bu mesajı gönderir miydin yoksa garip mi geldi? Hayali mi konuşuyor, kafeyi gerçekten tanıdı mı?

Bonus: Yazının içinde `[website_audit]` veya `[review_analyst]` gibi etiketler var. Bu etiketler "şu cümleyi şuradan aldım" demek. Garip bir cümle gördüysen yanındaki etikete bak — kafede gerçekten o özellik var mı?

---

### 2. Website sekmesi (site analizi)

Burada bir sürü kutu var. Hepsi sitenin teknik özelliklerini söylüyor. Korkma — sadece "var/yok" diyor.

**Robot diyebilir ki:**
- "Site açılıyor"
- "Yarım saniyede yükleniyor"
- "HTTPS yok" (yani site güvenlik kilidi yok)
- "WhatsApp linki var"
- "Online rezervasyon yok"
- "QR menü var"
- "Instagram'ı şu, Facebook'u şu"

**Sen şunu yap:**

Yeni sekme aç ve **işletmenin asıl sitesine git**. Robotun söylediği her şey orada gerçekten öyle mi?

| Robot demiş ki | Sen şunu kontrol et |
|---|---|
| Site açılıyor | Sen de aç → açıldı mı, gecikti mi? |
| HTTPS yok | Tarayıcı adres çubuğunda kilit ikonu var mı yoksa "Güvenli değil" mi diyor? |
| Mobil uyumlu | Tarayıcı penceresini daralt, telefon gibi yap → düzgün mü duruyor? |
| WhatsApp linki var | Sitede WhatsApp butonu var mı, tıklanıyor mu? |
| Online rezervasyon var/yok | Bir butonu tıkla — gerçekten masa ayırtabiliyor musun, yoksa sadece "rezervasyon" yazıyor ama ne yapıyor belli değil mi? |
| Yemek siparişi (delivery) | Yemeksepeti, Trendyol Yemek, Getir Yemek butonu var mı? |
| QR menü | Menü tıklayınca dijital olarak mı açılıyor, yoksa eski PDF mi? |
| Instagram / Facebook | Linklere tek tek tıkla → doğru hesaba mı gidiyor, ölü hesap mı, kırık link mi? |
| Tahmini iş tipi | Robot bu işletmeyi ne diye sınıflandırmış (kafe, restoran, balık restoranı, vs.)? Sence doğru mu? Mesela deniz kenarındaki bir aile restoranını "fast food" demişse → yanlış. |

Eğer robot bir şeyi atlamışsa (örnek: TripAdvisor profilleri varmış ama robot yazmamış), bunu rapora yaz.

---

### 3. Workers sekmesi (robotun çalışanları)

Burada robotun 7 farklı küçük çalışanı görünür. Her biri ayrı bir iş yapmış. Bazıları yeşil ✅ (başardı), bazıları kırmızı ❌ (yapamadı) olabilir.

Çalışanların ne yaptığı, basitçe:

| Çalışan | Ne yaptı |
|---|---|
| Site Bakıcı | İşletmenin sitesine girdi, her şeye baktı |
| Yorum Toplayıcı | Google yorumlarından örnekleri çekti |
| Kategori Bulucu | "Bu tam olarak hangi tip iş?" diye kafa yordu |
| Yorum Anlamlandırıcı | Yorumları okuyup özet çıkardı |
| Sosyal Avcı | Instagram, Facebook gibi hesapları buldu |
| Skor Veren | Bu işletme bizim için iyi bir hedef mi diye 100 üzerinden puan verdi |
| Rapor Yazan | Hepsini birleştirip uzun raporu yazdı |

**Sen şunu yap:**
- Hangileri ✅, hangileri ❌? Listele.
- ❌ olanın yanında bir hata mesajı varsa kopyala (örnek: "Failed to embed after 3 attempts").
- **Önemli durum:** Bir çalışan ❌ görünüyor ama Overview / Reviews / Website sekmesinde **yine de o veriyle ilgili bilgi varsa** → bunu özellikle yaz. Bu "yarım kaldı ama bir şeyler kaydedildi" demek, ilginç bir bug.

---

### 4. Reviews sekmesi (yorum analizi)

Burada robot diyor ki "müşteriler yemekleri %100 seviyor, manzarayı %80 seviyor, fiyatları %20 yüksek buluyor" gibi yüzdeler.

**Şunu bil:** Robot, Google'dan **sadece 5 yorum** çekebiliyor (Google'ın bedava limiti). İşletmenin 3000 yorumu olsa bile robot 5 tanesinden çıkarım yapıyor. Yani %100 dediğinde aslında "5 yorumdan 5'i" demek. Bu önemli, raporda yaz.

**Sen şunu yap:**

1. Google Maps'te işletmeyi aç → "Tüm yorumlar"a tıkla.
2. İlk **10-15 yorumu** gözden geçir (Türkçe + İngilizce).
3. Robotun söylediği yüzdeler senin gördüklerinle uyuşuyor mu?
   - Robot: "Yemek %100" → ilk 10 yorumda kaç tanesi yemekten bahsediyor? 8-9'u öyleyse ✅, 3'ü öyleyse ❌.
   - Robot: "Fiyat şikayeti %20" → sen daha çok mu, daha az mı görüyorsun?
4. Robot bazı **alıntılar** yapmış — "outstanding view", "breathtaking" gibi. Bu ifadeler Google'daki yorumlarda gerçekten var mı, yoksa robot uyduruyor mu?
5. **Switch signal:** Robot "kimse rakipten gelmemiş" diyebilir. Ama yorumlarda "Eskiden X kafeye gidiyorduk, artık burayı tercih ediyoruz" gibi bir cümle var mı? Varsa robot kaçırmış demektir.

---

### 5. Outreach sekmesi (satış aşaması)

Burada çok bakacak şey yok. Sadece:
- Sosyal hesap ikonlarına tek tek tıkla → doğru profile gidiyor mu, kırık mı?
- "Copy message" (mesajı kopyala) butonu çalışıyor mu, kopyaladığında doğru mesaj mı yapıştırılıyor?

---

## Yan tarayıcıda hızlı internet turu

Test ederken şu yerlere de uğra (her birinde 1-2 dakika):

- **Google Maps** → "<işletme adı> <şehir>" yaz, ara. Robot ile aynı adres, telefon, puan, yorum sayısı mı?
- **Asıl sitesi** → genel olarak nasıl görünüyor? Ucuz mu duruyor, modern mi? Robotun "site zayıf" yorumu sana da makul geliyor mu?
- **Instagram** → son post ne zaman atılmış? Aktif mi yoksa unutulmuş bir hesap mı?
- **Facebook** → aynısı; ayrıca "Reserve a table" gibi bir buton var mı?
- **Google'da `<işletme adı> rezervasyon`** ara → TripAdvisor, OpenTable, Quandoo gibi başka sitelerde rezervasyon var mı? Robot "rezervasyon yok" demiş olabilir ama 3. parti site üzerinden alıyor olabilir.
- **TripAdvisor / Yelp** → varsa, oradaki yorumların tonu Google'la aynı mı?

Bu 5 dakika robotun gözü görmediği yerleri yakalamana yarayacak.

---

## Rapor şablonu

Her lead için **yeni bir Google Doc / Notion sayfası** aç ve şunu kopyalayıp doldur. Bilmediğin yerlere tahmin yazma, tire (`—`) bırak.

```
# LeadAC Beta Test Raporu

Tester:
Tarih:
Toplam süre: dakika
Lead adı:
Lead şehri:
Lead URL'si (UI'daki):


## A) Tek cümleyle sonuç

[ ] ✅ Robot büyük oranda doğru
[ ] ⚠️ Yarı doğru, eksikler var
[ ] ❌ Yanlış / kafayı yemiş

Tek cümle özet:
> 


## B) Çalışanlar (Workers)

| Çalışan | ✅/❌ | Not |
|---|---|---|
| Site Bakıcı (WEBSITE_AUDITOR) | | |
| Yorum Toplayıcı (GOOGLE_PLACES_REVIEWS) | | |
| Kategori Bulucu (SUBVERTICAL_CLASSIFIER) | | |
| Yorum Anlamlandırıcı (REVIEW_ANALYST) | | |
| Sosyal Avcı (SOCIAL_SCRAPER) | | |
| Skor Veren (SALES_OPPORTUNITY_SCORER) | | |
| Rapor Yazan (LEAD_DOSSIER_GENERATOR) | | |


## C) Site analizi doğru mu?

| Robot demiş | Sen ne gördün? | Eşleşiyor mu? |
|---|---|---|
| Site açılıyor mu | | |
| Yüklenme hızı | | |
| HTTPS (kilit) | | |
| Mobil uyumlu | | |
| İletişim formu | | |
| WhatsApp linki | | |
| Online rezervasyon | | |
| Yemek siparişi (delivery) | | |
| QR menü | | |
| İletişim e-postası | | |
| İş tipi (kafe / restoran / vs.) | | |
| Sosyal hesaplar (her birini tıkla) | | |

Robot kaçırmış mı bir şey?
> 


## D) Yorum analizi doğru mu?

- Robot kaç yorum analiz etmiş? (genelde 5)
- Maps'teki gerçek yorum sayısı:
- Maps'teki ortalama puan:
- Robotun puanıyla uyumlu mu?

Güçlü yön yüzdeleri (sen Maps'te ilk 10 yoruma bak):

| Robot demiş | Robot % | Sen ilk 10'da kaç tane gördün | Tutarlı mı? |
|---|---|---|---|
| | | | |
| | | | |

Zayıf yön yüzdeleri:

| Robot demiş | Robot % | Sen ne gördün | Tutarlı mı? |
|---|---|---|---|
| | | | |

Robotun alıntıları gerçek mi? (3 alıntıyı Google'da arat)
> 

Robotun "kimse rakipten geçmemiş" demesi doğru mu, sen yorumlarda kaçışı yakaladın mı?
> 


## E) Robotun mesajı ve önerisi

- Skor (Overview ve Outreach'ta gösteriyor):
- Önerilen paket:
- Önerilen ilk mesajda:
  [ ] Doğru işletme adı kullanılmış
  [ ] İşletmeye özel bir detay var (manzara, semt, tarz)
  [ ] Türkçe akıcı, garip değil
  [ ] Sen bu mesajı gerçekten gönderir miydin?

Mesajla ilgili düşüncen:
> 


## F) Halüsinasyon kontrolü (3 cümle test)

Overview'daki uzun raporda 3 cümle seç. Her birini Google'da kontrol et — gerçek mi?

| Robotun cümlesi | Gerçek mi? | Notun |
|---|---|---|
| | | |
| | | |
| | | |


## G) Buton/UI sorunları

Test ederken bir şey bozuldu mu?
- [ ] Hayır
- [ ] Evet → ekran görüntüsü ekle, hangi butona basmıştın yaz

> 


## H) Güven puanın (1-5)

- Site analizi doğruluğu: /5
- Yorum analizi doğruluğu: /5
- Önerilen mesajın kalitesi: /5
- Genel raporun kalitesi: /5
- UI sorunsuzluğu: /5

TOPLAM: /25


## I) Final görüşün

Sen satışçı olsan, bu raporla bu işletmeye nasıl yaklaşırdın?

[ ] Robotun yazdığı mesajı olduğu gibi gönderirdim
[ ] Mesajı 1-2 cümle düzenlerdim
[ ] Sıfırdan kendim yazardım, robotun mesajı işime yaramaz

Neden:
> 
```

---

## Önemli kurallar

1. **Hiçbir gerçek e-posta gönderme.** Outreach status'unu değiştirmek serbest, ama mesaj gönderme butonuna basma.
2. **Hiçbir veriyi silme / arşivleme.** Sadece bakacaksın.
3. **Bug bulduysan üç şey gerekli:** ekran görüntüsü + hangi sayfadasın (URL) + hangi butona bastın. "Hata aldım" tek başına yetmiyor.
4. **Halüsinasyon yakaladığında robotun cümlesini birebir kopyala**, kendi kelimelerinle değiştirme. En değerli kanıt birebir alıntıdır.
5. **Tahmin etme.** Bilmediğin yere tire (`—`) koy. Eksik bilgi, yanlış bilgiden iyidir.

---

Hazırsın. İlk lead'i aç, bir tarafta UI, bir tarafta Google Maps + işletme sitesi açık olsun, bu doküman bir tarafta. Soru olursa direkt yaz.
