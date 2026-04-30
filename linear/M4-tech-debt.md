# M4 — Tech Debt & Operations

> **Status:** Continuous (no end date)
> **Hedef:** Coverage, hygiene, billing/worker hardening. M0-M3 paralelinde sürekli akan iş.
> **Exit kriteri:** AI Core unit coverage ≥%80, overall ≥%60, schema migration history aktif, hiçbir worker stuck job'da takılmıyor.

---

## Epic 4.1 — Test Infrastructure

### [M4-01] Coverage threshold + CI gate
**Type:** test
**Area:** test
**Priority:** High
**Effort:** S
**Owner:** @mert
**Depends on:** [M0-15]

**Description:**
M0-15 ile coverage measure açıldı. Şimdi threshold belirle ve CI'da fail kapısı yap.

**Acceptance Criteria:**
- [ ] `vitest.config.mts`'de threshold: AI Core %70, overall %50 (başlangıç)
- [ ] CI'da `npm run test:coverage` fail eder threshold altıysa
- [ ] Quarterly threshold artırma planı (her 3 ayda %5)
- [ ] Coverage badge README'de

**Technical Notes:**
- GitHub Actions: workflow YAML
- Tool: `@vitest/coverage-v8`

---

### [M4-02] Orchestrator transactional advance test (TODO'yu çöz)
**Type:** test
**Area:** test
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
`src/__tests__/integration/orchestrator.integration.test.ts` içinde "transactional advance" TODO var. Bu race condition guard'ı (advance lock) test'i — kritik ama yazılmamış.

**Acceptance Criteria:**
- [ ] Test yazıldı
- [ ] 2 paralel advance call → sadece 1'i SUCCESS, diğeri SKIPPED
- [ ] Lock release timing doğru
- [ ] TODO yorumu silindi

---

### [M4-03] API route test coverage expansion
**Type:** test
**Area:** test
**Priority:** Medium
**Effort:** L
**Owner:** @mert

**Description:**
71 API route var. Mevcut test ~10-15 route'u kapsıyor (tahminen). Critical path (lead CRUD, billing webhook, discovery, agent-runs) ≥%70 coverage.

**Acceptance Criteria:**
- [ ] Lead routes: GET/POST/PATCH/DELETE + bulk-action
- [ ] Discovery routes
- [ ] Billing webhook (idempotency, signature)
- [ ] Agent-runs routes
- [ ] Multi-tenant scope assertions her testte

**Technical Notes:**
- Skill: `multi-tenant-scope-audit` her route için

---

### [M4-04] Multi-tenant scope audit (workspace leak test)
**Type:** test
**Area:** test
**Priority:** Urgent
**Effort:** L
**Owner:** @mert

**Description:**
Skill: `multi-tenant-scope-audit`. Her API route ve her Prisma query için workspace scope doğru mu? Otomatik test framework yaz: cross-tenant request → 404, asla data dönmemeli.

