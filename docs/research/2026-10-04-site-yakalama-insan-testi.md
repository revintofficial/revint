# Site yakalama — son insan testi

Amaç: `WEBSITE_AUDITOR`'ın derin yakalamasının, ayar yapılırken hiç kullanılmamış 12 gerçek sitede doğru konuştuğunu ve neye bakamadığını dürüstçe söylediğini bir insanın doğrulaması.

## A. Kağıt testi (12 site, yaklaşık 60–90 dakika)

Kağıt: `docs/research/2026-10-04-site-yakalama-test-kagidi.md`.

Her site için:

1. Siteyi kendi tarayıcında aç.
2. **Bulgular** tablosu: her satırda kanıt adresine git, alıntıyı bul. Bulgu sitede öyleyse `D`, değilse `Y`, karar veremediysen `?`. "Kapsam" sütunu `kısıtlı (grup, etkinlik ya da özel gün)` diyorsa, kaporanın gerçekten alıntının söylediği gibi kısıtlı olduğunu (gruplar, etkinlikler, özel günler) kontrol et; her sıradan rezervasyonda isteniyorsa `Y`.
3. **Sistemin bilmediği** tablosu: boş bırakılan bulgu sitede açıkça varsa (ör. rezervasyon düğmesi OpenTable'a gidiyor) `KAÇAK` yaz ve sayfanın adresini ekle. Bulamadıysan boş bırak.
4. **Okunan sayfalar**: tür sütunu sayfayla uyuşuyor mu (`menu` gerçekten menü mü)?
5. **Okunamayan sayfalar**: listede rezervasyon, menü, sipariş, SSS ya da grup sayfası varsa "Önemli mi?" sütununa `evet` yaz. Sistemin tahmin edip denediği ama sitede olmayan adresler (ör. `/faq` yoksa) listelenmez, yalnızca sayıları tablonun altında yazar; `limit_total` yakalamanın deneme sınırına ulaşıp durduğunu, `blocked` sitenin tarayıcıyı reddettiğini söyler.

## B. Uygulama içi test (3 lead, yaklaşık 15 dakika)

Ön koşul: `site_captures` ve `site_capture_pages` tabloları veritabanında olmalı (`npm run db:push`, yalnızca kullanıcı onayıyla). Tablolar yoksa denetim yine tamamlanır ama 3. adımdaki kapsam satırı görünmez.

1. Worker süreci çalışıyor olmalı (`npm run workers`).
2. Bir lead'in detay sayfasında "Website Analizcisi"ni yeniden çalıştır. Koşu 5 dakikaya kadar sürebilir; "takıldı" etiketi 5 dakikadan önce çıkmamalı.
3. Yönetim panelinde İnceleme sayfasında aynı lead'in **Site** çekmecesini aç: "Kapsam: N sayfa açıldı · …" satırı görünmeli; okunamayan sayfa varsa nedeniyle yazmalı.
4. Aynı anda üç lead için denetimi başlat: üçü de tamamlanmalı (üçüncüsü slot bekler, düşmez).

## Geçme koşulu

- A.2: `Y` sayısı **0**. (`?` satırları tek tek konuşulur.)
- A.3: `KAÇAK` sayısı not edilir; engel değildir, ama rezervasyon sağlayıcısında 2'den fazla kaçak varsa yayına çıkmadan konuşulur.
- A.4: yanlış türlü sayfa en fazla 2.
- A.5: `evet` yazılan her satırın nedeni (`timeout`, `blocked`, `budget`, `robots_disallow`) makul olmalı; `budget` nedeniyle kaçan önemli sayfa varsa bildirilir.
- B: dört adım da beklendiği gibi.

## Bilinen sınırlar (hata değil)

- Bot korumalı siteler (Akamai vb.) `blocked` olarak görünür; proxy yok.
- Metin katmanı olmayan menü PDF'leri okunmaz (`needsOcr`).
- Tıklayınca açılan rezervasyon pencereleri (modal) yalnızca sayfa yüklenirken istek atıyorsa yakalanır.
- Toplu keşifte denetim aşaması eskisinden yavaştır (süreç başına 2 eşzamanlı site).
- Bir otelin oda rezervasyonu koşulları (ilk gece ödemesi, "Hotel may request prepayment") bilerek masa kaporası olarak okunmaz.
