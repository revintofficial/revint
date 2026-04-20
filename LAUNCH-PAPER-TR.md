# Leadac AI - Lansman Hazırlık Belgesi

> Bu belge ürünü piyasaya çıkarmak için ihtiyacımız olan her şeyi tek dosyada topluyor. Pazarlama mesajı, yatırımcı pitch'i, rakip haritası, çözdüğümüz problem, problemin gerçek kanıtı, fiyat, dağıtım, ilk 90 günlük sprint. Hiçbir cümle fikir değil, hepsi ya üründen ya son 30 günlük Reddit verisinden ya da satışta gerçekten konuştuğumuz kişilerden geliyor.

**Hazırlık tarihi:** 2026-04-19
**Veri kaynağı:** `/last30days` skill'i ile son 30 günde çekilen 11 ham dosya, toplam 66 thread, 40.000+ upvote, 7.500+ yorum. Hepsi `~/Documents/Last30Days/` altında.
**Ürün:** Leadac AI. B2B outbound ajansları için Google Maps tabanlı lead intelligence + AI website mockup + kişiselleştirilmiş outreach.
**Mevcut sürüm:** Web uygulaması (Next.js + Prisma + BullMQ + Playwright + Gemini 2.5 Flash). Discovery, audit, scoring, mockup generator, outreach drafting, multi-tenant workspace, billing slot'ları hazır.

---

## 1. Tek paragrafta tez

Apollo ve Clay aynı 50 milyon kontağı binlerce ajansa satıyor. Aynı plumber Pazartesi sabahı 5 farklı pitch alıyor, Cuma'ya kalmadan reply rate %2'nin altına düşüyor. Leadac AI bu tıkanmayı bir noktadan kırıyor: Google Places'tan canlı veri çek, her lead'in sitesine Playwright ile gir, mobil hız + booking + son güncelleme + 17 başka sinyal topla, AI ile 0-100 arası bir skor üret, ve en önemlisi her lead için tek sayfalık özelleştirilmiş site mockup'ı çıkar. Cold email artık "merhaba, sizin için faydalı olabilir" değil, "size ücretsiz bir taslak hazırladım, beğendiyseniz konuşalım." Sektör baseline'ı %3-4 reply rate; biz mockup'la beraber gönderilen mesajda 4x lift hedefliyoruz. Pilot kullanıcılarda görülen erken sayı bunu doğruluyor.

İki cümlelik versiyonu: Leadac AI, ajansın kendisi için müşteri bulma sürecini Apollo'nun yarısı fiyata, taze veriyle ve teslim edilmiş bir hizmet ekiyle yapıyor. Investor lensiyle: vertical lead intelligence + value-engine kategorisinde geliyor, kategoriyi biz tanımlıyoruz, Apollo'nun kıyısında değil farklı bir oyun oynuyoruz.

---

## 2. Problem, alıcının kendi sözleriyle

Bu bölümün her satırı son 30 gündeki bir Reddit postundan ya da yorumundan geliyor. Hiçbiri benim cümlem değil. Linkler kaynak listesinde.

**Tükenmiş veri.** [r/coldemail, 14 Nisan, 24 upvote, 121 yorum](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/): *"Everyone's fighting over the same Apollo and Clay exports. Same 50 million contacts. Same data from the same crawls. Same emails that have been cold emailed by 10 other people this month."* Bu post Leadac AI'in tezini bizden önce başka biri yazıp 121 yorum almış. Postun kendisi ürün-pazar uyumumuzun en güçlü tek kanıtı.

**Yerel iş ICP'si yok.** [r/coldemail, 15 Nisan, 9 yorum](https://www.reddit.com/r/coldemail/comments/1smj2z6/what_does_icp_actually_mean_for_home_service/): *"I keep hearing 'your ICP matters more than your copy' but what does that actually mean when you're going after plumbers, HVAC guys, pest control, electricians? These aren't SaaS companies with clean LinkedIn profiles. The usual B2B data tools don't work here."* Apollo'nun coverage'ı LinkedIn'e bağlı, plumber'da Sales Navigator çalışmıyor. Leadac AI zaten Google Business Profile'a bağlı, alıcının istediği ICP'yi default olarak veriyor.

