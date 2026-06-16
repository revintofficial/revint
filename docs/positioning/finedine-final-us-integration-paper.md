# LeadAC x FineDine Final US Integration Paper

Status: final integration strategy paper  
Date: 2026-05-29  
Language: Turkish  
Audience: LeadAC founders, product, engineering, sales, FineDine activation stakeholders  
Project: LeadAC Restaurant-Tech Operational Intelligence Pilot for FineDine, US-first

> Not: Bu dokuman hukuki danismanlik degildir. US outbound, privacy, telemarketing ve data-provider terms konulari launch oncesi US counsel ve vendor contract review ile dogrulanmalidir.

## 1. Final karar

Entegrasyonlar genel olarak uygulamanin amacina uygun konumlaniyor, ama mevcut planin revize edilmesi gereken kritik noktasi su:

> LeadAC'in entegrasyon stratejisi "ne kadar cok tool baglanirsa o kadar iyi" degil, "hangi tool LeadAC'in account judgment + safe activation + outcome learning dongusunu tamamlar?" olmalidir.

LeadAC'in FineDine icin asil urun amaci:

1. US restoran account'larini dogru tanimlamak.
2. FineDine icin operasyonel fit ve pitch angle secmek.
3. Email, manual call, field visit, referral veya suppress gibi safe next action onermek.
4. HubSpot/sender/manual workflow'lardan outcome almak.
5. Bu outcome'lari source, signal, action ve pitch performansina cevirmek.

Bu amaca gore final entegrasyon karari:

- HubSpot mantikli ve launch-critical: CRM truth + outcome source.
- One sender mantikli ve launch-critical: Smartlead veya Instantly V2, ikisi birden degil.
- Openmart mantikli ama "primary data rail" olarak: database replacement degil, storeable market fill.
- Google Places mantikli ama "canonical verifier" olarak: raw lead database degil.
- Apify mantikli ama "selective deep research" olarak: her account'a bulk enrichment degil.
- Field/call/manual workflow mantikli ve US restaurant-tech icin kritik: email-only motion yanlis olur.
- Orbital mantikli ama MVP'de direct connector degil: varsa HubSpot-mediated signal source.
- Clay mantikli ama extension surface: launch-critical core degil.
- Apollo mantikli ama sadece chain/HQ/corporate contacts icin: local owner source degil.
- Resquared mantikli ama opportunistic adapter: core loop icin sart degil.
- FineDine offer context entegrasyonu en az teknik connector'lar kadar kritik: offer ontology yoksa intelligence yanlis pitch uretir.
- Compliance substrate butun entegrasyonlardan once gelir: US-first product'ta P0 budur.

Final category sentence:

> LeadAC is the compliance-aware operational intelligence layer for US restaurant-tech GTM teams. It connects CRM, one sender, approved data rails and field workflows; turns restaurant signals into safe next actions; and learns from outcomes.

## 2. Entegrasyon fit testi

Her entegrasyon su 7 sorudan gecmeli:

1. Account truth'u iyilestiriyor mu?
2. FineDine operational fit kararini iyilestiriyor mu?
3. Safe activation'i mumkun kiliyor mu?
4. Outcome'u geri getiriyor mu?
5. Source provenance veya conflict resolution'a veri veriyor mu?
6. Learning loop'a tekrar kullanilabilir sinyal birakiyor mu?
7. Olmasa MVP yine calisir mi?

Bu testten gecmeyen entegrasyon launch-critical olmamalidir. FineDine pilotu icin "nice to have" entegrasyonlari build etmek product sinyalini guclendirmez; aksine P0 riskleri ve implementation debt'i buyutur.

## 3. Final entegrasyon mimarisi

### Layer 0: Compliance and use-right gate

Bu teknik connector degil, ama butun connector'larin onundeki kapidir.

Islev:

- contact channel eligibility
- unsubscribe/opt-out/suppression
- bounce suppression
- source license/use-right status
- Google Places storage policy
- owner mobile/manual review policy
- state/metro compliance profile
- audit log

Bu layer olmadan sender push, CRM writeback veya field/call task otomasyonu acilmamalidir.

### Layer 1: System-of-record and outcome truth

Primary integration:

- HubSpot

Islev:

- account/company/contact/deal truth
- owner assignment
- stage/lifecycle
- meeting/opportunity/won/lost
- notes/tasks/calls where available
- manager-visible context

HubSpot, LeadAC'in yerine gecmesi gereken bir CRM degildir. HubSpot, LeadAC'in ogrenmesi gereken truth source'tur.

### Layer 2: Activation rails

Primary integration:

- Smartlead or Instantly V2

Secondary/manual activation:

- Gmail/Outlook, if already connected
- HubSpot tasks
- manual call and field visit workflow

Sender'lar mesajlari tasir. LeadAC sender olmaya calismamalidir. LeadAC'in isi kimi, ne zaman, hangi reason/pitch ile, hangi channel'dan aktive etmenin mantikli ve safe oldugunu belirlemektir.

### Layer 3: Storeable market and enrichment rails

Primary storeable rail:

- Openmart, if contract/use-rights are acceptable

Canonical verifier:

- Google Places, with strict field masks and storage restrictions

Selective deep research:

- Apify

Optional existing-stack rails:

- Orbital via HubSpot fields
- Clay webhook/import
- Resquared export/import
- Apollo for chain/HQ contacts

### Layer 4: LeadAC intelligence core

LeadAC owns:

- identity resolution
- account/location/contact graph
- source provenance
- source conflict resolution
- use-right-aware signal model
- sub-niche classification
- chain/multi-location detection
- FineDine offer/module matching
- Account Intelligence Brief
- next-best-action
- outcome attribution
- behavioral memory

### Layer 5: Learning and reporting

LeadAC learns:

- which data source produced usable accounts
- which signals correlated with human approval
- which pitch/action got replies, calls, visits, meetings or won deals
- which signals were false positives
- which sub-niches and metros deserve more coverage

MVP learning language must stay cautious: "early signal", "hypothesis", "needs more outcomes". Do not claim statistical causality after one short pilot.

## 4. Final priority stack

| Priority | Integration / capability | Final role | Why it belongs | Launch decision |
|---:|---|---|---|---|
| P0 | Compliance substrate | Action gate | US-first outbound cannot scale safely without suppression, opt-out, use-right and audit state | Build first |
| P1 | HubSpot | CRM truth + outcomes | Closed-loop learning needs deal/account truth; reps/managers already live there | Launch-critical |
| P2 | One sender | Email activation + reply/bounce/unsub | Needed for first email outcome loop | Choose Smartlead or Instantly V2 |
| P3 | Field/call/manual workflow | Restaurant GTM reality | US restaurant-tech is not email-only; field, call, referral matter | Launch-critical as workflow, not vendor-heavy |
| P4 | Openmart | Storeable market/data rail | Provides restaurant/contact/tech-stack market fill without LeadAC becoming a database company | Use if terms pass |
| P5 | Google Places | Place identity and freshness verifier | Strong canonical place ID, rating/review/open status checks | Strict storage policy |
| P6 | Apify | Selective deep research | Useful for reviews/site/social/SERP depth, but costly | High-fit only |
| P7 | FineDine offer context | Product/pitch ontology | Without offer context, recommendations become generic | Launch-critical |
| P8 | Orbital | Existing upstream signal source | Good SMB signal provider but positioning overlap and partner dependency | HubSpot-mediated first |
| P9 | Clay | Extension surface | Good for GTM ops experiments, not core product loop | Webhook/import later |
| P10 | Apollo | Corporate contact supplement | Useful for restaurant groups/HQ, weak for local owner discovery | Later |
| P11 | Resquared | Opportunistic source/workflow | Useful if customer already uses it | Later/import |

## 5. Integration-by-integration final evaluation

### 5.1 HubSpot

Final position:

> HubSpot is the system-of-record and outcome rail. LeadAC should enrich and learn from HubSpot, not replace it.

Why it fits:

- Account intelligence only compounds if outcomes return.
- FineDine leadership needs manager-visible evidence inside CRM.
- CRM stage, deal status, owner, meeting and lost reason are more authoritative than sender events.

Launch scope:

- Private app token path for design partner speed.
- Company/contact/deal read/write.
- LeadAC property group and standard properties.
- Upsert company/contact.
- Create deal only after shortlist/qualification, not for every restaurant.
- Scheduled delta sync first.
- Webhook support only with manual private-app setup or OAuth app path.

