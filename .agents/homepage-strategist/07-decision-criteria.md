# 07 — Decision criteria

Seven tests. Every RFC passes them before it leaves your desk. They are the gate between "I wrote a thing" and "this is ready for review".

The tests are intentionally short, named, and orderable so they can be run as a checklist. They are also embedded inside the RFC templates so you do not have to remember to run them — the templates ask.

A proposal that fails a test does not automatically die. It either gets revised, or it gets shipped with the failure called out explicitly in the RFC's "Open questions" section. What you do not get to do is ship a failing test silently.

---

## The seven tests

| # | Name | One-line |
|---|---|---|
| 1 | 5-second | Can the hero be understood in 5 seconds? |
| 2 | 500-co | Would a 500-employee company's VP Sales forward this? |
| 3 | SDR-30x | Does this survive being opened 30 times a day? |
| 4 | FineDine BD | Would the closest real-world analog recognize their workflow? |
| 5 | Voice | Zero banned words; preferred phrases earn their place? |
| 6 | Evidence | Every claim sourced or pulled? |
| 7 | Engineering | Maps to existing patterns or flags the cost honestly? |

Run them in this order. Each is described below with what passing looks like, what failing looks like, and how to fix it.

---

## Test 1 — 5-second

**The question.** Show the above-the-fold to a target user for 5 seconds, hide it, ask: "What does this company do? Who is it for? What do you do next?" If they cannot answer all three, the hero fails.

**Passing looks like.** Three sentences, almost verbatim from the page:
- "It's a lead-generation tool for agencies that sell to local businesses."
- "It's for the small agency owner running outbound."
- "I would book a demo / join the waitlist."

**Failing looks like.** "It's AI for sales, I think." or "Some kind of CRM?" or "I'd scroll to see more before I clicked anything."

**Common failure modes.**
- The hero leads with mechanism instead of outcome. Fix: outcome first, mechanism later in the page.
- The hero has two CTAs of equal weight, so the user freezes. Fix: one primary, one secondary, visual weight obvious.
- The hero subhead piles three benefits together. Fix: one benefit, sharply phrased.

**How to run it.** Pull 3 people not familiar with the product. Show the screenshot for 5 seconds. Ask the 3 questions. If 2 of 3 cannot answer all three, the test fails. Record the question they could not answer; that tells you which element to fix.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) § hero spec → 5-second test result.

---

## Test 2 — 500-co

**The question.** Would a VP of Sales at a 500-employee B2B company read the homepage and forward it to their SDR pod with a one-line note like "look at this", unprompted?

**Passing looks like.** The page is specific enough that a senior buyer recognizes themselves and their team in it. They have a specific reason — "the audit-grounded opener is what we keep failing at" — to share it.

**Failing looks like.** Generic copy. Tropes ("Built for modern teams"). Feature listing instead of problem-naming. AI-hype register. Nothing on the page that the buyer's team would not already say to each other.

**Common failure modes.**
- The page is for the founder, not the buyer. Fix: read [`BUYER-PERSONA.md`](../../BUYER-PERSONA.md) and rewrite as the buyer would describe their own day.
- The proof is too abstract ("powered by AI") instead of operational ("47 audited leads in 5 minutes").
- The page reads as cool, not useful. Fix: replace one cool thing with one useful number.

**How to run it.** Mental test: pretend you are a VP Sales at a 500-employee agency. Read the page. Would you forward it? If you hesitate, the page is missing the specific hook for that buyer. Optionally, send the actual page to an actual VP Sales contact and watch what they say.

**Note.** The 500-co buyer is a stress test, not always the literal target. Our ICP is smaller. But if the page is specific enough that a 500-co buyer would forward it, it is more than specific enough for our 5-10 SDR buyer.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) § decision criteria tests → Test 2 line.

---

## Test 3 — SDR-30x

**The question.** Does the lead-detail page survive being opened 30 times in one morning by the same SDR without becoming exhausting? Does it answer "why this lead, why now, what to say, how to send it" within the first scroll?

**Passing looks like.** The SDR opens the page, scans it for 5-8 seconds, knows whether to dial, knows what to open with, and clicks the primary action. They do not have to think about which block to read first. They do not have to scroll twice to find the answer.

**Failing looks like.** Wall of blocks. No primary action. Five candidate "why now" signals competing for attention. The SDR opens 3 leads in a row and starts copying the same generic opener because the page did not surface a sharper one.

**Common failure modes.**
- The information hierarchy is flat. Everything looks equally important, so nothing is. Fix: pick the one block that wins above-the-fold; everything else gets progressive disclosure (see [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md) § G7).
- Too many CTAs above the fold. Hick's Law (§ G1) applies. Fix: one primary, one secondary, the rest below.
- The page is gorgeous but slow. Doherty threshold (§ E6) is violated. Fix: skeletons + `PreliminaryBanner` for blocks >400ms.
- The "next action" requires the SDR to interpret data. The page should interpret. The SDR should act.

