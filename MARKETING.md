# LeadAC — master copy book

This file holds the canonical copy for every public surface. Every hero, sub, CTA, FAQ answer, and reusable copy block lives here. Page components import or mirror from this doc so we never have three slightly different versions of the same headline scattered across the codebase.

Read order: `POSITIONING.md` first (strategy), then this file (execution).

The shared rules:

- Read `.agents/product-marketing-context.md` § Voice rules before editing any block here. The banned-word list applies.
- When rewriting an existing surface, also update the corresponding component file (linked per section) and run the humanizer pass on the diff.
- Do not write "Apollo alternative" / "replaces Apollo" anywhere outside the `/alternatives/apollo-alternative` programmatic SEO route. That route has different positioning rules (search-intent capture); see § Programmatic SEO routes.

---

## 1. Homepage

Component map:
- `src/app/(marketing)/page.tsx` (orchestration + section data)
- `src/components/marketing/cine/cine-hero.tsx`
- `src/components/marketing/cine/cine-features.tsx`
- `src/components/marketing/cine/cine-stats.tsx`
- `src/components/marketing/cine/cine-testimonials.tsx`
- `src/components/marketing/cine/cine-faq.tsx` (used as `<CineFaq>` on homepage)
- `src/components/marketing/cine/cine-pain.tsx` (NEW, Phase B)
- `src/components/marketing/cine/cine-case-study.tsx` (NEW, Phase B)
- `src/components/marketing/cine/cine-logo-wall.tsx` (NEW, Phase B)

### 1.1 Metadata

```
title:       LeadAC — Find your next local customer.
description: Type a postcode and a niche. LeadAC pulls 50 fresh leads off Google Maps, audits every site, and drafts an opener grounded in what the audit found. Pipeline-ready dossiers in five minutes. Built for the local-business segment Apollo doesn't index. Works with Smartlead, Instantly, GHL, Gmail, Outlook.
```

Title is short on purpose (under 50 chars) so it reads cleanly in SERPs and tab strips. The verb "find" is the point — passes the 5-second test. Keywords list lives in `src/app/(marketing)/page.tsx`. Do not add anything that contains "AI agent" or "AI cold email"; the keyword set leans on "local lead generation", "agency outbound", "google maps lead intelligence".

### 1.2 Hero

```
badge:        New
tagline:      Local lead generation for outbound agencies
headline:     Find your next local customer.
sub:          Type a postcode and a niche. LeadAC pulls fresh leads off Google Maps, audits every site against 20+ signals, and drafts the opener from what the audit found. Pipeline-ready dossiers in your tab in five minutes — for the local-business segment Apollo doesn't index.
ctaPrimary:   { label: "Audit your first 10 leads", href: "/signup" }
ctaSecondary: { label: "Book a 15-min walkthrough", href: "/demo" }
partnersLabel: Works with your sender. We don't replace it.
partners:     Smartlead, Instantly, GHL, Gmail, Outlook
```

Hero pills (right column floating glass pills):

```
- "Postcode + niche → 50 leads"          (concrete capability)
- "47 audited leads in 5 minutes"         (concrete metric)
- "Lead dossiers, not contact rows"       (positioning shorthand)
```

**Why this hero, not the previous one.** The previous draft led with "3 booked calls per week. Without Apollo's exhausted contact list." That's an outcome + audience qualifier — fine, but it leads on the *negative* (what we're not). 2026 SaaS landing-page benchmarks (Leadpin, LeadSwift, OpnLeads, LeadIntel Pro) all converge on a verb-led, capability-first hero: "find local leads, fast." That structure does three things our previous hero didn't:

1. **Passes the 5-second test cleanly.** Anyone landing on the page knows in one read what the system does (find local customers). The previous hero required two reads — outcome + Apollo cue — to understand the category.
2. **Keeps Apollo neutral, not antagonistic.** The sub explains the gap ("the local-business segment Apollo doesn't index") without naming Apollo as a failure. POSITIONING.md already states: Apollo owns enterprise B2B; we own local. The hero now matches.
3. **Restates the workflow openly.** "Type a postcode and a niche. We pull, audit, and draft." That's the entire mental model, in one sentence. The user shouldn't need to scroll to understand the loop.

