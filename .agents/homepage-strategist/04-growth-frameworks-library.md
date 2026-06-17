# 04 — Growth frameworks library

The toolkit. Around 35 frameworks across positioning, copywriting, persuasion, sales method, CRO, growth, UX, and SaaS finance. One paragraph each, plus a "use when" line and a "do not use when" line so you do not reach for the wrong tool.

You are not expected to use all of them. You are expected to know which one to reach for when the question on your desk lands. The source material for each lives in [`03-research-syllabus.md`](./03-research-syllabus.md) § E.

Conventions in this file:
- **What it is** — one paragraph of mechanism.
- **Use when** — the question on your desk that this tool answers.
- **Do not use when** — the failure mode for misapplying it.
- **Where it shows up in our work** — how it maps to the homepage or lead-detail RFC, or to a section of an existing repo doc.

---

## A. Positioning and strategic narrative

### A1. April Dunford 10-step positioning

**What it is.** Define the competitive alternatives the buyer considers, list your unique attributes vs those alternatives, translate each attribute into the value it delivers, identify the customer segments that care most about that value, and rebuild market category, point of view, and tagline from that foundation. Positioning is a function of the alternatives, not a function of your features.

**Use when.** You are writing the homepage hero, the canonical positioning sentence, or fighting a "we are like Apollo but better" instinct in the copy. Use to defend the existing canonical line in [`POSITIONING.md`](../../POSITIONING.md) § 3.

**Do not use when.** You are speccing a single in-product block. This is a strategic lens, not a UI lens.

**Where it shows up.** Hero section of the homepage RFC. Every vertical landing RFC. The "ICP this RFC is for" field of every template.

### A2. Jobs-to-be-Done (Christensen)

**What it is.** Buyers do not buy products; they hire products to make progress on a job. The job has functional, emotional, and social dimensions. The competitor is anything else they could hire for the same job, including doing nothing and using a spreadsheet. The milkshake example: people buy a thick milkshake on the morning commute because they hire it to make a boring 30-minute drive less boring while keeping one hand free.

**Use when.** You are speccing a lead-detail block ("what job does an SDR hire this block to do?"). Or you are writing the problem statement at the top of an RFC. Or you are running an SDR interview and need a structure for the questions.

**Do not use when.** You already have a clear primary job. JTBD is for clarification, not decoration.

**Where it shows up.** [`templates/sdr-interview-notes.md`](./templates/sdr-interview-notes.md), every lead-detail RFC's "primary SDR job" field.

### A3. Category Design (Play Bigger)

**What it is.** Markets are not discovered; they are designed. A "category king" gets 76% of category economics. The play is to name the problem the new category solves, define the category, and condition the market to think your way before you sell your product.

**Use when.** You are tempted to position Revint inside an existing category ("the best AI SDR tool"). Stop. Re-read [`POSITIONING.md`](../../POSITIONING.md) and remember we are explicitly *not* claiming to replace Apollo.

**Do not use when.** It is overkill for a section spec.

**Where it shows up.** Background context for any homepage rewrite. The "what changed in 2025-2026" narrative in [`.agents/product-marketing-context.md`](../product-marketing-context.md) is a category-design move.

### A4. The 95-5 rule (LinkedIn B2B Institute)

**What it is.** At any given time, only ~5% of B2B buyers are in-market. The other 95% are not buying right now but will be at some point. Long-term brand-building targets the 95%; short-term performance targets the 5%. Most companies underinvest in the 95%.

**Use when.** You are arguing for "memorable" hero copy over "purely conversion-optimized" hero copy, or building the case for non-pricing-page content. The 95-5 framing also affects how to treat the waitlist and email capture.

**Do not use when.** You are inside a single conversion test that is purely measuring this week's signups.

**Where it shows up.** The argument for keeping a memorable founder-line hero ("Your SDR's brain, in software.") instead of a feature-list hero.

### A5. Andy Raskin strategic narrative