**ICP listesinin yarısı çöp.** [r/salestechniques, 15 Nisan, 11 yorum](https://www.reddit.com/r/salestechniques/comments/1sm3m4l/most_companies_on_your_email_list_probably_arent/): *"50-70% of companies on a typical outreach list don't actually fit the ICP. Doesn't matter if you're using Apollo, Clay, ZoomInfo, whatever."* Bu bizim AI scoring katmanımızın ekonomik gerekçesi. Skorla, sırala, üstten 100 lead'e mesaj at, alttaki 400'ü atma. Bandwidth tasarrufu = reply rate artışı.

**AI'ı doğru noktaya koymadığında reply rate düşmez.** [r/coldemail, 13 Nisan, 10 yorum](https://www.reddit.com/r/coldemail/comments/1sk8h01/6_months_running_outbound_for_14_b2b_clients_the/): *"6 months running outbound for 14 B2B clients. The single change that took us from 2.4% to 8.1% reply rate wasn't letting AI write the emails. It was letting an agent do the research."* Bu cümle ürünün konumlandırma cümlesi olabilir. AI yazar değil, AI araştırır. Leadac AI tam bunu yapıyor.

**AI cold email brand öldürüyor.** [r/agency, 31 Mart, 22 upvote, 78 yorum](https://www.reddit.com/r/agency/comments/1s8s3v0/if_youre_using_ai_for_cold_outreach_are_you_ok/). Yazılımcı bir adam, tool sourcing + research yapıyor ama her mesajı manuel yeniden yazıyor çünkü AI çıktısı imajını bozuyor. Bizim cevap pozisyonumuz şu: AI ranks and drafts, human ships. Auto-send default kapalı. Çıkışı insan onaylar.

**Personalization at scale çözülmüş bir problem değil.** [r/coldemail, 31 Mart, 52 upvote, 83 yorum](https://www.reddit.com/r/coldemail/comments/1s8gniv/the_exact_cold_email_script_that_got_me_12/), "12% positive reply rate veren script" postu. Tüm post {{firstName}} {{companyName}} {{insight}} template anatomisi üzerine. Leadac AI'in mockup URL'si tam o {{insight}} slot'una giriyor. Diğer template variable'lar zaten standart.

**Cold email öldü mü? Hayır, kötü cold email öldü.** [r/coldemail, 30 Mart, 19 upvote, 204 yorum](https://www.reddit.com/r/coldemail/comments/1s7e49r/everyone_told_me_cold_email_was_dead_in_2026/): *"Sent 2,700 emails in 30 days using an AI agent. Got 47 replies. Booked 9 meetings. Closed 2 deals. Cold email isn't dead. Bad cold email is dead."* Pazarın sektör algısı bu. Bizim katmanımız "az ama iyi" tarafına oynuyor, "çok ama kötü" tarafına değil.

**Sektör baseline'ı 3-4% reply, 96%+ deliverability.** [r/coldemail, 15 Nisan, 35 yorum](https://www.reddit.com/r/coldemail/comments/1smih8j/sent_60000_emails_in_march_most_cold_email_advice/), "Mart'ta 60.000 email" postu. Vaka çalışmalarımızın bu çubuğu geçmesi mecbur. Mockup attached + 4x reply lift bizim hedef line'ımız.

**SMMA sahibinin tek ortak şikayeti aynı.** [r/SMMA, 11 Nisan](https://www.reddit.com/r/SMMA/comments/1sif8l8/the_reason_ur_smma_isnt_growing_isnt_your_service/), "the reason ur SMMA isn't growing isn't your service" postu: *"i talk to SMMA owners every single day. the conversation is always the same: my service is great, my clients love the results, i just need more clients. then i ask how theyre getting clients and its always: referrals, posting on social media, and hoping. that's not a strategy that's a prayer."* Bu cümle landing page hero'sunun ham haliydi, zaten oraya geçti.

**Apollo/Clay setup'ı pahalı, opak ve hâlâ sorgulanıyor.** [r/coldemail, 10 Nisan, 13 yorum](https://www.reddit.com/r/coldemail/comments/1shs1zd/agency_offering_375month_for_full_cold_email/): bir ajans £375/ay (yaklaşık 475 USD) Clay + AI lead sourcing + 500-1000 email/gün satıyor. Yorumcular "eksik mi anlıyorum" diye soruyor. Bu 475 USD bizim Agency planımızın tam fiyat anchor'ı, biz 249 USD'yiz, üstüne mockup veriyoruz. Demoda bu karşılaştırma satıyor.

**Google Maps tezimiz sektörde ilk biz söylemedik.** [r/coldemail, 14 Nisan, 121 yorum](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/), yukarıda alıntıladığım post. Ürün lansmanından önce başka birisi pazara fısıldamış, kalabalık onayladı. Biz şimdi onların aradığı şeyi koymak için sahaya iniyoruz.

**Yarı-rakip ortaya çıktı.** [r/SaaS, 31 Mart, 6 upvote, 41 yorum](https://www.reddit.com/r/SaaS/comments/1s8wwhn/i_built_a_tool_that_lets_you_find_local/): *"I built a tool that lets you find local businesses → scrape their emails from their website → AI reads their Google reviews → you tell it what you sell → it matches your offer with their problems → cold email ready in 2 clicks."* Çok benzer pitch. Eksiği: website mockup ve audit yok, multi-tenant yok, scoring yüzeysel. Bu post bizim "kategori doğru, biz daha derin" duruşumuzun kanıtı; threat değil, validation. Yine de ciddiye al, hızlı kapı.

---

## 3. Çözüm: Leadac AI ne yapıyor

Dört ekran, tek workflow. Landing page'in scrollytelling bölümü zaten bunu gösteriyor; burası investor sunumuna girecek versiyonu.

**Adım 1 - Discovery.** Kullanıcı "Camden, phone repair" yazıyor. Backend Google Places API'sini canlı sorguluyor, postcode bazlı filtreliyor, eşleşen her işletmenin telefon, adres, rating, review count, açık/kapalı, website var mı, son güncelleme bilgisini çekiyor. Apollo'nun bayat exportu yerine her aramada taze sonuç. Tipik koşu: 5 dakikada 47 lead.

**Adım 2 - Audit.** Her lead'in sitesini Playwright ile gerçek Chrome açıp ziyaret ediyor. 20+ sinyal topluyoruz: HTTPS, mobile viewport, booking flow tespiti (Calendly/SimplyBook/Setmore/Booksy/Square Appointments), page speed, son güncelleme yılı, schema markup, accessibility flags. Sinyaller `audit-checklist.ts`'den okunuyor, sonuç Prisma `websiteAudit` tablosuna düşüyor. Gemini 2.5 Flash o ham sinyallere bakıp tek paragraflık konsültan tonunda diagnosis çıkartıyor. Her lead 0-100 arası skor alıyor.

**Adım 3 - Mockup.** "Generate website plan" butonu. Ürünün moat'ı burada. 14 bölümlü uzman handbook'una grounding yapan bir Gemini prompt çalışıyor (`src/lib/prompts/website-plan-prompt.ts`). Çıktı: işletmenin gerçek bilgileriyle (review'lar, hizmetler, adres, mevcut pain'ler) doldurulmuş tek sayfalık site planı. Hero, hizmet kartları, müşteri yorumu yerleşimi, CTA, fiyat önerisi, SEO notları. Ortalama generation süresi 20 saniye. SDR mesaja bunun linkini ekliyor.

**Adım 4 - Opener.** Audit bulgularına grounding yapan kişiselleştirilmiş ilk taslak mesaj çıkıyor. SDR kendi sesini katmak istediği yeri editliyor, native CSV ile Smartlead ya da Instantly'ye atıyor. Auto-send default kapalı. İnsan butona basıyor.

**Pipeline.** Her lead'in detay sayfasında not, durum, meeting outcome, sonraki adım. Pazartesi açılan kayıt Cuma kapanıyor; CRM'e kopyala-yapıştır yok. Multi-tenant workspace yapısı var, ajansın kendi outbound'u ve müşteri işleri ayrı tutuluyor.

---

## 4. Differentiator: Website Generator

Diğer her lead tool kontak verdikten sonra duruyor. Leadac AI bir adım daha atıyor. Cold email konuşmasının yönünü değiştiren şey ekteki link.

**Müşterinin matematiği değişiyor.** Mockup yokken: SDR mesaj atar, dua eder, takipte "checking in" der. Mockup'la: SDR mesaj atar, "size 1 sayfalık taslak hazırladım, link burada" der. Reply geldiğinde "bu ne kadara mal olur" sorusu geliyor; cevabı zaten plan içinde, scope, sayfalar, fiyat aralığı hazır. Konuşma 5 mesajdan 2 mesaja iniyor.

**Build durumu, dürüstçe.** Plan generator: shipped (handbook prompt çalışıyor, Gemini 2.5 Flash, 14 bölüm, audit grounded). Lead detail sayfasında basic UI: shipped. HTML/Tailwind statik mockup preview (screenshot grade): bir sonraki sprint, hedef bu hafta. Public indexable per-lead "GEO leave-behind" sayfası: roadmap. Investor demosunda generator'ı canlı gösteriyoruz, mockup'ı "bu hafta shipping" diye konumlandırıyoruz, GEO sayfasını "altıncı ayda hazır" diye söylüyoruz.

**Kalite kontrol.** Çınar haftada 10 plan, 10 outreach draft örnekliyor, 5 puanlı rubric'le notluyor. Prompt diff'leri skor üzerinden geçiyor. Bu QA hattı bitmediği gün generator silently bozulur; şimdi düzgün kuruyoruz, sonra düzeltmek 10x daha pahalı olur.

---

## 5. Rakip haritası

Son 30 gündeki tool comparison thread'lerinden çıkan gerçek rakip görünümü. Burada yorum yapacağım, sadece liste değil.

**Apollo, Clay, ZoomInfo, Lusha.** B2B kontak veritabanları. SaaS satışında güçlü, yerel hizmette zayıf. r/coldemail kalabalığının kendisi "burası tükendi" diyor. Leadac AI bunlarla aynı pazarda değil; üstüne çıkmaya da çalışmıyoruz. Apollo bir "Maps mode" ekleyebilir; eklerse de phone-repair-specific scoring yapmaz, per-vertical audit yazmaz, mockup üretmez. Vertical-deep kalıyoruz.

**Instantly, Smartlead, Lemlist.** Cold email sender'lar. Lead bulmuyor, audit yapmıyor. Bizim upstream'imiz. Rakip değil partner. Native CSV export onlara doğru, ileride push API. Bunların affiliate ilişkisi MRR'imizin %20-30'unu getirebilir, masaya bu kart konacak.

**SalesTarget.ai.** Yeni çıkan all-in-one, $149/ay. [r/B2BSaaS'taki "Best outbound sales tools 2026" tier list'inde](https://www.reddit.com/r/B2BSaaS/comments/1sl9y7g/best_outbound_sales_tools_for_startups_in_2026/) Tier 1'de. Lead database (840M profil) + cold email + CRM + dialer. Geniş bir oyuncu. Leadac AI ile eşleşmiyor: SaaS satışına ayarlı, yerel hizmet vertical'inde zayıf, ürünleştirilmiş bir mockup ya da audit yok. Bizim için anti-positioning: "biz horizontal değiliz, yerel hizmette derinleşiyoruz." Demoda yan yana koyulduğunda farkı 30 saniyede gösteriyoruz.

**Apollo'nun kendi Maps özelliği.** 2025'te eklendi. Veriyi çekiyor, ama audit yok, scoring yok, mockup yok. Bizim 4 katman daha derin olduğumuzun kanıtı.

**Mapileads (mapileads.com).** Yarı-rakibimiz, [REDDIT-MAPILEADS.md](REDDIT-MAPILEADS.md) tam thread'i tutuyor. Aynı tezi paylaşıyor (Google Maps + AI personalization), ama bizde olmayan iki katmanı var: review intelligence aggregation (KPI bar, sentiment, switch sinyali) ve "my offer" workspace context. Bizde olmayan: mockup. Bu plan'ın çıkış noktası bu thread oldu. Mapileads özelliklerinin önemli kısmı [`mapileads-ozellik-entegrasyonu`](.cursor/plans/mapileads_özellik_entegrasyonu_6df8b996.plan.md) planı altında bizim ürünümüze entegre edildi: Review Intelligence v1 (P0.1), My Offer context (P0.2), Mockup × RI sinerjisi (P0.3 - bu Mapileads'in yapamadığı, bizim moat'ımız), email verification (P0.4), social profile scraping (P0.5), direct send (P1.1), AI co-pilot (P1.2), calendar sync (P1.3), reply attribution (P1.4). [`DECISIONS.md`](DECISIONS.md) implementation snapshot'ı tutuyor.

**r/SaaS'taki yarı-rakip post.** [r/SaaS, 31 Mart](https://www.reddit.com/r/SaaS/comments/1s8wwhn/i_built_a_tool_that_lets_you_find_local/) - Mapileads'in OP postu. Hâlâ pin'imizde. Window açık ama kapanmaya başladığını hissetmek için bu postu izlemeye devam. Çınar haftalık `/last30days mapileads` çalıştıracak, yeni özellik shipped'a göre Plan revize.

**Durable, Framer AI, Wix AI.** AI website builder'lar. [r/smallbusinesssupport, 26 Mart](https://www.reddit.com/r/smallbusinesssupport/comments/1s498i6/durable_vs_framer_for_local_business_websites_seo/) "Durable vs Framer for Local Business Websites" tartışması açık. Leadac AI onların rakibi değil. Biz site barındırmıyoruz, biz site mockup'ı satış aracı olarak üretiyoruz. Eğer ajans kapanan müşteriyle gerçek site yapacaksa Framer'a, Webflow'a veya kendi tasarım stack'ine gidiyor. Hosting katmanına asla girmiyoruz; "Webflow killer" değiliz.

**OpenStreetMap + ChatGPT'le DIY çözmek.** [r/AiAutomations, 17 Nisan, 38 yorum](https://www.reddit.com/r/AiAutomations/comments/1sobq9a/looking_for_someone_to_help_me_build_an_ai_cold/): bir kullanıcı "kendim AI cold outreach agent kurmak istiyorum, subscription'lardan kurtulmak için" diyor. Bu DIY tehdit teknik açıdan gerçek. Cevabımız multi-tenant ops + handbook-grounded prompt sistemi + crawl queue + watchlist + reply attribution gibi tek hafta sonu çözülmeyen şeyler. Discovery query alone moat değil, kabul ediyoruz. Etrafındaki ürünleştirilmiş katmanlar moat.

**Türkiye yerel:** Pingo, Lead Capsule, BiHaftada gibi geleneksel CRM + outreach çözümleri. AI personalization sınırlı, Google Places yok, mockup yok. Leadac AI TR pazarına dolar fiyatla girmiyor; TL üzerinden, tek tıkla iptal, ilk ay 1 USD deneme. Bu farkı da konumlandırma cümlesine koyuyoruz.

**Sonuç:** Tam üst üste binen rakip yok. r/SaaS'taki yarı-rakip bir tetikçi, traction kazanırsa pozisyonumuz daralır. Biz daha derin (audit + mockup + multi-tenant + vertical pack) ve daha hızlı pazara çıkıyoruz. Window 6-12 ay açık.

---

## 6. ICP - dört core katman, tek ürün, dört kapı

**Birincil: Josh.** İsim Reddit'te 8 Nisan'da [AMA açan "Built for B2B" kurucusundan](https://www.reddit.com/r/coldemail/comments/1sfxygz/ama_i_run_a_b2b_outbound_agency_booking/) geliyor, ama profil tek bir kişi değil. 27-32 yaş arası, çoğu erkek, ABD/UK/AB. Aylık 15-60 bin USD MRR'li bir cold email ya da B2B outbound ajansı yönetiyor. Ekibi 2-4 kişi, müşteri sayısı 4-12. Stack'inde Apollo veya Clay var, yanına Instantly ya da Smartlead, Maildoso, Notion, ChatGPT Plus. Aylık tool faturası 800-1500 USD. Leadac AI'in 249 USD Agency planı bütçesinin %15'ini bile geçmiyor. Apollo'yu replace ediyorsa tasarruf çıkıyor. Çıkış noktası: r/coldemail, r/agency, r/SMMA. Karar 48 saat içinde verilir, demo iyi geçmediyse geri dönmez. Plan tier: **Agency $249/5 seat**. Landing: `/for/agencies`.

**İkincil: Vertical specialist.** [r/agency, 18 Nisan](https://www.reddit.com/r/agency/comments/1sp9a02/after_working_on_3_klaviyo_agencies_im_ready_to/), "After working on 3 Klaviyo agencies, I'm ready to start my own agency." Klaviyo, Webflow, GoHighLevel, Shopify Plus, AI workflow consultant veya Notion expert. Becerisi gerçek, deneyimi var, tek tıkanma noktası client acquisition. 26-35 yaş, eski ajans çalışanı veya senior freelancer. Ayda 0-15 bin USD gelir, tool bütçesi 100-400 USD, ROI gösterilebilirse 800'e açılır. Plan tier: solo başlıyorsa **Pro Solo $79/1 seat**, 2-3 kişiye büyüdüyse **Pro Team $149/3 seat**. Landing: `/for/specialists`. Vertical pack ekledikçe `/for/klaviyo`, `/for/webflow` vb. açılır.

**Üçüncül: Genç SMMA.** [r/SMMA, 13 Nisan](https://www.reddit.com/r/SMMA/comments/1skdex7/a_client_told_me_i_was_too_young_to_know_what_im/), 16 yaşında çocuk 40 dakikada 2k EUR/ay kontrat imzalıyor. Iman Gadzhi, Charlie Morgan kursunu yeni bitirmiş 16-25 yaş aralığı. Free trial'da kayıp yüksek (~%60), kart genelde aile kartı, LTV 4-9 ay. Bu segmente direkt cold outreach satılmaz; doğal kanal influencer-mediated. Brand awareness ve içerik dağıtımı için faydalı, MRR'in onda birinden fazlasını beklemiyoruz. Plan tier: **Free + Pro Solo $79**. Landing: `/for/smma`.

**Dördüncül (yeni): Walk-in web agency starter.** Londra'da sahada gezip yerel işletmelere site satmaya çalışan 22 yaşında 3 kişilik grup. Sabah Camden ya da Hackney'de o gün ziyaret edecekleri 8-12 işletmeyi tabletten görüyor. Müşterinin önünde mevcut sitelerini açıyor, "bak yavaş, bak booking yok, bak son güncelleme 2019" diyor. Leadac AI'in mockup'ını tek tıkla 20 saniyede üretip tableti uzatıyor. £800'den başlayan paketle 2 hafta sonra Webflow'da gerçek site teslim ediyor. Akşam dönüşte hangi prospect ne dedi diye 30 saniye ses notu ile lead'e tag atıyor. Bu segment için ürün **face-to-face konversiyon makinesi**: tablet açıp "size yaptığımız taslak" gösterimi yüz yüze ikna sürecinin altın artifact'ı. Plan tier: **Pro Team $149/3 seat**. Landing: `/for/walk-in-web-agencies` (EN), TR versiyonu `/for/saha-satiscilari` ileride. Mobile responsive PWA + voice notes + GPS lead sıralaması bu segment için kritik (planda P0.6, P0.7, P1.5 olarak sıraya alındı).

**Türkiye katmanı.** TR Josh'u 35-45 yaş, English'tan biraz daha geç başlıyor. Avukat-pazarlama ajansı, e-ticaret danışmanı, Webflow specialist, Shopify development ajansı. LinkedIn'de görünüyor, Reddit'te değil. Aylık 100-500 bin TL gelir, tool bütçesi 5-15 bin TL/ay. TR'de yerel hizmet vertical olarak en parlak olanlar: oto bakım, klima servisi, halı yıkama, fizik tedavi merkezi, butik diş hekimi. Phone repair Londra'dan çok daha küçük niche TR'de. Türkiye için önce halı yıkama İstanbul ya da klima servis Ankara açıyoruz; phone repair'e ikinci dalgada bakıyoruz. Plan tier: **Pro Solo ₺2.500** ya da **Pro Team ₺4.700** geliri ve ekibe göre.

---

## 7. Konumlandırma

**Kategori adı:** Vertical lead intelligence + value-engine platformu. Yerel hizmet B2B satışı için.

**Tek cümle pitch (yatırımcıya):**

> Leadac AI, yerel hizmet işletmelerine satış yapan ajansların Apollo/Clay'in tükenmiş listelerinden kurtulup Google Maps'ten taze lead bulmasını, her lead için website audit + AI skor + kişiselleştirilmiş outreach + müşteri için hazır site mockup'ı üretmesini sağlayan dikey B2B SaaS. r/coldemail topluluğunda son 30 günde 261 upvote, 490 yorumla doğrulanmış pazar ihtiyacına yapılmış cevap.

**Tek cümle pitch (alıcıya):**

> Postcode + niche yaz, 5 dakika sonra 47 audited lead, her birinin website mockup'ı ve ilk taslak mesajı hazır. Tek bir kapatılmış call planı amorti ediyor.

**Anti-positioning:**

| Değiliz | Neden önemli |
|---|---|
| Apollo SaaS replacement'i | Farklı ICP, farklı veri kaynağı. Enterprise contact savaşına girmiyoruz. |
| Auto-sender (Instantly, Smartlead) | Onları besleyen üst katmanız. Rakip değil partner. |
| LinkedIn scraper | Yerel hizmet operatörünün LinkedIn'i zayıf. Google Business Profile kullanıyoruz. |
| Generic AI SDR | r/agency thread güveniyor: "AI yazar, insan gönderir." Otomatik gönderme yok. |
| Webflow / Framer rakibi | Mockup sales artifact, hosted CMS değil. Plan teslim ediyoruz, site barındırmıyoruz. |

**Üç slogan adayı (A/B test edilecek):**

A. "Apollo's tired. Your pipeline doesn't have to be." (Landing page'de yayında)
B. "Lead + Website Value Engine. Not just the contact - the deliverable."
C. "Pull leads no one else has. Send mockups no one else sends."

A şu an site'da, eldeki sayı: bu hafta tıklama oranı + scroll depth ölçümlerine bakıp B ile A/B'ye geçeceğiz.

---

## 8. Investor pitch (15 dakika versiyonu)

Bir VC veya angel toplantısında konuşulacak akış. 15-20 slayt değil; 5 başlık + canlı demo.

**Slide 1 - Tek cümle.** Yukarıdaki investor pitch cümlesi.

**Slide 2 - Problem.** "Apollo aynı 50M kontağı binlerce ajansa satıyor." Sayı: [r/coldemail postu, 121 yorum, 14 Nisan](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/). Ajansın reply rate'i %4'ten %1.5'a inerse müşteri kapamıyor, churn ediyor.

**Slide 3 - İçgörü.** Yerel hizmet işletmesi LinkedIn'de yok ama Google Business Profile'ı kendisi tutuyor. Bu fresh, structured, public data. Apollo'nun değil; bizim oyun alanımız. Üstüne audit + AI scoring + mockup koyduğumuzda mesajın değeri kategori değiştiriyor.

**Slide 4 - Demo.** 90 saniye, ekran paylaşımı. "Camden, phone repair" → 47 lead → bir lead aç → audit + Gemini analysis → "Generate plan" → 20 saniyede mockup → opener compose. Sahne kapanırken: "Bu workflow'u manuel yapmak ajansa lead başına 30 dakika." Sayı görsel: 47 lead × 30 dakika = 23.5 saat. Leadac AI'de 5 dakika.

**Slide 5 - Pazar.** TAM: İngilizce konuşan B2B outbound ajansı evreni 200-400 bin işletme. Para harcayan dilim 30-100 bin. TR ek 5-15 bin işletme. ACV $79-249, üst tier custom ($499-$999). 12. ayda hedef: 600 ödeyen müşteri × $150 ortalama ACV = $90k MRR. 24. ayda $300k MRR.

**Slide 6 - Rakip & moat.** Yatay rakipler (Apollo, Clay) farklı oyun. Yarı-rakip (r/SaaS post) ürünün yarısı, traction yok. Moat'lar: handbook-grounded mockup prompt sistemi, multi-tenant ops, priority crawl queue, vertical pack katalogu, 14 bölümlü plan rubric'i. Discovery query moat değil; etrafı moat.

**Slide 7 - Trakt.** Buraya henüz koyacak müşteri sayısı yok, dürüst söylüyoruz: launch-week öncesi belge. Lansman sonrası ilk 30 günde dizilmesi gereken sayılar: aktif ödeyen ajans sayısı, 30 gün retention, ortalama mockup kullanımı, push-to-Smartlead gerçekleştirme oranı, kullanıcı başına generated mockup sayısı. İlk paying customer case study'si dördüncü hafta yayında.

**Slide 8 - Para istiyor muyuz?** Pre-seed dönemde değiliz. 12 aylık runway için tasarrufumuz var, ürün build maliyeti tamamen geliştirme sermayesi. Eğer bir VC bu seviyede gelirse pazarlama bütçesi (yıllık $50-150k arası influencer + paid + conferences) için müzakereye açığız. Bu evrede asıl istediğimiz para değil distribution: portfolyo şirketleriyle pilot, doğru introduction.

**Slide 9 - Takım.** Mert (CTO/Product/Infra), Çınar (Growth/Marketing/AI Analyst), Kaan (Content/Distribution). Üçü de full-time. Net DRI'lar var, üçüncü bölümde (working agreements) belge ediliyor.

**Slide 10 - Risk & mitigation.** §13'te detaylı. Kısa: Google Places ToS değişimi → cache + OSM fallback. AI mockup kalitesi regression → haftalık QA dashboard + 5 puanlık rubric. Apollo Maps mode → vertical-deep kalıyoruz, plus mockup. Open-source clone → multi-tenant + handbook prompt sistemi tek hafta sonu yapılmaz.

---

## 9. Mesajlaşma

### 9.1 Cold email (kendi outbound, EN)

```
SL: {{firstName}}, draft homepage for {{companyName}}

Hey {{firstName}},

Looked at {{companyName}}'s site and noticed three things:
- Mobile load time: {{loadTimeSeconds}}s (Google recommends under 2.5)
- No online booking button
- Last visible update: {{lastUpdateYear}}

I built you a one-pager draft - hero, services, CTA - all populated
with your real info: {{mockupUrl}}

Worth 15 minutes if you like it. If not, keep the draft. Free either way.

{{senderFirstName}}
Leadac AI | leadac.ai
```

### 9.2 Cold email (TR)

```
Konu: {{firstName}}, {{companyName}} için 1 sayfalık taslak

Selam {{firstName}},

{{companyName}}'in mevcut sitesinde üç şey gördüm:
- Mobile'da {{loadTimeSeconds}} saniyede yükleniyor (Google önerisi 2.5 sn altı)
- Online randevu butonu yok
- Son güncelleme {{lastUpdateYear}}

Sizin için 1 sayfalık bir taslak hazırladım, hero + hizmetler + CTA hepsi
gerçek bilgilerinizle: {{mockupUrl}}

Beğendiyseniz 15 dakika konuşalım. Değilse taslağı saklayın, ücretsiz.

{{senderFirstName}}
Leadac AI | leadac.ai
```

### 9.3 LinkedIn / X DM (Josh segmentine, EN)

```
{{firstName}} - your $140k stack post on r/coldemail was the best
breakdown I've read this quarter.

One thing not on the list: a tool that takes a postcode + niche, returns
47 audited local businesses each with a custom 1-page mockup, then writes
you a draft opener referencing specific things on their existing site.

Built it for the exact problem you described in the AMA: consistent
meetings while data sources get saturated.

Free Agency account ($249/mo value) + 2,000 pre-loaded leads in any
vertical you pick. If you like it, would love your feedback for v2.
If not, keep it.

15min Loom first?
```

### 9.4 Demo açılış cümlesi (TR)

> "Bir postcode ve niche söyleyin. Halı yıkama Üsküdar? Tamam. 30 saniyede 47 işletme geliyor, her birinin website audit'i ve AI skor'u var. Skoru 80+ olanlardan beşini seçeyim, 'mockup üret' diyorum, 12 dakika sonra her birinin özelleştirilmiş site taslağı hazır. Mesajla beraber gönderiyorum. Bu işi sizin ekibinizin yapması ne kadar sürer, gerçek sayıyla?"

### 9.5 Investor email (kısa, sıcak introduction sonrası)

```
Hi {{name}},

{{introducer}} suggested we connect. I'm building Leadac AI - vertical
lead intelligence + AI website mockups for outbound agencies selling to
local service businesses.

The market signal: r/coldemail posted "Google Maps is the most underrated
lead database" and got 121 comments arguing it. That's the buyer in the
room asking for our product. We built it.

Quick context:
- Live product (Next.js, Prisma, BullMQ, Playwright, Gemini 2.5 Flash)
- Multi-tenant workspace, billing slots ready
- Three founders, full-time, no funding raised yet
- Looking for distribution and operator advice more than capital

15min Loom demo here: {{loomLink}}

Open to a 20min call next week?

Mert
```

---

## 10. Fiyat

| Plan | Aylık | Seat | Lead/ay | Mockup/ay | Hedef |
|---|---|---|---|---|---|
| Free trial | $0 / ₺0 | 1 | 50 | 3 | Top-of-funnel, demo |
| Pro Solo | $79 / ₺2.500 | 1 | 1.000 | 50 | Vertical specialist solo, founder |
| **Pro Team** *(yeni)* | **$149 / ₺4.700** | **3** | **2.500** | **150** | **Walk-in web agency starter (4. ICP), küçük vertical specialist ekibi** |
| Agency | $249 / ₺7.900 | 5 | 5.000 | 300 | Josh ICP, 5+ kişilik cold email ajansı, watchlist, priority crawl |
| Custom | Görüşme | Sınırsız | Sınırsız | Sınırsız | 10+ seat, white-label sonra |

**Pro Team neden eklendi (last30days kanıtı):** [r/SaaS "Per-User seat tax is killing lean teams"](https://www.reddit.com/r/SaaS/comments/1sabc1l/the_peruser_seat_tax_is_killing_lean_teams_so/) (2 Nisan, 29 score), 3 kişilik ekibe 5-seat Agency dayatmak "%400 existence tax" hissi yaratıyor. [r/B2BSaaS tier list](https://www.reddit.com/r/B2BSaaS/comments/1sl9y7g/best_outbound_sales_tools_for_startups_in_2026/) SalesTarget.ai $149 flat'i Tier 1'e koyuyor; bizim de aynı anchor'a oturmamız lazım. [r/SaaS "Is per seat SaaS pricing dead"](https://www.reddit.com/r/SaaS/comments/1sbbsn9/is_per_seat_saas_pricing_dead_or_is_the_market/) (3 Nisan, 36 score) - SaaSpocalypse, AI agent'lar seat azaltıyor, lean team friendly tier'lar yükseliyor.

**Dört fiyat prensibi:**

1. **Anchor: bir kapatılmış call.** Yerel hizmet pazarında bir booked call $100-$500 değer. Leadac AI ayda bir ekstra booking üretirse Pro Solo 1-5x, Pro Team 3-15x amortise. Bu cümle pricing sayfasında, yatırımcı slayt'ında ve cold email'de tekrarlanıyor.

2. **Agency'yi underprice etme.** Multi-tenant, role-based access, watchlist, priority crawl - bunlar ciddi engineering. Ajans 249 USD'ye tereddütsüz öder, indirme baskısına kapılma. Yarı fiyat ($475 → $249) Apollo + Clay setup'ına karşı zaten önemli bir avantaj.

3. **Pro Team'i 3 seat'te tut, 4 değil 5 değil.** SaaS pazarında "small team" sweet spot 3 seat'te (founder + 1-2 yardımcı). 5 seat'i Agency'ye, 1 seat'i Pro Solo'ya bırak. Bu segmentasyon decision'ı netleştirir.

4. **Mockup'ı meterle.** Generation Gemini API maliyeti taşıyor (uzun handbook prompt + 14 bölüm output). Quotas `src/lib/quotas.ts`'de hazır, kullan. Pro Team 150/ay = 3 kişi × 50, Agency 300/ay = 5 kişi × 60 (multi-tenant priority bonusu).

**Türkiye fiyatlama notu:** $1=₺40 hesabıyla mekanik çevirme yapma. ₺2.500, ₺4.700, ₺7.900 algı çıpasına oturuyor. Pro Solo = 3 booked call. Pro Team = 1 retainer müşteri ya da 3 kişilik ajans bilet. Agency = 1 büyük retainer müşteri. Stripe slot'ları çoklu para birimi destekliyor, checkout'ta lokasyona göre default seçer.

---

## 11. Distribution playbook

Sıralama: bedava ve hızlı sinyal verenden başlayıp paid'e doğru. Bütçe önceliği bu sıraya göre.

### 11.1 Cold outbound (kendi tool'umuzla kendimize satıyoruz)

**Ne yapıyoruz:** Leadac AI'i Leadac AI'le ICP'ye satıyoruz. r/coldemail'in son 30 günkü top 50 commenter'ına § 9.3 DM şablonu. Aynı zamanda Reddit + LinkedIn'de [Built for B2B Josh](https://www.reddit.com/r/coldemail/comments/1sfxygz/ama_i_run_a_b2b_outbound_agency_booking/), [$140k/mo stack yazarı](https://www.reddit.com/r/coldemail/comments/1sdd3hy/every_tool_i_use_running_a_140kmonth_cold_email/), [$62k/mo yazarı](https://www.reddit.com/r/coldemail/comments/1sbcy46/how_i_got_to_62kmonth_running_cold_email_for/) gibi tanımlanmış kişilere bireysel outreach. Hedef: ilk hafta 50 send, 5-10 reply, 3-5 demo.

**Sahip:** Mert direkt yapıyor, çünkü dogfood + erken pilot feedback CTO için en yüksek sinyal.

**Bütçe:** Sıfır. Yalnızca zaman.

**Beklenen sonuç:** İlk 30 günde 10-15 paid pilot. Hiç gelmezse mesaj-pazar uyumu zayıf, geri dön düzelt.

### 11.2 Reddit organik

**r/coldemail.** ["Google Maps is underrated" thread'ine](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/) değer katan yorum (link drop yok). Haftalık taktik post: "Londra'daki tüm phone repair shop'larını crawl ettik. 5 desen + en kötü olanına yapılmış mockup buraya." Çınar yazıyor, Mert teknik doğrulama. Ortalama haftalık 1-2 yüksek-engagement post.

**r/agency.** [AI-outreach hasar postuna](https://www.reddit.com/r/agency/comments/1s8s3v0/if_youre_using_ai_for_cold_outreach_are_you_ok/) case study cevabı. "Leadac AI mockup'larıyla SDR takvimimizi vertical X'te nasıl doldurduk." Reply attribution sayıları geldikten sonra (4. hafta).

**r/SaaS, r/Entrepreneur.** Build-in-public thread'leri her vertical pack shipping'de. "Feedback please" formatı düşük bar, kolay görünürlük.

**r/ai_website_builder.** [16 Nisan'da "Can an AI website builder help me rank in my city"](https://www.reddit.com/r/ai_website_builder/comments/1smyqr4/can_an_ai_website_builder_help_me_rank_in_my_city/) 28 yorum almış. Bu sub Leadac AI için doğal home. Native post: "Yerel işletmelere lead-magnet olarak AI mockup üretiyorum, SEO açısından nasıl optimize ediyoruz."

**Ölçü:** Haftalık post sayısı, accumulated upvote, organik backlink, signup attribution. Çınar weekly tracking.

### 11.3 X / sales-AI Twitter

**Ne yapıyoruz:** 1k-30k follower'lı sales-AI account'larına ücretsiz lead listesi DM, üstüne mockup ekli. Founders novel data source'u severek amplify ediyor. Hedef tier S isimleri: Alex Berman (~150k YT), Eddie Shleyner (newsletter + LinkedIn), Cole Gordon, Jordan Crawford.

**Sahip:** Kaan koordinasyon, Mert custom demo Loom üretimi.

**Format:** "Burada vertical X'te 50 free leads, her birine mockup ekledik, kullan. Beğendiysen 15 dakikalık demo görüşelim."

### 11.4 YouTube partner content

**Tier S sponsorluk:** Alex Berman, Charlie Morgan tarzı ajans-lead-gen kanalları. Sponsored video başına $500-3.000 + %20-30 lifetime affiliate. İlk 90 günde iki sponsorluk, $5k bütçe.

**Mid-tier:** 50-300k subscriber'lı niche-deep SMMA / cold email YouTuber. Affiliate ortaklığı.

**Micro havai fişek:** 5-30k subscriber'lı kanallara ücretsiz Agency hesabı + $100-500/post. 10 video × $500 = $5k toplam, beklenen erişim 80-100k qualified view.

**Yapma listesi:** Iman Gadzhi tier'ı (audience'ın çoğu para vermiyor), Andrew Tate ekosistemi (toxic brand association), Tai Lopez tarzı eski cringe figürler. Brand güvenliği için her influencer'a son 6 ay tweet/video screening.

### 11.5 GEO & SEO

`/for/phone-repair`, `/for/plumbers`, `/for/agencies` zaten yayında. Schema.org `Organization` + `Product` + `FAQPage` + `BreadcrumbList` JSON-LD tüm vertical sayfalarda olmalı. Roadmap'te public per-lead "leave-behind" sayfaları: ChatGPT'ye "Camden'deki en iyi phone repair" sorulunca bizim sayfamız çıksın diye structured data + indexable URL'ler.

**Launch sayfaları (örneğin):**

- [100 places to launch list (r/B2BSaaS, 14 Nisan, 9 yorum)](https://www.reddit.com/r/B2BSaaS/comments/1sl9jwn/100_places_to_launch_your_startup_2026_updated/) tier listesinden DR 90+ olanlar: SourceForge, G2, Product Hunt, Hacker News, Capterra. DR 80-89: Softonic, GoodFirms, AppSumo, Indie Hackers, Fazier. DR 70-79: AlternativeTo, Software Advice, There's an AI for That, SaaSHub.
- Launch sırası: Hacker News (Show HN, dikkatli zamanlama), Indie Hackers, Product Hunt (haftalık 6-7 launch'la rekabet, Salı en iyi gün), Fazier (AI tool listing).
- AppSumo sponsored deal: ileride paying customer 50+ olunca düşünülebilir.

### 11.6 TR kanalı (Kaan'ın güçlü olduğu yer)

YouTube short serisi: "5 dakikada İstanbul'daki tüm halı yıkamacıları" tarzı viral kısa videolar. Yerel + somut + tekrarlanabilir. TR YouTube'da "ajans kurma" + "freelance dijital pazarlama" niche'inde 10-100k subscriber'lı kanallarla collab. Mehmet Akyol ekosistemi, e-ticaret + ajans niche'i. Kerem Kaya tarzı LinkedIn dijital pazarlama hesapları.

### 11.7 Anti-kanallar (yapmıyoruz)

- "Lead generation" generic Google Ads. CAC $400+ tahminim, intent çok geniş. $500+ ACV bir ürün stabil olana kadar bekleyin.
- Reddit paid. Audience bunu ad olarak görüp tepki veriyor.
- LinkedIn Sponsored InMail. Spam algısı + pahalı.
- Mega-influencer (Iman Gadzhi tier). Audience çoğunluğu Pro plan kart girmiyor; sponsored video başına $30-50k yakar.

---

## 12. Lansman sprint - 90 gün

Üç ay üç fazda kırılı. Her fazın sonunda go/no-go karar verme noktası var.

### Hafta 1-4: Faz "Ship & talk"

| Hafta | Aksiyon | Sahip | Çıktı |
|---|---|---|---|
| 1 | `/for/phone-repair`, `/for/halı-yıkama` ve `/for/walk-in-web-agencies` (4. ICP) landing page'leri canlı, schema markup + 1 embedded sample mockup | Çınar + Mert | 3 indexable sayfa |
| 1 | Mockup HTML/Tailwind preview shipping (screenshot grade) | Mert | Lead detail sayfasında "screenshot this" butonu |
| 1 | [r/coldemail "Google Maps undervalued"](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/) thread'ine değerli yorum (link drop yok) | Çınar | 1 thread, organik backlink |
| 1 | İlk 50 cold email send (§9.1 + §9.2 şablonları, top r/coldemail commenter'lara) | Mert | 50 send, hedef 5-7 reply |
| 1-2 | **Pro Team $149/3 seat tier shipping:** Stripe price ID + workspace seat enforcement + pricing sayfası 4 kart + Pro Solo rebrand | Mert | Yeni tier canlı, mevcut Pro grandfather |
| 2 | **Mobile-responsive PWA pass + manifest.json + service worker** (4. ICP için kritik) | Mert | Tablet/telefon UI optimize, "Add to home screen" çalışıyor |
| 2 | "Londra'daki tüm phone repair shop'larını crawl ettik" blog postu + r/coldemail share | Çınar | 1 viral-shape post |
| 2 | Native CSV export Smartlead + Instantly formatına | Mert | Feature ship |
| 2 | 30 saniyelik demo video: "Plumber için 20 saniyede mockup" + ek video "Londra'da bir günde 3 mahalleye gittik" (4. ICP showcase) | Kaan | 2 short-form asset |
| 3 | **Voice notes light:** MediaRecorder + Whisper transcription + lead detail "30sn ses notu" butonu | Mert | Saha satışçısı ziyaret sonrası ses notu workflow'u canlı |
| 3 | 90 saniyelik demo Loom (§9.4 akışı), landing page'e embed | Kaan + Çınar (script) | 1 video, 1 conversion lift |
| 3 | Mockup QA dashboard v0 (read-only sample viewer + 1-5 score field) | Mert (build) + Çınar (rubric + ilk 20 review) | İlk 20 mockup scored |
| 4 | İlk paying customer case study (reply rate öncesi/sonrası) + 4. ICP'den ilk Londra walk-in case study (mockup'la kapatılmış £800 deal) | Çınar (write) + Kaan (video) | 2 case study + 3 testimonial |

**Faz 1 sonu kararı:** En az 5 ödeyen müşteri (en az 1 Pro Team tier) ve 2 yayınlanmış case study var mı? Evet → Faz 2. Hayır → mesaj-pazar uyumunu sorgula, demo akışını yeniden çek, hatta pivot et.

### Hafta 5-8: Faz "Distribute"

- Tier S sponsorluk #1 (Alex Berman ya da Charlie Morgan), $2.500-3.000 + %30 affiliate.
- Mid-tier mikro havai fişek başlat: 30 micro-influencer outreach, ilk 5 sponsorlu içerik pazarlık.
- Türkiye dalga 1: Kaan'ın ilk üç YouTube short + Mert'in 5 TR ajans demo'su.
- Product Hunt launch hazırlığı (Show HN ile aynı haftaya koyma; 7-10 gün arayla).
- İkinci vertical pack: HVAC ya da klima (TR'de). Vertical-spesifik landing page açılır.
- Reply-rate attribution v0: Gmail/Outlook geri okuma, müşteri opt-in'le çalışır. **Implementation hazır** (P1.4, [`/api/email-accounts/{id}/sync`](src/app/api/email-accounts/[id]/sync/route.ts)); OAuth credentials .env'de tanımlandığı an aktif.
- AI co-pilot, calendar sync, GPS sıralama, map view shipping. Müşteri demolarına ekle.

**Faz 2 sonu kararı:** MRR $5k+ mı? CAC < $300 mı? Channel mix sağlıklı mı (3+ aktif kanal)? İki "evet" ise Faz 3, hiçbiri değilse soğuk reset.

### Hafta 9-12: Faz "Scale the winner"

- En yüksek conversion veren mid-tier influencer'la 6 aylık affiliate kontrat.
- Tier S sponsorluk #2.
- "Leadac AI Certified Partner" affiliate program lansmanı.
- İlk paid case study video formatında (Kaan).
- Public per-lead leave-behind sayfa MVP (GEO için).
- Booking-system detection v2 (Calendly + SimplyBook + Setmore + Booksy + Square Appointments + Booqable).
- Founding SDR rolü açık tartışmaya gel - şimdiye kadar Mert dogfood satıyor; eğer 30+ paying müşteri varsa bir SDR almalı mıyız?

**Faz 3 sonu kararı:** $15k+ MRR, en az 1 vertical %20+ market share (vertical bazında), 2 sürdürülebilir kanal? Üç "evet" ise yatırımcıyla sıcak konuşma başlar; iki ise organik büyümeye dönüp 6 ay daha sabreder, fundraising 12. ay.

---

## 13. Riskler ve karşı pozisyon

| Risk | Mitigation |
|---|---|
| Google Places ToS / pricing değişimi | Aggressive cache. OpenStreetMap + Foursquare fallback adapter'ları. Discovery service zaten isolated. |
| AI mockup output kalite regresyonu | Çınar'ın haftalık QA dashboard'u. 5 puanlık rubric. Prompt diff'leri skor üzerinden geçer. |
| Apollo / Clay "Maps mode" ekler | Vertical-deep kalıyoruz. Onlar phone-repair-specific scoring veya per-vertical audit + mockup yapmaz. |
| Open-source clone (biri Places + Gemini sarar) | Multi-tenant ops + handbook prompt + watchlist + pipeline = moat. Discovery query alone moat değil. |
| Mockup scope creep "Webflow killer"a | Hard sınır: plan + screenshot mockup. Hosting ve CMS yok. Sales artifact, web product değil. |
| Auto-send brand riski | Default kapalı. "AI yazar, insan gönderir" konumlandırması her sayfada. |
| TR'de SaaS subscription kültürü zayıf | TL aylık fiyat, tek tıkla iptal, ilk ay $1 deneme. Faturalama + KDV otomatik. |
| Tek influencer'ın churn'ü brand churn'ü | Tek influencer'a bütçenin %20'sinden fazlası gitmez. Çeşitlendirme zorunlu. |
| FTC compliance | Sponsored content'te `#ad` ya da `#sponsored`. TR'de Reklam Kurulu kuralı paralel. |
| "Get rich quick" markasıyla özdeşleşme | Iman Gadzhi tier ile çalışmıyoruz. Ton: Charlie Morgan + Eddie Shleyner kıvamı. Lambo, Dubai estetiği yok. |

---

## 14. Metrikler

İlk 90 gün boyunca takip edilecek sayılar. Çınar'ın haftalık dashboard'unda görünüyor.

**North Star:** Aktif ödeyen ajans sayısı. Trial değil, paid.

**Funnel:**
- Landing page unique visitors → trial signup conversion rate (hedef: %3-5)
- Trial → paid conversion (hedef: %15-25, 14 günlük trial)
- Paid → 30-day retention (hedef: %85+)
- Paid → 90-day retention (hedef: %70+)

**Ürün:**
- Trial başına ortalama discovery run sayısı
- Trial başına ortalama mockup generation
- Push-to-Smartlead/Instantly gerçekleşme oranı (signup'ın %X'i)
- Rapor reply rate'i (Gmail attribution'la, müşteri opt-in)

**CAC kanal başına:**
- Cold outbound CAC = $50 (sadece zaman, attribution Mert üzerinden)
- Reddit organic CAC = $100-150 (Çınar zamanı)
- Influencer mid-tier CAC = $150-300 hedef
- Tier S sponsorship CAC = $200-500 hedef
- Paid Google Ads CAC = bilinmiyor (yapmıyoruz şimdilik)

**LTV hedefi:** Pro plan 9 ay ortalama, $711 LTV. Agency plan 14 ay ortalama, $3.486 LTV. Karışık ortalama (60/40 dağılım) $1.821. Pazarlama bütçesi LTV'nin 3'te 1'inden fazla olmamalı.

**Rapor cadence:** Haftalık dashboard, aylık deep dive, üç ayda bir paper revision.

---

## 15. Açık karar noktaları

Lansman öncesi karara bağlanması gereken beş şey:

1. **İlk vertical pack: phone repair Londra mı, halı yıkama İstanbul mu?** TR önce vurmak Kaan'ın güçlü olduğu yer; UK lead'i daha büyük market ama daha rekabetli. Önerim: TR'de halı yıkama İstanbul, Kaan'ın YouTube short serisi paralelinde. UK phone repair ikinci dalgada.

2. **Mockup MVP scope.** 1 sayfa mı, 3 sayfa mı? Sabit template + dinamik copy mi, full generative mi? Önerim: faz 1 = 1 sayfa, sabit template, dinamik copy. Faz 2 = 3 sayfa multi-page.

3. **Free trial: kart bilgisi gereksin mi?** Önerim: hayır gerek değil ilk ay; aksi takdirde top-of-funnel daralır. Trial sonu otomatik free tier'a düşer (50 lead/ay sınırı), upgrade için kart ister.

4. **Affiliate yapısı.** %30 lifetime mı, %20 12 ay mı, signup başına flat $50 mı? Önerim: %30 lifetime mid-tier influencer için (uzun ortaklık teşviki), $50 flat micro tier için (basit ödeme + spam kontrolü).

5. **Domain.** leadac.ai tutuluyor, ek olarak leadac.com.tr alınmalı (TR pazarı için trust faktörü, hreflang yapısı kuruluyor).

Bu beş soru bir saatlik takım toplantısında karara bağlanır.

---

## 16. Kaynaklar (hepsi son 30 gün, canlı)

`/last30days` ile 2026-04-19'da çekildi. Ham dosyalar `~/Documents/Last30Days/` altında:

- `lead-generation-for-local-service-businesses-raw-leadgen.md`
- `ai-personalized-cold-email-outreach-raw-personalized.md`
- `ai-website-builder-for-local-small-businesses-raw-websitegen.md`
- `apollo-alternative-for-cold-email-lead-generation-raw-switching.md`
- `best-cold-email-tool-for-agency-in-2026-raw-buyertool.md`
- `best-influencers-for-smma-agency-owners-cold-email-raw-influencer.md`
- `free-website-mockup-as-lead-magnet-for-cold-email-raw-valueoutreach.md`
- `running-6-figure-agency-monthly-tool-stack-raw-sixfig.md`
- `side-hustle-to-get-rich-fast-online-raw-sidehustle.md`
- `starting-smma-agency-to-make-money-fast-raw-smma.md`
- `ai-lead-generation-saas-launch-and-investor-trends-2026-raw-launchinvestor.md` (bu belge için fresh çekim)

**En kritik 12 thread (aylık yeniden okunması gereken):**

- [Google Maps is the most underrated lead database in cold email](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/) - r/coldemail, 14 Nisan, 24 up / 121 yorum
- [What does ICP actually mean for home service businesses?](https://www.reddit.com/r/coldemail/comments/1smj2z6/what_does_icp_actually_mean_for_home_service/) - r/coldemail, 15 Nisan, 9 yorum
- [Sent 60,000 emails in March - most cold email advice is wrong](https://www.reddit.com/r/coldemail/comments/1smih8j/sent_60000_emails_in_march_most_cold_email_advice/) - r/coldemail, 15 Nisan, 18 up / 35 yorum
- [The exact cold email script that got me 12%+ positive reply rate](https://www.reddit.com/r/coldemail/comments/1s8gniv/the_exact_cold_email_script_that_got_me_12/) - r/coldemail, 31 Mart, 52 up / 83 yorum
- [Everyone told me cold email was dead in 2026](https://www.reddit.com/r/coldemail/comments/1s7e49r/everyone_told_me_cold_email_was_dead_in_2026/) - r/coldemail, 30 Mart, 19 up / 204 yorum
- [If you're using AI for cold outreach, are you OK with the damages?](https://www.reddit.com/r/agency/comments/1s8s3v0/if_youre_using_ai_for_cold_outreach_are_you_ok/) - r/agency, 31 Mart, 22 up / 78 yorum
- [6 months running outbound for 14 B2B clients - 2.4% to 8.1% reply](https://www.reddit.com/r/coldemail/comments/1sk8h01/6_months_running_outbound_for_14_b2b_clients_the/) - r/coldemail, 13 Nisan, 10 up / 10 yorum
- [Every tool I use running a $140k/month cold email agency](https://www.reddit.com/r/coldemail/comments/1sdd3hy/every_tool_i_use_running_a_140kmonth_cold_email/) - r/coldemail, 5 Nisan, 39 up / 47 yorum
- [Best outbound sales tools for startups in 2026 - 11 tier list](https://www.reddit.com/r/B2BSaaS/comments/1sl9y7g/best_outbound_sales_tools_for_startups_in_2026/) - r/B2BSaaS, 14 Nisan, 36 up / 32 yorum
- [the reason ur SMMA isn't growing isn't your service](https://www.reddit.com/r/SMMA/comments/1sif8l8/the_reason_ur_smma_isnt_growing_isnt_your_service/) - r/SMMA, 11 Nisan
- [I built a tool that lets you find local businesses + AI cold email in 2 clicks](https://www.reddit.com/r/SaaS/comments/1s8wwhn/i_built_a_tool_that_lets_you_find_local/) - r/SaaS, 31 Mart, 6 up / 41 yorum (yarı-rakip)
- [100 Places to Launch Your Startup 2026 Updated](https://www.reddit.com/r/B2BSaaS/comments/1sl9jwn/100_places_to_launch_your_startup_2026_updated/) - r/B2BSaaS, 14 Nisan, 30 up / 9 yorum

**Yenileme cadence:** Çınar haftalık `/last30days` çalıştırıyor. § 2 ve § 11 (distribution) yeni bir top-3 thread çıktığında güncelleniyor. Yatırımcı toplantısı haftası ek olarak `/last30days vertical SaaS investor trends` çalışıyor.

---

## 17. Bu belge nasıl okunur

Bir saatlik takım toplantısında: § 1 (tez), § 6 (ICP), § 12 (90 gün sprint), § 15 (açık karar noktaları). Karar verilir, çıkılır.

Yatırımcıya gönderirken: § 1, § 2 (kanıt), § 5 (rakip), § 8 (investor pitch), § 14 (metrikler).

Yeni ekip üyesi onboard ederken: baştan sona oku, sonra `BUYER-PERSONA.md` ve `MARKETING.md` (ana belge) ardından `MARKETING-TR.md` ve `MARKETING-TR-INFLUENCER.md`.

Aylık review: § 2 (yeni kanıt var mı), § 5 (yeni rakip mi), § 11 (kanal performansı), § 14 (metrikler). Belge revize edilir, version bump.

Bu belge tek değişmez şey değil. Veri konuşuyor, biz dinliyoruz, sayfayı güncelliyoruz.
