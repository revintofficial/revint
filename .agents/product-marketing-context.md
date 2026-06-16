# LeadAC — product marketing context

This file is the entry point every marketing-related agent reads first. It exists because the architecture rule references it and other context files (MARKETING.md, POSITIONING.md, BUYER-PERSONA.md) build on top of it.

If you are about to write copy, an ad, an email, a landing page, a blog post, or a social caption for LeadAC, read this end to end before anything else.

---

## What LeadAC is

LeadAC is **operational revenue intelligence for SMB markets**. The memory layer that learns what closes in local-business markets and writes the next best action into the HubSpot card the SDR already opens.

We do not try to be the data source. The SMB data rails are commoditising — Orbital, Openmart, Resquared, and Clay all sell rows. We sit one layer above. Bring the rows, we score fit against what your team has closed before, surface the next best action, and feed every won and lost outcome back into the vertical playbook. The deliverable is a per-account brief inside HubSpot, not a CSV.

### What we are NOT replacing

This is the most common misframe — kill it on sight if you see it in copy:

- **Upstream data rails stay.** Apollo, Clay, Orbital, Openmart, Resquared, and any local-business data API the team already pays for. We sit *after* them, not *instead of* them. Never write "Orbital alternative", "Apollo alternative", or "replace Clay" in canonical positioning. (The `/alternatives/*` programmatic SEO pages are search-intent capture surfaces, not positioning claims. Different rules.)
- **Smartlead / Instantly stay.** They are the sender. We feed them.
- **The CRM stays.** HubSpot is where the team already lives. We write the brief into the HubSpot card; we do not ask the SDR to switch tabs.

What we DO collapse: the research VA, the per-prospect homework an SDR pretends to do but doesn't have time for, and the team-memory that walks out the door every time a senior rep quits. That is the cost line we replace.

### Integration reality (do not overpromise)

HubSpot is the **only integration we claim live today**. Everything else lands via CSV import while native connectors ship. "Works with your stack" is the positioning; the implementation phasing is:

1. CSV mapping for Apollo, Clay, Orbital, Openmart, Resquared, Smartlead, Instantly exports + HubSpot OAuth (live).
2. Native HubSpot + Smartlead + Instantly (next).
3. Two-way CRM writeback + Salesforce + native connectors for the data rails (later).

Copy must not imply native integrations that have not shipped. Use "bring your stack" before "deeply integrates with."

### Mockup feature — vertical only, not homepage pillar

LeadAC also ships a one-page site mockup generator. **It is not a general-marketing pillar.** Mockup belongs on the walk-in web agency landing, the SMMA web-services landing, and inside Pro+ feature lists. It does NOT belong in the homepage hero, hero pill, headline stats, or canonical positioning. B2B outbound agency buyers care about quality leads and audit signal, not "I will design your prospect a free site." Treat mockup like AI receptionist or review-reply: a Pro-tier feature, not the headline.

## Who buys it

**Primary ICP (homepage + canonical positioning lead with this):**
Vertical SaaS GTM teams at $2M–$50M ARR selling into local-business / SMB markets. 5 to 30 sellers, HubSpot + some mix of Apollo/Clay/Smartlead/Orbital/Openmart/manual research. Verticals where we have signal depth: restaurant tech, field service, dental, beauty/wellness, hospitality, legal practice software.

Daniel (VP Sales), Mike (SDR Manager), Sarah (Head of Marketing — champion) live here. Full persona file: `BUYER-PERSONA.md`.

**Secondary ICP (faster proof wedge, sub-page treatment under `/for/agency`):**
Agencies running outbound for local-business clients — B2B outbound agencies, SMMA owners, walk-in web agencies, local SEO operators. They convert faster but have lower willingness-to-pay and a tendency to read LeadAC as "another lead list" unless we discipline the framing to "the operating system for your local outbound motion."

**Not for:** enterprise SDR teams with dedicated RevOps engineers and Gong + Salesforce already in place, product-led growth motions, B2C, anyone selling software to companies above 500 employees, anyone who wants a fully autonomous AI SDR.

## What changed in 2025-2026 (why we exist)

Three things broke the previous outbound stack:

1. Apollo and Clay are selling the same 50M contacts to thousands of agencies. The receiving inbox has seen the same prospect ten times this month.
2. GPT first-line generators all sound the same. Reply rates dropped from 3-4% to under 2% across the industry through 2025. "I noticed you..." is a deliverability liability now.
3. Hand-writing each email caps an SDR at maybe 10 prospects a day. That is not a pipeline.