**What it is.** Five-part structure for the deck or homepage that tells the buyer they are at a turning point: (1) Name a big, undeniable change in the world. (2) Show there will be winners and losers. (3) Tease the promised land. (4) Introduce the obstacles between here and there. (5) Position your product as the magic that gets them past the obstacles.

**Use when.** You are sketching the macro arc of the homepage. The current narrative — "Apollo is exhaust, AI personalization is dying, manual research caps at 10/day" — is already structured this way. Use the framework to defend the arc.

**Do not use when.** You are writing a UI label.

**Where it shows up.** Homepage RFC § narrative arc; the existing ProblemGrid → HowItThinks → DossierProof flow is approximately this.

### A6. Crossing the Chasm (Geoffrey Moore)

**What it is.** New tech adoption goes innovators → early adopters → chasm → early majority → late majority → laggards. Most products die in the chasm because what excites early adopters bores the early majority. To cross, you must own one beachhead segment completely.

**Use when.** Deciding which persona to write the next RFC for. Pick one. Do not try to please all six.

**Do not use when.** As an excuse to ignore vertical signal.

**Where it shows up.** [`02-onboarding-30-day-plan.md`](./02-onboarding-30-day-plan.md) week 4 requires you to pick a single ICP for the v0.1 RFC.

---

## B. Homepage and section-level copywriting

### B1. StoryBrand 7-part (Donald Miller)

**What it is.** Frame every page as a story where the customer is the hero. Seven beats: (1) A character (the customer). (2) Has a problem (external + internal + philosophical). (3) Meets a guide (you). (4) Who gives them a plan. (5) Calls them to action. (6) Helps them avoid failure. (7) And ends in success.

**Use when.** Your homepage feels like a feature catalog and not a story. Run the seven beats over the section order and see which beat is missing.

**Do not use when.** You are speccing a single block in isolation.

**Where it shows up.** Homepage RFC § narrative arc; § hero spec ("character + problem + plan"); § final CTA ("success state").

### B2. AIDA

**What it is.** Attention → Interest → Desire → Action. The oldest copy structure. A single section, an email, a hero — all of these need to walk through these four states.

**Use when.** You are stuck on the order of elements inside a single section. Try AIDA before reaching for something heavier.

**Do not use when.** You think a whole homepage is one big AIDA. It is not. It is a sequence of small AIDAs.

**Where it shows up.** [`templates/section-spec.md`](./templates/section-spec.md) anatomy ordering.

### B3. PAS — Problem, Agitate, Solve

**What it is.** State the problem the reader has. Agitate it (twist the knife, show the cost of leaving it unsolved). Solve it (introduce your fix). Especially effective for cold readers who have not yet decided they have the problem.

**Use when.** You are writing the second section after the hero. Or you are writing a cold email subject + opener. The current ProblemGrid is doing PAS at a section level.

**Do not use when.** The reader already knows they have the problem (e.g., a return visitor from an ad).

**Where it shows up.** Homepage RFC § ProblemGrid (or equivalent) spec.

### B4. Bryan Eisenberg's Conversion Trinity

**What it is.** Every page must answer three questions in order: (1) Relevance — am I in the right place? (2) Value — what do I get and why is it worth my time? (3) Call to action — what do I do next, and is the friction low enough that I actually do it? If any of these fails, the page fails.

**Use when.** Auditing an existing section. The trinity is a quick three-point checklist.

**Do not use when.** As your only lens. It is necessary but not sufficient.

**Where it shows up.** [`07-decision-criteria.md`](./07-decision-criteria.md) builds on this. Every section spec implicitly asks "does it pass relevance, value, CTA?".

### B5. The 5-second test

**What it is.** Show the page to a target user for 5 seconds, hide it, ask: what does the company do, who is it for, and what do you do next? If they cannot answer all three, the above-the-fold has failed. Methodology comes from NN/g and Usability Hub.

**Use when.** Every hero spec. Always.

**Do not use when.** Testing copy that is below the fold or for a different visitor mode (e.g., return visitor coming to read a feature page).

**Where it shows up.** [`07-decision-criteria.md`](./07-decision-criteria.md) Test 1.

### B6. Eugene Schwartz "5 stages of awareness"

