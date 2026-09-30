# İnceleme kartı: kaynakla yan yana hüküm

Tarih: 28 Eylül 2026
Durum: tasarım, kod yok
Kapsam: yalnızca `/admin/control/reviews` karar kartı

## Güncelleme, tek cümle

İnceleme ekranı “iş çalıştı” demeyi bırakır. Her worker’ın bulgusunu, insanın zaten yanda açtığı kaynakla aynı satırda gösterir. Hüküm, cümle ile kaynak aynı şeyi söylüyorsa verilir.

## İnsan bugün ne yapıyor

Beta testlerinde inceleyen kişi brief’i tek başına okumadı. Şunu yaptı:

1. İşletmenin doğru işletme olduğunu kontrol etti. Adres, puan, yorum sayısı.
2. Web sitesini ayrı sekmede açtı. Rezervasyon var mı, QR var mı, site düşmüş mü, adres aslında Instagram mı.
3. Google Haritalar’ı açtı. Brief “müşteriler şunu diyor” dediyse, o cümle yorumlarda gerçekten var mı diye baktı. Kaç yorumdan çıktığına baktı.
4. Site analizini, yorum analizini ve satış cümlesini birbirine karıştırmadan ayrı ayrı tarttı.
5. En sonda konuşmayı okudu. “Sitenizi inceledim” diyorsa site açık mı, şube sayısı doğru mu.

Sistem bu sırayı ekranda vermiyor. İnsan sırayı kendi tarayıcısında kuruyor. Kart ise fused kararı basıyor: iddia, paket, konuşma, bir de “Oldu · süre · dolar”.

## Şu anki yaklaşım

Karar kartı `LEAD_INTELLIGENCE_BRIEF` çıktısındaki `headAgent` alanını okur. Site denetimi, yorum analizi ve puan worker’ının içeriği karta girmez.

| Mercek | Şu an gördüğü | Hüküm verirken eksik olan |
|---|---|---|
| Teknik | İddialar, brief’in bitiş zamanı, kanıt referansı, Site/Yorum/ICP/Karar satırında durum · süre · dolar | Sitenin adresi, hata kodu, yorum sayısı, yüzdeyi üreten örneklem |
| Alan | ICP puanı, güven, modül sırası, paket, hariç tutulanlar | Hesapta zaten olanlar, zincir, tier ile paketin çelişkisi |
| Satış | Konuşma, lokasyon sayısı, paket, iddialar, açı | Konuşmanın dayandığı acı cümlesi, o cümlenin yorumda olup olmadığı, sitenin açık olup olmadığı |

Üç mercek aynı fused metni farklı sırada görür. Kaynak sekmesi yoktur. Worker içeriği yoktur. Geçti, metin akıcı göründüğü için basılabilir.

Beta’da bu yüzden kaçanlar: Instagram adresi rezervasyon var sayıldı, 5 yorumda bütün çubuklar %100 oldu, süresi dolmuş siteye “sitenizi inceledim” denildi, ekranda Starter ile Premium aynı anda durdu, zincir hesaba şube QR’ı satıldı.

## Olması gereken yaklaşım

Ekran, insanın sekme sırasını takip eder. Tek hüküm kalır. İçerik dört çekmeceye ayrılır. Çekmece, worker’ın kendisidir.

Üst şerit, her rolde aynıdır:

- İşletme adı, adres, puan, yorum sayısı.
- İki link: `websiteUrl` ve `googleMapsUri`. İnsan siteyi ve haritayı buradan açar. Sistem onun yerine siteyi gezmez.

Sonra dört çekmece. Her çekmece iki sütundur: solda worker’ın cümlesi, sağda o cümlenin dayanağı.

