# M2 — Sub-Vertical Architecture (FineDine 500-team Prerequisite)

> **Status:** Backlog
> **Süre:** 4 hafta
> **Hedef:** 11 niche pack + sub-vertical classifier + dual-write memory + manual override + stale-version guard. FineDine 500-kişilik satış ekibi sisteme girmeden önceki ana mimari katman.
> **Exit kriteri:** Reply rate baseline 4% → 9%+ (FineDine v0.9 → v2 atlama). Override rate < 12%, classifier accuracy > 88%.
> **Reference:** `research/finedine/day-in-the-life.md` (full vision), `research/finedine/beta-test-plan.md` (validation plan)

---

## Epic 2.1 — Niche Packs Infrastructure

### [M2-01] SubNicheSlug Prisma enum (string → type-safe)
**Type:** refactor
**Area:** ai-core
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Şu an `Lead.subNicheSlug` muhtemelen string. Compile-time safety için Prisma enum'a çevir. 11 parent + 50+ child slug.

**Acceptance Criteria:**
- [ ] `enum SubNicheSlug { fnb, fnb_fine_dining, fnb_bar_club, ... }`
- [ ] `Lead`, `SemanticMemory`, `AgentRun` migration
- [ ] Generated client'ta enum export ediliyor
- [ ] Backwards compat: existing string'ler enum'a map ediliyor (data migration script)

**Technical Notes:**
- `prisma/schema.prisma` — yeni enum
- Migration risk: existing data — mapping script gerekli
- `src/lib/niches/index.ts` — slug listesi

---

### [M2-02] 10 F&B child niche pack tanımı
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
`fnb-fine-dining`, `fnb-bar-club`, `fnb-hotel-fnb`, `fnb-cafe-bakery`, `fnb-qsr`, `fnb-multi-location`, `fnb-ghost-kitchen`, `fnb-food-truck`, `fnb-casual-dining`, `fnb-airport-fnb`. Her pack:
- searchQueries (Google Places)
- ruleBasedClassifier patterns
- auditChecklist (sub-niche specific)
- openerPrompt (pitchAngle + signals)
- mockupTemplate (handcrafted vs generic)

**Acceptance Criteria:**
- [ ] 10 pack `src/lib/niches/fnb/*.ts` altında
- [ ] Her pack TypeScript shape'e uyuyor (`NichePack` type)
- [ ] Test: her pack'in classifier rule'ları unit test'le doğrulandı
- [ ] Localized<T> yapısı (M3-15 için hazır)

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\prompt-engineering-gemini\SKILL.md`
- Mevcut: `src/lib/niches/index.ts`

---

### [M2-03] Workspace.targetSubNiches UI binding
**Type:** feature
**Area:** frontend
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Settings → My Offer'da niche dropdown var. Altına 10-checkbox grid (parent F&B seçildiyse). Discovery picker bundan filtrelenir.

**Acceptance Criteria:**
- [ ] `offer-form.tsx`'e checkbox grid eklendi
- [ ] Save → `workspace.targetSubNiches` array kaydoluyor
- [ ] Discovery sayfası bu array'i okuyup picker'ı kısıtlıyor
- [ ] Validation: en az 1 child seçili olmalı (yoksa "All" varsayılan)

**Technical Notes:**
- Dosya: `src/components/app/offer-form.tsx`
- Dosya: `src/app/app/discovery/page.tsx`

---

## Epic 2.2 — Sub-Vertical Classifier

### [M2-04] Rule-based classifier (75% deterministic katman)
**Type:** feature
**Area:** ai-core
**Priority:** Urgent
**Effort:** L
**Owner:** @mert

**Description:**
`day-in-the-life.md`'deki Katman 1 — regex + Google Places type + priceLevel + name pattern. Hedef: %75 deterministic resolve. $0 cost.

**Acceptance Criteria:**
- [ ] `src/lib/agent-workers/vertical-subvertical-classifier.ts` worker
- [ ] Rule matrix testleri (50+ test case)
- [ ] Confidence > 0.85 → resolve, < 0.85 → Gemini fallback
- [ ] `metadata.classifierSource = 'rule'` yazılıyor

**Technical Notes:**
- Pattern examples: `name.match(/\b(bar|club|lounge)\b/i) → fnb-bar-club, conf 0.88`
- Risk: false positive → manual override flow (Epic 2.3) bunu kurtarıyor

---

### [M2-05] Gemini fallback classifier
**Type:** feature
**Area:** ai-core
**Priority:** Urgent
**Effort:** M
**Owner:** @mert
**Depends on:** [M2-04]

**Description:**
%25 ambiguous → Gemini structured output `{subNicheSlug, confidence, reasoning}`. Workspace.targetSubNiches scope'una sıkıştırılır (prompt'a inject edilir).

**Acceptance Criteria:**
- [ ] Gemini call structured output schema'lı
- [ ] Prompt scope'lu (sadece workspace target sub-niches'e seçim verir)
- [ ] `metadata.classifierSource = 'gemini'` yazılıyor
- [ ] Cost tracking (token kullanımı)
- [ ] Skill: `prompt-engineering-gemini`

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\prompt-engineering-gemini\SKILL.md`
- Helper: `src/lib/gemini-client.ts`
- Cost target: <$0.005 per lead

