# Revint x FineDine US-First Compliance Strategy Review

Status: improved strategy after full plan review  
Date: 2026-05-29  
Language: Turkish  
Audience: Revint founder team, product, engineering, sales, FineDine activation stakeholders  
Project: Revint Restaurant-Tech Operational Intelligence Pilot for FineDine, US-first version

> Not: Bu dokuman hukuki danismanlik degildir. US outreach, privacy ve telemarketing kurallari hizli degisebildigi icin launch oncesi US counsel review gereklidir. Bu dokuman product/engineering strateji ve risk tasarimi icindir.

## 1. Yeni ana karar

Onceki planin ana tezi dogru: Revint veri kaynagi olmak yerine restaurant-tech ekipleri icin post-enrichment operational intelligence layer olmali. Ancak proje artik US merkezli dusunulecekse planin ilk sirasi degismeli.

Eski ana sira:

1. Native integrations.
2. Account intelligence.
3. Closed-loop learning.

Yeni US-first ana sira:

1. Compliance substrate.
2. CRM/sender/outcome rails.
3. Storeable and auditable data rails.
4. Field/density/referral workflow.
5. Account intelligence.
6. Outcome learning.

US markette "native-first" tek basina guclu ama eksik bir stratejidir. Cunku outbound email, owner mobile, SMS, AI voice, phone calls, data resale, Google Places storage ve state privacy haklari ayni anda risk yaratir. Bu yuzden dogru kategori cumlesi su sekilde daraltilmali:

> Revint is the compliance-aware operational intelligence layer for US restaurant-tech GTM teams: it connects CRM, sender and approved data sources, turns restaurant signals into rep-ready actions, and learns from outcomes without becoming a spam engine or data broker.

Bu karar product promise'i de degistirir:

> Connect HubSpot, connect one compliant sender, choose approved data rails, define your US target market, then Revint builds restaurant account briefs, field-ready next actions, suppression-safe activation lists, and an auditable outcome loop.

## 2. Plan hakkinda genel hukum

Mevcut plan yon olarak iyi ama US launch icin fazla "integration-forward". En buyuk zayiflik teknik kapsam buyuklugu degil, compliance ve workflow varsayimlari.

Plan sunlari iyi yakalamis:

- Revint'in Openmart, Orbital, Clay, HubSpot, Smartlead, Instantly ve Google Places gibi araclari replace etmemesi gerektigini dogru soyluyor.
- FineDine icin "QR menu eksigi" yerine restaurant-specific digital stack angle secimini dogru merkeze aliyor.
- HubSpot'u CRM truth source, sender'lari activation rail, Revint'i learning/judgment layer olarak ayirmasi dogru.
- Source provenance ve conflict resolution ihtiyacini dogru tespit ediyor.
- Existing Revint code reality tarafinda semantic memory, AI Core, Apify, Gmail/Outlook, Google Places, account/lead/activity modellerini dogru okuyor.

Plan su noktalarda zayif:

- US compliance substrate'i integration roadmap'in icine gomuyor; halbuki P0 olmali.
- Cold email ve sender entegrasyonunu fazla merkeze aliyor; restaurant-tech US motion'inda field visit, local density, referrals ve channel partnerships cok kritik.
- Google Places data storage ve attribution/policy riskini yeterince ayirmiyor.
- HubSpot private app path'i "native webhook" gibi ele aliyor; HubSpot docs private app webhook settings'in API ile editlenemedigini soyluyor.
- Owner/contact/mobile enrichment'i product value gibi sunuyor ama US TCPA/DNC/state privacy acisindan bunu risk sinifi olarak ele almiyor.
- "Outcome learning" iddiasini 30 gunde fazla guclu kuruyor; 30 gunde learning proof olur ama istatistiksel playbook ogrenimi olmaz.
- US state privacy, California B2B data, data broker siniri, deletion/opt-out ve suppression architecture yok.

## 3. Kanit ozeti

### 3.1 US commercial email: CAN-SPAM opt-out ve truthfulness gerektirir

FTC'nin CAN-SPAM rehberi ticari email icin misleading header/subject yasagi, reklam/mesaj niteligini gizlememe, fiziksel posta adresi, clear opt-out ve opt-out'lari 10 business day icinde honor etme gibi kurallari listeler. Third-party vendor kullanimi da sorumlulugu kaldirmaz.

Kaynak: FTC CAN-SPAM compliance guide  
https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

Implication:

- Revint email gondermiyorsa bile generated sequence fields, unsubscribe merge field, sender identity, physical address ve suppression status uretmelidir.
- Smartlead/Instantly'e giden her contact icin `email_permission_basis`, `suppression_status`, `last_opt_out_at`, `source_provider`, `source_observed_at` gibi alanlar zorunlu olmalidir.
- "AI writes opener" yeterli degildir; "AI writes CAN-SPAM-safe opener variables" product requirement olmali.

### 3.2 US calls/SMS/AI voice: TCPA, TSR ve DNC riskleri emailden daha yuksek

FCC ve FTC kaynaklari, robocalls/robotexts ve artificial/prerecorded voice kullanimi icin consent riskini netlestiriyor. FTC'nin 2024 TSR degisiklikleri B2B telemarketing tarafinda deception/misrepresentation kurallarini guclendiriyor ve small business victim riskini acikca ele aliyor. FCC, AI-generated voice'lari TCPA kapsaminda artificial/prerecorded voice olarak degerlendiriyor.

Kaynaklar:

- FTC TSR amendments and B2B misrepresentation: https://www.ftc.gov/node/86937
- FTC telemarketing guidance: https://www.ftc.gov/business-guidance/advertising-marketing/telemarketing
- FCC AI-generated voice ruling material: https://docs.fcc.gov/public/attachments/DOC-400393A1.pdf

Implication:

- Revint MVP'de SMS marketing, AI voice call, autodialer, prerecorded voicemail ve auto-call feature olmamalidir.
- Manual call task ve field visit task olabilir, ama number type, DNC/suppression, consent/source ve call disposition loglanmalidir.
- Owner mobile "high-value data" degil, "high-risk channel" olarak tasarlanmalidir.

### 3.3 California ve state privacy: B2B contact data artik otomatik guvenli alan degil

California AG CCPA sayfasi CPRA amendments'in 1 Ocak 2023'ten itibaren yururlukte oldugunu, statutory requirements'in uygulanmasi gerektigini ve data broker tanimini acikliyor. CPPA data broker sayfasi, direct relationship olmayan consumer personal information'i toplayip third party'lere satan business'larin data broker sayilabilecegini anlatiyor. IAPP tracker, US state privacy law sayisinin ve variation'in hizla arttigini gosteriyor.

Kaynaklar:

- California AG CCPA page: https://oag.ca.gov/privacy/ccpa
- CPPA data broker information: https://cppa.ca.gov/data_brokers/
- IAPP US State Privacy Legislation Tracker: https://iapp.org/resources/article/us-state-privacy-legislation-tracker/

Implication:

- Revint "data broker" gibi konumlanmamalidir. FineDine icin processor/service provider posture hedeflenmelidir.
- Contact enrichment source'lari icin "license allows storage/use for outreach?" kontrolu olmadan data urune alinmamalidir.
- Deletion, access, opt-out, suppression, retention ve data source audit log P0 olmalidir.

### 3.4 Google Places: canonical identity iyi, raw database kaynagi olarak riskli

Google Places policies sayfasi Places API content'in allowed exceptions disinda pre-fetch/cache/store edilemeyecegini, place_id'nin caching restriction'dan exempt oldugunu soyluyor. Usage/billing docs field masks ile yalniz gerekli field'larin istenmesini oneriyor.

Kaynaklar:

- Google Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Place IDs: https://developers.google.com/maps/documentation/places/web-service/place-id
- Google Places usage and billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing

Implication:

- Planin `ExternalRecord(provider="google_places", rawJson=...)` yaklasimi legal/policy review olmadan uygulanmamali.
- Google Places icin store strategy: `place_id`, retrieval timestamp, request field mask, internal derived risk flags, and maybe transient cache. Raw Places content kalici source table'a yazilmamali.
- Openmart gibi "structured JSON you can store" diyen data rail'ler ile Google Places ayni source policy sinifinda degildir.

### 3.5 HubSpot private app path dogru ama webhook promise'i revize edilmeli

HubSpot usage docs private/static auth token yolunu single-account app icin kabul ediyor; private app token ile CRM API kullanilabilir. Ancak HubSpot Webhooks API dokumaninda private app webhook settings'in API ile editlenemedigi, in-app settings tarafindan yonetildigi yaziyor. Public/OAuth app webhook subscriptions daha tekrar edilebilir SaaS path'idir.

Kaynaklar:

- HubSpot API usage and limits: https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines
- HubSpot webhooks API: https://developers.hubspot.com/docs/guides/api/app-management/webhooks
- HubSpot private apps: https://developers.hubspot.com/docs/api/private-apps
- HubSpot properties API: https://developers.hubspot.com/docs/api/crm/properties

Implication:

- Day 1 private app path: CRM read/write plus scheduled delta sync.
- If webhook needed in Day 1: user manually configures private app webhook settings or Revint uses a public/OAuth app.
- Roadmap "private app token + webhook subscriptions fully automated" diye yazilmamali.

