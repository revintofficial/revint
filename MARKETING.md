# Lead Engine - Marketing Paper

> Positioning, messaging, and go-to-market for **Lead Engine** - a B2B prospecting platform that turns Google Maps into a curated, AI-scored sales pipeline for local-service verticals, with a built-in **Website Generator** module that turns every lead into a tangible "here's what we'd build for you" deliverable.

**Prepared:** 2026-04-19
**Research basis:** 12 community signals from the last 30 days (Reddit r/coldemail, r/sales, r/SaaS, r/agency, r/Entrepreneur, r/smallbusiness, r/AiAutomations) - 261 upvotes, 490 comments. Full raw evidence in `~/Documents/Last30Days/`.

---

## 1. Executive summary

**The thesis (validated this month):** Apollo and Clay sell the same 50M contacts to everyone. The next edge in cold outreach is a fresh, hyper-local source that competitors aren't scraping yet - **Google Maps / Places** - paired with per-lead website intelligence and AI-generated personalization. Lead Engine ships exactly that, and then takes one step further: it produces a **per-lead website plan** the SDR can drop into the first reply as a leave-behind.

**The wedge:** Phone-repair shops in London. A vertical small enough to win, painful enough to pay for, and structurally identical to dozens of adjacent local-service verticals (HVAC, plumbing, locksmiths, dental, auto-detailing, opticians) we expand into next.

**The promise to buyers:**

> "Give us a postcode and a vertical. We give you back a ranked list of local businesses, a website audit on each one, a personalized opener you can send today, and a complete website plan the prospect can read and react to. Your reply rate clears the 3-4% industry baseline because the leads aren't burnt, the message isn't a Mad Lib, and the follow-up is a deliverable - not another nudge."

**Why now:** Three convergent shifts make this the right month to push:

1. r/coldemail is openly debating that Apollo/Clay lists are saturated (top thread: 24 upvotes, 121 comments, posted 5 days ago).
2. Local-service operators are explicitly asking how to do ICP work on plumbers/HVAC/electricians where standard B2B data tools fail (top r/coldemail post, 4 days ago).
3. Local SEO is shifting to "GEO" - generative-AI search results - which raises the value of a structured, machine-readable view of local businesses (r/DigitalMarketing, 50+ comments).

---

## 2. Market signal: what people are actually saying right now

These are not invented quotes. They are top-scoring posts from the last 30 days, pulled live by the `/last30days` skill on 2026-04-19.

| Signal | Source | Why it matters for Lead Engine |
|---|---|---|
| **"Google Maps is the most underrated lead database in cold email."** Lists three reasons: businesses self-update it, every local business is on it, fresher than scraped lists. | r/coldemail, 2026-04-14, 24 upvotes, **121 comments** | This is our entire thesis, posted by a stranger, upvoted by the exact buyer we sell to. |
| **"What does ICP actually mean for home service businesses? The usual B2B data tools don't work here."** Specifically calls out plumbers, HVAC, pest control, electricians. | r/coldemail, 2026-04-15, 9 comments | Our ICP is the operator who feels this pain. The product is the answer. |
| **"Sent 60,000 emails in March - most cold email advice is wrong."** Establishes that 3-4% reply rate at >96% deliverability is the realistic bar. | r/coldemail, 2026-04-15, 35 comments | Sets the benchmark our case studies must beat. Anything sub-3% is a story we can't tell. |
| **"The exact cold email script that got me 12%+ positive reply rate."** Heavy use of `{{firstName}}` / `{{companyName}}` template variables on a curated list. | r/coldemail, 2026-03-31, 52 upvotes, 83 comments | Proves personalized outreach beats spray-and-pray 3x. Our Gemini layer ships this for free. |
| **"If you're using AI for cold outreach, are you OK with the damages?"** Engineer using AI tools but rewriting every message himself because the AI output was hurting his brand. | r/agency, 2026-03-31, 22 upvotes, 78 comments | Pure-AI outreach has a quality ceiling. Our positioning is "AI ranks and drafts, human ships" - not "AI sends." |
| **"Local SEO is shifting to GEO (Generative AI Search). I'm trying to adapt for local clients."** Customers increasingly find local services via ChatGPT/Perplexity. | r/DigitalMarketing, 2026-03-30, 10 comments | Structured local-business data + AI scoring is a hedge against the SEO collapse. |

