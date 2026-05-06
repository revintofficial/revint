# Agent 4 — Infra + Schema

> **Cluster:** infrastructure, schema migration, worker resilience
> **Source:** `research/finedine/beta-test-round-2-camden-report.md` §3.6, §4 carryover #7, §6 P0 yol haritası, §8.2 stratejik öneriler + önceki sohbet (Phase 5.2 / 7.3 / 7.4)
> **Yetki:** Yalnız markdown plan. Source code bu görevde değiştirilmez.

---

## 0. Cover

Bu doküman Round 2 raporundaki sistem-seviyesi (UI'dan bağımsız) sorunları ve Round 1'den taşınan altyapı tehditlerini kod seviyesinde doğruluyor, kök neden + fix tasarımı + effort/risk üretiyor. Beş ana iş paketi var:

1. **§3.6 — Quota error message yanıltıcılığı.** Per-lead daily cap (50/24h) ile worker monthly quota (44/50000) UI'da karışıyor; race + status-filter inconsistency tespit ettim.
2. **Round 1 #7 — Embedding crash + Gemini 403.** SUCCEEDED_NO_MEMORY status zaten mevcut; ancak retry budget per-lead, key rotation telemetri, ve embedding decoupling tam değil.
3. **Phase 5.2 — `SuggestedOffer` enum + `SalesOpportunity.suggestedOffer`/`expectedPriceBand` DROP + `WatchlistItem.selectedOffer` migration.** Schema'da hâlâ duruyor; reader'lar 8+ dosyada hâlâ field'ı okuyor.
4. **Phase 7.4 — `BetaFeedback` model.** Multi-tenant scope + minimal viable schema + admin viewer effort.
5. **Phase 7.3 — Single primary score migration.** `lead_score` + `opportunity_score` + `sales_confidence` → tek "salesConfidence". `salesConfidence` field'ı zaten var; "Advanced metrics" hide path kapalı.

Plus ek iki sürüm-altyapı kararı:
- **Production migration prosedürü:** `npm run db:push` vs `prisma migrate deploy` trade-off.
- **WatchlistItem.selectedOffer count threshold tablosu** (open question; SQL hazır, sayı bekleniyor).

---

## 1. Sorun Inventory

| # | Sorun | Dosya:satır | Severity | Round 1'de var mıydı? |
|---|---|---|---|---|
| §3.6-A | `assertWorkerQuota` `"44/50000 exceeded"` mesajı per-lead daily cap'i maskeliyor | `src/lib/agent-workers/quota.ts:442-477` | P0 | YENİ |
| §3.6-B | `checkWorkerQuota` per-lead cap'i ve `assertWorkerQuota`'nın ikinci sorgusu **iki ayrı transaction'da** sayıyor → race window | `quota.ts:377-389` + `442-474` | P0 | YENİ |
| §3.6-C | Per-lead cap PENDING+RUNNING+SUCCEEDED sayıyor; FAILED saymıyor → tester'ın One Shot'ta 8+ FAILED retry'ı per-lead count'ı 50'nin altında tutup quota'yı yanlış yönlendiriyor | `quota.ts:383` | P0 | YENİ |
| Round1#7-A | One Shot Coffee 8 ardışık `Failed to embed after 3 attempts` (`APIFY_WEB_CRAWL_DEEP`, 2026-05-02) | `src/lib/ai-core/embed.ts:131-134` | P0 | EVET, hâlâ canlı |
| Round1#7-B | LUMI Camden 2× Gemini 403 (`LEAD_DOSSIER_GENERATOR`, 2026-05-03) | `gemini-keys.ts:99-113` cooldown 5 dk; key sayısı = 1 ise rotation yok | P0 | EVET |
| Round1#7-C | Camden Roastery / Black Sheep / Glass / Il botanico / Fable and Falcon `WEBSITE_AUDITOR` ve `REVIEW_ANALYST` "Failed to embed" döngüsü | `execute.ts:531-545` (degrade path zaten var) ama re-embed backfill yok | P0 | EVET |
| Round1#7-D | `RetryableError` taxonomy `EmbeddingError`'ı **retryable saymıyor** (`errors.ts:81` "quota exceeded" → permanent matchliyor; embed mesajı transient ama retry'e girmiyor) | `errors.ts:49-90` | P1 | EVET |
| Phase5.2-A | `SuggestedOffer` enum hâlâ `prisma/schema.prisma:36-40` | `schema.prisma:36-40, 952, 979` | P1 | YENİ (cleanup) |
| Phase5.2-B | `SalesOpportunity.suggestedOffer` (default STARTER) + `expectedPriceBand` 8+ reader'da hâlâ okunuyor | `schema.prisma:952, 954` + 8 dosya | P1 | YENİ |
| Phase5.2-C | `WatchlistItem.selectedOffer` `SuggestedOffer?` rep tarafından kanban'da set ediliyor (`/api/watchlist/[id]`); enum DROP edilirse user data kaybı | `schema.prisma:979` + `api/watchlist/[id]/route.ts` | P0 (data risk) | YENİ |
| Phase7.4 | `BetaFeedback` modeli yok; lead detail sayfasından "Bug bildir" CTA'sı eksik; tester her seferinde lead.id manuel kopyalıyor (3 ID copy-paste hatası kanıt) | yeni model gerekli | P1 | YENİ |
| Phase7.3-A | UI `lead.salesConfidence ?? opp?.opportunityScore ?? null` fallback hâlâ `opportunityScore` gösteriyor (cycleResetAt öncesi lead'lerde) | `app/leads/[id]/page.tsx:1023-1024` | P2 | EVET |
| Phase7.3-B | `ReviewAnalysis.leadScore` UI'da "Review sub-score" badge olarak hâlâ visible; "Advanced metrics" tab'ına taşınmadı | `app/leads/[id]/page.tsx:968-976` | P2 | EVET |
| MIG-PROD | Production'da `db:push` mu yoksa `migrate deploy` mi kullanılacak — proje hâlâ `db:push` kullanıyor; migration history yok | `prisma-db.mdc` "no migration history" | P1 (release safety) | YENİ |

---

## 2. Root Cause Analysis

### 2.1 §3.6 — Quota error message yanıltıcılığı (kök neden)

**Akış (kod tabanlı izleme):**

```
agent-run-worker → executeAgentRun (execute.ts:142-150)
  → checkWorkerQuota (quota.ts:320-422)
      ├─ workerKind monthly count → used=44, limit=50000 → allowed=true
      ├─ args.leadId set → ikinci aggregate query (quota.ts:377-390):
      │     leadUsed = COUNT(agent_runs WHERE leadId AND status IN
      │                ('PENDING','RUNNING','SUCCEEDED') AND createdAt >= now-24h)
      │     leadUsed >= 50 → base.allowed=false (DAMA: used/limit hâlâ 44/50000)
      └─ return base
  → if (!quota.allowed) (execute.ts:148): throw QuotaExceededError(used=44, limit=50000)
```

`QuotaCheckResult` field'ı tek bir `(used, limit)` çiftiyle ifade ediliyor; per-lead cap `allowed=false`'a yazıyor ama mesaja sızmıyor.

`assertWorkerQuota` (API path)'te per-lead cap'i ayrıca yeniden sorguluyor (`quota.ts:454-473`) ve `PerLeadDailyCapExceededError` fırlatıyor — **doğru**. Ama bu yol **sadece API path'inde** çalışıyor; `executeAgentRun:142` `checkWorkerQuota`'yı çağırıyor (`assertWorkerQuota` değil) ve direkt `QuotaExceededError(used, limit, kind)` fırlatıyor → mesaj `"Quota exceeded for SALES_OPPORTUNITY_SCORER: 44/50000"`.

**İki olasılık testi:**

| Hipotez | Test | Sonuç |
|---|---|---|
| **A. Race condition.** İlk check'te `leadUsed=51` (yasaklı), `assertWorkerQuota`'nın ikinci sorgusunda bir RUNNING row FAILED'a geçti → leadUsed=50 → fall-through. | `assertWorkerQuota:457-466` ikinci `count`'u SAME (`status IN ('PENDING','RUNNING','SUCCEEDED')`); FAILED'a düşmüş satır iki yerde de görünmez. **Race değil**, sayım kuralı tutarlı. | ELIMINE |
| **B. Status filtering tutarsızlığı.** `PER_LEAD_DAILY_CAP=50` PENDING+RUNNING+SUCCEEDED sayar ama FAILED saymaz. Ancak One Shot Coffee'nin `agent_runs` tablosunda 15 ardışık FAILED satır var (raporun §A.6'sı). Cap'i FAILED'sız saymak normalde doğru, ama burada **execute.ts** `assertWorkerQuota` yerine `checkWorkerQuota` kullanıyor → `QuotaExceededError`'a düşüyor → message "44/50000" yanıltıcı. | `execute.ts:142` yorum: `checkWorkerQuota` zaten gather-only; `if (!quota.allowed) throw QuotaExceededError(quota.used, quota.limit)` per-lead cap olduğunda `used/limit` hâlâ 44/50000. UI bu mesajı `errorMsg` field'ından okuyor. **Kök neden: execute.ts'in `assertWorkerQuota` kullanmaması + `QuotaCheckResult`'ın `blockReason` taşımaması.** | DOĞRU |

**Sonuç:** Race değil, **disclosure bug**. Worker process'te `checkWorkerQuota` per-lead cap'i `allowed=false` yapıyor ama hangi cap'in tetiklendiğini taşıyamıyor; outer kod yanlış error class'ı seçiyor.

### 2.2 Round 1 #7 — Embedding crash + 403 (kök neden)

**Akış:**

```
worker.run(ctx) → result
memoryWritesFn(result.output, ctx) → writes[]
persistMemoryWrites (execute.ts:464-550)
  for w in writes:
    if !w.skipEmbed:
      await upsertAndEmbed(args)   ← memory.ts içinde embed(text) çağrılıyor
        embed (embed.ts:70-135)
          ├─ getGeminiKey() → key picked
          ├─ for rotation 0..2:
          │     model.embedContent(input)
          │     catch:
          │       isGeminiAuthFailure → markGeminiKeyCool(key) → continue rotation
          │       transient (429/5xx/timeout) → sleep + retry inner
          │       else → break (non-transient)
          └─ throw EmbeddingError("Failed to embed after 3 attempts")
    catch EmbeddingError (execute.ts:531):
      logger.warn(...)
      await upsert(args)  ← embedding=null, text persisted
      degraded = true
finalStatus = degraded ? "SUCCEEDED_NO_MEMORY" : "SUCCEEDED"
```

Yani **degrade path zaten doğru kurgulanmış** (Phase 2'de eklenmiş, `errorMsg = "embedding_unavailable_degraded"`). Ama:

**Eksiklikler:**

1. **Re-embed backfill kuyruğu yok.** `agent-runs` queue'da `{ type: "embed", memoryId: string }` discriminator var (workers-bullmq.mdc'de listeli) ama `SUCCEEDED_NO_MEMORY` status'lu run'lardan (veya `SemanticMemory.embedding IS NULL` row'lardan) **periyodik enqueue** yok. Tester'ın 8 ardışık fail ettikten sonra bile embedding'ler null kalmış.
2. **Retry budget per-lead yok.** `agent-runs` queue BullMQ retry attempts default'u (3'lük layer × embed.ts içindeki 3'lük layer = 9 deneme) **lead başına** counter yok. One Shot Coffee 8 ardışık fail = ~72 Gemini call hedge'lendi → maliyet, ve UI'a sürekli FAILED görünmesi rep'i tekrar tetiklemeye itiyor (sonsuz döngü).
3. **Key rotation pool size = 1.** `gemini-keys.ts:48-53` `GEMINI_API_KEY_1..8` bekliyor; production env'inde tek `GEMINI_API_KEY` set edilmişse pool'da 1 key var → 5 dakikalık cooldown sonrası aynı key'e dönüyor. LUMI'deki 2× 403 bunun kanıtı.
4. **`SUCCEEDED_NO_MEMORY` UI feedback yok.** Status enum'da var ama `errorMsg = "embedding_unavailable_degraded"` UI'a sızıyor; kullanıcı bunu "FAILED" sanıyor.

### 2.3 Phase 5.2 — `SuggestedOffer` enum DROP risk analizi

**Mevcut durum:**

```prisma
enum SuggestedOffer { STARTER GROWTH SALES }
model SalesOpportunity {
  suggestedOffer    SuggestedOffer @default(STARTER)
  expectedPriceBand String?
}
model WatchlistItem {
  selectedOffer     SuggestedOffer?
}
```

**Reader inventory** (grep ile bulundu):

| Path | Tip | Action gerekli? |
|---|---|---|
| `src/app/app/leads/[id]/page.tsx:963-967` | UI render Tier badge | DROP — Round 2 §3.1'in fix'i (Agent 1/UI cluster) |
| `src/lib/gemini.ts:177, 663` | Sales scorer prompt input | UPDATE — `recommendedPackageId` ile değiştir |
| `src/lib/agent-workers/dossier-summary.ts:141-142` | Dossier metrics | UPDATE — package.priceLabel kullan |
| `src/lib/agent-workers/sales-opportunity-scorer.ts:336-340` | ZATEN deprecated yorum, write yapmıyor | OK |
| `src/lib/ai-core/sentinels.ts:100, 199` | `__EMBED_LEAD_PROFILE__` lead-context | UPDATE |
| `src/components/app/leads/dossier/DossierSourceDrawer.tsx:325-326` | Dossier drawer field | DROP |
| `src/components/app/leads/dossier/source-registry.tsx:694-696` | Dossier field registry | DROP |
| `src/components/app/leads/useLeadsQuery.ts:117` | Type definition | UPDATE |
| `src/app/app/deals/types.ts:19, 25, 37` | Deal kanban types | UPDATE — `selectedOffer` deal kanban'da rep tarafından set ediliyor; kalmalı (string olarak) |
| `src/app/app/deals/page.tsx:616-628, 698-710` | Deal pipeline kanban "Selected package" badge | UPDATE — string olarak migrate, FK to ServicePackage tercih |
| `src/app/app/deals/deal-side-panel.tsx:172-329` | "Selected package" radio | UPDATE — `ServicePackage.id`'ye geçiş |
| `src/app/api/watchlist/[id]/route.ts:14-30, 63` | PATCH `selectedOffer` | UPDATE |
| `src/app/api/watchlist/route.ts:22, 28, 48` | GET watchlist `select` | UPDATE |
| `src/lib/watchlist-export.ts:21, 36, 46, 83, 91, 100, 274, 276` | CSV export | UPDATE |
| `src/app/api/leads/export/route.ts` | Lead export | UPDATE |
| `src/app/api/leads/route.ts` | Lead list select | UPDATE |
| `src/app/api/leads/[id]/lookalikes/route.ts:93` | Lookalikes select | DROP |
| `src/app/api/website-plan/[leadId]/route.ts:102` | Website plan input | UPDATE |
| 4× test file | Test fixture | UPDATE |

**Risk:** `WatchlistItem.selectedOffer` REP TARAFINDAN MANUAL SET EDİLİYOR. Direkt `DROP COLUMN` user data kaybı (özellikle FineDine Beta'da rep'in pipeline kanban'da "STARTER/GROWTH/SALES" seçimleri var). Bu **migration ad-hoc `db:push` ile yapılırsa rollback yok** — production'da `migrate deploy` veya en azından şema-kopya backup olmadan yapılamaz.

### 2.4 Phase 7.4 — `BetaFeedback` model

Mevcut durum: yok. Tester Round 2'de 12 lead için manuel markdown rapor yazdı, 3'ünde lead.id copy-paste hatası yaptı (raporun §1.1'i). Çözüm: lead detail page'de "Bug bildir / Pitch düzelt" butonu → otomatik `leadId` populate → `BetaFeedback` row.

### 2.5 Phase 7.3 — Single primary score (UI hide path)

`Lead.salesConfidence` field zaten mevcut (`schema.prisma:565`); `LEAD_INTELLIGENCE_BRIEF` worker `computeSalesConfidence()` ile yazıyor (lead-intelligence-brief.ts:464). UI'da:

```
const score = lead.salesConfidence ?? opp?.opportunityScore ?? null;
```

— **mevcut yapılandırma doğru** (fallback path eski lead'ler için). Eksik olan iki şey:
1. `ReviewAnalysis.leadScore` "Review sub-score" badge'i hâlâ visible (page.tsx:968-976). "Advanced metrics" disclosure'a taşınmadı.
2. `salesConfidence == null` olan lead'lerde fallback `opportunityScore` gösteriyor; bu da tester'a "üç farklı sayı görüyorum" hissi veriyor (One Shot Coffee: opp_score=100, lead_score=20, sales_confidence=35 raporda §2 #8).

---

## 3. Fix Önerisi

### 3.1 §3.6 — `blockReason` field design + 4 error path table

#### Schema diff (Prisma — yok; pure TypeScript shape)

`src/lib/agent-workers/quota.ts`:

```ts
// QuotaCheckResult'a yeni alan
export type QuotaBlockReason =
  | "WORKER_MONTHLY_QUOTA"
  | "PER_LEAD_DAILY_CAP"
  | "APIFY_USD_BUDGET"
  | "PLAN_TOO_LOW"
  | "WORKER_DISABLED"
  | null;

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;          // amaç-bağımlı: WORKER_MONTHLY_QUOTA için worker count, PER_LEAD_DAILY_CAP için leadUsed
  limit: number;         // amaç-bağımlı
  remaining: number;
  resetAt: Date | null;
  blockReason: QuotaBlockReason;
  // İstemci için: hangi cap tetiklendi
  workerMonthlyUsed: number;
  workerMonthlyLimit: number;
  perLeadDailyUsed: number | null;     // null = lead context yok
  perLeadDailyLimit: number;
  apifyCentsUsed?: number;
  apifyCentsLimit?: number;
}
```

`checkWorkerQuota` her bir cap için ayrı counter persist etsin; **tek snapshot transaction** içinde:

```ts
// Pseudo — implementation aşamasında transaction'a sar
const [workerMonthly, perLead, apifyAgg] = await prisma.$transaction([
  prisma.agentRun.count({ where: { workspaceId, workerKind: kind, createdAt: { gte: ws.cycleResetAt }, OR: [...]} }),
  args.leadId
    ? prisma.agentRun.count({ where: { workspaceId, leadId: args.leadId, status: { in: ["PENDING","RUNNING","SUCCEEDED","SUCCEEDED_NO_MEMORY"] }, createdAt: { gte: since } } })
    : Promise.resolve(0),
  isApifyKind(kind)
    ? prisma.agentRun.aggregate({ ... })
    : Promise.resolve(null),
], { isolationLevel: "RepeatableRead" });
```

> **Not:** `SUCCEEDED_NO_MEMORY` dahil — bu Round 2'de yeni eklenen status (Round 1 #7 fix'i sonrası); per-lead cap'i sayarken kaçırırsak embedding-degraded run'lar "free" sayılıyor → quota gevşetiliyor.

#### `assertWorkerQuota` rewrite

```ts
export async function assertWorkerQuota(args): Promise<QuotaCheckResult> {
  const quota = await checkWorkerQuota(args);
  if (quota.allowed) return quota;

  switch (quota.blockReason) {
    case "PLAN_TOO_LOW":
      throw new PlanTooLowError(args.kind, getWorker(args.kind)!.minPlan);
    case "WORKER_DISABLED":
      throw new PlanTooLowError(args.kind, getWorker(args.kind)!.minPlan);
    case "PER_LEAD_DAILY_CAP":
      throw new PerLeadDailyCapExceededError(args.leadId!, quota.perLeadDailyUsed!, quota.perLeadDailyLimit);
    case "APIFY_USD_BUDGET":
      throw new ApifyBudgetExceededError(quota.apifyCentsUsed!, quota.apifyCentsLimit!);
    case "WORKER_MONTHLY_QUOTA":
    default:
      throw new QuotaExceededError(quota.workerMonthlyUsed, quota.workerMonthlyLimit, args.kind);
  }
}
```

`execute.ts:142-150` change: `checkWorkerQuota` yerine `assertWorkerQuota` kullan (worker process'te de aynı tekil error class'ı atılsın). Şu anda execute.ts kontrolü gather + manual throw yapıyor:

```ts
// execute.ts:142-150 (mevcut, hatalı)
const quota = await checkWorkerQuota({ ... });
if (!quota.allowed) {
  throw new QuotaExceededError(quota.used, quota.limit, run.workerKind);
}

// FIX:
await assertWorkerQuota({ ... }); // throws taxonomy error
```

#### 4-error-path table

| blockReason | Error class | UI mesajı (TR) | UI mesajı (EN) | Recoverable? |
|---|---|---|---|---|
| `WORKER_MONTHLY_QUOTA` | `QuotaExceededError` | "Bu ay {worker} limitiniz doldu — yenileme tarihi: {resetAt}. Plan yükseltin veya bekleyin." | "Monthly limit reached for {worker}. Resets {resetAt}." | upgrade plan veya cycle reset |
| `PER_LEAD_DAILY_CAP` | `PerLeadDailyCapExceededError` | "Bu lead için günlük 50 AI çalıştırması sınırına ulaştınız — yarın aynı saatte tekrar deneyin." | "Daily 50-run cap hit for this lead. Retry in 24h." | wait 24h or pick another lead |
| `APIFY_USD_BUDGET` | `ApifyBudgetExceededError` | "Aylık enrichment bütçeniz tükendi (${cents/100}/${limit/100}). Plan yükseltin." | "Monthly enrichment budget exhausted (${cents/100}/${limit/100})." | upgrade plan |
| `PLAN_TOO_LOW` | `PlanTooLowError` | "{worker} en az {minPlan} planında çalışır. Plan yükseltin." | "{worker} requires plan {minPlan} or higher." | upgrade plan |

#### Defensive: execute.ts retry loop'u quota error'larını swallow etmesin

`errors.ts:81` `quota exceeded` permanent → BullMQ retry yapmıyor — **doğru**. Per-lead cap permanent (24h içinde tekrar başarısız olur). Apify budget permanent (cycle resetine kadar). Tüm 4 error PermanentError sınıfından türemeli; mevcut sınıflar (`QuotaExceededError`, `PerLeadDailyCapExceededError`, `ApifyBudgetExceededError`, `PlanTooLowError`) plain `Error` extends ediyor → `isRetryable` mesaj-string match'iyle yakalıyor (`/quota exceeded/`, `/apify monthly usd budget exhausted/`, `/plan too low/`). **Per-lead cap mesajını eklemek lazım**:

```ts
// errors.ts:82'ye ekle
if (msg.includes("daily per-lead cap exceeded")) return false;
```

veya — daha temiz — `QuotaExceededError`/`PerLeadDailyCapExceededError`/`ApifyBudgetExceededError`/`PlanTooLowError` **PermanentError extends** etsin (reason: "quota").

#### Effort: §3.6

| Sub-task | Effort |
|---|---|
| `QuotaCheckResult` şema değişikliği + `blockReason` ekleme | 2 saat |
| `checkWorkerQuota` transaction snapshot + per-lead cap'e `SUCCEEDED_NO_MEMORY` dahil etme | 3 saat |
| `assertWorkerQuota` switch + 4 error class | 1 saat |
| `execute.ts:142-150` `assertWorkerQuota`'ya geçiş | 30 dk |
| `errors.ts` per-lead cap mesajını PermanentError'a yönlendir + 4 error class'ı `extends PermanentError` yap | 1 saat |
| API route'larda 4 error class catch ediliyor mu kontrol (`/api/leads/[id]/workers/[kind]`) | 30 dk |
| Vitest: `__tests__/agent-workers/quota.test.ts` 4 senaryo | 2 saat |
| **Toplam** | **10 saat** (Round 2 raporundaki "4 saat" tahmini eksik; testler dahil) |

---

### 3.2 Round 1 #7 — API key rotation + `SUCCEEDED_NO_MEMORY` 3-state design

#### Mevcut 2-state sistemi

```
SUCCEEDED              ← embedding başarılı, memory queryable
SUCCEEDED_NO_MEMORY    ← worker output kalıcı, embedding null, memory non-queryable
FAILED                 ← worker output bile yok
```

Bu yeterli görünüyor. **Eksik kalan parçalar**:

#### A. Re-embed backfill cron + queue

Yeni BullMQ job (yeni queue YOK; `agent-runs` discriminator):

```ts
// src/lib/queues.ts (mevcut queue, yeni job tipi)
type AgentRunJob =
  | { type: "agent_run"; runId: string }
  | { type: "orchestrator_advance"; sessionId: string }
  | { type: "embed"; memoryId: string }            ← MEVCUT, ama enqueue eden yok
  | { type: "rebuild_memory_embedding"; semanticMemoryId: string }; ← YENİ
```

**Cron:** `src/app/api/agent-runs/rebuild-embeddings/route.ts` (admin-only):

```sql
-- SemanticMemory.embedding IS NULL olan en eski 100 satır
SELECT id FROM semantic_memory
WHERE embedding IS NULL
  AND created_at < NOW() - INTERVAL '5 minutes'  -- yeni satırlara dokunma
ORDER BY created_at ASC
LIMIT 100;
```

Her satır için `agent-runs` queue'ya `{ type: "rebuild_memory_embedding", semanticMemoryId: row.id }` enqueue. `agent-run-worker.ts` discriminator'ı genişlet → `embed(text)` çağır + UPDATE.

#### B. Per-lead AI run budget (saatlik soft cap)

`PER_LEAD_DAILY_CAP=50` günlük; ama **saatlik cap eksik**. One Shot Coffee 7 saat içinde 15 retry yaptı → saatte 2-3 retry normal değil. Yeni soft cap:

```ts
const PER_LEAD_HOURLY_CAP = 8;  // 50/24 ≈ 2/h, headroom + burst için 8/h
```

Aynı `checkWorkerQuota` snapshot'ta üçüncü counter:

```ts
const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
const leadHourly = await prisma.agentRun.count({
  where: { workspaceId, leadId, status: { in: ["PENDING","RUNNING","SUCCEEDED","SUCCEEDED_NO_MEMORY"] }, createdAt: { gte: sinceHour } },
});
// blockReason = "PER_LEAD_HOURLY_BURST" → recovery: wait 1h
```

`QuotaBlockReason`'a 5. değer ekle. UI mesajı: "Bu lead için son 1 saatte 8 AI çalıştırması yapıldı; biraz bekleyin."

#### C. Gemini API key rotation strategy (production env requirement)

**Mevcut:** `gemini-keys.ts` `GEMINI_API_KEY_1..8` + fallback `GEMINI_API_KEY`. Pool tek key ise 5 dk cooldown sonrası aynı key'e dönüyor.

**Strateji:**

1. **Min pool size telemetri:** `getGeminiKeyDiagnostics()` (mevcut export) `/api/health` route'una ekle; production'da CI guard:
   ```ts
   if (loadPool().length < 2) {
     logger.error("gemini.key.pool.degenerate", { size: loadPool().length });
     // Slack alert / Sentry breadcrumb
   }
   ```

2. **Cooldown adaptive:** 403 ardışık tekrarlanırsa cooldown'u 5 dk → 30 dk → 6 saat'e çıkar (Gemini revoked key 5 dk içinde geri gelmez):
   ```ts
   interface KeyState {
     // ...
     consecutiveFailures: number;
   }
   function markGeminiKeyCool(apiKey, reason) {
     const entry = ...;
     entry.consecutiveFailures = (entry.consecutiveFailures ?? 0) + 1;
     const baseMs = 5 * 60 * 1000;
     entry.cooldownUntil = Date.now() + baseMs * Math.min(2 ** entry.consecutiveFailures, 72);
   }
   // SUCCESS path'inde reset:
   function markGeminiKeySuccess(apiKey) {
     const entry = ...;
     entry.consecutiveFailures = 0;
   }
   ```

3. **Pool degenerate fallback:** `allGeminiKeysCool() === true` → embedding hatası "EMBEDDING_DISABLED_QUOTA_OUTAGE" classification'ı; `executeAgentRun` `RetryableError` fırlatmasın, doğrudan `SUCCEEDED_NO_MEMORY` ile sonlansın (mevcut yol zaten bunu yapıyor). UI'da workspace banner: "Gemini embedding API geçici olarak kapalı; AI memory degraded mode'da. Toplu re-embed kuyruğunda."

#### D. Effort: Round 1 #7

| Sub-task | Effort |
|---|---|
| Per-lead hourly cap (PER_LEAD_HOURLY_CAP=8) `checkWorkerQuota` extend | 2 saat |
| `QuotaBlockReason: PER_LEAD_HOURLY_BURST` ekleme + UI mesajı | 1 saat |
| `gemini-keys.ts` adaptive cooldown + `consecutiveFailures` field | 2 saat |
| `getGeminiKeyDiagnostics()` `/api/health`'e ekle + degenerate pool log/alert | 1 saat |
| `agent-runs` queue'a `rebuild_memory_embedding` discriminator + `agent-run-worker.ts` switch case | 3 saat |
| `/api/agent-runs/rebuild-embeddings` admin route + cron schedule (`vercel.json`) | 2 saat |
| `SUCCEEDED_NO_MEMORY` UI badge (Lead detail page'de "AI memory: degraded — re-embed kuyruğunda") | 2 saat |
| Vitest: 3 test (rotation, hourly cap, degenerate pool fallback) | 3 saat |
| **Toplam** | **16 saat** (Round 2 raporundaki "12 saat" tahmininden +4) |

---

### 3.3 Phase 5.2 — Migration script (SQL + Prisma steps + rollback)

#### Phase 5.2 — adım 1: Reader cleanup (PR-A; kod-only, schema değişiklik yok)

Bu phase'de **kod değişiklikleri** schema'dan ÖNCE yapılmalı. Aksi halde DROP COLUMN sonrası readers `Cannot read property 'suggestedOffer' of undefined` patlatır.

Cleanup PR'ı:

```
src/lib/gemini.ts                                        — `suggestedOffer` field'ı tüm scorer prompt input'larından kaldır; package selector sonucundan resolve et
src/lib/agent-workers/dossier-summary.ts                 — "Offer" + "Price band" metric'leri "Recommended package" + "Price label" ile değiştir
src/lib/ai-core/sentinels.ts                             — `__EMBED_LEAD_PROFILE__` lead-context'inde `expectedPriceBand` line'ı, `suggestedOffer` reference'ları çıkar
src/components/app/leads/dossier/DossierSourceDrawer.tsx  — "Suggested offer" + "Expected price band" Field'ları kaldır
src/components/app/leads/dossier/source-registry.tsx     — registry entry'lerini RecommendedPackage'a yönlendir
src/components/app/leads/useLeadsQuery.ts                — type from `suggestedOffer: string` to `recommendedPackageName: string | null`
src/app/app/deals/types.ts                               — `selectedOffer: OfferValue | null` → `selectedPackageId: string | null` (DEAL TARAFI! bunu siler kaybedersin)
src/app/app/deals/page.tsx                               — `item.selectedOffer === "STARTER"` mantığı → ServicePackage.id ile karşılaştır
src/app/app/deals/deal-side-panel.tsx                    — radio "STARTER/GROWTH/SALES" → workspace ServicePackage[] dinamik
src/app/api/watchlist/[id]/route.ts                      — `selectedOffer` PATCH validator → `selectedPackageId` validator (workspace-scoped FK check)
src/app/api/watchlist/route.ts                           — `select` listesinden `suggestedOffer`+`expectedPriceBand` çıkar, `recommendedPackageId` join ekle
src/lib/watchlist-export.ts                              — CSV export "Selected Package" column → ServicePackage.name
src/app/api/leads/export/route.ts                        — aynı
src/app/api/leads/route.ts                               — list select dahil
src/app/api/leads/[id]/lookalikes/route.ts:93            — select listesinden çıkar
src/app/api/website-plan/[leadId]/route.ts:102           — input'dan çıkar
src/__tests__/api/leads.test.ts                          — fixture
src/__tests__/api/lookalikes.test.ts                     — fixture
src/app/app/leads/[id]/page.tsx:963-967, 252-255         — Tier badge'i kaldır (Round 2 §3.1 fix'iyle aynı yer; Agent 1/UI cluster)
```

**Effort:** 12 saat (15 dosya × ~45 dk + 2 saat smoke test).

#### Phase 5.2 — adım 2: `WatchlistItem.selectedOffer` data migration

**Open question (Bölüm 6'da tablo):** Üretim DB'de kaç satırın `selectedOffer NOT NULL` olduğu bilinmeli. Önce:

```sql
-- Sayım
SELECT
  COUNT(*) FILTER (WHERE selected_offer IS NOT NULL) AS rep_set_count,
  COUNT(*) AS total
FROM watchlist_items;

-- Workspace dağılımı
SELECT l.workspace_id, COUNT(*) AS count
FROM watchlist_items wi
JOIN leads l ON l.id = wi.lead_id
WHERE wi.selected_offer IS NOT NULL
GROUP BY l.workspace_id
ORDER BY count DESC;
```

Migration tablosu (workspace başına `STARTER`/`GROWTH`/`SALES` enum değerlerini eşleyebileceği `ServicePackage` row'una map):

```sql
-- Yeni column
ALTER TABLE watchlist_items
  ADD COLUMN selected_package_id TEXT;
-- FK soft (no enforced constraint; cascade-safe gibi sales_opportunities.recommended_package_id'de yapıldığı gibi):
-- (string, no FK)

-- Migration: workspace başına package eşleme
WITH wkmap AS (
  SELECT
    sp.workspace_id,
    LOWER(sp.name) AS name_lc,
    sp.id AS package_id
  FROM service_packages sp
)
UPDATE watchlist_items wi
SET selected_package_id = (
  SELECT package_id FROM wkmap
  JOIN leads l ON l.workspace_id = wkmap.workspace_id
  WHERE l.id = wi.lead_id
    AND CASE
      WHEN wi.selected_offer = 'STARTER' AND wkmap.name_lc LIKE '%base%' THEN TRUE
      WHEN wi.selected_offer = 'STARTER' AND wkmap.name_lc LIKE '%starter%' THEN TRUE
      WHEN wi.selected_offer = 'GROWTH'  AND wkmap.name_lc LIKE '%premium%' THEN TRUE
      WHEN wi.selected_offer = 'GROWTH'  AND wkmap.name_lc LIKE '%growth%' THEN TRUE
      WHEN wi.selected_offer = 'GROWTH'  AND wkmap.name_lc LIKE '%pro%' THEN TRUE
      WHEN wi.selected_offer = 'SALES'   AND wkmap.name_lc LIKE '%enterprise%' THEN TRUE
      WHEN wi.selected_offer = 'SALES'   AND wkmap.name_lc LIKE '%custom%' THEN TRUE
      ELSE FALSE
    END
  LIMIT 1
)
WHERE wi.selected_offer IS NOT NULL;

-- Workspace'in eşleşen paketi yoksa: NULL bırak (rep yeniden seçer)
-- Audit query: kaç tane mapping başarısız?
SELECT COUNT(*) FROM watchlist_items
WHERE selected_offer IS NOT NULL AND selected_package_id IS NULL;
```

#### Phase 5.2 — adım 3: Schema diff (Prisma)

```diff
- enum SuggestedOffer {
-   STARTER
-   GROWTH
-   SALES
- }

  model SalesOpportunity {
    ...
-   suggestedOffer           SuggestedOffer @default(STARTER) @map("suggested_offer")
-   expectedPriceBand        String?        @map("expected_price_band")
    ...
  }

  model WatchlistItem {
    ...
-   selectedOffer   SuggestedOffer? @map("selected_offer")
+   selectedPackageId String?       @map("selected_package_id")  // soft FK to ServicePackage
    ...
  }
```

#### Phase 5.2 — adım 4: Migration prosedürü (Prisma)

**LeadAC `db:push` kullanıyor, migration history yok** — `migrate dev` çalıştırmadık. İki seçenek:

**Seçenek A: `db:push` (mevcut akış, hızlı, riskli):**

```bash
# 1. Backup (her durumda)
pg_dump $DATABASE_URL > backup-pre-phase52-$(date +%s).sql

# 2. Reader cleanup PR'ını deploy et (PR-A, schema yok)
git checkout main && git pull && npm run build
# Vercel deploy

# 3. Data migration SQL'ini çalıştır
psql $DATABASE_URL -f prisma/migrations/manual/2026-05-06-watchlist-selected-package.sql

# 4. Schema diff'i uygula
git checkout phase-5.2-schema && git pull
npm run db:push   # Prisma direct apply, NO migration history
npm run db:generate

# 5. Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='sales_opportunities' AND column_name IN ('suggested_offer','expected_price_band');"
# beklenen: 0
```

**Rollback:** `pg_restore` gerekir (3-5 dakika down). `db:push` reverse migration üretmez.

**Seçenek B: `prisma migrate deploy` adoption (production-grade, önerilen):**

```bash
# 1. (Tek seferlik) baseline migration al
npx prisma migrate dev --create-only --name "baseline-2026-05-06"
# Bu migration mevcut prod schema'sıyla aynı; migrate_lock tablosu oluşur

# 2. Baseline'ı resolved işaretle (apply etmeden):
npx prisma migrate resolve --applied "baseline-2026-05-06"

# 3. Phase 5.2 migration'ı oluştur
npx prisma migrate dev --create-only --name "phase-5-2-drop-suggested-offer"
# .sql dosyasını manuel olarak data migration ile birleştir (BEGIN ... COMMIT içinde)

# 4. Production'da:
npx prisma migrate deploy
```

`migrate deploy` migration history'i `_prisma_migrations` tablosuna yazar; her migration'ın hash'i kontrol edilir; failed migration block sırada bekler. **Rollback:** `migrate resolve --rolled-back <name>` + reverse SQL (down migration'ı manuel).

**Karar (Bölüm 7 detaylı):** LeadAC için `prisma migrate deploy` benimsenmeli; Phase 5.2 bu adoption için doğru fırsat (zaten elde data migration var).

#### Phase 5.2 — adım 5: Tek migration SQL dosyası (önerilen şekil)

`prisma/migrations/20260506000000_phase_5_2_drop_suggested_offer/migration.sql`:

```sql
-- 1. New column on watchlist_items
ALTER TABLE watchlist_items
  ADD COLUMN selected_package_id TEXT;

-- 2. Data migration (workspace ServicePackage eşleme)
-- (yukarıdaki UPDATE bloğu)

-- 3. Drop suggested_offer + expected_price_band on sales_opportunities
ALTER TABLE sales_opportunities
  DROP COLUMN suggested_offer,
  DROP COLUMN expected_price_band;

-- 4. Drop selected_offer on watchlist_items
ALTER TABLE watchlist_items
  DROP COLUMN selected_offer;

-- 5. Drop enum (must be last; nothing references it)
DROP TYPE "SuggestedOffer";
```

**Rollback (manuel down):**

```sql
CREATE TYPE "SuggestedOffer" AS ENUM ('STARTER','GROWTH','SALES');
ALTER TABLE sales_opportunities
  ADD COLUMN suggested_offer "SuggestedOffer" NOT NULL DEFAULT 'STARTER',
  ADD COLUMN expected_price_band TEXT;
ALTER TABLE watchlist_items
  ADD COLUMN selected_offer "SuggestedOffer";

-- Veri kayıp; backup'tan restore:
\i backup-pre-phase52-XXXXX.sql
```

#### Effort: Phase 5.2

| Sub-task | Effort |
|---|---|
| Reader cleanup PR (15 dosya) | 12 saat |
| Watchlist data migration SQL + dry-run + verify queries | 4 saat |
| Schema diff + Prisma migration file | 2 saat |
| `prisma migrate` adoption (baseline + ilk gerçek migration) | 4 saat |
| Smoke test on staging clone | 3 saat |
| Production deploy + monitoring window | 2 saat |
| **Toplam** | **27 saat** |

---

### 3.4 Phase 7.4 — `BetaFeedback` schema (multi-tenant scope)

#### Schema diff

```prisma
// Beta tester feedback. Captured from "Bug bildir / Pitch düzelt" CTA on
// the lead detail page. Lets us close the loop on AI quality issues
// without requiring testers to copy-paste lead IDs into a spreadsheet
// (Round 2 raporu §1.1: 3 / 13 lead'de copy-paste hatası).
//
// Multi-tenant scope: workspaceId always derived via requireUser() at
// API layer; userId is the rep who clicked. Cross-tenant leak protection
// matches Lead/AgentRun/SalesOpportunity tables.
enum BetaFeedbackType {
  THUMBS_UP
  THUMBS_DOWN
  INCORRECT_DATA
  HALLUCINATION
  TONE_OFF
  PACKAGE_MISMATCH
  OTHER
}

enum BetaFeedbackTarget {
  KPI            // weakness/strength KPI
  OPENER         // personalized first message
  PACKAGE        // recommended package / tier
  PAIN_POINTS    // likely_pain_points
  IDENTITY_SEO   // meta_description / title display
  CONVERSION_FEATURES
  TECH_SIGNALS
  PRIMARY_TYPE   // raw snake_case display
  SCORE          // salesConfidence / opportunityScore
  WHOLE_LEAD     // catch-all
}

model BetaFeedback {
  id           String              @id @default(cuid())
  workspaceId  String              @map("workspace_id")
  leadId       String              @map("lead_id")          // auto-populated; copy-paste hatası eliminate
  userId       String              @map("user_id") @db.Uuid // rep who reported
  feedbackType BetaFeedbackType    @map("feedback_type")
  targetField  BetaFeedbackTarget  @map("target_field")
  // Free-text rep comment (max 4000 char; Twitter-thread length)
  comment      String?             @db.Text
  // Optional: reps may paste a "this is what it should have said" suggestion
  // for OPENER / PAIN_POINTS / WHY_GOOD_TARGET. Eventually feeds into
  // OPENER_SUCCESS memory seeding.
  suggestedFix String?             @map("suggested_fix") @db.Text
  // Snapshot of lead AI run state at the moment of feedback —
  // intelligenceVersion + most recent SalesOpportunity.opportunityScore.
  // Lets us correlate feedback to specific AI Core pipeline versions.
  contextSnapshot Json             @default("{}") @map("context_snapshot")
  // Triage workflow. Rep reports → PENDING. Eng reviews → ACKNOWLEDGED
  // → RESOLVED with optional note.
  status       String              @default("PENDING") // PENDING / ACKNOWLEDGED / RESOLVED / WONT_FIX
  triageNotes  String?             @db.Text @map("triage_notes")
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  workspace    Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  lead         Lead                @relation(fields: [leadId],      references: [id], onDelete: Cascade)
  user         User                @relation(fields: [userId],      references: [id], onDelete: Cascade)

  @@index([workspaceId, status])
  @@index([workspaceId, leadId])
  @@index([workspaceId, targetField])
  @@map("beta_feedback")
}
```

> **Multi-tenant scope (rule-compliance, `multi-tenant-scope.mdc` check):**
> - `workspaceId` **mandatory + indexed**.
> - `onDelete: Cascade` from `Workspace`.
> - API endpoint `POST /api/leads/[id]/feedback` MUST derive `workspaceId` from `requireUser()` (never trust body).
> - lead-scope check: `prisma.lead.findFirst({ where: { id: leadId, workspaceId } })` BEFORE create. Reject 404 if mismatch.
> - Reader path (admin viewer) MUST scope by `workspaceId` UNLESS user is a global "BETA_ADMIN" role (yeni; opsiyonel — bkz. open question).

#### API endpoint

```
POST /api/leads/[id]/feedback           — rep creates
GET  /api/leads/[id]/feedback           — rep sees own + workspace
PATCH /api/admin/beta-feedback/[id]     — admin only (workspace == "leadac-internal" check)
```

#### UI surfaces

```
src/app/app/leads/[id]/page.tsx         — "Bug bildir" CTA (header'da, "Re-analyze" yanında)
src/components/app/beta-feedback-modal.tsx — yeni; targetField select + comment textarea + suggestedFix textarea
```

`BetaFeedbackTarget` enum value'ları lead detail page'de hangi section'dan tetiklendiğine göre auto-set:
- KPI badge'in yanına küçük thumbs-down button → `targetField=KPI` pre-set
- Personalized message kart altına → `targetField=OPENER`
- Tier/Package badge → `targetField=PACKAGE`

#### Admin viewer (effort gerekiyor mu?)

**Minimum viable:** YOK; reps direkt feedback gönderir, eng `psql $DATABASE_URL -c "SELECT ... FROM beta_feedback WHERE created_at > now()-interval '7 days' ORDER BY created_at DESC"` çeker. Admin viewer **P2'ye ertelenebilir**.

**Eğer eklenmek istenirse (P2):**
- `/admin/beta-feedback` route, sadece `workspace.slug = "leadac-internal"` veya `WorkspaceMember.role = "OWNER"` + email allow-list ile gate'lenir.
- Filter: `targetField`, `feedbackType`, `status`, `workspaceId`.
- Effort: 8 saat.

#### Effort: Phase 7.4

| Sub-task | Effort |
|---|---|
| Schema diff (`BetaFeedback` + 2 enum) + `db:push` + `db:generate` | 2 saat |
| API routes: POST + GET + PATCH | 4 saat |
| Lead detail UI: "Bug bildir" CTA + modal + 3 contextual entry points | 6 saat |
| Snapshot capture (intelligenceVersion + opportunityScore) | 1 saat |
| Vitest: 4 senaryo (auth, scope, validation, contextSnapshot) | 3 saat |
| Admin viewer (opsiyonel, P2) | 8 saat |
| **Toplam (admin viewer hariç)** | **16 saat** |

---

### 3.5 Phase 7.3 — Single primary score migration

#### Mevcut durum analizi

`Lead.salesConfidence` field'ı zaten var (`schema.prisma:565`). `LEAD_INTELLIGENCE_BRIEF` worker (`lead-intelligence-brief.ts:464`) `computeSalesConfidence()` ile yazıyor. UI'da fallback path: `salesConfidence ?? opportunityScore ?? null` (page.tsx:1023). **Backend doğru**; UI hâlâ üç sayı gösteriyor.

#### Fix tasarımı (UI-only; schema değişikliği yok)

`src/app/app/leads/[id]/page.tsx`:

1. **Hero band:** `score = salesConfidence ?? opportunityScore`. (Mevcut, kalsın.)
2. **HeroPriorityStrip Tier badge silinecek** — Round 2 §3.1 fix (Agent 1/UI cluster). Bu Phase 7.3'ün doğal uzantısı.
3. **"Review sub-score 20/100" badge** (page.tsx:968-976) silinsin VEYA "Advanced metrics" disclosure'a taşınsın:

```tsx
// Mevcut (silinecek)
{ra != null && (
  <Badge variant="outline" title="...">Review sub-score {ra.leadScore}/100</Badge>
)}

// Yeni (disclosure içine)
<Disclosure>
  <DisclosureTrigger>Advanced metrics</DisclosureTrigger>
  <DisclosureContent>
    <Stat label="Sales Confidence" value={lead.salesConfidence} />
    <Stat label="Opportunity Score" value={opp?.opportunityScore} />
    <Stat label="Review sub-score" value={ra?.leadScore} />
    <Stat label="Audit checklist" value={...} />
    <Stat label="Confidence breakdown" value={brief.confidenceBreakdown} />
  </DisclosureContent>
</Disclosure>
```

#### Backfill: eski lead'ler için `LEAD_INTELLIGENCE_BRIEF` re-run

`salesConfidence IS NULL` olan tüm lead'ler için `LEAD_INTELLIGENCE_BRIEF` worker'ı tekrar enqueue:

```sql
SELECT l.id, l.workspace_id
FROM leads l
WHERE l.sales_confidence IS NULL
  AND l.crawl_status = 'CRAWLED'      -- audit verisi var
  AND l.archived_at IS NULL
  AND l.workspace_id IN (             -- aktif workspace'ler
    SELECT id FROM workspaces WHERE plan != 'FREE' OR cycle_reset_at > NOW() - INTERVAL '30 days'
  );
```

Per-workspace enqueue (admin script):

```ts
// scripts/backfill-sales-confidence.ts
import { addAgentRunJob } from "@/lib/queues";
// for each lead → addAgentRunJob({ type: "agent_run", runId: createdRunId })
```

#### Effort: Phase 7.3

| Sub-task | Effort |
|---|---|
| HeroBand "Review sub-score" badge silme + Advanced metrics disclosure | 4 saat |
| Backfill script (`scripts/backfill-sales-confidence.ts`) | 3 saat |
| Smoke test on staging | 1 saat |
| **Toplam** | **8 saat** |

---

## 4. Effort + Risk

### 4.1 Effort özet

| Iş Paketi | Effort | Risk | Cluster |
|---|---|---|---|
| §3.6 Quota error message + blockReason | 10 saat | Low (test'le geri çevrilebilir) | Infra (bu cluster) |
| Round 1 #7 API key rotation + per-lead hourly + re-embed cron | 16 saat | Medium (Gemini outage simülasyonu staging'de zor) | Infra (bu cluster) |
| Phase 5.2 SuggestedOffer DROP migration | 27 saat | **HIGH** (data migration; rollback `pg_restore` gerektirir) | Infra+Schema (bu cluster) |
| Phase 7.4 BetaFeedback model + UI | 16 saat | Low | Schema (bu cluster) |
| Phase 7.3 Single score UI hide | 8 saat | Low | UI (Agent 1 cluster ile overlap) |
| **Toplam (bu cluster)** | **77 saat** | | |

### 4.2 Risk matrisi

| Risk | Olasılık | Etki | Mitigation |
|---|---|---|---|
| Phase 5.2 data migration rep'in `selectedOffer` seçimini kaybeder (workspace ServicePackage row'u yok ise) | Medium | High (rep frustration; pipeline kanban'da boş Selected Package badge) | Mapping başarısızsa sadece NULL'a düş, prod migration öncesi `SELECT COUNT WHERE selected_offer NOT NULL` raporu rep'lere göster + workspace'lerin minimum bir ServicePackage rolu var mı doğrula |
| Phase 5.2 cleanup PR'ı eksik kalır → DROP COLUMN sonrası app patlar | Low (CI testleri yakalar) | High (full app outage) | Pre-deploy: `rg -tts -tjs -ttsx 'suggestedOffer\|expectedPriceBand' src/` 0 sonuç dönmeli; CI guard ekle |
| §3.6 transaction snapshot Prisma `$transaction` ile RepeatableRead izolasyonu, pgBouncer transaction pooling ile uyumsuzluk | Medium (LeadAC'de pgBouncer var mı bilinmiyor) | Medium | `prisma.ts` driverAdapter check; eğer pgBouncer transaction-pool kullanılıyorsa session-level isolation set edilemez → fallback: 3 sequential count ama same `Date` cutoff'la |
| Round 1 #7 hourly cap çok agresif (PER_LEAD_HOURLY_CAP=8) → legitimate "re-analyze" akışı block | Low (50/24 = 2/saat ortalama, 8 burst headroom) | Medium | Cap'i 8 ile başlat, 30 günlük telemetri sonrası ayarla; UI'da rep'e remaining counter göster |
| Round 1 #7 re-embed backfill cron Gemini token quota'sını yer | Medium (her satır 1 embed call ≈ 0.0001 USD) | Low | Cron 5 dk'da 100 satır → günlük 28k call ≈ Gemini free tier 1500/day key başına; pool 8 key olmalı veya worker tier'da paid plan |
| Phase 7.4 `BetaFeedback.contextSnapshot` JSON büyür (toplu uses) | Low | Low | Field cap'i 32KB; `comment` + `suggestedFix` toplam 8KB max |

---

## 5. Dependencies

### 5.1 Cross-agent dependencies

| Bu cluster | Bağımlı/bağımlısı | Hangi agent | Açıklama |
|---|---|---|---|
| §3.6 quota fix | "Re-analyze" UI button "44/50000" mesajını okuyan toast | Agent 1/UI | Quota error mesaj formatı değiştiğinde UI da güncellenmeli |
| Round 1 #7 SUCCEEDED_NO_MEMORY badge | Lead detail UI | Agent 1/UI | Yeni "AI memory degraded" badge tasarımı |
| Phase 5.2 cleanup PR | UI Tier badge silme (§3.1) | Agent 1/UI | Aynı yer (page.tsx:963-967); birleşik PR |
| Phase 5.2 deal kanban "Selected package" radio | Deals UI | Agent 1/UI | Workspace ServicePackage[] dinamik liste |
| Phase 7.4 BetaFeedback | Lead detail "Bug bildir" CTA | Agent 1/UI | Yeni modal component |
| Phase 7.3 Advanced metrics disclosure | Lead detail UI | Agent 1/UI | Bu zaten UI-only |

### 5.2 Internal dependencies (sıralı yapılmalı)

1. **§3.6 quota fix** (10 saat) — bağımsız, ilk yapılabilir.
2. **Round 1 #7 retry budget** (16 saat) — quota fix'inden SONRA (per-lead hourly cap aynı `QuotaCheckResult` shape'ini kullanıyor).
3. **Phase 7.4 BetaFeedback** (16 saat) — bağımsız.
4. **Phase 7.3 single score** (8 saat) — bağımsız ama Agent 1/UI ile birleşik.
5. **Phase 5.2 SuggestedOffer DROP** (27 saat) — son. Reader cleanup PR önce, sonra schema diff. **Production migration prosedürü kararı (Bölüm 7) bu phase'den önce verilmeli.**

### 5.3 External dependencies

- **Gemini key pool genişletme:** Production env'de en az 4 `GEMINI_API_KEY_1..4` set edilmeli (Round 1 #7 fix'inin canlı etkisi için). Ops/DevOps task.
- **`pg_dump` backup hijyeni:** Phase 5.2 öncesi automatic snapshot — Supabase Postgres "Daily Backups" yeterli mi yoksa manual `pg_dump` mi kontrol edilmeli.
- **`prisma migrate deploy` adoption:** Bu doküman karar veriyor (Bölüm 7); ekibin onayı + CI pipeline güncellemesi (`vercel build` adımına `prisma migrate deploy` ekle).

---

## 6. Open Questions

### 6.1 `WatchlistItem.selectedOffer` count threshold tablosu

Bu rapor yazılırken count çıkarılmadı. Sayıma göre strateji:

| Count (`SELECT COUNT(*) FROM watchlist_items WHERE selected_offer IS NOT NULL`) | Önerilen strateji | Effort etkisi |
|---|---|---|
| **0** | Direkt DROP COLUMN, mapping query atla | -2 saat |
| **1-50** | Rep'lere e-posta: "Pipeline kanban'da paket seçimleriniz Phase 5.2 sonrası ServicePackage'a migrate edilecek. Workspace'inizde Premium/Enterprise paket tanımlı mı kontrol edin." Sonra otomatik mapping. | baseline |
| **51-500** | Mapping SQL + workspace başına `ServicePackage.findFirst({ name LIKE '%premium%' })` fallback; başarısızlık durumunda STARTER → ServicePackage[0]. | +2 saat |
| **501-5000** | Manuel mapping audit ekle: workspace owner'a in-app modal "26 watchlist item'ınızda eski tier seçimi var; aşağıdaki mapping'i onaylayın". | +8 saat |
| **>5000** | Migration deferred; `selectedOffer` field'ı `selectedPackageId` ile yan-yana yaşatılır 90 gün; sonra DROP. | +16 saat |

**Action item:** Bu rapor mergelenmeden önce `psql` ile sayım çıkarılsın; tablo'dan strateji seçilsin.

### 6.2 Production migration prosedürü kararı

→ Bölüm 7'de detaylı.

### 6.3 BetaFeedback admin viewer scope

LeadAC kendi workspace'i (`leadac-internal` slug?) feedback'i tüm beta workspace'lerden okuyabilmeli mi yoksa per-workspace mı?

- **Per-workspace (önerilen, multi-tenant safe):** Her workspace owner kendi feedback'lerini görür. LeadAC eng'i `psql` ile manuel çeker. Multi-tenant scope rule'una uyar.
- **Cross-workspace admin (multi-tenant ihlali):** `WorkspaceMember.role` enum'una `BETA_ADMIN` ekle; bu role API'de `requireUser()` dışında ek check ister. Önerilmez.

**Karar önerisi:** Per-workspace + eng manual SQL.

### 6.4 `PER_LEAD_HOURLY_CAP` value

Önerilen 8/saat — telemetri yokken keskin değer mi 12 mi? Round 2 raporundaki One Shot Coffee'nin 7 saatte 15 retry'ı = 2.1/saat ortalama. 8 cap legitimate "re-analyze + dossier + opener" akışını desteklemeli.

**Action item:** İlk hafta 12, telemetri sonrası 8'e düşür.

### 6.5 `SUCCEEDED_NO_MEMORY` ile `errorMsg` alanı

Mevcut: `errorMsg = "embedding_unavailable_degraded"` SUCCEEDED_NO_MEMORY status'ünde set ediliyor (`execute.ts:282-292`). `errorMsg` "FAILED" semantiği taşıyor; UI bunu yanlışlıkla error gösterebilir.

**Action item:** SUCCEEDED_NO_MEMORY'de `errorMsg=null`, ayrı `degradedReason` field'ı eklenebilir. Schema değişikliği (`AgentRun.degradedReason String?`) — Phase 7.4 ile birleşik PR olarak.

---

## 7. Production Migration Procedure (db:push vs migrate deploy karar dokümanı)

### 7.1 Mevcut durum

LeadAC `prisma db push` kullanıyor. `prisma-db.mdc` rule'unda explicit:
> "Schema editing flow: 1. Edit `prisma/schema.prisma`. 2. `npm run db:push` (no migration history in this project — using `db push` for now). Use `db:migrate` only when explicitly told to switch to migrations."

`prisma/migrations/apply.ts` script'i var ama `prisma migrate dev/deploy` history kullanılmıyor.

### 7.2 Trade-off analizi

| Boyut | `db:push` | `migrate deploy` |
|---|---|---|
| **Hız** | İlk gün hızlı; tek komut | Migration file edit + commit + deploy gerekir |
| **History** | Yok; "ne zaman, kim, ne değiştirdi" geri çevrilemez | `_prisma_migrations` tablosu + git history |
| **Rollback** | `pg_restore` only (3-5 dk down) | Reverse SQL + `migrate resolve --rolled-back` (saniyeler) |
| **CI/CD safety** | Drift detection yok; staging vs prod schema kayabilir | `migrate diff` + `migrate status` doğrular |
| **Branching** | Multiple PR'da schema çakışırsa son push kazanır (sessiz veri kaybı) | Migration file çakışması git merge conflict olarak görünür |
| **Data migration** | Manuel SQL `apply.ts` ile + ad-hoc | `migration.sql` içine BEGIN ... COMMIT + Prisma client schema sync |
| **Teaching curve** | Düşük | Orta |
| **LeadAC-specific** | Phase 5.2 gibi data migration için riskli (rollback yok) | Phase 5.2 tam fit |

### 7.3 Karar: `prisma migrate deploy` adoption (Phase 5.2 ile başla)

**Gerekçe:**
1. Phase 5.2 zaten data migration içeriyor → `migrate deploy` doğal fit.
2. LeadAC artık beta'dan üretime geçti (Round 2 tester real customer); `db:push` ile drift riski kabul edilemez.
3. Multi-tenant SaaS — herhangi bir hatalı schema push'ı 12+ FineDine Beta workspace'in datasını riske atar.
4. Rollback mekanizması yok-> production'da PROD outage = 3-5 dakika `pg_restore`. `migrate deploy` ile reverse migration saniyeler.
5. Stripe webhook + Apify webhook idempotency tabloları (`StripeEventLog`, `ApifyRun`) zaten history-aware; schema migration history paralel mantıkta.

### 7.4 Adoption adımları

```bash
# 1. Baseline mevcut prod schema'sını al
git checkout main
git pull
npx prisma migrate dev --create-only --name "baseline-2026-05-06"
# Bu dosyayı CIM (manuel) düzenle: var olan prod tabloları SQL olarak yaz.
# VEYA: prisma db pull → schema → migrate diff → SQL üret.

# 2. _prisma_migrations tablosunu prod'da kur (ilk seferlik)
psql $DATABASE_URL_PROD -c "CREATE TABLE IF NOT EXISTS _prisma_migrations (...)"
# Prisma migrate kendi otomatik kurar; ilk `migrate deploy` çağrısı.

# 3. Baseline'ı applied olarak işaretle (re-execute etme)
npx prisma migrate resolve --applied "baseline-2026-05-06"

# 4. Prisma migrate'a geç:
#    Dev: npx prisma migrate dev --name "<change>" → SQL preview + apply on dev DB
#    Prod (Vercel build hook):
#      npx prisma migrate deploy
#      npx prisma generate

# 5. CI guard: package.json'a "predeploy": "prisma migrate status" ekle
#    Failed/pending migration varsa Vercel deploy abort.

# 6. db:push'ı staging-only'a kısıtla
#    Production deploy hook'unda db:push çağrılmadığını doğrula.
```

### 7.5 `package.json` script güncellemeleri

```json
{
  "scripts": {
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate-deploy": "prisma migrate deploy",
    "db:migrate-status": "prisma migrate status",
    "db:migrate-create": "prisma migrate dev --create-only",
    "vercel-build": "prisma migrate deploy && prisma generate && next build"
  }
}
```

### 7.6 Geri uyumluluk

- Mevcut `prisma/migrations/add_pgvector_extension.sql`, `add_ai_core.sql`, vs. dosyaları `prisma/migrations/manual/` altına taşı; bunları `migrate deploy` baseline'a entegre etme; `prisma/migrations/apply.ts` script'i ile çalıştırma akışı korunur.
- pgvector extension migration (idempotent `CREATE EXTENSION IF NOT EXISTS vector`) ilk Prisma migration dosyasının başına eklenebilir.

---

## 8. Security Findings

Bu cluster için kod incelemesinde **multi-tenant scope ihlali tespit edilmedi**.

### 8.1 Kontrol edilen yollar

| Yol | Sonuç |
|---|---|
| `quota.ts` `prisma.agentRun.count` ve `aggregate` çağrıları | ✅ Hepsinde `workspaceId` predicate'i mevcut |
| `quota.ts:454-466` `assertWorkerQuota`'nın per-lead cap re-query'si | ✅ `workspaceId` + `leadId` her ikisi predicate'te |
| `execute.ts:69-80` `prisma.agentRun.findUnique({ where: { id: runId } })` | ⚠️ **Borderline** — `runId` cuid; çakışma riski yok ama `workspaceId` predicate'i yok. `hydrateContext`'te `lead = findFirst({ where: { id, workspaceId } })` ile **dolaylı korunmuş** (run.workspaceId güvenilir kaynak çünkü DB'den okundu). H6 fix yorumu (execute.ts:623-635) bu mantığı netleştiriyor. ✅ |
| `execute.ts:599-621` `workspace = findUniqueOrThrow({ where: { id: run.workspaceId } })` | ✅ Workspace tablosu için `id` zaten primary key; workspace_id-by-itself trusted (run.workspaceId DB'den okundu) |
| `execute.ts:282-294` `prisma.agentRun.update({ where: { id: runId } })` SUCCEEDED transition | ⚠️ `id` primary key; `updateMany({ workspaceId })` daha defensive olur ama practical risk yok |
| `embed.ts` Gemini call workspace context taşımıyor — sadece text + key | ✅ Multi-tenant relevant değil (workspace-agnostic external call) |
| `BetaFeedback` planlanan model | ✅ Tasarım gereği `workspaceId` mandatory + indexed + cascade |

### 8.2 Öneri: defansif `updateMany` pattern (P2)

`execute.ts`'in 5 yerde (`agentRun.update({ where: { id } })`) `updateMany({ where: { id, workspaceId } })`'e geçirilmesi multi-tenant audit checklist'ine tam uyum sağlar. Practical risk düşük (run row DB'den okundu, `runId` cuid, çakışma astronomik) ama code review noise'ı azaltır.

**Effort:** 2 saat. **P2 kategorisinde** — bu cluster'ın acil P0/P1 işlerinin önüne almıyorum.

---

## Ek A — Referans Tablo (her bug → fix → effort özet)

| Bug | Kök neden (file:line) | Fix tasarımı | Effort | Risk |
|---|---|---|---|---|
| §3.6-A "44/50000" yanıltıcı | `quota.ts:474` `QuotaCheckResult.used/limit` worker monthly'i taşıyor; per-lead cap için ayrılmamış | `QuotaBlockReason` enum + 4 ayrı counter + switch'te doğru error | 4 saat | Low |
| §3.6-B race | `quota.ts:377-389` ve `442-474` iki ayrı sorgu | Tek `$transaction` snapshot (`isolationLevel: RepeatableRead`) | 3 saat | Medium (pgBouncer uyumsuzluğu) |
| §3.6-C status filter | `quota.ts:383` per-lead cap `SUCCEEDED_NO_MEMORY` saymıyor | Status listesine `SUCCEEDED_NO_MEMORY` ekle | 30 dk | Low |
| Round1#7-A embed crash | `embed.ts:131` `Failed to embed after 3 attempts` | Adaptive cooldown + pool size 4+ + re-embed cron | 8 saat | Medium |
| Round1#7-B Gemini 403 | `gemini-keys.ts:99` 5 dk fixed cooldown | Exponential backoff cooldown (5→30→360 dk); pool degenerate alert | 4 saat | Low |
| Round1#7-C re-embed backfill yok | yok (`agent-runs` queue'da `embed` discriminator unused) | `rebuild_memory_embedding` job + cron | 5 saat | Low |
| Round1#7-D retry budget | `quota.ts` saatlik cap yok | `PER_LEAD_HOURLY_CAP=8` + 5. blockReason | 2 saat | Low |
| Phase 5.2 cleanup | 15 reader dosyası | Reader cleanup PR | 12 saat | Medium (CI gap potential) |
| Phase 5.2 watchlist data | 1+ rep'in `selectedOffer` set'i | SQL mapping → `selectedPackageId` | 4 saat | **High (data risk)** |
| Phase 5.2 schema diff | `schema.prisma:36-40, 952, 954, 979` | Migration SQL + DROP enum | 2 saat | Low (cleanup'tan sonra) |
| Phase 5.2 migrate adoption | `package.json` + `vercel-build` | `prisma migrate deploy` setup | 4 saat | Low |
| Phase 7.4 BetaFeedback | yeni model | Schema + 3 endpoint + 1 modal | 16 saat | Low |
| Phase 7.3 single score | `page.tsx:968-976` | Advanced metrics disclosure | 4 saat | Low |
| Phase 7.3 backfill | `salesConfidence IS NULL` lead'ler | Backfill script | 4 saat | Low |

---

**Rapor sonu** — `research/finedine/round2-plans/agent-4-infra-schema.md` olarak yazıldı. Source code değiştirilmedi. Multi-tenant scope ihlali tespit edilmedi (Bölüm 8.1). Phase 5.2 production deploy'u öncesi `WatchlistItem.selectedOffer` count'u çıkarılmalı (Bölüm 6.1) ve `prisma migrate deploy` adoption'u onaylanmalı (Bölüm 7.3).