### 3.6 US restaurant-tech GTM: field, density, referrals ve local ecosystem var

SaaStr'in Toast CRO analizlerinde restaurant-tech satisinin restaurant density, field reps, social proof, referrals ve local ecosystem uzerinden calistigi vurgulaniyor. Bir kaynak Toast'ta on-site visit alan prospect'lerde 45% vs 15% conversion gibi 3x fark iddiasini aktariyor; diger kaynaklar field reps'in dense territories'de calistigini ve one-in-five deal referral etkisini anlatiyor.

Kaynaklar:

- SaaStr, 10 Things Different in Vertical SMB Sales with Toast CRO: https://www.saastr.com/10-things-that-are-different-in-vertical-smb-sales-with-toasts-cro/
- SaaStr, Top 10 Strategies Toast CRO Uses: https://www.saastr.com/the-top-10-strategies-toasts-cro-uses-to-crush-quotas/
- SaaStr, CRO Confidential Toast GTM: https://www.saastr.com/cro-confidential-a-look-inside-saas-success-toast-with-cro-jonathan-vassil/

Implication:

- FineDine US pilotu sadece Smartlead/Instantly campaign loop olmamali.
- Revint brief output'u `EMAIL_NOW` kadar `FIELD_VISIT`, `CALL_BETWEEN_SHIFTS`, `ASK_FOR_REFERRAL`, `ROUTE_TO_PARTNER`, `SUPPRESS`, `ENRICH_MORE` gibi actions icermeli.
- Territory density ve local social proof, scoring'e girmeli.

### 3.7 Restaurant operator needs: digital ordering/payment/loyalty/labor/profitability

National Restaurant Association 2024 Technology Landscape Report, operatorlerin %76'sinin technology'nin competitive edge sagladigini soyledigini ve consumers icin order/pay convenience'in onemli oldugunu gosteriyor. Report snippet'lerinde digital marketing/location marketing, loyalty/reward systems, POS, contactless ordering/payment ve labor management gibi investment categories geciyor.

Kaynaklar:

- NRA Restaurant Technology Landscape Report 2024: https://restaurant.org/research-and-media/research/research-reports/2024-technology-landscape-report/
- NRA report PDF: https://go.restaurant.org/rs/078-ZLA-461/images/NatRestAssoc_TechLandscapeReport_2024.pdf
- Square Future of Restaurants 2025: https://squareup.com/us/en/townsquare/future-of-restaurants/

Implication:

- FineDine pitch taxonomy US'te "QR menu"den baslamamali.
- Default modules: order/pay convenience, loyalty/reward, marketing/customer data, menu updates, reservation/no-show, labor efficiency, direct ordering margin, multi-location control.
- Brief her account icin "operator outcome" yazmali: daha hizli order/pay, daha az labor friction, daha fazla repeat visit, daha az third-party dependency, daha iyi menu governance.

## 4. Zayif noktalar ve duzeltilmis kararlar

### Zayif nokta 1: Native-first, compliance-first degil

Mevcut plan native connector'lari stratejik sinyal olarak one koyuyor. US launch'ta bu yanlis siralama. Native connector'lar compliance evidence olmadan buyume riskini hizlandirir.

Duzeltme:

P0 "Compliance substrate" eklenmeli:

- `ContactChannelPermission`
- `SuppressionEntry`
- `ConsentEvidence`
- `DataSourcePolicy`
- `DataProcessingRole`
- `DataRetentionRule`
- `ComplianceAuditLog`
- `ProviderTermsSnapshot`

Her activation action, once bu substrate'den gecmeli.

### Zayif nokta 2: Owner mobile enrichment value gibi anlatiliyor

Openmart/Orbital gibi kaynaklar owner mobile/contact coverage sunabilir. US tarafinda bu, ozellikle mobile/SMS/auto-call icin yuksek riskli channel'dir.

Duzeltme:

Contact fields risk sinifina ayrilmali:

| Contact field | Risk | Default activation |
|---|---:|---|
| Business main phone | Medium | Manual call task only |
| Public business email | Medium | CAN-SPAM-safe email |
| Role email like info@ | Low-Medium | Email only |
| Owner direct email | Medium-High | Email with source/provenance |
| Owner mobile | High | Manual review; no SMS/autodial/AI voice |
| Personal social handle | High | No automated outreach in MVP |

### Zayif nokta 3: Google Places raw storage planliyor

Source provenance ihtiyaci dogru ama Google Places content'i raw external record olarak saklamak policy riskidir.

Duzeltme:

Provider-based storage policy:

- Google Places: store `place_id` and internal derived fields only after counsel/product review; raw response transient.
- Openmart: store raw JSON if contract/API terms allow; cited source says endpoints return structured JSON that can be stored.
- HubSpot: store synced CRM IDs, selected fields, event snapshots as processor.
- Smartlead/Instantly: store event payloads required for attribution and suppression.
- Apify: store only allowed scraped output, with crawl source and exclusion handling; avoid blocked/restricted content.

### Zayif nokta 4: HubSpot private app webhook path fazla iyimser

Private app token hizli native read/write icin iyi. Ama webhook subscriptions icin private app settings UI limitation var.

Duzeltme:

HubSpot roadmap:

1. Day 1-7: private app read/write, property setup, scheduled delta sync.
2. Day 7-14: manual webhook setup checklist OR polling-based outcome sync.
3. Day 15-30: OAuth app path for repeatable installs and webhook subscriptions.
4. Later: CRM cards/UI extensions if reps need in-HubSpot brief surface.

### Zayif nokta 5: Sender loop compliance kapisiz

Smartlead ve Instantly event capture dogru. Ancak plan, send eligibility'yi sender'a birakiyor gibi duruyor.

Duzeltme:

Revint sender'a yalniz `activation_eligible=true` olan contacts push etmeli. Eligibility:

- email present and syntactically valid
- not suppressed
- no bounce history
- source license allows outreach
- CAN-SPAM fields available
- no obvious role/personal mismatch
- workspace physical address configured
- unsubscribe route configured
- campaign purpose not deceptive

### Zayif nokta 6: Smartlead ve Instantly ayni anda build edilmemeli

Plan bir noktada ikisini de launch-critical gibi tutuyor. Bu MVP scope'u sisirir.

Duzeltme:

FineDine'in mevcut stack'i bilinmeden birini sec:

- If Smartlead: build Smartlead fully, Instantly CSV fallback.
- If Instantly: build Instantly V2 fully, Smartlead CSV fallback.

Instantly icin V2 zorunlu kabul edilmeli; Instantly Help Center API V1'in 19 Ocak 2026'da deprecated oldugunu soyluyor.

Kaynak: https://help.instantly.ai/en/articles/10432807-api-v2

### Zayif nokta 7: Restaurant-tech workflow sender-first yazilmis

US restaurant-tech icin email gerekli ama tek channel degil. Owner/GM desk worker degil; email bakmayabilir. Toast GTM kaynaklari field, local ecosystem ve referrals'in agirligini gosteriyor.

Duzeltme:

Next-best-action taxonomy genisletilmeli:

- `EMAIL_NOW`
- `CALL_BETWEEN_SHIFTS`
- `FIELD_VISIT`
- `CREATE_HUBSPOT_TASK`
- `ASK_CUSTOMER_REFERRAL`
- `ROUTE_TO_FIELD_REP`
- `ROUTE_TO_PARTNER`
- `ENRICH_DECISION_MAKER`
- `SUPPRESS_BAD_FIT`
- `WAIT_FOR_TRIGGER`

### Zayif nokta 8: 30 gunluk outcome learning iddiasi fazla iddiali

30 gunde reply/booked/no-show eventleri gelebilir ama statistically meaningful playbook learning icin sample size dusuk olabilir.

Duzeltme:

30 gun hedefi "learning proof" olmali:

- outcome events normalize edildi mi?
- source/pitch/action attribution calisiyor mu?
- human reviewer correction memory'ye donuyor mu?
- false positive signals listeleniyor mu?
- next action bir outcome sonrasi degisebiliyor mu?

"Which signal converts" iddiasi 60-90 gunluk scale phase'e tasinmali.

### Zayif nokta 9: Data broker boundary yok

Revint "Openmart/Google/Apify ile restoran buluyoruz ve FineDine'e veriyoruz" gibi anlatilirsa data broker algisi ve privacy obligation buyur.

Duzeltme:

Role language:

- Revint is not selling a standalone list.
- Revint processes FineDine workspace data and approved provider data to produce account intelligence.
- Revint does not resell contact data across customers.
- Cross-customer learning uses aggregated, non-identifying playbook patterns only.
- Provider data rights are tracked per provider and per workspace.

### Zayif nokta 10: AI-native autonomy compliance riskini buyutuyor

"Sistem outreach'i optimize eder ve basarisiz pattern'leri birakir" gibi cümleler uzun vadede dogru olabilir, ama US compliance ve deliverability acisindan MVP'de tehlikeli okunur.

Duzeltme:

MVP posture:

- AI recommends.
- Human approves.
- Existing sender sends.
- CRM stores truth.
- Revint records why.

