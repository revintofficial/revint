# Revint x FineDine pivot project paper

> Status: Master project paper
> Date: 2026-05-29
> Language: Turkish
> Audience: Revint founder team, product, engineering, marketing, sales, FineDine activation stakeholders
> Project name: **Revint Restaurant-Tech Intelligence Pilot for FineDine**

---

## 1. Yonetici ozeti

Revint'in yeni yonu netlesmistir: urun artik sadece local lead generation veya enrichment araci olarak konumlanmamalidir. Bu katman piyasada hizla kalabaliklasmistir. Orbital, Resquared, Openmart, Clay workflow'lari ve benzeri araclar local business discovery, owner/contact enrichment, Google Maps extraction, review scraping, basic scoring ve outreach workflow alanlarini sahiplenmeye baslamistir.

Revint'in kazanabilecegi alan bu veriyi uretmekten cok, verinin ustunde karar veren katmandir:

> Revint, restaurant-tech ve local-business marketlerine satis yapan ekipler icin post-enrichment operational intelligence layer'dir.

Bu su anlama gelir:

- Openmart, Orbital, Resquared, Clay, HubSpot, Smartlead, Instantly, Google Places ve Apify gibi kaynaklar veri uretir.
- Revint bu kaynaklardan gelen veriyi birlestirir, catisan sinyalleri cozer, hangi account'in aksiyon almaya deger oldugunu belirler.
- Sistem her outreach, reply, bounce, meeting, no-show, closed-won ve closed-lost sonucundan ogrenir.
- Bu ogrenim FineDine gibi restaurant-tech sirketleri icin vertical playbook'a donusur.

Ilk beachhead FineDine olmalidir. FineDine QR menu, digital menu, online ordering, reservation, payment, guest CRM, marketing automation ve restaurant website alanlarinda faaliyet gosteren restaurant-tech sirketidir. FineDine'in satis problemi Revint'in yeni vizyonunu test etmek icin idealdir: binlerce restoran arasindan hangisinin gercekten FineDine'e ihtiyaci oldugunu anlamak, dogru pitch acisini secmek, chain ile independent restoranlari ayirmak, her sonucdan ogrenmek ve BD ekibinin tekrar tekrar ayni arastirmayi yapmasini engellemek.

Bu dokumanin karari:

1. Revint'in kategori dili **Operational Revenue Intelligence for SMB Markets** olarak korunur, ancak FineDine pilotunda daha somut ifade kullanilir: **Restaurant-Tech Operational Intelligence**.
2. MVP bir lead listesi degil, FineDine icin native entegrasyonlu account intelligence ve closed-loop learning pilotudur.
3. MVP'nin amaci revenue automation degil, FineDine'in restaurant outbound motion'inda karar kalitesini, rep hizini ve ogrenme dongusunu kanitlamaktir.
4. Ilk 30 gunluk pilot, FineDine ile design partner olarak yurur ve sonraki restaurant-tech ICP'sinin kanit zemini olur.

---

## 2. Pivot gerekcesi

### 2.1 Eski positioning neden zayifladi?

Revint'in onceki positioning'i local lead generation, enrichment, audit ve opener hazirlama uzerine kuruluydu. Bu dil pazarin ilk boslugunu iyi yakaladi: Apollo ve ZoomInfo local SMB'lerde zayifti; agency ve restaurant-tech ekipleri Google Maps, websites, reviews ve sosyal hesaplari manuel kontrol etmek zorundaydi.

Ancak 2025-2026 arasinda bu katman kalabaliklasti:

- Openmart local business data/API, owner finding, Google Maps scraping ve CRM enrichment diliyle local data rail olmaya calisiyor.
- Resquared local business selling workflow'u uzerinden satis ekiplerine data ve outreach kolayligi sunuyor.
- Orbital sadece enrichment degil, "SMB Account Intelligence for Sales Teams" dilini kullaniyor.
- Clay, GTM engineer kitlesi icin enrichment, waterfall, AI research ve workflow platformu haline geldi.
- Apify/n8n/Google Maps scraper kombinasyonlari raw local listeleri ucuzlatiyor.

Bu yuzden "biz local lead buluyoruz" artik yeterince savunulabilir bir stratejik alan degildir. Bu alan veri maliyeti, coverage claim'i ve provider yarisi haline gelir. Revint'in gercek farki, local SMB verisini satis kararina ve ekip hafizasina cevirmekte olmalidir.

### 2.2 Yeni tez

Yeni tez:

> Piyasada daha fazla local data eksigi kalmiyor. Yeni eksik, bu datanin ne anlama geldigini bilen ve her outcome'dan ogrenerek sonraki aksiyonu daha iyi secen operational intelligence layer'dir.

Bu, Revint'i su noktalarda farklilastirir:

- Revint veri kaynagi olmak zorunda degil; veri kaynaklarinin ustundeki karar sistemi olabilir.
- Revint tek seferlik audit raporu degil; surekli ogrenebilen sales intelligence sistemi olabilir.
- Revint generic AI SDR degil; vertical-specific operational playbook engine olabilir.
- Revint'in moat'i proprietary data degil, proprietary outcome graph olabilir.

### 2.3 AI-native Revint vizyonu

Revint'i AI-native yapmak, urune daha fazla AI feature eklemek degildir. Sistemin calisma mantigini intelligence-first hale getirmektir.

Bugunku Revint ileri seviye AI-assisted outbound platformudur: kullanici bir aksiyon alir, belirli worker'lar calisir, audit/scoring/dossier/opener uretilir. AI arac gibi davranir.

AI-native evrimde sistem operasyonu yoneten bir varlik gibi davranir:

> Kullanici "Londra'daki premium sushi restoranlarindan bu ay 15 demo cikar" hedefini verir. Sistem ICP'yi parcalar, hangi sub-niche'in sicak oldugunu analiz eder, gecmiste hangi outreach angle'larinin cevap aldigini hatirlar, hangi enrichment worker'larinin calismasi gerektigine karar verir, outreach'i optimize eder ve basarisiz pattern'leri birakir.

Bu vizyonun dort temel parcasi vardir:

1. **Dynamic planning:** Static chain yerine objective-driven runtime planlama. Sistem lead_created -> audit -> scorer gibi sabit akisi degil, hedefe gore execution DAG'i kurar.
2. **Tool graph:** Worker registry, LLM/planner tarafindan cagirilabilir arac grafigine donusur. Ornek tool'lar: `search_reviews`, `deep_research`, `score_opportunity`, `find_lookalikes`, `build_sequence`, `sync_outcome`.
3. **Behavioral learning:** Semantic memory sadece retrieval katmani degil, outcome-driven ogrenme katmani olur. Hangi opener reply aldi, hangi tone spam gibi algilandi, hangi sub-niche hangi pain'e cevap verdi sistem tarafindan ogrenilir.
4. **Niche ontology:** Sistem F&B ekonomisini bilir. Fine dining, cafe, bakery, ghost kitchen, bar, hotel restaurant, QSR ve chain farkli davranir. Reservation flow, table turnover, no-show, brunch economics, delivery dependency, local SEO, review psychology, booking provider friction ve Instagram influence structured bilgi haline gelir.

Uzun vadede Revint'in esas moati sudur:

> Market knowledge + historical outcomes + sales psychology + retrieval memory + tool graph + vertical ontology.

---

## 3. Piyasa ve restaurant-tech market analizi

### 3.1 Restaurant-tech pazari neden uygun beachhead?

Restaurant-tech, local SMB satisinin en guclu orneklerinden biridir. Restoranlar yogun, lokasyon bazli, operasyonel olarak karmasik ve dijital donusum ihtiyaci surekli olan isletmelerdir. Ancak satis motion'u klasik SaaS satisindan farklidir.

Toast CRO anlatiminda restoran satisinin ozellikleri net gorulur:

- Toast'un satis modeli buyuk olcude field-based ilerler.
- Territory segmentation revenue potential yerine restaurant density uzerinden kurgulanir.
- On-site visit alan prospect'lerde conversion daha yuksektir.
- Social proof ve referral cok gucludur.
- Bir bolgede yeterli density olusunca flywheel baslar.

Bu, Revint icin kritik bir insight'tir: restaurant-tech satisinda account intelligence sadece "bu restoranin email'i nedir?" sorusu degildir. Asil soru sudur:

- Bu restoran hangi operasyonel sinyallerle FineDine'e uygun?
- Bu bolgede density var mi?
- Bu restoran chain mi, independent mi, group mu?
- QR menu mu, ordering mi, reservation mi, payment mi, loyalty mi, guest CRM mi daha guclu pitch?
- Hangi restoranlara once gidilmeli?
- Hangi mesaj field visit veya demo acma ihtimalini artirir?

### 3.2 QR menu pazari nasil degisti?

QR menu artik tek basina yeterli bir positioning degildir. COVID sonrasi QR menu kullanimi yayginlasti, fakat 2026 itibariyle pazar "menu linki"nden daha genis digital stack'e kaymistir:

- QR menu
- Digital menu
- Online ordering
- Table-side ordering
- Payments
- Reservations
- Loyalty
- Guest CRM
- Automated marketing
- Restaurant website
- Multi-location content/menu management
- POS ve delivery entegrasyonlari

FineDine'in resmi positioning'i de bunu destekler: platform QR menus, AI, websites, automated marketing, quick payments ve reservations gibi daha genis bir all-in-one restaurant platformu olarak sunulur. FineDine Help Center tarafinda da menu linki, QR code, tablet menu, delivery/pickup ordering ve plan yapisi anlatilir.

Revint bu nedenle FineDine icin sadece "QR menu olmayan restoranlari bulma" araci olmamalidir. Daha dogru vaad:

> FineDine'in hangi restorana hangi digital stack angle'iyle gitmesi gerektigini belirleyen operational intelligence sistemi.

### 3.3 Restaurant operator gercegi

Restoran sahipleri ve yoneticileri feature listesiyle satin almaz. Cogu zaman su konulara tepki verir:

- Masa donus hizi
- No-show ve rezervasyon kaybi
- Menu guncelleme maliyeti
- Komisyon ve delivery dependency
- Yogun saatlerde servis yavasligi
- Staff shortage
- Review rating ve sikayet pattern'leri
- Instagram ve local discovery etkisi
- Sadakat ve repeat visit
- Multi-location operasyon kontrolu

Bu nedenle Revint'in FineDine icin uretecegi account intelligence brief su soruya cevap vermelidir:

> Bu restoranin bugunku operasyonel goruntusune gore FineDine hangi sonucu satar?

Ornekler:

- Fine dining: reservation quality, no-show reduction, premium menu presentation, guest data.
- Cafe/bakery: mobile menu quality, local discovery, order-ahead, loyalty stamps, queue management.
- Ghost kitchen: delivery conversion, menu optimization, commission reduction.
- Bar/nightlife: late-night traffic, event menus, mobile payment, group ordering.
- Chain/multi-location: centralized menu control, location-level analytics, loyalty, brand consistency.

---

## 4. Tool ve rakip arastirmasi

### 4.1 Market layer haritasi

Pazar bes katmana ayriliyor:

| Katman | Ornekler | Ne yapiyor? | Revint'in yorumu |
|---|---|---|---|
| Local SMB data rails | Openmart, Resquared, Google Maps scrapers, Apify | Local business kaydi, owner, website, review, category, location, contact | Bu katman veri uretir; Revint bunun ustunde karar verir. |
| SMB account intelligence | Orbital | SMB TAM mapping, enrichment, vertical signals, outbound/inbound activation | Orbital en yakin positioning tehdidi; "SMB account intelligence" diliyle carpismamak gerekir. |
| Enrichment/workflow workbench | Clay | Data waterfall, AI research, CRM sync, workflow builder | Clay teknik ekipler icin lego setidir; Revint packaged vertical intelligence olmalidir. |
| Buyer/signal intelligence | Pocus, Common Room | Sinyal toplama, scoring, plays, buyer context | Sinyal -> aksiyon trendini dogrular; ancak local-business derinligi yoktur. |
| Revenue learning loop / agents | HockeyStack | Revenue data, journey, blueprint, agents | Enterprise tarafta learning-loop tezini dogrular; Revint bunun SMB/local versiyonudur. |

