# Product Marketing Context

*Last updated: 2026-04-23*
*Source: synthesized from `MARKETING.md`, `BUYER-PERSONA.md`, `REDDIT-MAPILEADS.md`, and `/last30days` evidence files in `~/Documents/Last30Days/`.*
*Owner: Çınar (positioning). Mert + Kaan PR-comment.*

---

## Product Overview

**One-liner:** Leadac AI turns Google Maps into a curated, AI-scored sales pipeline for local-service verticals — and ships a per-lead website plan with every lead.

**What it does:** Give Leadac AI a postcode and a vertical. It returns a ranked list of local businesses (sourced live from Google Places, not the Apollo dump), a Playwright-driven website audit on each one, a Gemini-generated quality score, a personalized cold-email opener, and a handbook-grounded website plan the SDR can attach to the first reply. Multi-tenant workspaces, BullMQ-backed crawl queue, Next.js + Prisma stack.

**Product category:** Vertical lead intelligence + value-engine platform for local-service B2B sales. Not an Apollo replacement, not an auto-sender, not a Webflow competitor — the upstream layer that feeds Instantly/Smartlead and closes the loop with a deliverable.

**Product type:** B2B SaaS, multi-tenant, subscription.

**Business model & pricing:**
| Plan | Monthly | Scope |
|------|---------|-------|
| Free trial | $0 | 50 leads, 1 vertical, 1 postcode, 3 website plans, no team |
| Pro | $79 | 1,000 leads/mo, all verticals, 1 seat, 50 website plans/mo |
| Agency | $249 | 5,000 leads/mo, 5 seats, multi-tenant workspaces, priority crawl queue, 300 plans/mo, landing-page mockup beta |
| Custom | Talk to us | Unlimited leads, dedicated crawl pool, white-label, unlimited plans + mockups |

Anchor: one booked sales call in this market is worth $100–$500. If Leadac AI books one extra call per month, Pro pays for itself 1–5×.

---

## Target Audience

**Target companies:** 1–10 person digital agencies selling web design / SEO / paid ads / done-for-you booking systems to local service businesses. Secondary: in-house SDR/BDR teams at vertical SaaS (booking software, payments, dispatch, POS) selling into local services. Tertiary: solo founders doing their own sales in years 0–2.

**Decision-makers:** Agency owner-operators (also the user, also the buyer — usually one person). For in-house SDR teams, the head of sales or RevOps owns the buy; the SDR is the user.

**Primary use case:** Replace the saturated Apollo/Clay spreadsheet with a fresh, vertical-specific lead list + a deliverable (website plan) that makes the first reply convert.

**Jobs to be done:**
- Book more demos per week without widening the TAM (fresh data, not more spray).
- Ship a reply that opens a conversation instead of asking for one (website plan as leave-behind).
- Stop researching every lead by hand before writing copy (Playwright audit + Gemini scoring does it).
- Run the same motion across multiple client accounts (multi-tenant workspaces, watchlists, role-based access).

**Specific use cases:**
- Agency targeting phone-repair shops in a London borough: 47 audited, ranked, personalized leads in under 5 minutes + a sample website plan for the highest-priority lead.
- Booking-software SDR with a territory: filter by "no booking system detected," pitch the wedge with an audit attached.
- Klaviyo/Webflow/GoHighLevel specialist starting their own agency: postcode + niche → client list + ready-to-pitch artifact.
- Agency white-labeling deliverables for three clients at once (Agency plan → Custom).

---

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| **Josh** — agency owner, 27–32, $15–60k MRR, 4–12 clients, 2–4 staff (primary ICP, Agency tier) | Predictable booked meetings, reply-rate math, stack ROI | Apollo list is saturated, AI outreach hurts brand, personalization at scale never sticks | Fresh Google Maps data + handbook-grounded website plan as the first-reply hook; you stay in control, AI drafts only |
| **Klaviyo/Webflow specialist** — 26–35, $0–15k MRR, ex-agency executor going solo (secondary ICP, Pro tier) | Getting first 5 clients, looking credible on day one | Has the vertical skill, zero client-acquisition muscle | Postcode + niche → ready-to-pitch list with a plan already attached |
| **Young SMMA operator** — 16–22, Skool/Gadzhi crowd (tertiary ICP, brand awareness only) | Looking legit to first prospects, replicating what the course taught | Low budget, unstable payment, TikTok/Discord native | The productized version of the course they just bought; distribute via influencers, not direct outbound |
| **Vertical SaaS SDR** — 24–30, inside sales at booking/POS/dispatch SaaS | Hit quota, beat 1–2% reply baseline | LinkedIn Sales Nav + Apollo getting 1–2% reply on local businesses | "No booking detected" segment as a ready-made outbound wedge |

