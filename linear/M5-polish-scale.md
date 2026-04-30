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