Autonomous sending, autonomous SMS, AI voice, auto-dialing, automated voicemail drop yok.

### Zayif nokta 11: US state-by-state go-to-market gating eksik

California, Florida, Texas gibi state'lerde privacy/telemarketing/call recording ve mini-TCPA riskleri farkli olabilir. Plan geography'yi sadece TAM olarak goruyor.

Duzeltme:

US geography object sadece market degil, compliance profile da olmali:

- state
- call recording consent rule
- state privacy applicability
- DNC sensitivity
- owner mobile usage policy
- recommended channels
- excluded automations

### Zayif nokta 12: Source conflict resolution var ama source legal policy yok

Plan "hangi data'ya guveniyoruz?" sorusunu cozuyor; "hangi data'yi kullanmaya hakkimiz var?" sorusunu cozmuyor.

Duzeltme:

Trust matrix ikiye ayrilmali:

1. Truth trust: field dogru mu?
2. Use-right trust: bu field'i store/use/activate edebilir miyiz?

Bir field dogru olsa bile use-right dusukse activation'a girememeli.

## 5. Improved US-first product architecture

### 5.1 Katmanlar

#### Layer 0: Compliance substrate

Bu katman olmadan activation yok.

Core jobs:

- contact permission status
- suppression and opt-out
- data source license/use-right tracking
- DNC/manual-call caution
- provider raw storage policy
- audit log
- retention/delete workflow
- role boundary: controller/processor/service provider

#### Layer 1: CRM and outcome truth

HubSpot US pilotunda system-of-record olmaya devam eder.

Day 1 scope:

- private app token read/write
- Company/Contact/Deal standard object mapping
- Revint property group
- scheduled delta sync
- manual webhook setup checklist or polling
- no custom object dependency

#### Layer 2: Activation rails

One sender only:

- Smartlead OR Instantly V2.
- Revint does not replace sender.
- Revint pushes compliant, shortlisted, suppression-safe rows.
- Revint receives reply/bounce/unsubscribe/sent events.
- Revint writes back to HubSpot and internal outcome graph.

Manual/field rails:

- HubSpot task creation
- call disposition log
- field visit outcome
- referral source
- partner intro source

#### Layer 3: Storeable data rails

Priority:

1. HubSpot existing accounts.
2. Openmart as storeable local business data rail if contract permits.
3. Google Places for canonical place ID and freshness checks, with strict storage policy.
4. Apify for selective deep research with crawl policy.
5. Orbital via HubSpot fields if FineDine already uses it.
6. Clay webhook bridge if FineDine has Clay workflows.
7. Resquared/Apollo later.

#### Layer 4: Intelligence core

Revint owns:

- entity resolution
- account/location/contact graph
- field-level source provenance
- use-right-aware source policy
- sub-niche classification
- chain/multi-location detection
- FineDine module mapping
- next-best-action
- Account Intelligence Brief
- human review corrections
- outcome attribution

#### Layer 5: Learning loop

MVP learning should be conservative:

- track what was recommended
- track what was approved
- track what was sent or done
- track what happened
- update insight performance
- write corrected examples to semantic memory
- produce "hypothesis updates", not overconfident causal claims

## 6. Revised integration priority

| Priority | Integration | US-first role | Launch decision |
|---:|---|---|---|
| P0 | Compliance substrate | Gate every action | Must build before native activation |
| P1 | HubSpot | CRM truth, owner, stage, outcomes | Private app + polling first; OAuth/webhooks next |
| P2 | One sender | Email activation and reply/bounce/unsub events | Smartlead or Instantly V2, not both |
| P3 | Openmart | Storeable US local business data rail | Use if contract supports storage/outreach |
| P4 | Google Places | Place ID, freshness, identity validation | Strict field mask and storage policy |
| P5 | Field/call workflow | Restaurant GTM reality | HubSpot tasks and manual outcomes |
| P6 | Apify | Selective deep research | High-fit accounts only |
| P7 | Orbital | Existing SMB signal source | Read via HubSpot fields first |
| P8 | Clay | Customer GTM workflow bridge | Webhook/HTTP action later |
| P9 | Apollo/Resquared | Supplemental source | Not launch-critical |

## 7. Revised data model additions

The previous plan proposed `IntegrationConnection`, `ImportBatch`, `ExternalRecord`, `AccountSignal`, `IntegrationEvent`. Keep those, but add compliance models.

### 7.1 Integration models

- `IntegrationConnection`
  - `workspaceId`
  - `provider`
  - `status`
  - `authType`
  - `encryptedCredentialsJson`
  - `settingsJson`
  - `lastSyncAt`

