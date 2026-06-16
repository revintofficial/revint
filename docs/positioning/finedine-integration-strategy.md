# LeadAC x FineDine Integration Strategy Paper

Status: native-first integration strategy draft  
Date: 2026-05-29  
Audience: LeadAC founders, product, engineering, FineDine activation stakeholders  
Language: Turkish  
Project: LeadAC Restaurant-Tech Operational Intelligence Pilot for FineDine

## 1. Ana karar

LeadAC'in entegrasyon stratejisi "her tool'u replace etmek" olmamalı. LeadAC'in kazanacağı yer, Openmart, Orbital, Clay, HubSpot, Smartlead, Instantly, Google Places ve Apify gibi araçlardan gelen dağınık kanıtları tek bir account intelligence graph'a bağlamak, bu kanıtların hangisine güvenileceğini belirlemek ve outcome'lardan öğrenen FineDine-specific playbook üretmektir.

Bu yüzden doğru kategori cümlesi:

> LeadAC, restaurant-tech ekipleri için post-enrichment operational intelligence layer'dır: veri kaynaklarını bağlar, account context'i çözer, pitch angle seçer, aksiyon önerir ve outcome'lardan öğrenir.

Entegrasyonların amacı "daha fazla row" üretmek değil, şu dört şeyi mümkün kılmaktır:

1. Account truth: Bu restoran kim, kaç lokasyonlu, chain mi independent mı, doğru contact kim?
2. Operational fit: FineDine'in hangi modülü bu restorana gerçek değer satar?
3. Activation context: Bu account hangi kampanyaya, hangi mesajla, hangi kanaldan gitmeli?
4. Learning loop: Reply, meeting, no-show, won/lost geldikten sonra sistem neyi öğrenmeli?

FineDine başlangıcı için varsayım değişmiştir: pilot CSV/import-first başlamayacak; native entegrasyon hedefiyle başlayacaktır. CSV sadece fallback, debugging ve hızlı backfill aracı olarak tutulur. İlk FineDine launch'ının product promise'i şu olmalıdır:

> Connect HubSpot, connect your sender, connect Openmart/Orbital-style sources, then LeadAC builds the FineDine account intelligence and learning loop natively.

Bu karar LeadAC'i daha ağır bir ilk engineering scope'a sokar ama category açısından daha doğru sinyal verir. FineDine'e "bize export atın, biz analiz edelim" demek LeadAC'i research service gibi gösterir. "Stack'inize bağlanıyoruz ve outcome'lardan öğreniyoruz" demek ise operational intelligence layer iddiasını ürün olarak kanıtlar.

## 2. FineDine ICP'sinde beklememiz gereken GTM stack

FineDine gibi restaurant-tech şirketlerinde mükemmel RevOps stack beklememeliyiz. Ürünü buna göre kurarsak yanlış problemi çözeriz.

Beklenen üç seviye:

### Seviye A: Manual / founder-led / erken BD motion

Muhtemel stack:

- Google Maps
- spreadsheets
- HubSpot veya Pipedrive light
- Gmail/Outlook
- manuel Instagram/website/review research
- belki Apollo, belki hiç sender yok

Bu segment için CSV fallback gerekir; ancak FineDine başlangıcı native-first olacağı için bu persona ana design center değildir. Import akışı sadece demo data, backfill ve connector failure durumlarında kullanılacak güvenlik ağıdır.

### Seviye B: FineDine için tasarlanması gereken ana seviye

Muhtemel stack:

- HubSpot CRM
- Smartlead veya Instantly
- Google Maps / Apify / manual research
- Clay veya Openmart exportları
- BD rep notları
- bazı bölgeler için field visit / call motion

LeadAC'in design center'ı bu olmalı. Çünkü burada veri var ama karar sistemi yoktur. En büyük acı, veri eksikliği değil, hangi account'un aksiyon almaya değer olduğunu ve hangi pitch'in çalıştığını bilmemektir.

### Seviye C: İleri RevOps / scale-up restaurant-tech

Muhtemel stack:

- HubSpot/Salesforce
- Smartlead/Instantly/Apollo sequencing
- Clay workflows
- Openmart/Orbital/Resquared
- enrichment waterfall
- dashboard/reporting
- custom properties and webhooks

Bu seviyede LeadAC "replace" değil "judgment layer" olarak satılmalıdır. Müşteri zaten araçlara para ödüyordur; LeadAC bu araçların ürettiği sinyali account prioritization ve learning loop'a çevirir.

## 3. Mevcut LeadAC kod gerçekliği

Kodda halihazırda güçlü temeller var:

- `RESTAURANT_TECH` workspace niche'i ve F&B sub-niche ontology'si var.
- Google Places discovery var.
- Apify tabanlı deep research worker'ları var.
- Gmail/Outlook email account bağlantısı var.
- Smartlead/Instantly için CSV export var.
- Account, Lead, Contact-benzeri contact fields, LeadActivity, LeadNextAction, CommercialInsight, InsightPerformance ve SemanticMemory modelleri var.
- AI Core zinciri restaurant-tech intelligence'a evrilebilecek durumda.

Kodda şu entegrasyonlar henüz yok:

- Native HubSpot connector yok.
- Openmart native API connector yok.
- Orbital native connector yok.
- Clay webhook/API bridge yok.
- Smartlead/Instantly native webhook receiver yok.
- Resquared native connector yok.
- Kaynak bazlı field provenance için ayrı, genel bir integration signal tablosu yok.

Bu yüzden FineDine MVP entegrasyon stratejisi native-first olmalı:

1. Launch-critical native layer: HubSpot OAuth/private app, Smartlead veya Instantly native sender integration, Openmart API, Google Places/Apify internal enrichment, source provenance, closed-loop outcome capture.
2. Native-adjacent partner layer: Orbital via CRM-mediated sync or partner/API, Clay webhook bridge, Resquared CRM/export bridge.
3. Fallback layer: CSV import/export for bootstrapping, data recovery, partner tools without API access, and auditability.

## 4. Entegrasyon mimarisi

LeadAC stack'i dört katmandan oluşmalı:

### 4.1 Upstream data rails

Bu araçlar veri üretir:

- Google Places: canonical place ID, address, rating, review count, website, phone, opening status.
- Apify: deeper Google Maps data, reviews, social/site scraping, SERP, website crawl.
- Openmart: local business search, owner/contact, tech stack, revenue/employee estimates, social profiles.
- Orbital: SMB-specific signals, multi-location/franchise detection, vertical agents, custom SMB signals, CRM sync.
- Clay: custom enrichment workflow, GTM engineer workbench, HTTP/webhook automation.
- Resquared: local business data, outreach workflow, social/CRM flows.
- Apollo: contact/person/org enrichment for HQ, multi-location groups, corporate contacts.

### 4.2 LeadAC intelligence core

LeadAC'in sahiplenmesi gereken alan:

- identity resolution
- source provenance
- source conflict resolution
- restaurant sub-niche classification
- FineDine fit scoring
- pitch angle selection
- next-best-action
- Account Intelligence Brief
- outcome memory
- vertical playbook learning

### 4.3 Activation rails