Important constraint:

HubSpot private apps support webhooks, but HubSpot docs say subscriptions cannot be edited programmatically through an API and must be edited in private app settings. Therefore "private app + fully automated webhook subscription" should not be promised.

Final verdict:

- Keep.
- Make P1.
- Do not overbuild custom objects in MVP.
- Do not create a deal for every imported restaurant.

### 5.2 Smartlead

Final position:

> Smartlead is an activation and email-outcome rail, not the intelligence layer.

Why it fits:

- Smartlead webhooks cover useful events such as sent, opened, replied, bounced and unsubscribed.
- Reply/bounce/unsubscribe are directly needed for suppression, outcome attribution and source quality scoring.

Launch scope if selected:

- API key connection.
- Campaign read/list.
- Push eligible shortlisted contacts.
- Include `leadac_lead_id`, `leadac_account_id`, `source_provider`, `pitch_angle`, `unsubscribe_context` as custom variables where possible.
- Webhook receiver for `EMAIL_REPLIED`, `EMAIL_BOUNCED`, `LEAD_UNSUBSCRIBED`, optionally `EMAIL_SENT`.
- Idempotency by provider event/message/campaign/lead identifiers.
- Immediate suppression write on bounce/unsubscribe.

Final verdict:

- Keep.
- Build only if FineDine uses Smartlead.
- If selected, make it the only native sender for MVP.

### 5.3 Instantly

Final position:

> Instantly is the alternate activation rail. It should not be built in parallel with Smartlead unless FineDine actually needs it.

Why it fits:

- Same product role as Smartlead: campaign membership and email event loop.
- Instantly API V2 has granular API scopes and V1 was deprecated on January 19, 2026 according to Instantly Help Center.

Launch scope if selected:

- API V2 only.
- Lead create/update.
- Campaign assignment.
- Webhook receiver for reply/bounce/unsubscribe/interested/meeting where available.
- Same normalized outcome vocabulary as Smartlead.

Final verdict:

- Keep as sender option.
- Do not build alongside Smartlead in MVP.
- If FineDine uses Instantly, Smartlead remains CSV fallback.

### 5.4 Gmail/Outlook

Final position:

> Gmail/Outlook are manual/semi-manual activation and reply-capture rails.

Why it fits:

- Current code already has email account connection.
- Useful for founder-led or low-volume rep outreach.
- Good fallback when FineDine has no sender.

Launch scope:

- Keep existing connection.
- Use for manual send/copy flows.
- Ingest replies where current inbox sync supports it.
- Still apply compliance/suppression gate before generating/send-ready content.

Final verdict:

- Keep.
- Not primary sender for scale.
- Useful fallback and human-in-the-loop channel.

### 5.5 Field/call/manual workflow

Final position:

> Field/call workflow is not a fallback; it is core to US restaurant-tech GTM.

Why it fits:

- Restaurant buyers often operate offline and locally.
- US restaurant-tech motions often depend on density, field visits, referrals and local proof.
- Email-only activation would underfit the ICP.

Launch scope:

- HubSpot task creation.
- Manual call disposition.
- Field visit next action.
- Best visit/call window.
- Nearby account cluster.
- Referral source field.
- Manual outcome capture.

Do not build:

- autodialer
- AI voice
- automated SMS
- prerecorded voicemail

Final verdict:

- Promote to P3.
- Build as workflow and data model first, not as telephony vendor integration.

### 5.6 Openmart

Final position:

> Openmart is the primary storeable market fill and enrichment rail, not the product moat.

Why it fits:

- Openmart positions its local business API around 200M+ businesses, 50+ fields, emails, social profiles, owner contacts, tech stack and local business search.
- It gives LeadAC a way to source US restaurant markets without building a local business database.
- It is more aligned with lead-generation/storage use cases than Google Places.

Launch scope:

- API key connection or LeadAC-managed provider account.
- Search by US metro/sub-niche.
- Store raw response only if provider terms and contract allow.
- Selective people/contact lookup only for high-fit/shortlisted accounts.
- Tech-stack detection only when it affects FineDine pitch.
- Provider freshness timestamps.
- Cost controls.

