# Lead Detail Sayfası — Sıfırdan Tasarım Brief'i

**Hedef:** Tek lead sayfasını (`/app/leads/[id]`) SDR Brain v2'nin ürettiği tüm yeni veriyi **native** olarak gösterecek şekilde sıfırdan tasarla. Şu anda bu verilerin %70'i ya UI'da hiç yok ya da bir tab'ın derinine gömülü.

**Bu brief'in amacı:** Designer'ın kodu okumak zorunda kalmadan, sayfanın hangi soruları cevaplaması gerektiğini, elinde hangi blok hangi veriyle dolacağını, ve hangi etkileşim kalıplarının bu üründe doğru olduğunu anlaması.

---

## 1. Bağlam — Bu sayfa kim için?

**Kullanıcı:** B2B ajans satış temsilcisi (SDR / AE). Ürünü satıyor: sektörel AI dağıtım paketleri (AI receptionist, review reply, lead response, booking widget). Lead'leri Google Maps + manuel arama üzerinden çekiyor; hangisini, ne zaman, nasıl arayacağına karar vermek için bu sayfayı kullanıyor.

**Ortalama oturum süresi (hedef):** 90-180 saniye. Sayfa "okumak için açılan" bir sayfa değil; "ne yapacağıma karar verip yapacağım" sayfası. Her ekran kararı **scroll yapmadan**, üstten ulaşılabilir olmalı.

**Kullanıcının zihninde sayfaya gelirken sorduğu üç soru:**
1. **Why now?** — Bu lead'i şimdi mi aramalıyım, yoksa watchlist'e mi koymalıyım?
2. **What do I say?** — İlk mesajım ne olmalı? Hangi acı noktasına bas?
3. **What will they push back on?** — Hangi itirazları gelir, ne cevaplarım?

Mevcut sayfa bu üç soruya cevap **vermiyor**. Cevaplar arka planda üretiliyor (SDR Brain v2 ile), ama UI hâlâ "veri katalogu" gibi: audit, reviews, social, dossier, mockup ayrı tab'larda yan yana duruyor; karar olarak kullanıcıya hiçbir şey hazırlanmıyor.

---

## 2. SDR Mental Model — Sayfanın akışı bunu yansıtmalı

Satış döngüsü 4 aşamalı bir döngü:

```
QUALIFY  →  OUTREACH  →  DISCOVER  →  CLOSE
   ↑                                      │
   └────────── LEARN (closed loop) ───────┘
```

| Aşama | Sayfada cevap aranan soru | SDR Brain v2'de bunu üreten |
|---|---|---|
| **Qualify** | Bu lead ICP'ye uyuyor mu? Tier ne? BANT skoru? | `ICP_SCORER`, `ACCOUNT_TIER_RANKER`, `BANT_INFERRER` |
| **Outreach** | İlk temasta ne diyeceğim? Neden şimdi? | `WHY_NOW_SYNTHESIZER`, `COMMERCIAL_INSIGHT_MATCHER`, `OPENER_WRITER` |
| **Discover** | Karar verici kim? Hangi soruları sorayım? | `BUYING_COMMITTEE_MAPPER`, `SPIN_EXTRACTOR`, `MEDDPICC_EXTRACTOR` |
| **Close** | Hangi itiraz gelir? Sözleşmeye ne kadar yakın? | `OBJECTION_PREDICTOR`, `MEDDPICC_EXTRACTOR` (PROCESS, ECONOMIC_BUYER) |
| **Learn** | Kazandık/kaybettik — hangi sinyal işe yaradı? | `OUTCOME_ATTRIBUTOR` (sayfada gösterilmez ama her etkileşimi besler) |

Önemli: bu beş aşama **hep aynı sayfada** akıyor. Lead'in pipeline durumu (`COLD → CONTACTED → REPLIED → MEETING → DEAL_WON`) ilerledikçe sayfa **morf etmeli**. Bir lead daha "qualify" aşamasındayken "MEDDPICC" bölümünü göstermek gürültü yapar; ama "REPLIED" olduğunda MEDDPICC bölümü öne geçmeli.

---

## 3. Veri Envanteri — Sayfada gösterilecek her şey

Bu listeyi tek tek oku. Yanındaki "Şu an UI" sütunu hangi verinin ne kadar görünür olduğunu söylüyor. **HIDDEN** olanlar bu redesign'da native gelmeli.

### 3.1 Lead temel bilgisi (zaten var, değişmez)
| Alan | Şu an UI | Tip |
|---|---|---|
| `businessName` | Page header | string |
| `phone`, `phoneNormalized` | Sidebar | string |
| `email`, `emailVerified` | Sidebar | string + bool |
| `websiteUrl`, `hasWebsite` | Sidebar + Website tab | string + bool |
| `address`, `geo`, `mapData` | LeadMapView | object |
| `nicheSlug`, `subNicheSlug` | Header rozeti | enum slug |
| `rating`, `reviewCount`, `priceLevel` | Sidebar | number |
| `googleReviews[]` | Reviews tab | Review[] |
| `socialProfiles` | Sidebar (icon row) | object |