**One-line takeaway:** the buyer is in the room, asking for the product. We just have to put it in front of them.

---

## 3. The differentiator: Website Generator

Every other lead tool stops at "here's the contact." Lead Engine ships the next move for the SDR - a generated website plan grounded in the prospect's actual audit findings, reviews, and missing features. This is the wedge that turns Lead Engine from a list-builder into a **value engine**.

### 3.1 What it does

For any lead in the workspace, the system generates:

- A full **website plan** (page structure, sections, copy directions, CTAs, pricing model, SEO notes, accessibility checklist) based on the live audit, Google reviews, and sales-opportunity scoring.
- A **personalized hook** the SDR can drop into a reply: *"Here's the 12-page site we'd build to fix the three issues we found - landing in your inbox in 60 seconds."*
- A **landing-page mockup** for high-priority leads (next milestone - see §12 roadmap).

The plan generator is grounded in a 14-section professional handbook (SEO, Core Web Vitals, security headers, accessibility, PWA, deployment) so the output is consultative, not generic AI slop.

### 3.2 Build status (so we don't oversell it)

| Component | Status | Where it lives |
|---|---|---|
| Per-lead website plan generator (Gemini 2.5 Flash, 14-section handbook prompt) | **Shipped** | `src/lib/prompts/website-plan-prompt.ts`, `src/app/api/website-plan/[leadId]/route.ts` |
| Audit-grounded inputs (features, reviews, sales opportunity) | **Shipped** | `src/lib/audit-checklist.ts`, `src/lib/extractor.ts`, Prisma `websiteAudit` + `googleReviews` + `salesOpportunity` |
| Plan UI in lead detail page | **Shipped** (basic) | Workspace lead detail view |
| Static landing-page mockup (HTML/Tailwind preview from the plan) | **Next milestone** | TBD in `src/lib/website-mockup/` |
| Public, indexable per-lead "GEO leave-behind" page | **Roadmap** | See §12 |

We talk about the plan generator as live (it is), and the landing-page mockup as "shipping next sprint" - never as if it's already in production.

### 3.3 Why this changes the buyer's math

| Without website generator | With website generator |
|---|---|
| SDR sends an opener, prays for a reply, follows up with a nudge. | SDR sends an opener, attaches a 1-page plan summary, reply rate compounds. |
| Reply = "what would this cost?" → SDR has to research. | Reply = "what would this cost?" → SDR already has scope, sections, and CTA structure to quote against. |
| Lead Engine competes on data freshness alone. | Lead Engine competes on data freshness + a deliverable that takes a competing tool a 30-min consult to produce. |

> **Positioning line:** "We don't just sell you the lead. We sell you the first version of the pitch."

---

## 4. The problem (in our buyer's words)

Three pain clusters dominate every thread above:

1. **Saturated data.** "Same 50M contacts. Same data from the same crawls. Same emails that have been cold emailed by 10 other people this month." Apollo, ZoomInfo, Lusha, Clay are commoditized. Every SDR is hitting the same inboxes.
2. **No usable ICP for the local segment.** Standard B2B tools assume LinkedIn-rich SaaS buyers. Plumbers, HVAC techs, locksmiths, repair shops don't show up cleanly. Operators end up scraping Google Maps manually in spreadsheets.
3. **AI outreach quality collapse.** Tools that auto-generate cold emails produce slop that hurts deliverability and brand. Operators want AI to do the **research** and **first draft**, not press send.

Lead Engine resolves all three:

- Source: live Google Places API, refreshed per discovery run, never the Apollo dump.
- Coverage: built specifically for local service verticals.
- AI role: rank + draft, never auto-send. The human SDR ships the message - and now ships a website plan with it.

---

## 5. Positioning

