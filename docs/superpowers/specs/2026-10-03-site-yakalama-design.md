# Site yakalama (website worker, alt proje 1) — tasarım

Tarih: 3 Ekim 2026. Son güncelleme: 4 Ekim 2026 (yazılı inceleme işlendi: süre modeli, ölçülebilir başarı ölçütü, saklama, robots kararı; `APIFY_WEB_CRAWL_DEEP` geçişi kapsamdan çıktı).
Durum: yazılı inceleme işlendi, uygulama planı `docs/superpowers/plans/2026-10-04-site-yakalama.md`.

## Amaç

FineDine SDR'ına giden site bilgisinin eksiksiz ve doğru olması. Sistem bakmadığı şeye "yok" demez. Bu belge dört alt projenin ilkini tanımlar; diğer üçü (bulgu çıkarmada Gemini okuması, menü zekâsı, teknik denetim) ayrı spec alır.

## Bugünkü durum ve neden kaçırıyor

`src/lib/crawler.ts` Playwright ile ana sayfayı açar, `pickSubpages` ana sayfadaki linklerden her tür için (rezervasyon, menü, sipariş) tek sayfa seçer, `mergeSiteFacts` bulguları URL ve alıntıyla üretir. 40 gerçek sitede yanlış cevap 15'ten 1'e indi (`docs/research/2026-10-03-website-audit-accuracy.md`).

Kaçakların kaynağı yapısal:

- Sadece ana sayfadaki linkler izlenir, tür başına tek sayfa. SSS, grup rezervasyonu, özel etkinlik, şubeler, iletişim sayfaları açılmaz.
- Alt sayfa başına 8 sn, toplam 20 sn bütçe.
- Sadece son HTML okunur; sayfanın yaptığı ağ istekleri kaydedilmez, geç yüklenen widget'lar görünmez.
- PDF açılmaz, site haritası kullanılmaz.
- Worker'ın dış süre sınırı `min(estimatedDurationMs × 3, 180 sn)`; `WEBSITE_AUDITOR` için bugün 90 sn (`src/lib/agent-workers/execute.ts`).

## Yaklaşım: önce yakala, sonra oku

Önce sitenin ilgili her sayfası indirgenmiş haliyle kaydedilir, sonra bulgular bu kayıttan çıkarılır. Kayıt yeniden taramadan tekrar okunabilir ve ölçüm düzeneğinde çevrimdışı kullanılabilir.

Reddedilenler: mevcut tarayıcıyı yerinde büyütmek (ana sayfa darboğazı kalır); tarayıcıyı modelin sürmesi (yavaş, pahalı, ölçmesi zor).

## Bileşenler (`src/lib/site-capture/`)

| Parça | Sorumluluk |
|---|---|
| Sınıflandırma | Bir adresi türe atar: home, menu, reservation, order, faq, events, locations, contact, about, other, external. Gürültü sayfaları (gizlilik, sepet, giriş) hiç aday olmaz. |
| Keşif | Adayları toplar: ana sayfa linkleri, `robots.txt` + `sitemap.xml`, bilinen yolların denenmesi, açılan sayfalardaki linkler (derinlik 2). Tür önceliği ve sınırlarla sıralar. |
| İndirgeme | Bir sayfanın HTML'inden görünür metin, linkler, iframe/script adresleri ve JSON-LD çıkarır. |
| Yakalama | Sayfaları bütçe içinde açar; çerez penceresini kapatır, sayfayı kaydırır, üçüncü taraf ağ isteklerini kaydeder. |
| Belgeler | Menü PDF'lerini SSRF korumalı indirir, metnini çıkarır; metin katmanı yoksa `needsOcr` işaretler. |
| Kapsam defteri | Keşfedilen her adres için tek sonuç: açıldı, atlandı (neden), açılamadı (neden). |
| Bulgu köprüsü | Mevcut `mergeSiteFacts`'i yakalanan sayfalarla çalıştırır, sonra yalnızca `null` kalan bulguları ek sayfalardan ve ağ kanıtından doldurur. |
| Saklama | `SiteCapture` ve `SiteCapturePage` tabloları. |

Site dışına tek adım: bilinen rezervasyon, sipariş veya menü sağlayıcısına giden linkin sayfası da açılır (en fazla 5).

## Sınırlar