Trust policy:

- High trust for market fill, website, category, social links and candidate contacts.
- Medium trust for owner/contact and tech stack until verified by bounce/manual/website/CRM.
- Lower trust for open/closed status and exact chain/location count unless cross-checked.

Final verdict:

- Keep.
- Make P4.
- Do not spend contact lookup cost on every account.
- Do not let Openmart define final score; it is evidence, not judgment.

### 5.7 Google Places

Final position:

> Google Places is the canonical place identity and freshness verifier, not a raw lead database.

Why it fits:

- Place ID, name/address, rating/review count, business status and website are strong identity/freshness signals.
- Field masks help cost control.

Why it must be constrained:

- Google Places policies require attribution and restrict how Places content can be stored/cached/displayed.
- Place ID can be treated differently from full Places content, but raw payload warehousing is a policy risk.

Launch scope:

- Use IDs-only / Essentials where possible.
- Store `placeId`, request timestamp, field mask, provider reference and derived internal signals.
- Do not store raw Google Places response as generic `ExternalRecord` unless policy review approves.
- Display required attribution where Google-sourced content is shown.
- Refresh before active outreach where freshness matters.

Final verdict:

- Keep.
- Make P5.
- Rewrite storage policy before implementation.

### 5.8 Apify

Final position:

> Apify is a selective deep research rail for high-fit accounts, not a default enrichment pass.

Why it fits:

- Current LeadAC code already uses Apify workers.
- Apify supports actors, actor runs, datasets and webhooks.
- Useful for deeper reviews, website crawl, social, SERP and ad-library signals.

Why it must be constrained:

- Cost can balloon.
- Scraped data may have terms/privacy constraints.
- Deep research on every account slows the funnel and adds noise.

Launch policy:

- No Apify deep run on every imported row.
- Run lightweight website audit first.
- Run Apify only for high-fit, shortlisted, uncertain, or active opportunity accounts.
- Store source, actor, observedAt and crawl status.
- Do not allow Apify-derived claims in brief unless grounded and source-visible.

Final verdict:

- Keep.
- Make P6.
- Treat as targeted signal amplifier.

### 5.9 Orbital

Final position:

> Orbital is an upstream SMB signal source if FineDine already uses it; it is not a launch-critical connector.

Why it fits:

- Orbital has SMB account-intelligence positioning and CRM sync language.
- Orbital docs say bidirectional CRM sync supports Salesforce, HubSpot and Attio.
- Its signals may be valuable for chain/multi-location, POS, review/social, hiring/new-location patterns.

Why not direct MVP connector:

- Positioning overlap: LeadAC should not look like "another Orbital".
- Partner/API access may be uncertain.
- If Orbital already syncs to HubSpot, HubSpot-mediated ingestion is enough for MVP.

Launch scope:

- Read Orbital-enriched custom fields from HubSpot if present.
- Map to `AccountSignal` with `sourceProvider=orbital`.
- Learn whether Orbital signals correlate with FineDine approval/outcomes.
- Direct connector only after HubSpot + sender + Openmart loop works.

Final verdict:

- Keep as ecosystem source.
- Do not build direct connector in MVP.
- Use HubSpot-mediated route first.

### 5.10 Clay

Final position:

> Clay is a GTM workflow extension surface, not LeadAC's core integration dependency.

Why it fits:

- Technical GTM teams may already run enrichment experiments in Clay.
- Clay can send enriched rows via webhook/HTTP/API-like flows.
- Useful for customer-specific enrichment not worth productizing yet.

Why not core:

- Clay is a workbench. LeadAC should be the packaged vertical judgment layer.
- If LeadAC overdepends on Clay, the product looks like a Clay add-on instead of an intelligence layer.

Launch scope:

- Inbound webhook/import.
- Provider schema validation.
- Map Clay row fields to `AccountSignal`.
- Optional outbound request later for missing enrichment tasks.

Final verdict:

- Keep.
- Build after core loop.
- Treat as extension, not dependency.

### 5.11 Apollo

Final position:

> Apollo is supplemental person/org enrichment for chains and HQ contacts, not primary local restaurant owner discovery.

Why it fits:

- Useful when account is a restaurant group, franchise, corporate HQ or investor-backed hospitality group.
- Less useful for independent local owner/GM data.

Launch scope:

- No MVP native connector.
- CSV/API later for specific corporate contact lookup.
- Use only after account is confirmed as multi-location/group/HQ.

Final verdict:

- Keep for later.
- Do not make launch-critical.

### 5.12 Resquared

Final position:

> Resquared is an optional source/workflow rail if FineDine already uses it.

Why it fits:

- Local business selling workflows and data may overlap with the ICP.
- Could provide source accounts or outreach context.

Why not core:

- API availability and customer usage are uncertain.
- Openmart + HubSpot + sender + field workflow cover the core MVP better.

Launch scope:

- CSV/import or HubSpot-mediated data.
- Direct connector later only if real customer dependency exists.

Final verdict:

- Keep as optional.
- Do not build native in MVP.

### 5.13 FineDine offer context

Final position:

> FineDine offer context is a first-class integration even though it is not a third-party API.

Why it fits:

- LeadAC cannot choose a useful pitch angle without knowing FineDine's modules, packages, pricing posture, disqualifiers and strongest proof.
- Product context is what turns generic restaurant signals into FineDine-specific sales judgment.

Launch scope:

- Offer module ontology.
- Packages and positioning.
- Disqualifiers.
- Approved claims.
- Corrected opener examples.
- Human review feedback.
- Weekly update workflow.

Final verdict:

- Make launch-critical.
- Build as structured workspace config + memory seeds.

## 6. What changes from the previous plan

### Keep

- Post-enrichment operational intelligence positioning.
- HubSpot as CRM truth.
- One sender as email event rail.
- Openmart as upstream local business rail.
- Google Places as identity verifier.
- Apify as deep research rail.
- Orbital/Clay/Resquared/Apollo as ecosystem connectors.
- Source provenance and conflict resolution.
- Closed-loop outcome learning.

### Change

- Compliance substrate becomes P0.
- Field/call workflow moves from fallback to core.
- Smartlead and Instantly become alternatives, not parallel launch builds.
- Google Places raw storage is removed from generic external-record design.
- HubSpot private app path uses polling/manual webhook setup first, OAuth app later.
- Openmart contact lookup becomes selective.
- Orbital direct connector moves later.
- Clay moves later.
- 30-day learning claim becomes learning plumbing proof, not performance conclusion.

### Remove from MVP

- SMS automation.
- AI voice.
- Autodialing.
- Fully autonomous outreach.
- Generic US restaurant contact database.
- Direct Orbital connector.
- Full two-way Clay integration.
- Resquared native connector.
- Apollo native connector.

## 7. Final data flow

### 7.1 Setup flow

1. FineDine workspace is created.
2. FineDine US sender identity and physical address are configured.
3. Compliance policies and suppression tables are initialized.
4. FineDine offer/module ontology is configured.
5. HubSpot private app is connected.
6. One sender is selected.
7. Openmart or other approved data source is enabled.
8. Google Places policy config is enabled.

### 7.2 Account sourcing flow

1. Pull existing HubSpot accounts and deals.
2. Source market fill from Openmart or approved source.
3. Validate identity with Google Places.
4. Auto-group by domain/place/phone/name-address.
5. Run website audit.
6. Compute preliminary fit.
7. Run Apify only if needed.
8. Write normalized account signals.

### 7.3 Brief flow

1. Read normalized signals, not provider-specific raw payloads.
2. Resolve source conflicts.
3. Check use-right and channel eligibility.
4. Classify sub-niche and chain context.
5. Map FineDine module/pitch.
6. Recommend next action.
7. Show confidence, risk flags and source provenance.

### 7.4 Activation flow

Email:

1. Check compliance eligibility.
2. Push only shortlisted/eligible rows to selected sender.
3. Include LeadAC IDs for attribution.
4. Receive sender event webhooks.
5. Write `LeadActivity`, suppression and outcome attribution.

Field/call:

1. Create HubSpot task or LeadAC next action.
2. Show visit/call window and reason.
3. Rep logs outcome.
4. Outcome feeds learning loop.

CRM:

1. Write brief summary and LeadAC properties to HubSpot Company.
2. Create Deal only after shortlist/qualified stage.
3. Poll/read deal stage and outcome.
4. HubSpot outcome overrides sender category for revenue truth.

## 8. Final normalized outcome vocabulary

Email mechanics:

- `EMAIL_SENT`
- `EMAIL_REPLIED`
- `EMAIL_BOUNCED`
- `EMAIL_UNSUBSCRIBED`
- `EMAIL_NEGATIVE_REPLY`
- `EMAIL_POSITIVE_REPLY`

Manual/channel outcomes:

- `CALL_CONNECTED`
- `CALL_NO_ANSWER`
- `CALL_BAD_NUMBER`
- `FIELD_VISIT_COMPLETED`
- `FIELD_VISIT_NOT_RELEVANT`
- `REFERRAL_INTRO_MADE`
- `MANUAL_SUPPRESSED`

Sales outcomes:

- `MEETING_BOOKED`
- `MEETING_NO_SHOW`
- `OPPORTUNITY_CREATED`
- `CLOSED_WON`
- `CLOSED_LOST`
- `DISQUALIFIED`

Compliance outcomes:

- `OPT_OUT`
- `DNC`
- `BOUNCE_SUPPRESSION`
- `DELETION_REQUEST`
- `SOURCE_RESTRICTION`

Rules:

- Sender event is source-of-truth for delivery mechanics.
- HubSpot is source-of-truth for pipeline stage and won/lost.
- Manual reviewer correction is source-of-truth for brief quality.
- Compliance event overrides all activation recommendations.

## 9. Final provider capability matrix

| Provider | Account truth | Operational fit | Activation | Outcome | Learning | Launch role |
|---|---:|---:|---:|---:|---:|---|
| HubSpot | High | Medium | Medium | High | High | Core |
| Smartlead | Low | Low | High | Medium-High | Medium | One-sender option |
| Instantly | Low | Low | High | Medium-High | Medium | One-sender option |
| Openmart | Medium-High | Medium | Low | Low | Medium | Market/data rail |
| Google Places | High for identity | Medium | None | None | Medium | Verifier |
| Apify | Medium | High | None | None | High | Selective research |
| Field/manual | Medium | High | High | High | High | Core workflow |
| Orbital | Medium-High | Medium-High | Low-Medium | Low-Medium | Medium | Existing-source adapter |
| Clay | Medium | Medium | Low-Medium | Low | Medium | Extension |
| Apollo | Medium for HQ | Low-Medium | Low | Low | Low-Medium | Later supplement |
| Resquared | Medium | Low-Medium | Medium | Low-Medium | Low-Medium | Optional |

## 10. Engineering implementation order

### Sprint 0: Final contracts

- Define provider registry.
- Define normalized outcome enum.
- Define source/use-right policy model.
- Define channel eligibility states.
- Define FineDine offer ontology schema.
- Define Account Intelligence Brief v2 output contract.

### Sprint 1: Compliance and integration substrate

- Add `IntegrationConnection`.
- Add `ExternalRecord` with raw storage policy.
- Add `AccountSignal`.
- Add `IntegrationEvent`.
- Add `ContactChannelPermission`.
- Add `SuppressionEntry`.
- Add `DataSourcePolicy`.
- Add compliance audit log.

### Sprint 2: HubSpot

- Private app credential storage.
- Company/contact/deal client.
- Property group setup.
- Upsert company/contact.
- Deal creation only after qualification.
- Polling/delta sync.
- Outcome normalization from stages.

### Sprint 3: One sender

- Pick Smartlead or Instantly V2.
- API key connection.
- Campaign read.
- Eligible lead push.
- Webhook receiver.
- Event idempotency.
- Suppression propagation.

### Sprint 4: Openmart and Google Places

- Openmart search client.
- Openmart raw storage if allowed.
- Selective people/tech lookup.
- Google Places ID/freshness verifier.
- Google field mask and attribution policy.

### Sprint 5: Brief and action surface

- Brief reads normalized signals.
- Add compliance flags.
- Add action taxonomy: email, call, field, referral, enrich more, suppress.
- Add human review correction.
- HubSpot writeback summary.

### Sprint 6: Apify selective research