Outcome metrics (3 booked calls/wk, retainers etc.) live further down the page, in the stats band and case study, where they belong as proof — not as the headline claim.

### 1.3 Pain section (NEW component: `cine-pain.tsx`)

Eyebrow: `What changed in 2025`
Headline: `The 2024 cold email playbook stopped working.`
Sub: `Three things broke at once. We built around the third one.`

Three cards:

```
1. Apollo is everyone's exhaust
   Same 50 million contacts, same crawls, same prospects pitched by ten other agencies this month. Reply rates on recycled-list outbound dropped from 3-4% into the 1-2% range across the industry. The fix is not a better cadence. It's data nobody else has.

2. AI personalization stopped working
   "I noticed you launched..." is a deliverability liability now. Twelve months of training-data leakage and every GPT first-line generator sounds the same. The receiving inbox figured it out. Different fuel beats louder personalization.

3. Manual research caps at 10 a day
   A senior SDR can hand-write a great per-prospect message — for ten prospects. That's not a pipeline. The middle path between "AI slop at scale" and "hand-write everything" is the gap nothing was filling.
```

### 1.4 Features bento (existing, keep mostly as-is)

The four cards in `cine-features.tsx` stay. Tweak the eyebrow + headline:

```
eyebrow:  How it works
headline: Cold email replies come from doing the homework.
sub:      We do the homework on every prospect. Audit, score, draft. Then your SDR ships.
```

Card titles (existing copy works; minor edits):

1. **Every site audited before you write a word** (keep)
2. **Data nobody else has** (keep)
3. **Emails that mention what's actually broken** (sub-tweak: "The draft references what the audit found. Their reply asks how much, not who you are.")
4. **Your inbox. Your rules.** (keep)

### 1.5 Stats band (replaces current vanity stats)

Eyebrow: `The numbers that matter`

Four cells:

```
1. 47 leads audited in 5 minutes  (DB-backed, internal staging)
2. 20+ signals scored per lead    (audit pipeline ground truth)
3. 500 reviews scanned per lead   (Apify ceiling)
4. $1,500 retainer covers the year (math: $249/mo Agency+ × 12 = ~$3k. One closed local-business client at $1,500/mo = $18k/year. 6x payback.)
```

The current stats ("47 leads in 5 minutes", "500 reviews", "20+ signals", "0 Apollo contacts recycled") are mostly fine — the only one to drop is "0 Apollo contacts recycled" because it positions us against Apollo, which we corrected away from. Replace with the payback math cell.

### 1.6 Process (existing 5 steps, light edit)

```
1. Discover — Postcode, niche. Name, website, phone, rating, hours. Back in seconds.
2. Audit    — 20 signals, up to 500 reviews, 0-100 fit score. The angle and price band ready.
3. Pitch    — Opener draft grounded in what the audit found. One click.
4. Send     — Gmail, Outlook, or export to Smartlead/Instantly. Replies match back to the lead automatically.
5. Install  — Closed prospect? Export the AI receptionist, review-reply agent, and lead-response flow you pitched.
```

(Old step 3 said "opener draft plus a mockup on a branded link." Drop the mockup half from homepage — mockup belongs in vertical pages, not core process.)

### 1.7 Case study (NEW component: `cine-case-study.tsx`)

Eyebrow: `Beta cohort`
Headline: `12 cafes in Camden. One BD team. One afternoon.`

Body card:

```
Customer:     F&B SaaS BD team (Camden / North London cohort, May 2026)
Setup:        2-rep BD team selling QR menu + reservations stack to local cafes
Before:       Manual research at 30 cafes per BD rep per day. 80% of time
              on Google Maps and Instagram tabs, 20% on calls.
After:        Cohort of 12 cafes audited end-to-end in one session.
              Sub-niche detection, package recommendation, opener grounded
              in what each cafe was missing (QR ordering, online reservations,
              loyalty).
What landed:  Audit signal flagged 6 of 12 cafes as "no online ordering" —
              their pitch territory.
What didn't:  Round 2 surfaced 10 bug classes (chain blindness, review
              small-sample blowups, expired-domain context) which are now
              this sprint's hotfix release. Customer found those, not us.

—  Anonymized at customer request. Public case study lands when permission
   confirmed.  See research/finedine/beta-test-round-2-camden-report.md
   for the internal artifact.
```

If/when written permission lands, swap the customer name in. Until then, keep the anonymized framing.

### 1.8 Logo wall (NEW component: `cine-logo-wall.tsx`)

Until at least 3 written permissions land, render placeholder text only — no fake logos, no SaaSquatch-style "as featured in" bar.

```
"Used by [N] agencies running outbound across [M] cities. Real logos when
 our customers want them up — we don't ship anonymous claims."
```

Replace `[N]` and `[M]` with current paying-customer counts from DB. Re-pull weekly.

### 1.9 Lead Intelligence Engine section (replaces current "Brain" section)

This is the section that currently lives as the "Talk to your pipeline" + "Best openers train the next one" copilot/memory dual panel. Repackage. Move below pricing (bury, per plan § Phase B task 2).

Eyebrow: `What's inside`
Headline: `Lead Intelligence Engine.`
Sub:      `Five things we run on every prospect, before you write a word.`

Five feature cards (replaces the current Copilot tools + Memory kinds dual panel):

```
1. Discovery       — Live Google Maps pull, scoped to your postcode + niche.
                     No recycled lists. No stale rows.
2. Site audit      — 20+ signals: HTTPS, mobile fit, booking flow, schema,
                     LCP, social proof. 0-100 fit score with the reasons listed.
3. Sub-niche       — Detects whether the prospect is a fine-dining restaurant,
   classification    a coffee shop, a ghost kitchen — and matches the
                     pitch and package to their sub-niche.
4. Opener grounded — Drafts the first line from the audit, not from a generic
   in the audit     "I noticed you launched..." prompt.
5. Pipeline-ready  — Each lead arrives as a dossier: signals, score, suggested
   dossier          package, draft opener. Open Monday, work through Friday.
```

The naming "Lead Intelligence Engine" replaces "the brain" / "the compounding part" hype framing. The internal Copilot product still keeps that name; this is the *external* description for what runs server-side per lead.

### 1.10 Pricing block

Pricing copy lives in § 3 of this doc. The homepage pricing block uses the same component (`PricingCards`) and the same plan tier names from `src/lib/plans.ts`.

Section header for the homepage pricing band:

```
eyebrow:  Pricing
headline: One subscription. Stop bolting on a research VA.
sub:      Apollo and Smartlead stay where they are. We collapse the per-prospect
          homework — the part that used to cost $360-600/month in VA hours.
          One workspace, one card on file.
```

(Old copy: "Apollo + Clay + Smartlead + a receptionist runs $300-475/month before your agency retainer. Leadac Agency does it all for about 15% of that." This is the misframe we corrected away from. Replace with the version above.)

### 1.11 FAQ (homepage)

Drop questions that lean on the "memory loop" / "compounding" framing. Add operator-relevant ones.

Final list (10 items):