**What it is.** Buyers are at one of five stages: Unaware, Problem Aware, Solution Aware, Product Aware, Most Aware. The same copy fails at the wrong stage. "Buy now" fails on an Unaware visitor; "what is this thing" fails on a Most Aware visitor.

**Use when.** Sketching the homepage flow. The hero typically addresses Problem Aware. The final CTA addresses Most Aware. The middle does the conversion of one to the other.

**Do not use when.** You assume your visitor is at the same stage as you. They are not. They are probably more Unaware than you think.

**Where it shows up.** Homepage RFC § narrative arc; the FAQ block exists in large part to convert Solution Aware to Product Aware.

### B7. "One job per section" rule

**What it is.** A homepage section should do exactly one job. If you cannot name the job in one sentence, the section is doing two jobs (or zero) and needs to split (or be deleted).

**Use when.** Auditing the current 11-section homepage. For each section, write the one-sentence job. If any section fails, it gets flagged in the RFC.

**Do not use when.** Writing a longform blog. Different medium.

**Where it shows up.** Week 1 homepage state-of-the-page audit (see [`02-onboarding-30-day-plan.md`](./02-onboarding-30-day-plan.md)).

### B8. Above-the-fold rubric

**What it is.** Above the fold must contain: (1) what it is, (2) who it is for, (3) primary outcome / benefit, (4) primary CTA, (5) one piece of proof (logo, number, quote). If any is missing, the hero is incomplete.

**Use when.** Every hero spec.

**Do not use when.** Mobile hero — there is no fold on mobile; treat the first 100vh as the unit.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) § hero spec.

### B9. Voice of Customer (Joanna Wiebe / Copyhackers)

**What it is.** The best copy is not written; it is lifted. Mine sales call transcripts, support tickets, reviews, Reddit threads, and direct interviews for the exact language buyers use. Use their words, not yours.

**Use when.** Every single time you write copy. The week-3 interview output ([`02-onboarding-30-day-plan.md`](./02-onboarding-30-day-plan.md)) is the input to this.

**Do not use when.** You are tempted to "improve" a verbatim quote. Do not improve it. Use it as-is or pick a better one.

**Where it shows up.** [`templates/sdr-interview-notes.md`](./templates/sdr-interview-notes.md) § verbatim quotes; copy drafts in every section spec.

---

## C. Persuasion and behavioral

### C1. Cialdini 6+1 principles

**What it is.** Reciprocity, Commitment & Consistency, Social Proof, Authority, Liking, Scarcity, and (added later) Unity. Each is a documented shortcut humans use to decide. You can stack two or three on a single section; more than three feels like a used-car sales floor.

**Use when.** Designing CTAs, proof sections, scarcity messaging (waitlist, cohort capacity), authority signals (logos, founder credentials), commitment ladders (email → trial → paid).

**Do not use when.** As a substitute for substance. Cialdini stacked on a weak offer is still a weak offer.

**Where it shows up.** Waitlist block (scarcity + social proof). DossierProof (authority + social proof). FinalCTA (commitment + reciprocity).

### C2. Loss aversion and framing (Kahneman)

**What it is.** Losses loom roughly twice as large as equivalent gains. "Stop losing 4 deals a month" hits harder than "win 4 more deals a month" for the same buyer. Framing the same fact in loss vs gain terms changes behavior.

**Use when.** Writing a problem section, a churn-prevention message, or a "what your SDR is missing today" pitch.

**Do not use when.** Continuous loss framing exhausts the reader. Alternate with gain framing.

**Where it shows up.** ProblemGrid; the "leads going stale" angle; cold-email subject lines.

### C3. Fogg behavior model

**What it is.** Behavior = Motivation × Ability × Trigger (B = MAT). For an action to happen, the user must want to do it (M), be able to do it (A), and be prompted to do it (T) at the same moment. If a behavior is not happening, one of the three is missing.

**Use when.** Diagnosing a low-conversion CTA. Usually the trigger is right but ability (friction) is too low or motivation (perceived value) is too low.

