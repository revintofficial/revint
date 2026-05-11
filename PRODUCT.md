# LeadAC — Tam Ürün Dokümantasyonu

> Kaynak doğrudan koddan çıkarılmıştır: `prisma/schema.prisma`, `src/lib/agent-workers/registry.ts`, `src/lib/ai-core/chains.ts`, `src/lib/plans.ts`, `src/app/**`, `src/workers/**`. Pazarlama söyleminden değil, gerçekten kurulu olan işlevsellikten yazılmıştır.

---

## 1. Tek Cümlede Ürün

LeadAC, **lokal işletmelere outbound satış yapan ajansların** kullandığı **lokal lead-intelligence (potansiyel müşteri istihbaratı) katmanıdır**. Bir posta kodu ve niş yazarsınız; sistem Google Maps'ten taze leadleri çeker, her sitede 20+ sinyalli denetim çalıştırır, fit skoru üretir (0–100), ve denetim bulgularına dayanan bir cold-email taslağı yazar. Gönderme işini Smartlead, Instantly, GHL, Gmail veya Outlook yapmaya devam eder; LeadAC onlara yakıt verir.

İçinde 30'dan fazla AI worker, planner DAG'i, vector-tabanlı semantic memory, kanban deal pipeline, çoklu kullanıcı workspace + rol yönetimi, native Gmail/Outlook entegrasyonu, Stripe billing, multi-tenant izolasyon ve programmatic SEO katmanı barındırır.

---

## 2. Teknik Yığın (Stack)

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 16.2.3** (App Router, Webpack), **React 19**, **TypeScript** |
| ORM / DB | **Prisma 6** + **PostgreSQL** + **pgvector** (768-boyutlu embedding) |
| Auth | **Supabase** (`auth.users` ↔ `User` trigger ile senkron) |
| Queue | **BullMQ** + **Redis** (ioredis) — supervisor 7 worker süreci yönetir |
| LLM | **Google Gemini** (`@google/generative-ai`) — embedding `gemini-embedding-001` (`outputDimensionality=768`), JSON-mode generation |
| Crawl | **Playwright** (site denetimi için Chromium headless) |
| Enrichment | **Apify** actor'ları — Google Maps deep, web crawl deep, sosyal medya, SERP, rakip reklamlar, LinkedIn, Reddit |
| Email | **Resend** (transactional), **OAuth Gmail/Outlook** (kullanıcı gönderimi) |
| Billing | **Stripe v22** (no `apiVersion` pin), webhook idempotency `StripeEventLog` ile |
| UI | **Tailwind v4** (PostCSS), **Radix UI**, **Framer Motion**, **lucide-react**, **sonner** (toast), **TipTap**, **dnd-kit**, **Recharts** |
| Fontlar | Inter (sans + mono), Oswald (display) |

**Hard kurallar** (her değişiklikte uyulur):

1. Workspace'e ait her Prisma sorgusu **`workspaceId`** ile scope edilir. Cross-tenant veri sızıntısı en yüksek öncelikli bug sınıfıdır.
2. Generated Prisma client `@/generated/prisma/client` üzerinden import edilir, asla `@prisma/client`'tan değil.
3. Semantic memory'ye yalnızca `src/lib/ai-core/memory.ts` üzerinden yazılır/okunur — direkt `prisma.semanticMemory.*` çağrısı yasak.
4. AI işi için yeni BullMQ kuyruğu **eklenmez** — `agent-runs` queue'una `type` discriminator eklenir veya AI Core chains genişletilir.
5. Yeni Gemini-çağıran endpoint **eklenmez** — her çağrı `src/lib/agent-workers/` altında bir worker modülü olarak sarılır.
6. Stripe webhook: imza doğrulama + `runtime = "nodejs"` + `StripeEventLog` ile idempotency zorunlu.

---

## 3. Plan Yapısı (Pricing)

Tek doğru kaynak: `src/lib/plans.ts`. Para birimi `USD` ve `GBP`; faturalama `monthly` veya `annual` (`%20` indirim).