---

### [M2-06] Confidence gate (low conf → parent fallback)
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** S
**Owner:** @mert
**Depends on:** [M2-05]

**Description:**
`subNicheConfidence < 0.7` AND `subNicheSource = 'AUTO'` → opener writer parent F&B angle kullansın (sub-niche specific değil). Yanlış pitch atılmamalı.

**Acceptance Criteria:**
- [ ] Opener prompt builder'da confidence check
- [ ] Audit checklist'te de aynı gate (parent generic checks)
- [ ] Test: synthetic low-conf lead → generic opener çıkıyor
- [ ] Logging: `confidence_gate_triggered` event

**Technical Notes:**
- Dosya: `src/lib/agent-workers/opener-writer.ts` (varsa)
- P0.4 from `day-in-the-life.md`

---

## Epic 2.3 — Manual Override + Stale Guard (P0.3)

### [M2-07] PATCH /api/leads/[id]/sub-niche endpoint
**Type:** feature
**Area:** engineering
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Lead detail UI'dan sub-niche manual override. Endpoint:
- `Lead.subNicheSlug = newSlug`
- `Lead.subNicheSource = MANUAL`
- `Lead.subNicheConfidence = 1`
- `Lead.subNicheVersion += 1`
- Re-enqueue: WEBSITE_AUDITOR + OPENER_WRITER + WEBSITE_MOCKUP

**Acceptance Criteria:**
- [ ] Endpoint workspaceId scope'lu
- [ ] Version bump atomic (transaction)
- [ ] Re-enqueue işlemi `agent-runs` queue'ya
- [ ] Response: 200 + new version + queued runs list
- [ ] UI integration: lead detail "Override sub-niche" button

**Technical Notes:**
- Lead schema'ya `subNicheVersion` Int @default(0) eklendi mi? (M2-01 prerequisite)
- AgentRun.inputSubNicheVersion field gerekli (M2-08)

---

### [M2-08] Stale-version guard in execute.ts
**Type:** feature
**Area:** ai-core
**Priority:** Urgent
**Effort:** M
**Owner:** @mert
**Depends on:** [M2-07]

**Description:**
In-flight worker run sırasında manual override geldi → eski run kendi başına early-exit etmeli. Run başında `inputSubNicheVersion !== current Lead.subNicheVersion` kontrolü.

**Acceptance Criteria:**
- [ ] `executeAgentRun` başında version check
- [ ] Stale → `AgentRun.status = SUCCEEDED`, `outputJson.stale = true`, `outputJson.reason = 'subniche-version-mismatch'`
- [ ] DB write yapmıyor (audit yok, opener yok)
- [ ] Logging
- [ ] Integration test (race condition)

**Technical Notes:**
- Dosya: `src/lib/agent-workers/execute.ts`
- Test: `src/__tests__/agent-workers/stale-version.integration.test.ts`