```
1. Q: How is this different from Apollo or Clay?
   A: Apollo and Clay own the enterprise B2B database — that's where they're
      strong. We're the local-business lead-intelligence layer Apollo doesn't
      cover. Most agencies run LeadAC in front of Apollo, not instead of it.

2. Q: Where do the leads come from?
   A: Live Google Maps on every search. Businesses keep their own profiles
      current, so the data is cleaner than a scraped list. Deep enrichment
      adds reviews, social posts, competitor ads, LinkedIn signals.

3. Q: What does the audit actually check?
   A: 20+ signals: HTTPS, mobile fit, booking flow integrity, schema markup,
      Largest Contentful Paint, up to 500 reviews scanned for sentiment, social
      proof, competitor ad presence. 0-100 fit score with each reason listed.

4. Q: How long until first booked call?
   A: Most operators see their first reply in week 1, first booked call in
      week 2-3. Retainer-grade clients tend to land in week 4. Faster if you
      already have a sender warmed and a working ICP.

5. Q: Does it work with Smartlead, Instantly, or GHL?
   A: Yes. Solo and Studio plans export CSV formatted for both, with custom
      variables for the audit signals. Agency+ adds native Gmail and Outlook
      send with reply attribution.

6. Q: Is the AI sending emails for me?
   A: No. Auto-send is off by default. We generate the audit and the draft.
      You review and ship from your own inbox. AI cold email without a human
      in the loop burns deliverability — we won't ship that.

7. Q: Can I bring my existing client list?
   A: Yes. Import a CSV and we'll audit each row. The fit score and the
      sub-niche detection still run, just against the rows you bring instead
      of a fresh Maps pull.

8. Q: What about an agency-friendly billing model?
   A: Agency+ plan is workspace-based, not per-seat: 5 seats included, no
      per-seat surcharge for adding the next SDR. Custom volume above
      Agency+ tier on request.

9. Q: Is there a money-back window?
   A: 14-day trial with a card on file. If you don't pull a single fresh lead
      list and an audit you'd actually send, cancel inside 14 days and we
      refund. No "are you sure?" loops.

10. Q: Is my data private?
    A: Leads, notes, pipeline, voice notes, and saved playbook are scoped to
       your workspace. Only invited members see them. We don't share or
       resell, and we don't train models on your data.
```

The "How does the AI improve over time?" question is dropped. Replace with the operator-relevant ones above.

### 1.12 CTA band (bottom of homepage)

```
headline: Your next 50 clients aren't on Apollo's list.
sub:      They're on Google Maps. Pick a postcode, pick a niche, and the first
          audited dossier is in your tab in five minutes. If the list doesn't
          beat what you're emailing now, cancel inside 14 days and the card on
          file gets a refund.
primary:   { label: "Audit your first 10 leads", href: "/signup" }
secondary: { label: "Book a 15-min walkthrough", href: "/demo" }
microCopy: 14-day trial · cancel any time · refund window if it doesn't earn you a reply
```

The microCopy intentionally drops "no credit card" and "free leads forever" — those map to the FREE plan that's sunsetting. See `docs/decisions/free-plan-sunset.md`.

### 1.13 Section order (final)

```
1. Hero
2. Pain (NEW)
3. Features bento (existing CineFeatures, light edit)
4. Live tour (existing HomeScrollTour)
5. CineWhy (light edit; eyebrow stays)
6. Process (5 steps, mockup half dropped from step 3)
7. Case study (NEW)
8. Logo wall (NEW)
9. Stats band (replaced)
10. Pricing (header rewritten; cards unchanged)
11. Lead Intelligence Engine (replaces Brain section, moved below pricing)
12. Integrations orbit (existing)
13. FAQ (rewritten)
14. CTA band (rewritten)
```

---

## 2. Vertical landing pages

Each vertical page imports `VerticalCopy` from `src/components/marketing/vertical-landing/types.ts` and feeds the canonical layout. Existing four:

- `for/agencies` (B2B outbound) — strongest already, surgical tweaks only
- `for/smma` — tone alignment pass
- `for/specialists` — tone alignment pass
- `for/walk-in-web-agencies` — keep mockup as a pillar (this is the persona where mockup IS the pitch)

Plus two new in Phase D:

- `for/fnb-tech` (F&B / restaurant-tech BD)
- `for/local-seo` (Local SEO agencies)

Each vertical page MUST follow this skeleton (see `BUYER-PERSONA.md` for the persona-specific facts to plug in):

