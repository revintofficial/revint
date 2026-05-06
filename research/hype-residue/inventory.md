# Hype-residue inventory

Marketing surfaces audit. Each row: where the residue lives, what's wrong, what to replace it with.

This file is the input for Phase B (homepage surgical) and Phase D (vertical alignment) of the web-presence overhaul. Generated 2026-05-06.

Categories of residue:

- **HYPE** — AI/Twitter-tourist vocabulary ("memory loop", "compounding", "AI agent")
- **MOCKUP** — homepage mentions of mockup that should move to vertical pages only (per the B2B-only positioning correction)
- **APOLLO** — copy that misframes the Apollo relationship as "replace" (Apollo stays; we cover the gap)
- **FREE** — copy that promises the FREE plan, which is sunsetting
- **VANITY** — vanity metrics that don't speak to a B2B agency owner
- **TONE** — em dashes, rule-of-three, AI-tell phrasing

Internal product mentions of "mockup" / "copilot" / "memory" inside `src/lib/agent-workers/`, `src/lib/prompts/`, `src/lib/gemini.ts`, and `src/components/app/` are **not** in scope. Those are internal feature names — the marketing rule does not apply. This inventory only covers public-facing marketing copy.

---

## src/app/(marketing)/page.tsx

### Metadata

| Line | Category | Before | After |
|---|---|---|---|
| 27 | MOCKUP | `title: "Leadac — Find local clients off Google Maps. Audit, email, mockup, close."` | `title: "LeadAC — local-business lead intelligence for outbound agencies."` |
| 29 | MOCKUP, TONE | `description: "Postcode plus niche pulls 50 fresh businesses off Google Maps. Every site audited, a personalised opener drafted, and a one-page mockup the prospect can click. Works with Smartlead, Instantly, GHL, Gmail, Outlook."` | `description: "Postcode plus niche pulls 50 fresh leads off Google Maps. Every site audited, every opener grounded in what the audit found. Lead dossiers ready for your pipeline review. Works with Smartlead, Instantly, GHL, Gmail, Outlook."` |

### REASONS array (CineWhy)

| Line | Category | Before | After |
|---|---|---|---|
| 65 | MOCKUP | `body: "Apollo gives you a name and wishes you luck. Clay enriches a row. Smartlead sends it. Leadac gives you the opener, the mockup, and the angle that actually gets a response."` | `body: "Apollo hands you a contact and a guess. We hand you a dossier — the audit, the score, the angle, and the draft. Same SDR seat, different fuel."` |
| 70 | HYPE | "Gets better the longer you use it" + "Winning openers get saved and pulled back as examples next time. The drafts sound more like you with every campaign. No re-prompting per client." | KEEP the title; rewrite body to drop "compounding"-adjacent framing. New body: "Saved openers seed the next campaign. Your voice and offer are learned once, applied everywhere. Drafts get sharper because the inputs do, not because of mystery-box magic." |

### STEPS array (CineProcess)

| Line | Category | Before | After |
|---|---|---|---|
| 98 | MOCKUP | Step 3 body: `"One click: opener draft plus a mockup on a branded link. That link is what gets replied to."` | `"One click. The opener draft pulls in the audit signals — what's broken, what's missing, what's worth fixing — so the first line is grounded in what the prospect can see on their own site."` |

### STATS array

| Line | Category | Before | After |
|---|---|---|---|
| 112-117 | VANITY, APOLLO | `[{ value: "47", label: "Leads audited in five minutes" }, { value: "500", label: "Google reviews scanned per lead" }, { value: "20+", label: "Site signals scored, 0-100" }, { value: "0", label: "Apollo contacts recycled" }]` | Keep the first three. Replace the fourth with `{ value: "75x", label: "Year-1 payback on one closed retainer ($1,500/mo client vs Agency+ plan)" }`. The "0 Apollo contacts recycled" framing positions us against Apollo, which we corrected away from. |

### TESTIMONIALS array