---

### [M2-09] Re-pipeline downstream artifact invalidation
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** M
**Owner:** @mert
**Depends on:** [M2-07], [M2-08]

**Description:**
Override sonrası eski WebsiteAudit, opener content, mockup içeriği "stale" işaretle. Yeni run'lar geldiğinde overwrite edilsin, ama UI önceki version'u "outdated" badge'iyle göstermeli.

**Acceptance Criteria:**
- [ ] WebsiteAudit, AgentRun output'larında `staleAt: timestamp` field
- [ ] UI: stale artifact'ler "outdated" badge'iyle (60s spinner sonra refresh)
- [ ] Yeni run completion → badge kalkıyor

**Technical Notes:**
- Lead detail page UI update gerekli

---

## Epic 2.4 — Memory Dual-Write Semantics (P1.2)

### [M2-10] Positive signals → child + parent dual write
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
`OPENER_SUCCESS`, `LEAD_PROFILE` → hem `niche_scope = 'fnb-bar-club'` hem `niche_scope = 'fnb'`. Parent scope cross-pollination havuzu.

**Acceptance Criteria:**
- [ ] `memory.ts`'de `writeMemory({ scope: 'child', alsoParent: true })`
- [ ] DB'ye 2 satır INSERT (child + parent)
- [ ] Embedding aynı (tek Gemini call)
- [ ] Test: write → 2 row, both queryable

**Technical Notes:**
- Dosya: `src/lib/ai-core/memory.ts`
- AGENTS.md non-negotiable: SemanticMemory direct write FORBIDDEN — sadece `memory.ts` üzerinden

---

### [M2-11] Negative signals → child only
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** S
**Owner:** @mert
**Depends on:** [M2-10]

**Description:**
`OPENER_FAILURE`, `OPENER_BOUNCE` → sadece child scope. Parent'a yazma → bar'da işlemeyen pattern hotel few-shot'larına sızmasın.

**Acceptance Criteria:**
- [ ] `writeMemory({ scope: 'child', alsoParent: false })` default for negative
- [ ] Test: failure write → sadece 1 child row
- [ ] Test: parent scope query → bu failure görünmüyor

---

### [M2-12] Weighted union read (child 1.0, parent 0.5)
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** M
**Owner:** @mert
**Depends on:** [M2-10]

**Description:**
Few-shot retrieval: önce child scope'tan top-K (weight 1.0), eğer K dolmadıysa parent'tan top-(K-n) (weight 0.5). Dedup by embedding similarity > 0.95.

**Acceptance Criteria:**
- [ ] `getMemoryForFewShots(scope, k=3)` helper
- [ ] Cosine similarity dedup
- [ ] Logging: `memory_union_count`, `memory_child_hits`, `memory_parent_hits`
- [ ] Test: brand-new sub-niche lead → 0 child + N parent hits

**Technical Notes:**
- Dosya: `src/lib/ai-core/memory.ts`

---

## Epic 2.5 — Discovery Fan-Out (Faz 9)

### [M2-13] Parallel Google Places query per child niche
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** L
**Owner:** @mert
**Depends on:** [M2-02]

**Description:**
Discovery'de "All F&B" seçilirse 10 child query paralel atılır. Workspace.targetSubNiches subset'iyse o subset paralel atılır. Promise.all + dedup by Place ID.

**Acceptance Criteria:**
- [ ] `src/lib/discovery/fanout.ts` (yeni)
- [ ] Per-child query result aggregation + dedup
- [ ] `Lead.discoverySourceQuery` field — hangi child query'den geldi
- [ ] Server log: `api.discovery.fanout_start { parent, childCount, focusedTo }`
- [ ] Server log: `api.discovery.fanout_done { totalRaw, deduped }`

**Technical Notes:**
- Dosya: `src/lib/discovery/fanout.ts`
- API: `src/app/api/discovery/route.ts`

---

### [M2-14] Discovery UI real-time per-child counts
**Type:** feature
**Area:** frontend
**Priority:** Medium
**Effort:** M
**Owner:** @mert
**Depends on:** [M2-13]

