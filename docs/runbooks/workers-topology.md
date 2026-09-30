# Worker ve kuyruk topolojisi

Son güncelleme: 30 Eylül 2026 (admin paneli son planı, Task 2).

`npm run workers` (`src/workers/index.ts`) tek süreçte aşağıdaki worker'ları açar. Kuyruk tanımları `src/lib/queues.ts` içindedir. Yeni BullMQ kuyruğu açılmaz; AI işi `agent-runs` üzerindedir.

## Açılan kuyruklar

| Kuyruk | Worker dosyası | Kim besliyor | Not |
|---|---|---|---|
| `discovery` | `discovery-worker.ts` | `POST /api/discovery` | Google Places taraması. Bitince `lead_created` yayınlar, AI Core zinciri başlar. |
| `agent-runs` | `agent-run-worker.ts` | Orkestratör (`orchestrator_advance`), `tryEnqueue` (lead worker rotası, kontrol odası rerun/eval, kalibrasyon, `/api/reviews/[leadId]/analyze`), toplu işlem, `memory.ts` (embed), gmaps yeniden denetim, `sequence_tick` cron'u (60 sn), stuck-status reset cron'u (5 dk) | Varsayılan lead zinciri burada koşar: `apify_gmaps` → `review_refresh`, `audit`, hepsi → `intelligence_brief`. |
| `seo-ops` | `seo-ops-worker.ts` | Worker kendi zamanlayıcılarını kurar (GSC saatlik, kırık link haftalık, altın fiyatı 5 dk) | Pazarlama sitesi ve kuyumcu mockup'ları için. Lead hattıyla ilgisi yok. |

## Açılmayan kuyruklar

Dosyalar diskte durur, enum değerleri silinmez. Acil geri dönüş için import satırı geri açılır.

| Kuyruk | Worker dosyası | Neden kapalı | Hâlâ besleyen var mı |
|---|---|---|---|
| `crawl` | `crawl-worker.ts` | `WEBSITE_AUDITOR` ile aynı `WebsiteAudit` satırında yarışıyordu (Phase 0/B4). | Hayır. `/api/crawl` AI Core'a yönlenir. |
| `analyze` | `analyze-worker.ts` | `SalesOpportunity` üzerinde ikinci skor üretiyordu (Phase 0/B4). | Hayır. `/api/analyze` AI Core'a yönlenir. |
| `review-analysis` | `review-analysis-worker.ts` | `REVIEW_ANALYST` ile aynı `ReviewAnalysis` satırına yazıyordu; 30 yorum eşiği yoktu. (Task 2) | Hayır. `/api/reviews/[leadId]/analyze` artık `REVIEW_ANALYST` AgentRun'ı açar. `src/lib/review-analysis/try-enqueue.ts` ve `run-job.ts` kullanılmıyor. |
| `email-verification` | `email-verification-worker.ts` | Tek besleyeni `crawl-worker` idi. (Task 2) | Hayır. E-posta doğrulama `EMAIL_VERIFIER` worker'ı olarak tıklamayla çalışır. |
| `inbox-sync` | yok | Kuyruk tanımı var, worker hiç yazılmadı. | Hayır. `/api/sequences/inbox-sync` senkronu satır içinde çalıştırır. |

`src/lib/pipeline-cancel-workspace.ts` kapalı kuyrukları da boşaltır; eski işler kalmışsa temizlenir.

## Varsayılan lead zinciri (Task 1)

| Adım | Worker | Bağımlılık | Atlama |
|---|---|---|---|
| `apify_gmaps` | `APIFY_GMAPS_DEEP` | yok | Apify yok / kota 402-403 → `{ skipped: "apify_quota", statusCode }`, koşu `SUCCEEDED` |
| `audit` | `WEBSITE_AUDITOR` | yok | Site yok / ulaşılamadı |
| `review_refresh` | `REVIEW_ANALYST` | `apify_gmaps` | Korpus < 30 yorum → `{ skipped: "thin_corpus", count }`, Gemini çağrılmaz |
| `intelligence_brief` | `LEAD_INTELLIGENCE_BRIEF` | üçü | — |

Apify çağrıları süreç içinde en fazla 2 eşzamanlı koşar (`withApifySlot`, `src/lib/apify.ts`).