1. **Site** (`WEBSITE_AUDITOR`). Solda “rezervasyon var / QR var / sipariş var”. Sağda gerçek adres, erişilebilir mi, `crawlError` (sosyal profil, süresi dolmuş, ulaşılamadı), denetim tarihi. Adres Instagram ise sağ sütun bunu yazar. Sol sütun “var” dese de hüküm buradan okunur.
2. **Yorum** (`REVIEW_ANALYST`). Solda acı cümlesi ve yüzde. Sağda okunan yorum sayısı, analiz tarihi, alıntının dili. Yüzde, sayının yanında durur. “%100” ile “5 yorum” aynı satırdadır.
3. **Puan** (`SALES_OPPORTUNITY_SCORER`). Solda fırsat puanı ve paket. Sağda puanın dayandığı sinyaller ve tier. Paket Premium, tier Starter ise satır bunu yan yana koyar. Site yokken puan 100 ise satır bunu yan yana koyar.
4. **Brief** (`LEAD_INTELLIGENCE_BRIEF`). Solda konuşma ve modül sırası. Sağda konuşmanın kullandığı acı cümlesi, lokasyon sayısı, sitenin durumu. Brief, önceki üç çekmecenin özetidir. Yeni bir gerçek icat etmez.

Çekmece boşsa “Kayıt yok” yazar. Süre ve dolar bu ekranda durmaz. Onlar Vaka izi’ndedir.

## Üç rol

Sıra değişir. Çekmeceler kaybolmaz. Üstteki soru, o rolün baktığı çelişkiyi söyler.

### Teknik

Soru: bu bulgu hangi kaynaktan, ne zaman geldi?

Önce Site, sonra Yorum. Puan ve Brief altta, katlanmış durur. Teknik, satış cümlesini düzeltmez. Şuna bakar:

- Adres gerçek site mi.
- Denetim tarihi brief’ten eski mi. Eski denetim canlı kaldıysa kaynak bayat.
- Yorum sayısı bir yüzdeyi taşıyor mu. Beş yorum ve %100 ise örneklem patlamış.
- Worker hata yazmış ama kart akıcıysa, hata satırı çekmecenin üstündedir.

Kaldı sınıfları: kaynak eski, boru hattında adım eksik.

### Alan

Soru: bu hesapta bu sıra ve bu paket uyar mı?

Önce Site (hesapta zaten olanlar), sonra Puan (paket ve tier), sonra Yorum (sırayı haklı çıkaran acı). Brief’teki modül sırası bunların altında durur. Alan şuna bakar:

- Rezervasyon zaten varsa sıra onu birinci yapmamalı.
- Zincir veya birden fazla lokasyon varsa şube QR’ı birinci olmamalı.
- Paket ile tier aynı satırda çelişiyorsa paket uymuyor.
- Alt niş ile işletme tipi birbirini tutmuyorsa oyun kitabına aykırı.

Kaldı sınıfları: paket uymuyor, oyun kitabına aykırı, puan bandın dışında, boru hattında adım eksik.

### Satış

Soru: bu cümleyi yarına söyler miyim?

Önce Brief’teki konuşma, büyük puntoda. Hemen altında Yorum çekmecesindeki acı cümlesi ve “alıntı yorumda var / yok”. Yanında Site çekmecesinin tek satırı: site açık, düşmüş, ya da yalnızca Instagram. Lokasyon sayısı, konuşmanın içindeki sayının yanında durur. Satış şuna bakar:

- Acı cümlesi yorumda yoksa iddia dayanaksız.
- “Sitenizi inceledim” deyip site yoksa veya düşmüşse iddia dayanaksız.
- Konuşmadaki şube sayısı, hesaptaki lokasyonla uyuşmuyorsa kaynak eski ya da yanlış işletme.
- Konuşma öneridir. Restoran gerçeği gibi yazılmışsa cümle düzeltilir, Geçti basılmaz.

Kaldı sınıfları: iddia dayanaksız, yanlış işletme, kaynak eski.

## Hüküm kuralı

Geçti, ancak yargılanan cümle ile sağ sütundaki dayanak aynı şeyi söylüyorsa basılır.

Aynı şey demek:

- Kutup aynı. Bir yorum “yavaş servis” diyorsa brief “sık şikayet” diyemez.
- Sayı aynı. Beş yorum, yüzde yüz küresel sorun olamaz.
- Kimlik aynı. Alıntı bu işletmenin yorumudur.
- Tür aynı. Konuşma öneridir, site bulgusu gözlemdir. İkisi aynı cümlede erimez.

