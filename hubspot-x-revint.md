# HubSpot × Revint — Entegrasyon Stratejisi & Tasarım

> **Kime:** Bu entegrasyonu sürdüren developer + PM
> **Hazırlayan:** (bu oturum — FineDine M1/M2 + Irem call transcript + mevcut kod taraması)
> **Tarih:** 2026-06-19
> **Tek cümleyle:** Revint, HubSpot'u **replace etmez**; HubSpot'un üstünde çalışan **karar & aksiyon (sales intelligence) katmanıdır**. Bu dosya sistemin amacını, nasıl çalıştığını, FineDine gerçeğiyle olan boşlukları ve "en mantıklı" bir sonraki tasarımı tanımlar.

---

## 1. Revint'in amacı (sistem ne yapıyor, neden var)

Revint (kod adı `leadac` / `revint`) bir **lead acquisition zekâ katmanı**. Çözdüğü çekirdek problem FineDine M2'de net konuldu:

> İyi bir SDR bir restoranı inceler (site, menü, Google review, Instagram, online ordering var mı) ve **kafasında** bir karar verir: "bu restoran FineDine için iyi mi, hangi angle ile satarım?". Bu sezgi **sistemleşmez**; SDR ayrılınca bilgi gider, yeni SDR aynı hataları tekrar yapar, lead'e harcanan vakit boşa gider.

Revint bu sezgiyi **sonuçtan öğrenen bir sisteme** dönüştürür:

- **Skorlama:** Her lead'e bir `salesConfidence` (0–100, kapanış olasılığı × veri kalitesi) + `leadTemperature` (HOT/WARM/COLD) + `icpFitScore` verir.
- **Karar:** Hangi FineDine angle ile, hangi kanaldan, hangi zaman penceresinde aranacağını ("next best action") üretir — gerekçesiyle (evidence).
- **Öğrenme:** Satış **sonucuna** (won / lost / no-show / disqualified) bakar; kazanılan örüntüyü güçlendirir, kaybedileni aşağı çeker (OI.LearningLayer / PatternRecognition).

**Konumlandırma (M2 kararı, sapma yok):**
- ❌ "AI SDR", "CRM", "sender", "lead database" **değil**.
- ✅ HubSpot'un üstünde çalışan **lead intelligence + workflow** katmanı.
- ✅ Tekil lead sayfasının amacı restoran raporu değil: **"bugün bu lead ile ne yapacağım?"** sorusunu 10 saniyede cevaplayan **call-first action sheet**.

**Neden değerli (araştırma dayanağı, in-tree):** Salesforce State of Sales 2026 — satış temsilcileri vaktinin yalnızca ~%22'sini meeting'de geçiriyor; gerisi prospecting + data girişi. Revint'in hedefi: **kötü lead'e harcanan vakti kıs, ICP-fit lead'e vakit aç.**

---

## 2. Sistem nasıl çalışıyor (mevcut mimari + gerçek kod yolları)

### 2.1 Bounded context'ler (Notion mimari hub'ından)
- **SI (System Intelligence)** → `SI.AI.Workers`: Enrichment, SERP, WebsiteAudit, ReviewAudit, SocialAnalysis, SubVerticalClassifier, **ICPScorer**, **SalesAngle**, QA. Sinyaller buradan çıkar.
- **OI (Outcome Intelligence)** → EvidenceSystem, **LearningLayer**, **PatternRecognition**. Öğrenme döngüsü burada.
- **CH (Customer Channel)** → UI (Lead-Detail), **Integrations.Hubspot**, MCP. Müşteriye temas burada.

### 2.2 Kanonik akış (M2'de yazılı 8 adım) → kod eşlemesi

```
1. Lead HubSpot'a düşer (New Inbound, website form)
2. Revint HubSpot'tan lead datasını çeker         → context.ts (getHubspotLeadContext)
3. Revint restoranı analiz eder                    → ingest.ts (place-first match) → emit("lead_created") → SI.AI.Workers
4. Revint satış kararını üretir                    → playbook/angle (pickAngle) + qualification + nextAction
5. HubSpot içinde Revint App Card görünür          → card-data/route.ts (+ React UI extension)
6. SDR karttan Revint Lead Detail sayfasını açar   → actionSheetUrl → /app/leads/{id}
7. SDR arama sonucunu loglar                       → call-task-sync.ts + webhook.ts
8. Revint sonucu HubSpot'a geri yazar              → writeback.ts → revint_* properties (properties.ts)
```