**Do not use when.** You think this is enough to plan an end-to-end funnel. It is enough to fix one moment.

**Where it shows up.** Lead-detail RFC § primary action — every primary action must be B = MAT-pass.

### C4. Hooked (Nir Eyal)

**What it is.** Habit-forming products run on a loop: Trigger → Action → Variable Reward → Investment. The investment phase loads the next trigger.

**Use when.** Designing the SDR's daily ritual with the lead-detail page. The trigger is the morning queue; the action is opening a lead; the variable reward is "is this lead actually good?"; the investment is the disposition or note.

**Do not use when.** Trying to apply to a single homepage visit. Habit loops are for product, not for a marketing landing.

**Where it shows up.** Lead-detail RFC § daily ritual narrative.

### C5. Made to Stick — SUCCESs (Heath brothers)

**What it is.** Sticky ideas are Simple, Unexpected, Concrete, Credible, Emotional, Stories. Use as a checklist when an idea or claim is not landing.

**Use when.** Auditing your own hero or section claim. If it fails 3+ SUCCESs criteria, it is forgettable.

**Do not use when.** As a generation tool. It is an audit tool.

**Where it shows up.** Hero copy audits; case-study selection.

### C6. Social proof typology

**What it is.** Social proof has several flavors that work for different buyers: (a) Expert proof (named experts vouch), (b) Celebrity proof, (c) User proof (named customers vouch), (d) Wisdom of crowds ("10,000 agencies trust us"), (e) Wisdom of friends ("3 of your peers use this"). Different ICPs respond to different flavors. Agency owners trust other agency owners more than they trust a celebrity endorsement.

**Use when.** Choosing logos, testimonials, quote attribution. Currently the homepage uses Reddit pull-quotes — that is wisdom-of-friends. Cohort metrics (47 audited leads in 5 minutes) is user proof.

**Do not use when.** Mixing five types in one section. Pick one or two per section.

**Where it shows up.** DossierProof section; vertical landings; final CTA proof element.

### C7. Endowed progress

**What it is.** People are more likely to complete a task if they perceive they have already started. Two stamps already on a 10-stamp card; a profile that is "60% complete"; a checklist with the first item pre-ticked. Loyalty cards exploit this.

**Use when.** Onboarding, signup flow, or any commitment ladder. The lead-detail page can apply this when proposing a "complete your audit" prompt that ships with 2 of 6 steps already done by the system.

**Do not use when.** The user has not actually done anything. Fake progress is detectable and feels manipulative.

**Where it shows up.** Lead-detail RFC § preliminary-banner / progressive enrichment narrative.

---

## D. Sales methods — so you speak SDR

These exist because Revint's product already speaks several of them in the UI ([`src/components/app/lead-detail-v2/MeddpiccChecklist.tsx`](../../src/components/app/lead-detail-v2/MeddpiccChecklist.tsx), `BantBars`, `SpinBoard`, `QualificationBlock`). If your lead-detail RFC ignores these methods, it will not fit the existing user expectations.

### D1. SPIN Selling (Neil Rackham)

**What it is.** Discovery questions in four types: Situation, Problem, Implication, Need-payoff. Implication is the leverage — it is the question that turns a small problem into a big one ("if you don't fix this, what happens at year-end?"). Built into the existing `SpinBoard` block.

**Use when.** Designing lead-detail blocks that surface discovery prompts to the SDR. Or designing copy that asks the reader implication questions ("if your reply rate stays at 1.6%, how many fewer deals close this quarter?").

**Do not use when.** Replacing it with BANT — they are not the same.

**Where it shows up.** Lead-detail RFC § SpinBoard spec. Cold-email body templates.

### D2. MEDDPICC

**What it is.** Enterprise sales qualification: Metrics, Economic buyer, Decision criteria, Decision process, Paper process, Identify pain, Champion, Competition. Built into the existing `MeddpiccChecklist` block.

**Use when.** Designing lead-detail qualification UX. Or designing the "pricing page leads to demo" flow for the higher-tier buyer.

