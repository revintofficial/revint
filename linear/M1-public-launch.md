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