| Line | Category | Before | After |
|---|---|---|---|
| 125-167 | TONE (low credibility for B2B buyer) | 7 anonymous Reddit pull-quotes attributed to `r/coldemail`, `r/SMMA`, `r/agency` | Replace with a `cine-case-study.tsx` component (1 anonymized FineDine card) + `cine-logo-wall.tsx` placeholder. Keep 2-3 best Reddit quotes if needed for top-of-page proof, but move them above the case study, not as a marquee. Drop the marquee component entirely from the homepage. |

### FAQ array

| Line | Category | Before | After |
|---|---|---|---|
| 173 | MOCKUP, TONE (em dash) | `"Both. Discovery, audit, mockup, opener draft, export — that's the tool. The system is the part that actually books the call: fresh data nobody else has, homework attached to every first email, and a memory that learns which lines land."` | `"Both. The tool is the discovery, audit, opener-draft, and export. The system is the part that books the call: fresh local data, homework attached to every email, and a saved playbook that gets sharper as you keep what works."` |
| 184-186 | HYPE | Q: `"How does the AI improve over time?"` + memory-loop answer | Drop this question entirely. Replace with: Q: "How long until first booked call?" → see MARKETING.md § 1.11 #4 for canonical answer. |
| 189 | MOCKUP | `"Yes. Pro and Agency plans export a CSV formatted for both, with custom variables for the mockup link and audit signals..."` | `"Yes. Studio and Agency+ plans export a CSV formatted for both, with custom variables for the audit signals. Native Gmail and Outlook send is on Agency+ with reply attribution back to the lead."` (drop "mockup link" mention here; keep mockup discussion in vertical pages and pricing where it's a Pro+ feature) |
| 201 | TONE | "Agency tier has workspace branding today: your logo, colours, and domain on mockup pages. Full white-label with a custom domain across the whole workspace lands mid-2026." | Keep, but rename "Agency tier" → "Agency+ tier" once tier rename ships. The mockup-pages mention is fine here because the FAQ is about workspace branding. |
| 205 | FREE | `"Yes. Settings, billing, done. Access runs till the end of your cycle. Data kept 30 days. Free plan never touches a card."` | `"Yes. Settings → Billing, done. Access runs till the end of your cycle. Data kept 30 days. The 14-day trial refund window is documented on the pricing page."` |

### COPILOT_TOOLS / MEMORY_KINDS arrays + Brain section

| Line | Category | Before | After |
|---|---|---|---|
| 213-257 | HYPE | `COPILOT_TOOLS` and `MEMORY_KINDS` arrays driving the "Talk to your pipeline" / "Best openers train the next one" dual-panel section | Replace with `LEAD_INTELLIGENCE_FEATURES` array driving the new "Lead Intelligence Engine" section. See MARKETING.md § 1.9 for the 5 cards. Drop the dual-panel layout; use a 5-feature grid. |
| 346-491 | HYPE | The whole "Brain" section JSX (`section id="brain"`, eyebrow "The compounding part", headline "Gets sharper the more you use it.") | Repackage as `<LeadIntelligenceEngine />`. Eyebrow: "What's inside". Headline: "Lead Intelligence Engine." Move BELOW pricing (currently above). |
| 365 | HYPE | Eyebrow text: `"The compounding part"` | `"What's inside"` |
| 368-369 | HYPE | Headline: `Gets sharper the more you use it.` | `Lead Intelligence Engine.` |
| 372 | HYPE | Sub: `"A copilot that runs real actions from chat, and a memory that learns from every reply you get."` | `"Five things we run on every prospect, before you write a word."` |
| 401-406 | HYPE | "Copilot" panel header + "Talk to your pipeline." + body | The panel disappears. Copilot still exists internally as a product feature; the homepage doesn't need to lead with it. If we want to keep ONE copilot mention on the homepage, move it to a single feature card inside the new 5-card grid: "Copilot — chat-driven actions on top of the dossier (Pro+)." |
| 458-465 | HYPE | "Learning loop" panel header + "Best openers train the next one." + body | Same disposal. The "saved openers" idea moves into the "Pipeline-ready dossier" card description. |

### Hero copy

| Line | Category | Before | After |
|---|---|---|---|
| 268 | TONE | `headline="Google Maps to signed clients."` | `headline="3 booked calls per week. Without Apollo's exhausted contact list."` |
| 269 | MOCKUP, TONE | `sub="Postcode, niche, go. 50 fresh leads off Maps, every site audited, a draft email and clickable mockup ready to send. Five minutes."` | `sub="Postcode plus niche, fresh off Google Maps. Every site audited, every opener grounded in what the audit found. Lead dossiers your SDR opens at the start of the week and works through by Friday."` |
| 273 | FREE | `ctaPrimary: { label: "Get my first 50 leads", href: "/signup" }` | `ctaPrimary: { label: "Audit your first 10 leads", href: "/signup" }` |
| 275 | TONE | `ctaSecondary={{ label: "Watch the tour", href: "#tour" }}` | `ctaSecondary={{ label: "Book a 15-min walkthrough", href: "/demo" }}` (move "Watch the tour" to a third tertiary link, or kill it — the live tour is below anyway) |

### CTA band (bottom)

| Line | Category | Before | After |
|---|---|---|---|
| 568 | APOLLO (mild) | `headline="Your next 50 clients aren't on Apollo."` | `headline="Your next 50 clients aren't on Apollo's list."` (small but important: "on Apollo" reads like Apollo positioning. "On Apollo's list" reads like audience qualifier.) |
| 572 | TONE | sub: ends with "If the list doesn't beat what you're emailing now, close the tab." | Replace with: "If the list doesn't beat what you're emailing now, cancel inside 14 days and the card on file gets a refund." |
| 577 | FREE | `primary: { label: "Get my first 50 leads", href: "/signup" }` | `primary: { label: "Audit your first 10 leads", href: "/signup" }` |
| 587 | FREE | `microCopy: "50 free leads · no credit card · cancel any time"` | `microCopy: "14-day trial · cancel any time · refund window if it doesn't earn you a reply"` |

### Pricing section header (lines 530-540)

| Line | Category | Before | After |
|---|---|---|---|
| 539 | APOLLO | `"Apollo + Clay + Smartlead + a receptionist runs $300-$475 a month before your agency retainer. Leadac Agency does it all for about 15% of that. One card on file."` | `"Local outbound is a per-prospect-homework cost line. A research VA at $3-5/hr × 30 hrs/week runs $360-600/month. We collapse that one cost line. Apollo and Smartlead stay where they are."` |

---

## src/components/marketing/cine/cine-hero.tsx

| Line | Category | Before | After |
|---|---|---|---|
| 253 | TONE | Pill 1: `"Your on-demand SDR pod"` | KEEP. This phrasing is operator-tone and lands. |
| 266 | VANITY | Pill 2: `"47 audited leads in 5 minutes"` | KEEP. Specific, DB-backed, concrete. |
| 279 | MOCKUP | Pill 3: `"4× reply lift with a mockup"` | Replace with: `"Lead dossiers, not contact rows"` |
| 351-353 | TONE | SR-only description: `"Leadac AI scans Google Maps for local businesses, scores their websites, and drafts a personalised opener — all in five minutes."` | `"LeadAC pulls fresh leads off Google Maps for outbound agencies, audits each one, and grounds the opener in what the audit found. Built for local-business outbound."` (drop em dash, drop "AI" branding inside SR description, sharpen ICP) |

---

## src/components/marketing/cine/cine-features.tsx

This component is mostly already aligned. Two minor edits:

| Line | Category | Before | After |
|---|---|---|---|
| 41 | TONE | Headline: `"Cold email fails when it sounds <span>cold.</span>"` | `"Cold email replies come from doing the <span>homework.</span>"` |
| 44 | TONE | Sub: `"Replies come from proof you did the homework. We do it on every prospect."` | `"We run the homework on every prospect: audit, score, draft. Then your SDR ships."` |

The 4 feature cards (titles + body) stay. They're already operator-tone and the mockup-as-pillar is already absent.

---

## src/components/marketing/faq.tsx (legacy, may not be used on homepage but exists in the tree)

| Line | Category | Before | After |
|---|---|---|---|
| 9 | APOLLO | `"Apollo and Clay sell the same 50M B2B contacts to thousands of agencies, so the same prospects get hit by ten different pitches a month. Leadac AI pulls live from Google Maps every time you search, so the data is fresh and the businesses keep it current themselves. We focus on local service verticals like plumbers and dental practices, where Apollo's coverage is thin to begin with."` | KEEP the substance, soften the hostile framing on Apollo. New: `"Apollo and Clay own the enterprise B2B database — that's their strong category. We're the local-business lead-intelligence layer Apollo doesn't cover well: live Google Maps data, a real audit on every site, and an opener grounded in the audit. Most agencies run LeadAC in front of Apollo, not instead of it."` |
| 13 | MOCKUP | `"Yes. Pro and Agency plans include native CSV export in Smartlead and Instantly format, with custom variables for the mockup URL and the audit signals."` | Drop "mockup URL" from the canonical answer. Keep audit signals. |
| 24-25 | MOCKUP | Q: `"What's the website mockup for?"` + answer that positions mockup as the conversion lever | If this FAQ stays in the tree, move it to a Pro+ feature FAQ section. The homepage and main pricing page should NOT lead with mockup. The walk-in web agency landing page IS allowed to lead with it (different persona). |

---

## src/lib/marketing-coming-soon.ts

| Line | Category | Decision |
|---|---|---|
| 5 | n/a | `MARKETING_COMING_SOON = true` stays. The whole web-overhaul lands behind this flag. Phase H (auth gating + signup flow rewrite) flips it to `false` once the trial billing flow ships. Do NOT flip the flag mid-overhaul. |

---

## src/lib/plans.ts

| Line | Category | Before | After |
|---|---|---|---|
| 60-81 | FREE | Whole `FREE` plan definition with "50 fresh leads / month", "No credit card required" feature line | DO NOT delete the FREE plan from the enum or from the database — too many existing rows, too many code paths reference it. Instead: hide it from the marketing pricing cards, swap signup flow to the trial path, and let existing FREE-tier customers grandfather. See `docs/decisions/free-plan-sunset.md` for the full disposal. |
| 76 | FREE | feature: `"No credit card required"` | Remove from features list. The FREE plan still exists as an enum value, but its UI surface is gone, so this string no longer renders. |
| 84-85 | TONE | `name: "Pro Solo"`, tagline `"For solo SDRs and vertical specialists."` | Rename `name` to `"Solo"` (drop the "Pro" prefix in the marketing display). Tagline keeps. The `Plan.PRO` enum stays unchanged. |
| 113-115 | TONE | `name: "Pro Team"`, tagline `"For walk-in web agency starters and small teams."` | Rename to `"Studio"`. New tagline: `"For 2-3 person agencies and small SMMA shops."` |
| 145-147 | TONE | `name: "Agency"`, tagline `"For agencies running outbound for clients."` | Rename to `"Agency+"`. Tagline keeps. |

---

## src/components/marketing/pricing-cards.tsx

The card UI itself is fine. Display names need to read from the renamed `name` field in `plans.ts` (no separate edit needed once `plans.ts` updates).

The FREE-tier card needs to disappear from the public pricing surface. Two options for Phase C:

1. Filter `PLAN_ORDER` in the component to skip `FREE` (1 line change).
2. Add a `hidden?: boolean` flag to `PlanDefinition` and toggle it on FREE (cleaner).

Option 2 is the cleaner one because it keeps `PLAN_ORDER` as the single source of truth and gives us a flag we can flip back if needed. See `docs/decisions/free-plan-sunset.md` § Implementation.

---

## What this inventory does NOT cover

- Vertical landing pages (`for/agencies`, `for/smma`, `for/specialists`, `for/walk-in-web-agencies`) — these are mostly already aligned per Phase 0 audit. Phase D will do a per-page tone pass.
- Programmatic SEO routes — they have different positioning rules (search-intent capture). See `MARKETING.md` § 5.
- Internal product copy (worker names, internal feature names like "Copilot", "Mockup Generator") — out of scope for marketing audit. The marketing surfaces should AVOID those internal names; the internal product can keep them.
- Email templates and Resend templates — Phase J.
- TR-language copy — deferred to Phase I.

---

Last updated: 2026-05-06.