**Do not use when.** The buyer is an owner-operator buying $79/month. MEDDPICC is heavy. BANT is lighter and often sufficient at our price point.

**Where it shows up.** Lead-detail RFC § MeddpiccChecklist spec; the "for larger teams" narrative on Pro_Team and Agency tiers.

### D3. BANT

**What it is.** Budget, Authority, Need, Timeline. Light qualification. The existing `BantBars` block visualizes this.

**Use when.** Designing the "is this lead worth my next hour?" decision for the SDR. The lead-detail page should let the SDR answer BANT in 5 seconds.

**Do not use when.** Misapplying as a one-size-fits-all. BANT skews seller-centric; modern variants put pain first.

**Where it shows up.** Lead-detail RFC § BantBars spec.

### D4. The Challenger Sale

**What it is.** The best sellers Teach, Tailor, and Take control. They reframe the buyer's worldview with a new insight (Teach), then connect it to the buyer's specific situation (Tailor), then assert next steps confidently (Take control).

**Use when.** Designing the "RecommendedApproach" block on the lead-detail. The system should give the SDR a teach insight, not just a data dump. Or designing the homepage problem section — "what if the thing you think is the problem is not the problem".

**Do not use when.** Confrontational framing is the wrong move for relationship-driven F&B sales. Use Sandler instead.

**Where it shows up.** Lead-detail RFC § RecommendedApproach spec; ProblemGrid framing.

### D5. Gap Selling (Keenan)

**What it is.** Sell the gap between the buyer's current state and their desired future state. The gap is the value. If the gap is small, the sale is small. The seller's job is to make the gap visible and quantified.

**Use when.** Writing the homepage problem-to-solution narrative. Or designing the lead-detail "why this lead, why now" block — the gap is the buying signal.

**Do not use when.** You cannot quantify the gap. Vague gap selling becomes vague selling.

**Where it shows up.** WhyNowBlock spec; hero subhead arithmetic ("from 1.6% to 4% reply rate" is gap selling).

### D6. Sandler

**What it is.** A seven-step method with strong emphasis on upfront contracts (agreeing on what happens next), pain funnel (digging past surface pain), and disqualification (it is fine if they are not a fit, move on). Relationship-driven, longer cycles.

**Use when.** The F&B / restaurant-tech BD persona, where deals are relational and slow.

**Do not use when.** The SMMA owner / outbound agency persona where pace is faster and the deal happens in 7-14 days.

**Where it shows up.** F&B vertical-landing RFCs; FineDine-shaped buyer's lead-detail RFC.

### D7. Predictable Revenue (Aaron Ross)

**What it is.** The classic outbound playbook that separated SDR (prospecting), AE (closing), and CSM (retention) roles. Established cold-calling 2.0, email-first prospecting, and the idea of a predictable outbound pipeline.

**Use when.** Background context for who an SDR is and why they exist as a role. Useful when explaining "why Revint exists" to someone outside sales.

**Do not use when.** Treating it as current best practice. The playbook is 15 years old; the modern variants (signal-based outbound, multithreading) have moved on.

**Where it shows up.** Background context only.

---

## E. CRO and conversion

### E1. LIFT model (WiderFunnel)

**What it is.** Six conversion factors: Value Proposition (the elevator), Clarity, Relevance, Distraction, Urgency, Anxiety. The first three lift conversion; the last three drag it down. Score a page on all six.

**Use when.** Auditing an existing page or section. Numerical-ish, fast to apply.

**Do not use when.** As a substitute for customer research. LIFT tells you what to fix; research tells you what to change it to.

**Where it shows up.** Section spec audit; weekly teardown audits.

### E2. ConversionXL / ResearchXL 6-step

**What it is.** Heuristic analysis → Technical analysis → Web analytics → Mouse-tracking / heatmap → Qualitative survey → User testing. Always research before testing. The ratio of research to testing is usually 80:20 in a healthy CRO program.

**Use when.** Building a CRO process around the homepage and lead-detail. Use to argue against "let's just A/B test it" without research.

**Do not use when.** You are pre-launch and have no traffic to mine yet. Skip the analytics steps; lean harder on qualitative.

