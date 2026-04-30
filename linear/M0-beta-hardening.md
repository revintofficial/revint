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