### 3.2 Klasik enrichment (zaten var, kalır)
| Alan | Şu an UI | Tip |
|---|---|---|
| `websiteAudit` (perf, accessibility, SEO, found patterns) | Website tab | WebsiteAudit |
| `reviewAnalysis` (sentiment, themes, complaints, FNB labels) | Reviews tab | ReviewAnalysis |
| `salesOpportunity` (legacy 0-100 score, packageReason) | Outreach tab | SalesOpportunity |
| `agentRuns[]` (her worker'ın çalışma geçmişi) | Workers tab | AgentRun[] |
| `dossier` (Markdown brief, ~2dk okuma) | Overview tab | Dossier |
| `websiteMockup` (`/m/{slug}` HTML preview) | Workers tab | Mockup |

### 3.3 SDR Brain v2 ÇIKTILARI — **YENİ, ŞU AN NATIVE GÖSTERILMIYOR**

Bunlar arka planda üretiliyor, DB'de duruyor, ama UI'da ya hiç görünmüyor ya da `NbaCard` içinde yarı gizli duruyor. Designer'ın bu 11 bloku **birinci sınıf vatandaş** yapması gerekiyor.

#### A) Qualification katmanı

**`IcpScore` + `IcpFitDimension[]`**
- 0-100 ICP fit skoru + boyutlara göre alt-skor (revenue, employee count, tech stack, geo, vertical signals).
- **Soru:** Bu lead ICP profilime ne kadar uyuyor ve nerede zayıflıyor?
- Şu an: Sadece sayı olarak `salesOpportunity.icpFitScore` alanında. Boyut breakdown'u UI'da YOK.

**`AccountTier` (TIER_1 / TIER_2 / TIER_3 / TIER_4)**
- Lead'in parent `Account`'una atanmış tier. Lokasyon sayısı, ICP fit, contact density, sub-niche sinyallerinin birleşimi.
- **Soru:** Bu hesap büyük balık mı, küçük mü? Önceliklendirme rengi.
- Şu an: UI'da YOK.

**`BuyingReadiness` (BANT — 4x 0-100)**
- `budget`, `authority`, `need`, `timing` — her biri 0-100 + her biri için `reasoning[]` (string array, neden böyle).
- **Soru:** "Şimdi al" sinyali güçlü mü?
- Şu an: UI'da YOK. Sadece preliminary NBA'in arkasında bir input olarak çalışıyor.

#### B) Why Now katmanı

**`LeadTrigger[]`**
- Son N günde tetiklenmiş satış sinyalleri. Her trigger:
  - `type` (enum: `HIRING_BURST`, `NEW_LOCATION`, `TECH_STACK_CHANGE`, `BAD_REVIEW_STREAK`, `WEBSITE_BROKEN`, `COMPETITOR_AD_LAUNCH`, `SEASONAL_PEAK`, `FUNDING_EVENT`, ...)
  - `confidence` (0-1)
  - `urgencyDays` (kaç gün içinde aksiyon alınmalı — örn. 7)
  - `evidenceRefType` + `evidenceRefId` (hangi memory/audit/review satırından geldi)
  - `detectedAt`
- **Soru:** Şu anda bu lead'de NE oluyor da onu aramam lazım?
- Şu an: NbaCard içinde küçük rozetler olarak görünüyor — gerçek görünürlük yok.

**`whyNow` narrative + urgency score**
- `WHY_NOW_SYNTHESIZER` çıktısı: bir cümlelik headline + 2-3 cümlelik gerekçe + 0-100 urgency.
- **Soru:** Tek cümleyle "neden şimdi"yi söyle.
- Şu an: NbaCard'ın tepesinde küçük tip olarak görünüyor.

#### C) Outreach katmanı

**`LeadNextAction` (preliminary + final, versionlu, supersession'lı)**
- `kind` (`CALL_NOW`, `EMAIL_FIRST`, `BOOK_DISCOVERY`, `SEND_DEMO`, `WAIT_AND_NURTURE`)
- `channel` (`PHONE`, `EMAIL`, `WHATSAPP`, `SMS`, `LINKEDIN`)
- `openingHook` (string — açılış cümlesi, kişiselleştirilmiş)
- `whatNotToPitch` (string[] — bu lead'e söylememesi gereken şeyler)
- `confidence` (0-1)
- `reasoningGraph` (Json — node + edge yapısı, EVIDENCE/INFERENCE/DECISION nodelar)
- `arbitrationRecords[]` (çelişen sinyaller nasıl çözüldü)
- `version` (incrementing, supersededBy ilişkisi)
- `status` (`PRELIMINARY` | `FINAL`)
- **Soru:** Bu insanı nasıl açacağım, telefonu mu açacağım email mi atacağım, ne dememeliyim?
- Şu an: NbaCard'da var ama mini-card formatında. Genişletmeye değecek bir yapı.

**`CommercialInsight` (Challenger reframe)**
- 1-2 cümlelik "müşterinin bilmediği bir şey" — bu lead'i şaşırtacak / re-frame edecek satış zekâsı.
- Workspace'in `CommercialInsight` kütüphanesinden `COMMERCIAL_INSIGHT_MATCHER` tarafından eşleştirildi.
- Performansı `InsightPerformance` tarafından izleniyor (kaç kez kullanıldı, win-rate).
- **Soru:** Açılışta hangi sürpriz/karşı-tez ile dikkat çekerim?
- Şu an: NbaCard'da pasif olarak gösteriliyor.

**`Objection[]` (PREDICTED + REAL ayrımı)**
- Tahmin edilmiş itirazlar (lead aramadan önce bilinen) ve gerçek itirazlar (görüşmede yazılan).
- Her itiraz: `text`, `source` (PREDICTED/REAL), `rebuttalUsed` (önceden hazır cevap), `evidenceRefType`/`evidenceRefId`.
- **Soru:** Beni hangi itirazlar bekliyor, hazır cevabım ne?
- Şu an: NbaCard'da küçük accordion. Discover/Close döngüsünde bu listenin üstüne yazılması gerek.

#### D) Discover katmanı

**`Stakeholder[]` (Buying Committee)**
- `name`, `email`, `title`, `roleLabel`
- Boolean flag'ler: `isEconomicBuyer`, `isBlocker`, `championLikelihood` (0-1)
- `source` (nereden tespit edildi: site team page, gmaps owner, social, vs.)
- **Soru:** Bu işletmede karar veren kim? Champion'um kim? Blocker var mı?
- Şu an: UI'da YOK. Backend'de tam olarak duruyor.

**`DiscoverySession[]` + `DiscoveryItem[]` (SPIN sınıflaması)**
- Voice note veya call notes'tan SPIN_EXTRACTOR tarafından çıkartılan cümleler.
- Her item: `kind` (`SITUATION` | `PROBLEM` | `IMPLICATION` | `NEED_PAYOFF`), `text`, `confidence`.
- **Soru:** Discovery'de neyi anladık, eksik kalan ne?
- Şu an: UI'da YOK. Voice notes panel'inde transcript var ama SPIN sınıflaması GÖRÜNMÜYOR.

#### E) Close katmanı

**`DealQualification` (MEDDPICC) + `DealQualificationFact[]`**
- 7 boyut: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition.
- Her boyut için: `status` (UNKNOWN | PARTIAL | CONFIRMED), `notes`, `factCount`.
- Her `Fact`: `dimension`, `text`, `evidenceRefType`/`evidenceRefId`, `extractedAt`.
- **Soru:** Bu deal kapanır mı? Hangi boyutta zayıfım?
- Şu an: UI'da YOK.

#### F) Explainability katmanı

**`reasoningGraph` (Json — `LeadNextAction` üzerinde)**
- `nodes[]`: her biri `id`, `kind` (EVIDENCE | INFERENCE | DECISION), `content`, `weight`, `confidence`, opsiyonel `source` metadata.
- `edges[]`: her biri `from`, `to`, `type` (SUPPORTS | CONTRADICTS | DEPENDS_ON).
- `contradictions[]`: arbitrasyon kayıtları — hangi iki sinyal çelişti, hangi kuralla çözüldü.
- **Soru:** AI bu kararı NEDEN verdi?
- Şu an: NbaCard'ın altında "Why?" linkiyle açılan bir collapsible. **Kullanıcı bu derinliği fark etmiyor.**

**`InsightApplication[]`**
- Lead'in geçmişinde uygulanmış her CommercialInsight'ın kaydı: ne zaman uygulandı, sonuç ne oldu (pending/replied/booked/won/lost).
- **Soru:** Bu lead'e geçmişte hangi reframe'leri denedik?
- Şu an: UI'da YOK.

### 3.4 Etkileşim verisi (input)
Sayfa sadece okuma değil; SDR şu aksiyonları girer:

- **Voice note** — `POST /api/leads/[id]/voice-notes` → emit `voice_note_added` → MEDDPICC + SPIN extractor tetiklenir.
- **Call disposition** — `POST /api/leads/[id]/dispositions` → emit `disposition_logged` → outcome attributor.
- **Pipeline stage change** — sürükle-bırak veya buton → emit `watchlist_stage_changed` → outcome attributor.
- **Real objection** — manuel ekleme → REAL kaynaklı `Objection` row.
- **Manual worker run** — Workers tab'tan tek tek tetikleme (agency owner / power user için).

---

## 4. Mevcut UI'nın Sorunları

Designer'ın çözmesi gereken concrete sorunlar:

1. **Tab kısmı yatay tarama gerektiriyor.** Overview / Website / Workers / Reviews / Outreach — her sekmede ayrı ayrı veri var, hiçbiri "şimdi ne yapayım"a cevap vermiyor.
2. **NbaCard tek başına izole.** SDR Brain v2'nin %80'lik çıktısı bu karta sıkıştırılmış. Trigger'lar küçük rozet, reasoning bir "Why?" linki, objections bir mini liste. Hepsi expandable. Kimse açmıyor.
3. **Sidebar yetersiz.** Sol tarafta sadece iletişim bilgisi var. Tier, ICP fit, BANT, son trigger gibi "hızlı bakış" verisi sidebar'a layık ama yok.
4. **AI Workers paneli ürün gibi görünüyor, akıştan kopuk.** 30 worker'ın listesi göz korkutucu; SDR aslında bunlardan 4-5 tanesini elle tetikliyor (deep research, pitch pack, mockup). Geri kalanı zaten arka planda otomatik koşuyor — ama panelde aynı ağırlıkta görünüyor.
5. **MEDDPICC, SPIN, Stakeholder hiç yok.** Discover ve Close aşamalarına yardımcı olacak hiçbir surface yok. Voice note transcribe ediliyor ama SPIN sınıflaması geri yüklenmiyor.
6. **Pipeline stage değişikliği hiçbir yerden hissedilmiyor.** Lead `COLD`'ken vs. `REPLIED`'ken sayfa aynı görünüyor; halbuki ihtiyaç duyduğu bilgi tamamen farklı.
7. **Mobilde** segment control daralıyor ama tab içeriği masaüstü için tasarlanmış: tek kolon, devasa kartlar.

---

## 5. Tasarım Hedefleri

| Hedef | Ölçü |
|---|---|
| **G1.** Sayfa açılır açılmaz "Why now + What to say" anlaşılır | İlk fold (above the fold) içinde: pipeline stage, urgency, why now narrative, opening hook, channel önerisi |
| **G2.** Pipeline aşamasına göre sayfa morf eder | COLD/CONTACTED → Outreach öne; REPLIED/MEETING → Discover öne; LATE_STAGE → Close öne |
| **G3.** Reasoning her kartın altına gömülü, tek tıkla genişler | "Why?" linkleri "Show reasoning trace" pattern'iyle her büyük karta gelir |
| **G4.** Worker dünyası SDR'dan saklanır, agency owner'a açıktır | Workers tab → "Power tools" etiketi; ana akıştaki blokların altına otomatik sürerler |
| **G5.** Voice note → SPIN/MEDDPICC döngüsü tek hamlede gözle görülür | Voice note girer girmez; transcript + SPIN/MEDDPICC bloku yenilenmiş olarak ekrana iner |
| **G6.** İlerleme hissi: lead skorları zamanla değiştikçe küçük "+12" / "-5" delta'ları görünür | Polling-driven |
| **G7.** Mobil-öncelikli: aynı sayfa telefonda da SDR için kullanılabilir (ajansta saha çalışanı var) | Tek kolon stack; sticky CTA bar |

---

## 6. Sayfa Yapısı — Önerilen Information Architecture

Bu bir öneri; tasarımcı kendi yorumunu üretebilir. Ama bu yapı yukarıdaki "üç soru" akışını zorla uygular:

### 6.1 Header (sticky)
- **Sol:** Geri ok + işletme adı + sub-niche rozet + tier rozet (TIER_1 = altın, TIER_2 = gümüş, TIER_3 = bakır, TIER_4 = gri)
- **Orta:** Pipeline stage chip — interaktif, dropdown'la değiştirilebilir
- **Sağ:** Quick actions: `Call`, `Email`, `Add voice note`, `More` (kebab)

### 6.2 "Decision Bar" — yeni, sticky 2. row
Sayfa açılır açılmaz cevap istediğimiz soruyu burada cevaplıyoruz:

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔥 WHY NOW                              ⏱ Act within 7 days     │
│ "Owner just hired 2nd location head; reviews dropped to 3.6★    │
│  in last 30d — they're feeling growing pains."                   │
│                                                                   │
│ ▶ CALL Owner María García (champion, 0.82) — opening hook ▼     │
│   "I noticed you opened the Polanco location last month and      │
│   your delivery scores dipped. Most multi-loc operators we work  │
│   with hit a ops gap exactly here — worth 12 minutes?"           │
│                                                                   │
│ Why? · 3 contradictions arbitrated · v3 (final)                  │
└──────────────────────────────────────────────────────────────────┘
```

Bu blok = `LeadTrigger[]` özeti + `whyNow.headline` + `LeadNextAction.kind/channel/openingHook` + `Stakeholder` (champion seçili) + reasoning link.

### 6.3 Sidebar (sol, sticky desktop / collapsible mobile)

Tek bakışta okunabilir 5 satır:

| Slot | İçerik | Veri kaynağı |
|---|---|---|
| Contact | Phone / Email / Site / Maps icons | Lead |
| ICP Fit | "82/100 — strong" + dimension breakdown küçük inline bars | `IcpScore` + `IcpFitDimension[]` |
| Buying Readiness (BANT) | 4 mini-bar dikey: B / A / N / T (her biri 0-100) | `BuyingReadiness` |
| Account | "Casa Polanco · 4 locations · TIER_2" | `Account` + `AccountTier` |
| Champion | Avatar + name + roleLabel + championLikelihood | `Stakeholder[]` (filter en yüksek) |

### 6.4 Ana içerik — Pipeline-aware sekmeler

Sekme sayısı 5'ten 4'e iniyor ve isimler **fonksiyonel**, veri-tipi değil:

```
Brief   |   Outreach   |   Discover   |   Pipeline
```

Her sekme, lead'in pipeline stage'ine göre **default selected** değişir:
- COLD / CONTACTED → **Outreach** açık
- REPLIED / MEETING_BOOKED → **Discover** açık
- PROPOSAL_SENT / NEGOTIATING → **Pipeline** açık
- DEAL_WON / DEAL_LOST → **Brief** açık (retro / öğrenme)

#### Brief
- Dossier (mevcut, kalır)
- ICP Fit detail breakdown (dimension'a göre çubuk grafik)
- Account view (sister leads varsa, multi-location ise)
- Recent activity timeline (agentRuns + voice notes + dispositions, time-ordered)

#### Outreach
- Big card: NBA detayı (kanal, hook, what-not-to-pitch, confidence)
- Commercial Insight kartı (reframe + win-rate'i ile birlikte; "Apply this insight" tıklayınca `InsightApplication` yaratılır)
- Predicted Objections accordion (her birinin altında `rebuttalUsed`)
- "Send" buton grubu — kanala göre değişir; OAuth bağlıysa direkt gönderir, değilse kopyalar

#### Discover
- Stakeholder map (basit kartlar grid; her kart: name, role, champion/blocker rozeti, evidence)
- SPIN board (4 kolon: Situation / Problem / Implication / Need-Payoff; her kolonda `DiscoveryItem[]`)
- MEDDPICC checklist (7 satır; her birinde status badge + "facts" sayısı + collapse)
- "Add voice note" floating action button — kayıt sonrası otomatik SPIN/MEDDPICC refresh

#### Pipeline
- Stage timeline (visual: hangi stage'de ne kadar kaldı)
- Real Objections (manual ekleme + tarihçe)
- Insight Applications history (geçmişte uygulanmış her insight + sonucu)
- Outcome attribution timeline (hangi NBA, hangi insight, hangi sonuç → InsightPerformance'a nasıl katkı sağladı)

### 6.5 Power Tools drawer (sağ kenar, opt-in)
- Eski "Workers" tab'ının sade versiyonu.
- 14 görünür worker (`hiddenFromPanel: true` filtresi sonrası).
- Her birinde: durum, son çalışma, "Run again" butonu, plan kilidi.
- Kapalı varsayılan; açıldığında sayfa over-lay olarak gelir, ana akışı bölmez.

### 6.6 Reasoning Trace — global pattern
Her büyük blokun footer'ında küçük link:

```
ⓘ Why? · 4 evidence · 3 inferences · 1 contradiction
```

Tıklayınca: bottom sheet (mobil) / side drawer (desktop) açılır, `ReasoningTraceExpandable` içeriğini gösterir. Bu pattern blok-bağımsız: NBA, ICP Fit, BANT, Trigger listesi, MEDDPICC her biri kendi reasoning trace'ine sahip.

---

## 7. Komponent Kataloğu — Tasarımcının üreteceği temel parçalar

| Komponent | Veri | State'ler |
|---|---|---|
| `TierBadge` | `AccountTier` enum | TIER_1 (gold) / TIER_2 (silver) / TIER_3 (bronze) / TIER_4 (gray) |
| `IcpScoreRing` | `IcpScore` 0-100 | weak (<40) / mid (40-70) / strong (≥70) |
| `BantBars` | 4x 0-100 | hover → reasoning tooltip |
| `TriggerChip` | `LeadTrigger` (type, urgency) | hot (urgency≤3d) / warm (≤14d) / cool |
| `WhyNowHeadline` | string + urgency 0-100 | tek satır + sub-line |
| `NbaPrimaryCard` | preliminary `LeadNextAction` | `dashed border + spinner` |
| `NbaPrimaryCard` | final `LeadNextAction` | `solid + glow` |
| `OpeningHookBlock` | string + channel | copy / send buttons |
| `CommercialInsightCard` | `CommercialInsight` + `InsightPerformance` | win-rate badge (>%30 = green, <%15 = warn) |
| `ObjectionAccordion` | `Objection` (PREDICTED) | predicted (mute) / real (highlighted) |
| `StakeholderCard` | `Stakeholder` | champion / decision_maker / blocker / influencer / gatekeeper / user |
| `SpinBoard` | `DiscoveryItem[]` grouped by `kind` | confidence bar her item'da |
| `MeddpiccChecklist` | `DealQualification` + `Fact[]` | UNKNOWN / PARTIAL / CONFIRMED, her birine evidence drilldown |
| `ReasoningTraceSheet` | `reasoningGraph` + `arbitrationRecords[]` | EVIDENCE / INFERENCE / DECISION node tipleri renk kodlu |
| `ContradictionLogItem` | `ContradictionRecord` | ruleCode + 2 conflicting nodes + resolution + resolverNote |
| `PipelineStageStepper` | enum + history | interactive |
| `InsightApplicationRow` | `InsightApplication` | pending / replied / booked / won / lost |
| `VoiceNoteRecorder` | n/a | recording / uploading / processing |
| `PowerToolDrawer` | filtered `WORKERS[]` | per-worker mini-card |

---

## 8. Etkileşim & State Diyagramı

### 8.1 Sayfa hidrasyonu
```
t=0     User opens page
        ├─ Lead detail (hızlı, cached)         → Header + Sidebar dolu
        ├─ NBA endpoint poll başlar (every 2s) → Decision Bar "preliminary" state
        └─ Tab içerikleri ayrı ayrı yüklenir   → her biri kendi skeleton'ıyla

t=3-8s  Preliminary NBA gelir (BANT-only)
        → Decision Bar dashed border + spinner

t=15-45s Final NBA (SDR_BRAIN T3) gelir
        → Decision Bar solid + glow
        → Polling durur
        → Reasoning trace artık erişilebilir
        → Trigger chips render
        → Commercial Insight render

t=∞     User aksiyon alır:
        - voice note → MEDDPICC/SPIN tab'larında live update (websocket veya optimistic + polling)
        - disposition logged → outcome attributor tetikler → InsightPerformance update
        - stage change → tab default değişir
```

### 8.2 NBA morphing animasyonu
- Preliminary → Final geçişinde **layout shift olmayacak şekilde** crossfade.
- Border: `dashed → solid`, glow: yok → soft.
- Yeni veri (insight, objections, stakeholder, hook) cascade fade-in.

### 8.3 Loading / Error / Empty
| Durum | Tasarım yaklaşımı |
|---|---|
| Lead yeni oluştu, T1 bile çıkmadı | Decision Bar: "Quick analysis running…" (3-5s wait normal) |
| T3 8 dakikadır gelmiyor | Decision Bar: warning icon + "Brain analysis taking longer than usual. [Retry deep run]" |
| Plan limiti dolu | Block içinde rozet: "Upgrade to Pro to unlock" |
| Worker fail oldu | Block içinde rozet: "Last run failed · [Retry]" — alttaki insight/data eski versiyonla render edilir |
| Hiç voice note / discovery yok | SPIN board boş → "Drop a voice note to start discovery" CTA |
| Hiç stakeholder bulunamadı | Stakeholder grid → "Run STAKEHOLDER_DISCOVERER (Phase 2)" gri buton |

---

## 9. Tasarım Sistemi & Brand

CSS değişkenleri (kullanılacak ana tokenlar — tüm Tailwind class'ları bu var'ları okuyor):

### 9.1 Renk paleti
- **Brand (LeadAC altın/sarı):** `--leadac-100..900` (HSL h=38, s=78%)
  - Primary action / focus / glow → `--leadac-500`
  - Hover → `--leadac-400`
  - Active state border → `--leadac-500`
- **Neutral:**
  - Background: `--leadac-bg` (very dark)
  - Surface: `--leadac-surface` (cards)
  - Card raised: `--leadac-card`
  - Hover: `--leadac-hover`
  - Border: `--leadac-border`
- **Text:**
  - Primary: `--leadac-text-1`
  - Secondary: `--leadac-text-2`
  - Tertiary: `--leadac-text-3`
  - Muted: `--leadac-muted`
- **Semantic:**
  - Success: `--leadac-success` (green)
  - Warning: `--leadac-warning` (amber)
  - Error: `--leadac-error` (red)
  - Info: `--leadac-info`
- **Glow (cinematic touch — final NBA için):**
  - `--leadac-glow-soft / -medium / -strong`

### 9.2 SDR Brain v2'ye özel renk önerileri (bu brief'le birlikte tanımla)

| Anlam | Token önerisi | Nerede kullanılır |
|---|---|---|
| Trigger urgency: hot (≤3d) | `--leadac-error` ile uyumlu kırmızımsı | TriggerChip |
| Trigger urgency: warm (≤14d) | `--leadac-warning` (amber) | TriggerChip |
| Trigger urgency: cool | `--leadac-text-3` | TriggerChip |
| Champion | `--leadac-500` (gold) | StakeholderCard rozet |
| Blocker | `--leadac-error` | StakeholderCard rozet |
| MEDDPICC CONFIRMED | `--leadac-success` | Checklist |
| MEDDPICC PARTIAL | `--leadac-warning` | Checklist |
| MEDDPICC UNKNOWN | `--leadac-text-3` | Checklist |
| Reasoning EVIDENCE | mavi (önerilir, yeni token gerekebilir) | Reasoning trace dot |
| Reasoning INFERENCE | mor | Reasoning trace dot |
| Reasoning DECISION | altın | Reasoning trace dot |
| Reasoning CONTRADICTS edge | kırmızı | Reasoning trace edge |

### 9.3 Tipografi
- Sans-serif (Inter) zaten yüklü.
- Display için: header → text-2xl/3xl bold; section title → text-sm uppercase tracking-wide muted (mevcut pattern).
- Monospace yalnızca: phone numbers, IDs, evidence quotes.

### 9.4 Motion
- Crossfade'ler 200-300ms, ease-out.
- Glow pulse final NBA gelince 1 kere (sonra sabit).
- Sayfaya yeni veri akışı (polling sonucu) — tüm bloklarda 150ms fade-in, asla layout shift değil.
- Framer Motion zaten projede var; `AnimatePresence` + `layout` prop ile çalışılır.

---

## 10. Kısıtlamalar & Edge Case'ler

1. **Multi-tenant.** Her veri zaten `workspaceId`'ye scope'lu. Designer için bu görünmez ama sayfada **workspace context bar** olabilir mi sorulacak (hangi workspace'deyim hatırlatması).
2. **Plan tier'ları.** FREE / PRO / PRO_TEAM / AGENCY. Bazı SDR Brain v2 worker'ları `PRO+` gerektiriyor. Bloklar locked state'i ile gelmeli (rozet + upgrade CTA).
3. **Tek kullanıcı vs. takım.** PRO_TEAM workspace'inde aynı lead'e bakan birden fazla SDR olabilir. "Currently viewed by Alex" gibi bir touch — opsiyonel, V2 düşünülebilir.
4. **i18n.** Tüm worker'ların `displayName` + `displayNameTr` var. Marketing TR/EN bilingual; ürün iç UI şu an çoğunlukla EN. Designer her label'da TR çeviri için yer ayırmalı (örn. tooltip'te TR alt-yazı).
5. **Mobile-first.** Saha kullanımı var; 375-414px viewport için tek kolon, sticky CTA bar (call/voice note), drawer açılışları bottom-sheet.
6. **A11y.** Reasoning trace, MEDDPICC, SPIN — hepsinde keyboard navigation; renk semantic'i tek başına değil, ikon/text de eşlik etsin (color-blind safe).
7. **Polling impact.** NBA endpoint 2 saniyede bir poll edilirken kullanıcının diğer aksiyonları (insight apply, objection ekleme) optimistic UI olmalı, request finish'i beklenmemeli.
8. **Backward compat.** Mevcut tab linkleri (örn. `?tab=workers#anchor-workers-top`) deep link olarak production'da kullanılıyor. Yeni IA'da bu URL'ler 301 redirect veya hash backward-compat planlanmalı.

---

## 11. Designer'a açık sorular (cevap bekliyor)

Bu sorulara cevap verirsek tasarım netleşir:

1. **Header'da pipeline stage chip mi, yoksa stepper mı olmalı?** Stepper daha çok info verir ama yer kaplar; chip + dropdown daha kompakt.
2. **"Decision Bar" sticky'liği kaç piksel scroll sonrası şirink olmalı?** (örn. 200px scroll → header + decision bar tek satıra düşsün)
3. **Reasoning trace mobilde bottom sheet mi tüm sayfa modal mı?** Bottom sheet yarıdan yukarıyı görmesini sağlar (avantaj); modal odak (avantaj).
4. **Stakeholder grid mi, hierarchy görsel mi?** Hierarchy daha doğru ama "blocker → champion → economic buyer" ilişkisi bilinmiyor (data yok). Grid pragmatik.
5. **SPIN board kanban mı (kolon-bazlı), yoksa timeline mı (zaman-bazlı)?** Kanban kategoriyi öne çıkarır; timeline keşif sürecini gösterir.
6. **MEDDPICC checklist'i sayfada açık mı yoksa accordion mu?** 7 boyut çok yer kaplar; ama her zaman açık olması "neyi atladım" hatırlatır.
7. **Power Tools drawer'ı triggerlamak için global FAB mı, header'dan kebab mı?** FAB SDR'a "ek katman" hissi verir; kebab gizler.
8. **Voice note recorder global FAB mı yoksa Discover tab'ında inline mi?** Saha kullanımı için global FAB güçlü argüman.
9. **InsightPerformance verisini lead sayfasında mı (insight kartının altında) yoksa sadece settings'te mi göstereceğiz?** Lead sayfasında "bu insight ortalama %42 cevap aldı" göstermek SDR'ın seçimini etkiler — pozitif.
10. **Champion rozeti ile economicBuyer rozeti aynı stakeholder'da çakışırsa birinciyi mi öncelendirelim?** (Champion daha sıcak; ama Economic Buyer karar yetkili.)

---

## 12. Referans dosyalar

Tasarımcının inspect edebileceği — **kodu okumak zorunda değil**, sadece "şu komponent şu dosyada, davranışı şu" diye haritalama:

- **Sayfa root:** `src/app/app/leads/[id]/page.tsx` (mevcut tab yapısı, ~2650 satır)
- **NBA card (mevcut):** `src/components/app/nba/NbaCard.tsx`
- **Reasoning trace expandable (mevcut):** `src/components/app/nba/ReasoningTraceExpandable.tsx`
- **Workers panel (mevcut):** `src/components/app/ai-workers-panel.tsx`
- **Voice notes panel (mevcut):** `src/components/app/voice-notes-panel.tsx`
- **Brand tokens:** `src/app/globals.css` — tüm `--leadac-*` ve `--cine-*` var'lar
- **Brand kit PDF:** `public/leadac-brand-kit.pdf`
- **Logo:** `public/logo.png`
- **API'lar (designer prototype'da mock'layabilir):**
  - `GET /api/leads/[id]` — lead temel
  - `GET /api/leads/[id]/next-action` — preliminary + final NBA + triggers + insight + reasoning graph + arbitration
  - `GET /api/leads/[id]/workers` — worker statusları (artık `hiddenFromPanel` filtresiyle 14 worker)
  - `GET /api/settings/insight-performance` — insight win-rate (settings'te)
- **Eski tasarım deck'i:** `research/finedine/beta-presentation-deck.md` (bağlam için)

---

## 13. Deliverable beklentisi

Tasarımcıdan beklenen çıktı:

1. **Lead detail sayfası — 3 ana state Figma** (desktop + mobile):
   - Yeni lead (preliminary NBA gelmiş, final beklenirken)
   - Olgun lead (final NBA, full data, COLD aşamada)
   - REPLIED aşaması (Discover öne çıkmış, MEDDPICC + SPIN dolu)
2. **Komponent library** — yukarıdaki tablodaki 18 komponentin Figma master'ları (Auto-layout + variant'lar)
3. **Reasoning trace pattern** — ayrı bir frame'de (mobile bottom sheet + desktop drawer)
4. **Power Tools drawer** — açık/kapalı state
5. **Empty / Loading / Error state'leri** — her ana blok için en az 1 örnek
6. **State transition spec** — preliminary → final NBA crossfade için kısa motion notu
7. **Token önerileri** — yeni renk/spacing token'ları ekleneceği yerleri commitle (örn. `--leadac-trigger-hot`)

---

## 14. Önemli filtreler (tasarımcı için "yapma" listesi)

- **Yeni renk/font sistemi getirme.** Brand tokenları sabit; sadece yeni semantic token öner.
- **Sidebar'a 5'ten fazla slot koyma.** Hızlı bakış değerini kaybeder.
- **Worker listesini ana akışa karıştırma.** SDR akışı (Brief/Outreach/Discover/Pipeline) ve Power Tools birbirinden ayrı kalsın.
- **MEDDPICC/SPIN'i COLD lead'lerde öne çıkarma.** Pipeline stage öncesi bu data zaten yok ya da çok zayıf.
- **NBA card'ı preliminary state'de "tamam" göstermesi.** Kullanıcı her zaman bunun bir "quick read" olduğunu anlamalı (dashed/spinner şart).
- **Reasoning trace'i defaultta açık bırakma.** Yer kaplar, gürültü yapar, opt-in pattern doğru.
- **3'ten fazla sticky element koyma.** Header + decision bar + (mobil için) CTA bar. Daha fazlası viewport'u yer.

---

**Özet bir cümleyle:** Bu sayfa bir "lead profili" değil; bir SDR'ın **bir sonraki 90 saniyede ne yapacağına dair karar yüzeyi**. Tüm SDR Brain v2 verisini bu karara hizmet ettirecek şekilde yeniden organize et.