**Where it shows up.** [`06-weekly-operating-rhythm.md`](./06-weekly-operating-rhythm.md) cadence.

### E3. ICE prioritization

**What it is.** Impact × Confidence × Ease, score each 1-10, multiply, sort the backlog. Simple and abuseable (everyone scores their own idea high on Confidence).

**Use when.** You have more proposals than time. Use ICE to order the backlog.

**Do not use when.** As the only prioritization. Some bets are non-negotiable (e.g., compliance, multi-tenant scope) regardless of ICE.

**Where it shows up.** Backlog ordering for proposals/.

### E4. PIE prioritization

**What it is.** Potential × Importance × Ease. Same shape as ICE, different second-letter emphasis (Importance = "is this page strategically important?").

**Use when.** When ICE is overweighting nice-to-have heroes over below-the-fold structural fixes.

**Do not use when.** You already have ICE working.

**Where it shows up.** Backlog re-ordering when ICE is misleading.

### E5. Friction audit

**What it is.** Walk through the conversion path step by step and count every form field, every decision, every wait, every confusion. Each is a friction unit. Halving friction often raises conversion as much as doubling motivation.

**Use when.** Auditing the signup flow, the trial-start flow, the "first lead created" flow. Useful for any homepage CTA spec.

**Do not use when.** You are tempted to remove friction that is intentional (e.g., the 14-day trial requires a card — that is a quality filter, not bad friction).

**Where it shows up.** Homepage RFC § CTA spec; lead-detail RFC § primary action spec.

### E6. Doherty threshold (UX)

**What it is.** Productivity soars when a system and its users interact at a pace (<400ms) that ensures neither has to wait. Above that, users disengage.

**Use when.** Specifying loading states for the lead-detail. If a block takes >400ms to render, it needs a skeleton or a "preliminary" state — see the existing `PreliminaryBanner`.

**Do not use when.** Designing initial-load — first paint is a different number.

**Where it shows up.** Lead-detail RFC § empty states and edge cases.

---

## F. Growth and funnels

### F1. Pirate Metrics — AARRR (Dave McClure)

**What it is.** Five-stage funnel: Acquisition → Activation → Retention → Referral → Revenue. The original SaaS funnel framework. Updated by some to RARRA (retention first) for product-led growth.

**Use when.** Sketching the macro funnel the homepage feeds into. Useful for "what happens after signup" thinking.

**Do not use when.** Designing a single page. AARRR is for the funnel, not the surface.

**Where it shows up.** Homepage RFC § success metrics + measurement plan; pre-register the relevant stage metric.

### F2. Reforge Growth Loops

**What it is.** Funnels are linear and leak; growth loops are circular and compound. Each successful action creates the input for the next action — e.g., user signup → user invites teammate → teammate signs up → invites their teammate.

**Use when.** Designing for compounding growth. Revint has a possible loop: user closes a deal → cited Revint in the win → posts about it → other agency owners see → sign up.

**Do not use when.** Pretending a loop exists when it does not. Loops are real or they are not.

**Where it shows up.** Long-term growth strategy; not usually inside a single RFC.

### F3. Brian Balfour — ICP × Channel × Model fit

**What it is.** Sustainable growth requires three things to fit together: the ICP, the channel that reaches them efficiently, and the business model that monetizes them. Misfit on any one breaks the others. The "$10/month SMB sold via outbound sales" example is the canonical misfit.

**Use when.** Defending the choice of an ICP for an RFC. The "agency owner sold via SEO + cold inbound at $79-$249/month" combo is the current fit; departures need to be justified.

**Do not use when.** Picking one of the three in isolation.

**Where it shows up.** Homepage RFC § ICP this RFC is for.

### F4. Sean Ellis PMF survey

**What it is.** Ask users: "How would you feel if you could no longer use this product? (Very disappointed / Somewhat disappointed / Not disappointed.)" Below 40% "very disappointed" = no PMF; above = approaching PMF. The 40% number is a benchmark, not a law.