**Acceptance Criteria:**
- [ ] `src/__tests__/multi-tenant/` test suite
- [ ] Her workspace-scoped tablo için cross-tenant test
- [ ] Test: workspace A user, workspace B lead ID → 404
- [ ] CI'da fail eder herhangi bir leak bulursa
- [ ] Audit report yazıldı

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\multi-tenant-scope-audit\SKILL.md`
- AGENTS.md non-negotiable #1

---

## Epic 4.2 — Operational Hygiene

### [M4-05] db:push → db:migrate strategy
**Type:** ops
**Area:** ops
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Şu an `npm run db:push` (no migration history). Production deploy'da risk: drift, data loss potential. `prisma migrate dev` + `prisma migrate deploy` stratejisine geç.

**Acceptance Criteria:**
- [ ] Mevcut prod schema'dan baseline migration yaratıldı
- [ ] CI'da `prisma migrate deploy` adımı
- [ ] Dev'de `prisma migrate dev` (ama acil schema değişikliklerinde push hala kullanılabilir)
- [ ] Migration documentation yazıldı (rollback, conflict resolution)
- [ ] Architecture rule güncellendi

**Technical Notes:**
- Risk: ilk migration baseline yanlışsa prod data kaybı. Test environment'ta dene önce.

---

### [M4-06] ESLint sweep + cleanup
**Type:** refactor
**Area:** engineering
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
`npm run lint` çıktısı temiz mi? Unused import, no-any violation, accessibility issue var mı? Sweep yap.

**Acceptance Criteria:**
- [ ] `npm run lint` 0 error
- [ ] Warning sayısı baseline → tracker
- [ ] CI'da lint fail eder
- [ ] Top 10 warning kategorisi için fix plan

---

### [M4-07] Console.log audit
**Type:** refactor
**Area:** engineering
**Priority:** Low
**Effort:** S
**Owner:** @mert

**Description:**
Production'da console.log = log noise. Yapılandırılmış logger'a geç (pino/winston) veya sil.

**Acceptance Criteria:**
- [ ] `rg "console\.(log|debug|info)" src/` çıktısı review
- [ ] Boot banner gibi kasıtlılar etiketlendi
- [ ] Diğerleri silindi veya `logger.info()`'ya çevrildi
- [ ] ESLint rule: `no-console` (allow: ['warn', 'error'])

---

### [M4-08] TODO/FIXME triage
**Type:** ops
**Area:** ops
**Priority:** Low
**Effort:** S
**Owner:** @mert

**Description:**
Repo'daki TODO/FIXME yorumları gözden geçir, her birini Linear issue'ya çevir veya sil.

**Acceptance Criteria:**
- [ ] `rg "TODO|FIXME" src/` listesi
- [ ] Her TODO için karar: fix / Linear issue / silinebilir
- [ ] Action items Linear'da

---

### [M4-09] Untracked Prisma generated decision rollout
**Type:** ops
**Area:** ops
**Priority:** High
**Effort:** S
**Owner:** @mert
**Depends on:** [M0-01]

**Description:**
M0-01'de karar verildi (önerilen: gitignore). Tüm developer makinaları + CI'da bu karar uygulansın.

**Acceptance Criteria:**
- [ ] Ekip onboarding doc güncellendi
- [ ] CI postinstall + `prisma generate` çalışıyor
- [ ] Hiçbir PR'da generated dosya commit edilmiyor (precommit hook?)

---

## Epic 4.3 — Stripe Hardening

### [M4-10] Failed payment dunning
**Type:** feature
**Area:** billing
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Skill: `churn-prevention`. Stripe `invoice.payment_failed` webhook → retry schedule + dunning email + grace period (3 gün) + downgrade.

**Acceptance Criteria:**
- [ ] Webhook handler `invoice.payment_failed`
- [ ] Retry schedule (Stripe Smart Retries)
- [ ] Dunning email sequence (Day 1, 3, 7)
- [ ] Grace period: 3 gün read-only access
- [ ] Auto-downgrade to FREE on failure
- [ ] Reactivation flow

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\churn-prevention\SKILL.md`
- Skill: `c:\Users\meert\.cursor\skills\stripe-billing-audit\SKILL.md`
- Webhook: `src/app/api/billing/webhook/route.ts`

---

### [M4-11] Plan downgrade flow
**Type:** feature
**Area:** billing
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
PRO → FREE veya AGENCY → PRO. Quota implications: existing leads silinmemeli, ama yeni discovery cap'lansın.

**Acceptance Criteria:**
- [ ] Customer portal: downgrade button
- [ ] Confirmation flow: "Bu pakette X kaybedeceksiniz"
- [ ] End of billing period sonra effective
- [ ] Existing data preserve (read-only erişim)
- [ ] Reactivation flow
- [ ] Skill: `churn-prevention` save offer

---

### [M4-12] Refund / dispute handling
**Type:** feature
**Area:** billing
**Priority:** Low
**Effort:** M
**Owner:** @mert

**Description:**
Stripe dispute webhook → admin notification. Refund manual approve flow.

**Acceptance Criteria:**
- [ ] `charge.dispute.created` webhook
- [ ] Admin Slack/email notification
- [ ] Audit log: who approved refund

---