LeadAC is the third path: fresh local data nobody else has, a real audit attached to every email, and an opener that references something the prospect can see on their own homepage right now. Different fuel, not louder personalization.

## Voice rules (non-negotiable)

Pick three, in order:

1. **Operator to operator.** We have sent cold email. We know which lines work and which ones get marked as spam. Speak like that. Skip the "transformative AI" register.
2. **Outcome before mechanism.** "3 booked calls per week" before "Google Maps Places API + Gemini 1.5". The mechanism is interesting later.
3. **No AI hype lexicon.** See banned/preferred lists below.

Voice should sound like a senior agency owner who is tired of the noise. Not a marketing department. Not a Y Combinator pitch. Not a Twitter thread.

### Banned words and phrases

These get caught in the humanizer pass. Do not ship copy that contains them.

- "agent" or "AI agent" (when describing LeadAC itself)
- "copilot" (the existing Copilot UI element keeps the name internally; do NOT rename it for marketing)
- "transformative", "groundbreaking", "revolutionary", "cutting-edge"
- "delve", "leverage", "synergy", "robust", "seamless", "intuitive"
- "stands as", "serves as", "marks a pivotal moment", "in the rapidly evolving landscape"
- "Despite challenges, X continues to thrive"
- "Whether you're a... or a..." (false range)
- Em dashes (—). Use periods or commas.
- "Let's dive in", "without further ado", "here's what you need to know"
- Rule of three lists when two would do
- "It's not just X, it's Y" (negative parallelism)
- Title Case In Headings (use sentence case)
- Competitor-claimed phrases — see `src/content/site/keywords.ts` `AVOID_PHRASES`. Highlights: "SMB account intelligence" (Orbital), "selling to local businesses" (Orbital/Resquared), unqualified "revenue intelligence" (always qualify with "for SMB markets"), "AI lead generation", "Apollo for local", "AI SDR / digital workers", "buyer intelligence" (Common Room).

### Un-banned (this is the thesis now, use them)

The previous version of this file banned "memory loop / compounding intelligence." That was correct for the old "Apollo for local" positioning. It is wrong for the current Operational Revenue Intelligence positioning. These phrases are now the wedge — use them, repeat them across surfaces:

- "memory layer", "remembers what closes", "what closes in your vertical"
- "learning loop", "outcome loop", "vertical playbook memory"
- "the next best revenue action", "next best action"
- "operational revenue intelligence for SMB markets" (always qualified — never bare "revenue intelligence")

The full keyword dataset (own / avoid / white-space) lives in `src/content/site/keywords.ts`. Read it before writing any new page or ad.

### Preferred phrases