Bu araçlar aksiyonu taşır:

- HubSpot: CRM system-of-record, owner assignment, deal stage, meeting, won/lost.
- Smartlead: cold email campaigns, reply/bounce/unsubscribe events.
- Instantly: cold email campaigns, reply/interest/meeting statuses, deliverability controls.
- Gmail/Outlook: manual/semi-manual rep sending and reply capture.
- Field/call workflow: manual call/visit outcomes.

### 4.4 Outcome loop

Bu veriler LeadAC'in moat'idir:

- email sent
- reply received
- positive/negative/neutral classification
- bounce
- unsubscribe
- call disposition
- meeting booked
- no-show
- opportunity created
- closed-won
- closed-lost
- lost reason

LeadAC'in integration ihtiyacı en çok burada doğar. Çünkü Openmart veya Orbital account'u bulabilir; HubSpot deal'ı tutabilir; Smartlead email'i gönderebilir. Ama "hangi restaurant signal'i hangi FineDine pitch'iyle reply/demo/won üretti?" sorusu LeadAC'in alanıdır.

## 5. Entegrasyon öncelik matrisi

| Tool | LeadAC içindeki rol | Neden gerekli? | FineDine başlangıç şekli | Fallback |
|---|---|---|---|---|
| HubSpot | System-of-record + outcome source | FineDine sales motion'unun merkezi olması muhtemel; deal stage, owner, meeting ve won/lost burada yaşar | OAuth app veya FineDine private app token; company/contact/deal read-write; webhook subscriptions | HubSpot import/export CSV |
| Smartlead | Sender + campaign outcome | Cold email activation ve reply/bounce/unsubscribe eventleri | API lead push + campaign webhook receiver | CSV export/import |
| Instantly | Sender + campaign outcome | Smartlead alternatifi; campaign membership, reply, interest/meeting status | API V2 lead push + webhook receiver | CSV export/import |
| Openmart | Local SMB data rail | Restaurant TAM, owner/contact, tech stack ve local business fields'i hızlı üretir | API `/search`, pagination, selective contact lookup, refresh jobs | Openmart export CSV |
| Orbital | SMB signal/data rail | Multi-location, franchise, POS, vertical SMB signals; en yakın upstream intelligence source | HubSpot-mediated native sync first; partner/API if available | Orbital export CSV |
| Clay | GTM workflow workbench | Customer-specific enrichment denemeleri, ops automation, custom sources | LeadAC webhook in + Clay HTTP action back | CSV import/export |
| Resquared | Local selling workflow source | Eğer müşteri kullanıyorsa local business/outreach records gelir | HubSpot-mediated sync or partner export endpoint | CSV import |
| Google Places | Canonical local identity | Place ID, address, rating, open status, website, phone; internal discovery zaten var | native internal connector with cost-controlled field masks | none |
| Apify | Deep local research | Google Maps/reviews/site/social/SERP derinliği; mevcut worker'lar var | actor/task templates + completion webhook/polling | manual rerun |
| Apollo | Supplemental contact enrichment | HQ/multi-location corporate contacts için yararlı; local restaurant owner için zayıf kalabilir | optional API after HubSpot/Openmart/sender live | CSV/API later |

Native-first kararı şu öncelik sırasını doğurur:

1. HubSpot + one sender + Openmart + Google Places/Apify.
2. Orbital through HubSpot fields, çünkü Orbital zaten HubSpot bidirectional sync destekliyorsa LeadAC'in ilk günden ayrı Orbital API'ye bağımlı olması gereksizdir.
3. Clay webhook bridge, çünkü Clay teknik müşterilerde extension surface olur.
4. Resquared/Apollo later, çünkü FineDine'in ilk learning loop'u için şart değiller.

## 5.1 Connectorless mode: FineDine bu araçları kullanmıyorsa

FineDine Openmart, Orbital, Resquared veya Clay kullanmıyor olabilir. Bu durum LeadAC için blocker olmamalıdır. Ürün onboarding'de bu connector'ları opsiyonel göstermeli ve bağlı değillerse kendi native discovery/enrichment hattıyla çalışmalıdır.

Connectorless mode'da LeadAC şu kaynaklarla çalışır:

- Google Places: restaurant discovery, place ID, address, phone, website, rating, review count, open status.
- Apify: deeper reviews, website crawl, social/SERP signals, menu/booking/ordering evidence.
- LeadAC-managed Openmart API: FineDine'in Openmart hesabı olmasa bile LeadAC kendi Openmart integration'ı üzerinden market fill veya contact enrichment çalıştırabilir.
- Website audit: menu, booking, ordering, payment, reservation, QR/PDF menu, parked/blocked/expired site signals.
- Manual inputs: rep notes, call outcomes, field visit notes, meeting/no-show/won/lost updates.

Bu modda minimum onboarding:

1. Workspace setup:
   - FineDine offer context
   - target market
   - target sub-niches
   - service packages

2. Data source:
   - LeadAC discovery via Google Places + Apify
   - optional LeadAC-managed Openmart API

3. Activation:
   - Smartlead/Instantly native if available
   - Gmail/Outlook if available
   - manual call/field visit tracking if no sender

4. Outcome loop:
   - HubSpot if available
   - sender webhooks if available
   - manual outcome capture if neither is connected

Bu nedenle onboarding dependency modeli şöyle olmalı:

| Connector | Required? | Bağlanmazsa ne olur? |
|---|---:|---|
| HubSpot | Hayır, ama güçlü önerilir | LeadAC kendi account/workflow yüzeyinde çalışır; won/lost manual girilir |
| Smartlead/Instantly | Hayır, ama activation için önerilir | Gmail/Outlook veya manual call/field visit tracking kullanılır |
| Openmart | Hayır | LeadAC Google Places + Apify ile discovery yapar; LeadAC-managed Openmart opsiyonel kullanılır |
| Orbital | Hayır | Orbital-specific SMB signals olmaz; LeadAC website/review/Google/Apify signals ile scoring yapar |
| Resquared | Hayır | Resquared-sourced accounts olmaz; internal discovery veya Openmart kullanılır |
| Clay | Hayır | Custom enrichment workflow olmaz; LeadAC native workers çalışır |
| Google Places | Evet, internal dependency | Canonical local identity için LeadAC tarafında gerekir |
| Apify | Güçlü önerilir | Deep review/site/social kalitesi düşer ama lightweight audit devam eder |

Product implication:

- Openmart/Orbital/Resquared/Clay "required setup" ekranında olmamalı.
- Bunlar "boost coverage" veya "connect existing data source" olarak sunulmalı.
- FineDine hiçbirini kullanmıyorsa demo/pilot yine çalışmalı.
- LeadAC'in core value proposition connector availability'ye değil, normalized signal -> account judgment -> outcome learning loop'a dayanmalı.

## 6. Openmart entegrasyonu

### 6.1 Openmart ne işe yarar?

Openmart kendini local business API, Google Maps scraper alternatifi, owner finder, email finder ve local business enrichment kaynağı olarak konumlandırıyor. Resmi sayfasında 200M+ local business, 50+ data field, owner contact, tech stack, rating, social profiles ve search/enrichment API vurgusu yapılıyor. API tutorial'ında `/api/v1/search` endpoint'i, API key ile arama, pagination ve batch people lookup akışı anlatılıyor.

