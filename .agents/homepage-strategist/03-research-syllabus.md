# 03 — Research syllabus

Everything you need to study so your RFCs read like you have been in the room with the buyer and the user. Organized by the question it answers, not the medium it lives in.

This is not a "read it all and then start". This is a "read it in the week the onboarding plan tells you to, and come back when you are stuck on a specific question". Pick the section that maps to the open question on your desk.

The [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md) is the lens. This file is the source material.

---

## A. Market and ICP

What you are answering: who is the buyer, what changed in their world, why do they need a new tool now, what are they already paying for, what would they cancel to make room for us.

### Must-read (already in the repo)

- [`POSITIONING.md`](../../POSITIONING.md) § 1 (Market context) and § 2 (ICP).
- [`BUYER-PERSONA.md`](../../BUYER-PERSONA.md) — all six personas.
- [`.agents/product-marketing-context.md`](../product-marketing-context.md) § What changed in 2025-2026.

### External sources

- **The agency outbound ecosystem.** Read the last 90 days of `r/coldemail`, `r/agency`, `r/SMMA`. The questions agency owners ask each other every week are your buyer signal. Bookmark the threads that keep coming back: deliverability complaints, Apollo data quality complaints, "what tool do you use", "is anyone else seeing reply rates drop".
- **Pricing benchmarks.** Apollo, Clay, Smartlead, Instantly, Outreach, Salesloft, Lemlist, Reply.io. Pull the pricing page screenshots into `research/teardowns/pricing-benchmarks.md` so you can argue our tiers in context. Cross-reference [`src/lib/plans.ts`](../../src/lib/plans.ts).
- **The retainer math.** A B2B outbound agency typically charges $2k–$8k/month per client and aims for 5–20 active retainers. Total revenue $10k–$160k/month. Tool budget is usually 5–10% of that. Internalize this number so you can argue $79–$249/month as cheap, not as expensive.
- **Local-business SaaS funnels.** FineDine, Toast, OpenTable, SevenRooms, Square for Restaurants, Mindbody, Boulevard. They are not competitors, but they market to a buyer who shares some shape with our F&B BD persona. Pay attention to how they handle "how a restaurant actually buys software" — long, relationship-driven, demo-heavy.

### Output to your research folder

`research/synthesis/market-and-icp.md`. Living doc. Append as you learn. By month 2 it should be your one-pager you can hand to a new hire.

---

## B. Competitors — deep teardowns

What you are answering: how does the rest of the category treat the two pages we own? What patterns do they use? Where do they win? Where do they lose?

For each, use [`templates/competitor-teardown.md`](./templates/competitor-teardown.md). Capture screenshots into `research/teardowns/assets/<competitor>/`.

### Tier 1 — direct, must teardown

| Competitor | URL | Focus on |
|---|---|---|
| Apollo | apollo.io | Homepage hero, "How it works", pricing page; in-app prospect detail view (request a demo or take public screenshots) |
| Clay | clay.com | Homepage, "What is Clay", waterfalls page, enrichment table screens |
| Smartlead | smartlead.ai | Homepage, deliverability copy, integrations page |
| Instantly | instantly.ai | Homepage, hero proof, pricing |
| Outreach | outreach.io | Homepage, sequences page, deal command center |
| Salesloft | salesloft.com | Homepage, "Conductor AI", platform page |
| HubSpot Sales Hub | hubspot.com/products/sales | Homepage, contact / company timeline, deal pipeline |
| Lemlist | lemlist.com | Homepage, free-tools section, video proof |
| Reply.io | reply.io | Homepage, AI SDR positioning |
| Gong | gong.io | Homepage, deal cards, call summaries |

### Tier 2 — direct, half-page teardown

- Salesforce — Sales Cloud homepage and Account 360 demo video.
- Pipedrive — homepage and deal card (smaller-team CRM lens).
- Close.com — homepage (calling-first CRM lens).
- ZoomInfo — homepage and prospect view (enterprise alternative we are NOT trying to replace).

### Tier 3 — adjacent inspiration

| Site | Reference for |
|---|---|
| Linear (linear.app) | Information density, confidence in the writing, "Method" page narrative |
| Stripe (stripe.com) | Technical credibility without jargon; the way they let the product speak |
| Attio (attio.com) | Modern CRM register; the "for the way you actually work" message done well |
| Notion (notion.so) | Progressive disclosure and show-don't-tell hero |
| Default (default.com) | RevOps speed feel; "scheduling + routing + enrichment" combo |
| Cursor (cursor.com) | Developer-buyer hero done well; clear ICP, clear outcome |
| Vercel (vercel.com) | Logo wall, "trusted by", subtle dev-first credibility |
| Webflow (webflow.com) | Visual hierarchy on a long homepage |

### Tier 4 — local-business / vertical SaaS analogs

