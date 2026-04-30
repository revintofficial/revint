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