### 4.2 Tool-by-tool degerlendirme

| Tool | Kategori claim'i | Funding/backing/traction | Sahiplendigi alan | Revint icin tehdit | Revint icin firsat |
|---|---|---|---|---|---|
| Orbital | SMB Account Intelligence for Sales Teams | Funding miktari net public degil; olgun GTM dili, CRM/GTM tooling ve GTM Engineer onboarding anlatimi var | SMB TAM mapping, 200+ SMB attribute, contacts beyond LinkedIn, inbound routing, outbound activation, vertical-specific signals | En yakin positioning tehdidi. "SMB account intelligence" dili Orbital'e cok yakin. | Orbital upstream data/intelligence kaynagi gibi konumlanir; Revint post-enrichment judgement, source conflict, playbook memory ve next-best-action katmani olur. |
| Resquared | Platform for selling to local businesses | YC W21; VentureBeat tarafinda $5M seed olarak raporlandi | Local business data, outreach workflow, CRM/social flows | Agency/local outbound use case'ini sahiplenir | Resquared kaynakli account'larda hangi sinyallerin convert ettigini Revint ogrenir. |
| Openmart | Local business data intelligence/API | YC W24; public profillerde seed backing gorunuyor, detayli funding rakamlari kaynaga gore degisebilir | 200M+ local business claim, owner contacts, tech stack, Google Maps scraping, API, Clay integration | Raw local data ve owner finding commodity hale gelir | En guclu integration/data rail adaylarindan biri. Revint Openmart account'larini aksiyona cevirir. |
| Clay | GTM enrichment/workflow platform | GTM engineering kategorisinin en bilinen platformlarindan | Enrichment waterfall, 75+ provider, AI scraping/research, CRM sync | Teknik ekipler Revint'in basit versiyonunu Clay'de kurabilir | Revint, Clay workflow'larinin ustune vertical playbook ve learning loop koyar. |
| Pocus | Product-led sales / signals | 2022'de $23M funding duyurdu | Product usage signals, explainable scoring, plays | "signals to revenue" mental modelini PLG tarafinda sahiplenir | Revint product-usage-first degil, local-business-context-first olur. |
| Common Room | AI-native GTM / buyer intelligence | $52M total funding ile launch; Series B haberleri var | Buyer intelligence, identity resolution, signal aggregation, AI agents | Broad platform olarak vertical SMB'ye inebilir | Revint daha dar, restoran/local operational context ile ayrisir. |
| HockeyStack | Revenue Agents for the Enterprise | $20M Series A, Bessemer liderliginde | Revenue attribution, buyer journeys, Blueprint, Odin/Nova agents | Enterprise learning-loop beklentisini yukari tasir | Revint "HockeyStack-style learning loop, restaurant-tech ve SMB GTM icin hafif versiyon" olarak anlatilabilir. |
| Sixtyfour | Intelligence infrastructure on people/entities | YC-backed; 2025 spring batch duyurusu var | Deep research agents, people/company intelligence, entity resolution | Research/enrichment infrastructure olarak API katmanina inebilir | Potansiyel upstream research provider; Revint applied revenue action'i sahiplenir. |

### 4.3 Strategic conclusion

Bu pazar arastirmasi su sonucu verir:

- Revint data vendor olmamali.
- Revint "SMB account intelligence" kategorisini genis sekilde sahiplenmemeli; Orbital ile carpismaya cok yakin.
- Revint "post-enrichment operational intelligence" olarak konumlanmali.
- FineDine pilotu, bu farki gostermek icin somut ve guclu bir ornektir.

Kisa ic ifade:

> Openmart ve Orbital marketi bulur. Clay row'lari enrich eder. HubSpot pipeline'i tutar. Smartlead ve Instantly mesajlari gonderir. Revint neyin ise yaradigini ogrenir ve siradaki dogru aksiyonu soyler.

---

## 5. ICP arastirmasi

### 5.1 Primary ICP

Ilk ICP:

> Restaurant-tech sirketleri: restoranlara QR menu, digital menu, ordering, reservation, payments, loyalty, guest CRM, restaurant website, marketing automation veya POS-adjacent digital stack satan B2B SaaS ekipleri.

Bu ICP'nin ozellikleri:

| Alan | Ideal profil |
|---|---|
| Sirket tipi | Restaurant-tech / F&B SaaS / hospitality tech |
| Urun | QR menu, online ordering, reservation, payments, loyalty, guest CRM, marketing automation, restaurant website |
| Sirket buyuklugu | 15-300 calisan |
| GTM ekip buyuklugu | 2-30 BD/sales/market expansion user |
| CRM | HubSpot, Pipedrive veya Salesforce light |
| Sender | Smartlead, Instantly, Apollo sequencing, Gmail/Outlook manual |
| Veri kaynaklari | Google Maps, Apollo, Clay, spreadsheets, Openmart, local directories, manual research |
| Satis motion | Outbound + field visit + demo + referral |
| Ana aci | Dogru restoranlari bulmak, arastirmayi hizlandirmak, pitch'i operasyonel baglama gore secmek, rep bilgisini sistemde tutmak |

### 5.2 FineDine-first persona

#### Persona 1: FineDine BD / SDR / market expansion rep

Gunluk is:

- Yeni bolge veya sub-niche listesi cikarir.
- Google Maps, Instagram, website, reviews, menu, reservation ve ordering akisini kontrol eder.
- Hangi restorana hangi angle ile gidilecegini anlamaya calisir.
- HubSpot'a not girer.
- Cold email, LinkedIn, WhatsApp, call veya field visit ile aksiyon alir.

Sorunlar:

- Arastirma satisin onune gecer.
- Restaurant tech stack manuel kontrol edilir.
- Chain ve independent restoranlar ayni gibi islenir.
- QR menu eksikligi her restoran icin dogru pain degildir.
- Hangi opener'in reply aldigi sistemde ogrenilmez.
- FineDine'in en iyi rep'inin bilgisi yazilima donusmez.

