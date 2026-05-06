# LeadAC — positioning

This is the strategic positioning doc. Three pages. Read this before changing any marketing copy or pitching the product.

The shorter operational doc is `.agents/product-marketing-context.md`. The page-by-page copy book is `MARKETING.md`. The audience profiles are in `BUYER-PERSONA.md`.

---

## 1. Market context (what changed)

Three things shifted between mid-2024 and early 2026 that broke the previous outbound playbook for small agencies:

**Apollo is everyone's exhaust.** The same 50 million B2B contacts that powered the 2022-2023 SMMA wave are now sold to thousands of agencies running near-identical sequences. Receiving inboxes have seen the same prospect ten times this month. Reply rates on recycled-list outbound dropped from a normal 3-4% range into the 1-2% range across the industry through 2025. The fix is not a better cadence. The fix is data nobody else has.

**AI personalization stopped working.** First-line generators powered by GPT-3.5/4 all sound the same after twelve months of training data leakage. "I noticed you launched..." is now a deliverability signal. The receiving inbox figured it out. Sequences that lean on AI personalization without grounded research have collapsed reply rates below 2% and pushed agencies into "please remove me" reply hell.

**Manual research caps at 10 prospects a day.** A senior SDR can write a great per-prospect message — for ten prospects. That is not a pipeline. The middle path between "AI slop at scale" and "hand-write every email" is the gap nothing was filling.

LeadAC is the third path: fresh local data nobody else has, a real audit attached to every email, and an opener that references something the prospect can see on their own homepage right now.

## 2. ICP (who this is for)

We sell to **agency owners running outbound for local-business clients.** Not a marketing team at a Series B. Not a 200-rep SDR organization. The owner who is already on Reddit at midnight asking why Apollo stopped working.

Inside that, six personas (full breakdown in `BUYER-PERSONA.md`):

| Persona | Setup | What they buy LeadAC for |
|---|---|---|
| B2B outbound agency owner | 1 owner + 1 to 3 SDRs | Local-business lead-gen layer Apollo doesn't cover, plus the per-prospect homework |
| SMMA owner | 1 to 5 person social/web shop | Stop pricing-pressure spiral with predictable lead pipeline |
| Specialist going solo | Klaviyo / paid social / SEO ex-employee | First 3 retainer clients without an SDR hire |
| Walk-in web agency | Local web design, door-knocking | Pre-qualified leads with audit-derived pitch |
| F&B / restaurant-tech BD team | 2-10 person SaaS BD | Manual restaurant research is killing throughput |
| Local SEO agency | 2-10 person GMB / SEO shop | Audit-to-retainer conversion lift |

What unites all six: they sell a service or product priced at $500 to $5,000 per month per client, mostly to local SMBs, and they spend more time finding the next prospect than fulfilling for the current one.