**Category:** Vertical lead intelligence + value-engine platform for local-service B2B sales.

**Positioning statement:**

> Lead Engine is the lead-discovery, outreach, and website-value platform built for SDRs and agencies that sell to local service businesses. Where Apollo gives you a stale spreadsheet of 50M contacts everyone else has, Lead Engine gives you a fresh, ranked list of every plumber, repair shop, or HVAC company in a postcode - each one with a Playwright website audit, an AI-generated quality score, a personalized opener, **and a full website plan you can hand the prospect on the first reply**. Reply rates that clear the cold-email industry baseline because the data is fresh, the copy isn't generic, and the follow-up is a deliverable.

**Anti-positioning (who we are not):**

| We are NOT | Why this matters |
|---|---|
| An Apollo replacement for SaaS sales. | Different ICP, different data source. We don't fight on enterprise contact databases. |
| An auto-sender like Instantly or Smartlead. | We feed those tools - we're the upstream layer. Pairs cleanly. |
| A LinkedIn scraper. | LinkedIn coverage of local service operators is poor. We use the source they actually maintain: their Google Business Profile. |
| A generic AI SDR. | Pure-AI SDRs have a trust problem (see r/agency thread). We are AI-assisted, human-shipped. |
| A Webflow / Framer competitor. | The website generator is a **sales artifact**, not a hosted CMS. We hand off the plan; the agency builds (or upsells) the actual site. |

---

## 6. Product → market mapping

Each Lead Engine feature maps to a community-validated pain.

| Lead Engine capability | Community pain it answers | Evidence |
|---|---|---|
| Google Places-powered discovery by borough / postcode + vertical | "Same Apollo exports as everyone else" | r/coldemail "Google Maps is the most underrated lead database" (121 comments) |
| Playwright-driven website audit (booking? mobile? speed? schema?) | "I have to research every lead manually before I can write copy" | r/agency thread (78 comments) |
| Gemini 2.5 Flash AI scoring + segmented campaigns ("no website", "old website", "no booking", "high potential") | "What does ICP actually mean for plumbers / HVAC / electricians?" | r/coldemail ICP post |
| Personalized message generation grounded in audit findings | 12% positive reply rate is achievable with real personalization | r/coldemail script post (52 upvotes, 83 comments) |
| **Website plan generator (per-lead, handbook-grounded)** | "AI outreach is slop - I want it to do the research, not press send" | r/agency AI-damage thread (78 comments) - we ship a deliverable, not a bulk-send |
| Multi-tenant workspaces, team invites, pipeline + watchlist | Agencies running this for multiple clients | r/agency, r/SaaS recurring theme |
| BullMQ-driven background workers for crawl + analyze | Operators don't want to babysit scrapers | Implicit in every "I sent 60k emails" post |

---

## 7. Team and roles

Lead Engine is built and taken to market by a three-person founding team. Roles are crisp on purpose - no overlap, no ambiguity about who ships what.

### 7.1 Mert - CTO / Product / Infrastructure

- SaaS architecture and core product (Next.js, Prisma, BullMQ, Playwright, multi-tenant).
- Discovery, audit, scoring, outreach, billing, workspace platform.
- Website Generator engine: prompt system, audit-grounded plan output, mockup pipeline.
- Performance, deliverability infra, analytics plumbing, paid acquisition wiring.
- DRI for: anything that runs in production.

### 7.2 Çınar - Growth / Marketing / AI Analyst & Vibe-Coder

- SaaS positioning and category strategy (owns this paper as it evolves).
- Content strategy, SEO, GEO, landing-page optimization (`/for/phone-repair`, `/for/plumbers`, etc.).
- Competitor + market analysis - runs the `/last30days` skill weekly, owns the evidence files in `~/Documents/Last30Days/`.
- **AI analysis ownership:** prompt evaluation, scoring-output QA, website-plan-output QA. Reads samples weekly, opens issues with concrete prompt diffs.
- **Vibe-coding:** ships marketing-side React components, landing-page experiments, demo widgets, in-app onboarding copy. Doesn't touch core product code paths; lives in `src/app/(marketing)/` and content/landing surfaces.
- DRI for: pipeline above the app (traffic, signups, positioning, top-of-funnel attribution).