Basari kriterleri:

- Daha az research time.
- Daha dogru account prioritization.
- Daha yuksek reply/demo rate.
- Daha dogru package/offer mapping.
- HubSpot'ta daha iyi account context.
- New rep ramp suresinde azalma.

#### Persona 2: FineDine sales leadership

Sorulari:

- Hangi markete once girmeliyiz?
- Londra'da hangi restaurant segmenti FineDine icin en sicak?
- BD rep'leri neden farkli quality'de account seciyor?
- Hangi pitch acisi demo getiriyor?
- Chain hesaplarda enterprise pitch'i ne zaman dogru?
- Kazandigimiz ve kaybettigimiz deal'lerden ne ogrendik?

Revint'in cevabi:

- Segment ve geography bazli account intelligence.
- Outcome'a dayali playbook.
- Rep-ready account brief.
- HubSpot outcome sync.
- FineDine-specific learning layer.

#### Persona 3: FineDine product/strategy team

Sorulari:

- Restoranlar hangi digital module'lere gercekten ihtiyac duyuyor?
- QR menu tek basina mi satiliyor, yoksa ordering/reservation/payment/CRM bundle mi daha guclu?
- Chain restoranlarin istekleri independent restoranlardan nasil ayriliyor?
- Market expansion icin hangi vertical insights product roadmap'e girmeli?

Revint'in cevabi:

- Field sales ve outbound outcome'larindan product insight.
- Restaurant sub-niche ontology.
- Pain -> module mapping.
- Market-level signal dashboard.

### 5.3 Secondary ICP

FineDine pilotundan sonra ayni motion su sirketlere genisleyebilir:

- Toast benzeri POS/restaurant platformlari.
- Square for Restaurants benzeri payment/POS platformlari.
- OpenTable/SevenRooms benzeri reservation ve guest experience platformlari.
- Restaurant loyalty ve marketing automation platformlari.
- Delivery/ordering altyapisi satan SaaS'ler.
- Hospitality ve hotel F&B teknolojileri.

### 5.4 Disqualifiers

Bu MVP icin yanlis musteri:

- Sadece ucuz lead listesi isteyen ekip.
- Outcome tracking yapmayan ekip.
- CRM veya sender event'lerini paylasmak istemeyen ekip.
- Restaurant vertical'inda repeatable motion'u olmayan ekip.
- "AI bizim yerimize tum satisi yapsin" beklentisinde olan ekip.
- FineDine gibi design partner calismasina feedback ayiramayan ekip.

---

## 6. FineDine design partner degerlendirmesi

### 6.1 FineDine bu proje icin neden dogru partner?

FineDine, Revint'in yeni pivotunu test etmek icin iyi design partner'dir:

- Restaurant-tech pazarinda gercek vertical context vardir.
- QR menu ile baslar ama ordering, reservation, payment, website, marketing ve guest CRM gibi genis digital stack'e uzanir.
- Local business buyer'a satar.
- BD ekibinin account research problemi somuttur.
- Mevcut FineDine beta cohort'u vardir.
- Camden/North London testlerinde gercek lead, review, audit, opener ve package mapping feedback'i alinmistir.

### 6.2 FineDine icin proje ne ise yarar?

FineDine icin Revint pilotu su anlama gelir:

> FineDine'in restaurant outbound motion'unu daha hizli, daha dogru ve ogrenebilen hale getiren intelligence pilotu.

Somut faydalar:

- Daha hizli market expansion.
- Daha dogru restoran prioritization.
- Chain vs independent ayrimi.
- QR menu pitch'i yerine restaurant-specific digital stack pitch'i.
- HubSpot icinde zengin account context.
- BD rep ramp suresinin azalmasi.
- Basarili opener ve angle'larin sistemde kalmasi.
- Hangi sub-niche ve geography'nin daha iyi tepki verdigini gorme.
- FineDine product/strategy ekibine market insight saglama.

### 6.3 FineDine Revint'e ne kazandirir?

FineDine, Revint icin sadece beta kullanicisi degil, category proof'tur:

- Restaurant-tech ICP'si icin gercek veri.
- Outcome-based learning loop icin ilk closed-loop dataset.
- FineDine-specific vertical ontology.
- Product roadmap icin net bug ve quality feedback'i.
- Satilabilir case study zemini.
- "Built with FineDine" anlatimi.

### 6.4 FineDine beta'dan ogrenilenler

Mevcut FineDine Round 2 Camden audit'i su dersleri verdi:

- Sistem dogru deger uretebiliyor: Google Maps/Apify enrichment, review analysis, chain detection, package mapping ve opener kalitesi bazi lead'lerde guclu calisti.
- Ancak tek seferlik audit yetmiyor: stale audit, social-only URL, expired website ve embedding/403 hatalari rep guvenini dusuruyor.
- Chain restoranlar farkli ele alinmali: Black Sheep ve Blank Street gibi chain'lerde location-level QR pitch'i yanlis olabilir; group-level analytics, central menu control ve loyalty daha dogru olabilir.
- Review intelligence grounded olmali: small sample, hallucinated snippets ve non-English leakage karar kalitesini bozar.
- UI/brief catisan sinyalleri cozmeli: reason code, package, tier ve conversion feature alanlari tek bir karar katmaninda toplanmali.
- Feedback API kritik: tester'in duzelttigi opener'lar semantic memory'ye girmezse sistem ogrenmez.

Bu pilotun ana amaci bu dersleri urunlesmis closed-loop sisteme cevirmektir.

---

## 7. Urun vizyonu

### 7.1 Revint ne olacak?

Revint'in hedef hali:

> Objective-driven outbound operating system for local-business GTM teams.

FineDine baglaminda:

> FineDine'in hangi restoranlara, hangi digital stack angle'iyle, hangi sirada, hangi kanaldan gitmesi gerektigini ogrenerek soyleyen restaurant-tech intelligence sistemi.

### 7.2 Core objects

MVP'de sistemin temel objeleri:

| Object | Anlam |
|---|---|
| Account | Restoran veya restoran grubu |
| Location | Tekil sube/lokasyon |
| Contact | Owner, GM, marketing manager, operations contact |
| Signal | Review, website, menu, booking, ordering, payment, social, location, chain, density, tech stack |
| Brief | Rep-ready account intelligence brief |
| Action | Call, email, field visit, enrich, suppress, sequence, demo prep |
| Outcome | Reply, bounce, unsubscribe, booked, no-show, opportunity, closed-won, closed-lost |
| Playbook | FineDine ve sub-niche bazli ogrenilmis pattern |

### 7.3 Account intelligence brief

Lead dossier terimi agency tarafinda kalabilir. FineDine/restaurant-tech icin ana artifact:

> Account Intelligence Brief

Brief icermeli:

- Account overview
- Location/chain context
- Sub-niche classification
- FineDine fit summary
- Detected digital stack
- Missing or weak modules
- Review-derived operational pain
- Website/social/menu/reservation/ordering findings
- Confidence and source provenance
- Recommended next action
- Suggested pitch angle
- Suggested FineDine module/package
- Risk flags
- HubSpot sync status
- Last outcome and learning note

### 7.4 Playbook graph

FineDine icin playbook graph ornekleri:

- `no_booking_provider + high_review_count + fine_dining -> reservation optimization angle`
- `qr_pdf_menu + premium_branding + high_instagram_activity -> branded digital menu angle`
- `chain_detected + multiple_locations -> central menu governance + analytics angle`
- `low_rating + service_wait_mentions + cafe -> order-ahead + queue reduction angle`
- `delivery_dependency + ghost_kitchen -> direct ordering + commission reduction angle`

Bu kurallar hardcoded master prompt olmamali. Ilk MVP'de seed rule olarak baslar; outcome geldikce memory tarafindan agirliklandirilir.

---

## 8. PRINCE2 MVP project brief

### 8.1 Project mandate

Revint, FineDine ile restaurant-tech vertical'inda native entegrasyonlu bir operational intelligence pilotu baslatir. Pilotun amaci FineDine'in restaurant account selection, outreach prioritization, pitch angle selection ve sales learning loop sureclerini iyilestirmektir.

### 8.2 Business case

#### Problem

FineDine ve benzeri restaurant-tech ekipleri binlerce restorana satis yapar, ancak mevcut GTM stack account context'i anlamaz:

- CRM deal durumunu bilir ama restoranin operasyonel ihtiyacini bilmez.
- Sender reply/bounce bilgisini bilir ama hangi signalin reply yarattigini bilmez.
- Enrichment tools data verir ama hangi field'in onemli oldugunu soylemez.
- Rep'ler pattern'leri kendi kafasinda ogrenir; sistem ogrenmez.

#### Opportunity

Revint, FineDine icin restaurant-specific operational intelligence layer olarak calisir:

- Daha az manuel research.
- Daha iyi account prioritization.
- Daha dogru pitch.
- Daha hizli rep ramp.
- Outcome-based playbook.
- HubSpot icinde daha guclu account context.

#### Expected return

Pilotun basarisi uc sekilde olculur:

1. BD verimliligi: rep basina arastirma suresi azalir.
2. Pipeline quality: shortlisted account -> demo conversion artar.
3. Learning quality: her outcome sonraki account scoring ve pitch secimini etkiler.

### 8.3 Project product description

Urun:

**Revint Restaurant-Tech Intelligence Pilot for FineDine**

MVP ciktisi:

- Native entegrasyonlarla veri alan bir restaurant account intelligence sistemi.
- FineDine ICP ve offer context'iyle calisan account brief generator.
- HubSpot ve sender outcome'larini behavioral memory'ye yazan closed-loop learning layer.
- FineDine ekibinin kullanabilecegi activation workflow ve demo-ready project artifact.

### 8.4 Benefits management approach

| Benefit | Measurement | Owner | Review timing |
|---|---|---|---|
| Research time azalmasi | Rep basina account research dakika | FineDine BD lead + Revint PM | Day 15, Day 30 |
| Account prioritization kalitesi | FineDine tarafindan "actionable" isaretlenen account orani | FineDine sales lead | Weekly |
| Outreach outcome ogrenimi | Reply/booked/no-show/closed outcome'larin playbook'a yazilma orani | Revint product | Weekly |
| Chain vs independent ayrimi | Yanlis pitch flag sayisi | FineDine reviewer + Revint QA | Weekly |
| HubSpot context degeri | HubSpot'ta sync edilen account field ve rep usage | Revint engineering | Day 30 |
| Pilot case study readiness | FineDine'in public veya anonymized referans izni | Founder | Day 30-45 |

### 8.5 Quality criteria

MVP kabul edilebilir kalite icin:

- Her brief source provenance gostermeli.
- Her recommendation confidence ve reason icermeli.
- Chain accounts independent restaurant gibi pitch edilmemeli.
- Social-only, expired, parked, blocked websites acik flag'lenmeli.
- Review-derived pain'ler corpus'a grounded olmali.
- Non-English review leakage FineDine UK/EN ICP'sinde filtrelenmeli veya isaretlenmeli.
- HubSpot outcome sync hatalari sessizce yutulmamali.
- Smartlead/Instantly eventleri account identity ile eslesmeli.

### 8.6 Product breakdown structure

1. Integration layer
   - HubSpot connector
   - Smartlead connector
   - Instantly connector
   - Clay webhook/input-output connector
   - Openmart connector/import
   - Orbital connector/import
   - Resquared connector/import
   - Google Places + Apify enrichment

2. Intelligence layer
   - Account entity resolution
   - Restaurant sub-niche ontology
   - Signal extraction and confidence
   - Source conflict resolution
   - FineDine fit scoring
   - Next-best-action recommendation

3. Learning layer
   - Outcome ingestion
   - Behavioral memory
   - Playbook graph
   - FineDine feedback capture

4. User-facing layer
   - Account intelligence brief
   - Pilot dashboard
   - HubSpot sync summary
   - Activation meeting materials

### 8.7 Stage plan