```
1. Eyebrow:  "For [persona]"
2. H1:       Outcome metric or pain reframe (NOT a feature claim)
3. Sub:      The pain trigger in operator language
4. Validation quote: Sourced operator quote from the persona's forum
5. Pains:    3 cards (the 3 things from § Pain in this persona's framing)
6. Proof:    "What changes for your team" — 5-7 bullets
7. Demo:     Live demo data (per vertical: see existing demo-data.ts)
8. Pricing card embed: PricingCards
9. FAQ:      3 vertical-specific FAQs (different per persona)
10. CTA:     "Audit your first 10 leads in [their context]"
```

The full per-vertical copy lives in the vertical page's own file (e.g. `src/app/(marketing)/for/agencies/page.tsx`). Phase B and Phase D updates each vertical against the persona doc.

---

## 3. Pricing page

Component: `src/app/(marketing)/pricing/page.tsx` + `src/components/marketing/pricing-cards.tsx`.

### 3.1 Page header

```
eyebrow:  Pricing
headline: Math, not features.
sub:      Local outbound is a per-prospect-homework cost line. We collapse it.
          The Apollo seat and the Smartlead inbox stay where they are.
```

### 3.2 ROI argument (above the cards)

```
$249/mo Agency+ plan = ~$8 per working day. One closed local-business
client at a $1,500/mo retainer pays it back 75x over the year. The math
holds at every tier:

- Solo  $79/mo  → one closed retainer in year 1 = 19x payback
- Studio $149/mo → one closed retainer per quarter = 30x payback
- Agency+ $249/mo → one closed retainer per quarter = 75x payback at $1,500/mo

If your average retainer is bigger than $1,500/mo (most B2B agency retainers
are $2,500-$5,000), the multiple climbs. If it's smaller, you probably
shouldn't be selling to local SMBs.
```

### 3.3 Plan tier display names

| Plan enum | Marketing display | Tagline |
|---|---|---|
| FREE | (sunsetting; show "14-day trial" CTA on cards instead, no separate FREE card) | n/a |
| PRO | **Solo** | For solo SDRs and vertical specialists. |
| PRO_TEAM | **Studio** | For 2-3 person agencies and small SMMA shops. |
| AGENCY | **Agency+** | For agencies running outbound for clients. |

### 3.4 "Not sure?" footer

```
headline: Not sure which tier?
sub:      Book a 15-minute walkthrough. We'll pull a list against your real
          postcode and ICP, run the audit live, and show you what week 4 looks
          like. No demo script, no pitch deck.
cta:      { label: "Book a 15-min walkthrough", href: "/demo" }
```

### 3.5 FAQ (pricing-page-specific)

```
1. Q: What counts as one lead?
   A: One business pulled from Maps. Re-pulling the same business doesn't
      double-count; duplicates are filtered per workspace.

2. Q: Can I bring more seats than my plan allows?
   A: Solo is 1 seat, Studio is 3 seats, Agency+ is 5 seats. Above 5, custom.
      We don't charge per-seat-surcharge inside the included count.

3. Q: Annual or monthly?
   A: Annual saves 20%. Monthly is on by default; switch in Settings → Billing
      whenever the math works for you.

4. Q: Refund window?
   A: 14-day trial with a card on file. Refund inside 14 days if you don't
      pull a list and an audit you'd actually send.

5. Q: GBP pricing?
   A: Yes — UK locale auto-detects. £59 Solo, £99 Studio, £199 Agency+.

6. Q: I have an existing PRO subscription. Will renaming to "Solo" affect me?
   A: No. The Plan enum (`PRO`) is unchanged in the database. We're only
      changing the display name on marketing surfaces.
```

---

## 4. Demo page (NEW route in Phase C)

Route: `src/app/(marketing)/demo/page.tsx` (NEW).

### 4.1 Page copy