### 2.3 Mevcut dosya haritası (`src/lib/integrations/hubspot/` + `src/app/api/integrations/hubspot/`)

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `oauth.ts` | OAuth code↔token, refresh, şifreli saklama | ✅ |
| `client.ts` | CRM v3 read/write, engagement (note/call/task/deal), property & pipeline | ✅ |
| `ingest.ts` | Place-first eşleme, lead create/link, `lead_created` tetikleme | ✅ |
| `context.ts` | HubSpot context (contact/company/deal/owner + **form intents**) | ✅ |
| `properties.ts` | 11 kanonik `revint_*` contact property + "Revint" grubu | ✅ |
| `field-map.ts` | HubSpot deal stage ↔ playbook stage (override + label match) | ✅ |
| `writeback.ts` | Revint zekâsını `revint_*` alanlarına geri yaz | ✅ |
| `webhook.ts` | v3 imza doğrulama + event işleme | ✅ |
| `call-task-sync.ts` | Disposition → note/call/task engagement | ✅ |
| `api/.../card-data` | App Card backend (flat JSON, imza doğrulamalı) | ✅ |
| `api/.../reconcile` | Kaçan webhook için tarama/telafi | ✅ |
| `api/.../sync`, `provision`, `connect`, `callback`, `status`, `migrate-card` | Bağlama / property provision / legacy kart migrasyonu | ✅ / 🟡 |

### 2.4 App Card'ın bugün yüzeye çıkardığı alanlar (`card-data/route.ts`)
`signals`: temperature, salesConfidence, icpFitScore, stage, subNiche, **qualificationStatus + qualified + qualificationRisk + qualificationRiskReason**, noShowRisk
`decision`: recommendedAngle, **pitchThis / whatNotToPitch**, nextBestAction (+confidence, timing window, channel), evidenceSummary
`timing`: **hoursSinceInbound**, inboundReceivedAt, lastSyncedAt

> Not: "qualified ≠ fiyat paylaşıldı" derdi **zaten** çözülmüş — `qualificationStatus="info_only"` ve `qualificationRiskReason="Caller only after info — not in buying mode."` kartta görünüyor.

---

## 3. FineDine gerçeği (M2 + Irem transcript özeti)

**Şirket:** Restoran-tech (QR menü, AI menü, Order & Pay, rezervasyon, turistik bölge için multi-language, web + ordering). HubSpot **ana çalışma yeri**.

**Ekip:** Şu an **tek SDR** (Irem Söğütlü Güler), solo. Telefonla kapatan, B2C-refleksli, hızlı kapanış odaklı. Ecem (Dubai) online toplantıyla kapatıyor.

**Lead kaynağı:** Website formu → HubSpot'ta **New Inbound**.

**Irem'in pipeline'ı (ekran paylaşımından):**
`New Inbound → Connected → Qualified → Attempting → Disqualified` (+ kapanış).

**M2'de hedeflenen kanonik stage seti:**
`New Inbound · Attempting · Connected · Qualified · Meeting Booked · No-show · Lost`.

**Brief bugün nereden geliyor?** **Slack'ten** (AI "restoran röntgeni"). HubSpot'a gömülmesi isteniyor → tam olarak App Card'ın amacı.