| Site | Reference for |
|---|---|
| FineDine | F&B BD funnel; bilingual marketing precedent; tier laddering |
| Toast | Restaurant-first hero; "talk to sales" CTA prominence |
| OpenTable | Restaurant onboarding flow |
| SevenRooms | Premium F&B positioning |
| Mindbody | Multi-vertical local-business handling |
| Square for Restaurants | "Side product for a big platform" framing |

### Output

A teardown md per competitor in `research/teardowns/`. One synthesis doc per month in `research/synthesis/<yyyy-mm>-teardown-synthesis.md` summarizing the patterns you keep seeing.

---

## C. SDR workflow research

What you are answering: what does an SDR actually do all day, what tools do they live in, what makes them love a tool, what makes them rage-quit a tool. The lead-detail page exists for this person; you cannot redesign it without watching them.

### Sources

- **Live observation if possible.** Watch one SDR work for 2 hours. Take notes on every click and every tab switch.
- **Bravado community** (bravado.co) — long-form posts from real SDRs.
- **RevGenius community** — operator threads.
- **SDR Defenders** (sdrdefenders.com) — newsletter and community.
- **Pavilion** — paid community but the public posts are useful.
- **Twitter/X accounts to read 6 months back:**
  - Sam Nelson (Outreach) — sequence design
  - Florin Tatulea (Common Room) — outbound tactics
  - Will Allred (Lavender) — email writing patterns
  - Jordan Crawford (Blueprint) — ICP and signal-based outbound
  - Adam Robinson (Retention.com / RB2B) — signal selling
  - Nicholas Thickett (Alignd) — multi-channel outbound
  - Jen Allen-Knuth (DemandJen) — Challenger sale modernization
- **Lavender's "Email Coach" blog** — line-by-line cold-email teardowns.
- **Lemlist's Friday Sales podcast** — operator interviews.

### What to extract

- The 5 most common SDR rituals (queue triage, dial, opener edit, send, log).
- The 5 most common SDR frustrations with their current stack.
- The 3 things SDRs say a tool must do for them to actually open it every morning.
- The 3 things SDRs say make them stop using a tool after the trial.

### Output

`research/synthesis/sdr-workflow.md`. Append as you learn.

---

## D. Local-business sales playbooks

What you are answering: how do real sellers actually sell to the local SMB that Revint ends up touching? This is the FineDine / OpenTable / restaurant-tech BD playbook, the SMMA owner-on-Reddit playbook, the walk-in web agency playbook, the [`docs/berkay-paketler.md`](../../docs/berkay-paketler.md) jeweler playbook. If you do not understand how this sale happens, your RFCs will optimize for the wrong moments.

### Sources

- [`docs/berkay-paketler.md`](../../docs/berkay-paketler.md) — the jeweler playbook. Read twice. Notice the tier laddering, the segment-specific selling line, the "if reviews are good vs bad" branching.
- [`MARKETING.md`](../../MARKETING.md) § Vertical landings — all current vertical landing copy.
- [`src/app/(marketing)/for/`](../../src/app/(marketing)/for) — where vertical landings live as route folders (e.g. `for/restaurant-agencies/page.tsx`).
- FineDine partner page, Toast restaurant page, OpenTable for Restaurants — how the platform-side sells to the SMB.
- "Restaurant Recovery" podcast, "The Restaurant Strategist" podcast.

### What to extract

