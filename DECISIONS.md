# Mapileads özellik entegrasyonu - karar noktaları

Plan §7'de açık kalan 4 karar noktası implementation sırasında bağlandı.
Kayıt altına alınması için bu dosya tutuluyor; her kararın nerede yansıdığı
kod referansıyla.

## 1. Email verification provider: ZeroBounce

**Karar:** ZeroBounce seçildi.

**Gerekçe:** Plan §7.1'de yazılı: $0.0008/email at scale, NeverBounce'tan 10x ucuz
volume büyüdükçe. Free tier 100/ay test için yeterli.

**Implementation:**
- [`src/lib/email-verification.ts`](src/lib/email-verification.ts) - ZeroBounce API client
- [`src/workers/email-verification-worker.ts`](src/workers/email-verification-worker.ts) - BullMQ worker
- [`src/app/api/leads/export/route.ts`](src/app/api/leads/export/route.ts) - CSV export filter
- [`.env`](.env) - `ZEROBOUNCE_API_KEY` slot eklendi
- Graceful degradation: API key boşsa worker silently skip eder

## 2. Co-pilot chat tier dağılımı

**Karar:** Free 5/gün, Pro Solo 50/gün, Pro Team 200/gün, Agency 10.000/gün.

**Gerekçe:** Plan §7.2'de yazılı öneri. Gemini token maliyeti orta; Pro Team
3 kişilik ekipte 200/gün = kişi başı 67 mesaj, gerçek kullanım için bol.

**Implementation:**
- [`src/lib/copilot.ts`](src/lib/copilot.ts) - `TIER_LIMITS` sabiti
- [`src/app/api/copilot/route.ts`](src/app/api/copilot/route.ts) - 402 quota_exceeded response
- [`src/components/app/copilot-drawer.tsx`](src/components/app/copilot-drawer.tsx) - quota error UI

## 3. Personalized video özelliği: pilot scaffolding hazır, P1 promosyonu pilot sonucuna bağlı

**Karar:** P2.1 endpoint shipping olarak hazır, kullanıcı "video script üret"
diyebilir. P1'e tier promosyonu (UI butonu lead detail'de prominent + tier
metering) `New_Grape7181`'in 8% → 20% reply lift iddiasını 30 müşteride
pilotlayıp ölçtükten sonra yapılacak.

**Implementation:**
- [`src/lib/prompts/video-script-prompt.ts`](src/lib/prompts/video-script-prompt.ts)
- [`src/app/api/leads/[id]/video-script/route.ts`](src/app/api/leads/[id]/video-script/route.ts)
- Pilot kullanım: `POST /api/leads/{id}/video-script` → 30 saniyelik script döner
- Pilot ölçüm planı: 30 müşteriye sun, video gönderen vs göndermeyen kohort
  reply rate karşılaştır. Lift > 1.5x ise lead detail'e prominent buton koy.

## 5. AI Core + pgvector + Apify — orchestration platformu

**Karar:** Butun AI parcalari tek bir orchestrator + pgvector tabanli
semantic memory + Apify external data source katmani altinda toplandi.
Pinecone yerine Supabase pgvector (zaten Supabase'deyiz, tek sistem,
Prisma transaction atomikligi); legacy worker'lar registry'e tasindi
(yerleri korundu); Apify 9 actor'lu "enrichment" worker grubu olarak
registry'e baglandi.

**Gerekce:**
- Dagilmislik: 7 BullMQ kuyrugu -> 1 (`ai-runs`). 2 state modeli
  (legacy `Lead.*Status` vs `AgentRun`) -> `AgentRun + PlannerSession`.
- Baglamsizlik: Her worker ayni `SemanticMemory` substrate'inden okur
  ve yazar. Copilot artik "top 30 by recency" yerine semantic
  retrieval kullaniyor. Opener writer few-shot olarak gecmis basarili
  opener'lari cekiyor (learning loop).
- Yuzeyselkalma: Apify ile lead basi ~$1-2 karsiliginda 500 review,
  tam Instagram/Facebook/TikTok profili, SERP rank, rakip ad arsivi,
  LinkedIn hiring sinyali, Reddit itibari memory'e giriyor.
- AI Receptionist Builder gercek deliverable olarak shippable:
  `APIFY_WEB_CRAWL_DEEP -> PROSPECT_KB_CHUNK memory -> receptionist
  kb_json export` Synthflow/Retell panosuna yuklenebiliyor.

**Implementation:**
- [`prisma/schema.prisma`](prisma/schema.prisma) — yeni modeller
  (`SemanticMemory`, `PlannerSession`), 9 yeni `AgentWorkerKind`,
  `MemoryKind`/`PlannerStatus`/`PlannerTrigger` enumlari.
- [`prisma/migrations/add_pgvector_extension.sql`](prisma/migrations/add_pgvector_extension.sql) — extension install.
- [`prisma/migrations/add_ai_core.sql`](prisma/migrations/add_ai_core.sql) — vector(768) kolonu + HNSW cosine index.
- [`src/lib/ai-core/`](src/lib/ai-core) — memory facade, embed helper,
  event bus, chains (DAG), planner, orchestrator, router (copilot
  function-calling), sentinels.
- [`src/lib/agent-workers/`](src/lib/agent-workers) — legacy worker
  wrappers (website-auditor, review-analyst, sales-opportunity-scorer,
  social-scraper, email-verifier, opener-writer, inbox-reply-attributor)
  + `apify/` klasoru 9 Apify wrapper.
- [`src/lib/apify.ts`](src/lib/apify.ts) — Apify REST client + webhook
  secret verify.
- [`src/app/api/planner/`](src/app/api/planner) — start / [id] / bulk
  endpoint'leri.