### 7.3 Kaan - Content / Distribution

- Demo videos (90-second loom for landing page; vertical-specific demos for each new pack).
- Viral-shaped content production (short-form video, screen recordings, before/after mockup reveals).
- Social distribution: X / sales-AI Twitter, YouTube partner outreach (Alex Berman, Charlie Morgan, Robb Bailey, lead-gen-agency channels).
- Creator coordination and production logistics.
- DRI for: every video asset and every distribution moment outside organic Reddit.

### 7.4 Working agreements

- **Single source of truth for go-to-market:** this paper. Çınar owns updates; Mert and Kaan PR-comment.
- **AI-output reviews:** Çınar samples 10 website plans + 10 outreach drafts per week; flags regressions in a shared issue.
- **Vibe-coded landing pages** ship behind a feature flag and a marketing-only route to keep the core app stable.

---

## 8. Ideal Customer Profile

### Primary ICP: the digital agency owner

- Runs a 1-10 person agency.
- Sells web design, SEO, paid ads, or done-for-you booking systems to local service businesses.
- Already does cold email but is hitting saturation on Apollo/Clay lists.
- **Resonates extra hard with the website generator** - the plan output *is* the agency's deliverable, pre-drafted.
- Pays $99-$499/mo for tools without thinking. Pays $1k+/mo if it generates 1 booked call.
- Lives in r/agency, r/SaaS, r/coldemail, X (sales-AI Twitter), and YouTube (Alex Berman, Charlie Morgan, Robb Bailey).

### Secondary ICP: the in-house SDR / BDR at a vertical SaaS

- Sells SaaS *into* local service businesses (booking software, payments, dispatch tools, POS).
- Has a defined geographic territory.
- Currently runs LinkedIn Sales Navigator + Apollo and gets 1-2% reply rates.
- Uses the website plan as a "here's why your current site can't book this" wedge for booking-software pitches.

### Tertiary ICP: the founder doing their own sales (years 0-2)

- Same product as ICP #1 or #2, but solo.
- Lead Engine is the wedge that lets them stop scraping Google Maps in spreadsheets at midnight.

### What disqualifies a lead

- Sells exclusively to enterprise SaaS (use Apollo).
- Sells consumer products (wrong tool).
- Refuses to send any cold outreach (philosophical mismatch).

---

## 9. Messaging frameworks

### 9.1 Cold email (for our own outbound)

Modeled on the validated 12% positive-reply script structure. Short subject. Specific opener grounded in something only Lead Engine could know about the prospect. The website-plan deliverable is the explicit hook.

```
SL: {{firstName}}, your r/coldemail post

Hey {{firstName}},

Saw your post about Google Maps being the underrated lead database -
agreed completely. We built the version of that idea you'd actually
want to use.

Drop us a postcode + vertical and tomorrow morning you'll have a
ranked list of every business in it, a website audit on each one,
a first-draft opener you can ship from your inbox, AND a per-lead
website plan you can attach to the first reply.

Free pilot on the first 50 leads + 5 generated website plans.
Worth 10 minutes?

- {{senderFirstName}}
Lead Engine | leadengine.io
```

### 9.2 LinkedIn / X DM opener

```
{{firstName}} - your March cold-email recap was the best thing in r/coldemail
this quarter. The 3-4% reply / 96%+ deliverability bar is exactly the
benchmark we're trying to beat with fresher data + a real deliverable
in the follow-up.

We pull from Google Places instead of the Apollo dump and ship a per-lead
website plan with every send. Happy to send you 50 free leads + 5 plans
in your vertical if you want to A/B against your current list.
```

### 9.3 Demo opener (90 seconds, screen-shared)