Bu LeadAC için şu anlama gelir:

- LeadAC'in büyük local business database kurmasına gerek yok.
- Openmart raw TAM ve contact coverage için upstream rail olabilir.
- LeadAC, Openmart'ın verdiği account'ları FineDine fit, pitch angle ve outcome-learning tarafında işler.

### 6.2 Neden gerekli?

FineDine'in sorusu "Londra'daki bütün restoranlar nerede?" değildir. O soru commodity hale geliyor. Asıl soru:

- Bu restoran FineDine'e gerçekten uygun mu?
- QR/digital menu mu, reservation mı, ordering/payment mı, CRM/loyalty mi satılmalı?
- Bu account'a rep bugün gitmeli mi, yoksa suppress mi edilmeli?
- Bu restoran chain/group mu, yoksa independent mı?

Openmart ilk soruya veri sağlar; LeadAC kalan soruları çözer.

### 6.3 Native-first entegrasyon şekli

FineDine başlangıcında Openmart CSV değil API ile bağlanmalıdır. CSV sadece API erişimi gecikirse fallback olur.

Native flow:

1. LeadAC içinde `IntegrationConnection(provider="openmart")` oluşturulur.
2. API key workspace-scoped credential olarak saklanır.
3. FineDine market/sub-niche seçer: örnek `premium sushi restaurants in London`.
4. LeadAC Openmart `/search` çağırır.
5. Pagination ve rate limit state'i `IntegrationSyncState` veya `IntegrationConnection.settingsJson` içinde tutulur.
6. Sonuçlar `ExternalRecord(provider="openmart")` olarak raw saklanır.
7. LeadAC identity resolver domain, phone, name/address ve Google Place candidate ile `Lead`/`Account` eşleştirir.
8. Eksik owner/GM contact lookup sadece high-fit veya shortlisted accounts için çalışır.
9. Openmart fields `AccountSignal` olarak confidence/freshness ile yazılır.
10. Google Places ve website crawl, Openmart data'yı doğrulamak için kullanılır.

Fallback:

- Openmart export CSV aynı mapping layer'a girer.
- CSV ile gelen data da `source_provider=openmart_csv` değil, provider `openmart`, ingestion mode `csv` olarak saklanır. Böylece source analytics bozulmaz.

### 6.4 Hangi veriler alınmalı?

Openmart'tan alınacak minimum fields:

- source provider: `openmart`
- external id
- company/business name
- website URL
- phones
- store/business emails
- owner/person contacts
- titles
- social links
- category/tags
- address/city/country
- Google rating
- Google reviews count
- tech stack
- employee/revenue estimate
- last updated/freshness
- raw JSON

### 6.5 LeadAC'e nasıl akar?

Flow:

1. User FineDine workspace'te market seçer.
2. LeadAC Openmart API'den accounts alır.
3. Domain, Google place id, phone ve name/address ile identity resolution yapar.
4. `AccountSignal` içine Openmart fields source confidence ile yazılır.
5. Google Places ile canonical place doğrulanır.
6. Apify/website/review worker'ları eksik operational context'i tamamlar.
7. `LEAD_INTELLIGENCE_BRIEF` FineDine pitch angle üretir.
8. Shortlisted accounts HubSpot/Smartlead/Instantly'e gider.

### 6.6 Openmart için trust policy

Openmart'a şu alanlarda yüksek güven verilir:

- initial list generation
- business website
- owner/contact suggestions
- social links
- local categories
- high-level tech stack

Şu alanlarda Google/website/HubSpot ile doğrulama gerekir:

- open/closed status
- exact address/location count
- chain/group structure
- current booking/ordering provider
- CRM lifecycle/outcome

### 6.7 Openmart ne zaman kullanılmamalı?

- FineDine zaten Orbital veya HubSpot içinde yeterli TAM'a sahipse.
- Account quality yerine ucuz row sayısı hedefleniyorsa.
- API cost'u her restaurant için gereksiz contact lookup'a harcanacaksa.

Openmart'ı "her account'a full enrichment" olarak değil, "market fill + selective contact enrichment" olarak kullanmalıyız.

## 7. Orbital entegrasyonu

### 7.1 Orbital ne işe yarar?

Orbital kendini SMB account intelligence/discovery platformu olarak konumlandırıyor. Resmi sitesinde SMB account discovery, vertical-specific signals, 200+ SMB-specific enrichment agents, CRM/GTM integrations, scoring, inbound routing ve outbound activation dili var. Dokümanlarında Salesforce, HubSpot ve Attio ile bidirectional CRM sync desteklediğini, CRM data'yı Orbital'e çekip Orbital updates'i CRM'e yazabildiğini anlatıyor.

Bu LeadAC için hem fırsat hem positioning riskidir.

Fırsat:

- Orbital güçlü upstream SMB signal provider olabilir.
- FineDine Orbital kullanıyorsa LeadAC bu signal'leri okuyup outcome-learning layer'a çevirebilir.

Risk:

- "SMB Account Intelligence" dili Orbital'e çok yakın.
- LeadAC kendini Orbital alternatifi gibi anlatırsa yanlış savaşa girer.

Bu yüzden Orbital entegrasyonunun dili:

> Orbital finds and enriches SMB accounts. LeadAC learns which Orbital-sourced signals actually convert for FineDine and turns them into next actions.

### 7.2 Neden gerekli?

Orbital'in restaurant tarafında public sayfalarında POS system, Yelp review count, new location opening, review sentiment, Google review/rating/open status, Instagram follower count, hiring/open jobs gibi sinyaller öne çıkıyor. Bunlar FineDine için doğrudan faydalı:

- POS system -> integration/payment/ordering pitch
- multi-location/franchise -> central menu governance
- new location opening -> launch stack pitch
- review sentiment -> wait time/service/menu pain
- Instagram follower count -> brand/digital menu/marketing angle
- open jobs -> growth/operations pressure

### 7.3 MVP entegrasyon şekli

Orbital için native API beklememeliyiz. Daha mantıklı üç yol:

1. HubSpot-mediated sync:
   - Orbital HubSpot'a custom fields yazar.
   - LeadAC HubSpot'tan bu fields'i okur.
   - Bu en pratik ve en az partner dependency'li yoldur.

2. CSV import:
   - Orbital export alınır.
   - LeadAC source provider `orbital` olarak import eder.
   - Orbital-specific fields `AccountSignal` olarak saklanır.

3. Partner/API later:
   - FineDine/Orbital tarafında API/export erişimi varsa native connector yapılır.
   - Aksi halde MVP'ye koymak risklidir.

### 7.4 Hangi veriler alınmalı?

Orbital'den alınacak fields:

- orbital account id
- account/domain/name/address
- locations count
- franchise/chain signal
- owner/contact/mobile/email
- POS/payment/booking/scheduling tech stack
- review/rating/open status
- Yelp/Google review counts
- social/Instagram signals
- hiring signal
- new location signal
- Orbital score/tier, varsa
- custom signal values
- CRM sync ids