- The 3 friction points a local-business buyer has when buying any software.
- The 3 trust signals that move them faster.
- The pricing register that works (subscription anxiety is real for SMBs).
- The role of a partner / agency in the sale (because Revint's user is often selling THROUGH an agency to an SMB).

### Output

`research/synthesis/local-business-sales.md`.

---

## E. Authoritative reads (canonical sources for the frameworks)

What you are answering: when you cite a framework in an RFC, you need to know it well enough to defend it. These are the source books and essays for the frameworks in [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md).

### Positioning and narrative

- April Dunford — *Obviously Awesome* and *Sales Pitch*. Read at least the chapter summaries.
- Clayton Christensen — "Jobs to be Done" essays, especially the milkshake one.
- Andy Raskin — "The Greatest Sales Deck I've Ever Seen" Medium essay. Read three times.
- Al Ramadan / Dave Peterson / Christopher Lochhead / Kevin Maney — *Play Bigger* (category design summary fine if you cannot read the whole book).
- Geoffrey Moore — *Crossing the Chasm* (skim is fine).
- LinkedIn B2B Institute — the "95-5 rule" and "Category Entry Points" research.

### Homepage copywriting and CRO

- Donald Miller — *Building a StoryBrand*. The 7-part framework.
- Joanna Wiebe — Copyhackers blog. Pay particular attention to "Voice of Customer" articles.
- Bryan Eisenberg — *Waiting for Your Cat to Bark*. The Conversion Trinity.
- Eugene Schwartz — *Breakthrough Advertising* (skim — the awareness stages framework alone is worth it).
- Marketing Examples (marketingexamples.com) — Harry Dry's homepage breakdowns.
- ConversionXL / CXL Institute — research-driven CRO process posts.
- WiderFunnel — the LIFT model.
- NN/g (Nielsen Norman Group) — the 5-second test methodology and 10 heuristics.
- Julian Shapiro — "Growth Handbook" (free, online).
- Lenny Rachitsky — newsletter homepage breakdowns and growth essays.

### Persuasion and behavioral

- Robert Cialdini — *Influence* and *Pre-Suasion*. The 6+1 principles.
- Daniel Kahneman — *Thinking, Fast and Slow* (System 1 / System 2; loss aversion; framing).
- Richard Thaler / Cass Sunstein — *Nudge*.
- BJ Fogg — *Tiny Habits* (Fogg behavior model: B = MAT).
- Nir Eyal — *Hooked*.
- Chip and Dan Heath — *Made to Stick* (the SUCCESs framework).

### Sales method

- Neil Rackham — *SPIN Selling*.
- Matthew Dixon / Brent Adamson — *The Challenger Sale*. *The Challenger Customer* if you have time.
- Keenan — *Gap Selling*.
- David Sandler — *You Can't Teach a Kid to Ride a Bike at a Seminar* (Sandler method).
- MEDDPICC — Force Management materials and the original MEDDIC explainer (Jack Napoli).
- Aaron Ross — *Predictable Revenue* (outbound process classic).
- Trish Bertuzzi — *The Sales Development Playbook*.

### SaaS metrics

- David Skok — "For Entrepreneurs" blog, all SaaS metric posts.
- Tomasz Tunguz — blog and *Winning with Data*.
- Patrick Campbell / ProfitWell — pricing and retention essays.
- Reforge — Growth Series materials (if accessible).
- a16z — "16 SaaS metrics" post and follow-ups.

### Design and UX

- Don Norman — *The Design of Everyday Things*.
- Jakob Nielsen — 10 Usability Heuristics; F-pattern research.
- Steve Krug — *Don't Make Me Think*.
- Refactoring UI (Adam Wathan / Steve Schoger) — practical reference.
- Laws of UX (lawsofux.com) — quick reference for Hick's, Fitts's, Miller's, Jakob's, Doherty threshold, etc.

### Modern B2B and category creation

- Pavilion playbooks — sales and revops resources.
- Lenny's Newsletter — paid posts on PMF, growth loops, retention.
- First Round Review — long-form essays.
- a16z B2B blog.
- Pocus and Common Room blogs — signal-based selling.

---

## F. Inside-the-codebase research (do not skip)

What you are answering: what is technically possible here, what is already half-built, what is forbidden. Most of this lives in [`05-infrastructure-primer.md`](./05-infrastructure-primer.md); the sources below are the raw material.

- [`AGENTS.md`](../../AGENTS.md) — top-level conventions.
- [`.cursor/rules/architecture.mdc`](../../.cursor/rules/architecture.mdc) — folder map and hard rules.
- [`.cursor/rules/multi-tenant-scope.mdc`](../../.cursor/rules/multi-tenant-scope.mdc) — required reading before any lead-detail RFC.
- [`.cursor/rules/ui-components.mdc`](../../.cursor/rules/ui-components.mdc) — design tokens and component conventions.
- [`.cursor/rules/nextjs-16.mdc`](../../.cursor/rules/nextjs-16.mdc) — what changed (async params, caching defaults).
- [`.cursor/rules/api-routes.mdc`](../../.cursor/rules/api-routes.mdc) and [`.cursor/rules/prisma-db.mdc`](../../.cursor/rules/prisma-db.mdc) — so you know what backend changes are cheap vs heavy.
- [`src/components/marketing/v2/*`](../../src/components/marketing/v2) — the current homepage section components.
- [`src/components/app/lead-detail-v2/*`](../../src/components/app/lead-detail-v2) — the current lead-detail blocks.
- [`src/lib/plans.ts`](../../src/lib/plans.ts) — tier source of truth.
- [`src/lib/feature-flags.ts`](../../src/lib/feature-flags.ts) — how new blocks gate behind flags.
- [`src/lib/seo/metadata.ts`](../../src/lib/seo/metadata.ts) — how metadata is built.

---

## How to use this file

You are not reading this list end to end every month. You are using it as an index.

- "I am stuck on a hero headline" → § E Homepage copywriting → Marketing Examples + Lenny's homepage breakdowns + StoryBrand. And § C SDR workflow for the verbatim.
- "I am stuck on lead-detail information density" → § B Tier 1 (Apollo, Clay, Outreach, Gong) → § E Design and UX (Norman, NN/g, Krug).
- "I am stuck on CTAs" → § E Persuasion (Cialdini, Fogg) → § B (look at what Linear / Stripe / Cursor do for primary vs secondary).
- "I am being told the proposal is too big" → § F (find the cheap variant that ships in a week).

Next file: [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md).