- Site başına en fazla 40 sayfa (ana sayfa dahil) ve 150 sn yakalama bütçesi; sayfa başına 15 sn. Bunlar tavandır, hedef değil.
- Tür başına sınır: rezervasyon 4, dış sağlayıcı 5, menü 6, sipariş 3, etkinlik/grup 3, SSS 3, şubeler 6, iletişim 2, hakkında 2, diğer 3. Aday kalmayınca yakalama biter (erken durma budur); tipik sitede 8–12 sayfa açılır.
- Site haritasından en fazla 150 aday alınır (öncelik sırasıyla); fazlası deftere girmez, sayısı kayda yazılır.
- Aynı siteye en fazla 3 eşzamanlı sayfa.
- Süreç başına en fazla 2 eşzamanlı site taraması (`SITE_CAPTURE_MAX_CONCURRENT`).
- En fazla 5 PDF, PDF başına 15 MB.
- Engellenen sitede sıra: mobil kimlikle yeniden deneme, tarayıcısız düz HTTP, olmazsa defterde `blocked`. Proxy kapsam dışı.
- `robots.txt`: `Sitemap:` satırları keşif için okunur. `User-agent: *` grubunun `Disallow` kurallarına uyulur; atlanan adres deftere `robots_disallow` nedeniyle yazılır. İstisna: ana sayfa ve ana sayfadan doğrudan bağlanan rezervasyon / menü / sipariş sayfaları (bugün zaten açılan üç sayfa), çünkü bunlar olmadan bugünkü doğru cevaplar bozulur.

## Süre modeli

Yakalama uzun sürer; `agent-runs` kuyruğunun 10 slotunu ve 3 dakikalık bekçisini bozmadan çalışması için:

- **Dış sınır.** Worker kaydına isteğe bağlı `deadlineMs` eklenir. `WEBSITE_AUDITOR` için 300 sn (ana sayfa denetimi ≤ 60 sn + yakalama 150 sn + PDF ve yazma payı). Diğer worker'ların sınırı değişmez. Slot beklemesi bu sürenin içinde değildir.
- **İptal.** Dış sınır dolunca yürütücü bir iptal sinyali gönderir; yakalama tarayıcı bağlamını kapatır ve slotu bırakır. Sınırı aşan iş arkada çalışmaya devam etmez.
- **Slot beklemesi iş slotu tutmaz.** Tarama slotu yoksa koşu `PENDING`'e döner ve iş gecikmeli olarak kuyruğa geri konur (20 sn'den başlayıp 120 sn'ye çıkan aralıkla). Bu, BullMQ deneme hakkı harcamaz ve diğer worker'ların sırasını tıkamaz.
- **Bekleme tavanı.** Koşu oluşturulduktan 30 dakika sonra hâlâ slot yoksa denetim bugünkü sığ taramayla tamamlanır; zincir ilerler, kayıtta derin taramanın kapasite yüzünden atlandığı görünür.
- **Bekçiler.** `GET /api/agent-runs/[id]` içindeki tembel bekçi, senkron koşuda worker'ın `deadlineMs` + 60 sn'sini kullanır (yoksa bugünkü 3 dakika) ve süreyi son başlangıç ya da son ertelemeden sayar. Arayüzdeki "takıldı" etiketi de `deadlineMs`'i bilir.
- **Verim.** Tek süreçte 2 slot ve hedef medyan 60 sn ile saatte yaklaşık 120 site. 90 lead'lik bir partide denetim aşaması yaklaşık 45 dakika sürer (bugün birkaç dakika); bu bilinen bedeldir, slot sayısı ortam değişkeniyle artırılabilir.
- **Kapatma anahtarı.** `SITE_CAPTURE_DEEP=0` derin yakalamayı kapatır; worker bugünkü davranışına döner.

## Sözleşme