| Stage | Duration | Output | Decision gate |
|---|---|---|---|
| Stage 0: Alignment | 3-5 days | FineDine data access, ICP, offer mapping, pilot scope signed | FineDine confirms design partner scope |
| Stage 1: Data and integration setup | 1-2 weeks | HubSpot + sender + data source connections | 50-100 accounts ingested with source provenance |
| Stage 2: Intelligence brief MVP | 1-2 weeks | FineDine account brief, scoring, next action, pitch angle | FineDine reviews 30 briefs and marks quality |
| Stage 3: Closed-loop learning | 2 weeks | Outcome sync, feedback capture, playbook updates | First campaign outcomes affect scoring/pitch |
| Stage 4: Pilot review | 1 week | Benefits report, case study decision, scale/no-scale recommendation | FineDine and Revint decide next market/vertical |

### 8.8 Work packages

| Work package | Description | Owner |
|---|---|---|
| WP1 FineDine ICP and offer mapping | FineDine packages, modules, target restaurant types, geography and disqualifiers | Founder + FineDine lead |
| WP2 Native integration setup | HubSpot, Smartlead/Instantly, Clay/Openmart/Orbital/Resquared where available, Google Places/Apify | Engineering |
| WP3 Restaurant ontology | Sub-niche, chain detection, module mapping, pain taxonomy | Product + AI |
| WP4 Account brief | Brief structure, source provenance, confidence, next action | Product + Engineering |
| WP5 Outcome graph | Event ingestion, identity mapping, behavioral memory, playbook update | Engineering + AI |
| WP6 FineDine activation | Meeting deck/script, pilot workflow, weekly review cadence | Founder + Product |
| WP7 QA and acceptance | Brief review, hallucination checks, chain/independent cases, source conflicts | QA + FineDine reviewer |

### 8.9 Roles and responsibilities

| Role | Responsibility |
|---|---|
| Executive sponsor | Approves pivot and pilot investment |
| Revint founder | Owns FineDine relationship, activation meeting, business case |
| Product owner | Owns project paper, MVP requirements, acceptance criteria |
| Engineering lead | Owns integration architecture, identity resolution, reliability |
| AI/core lead | Owns planner/tool graph/memory/playbook behavior |
| FineDine sponsor | Provides business priority, target markets, success criteria |
| FineDine BD reviewer | Reviews briefs, flags wrong pitches, gives corrected examples |
| FineDine ops/contact | Provides HubSpot/sender/data access and workflow context |

### 8.10 Change control

MVP scope changes must be classified:

- Minor: copy, field label, brief layout, low-risk source addition.
- Moderate: new integration, new outcome type, new sub-niche logic.
- Major: autonomous sending, new CRM object model, pricing/package recommendation automation, production-wide rollout.

Major changes require founder + product + engineering approval.

### 8.11 Acceptance criteria

MVP accepted when:

- FineDine can provide a target objective, geography and segment.
- System ingests restaurant accounts from at least two upstream sources.
- HubSpot account/company/deal context sync works.
- Smartlead or Instantly event sync works.
- Each account has brief with source provenance and next action.
- At least 30 FineDine-reviewed briefs reach acceptable quality.
- At least one campaign/outcome cycle updates memory/playbook.
- FineDine can identify whether the system should scale to next geography or sub-niche.

---

## 9. Native integration plan

### 9.1 HubSpot

Why:

- FineDine'in CRM truth source'u olabilir.
- Company/account/deal lifecycle ve outcome'lar closed-loop learning icin gerekir.

Data flow:

- Revint -> HubSpot: account intelligence fields, fit score, next action, pitch angle, source links, last audit date.
- HubSpot -> Revint: deal stage, owner, activity, outcome, closed-won/lost, no-show, disqualification reason.

MVP role:

- Account/company/deal sync.
- Outcome ingestion.
- HubSpot property mapping.

Risk:

- Custom object availability HubSpot planina bagli olabilir.
- Association ve property mapping karmasiklasabilir.

Mitigation:

- Ilk MVP'de standard Company/Deal properties tercih edilir; custom object opsiyonel tutulur.

### 9.2 Smartlead

Why:

- Reply, bounce, unsubscribe ve campaign eventleri outreach outcome graph icin kritik.

Data flow:

- Smartlead -> Revint: lead replied, opened, bounced, unsubscribed, sent, campaign metadata.
- Revint -> Smartlead: selected leads, sequence fields, personalization variables.

MVP role:

- Campaign webhooks.
- Reply/bounce/unsubscribe mapping.

Risk:

- Email identity ile account identity eslesmesi hatali olabilir.

Mitigation:

- Email + domain + HubSpot company + Revint account ID mapping kullanilir.

### 9.3 Instantly

Why:

- Smartlead alternatifi sender olarak musteri stack'lerinde yaygin.

Data flow:

- Instantly -> Revint: reply_received, bounced, unsubscribed, sent, campaign events.
- Revint -> Instantly: campaign-ready contact rows and variables.

MVP role:

- Smartlead yoksa fallback sender integration.

Risk:

- API v1/v2 farklari ve scope yonetimi.

Mitigation:

- MVP'de API v2 ve webhook event type'lari baz alinir.

### 9.4 Clay

Why:

- GTM ekipleri enrichment workflow'larini Clay'de kuruyor.

Data flow:

- Clay -> Revint: enriched rows via webhook/export.
- Revint -> Clay: account list or fields for further enrichment where needed.

MVP role:

- Webhook/export based integration.

Risk:

- Clay traditional API sunmaz; enterprise API baska scope olabilir.

Mitigation:

- MVP'de webhook/CSV/Make/Zapier path supported olarak yazilir; native real-time API sonraki faz.

### 9.5 Openmart

Why:

- Local business data/API ve restaurant discovery rail.

Data flow:

- Openmart -> Revint: restaurant records, owner/contact, website, location, tech stack, ratings.
- Revint -> Openmart: no initial writeback required.

MVP role:

- Upstream account discovery.

Risk:

- Data freshness ve duplicate records.

Mitigation:

- Source provenance, freshness timestamp, entity resolution.