**Use when.** You want a defensible "do we have PMF" answer instead of a vibes-based one. Especially useful when proposing a homepage rewrite — you want to know whether you are changing positioning of a working product or whether the product itself needs work first.

**Do not use when.** You only have 5 users. Sample is too small.

**Where it shows up.** Background; week 3 customer interviews should include this question informally.

### F5. North Star Metric

**What it is.** The single metric that best captures the value the product delivers to customers. Not revenue (lagging); not signups (vanity); something in the middle that tracks actual usage value. For Revint a candidate is "leads acted on within 24h" — proxies for "the SDR found the audit useful enough to send".

**Use when.** Pre-registering the metric that an RFC will move. Tie every RFC back to whether it nudges the North Star.

**Do not use when.** You think there is only one possible North Star. There are usually 2-3 defensible candidates; pick the one that aligns with the current quarter's focus.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) § success metrics; [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md) § success metrics.

### F6. Activation rate

**What it is.** % of new signups who reach the "aha" event within the activation window (often 7 days, sometimes 1 hour). The aha event must be the moment a user perceives core value. For Revint, candidate aha events: "first 50 leads imported", "first audit-grounded opener sent", "first reply received".

**Use when.** Pre-launch and just-post-launch. The homepage RFC should pre-register an activation goal.

**Do not use when.** Picking an aha event before customer interviews tell you what the aha actually is.

**Where it shows up.** Homepage RFC § measurement plan; success criteria post-launch.

---

## G. UX laws (so the lead-detail page is usable, not just informative)

### G1. Hick's Law

**What it is.** The time to make a decision grows with the log of the number of choices. More choices = slower decisions = lower action rates. Simplify menus, CTAs, options.

**Use when.** A page has more than 3 CTAs above the fold. Or a block has more than 5 options.

**Do not use when.** Removing necessary options for power users who need them.

**Where it shows up.** Lead-detail RFC § primary / secondary / tertiary actions.

### G2. Fitts's Law

**What it is.** Time to acquire a target is a function of distance and size. Bigger and closer targets are faster to hit. The primary CTA should be the biggest, most central tappable surface.

**Use when.** Designing the lead-detail header bar and primary action button. The existing `StickyShell` + `MobileStickyCTA` already obey Fitts on mobile.

**Do not use when.** Making everything big — Fitts only helps if hierarchy is preserved.

**Where it shows up.** Lead-detail RFC § header bar; mobile sticky CTA spec.

### G3. Miller's Law

**What it is.** Short-term memory holds ~7 ± 2 items. Chunk longer lists into groups of 3-5.

**Use when.** Designing the section count on the homepage (current count is 11 — at the upper bound). Or designing a block with many fields.

**Do not use when.** Treating "7" as a magic number; it is a guide, not a rule.

**Where it shows up.** Section-count audits; block-density audits.

### G4. Jakob's Law

**What it is.** Users spend most of their time on other sites. They expect your site to work the same way. Innovate where you have a reason; conform everywhere else.

**Use when.** You are tempted to invent a novel navigation pattern. Do not. Use the Linear/Stripe/Notion-shaped pattern.

**Do not use when.** Defending a literally-identical-to-everyone-else page. Conform on UX, differentiate on substance.

**Where it shows up.** Homepage navigation spec; lead-detail block-shape spec.

### G5. Nielsen 10 usability heuristics

**What it is.** Visibility of system status; match between system and real world; user control and freedom; consistency and standards; error prevention; recognition over recall; flexibility and efficiency; aesthetic and minimalist design; help users recognize, diagnose, recover from errors; help and documentation. A checklist that catches more issues than its size suggests.

**Use when.** Every lead-detail block spec. Run the 10 against the block.

**Do not use when.** Substituting for actual user testing.

**Where it shows up.** Lead-detail RFC § per-block spec.

### G6. F-pattern reading

**What it is.** On dense pages users read in an F-shape: top horizontal sweep, second shorter horizontal sweep, then a vertical scan down the left side. Put the highest-value information at the top-left of every section.

**Use when.** Speccing dense lead-detail blocks where information density is high.

