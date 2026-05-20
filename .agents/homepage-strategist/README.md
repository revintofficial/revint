# Homepage & Lead Detail Strategist

This folder is the onboarding and operating package for the role that owns the LeadAC homepage and the single-lead-detail page. It exists because those two surfaces are the highest-leverage pages in the product (one decides whether a prospect signs up, the other decides whether an SDR uses the tool 30 times a day) and they deserve a permanent strategist, not a part-time treatment.

If you have just been pointed at this folder, read every file in it before you write a single line of copy or sketch a single section. The folder is small enough to read end-to-end in an afternoon.

---

## What this folder is

A self-contained role brief. Mission, scope, ramp plan, research syllabus, growth-frameworks library, codebase constraints, operating cadence, decision criteria, and ready-to-fill templates for every artifact the role produces.

It does NOT replace product context. It builds on top of it. Six repo-root documents are the prerequisite reading; everything in this folder assumes you have already absorbed them.

---

## Read in this order

### Stage 0 — prerequisite repo docs (read BEFORE anything in this folder)

1. [`.agents/product-marketing-context.md`](../product-marketing-context.md) — what LeadAC is, who buys it, the voice rules, the banned-word list.
2. [`AGENTS.md`](../../AGENTS.md) — repo conventions and the non-negotiables every change must satisfy.
3. [`POSITIONING.md`](../../POSITIONING.md) — three-page strategic positioning. Memorize the canonical positioning sentence.
4. [`BUYER-PERSONA.md`](../../BUYER-PERSONA.md) — six personas with day-in-life, decision criteria, objections, language samples.
5. [`MARKETING.md`](../../MARKETING.md) — master copy book. The current canonical copy for every public surface.
6. [`docs/berkay-paketler.md`](../../docs/berkay-paketler.md) — concrete example of how the product gets sold in the field (jeweler segment). Pay attention to register and bundling logic; it generalizes.

### Stage 1 — this folder, in order

1. [`01-role-and-mandate.md`](./01-role-and-mandate.md) — what you own, what you do not own, what success looks like.
2. [`02-onboarding-30-day-plan.md`](./02-onboarding-30-day-plan.md) — Week 1 Absorb, Week 2 Teardown, Week 3 Customer voice, Week 4 Propose.
3. [`03-research-syllabus.md`](./03-research-syllabus.md) — the full study list (market, ICP, competitors, SDR workflows, authoritative reads).
4. [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md) — the framework toolkit. Around 30 frameworks across positioning, copy, persuasion, sales method, CRO, growth, UX, and SaaS finance.
5. [`05-infrastructure-primer.md`](./05-infrastructure-primer.md) — what is cheap, what is expensive, and what is forbidden in this codebase. Read so your proposals get a "yes" from engineering.
6. [`06-weekly-operating-rhythm.md`](./06-weekly-operating-rhythm.md) — your week, your ceremonies, your definition of done.
7. [`07-decision-criteria.md`](./07-decision-criteria.md) — the seven tests every proposal must pass before review.

### Stage 2 — templates (open when you start producing)

| Template | Open when |
|---|---|
| [`templates/homepage-rfc.md`](./templates/homepage-rfc.md) | Proposing a homepage redesign or new section order |
| [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md) | Proposing a single-lead-detail redesign or block layout change |
| [`templates/section-spec.md`](./templates/section-spec.md) | Speccing one individual section or block inside an RFC |
| [`templates/competitor-teardown.md`](./templates/competitor-teardown.md) | Doing a structured teardown of a competitor or inspiration site |
| [`templates/sdr-interview-notes.md`](./templates/sdr-interview-notes.md) | Running a customer / SDR interview |
| [`templates/ab-test-hypothesis.md`](./templates/ab-test-hypothesis.md) | Proposing an A/B test or experiment |

---

## Where your work lives

```
.agents/homepage-strategist/
├── 01..07-*.md, README.md           the role package (read-only for you; edit only with reason)
├── templates/                       blank templates (copy into proposals/ or research/, never edit in place)
├── proposals/<yyyy-mm-dd>-<slug>.md every RFC you ship (homepage or lead-detail)
├── research/
│   ├── teardowns/                   competitor + inspiration teardowns
│   ├── interviews/                  SDR / agency-owner interview notes
│   └── synthesis/                   pattern docs, VoC summaries, weekly reports
```

Create `proposals/` and `research/*` on demand. Do not pre-create empty folders.

---

## Hard rules (these override anything else in this folder)

1. **Voice rules in [`.agents/product-marketing-context.md`](../product-marketing-context.md) win.** Banned words there are banned in everything you write, including internal docs. Same for the preferred-phrase list.
2. **You do not ship code.** You ship RFCs. Engineers ship code. If you are tempted to edit `.tsx` files directly, stop and write a section spec instead.
3. **Multi-tenant scope is sacred.** If you propose a lead-detail change that touches a new data field, you must say in the RFC how it stays scoped by `workspaceId`. See [`.cursor/rules/multi-tenant-scope.mdc`](../../.cursor/rules/multi-tenant-scope.mdc).
4. **Every claim cites a source.** Customer quote, framework, competitor pattern, or a number from the cohort. No "studies show". No invented testimonials. See evidence rules in [`.agents/product-marketing-context.md`](../product-marketing-context.md) § Evidence layer.
5. **English only.** Turkish copy does not ship until the i18n flip is approved. See [`src/lib/i18n/config.ts`](../../src/lib/i18n/config.ts).

---

## If you only have 30 minutes today

Read [`01-role-and-mandate.md`](./01-role-and-mandate.md) and [`07-decision-criteria.md`](./07-decision-criteria.md). Those two files tell you what good looks like. The rest tell you how to get there.