1. "Pick a London postcode." (Type into Discovery.)
2. "Pick a vertical." (Phone repair, today. HVAC, plumbing, dental on the roadmap.)
3. Show 30 seconds of crawl + score running.
4. Open one lead detail page: Google Places info → Playwright audit (mobile score, has-booking, last-updated) → Gemini analysis → generated opener.
5. **Click "Generate website plan."** Show the 14-section, handbook-grounded plan rendering in ~20 seconds.
6. "That's 47 ranked, audited, personalized leads in under 5 minutes - and a website plan attached to the highest-priority one. What does that take you today?"

### 9.4 Three taglines to A/B

- **A.** "Apollo, but fresh and local - with a website plan attached."
- **B.** "Every local business in your postcode, ranked, called, and pitched."
- **C.** "Lead + Website Value Engine. Not just the contact - the deliverable."

---

## 10. Distribution playbook (where to actually find ICP this quarter)

Rank-ordered by signal strength from the research.

| Channel | Tactic | Why it works (evidence) | Owner |
|---|---|---|---|
| **r/coldemail** | Reply with concrete value to the "Google Maps is underrated" thread; weekly tactical posts of our own (e.g. "We crawled every London postcode for plumbers - here are 5 patterns we found, plus a sample website plan for one of them"). | 121 comments on a single thread = highest-engagement community in our space. | Çınar |
| **r/agency** | Case-study post: "How we used Lead Engine to fill an SDR's calendar in vertical X - and used the auto-generated website plans as the closing artifact." | r/agency thread on AI-outreach damage shows the audience is hungry for tools that *don't* embarrass them. | Çınar |
| **r/SaaS, r/Entrepreneur** | Build-in-public threads when we ship a new vertical or a website-mockup feature. Engagement-first, not pitch-first. | "Feedback please" agency post got 36 score with 4 comments - low bar to break through. | Çınar |
| **X / sales-AI Twitter** | Free leads-in-your-postcode hook DM'd to mid-following sales-AI accounts (1k-30k followers). Include a one-page generated website plan as the proof. | Founders here amplify novel data sources eagerly. | Kaan |
| **YouTube partner content** | Sponsor or guest on Alex Berman, Charlie Morgan, lead-gen-agency channels. Demo segment ends on the website-plan reveal. | Their audience is exactly ICP #1. | Kaan |
| **Short-form video** | 30-60s screen recordings: "Watch Lead Engine generate a website plan for a real London plumber in 20 seconds." Repurpose across X, LinkedIn, TikTok, YouTube Shorts. | Mockup reveals are inherently shareable; this is a visual product. | Kaan |
| **GEO / generative-AI search** | Structured `<script type="application/ld+json">` Organization + Product schema, plus deep landing pages per vertical (`/for/plumbers`, `/for/phone-repair`). Per-lead public "leave-behind" pages later. | r/DigitalMarketing GEO thread confirms buyers are searching ChatGPT/Perplexity for tools - we want to be the answer. | Çınar (content) + Mert (schema infra) |

**Anti-channel:** generic Google Ads on "lead generation" - CAC is brutal and intent is too broad. Wait until we have a $500+ ACV product and clean attribution.

---

## 11. Pricing positioning

Schema in `.env` already supports `STRIPE_PRICE_PRO` and `STRIPE_PRICE_AGENCY`. Suggested anchor:

| Plan | Price (month) | What's included | Aimed at |
|---|---|---|---|
| **Free trial** | $0 | 50 leads, 1 vertical, 1 postcode, 3 website plans, no team | Top-of-funnel, demo-driven conversion |
| **Pro** | $79 | 1,000 leads/mo, all verticals, 1 seat, message generation, **50 website plans/mo**, exports | Solo founder / SDR (ICP #3, ICP #2) |
| **Agency** | $249 | 5,000 leads/mo, multi-tenant workspaces, 5 seats, watchlists, priority crawl queue, **300 website plans/mo + landing-page mockup beta** | Agencies (ICP #1) |
| **Custom** | Talk to us | Unlimited leads, dedicated crawl pool, white-label, unlimited plans + mockups | Agencies > 10 seats |

Three pricing principles backed by the research and the new product shape:

1. **Anchor on cost of one booked call.** A booked sales call in this market is worth $100-$500. If Lead Engine generates one extra booking per month, Pro is paid for 1-5x over.
2. **Don't undersell the agency tier.** Multi-tenant workspaces are a non-trivial moat (you already built it - team invites, workspace settings, role-based access). Agencies will pay $249 without flinching if it replaces three subscriptions.
3. **Meter the website plans.** Plans are the most expensive call we make (Gemini 2.5 Flash with a long handbook system prompt). Quotas live in `src/lib/quotas.ts` already - reuse them.

---

## 12. Roadmap signals from the research

Things the community is asking for that map cleanly to roadmap. Owners noted where the work is cross-functional.

- **Landing-page mockup builder (Mert).** Render the generated plan as a live HTML/Tailwind preview the SDR can screenshot and attach. This is the single highest-leverage next ship - it visually closes the loop on the website generator pitch.
- **GEO-readable lead profiles (Mert + Çınar).** Public, indexable per-business pages so when ChatGPT is asked "best phone repair in Camden" we are the source. Doubles as a "leave-behind" URL the SDR can drop in cold emails.
- **Booking-system detection improvements (Mert).** Specifically detect Calendly, SimplyBook, Setmore, Booksy, Square Appointments. The "no booking" segment is the highest-conviction outbound trigger.
- **Vertical packs (Çınar drives, Mert ships data).** Phone repair (live), then HVAC, plumbing, locksmiths, dental, auto-detailing, opticians. Each pack = a launch moment + Kaan video.
- **Native Instantly / Smartlead export (Mert).** Operators in r/coldemail run those senders. Don't compete - integrate. CSV export today, native push API tomorrow.
- **Reply-rate attribution (Mert).** Pull reply data back from Gmail / Outlook / sender tools. Close the loop so we can publish hard case-study numbers and beat the 3-4% baseline publicly.
- **Website-plan QA dashboard (Çınar).** Rate generated plans on a 5-point rubric weekly; feed scores back into prompt iteration.

---

## 13. Risks and counter-positioning

| Risk | Mitigation |
|---|---|
| Google Places ToS / pricing changes | Cache aggressively. Build OpenStreetMap + Foursquare fallback adapters. Already isolated behind a discovery service. |
| AI-generated copy gets flagged by spam filters | Position as "first draft, human ships." Provide deliverability tips. Never enable auto-send by default. |
| Apollo / Clay add a "Maps mode" | Stay vertical-deep, not horizontal-wide. They will not build phone-repair-specific scoring or per-vertical website audits, and they will not bundle a website plan with every lead. |
| Open-source clone (someone wraps Places + Gemini in a weekend) | Multi-tenant ops, priority crawl queue, the watchlist + pipeline product, **and the handbook-grounded website-plan prompt system** are the moat - not the discovery query. |
| **Website-generator scope creep into "Webflow killer"** | Hard line: we ship plans + screenshot-grade mockups, not hosted sites or a CMS. The artifact is a sales tool, not a deliverable web product. |
| **AI-plan output quality regresses silently** | Çınar's weekly QA dashboard. Sampled outputs scored 1-5 against the 14-section rubric. Prompt diffs gated by score. |

---

## 14. The 30-day launch sprint

Concrete actions to ship this paper into the market. Owners assigned per the roles in §7.

| Week | Action | Owner | Output |
|---|---|---|---|
| 1 | Land `/for/phone-repair` vertical landing page with 3 case-study leads + 1 embedded sample website plan. Schema.org markup for GEO. | Çınar (content + vibe-code) + Mert (schema/build infra) | Indexable page, opengraph-ready, plan visible above the fold |
| 1 | Ship landing-page mockup (HTML/Tailwind preview) v0 from existing plan output. | Mert | New route under lead detail; "screenshot this" button |
| 1 | Comment in 3 r/coldemail threads with concrete value (no link drop). | Çınar | 3 threads, 1 backlink earned |
| 2 | Publish "We crawled every London postcode for phone repair shops - here's what we found, plus the website plan we'd build for the worst one" on the blog and r/coldemail. | Çınar | 1 viral-shaped post |
| 2 | Ship native CSV export to Instantly / Smartlead format. | Mert | Feature ships, blog announces |
| 2 | Cut 30-second video: "Watch Lead Engine generate a website plan for a real plumber in 20 seconds." | Kaan | 1 short-form asset, distributed across X / LinkedIn / Shorts |
| 3 | Record 90-second demo loom (per §9.3, ending on the website-plan reveal). Embed on landing page + Pricing. | Kaan + Çınar (script) | 1 video, 1 conversion lift |
| 3 | Cold-email the top 50 commenters from the validated r/coldemail threads with the script in §9.1. | Çınar | 50 sends, target 5-7 replies |
| 3 | Ship website-plan QA dashboard v0 (read-only sample viewer + 1-5 score field). | Mert (build) + Çınar (rubric + first 20 reviews) | Working internal tool, first 20 plans scored |
| 4 | Publish first paying-customer case study with reply-rate numbers vs. their previous Apollo list, and how the attached website plans affected reply quality. | Çınar (write) + Kaan (video cut) | 1 case study, 3 testimonials, 1 video |

---

## Appendix A: source material

All citations pulled live by the `/last30days` skill on 2026-04-19. Raw evidence files saved to `~/Documents/Last30Days/`:

- `lead-generation-for-local-service-businesses-raw-leadgen.md`
- `ai-personalized-cold-email-outreach-raw-personalized.md`

**Top-engagement threads (re-read these monthly):**

- [Google Maps is the most underrated lead database in cold email](https://www.reddit.com/r/coldemail/comments/1sl3go9/google_maps_is_the_most_underrated_lead_database/) - r/coldemail, 24 up / 121 comments
- [What does ICP actually mean for home service businesses?](https://www.reddit.com/r/coldemail/comments/1smj2z6/what_does_icp_actually_mean_for_home_service/) - r/coldemail, 9 comments
- [Sent 60,000 emails in March - most cold email advice is wrong](https://www.reddit.com/r/coldemail/comments/1smih8j/sent_60000_emails_in_march_most_cold_email_advice/) - r/coldemail, 18 up / 35 comments
- [The exact cold email script that got me 12%+ positive reply rate](https://www.reddit.com/r/coldemail/comments/1s8gniv/the_exact_cold_email_script_that_got_me_12/) - r/coldemail, 52 up / 83 comments
- [If you're using AI for cold outreach, are you OK with the damages?](https://www.reddit.com/r/agency/comments/1s8s3v0/if_youre_using_ai_for_cold_outreach_are_you_ok/) - r/agency, 22 up / 78 comments
- [Local SEO is shifting to GEO (Generative AI Search)](https://www.reddit.com/r/DigitalMarketing/comments/1s7x3og/local_seo_is_shifting_to_geo_generative_ai_search/) - r/DigitalMarketing, 2 up / 10 comments

**Refresh cadence:** Çınar re-runs `/last30days lead generation for local service businesses` and `/last30days AI personalized cold email outreach` weekly. Update §2 of this paper any time a new top-3 thread appears.

---

## Appendix B: how this paper was generated

This document is grounded research, not opinion. It was synthesized from 12 community signals pulled by the [last30days](https://github.com/mvanhorn/last30days-skill) AI agent skill, scoring posts by upvotes + comments across Reddit, Hacker News, and the broader social web for the trailing 30 days. To regenerate the underlying research:

```powershell
cd $env:USERPROFILE\.cursor\skills\last30days
python scripts/last30days.py "lead generation for local service businesses" --quick `
  --subreddits "sales,salestechniques,Entrepreneur,smallbusiness,agency,SaaS,marketing,coldemail" `
  --emit compact --save-dir $env:USERPROFILE\Documents\Last30Days
```

To unlock X/Twitter, YouTube, and TikTok signals on the next pass: log into x.com in any browser (cookies auto-detected), `winget install yt-dlp`, and add a free ScrapeCreators key.