### 7.5 LeadAC Orbital signal'lerini nasıl kullanır?

Orbital signal'leri direkt final score olmamalı. LeadAC onları evidence olarak almalı:

- `orbital.locations_count >= 3` + website multiple locations + Google duplicate names -> chain/group confidence yükselir.
- `orbital.pos_detected = Toast/Square` + FineDine ordering/payment package -> POS-adjacent pitch.
- `orbital.instagram_followers high` + premium/cafe/fine dining -> branded digital menu + campaign angle.
- `orbital.new_location_opening` -> "opening stack" playbook.

Outcome sonrası LeadAC şunu öğrenir:

- Orbital'in hangi restaurant signals'i FineDine için reply/demo/won üretiyor?
- Hangi Orbital signal'i false positive?
- Orbital score ile LeadAC fit score arasındaki fark nerede?

### 7.6 Orbital için stratejik sınır

Orbital'i homepage'de ana düşman gibi göstermemeliyiz. FineDine pilotunda Orbital:

- upstream source
- integration source
- competitor validation
- not replacement target

LeadAC'in farkı "source üretmek" değil "source'lardan öğrenmek" olmalı.

## 8. HubSpot entegrasyonu

### 8.1 HubSpot'un rolü

HubSpot, FineDine pilotunda system-of-record olmalı. LeadAC'in CRM olmaya çalışması yanlış olur. HubSpot:

- company/contact/deal record'larını tutar
- rep owner bilgisini tutar
- lifecycle/deal stage bilgisini tutar
- meetings, notes, tasks, calls gibi aktiviteleri tutar
- won/lost outcome truth'u üretir

LeadAC:

- HubSpot kayıtlarını restaurant context ile zenginleştirir
- account brief ve next action üretir
- HubSpot outcome'larını öğrenme loop'una çeker
- HubSpot'a rep-ready context yazar

### 8.2 Neden en kritik entegrasyon?

Çünkü FineDine sales leadership'in ürünü kullanması için insight'ın rep workflow'una girmesi gerekir. Rep HubSpot'ta çalışıyorsa LeadAC dashboard'u tek başına yeterli değildir.

HubSpot entegrasyonu üç fayda üretir:

1. Adoption: Rep kendi CRM'inde LeadAC insight'ı görür.
2. Outcome truth: Meeting, deal stage, won/lost LeadAC'e döner.
3. Manager visibility: FineDine leadership hangi account source/pitch'in pipeline ürettiğini görür.

### 8.3 HubSpot object mapping

Restaurant-tech için önerilen mapping:

| LeadAC object | HubSpot object | Not |
|---|---|---|
| Account/group | Company | Chain/group parent veya single-location company |
| Location/restaurant | Company veya child Company | MVP'de location da Company olabilir; chain için parent-child association kullanılır |
| Contact | Contact | Owner, GM, marketing, ops |
| Sales opportunity | Deal | Demo/opportunity stage için |
| LeadActivity | Engagement/Activity veya custom notes | Email/call/meeting outcomes |
| Account Intelligence Brief | Company custom properties + note/link | Full brief LeadAC'te, summary HubSpot'ta |

MVP kararı:

- Independent restaurant: one LeadAC Account + one Lead/Location -> one HubSpot Company.
- Multi-location group: parent Account -> parent HubSpot Company; locations -> child Companies veya associated Companies.
- Contact email varsa Contact oluştur/upsert et; yoksa Company context yine yaz.
- Deal sadece FineDine team shortlist/outreach sonrası oluşturulsun. Her imported restaurant için Deal açmak CRM'i kirletir.

### 8.4 HubSpot custom properties

LeadAC HubSpot'ta ayrı property group oluşturmalı: `LeadAC Intelligence`.

Minimum Company properties:

- `leadac_account_id`
- `leadac_location_id`
- `leadac_google_place_id`
- `leadac_source_providers`
- `leadac_source_confidence`
- `leadac_sub_niche`
- `leadac_chain_context`
- `leadac_locations_count`
- `leadac_fit_score`
- `leadac_priority_tier`
- `leadac_next_action`
- `leadac_pitch_angle`
- `leadac_recommended_module`
- `leadac_detected_stack`
- `leadac_missing_modules`
- `leadac_review_pain`
- `leadac_risk_flags`
- `leadac_brief_summary`
- `leadac_brief_url`
- `leadac_last_learning_note`
- `leadac_last_synced_at`

Minimum Contact properties:

- `leadac_contact_source`
- `leadac_contact_confidence`
- `leadac_role_guess`
- `leadac_is_primary_contact`
- `leadac_dnc`

Minimum Deal properties:

- `leadac_source_provider`
- `leadac_initial_fit_score`
- `leadac_pitch_angle`
- `leadac_recommended_module`
- `leadac_playbook_id`
- `leadac_outcome_attribution_status`

### 8.5 Sync direction

HubSpot -> LeadAC:

- companies
- contacts
- deals
- owners
- deal stage
- lifecycle status
- last activity date
- meeting booked
- closed won/lost
- lost reason
- notes/call outcomes where available

LeadAC -> HubSpot:

- fit score
- priority tier
- next action
- pitch angle
- FineDine module/package
- account brief summary
- source confidence
- restaurant operational pains
- suppress/risk flags
- brief URL

### 8.6 HubSpot native-first launch path

FineDine başlangıcında HubSpot CSV writeback ana yol olmamalı. HubSpot native connection launch-critical olmalı. İki seçenek vardır:

Option A: FineDine private app token

- En hızlı native yol.
- FineDine HubSpot içinde private app oluşturur.
- Required scopes minimum tutulur.
- LeadAC token'ı workspace credential olarak saklar.
- Marketplace/OAuth approval süreci beklenmez.
- Tek design partner için uygundur.

Option B: LeadAC OAuth app

- Tekrarlanabilir SaaS onboarding için doğru nihai yol.
- User HubSpot install flow'dan geçer.
- Refresh token lifecycle, uninstall, webhook subscriptions ve app scopes yönetilir.
- İlk FineDine başlangıcı için daha ağırdır ama product narrative açısından daha güçlüdür.

Benim önerim:

1. Engineering Day 1-7: private app token path ile FineDine native read/write çıkar.
2. Aynı abstraction içinde OAuth token modelini hazırla.
3. Day 15-30: OAuth install flow'u ikinci path olarak ekle.

Native HubSpot launch scope:

- Create/update LeadAC property group.
- Upsert Company by LeadAC account id, Google Place ID, domain, phone, name/address.
- Upsert Contact by email.
- Associate contacts to companies.
- Create Deal only when account is shortlisted/qualified, not every imported restaurant için.
- Read deal stage, owner, last activity, meeting booked, closed won/lost, lost reason.
- Subscribe to webhooks for company/contact/deal property changes where available.
- Write LeadAC intelligence fields back to Company and Deal.

Fallback:

- HubSpot-ready CSV export remains available for debugging, bulk repair and non-admin users.

### 8.7 HubSpot identity and dedupe

Unique matching order:

1. `leadac_account_id` / `leadac_location_id`
2. Google Place ID custom property
3. company domain
4. normalized phone
5. normalized name + city + postal code