---

## Problems & Pain Points

**Core problem:** The cold-outreach stack every agency owns (Apollo + Clay + Instantly/Smartlead + ChatGPT) now delivers the same 50M contacts to everyone. The same prospect gets five near-identical pitches in the same week. Reply rates are collapsing, churn is rising, and "AI for cold email" makes the quality floor worse, not better.

**Why alternatives fall short:**
- **Apollo / Clay / ZoomInfo / Lusha:** commoditized 50M contact pool. No coverage of local-service operators (plumbers, HVAC, repair shops, dental). Every SDR is hitting the same inboxes.
- **LinkedIn Sales Navigator:** local-service operators don't live on LinkedIn — they maintain their Google Business Profile.
- **Generic AI SDR tools (Agent Frank, 11x, etc.):** pure-AI auto-send hurts brand and deliverability. r/agency thread (78 comments) shows engineers literally rewriting every AI draft.
- **Manual Google Maps scraping in spreadsheets:** what operators do today at midnight. Works, but doesn't scale past one vertical / one region.
- **Webflow / Framer / generic page builders:** not the same job. Those host sites; we ship a sales artifact.

**What it costs them:** Reply rate stuck at 1–2% vs the 3–4% industry baseline. Every missed reply = missed $100–500 booked call. Hours per week researching leads before writing. AI tools actively damaging sender reputation when misused.

**Emotional tension:** "Everyone told me cold email was dead in 2026" (r/coldemail, 204 comments). Fear that the outbound motion they built their agency on is running out of runway. Shame about sending generic AI slop. Resentment at paying $300+/mo for a list everyone else has.

---

## Competitive Landscape

**Direct (same solution, same problem):**
- **Apollo / Clay / ZoomInfo / Lusha** — stale spreadsheet of the same 50M contacts. We don't fight on enterprise SaaS contact databases; we pull from a fresher, local-service-specific source (Google Places) and bundle a deliverable.
- **Instantly / Smartlead / Lemlist** — falls short because they're senders, not sources. We integrate (CSV today, native push next), not compete.

**Secondary (different solution, same problem):**
- **Manual Google Maps scraping + ChatGPT first-line generation** — what r/coldemail operators do by hand. Doesn't scale, no audit, no mockup.
- **LinkedIn Sales Navigator + Apollo** — poor local-service coverage, same saturation problem.
- **Generic AI SDR tools (11x, Agent Frank, Regie)** — auto-send kills brand; buyers rewrite every message anyway.

**Indirect (conflicting approach):**
- **Hire an offshore appointment-setter + give them Apollo** — same stale list, now with a human overhead.
- **Run ads and wait for inbound** — wrong motion for this ICP. Agencies need outbound control.

**Where each falls short for our buyer:** none of them combine (a) fresh local-specific data, (b) per-lead website audit, (c) personalized opener grounded in audit findings, and (d) a handbook-grounded website plan as the first-reply deliverable. The website plan is the part nobody else ships.

---

## Differentiation

**Key differentiators:**
- **Google Places–native source** instead of the Apollo dump — fresh data, local coverage, no list saturation.
- **Playwright-driven website audit on every lead** — detects booking systems (Calendly, SimplyBook, Setmore, Booksy, Square), Core Web Vitals, schema, security headers.
- **Per-lead website plan generator (Gemini 2.5 Flash, 14-section handbook-grounded prompt)** — already shipped at `src/lib/prompts/website-plan-prompt.ts`.
- **Multi-tenant workspaces + priority crawl queue + role-based access** — real infra moat, not a weekend wrapper.
- **AI-assisted, human-shipped positioning** — never auto-sends. SDR ships the message.
- **Vertical-deep scoring** — per-vertical ranking heuristics (phone repair today; HVAC, plumbing, dental, locksmiths, opticians on the roadmap).