**Irem fiilen neyi kullanıyor:** website var mı, dijital QR menü var mı, skor, rakipler, sosyal takipçi. **Ton önerisini kullanmıyor** (kendi template'i var).

**M2 pain points:** lead sıcaklığı kaçıyor (tatil/hafta sonu sonrası 2–3 günde soğuyor); solo SDR yetişemiyor; cep telefonuyla arama → **call tracking zayıf**; "no answer" kalitesi ölçülemiyor; "Qualified" hatalı kullanılıyor; no-show var; manager lead kalitesini doğrulayamıyor; mevcut kartlar **bilgi gösteriyor ama aksiyon/öncelik/öğrenme yok**; hangi restorana hangi angle belirsiz.

---

## 4. Irem'in ihtiyaçları → HubSpot alanı eşlemesi (EN KRİTİK BÖLÜM)

Transcript'ten çıkan somut istekler ve bugünkü durumla boşluk analizi:

| # | İhtiyaç (transcript) | Görüşmeden | Bugün var mı? | Önerilen alan / kart öğesi |
|---|---|---|---|---|
| 1 | **Karar verici mi konuşuyorum?** (sahip mi, garson mu) | "karar vericiyle konuşuyorsam kapatma olasılığı artıyor" | ❌ Kartta yok | `revint_decision_maker` (enum: OWNER / MANAGER / STAFF / UNKNOWN) |
| 2 | **Satın alma niyeti + zamanlama** | "fiyat almak istiyorum" vs "bilgi alabilir miyim" çok farklı; "yeni şube açıyor" | 🟡 Kısmen (`qualification.status=info_only`) | `revint_buying_intent` (HIGH/MED/LOW) + kısa "intent reason" |
| 3 | **Key account mı, tekil işletme mi?** (routing) | "key account ise zaten ona bakan ekip var, doğrudan rımlerim" | 🟡 `accountId` var (pickAngle'da `isMultiLocation`) ama yüzeyde yok | `revint_account_type` (KEY_ACCOUNT / SINGLE) — kartta rozet |
| 4 | **Lokal rakip analizi (FOMO)** | "bölgende X tatlıcı var, Y'si QR menüye geçmiş, sen yoksun" | ❌ Yok | `revint_competitor_snapshot` (ör. "Bölgende 12 benzer mekân, 8'i dijital menüde") |
| 5 | **Referans / benzer müşteri kanıtı** | "Godiva'nın linkini paylaştım; bunu sistem önüme koysa işim kolaylaşır" | ❌ Yok | `revint_reference_proof` (benzer **kazanılmış** müşteri + menü linki) — **OI.LearningLayer çıktısı** |
| 6 | **Speed-to-lead alert / renkli skor** | "yüksek potansiyel lead kırmızıya dönse, puanlansa" | 🟡 temperature + today_priority + hoursSinceInbound var | Kartta **SLA geri sayım** + temperature rozeti (HOT=kırmızı) |
| 7 | **Her şey HubSpot'ta, Slack'te değil** | "Slack'ten geliyor, HubSpot'a gömmek istiyorlar" | 🟡 App Card backend hazır, React extension/migrate-card 🟡 | App Card'ı **tek kaynak** yap, Slack brief'i emekliye ayır |
| 8 | **Call attempt history / no-answer kalitesi** | "kaç kez çaldı, gerçekten ulaşılamadı mı belli değil" | 🟡 call-task-sync var ama history yüzeyde yok | Kartta "Attempts: 3 · son: dün 14:02 · no-answer" satırı |

---

## 5. Learning loop bütünlüğü (en büyük teknik risk)

Transcript'te iki kez vurgulandı, M2 requirement'ı: **"Outcome learning mutlaka kurulmalı."**

**Risk:** SDR yanlış disposition girerse (ilgili lead'i "not interested" işaretler ya da sadece bilgi paylaşımını "Qualified" yapar), Revint **yanlış örüntü öğrenir**. Sonuç sinyali kirlenir → skorlama bozulur → SDR'a yanlış öneri döner.

**Bugün ne hafifletiyor:**
- `qualification.status` (info_only / in_progress / qualified) + `qualificationRisk` + `qualificationRiskReason` → "Qualified ≠ fiyat paylaşıldı" derdini kartta açık gösteriyor.
- Stage değişiklikleri webhook → `field-map.ts` ile playbook stage'e map ediliyor.

**Tasarlanması gereken (boşluk):**
1. **Outcome sinyali tanımı:** Hangi HubSpot olayı "sonuç"? → `dealstage` = Won/Lost, stage = No-show/Disqualified, `hs_lead_status`.
2. **Outcome → memory yazımı:** Kazanılan lead'in örüntüsü (sub-niche, sinyal seti, angle) **OI.LearningLayer**'a pozitif, kaybedilen negatif örnek olarak yazılır. **Kural:** SemanticMemory'e **sadece `src/lib/ai-core/memory.ts` üzerinden** yazılır (doğrudan `prisma.semanticMemory.*` yasak).
3. **Qualification checklist:** "Qualified" için minimum kriter (karar verici ✓ + ihtiyaç netleşti ✓ + sonraki adım belli ✓). Fiyat paylaşımı **tek başına yetmez**. Bu checklist `qualification` modeline bağlanır ve no-show riskini düşürür.
4. **Manager doğrulaması:** "Bu lead gerçekten qualified mı?" — checklist + evidence manager'a görünür (M2 isteği).

```
Won/Lost/No-show/Disqualified (HubSpot)
      │  webhook.ts
      ▼
field-map → playbook stage / outcome
      │
      ▼
OI.LearningLayer  ── memory.ts ──▶ SemanticMemory (pattern reinforce / down-weight)
      │
      ▼
sonraki skorlama (salesConfidence) + reference_proof bu pattern'den beslenir
```

---

## 6. Kanonik eşlemeler (kaydetmek için)

### 6.1 FineDine pipeline stage ↔ playbook stage
`field-map.ts` label-match + override yapıyor. FineDine portalı için sabit eşleme önerisi:

| HubSpot stage | playbook stage key (öneri) | Outcome? |
|---|---|---|
| New Inbound | `new_inbound` | — |
| Attempting | `attempting` | — |
| Connected | `connected` | — |
| Qualified | `qualified` | — |
| Meeting Booked | `meeting_booked` | — |
| No-show | `no_show` | ⚠️ negatif sinyal |
| Lost / Disqualified | `lost` | ⚠️ negatif sinyal |
| (Won) | `won` | ✅ pozitif sinyal |

### 6.2 `revint_*` property'leri — mevcut 11 + önerilen 4 yeni

**Mevcut (properties.ts):** `revint_sales_confidence`, `revint_lead_temperature`, `revint_today_priority`, `revint_recommended_angle`, `revint_next_best_action`, `revint_qualification_status`, `revint_no_show_risk`, `revint_detected_sub_niche`, `revint_evidence_summary`, `revint_source_conflicts`, `revint_action_sheet_url`.

**Önerilen yeni (Bölüm 4'ten):** `revint_decision_maker`, `revint_buying_intent`, `revint_account_type`, `revint_competitor_snapshot`, `revint_reference_proof`.

> Yeni property eklerken: `REVINT_PROPERTIES`'e ekle → `ensureRevintProperties` idempotent → `writeback.ts` doldurur → `card-data` payload'ına bağla → React kart UI'ında render et. Enum alanlar `REVINT_ENUM_PROPERTY_NAMES`'e girmeli (boş enum yazımı HubSpot'ta reddedilir).

---

## 7. "En mantıklı" tasarım — Revint App Card v2 (call-first)

Tek ekranda, kalabalık olmadan, **aksiyon odaklı**. 4 blok + deep link:

```
┌──────────────────────────────────────────────┐
│ Revint                          🔴 HOT · #2    │  ← temperature + today_priority
│ ⏱ 41 dk önce geldi · BUGÜN ara (SLA)           │  ← speed-to-lead
├──────────────────────────────────────────────┤
│ 👤 Karar verici: Sahip · Niyet: YÜKSEK         │  ← #1 + #2 (yeni)
│    Tip: Tekil işletme                          │  ← #3 (yeni)
├──────────────────────────────────────────────┤
│ 🎯 Best Angle: Order & Pay                     │
│    Pitch: online ordering yok, review yüksek   │  ← pitchThis
│    Don't: multi-location (tekil işletme)        │  ← whatNotToPitch
├──────────────────────────────────────────────┤
│ 📊 Rakip: Bölgende 8/12 dijital menüde         │  ← #4 (yeni, FOMO)
│ 🏆 Benzer kazanım: "Çikolata Evi" (menü linki) │  ← #5 (yeni, learning loop)
├──────────────────────────────────────────────┤
│ ⚠️ Risk: Henüz gerçekten qualified değil       │  ← qualificationRiskReason
│ 📞 Attempts: 2 · son: dün 14:02 (no-answer)    │  ← #8 (yeni)
│                          [ Lead Sheet'i Aç → ] │  ← actionSheetUrl
└──────────────────────────────────────────────┘
```

**Tasarım ilkeleri:**
- Kart **karar verir**, rapor sunmaz. Derin kanıt (röntgen) Lead Detail sayfasında, ikinci ekranda.
- HubSpot bileşen kütüphanesi zorunlu (kendi CSS/HTML yok) — bu hızlı + native his demek.
- `hubspot.fetch()` limitleri: 15s timeout, 1MB, portal başına 20 eşzamanlı → `card-data` **hafif kalmalı** (Gemini/Apify YOK; sadece denormalize `revint_*` + tek `pickAngle`).

---

## 8. Yapılacaklar (kod) — öncelik sıralı

1. **🔴 Legacy CRM Card → React App Card migrasyonunu bitir.** Classic CRM cards **31 Ekim 2026**'da sunset. `migrate-card` + `card-data` zaten legacy karta bağlı. `hs` CLI projesi (2026.03) ile React app card kur, `card-data` backend'ine `hubspot.fetch()` ile bağla. HubSpot'un "Legacy CRM Card → UI Extension Converter" örneğini başlangıç al.
2. **🟠 Yeni 5 property** (`decision_maker`, `buying_intent`, `account_type`, `competitor_snapshot`, `reference_proof`) → `properties.ts` + `writeback.ts` + `card-data` payload + kart UI.
3. **🟠 Outcome learning loop** → `webhook.ts`'te Won/Lost/No-show/Disqualified yakala → `memory.ts` üzerinden pattern reinforce/down-weight. `reference_proof` bu memory'den beslenir.
4. **🟡 Qualification checklist** → "Qualified" için minimum kriter (karar verici + ihtiyaç + sonraki adım); fiyat tek başına yetmez. Manager görünürlüğü.
5. **🟡 Call attempt history** → `call-task-sync` verisinden "Attempts / son deneme / sonuç" özetini karta taşı (no-answer kalitesi derdi).
6. **🟢 OAuth uçları** → token refresh'in v3/`2026-03` endpoint'lerini kullandığını doğrula (v1 deprecated).

---

## 9. "Bitti" tanımı (kontrol listesi)

- [ ] App Card React UI extension yayında (legacy kart emekli), Slack brief'i devre dışı.
- [ ] Kart 4 bloğu render ediyor: Speed/Priority · Who & Intent · Angle (pitch/don't) · Proof & Competitors.
- [ ] 5 yeni `revint_*` property provision + writeback + kartta görünür.
- [ ] FineDine pipeline stage'leri playbook'a map'li; Won/Lost/No-show outcome olarak işaretli.
- [ ] Outcome → `memory.ts` öğrenme döngüsü canlı; `reference_proof` pattern'den üretiliyor.
- [ ] Qualification checklist devrede; "fiyat paylaşıldı = qualified" kapatıldı.
- [ ] Multi-tenant: tüm sorgular `workspaceId` ile scope'lu; card-data portal→workspace çözümü imzalı input'tan.

---

## 10. Açık sorular (FineDine'a sorulacak)

- Kanonik stage seti hangisi: Irem'in ekranı (Disqualified) mı, M2 listesi (Meeting Booked/No-show/Lost) mı? → field-map sabitlemeden önce netleşmeli.
- "Karar verici" ve "buying intent" sinyalini nereden türeteceğiz: form alanı mı, çağrı sonrası SDR girdisi mi, yoksa enrichment mi?
- Outcome'u deal mı yoksa contact `hs_lead_status` mı taşıyacak? (FineDine deal kullanıyor mu, yoksa pipeline contact-stage mı?)
- Pilot tek territory/segment ile mi başlıyor? (M2 requirement: pilot tek segment.)