Contact matching:

1. email
2. mobile/phone + company
3. name + company as low-confidence candidate

Deal matching:

1. `leadac_opportunity_id`
2. associated company + active pipeline stage

Do not create duplicate records silently. Every ambiguous match should become `needs_review`.

## 9. Smartlead entegrasyonu

### 9.1 Smartlead'in rolü

Smartlead sender ve campaign outcome rail'dir. LeadAC Smartlead'in yerine geçmemeli; Smartlead'e doğru account, doğru merge variables ve doğru campaign selection göndermeli. Smartlead'den de reply/bounce/unsubscribe/message history geri almalı.

Smartlead API dokümanında campaign lead add/update, lead pause/resume/unsubscribe, message history, campaign analytics ve webhook eventleri bulunuyor. Webhook guide, reply, bounce, unsubscribe ve message sent gibi campaign eventlerini HTTP POST ile gönderebildiğini anlatıyor.

### 9.2 Neden gerekli?

FineDine outbound motion'unda email sender kullanılıyorsa outcome truth'un önemli kısmı Smartlead'de yaşar:

- Hangi email gönderildi?
- Hangi variation reply aldı?
- Bounce oldu mu?
- Prospect unsubscribe etti mi?
- Positive/negative reply geldi mi?
- Hangi campaign daha iyi çalıştı?

LeadAC bu olayları alamazsa learning loop iddiası zayıf kalır.

### 9.3 LeadAC -> Smartlead

Gönderilecek fields:

- email
- first name / last name
- company name
- phone
- website
- city/country
- `leadac_lead_id`
- `leadac_account_id`
- `leadac_brief_url`
- `leadac_fit_score`
- `leadac_priority_tier`
- `leadac_sub_niche`
- `leadac_pitch_angle`
- `leadac_recommended_module`
- `leadac_opener`
- `leadac_pain_point`
- `leadac_risk_flags`

Campaign selection:

- reservation angle campaign
- branded digital menu campaign
- ordering/payment campaign
- guest CRM/loyalty campaign
- multi-location governance campaign
- suppress/no-send bucket

### 9.4 Smartlead -> LeadAC

Normalize edilecek events:

- email sent -> `EMAIL_SENT`
- reply received -> `EMAIL_REPLIED`
- bounce -> `BOUNCED`
- unsubscribe -> `UNSUBSCRIBED` + DNC
- positive reply -> `REPLY_POSITIVE`
- negative reply -> `REPLY_NEGATIVE`
- campaign completed -> sequence completed

Her event şu mapping ile kaydedilmeli:

- provider: `smartlead`
- campaign id
- lead id in provider
- message id/thread id
- LeadAC lead/account id
- raw payload
- timestamp
- normalized outcome

### 9.5 Smartlead native-first launch path

FineDine başlangıcında Smartlead kullanılacaksa CSV ana yol olmamalı. LeadAC campaign'e lead push etmeli ve webhook eventlerini normalize etmelidir.

Native launch scope:

- `IntegrationConnection(provider="smartlead")` API key storage.
- Campaign list/read.
- Campaign webhook registration veya webhook URL configuration guide.
- Lead push/update to selected campaign.
- Custom fields: `leadac_lead_id`, `leadac_account_id`, `pitch_angle`, `recommended_module`, `brief_url`, `fit_score`.
- Reply/bounce/unsubscribe/message-sent webhook receiver.
- Raw payload storage as `IntegrationEvent`.
- Normalized `LeadActivity`.
- `OUTCOME_ATTRIBUTOR` event emit.
- DNC update on unsubscribe.
- Contact confidence reduction on bounce.

Implementation detail:

- LeadAC should not decide deliverability settings. Smartlead owns sending infrastructure.
- LeadAC should choose campaign and variables, not mailbox warmup or daily sending limits.
- Duplicate lead rejection must be handled gracefully and stored as integration error.

Fallback:

- CSV export/import remains available.
- CSV output must use the same custom variable names as native API path.
- If webhook setup is blocked, scheduled campaign event pull is acceptable as temporary fallback.

## 10. Instantly entegrasyonu

### 10.1 Instantly'nin rolü

Instantly de Smartlead gibi sender ve outcome rail'dir. Instantly API V2 lead create/list/update, campaign/list membership ve custom variables destekliyor. Instantly webhooks help center'da email sent, bounced, opened, clicked, reply received, unsubscribed, interested/not interested/neutral, meeting booked ve close gibi events listeleniyor.

Bu, LeadAC için çok değerli çünkü Instantly bazı outcome'ları Smartlead'e göre daha doğrudan sales status olarak döndürebilir.

### 10.2 LeadAC -> Instantly

API veya CSV ile gönderilecek custom variables:

- `leadac_lead_id`
- `leadac_account_id`
- `fit_score`
- `sub_niche`
- `pitch_angle`
- `recommended_module`
- `review_pain`
- `detected_stack`
- `brief_url`
- `opener`
- `source_summary`

Instantly create lead API custom variables alanını lead payload içinde saklayabildiği için LeadAC context'i campaign copy'de kullanılabilir.

### 10.3 Instantly -> LeadAC

Webhook mapping:

- reply received -> reply outcome
- lead marked interested -> positive outcome
- lead marked not interested -> negative outcome
- neutral -> neutral outcome
- meeting booked -> booked
- bounced -> bad contact
- unsubscribed -> DNC
- close -> won/closed signal, HubSpot ile doğrulanmalı

### 10.4 Instantly native-first launch path

FineDine başlangıcında Instantly seçilirse LeadAC API V2 ile lead/campaign push ve webhook receiver kurmalıdır.

Native launch scope:

- `IntegrationConnection(provider="instantly")` API key storage.
- Campaign list/read.
- Lead create/update with custom variables.
- Campaign assignment.
- Webhook receiver for reply, interested, not interested, neutral, meeting booked, bounced, unsubscribed and close-like events where available.
- Raw event storage.
- Normalized `LeadActivity`.
- `OUTCOME_ATTRIBUTOR` event emit.
- DNC/bounce handling.

Fallback:

- CSV export/import remains available.
- `leadac_lead_id` custom variable is mandatory in both API and CSV modes.

Important boundary:

- Instantly may expose campaign/sending configuration, but LeadAC should avoid becoming a deliverability control plane.
- LeadAC only sends the right accounts, variables and suppressions; sender remains the source of sending execution.

## 11. Clay entegrasyonu

### 11.1 Clay'in rolü

Clay generic enrichment/workflow workbench'tir. Resmi Clay docs, Clay'in geleneksel bir API olmadığını; webhooks, Make/Zapier wrapper veya Enterprise People & Company API ile programmatic kullanım sağladığını söylüyor. Clay table webhook'larıyla veri içeri alınabilir; enrichments sonrası HTTP actions ile veri dışarı gönderilebilir.

Bu yüzden LeadAC Clay'i "provider" değil "customer-controlled enrichment lab" olarak görmeli.

### 11.2 Neden gerekli?

Bazı FineDine/GTM ekipleri Clay'i zaten kullanıyor olabilir. Onlar LeadAC'e şunu sorar:

"Bunu Clay'de build edemez miyiz?"

Cevap:

"Clay'de veri pipeline'ı kurabilirsiniz. LeadAC ise restaurant-tech judgment, source conflict, account brief ve outcome learning loop'u hazır verir."

### 11.3 Entegrasyon akışları

Flow A: Clay -> LeadAC

1. Clay table enriched rows üretir.
2. HTTP action veya CSV ile LeadAC import endpoint'ine gönderir.
3. LeadAC row'u `source_provider=clay` olarak saklar.
4. Clay columns `AccountSignal` olur.

Flow B: LeadAC -> Clay -> LeadAC

1. LeadAC eksik field tespit eder: örnek "booking provider unknown".
2. LeadAC Clay webhook endpoint'ine row gönderir.
3. Clay custom workflow çalışır.
4. Clay HTTP action ile result'u LeadAC'e post eder.
5. LeadAC signal confidence ve provenance ile kaydeder.

### 11.4 Clay için sınır

LeadAC Clay'e bağımlı olmamalı. Çünkü Clay customer-specific ops workbench'tir; product core logic oraya taşınırsa LeadAC'in moat'i zayıflar.

Clay entegrasyonu şu şekilde konumlanmalı:

- optional upstream enrichment
- GTM engineer extension point
- not source of truth
- not required for FineDine MVP

## 12. Resquared entegrasyonu

### 12.1 Resquared'in rolü

Resquared kendini local businesses'a satış platformu olarak konumlandırıyor: local business database, email prospecting, sales pipeline management, outreach analytics ve social media outreach sunuyor. Public sayfalarında CRM entegrasyon kolaylığı iddiası var; ancak public API dokümanı açık şekilde bulunmuyor.

Bu nedenle Resquared için native API varsaymak doğru değil.

### 12.2 Ne zaman gerekli?

FineDine veya başka bir customer Resquared kullanıyorsa:

- Resquared account listeleri LeadAC'e import edilir.
- Resquared outreach engagement/outcome exportları varsa LeadAC'e outcome source olarak gelir.
- LeadAC hangi Resquared-sourced accounts'ın convert ettiğini öğrenir.

### 12.3 Native-first path

Resquared public API net olmadığı için FineDine başlangıcında Resquared native connector launch-critical değildir. Ancak native-first prensip korunur:

- Eğer Resquared HubSpot'a data yazıyorsa, LeadAC bu veriyi HubSpot custom fields üzerinden okur.
- Eğer Resquared partner/export endpoint sağlıyorsa provider-specific connector yazılır.
- CSV sadece fallback olur.

Priority düşük kalmalıdır; Openmart + HubSpot + sender loop çalışmadan Resquared'e engineering harcanmamalıdır.

## 13. Google Places ve Apify

### 13.1 Google Places'in rolü

Google Places canonical local identity source olmalı. Google Places Text Search ve Place Details API, field mask ile istenen alanların seçilmesini gerektiriyor ve bu maliyet kontrolü için önemli. Text Search query + location bias ile restaurant seti bulunabilir; Place Details unique place id ile address, phone, website, rating/reviews gibi detayları döndürür.

LeadAC'te zaten Google Places discovery var. Bunu kaldırmak değil, integration graph'ın canonical identity layer'ı yapmak gerekir.

### 13.2 Apify'nin rolü

Apify deep research ve scraping rail'dir. Apify API Actor run, dataset item fetch, webhook/schedule ve auth token akışları sunuyor. LeadAC'te Apify worker'ları zaten var.

FineDine için Apify şu işlerde kullanılmalı:

- deeper Google Maps scrape
- review corpus
- website crawl
- social/profile scrape
- SERP/local SEO signal
- competitor/ad signal

### 13.3 Cost policy

Her account'a deep research çalıştırmak pahalı ve yavaş olur. Önerilen policy:

- Import/discovery stage: Google Places essentials + Openmart API fields.
- Pre-shortlist: website audit + lightweight review summary.
- Shortlisted/high-fit: Apify deep reviews/site/social.
- Active opportunity: refresh before demo/call.

## 14. Apollo entegrasyonu

Apollo local restaurant owner discovery için birincil kaynak olmamalı. Apollo daha çok B2B person/org data için güçlüdür. FineDine bağlamında Apollo şu durumlarda yararlı:

- multi-location group HQ contacts
- restaurant group marketing/ops contacts
- franchise/corporate decision makers
- investor-owned hospitality groups

MVP'de Apollo native connector şart değil. Ancak import mapping ve future optional API enrichment desteklenmeli.

## 15. Source provenance ve conflict resolution

LeadAC'in entegrasyonlardan gerçek değer üretmesi için her field'ın kaynağı saklanmalı. Aksi halde sistem "hangi data'ya niye güveniyoruz?" sorusuna cevap veremez.

### 15.1 Önerilen yeni veri modelleri

MVP için minimum:

- `IntegrationConnection`
  - workspaceId
  - provider
  - status
  - authType
  - credentialsJson / encryptedCredentialsJson
  - settingsJson
  - lastSyncAt

- `ImportBatch`
  - workspaceId
  - provider
  - fileName
  - mappingJson
  - status
  - countsJson
  - createdByUserId

- `ExternalRecord`
  - workspaceId
  - provider
  - externalId
  - leadId nullable
  - accountId nullable
  - contactKey nullable
  - rawJson
  - observedAt

- `AccountSignal`
  - workspaceId
  - accountId nullable
  - leadId nullable
  - key
  - valueJson
  - sourceProvider
  - externalRecordId nullable
  - confidence
  - observedAt
  - expiresAt nullable

- `IntegrationEvent`
  - workspaceId
  - provider
  - eventType
  - externalEventId
  - leadId nullable
  - accountId nullable
  - rawJson
  - normalizedOutcome
  - processedAt

### 15.2 Trust matrix

| Field | Highest trust | Secondary | Notes |
|---|---|---|---|
| Google place id | Google Places | Openmart/Apify | Canonical local identity |
| Business name/address | Google Places | Openmart, HubSpot | HubSpot may have rep-edited data |
| Open/closed status | Google Places | website | Refresh before outreach |
| Website | Google Places + website response | Openmart/Orbital | Verify parked/blocked/expired |
| Owner/contact email | HubSpot verified, Smartlead successful send | Openmart, Orbital, Apollo | Bounce lowers confidence |
| Mobile/phone | HubSpot/manual, Orbital/Openmart | Google listed phone | Owner mobile sensitive/high value |
| Chain/location count | website + Google duplicate grouping | Orbital/Openmart | Needs conflict resolver |
| POS/booking/ordering tech | website crawl + Orbital | Openmart/Clay | Often stale; show confidence |
| Review pain | Apify/Google reviews | Orbital sentiment | Must be grounded in review text |
| Outcome | HubSpot deal + sender event | manual rep input | HubSpot wins for won/lost |

### 15.3 Conflict examples

Example 1:

- Openmart says 3 locations.
- Website locations page says 5.
- Google search returns 4.

LeadAC output:

- `locationsCountEstimate=5`
- confidence: medium
- reason: website is freshest for brand-owned location list; Google confirms multi-location; Openmart stale.
- risk flag: verify before enterprise/multi-location pitch.