**How to run it.** The literal test: open the page 30 times with different leads. Note where your eye lands first each time. If it is the same block 25 times, that is your primary block — design around it. If it is different every time, the page lacks hierarchy.

The shortcut test: open the page and time how long until you can confidently say "dial / don't dial". If >10 seconds, the page fails.

**Where it shows up.** [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md) § decision criteria tests → Test 3 line.

---

## Test 4 — FineDine BD

**The question.** Would the FineDine BD team — or any real-world team selling to local-business buyers — recognize their workflow on the page? FineDine is the closest real-world analog to our F&B vertical motion. If the page rings true to them, it rings true to the buyer.

**Passing looks like.** A FineDine BD person reads the page and says "yes, that is what my Tuesday morning looks like" or "yes, that is the problem I solve". The vocabulary matches; the steps match; the cadence matches.

**Failing looks like.** A FineDine BD person reads the page and says "this is not how we work" or "this skips the part of the job that actually takes me time". Or worse, they cannot tell whether the page is for them or for someone else.

**Common failure modes.**
- The page describes the agency / SDR workflow but not the F&B BD workflow. Fix: read [`BUYER-PERSONA.md`](../../BUYER-PERSONA.md) § 5 F&B / restaurant-tech BD team. Address that workflow specifically.
- The page assumes an agency seller, not a vendor's in-house BD person. Different selling motion, different vocabulary. Fix: vertical-specific copy.

**Note.** This test is named for FineDine because it is the canonical analog. For other personas, swap the name: for the SMMA owner, "SMMA-on-Reddit test". For the walk-in web agency, "walk-in-web-agency test". The principle generalizes: name the real-world buyer, and check whether the page would land with them.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) and [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md) § decision criteria tests → Test 4 line. Name the analog explicitly.

---

## Test 5 — Voice

**The question.** Does the copy contain any banned phrases from [`.agents/product-marketing-context.md`](../product-marketing-context.md) § Banned words and phrases? Does it use preferred phrases where they fit, and where it departs, does it earn the departure?

**Passing looks like.** Zero banned phrases. Sentence-case headings. Periods or commas instead of em dashes. Operator-to-operator register. Specific numbers over round ones.

**Failing looks like.** The presence of any of:
- "agent" / "AI agent" (when describing LeadAC itself)
- "transformative", "groundbreaking", "revolutionary", "cutting-edge"
- "delve", "leverage", "synergy", "robust", "seamless", "intuitive"
- "memory loop", "compounding intelligence", "compounding part"
- Em dashes (—)
- "Whether you're a... or a..."
- "It's not just X, it's Y"
- "Let's dive in", "without further ado", "here's what you need to know"
- Title Case In Headings (use sentence case)

**Common failure modes.**
- "Built for [adjective] teams". Replace with the specific role and the specific job.
- Em dashes drifting back in. Run a find-replace before shipping.
- A second pass to "polish" introduces flowery words. Resist. The first-draft register is closer to right.

**How to run it.** Grep your RFC for the banned list. Read each banned-list match in context. If it ever helps the sentence, keep it and call out the exception in the RFC; if it does not, cut it.

The humanizer skill ([`humanizer`](C:/Users/meert/.cursor/skills/humanizer/SKILL.md)) is the formal check. Run it on any copy block before considering the RFC done.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md), [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md), [`templates/section-spec.md`](./templates/section-spec.md) → Voice test result.

---

## Test 6 — Evidence

**The question.** Does every claim in the RFC have a source? Customer quote, framework, competitor pattern, or a number from the cohort.

**Passing looks like.** Every claim cites where it came from. Numbers are linked to cohort data or industry benchmarks (and labeled as either). Customer quotes are verbatim and attributed (initials + role + date). Framework references name the framework and one-sentence why it applies.

**Failing looks like.** "Studies show". "Most agencies struggle with...". "Customers tell us...". "It's well known that...". Numbers without sources. Quotes without attribution.

**Common failure modes.**
- Stretching a 12-lead cohort metric into a "47% of agencies" claim. Pull the stretch; cite the cohort size.
- Treating a single Reddit comment as "what the market says". Cite the comment; do not generalize.
- Quoting yourself as a customer. You are not the customer. Pull the quote.

**How to run it.** Read the RFC and underline every claim. For each underlined claim, ask "where did this come from?" and write the source inline. If a claim cannot be sourced, either pull it or downgrade it to "hypothesis to test".