### 9.6 Orbital

Why:

- SMB account intelligence ve vertical signals kaynagi olabilir.

Data flow:

- Orbital -> Revint: SMB attributes, contacts, fit/intent signals, inbound/outbound context.
- Revint -> Orbital: not required in MVP.

MVP role:

- Import/API if available; otherwise CSV or shared account export.

Risk:

- Positioning overlap.

Mitigation:

- Orbital upstream data/intelligence rail olarak anlatilir; Revint post-enrichment action/learning layer olarak kalir.

### 9.7 Resquared

Why:

- Local business sales workflow ve data source olarak kullanilabilir.

Data flow:

- Resquared -> Revint: local business records and outreach context where available.

MVP role:

- Import-first or API if available.

Risk:

- API availability belirsiz olabilir.

Mitigation:

- MVP planinda connector "available data export/API durumuna gore" tanimlanir.

### 9.8 Google Places/Maps + Apify

Why:

- Restaurant discovery, reviews, location, category, opening hours, social/website enrichment icin ana kaynak.

Data flow:

- Google/Apify -> Revint: business identity, reviews, categories, rating, location, website, social, enrichment.

MVP role:

- Restaurant operational signal extraction.

Risk:

- Rate limits, stale data, review language, social-only URLs, false positives.

Mitigation:

- Audit versioning, source confidence, language filter, social-url gate, review grounding.

### 9.9 FineDine internal offer context

Why:

- FineDine'in hangi pain'e hangi module'u satacagini sistemin bilmesi gerekir.

Data flow:

- FineDine -> Revint: product modules, packages, positioning, disqualifiers, sales notes, corrected opener examples.
- Revint -> FineDine: recommended module/package/angle and reason.

MVP role:

- FineDine-specific offer ontology.

Risk:

- Offer context guncellenmezse pitch kalitesi duser.

Mitigation:

- Weekly offer/playbook review.

---

## 10. FineDine ilk aktivasyon gorusmesi

### 10.1 Gorusmenin amaci

FineDine'e "Revint size lead listesi verecek" demek yanlis olur. Gorusmenin amaci yeni kategoriyi anlatmak ve FineDine'i design partner olarak projeye dahil etmektir.

Ana mesaj:

> Bu proje FineDine'in restaurant outbound motion'unu ogrenebilen bir sisteme cevirme pilotudur. Revint size sadece daha fazla restoran listesi vermeyecek; hangi restorana neden, hangi sirayla, hangi angle ile gidilecegini ve hangi sonuclarin playbook'a donmesi gerektigini belirleyecek.

### 10.2 Gorusme akisi

| Sure | Bolum | Anlatilacak konu |
|---|---|---|
| 5 dk | Yeni kategori ve problem | Restaurant-tech satisinda problem veri yoklugu degil, karar ve ogrenme yoklugu |
| 10 dk | FineDine beta bulgulari | Camden/North London testleri, iyi calisan sinyaller, chain blindness, stale audit, opener feedback |
| 10 dk | Yeni MVP demo flow | Objective -> ingestion -> brief -> next action -> sender/CRM -> outcome -> playbook |
| 10 dk | Entegrasyon ve data ihtiyaci | HubSpot, sender, account sources, FineDine offer context, feedback loop |
| 10 dk | Pilot basari kriterleri | 30 gunluk hedefler, quality review, account/action/outcome metrics |
| 5 dk | Karar ve next steps | Access, owner, first geography, review cadence |

### 10.3 FineDine'e anlatilacak "bu proje sizin ne isinize yarar?"

FineDine icin:

- BD rep'leri daha az manuel research yapar.
- En iyi restoranlar once gorulur.
- Chain account'lar independent gibi pitch edilmez.
- QR menu, ordering, reservation, payment, loyalty, guest CRM angle'lari account'a gore secilir.
- HubSpot sadece pipeline degil, account intelligence tasir.
- Her reply/no-reply/booked/lost sonraki listeyi daha iyi hale getirir.
- FineDine yeni markete girerken sifirdan ogrenmek zorunda kalmaz.

### 10.4 FineDine'den istenecekler

- Hedef geography: ornegin London, Camden, Shoreditch, Manchester veya Istanbul.
- Hedef sub-niche: cafe, fine dining, sushi, hotel restaurant, QSR, ghost kitchen.
- HubSpot access veya export.
- Smartlead/Instantly campaign event access.
- FineDine package/module listesi.
- En iyi ve en kotu opener ornekleri.
- 30-50 account icin human quality review.
- Closed-won/lost veya booked/no-show feedback.

### 10.5 Ilk 30 gun hedefi

30 gun sonunda FineDine su sorulara cevap alabilmeli:

- Hangi restaurant segmenti FineDine icin en sicak?
- Hangi signal demo acmaya en yakin?
- Hangi pitch angle'lari yanlis?
- Chain hesaplarda hangi enterprise angle daha iyi?
- HubSpot'ta hangi account context rep'ler tarafindan kullaniliyor?
- Revint'in sonraki geography/sub-niche'e genislemesi mantikli mi?

---

## 11. Risk register

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Native integrations MVP'yi yavaslatir | High | Medium | Stage plan; once HubSpot + one sender + one data source minimum kabul kriteri |
| FineDine data access gecikir | High | Medium | CSV/export fallback; activation meetingde access checklist |
| Revint hala lead-gen gibi algilanir | High | Medium | Dokuman ve sunumda "lead listesi degil, operational intelligence" vurgusu |
| Orbital ile positioning overlap | Medium | High | "Post-enrichment learning/action layer" dili korunur |
| AI hallucination rep guvenini bozar | High | Medium | Source provenance, confidence, grounded review snippets |
| Chain accounts yanlis pitch edilir | High | Medium | Chain-aware ontology and QA set |
| HubSpot custom object complexity | Medium | Medium | Standard Company/Deal properties ile basla; custom object later |
| Outcome mapping hatali olur | High | Medium | Email/domain/account ID matching and manual review queue |
| FineDine feedback yeterli gelmez | Medium | Medium | Weekly review cadence and named BD reviewer |
| MVP scope revenue automation'a kayar | High | Low | Acceptance criteria: operational intelligence + learning proof, autonomous sending yok |