Çelişki satırı doluysa dürüst hüküm Kaldı’dır. Not, çelişkiyi yazar. Üç mercek de kendi çekmecesinden hüküm verir. Referans vaka, üç hüküm de yazılınca açılır. Bu sözleşme değişmez.

## Worker’lar ayrı değerlendirilir, ayrı form açılmaz

Üç yaklaşım konuşuldu.

1. Her worker için ayrı Geçti formu. Teknik dört kez, Alan dört kez kaydeder. İnceleme kuyruğu şişer. Üç mercek sözleşmesi bozulur.
2. Yalnızca brief okunur, worker’lar Vaka izi’nde kalır. Bugünkü hal. Beta’da kaçan hatalar burada kaldı.
3. Dört çekmece aynı kartta, worker içeriği ayrı ayrı görünür, kişi kendi merceğinden tek hüküm yazar. Önerilen bu.

Ayrı değerlendirmek, ayrı kaydetmek demek değildir. Site yanlışsa Teknik Site çekmecesinden Kaldı der. Yorum doğru olsa bile Brief o yanlışı konuşmaya taşımışsa Satış da Kaldı der. Hata, akıcı özetin altında kaybolmaz.

Sıralı boru hattında erken hata son metne taşınır. Bu yüzden çekmece, brief’ten önce durur. Brief çekmecesi yeni gerçek üretmez. Önceki üç çekmecede olmayan bir acı söylüyorsa satır “brief’te var, yorumda yok” der.

## Araştırmadan alınan pay

İnsan doğrulaması, fused cevabı değil iddia ile kanıtı yan yana ister.

- PaperTrail (Martin-Boyle, Leckey, Brown, Kaur, CHI 2026, [arXiv:2602.21045](https://arxiv.org/abs/2602.21045)) LLM cevabını ve kaynağı ayrı iddialara böler. Desteklenen, desteklenmeyen ve kaynakta olup cevaba girmeyen bilgiyi gösterir. Yirmi altı araştırmacıda kaynak göstermek güveni düşürdü, kullanımı düşürmedi. Yani daha fazla metin yetmez. Karşılaştırma zorunlu olmalı. Çelişki satırı bu yüzden var.
- CiteLLM kontrol listesi doğrulanmış alan için üç şey ister: kaynağın yeri, o değeri taşıyan alıntı, riskliyse insan kararı ve denetim kaydı. ([how to verify LLM answers](https://citellm.com/blog/how-to-verify-llm-answers))
- Ajan kendi çıktısına not vermemeli. Doğrulama, gözlemi hedefle kıyaslar. ([ayrı değerlendirici](https://www.mindstudio.ai/blog/ai-agent-evaluators-verifiers-separate-grading), [claim-level receipt](https://arxiv.org/html/2609.15319v1))
- Sıralı çoklu ajan boru hattında her adımın çıktısı ve birleşik sonuç ayrı kontrol edilir. Bir adımın hatası son metne taşınır. ([Mastra, multi-agent](https://mastra.ai/articles/multi-agent-systems))

Perplexity Sonar (28 Eylül 2026) aynı sırayı verdi: önce atomik cümle, sonra kaynak kimliği ve alıntı, sonra ilişki (destekli / kısmen / desteksiz), en sonda insan hükmü. Geçti ancak kutup, kapsam ve sayı alıntıyla aynıysa.

## Bu güncellemenin yapmadığı

Puan formülü, yeniden oynatma, kalibrasyon ve rehberin on adımı açılmaz. Yeni kuyruk, yeni model çağrısı, yeni rol yoktur. `HumanReview` geriye dönük doldurulmaz. Hüküm hâlâ mercek başına bir kez yazılır. Ekran metni Türkçe, adres İngilizce kalır.

## Bitti sayılması

Yönetici üç merceği atar. Teknik, bir brief’te sitenin adresini ve yorum sayısını görür, “Oldu” satırını görmez. Alan, paketi hesabın elindekiyle ve tier ile yan yana görür. Satış, konuşmayı, acı alıntısını ve site linkini aynı ekranda görür. Üçü de kendi hükmünü kaydeder. Üçüncü kayıt referans vaka formunu açar.