What we are NOT for:
- Enterprise SDR teams (sales cycle 6-9 months, wrong economics for our pricing)
- B2C anything
- Product-led growth motions ("free signup, viral loop")
- AI hype tourists (they want a free toy; we charge $79+ and don't apologize for it)

The hype-tourist exclusion is deliberate. Our previous FREE plan was their hideout. Sunsetting it is a positioning act, not just a billing change. See `docs/decisions/free-plan-sunset.md`.

## 3. Canonical positioning sentence

Memorize this. Every page should rhyme with it.

> For agency owners running outbound to local-business clients, LeadAC is the local lead-intelligence layer that covers the gap Apollo and Clay leave open.
>
> Apollo owns the enterprise B2B database. We own local. We pull live from Google Maps, run a 20-plus signal audit on every site, score fit 0-100, and draft the opener grounded in what the audit found. The deliverable is a lead dossier ready for your pipeline review.
>
> Result: 3-5x reply rates over recycled-list outbound, and retainer-grade clients in week 4 instead of pilot calls in month 2. Most agencies run LeadAC in front of Apollo, not instead of it.

The first paragraph is the category. The second is the mechanism. The third is the outcome. Do not lead with the mechanism. Do not say "replaces Apollo" — that misreads the category and starts an argument we don't need to be in.

## 4. Against (how we position vs the alternatives)

We are not in Apollo's category. We are in the category Apollo doesn't cover. Same for Clay, Smartlead, and the rest. Treat this table as "what each tool is good at" + "where the local-business outbound gap is" + "where we sit."

| Tool | Strong at | Weak at (the gap we cover) | Our angle |
|---|---|---|---|
| **Apollo** | Enterprise B2B contacts at scale ($99-149/mo) | Local SMBs barely covered. The dentist, the cafe, the contractor — Apollo's data is thin or stale. | "Apollo for enterprise. LeadAC for local. Run them in front of each other, not against." |
| **Clay** | Heavy enrichment + waterfall data + GPT first-lines | $$$$ at scale; prompts go stale; not designed around local-business signals or per-site audits | "Clay is a Lego set. We are a finished motion for one specific buyer." |
| **Smartlead / Instantly** | Sender, warmup, deliverability, sequencing | They ship the email; they don't tell you what to write | "We feed your sender. Smartlead and Instantly stay where they are." |
| **Hire an SDR / VA** | Per-prospect research + writing | Scales linearly, $4k-$8k/mo plus management overhead | "$249/mo Agency+ = ~$8/day. One $1,500/mo retainer pays it back 75x." |
| **A directory / Maps scraper** | A list of names and URLs, period | No audit, no scoring, no opener context, no fit signal | "A list is not a pipeline. We hand you a dossier plus a draft." |

We do **not** compete with Apollo on enterprise contact coverage. We do not compete with HubSpot on CRM. We do not compete with Salesforce on anything. We do compete with the time and money an agency owner currently spends on a research VA plus the per-prospect homework their SDR pretends to do.

Pricing argument that always works:

> Local outbound costs more than people think: a research VA at $3-5/hour for 30 hours/week is $360-600/month. Add a Clay seat and an enrichment credit pack on top of that and the homework alone runs $500+/month. LeadAC Agency+ does it for $249, with the audit and draft already attached to the lead. One subscription. No credit math.

Note: do NOT phrase the pricing argument as "$249 instead of Apollo + Clay + Smartlead + VA = $X." It misreads the category. Apollo and Smartlead stay; the VA cost is what we collapse.

## 5. Pricing logic

Source of truth for the numbers: `src/lib/plans.ts`.

| Tier | Display name | Monthly USD | Seats | Why this tier |
|---|---|---|---|---|
| FREE | (sunset) | $0 | 1 | Hype-tourist hideout. Sunsetting. |
| PRO | Solo | $79 | 1 | Solo SDR or specialist. One closed retainer pays 19 months. |
| PRO_TEAM | Studio | $149 | 3 | Small agency, 2-3 SDRs. Industry-standard $149 anchor. |
| AGENCY | Agency+ | $249 | 5 | Full agency. Replaces Apollo + Clay + VA stack. |

Annual: 20% off effective monthly rate (industry standard 2026: Asana 18%, Canva 23%, Notion 31%; deeper than 30% signals desperation).

GBP pricing exists for UK detection (`detectBrowserCurrency` in plans.ts).

The pricing argument lives on the pricing page itself, not just in the cards: math first, features second.

## 6. Evidence layer (what we can claim)

We are pre-revenue at scale. Most validated numbers come from the FineDine beta cohort (Camden / North London cafes, 12 leads, May 2026 — see `research/finedine/beta-test-round-2-camden-report.md`).

What we **can** claim today, with sources:

- "47 audited leads in 5 minutes" — DB-backed from internal staging runs
- "20+ signals scored, 0-100 opportunity score" — true, see `src/lib/agent-workers/sales-opportunity-scorer.ts`
- "500 reviews scanned per lead" — ceiling, see `src/lib/agent-workers/review-analyst.ts`
- "Research VA at $3-5/hour for 30 hours/week = $360-600/month before Clay enrichment credits" — public market-rate math (do NOT collapse Apollo or Smartlead into this number; they are separate categories)
- "Reply rates 1-2 per 200 on recycled-list outbound" — sourced quote from r/coldemail (8-year vet, 42 upvotes, April 2026)
- Industry benchmark: "3-4% reply rate, 96%+ deliverability is the realistic bar" — sourced quote from r/coldemail 60k-email operator

What we **cannot** claim today (do not write these in copy):

- A specific reply rate number for our customers ("4.7% reply rate" — we don't have it yet)
- Customer count over 10 ("Used by 200 agencies" — false)
- Named customer testimonials beyond what we have written permission for
- Revenue figures for our own product

When in doubt: pull it. Stretching evidence costs more trust than missing the claim costs revenue.

### Evidence layer roadmap

Asset: when it lands.

- FineDine case study (anonymized as "F&B SaaS BD team running Camden cafe outreach"): Phase B, Hafta 2 of web overhaul plan. If written permission lands, swap to named.
- Logo wall placeholder: Phase B (placeholder text "Trusted by N agencies" until 3+ written permissions land).
- Demo video (60-90s): Phase G, recorded against Camden cohort data.
- Real reply-rate metric: post-Round-3 beta validation, ~6-8 weeks out.

## 7. Distribution thesis (where the buyers actually are)

Not everywhere. Specifically:

**In:**
- LinkedIn outbound to agency owners (we sell to operators; LinkedIn is where they live)
- Niche forums and Slack/Discord communities (agency-only Slacks, BNI-style structures, Restaurant Owner Subreddits for the F&B vertical)
- SEO directory routes (`(public)/{niches,cities,alternatives,vs,glossary,blog}` — already built, needs content fed)
- Partnerships with CRM partner programs (GHL, HubSpot Solutions Partners) and agency coaching programs
- Cold email (yes, we eat our own cooking — drives the most qualified signups historically)

**Out:**
- Product Hunt launch (hype-tourist channel)
- AI Twitter / X threads about "I built X with Cursor" (wrong audience)
- Indie Hackers makers Slacks ("build in public" energy attracts the wrong tenant)
- Reddit AI subs (r/ChatGPT, r/singularity)

The distribution thesis is paired with the FREE plan sunset. We are deliberately narrowing top-of-funnel to qualified buyers. Any short-term signup-volume drop is the system working as designed.

## 8. Architecture-positioning fit (why this is defensible)

The codebase is already shaped for this ICP. Pieces that exist that confirm the B2B-only positioning:

- `Workspace` model with `Plan`, multi-tenant scope, `WorkspaceMember` roles — agency operator with 1-5 SDRs, not a single-user toy
- `ServicePackage` table with tiered packages, package recommendation logic — selling services, not consuming a tool
- `SalesOpportunity` table, opportunity score, recommended package, suggested offer — closing motion
- `AgentRun` worker queue with quota enforcement — high-throughput per-prospect intelligence
- Memory layer (`SemanticMemory`, opener success memory) — playbook automation
- Apify enrichment (deep review, social, competitor ads, LinkedIn hiring) — agency-grade research

This is not the architecture of a free AI toy. It is the architecture of an outbound operations layer. The positioning shift is catching up to what the architecture already decided.

## 9. The ban list (what positioning does NOT do)

- Does not say "AI agent platform" (positions us against AutoGPT/Cognition; wrong category)
- Does not say "for everyone who does cold email" (false range; we are for a specific buyer)
- Does not say "no-code" (irrelevant to B2B agency owners; signals hobbyist tool)
- Does not lead with mockup feature (mockup is vertical-only, not homepage pillar)
- Does not promise a reply-rate number we have not validated
- Does not put an em dash where a period would do
- Does not use "transformative", "groundbreaking", "revolutionary"
- Does not start a paragraph with "In today's rapidly evolving..."
- Does not describe itself as "the future of outbound" — we are the present of outbound for a specific buyer

---

Last updated: 2026-05-06 (Phase A of web-presence overhaul).