- "Your playbook, automated"
- "Fresh signals" (vs Apollo's exhaust)
- "The homework attached to every email"
- "What changes for your team"
- "Different fuel, not louder personalization"
- "Retainer-grade clients in week 4, not pilot calls in month 2"
- Specific numbers: "1 to 2 replies per 200", "47% mockup-click rate", "$1,500/mo retainer"

### Tone calibration sample

Before:

> LeadAC stands as a pivotal evolution in the SMB revenue intelligence landscape, unlocking transformative AI agents and groundbreaking buyer intelligence — empowering operators to deliver seamless, intuitive, and revolutionary results.

After:

> LeadAC reads the accounts your team already imported, scores fit against what you have closed before, and writes the next best action into the HubSpot card the SDR opens before every dial. Same stack, different memory.

### Three lines the founder uses internally (lift these for copy)

These are the lines the founder keeps repeating when describing what LeadAC is for. They translate well to hero copy, ad copy, and outbound subject lines.

- "We remember what closes in local-business markets."
- "Bring your stack. We make it remember."
- "Inside the HubSpot card your SDR already opens."

## Positioning sentence (canonical)

Memorize this. Every page should rhyme with it.

> For vertical SaaS GTM teams selling into local-business and SMB markets, LeadAC is operational revenue intelligence — the memory layer that learns what closes in your vertical and writes the next best action into the HubSpot card your SDR already opens. Bring the data rails you already pay for (Apollo, Clay, Orbital, Openmart, Resquared); LeadAC sits one layer above and makes them compound into team memory.

Short version (sticker line):

> Apollo finds. Clay enriches. Gong records. LeadAC remembers.

The full version (3 paragraphs), competitor reframes, and category-defense reasoning are in `POSITIONING.md` § 3-4. The keyword dataset that grounds this sentence lives in `src/content/site/keywords.ts`.

## Pricing logic (current)

Source of truth: `src/lib/plans.ts`. Marketing surfaces should read from there or stay in sync with these numbers.

| Tier | Display name | Monthly USD | Seats | Leads/mo | Mockups/mo |
|---|---|---|---|---|---|
| FREE | (sunset, see below) | $0 | 1 | 50 | 3 |
| PRO | Solo | $79 | 1 | 1,000 | 50 |
| PRO_TEAM | Studio | $149 | 3 | 2,500 | 150 |
| AGENCY | Agency+ | $249 | 5 | 5,000 | 300 |

GBP pricing: £59 / £99 / £199 (no GBP for FREE since FREE is sunsetting).

Annual: 20% off effective monthly rate.

ROI argument that always works:

> $249/mo Agency+ = ~$8/day. One closed local-business client at $1,500/mo retainer pays it back 75x over the year.

### FREE plan decision

Sunset. Replaced with a 14-day trial that requires a card. Full reasoning in `docs/decisions/free-plan-sunset.md`. The hype tourists were the loudest tenant of FREE and they never converted; agency buyers expect a trial with a card on file.

This means: kill copy that says "no credit card", "50 free leads", "start free", "free forever". Replace with "14-day trial · cancel any time · refund window if it doesn't earn you a reply."

Until the Stripe + UI work for trial flow ships, the marketing flag `MARKETING_COMING_SOON` keeps "Launching soon" CTAs visible. Do not ship copy that contradicts the flag's current state.

## Evidence layer (what we can claim)

We are pre-revenue at scale. Most numbers are from the FineDine beta cohort (Camden / North London cafes, 12 leads, May 2026). Until paid customers ship case studies, copy must:

- Cite specific cohort metrics where they exist (47 audited leads in 5 minutes is real and DB-backed; 4% reply rate is industry benchmark, not our number yet)
- Use anonymized customer language ("F&B SaaS BD team running Camden cafe outreach") until written permission lands
- Avoid invented testimonial names. The Reddit pull-quotes on the homepage today are sourced from `r/coldemail`, `r/SMMA`, `r/agency`. Keep them attributed correctly. Replace with real named operators when they exist.

When in doubt about a claim: pull it. Do not stretch it.

## Asset inventory

- Brand kit: `public/leadac-brand-kit.pdf`, `public/brand-kit.html`, `public/logo.png`
- Cinematic palette tokens: `src/app/globals.css` (`--cine-*`)
- Component library: `src/components/marketing/cine/*`
- Hero scroll-frames: `public/frames/` (currently empty; falls back to gradient)
- Hero loop video (deferred): `public/hero-loop.mp4`
- FineDine beta artifacts (NOT public): `research/finedine/*`

## i18n state

- Active: English only. `src/lib/i18n/config.ts` exports `["en"]`.
- TR launch is Phase I in the web-presence overhaul plan. Do not ship `/tr` routes or TR copy until the i18n flip is approved.

## Where to look when writing for a specific surface

| Writing for | Read first |
|---|---|
| Homepage | `src/app/(marketing)/page.tsx`, `MARKETING.md` § Homepage |
| Vertical landing | `src/components/marketing/vertical-landing/*`, BUYER-PERSONA.md for that vertical |
| Pricing page | `src/lib/plans.ts`, `MARKETING.md` § Pricing |
| Programmatic SEO page | `src/app/(public)/{niches,cities,alternatives,vs}/...`, `programmatic-seo` skill |
| Blog post | `src/app/(public)/blog/[slug]/page.tsx`, `content-strategy` skill |
| Cold email / nurture | `cold-email` skill, `email-sequence` skill |

## What this file is NOT

It is not a positioning doc (see `POSITIONING.md`).
It is not a buyer persona doc (see `BUYER-PERSONA.md`).
It is not a copy book with hero/sub for every page (see `MARKETING.md`).
It is not a roadmap (see the web-presence plan in `.cursor/plans/`).

If you are about to read this file twice in the same session, you are probably looking for one of the four files above instead.

---

Last updated: 2026-06-16 (Operational Revenue Intelligence for SMB Markets repositioning — see `src/content/site/keywords.ts` and the homepage hero in `src/app/(site)/page.tsx`).