---

## 12. Basari metrikleri ve karar kapilari

### 12.1 Pilot success metrics

| Metric | Target |
|---|---|
| Accounts ingested | 100+ restaurant accounts |
| Briefs reviewed by FineDine | 30+ |
| Acceptable brief quality | 70%+ initial, 85%+ after iteration |
| Incorrect chain/independent pitch | <10% after QA |
| Source provenance coverage | 90%+ core fields |
| Outcome events captured | 1 full sender/CRM cycle |
| Playbook updates from outcomes | At least 5 validated pattern updates |
| FineDine scale decision | Yes/no decision by day 30-45 |

### 12.2 Decision gates

| Gate | Question | Decision |
|---|---|---|
| Gate 1 | FineDine confirms access and reviewer capacity? | Start pilot / pause |
| Gate 2 | First 50 accounts produce usable briefs? | Continue / fix data layer |
| Gate 3 | Sender + HubSpot outcomes map correctly? | Enable learning loop / hold |
| Gate 4 | FineDine sees BD value? | Expand geography / stop |
| Gate 5 | Case study or anonymized proof possible? | Public positioning / internal only |

---

## 13. Team action plan

### Product

- Convert lead dossier into restaurant-tech account intelligence brief.
- Define FineDine offer ontology.
- Define sub-niche ontology.
- Define source provenance and confidence model.
- Define next-best-action taxonomy.
- Create FineDine review workflow.

### Engineering

- Prioritize HubSpot connector, one sender connector, one upstream data connector.
- Implement identity mapping: email, domain, company, location, account ID.
- Add outcome ingestion path.
- Add audit version/source freshness fields.
- Ensure multi-tenant workspace scope remains strict.

### AI/Core

- Turn static chain into objective-planning MVP where possible.
- Expose worker registry as tool graph conceptually.
- Seed FineDine playbook memory with corrected examples.
- Add chain-aware and sub-niche-aware reasoning.
- Ensure review and opener claims are grounded.

### Marketing

- Stop using "AI lead generation" as primary claim for this motion.
- Build FineDine/restaurant-tech narrative around "restaurant account intelligence" and "learning loop."
- Prepare activation deck and future case study language.

### Sales/founder

- Run FineDine activation meeting.
- Secure data access and reviewer commitment.
- Align on first geography/sub-niche.
- Confirm success metrics and review cadence.

---

## 14. Sources

### FineDine and restaurant-tech context

- FineDine official site: https://www.finedinemenu.com/es/home/
- FineDine Help Center, solutions/cost/products: https://support.finedinemenu.com/en/articles/5898218-finedine-solutions-cost-products
- Toast CRO sales model via SaaStr: https://www.saastr.com/the-top-10-strategies-toasts-cro-uses-to-crush-quotas/
- PAR Technology 2026 QSR Operational Index: https://partech.com/press-releases/par-technology-releases-2026-qsr-operational-index-report-highlighting-loyalty-digital-channels-and-revenue-trends-across-u-s/
- DoorDash 2026 Restaurant Industry Trends: https://about.doordash.com/en-us/news/doordash-restaurant-industry-trends-report-2026
- National Restaurant Association Technology Landscape Report: https://go.restaurant.org/rs/078-ZLA-461/images/NatRestAssoc_TechLandscapeReport_2024.pdf

### Tool/rakip kaynaklari

- Orbital: https://www.withorbital.com/
- Resquared: https://www.re2.ai/
- Resquared YC: https://www.ycombinator.com/companies/resquared
- Resquared seed coverage: https://venturebeat.com/ai/exclusive-resquared-nabs-5m-to-take-on-leading-crms-with-b2b-local-sales-platform
- Openmart: https://www.openmart.com/industry/smb-tech
- Openmart local business API: https://www.openmart.com/products/local-business-data-api
- Openmart YC: https://www.ycombinator.com/companies/openmart
- Clay API guide: https://university.clay.com/docs/using-clay-as-an-api
- Pocus signals: https://www.pocus.com/product/signals
- Pocus funding: https://www.pocus.com/blog/pocus-raises-funding-from-coatue-for-product-led-sales-platform
- Common Room: https://www.commonroom.io/
- Common Room buyer intelligence: https://www.commonroom.io/blog/intent-data-vs-buyer-intelligence/
- HockeyStack Blueprint: https://www.hockeystack.com/blog-posts/blueprint-the-brain-behind-your-revenue-agents
- HockeyStack Series A: https://www.hockeystack.com/blog-posts/hockeystack-raises-20m-in-series-a-led-by-bessemer-venture-partners
- Sixtyfour: https://www.sixtyfour.ai/
- Sixtyfour YC: https://www.ycombinator.com/companies/sixtyfour

### Integration kaynaklari

- HubSpot CRM object APIs: https://developers.hubspot.com/docs/api-reference/crm-objects-v3/guide
- Smartlead campaign webhooks: https://api.smartlead.ai/api-reference/campaigns/get-webhooks
- Smartlead webhook integration guide: https://api.smartlead.ai/guides/webhook-integration
- Instantly API V2: https://help.instantly.ai/en/articles/10432807-api-v2
- Instantly webhooks: https://developer.instantly.ai/api/v2/webhook/def-36

---

## 15. Final karar

Revint local SMB pazarindan cikmamalidir. Ancak local SMB datasini urunun kendisi olmaktan cikarmalidir.

FineDine pilotu ile hedef:

> Local restaurant data -> operational signal -> recommended action -> outcome -> learned playbook.

Bu dongu calisirsa Revint'in yeni konumu savunulabilir hale gelir:

> Revint, restaurant-tech ve local-business GTM ekipleri icin operational intelligence layer'dir. Veri kaynaklarini degistirmez; onlarin ustune karar, aksiyon ve ogrenme katmani koyar.

Ilk public anlatim FineDine uzerinden kurulmalidir:

> Built with FineDine to help restaurant-tech teams know which restaurants to target, what to say, and what their market is teaching them after every outcome.