Example 2:

- Orbital detects Toast POS.
- Website has no POS reference.
- Reviews mention "Toast receipt".

LeadAC output:

- POS signal: Toast
- confidence: medium-high
- recommended angle: FineDine ordering/payment integration adjacent, not POS replacement.

Example 3:

- Smartlead reply says "not interested".
- HubSpot deal later marked meeting booked.

LeadAC output:

- HubSpot stage overrides sender category.
- Smartlead reply classification becomes historical signal, not final outcome.

## 16. FineDine end-to-end ICP flow

### Step 0: Setup

LeadAC creates FineDine workspace:

- niche: `RESTAURANT_TECH`
- market: UK/London first
- target sub-niches
- FineDine packages
- ICP weights
- CommercialInsight seed playbooks
- HubSpot fields
- Smartlead/Instantly custom variables

### Step 1: Market definition

FineDine user chooses objective:

> "London premium sushi and fine dining restaurants; this month 15 demos."

LeadAC translates this into:

- geography
- sub-niches
- price/rating/review count filters
- excluded categories
- desired modules
- acceptable account types

### Step 2: Source accounts

Priority:

1. HubSpot existing accounts, if FineDine has them.
2. Openmart API for market fill.
3. Google Places internal discovery for canonical restaurant identity.
4. Orbital via HubSpot-synced fields if FineDine already uses it.
5. Clay webhook bridge if FineDine has Clay workflows.
6. Resquared via HubSpot/export bridge if present.
7. Apify deep research only for shortlisted or high-fit accounts.

### Step 3: Identity resolution

LeadAC merges by:

- Google place id
- domain/apex domain
- phone
- name + address
- HubSpot company id
- Openmart/Orbital external ids

Output:

- Account group
- Location records
- Contacts
- source map
- conflict flags

### Step 4: Enrichment decision

LeadAC decides which tool to use based on missing fields:

- Missing place id -> Google Places
- Missing owner/contact -> Openmart/Orbital/Apollo if high-fit
- Missing review pain -> Apify reviews
- Missing booking/ordering tech -> website crawl + Clay/Orbital if available
- Missing outcome -> HubSpot/sender sync

This is important: LeadAC should not run all enrichments on all rows. It should plan enrichment based on potential value.

### Step 5: Account Intelligence Brief

Brief output:

- account overview
- chain/location context
- sub-niche
- FineDine fit
- detected stack
- missing modules
- review pain
- recommended module
- pitch angle
- next action
- confidence
- source provenance
- risk flags

### Step 6: Human review and shortlist

FineDine BD lead reviews:

- ready for outreach
- enrich more
- field visit
- suppress
- wrong category
- chain/enterprise route

These review actions are outcomes too. They should feed memory.

### Step 7: Activation

If email:

- push/export to Smartlead/Instantly with custom variables.

If CRM-first:

- sync to HubSpot company/contact/deal.

If field/call:

- create HubSpot task or LeadAC next action.

### Step 8: Outcome capture

Events return from:

- HubSpot deal stage
- Smartlead/Instantly webhooks
- Gmail/Outlook inbox
- manual call log
- meeting/no-show input

### Step 9: Learning

LeadAC updates:

- LeadNextAction outcome
- CommercialInsight performance
- trigger confidence
- NBA outcome memory
- FineDine playbook graph

The key output after 30 days:

> In London, high-review premium restaurants with no visible booking provider and service/wait review pain responded best to reservation optimization angle; cafe/bakery accounts with Instagram activity responded better to branded digital menu + loyalty, while generic QR menu angle underperformed.

## 17. Integration roadmap

### P0: Native foundation before FineDine connection

- Integration schema:
  - `IntegrationConnection`
  - `IntegrationEvent`
  - `ExternalRecord`
  - `AccountSignal`
  - `ImportBatch` as fallback only
- Credential storage abstraction.
- Provider registry: hubspot, openmart, smartlead, instantly, clay, orbital, resquared, apify, google_places.
- Source provenance and conflict resolution primitives.
- Closed-loop event plumbing in AI Core.
- FineDine seed ICP/packages/playbooks.

### P1: HubSpot native

- FineDine private app token path.
- OAuth app path scaffolded in same abstraction.
- Company/contact/deal read-write.
- LeadAC property group and properties.
- Owner/deal stage/lifecycle sync.
- Webhook receiver and signature/validation handling.
- Deal stage changes mapped to outcomes.
- HubSpot sync status on account brief.

### P2: Sender native

Choose one sender first based on FineDine's actual stack. Do not build Smartlead and Instantly fully in parallel unless FineDine requires both.

If Smartlead:

- API key connection.
- Campaign list/read.
- Lead push/update.
- Campaign webhook receiver.
- Reply/bounce/unsubscribe/message sent normalization.

If Instantly:

- API V2 key connection.
- Campaign list/read.
- Lead create/update.
- Campaign assignment.
- Webhook receiver for reply/interested/not interested/meeting/bounce/unsubscribe.

Shared sender layer:

- `leadac_lead_id` mandatory custom variable.
- DNC/bounce suppression.
- `LeadActivity` write.
- `OUTCOME_ATTRIBUTOR` emit.
- sender health/error dashboard.

### P3: Openmart native

- API key connection.
- Search endpoint integration.
- Pagination/rate limit handling.
- Market query builder from FineDine objective.
- Selective contact lookup only for high-fit/shortlisted accounts.
- ExternalRecord raw payload storage.
- AccountSignal writes.
- Google Places canonical validation.

### P4: Google Places + Apify hardening

- Google Places field masks and cost policy.
- Place Details refresh scheduler.
- Apify actor templates for restaurant reviews/site/social/SERP.
- Run status tracking.
- Dataset ingestion.
- Source freshness policy.

### P5: Orbital native-adjacent

- First path: read Orbital-enriched fields from HubSpot.
- Map Orbital custom fields to AccountSignal.
- If partner/API access exists, add direct connector later.
- Learn which Orbital signals predict FineDine outcomes.

### P6: Clay webhook bridge

- LeadAC inbound enrichment webhook endpoint.
- Clay HTTP action result schema.
- Optional LeadAC -> Clay row dispatch for missing fields.
- Source provenance as provider `clay`.

### P7: Resquared/Apollo optional

- Resquared via HubSpot/export/partner route.
- Apollo optional for chain HQ/corporate contacts.
- Do not block FineDine launch on these.

### P8: CSV fallback and repair tools

- HubSpot-ready CSV export.
- Openmart/Orbital/Clay/Resquared CSV import.
- Smartlead/Instantly CSV export/import.
- Used for backfill, debugging and partner tools without API access, not primary product path.

### 17.1 Native engineering implementation map

Recommended folder shape:

- `src/lib/integrations/registry.ts`
  - provider definitions
  - auth type
  - supported capabilities
  - rate limit defaults

- `src/lib/integrations/hubspot/client.ts`
  - authenticated REST client
  - retry/rate limit wrapper
  - company/contact/deal methods
  - property setup

