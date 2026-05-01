# Hustle - Ops Archive

> Auto-archived bundle. Generated 2026-05-01.
> Original individual files were deleted from the workspace to reduce agent token cost.
> This bundle preserves the full content of each source file, separated by markers.

## Bundle contents

- linear/README.md
- linear/M0-beta-hardening.md
- linear/M1-public-launch.md
- linear/M2-sub-vertical.md
- linear/M3-monetization.md
- linear/M4-tech-debt.md
- linear/M5-polish-scale.md
- DECISIONS.md
- COSTS.md
- BETA-TESTER-INSTRUCTIONS.md
- docs/email-setup.md

---


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/README.md -->
<!-- ============================================================ -->

# LeadAC — Linear Backlog (Draft)

> Bu klasör Linear'a push etmeden önce gözden geçirilecek tasarım dokümanıdır.
> Onaylandıktan sonra `linear-mcp` ile workspace'e issue olarak yaratılacak.
>
> **Hazırlayan:** Cursor AI (kod tabanı + research/finedine/* + product-marketing-context.md sentezi)
> **Tarih:** 2026-04-30
> **Status:** DRAFT — kullanıcı review bekliyor

---

## 0. Linear Workspace Setup (push'tan önce)

### Team yapısı
**Tek team:** `LeadAC` — şu an 3 kişiyiz, ayrı engineering/marketing team açmaya değmez. Label'larla bölelim.

### Members
| User | Role | Linear handle (önerilen) |
|---|---|---|
| Mert | Engineering Lead | @mert |
| Çınar | Positioning / Marketing | @cinar |
| Kaan | PR-Comment / Review | @kaan |

### Labels (Linear'da yaratılacak)

**Area** (issue hangi domain'e ait):
- `area:engineering` (gri)
- `area:ai-core` (mor)
- `area:workers` (mavi)
- `area:frontend` (yeşil)
- `area:marketing` (pembe)
- `area:design` (turuncu)
- `area:billing` (sarı)
- `area:ops` (kahverengi)
- `area:test` (cyan)

**Type:**
- `type:feature` (yeşil)
- `type:bug` (kırmızı)
- `type:refactor` (mavi)
- `type:test` (cyan)
- `type:docs` (gri)
- `type:research` (pembe)

**Effort** (kabaca size):
- `effort:S` — < 1 gün
- `effort:M` — 1-3 gün
- `effort:L` — 3-7 gün
- `effort:XL` — 1+ hafta

**Priority** Linear'ın native field'ı kullanılır (Urgent / High / Medium / Low / No priority).

### Milestone → Linear Project mapping

Linear'da **Project** = Milestone. Her milestone bir Project olur:
1. `M0 — Beta Hardening` (Active)
2. `M1 — Public Launch` (Backlog → 2 hafta sonra Active)
3. `M2 — Sub-Vertical Architecture (FineDine)` (Backlog)
4. `M3 — Monetization & Growth` (Backlog)
5. `M4 — Tech Debt & Operations` (Continuous, no end date)
6. `M5 — Polish & Scale` (Future)

### Cycles
2 haftalık cycle önerilir. M0 = bu cycle. M0 + ilk M1 issue'ları sonraki cycle'a düşsün.

---

## 1. Roadmap özeti

```
[Şimdi ──────────────────────────────────────────────────────► 6 ay sonra]

M0 (2hf)    M1 (4-6hf)         M2 (4hf)              M3 (8hf)
[BETA] ───► [LAUNCH] ───────► [FINEDINE 500] ───► [MONETIZE]
                                                          │
M4 (continuous)  ────────────────────────────────────────►│
                 (tech debt / ops)                        │
M5 (post-launch) ─────────────────────────────────────────►
                 (polish / scale)
```

| Milestone | Hedef | Süre tahmini | KPI |
|---|---|---|---|
| M0 — Beta Hardening | FineDine 2-tester beta'sı stabil, untracked iş commit edilmiş, Beta tester raporlarından çıkan top-5 bug fix | 2 hafta | 50 lead pass'i 90 dk altı, ≥4/5 güven puanı |
| M1 — Public Launch | r/coldemail launch, ilk 25 paying Agency-tier customer | 4-6 hafta | 25 paying × $249 = $6k MRR |
| M2 — Sub-Vertical Architecture | FineDine 500-team prerequisite (11 niche pack + classifier + dual-write memory) | 4 hafta | Reply rate 4% → 9% |
| M3 — Monetization & Growth | Stub workers ship, native push integrations | 8 hafta | $40-55k MRR |
| M4 — Tech Debt & Operations | Coverage, hygiene, billing hardening | Continuous | %80 unit coverage AI Core |
| M5 — Polish & Scale | Performance, observability, mockup parity | Post-launch | <60s pipeline median |

---

## 2. Milestone dosyaları

| Dosya | İçerik |
|---|---|
| [`M0-beta-hardening.md`](./M0-beta-hardening.md) | Active milestone — beta stabilization |
| [`M1-public-launch.md`](./M1-public-launch.md) | r/coldemail launch sprint |
| [`M2-sub-vertical.md`](./M2-sub-vertical.md) | FineDine sub-vertical architecture |
| [`M3-monetization.md`](./M3-monetization.md) | Stub workers + integrations + agency tier |
| [`M4-tech-debt.md`](./M4-tech-debt.md) | Coverage, hygiene, hardening |
| [`M5-polish-scale.md`](./M5-polish-scale.md) | Mockup parity, perf, observability |

---

## 3. Issue formatı (her milestone dosyasında bu yapı)

```markdown
### [M0-01] Issue başlığı
**Type:** feature/bug/refactor/test
**Area:** engineering / ai-core / frontend / ...
**Priority:** Urgent / High / Medium / Low
**Effort:** S/M/L/XL
**Owner:** @mert / @cinar / @kaan
**Depends on:** [M0-X], [M1-Y] (varsa)

**Description:**
2-3 paragraflık bağlam. Neden bu issue var, hangi sorunu çözüyor.

**Acceptance Criteria:**
- [ ] Madde 1
- [ ] Madde 2
- [ ] Madde 3

**Technical Notes:**
- Dosya: `src/path/to/file.ts:LINE`
- İlgili: `<symbol>` veya `<diğer dosya>`
- Risk: ...
```

---

## 4. Linear push akışı (onaylandıktan sonra)

1. **Linear MCP setup** (Cursor `~/.cursor/mcp.json` veya workspace `.cursor/mcp.json`):
   ```json
   {
     "mcpServers": {
       "linear": {
         "url": "https://mcp.linear.app/sse"
       }
     }
   }
   ```
2. Cursor'ı restart et, OAuth ile authenticate ol (Linear hesabıyla).
3. Cursor chat'e geri dön: "Linear MCP up. Push the backlog."
4. Cursor:
   - Workspace'i listeler, hangisine push edileceğini sorar.
   - Labels'ı yaratır.
   - 6 Project'i yaratır.
   - Her milestone dosyasındaki issue'ları sırayla yaratır (parent-child link, priority, label, assignee dahil).
   - Sonunda her bir issue ID + Linear URL'sini geri verir.

### Push tehlikeleri (önce sen kontrol et)
- **Owner atamaları doğru mu?** Yanlış kişiye gidemezse `@mert` her şeyde default olur.
- **Effort tahminleri optimistik mi?** Bilerek M (medium) önerdiğim yerlere bak — gerçekçi mi?
- **M1 vs M2 sıralaması**: Sen "önce launch, sonra FineDine" dedin. Ama FineDine 500-team beta'sı paralel devam edecekse M1+M2 paralel cycle olabilir. Bunu Linear'da Cycle ataması yaparken çözeriz.

---

## 5. Sonraki adımlar (sen ne yapacaksın)

1. **Bu klasörü oku.** Sırayla README → M0 → M1 → M2 → M3 → M4 → M5.
2. **Yön düzeltmek istediğin yerleri** doğrudan dosyaya yorum bırak veya Cursor'a söyle ("M1-03'ü çıkar, M0'a şunu ekle" gibi).
3. **Linear MCP'yi kur** (yukarıdaki adım 0).
4. Cursor'a "push" de.

Sorular varsa hemen sor — issue detayını incele, eksik gördüğün her şeyi söyle.


<!-- END FILE: linear/README.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/M0-beta-hardening.md -->
<!-- ============================================================ -->

# M0 — Beta Hardening

> **Status:** Active
> **Süre:** 2 hafta (cycle 1)
> **Hedef:** FineDine 2-tester beta'sı stabil çalışsın. Tester raporlarından çıkan top-5 bug çözülsün. Untracked iş repo'ya inip prod'a geçsin.
> **Exit kriteri:** Her iki tester de 50-lead pass'ini ≤90 dk'da bitirebilsin, güven puanı ortalaması ≥ 4/5.

---

## Epic 0.1 — Untracked Work Cleanup

> Şu an git status'ta 19 modified + 3 untracked dosya var. Bu dosyaların yarısı production'a gidemez halde. Önce ne yapmak istediğimizi netleştirip commit'leyelim, sonra deploy edelim.

### [M0-01] Audit untracked Prisma generated client + schema decisions
**Type:** refactor
**Area:** engineering
**Priority:** Urgent
**Effort:** S
**Owner:** @mert

**Description:**
`prisma/schema.prisma` modified halde, `src/generated/prisma/*` ise tamamen untracked. Karar: bu dosyalar repo'ya girmeli mi yoksa `.gitignore`'da mı kalmalı? Şu an her makinada `prisma generate` çalışmadıkça TypeScript hatası alınıyor.

İki yol var:
- **(A)** Generated client'ı .gitignore'a ekle, postinstall'da `prisma generate` çalıştır (zaten var). Repo temiz kalır.
- **(B)** Generated client'ı commit et. CI/CD daha hızlı, ama her schema değişikliğinde diff şişer.

Önerilen: (A). Çünkü `package.json`'da `postinstall: prisma generate` zaten var, Vercel/Railway build'de çalışıyor.

**Acceptance Criteria:**
- [ ] Karar dokümante edildi (architecture rule güncellendi)
- [ ] `.gitignore`'a `src/generated/prisma/**` eklendi (eğer A seçildiyse)
- [ ] `prisma db push` ile DB-repo senkron sağlandı
- [ ] `git status` sadece kasıtlı değişiklikleri gösteriyor

**Technical Notes:**
- Karar dokümanı: `.cursor/rules/prisma-db.mdc` veya `AGENTS.md` non-negotiables güncellensin
- Risk: Generated client büyük (`query_engine-windows.dll.node` 50MB+), commit etmek istemeyiz

---

### [M0-02] Commit lead intelligence brief endpoint + worker
**Type:** feature
**Area:** ai-core
**Priority:** High
**Effort:** S
**Owner:** @mert

**Description:**
`src/app/api/leads/[id]/intelligence-brief/` ve `src/lib/agent-workers/lead-intelligence-brief.ts` untracked. Yeni LEAD_INTELLIGENCE_BRIEF worker prod'a hazır görünüyor. Bunu commit et, registry'ye eklendiği doğrula, prod'a geç.

**Acceptance Criteria:**
- [ ] `lead-intelligence-brief.ts` worker'ın AC'si net (input/output schema)
- [ ] `registry.ts`'de implModule lazy import doğru
- [ ] `/api/leads/[id]/intelligence-brief` endpoint workspaceId scope'lu (`requireUser` çağrısı)
- [ ] Quota config'i `quota.ts`'de tanımlı
- [ ] Commit edildi, prod'a deploy edildi

**Technical Notes:**
- Dosya: `src/lib/agent-workers/lead-intelligence-brief.ts`
- Dosya: `src/app/api/leads/[id]/intelligence-brief/route.ts`
- Multi-tenant scope check: `requireUser()` → `workspaceId` her query'de
- Yetkilendirme: Lead'in workspace'inde olduğu doğrulanmalı

---

### [M0-03] Commit log-call endpoint
**Type:** feature
**Area:** engineering
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
`src/app/api/leads/[id]/log-call/` untracked. Lead detail UI'dan çağrı kaydı tutmak için endpoint. Activity feed'e yazıyor olmalı.

**Acceptance Criteria:**
- [ ] Endpoint workspaceId scope'lu
- [ ] `LeadActivity` tablosuna `LeadActivityKind = CALL_LOGGED` ile yazıyor
- [ ] UI tarafında çağrı butonu çalışıyor
- [ ] Test (en azından happy path) yazıldı

**Technical Notes:**
- Dosya: `src/app/api/leads/[id]/log-call/route.ts`
- İlgili enum: `LeadActivityKind` (`schema.prisma`)
- UI integration: `src/app/app/leads/[id]/page.tsx`

---

### [M0-04] Schema değişikliklerini commit et + migration plan
**Type:** ops
**Area:** engineering
**Priority:** Urgent
**Effort:** M
**Owner:** @mert

**Description:**
`prisma/schema.prisma` modified. Hangi alanlar eklendi belli değil ama untracked Prisma generated dosyalarında 30+ model var. DB ile repo senkron mu? Production DB'de bu kolonlar var mı?

Şu an `npm run db:push` kullanılıyor — migration history yok. Beta'dan prod'a geçişte risk: schema drift, kolon ekleme/silme erroru.

**Acceptance Criteria:**
- [ ] `git diff prisma/schema.prisma` review edildi, her değişiklik dokümante edildi
- [ ] Production DB'de `prisma db push` ile senkronize
- [ ] Schema commit edildi
- [ ] Migration history strategy karar verildi (M4'e taşı detay refactor için)

**Technical Notes:**
- Komut: `git diff prisma/schema.prisma`
- Karar: `db:push` (dev) → `db:migrate` (prod) geçişi M4'te yapılacak; bu issue sadece mevcut state'i sağlam tutmak için

---

### [M0-05] Crawler/extractor/gemini-client güncellemelerini commit et
**Type:** refactor
**Area:** engineering
**Priority:** High
**Effort:** S
**Owner:** @mert

**Description:**
`src/lib/crawler.ts`, `src/lib/extractor.ts`, `src/lib/gemini-client.ts` modified. Yeni `WEBSITE_AUDITOR` worker bunları kullanıyor. Beta tester'lar bu yoldan geçiyor.

**Acceptance Criteria:**
- [ ] `git diff` review edildi
- [ ] `crawler.ts`'in Playwright timeout / error handling'i sağlam
- [ ] `gemini-client.ts`'in retry logic'i `RetryableError` türüne göre çalışıyor
- [ ] Beta tester'lardan crawl crash raporu yok
- [ ] Commit edildi

**Technical Notes:**
- Dosya: `src/lib/crawler.ts` — Playwright chromium init
- Dosya: `src/lib/extractor.ts` — cheerio booking/QR/delivery patterns
- Dosya: `src/lib/gemini-client.ts` — `generateWithTimeout`, `RetryableError`

---

### [M0-06] Crawl-worker / analyze-worker yarım durumunu çöz
**Type:** refactor
**Area:** workers
**Priority:** High
**Effort:** S
**Owner:** @mert

**Description:**
`src/workers/crawl-worker.ts` ve `src/workers/analyze-worker.ts` supervisor'da yorum satırında. Dosyalar diskte duruyor ama çalışmıyor. Bu kafa karışıklığı yaratıyor: yeni gelen biri "bu worker var ama neden çalışmıyor?" diyor.

İki seçenek:
- **(A)** Dosyaları sil, AI Core `agent-runs` queue'ya tamamen geç
- **(B)** Dosyaları `archive/` veya `legacy/` klasörüne taşı

Önerilen: (A). Çünkü `/api/crawl` ve `/api/analyze` zaten deprecated facade — `emit("lead_created")` ile AI Core'a yönlendiriyor. Eski worker artık dead code.

**Acceptance Criteria:**
- [ ] `crawl-worker.ts` ve `analyze-worker.ts` silindi
- [ ] `src/workers/index.ts`'de yorum satırlarındaki import'lar kaldırıldı
- [ ] `/api/crawl` ve `/api/analyze` facade'lerine TODO eklendi (M3'te tamamen kaldırılacak)
- [ ] Doc güncellendi (`AGENTS.md` "BullMQ workers" bölümü)

**Technical Notes:**
- Dosya: `src/workers/crawl-worker.ts` (silinecek)
- Dosya: `src/workers/analyze-worker.ts` (silinecek)
- Dosya: `src/workers/index.ts` — yorum satırlarındaki import temizliği

---

### [M0-07] Lead detail page UI değişikliklerini gözden geçir + commit
**Type:** refactor
**Area:** frontend
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
`src/app/app/leads/[id]/page.tsx` modified. Yüzlerce satırlık client component. Beta tester'lar bu sayfayı kullanıyor. Değişikliklerin neyi etkilediği review edilmeli.

**Acceptance Criteria:**
- [ ] `git diff src/app/app/leads/[id]/page.tsx` satır satır incelendi
- [ ] Yeni eklenen UI öğeleri (intelligence brief panel?) doğru render ediyor
- [ ] Mobile responsive kontrol edildi
- [ ] Tab switch performansı (5 tab) sub-200ms
- [ ] Commit edildi

**Technical Notes:**
- Dosya: `src/app/app/leads/[id]/page.tsx`
- İlişkili components: `lead-overview-panel`, `lead-website-panel`, `lead-workers-panel`, `lead-reviews-panel`, `lead-outreach-panel`
- Risk: Bu sayfa client component — bundle size artışı varsa code-split düşün

---

### [M0-08] Lead list query + page güncellemeleri
**Type:** refactor
**Area:** frontend
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
`src/app/app/leads/page.tsx`, `src/components/app/leads/useLeadsQuery.ts` modified. Filter / sort logic değişmiş olabilir. Beta tester'lar lead listesinde filtreleme yapıyor.

**Acceptance Criteria:**
- [ ] `git diff` review edildi
- [ ] `useLeadsQuery` hook'unda dependency array'ler doğru
- [ ] Pagination çalışıyor
- [ ] Filter + sort kombinasyonu correct sonuç dönüyor
- [ ] Commit edildi

**Technical Notes:**
- Dosya: `src/app/app/leads/page.tsx`
- Dosya: `src/components/app/leads/useLeadsQuery.ts`

---

### [M0-09] Stats + leads API endpoint güncellemeleri
**Type:** refactor
**Area:** engineering
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
`src/app/api/stats/route.ts`, `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts` modified. Multi-tenant scope kontrolü kritik.

**Acceptance Criteria:**
- [ ] Her route'da `requireUser()` ve `workspaceId` filter mevcut
- [ ] Cross-tenant data leak testi yapıldı (başka workspace ID'si gönderilirse 404 veya filtered)
- [ ] Response shape'i UI'la uyumlu
- [ ] Commit edildi

**Technical Notes:**
- Multi-tenant rule: AGENTS.md non-negotiables #1
- Skill: `multi-tenant-scope-audit` SKILL.md'yi her route için çalıştır

---

### [M0-10] Worker / agent-workers commit + registry doğrula
**Type:** refactor
**Area:** ai-core
**Priority:** High
**Effort:** S
**Owner:** @mert

**Description:**
`src/lib/agent-workers/lead-dossier-generator.ts`, `src/lib/agent-workers/quota.ts`, `src/lib/agent-workers/registry.ts`, `src/lib/agent-workers/website-auditor.ts` modified. `src/lib/ai-core/chains.ts` modified. Bunlar yeni 3 worker'ın AI Core entegrasyonu.

**Acceptance Criteria:**
- [ ] `registry.ts`'de WEBSITE_AUDITOR, LEAD_DOSSIER_GENERATOR, LEAD_INTELLIGENCE_BRIEF için implModule resolve ediyor
- [ ] `quota.ts`'de quota matrix'te bu worker'lar için entry var (LAUNCH_POLICY=true scope'unda gevşek)
- [ ] `chains.ts`'de chain definition'lar doğru sequence
- [ ] `npm run lint` temiz
- [ ] Commit edildi

**Technical Notes:**
- AI Core dokümantasyonu: `.cursor/rules/ai-core.mdc`
- Worker contract: `src/lib/agent-workers/types.ts`

---

## Epic 0.2 — Beta Test Stabilization

> 2 tester + owner hesabı çalışıyor olmalı. Tester'lar BETA-TESTER-INSTRUCTIONS.md'i takip ediyor. Çıkan bug'ları toparlayıp prio'lamak gerek.

### [M0-11] Beta tester hesaplarını sağla (2 tester + 1 owner)
**Type:** ops
**Area:** ops
**Priority:** Urgent
**Effort:** S
**Owner:** @mert

**Description:**
Şu an sadece `finedine-owner@leadac.beta` hazır gibi görünüyor. `beta-test-plan-ui.md`'de tester1 + tester2 hesapları gerekli.

**Acceptance Criteria:**
- [ ] `finedine-tester1@leadac.beta` + `finedine-tester2@leadac.beta` hesapları yaratıldı
- [ ] Her ikisi de `FineDine Beta` workspace'ine MEMBER olarak eklendi
- [ ] Workspace AGENCY plan, 100yr trial, niche=`RESTAURANT_TECH`
- [ ] Şifreler güvenli iletildi (1Password / signal)
- [ ] Test girişi yapıldı, dashboard yükleniyor

**Technical Notes:**
- Komut: `npx tsx scripts/seed-finedine-beta.ts --owner ... --tester ... --tester ...`
- Skript: `scripts/seed-finedine-beta.ts` (varsa, yoksa M0-11A'da yarat)

---

### [M0-11A] Seed script'i guarantee et: scripts/seed-finedine-beta.ts
**Type:** feature
**Area:** ops
**Priority:** High
**Effort:** S
**Owner:** @mert
**Depends on:** [M0-11]

**Description:**
`beta-test-plan.md`'de `npx tsx scripts/seed-finedine-beta.ts ...` komutu var. Bu script var mı / çalışıyor mu? Eğer yoksa yaz.

**Acceptance Criteria:**
- [ ] `scripts/seed-finedine-beta.ts` mevcut ve çalışıyor
- [ ] CLI argümanları: `--owner`, `--tester` (multi), `--name`, `--slug`, `--country`, `--language`
- [ ] İdempotent (aynı script ikinci kere çalışırsa duplicate hatası vermez)
- [ ] Console output'unda final state'i print eder (plan, niche, seats, members)
- [ ] README'ye seed komutu eklenmiş

**Technical Notes:**
- Schema: `Workspace`, `WorkspaceMember`, `User` tabloları
- Auth: Supabase user'lar zaten hazır olmalı (auth.users içinde)
- Önerilen: `tsx`, `commander` veya plain `process.argv` parsing

---

### [M0-12] Beta tester onboarding dokümanı netleştir
**Type:** docs
**Area:** ops
**Priority:** High
**Effort:** S
**Owner:** @cinar

**Description:**
`BETA-TESTER-INSTRUCTIONS.md` ve `research/finedine/beta-test-plan-ui.md` arasında dil/seviye farkı var. İlki "robot dedektif" tarzı laymen Türkçe, ikincisi teknik tester rehberi. Tester'lara hangisi gönderilecek?

**Acceptance Criteria:**
- [ ] İki dokümanın hedef kitlesi netleştirildi (laymen tester vs teknik tester)
- [ ] Tester'a tek doküman link'i verildi
- [ ] PM contact info, bug rapor URL'si, Slack/Linear kanalı yazılı
- [ ] Test başlangıç tarihi + bitiş tarihi netleştirildi

**Technical Notes:**
- Doküman: `BETA-TESTER-INSTRUCTIONS.md`
- Doküman: `research/finedine/beta-test-plan-ui.md`
- Owner: Çınar (positioning + customer-facing copy)

---

### [M0-13] Bug raporlama kanalını kur
**Type:** ops
**Area:** ops
**Priority:** High
**Effort:** S
**Owner:** @mert

**Description:**
Tester'lar bug bulduğunda nereye yazacak? `BETA-TESTER-INSTRUCTIONS.md` "rapor şablonu var ama kanal yok" diyor. Slack? Linear? Email?

**Acceptance Criteria:**
- [ ] Bug rapor kanalı seçildi (önerilen: Linear, çünkü zaten kuruyoruz)
- [ ] Tester'lar Linear hesabı açtı (guest member?) veya bir form var
- [ ] Şablon Linear template olarak kuruldu
- [ ] Tester'lara link gönderildi

**Technical Notes:**
- Linear "Form" feature'ı kullanılabilir (public bug submission)
- Alternatif: Tally / Typeform → Linear webhook → otomatik issue
- Şablon: `BETA-TESTER-INSTRUCTIONS.md` "Rapor şablonu" bölümü

---

### [M0-14] Smoke test runbook dokümante et
**Type:** docs
**Area:** ops
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
`beta-test-plan.md` §1'deki 30-dk smoke test'i deploy sonrası her seferinde manuel olarak yapılabilir bir runbook'a çevir. Bunu Linear template / Notion / repo doc — bir yere koy.

**Acceptance Criteria:**
- [ ] Smoke test 6 adımı bir doc'ta listeli
- [ ] Her adımda "fail durumunda ne yapılır" var
- [ ] Engineering rotation'a (kim çalışıyorsa) doc link'i geçer
- [ ] İlk smoke test bu runbook ile çalıştı, geçti

**Technical Notes:**
- Yeri: `docs/runbooks/smoke-test.md` veya repo `README.md`'de bir bölüm
- Refer: `research/finedine/beta-test-plan.md` §1

---

## Epic 0.3 — Test Foundation

> Coverage ölçülmüyor, yeni 2 worker'ın testi yok. M1 ve sonrası için bu sağlam bir taban olmalı, yoksa launch sonrası regression bizi yer.

### [M0-15] Vitest coverage config
**Type:** test
**Area:** test
**Priority:** High
**Effort:** S
**Owner:** @mert

**Description:**
`vitest.config.mts`'de coverage tanımı yok. `@vitest/coverage-v8` ekle, `coverage:run` script'i, başlangıç threshold'u 0% (ama trendi görelim).

**Acceptance Criteria:**
- [ ] `@vitest/coverage-v8` dev dependency
- [ ] `vitest.config.mts`'de coverage `provider: 'v8'`, `reporter: ['text', 'html']`
- [ ] `npm run test:coverage` komutu var
- [ ] CI'da coverage report artifact olarak yüklenir (varsa GitHub Actions)
- [ ] İlk run sonucu README'ye yazılı (baseline)

**Technical Notes:**
- Dosya: `vitest.config.mts`
- Hedef: M4'te threshold AI Core %80, overall %60

---

### [M0-16] LEAD_INTELLIGENCE_BRIEF unit test
**Type:** test
**Area:** ai-core
**Priority:** High
**Effort:** M
**Owner:** @mert
**Depends on:** [M0-02], [M0-15]

**Description:**
Yeni LEAD_INTELLIGENCE_BRIEF worker test edilmemiş. Beta tester'lar bu output'u görüyor — halüsinasyon riski var. En azından:
- Mocked Gemini response → output structure validate
- Quota check
- Memory write/read
- Confidence/structured output schema validation

**Acceptance Criteria:**
- [ ] `src/__tests__/agent-workers/lead-intelligence-brief.test.ts` var
- [ ] Happy path: mocked context → expected output shape
- [ ] Edge case: missing lead.website → graceful fallback
- [ ] Edge case: Gemini timeout → RetryableError
- [ ] Coverage report'ta bu modül ≥%70

**Technical Notes:**
- Dosya: `src/lib/agent-workers/lead-intelligence-brief.ts`
- Mock pattern: diğer worker test'lere bak (`website-auditor.test.ts` örnek)

---

### [M0-17] LEAD_DOSSIER_GENERATOR unit test
**Type:** test
**Area:** ai-core
**Priority:** High
**Effort:** M
**Owner:** @mert
**Depends on:** [M0-15]

**Description:**
Aynı M0-16 mantığı, dossier generator için. Bu worker rapor yazıyor ve `[website_audit]`, `[review_analyst]` gibi citation tag'leri ekliyor — citation accuracy kritik.

**Acceptance Criteria:**
- [ ] `src/__tests__/agent-workers/lead-dossier-generator.test.ts` var
- [ ] Happy path: 3 farklı niche için citation pattern doğru
- [ ] Citation tag'lerin source'larıyla eşleştiği test edildi
- [ ] Coverage ≥%70

**Technical Notes:**
- Dosya: `src/lib/agent-workers/lead-dossier-generator.ts`
- Önemli: Citation accuracy → halüsinasyon prevent eden ana mekanizma

---

### [M0-18] /api/leads/[id]/intelligence-brief integration test
**Type:** test
**Area:** test
**Priority:** Medium
**Effort:** M
**Owner:** @mert
**Depends on:** [M0-02], [M0-15]

**Description:**
Endpoint workspaceId scope'unu doğrula. Cross-tenant access reddediliyor mu, yoksa data leak var mı?

**Acceptance Criteria:**
- [ ] Integration test config'ine eklendi (`vitest.config.integration.ts`)
- [ ] Test: aynı workspace'in lead'i → 200 OK + brief
- [ ] Test: başka workspace'in lead'i → 404
- [ ] Test: unauthenticated → 401
- [ ] Test: rate limit / quota → uygun status

**Technical Notes:**
- Skill: `multi-tenant-scope-audit` SKILL.md
- Test framework: vitest integration config

---

## Epic 0.4 — Critical Beta Bugs (placeholder)

> Bu epic boşken duruyor. Tester raporları geldikçe issue açılacak (M0-19+).

### [M0-19] [PLACEHOLDER] Bug rapor 1
**Status:** Will be filled from tester reports

### [M0-20] [PLACEHOLDER] Bug rapor 2
**Status:** Will be filled from tester reports

---

## Epic 0.5 — Beta Exit Criteria Doğrulama

### [M0-21] 50-lead pass'i 90 dk altında bitir (her tester)
**Type:** ops
**Area:** ops
**Priority:** High
**Effort:** L
**Owner:** @cinar (PM tarafı)
**Depends on:** [M0-11], [M0-12]

**Description:**
`beta-test-plan.md` §9 acceptance criteria son maddesi: "Her iki tester de 50-lead pass'ini ≤90 dk'da bitirebilsin." Bu cycle-time gerçek bir performans sinyali — UI ya da worker yavaşsa burada görünür.

**Acceptance Criteria:**
- [ ] Tester 1 → 50 lead, time tracked
- [ ] Tester 2 → 50 lead, time tracked
- [ ] İkisi de ≤90 dk
- [ ] Bottleneck'ler not edildi (eğer 90+ dk ise hangi adım yavaş)

**Technical Notes:**
- Bottleneck candidates: Discovery API call, lead detail page initial load, AI workers chain duration

---

### [M0-22] Güven puanı ≥4/5 ortalaması
**Type:** ops
**Area:** ops
**Priority:** High
**Effort:** S
**Owner:** @cinar
**Depends on:** [M0-21]

**Description:**
`BETA-TESTER-INSTRUCTIONS.md` §H "Güven puanın (1-5)" — site analizi, yorum analizi, mesaj kalitesi, genel rapor, UI sorunsuzluğu. Toplam 25 üzerinden ≥20 = ≥4/5 ortalama.

**Acceptance Criteria:**
- [ ] Tester 1 puanı raporlandı (toplam /25)
- [ ] Tester 2 puanı raporlandı (toplam /25)
- [ ] Ortalama ≥20/25
- [ ] Düşük puan veren kategoriler (varsa) M1/M2'ye issue olarak çıkarıldı

**Technical Notes:**
- Form: `BETA-TESTER-INSTRUCTIONS.md` rapor şablonu
- Aksiyon: <4 puanlı her kategori için yeni issue M1 veya M2'ye

---

## M0 Çıkış Kontrol Listesi

- [ ] Tüm Epic 0.1 issue'ları kapalı (untracked work cleared)
- [ ] Tüm Epic 0.3 test foundation kuruldu
- [ ] 2 tester + owner aktif
- [ ] Bug rapor kanalı çalışıyor
- [ ] Tester raporları toparlandı
- [ ] M0-21, M0-22 acceptance criteria geçti
- [ ] Top-5 critical bug fix edildi
- [ ] M0 retro yapıldı, M1'e geçildi

**Toplam M0 issue sayısı: 22 (yer tutucu 2 + dolu 20)**


<!-- END FILE: linear/M0-beta-hardening.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/M1-public-launch.md -->
<!-- ============================================================ -->

# M1 — Public Launch

> **Status:** Backlog → 2 hafta sonra Active
> **Süre:** 4-6 hafta
> **Hedef:** r/coldemail community'sine launch, ilk 25 paying Agency-tier customer = ~$6k MRR
> **Exit kriteri:** 25 ödeme yapan Agency tier müşteri ($249/mo) + 1 published case study + reply rate baseline > 4%

---

## Epic 1.1 — Marketing Site Polish

> ICP: 1-10 person digital agency owner-operators selling web design/SEO/paid ads to local services.
> Voice: research-grounded, specific, founder-direct (product-marketing-context.md). Asla "AI SDR" ya da "auto-send" pozisyonlamayacak.

### [M1-01] Homepage hero CRO pass
**Type:** feature
**Area:** marketing
**Priority:** High
**Effort:** M
**Owner:** @cinar

**Description:**
Mevcut homepage hero (`src/app/(marketing)/page.tsx`) "we sell you the first version of the pitch" pozisyonunu yeterince netleştiriyor mu? Reddit + Last30Days çıktılarına göre buyer'ın ana acısı: "Apollo aynı listeyi 5 ajansa veriyor, AI auto-send brand'ime zarar veriyor." Hero bunun anti-pozisyonunu vermeli.

Skill kullan: `copywriting` + `page-cro` + `humanizer` + `tr-en-marketing-sync`.

**Acceptance Criteria:**
- [ ] Headline + subheadline + primary CTA + social proof (Reddit alıntı)
- [ ] "AI sends for you" yok, "we draft, you ship" var
- [ ] EN ve TR versiyon paralel
- [ ] Above-the-fold mobile + desktop screenshots eklendi (Linear thread)
- [ ] Humanizer skill'inden geçti (no AI-tell words)
- [ ] A/B test setup'ı (M1-19)

**Technical Notes:**
- Dosya: `src/app/(marketing)/page.tsx`
- Skill: `c:\Users\meert\.cursor\skills\copywriting\SKILL.md`
- Skill: `c:\Users\meert\.cursor\skills\humanizer\SKILL.md`
- Voice rules: `.agents/product-marketing-context.md` "Brand Voice"

---

### [M1-02] Pricing page CRO + value anchor
**Type:** feature
**Area:** marketing
**Priority:** High
**Effort:** M
**Owner:** @cinar

**Description:**
Pricing tier'ları: Free trial / Pro $79 / Agency $249 / Custom. Anchor: "1 booked call = $100-$500 → Pro 1-5× ROI." Bu anchor pricing page'de görünüyor mu? Comparison row'lar (50 lead vs 1k vs 5k) var mı?

**Acceptance Criteria:**
- [ ] 4 tier yan yana (mobile'da accordion)
- [ ] "Most popular: Agency" badge
- [ ] ROI calculator section (kaç meeting → ROI)
- [ ] FAQ section: "Apollo değiştirir mi? AI mı sender? Vertical pack ne?"
- [ ] CTA: "Start free trial — 50 leads, no credit card"

**Technical Notes:**
- Dosya: `src/app/(marketing)/pricing/page.tsx`
- Skill: `pricing-strategy` + `page-cro`
- Plans table: `src/lib/plans.ts`

---

### [M1-03] /for/<niche> vertical landing pages — 5 pack
**Type:** feature
**Area:** marketing
**Priority:** High
**Effort:** L
**Owner:** @cinar

**Description:**
Mevcut `/for/agencies` ve `/for/specialists` var. Yeni: `/for/phone-repair`, `/for/hvac`, `/for/plumbing`, `/for/dental`, `/for/locksmiths`. Her sayfa o vertical'in r/coldemail/Reddit acısını göstermeli + LeadAC'nin nasıl çözdüğünü anlatmalı.

Skill kullan: `vertical-landing-template` (workspace skill).

**Acceptance Criteria:**
- [ ] 5 sayfa live: phone-repair, hvac, plumbing, dental, locksmiths
- [ ] Her sayfa: hero, pain (with citation), product fit, screenshot/mockup, CTA
- [ ] Internal link: nav + footer + sitemap
- [ ] EN + TR versiyon
- [ ] Schema markup (`Service`, `LocalBusiness`)
- [ ] OG image her sayfa için unique (web-asset-generator skill)

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\vertical-landing-template\SKILL.md`
- Mevcut: `src/app/(marketing)/for/agencies/page.tsx`
- Buyer evidence: `BUYER-PERSONA.md`, `MARKETING.md` §9

---

### [M1-04] /vs/apollo, /vs/clay, /vs/instantly comparison pages
**Type:** feature
**Area:** marketing
**Priority:** High
**Effort:** M
**Owner:** @cinar

**Description:**
Anti-pozisyon "Apollo killer değiliz, üstü katmanız". Comparison page'leri Apollo'yu küçük düşürmemeli, "biz farklı işi yapıyoruz" demeli. Skill: `competitor-alternatives`.

**Acceptance Criteria:**
- [ ] /vs/apollo, /vs/clay, /vs/instantly live
- [ ] Her sayfa: side-by-side feature table + when to use which + integration story
- [ ] Apollo + Clay + Instantly + Smartlead için "we integrate, not compete" net mesaj
- [ ] Schema: `Product` markup + comparison table semantik
- [ ] EN + TR

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\competitor-alternatives\SKILL.md`
- Mevcut: `src/app/(public)/vs/` veya `(public)/alternatives/` (ilk konum confirm et)
- Anti-positioning: `.agents/product-marketing-context.md` "Anti-persona"

---

### [M1-05] Demo video — 15dk Loom
**Type:** docs
**Area:** marketing
**Priority:** High
**Effort:** M
**Owner:** @cinar

**Description:**
`MARKETING.md §9.3` demo script'i var (varsayım — yoksa bu issue'da yaz). 15dk Loom: postcode + niche → 47 lead → 1 audit → 1 opener → 1 plan → CSV export → reply.

**Acceptance Criteria:**
- [ ] Script yazıldı (script-first, sonra çekim)
- [ ] Loom recorded (15 dk hedef, 18 dk hard cap)
- [ ] Pricing CTA card embed edildi (Loom'da clickable CTA)
- [ ] Ana sayfa hero altına embed
- [ ] Email sequence + Reddit reply'larında link

**Technical Notes:**
- Owner: Çınar (script + voice), Mert (recording assist)
- Loom embed: marketing page'de `<iframe>` veya Loom oEmbed

---

### [M1-06] OG / Twitter card images (web-asset-generator)
**Type:** design
**Area:** design
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
Her landing page için unique OG image. Skill: `web-asset-generator`.

**Acceptance Criteria:**
- [ ] Homepage OG (1200x630)
- [ ] /for/* her vertical için OG
- [ ] /vs/* her comparison için OG
- [ ] Twitter card meta tags doğru
- [ ] Slack / Discord preview test

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\web-asset-generator\SKILL.md`
- Brand: `public/leadac-brand-kit.pdf`, `public/brand-kit.html`

---

## Epic 1.2 — Programmatic SEO

> Vertical pack landing pages at scale. Skill: `programmatic-seo`. Hedef: 6 ay içinde 200+ indexed page.

### [M1-07] /niches/<vertical> hub pages
**Type:** feature
**Area:** marketing
**Priority:** High
**Effort:** L
**Owner:** @cinar

**Description:**
Mevcut `src/app/(public)/niches/` var. Her vertical (phone-repair, HVAC, plumbing, dental, locksmiths, opticians) için bir hub page. Hub page → city pages.

**Acceptance Criteria:**
- [ ] 6 vertical hub page live
- [ ] Her sayfa: vertical intro + ICP + sample lead snapshot + city links + CTA
- [ ] JSON-LD: `CollectionPage`, `BreadcrumbList`, `ItemList`
- [ ] Sitemap'te listeli
- [ ] Internal linking: from `/for/<niche>` → `/niches/<vertical>`

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\programmatic-seo\SKILL.md`
- Skill: `c:\Users\meert\.cursor\skills\seo-public-pages\SKILL.md`
- Mevcut: `src/app/(public)/niches/`

---

### [M1-08] /niches/<vertical>/<city> page templates (≥3 leads only)
**Type:** feature
**Area:** marketing
**Priority:** High
**Effort:** L
**Owner:** @cinar

**Description:**
City-specific pages, ama sadece o city'de en az 3 audited lead varsa render et. Yoksa 404. Bu kalite bar'ı; thin content riskini azaltır.

**Acceptance Criteria:**
- [ ] Template: hero + city stats + top 3 lead snapshot (anonimize) + CTA
- [ ] Render gating: leads count ≥3
- [ ] JSON-LD: `LocalBusiness` + `BreadcrumbList`
- [ ] Sitemap'e dynamic ekleme (`sitemap.ts`)
- [ ] İlk 5 vertical × 3 city = 15 page live

**Technical Notes:**
- Mevcut: `src/app/(public)/niches/[verticalSlug]/[citySlug]/page.tsx` (var mı kontrol)
- Sitemap: `src/app/sitemap.ts`
- Risk: Google thin content penalty — 3 lead bar'ını koruyalım

---

### [M1-09] Schema markup audit + structured data
**Type:** feature
**Area:** marketing
**Priority:** Medium
**Effort:** M
**Owner:** @cinar

**Description:**
Tüm marketing site için JSON-LD: `Organization`, `Product`, `FAQPage` (pricing'de), `Article` (blog), `BreadcrumbList`. Skill: `schema-markup`.

**Acceptance Criteria:**
- [ ] Homepage: Organization + Product
- [ ] Pricing: FAQPage
- [ ] Blog post'lar: Article + Author
- [ ] /vs/*: SoftwareApplication comparison
- [ ] Google Rich Results test 100% pass
- [ ] schema.org validator pass

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\schema-markup\SKILL.md`
- Helper: `src/lib/seo/schema.ts` (varsa, yoksa yarat)

---

### [M1-10] Sitemap.ts dinamik niche/city aggregation
**Type:** refactor
**Area:** marketing
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
Sitemap'in static route'lar + dinamik /niches/* + /niches/*/* + /m/* mockup'ları otomatik aggregate etmesi gerekiyor. Şu an manuel olabilir.

**Acceptance Criteria:**
- [ ] `src/app/sitemap.ts` dinamik query: niche slugs + city slugs (≥3 lead) + public mockup slugs
- [ ] `lastModified` doğru
- [ ] `priority` urgent page'ler için 1.0, alt page'ler 0.7
- [ ] Robots.txt sitemap reference doğru
- [ ] IndexNow webhook firing (mevcut `/api/indexnow-key/route.ts`)

**Technical Notes:**
- Dosya: `src/app/sitemap.ts`
- IndexNow: `src/app/api/indexnow-key/route.ts`

---

## Epic 1.3 — AI/GEO SEO (LLM Citation)

> Skill: `ai-seo`. Hedef: ChatGPT/Perplexity/Claude'un "best lead generation tool for agencies" sorgusunda LeadAC'yi citation listesine alması.

### [M1-11] AI search optimization for "lead generation for agencies"
**Type:** feature
**Area:** marketing
**Priority:** Medium
**Effort:** M
**Owner:** @cinar

**Description:**
Skill: `ai-seo`. ChatGPT/Perplexity citation almak için: long-form Q&A content, listicles ("Top X tools for Y"), her sayfada "TL;DR" bölümü, structured FAQ.

**Acceptance Criteria:**
- [ ] Homepage TL;DR (3 satır) eklendi
- [ ] Blog: "Top 7 lead gen tools for digital agencies (2026)" yayında — kendimizi #3-5'e koyup objectivity göster
- [ ] /for/<niche> her sayfada FAQ schema'lı
- [ ] AI search test: ChatGPT'ye "best lead generation tool for digital agencies"sor, ilk 5'te biri olalım

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\ai-seo\SKILL.md`
- Risk: Self-rank bias → 3-5 koy, 1-2 değil

---

### [M1-12] Cited evidence: r/coldemail thread roundup
**Type:** docs
**Area:** marketing
**Priority:** Low
**Effort:** M
**Owner:** @cinar

**Description:**
Blog: "What r/coldemail's 50k+ operators are saying about lead gen in 2026" — 10 alıntı + thread link. Hem AI citation hem human social proof.

**Acceptance Criteria:**
- [ ] 10 quote, her biri thread URL + upvote count
- [ ] LeadAC'nin nasıl bu pain'leri solve ettiği (2-3 cümle)
- [ ] CTA: free trial
- [ ] OG image
- [ ] Reddit'te kendi post'umuzla repost (community marketing)

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\customer-research\SKILL.md`
- Skill: `c:\Users\meert\.cursor\skills\last30days\SKILL.md`
- Source: `~/Documents/Last30Days/` evidence files

---

## Epic 1.4 — Free Trial → Paid Conversion

> 50 leads + 3 website plans → upgrade prompt. Bu loop monetization'ın kalbi.

### [M1-13] Trial limits enforcement
**Type:** feature
**Area:** billing
**Priority:** Urgent
**Effort:** M
**Owner:** @mert

**Description:**
Free trial: 50 leads, 1 vertical, 1 postcode, 3 website plans. Sınır aşımında kullanıcı upgrade modal görmeli, ama trial içindeyse soft block (queue overnight değil, hard block + upgrade CTA).

**Acceptance Criteria:**
- [ ] `quota.ts`'de FREE plan'ın limit matrix'i tanımlı
- [ ] Discovery API: 51. lead için 402 + upgrade JSON
- [ ] Website plan API: 4. plan için 402 + upgrade JSON
- [ ] UI: upgrade modal (`<UpgradeRequired />` component)
- [ ] Modal'dan tek tık ile Stripe Checkout'a (paywall-upgrade-cro)

**Technical Notes:**
- Dosya: `src/lib/agent-workers/quota.ts`
- Dosya: `src/lib/plans.ts` PLANS table
- Skill: `c:\Users\meert\.cursor\skills\paywall-upgrade-cro\SKILL.md`

---

### [M1-14] Upgrade modal CRO pass
**Type:** feature
**Area:** frontend
**Priority:** High
**Effort:** M
**Owner:** @mert
**Depends on:** [M1-13]

**Description:**
Upgrade modal'ın copy + UX'i konuşma açıcı olmalı. "Limit hit, pay $79" değil — "You've used 50 free leads. Pro gets you 1,000/mo + every vertical. ROI: 1 booked call covers it." Skill: `paywall-upgrade-cro`.

**Acceptance Criteria:**
- [ ] Modal copy çıkartıldı (humanizer + tr-en-marketing-sync)
- [ ] CTA primary: "Upgrade to Pro $79" → Stripe checkout
- [ ] CTA secondary: "Talk to founder" → calendly
- [ ] Dismiss option (24hr cooldown)
- [ ] Analytics event: `upgrade_modal_shown`, `upgrade_modal_clicked`, `upgrade_completed`

**Technical Notes:**
- Component: `src/components/app/upgrade-modal.tsx` (yeni)
- Skill: `c:\Users\meert\.cursor\skills\paywall-upgrade-cro\SKILL.md`
- Analytics: M1-17

---

### [M1-15] Trial expiration email sequence
**Type:** feature
**Area:** engineering
**Priority:** High
**Effort:** M
**Owner:** @cinar (copy) + @mert (sender)
**Depends on:** [M1-13]

**Description:**
Skill: `email-sequence`. Trial start day 1 → onboarding tip. Day 7 → halfway. Day 12 → "2 days left". Day 14 (expired) → reactivation. Resend ile.

**Acceptance Criteria:**
- [ ] 4 email yazıldı (humanizer + tr-en-marketing-sync)
- [ ] Resend templates kuruldu
- [ ] Trigger: BullMQ delayed job (her trial start'ta enqueue)
- [ ] Unsubscribe link
- [ ] Open/click rate analytics

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\email-sequence\SKILL.md`
- Email lib: `src/lib/email/`
- Resend: zaten kuruluı, template helper'lar

---

### [M1-16] Stripe checkout success → workspace upgrade flow
**Type:** feature
**Area:** billing
**Priority:** Urgent
**Effort:** M
**Owner:** @mert

**Description:**
Stripe checkout completion → webhook idempotency check → workspace.plan upgrade → quota reset → confirmation email + UI redirect. Skill: `stripe-billing-audit`.

**Acceptance Criteria:**
- [ ] Webhook signature verification çalışıyor
- [ ] `StripeEventLog` ile dedup
- [ ] `workspace.plan` doğru güncelleniyor (PRO/PRO_TEAM/AGENCY)
- [ ] Quota cycle reset trigger
- [ ] Welcome email (paid) gönderiliyor
- [ ] UI: success page + dashboard redirect

**Technical Notes:**
- Dosya: `src/app/api/billing/webhook/route.ts`
- Skill: `c:\Users\meert\.cursor\skills\stripe-billing-audit\SKILL.md`
- Skill: `c:\Users\meert\.cursor\plugins\cache\cursor-public\stripe\.../skills/stripe-best-practices/SKILL.md`

---

## Epic 1.5 — Onboarding CRO

### [M1-17] Postcode + niche → 47 leads first-run
**Type:** feature
**Area:** frontend
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Skill: `onboarding-cro`. New user signup → onboarding wizard → postcode + niche pick → ilk discovery 60s içinde tetiklenir → user "first 47 lead" experience yaşar. Bu activation için kritik.

**Acceptance Criteria:**
- [ ] Onboarding wizard 3 step (welcome → postcode/niche → first discovery)
- [ ] Wizard tamamlandığında `workspace.onboardingCompletedAt` set
- [ ] İlk discovery sub-200ms response (queued, results stream)
- [ ] "First 5 leads ready" notification + dashboard redirect
- [ ] Activation event tracking (M1-19)

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\onboarding-cro\SKILL.md`
- Mevcut: `src/app/app/onboarding/`
- Activation metric: %onboarding completion + %first lead opened

---

### [M1-18] Empty state + sample data
**Type:** feature
**Area:** frontend
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Lead listesi boşken: "Run your first discovery" CTA + 1 sample lead (read-only, "this is what your leads will look like") + 30s explainer video.

**Acceptance Criteria:**
- [ ] Empty state component
- [ ] Sample lead static (frontend mock, DB'ye yazma)
- [ ] CTA → discovery
- [ ] Tüm app/app/* sayfalarda empty state benzer pattern (deals, todos, watchlist, campaigns)

**Technical Notes:**
- Mevcut empty state'leri tara: `rg -i "no leads yet|empty state" src/components/`

---

### [M1-19] Analytics tracking — activation funnel
**Type:** feature
**Area:** ops
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
Skill: `analytics-tracking`. Funnel: signup → onboarding_started → onboarding_completed → first_discovery → first_lead_opened → first_audit_run → first_opener_generated → upgraded. Her event Mixpanel/PostHog/GA4'e.

**Acceptance Criteria:**
- [ ] Analytics provider seçildi (öneri: PostHog — open source, self-host opsiyonu)
- [ ] Event taxonomy yazıldı (camelCase, env: dev/prod ayrı)
- [ ] Backend: `lib/analytics.ts` helper
- [ ] Frontend: `useAnalytics()` hook
- [ ] Funnel dashboard kuruldu
- [ ] A/B test setup (M1-01 hero variants)

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\analytics-tracking\SKILL.md`
- Skill: `c:\Users\meert\.cursor\skills\ab-test-setup\SKILL.md`
- PostHog vs Mixpanel: PostHog free 1M event/mo, embed-able

---

## Epic 1.6 — Launch Mechanics

### [M1-20] Product Hunt launch prep
**Type:** ops
**Area:** marketing
**Priority:** High
**Effort:** L
**Owner:** @cinar

**Description:**
Skill: `launch-strategy`. PH launch: tagline, gallery, maker comment, hunter outreach (BetaList founders), launch day checklist.

**Acceptance Criteria:**
- [ ] Tagline + 3-line description (humanizer)
- [ ] 5 gallery image (web-asset-generator)
- [ ] Maker comment yazıldı
- [ ] Hunter ayarlandı (varsa)
- [ ] Launch day calendar invite (saat 12:01 PT)
- [ ] T-7, T-3, T-1 social posts hazır

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\launch-strategy\SKILL.md`
- Brand assets: `public/`

---

### [M1-21] Directory submissions (Top 30)
**Type:** ops
**Area:** marketing
**Priority:** Medium
**Effort:** L
**Owner:** @cinar

**Description:**
Skill: `directory-submissions`. SaaS / AI / agency directories: BetaList, TAAFT, AlternativeTo, SaaSHub, Futurepedia, Capterra, G2, GetApp.

**Acceptance Criteria:**
- [ ] 30 directory listesi (skill'in kendi tracker'ından)
- [ ] Her birine submission yapıldı
- [ ] Tracker'da listing URL + status
- [ ] Backlink dashboard (Google Search Console)
- [ ] DR/DA bumped (baseline note)

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\directory-submissions\SKILL.md`

---

### [M1-22] r/coldemail community engagement plan
**Type:** ops
**Area:** marketing
**Priority:** High
**Effort:** L
**Owner:** @cinar

**Description:**
Skill: `community-marketing`. Top commenter outreach (Last30Days evidence), value-first post strategy, AMA on launch day, case study post-launch.

**Acceptance Criteria:**
- [ ] 20 r/coldemail top commenter listesi (cold-email skill ile DM template)
- [ ] 3 value-first post yazıldı (no link, just value, mod onay alır)
- [ ] AMA scheduled
- [ ] Launch day reply strategy (her thread'e 5 dk içinde value reply)
- [ ] Engagement tracker

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\community-marketing\SKILL.md`
- Skill: `c:\Users\meert\.cursor\skills\cold-email\SKILL.md`

---

### [M1-23] Cold outbound to first 50 ICP from r/coldemail
**Type:** ops
**Area:** marketing
**Priority:** Medium
**Effort:** L
**Owner:** @cinar

**Description:**
Self-eat dogfood: LeadAC kullanıp r/coldemail aktif kullanıcılarını lead olarak topla, kişiselleştirilmiş opener + plan ile cold email at. Skill: `cold-email`.

**Acceptance Criteria:**
- [ ] 50 lead toplandı (LeadAC ile)
- [ ] 50 personalized opener gönderildi
- [ ] Reply rate ölçüldü (target: ≥10% — high because targeted ICP)
- [ ] 5 demo booked
- [ ] 1 case study + reply rate proof point

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\cold-email\SKILL.md`
- Self-promotion: ürünün kendisi bu issue'da test edilmiş olur

---

## Epic 1.7 — First Case Study

### [M1-24] First paying customer + case study capture
**Type:** ops
**Area:** marketing
**Priority:** High
**Effort:** L
**Owner:** @cinar

**Description:**
İlk paying Agency-tier müşterisinin reply rate uplift'i public case study. Skill: `customer-research`.

**Acceptance Criteria:**
- [ ] 1 paying customer onboarding tamamlandı
- [ ] Önce/sonra reply rate karşılaştırması
- [ ] 3 verbatim alıntı (consent alınmış)
- [ ] Blog post + landing page case study (humanizer)
- [ ] Homepage hero altı social proof slot'a eklendi

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\customer-research\SKILL.md`

---

## M1 Çıkış Kontrol Listesi

- [ ] 25 paying Agency-tier customer ($249 × 25 = $6k MRR)
- [ ] Marketing site polished (M1-01..06)
- [ ] Programmatic SEO 200+ pages (M1-07..10)
- [ ] AI/GEO SEO citation kanıtı (ChatGPT'de bahsediliyor)
- [ ] Free → Paid conversion funnel çalışıyor (>2% baseline)
- [ ] Onboarding activation rate >40%
- [ ] First case study yayında
- [ ] Reply rate uplift kanıtı (>4% baseline cleared)

**Toplam M1 issue sayısı: 24**


<!-- END FILE: linear/M1-public-launch.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/M2-sub-vertical.md -->
<!-- ============================================================ -->

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


<!-- END FILE: linear/M2-sub-vertical.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/M3-monetization.md -->
<!-- ============================================================ -->

# M3 — Monetization & Growth

> **Status:** Backlog
> **Süre:** 8 hafta
> **Hedef:** $40-55k MRR. Stub worker'ları ship et, native push integration'ları aç, Agency tier feature parity.
> **Exit kriteri:** 8 stub worker'dan en az 5'i live, native push (Instantly + Smartlead), white-label MVP, $30k+ MRR

---

## Epic 3.1 — Stub Workers Implementation

> Registry'de implModule'ü yok olan 8 worker. Pazarlama vaat ediyor ama kod yok. M3'te en az 5'i ship.

### [M3-01] WEBSITE_PLAN_GENERATOR
**Type:** feature
**Area:** ai-core
**Priority:** Urgent
**Effort:** XL
**Owner:** @mert

**Description:**
Pazarlama vaadinin kalbi: "we sell you the first version of the pitch." Handbook-grounded 14-section per-lead website plan. `src/lib/prompts/website-plan-prompt.ts` zaten varmış (product-marketing-context'te bahsediliyor) — varsa bunu worker'a sar, yoksa prompt + worker hep birlikte yaz.

**Acceptance Criteria:**
- [ ] `src/lib/agent-workers/website-plan-generator.ts` worker
- [ ] Registry'de implModule resolve ediyor
- [ ] 14-section structured output
- [ ] Citation pattern (`[website_audit]`, `[review_analyst]`)
- [ ] ~20s generation latency hedef
- [ ] /m/<slug> public mockup page'inde render ediliyor
- [ ] Pro plan: 50 plans/mo, Agency: 300/mo, Free: 3 plan
- [ ] Test coverage ≥%75

**Technical Notes:**
- Prompt: `src/lib/prompts/website-plan-prompt.ts`
- Skill: `prompt-engineering-gemini`
- Quota: `src/lib/agent-workers/quota.ts`

---

### [M3-02] OUTREACH_SENDER (Instantly + Smartlead native push)
**Type:** feature
**Area:** ai-core
**Priority:** Urgent
**Effort:** XL
**Owner:** @mert

**Description:**
"Native push to Instantly/Smartlead" pazarlama vaadi. CSV export var, native push yok. Bu worker bir lead listesini direkt Instantly/Smartlead campaign'ine itiyor.

**Acceptance Criteria:**
- [ ] Instantly API integration (auth, list create, lead push)
- [ ] Smartlead API integration
- [ ] Bulk push (1000 lead'e kadar)
- [ ] Workspace settings'te API key kayıt (encrypted)
- [ ] Push history audit log
- [ ] Rate limit handling

**Technical Notes:**
- Settings UI: yeni page `src/app/app/settings/integrations/`
- Risk: API change → integration adapter pattern (factory)

---

### [M3-03] COPILOT_CHAT (full-page)
**Type:** feature
**Area:** frontend
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Şu an Copilot drawer-only. Tam sayfa `/app/copilot` + sidebar history + tool router (`src/lib/ai-core/router.ts` zaten var). Long-form research, planner triggers.

**Acceptance Criteria:**
- [ ] `/app/copilot` page
- [ ] Mevcut `copilot-drawer` component reuse + expand
- [ ] CopilotMessage tablosu zaten var (schema), history persistence
- [ ] Tool router entegrasyonu (deep research, lookalikes, planner)
- [ ] Streaming SSE responses

**Technical Notes:**
- Mevcut: `src/components/app/copilot-drawer.tsx`
- API: `src/app/api/copilot/route.ts`
- Schema: `CopilotMessage`

---

### [M3-04] VIDEO_SCRIPT_WRITER
**Type:** feature
**Area:** ai-core
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Lead için kısa video script (Loom-style intro). Sub-niche + audit findings + sales angle.

**Acceptance Criteria:**
- [ ] Worker registry'de live
- [ ] Output: 60-90s script (intro, value prop, CTA)
- [ ] Lead detail'de "Video script" tab veya card
- [ ] Quota: Agency only

---

### [M3-05] VOICE_NOTE_TRANSCRIBER
**Type:** feature
**Area:** ai-core
**Priority:** Low
**Effort:** M
**Owner:** @mert

**Description:**
Sales rep voice note kaydeder → Whisper transcribe → lead activity feed'e eklenir. Mevcut `VoiceNote` schema var.

**Acceptance Criteria:**
- [ ] Worker live
- [ ] Audio upload UI (lead detail)
- [ ] OpenAI Whisper veya Gemini transcribe
- [ ] Activity feed integration

**Technical Notes:**
- Schema: `VoiceNote` model exists
- API: `src/app/api/leads/[id]/voice-notes/`

---

### [M3-06] BOOKING_WIDGET_BUILDER
**Type:** feature
**Area:** ai-core
**Priority:** Low
**Effort:** L
**Owner:** @mert

**Description:**
Lead için "this is what your booking widget should look like" mockup HTML. Sub-niche'e göre.

**Acceptance Criteria:**
- [ ] Worker live
- [ ] Output: HTML embed snippet + preview iframe
- [ ] Lead detail'de "Booking widget mockup" tab

---

### [M3-07] GBP_AUTOPOST_AGENT
**Type:** feature
**Area:** ai-core
**Priority:** Low
**Effort:** L
**Owner:** @mert

**Description:**
Lead Google Business Profile'ı için draft post önerileri (haftalık).

**Acceptance Criteria:**
- [ ] Worker live
- [ ] Output: 4 weekly post draft (text + image suggestion)
- [ ] Optional GBP API push (OAuth gerekli)

---

### [M3-08] CONTAINMENT_RATE_TRACKER
**Type:** feature
**Area:** ai-core
**Priority:** Low
**Effort:** M
**Owner:** @mert

**Description:**
Outreach metric: kaç lead'e mesaj atıldı, kaç reply geldi, rate. Lead-level + workspace-level.

**Acceptance Criteria:**
- [ ] Worker live (cron veya event-driven)
- [ ] Workspace dashboard: containment rate widget
- [ ] Per-niche breakdown

---

## Epic 3.2 — Agency Tier Features

### [M3-09] Priority crawl queue (BullMQ priority)
**Type:** feature
**Area:** workers
**Priority:** High
**Effort:** M
**Owner:** @mert

**Description:**
AGENCY plan workspace'leri BullMQ'da daha yüksek priority. Discovery + AI runs queue'larında priority field.

**Acceptance Criteria:**
- [ ] Job enqueue'de plan-aware priority
- [ ] AGENCY: priority 10, PRO: 5, FREE: 1
- [ ] Worker concurrency aynı kalsın, priority sıralama değişsin
- [ ] Test: AGENCY job, FREE job'tan önce çalışıyor

**Technical Notes:**
- Skill: `worker-queue-debug`
- BullMQ priority docs

---

### [M3-10] White-label branding (Settings → Branding)
**Type:** feature
**Area:** frontend
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
AGENCY+ workspace logo, brand color, custom domain (opsiyonel). Public mockup page'leri (/m/<slug>) workspace branding'i kullansın.

**Acceptance Criteria:**
- [ ] Settings → Branding page
- [ ] Logo upload (Supabase Storage)
- [ ] Primary color picker
- [ ] Mockup page'de workspace branding render
- [ ] Custom domain: out of scope (M5)

**Technical Notes:**
- Mevcut: `src/app/app/settings/branding/`
- Schema: workspace.branding JSON field

---

### [M3-11] Team invite flow + role-based access
**Type:** feature
**Area:** frontend
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Team owner invite member → email link → signup → workspace member. Role: OWNER, ADMIN, MEMBER. Permission matrix.

**Acceptance Criteria:**
- [ ] Settings → Team page
- [ ] Invite via email
- [ ] Email template (Resend)
- [ ] Magic link signup → auto-add as MEMBER
- [ ] Permission matrix dokümante
- [ ] OWNER kendisini kovamaz

**Technical Notes:**
- Mevcut: `src/app/api/team/invite/`, `src/app/app/settings/team/`

---

## Epic 3.3 — Email Account Integrations

### [M3-12] Gmail OAuth deep integration
**Type:** feature
**Area:** engineering
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Mevcut email-accounts var. Gmail OAuth: send-as, label sync, thread tracking.

**Acceptance Criteria:**
- [ ] Gmail OAuth scope: gmail.send + readonly
- [ ] Send-as via user's Gmail (not workspace SMTP)
- [ ] Reply detection (thread tracking)
- [ ] Bounce/spam detection

**Technical Notes:**
- Mevcut: `src/app/api/oauth/start/[provider]/`
- Mevcut: `src/lib/oauth/`

---

### [M3-13] Outlook OAuth
**Type:** feature
**Area:** engineering
**Priority:** Medium
**Effort:** L
**Owner:** @mert
**Depends on:** [M3-12]

**Description:**
Outlook/Office365 OAuth, send + read. Microsoft Graph API.

**Acceptance Criteria:**
- [ ] OAuth flow
- [ ] Send + read scope
- [ ] Reply tracking

---

### [M3-14] Custom SMTP support
**Type:** feature
**Area:** engineering
**Priority:** Low
**Effort:** M
**Owner:** @mert

**Description:**
Workspace owner kendi SMTP credentials'ını gir. Encrypted storage.

**Acceptance Criteria:**
- [ ] Settings UI
- [ ] AES-256 encryption (key from env)
- [ ] Test connection button

---

## Epic 3.4 — Advanced Memory + Learning

### [M3-15] ClassifierTrainingExample table
**Type:** feature
**Area:** ai-core
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Override sonrası `{ leadId, predicted, corrected, confidence, source }` log'la. 30 gün içinde N override → admin alert "rule tighten".

**Acceptance Criteria:**
- [ ] Schema: `ClassifierTrainingExample`
- [ ] Override endpoint trigger'da insert
- [ ] Admin dashboard widget: top false-positive patterns

**Technical Notes:**
- Long-term: bu data ile rule auto-tightening (M5)

---

### [M3-16] Per-subniche eval cron
**Type:** feature
**Area:** ai-core
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Haftalık cron: her sub-niche için override rate, classifier accuracy, opener reply rate. >25% override rate → engineering alert.

**Acceptance Criteria:**
- [ ] BullMQ scheduled job
- [ ] Output: weekly report (email + Linear issue)
- [ ] Threshold-based alerting

---

## Epic 3.5 — Multi-Property Aggregator

### [M3-17] Resort/chain group discovery
**Type:** feature
**Area:** ai-core
**Priority:** Medium
**Effort:** XL
**Owner:** @mert

**Description:**
"Land of Legends Antalya" gibi resort'larda parent + 9 child venue. Single discovery → grouped lead. Enterprise pitch için kritik.

**Acceptance Criteria:**
- [ ] Group detection (Google Places parent-child)
- [ ] Aggregated audit (cross-property gaps)
- [ ] UI: grouped lead view (parent + expandable children)
- [ ] Enterprise pitch flow

**Technical Notes:**
- `day-in-the-life.md` "Multi-property aggregator" v1.1 backlog

---

### [M3-18] Cross-property guest CRM ID concept
**Type:** feature
**Area:** ai-core
**Priority:** Low
**Effort:** L
**Owner:** @mert

**Description:**
Hotel F&B opener'larda "property-wide guest CRM ID" pitch açısı. Sub-niche-specific value prop.

**Acceptance Criteria:**
- [ ] Hotel F&B prompt template'inde bu açı vurgulu
- [ ] A/B test: with vs without
- [ ] Reply rate uplift ölç

---

## Epic 3.6 — Localization

### [M3-19] Localized<T> refactor
**Type:** refactor
**Area:** ai-core
**Priority:** Medium
**Effort:** L
**Owner:** @mert

**Description:**
Niche pack'lerde, prompt'larda string'ler `Localized<{ en, tr }>` shape'inde. Lead.country=TR ise opener TR çıksın (workspace.language override).

**Acceptance Criteria:**
- [ ] Type: `Localized<T> = { en: T; tr: T }`
- [ ] Helper: `localized(value, lang)` fallback en
- [ ] Niche pack'lerde pitchAngle, signals localized
- [ ] Opener writer lead.country veya workspace.language'i seçiyor
- [ ] Test: TR lead → TR opener

**Technical Notes:**
- `day-in-the-life.md` "Localized<T> refactor" v1.1 backlog

---

### [M3-20] TR/EN bilingual marketing parity
**Type:** ops
**Area:** marketing
**Priority:** Medium
**Effort:** L
**Owner:** @cinar

**Description:**
Skill: `tr-en-marketing-sync`. Tüm marketing page'lerinin EN + TR versiyonu sync, voice korunmuş.

**Acceptance Criteria:**
- [ ] Tüm /for/* pages TR
- [ ] /vs/* TR
- [ ] Pricing TR
- [ ] Glossary up-to-date
- [ ] Humanizer pass'lendi

**Technical Notes:**
- Skill: `c:\Users\meert\.cursor\skills\tr-en-marketing-sync\SKILL.md`

---

## M3 Çıkış Kontrol Listesi

- [ ] WEBSITE_PLAN_GENERATOR + OUTREACH_SENDER + COPILOT_CHAT live (top 3)
- [ ] 8 stub worker'dan en az 5 live
- [ ] Native push (Instantly + Smartlead) çalışıyor
- [ ] White-label MVP shipping
- [ ] Gmail + Outlook OAuth çalışıyor
- [ ] $30k+ MRR
- [ ] Multi-property aggregator beta'da
- [ ] TR marketing site EN ile parite

**Toplam M3 issue sayısı: 20**


<!-- END FILE: linear/M3-monetization.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/M4-tech-debt.md -->
<!-- ============================================================ -->

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


<!-- END FILE: linear/M4-tech-debt.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: linear/M5-polish-scale.md -->
<!-- ============================================================ -->

# M5 — Polish & Scale

> **Status:** Future (post-launch)
> **Süre:** continuous, sırası M3'ten sonra
> **Hedef:** Mockup template parity, performance optimization, observability, advanced features.
> **Exit kriteri:** Pipeline median <60s, mockup 10 niche için handcrafted, per-workspace observability dashboard, müşteri ölçeği 100+ paying.

---

## Epic 5.1 — Mockup Template Parity

> Şu an 3 niche için handcrafted (fine-dining, bar, qsr). Diğer 7 generic template. Reply rate'i +1-2pp eklemek için her sub-niche kendi template'ine ihtiyaç duyuyor.

### [M5-01] Handcrafted template — fnb-hotel-fnb
**Type:** design
**Area:** design
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Hotel F&B mockup: room-charge button, spa/restaurant cross-sell, multi-property menu. `templates/hotel-fnb-roomcharge.html` reference (`day-in-the-life.md`).

**Acceptance Criteria:**
- [ ] Template: HTML + Tailwind
- [ ] 5 sample property test renders (Mövenpick, Fairmont, Burj Al Arab, Hilton, Marriott)
- [ ] Mobile responsive
- [ ] Opener'da bahsedilen UI öğeleri template'te var

---

### [M5-02] Handcrafted template — fnb-cafe-bakery
**Type:** design
**Area:** design
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Cafe/bakery mockup: QR menu, loyalty card, order-ahead.

**Acceptance Criteria:**
- [ ] Template hazır + 5 sample render
- [ ] Mobile-first design

---

### [M5-03] Handcrafted template — fnb-multi-location
**Type:** design
**Area:** design
**Priority:** Medium
**Effort:** L
**Owner:** @mert

**Description:**
Chain/multi-location: location selector, centralized menu, brand consistency.

---

### [M5-04] Handcrafted template — fnb-ghost-kitchen
**Type:** design
**Area:** design
**Priority:** Low
**Effort:** M
**Owner:** @mert

**Description:**
Ghost kitchen: own ordering site (no UberEats commission), delivery-only branding.

---

### [M5-05..07] Other 4 niche templates (food-truck, casual-dining, airport, etc.)
**Type:** design
**Area:** design
**Priority:** Low
**Effort:** M each
**Owner:** @mert

---

## Epic 5.2 — Performance Optimization

### [M5-08] Pipeline median <60s target
**Type:** refactor
**Area:** ai-core
**Priority:** High
**Effort:** L
**Owner:** @mert

**Description:**
Şu an Discovery → first lead displayed median ne? Profile et, bottleneck bul, optimize et.

**Acceptance Criteria:**
- [ ] Profiling: trace per-stage latency (Discovery → audit → opener → mockup)
- [ ] p50 hedef <60s
- [ ] p95 hedef <120s
- [ ] Bottleneck'ler dokümante + fix

**Technical Notes:**
- Tools: BullMQ metrics, custom timing logs
- Skill: `worker-queue-debug`

---

### [M5-09] Web vitals — Core Web Vitals'ı yeşile çıkar
**Type:** feature
**Area:** frontend
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
Marketing site + product app için Core Web Vitals (LCP, CLS, INP) yeşil. Mevcut `/api/web-vitals` endpoint var.

**Acceptance Criteria:**
- [ ] LCP <2.5s
- [ ] CLS <0.1
- [ ] INP <200ms
- [ ] Real user monitoring dashboard

---

### [M5-10] Lead detail page bundle size optimization
**Type:** refactor
**Area:** frontend
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
`src/app/app/leads/[id]/page.tsx` yüzlerce satır client component. Code-split, lazy-load, tab-switch performance.

**Acceptance Criteria:**
- [ ] Bundle analyzer ile size baseline
- [ ] Per-tab lazy-load (Reviews tab → click'te yüklenir)
- [ ] Tab switch <200ms
- [ ] Bundle size <300KB initial

---

## Epic 5.3 — Admin Observability

### [M5-11] Per-workspace metrics dashboard
**Type:** feature
**Area:** ops
**Priority:** Medium
**Effort:** L
**Owner:** @mert

**Description:**
Admin görsel: per-workspace lead count, AI runs, cost, reply rate, churn risk.

**Acceptance Criteria:**
- [ ] Admin-only `/admin/workspaces/[id]` route
- [ ] Charts: lead growth, AI cost trend, reply rate
- [ ] Churn risk score (login frequency, lead activity)
- [ ] Action: pause workspace, refund, contact

---

### [M5-12] Cost per workspace tracking
**Type:** feature
**Area:** ops
**Priority:** Medium
**Effort:** M
**Owner:** @mert

**Description:**
AgentRun.cost field zaten muhtemelen var. Workspace'e roll-up. Margin per workspace görülsün.

**Acceptance Criteria:**
- [ ] Cost rollup query
- [ ] Workspace margin calculation
- [ ] Alert: margin <50% → review

---

### [M5-13] Sentry / error monitoring
**Type:** feature
**Area:** ops
**Priority:** Medium
**Effort:** S
**Owner:** @mert

**Description:**
Frontend + backend Sentry integration. Error grouping, Slack alerts.

**Acceptance Criteria:**
- [ ] Sentry SDK eklendi
- [ ] Source maps upload
- [ ] Slack alert routing
- [ ] Sample rate budget (50% prod errors)

---

## Epic 5.4 — Advanced Features

### [M5-14] Custom domain (white-label v2)
**Type:** feature
**Area:** engineering
**Priority:** Low
**Effort:** XL
**Owner:** @mert
**Depends on:** [M3-10]

**Description:**
Custom plan: workspace `agency.com/leadac` veya `leads.agency.com` route. CNAME setup + reverse proxy.

**Acceptance Criteria:**
- [ ] Custom domain settings UI
- [ ] CNAME validation
- [ ] Vercel custom domain add via API
- [ ] SSL otomatik (Let's Encrypt via Vercel)
- [ ] Branded mockup pages on custom domain

---

### [M5-15] Vertical pack: HVAC, plumbing, dental, locksmith, optician
**Type:** feature
**Area:** ai-core
**Priority:** Medium
**Effort:** XL
**Owner:** @mert

**Description:**
F&B'den sonraki ICP: home service verticals. Her biri için niche pack (M2-02 pattern).

**Acceptance Criteria:**
- [ ] 5 vertical pack tanımlı
- [ ] Per-vertical search queries, audit checklist, opener prompt
- [ ] Test: 5 sample lead per vertical, classifier accuracy >85%
- [ ] /for/* landing page parity

---

### [M5-16] Workspace-level rate limit redesign
**Type:** refactor
**Area:** ai-core
**Priority:** Low
**Effort:** L
**Owner:** @mert

**Description:**
Mevcut: per-API rate limit. İhtiyaç: workspace-level (AGENCY 10x more requests/min). Redis token bucket.

**Acceptance Criteria:**
- [ ] Token bucket implementation (Redis)
- [ ] Per-plan budget
- [ ] Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] 429 + retry-after header

---

### [M5-17] Public per-lead leave-behind pages (roadmap)
**Type:** feature
**Area:** marketing
**Priority:** Medium
**Effort:** L
**Owner:** @mert

**Description:**
Mevcut `/m/<slug>` mockup HTML route. Roadmap: public, indexable, branded leave-behind pages — first reply'a link olarak yapıştırılır.

**Acceptance Criteria:**
- [ ] Branded layout (workspace branding)
- [ ] Indexable (or noindex toggle)
- [ ] Analytics: kim açtı, ne kadar kaldı
- [ ] Embedded CTA (book demo)

---

## Epic 5.5 — Internationalization Beyond TR

### [M5-18] EU pivot: ES, DE, FR
**Type:** feature
**Area:** ai-core
**Priority:** Low
**Effort:** XL
**Owner:** @cinar + @mert

**Description:**
Skill: `tr-en-marketing-sync` → genişlet. Localized<T> 5 dile.

**Acceptance Criteria:**
- [ ] Type genişletildi: `Localized<T> = { en, tr, es, de, fr }`
- [ ] 3 marketing site EU dilinde
- [ ] Opener writer EU lead'lerde local language

---

## M5 Çıkış Kontrol Listesi

- [ ] 10 niche için handcrafted mockup template
- [ ] Pipeline median <60s
- [ ] Core Web Vitals yeşil
- [ ] Per-workspace observability dashboard live
- [ ] Sentry monitoring çalışıyor
- [ ] HVAC/plumbing/dental vertical pack canlı
- [ ] Custom domain feature stable
- [ ] EU expansion ready (en az 1 dil)

**Toplam M5 issue sayısı: 18**

---

## Toplam Backlog Özeti

| Milestone | Issue sayısı |
|---|---|
| M0 — Beta Hardening | 22 |
| M1 — Public Launch | 24 |
| M2 — Sub-Vertical | 17 |
| M3 — Monetization | 20 |
| M4 — Tech Debt | 19 |
| M5 — Polish & Scale | 18 |
| **Toplam** | **120** |

> Bu draft. Kullanıcı review sonrası M0'daki issue sayısı tester raporlarından kabarabilir, M3+ post-launch insight'larla yeniden şekillenecek.


<!-- END FILE: linear/M5-polish-scale.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: DECISIONS.md -->
<!-- ============================================================ -->

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


<!-- END FILE: DECISIONS.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: COSTS.md -->
<!-- ============================================================ -->

# Project Costs - Leadac AI

Bu dokuman platformun tum API + AI + altyapi maliyetlerini, her chain'in
lead-basina maliyetini, plan tier'larinin tavanlarini ve unit economics'i
icerir. Her sayi 2026 Q2 itibariyledir; vendor pricing'i degistikce
guncellenmesi gerekir.

> **Not**: Bazi sayilar (Gemini, Google Places) approximate. Vendor sayfalari
> sik degistigi icin her uc ayda bir teyit edilmesi gerekir. ZeroBounce,
> Apify ve Stripe sayilarini son 30 gun icinde dogruladik.

## TL;DR

| Sorulan | Cevap |
|---|---|
| Tipik lead-basina ortalama maliyet (auto chain dahil) | **~$0.05** |
| Ek olarak deep research lead-basina | **+$1.85** (Apify) |
| Ek olarak resepsiyonist + KB lead-basina | **+$0.46** (Apify + Gemini) |
| Platform fixed monthly (kullanici sayisi 0 olsa bile) | **~$80-150** |
| FREE plan kullaniciya costu (limit dahilinde) | **~$3-5/ay** (zarar/loss leader) |
| PRO ($79) plan max-out cost | **~$24/ay** (margin %70+) |
| PRO_TEAM ($149) plan max-out cost | **~$58/ay** (margin %60+) |
| AGENCY ($249) plan max-out cost | **~$140/ay** (margin %44+) |

## 1. Cost surface envanter

Platformun para harcadigi her vendor:

| Surface | Vendor | Pricing modeli | Aylik fixed | Variable per kullanim |
|---|---|---|---|---|
| LLM (analiz, mockup, opener, copilot) | **Google Gemini** | Token bazli | $0 | ~$0.01-0.013 / lead |
| Embedding (semantic memory) | **Google Gemini** (text-embedding-004) | Token bazli | $0 | ~$0.000025 / kayit |
| Lead discovery | **Google Places API (New)** | Per request | $0 | ~$0.019 / lead |
| Deep enrichment | **Apify** | Per actor / cred | $5-199 | $0.01-2.00 / actor run |
| Email verification | **ZeroBounce** | Per email | $0 | $0.0008-0.008 / email |
| Database + Auth | **Supabase** | Tier | $0-25/ay (Free->Pro) | bandwidth + storage |
| Hosting + CDN | **Vercel** | Per seat / build | $0-20+/ay | function exec time |
| Redis (BullMQ) | **Upstash Redis** | Per cmd | $0-10/ay | $0.20 / 100K cmd |
| Transactional email | **Resend** | Per email | $0-20/ay | dahili |
| Error monitoring | **Sentry** | Per event | $0-26/ay | dahili |
| Browser pool | **Steel** | Per session | $0 | $0.01/min (video capture) |
| Payment processing | **Stripe** | %fee | $0 | %2.9 + $0.30 / charge |

## 2. Gemini (LLM + embedding) - en sık tetiklenen surface

Tum AI worker'lari (analyze, review intelligence, mockup, opener, copilot,
resepsiyonist) tek bir `GEMINI_API_KEY` uzerinden gidiyor. Platform tek
sahip; tenant'lar paylasiyor.

### Model fiyatlari (2026 Q2 yaklaşıkları)

| Model | Input ($/1M token) | Output ($/1M token) |
|---|---|---|
| `gemini-2.5-flash` | ~$0.30 | ~$2.50 |
| `text-embedding-004` | ~$0.025 | yok |

### Worker basina tipik tuketim

| Worker | Input token | Output token | Maliyet/run |
|---|---|---|---|
| SALES_OPPORTUNITY_SCORER | ~3.000 | ~1.000 | $0.0034 |
| REVIEW_ANALYST | ~5.000 | ~2.000 | $0.0065 |
| WEBSITE_MOCKUP_GENERATOR | ~6.000 | ~4.000 | $0.0118 |
| OPENER_WRITER | ~3.000 | ~500 | $0.0023 |
| AI_RECEPTIONIST_BUILDER (no KB) | ~5.000 | ~3.000 | $0.0090 |
| AI_RECEPTIONIST_BUILDER (with KB chunks) | ~10.000 | ~3.000 | $0.0105 |
| VIDEO_SCRIPT_WRITER | ~2.000 | ~500 | $0.0019 |
| Copilot turn (ortalama) | ~3.500 | ~600 | $0.0026 |
| Embed - 1 kayit | ~500 | yok | $0.0000125 |

**Pratik aciklama**: Gemini maliyeti gercek bir engel degil. 1.000 lead'in tum
auto chain'i ~$10. Asil cost driver Apify; Gemini gurultu seviyesinde.

## 3. Apify - deep enrichment (en pahali surface)

Apify tenant'lara $ cap'li sunulan opsiyonel ozellik. FREE plan'da kapali.

### Actor fiyatlari (2026 Q2 dogrulanmis)

| Actor | Maliyet / lead | Notlar |
|---|---|---|
| **APIFY_GMAPS_DEEP** | $1.00 - $2.00 | 500 review, emails, 6 sosyal link |
| **APIFY_WEB_CRAWL_DEEP** | $0.30 - $0.60 | 50 sayfa markdown crawl |
| APIFY_INSTAGRAM_DEEP | $0.06 | 20 post X $0.003 (experimental) |
| APIFY_FACEBOOK_DEEP | $0.04 | 20 post X $0.002 (experimental) |
| APIFY_TIKTOK_DEEP | $0.06 | 20 video X $0.003 (experimental) |
| **APIFY_SERP_RANK** | $0.01 | 3 sorgu X $0.003 |
| APIFY_COMPETITOR_ADS | $0.02 | 25 reklam (experimental) |
| APIFY_LINKEDIN_COMPANY | $0.05 - $0.10 | HarvestAPI (experimental) |
| APIFY_REDDIT_MENTIONS | $0.02 | 15 mention (experimental) |

**Bold = aktif olarak `user_deep_research` chain'inde calisanlar**.
Faz 1.4 sonrasi diger 6'si experimental flag arkasinda; UI'dan
calistirilmiyor ama kod duruyor.

### Aktif `user_deep_research` (3 worker) maliyet kapsami

```
Lead basina toplam: ~$1.31 - $2.61 (typical $1.85)
```

### Apify hesabi (platform'un satin aldigi)

Plan secimi:

| Apify plan | Aylik | Sundugu | Bizim icin uygun mu |
|---|---|---|---|
| Free | $0 | $5 credit | Dev/test only |
| Starter | $29 | $29 credit | <30 deep research/ay olan SaaS |
| **Scale** | $199 | $199 credit | Onerilen production tier |
| Business | $999 | $999 credit | Cok sayida agency tenant ile |

**Onerilen**: Scale plan ($199/ay). 100+ deep research/ay yapan AGENCY
tenant'larini icine alir.

### Plan tier'a gore aylik USD cap

[`src/lib/agent-workers/quota.ts`](src/lib/agent-workers/quota.ts) icindeki
`MONTHLY_APIFY_USD_CENTS`:

| Plan | Apify monthly cap | Yapacagi tipik deep research / ay |
|---|---|---|
| FREE | $0 | 0 |
| PRO | $5 | ~2-3 lead |
| PRO_TEAM | $25 | ~13-19 lead |
| AGENCY | $100 | ~54-76 lead |

## 4. Google Places API (New) - lead discovery

Lead discovery bu API'yi cagiriyor. Platform tek API key.

### Pricing

| SKU | Birim maliyet | Cagrilan field |
|---|---|---|
| Place Search (Nearby/Text) | $32 / 1.000 request | `searchText` worker |
| Place Details (Pro fields) | $17 / 1.000 request | full lead enrichment |
| Place Photos | $7 / 1.000 photo | optional |

### Lead basina ortalama

```
Search: $32 / 1.000 / ~20 lead per search = $0.0016 / lead
Details: $17 / 1.000 = $0.017 / lead
TOPLAM: ~$0.019 / lead (tipik)
```

Lead discovery cap'i workspace tier'larinda zaten var
(`workspace.leadsCreatedThisCycle`); bu yuzden Google Places spend deterministik.

### Plan tier'a gore aylik lead discovery cap

| Plan | Monthly lead cap | Google Places cost cap |
|---|---|---|
| FREE | 100 | $1.90 |
| PRO | 2.000 | $38 |
| PRO_TEAM | 8.000 | $152 |
| AGENCY | unlimited (soft 50K) | <$950 |

## 5. ZeroBounce - email verification

Optional. `ZEROBOUNCE_API_KEY` setti olmazsa worker silently skip eder.

### Pricing

- Free tier: 100 email/ay
- Volume <100K: $0.008/email
- Volume 100K+: $0.0008/email (tipik production tier)

### Lead basina

Audit tipik 2-5 contact email cikariyor; ortalama 3:

```
3 email X $0.0008 = $0.0024 / lead (Scale tier'da)
```

## 6. Supabase - DB + Auth

Platformun tek DB'si. pgvector icin de tek hesap.

| Plan | Aylik | Limit |
|---|---|---|
| Free | $0 | 500 MB DB, 1 GB storage, 50K MAU |
| **Pro** | **$25** | 8 GB DB, 100 GB storage, 100K MAU |
| Team | $599 | bigger |

**Production icin Pro yeterli**. SemanticMemory tablosu her workspace'te
~5K satir ortalama (~50 MB), 100 workspace = 5 GB DB hala Pro icinde.

## 7. Vercel - hosting

Next.js + serverless functions.

| Plan | Aylik | Sundugu |
|---|---|---|
| Hobby | $0 | Personal use only, ticari yasak |
| **Pro** | **$20/seat** | 1 TB bandwidth, 1M function exec |
| Enterprise | custom | per-seat negotiation |

**Production icin Pro zorunlu** (Hobby ticari kullanim icin lisanssiz).
Tek seat $20/ay; 3 dev'lik takim = $60/ay.

## 8. Upstash Redis - BullMQ

| Plan | Aylik | Sundugu |
|---|---|---|
| Free | $0 | 10K cmd/gun |
| Pro | $10 | 1M cmd/ay (bir AI workspace icin yeterli) |
| Pay as you go | $0.20 / 100K cmd | scale |

Production'da `Pro $10/ay` veya pay-as-you-go. AI worker'lari job basina
~5-10 cmd; 1.000 lead'lik intelligence cycle = ~10K cmd.

## 9. Resend - transactional email

| Plan | Aylik | Sundugu |
|---|---|---|
| Free | $0 | 3K email/ay, 100/gun |
| **Pro** | **$20** | 50K email/ay |

Production icin Pro tipik. Welcome + lead alert + booking notif gunde
~50-100 mail/agency.

## 10. Sentry - error monitoring

| Plan | Aylik | Sundugu |
|---|---|---|
| Developer | $0 | 5K error/ay |
| **Team** | **$26** | 50K error/ay, full stack |

Production: $26 yeterli. AI Core hata oranlari dusuk olmali (ay basi 1-5K
event tipik).

## 11. Stripe - payment processing

Sabit aylik degil; her tahsilat uzerinden.

```
Card processing: 2.9% + $0.30 per successful charge
International card: +0.4%
Stripe Tax: +0.5% (eger acikse)
```

PRO $79 X tipik %3.5 fee = ~$2.77 stripe gider/customer/ay.

## 12. Steel - video capture (optional)

`STEEL_API_KEY` set; ad video'lar uretilirken kullaniyor. Production'da AI
Core'a etkisi yok.

```
~$0.01/dakika (browser session)
```

Ay basi tipik 30-60 dakika capture = $0.30-0.60.

---

## Per-chain cost matematigi

### `lead_created` chain (otomatik, her lead ingest'inde)

```
WEBSITE_AUDITOR (Playwright, self-hosted) ........ $0.000
SOCIAL_SCRAPER (audit'ten cikar) ................. $0.000
REVIEW_ANALYST (Gemini) .......................... $0.0065
EMAIL_VERIFIER (ZeroBounce 3 email) .............. $0.0024  (eger acik)
SALES_OPPORTUNITY_SCORER (Gemini) ................ $0.0034
__EMBED_LEAD_PROFILE__ (Gemini embed) ............ $0.0000125
                                                   ─────────
                                                    $0.012
```

Ek olarak Google Places (discovery sirasinda, lead'in dogusu sirasinda):
```
+ $0.019 / lead
                                                   ─────────
                                                   ~$0.031 / lead toplam
```

### `user_one_click_pitch` (manuel, kullanici tetikler)

```
WEBSITE_MOCKUP_GENERATOR ......................... $0.012
OPENER_WRITER (few-shot retrieval ile) ........... $0.0023
VIDEO_SCRIPT_WRITER (optional) ................... $0.0019
                                                   ─────────
                                                   ~$0.016 / lead
```

### `user_deep_research` (manuel, opsiyonel, $$$)

```
APIFY_GMAPS_DEEP ................................. $1.00 - $2.00
APIFY_WEB_CRAWL_DEEP ............................. $0.30 - $0.60
APIFY_SERP_RANK .................................. $0.01
REVIEW_ANALYST re-run (Gemini) ................... $0.0065
SALES_OPPORTUNITY_SCORER re-run (Gemini) ......... $0.0034
                                                   ─────────
                                                   $1.32 - $2.61
                                                   (tipik $1.85)
```

### `user_receptionist_with_kb`

```
APIFY_WEB_CRAWL_DEEP ............................. $0.30 - $0.60
AI_RECEPTIONIST_BUILDER (KB ile) ................. $0.0105
                                                   ─────────
                                                   ~$0.31 - $0.61
                                                   (tipik $0.46)
```

### Copilot turn

```
Embed query .................................... $0.0000250
pgvector query (DB cost, marjinal) ............. $0.0000010
Gemini call (with retrieved context) ........... $0.0026
                                                 ─────────
                                                 ~$0.0026 / turn
```

---

## Worked scenarios

### Scenario A: Solo SDR, FREE plan

- 50 lead/ay discover, hepsine auto chain
- 5 copilot mesaji/gun = 150/ay
- 0 deep research (FREE'de kapali)
- 0 receptionist (FREE 5/ay limitinde, kullanmiyor)

```
Discovery + auto:  50 X $0.031 = $1.55
EMAIL_VERIFIER:    50 X $0.0024 = $0.12
Copilot:           150 X $0.0026 = $0.39
                                  ──────
                                  $2.06 / ay
```

**FREE = $0 revenue, ~$2 cost = -$2 margin (loss leader, tolerable)**

### Scenario B: PRO solo ($79/ay), 500 lead/ay, 5 deep research

```
Discovery + auto:  500 X $0.031 = $15.50
Email verify:      500 X $0.0024 = $1.20
Pitch packs:       50 X $0.016 = $0.80
Receptionists:     5 X $0.46 = $2.30
Deep research:     5 X $1.85 = $9.25
Copilot:           50/gun X 30 = 1500 X $0.0026 = $3.90
                                                  ──────
                                                  $32.95 / ay
```

Stripe fee: $79 X 3.5% = $2.77

```
Revenue:    $79.00
Cost:       $32.95
Stripe:     $2.77
            ──────
Margin:     $43.28  (~%55)
```

### Scenario C: PRO_TEAM ($149/ay), 2000 lead/ay, 25 deep research

```
Discovery + auto:  2000 X $0.031 = $62.00
Email verify:      2000 X $0.0024 = $4.80
Pitch packs:       100 X $0.016 = $1.60
Receptionists:     15 X $0.46 = $6.90
Deep research:     25 X $1.85 = $46.25 (cap = $25, dolayisiyla blocked +)
                                       (gercek: $25, sonra blocked)
Copilot:           200/gun X 30 = 6000 X $0.0026 = $15.60
                                                   ──────
                                                   $115.90 / ay
```

Apify cap'i $25/ay olarak bagliyor ($46 yerine). Yani gercek total:

```
$62.00 + $4.80 + $1.60 + $6.90 + $25.00 + $15.60 = $115.90
Stripe: $5.22
            ──────
Revenue:    $149.00
Cost:       $115.90
Stripe:     $5.22
            ──────
Margin:     $27.88  (~%19)
```

PRO_TEAM tier marjini en dar. **Buyuk problem**: bu tenant 2000 lead'lik
bir agency. Discovery cost'u tek basina $62. Lead cap'i 8000'e cikarsa
Google Places cost $250/ay'a firlar - margin negatif.

**Cozum**: PRO_TEAM'da lead cap'i 8000'den **3000'e indir** veya
discovery'i tier'a gore stratejik kapat (sadece "yer onerisi" goster,
detail'i kullanici tetiklerse cek).

### Scenario D: AGENCY ($249/ay), 5000 lead/ay, 50 deep research

```
Discovery + auto:  5000 X $0.031 = $155.00  [BUYUK SORUN]
Email verify:      5000 X $0.0024 = $12.00
Pitch packs:       250 X $0.016 = $4.00
Receptionists:     30 X $0.46 = $13.80
Deep research:     50 X $1.85 = $92.50, ama cap $100, OK
Copilot:           500/gun X 30 = 15000 X $0.0026 = $39.00
                                                    ──────
                                                    $316.30 / ay
```

```
Revenue:    $249.00
Cost:       $316.30
Stripe:     $7.50
            ──────
Margin:     -$74.80  (NEGATIVE)
```

**AGENCY tier teorik olarak zarar veriyor**. Buyuk discovery cost'u Google
Places'tan geliyor.

### Cozum onerileri (margin riski icin)

1. **Lead cap'lerini sertlestir**: AGENCY 5K lead/ay degil 2K lead/ay olsun.
2. **Discovery'i ucretlendir**: Lead cap'i kaldirip "1.000 lead = $20 ekstra"
   credit pack sat.
3. **Apify cap'i agresif tut**: AGENCY'de $100 yerine $50.
4. **Google Places yerine Apify GMaps kullan**: Apify alternatif scraper'i
   $0.40-1.20/1.000 - %95 ucuz.

## Platform fixed monthly cost (kullanici sayisindan bagimsiz)

```
Vercel Pro (1 seat, dev only) ................... $20
Supabase Pro .................................... $25
Apify Scale ..................................... $199  (production tier)
Resend Pro ...................................... $20
Sentry Team ..................................... $26
Upstash Redis Pro ............................... $10
                                                  ────
                                                  $300 / ay
```

Eger Apify Starter ($29) yeterli olursa total ~$130/ay.
Eger Apify hic kullanilmiyorsa (sadece native worker'lar) total ~$101/ay.

## Cost monitoring tavsiyesi

Bu dokumanda gosterilen sayilar **gercek olcumler degil tahmin**.
Production ship oncesi su monitoring kurulmali:

### 1. Per-workspace AI spend dashboard

`src/components/app/ai-spend-panel.tsx` (Faz 2.1) workspace settings'e
eklenir. Aylik harcama her vendor icin ayrı:

```
Bu ay: $4.27
  Gemini: $0.45
  Apify:  $3.50
  Discovery: $0.32
  
Kalan butce (Apify): $1.50 / $5.00
```

### 2. Vendor-level alerting

- Apify Scale plan'inda dashboard'dan alert: $150 hit oldugunda email.
- Google Cloud billing alert: $50/ay Gemini total icin email.
- Supabase usage alert: 6 GB DB hit oldugunda Pro -> Team upgrade lazim.

### 3. Per-tenant guardrails

Her tenant icin "ayda max $X bizden satin alabilir" hard cap. Su anki
tier-bazli quota'lar bunu yapiyor ama AGENCY'de **delik** var. Cozum:

```ts
// src/lib/agent-workers/quota.ts
const MONTHLY_TOTAL_CENTS_CEILING: Record<Plan, number> = {
  FREE: 1000,        // $10 max even if usage allows
  PRO: 7500,         // $75 max ~ revenue  
  PRO_TEAM: 14000,   // $140 max < $149 revenue
  AGENCY: 22000,     // $220 max < $249 revenue
};
```

Bu Faz 2.1'in scope'una eklenmeli; AGENCY tier'i mevcut tasarimda
zarar verme riski var.

## Cost optimization firsatlari (gelecek)

1. **Embedding cache**: Ayni text'in tekrar embed edilmesi cogu zaman gereksiz.
   `SemanticMemory.text`'in hash'iyle cache. Tahmini tasarruf: %10-15.
2. **Gemini Pro yerine Flash kullan** (zaten yapiyoruz, kontrol).
3. **Apify yerine kendi Playwright crawler'i** (sadece WEB_CRAWL_DEEP icin).
   Tasarruf: lead basi $0.40, ama dev + maintenance maliyeti yuksek.
4. **Cron pruning**: Memory satirlari 6 ay sonra silinirse DB Pro tier'inda
   kalir (Team $599'a gecmek gerekmez).
5. **AGENCY'de Apify yerine Place Details bulk discount**: Google Cloud'da
   sozlesmeli fiyat negotiate et (>$500/ay'a tetiklenir).

## Kaynaklar (her uc ayda dogrula)

- Google Gemini pricing: <https://ai.google.dev/pricing>
- Google Maps Platform pricing: <https://mapsplatform.google.com/pricing/>
- Apify pricing: <https://apify.com/pricing>
- Apify per-actor pricing: actor sayfasindaki "Pricing" sekmesi
- ZeroBounce pricing: <https://www.zerobounce.net/pricing/>
- Supabase pricing: <https://supabase.com/pricing>
- Vercel pricing: <https://vercel.com/pricing>
- Upstash pricing: <https://upstash.com/pricing/redis>
- Resend pricing: <https://resend.com/pricing>
- Sentry pricing: <https://sentry.io/pricing/>
- Stripe pricing: <https://stripe.com/pricing>

---

**Son guncelleme**: 2026-04-22  
**Sonraki gozden gecirme**: 2026-07-22 (Q3 vendor pricing kontrolu)


<!-- END FILE: COSTS.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: BETA-TESTER-INSTRUCTIONS.md -->
<!-- ============================================================ -->

# LeadAC — Beta Tester Talimatları

Selam! Bu yazı seni LeadAC'i test etmen için hazırladık. Hiç teknik bilgine ihtiyacın yok — internet kullanabiliyorsan tamam.

## Olay nedir?

LeadAC bir robot gibi düşün. Bu robotun işi şu: bir kafe, restoran ya da otel hakkında **internette bulabileceği her şeyi toplayıp** bir not defteri çıkarmak. "Bu kafenin sitesi şöyle, müşterileri şunu seviyor, sitesinde şu eksik, satış ekibi şöyle bir mesaj atabilir…" gibi.

Senin işin: **Robot iyi mi araştırma yapmış, yoksa atmış mı tutturmuş**, ona bakmak. Sen de aynı kafeyi internette araştıracaksın, robotun söylediğiyle senin gördüğünü karşılaştıracaksın, sonra kısa bir not yazacaksın.

Kısacası: robot dedektif olmuş, sen onun ödevini kontrol eden öğretmen olacaksın.

---

## Başlamadan önce

| Şey | Bilgi |
|---|---|
| Site | (sana ayrıca verilecek — `localhost:3000` veya canlı URL) |
| E-posta | `finedine-owner@leadac.beta` |
| Şifre | (proje sahibi sana ayrıca atacak) |

Tarayıcını aç, giriş yap, sol menüden **Leads** sekmesine tıkla. Listeden sana atanan kafeyi/restoranı aç.

> Test sırasında **silme**, **arşivleme**, **gerçek mesaj gönderme**. Sadece bakacaksın, kontrol edeceksin, sonra rapor yazacaksın.

---

## Ekranda göreceğin 5 sekme

Bir lead'i (yani bir işletmeyi) açtığında üst tarafta şu 5 buton var:

1. **Overview** → Robotun yazdığı özet rapor. "Bu işletme ne, neden iyi bir hedef, ne mesaj atılabilir."
2. **Website** → Robotun siteye girip baktıkları. "Site açılıyor mu, mobile uyumlu mu, online rezervasyon var mı, vs."
3. **Workers** → Robotun yaptığı 7 ayrı küçük iş. Her biri farklı şey topluyor — burada hangisi başardı, hangisi bok etti onu göreceksin.
4. **Reviews** → Google'daki müşteri yorumlarından çıkardığı şeyler. "İnsanlar yemekleri seviyor, manzaradan etkileniyor, fiyatları yüksek buluyor."
5. **Outreach** → Hangi aşamada, sosyal hesapları nerede.

Sırayla bunlara bakacaksın. Her sekmede iki şey yapacaksın:

- (1) **UI'da oku** — robot ne demiş?
- (2) **Yeni sekmede aç ve kontrol et** — gerçekte böyle mi?

İşte bu kadar. Tek cümle: **"Robot ne dedi" vs "ben gerçekte ne gördüm".**

---

## Sekme sekme ne yapacaksın

### 1. Overview sekmesi (özet rapor)

Burada uzun bir yazı göreceksin. "Lead Score: 80", "Önerilen paket: …", "Önerilen ilk mesaj: …" gibi şeyler.

**Sen şunu yap:**
- Yazıyı oku.
- Önemli iddialara bak — örnek: "muhteşem deniz manzarası", "3000+ yorum", "aile dostu".
- **Yeni sekme aç → Google'a işletmenin adını yaz → Maps'te aç.** Maps'teki fotoğraflara, açıklamaya, yorumlara bak. Robot atmış mı, yoksa gerçekten öyle mi?
- "Önerilen ilk mesaj" kutusunu oku. Sen olsan bu mesajı gönderir miydin yoksa garip mi geldi? Hayali mi konuşuyor, kafeyi gerçekten tanıdı mı?

Bonus: Yazının içinde `[website_audit]` veya `[review_analyst]` gibi etiketler var. Bu etiketler "şu cümleyi şuradan aldım" demek. Garip bir cümle gördüysen yanındaki etikete bak — kafede gerçekten o özellik var mı?

---

### 2. Website sekmesi (site analizi)

Burada bir sürü kutu var. Hepsi sitenin teknik özelliklerini söylüyor. Korkma — sadece "var/yok" diyor.

**Robot diyebilir ki:**
- "Site açılıyor"
- "Yarım saniyede yükleniyor"
- "HTTPS yok" (yani site güvenlik kilidi yok)
- "WhatsApp linki var"
- "Online rezervasyon yok"
- "QR menü var"
- "Instagram'ı şu, Facebook'u şu"

**Sen şunu yap:**

Yeni sekme aç ve **işletmenin asıl sitesine git**. Robotun söylediği her şey orada gerçekten öyle mi?

| Robot demiş ki | Sen şunu kontrol et |
|---|---|
| Site açılıyor | Sen de aç → açıldı mı, gecikti mi? |
| HTTPS yok | Tarayıcı adres çubuğunda kilit ikonu var mı yoksa "Güvenli değil" mi diyor? |
| Mobil uyumlu | Tarayıcı penceresini daralt, telefon gibi yap → düzgün mü duruyor? |
| WhatsApp linki var | Sitede WhatsApp butonu var mı, tıklanıyor mu? |
| Online rezervasyon var/yok | Bir butonu tıkla — gerçekten masa ayırtabiliyor musun, yoksa sadece "rezervasyon" yazıyor ama ne yapıyor belli değil mi? |
| Yemek siparişi (delivery) | Yemeksepeti, Trendyol Yemek, Getir Yemek butonu var mı? |
| QR menü | Menü tıklayınca dijital olarak mı açılıyor, yoksa eski PDF mi? |
| Instagram / Facebook | Linklere tek tek tıkla → doğru hesaba mı gidiyor, ölü hesap mı, kırık link mi? |
| Tahmini iş tipi | Robot bu işletmeyi ne diye sınıflandırmış (kafe, restoran, balık restoranı, vs.)? Sence doğru mu? Mesela deniz kenarındaki bir aile restoranını "fast food" demişse → yanlış. |

Eğer robot bir şeyi atlamışsa (örnek: TripAdvisor profilleri varmış ama robot yazmamış), bunu rapora yaz.

---

### 3. Workers sekmesi (robotun çalışanları)

Burada robotun 7 farklı küçük çalışanı görünür. Her biri ayrı bir iş yapmış. Bazıları yeşil ✅ (başardı), bazıları kırmızı ❌ (yapamadı) olabilir.

Çalışanların ne yaptığı, basitçe:

| Çalışan | Ne yaptı |
|---|---|
| Site Bakıcı | İşletmenin sitesine girdi, her şeye baktı |
| Yorum Toplayıcı | Google yorumlarından örnekleri çekti |
| Kategori Bulucu | "Bu tam olarak hangi tip iş?" diye kafa yordu |
| Yorum Anlamlandırıcı | Yorumları okuyup özet çıkardı |
| Sosyal Avcı | Instagram, Facebook gibi hesapları buldu |
| Skor Veren | Bu işletme bizim için iyi bir hedef mi diye 100 üzerinden puan verdi |
| Rapor Yazan | Hepsini birleştirip uzun raporu yazdı |

**Sen şunu yap:**
- Hangileri ✅, hangileri ❌? Listele.
- ❌ olanın yanında bir hata mesajı varsa kopyala (örnek: "Failed to embed after 3 attempts").
- **Önemli durum:** Bir çalışan ❌ görünüyor ama Overview / Reviews / Website sekmesinde **yine de o veriyle ilgili bilgi varsa** → bunu özellikle yaz. Bu "yarım kaldı ama bir şeyler kaydedildi" demek, ilginç bir bug.

---

### 4. Reviews sekmesi (yorum analizi)

Burada robot diyor ki "müşteriler yemekleri %100 seviyor, manzarayı %80 seviyor, fiyatları %20 yüksek buluyor" gibi yüzdeler.

**Şunu bil:** Robot, Google'dan **sadece 5 yorum** çekebiliyor (Google'ın bedava limiti). İşletmenin 3000 yorumu olsa bile robot 5 tanesinden çıkarım yapıyor. Yani %100 dediğinde aslında "5 yorumdan 5'i" demek. Bu önemli, raporda yaz.

**Sen şunu yap:**

1. Google Maps'te işletmeyi aç → "Tüm yorumlar"a tıkla.
2. İlk **10-15 yorumu** gözden geçir (Türkçe + İngilizce).
3. Robotun söylediği yüzdeler senin gördüklerinle uyuşuyor mu?
   - Robot: "Yemek %100" → ilk 10 yorumda kaç tanesi yemekten bahsediyor? 8-9'u öyleyse ✅, 3'ü öyleyse ❌.
   - Robot: "Fiyat şikayeti %20" → sen daha çok mu, daha az mı görüyorsun?
4. Robot bazı **alıntılar** yapmış — "outstanding view", "breathtaking" gibi. Bu ifadeler Google'daki yorumlarda gerçekten var mı, yoksa robot uyduruyor mu?
5. **Switch signal:** Robot "kimse rakipten gelmemiş" diyebilir. Ama yorumlarda "Eskiden X kafeye gidiyorduk, artık burayı tercih ediyoruz" gibi bir cümle var mı? Varsa robot kaçırmış demektir.

---

### 5. Outreach sekmesi (satış aşaması)

Burada çok bakacak şey yok. Sadece:
- Sosyal hesap ikonlarına tek tek tıkla → doğru profile gidiyor mu, kırık mı?
- "Copy message" (mesajı kopyala) butonu çalışıyor mu, kopyaladığında doğru mesaj mı yapıştırılıyor?

---

## Yan tarayıcıda hızlı internet turu

Test ederken şu yerlere de uğra (her birinde 1-2 dakika):

- **Google Maps** → "<işletme adı> <şehir>" yaz, ara. Robot ile aynı adres, telefon, puan, yorum sayısı mı?
- **Asıl sitesi** → genel olarak nasıl görünüyor? Ucuz mu duruyor, modern mi? Robotun "site zayıf" yorumu sana da makul geliyor mu?
- **Instagram** → son post ne zaman atılmış? Aktif mi yoksa unutulmuş bir hesap mı?
- **Facebook** → aynısı; ayrıca "Reserve a table" gibi bir buton var mı?
- **Google'da `<işletme adı> rezervasyon`** ara → TripAdvisor, OpenTable, Quandoo gibi başka sitelerde rezervasyon var mı? Robot "rezervasyon yok" demiş olabilir ama 3. parti site üzerinden alıyor olabilir.
- **TripAdvisor / Yelp** → varsa, oradaki yorumların tonu Google'la aynı mı?

Bu 5 dakika robotun gözü görmediği yerleri yakalamana yarayacak.

---

## Rapor şablonu

Her lead için **yeni bir Google Doc / Notion sayfası** aç ve şunu kopyalayıp doldur. Bilmediğin yerlere tahmin yazma, tire (`—`) bırak.

```
# LeadAC Beta Test Raporu

Tester:
Tarih:
Toplam süre: dakika
Lead adı:
Lead şehri:
Lead URL'si (UI'daki):


## A) Tek cümleyle sonuç

[ ] ✅ Robot büyük oranda doğru
[ ] ⚠️ Yarı doğru, eksikler var
[ ] ❌ Yanlış / kafayı yemiş

Tek cümle özet:
> 


## B) Çalışanlar (Workers)

| Çalışan | ✅/❌ | Not |
|---|---|---|
| Site Bakıcı (WEBSITE_AUDITOR) | | |
| Yorum Toplayıcı (GOOGLE_PLACES_REVIEWS) | | |
| Kategori Bulucu (SUBVERTICAL_CLASSIFIER) | | |
| Yorum Anlamlandırıcı (REVIEW_ANALYST) | | |
| Sosyal Avcı (SOCIAL_SCRAPER) | | |
| Skor Veren (SALES_OPPORTUNITY_SCORER) | | |
| Rapor Yazan (LEAD_DOSSIER_GENERATOR) | | |


## C) Site analizi doğru mu?

| Robot demiş | Sen ne gördün? | Eşleşiyor mu? |
|---|---|---|
| Site açılıyor mu | | |
| Yüklenme hızı | | |
| HTTPS (kilit) | | |
| Mobil uyumlu | | |
| İletişim formu | | |
| WhatsApp linki | | |
| Online rezervasyon | | |
| Yemek siparişi (delivery) | | |
| QR menü | | |
| İletişim e-postası | | |
| İş tipi (kafe / restoran / vs.) | | |
| Sosyal hesaplar (her birini tıkla) | | |

Robot kaçırmış mı bir şey?
> 


## D) Yorum analizi doğru mu?

- Robot kaç yorum analiz etmiş? (genelde 5)
- Maps'teki gerçek yorum sayısı:
- Maps'teki ortalama puan:
- Robotun puanıyla uyumlu mu?

Güçlü yön yüzdeleri (sen Maps'te ilk 10 yoruma bak):

| Robot demiş | Robot % | Sen ilk 10'da kaç tane gördün | Tutarlı mı? |
|---|---|---|---|
| | | | |
| | | | |

Zayıf yön yüzdeleri:

| Robot demiş | Robot % | Sen ne gördün | Tutarlı mı? |
|---|---|---|---|
| | | | |

Robotun alıntıları gerçek mi? (3 alıntıyı Google'da arat)
> 

Robotun "kimse rakipten geçmemiş" demesi doğru mu, sen yorumlarda kaçışı yakaladın mı?
> 


## E) Robotun mesajı ve önerisi

- Skor (Overview ve Outreach'ta gösteriyor):
- Önerilen paket:
- Önerilen ilk mesajda:
  [ ] Doğru işletme adı kullanılmış
  [ ] İşletmeye özel bir detay var (manzara, semt, tarz)
  [ ] Türkçe akıcı, garip değil
  [ ] Sen bu mesajı gerçekten gönderir miydin?

Mesajla ilgili düşüncen:
> 


## F) Halüsinasyon kontrolü (3 cümle test)

Overview'daki uzun raporda 3 cümle seç. Her birini Google'da kontrol et — gerçek mi?

| Robotun cümlesi | Gerçek mi? | Notun |
|---|---|---|
| | | |
| | | |
| | | |


## G) Buton/UI sorunları

Test ederken bir şey bozuldu mu?
- [ ] Hayır
- [ ] Evet → ekran görüntüsü ekle, hangi butona basmıştın yaz

> 


## H) Güven puanın (1-5)

- Site analizi doğruluğu: /5
- Yorum analizi doğruluğu: /5
- Önerilen mesajın kalitesi: /5
- Genel raporun kalitesi: /5
- UI sorunsuzluğu: /5

TOPLAM: /25


## I) Final görüşün

Sen satışçı olsan, bu raporla bu işletmeye nasıl yaklaşırdın?

[ ] Robotun yazdığı mesajı olduğu gibi gönderirdim
[ ] Mesajı 1-2 cümle düzenlerdim
[ ] Sıfırdan kendim yazardım, robotun mesajı işime yaramaz

Neden:
> 
```

---

## Önemli kurallar

1. **Hiçbir gerçek e-posta gönderme.** Outreach status'unu değiştirmek serbest, ama mesaj gönderme butonuna basma.
2. **Hiçbir veriyi silme / arşivleme.** Sadece bakacaksın.
3. **Bug bulduysan üç şey gerekli:** ekran görüntüsü + hangi sayfadasın (URL) + hangi butona bastın. "Hata aldım" tek başına yetmiyor.
4. **Halüsinasyon yakaladığında robotun cümlesini birebir kopyala**, kendi kelimelerinle değiştirme. En değerli kanıt birebir alıntıdır.
5. **Tahmin etme.** Bilmediğin yere tire (`—`) koy. Eksik bilgi, yanlış bilgiden iyidir.

---

Hazırsın. İlk lead'i aç, bir tarafta UI, bir tarafta Google Maps + işletme sitesi açık olsun, bu doküman bir tarafta. Soru olursa direkt yaz.


<!-- END FILE: BETA-TESTER-INSTRUCTIONS.md -->


<!-- ============================================================ -->
<!-- BEGIN FILE: docs/email-setup.md -->
<!-- ============================================================ -->

# Email setup — Resend + leadacai.com

Platform-wide transactional email goes through [Resend](https://resend.com) from the `leadacai.com` domain. This doc is the one-shot checklist for a new deploy or a domain migration.

Cold outreach (Gmail/Outlook OAuth) is a separate system and does **not** use Resend. See `src/lib/oauth/email-client.ts`.

## Architecture at a glance

| Channel | Provider | Code path |
| --- | --- | --- |
| Sign-up confirmation, magic link, password reset | Supabase Auth → Resend SMTP | `supabase.auth.*` (no code) |
| Team invite (account activation) | Supabase Auth → Resend SMTP | `src/app/api/team/invite/route.ts` |
| Team invite (branded supplement) | Resend SDK | `src/lib/email/templates/team-invite.tsx` |
| Welcome | Resend SDK | `src/lib/auth.ts` (first workspace creation) |
| Hot lead alert | Resend SDK | `src/workers/analyze-worker.ts` |
| Booking provider detected | Resend SDK | `src/workers/crawl-worker.ts` |
| Billing events (payment failed, plan change, cancel) | Resend SDK | `src/app/api/billing/webhook/route.ts` |
| Cold outreach to leads | OAuth Gmail/Outlook (user's own inbox) | `src/lib/oauth/email-client.ts` |

All Resend sends flow through `src/lib/email/send.ts` → `src/lib/email/client.ts`. In dev the client falls back to a console stub when `RESEND_API_KEY` is empty. In production missing the key throws.

## One-time setup

### 1. Create a fresh Resend API key

Resend Dashboard → **API Keys** → *Create API Key*. Name it `production-leadacai`. Never commit the value. Never paste it into a chat transcript (those are stored on disk and quickly become the weakest link in your secret chain).

### 2. Add `leadacai.com` to Resend

Resend Dashboard → **Domains** → *Add Domain* → `leadacai.com`. Resend will give you four DNS records to add to your registrar. You typically get:

- `TXT send.leadacai.com` — SPF (`v=spf1 include:amazonses.com ~all`)
- `MX send.leadacai.com` — bounce/complaint mailbox (`feedback-smtp.<region>.amazonses.com`, priority 10)
- `TXT resend._domainkey.leadacai.com` — DKIM public key
- `TXT _dmarc.leadacai.com` — recommended: `v=DMARC1; p=none; rua=mailto:dmarc@leadacai.com`

Paste each value *exactly* as Resend displays it. Propagation is usually under 30 minutes. Until verification turns green in the dashboard, sends will return `domain_not_verified`.

Use the `send.` subdomain rather than the apex — it keeps the root MX/SPF free for a mailbox (G Suite, Fastmail) if you ever want one on `@leadacai.com`.

### 3. Configure Supabase Custom SMTP

Supabase Dashboard → **Authentication** → *Email Templates* → **SMTP Settings** → *Enable Custom SMTP*:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<your RESEND_API_KEY>` |
| Sender email | `noreply@leadacai.com` |
| Sender name | `Leadac AI` |
| Admin email | `hello@leadacai.com` |

Once saved, sign-up confirmation, magic link, password reset, and `admin.auth.admin.inviteUserByEmail()` all route through Resend automatically. No code change needed.

While you're there, translate the built-in email templates (*Confirm signup*, *Magic Link*, *Change Email*, *Reset Password*, *Invite*) to Turkish and match the visual tone of `src/lib/email/templates/base.tsx`.

### 4. Set environment variables

Copy the new API key into your environment. Locally that's `.env`:

```
RESEND_API_KEY=re_xxx
EMAIL_FROM="Leadac AI <noreply@leadacai.com>"
EMAIL_REPLY_TO=hello@leadacai.com
```

On Vercel: **Project** → *Settings* → *Environment Variables*. Add the same three keys for Production (and Preview if you want previews to send real mail — usually you don't).

Optional for local dev:

```
EMAIL_DEV_REDIRECT=you@leadacai.com
```

With that set, every email routes to your personal address regardless of the "real" recipient — handy for exercising templates without spamming testing users.

## Exercising templates

The send helper treats `react` as the primary input and auto-renders both HTML and plaintext:

```ts
import { sendEmail } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

await sendEmail({
  to: "you@leadacai.com",
  subject: WelcomeEmail.buildSubject("Mert", "tr"),
  react: WelcomeEmail({
    fullName: "Mert Okumus",
    workspaceName: "Mert's Workspace",
    locale: "tr",
  }),
  tags: [{ name: "type", value: "welcome" }],
});
```

Use `sendEmailAsync` in hot paths (auth flows, workers) where a Resend outage must not block the primary action.

## Deployment checklist

Before flipping production traffic:

- [ ] `leadacai.com` shows **Verified** in Resend Dashboard → Domains
- [ ] Supabase Custom SMTP is enabled and the test button succeeds
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` are set in Vercel (Production)
- [ ] A manual test send (e.g. `npm run test -- email.test`) returns `delivered: true`
- [ ] A magic-link sign-up from a fresh email actually arrives in the inbox from `noreply@leadacai.com`
- [ ] A test invite triggers both the Supabase activation email **and** the branded supplement
- [ ] Resend Dashboard → Emails shows the sends grouped by `tags.type`

## When things go wrong

| Symptom | Likely cause |
| --- | --- |
| All sends skipped, dev logs `email.no_api_key_dev_stub` | `RESEND_API_KEY` empty — expected in local dev without a key |
| `delivered: false, error: "domain_not_verified"` | DNS not propagated or TXT value mistyped; re-check Resend Dashboard → Domains |
| Supabase auth emails still come from `noreply@mail.app.supabase.io` | Custom SMTP not enabled or credentials wrong; use the test button in the SMTP Settings panel |
| Booking/lead alerts never fire | Workspace owner's email is `*@user.local` or missing; only real addresses are eligible |
| Same alert sent many times during a bulk run | Cooldown Redis key isn't being set — check Redis health, then `email-cooldown:*` keys |
| Dev redirect emails go to real users | `EMAIL_DEV_REDIRECT` is set but `NODE_ENV` is `production` — redirect is ignored in prod by design |

## Secret rotation

If a Resend key leaks (committed, pasted in chat, leaked in a screenshot):

1. Resend Dashboard → **API Keys** → revoke the old key immediately.
2. Create a fresh key.
3. Update Vercel env vars and redeploy.
4. Update Supabase Custom SMTP (Authentication → SMTP Settings) with the new key.
5. Optionally update your local `.env`.

Supabase-side custom SMTP passwords aren't readable after save, so a leaked key *plus* a missed Supabase update would produce 5xx `smtp_auth_failed` on every auth email — use the Supabase SMTP test button after rotation to confirm both ends match.


<!-- END FILE: docs/email-setup.md -->