**Description:**
Discovery sayfasında SSE/WebSocket ile her child query'nin sonuç sayısı gerçek zamanlı görünür:
```
✓ fine dining restaurant     [73]
✓ cocktail bar              [58]
...
Toplam: 178 unique lead (deduped 58)
```

**Acceptance Criteria:**
- [ ] SSE endpoint veya event-source
- [ ] UI: real-time counter (per-child + total + deduped)
- [ ] Skeleton state
- [ ] Error per-child handling (1 child fail → diğerleri devam)

**Technical Notes:**
- Mevcut: `src/app/app/discovery/page.tsx`
- SSE pattern: Next.js streaming response

---

## Epic 2.6 — Recommended Package System

### [M2-15] ServicePackage CRUD (Settings → Service Packages)
**Type:** feature
**Area:** frontend
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Workspace owner kendi service package'larını tanımlayabilsin (Base/Premium/Enterprise). Sonra AI bu paketlerden öneriyor. FineDine için 3 tier preset'i seed edildi.

**Acceptance Criteria:**
- [ ] Settings → Service Packages CRUD page
- [ ] OWNER düzenleyebiliyor, MEMBER read-only
- [ ] Her paket: name, price, currency, billing, features[], isPopular flag
- [ ] Validation
- [ ] Audit log (kim ne zaman ne değiştirdi)

**Technical Notes:**
- Mevcut: `src/app/app/settings/packages/page.tsx`
- Mevcut: `src/components/app/packages-form.tsx`
- API: `src/app/api/workspace/packages/`

---

### [M2-16] Package recommendation logic
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** L
**Owner:** @mert
**Depends on:** [M2-15]

**Description:**
Lead profile (size, multi-location, sub-niche, audit findings) → ServicePackage tier öneri + 1-2 cümle gerekçe. Yeni worker `PACKAGE_RECOMMENDER` veya OPENER_WRITER içinde.

**Acceptance Criteria:**
- [ ] Logic dokümante (decision tree veya prompt)
- [ ] Output: `{ packageId, reasoning, featuresHighlighted[] }`
- [ ] UI: lead detail "Recommended Package" card (Overview + Outreach tab)
- [ ] Test: 4 senaryo (small cafe → Base, hotel chain → Enterprise, etc.)

**Technical Notes:**
- Validation senaryoları: `research/finedine/beta-test-plan-ui.md` §5

---

### [M2-17] Soft mention in opener message (1 kez, soft kapanış)
**Type:** feature
**Area:** ai-core
**Priority:** Medium
**Effort:** S
**Owner:** @mert
**Depends on:** [M2-16]

**Description:**
Opener prompt'una recommended package adı + fiyat tek bir yerde, soft kapanış sorusunda inject edilir. Tüm özellik listesi ASLA ATILMAMALI (broşür gibi okumamalı).

**Acceptance Criteria:**
- [ ] Prompt template: "{packageName} planımız {price}'dan başlıyor — {leadCharacteristic}'e uyar mı?"
- [ ] Test: 10 opener'da paket adı 1 kez geçiyor
- [ ] Test: full feature list yok
- [ ] Beta tester scenarios A-D pass (`beta-test-plan-ui.md` §5)

**Technical Notes:**
- Skill: `prompt-engineering-gemini`

---

## M2 Çıkış Kontrol Listesi

- [ ] 10 F&B child pack tanımlı + workspace.targetSubNiches UI'a bağlı
- [ ] Rule + Gemini classifier %88+ accuracy
- [ ] Manual override + stale-guard çalışıyor (race condition test pass)
- [ ] Memory dual-write semantics doğru (positive→both, negative→child only)
- [ ] Discovery fan-out 10 paralel query
- [ ] Recommended Package card lead detail'de
- [ ] FineDine 2-tester beta tekrar yapıldı, reply rate uplift kanıtlandı
- [ ] 500-team rollout dokümentasyonu hazır

**Toplam M2 issue sayısı: 17**