**How we do it differently:** We treat the lead as the start of the sale, not the end. Every other tool hands you a contact and says good luck. We hand you a contact, an audit, a score, an opener, and a plan — the full shape of the first two emails in the conversation.

**Why that's better:** The SDR's reply rate compounds because the follow-up is a deliverable, not a nudge. "What would this cost?" gets answered by the plan itself, not by another round of discovery.

**Why customers choose us:** one-line positioning — *"We don't just sell you the lead. We sell you the first version of the pitch."*

---

## Objections

| Objection | Response |
|-----------|----------|
| "Can't I just scrape Google Maps myself with Apify + ChatGPT?" | You can, for one vertical, for a weekend. Then the audit, scoring, watchlist, multi-tenant handoff to team, and the handbook-grounded plan generator become the thing you'd have to build. We already built it. |
| "I already pay for Apollo / Clay — why add another line item?" | Apollo's list is saturated; you're reading from the same well as thousands of other agencies. We're the fresher upstream layer; Agency plan at $249 is ~15% of a typical agency stack and often replaces part of Apollo. |
| "AI-written outreach hurts my brand." | Agreed — which is why we don't auto-send. We draft, you ship. The plan attachment is the thing that makes the reply feel researched, not generic. |
| "How do I know the reply rate actually beats 3–4%?" | Pilot on 50 free leads + 5 website plans in your chosen vertical + postcode. A/B against your current list. If it doesn't beat your baseline, don't pay. |
| "Our SDRs won't use another tool." | One-click CSV export to Instantly/Smartlead today, native push next quarter. They don't leave their sender; they just receive better inputs. |
| "Does it work for my vertical?" | Phone repair (London) is the first pack. HVAC, plumbing, dental, locksmiths, auto-detailing, opticians are the roadmap — ask which pack and we'll tell you timing, or you can run custom verticals today with lower scoring confidence. |
| "Can I white-label the website plan for my clients?" | Custom plan only today; Agency plan mockup beta includes light white-label. Full white-label is on the roadmap for mid-2026. |

**Anti-persona:** Enterprise SaaS SDRs (wrong ICP, go use Apollo). Consumer product marketers (wrong tool entirely). Anyone philosophically opposed to any cold outreach. Operators under $5k/mo who can't afford the Pro plan and won't activate past trial.

---

## Switching Dynamics (JTBD Four Forces)

**Push (frustrations driving them away from current stack):**
- Apollo list saturation → reply rate in free-fall
- Hours per week hand-researching leads for local-service clients
- AI outreach tools hurting their sender reputation
- Clients churning because "my current data source is the same one every other agency pitches from"

**Pull (what attracts them to Leadac AI):**
- Fresh Google Maps data nobody else is scraping at scale yet
- A deliverable (website plan) attached to every reply
- Handbook-grounded AI output that doesn't read like slop
- Multi-tenant infra built for agencies from day one, not retrofitted
- "We don't just sell you the lead. We sell you the first version of the pitch."

**Habit (what keeps them stuck):**
- Existing Apollo/Clay/Smartlead integrations wired into their workflow
- SDRs trained on the current stack
- Sunk-cost on contracts signed at annual billing
- "We've always done it this way" inertia

**Anxiety (worries about switching):**
- "Will my SDRs adopt another tool?"
- "What if the data coverage is worse in my city?"
- "What if the AI plans embarrass me in front of a prospect?"
- "Is this team going to be around in 12 months?"
- Turkish buyers specifically: "Is this a foreign SaaS I can't get a proper invoice from?"

---

## Customer Language

**How they describe the problem (verbatim from r/coldemail, r/agency, r/SMMA):**
- > "Google Maps is the most underrated lead database in cold email." (r/coldemail, 121 comments)
- > "What does ICP actually mean for home service businesses? The usual B2B data tools don't work here."
- > "Same 50M contacts. Same data from the same crawls. Same emails that have been cold emailed by 10 other people this month."
- > "If you're using AI for cold outreach, are you OK with the damages?"
- > "3–4% reply / 96%+ deliverability is the realistic bar."
- > "I need a predictable way to get clients." (r/SMMA)
- > "I worked as an executor, and I don't know how agencies acquire clients." (Klaviyo specialist)