### [M4-13] Stripe webhook stress test
**Type:** test
**Area:** test
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Stripe webhook idempotency. Aynı event 2x gelse veya out-of-order gelse?

**Acceptance Criteria:**
- [ ] Stripe CLI ile event replay
- [ ] Test: `StripeEventLog` dedup çalışıyor
- [ ] Test: out-of-order checkout.session.completed + customer.subscription.created → doğru order'da apply
- [ ] Skill: `stripe-billing-audit` checklist

---

## Epic 4.4 — BullMQ Hardening

### [M4-14] Dead-letter queue for failed jobs
**Type:** feature
**Area:** workers
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Worker N kez retry sonra fail → DLQ'ya yaz. Admin manuel inceleyebilsin.

**Acceptance Criteria:**
- [ ] DLQ queue: `agent-runs-dlq`
- [ ] Permanent fail handler: DLQ'ya push
- [ ] Admin dashboard: DLQ list + retry button
- [ ] Slack alert N>10 in 1hr

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\worker-queue-debug\SKILL.md`

---

### [M4-15] Stuck job recovery harden
**Type:** feature
**Area:** workers
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Mevcut: `recover-stuck-sessions` route + cron. Daha sağlam yap: stale job detection (>10dk processing without progress), automatic recovery, audit log.

**Acceptance Criteria:**
- [ ] Stuck job detection cron (her 5 dk)
- [ ] Recovery: re-enqueue with backoff
- [ ] Audit log
- [ ] Alerting threshold

**Technical Notes:**
- Mevcut: `src/app/api/recover-stuck-sessions/route.ts`

---

### [M4-16] Concurrency vs Apify quota tuning
**Type:** ops
**Area:** workers
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
BullMQ worker concurrency ile Apify rate limit dengesi. Şu an config nasıl? 429 alıyor muyuz?

**Acceptance Criteria:**
- [ ] Apify rate limit dökümante
- [ ] Worker concurrency = Apify limit / safety_factor
- [ ] 429 detect → exponential backoff
- [ ] Monitoring dashboard

---

### [M4-17] Redis observability
**Type:** ops
**Area:** workers
**Priority:** Low
**Effort:** M
**Owner:** @mert

**Description:**
Redis memory, queue depth, latency metrics. Admin dashboard.

**Acceptance Criteria:**
- [ ] BullMQ Bull Board veya custom dashboard
- [ ] Memory usage chart
- [ ] Queue depth per queue
- [ ] Latency p50/p95/p99

---

## Epic 4.5 — Quota & Limits Sanity

### [M4-18] Quota matrix audit (LAUNCH_POLICY=true after launch?)
**Type:** ops
**Area:** ai-core
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
Şu an `LAUNCH_POLICY = true` (gevşek matrix). Public launch sonrası daha sıkıştırılmalı mı? Cost vs activation balance.

**Acceptance Criteria:**
- [ ] Cost analysis: launch policy ile aylık Gemini/Apify cost
- [ ] Karar: tighten / loosen / aynı kalsın
- [ ] Quota matrix dokümante
- [ ] Plan limits table güncelle (`src/lib/plans.ts`)

**Technical Notes:**
- Dosya: `src/lib/agent-workers/quota.ts`

---

### [M4-19] Per-lead daily cap doğrula
**Type:** test
**Area:** test
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
Recent commit `feat(p3): idempotency key, retry classification, per-lead daily cap` — bu cap çalışıyor mu? Test yazılı mı?

**Acceptance Criteria:**
- [ ] Test: aynı lead için 24hr içinde N+1. worker run → reject
- [ ] Cap configurable per worker kind
- [ ] Reset her UTC midnight

---

## M4 Çıkış Kontrol Listesi (rolling)

- [ ] AI Core unit coverage ≥%80
- [ ] Overall coverage ≥%60
- [ ] Schema migration history aktif (`prisma migrate`)
- [ ] ESLint 0 error, warning trend düşüş
- [ ] Failed payment dunning canlı
- [ ] DLQ ve stuck job recovery sağlam
- [ ] Multi-tenant audit %100 pass
- [ ] Stripe webhook stress test pass

**Toplam M4 issue sayısı: 19 (continuous)**