**Do not use when.** Highly visual layouts (image-led, card-grid) — the pattern shifts.

**Where it shows up.** Lead-detail RFC § information hierarchy.

### G7. Progressive disclosure

**What it is.** Show only what is needed for the moment; reveal advanced or rarely-used details on request. Reduces cognitive load without removing capability.

**Use when.** Lead-detail blocks with many fields — show the headline data; tuck the rest behind an expand. The existing `WebsiteIntelLazyPanel` is doing exactly this.

**Do not use when.** Disclosure hides the primary action the user is here for. Never hide what 80% of users came to do.

**Where it shows up.** Lead-detail RFC § information hierarchy; every block spec.

---

## H. SaaS metrics literacy (so your ROI copy is honest)

You do not need to be a finance person. You need to know enough not to write a number that an agency owner sees as ridiculous.

### H1. CAC — Customer Acquisition Cost

**What it is.** Total spend to acquire a paying customer, including ads, content, sales salaries, tooling. The "honest" CAC includes all of these.

**Use when.** Arguing pricing or ROI in copy. Useful as background.

**Do not use when.** Quoting a number you cannot defend.

**Where it shows up.** Background literacy.

### H2. LTV — Lifetime Value

**What it is.** Total revenue from a customer over their lifetime, often computed as ARPA / churn rate. For SaaS at $79/month with 5% monthly churn → $1,580 LTV.

**Use when.** Defending or arguing pricing tiers in copy. The existing ROI line ("$249/mo = $8/day; one closed local-business client at $1,500/mo retainer pays it back 75x") is an LTV-style argument from the buyer's perspective.

**Do not use when.** Citing LTV without churn assumption.

**Where it shows up.** Pricing copy; ROI sections.

### H3. Payback period

**What it is.** Months until LTV covers CAC. Best-in-class SaaS sits under 12 months; healthy under 18.

**Use when.** Arguing pricing tiers and trial length.

**Do not use when.** Treating as fixed law.

**Where it shows up.** Pricing strategy background.

### H4. Magic Number

**What it is.** Quarter-over-quarter ARR growth divided by previous quarter's sales+marketing spend. >1 = efficient growth; <0.75 = inefficient.

**Use when.** Background for arguing marketing investment vs sales investment trade-offs.

**Do not use when.** In copy. This is internal language.

### H5. NDR — Net Dollar Retention

**What it is.** Revenue retained from existing customers including expansion and minus contraction/churn. >100% = compounding revenue without new logos.

**Use when.** Designing the upgrade narrative across the product (lead-detail → Pro → Pro_Team → Agency).

**Do not use when.** As a homepage claim until we have the data.

**Where it shows up.** Upgrade-prompt design on the lead-detail (e.g., `UpgradeBanner`, `UpgradeModal`).

### H6. The "buyer ROI line" rule

**What it is.** For every price you ask, give the buyer a one-sentence ROI argument they can repeat to their CFO / spouse / themselves. The existing line — "$249/mo Agency+ = ~$8/day. One closed local-business client at $1,500/mo retainer pays it back 75x over the year" — is the template.

**Use when.** Every pricing-adjacent copy block. Every upgrade prompt.

**Do not use when.** The math is fragile (i.e., requires assumptions the buyer would dispute).

**Where it shows up.** Pricing page; upgrade banners; final CTA copy.

---

## How to pick the right framework

Decision tree:

1. The question is about **what we say and to whom** → A (positioning) + B (copy).
2. The question is about **whether they will act** → C (persuasion) + E (CRO).
3. The question is about **what the SDR does inside the product** → D (sales method) + G (UX).
4. The question is about **what happens after they sign up** → F (growth) + H (SaaS metrics).
5. The question is about **whether the proposal is worth doing at all** → ICE / PIE (E3-E4) + the 7 tests in [`07-decision-criteria.md`](./07-decision-criteria.md).

When you cite a framework in an RFC, cite which one and one-sentence why. Reviewers should not have to look it up.

Next file: [`05-infrastructure-primer.md`](./05-infrastructure-primer.md).