- [`src/app/api/webhooks/apify/route.ts`](src/app/api/webhooks/apify/route.ts) — async actor callback.
- [`src/app/api/leads/[id]/lookalikes/route.ts`](src/app/api/leads/[id]/lookalikes/route.ts) — semantic k-NN.
- [`src/app/api/leads/[id]/mark-outcome/route.ts`](src/app/api/leads/[id]/mark-outcome/route.ts) — learning loop tetikleyici.
- [`src/components/app/planner-actions.tsx`](src/components/app/planner-actions.tsx) — UI panel.
- [`scripts/check-pgvector.ts`](scripts/check-pgvector.ts) — deploy
  oncesi migration dogrulama.

**Vector DB secimi: pgvector vs Pinecone.**  Onerilen secim **pgvector**'du
ve uygulanan da bu. Nedenleri:
- Supabase uzerinde built-in, ek servis/fatura yok.
- Prisma transaction icinde `SemanticMemory` row + embed atomik yazilabilir.
- HNSW index `vector_cosine_ops` ile cosine similarity direkt SQL.
- Gemini `text-embedding-004` 768 dim, pgvector 2000 dim limitinin altinda.
- Tenant izolasyonu `workspace_id` filter ile saglaniyor; Pinecone'un
  namespace modeli ile islevsel olarak esdeger.
- 5M+ vector'e cikinca Pinecone'a mal olmadan geciste de kolay: embedding
  vendor lock-in yok.

**Big-bang degil, 7 fazli tek sprint.** Her faz bir commit/logical
unit olarak uygulandi: Foundation -> Planner -> Queues -> Copilot ->
UI -> Learning loop -> Apify. Legacy BullMQ kuyruklari (`discovery`,
`crawl`, `analyze`, `review-analysis`, `email-verification`,
`inbox-sync`) suan canli akista; kapatma bir sonraki release'e
birakildi (sifir-downtime tasinma icin).

## 4. Mapileads competitive monitoring cadence

**Karar:** Çınar haftalık `/last30days mapileads` çalıştıracak. İlk Pazartesi
sonrası repo'da `MAPILEADS-MONITOR.md` dosyası oluşturulup yeni özellikler
not edilecek; Plan §4 P0/P1 bucket'ları yeni signal'a göre revize edilecek.

**Implementation (process-level, code değil):**
- Çınar'ın haftalık takvim hatırlatıcısı
- Takvim hooku: Pazartesi 09:00 GMT - "Run /last30days mapileads"
- Output dosya yeri: `~/Documents/Last30Days/mapileads-{YYYY-MM-DD}-raw-mapileads.md`
- Aylık review: Plan §4 ve §6 (anti-roadmap) revizyonu
- Yeni rakip çıkarsa `REDDIT-{competitor}.md` dosyası açılır, plan §5'e satır
  eklenir, P0/P1'e gerekirse yeni madde girer

---

## Implementation snapshot (sonraki turn için referans)

**Tüm 17 P0/P1/P2 maddesi shipping** ya da **scaffolding hazır**. Aşağıda kim
gerçek production-ready, kim "first iteration shipping pending API key":

| ID | Status | Production-blocker var mı |
|---|---|---|
| P0.1 Review Intelligence | shipping | yok, GEMINI_API_KEY zaten kurulu |
| P0.2 My Offer | shipping | yok |
| P0.3 Mockup × RI sinerjisi | shipping | yok (P0.1 + P0.2 üzerine) |
| P0.4 Email verification | shipping (graceful skip) | ZEROBOUNCE_API_KEY set edilmeli prod'da |
| P0.5 Social profile scraping | shipping | yok |
| P0.6 PWA | shipping | icon-192/512.png assetleri lazım (placeholder svg ile çalışır) |
| P0.7 Voice notes | shipping | yok, GEMINI_API_KEY zaten kurulu |
| P0.8 Pro Team pricing | shipping | STRIPE_PRICE_PRO_TEAM Stripe Dashboard'dan oluşturulup .env'e eklenmeli |
| P0.9 Walk-in landing | shipping | yok |
| P1.1 Direct email send | shipping (kapalı default) | GOOGLE_OAUTH ve MICROSOFT_OAUTH credentials |
| P1.2 Co-pilot chat | shipping | yok |
| P1.3 Calendar sync | shipping (kapalı default) | GOOGLE_OAUTH (Calendar scope), MICROSOFT_OAUTH |
| P1.4 Reply attribution | shipping (opt-in toggle) | aynı OAuth |
| P1.5 GPS lead sıralama | shipping | yok, HTTPS olmadan tarayıcı geolocation izin vermez |
| P1.6 Map view | shipping | yok (OpenStreetMap embed iframe, dependency-free) |
| P2.1 Video script | shipping (pilot) | yok |
| P2.3 Multi-language | shipping (TR/EN/ES/DE/FR/IT/PT) | yok |

**Net production checklist (deploy öncesi):**
1. `npm install` + `npx prisma db push` (schema migration uygula)
2. `.env`: `ZEROBOUNCE_API_KEY`, `STRIPE_PRICE_PRO_TEAM`, `GOOGLE_OAUTH_*`, `MICROSOFT_OAUTH_*`, `OAUTH_REDIRECT_URL`
3. Stripe Dashboard: Pro Team $149/ay product + price ID oluştur
4. Google Cloud Console: OAuth client, Gmail + Calendar scope, redirect URI
5. Microsoft Azure Portal: App registration, Mail.Send + Mail.Read + Calendars.ReadWrite scope
6. `public/`: icon-192.png, icon-512.png, icon-maskable-512.png assetleri (en kötü ihtimalle SVG'den convert)
7. Nginx/Vercel: `/sw.js` static dosyası `Service-Worker-Allowed: /` header ile servis edilmeli