The rule from [`.agents/product-marketing-context.md`](../product-marketing-context.md) § Evidence layer: "When in doubt about a claim: pull it. Do not stretch it."

**Where it shows up.** Every claim in the RFC must carry an inline citation. Pre-launch, citations skew toward Reddit pull-quotes, the FineDine beta cohort (12 leads, May 2026), and the founder's stated lines. As paying customers ship case studies, citations upgrade to named testimonials.

---

## Test 7 — Engineering

**The question.** Does the proposal map to existing component patterns and design tokens? Or does it require new infrastructure? If new infrastructure, is the cost honestly flagged on the cost ladder?

**Passing looks like.** Every proposed section reuses an existing pattern from [`src/components/marketing/v2/`](../../src/components/marketing/v2) or [`src/components/app/lead-detail-v2/`](../../src/components/app/lead-detail-v2), uses `--leadac-*` tokens, and slots into the current composition. Where the proposal needs something new, the RFC labels it on the cost ladder from [`05-infrastructure-primer.md`](./05-infrastructure-primer.md) § 11 (Trivial / Small / Medium / Large / Forbidden) and explains the trade-off.

**Failing looks like.** A proposal that:
- Hardcodes a hex color instead of a token. Fix: use the token.
- Proposes a new BullMQ queue. Forbidden. Fix: extend `agent-runs`.
- Proposes a Gemini call outside `src/lib/agent-workers/` or `src/lib/ai-core/router.ts`. Forbidden. Fix: wrap as a worker module.
- Proposes a lead-detail block reading data that is not workspace-scoped. Forbidden. Fix: scope by `workspaceId` (see [`.cursor/rules/multi-tenant-scope.mdc`](../../.cursor/rules/multi-tenant-scope.mdc)).
- Proposes a new section with no cost label. Add one.

**Common failure modes.**
- "Add a real-time chat with the AI". Large cost, ambiguous data model, multi-tenant implications. Pull or shrink.
- "Show the lead's competitors". Forbidden if it leaks across workspaces. Reframe as "same-niche leads from the user's own workspace".
- "Replace the hero with a video". Medium-to-Large (video produced, hosted, motion design, accessibility). Flag it.

**How to run it.** Read [`05-infrastructure-primer.md`](./05-infrastructure-primer.md) § 11 with your RFC open. For each proposed change, write its cost label inline. If a change is Large or Forbidden, either shrink to Medium or explicitly mark "needs engineering decision before proceeding" and continue with the rest.

**Where it shows up.** [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) and [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md) carry a cost label on every proposed change.

---

## Stacking the tests

The tests are designed to compound:

- Test 1 (5-second) and Test 5 (Voice) usually pass or fail together. Banned-word copy is also unfocused copy.
- Test 2 (500-co) and Test 4 (FineDine BD) usually pass or fail together. A page specific enough for one is usually specific enough for the other.
- Test 3 (SDR-30x) and Test 6 (Evidence) compound on the lead-detail. The SDR-30x test is hard to pass without verbatim quotes from actual SDRs (which is the evidence).
- Test 7 (Engineering) is independent. It can fail on a beautiful, well-researched RFC. The fix is usually shrinking, not rewriting.

If three or more tests fail, the RFC needs more research, not more drafting. Go back to a research day before drafting again.

---

## The checklist (paste into every RFC)

```markdown
## Decision criteria — 7 tests

- [ ] **1. 5-second test** — `<pass/fail/n-a>` — `<one-line evidence>`
- [ ] **2. 500-co test** — `<pass/fail/n-a>` — `<one-line evidence>`
- [ ] **3. SDR-30x test** — `<pass/fail/n-a>` — `<one-line evidence>`
- [ ] **4. FineDine BD test (or named analog: <name>)** — `<pass/fail/n-a>` — `<one-line evidence>`
- [ ] **5. Voice test** — `<pass/fail>` — `<grep'd for banned terms: yes/no>`
- [ ] **6. Evidence test** — `<pass/fail>` — `<every claim cited: yes/no>`
- [ ] **7. Engineering test** — `<pass/fail>` — `<all proposed changes labeled on cost ladder: yes/no>`
```

If any line is `fail`, the proposal carries the failure into the "Open questions" section and the reviewer decides whether to revise or accept-with-flag.

Templates start here: [`templates/homepage-rfc.md`](./templates/homepage-rfc.md), [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md), [`templates/section-spec.md`](./templates/section-spec.md), [`templates/competitor-teardown.md`](./templates/competitor-teardown.md), [`templates/sdr-interview-notes.md`](./templates/sdr-interview-notes.md), [`templates/ab-test-hypothesis.md`](./templates/ab-test-hypothesis.md).