- `src/lib/integrations/hubspot/sync.ts`
  - LeadAC account -> HubSpot company
  - HubSpot company/deal -> LeadAC account/opportunity
  - webhook event normalization

- `src/lib/integrations/openmart/client.ts`
  - search
  - pagination
  - contact lookup
  - raw response validation

- `src/lib/integrations/senders/smartlead.ts`
  - campaign list
  - lead push/update
  - webhook normalization

- `src/lib/integrations/senders/instantly.ts`
  - campaign list
  - lead create/update
  - webhook normalization

- `src/lib/integrations/clay/webhook.ts`
  - inbound enrichment payload validation
  - output -> AccountSignal mapping

- `src/lib/integrations/source-provenance.ts`
  - field-level source writes
  - confidence calculation
  - conflict resolver helpers

- `src/app/api/integrations/[provider]/connect/route.ts`
  - OAuth start or API-key/private-token setup

- `src/app/api/integrations/[provider]/callback/route.ts`
  - OAuth callback where provider supports OAuth

- `src/app/api/webhooks/hubspot/route.ts`
  - HubSpot webhook receiver

- `src/app/api/webhooks/smartlead/route.ts`
  - Smartlead webhook receiver

- `src/app/api/webhooks/instantly/route.ts`
  - Instantly webhook receiver

- `src/app/api/webhooks/clay/route.ts`
  - Clay HTTP action receiver

- `src/app/api/integrations/openmart/search/route.ts`
  - native Openmart market search

Rules:

- All integration records must be workspace-scoped.
- Integration webhook handlers must map external events to internal `LeadActivity` and then emit AI Core learning events.
- No provider client should write semantic memory directly.
- No provider-specific logic should leak into `lead-intelligence-brief`; brief reads normalized account signals and outcomes.
- Sender integrations should share a normalized outcome vocabulary.
- HubSpot remains system-of-record for won/lost; sender remains source-of-record for email delivery/reply mechanics.

### 17.2 Native launch acceptance criteria

FineDine native launch is acceptable only if:

- HubSpot connection can read/write company, contact and deal records.
- LeadAC can create or update HubSpot custom properties under a LeadAC property group.
- Deal stage changes in HubSpot create normalized outcomes in LeadAC.
- One sender is fully native: Smartlead or Instantly.
- LeadAC can push a shortlisted account to the selected sender campaign with `leadac_lead_id`.
- Sender reply/bounce/unsubscribe events return to LeadAC without CSV.
- Openmart API can source at least one FineDine market list natively.
- Google Places validates imported/Openmart restaurants with place ID, website, phone and open status.
- Account Intelligence Brief shows source provenance and sync status.
- One real or test outcome changes next action / insight performance / memory.
- CSV still exists only as repair/fallback, not as the main demo path.

## 18. What not to build

Do not build:

- a generic local business database to compete with Openmart
- a generic SMB account intelligence platform to compete head-on with Orbital
- a Clay clone
- a HubSpot replacement
- a Smartlead/Instantly replacement
- a fully autonomous SDR before outcome learning is proven

Build instead:

- import/connect sources
- resolve identity and conflicts
- produce FineDine-specific account judgment
- activate through existing systems
- learn from outcomes

## 19. FineDine-specific integration story

FineDine'e anlatılacak basit hikaye:

> HubSpot pipeline'ı tutuyor. Smartlead/Instantly mesajları gönderiyor. Openmart/Orbital/Clay restoran verisini getiriyor. LeadAC bu parçaları birleştirip hangi restoranın FineDine'e neden uygun olduğunu, hangi module/pitch ile gidilmesi gerektiğini ve her outcome'dan ne öğrenildiğini söylüyor.

FineDine için integration promise:

- "Connect HubSpot, your sender and your restaurant data source."
- "We will not force you to rip out your stack."
- "We will show which account sources and signals produce demos."
- "We will turn your best BD rep's restaurant judgment into repeatable playbook memory."

## 20. Açık kararlar

1. FineDine HubSpot kullanıyor mu, yoksa başka CRM mi?
2. Smartlead mi Instantly mi ana sender?
3. FineDine'de mevcut restaurant listeleri hangi formatta?
4. FineDine Openmart/Orbital/Clay kullanıyor mu, yoksa LeadAC mi kaynak getirecek?
5. İlk pilot market kesin Londra mı?
6. FineDine için primary module priority nedir: QR/digital menu, reservations, ordering/payments, CRM/loyalty, website?
7. HubSpot'a Deal her shortlisted account için mi açılacak, sadece qualified/demo için mi?

Benim önerilen cevaplarım:

- HubSpot'u default kabul et.
- Sender'ı customer mevcut stack'e göre seç; ilk native sender olarak yalnızca birini tamamla.
- İlk 30 gün native-first hedefle: HubSpot private app/OAuth abstraction + one sender native + Openmart API + Google/Apify hardening.
- CSV'yi product promise değil fallback olarak tut.
- Openmart API'yi market fill için kullan; Orbital'i varsa ilk etapta HubSpot-mediated signal source olarak al.
- Deal sadece qualified/shortlisted sonrası aç.

## 21. Kaynaklar

- Openmart Local Business Data API: https://www.openmart.com/products/local-business-data-api
- Openmart API tutorial: https://www.openmart.com/product-tutorials/using-the-openmart-api-to-fetch-data
- Openmart Clay integration: https://www.openmart.com/product-tutorials/clay-openmart
- Orbital main site: https://www.withorbital.com/
- Orbital Agents: https://www.withorbital.com/product/agents
- Orbital Discover: https://www.withorbital.com/product/discover
- Orbital Bidirectional CRM Sync docs: https://docs.withorbital.com/integrations/overview-bidirectional-crm-sync
- HubSpot OAuth quickstart: https://developers.hubspot.com/docs/guides/apps/authentication/oauth-quickstart-guide
- HubSpot Contacts API: https://developers.hubspot.com/docs/api-reference/latest/crm/objects/contacts/guide
- HubSpot CRM Search API: https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm
- HubSpot Imports API: https://developers.hubspot.com/docs/api-reference/latest/crm/imports/guide
- Smartlead API docs: https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation
- Smartlead webhook guide: https://api.smartlead.ai/guides/webhook-integration
- Instantly Webhooks: https://help.instantly.ai/en/articles/6261906-webhooks
- Instantly API V2 lead docs: https://developer.instantly.ai/api-reference/lead/create-lead
- Instantly API and webhooks article: https://instantly.ai/blog/api-webhooks-custom-integrations-for-outreach/
- Clay as API docs: https://university.clay.com/docs/using-clay-as-an-api
- Clay integrations FAQ: https://www.clay.com/faq/what-prospecting-data-enrichment-tools-and-crms-can-i-access-with-clay
- Resquared main site: https://re2.ai/
- Google Places Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Places Details: https://developers.google.com/maps/documentation/places/web-service/place-details
- Google Places usage/billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Apify API v2 docs: https://docs.apify.com/api/v2
- FineDine AI home: https://www.finedinemenu.com/en/ai-home/
- FineDine QR dine-in ordering help: https://support.finedinemenu.com/en/articles/6062415-qr-dine-in-ordering-settings
- Apollo API docs: https://docs.apollo.io/