- `null` = bilinmiyor. Hiçbir alan "görmedim" için `false` yazmaz.
- Her bulgu üç durumdan biri: bulundu (URL + alıntı), bakıldı ve yok (defterde hangi sayfaların açıldığı), bakılamadı (defterde neden).
- Köprü yalnızca `null` bulguları doldurur; `mergeSiteFacts`'in bugünkü cevabını ezmez. Köprü `bookingChecked`, `menuPageSeen`, `orderPageSeen` alanlarına dokunmaz: "bakıldı ve yok" kararını bugünkü kurallar verir, daha çok sayfa açıldı diye yeni `false` üretilmez.
- **Bulgunun kapsamı.** Etkinlik / grup / SSS sayfasından ya da grup ifadesinin yanından okunan kapora bulgusu `scope: "group_or_event"` taşır. Oda 1 genel "kapora var" sinyalini yalnızca kapsamı genel olan bulgudan üretir; grup kapsamlı bulgu kanıt olarak durur ama genel iddiaya dönüşmez.
- **Bulgunun kaynağı.** Köprünün doldurduğu bulgu `source` taşır: `page`, `network` (üçüncü taraf istek) ya da `pdf`.
- `SiteFacts` geriye uyumlu kalır: yeni `coverage`, `scope`, `source` alanları isteğe bağlıdır.
- Ham HTML veritabanına yazılmaz; sayfa başına metin 60.000 karakterle sınırlıdır.

## Saklama

- `SiteCapture` ve `SiteCapturePage` satırları `workspaceId` taşır; her okuma ve yazma `workspaceId` ile kapsamlanır.
- Lead başına tek kayıt (`leadId` tekil). Her yeni denetim eski kaydı ve sayfalarını silip yenisini yazar; geçmiş tutulmaz.
- Lead silinince kayıt ve sayfaları birlikte silinir (cascade).
- Tavan: lead başına 40 sayfa × 60.000 karakter ≈ 2,4 MB metin; tipik kayıt bunun onda birinin altındadır.

## Mevcut sisteme bağlanış

- Zincir değişmez: `WEBSITE_AUDITOR` tek adım kalır. Yeni kuyruk, yeni worker türü, yeni Gemini çağrısı yok.
- `crawlWebsite(url, type)` imzası ve davranışı korunur; yeni `crawlWebsiteDeep` hem `features` hem `capture` döner.
- Kanıt rafının Site çekmecesi kapsam satırını gösterir (kaç sayfa açıldı, hangileri neden açılamadı) ve kapsamlı kapora bulgusunu kapsamıyla yazar.

## Kapsam dışı

- `APIFY_WEB_CRAWL_DEEP`'in Apify yerine `SiteCapture` okuması: faturalanan bir özelliğe (kota, plan metni, maliyet tahmini, `PROSPECT_KB_CHUNK` kalitesi) dokunur ve "kayıt yoksa / eskiyse" kuralı ister; ayrı küçük spec.
- Üç Apify doğrulama yardımcısı (Bing, Companies House, Instagram bio): Companies House anahtarı ve arama API'si seçimi gerektirir; ayrı küçük plan.
- Gemini ile okuma, menü zekâsı, teknik denetim: alt projeler 2, 3, 4.
- Proxy, giriş gerektiren sayfalar, ekran görüntüsü saklama, PDF için OCR.

## Test ve başarı ölçütü

- Saf parçalar (sınıflandırma, keşif, indirgeme, defter, köprü) birim testle; yakalama sahte bir sayfa açıcıyla test edilir.
- Defter kuralı testle korunur: keşfedilen her adresin tam bir sonucu olur.
- **40 sitelik ölçüm** (`scripts/website-audit-eval`):
  - Bugünkü doğru cevapların hiçbiri bozulmaz.
  - Toplam yanlış 1'i geçmez; eskiden `null` olan hiçbir hücre yanlış cevaba dönmez.
  - Kaçırılan pozitif toplamı azalır, hiçbir alanda artmaz.
  - Süre: site başına medyan ≤ 60 sn, p95 ≤ 180 sn.
- **Bilinen kaçaklar:**
  - Dishoom ve Lokanta'nın kaporası kapsamıyla (`group_or_event`) ve kanıt adresiyle bulunur (2/2).
  - Zizzi ve Gaucho: rezervasyon sağlayıcısı kanıtıyla adlandırılır, ya da defterde rezervasyon sayfasının açıldığı ve hangi üçüncü taraf adreslerin görüldüğü yazar; hangisi olduğu ölçüm notuna yazılır.
  - Four Seasons (Avlu): defterde `blocked`.
- **Ayrı küme (insan testi).** 40 sitede ayar yapıldığı için, ölçümde hiç kullanılmamış 12 gerçek lead sitesi ayrı tutulur. Bu küme için her bulgu, kanıt adresi ve defter özeti bir test kağıdına dökülür; insan her satırı siteyi açarak işaretler. Geçme koşulu: iddia edilen bulgularda yanlış 0, defterde "açıldı" yazan her sayfa gerçekten ilgili sayfa.