```
eyebrow:  Walkthrough
headline: 15 minutes. Your real postcode. Your real ICP.
sub:      No demo script, no pitch deck. We pull a list against your actual
          territory, run the audit live, and show you what the dossier looks
          like for one of your real prospects. If it doesn't beat the list
          you're working today, we'll tell you.

form fields:
  - Email (work email preferred)
  - Agency name
  - Your role (Owner / SDR / VP / Other)
  - Postcode you'd run the demo against
  - Niche (free text or dropdown)
  - Anything else we should know? (optional textarea)

CTA: "Book the walkthrough"

post-submit copy:
  "Booked. Check your inbox — you'll get a calendar link in the next
   30 minutes. We don't auto-confirm; we want to look at your postcode
   first and pull a real list to walk you through."
```

(Calendly embed comes later via env var. For Phase C, the form submits to a new API route that emails the founder + sends a Resend acknowledgement to the prospect.)

### 4.2 Demo page footer

```
"Already signed up? You don't need a demo. Open the app, type a postcode,
 hit go — that's the same demo, but interactive."
```

---

## 5. Programmatic SEO routes (special positioning rules)

Routes live in `src/app/(public)/{niches,cities,alternatives,vs,glossary,blog,tools,b}`.

These pages target search intent. They follow different rules than the canonical positioning:

- `/alternatives/apollo-alternative` is a search-intent capture page. It is allowed (and expected) to use "Apollo alternative" framing in H1, meta, and on-page copy. It is NOT a positioning claim — it's a SERP page intercepting prospects already searching for "apollo alternative."
- `/vs/leadac-vs-apollo` does the same but as a head-to-head feature matrix. The verdict on this page should still land at "complementary, not substitutes" — we don't lie to win the page. The page captures search intent and educates the prospect.
- `/niches/[verticalSlug]/[citySlug]` pages can be local-search-leaning ("dentist lead generation Manchester") even when the homepage is positioned at the agency owner.

The rule of thumb: programmatic SEO pages are ALLOWED to use language that the homepage forbids, as long as the verdict still aligns with the positioning. This file's positioning rules apply to the canonical surfaces (homepage, pricing, vertical pages, demo, about). They DO NOT apply to programmatic SEO surfaces, because those exist to intercept searches that already use that vocabulary.

The full programmatic SEO content production plan is in Phase E of `.cursor/plans/web_presence_b2b_overhaul_cf071b64.plan.md`.

---

## 6. Reusable copy blocks (use these everywhere)

When you need a one-liner, pull from this list. Don't reinvent.

### 6.1 Pain triggers

- "Apollo is everyone's exhaust."
- "AI personalization stopped working."
- "Manual research caps at ten a day."
- "Reply rates dropped from 4% to 1.6% across the industry through 2025."
- "Different fuel beats louder personalization."

### 6.2 Mechanism

- "Postcode plus niche. 50 fresh leads. 5 minutes."
- "Every site audited before you write a word."
- "20+ signals scored 0-100, with the reasons listed."
- "Opener grounded in what the audit found."
- "Lead dossiers, not contact rows."

### 6.3 Outcome

- "3 booked calls per week."
- "Retainer-grade clients in week 4, not pilot calls in month 2."
- "Your SDR's brain, in software."
- "Your end-of-month pipeline review, ready Friday morning."
- "$1,500 retainer pays back the year, 75 times over."

### 6.4 Disqualifiers (intentional anti-copy)

- "Not for enterprise SDR teams."
- "Not for B2C anything."
- "If your average retainer is under $500/mo, our pricing won't work for you."
- "If you're looking for a free toy to play with on Twitter, this isn't it."

(These intentionally repel hype tourists. Keep at least one per landing page.)

---

## 7. Email sequences (light reference, full files in Phase J)

The cold email and nurture sequences will live in their own file (`MARKETING-EMAILS.md`) when Phase J ships. For now, this file's voice rules apply — same banned-word list, same outcome-first ordering.

If you write an email or sequence before Phase J: read `cold-email` skill + this file's voice rules, then ship to `src/lib/email/templates/` with the pattern from existing templates.

---

Last updated: 2026-05-06 (Phase A of web-presence overhaul). Bumps to this file MUST also update the corresponding component file in the same commit.