- `ExternalRecord`
  - `workspaceId`
  - `provider`
  - `externalId`
  - `rawJson`
  - `rawStoragePolicy`
  - `observedAt`
  - `expiresAt`

- `AccountSignal`
  - `workspaceId`
  - `accountId`
  - `leadId`
  - `key`
  - `valueJson`
  - `sourceProvider`
  - `confidence`
  - `truthTrust`
  - `useRightTrust`
  - `observedAt`
  - `expiresAt`

- `IntegrationEvent`
  - `workspaceId`
  - `provider`
  - `eventType`
  - `externalEventId`
  - `leadId`
  - `accountId`
  - `contactId`
  - `rawJson`
  - `normalizedOutcome`
  - `processedAt`

### 7.2 Compliance models

- `ContactChannelPermission`
  - `workspaceId`
  - `contactKey`
  - `channel`: email, phone, sms, social, field
  - `status`: eligible, suppressed, opt_out, bounced, consent_required, manual_review
  - `basis`: public_business_contact, provider_contact, existing_relationship, consent, manual_entry
  - `sourceProvider`
  - `evidenceRefType`
  - `evidenceRefId`
  - `updatedAt`

- `SuppressionEntry`
  - `workspaceId`
  - `channel`
  - `valueHash`
  - `reason`: unsubscribe, bounce, dnc, manual, deletion_request, provider_restriction
  - `source`
  - `createdAt`

- `ConsentEvidence`
  - `workspaceId`
  - `contactKey`
  - `channel`
  - `consentType`
  - `capturedAt`
  - `source`
  - `rawEvidenceJson`

- `DataSourcePolicy`
  - `workspaceId`
  - `provider`
  - `canStoreRaw`
  - `canUseForOutreach`
  - `canShareToCRM`
  - `canShareToSender`
  - `retentionDays`
  - `policyVersion`
  - `reviewedAt`

- `ComplianceAuditLog`
  - `workspaceId`
  - `actorUserId`
  - `action`
  - `leadId`
  - `contactKey`
  - `decisionJson`
  - `createdAt`

## 8. Revised Account Intelligence Brief

US-first brief fields:

- Account overview
- Location and chain context
- US metro and state
- Restaurant sub-niche
- FineDine fit summary
- Detected digital stack
- Missing or weak operational modules
- Operator pain hypothesis
- Source provenance
- Use-right status
- Contact channel eligibility
- Recommended next action
- Field/call/email route
- Suggested pitch angle
- Suggested module/package
- Compliance risk flags
- HubSpot sync status
- Last outcome and learning note

New required flags:

- `email_eligible`
- `phone_manual_only`
- `sms_blocked_without_consent`
- `ai_voice_blocked`
- `google_places_content_not_persisted`
- `source_license_uncertain`
- `owner_mobile_manual_review`
- `california_privacy_sensitive`
- `suppressed`

## 9. US-first FineDine ICP workflow

### Step 0: Compliance and workspace setup

Collect:

- FineDine US entity/sender identity
- physical mailing address for commercial email
- unsubscribe domain/route
- target states/metros
- privacy notice/DPA posture
- approved data sources
- sender tool
- HubSpot admin/contact
- no-SMS/no-AI-voice launch rule acknowledgement

### Step 1: US market definition

Example objective:

> "New York City and North Jersey independent full-service restaurants, 2-10 locations, strong review volume, weak direct ordering or reservation flow, target 20 demos this quarter."

Revint converts this into:

- metro
- state compliance profile
- density zones
- sub-niches
- channel policy
- field vs inside coverage
- data source plan

### Step 2: Source accounts

Order:

1. HubSpot existing companies/deals.
2. Openmart US local business search.
3. Google Places place ID validation.
4. Website/audit worker.
5. Apify only for shortlisted/high-fit accounts.
6. Orbital/Clay/Resquared only if already present in FineDine stack.

### Step 3: Resolve identity and source rights

Revint resolves:

- HubSpot company ID
- account/group
- location
- place ID
- domain
- phone
- contact
- source provider
- use-right status

No account becomes activation eligible until source rights and suppression pass.

### Step 4: Build brief and next action

Decision examples:

- Dense restaurant row + strong local reputation + weak reservation flow -> field visit or call between shifts, reservation/payment angle.
- Multi-location group + inconsistent menus across locations -> HubSpot company brief, enterprise menu governance angle.
- Owner mobile only and no business email -> manual review, no automated SMS.
- Google Places only and no storeable provider record -> validate identity, do not persist raw Google content.
- California business contact from third-party provider -> privacy-sensitive flag, retention and deletion readiness.

### Step 5: Activate through compliant rails

Email:

- push to one sender with unsubscribe fields, physical address, suppression-safe custom variables.

Field:

- create HubSpot task with visit notes, best visit window, route cluster.

Call:

- manual call task only; no autodialer or AI voice in MVP.

Referral:

- link account to nearby FineDine customer, partner, or local ecosystem note.

### Step 6: Outcome capture

Normalize:

- email sent
- email replied
- positive reply
- negative reply
- bounce
- unsubscribe
- manual call connected
- manual call no answer
- field visit completed
- referral intro made
- meeting booked
- no-show
- opportunity created
- closed-won
- closed-lost
- deletion/opt-out request

### Step 7: Learning

Learning writes:

- insight application outcome
- next action outcome
- source provider performance
- contact channel performance
- pitch angle performance
- human correction memory
- false positive pattern

But output wording must stay cautious:

- "early signal"
- "hypothesis strengthened"
- "needs more outcomes"
- "do not scale yet"

## 10. Revised 30/60/90-day plan

### Days 0-7: Compliance and integration foundation

Outputs:

- US workspace compliance policy
- suppression tables
- sender identity and unsubscribe config
- HubSpot private app token
- HubSpot property group
- one sender selected
- provider policy matrix
- Google Places storage policy implemented

Decision gate:

- No activation until compliance gate passes.

### Days 8-21: First US metro data and briefs

Outputs:

- 100-250 restaurant accounts from approved sources
- place ID validation
- 50 account briefs
- 30 FineDine-reviewed briefs
- channel eligibility per contact
- first HubSpot sync
- first field/call/email next actions

Decision gate:

- Brief quality and compliance eligibility acceptable?

### Days 22-45: Controlled activation

Outputs:

- one sender campaign or one field/call workflow
- reply/bounce/unsubscribe ingestion
- HubSpot task/deal/outcome sync
- suppression propagation
- manual reviewer correction loop

Decision gate:

- Are outcomes captured correctly and safely?

### Days 46-90: Learning proof and scale decision

Outputs:

- source performance report
- pitch/action performance report
- field vs email comparison
- top false positives
- sub-niche/module signal report
- next metro recommendation

Decision gate:

- Scale geography, change segment, or stop?

## 11. Revised success metrics

### Compliance readiness

| Metric | Target |
|---|---:|
| Activation rows with source provenance | 100% |
| Activation rows with suppression check | 100% |
| Email rows with unsubscribe-ready fields | 100% |
| Owner mobile auto-SMS/autodial attempts | 0 |
| Google Places raw persistent records without approval | 0 |
| Opt-out propagation time | Under 24h target, legally validate |

### Product quality

| Metric | Target |
|---|---:|
| FineDine-reviewed briefs | 30+ by day 21 |
| Acceptable brief quality | 70% initial, 85% after iteration |
| Chain/independent wrong pitch | Under 10% after QA |
| Source/use-right visibility | 90%+ core fields |
| Field/call/email next action coverage | 80%+ eligible accounts |

### GTM learning

| Metric | Target |
|---|---:|
| Outcome event types captured | 5+ |
| Human correction writes to memory | 20+ |
| First source performance report | Day 45 |
| First pitch/action hypothesis report | Day 60-90 |
| Scale/no-scale decision | Day 90 |

## 12. Revised positioning for FineDine US

Avoid:

- "We find owner mobiles and automate outreach."
- "AI books demos automatically."
- "Connect every source and send at scale."
- "Google Maps database for restaurants."
- "US restaurant owner contact database."

Use:

> Revint helps FineDine's US team decide which restaurant accounts deserve action, which route is safe and sensible, what operational angle to use, and what each outcome teaches the next market.

Short version:

> Compliance-aware restaurant account intelligence for US restaurant-tech GTM.

Founder call version:

> We are not replacing HubSpot, Smartlead, Instantly, Openmart, Orbital or field reps. We sit above them. We normalize the restaurant evidence, prevent unsafe activation, recommend the next best action, and learn which signals actually move US restaurant accounts.

## 13. What to build now

Build:

- compliance substrate
- HubSpot private app read/write + polling
- one sender native integration
- Openmart connector if storage/outreach rights are clear
- Google Places identity validation with strict storage policy
- field/call/referral next action workflow
- Account Intelligence Brief v2
- outcome normalization
- human review correction loop

Do not build yet:

- autonomous sending
- SMS automation
- AI voice calls
- autodialer integration
- full Orbital direct API
- full Clay two-way workflow
- Resquared native connector
- Google Places raw warehouse
- generic US restaurant contact database

## 14. Engineering implications for current Revint code

Current code already has:

- `Lead`, `Account`, `LeadActivity`
- `EmailAccount`
- `SemanticMemory`
- `CommercialInsight`
- `InsightPerformance`
- `LeadNextAction`
- `PlannerSession` and AI Core
- restaurant-tech niche packs
- Google Places discovery
- Apify workers
- Smartlead/Instantly CSV export

Missing for US-first:

- provider connection schema
- provider event schema
- field-level signal table
- compliance permission/suppression schema
- provider storage policy
- HubSpot connector
- one sender native webhook receiver
- opt-out propagation
- channel eligibility gate
- field/call/referral action taxonomy

Implementation rule:

Every workspace-data query must keep `workspaceId` scope. Memory writes still go through `src/lib/ai-core/memory.ts`, not direct Prisma `semanticMemory`.

## 15. Final improved plan

Revint should keep the post-enrichment operational intelligence strategy, but the FineDine pilot should be rewritten as a US compliance-aware operating layer, not simply a native integration pilot.

The corrected MVP is:

1. Establish US compliance substrate.
2. Connect HubSpot through private app read/write and polling.
3. Connect exactly one sender natively.
4. Use Openmart or approved provider data for storeable account discovery.
5. Use Google Places primarily for place identity and freshness, with strict storage policy.
6. Generate Account Intelligence Briefs with source provenance and use-right status.
7. Recommend email, manual call, field visit, referral, enrich-more or suppress actions.
8. Capture outcomes from sender, HubSpot and manual workflows.
9. Learn cautiously from outcomes and human corrections.
10. Decide scale after 60-90 days, not after a single 30-day sample.

Strategic sentence:

> Openmart and Orbital can find SMB accounts. HubSpot stores pipeline. Smartlead and Instantly send email. Field reps build local trust. Revint decides which account action is safe, timely and commercially intelligent, then learns from what happened.

## 16. Source list

Compliance and privacy:

- FTC CAN-SPAM Act Compliance Guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- FTC Telemarketing Sales Rule amendments: https://www.ftc.gov/node/86937
- FTC Telemarketing guidance: https://www.ftc.gov/business-guidance/advertising-marketing/telemarketing
- FCC AI-generated voice ruling material: https://docs.fcc.gov/public/attachments/DOC-400393A1.pdf
- California AG CCPA page: https://oag.ca.gov/privacy/ccpa
- CPPA data broker information: https://cppa.ca.gov/data_brokers/
- IAPP US State Privacy Legislation Tracker: https://iapp.org/resources/article/us-state-privacy-legislation-tracker/

Restaurant-tech GTM and operator context:

- SaaStr, 10 Things Different in Vertical SMB Sales with Toast CRO: https://www.saastr.com/10-things-that-are-different-in-vertical-smb-sales-with-toasts-cro/
- SaaStr, Toast CRO sales strategies: https://www.saastr.com/the-top-10-strategies-toasts-cro-uses-to-crush-quotas/
- SaaStr, CRO Confidential Toast GTM: https://www.saastr.com/cro-confidential-a-look-inside-saas-success-toast-with-cro-jonathan-vassil/
- National Restaurant Association Technology Landscape Report 2024: https://restaurant.org/research-and-media/research/research-reports/2024-technology-landscape-report/
- NRA report PDF: https://go.restaurant.org/rs/078-ZLA-461/images/NatRestAssoc_TechLandscapeReport_2024.pdf
- Square Future of Restaurants 2025: https://squareup.com/us/en/townsquare/future-of-restaurants/

Integration and data source docs:

- HubSpot API usage and limits: https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines
- HubSpot Webhooks API: https://developers.hubspot.com/docs/guides/api/app-management/webhooks
- HubSpot private apps: https://developers.hubspot.com/docs/api/private-apps
- HubSpot properties API: https://developers.hubspot.com/docs/api/crm/properties
- Smartlead campaign webhooks: https://api.smartlead.ai/api-reference/campaigns/get-webhooks
- Smartlead webhook guide: https://api.smartlead.ai/guides/webhook-integration
- Instantly API V2: https://help.instantly.ai/en/articles/10432807-api-v2
- Instantly webhooks: https://help.instantly.ai/en/articles/6261906-how-to-use-webhooks
- Openmart Local Business Data API: https://www.openmart.com/products/local-business-data-api
- Openmart API tutorial: https://www.openmart.com/product-tutorials/using-the-openmart-api-to-fetch-data
- Orbital main site: https://www.withorbital.com/
- Orbital bidirectional CRM sync docs: https://docs.withorbital.com/integrations/overview-bidirectional-crm-sync
- Google Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Place IDs: https://developers.google.com/maps/documentation/places/web-service/place-id
- Google Places usage and billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