**How they describe what they want us to be:**
- > "Postcode + niche → 47 audited leads, ready-to-pitch, with a mockup."
- > "Fresh data + ready personalization."
- > "Lead + website value engine. Not just the contact — the deliverable."
- > "AI ranks and drafts, human ships."

**Words to use:**
- *fresh*, *local*, *vertical*, *audit*, *ranked*, *deliverable*, *first reply*, *leave-behind*, *handbook-grounded*, *per-lead website plan*, *postcode*, *booked call*, *reply rate*, *integration* (with Instantly/Smartlead), *control*, *draft*, *Google Places*.

**Words to avoid:**
- *predictable* (real customer word, but "AI-tell"; rephrase as "the math stops sliding week to week")
- *leverage*, *unlock*, *supercharge*, *game-changer*, *revolutionize*, *cutting-edge*, *seamlessly*
- *AI SDR*, *AI sends for you*, *fully automated outreach*, *autonomous agent* (triggers the quality-collapse fear)
- *Apollo killer*, *Webflow killer* (we're not; these are anti-positions)
- *empower*, *streamline*, *holistic*, *robust*, *best-in-class*

**Glossary:**
| Term | Meaning |
|------|---------|
| Discovery | Running a new crawl for a postcode + vertical |
| Lead | A business record from Google Places + our audit + score |
| Audit | Playwright-driven website check (mobile, speed, schema, booking detection, security headers) |
| Website plan | Handbook-grounded, 14-section per-lead plan generated by Gemini 2.5 Flash |
| Mockup | Rendered HTML/Tailwind preview of a plan (next milestone) |
| GEO | Generative Engine Optimization — getting cited by ChatGPT / Perplexity / AI search results |
| Vertical pack | A curated crawl + scoring configuration for a specific niche (phone repair, HVAC, plumbing, dental…) |
| Watchlist | Saved search + pipeline view of leads an SDR is working |
| Opener | AI-generated first cold email grounded in audit findings |
| Leave-behind | The website plan attached to the first reply, or the public per-lead page (roadmap) |

---

## Brand Voice

**Tone:** Research-grounded, specific, founder-direct. Never corporate. Never salesy. Quotes real Reddit posts by upvote count, cites thread URLs, names prices in real dollars. Reads like a smart operator writing to another smart operator — not like a marketing team.

**Style:** Short subjects, specific numbers, concrete examples, zero buzzwords. Plain sentences over clever ones. When in doubt, say the number ("47 leads in 5 minutes," not "massively scale your pipeline"). Bilingual EN/TR capable — the Turkish voice is equally direct, slightly more conversational, uses real Turkish idioms rather than translated English marketing-speak.

**Personality (3–5 adjectives):** direct, technical, evidence-grounded, vertical-deep, anti-slop.

**Hard rules:**
- Never claim features that aren't shipped. Website-plan generator = shipped (as of 2026-04); mockup = "shipping next sprint"; public leave-behind pages = "on the roadmap." Never conflate.
- Never say "AI does the sending." We are AI-assisted, human-shipped.
- Every positioning claim cites a Reddit thread, an upvote count, or a production code path.
- Run all copy through the `humanizer` skill and `tr-en-marketing-sync` before it hits a landing page.

---

## Proof Points

**Metrics (public):**
- 3–4% reply / 96%+ deliverability = cold-email industry baseline (r/coldemail, 60k-email operator). Our target: clear it consistently.
- 12%+ positive reply rate documented by r/coldemail operators using personalized `{{firstName}}/{{companyName}}` scripts on curated lists (52 upvotes, 83 comments). Our Gemini personalization ships this shape by default.
- Website plans generated in ~20 seconds per lead, Gemini 2.5 Flash, 14-section handbook grounding.
- Multi-tenant crawl queue (BullMQ + Redis) handles parallel discovery runs without blocking workspace-level rate limits.

**Customers:** Pre-launch. First paying case study targeted for Week 4 of the 30-day sprint (see `MARKETING.md §14`).

**Testimonials:** None yet (pre-launch). Closest validation: community-verified pain signals.
> "Google Maps is the most underrated lead database in cold email." — r/coldemail, 2026-04-14, 121 comments
> "Same 50M contacts. Same data from the same crawls." — r/coldemail recurring theme

**Value themes:**
| Theme | Proof |
|-------|-------|
| Fresh local data beats saturated contact dumps | r/coldemail "Google Maps is underrated" thread (121 comments) + our Google Places live source |
| Personalization grounded in real audit findings beats generic AI | r/coldemail 12%-reply script post + `src/lib/prompts/website-plan-prompt.ts` handbook prompt |
| Human ships, AI drafts — brand safety by design | r/agency AI-damage thread (78 comments) + our "never auto-send" default |
| Multi-tenant built for agencies from day one | Working workspaces, team invites, role-based access, priority crawl queue |
| Vertical depth over horizontal coverage | Phone-repair pack live; HVAC, plumbing, dental, locksmiths, opticians on the roadmap |
| Website plan turns the first reply into a deliverable | `website-plan-prompt.ts` + lead-detail UI shipped |

---

## Goals

**Business goal:** Land the first 25 paying Agency-tier customers ($249/mo × 25 = ~$6k MRR) from the r/coldemail community within the 30-day launch sprint, then use those case studies to open the Klaviyo/Webflow specialist segment in months 2–3. 12-month realistic target: $40–55k MRR.

**Primary conversion action:** Start the free trial with a specific postcode + vertical (50 leads + 3 website plans, no credit card). Secondary: book a 15-minute Loom demo with the founder (`§9.3` demo script in `MARKETING.md`).

**Current metrics (baseline, pre-launch):**
- Landing page: `/` + vertical-specific pages (`/for/agencies`, `/for/specialists`) in `src/app/(marketing)/` — traffic TBD.
- Pre-launch signups, demo requests, trial activations: track via `analytics-tracking` skill once wired.
- First KPI to publish publicly: reply-rate lift vs. Apollo baseline from first case study (target Week 4 of sprint).

**Secondary goals:**
- Refresh this document every 30 days using `/last30days` skill output. Any new top-3 thread updates §2 of `MARKETING.md` and the Customer Language section here.
- Ship landing-page mockup v0 (Mert) to visually close the website-plan pitch.
- Fill the `competitor-profiling` and `customer-research` skills with concrete entries for Apollo, Clay, Instantly, Smartlead within the sprint.

---

## Related skills in this workspace

This file is read first by every other marketing skill in `C:\Users\meert\.cursor\skills\`. The most commonly triggered combinations for Leadac AI:

- `copywriting` + `page-cro` → editing `src/app/(marketing)/page.tsx` and `/for/*` vertical pages
- `seo-audit` + `ai-seo` + `schema-markup` → making Leadac AI findable in ChatGPT/Perplexity (see also `seo-public-pages` workspace skill)
- `cold-email` + `email-sequence` → our own outbound to the r/coldemail top commenters
- `ad-creative` + `paid-ads` → Meta/X ad iterations once CAC is known
- `competitor-alternatives` → `/vs/apollo`, `/vs/clay`, `/vs/instantly` pages
- `programmatic-seo` → vertical pack landing pages at scale (phone repair → HVAC → plumbing → …)
- `customer-research` → biweekly `/last30days` refresh; feed new Reddit threads back into §9 of `MARKETING.md`
- `vertical-landing-template` (workspace skill) → scaffolds new `/for/<niche>` pages using this context
- `tr-en-marketing-sync` (workspace skill) → keeps `MARKETING-TR.md` and `/tr` pages in voice
- `humanizer` (workspace skill) → final pass on all copy before it ships

---

## Maintenance

- **Owner:** Çınar. Mert and Kaan PR-comment.
- **Refresh cadence:** every 30 days, or whenever `MARKETING.md`, `BUYER-PERSONA.md`, or pricing changes materially.
- **Regeneration command:** run the `product-marketing-context` skill and say "update from MARKETING.md and BUYER-PERSONA.md."
- **Source of truth hierarchy:** if this file conflicts with `MARKETING.md`, `MARKETING.md` wins and this file is stale — regenerate.