| Plan Enum | Pazarlama Adı | Aylık USD | Aylık GBP | Koltuk | Lead/ay | AI Kredi/ay | Mockup/ay |
|---|---|---|---|---|---|---|---|
| `FREE` | (sunset — yeni signup'lara gizli) | $0 | — | 1 | 50 | 20 | 3 |
| `PRO` | **Solo** | $79 | £59 | 1 | 1.000 | 500 | 50 |
| `PRO_TEAM` | **Studio** | $149 | £99 | 3 | 2.500 | 1.500 | 150 |
| `AGENCY` | **Agency+** | $249 | £199 | 5 | 5.000 | 5.000 | 300 |

Plan başına özellikler:

- **PRO (Solo)** — 1.000 lead, 50 mockup, 500 audit + opener, **native Gmail/Outlook send + reply attribution**, opener öğrenme döngüsü (success memory), Smartlead/Instantly CSV export, deep review scan (lead başına 500'e kadar).
- **PRO_TEAM (Studio)** — 3 koltuk, 2.500 lead, 150 mockup, 1.500 AI audit, AI receptionist + review-reply + lead-response export'ları, mobil PWA + voice notes (saha kullanımı).
- **AGENCY (Agency+)** — 5 koltuk, 5.000 lead, 300 mockup, **tüm install suite** (receptionist, review-reply, lead-response, booking widget, GBP poster), **deep Apify enrichment**, AI sales co-pilot (tool calling), reply attribution dashboard, **multi-tenant workspaces + white-label branding**, dedicated onboarding.

Plan rütbesi `PLAN_RANK = { FREE: 0, PRO: 1, PRO_TEAM: 2, AGENCY: 3 }`. `planMeetsMinimum(plan, minPlan)` worker erişimini bu skala üzerinden geçer.

Yardımcı fonksiyonlar (`plans.ts`): `getPriceId(plan, currency, cycle)`, `hasAnnualPricing`, `getDisplayPrice`, `currencySymbol`, `normalizeCurrency`, `normalizeCycle`, `detectBrowserCurrency` (UK locale → GBP), `getPlanLabel` (UI'da `"PRO_TEAM"` yerine `"Studio"`), `planAllowsAdditionalSeat(plan, currentSeatCount)`.

---

## 4. Workspace ve Multi-Tenant Mimari

### 4.1 Workspace Modeli

`Workspace` (her tenant'ın temel scope'u) şu alanları taşır:

- **Kimlik**: `id`, `name`, `slug` (unique), `ownerId`
- **Plan & faturalama**: `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`
- **Cycle sayaçları**: `leadsCreatedThisCycle`, `aiCreditsUsedThisCycle`, `cycleResetAt` (Stripe billing cycle ile align)
- **Niche**: `niche` (`WEB_AGENCY` | `RESTAURANT_TECH` | `DENTAL` | `REAL_ESTATE`), `targetSubNiches[]` (alt-vertical odak listesi)
- **Coğrafya**: `country` (ISO-3166-1 alpha-2)
- **Onboarding**: `onboardingCompletedAt`
- **"My offer" bağlamı** (`POSITIONING.md` § 4): `offerName`, `valueProposition`, `socialProof`, `offerHook`, `objective`, `tone`, `length`, `language` (default `"en"`), `senderName`, `conversionLink`
- **White-label**: `branding` (JSON, AGENCY+ tier)
- **Public profile gate**: `publicProfilesEnabled` — açıkken `/[country]/[city]/[niche]/[business]` SEO sayfaları render edilir
- **Telefoni**: `telephonyWebhookSecret` (workspace başına HMAC secret)

### 4.2 Üyelik & Roller

`WorkspaceMember(workspaceId, userId, role)` tablosu üyelikleri tutar; `role` enum'u: **`OWNER`** | **`ADMIN`** | **`MEMBER`**. Aktif workspace `leadac_active_workspace_id` cookie'sinden çözümlenir; cookie kullanıcı üyesi değilse en eski üyelik seçilir.

### 4.3 `requireUser()` Helper

`src/lib/auth.ts` içinde tanımlı, her authed route ve worker'ın güvenilir başlangıç noktası:

- Supabase oturumunu okur
- `User` satırını upsert eder (Supabase `auth.users`'tan id ile)
- Aktif workspace üyeliğini çözer
- İlk girişte otomatik kişisel workspace oluşturur
- Oturum yoksa `UnauthorizedError` (→ 401)

Request body'sinden veya URL'den gelen `workspaceId` **güvenilmez**: önce `WorkspaceMember.findUnique` ile üyelik doğrulanır.

### 4.4 Workspace-Scoped Tablolar

`workspaceId` zorunlu olan tablolar (her query bunlarla kapsanır):

`Lead`, `WebsiteAudit`, `SalesOpportunity`, `WatchlistItem`, `GoogleReview`, `Mockup`, `WebsiteMockup`, `ReviewAnalysis`, `VoiceNote`, `AgentRun`, `SemanticMemory`, `PlannerSession`, `WorkspaceLeadPipeline`, `ServicePackage`, `TeamTodo`, `EmailAccount`, `CopilotMessage`, `WorkspaceMember`, `Account`, `LeadActivity`, `Sequence`, `SequenceStep`, `LeadSequenceState`, `LeadSegment`.

---

## 5. Lead (Potansiyel Müşteri) Veri Modeli

`Lead` tablosu her potansiyel müşteriyi temsil eder. Place başına workspace içinde tek satır (`@@unique([workspaceId, placeId])`).

### 5.1 Temel alanlar

- **Google Places kimlikleri**: `placeId`, `businessName`, `formattedAddress`, `borough`, `phone`, `websiteUrl`, `hasWebsite`, `googleMapsUri`, `rating`, `reviewCount`, `businessStatus`, `primaryType`, `priceLevel` (0–4 ladder)
- **Discovery context**: `sourceQuery`, `sourceLat`, `sourceLng`, `discoverySourceQuery`

### 5.2 Worker durum enum'ları (her lead taşır)

- `crawlStatus`: `PENDING | CRAWLING | CRAWLED | FAILED | NO_WEBSITE`
- `analyzeStatus`: `PENDING | ANALYZING | ANALYZED | FAILED`
- `reviewAnalysisStatus`: `PENDING | ANALYZING | ANALYZED | FAILED | NO_REVIEWS`
- `pipelineStatus`: `OK | BLOCKED_NEEDS_PACKAGES`

### 5.3 Niche / sub-niche etiketleme

- `nicheSlug`, `subNicheSlug`, `subNicheSource` (`AUTO | MANUAL`), `subNicheConfidence` (0..1), `subNicheVersion`, `subNicheSlugs[]` (hibrit lead'ler için), `subNicheAlternatives` (JSON: `[{slug, confidence, reason}]`)
- AgentRun'lar `inputSubNicheVersion` snapshot'ı taşır; bir override sonrası kuyruğa alınmış stale worker, mevcut versiyonu daha yüksek bulursa `SUCCEEDED` + `"stale-subniche-version"` ile çıkar.

### 5.4 SDR workflow alanları

- `lastContactedAt`, `nextActionDueAt`, `sequenceStep`, `lastDisposition` (CallDisposition)
- `assignedToUserId` (multi-rep workspace'lerde sahibi)
- `archivedAt`, `discardedAt`, `snoozeUntil` (lifecycle flags)
- `salesConfidence` (0–100, `LEAD_INTELLIGENCE_BRIEF` çıktısı), `intelligenceVersion`

### 5.5 Compliance (KVKK / GDPR)

- `dnc` (do-not-contact) — true ise send-email/whatsapp API'leri reddeder, UI'da kırmızı badge çıkar
- `consentSource` (`PUBLIC_LISTING` | `MANUAL_OPT_IN` | `REFERRED`)
- `consentRecordedAt`, `optedOutAt`
- `timezone` (IANA, "Europe/Istanbul" gibi) — "Local time: 14:34" badge'i bu alandan çıkar; TR SDR NYC'de saat 4'te aramaz

### 5.6 Multi-location rollup

`accountId` opsiyonel — aynı brand'in birden çok lokasyonu (örn. FineDine'ın 5 restoranı) tek `Account` satırı altında toplanır. `Account` tablosu `name`, `apexDomain` (dedupe sinyali), `primaryEmail`, `primaryPhone`, `notes`, `archivedAt` taşır.

### 5.7 İlişkiler

Her `Lead` aşağıdakilere referans eder: `WebsiteAudit?`, `SalesOpportunity?`, `WatchlistItem?`, `GoogleReview[]`, `Mockup[]`, `WebsiteMockup[]`, `ReviewAnalysis?`, `VoiceNote[]`, `AgentRun[]`, `SemanticMemory[]`, `PlannerSession[]`, `LeadActivity[]`, `LeadSequenceState[]`.

---

## 6. AI Worker Sistemi (30+ worker)

`AgentWorkerKind` enum'u, sistemde çalıştırılabilir her AI işinin sınıflandırmasıdır. Workers beş gruba ayrılır:

### Grup A — Intelligence (lead ingest'inde otomatik)

| Worker | Min Plan | Süre | Açıklama |
|---|---|---|---|
| **`WEBSITE_AUDITOR`** | FREE | ~15s | Playwright ile siteyi tarar; HTTPS, mobile fit, contact form, WhatsApp link, booking sistemi (provider tespiti dahil), e-commerce, services, nav items, CTA links, contact emails, broken links, structured data, LCP'yi kaydeder. `WebsiteAudit` satırı yazar. Bot-blocked 4xx vs gerçek DNS fail'i ayrıştırır (`crawlError`, `httpStatus`). |
| **`GOOGLE_PLACES_REVIEWS`** | FREE | ~4s | Lead oluşturulurken Places API'den 5 yorum çeker — `REVIEW_ANALYST`'in en azından bir corpus'u olsun diye. Tek API çağrısı, Gemini/Apify yok. |
| **`REVIEW_ANALYST`** | FREE | ~20s | Up to 50–500 yorum → Gemini 2.5 Flash JSON mode → `ReviewAnalysis` satırı: `weaknessKpis`, `strengthKpis`, `sentimentBreakdown` (positive/neutral/negative), `painPhrases`, `strengthPhrases`, `switchSignals`, `leadScore` (0–100), `summary`. |
| **`SUBVERTICAL_CLASSIFIER`** | FREE | ~4s | Hibrit niş leadleri için (örn. `fnb` → `fnb-bar-club` / `fnb-fine-dining` / `fnb-coffee-shop` / `fnb-ghost-kitchen`). Önce kural-tabanlı (Google Places types + isim + audit sinyalleri + price level + discovery query); kararsız kalırsa Gemini fallback. Çocuk paketi olmayan workspace'lerde kendini atlar. |
| **`SOCIAL_SCRAPER`** | FREE | ~8s | Instagram, Facebook, LinkedIn, TikTok, YouTube, Twitter, WhatsApp profillerini siteden link çıkararak bulur. Derin profil verisi için `APIFY_*` workers. |
| **`EMAIL_VERIFIER`** | PRO | ~3s | ZeroBounce ile her contact email'i doğrular; `WebsiteAudit.contactEmailsVerified` JSON'una yazar (`{ email, verified, verifiedAt, status }`). CSV export default olarak yalnızca verified email gösterir. |
| **`SALES_OPPORTUNITY_SCORER`** | FREE | ~12s | 0–100 fırsat skoru, `reasonCodes`, `whyGoodTarget`, `likelyPainPoints`, `bestSalesAngle`, `suggestedOffer` (STARTER/GROWTH/SALES), `personalizedFirstMessage`, `expectedPriceBand`, `recommendedPackageId` (workspace'in `ServicePackage`'larından seçilir), `recommendedPackageReason`. |
| **`LEAD_INTELLIGENCE_BRIEF`** | FREE | ~9s | Final-stage rollup. Audit + reviews + sosyal + deep crawl + dossier + mockup'ı tek "Sales Talking Points" + 0–100 **Sales Confidence** skoruna ezer. `Lead.salesConfidence` ve `Lead.intelligenceVersion`'ı denormalize update eder. Birden fazla skor kaynağının çelişkisini bitiren tek canonical artifact. |

### Grup B — Pitch (prospect'e gidecek artifact'lar)

| Worker | Min Plan | Süre | Çıktı |
|---|---|---|---|
| **`WEBSITE_PLAN_GENERATOR`** | FREE | ~35s | 19-section profesyonel web geliştirme planı (Markdown). Audit + review analizine bağlı. |
| **`WEBSITE_MOCKUP_GENERATOR`** | FREE | ~25s | Production-quality tek-sayfa landing site. `WebsiteMockup` satırı: `sectionsJson` (hero/services/testimonial/cta/about), `themeJson`, `htmlCache`, `templateId` (default `"leadac-hero-v1"`). `/m/{slug}` adresinde public URL — prospect telefondan açar. Auto chains'te artık YOK; on-demand "Generate Mockup" butonuyla `user_one_click_pitch` chain'i tetikler. |
| **`OPENER_WRITER`** | FREE | ~8s | Personalize cold-email (veya WhatsApp) ilk mesajı. SemanticMemory'den `OPENER_SUCCESS` (workspace scope, top-5) + `LEAD_PROFILE` (lead scope, top-1) few-shot retrieval. Sub-niche aware (confidence < 0.7 ise parent angle'a fallback). |
| **`VIDEO_SCRIPT_WRITER`** | PRO | ~10s | 30-saniyelik Loom / Vidyard kişiselleştirilmiş video scripti per lead. |
| **`VOICE_NOTE_TRANSCRIBER`** | FREE | ~6s | Saha sesli notlarını Gemini ile metne çevirir, pipeline notlarına ekler. |
| **`LEAD_DOSSIER_GENERATOR`** | FREE | ~12s | Toplanmış her sinyali 2-dakikalık Markdown brief'e çevirir. AgentRun'da cache'lenir; reviews/Apify değişmedikçe instant servis. SemanticMemory'den `LEAD_PROFILE` + `REVIEW_CHUNK` retrieval. |

### Grup C — Deliverable (kapatılan müşterinin sistemine kurulacak paketler)

| Worker | Min Plan | Süre | Export Formatları |
|---|---|---|---|
| **`AI_RECEPTIONIST_BUILDER`** | FREE (launch) | ~40s | `synthflow`, `retell`, `vapi`, `ghl`, `json`, `kb_json`. Greeting, FAQ, hours, booking flow tuned to the lead. `APIFY_WEB_CRAWL_DEEP` `PROSPECT_KB_CHUNK` doldurduysa FAQ ve servisler prospect'in kendi site içeriğine grounded. |
| **`REVIEW_REPLY_AGENT`** | FREE (launch) | ~25s | `json`, `zip`. 50-cevap havuzu + ton spec + 1–2 yıldız onay kuralı. Reploi / UseLocalGuide / Zapier ile GBP'ye takılır. |
| **`LEAD_RESPONSE_AGENT`** | FREE (launch) | ~20s | `ghl`, `n8n`, `make`, `json`. Inbound lead'lere 60 saniyede cevap veren SMS/email tetikleyici akışı. |
| **`BOOKING_WIDGET_BUILDER`** | PRO | ~15s | `html`, `json`. Embeddable HTML booking widget + Cal.com/GHL takvim config. |
| **`GBP_AUTOPOST_AGENT`** | PRO_TEAM | ~30s | `json`, `zip`. 30-günlük Google Business Profile post takvimi + asset prompt'ları. |

### Grup D — Ops (platform-level)

| Worker | Min Plan | Açıklama |
|---|---|---|
| **`COPILOT_CHAT`** | FREE | Workspace-wide Gemini chat; pipeline'daki her lead'i bilir. Tool calling: `search_leads`, `semantic_search_leads`, `start_pitch_pack`, `start_deep_research`, `find_lookalikes`. |
| **`INBOX_REPLY_ATTRIBUTOR`** | PRO | Gmail/Outlook gelen cevapları gönderilen opener'larla eşleştirir, `OutreachStatus`'u ilerletir. `OPENER_SUCCESS` / `OPENER_FAILURE` SemanticMemory yazar (sentinel step). |
| **`OUTREACH_SENDER`** | PRO | OAuth Gmail/Outlook'tan workspace içinden direkt send. Hesap başına `dailyLimit` (default 500), `sentToday`, `resetAt`. |
| **`CONTAINMENT_RATE_TRACKER`** | PRO_TEAM | Kurulan AI receptionist'in insan devrine gerek duymadan bitirdiği call yüzdesini ölçer. Ajansın müşteri yenileme pitch'i için metrik. |

### Grup E — Enrichment (Apify'a-bağlı dış data kaynakları)

Her Apify worker actor çalıştırır, sonuçları SemanticMemory'ye yazar (uygun `MemoryKind`), raw artifact'i `AgentRun.outputJson`'a kaydeder. `costUsdCents` cycle başına `MONTHLY_APIFY_USD_CENTS` cap'e karşı toplanır. Hepsi opt-in.

| Worker | Min Plan | Süre | Mod | Maliyet (yaklaşık) |
|---|---|---|---|---|
| **`APIFY_GMAPS_DEEP`** | PRO | ~90s | sync | ~$1–2 / lead. Compass/crawler-google-places — 500 yorum + email'ler + 6 sosyal link + foto. |
| **`APIFY_WEB_CRAWL_DEEP`** | PRO | ~120s | sync | ~$0.50 / site. RAG-uyumlu markdown chunk'lara çevirir. `PROSPECT_KB_CHUNK` memory yazar. |
| **`APIFY_INSTAGRAM_DEEP`** | PRO | ~60s | sync | ~$0.003 / post. Profil + son postlar + engagement. |
| **`APIFY_FACEBOOK_DEEP`** | PRO | ~60s | sync | ~$0.002 / post. Postlar + engagement. |
| **`APIFY_TIKTOK_DEEP`** | PRO | ~60s | sync | ~$0.003 / video. clockworks/tiktok-scraper. |
| **`APIFY_SERP_RANK`** | PRO | ~90–180s | **async-apify** | google-search-scraper. Webhook ile finalize. |
| **`APIFY_COMPETITOR_ADS`** | PRO | ~60s | sync | curious_coder/facebook-ads-library-scraper. |
| **`APIFY_LINKEDIN_COMPANY`** | PRO_TEAM | ~75s | sync | HarvestAPI — şirket çalışanları + ise alım sinyalleri. |
| **`APIFY_REDDIT_MENTIONS`** | PRO | ~45s | sync | trudax/reddit-scraper-lite — itibar taraması. |

---

## 7. AI Core — Planner, Orchestrator, Chains, Memory

### 7.1 Olay (event) modeli

Tek giriş noktası: `emit(event, payload)` (`src/lib/ai-core/events.ts`). Bir `PlannerSession` yaratır, ilk `orchestrator_advance` job'ını `agent-runs` queue'una atar.

`EventKind` union:

- `lead_created` (workspace'in `WorkspaceLeadPipeline` row'undan dinamik resolve)
- `lead_reviews_updated`
- `inbox_reply_received`
- `user_one_click_pitch`
- `user_deep_research`
- `user_receptionist_with_kb`

### 7.2 Chains (DAG'lar)

Her chain `ChainStep[]`: `{ stepId, workerKind, dependsOn[], optional?, inputs? }`.

**`lead_created` preset'leri** (`PipelinePreset` enum: `LITE | BALANCED | AGGRESSIVE | CUSTOM`):

- **LITE** (FREE-friendly): `audit → classifier → score → embed_profile → intelligence_brief`. Apify yok, mockup yok, dossier yok.
- **BALANCED** (yeni workspace default): `audit → social → apify_gmaps → review_refresh → apify_webcrawl → classifier → deep_score → embed_profile → dossier → intelligence_brief`. Plan tarafından plan-gated; FREE'de Apify step'leri otomatik filtrelenir (`filterByPlan`).
- **AGGRESSIVE** (PRO+): BALANCED + `apify_serp` + on-create `opener`. Gemini ve Apify bütçesini hızlı yakar.
- **CUSTOM**: workspace owner `WorkspaceLeadPipeline.steps` JSON'unu hand-edit etmiştir; `validateLeadPipelineChain` ile kontrol edilir (no duplicate stepIds, no unknown deps, no cycles, sadece `LEAD_PIPELINE_ALLOWED_WORKERS` setine üye worker'lar).

**Statik chains**:

- `inbox_reply_received` — `attribute → write_outcome` (sentinel `__WRITE_OPENER_OUTCOME__`)
- `user_one_click_pitch` — `mockup → opener` (+ optional `video_script`)
- `user_deep_research` — paralel `apify_gmaps`, `apify_webcrawl`, `apify_instagram`, `apify_facebook`, `apify_serp` → `apify_competitor_ads` → `review_refresh` → `score_refresh` → `embed_profile` (sentinel)
- `user_receptionist_with_kb` — `apify_webcrawl → ai_receptionist`
- `lead_reviews_updated` — `review_refresh → score_refresh → embed_profile → dossier_refresh`

### 7.3 Sentinels

`SENTINEL_STEPS`:
- `__EMBED_LEAD_PROFILE__` — score sonrası lead profile vector'ünü `LEAD_PROFILE` memory'sine upsert eder
- `__WRITE_OPENER_OUTCOME__` — inbox reply sonrası `OPENER_SUCCESS` veya `OPENER_FAILURE` yazar

Sentinel'ler tam worker olarak sarmaya değmeyen küçük SQL-step'lerdir; orchestrator inline handle eder.

### 7.4 Worker yürütme akışı

1. API handler `AgentRun` satırını `PENDING` ile yaratır + `addAgentRunJob({ type, runId })` ile BullMQ'ya verir
2. `agent-run-worker.ts` (queue: `agent-runs`) job'ı alır
3. Job tipine göre dispatch eder:
   - `agent_run` → `executeAgentRun(runId)`
   - `orchestrator_advance` → `advance(sessionId)` (DAG bir adım ilerletir)
   - `embed` → `embedMemoryRow(memoryId)` (re-embed tek satır)
4. `executeAgentRun`: registry'den worker resolve eder, ctx'i hidrate eder (`lead`, `workspace`, `memory[]`), worker'ın `run()` veya `start()` callback'ini çağırır
5. Worker `AgentWorkerOutput`: `{ output, artifactUrl?, costTokens?, costUsdCents? }` döner
6. Executor `AgentRun.outputJson`'a yazar, `memoryWrites(output, ctx)` çıktısını `memory.ts` üzerinden upsert + embed eder
7. Async-apify worker'lar için: `start(ctx)` Apify actor'ünü webhook ile başlatır → `/api/webhooks/apify` çağrılır → `finalize(ctx, payload)` ile run tamamlanır

### 7.5 Idempotency

`AgentRun.idempotencyKey` = `hash(workspaceId, workerKind, leadId, inputs)`. Concurrent enqueue'lar partial unique index'te collide eder ve mevcut row'u re-use eder. BullMQ job id'si de bundan türetilir.

### 7.6 `AgentRunStatus` enum

`PENDING | RUNNING | SUCCEEDED | SUCCEEDED_NO_MEMORY | FAILED | CANCELLED`. `SUCCEEDED_NO_MEMORY`: worker'ın primary artifact'i başarılı oldu ama post-run memory write veya pre-fetch'te EmbeddingError oldu. Row mantıken başarılı, downstream chain'ler ilerleyebilir, ama UI "AI memory degraded" badge'i gösterir, backfill embed job'u gerekir.

### 7.7 Stuck-job recovery

`POST /api/agent-runs/cleanup-stale` — grace window'dan eski `RUNNING` row'ları FAILED'a çevirir. Cron'la production'da çalışır. Quota helper stale `PENDING/RUNNING` row'ları zaten ignore eder, böylece crash bir worker workspace quota'sını sessizce drain edemez.

---

## 8. Semantic Memory (pgvector)

### 8.1 Şema

`SemanticMemory` tablosu pgvector(768) embedding'i ile her bilgi parçasını saklar. Gemini `gemini-embedding-001` ile embed edilir (`outputDimensionality=768`, `EMBEDDING_DIM = 768` — daha önce kullanılan `text-embedding-004` Google tarafından emekliye ayrıldı, 404 NOT_FOUND dönüyordu). HNSW index `embedding vector_cosine_ops` üzerine raw SQL migration ile kurulu.

### 8.2 `MemoryKind` enum

**Native (kendi worker'larımız)**:
- `LEAD_PROFILE` — lead'in özet profil vector'u
- `REVIEW_CHUNK` — yorum corpus chunk'ları
- `VOICE_NOTE` — saha sesli notlarının transcript'i
- `OPENER_SUCCESS` — cevap alan opener
- `OPENER_FAILURE` — bounce/opt-out olan opener (öğrenme döngüsü)
- `MOCKUP_SECTION` — kullanılan mockup bölümü
- `WORKSPACE_OFFER` — workspace'in offer/pricing bağlamı
- `WORKSPACE_PERSONA` — workspace'in target persona profili
- `PROSPECT_KB_CHUNK` — prospect'in kendi site içeriğinden RAG chunk (receptionist için)
- `COPILOT_TURN` — copilot konuşma turu

**Apify-sourced**:
- `SOCIAL_POST` — Instagram/Facebook/TikTok post'u
- `SERP_SNAPSHOT` — Google SERP snapshot
- `COMPETITOR_AD` — Facebook Ad Library reklamı
- `HIRING_SIGNAL` — LinkedIn hiring sinyali
- `REDDIT_MENTION` — Reddit mention

### 8.3 Niche scope (asimetrik dual-write)

`SemanticMemory.nicheScope` — child slug (`fnb-bar-club`), parent slug (`fnb`), veya null (niche-agnostic).

**Pozitif sinyaller** (`OPENER_SUCCESS`, `MOCKUP_SECTION`, `LEAD_PROFILE`) çocuk + parent slug'a **dual-write** edilir — yeni bir alt-niş'te bile parent'tan few-shot fuel toplanır.

**Negatif sinyaller** (`OPENER_FAILURE`) yalnızca **child-only** yazılır — bir bar-club failure'i cafe-bakery retrieval'ını zehirlemez.

Composite unique key: `(workspaceId, refType, refId, nicheScope)`.

### 8.4 Yetkili erişim

**Yalnızca `src/lib/ai-core/memory.ts` üzerinden read/write.** Direkt `prisma.semanticMemory.*` çağrısı yasak. Cross-workspace retrieval inşa gereği imkansız. `MemoryHit.similarity` null geldiğinde (recency-based pre-fetch) sort/threshold yapılmaz.

---

## 9. Discovery (Lead Bulma)

`POST /api/discovery` — `Workspace.country` ile scoped Google Places Text Search çalıştırır. Hibrit niche packlerde **fan-out**: parent seçilince her child'ın `searchQueries[0]`'ı paralel çağrılır; `placeId` ile dedupe edilir.

`/api/places/autocomplete` ve `/api/places/details` ile lokasyon picker'ı UI tarafında verified `place_id` + viewport rectangle kullanır.

Worker: `discovery-worker.ts` (queue: `discovery jobs`).

Sonuç: yeni `Lead` satırları + her biri için `emit("lead_created")` (BALANCED preset varsayılan, plan'a göre filtrelenmiş chain başlatılır).

---

## 10. Niche Packs

`src/lib/niches/index.ts` — `NichePack[]` tanımı. Her pack:

- `slug` (URL-safe, route'larda kullanılır), opsiyonel `parentSlug`
- `label`, `tagline`
- `searchQueries[]` — Google Places query'leri (multi-word ifadeler `"food truck"` gibi double quote'la sarılı)
- `discoveryPlaceTypes[]` — `includedType` filter
- `pitchAngle`
- `highValueSignals[]` — bu vertical için en güçlü cold-email kancası olan audit sinyalleri
- `commonBookingProviders[]`
- `mockupTemplateId`
- `featuredProductModules[]` (hibrit child packlerde)

İki şekil: **Flat** (`phone-repair`, `hvac`, `dental`, ...) ve **Hybrid** (parent `fnb` + children `fnb-fine-dining`, `fnb-bar-club`, `fnb-coffee-shop`, `fnb-ghost-kitchen`, `fnb-food-truck`, `fnb-hotel-fnb`, ...). Workspace owner `targetSubNiches[]` ile hangi child'ları pitch'lediğini daraltır.

---

## 11. Site Audit (`WebsiteAudit`)

`WEBSITE_AUDITOR` worker Playwright ile siteyi tarar; `WebsiteAudit` satırına yazar:

- **Erişilebilirlik**: `reachable`, `crawlAttemptedAt`, `crawlError` (`TIMEOUT | DNS_ERROR | BOT_BLOCKED_4XX | PLAYWRIGHT_CRASH`), `httpStatus`
- **Performans**: `loadTimeMs`
- **Güvenlik**: `https`
- **Mobile**: `mobileFriendlyGuess`
- **İçerik**: `title`, `metaDescription`, `h1`, `navItems[]`, `ctaLinks[]`
- **İletişim & dönüşüm**: `hasContactForm`, `hasWhatsappLink`, `hasBookingSystem`, `bookingProvider` (Calendly, Cal.com, OpenTable, Resy, ...), `hasEcommerce`, `servicesDetected[]`, `contactEmails[]`, `contactEmailsVerified[]`
- **Sosyal**: `socialProfiles` (`{ instagram, facebook, linkedin, tiktok, youtube, twitter, whatsapp }`)
- **SEO**: `brokenLinksCount`, `structuredDataPresent`, `rawFeaturesJson`

Audit step'i chain'lerde `optional` — transient crawl fail (timeout, 403, robots block) downstream worker'ları starve etmez. Classifier, scorer, dossier null sinyali tolere eder.

---

## 12. Sales Opportunity Scoring (`SalesOpportunity`)

Her lead için `SalesOpportunity` satırı:

- `opportunityScore` (0–100)
- `reasonCodes[]` (kategorize edilmiş gerekçeler)
- `whyGoodTarget` (free-text)
- `likelyPainPoints[]`
- `bestSalesAngle` (ana satış açısı, opener ve dossier'da kullanılır)
- `suggestedOffer` (`STARTER | GROWTH | SALES`)
- `personalizedFirstMessage`
- `expectedPriceBand`
- `recommendedPackageId` (workspace'in `ServicePackage` ID'si — free-text, FK değil — silinen/yeniden adlandırılan paket tombstone bırakır)
- `recommendedPackageReason`
- `status` (`OutreachStatus`: `NEW | CONTACTED | INTERESTED | MEETING | WON | LOST`)

---

## 13. Service Packages (Workspace'in kendi paketleri)

`ServicePackage` tablosu workspace'in sattığı paket katmanlarını tutar. Onboarding'de seed edilir, **Settings → Packages**'tan editlenir:

- `name`, `priceLabel`, `features[]` (string array, UI'da checklist), `isPopular`, `sortOrder`
- `(workspaceId, name)` unique

Workspace en az bir `ServicePackage` row'u eklemeden `lead_created` chain'i `SCORER`'a giremez — `pipelineStatus = BLOCKED_NEEDS_PACKAGES` ile leadler park edilir, UI "process pending leads" CTA'sı gösterir; ilk paket eklenince `POST /api/leads/process-pending` ile blok çözülür.

---

## 14. Lead Pipeline (Onboarding chain'i editor)

`WorkspaceLeadPipeline` workspace başına bir satır:

- `preset`: `LITE | BALANCED | AGGRESSIVE | CUSTOM`
- `steps`: `Json` (`ChainStep[]`)
- `enabled`: bool

UI: **Settings → Lead Pipeline**.

- Preset seçilince `getDefaultChain(preset, plan)` ile auto-regenerate edilir — plan upgrade'i yeni worker'ları otomatik açar
- CUSTOM mode hand-edited steps'i olduğu gibi kullanır; `validateLeadPipelineChain` cycle/duplicate/unknown-dep/disallowed-worker kontrolü yapar
- Dry-run: `POST /api/workspaces/[id]/lead-pipeline/dry-run` — chain'i çalıştırmadan plan-filter sonrası DAG'ı önizler

`LEAD_PIPELINE_ALLOWED_WORKERS`: `WEBSITE_AUDITOR`, `SUBVERTICAL_CLASSIFIER`, `REVIEW_ANALYST`, `SOCIAL_SCRAPER`, `EMAIL_VERIFIER`, `SALES_OPPORTUNITY_SCORER`, `LEAD_DOSSIER_GENERATOR`, `OPENER_WRITER`, `APIFY_GMAPS_DEEP`, `APIFY_SERP_RANK`, `APIFY_WEB_CRAWL_DEEP`, `APIFY_INSTAGRAM_DEEP`, `APIFY_FACEBOOK_DEEP`, `APIFY_REDDIT_MENTIONS`. `INBOX_REPLY_ATTRIBUTOR` (lead context'i yok), `MOCKUP_GENERATOR` (on-demand only), `GOOGLE_PLACES_REVIEWS` (5-yorum bias) explicitly hariç.

---

## 15. Outreach (Cold Email Send)

### 15.1 Email Account (OAuth Gmail/Outlook)

`EmailAccount` satırı — provider (`GMAIL | OUTLOOK`), email, `accessToken`, `refreshToken`, `expiresAt`, `dailyLimit` (default 500), `sentToday`, `resetAt`, `replyAttributionEnabled`, `lastInboxSyncAt`. `(workspaceId, email)` unique.

UI: **Settings → Email Accounts**.

OAuth flow: `/api/oauth/start/[provider]` → kullanıcı consent → `/api/oauth/callback` → token'lar `EmailAccount` row'una yazılır.

### 15.2 Send

`POST /api/leads/[id]/send-email` — `OUTREACH_SENDER` worker'ı tetikler, OAuth Gmail/Outlook üzerinden gönderir. `LeadActivity(kind: EMAIL_SENT, payload: { subject, bodyPreview, threadId, accountId })` yazılır.

DNC veya `optedOutAt` set lead'lere send refused.

### 15.3 Reply Attribution

`POST /api/email-accounts/[id]/sync` veya cron job — Gmail/Outlook inbox'unu polluyor, `INBOX_REPLY_ATTRIBUTOR` ile gelen cevapları sent opener'larla `threadId` üzerinden eşleştiriyor:

- `LeadActivity(kind: EMAIL_REPLIED, payload: { sentiment, classification, threadId })`
- `WatchlistItem.pipelineStage` ilerletilir
- `inbox_reply_received` event'i emit edilir (`OPENER_SUCCESS` / `OPENER_FAILURE` SemanticMemory yazımı için)

### 15.4 Smartlead/Instantly CSV Export

`POST /api/leads/export` — workspace'in lead'lerini CSV'ye dump eder, audit sinyallerini custom variable column'lara yayar. Smartlead/Instantly format'ı destekli. Default `verified=true` filtreli, `?raw=1` ile bypass.

---

## 16. Sequences (Multi-Touch Cadence Engine)

`Sequence` workspace-level cadence template (örn. "Restaurant 5-touch"). `SequenceStep` ordered: `position`, `channel` (`EMAIL | WHATSAPP | MANUAL_CALL | WAIT`), `delayHours`, channel-specific `payload`.

`LeadSequenceState` lead'in cadence durumu: `currentStepId`, `state` (`ACTIVE | PAUSED | COMPLETED | EXITED`), `nextStepAt`, `pausedAt`, `pausedReason` (`REPLY_RECEIVED | DNC | MANAGER_PAUSE`), `enrolledAt`, `enrolledByUserId`, `completedAt`, `stepsFired`.

Tick worker: `LeadSequenceState`'leri `state=ACTIVE AND nextStepAt <= now() AND pausedAt IS NULL` ile tarar; `agent-runs` queue'una `type="sequence_step"` job atar (kendi queue'su yok). Step çalışınca `LeadActivity(kind: SEQUENCE_STEP_FIRED)` yazılır.

Pozitif reply (`INBOX_REPLY_ATTRIBUTOR` sentiment classification ile) → state otomatik `PAUSED` (`pausedReason: "REPLY_RECEIVED"`).

API: `GET/POST /api/sequences`, `POST /api/sequences/inbox-sync`, `POST /api/leads/[id]/sequence`.

---

## 17. Lead Activity Timeline

`LeadActivity` her outbound veya status-change touch için bir satır. `LeadActivityKind`:

- `CALL_LOGGED` (payload: `{ disposition, durationSec?, notes?, externalCallId? }`)
- `EMAIL_SENT`, `EMAIL_REPLIED`
- `WHATSAPP_SENT`
- `NOTE`
- `STATUS_CHANGED` (`{ from, to }`)
- `MEETING_BOOKED` (`{ startsAt, provider, eventId }`)
- `DISPOSITION_LOGGED`
- `SEQUENCE_STEP_FIRED` (`{ sequenceId, step, channel }`)
- `SNOOZED` (`{ until }`)
- `ASSIGNED` (`{ from, to }`)
- `CONSENT_RECORDED` (`{ source }`)

Telefoni webhook idempotency: `(workspaceId, leadId, kind, externalCallId)` partial unique constraint — aynı external call id ile iki terminal `CALL_LOGGED` insert imkansız.

UI: lead detail page chronological feed olarak render eder; dashboard kind+day aggregation ile SDR throughput metrikleri çıkarır.

`CallDisposition` enum: `ANSWERED_INTERESTED | ANSWERED_NOT_INTERESTED | VOICEMAIL | NO_ANSWER | WRONG_NUMBER | BOOKED_MEETING | OPTED_OUT`. `ANSWERED_NOT_INTERESTED` ve `OPTED_OUT` lead'i Today's Queue'dan çıkarır; `VOICEMAIL/NO_ANSWER` re-attempt zamanlar.

---

## 18. Telefoni Entegrasyonu (M12/M13)

`POST /api/webhooks/telephony/[provider]` — provider başına webhook endpoint. Workspace başına HMAC secret (`Workspace.telephonyWebhookSecret`, unique) ile imza doğrulama; tek paylaşılan token yerine workspace başına token (sızıntı bir tenant'la sınırlı kalır).

Webhook → `LeadActivity(kind: CALL_LOGGED, payload: { disposition, durationSec, externalCallId })` insert. Idempotency `externalCallId` üzerinden DB layer'ında.

---

## 19. Voice Notes

Saha satışçısı için 30-saniyelik voice memo. UI lead detail'den kaydeder; `VOICE_NOTE_TRANSCRIBER` worker'ı transcribe eder (Whisper / Gemini), `VoiceNote` satırına yazar (`audioUrl`, `durationSec`, `transcript`, `language`, `source` default `"web"`, `createdBy`). Optional olarak `WatchlistItem.pipelineNotes`'a append edilir.

`SemanticMemory(kind: VOICE_NOTE)` yazılır — copilot voice note'lardan retrieve edebilir.

API: `POST /api/leads/[id]/voice-notes`, `DELETE /api/voice-notes/[id]`.

---

## 20. Mockup Engine (`/m/[slug]` public viewer)

İki tablo:

- `Mockup` (legacy) — markdown WEBSITE PLAN'leri (`htmlContent`, `templateId`)
- `WebsiteMockup` (current) — gerçek render edilebilir landing page artifact'i: `sectionsJson` (hero/services/testimonial/cta/about), `themeJson`, `htmlCache`, `templateId` (`leadac-hero-v1` vb.), `slug` unique, `isPublic`, `expiresAt`, `viewCount`

`/m/[slug]` route ikisinden de render eder; `WebsiteMockup` öncelikli. `htmlCache` null ise route render edip cache'e yazar — cold-email click'inde instant load. View counter increment edilir.

Mockup üretimi: `WEBSITE_MOCKUP_GENERATOR` worker'ı. Niche pack'in `mockupTemplateId`'si ile branş-spesifik template kullanılır. Workspace branding (Agency+ tier) `WebsiteMockup.themeJson`'a inject edilir — white-label.

`SemanticMemory(kind: MOCKUP_SECTION)` opener writer'a few-shot fuel verir.

Auto chains'te artık YOK (Gemini-token israfı azaltıldı). On-demand: lead detail'de **Generate Mockup** butonu → `user_one_click_pitch` chain'i (mockup → opener) tetikler.

---

## 21. Copilot (Workspace AI Chat)

`COPILOT_CHAT` worker — Gemini function-calling router (`src/lib/ai-core/router.ts`). Sabit tool seti:

- **`search_leads`** — filtreli lead arama
- **`semantic_search_leads`** — pgvector ile semantic search
- **`start_pitch_pack`** — `user_one_click_pitch` chain'ini tetikler
- **`start_deep_research`** — `user_deep_research` chain'ini tetikler
- **`find_lookalikes`** — bir lead'e benzer leadleri vector similarity ile bulur

Yeni tool eklenmesi test gerektirir. Destructive tool (kullanıcı onayı olmadan write yapan) plan doc olmadan eklenmez.

`CopilotMessage` her mesaj için: `workspaceId`, `userId`, `role` (`USER | ASSISTANT`), `content`, `leadIds[]` (kontekst kullanılan), `tokensIn`, `tokensOut`. UI "where did this recommendation come from" denetimini bu sayede yapabilir.

`SemanticMemory(kind: COPILOT_TURN)` her tur arşivlenir.

---

## 22. Deals (Kanban Pipeline)

`WatchlistItem` satırı her shortlist'lenmiş lead için. `pipelineStage` enum: `NEW | REACHED_OUT | IN_TALKS | WON | LOST`. `stageOrder` kolon-içi sıralama.

Ek alanlar:
- `siteUrl`, `notes`, `websitePlan` (Markdown), `pipelineNotes`
- `selectedOffer` (SuggestedOffer)
- `meetingResult` (legacy) — `pipelineStage` öncesi sales-stage sinyali; backward compat için tutuluyor
- `nextMeetingAt`, `meetingProvider` (Google Cal / Outlook), `meetingEventId` — `POST /api/leads/[id]/schedule-meeting` ile takvim entegrasyonu

UI: `/app/deals` — dnd-kit drag-and-drop kanban. Phone'da segmented control + ActionSheet ile "Move to stage" (drag-drop yerine). Side panel lead detayını gösterir.

API: `GET/POST /api/watchlist`, `PATCH /api/watchlist/[id]`, `POST /api/watchlist/reorder`.

---

## 23. Lead Segmentasyon

`LeadSegment` — kullanıcı saved smart-segment'ı:

- `name`
- `queryJson` (serialized `LeadsFilters` — bkz `src/components/app/leads/useLeadsQuery.ts`)
- `isShared` (workspace'in tüm üyeleri görür)
- `createdByUserId`

UI: leads listesinde "Save segment" butonu; saved segment'ler favori filter preset gibi davranır. Solo workspace'lerde de fayda sağlar.

---

## 24. Stripe Billing

### 24.1 Init

`src/lib/stripe.ts` — lazy singleton. **`apiVersion` PIN'lenmez** — v22 type'larını kırıyor. `isBillingEnabled()` `Boolean(STRIPE_SECRET_KEY)`.

### 24.2 Checkout

`POST /api/billing/checkout` — body: `{ plan, currency, cycle }`. `getPriceId(plan, currency, cycle)` ile Stripe Price ID resolve edilir (annual yoksa monthly fallback, GBP yoksa USD fallback). `Workspace.stripeCustomerId` upsert. Checkout session yaratılır, `url` döner.

### 24.3 Portal

`POST /api/billing/portal` — Stripe billing portal session. Kullanıcı `cancel`/`update payment method`/`switch plan`'i Stripe UI'ından yapar. Workspace başına tek `stripeCustomerId` — birden fazla customer yaratılmaz.

### 24.4 Webhook

`POST /api/billing/webhook` — `runtime = "nodejs"` (raw body + Prisma için zorunlu).

1. `STRIPE_WEBHOOK_SECRET` yoksa 503; `stripe-signature` yoksa 400; `constructEvent` throw → 400
2. `prisma.stripeEventLog.create({ data: { id: eventId, type } })` — `P2002` (duplicate) → 200 erken dönüş
3. `request.text()` (raw body) — `request.json()` kullanılmaz
4. `detectPlanFromPriceId(priceId)` — `PLANS[*].priceIds.{USD,GBP}` ve `annualPriceIds`'e karşı match
5. `customer.subscription.updated`, `invoice.payment_succeeded` → `Workspace.plan`, `currentPeriodEnd`, `cycleResetAt` update; `leadsCreatedThisCycle` ve `aiCreditsUsedThisCycle` 0'lanır
6. `subscription` `unpaid`/`canceled` → plan FREE'ye düşer; `notifyBillingEvent` ile owner'a mail
7. `charge.refunded`, `charge.dispute.created` → log + ops notification (manuel karar)

### 24.5 Cycle reset

`Workspace.cycleResetAt` UI meter'larında "resets on X" copy'sini besler. Başka yerde recompute edilmez.

### 24.6 Quota gating

İki katman:
- API route: `assertWorkerQuota({ workspaceId, kind })` — exceed → 402 + upsell payload
- Worker process: `executeAgentRun` job start'ında re-assert (defense in depth — direkt queue enqueue bypass etmesin)

---

## 25. Public Surfaces (SEO + Marketing)

### 25.1 Marketing route group `(marketing)/`

- `/` — homepage (hero, pain, features, scroll-tour, why, process, case study, logo wall, stats, pricing, lead-intelligence, integrations orbit, FAQ, CTA)
- `/pricing`
- `/demo` — 15-minute walkthrough request form (`POST /api/demo/request` → founder'a mail + Resend ack)
- `/login`, `/signup`
- `/for/agencies`, `/for/smma`, `/for/specialists`, `/for/walk-in-web-agencies` (mockup pillar burada), planlanmış: `/for/fnb-tech`, `/for/local-seo`
- `/partners`
- `/legal/terms`, `/legal/privacy`

### 25.2 Public route group `(public)/`

Programmatic SEO sayfaları — search-intent capture:

- `/niches` — tüm niche'ler
- `/niches/[verticalSlug]` — vertical landing
- `/niches/[verticalSlug]/[citySlug]` — vertical × şehir cross-product
- `/cities`, `/cities/[citySlug]` — şehir landing
- `/alternatives`, `/alternatives/[slug]` — alternatif sayfaları (`apollo-alternative`, `clay-alternative`, ...)
- `/vs/[slug]` — head-to-head feature matrix
- `/compare` — multi-tool comparison
- `/glossary`, `/glossary/[term]` — outbound terim sözlüğü
- `/blog`, `/blog/[slug]` — yazı içerik (Markdown sources)
- `/about`, `/about/[authorSlug]` — yazar sayfaları
- `/tools` — free tools landing
- `/tools/icp-match-scorer` — interactive ICP fit scorer (lead capture)
- `/tools/cold-email-reply-rate-calculator` — interactive calculator
- `/b/[citySlug]/[businessSlug]` — public lead profile (`Workspace.publicProfilesEnabled` açıkken)

Programmatic SEO sayfaları homepage'in pozisyonlama kuralları DIŞINDA — "Apollo alternative" framing'i SERP intercept için izinli, ama verdict pozisyonla hizalanır.

### 25.3 Mockup viewer

- `/m/[slug]` — public mockup; `viewCount` increment, `expiresAt` kontrol

### 25.4 SEO/AEO altyapısı

- `generateMetadata` her route'ta (`buildMetadata` helper)
- OpenGraph + Twitter cards
- JSON-LD: `LocalBusiness`, `Organization`, `Article`, `BreadcrumbList`, `FAQPage`
- Canonical URLs
- `robots.txt`, `sitemap.ts`
- IndexNow: `/[indexnowKey]` proof file route + `seo-ops-worker` ile auto-ping
- Web Vitals beacon: `POST /api/web-vitals` (anonymous)
- Google Search Console (GSC) entegrasyonu: queries/pages/daily cache Redis'te

---

## 26. App (Authed Product) — Sayfa Yapısı

### 26.1 `(app)/app/`

- **`/app/dashboard`** — KPI kartları (Total Leads, Have Website, Avg Score, This Week), borough distribution chart, outreach/crawl/analyze status charts, **SDR throughput** (calls today, emails today, meetings booked 30d, replies 7d, today queue size, average confidence, activitiesByKind 7d), next action recommendation
- **`/app/discovery`** — postcode + niche pack selector. `LocationPicker` autocomplete (verified place_id + viewport). Niche dropdown parent/leaf/child packs'i tek listede. Hibrit parent seçilince fan-out search. `LiveProcessingStrip` aktif `lead_created` chain'lerinin progress'ini real-time gösterir.
- **`/app/leads`** — leads listesi. Tabs: Table / Cards / Map (Leaflet, lazy-load) / Kanban (dnd-kit, lazy-load). `LeadFiltersBar` (filtre + search), `LeadActionBar` (bulk action: assign, snooze, archive, discard, mark DNC, send, enroll sequence), `MobileLeadList` (mobile UX). `LeadSegment` save/load.
- **`/app/leads/[id]`** — lead detail. Üst banner: business name, address, phone, hours, local time badge, dnc badge, salesConfidence chip, intelligence brief preview. Tabs: Overview, Audit, Reviews, Sales Brief, Activity, Voice Notes, Sequence, Mockup. Side actions: Generate Mockup, Run Deep Research, Pitch Pack, Send Email, Log Call, Schedule Meeting, Add Note, Snooze, Assign, Archive, Discard, Mark DNC, Find Lookalikes. AgentRun history per worker kind.
- **`/app/deals`** — kanban board (NEW/REACHED_OUT/IN_TALKS/WON/LOST). DealSidePanel.
- **`/app/campaigns`** — service packages, sequences listing, campaign analytics
- **`/app/todos`** — `TeamTodo` kanban (column-based, sortOrder)
- **`/app/seo`** — GSC queries/pages/daily, broken links scan, web vitals (LCP/CLS/INP/FCP/TTFB), IndexNow status
- **`/app/onboarding`** — wizard: workspace name, country, niche selection, target sub-niches, Service Packages seed, Pipeline preset, Email Account connect (opt). `Workspace.onboardingCompletedAt` set olunca dashboard'a redirect.
- **`/app/more`** — mobile drawer: secondary nav (settings, copilot, todos, seo)
- **Settings** (`/app/settings/`):
  - `/account` — kullanıcı profili, email
  - `/workspace` — workspace name, slug, country, niche, target sub-niches, language, tone, length
  - `/billing` — plan, current period, change plan, customer portal link, usage meters
  - `/team` — invite member, role yönetimi (`POST /api/team/invite`, `DELETE /api/team/[id]`)
  - `/packages` — `ServicePackage` CRUD, sortable
  - `/offer` — workspace `offerName`, `valueProposition`, `socialProof`, `offerHook`, `objective`, `senderName`, `conversionLink`
  - `/branding` — logo, colors (Agency+ white-label)
  - `/lead-pipeline` — preset selector, custom DAG editor, dry-run preview
  - `/email-accounts` — Gmail/Outlook OAuth connect, daily limit, reply attribution toggle, inbox sync trigger

### 26.2 Auth

`/auth/*` — Supabase auth pages (sign in, sign up, reset, callback).

### 26.3 Admin

- `POST /api/admin/pipeline/cancel-all` — workspace'in stuck planner session'larını cancel
- `POST /api/admin/pipeline/cancel-all-global` — tüm workspace'lerde global cancel (ops emergency)

---

## 27. API Yüzeyi (Full Liste)

Hepsi `requireUser()` kapısından geçer (webhook'lar hariç, onlar imza doğrular).

**Workspace**:
- `GET /api/workspace`, `GET /api/workspaces`, `POST /api/workspaces`, `GET/PATCH /api/workspaces/[id]`, `POST /api/workspaces/switch`
- `PATCH /api/workspace/country`, `GET/PUT /api/workspace/offer`
- `GET/POST /api/workspace/packages`, `GET/PATCH/DELETE /api/workspace/packages/[id]`
- `GET/PUT /api/workspaces/[id]/lead-pipeline`, `POST /api/workspaces/[id]/lead-pipeline/dry-run`

**Onboarding**:
- `POST /api/onboarding/complete`

**Team**:
- `POST /api/team/invite`, `PATCH/DELETE /api/team/[id]`

**Discovery & Places**:
- `POST /api/discovery`
- `GET /api/places/autocomplete`, `GET /api/places/details`
- `GET /api/website-search`, `POST /api/website-check`

**Leads**:
- `GET /api/leads`, `POST /api/leads/tool-capture`, `POST /api/leads/export`, `POST /api/leads/bulk-action`, `GET /api/leads/processing-status`, `POST /api/leads/process-pending`, `GET /api/leads/sub-niches`
- `GET/PATCH/DELETE /api/leads/[id]`
- `PATCH /api/leads/[id]/status`, `POST /api/leads/[id]/dnc`, `PATCH /api/leads/[id]/sub-niche`, `POST /api/leads/[id]/account`
- `POST /api/leads/[id]/log-call`, `POST /api/leads/[id]/mark-outcome`, `POST /api/leads/[id]/schedule-meeting`
- `POST /api/leads/[id]/send-email`, `POST /api/leads/[id]/sequence`
- `POST /api/leads/[id]/pipeline-rerun`, `POST /api/leads/[id]/workers`, `POST /api/leads/[id]/workers/[kind]`
- `GET /api/leads/[id]/explain`, `GET /api/leads/[id]/dossier-sources`, `GET /api/leads/[id]/intelligence-brief`, `GET /api/leads/[id]/lookalikes`
- `POST /api/leads/[id]/deep-research-session`
- `POST /api/leads/[id]/voice-notes`, `DELETE /api/voice-notes/[id]`
- `POST /api/leads/[id]/video-script`

**Reviews**:
- `GET /api/reviews/[leadId]`, `POST /api/reviews/[leadId]/analyze`

**Crawl/Analyze (legacy forwards)**:
- `POST /api/crawl`, `POST /api/analyze` — `emit("lead_created")`'a forward eder

**Watchlist (deals)**:
- `GET/POST /api/watchlist`, `PATCH/DELETE /api/watchlist/[id]`, `POST /api/watchlist/reorder`

**Sequences**:
- `GET/POST /api/sequences`, `POST /api/sequences/inbox-sync`

**Accounts (multi-location)**:
- `GET/POST /api/accounts`

**Campaigns**:
- `GET/POST /api/campaigns`

**Todos**:
- `GET/POST /api/todos`, `PATCH/DELETE /api/todos/[id]`

**Email Accounts**:
- `GET/POST /api/email-accounts`, `DELETE /api/email-accounts/[id]`, `POST /api/email-accounts/[id]/sync`
- `GET /api/oauth/start/[provider]`, `GET /api/oauth/callback`

**Agent Runs**:
- `GET /api/agent-runs/[id]`, `GET /api/agent-runs/[id]/export`
- `POST /api/agent-runs/cleanup-stale`, `POST /api/agent-runs/recover-stuck-sessions`

**Planner**:
- `POST /api/planner/start`, `POST /api/planner/bulk`, `GET /api/planner/[id]`

**Copilot**:
- `POST /api/copilot`

**Stats**:
- `GET /api/stats`

**Website Plan**:
- `GET /api/website-plan/[leadId]`

**Billing**:
- `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /api/billing/webhook`

**Webhooks (signature-verified)**:
- `POST /api/webhooks/apify` — Apify run callback
- `POST /api/webhooks/telephony/[provider]` — telefoni cevap

**Demo**:
- `POST /api/demo/request`

**SEO/Health**:
- `GET /api/health` — auth gerektirmez
- `POST /api/web-vitals` — anonymous beacon
- `GET /[indexnowKey]` — IndexNow proof file

---

## 28. Worker Süreçleri (`npm run workers`)

`src/workers/index.ts` supervisor 7 worker süreci başlatır:

| Worker | Queue | İş |
|---|---|---|
| `discovery-worker.ts` | `discovery jobs` | Google Places lead bulma + dedupe + `emit("lead_created")` |
| `crawl-worker.ts` | `crawl` | (legacy, sunset window'da disabled — `WEBSITE_AUDITOR` race ediyordu) |
| `analyze-worker.ts` | `analyze` | (legacy, disabled — `SALES_OPPORTUNITY_SCORER` race ediyordu) |
| `review-analysis-worker.ts` | `review-analysis` | Review corpus → pain/strength phrases (eski path; AI Core `REVIEW_ANALYST`'e migrate ediliyor) |
| `email-verification-worker.ts` | `email-verification` | ZeroBounce SMTP / catch-all verification |
| **`agent-run-worker.ts`** | **`agent-runs`** | **Tüm AI Core kuyruğu**. Discriminated union job: `agent_run`, `orchestrator_advance`, `embed`. |
| `seo-ops-worker.ts` | `seo-ops` | Sitemap ping, IndexNow submit |

**Gemini key rotation**: `src/lib/gemini-keys.ts` — multiple API key rotation. Tüm key'ler 429 cooldown'daysa worker idle bekler. Boot banner Redis URL + Database URL + Gemini key sayısını yazar.

`process.env.IS_WORKER = "1"` Prisma pool sizing helper'ı için — worker context'inde concurrency'ye göre pool downsize edilir.

---

## 29. Compliance, Privacy, GDPR/KVKK

- **Consent**: lead başına `consentSource` (`PUBLIC_LISTING` — public dizinler için; `MANUAL_OPT_IN` — explicit opt-in; `REFERRED` — warm intro). `consentRecordedAt` yasal zaman damgası.
- **DNC**: `Lead.dnc = true` send-email ve send-whatsapp API'leri reddeder; UI kırmızı badge gösterir; sequence state otomatik PAUSED (`pausedReason: "DNC"`).
- **Opt-out**: unsubscribe / "stop calling me" reply landing → `optedOutAt` set + `LeadActivity(kind: CONSENT_RECORDED, payload: { source })` kaydı.
- **Data isolation**: workspace başına Prisma scope; SemanticMemory facade cross-workspace retrieval'ı inşa gereği imkansız.
- **No model training**: kullanıcı verisi LLM eğitimine kullanılmaz (Gemini API contract).
- **Local time awareness**: `Lead.timezone` (IANA) — yanlış saatte arama önlenir.

---

## 30. Marketing Bayrakları & i18n

- **`MARKETING_COMING_SOON`** flag (`src/lib/marketing-coming-soon.ts`) — true ise homepage CTA'sı "Launching soon", false ise "Audit your first 10 leads"; tüm hero / CTA / pricing band'ında karar buradan akar.
- **i18n state** (`src/lib/i18n/config.ts`): aktif `["en"]`. TR launch Phase I (web-presence overhaul plan). `/tr` route'ları onay alana kadar yayınlanmaz.
- **Cinematic palette** (`src/components/marketing/cine/*`): homepage için ayrı tema; `--cine-ink`, `--cine-cream`, `--cine-ochre`, `--cine-terra`, `--cine-indigo` token'ları.
- **Hero scroll-frames** (`public/frames/`): empty fallback gradient. Frame inject edilince `HERO_FRAME_COUNT` set edilir; ffmpeg ile fps=30 jpg üretilir.
- **Brand kit**: `public/leadac-brand-kit.pdf`, `public/brand-kit.html`, `public/logo.png`, `public/master.mp4`, `public/hero-loop.mp4`.

---

## 31. Tasarım Sistemi (Token'lar)

`src/app/globals.css` tek doğru kaynak. 4 ana knob ile tüm uygulama re-skin edilir:

```css
--leadac-h:   38;     /* hue */
--leadac-s:   78%;    /* saturation */
--leadac-ns:  7%;     /* neutral surface saturation */
--leadac-nts: 10%;    /* neutral text saturation */
```

Türetilenler: `--leadac-100..900` ramp, `--leadac-bg/surface/card/hover/border`, `--leadac-text-1/2/3`, `--leadac-muted`, `--leadac-success/warning/error/info`, `--leadac-glow-soft/medium/strong`.

Legacy iOS dark-mode token'ları (`--system-blue/green/orange/red/purple/teal/yellow`, `--label-primary/secondary/tertiary/quaternary`, `--shadow-sm/card/elevated/modal`, `--border-primary/light`, `--separator`) ana ramp'e map edilmiş.

`src/lib/colors.ts` — `LEADAC_HUE` ve `LEADAC_SATURATION` CSS knob'larıyla senkron tutulur.

**Hardcoded hex/rgb yasak** — her yerde `var(--leadac-*)`. Cinematic palette sadece marketing cine bölümünde.

---

## 32. Mobil & Erişilebilirlik

- iOS notch utilities: `.safe-pt`, `.safe-pb`, `.safe-pl`, `.safe-pr`, `.safe-mt`, `.safe-mb`
- Form input'ları 640px altında auto `font-size: 16px` (iOS auto-zoom block)
- Mobile lead list ve mobile deals view ayrı component'ler
- `prefers-reduced-motion` respect — non-decorative animation wrap'lı
- Glass utility'leri (`.glass`, `.glass-strong`) cross-browser `backdrop-filter` handle eder

---

## 33. Komutlar

```bash
npm run dev               # next dev --webpack
npm run workers           # tsx src/workers/index.ts (BullMQ supervisor)
npm run db:push           # prisma db push (dev — no migration history)
npm run db:generate       # prisma generate
npm run db:multitenant    # multi-tenant SQL migration
npm run db:ai-core        # pgvector extension + AI Core SQL migration
npm run test              # vitest run (unit)
npm run test:integration  # vitest with integration config
npm run lint              # eslint .
```

Migration script: `tsx prisma/migrations/apply.ts <file>.sql` — schema editleri sonrası pgvector / RLS gerektiren raw SQL bunun üzerinden uygulanır.

---

## 34. Ne LeadAC DEĞİL (negatif scope)

- **Apollo replacement değil** — Apollo enterprise B2B'yi sahiplenir; LeadAC lokal işletmeleri sahiplenir. Çoğu ajans LeadAC'i Apollo'nun **önünde** çalıştırır, yerine değil.
- **Smartlead / Instantly replacement değil** — onlar gönderici; LeadAC onlara yakıt verir.
- **CRM değil** — `WatchlistItem` minimal kanban'dır; HubSpot/Salesforce'la rekabet etmez.
- **AutoGPT / agent platform değil** — sabit, opinionated workflow'a sahip bir SaaS'tır; "build any agent" değil.
- **B2C için değil** — sadece B2B agency/operator ICP.
- **PLG/freemium toy değil** — FREE tier sunset edildi; 14-day trial + card on file modeli.
- **Enterprise SDR teams için değil** — 6-9 aylık satış döngüsü ekonomisi LeadAC pricing'iyle uyumsuz.
- **Yeni BullMQ queue eklenmez** — AI iş `agent-runs` discriminator'ı veya AI Core chains üzerinden.
- **Yeni Gemini-çağıran endpoint eklenmez** — her çağrı `src/lib/agent-workers/` altında bir worker.
- **`prisma.semanticMemory.*` direkt çağrılmaz** — yalnızca `src/lib/ai-core/memory.ts`.
- **`@prisma/client` import edilmez** — `@/generated/prisma/client`.

---

## 35. Mimarinin Pozisyonla Hizası

Mevcut şema, kod pozisyonlamayı yansıtır:

- **`Workspace` + `WorkspaceMember` + roles** — single-user oyuncak değil, 1–5 SDR'lı ajans operatörü için
- **`ServicePackage` + tier'lı paketler + recommendation logic** — bir araç tüketmek değil, **servis satmak** için
- **`SalesOpportunity` + opportunity score + recommended package + suggested offer** — kapatma motoru
- **`AgentRun` queue + quota enforcement** — high-throughput per-prospect istihbarat
- **Memory layer (`SemanticMemory`, opener success memory, asimetrik niche dual-write)** — playbook automation
- **Apify enrichment (deep review, sosyal, rakip reklam, LinkedIn hiring, Reddit)** — agency-grade research

Bu mimari free AI oyuncağı değil; outbound operations layer'ıdır.

---

Son güncelleme: 2026-05-07. Prisma şeması, AgentWorker registry, AI Core chains, pricing tablosu ve API yüzeyinden ekstre edildi.