- Cost policy.
- Trigger only on shortlist/high-fit/uncertain accounts.
- Grounded evidence in brief.
- Source freshness and rerun policy.

### Sprint 7: Optional adapters

- Orbital via HubSpot custom fields.
- Clay inbound webhook.
- Resquared CSV/import.
- Apollo HQ/contact supplement.

## 11. Final acceptance criteria

MVP is acceptable only if:

- Compliance gate exists before activation.
- HubSpot can read/write company/contact/deal standard objects.
- HubSpot properties are created or mapped.
- Deal/stage/outcome sync works through polling or webhook.
- Exactly one sender is native.
- Sender reply/bounce/unsubscribe events write normalized outcomes.
- Suppression propagates before future activation.
- Openmart or approved source can source a US metro/account set.
- Google Places validates identity without raw payload warehousing.
- Account brief shows source provenance and use-right status.
- Brief recommends email, manual call, field visit, referral, enrich more or suppress.
- At least 30 FineDine-reviewed briefs are reviewed.
- At least one real activation loop returns an outcome.
- One outcome changes next action, insight performance or memory.

## 12. Final "do not build" list

Do not build:

- Smartlead and Instantly native integrations in parallel.
- Direct Orbital connector before HubSpot/sender/Openmart loop works.
- Full Clay two-way workflow before product-market proof.
- Native Resquared connector before a customer dependency exists.
- Apollo connector for independent restaurant owner discovery.
- Google Places raw data warehouse.
- Generic US restaurant lead database.
- Autonomous sending.
- SMS automation.
- AI voice.
- Autodialer.
- CRM replacement.
- Sender replacement.

## 13. Final FineDine integration story

FineDine'e anlatilacak net hikaye:

> HubSpot pipeline truth'u tutuyor. Smartlead veya Instantly email aksiyonunu tasiyor. Openmart US restoran marketini dolduruyor. Google Places identity ve freshness dogruluyor. Apify yalniz gerekli hesaplarda derin kanit topluyor. Field reps yerel guveni kuruyor. LeadAC bunlarin ustunde hangi account'un FineDine icin neden uygun oldugunu, hangi aksiyonun safe ve mantikli oldugunu, hangi pitch'in denenmesi gerektigini ve her outcome'dan ne ogrenildigini soyluyor.

Short promise:

> Connect HubSpot, one sender and approved restaurant data. LeadAC turns that stack into safe account judgment and a learning loop for US restaurant-tech sales.

## 14. Final answer to the user's question

Evet, entegrasyonlar uygulamanin amacina gore genel olarak mantikli konumlaniyor. Ancak final planin dogru hali su sekilde daha sert olmalidir:

- HubSpot, one sender, field/manual workflow, compliance substrate, FineDine offer context: core.
- Openmart, Google Places, Apify: core data/research rails but strictly role-limited.
- Orbital, Clay, Apollo, Resquared: ecosystem adapters, not core launch dependencies.
- CSV/import/export: fallback, repair and bridge layer, not product promise.
- Autonomous activation: future, not MVP.

LeadAC'in kazanacagi yer "daha cok entegrasyon" degil, "dogru entegrasyonu dogru rolde kullanip account judgment ve outcome learning'e cevirmek"tir.

## 15. Sources

- FTC CAN-SPAM compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- HubSpot private apps docs: https://developers.hubspot.com/docs/api/private-apps
- HubSpot webhooks docs: https://developers.hubspot.com/docs/guides/api/app-management/webhooks
- Smartlead webhook integration guide: https://api.smartlead.ai/guides/webhook-integration
- Instantly API V2 Help Center: https://help.instantly.ai/en/articles/10432807-api-v2
- Openmart Local Business Data API: https://www.openmart.com/products/local-business-data-api
- Orbital bidirectional CRM sync docs: https://docs.withorbital.com/integrations/overview-bidirectional-crm-sync
- Google Places policies and attributions: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Places usage and billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Apify API v2 docs: https://docs.apify.com/api/v2
- SaaStr, Toast vertical SMB sales: https://www.saastr.com/10-things-that-are-different-in-vertical-smb-sales-with-toasts-cro/
- National Restaurant Association Technology Landscape Report 2024: https://restaurant.org/research-and-media/research/research-reports/2024-technology-landscape-report/
