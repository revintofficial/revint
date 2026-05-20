# 06 — Weekly operating rhythm

The role only works on a cadence. Without one, the work drifts into "I'll do customer interviews when I have time" and "let me polish this hero one more day". This file pins the week.

The rhythm is research-heavy by design. The bulk of your week is study and synthesis; ship days are narrow and time-boxed.

---

## The week

| Day | Block | Outcome |
|---|---|---|
| Monday | AM: Metric review + queue triage. PM: One competitor teardown. | One teardown shipped to `research/teardowns/`. |
| Tuesday | Deep research block. Interviews, mining, framework re-reading. | Notes appended to `research/synthesis/` files. |
| Wednesday | Deep research block (continued) or a customer interview slot. | Interview note in `research/interviews/` OR synthesis update. |
| Thursday | Draft / revise the current RFC. | RFC v0.x in `proposals/`. |
| Friday | Ship one of {weekly report, RFC v-next, A/B test hypothesis}. | One artifact merged or sent to reviewer. |

Two ship days per week (Monday teardown + Friday RFC/report). Two research days per week (Tuesday + Wednesday). One synthesis day (Thursday).

This is a target. Adjust to your real calendar. The principle that does not move: at least one artifact every Friday, at least one teardown every Monday.

---

## Monday — metric review and queue triage

The week starts with last week's numbers. If the team is running A/B tests or recently shipped an RFC, pull the numbers and write a one-paragraph read at the top of your Friday weekly report draft.

The teardown slot is non-negotiable. Pick one competitor or inspiration site from [`03-research-syllabus.md`](./03-research-syllabus.md) § B and tear it down using [`templates/competitor-teardown.md`](./templates/competitor-teardown.md). Even when the queue is full, the teardown ships — the muscle of seeing other pages clearly is the muscle of seeing our pages clearly.

Output: `research/teardowns/<competitor-slug>-<yyyy-mm-dd>.md`.

---

## Tuesday and Wednesday — deep research blocks

Two-hour blocks minimum. Phone away, notifications off.

The research can be any of:

- **Customer / SDR interview** — use [`templates/sdr-interview-notes.md`](./templates/sdr-interview-notes.md). One interview per week is the floor; two is the target.
- **Language mining** — Reddit, Twitter/X, communities listed in [`03-research-syllabus.md`](./03-research-syllabus.md) § C. Pull verbatim quotes; do not paraphrase.
- **Framework re-reading** — open one chapter from [`03-research-syllabus.md`](./03-research-syllabus.md) § E that maps to your current open RFC question.
- **Codebase exploration** — open the component file you are about to reference in an RFC. Read it. Then your RFC reads back accurately.

Output: synthesis files in `research/synthesis/`, interview notes in `research/interviews/`. These are living documents; append, do not rewrite.

---

## Thursday — RFC drafting

This is your build day. Pick up the open RFC and push it forward.

The protocol:
1. Pull yesterday's research and the verbatim quotes most relevant to the RFC.
2. Open the right template ([`templates/homepage-rfc.md`](./templates/homepage-rfc.md) or [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md)).
3. Fill the template top-to-bottom. Do not skip sections. If a section is "TBD", write "TBD because [reason]" so reviewers know it was thought about.
4. Run the 7-tests checklist from [`07-decision-criteria.md`](./07-decision-criteria.md) on yourself before declaring v-next ready.
5. Save as `proposals/<yyyy-mm-dd>-<surface>-rfc-v<version>.md`.

Definition of done for an RFC version (per the framework defined in [`07-decision-criteria.md`](./07-decision-criteria.md)):
- All 7 tests passed (or explicitly waived with a reason).
- At least 3 frameworks cited from [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md).
- At least 2 competitor patterns referenced from `research/teardowns/`.
- At least 1 verbatim customer quote pulled from `research/interviews/` or `research/synthesis/`.
- Every cost-flagged proposal labeled on the cost ladder from [`05-infrastructure-primer.md`](./05-infrastructure-primer.md) § 11.

If the RFC fails to meet definition of done, do not ship Friday. Slip to Monday. Better to ship one great RFC late than two weak RFCs on time.

---

## Friday — ship

Pick exactly one artifact for the week:

1. **The current RFC** at v-next (if it cleared Thursday's definition of done).
2. **A weekly report** if no RFC is ready. Five lines: what shipped, what is in flight, what the metrics did, what blocked, what next week looks like. Lives at `research/synthesis/<yyyy-mm-dd>-weekly.md`.
3. **An A/B test hypothesis** if a quick-win experiment is ready to register. Use [`templates/ab-test-hypothesis.md`](./templates/ab-test-hypothesis.md).

Never ship more than one — quality goes down. Friday is the close of the loop, not a sprint.

After shipping, post the link in whatever channel reviewers watch. Tag the reviewer. Move on.

---

## Where work lives

```
.agents/homepage-strategist/
├── proposals/
│   └── 2026-05-22-homepage-rfc-v0.1.md          your RFCs land here
├── research/
│   ├── teardowns/
│   │   ├── apollo-2026-05-04.md                 competitor teardowns
│   │   └── assets/<competitor>/                 screenshots
│   ├── interviews/
│   │   ├── agency-owner-mt-2026-05-12.md        customer / SDR interview notes
│   │   └── sdr-jh-2026-05-19.md
│   └── synthesis/
│       ├── 2026-05-10-homepage-state-of-the-page.md
│       ├── 2026-05-12-voc.md                    voice of customer
│       ├── 2026-05-22-patterns-to-steal-or-avoid.md
│       └── 2026-05-30-weekly.md                 Friday weekly reports
```

Naming rules:
- Dates are `<yyyy-mm-dd>`, no exceptions.
- Files are kebab-case.
- Initials for interview names (no full names) to protect interviewees by default. Add full attribution only when you have explicit permission.

Folder creation: lazy. Create only what you need. Do not pre-create empty directories.

---

## Ceremonies

Weekly:

- **Monday metric review.** 30 minutes max. Write a one-paragraph read of last week's numbers at the top of your weekly report draft.
- **Friday ship.** Whatever ships, ships. If nothing ships, the weekly report is the artifact.

Bi-weekly:

- **Reviewer sync.** 30 minutes with the engineering / design owner of whichever surface your current RFC targets. Bring the open question; do not bring the whole RFC.

Monthly:

- **Synthesis pass.** Read everything you produced this month. Update [`research/synthesis/`](./research/synthesis) summary files (market-and-icp.md, sdr-workflow.md, local-business-sales.md). The summaries are the artifact a future agent will inherit; keep them current.
- **Backlog re-ordering.** Score the proposals/ backlog on ICE or PIE (see [`04-growth-frameworks-library.md`](./04-growth-frameworks-library.md) § E3-E4). Re-order. Park anything that has slid past three Fridays without movement.

Quarterly:

- **Role retro.** What landed, what did not, what would you change about how this role operates. Update this file ([`06-weekly-operating-rhythm.md`](./06-weekly-operating-rhythm.md)) with anything that should change.

---

## Boundaries

What this rhythm protects:

- **Research time.** Tuesday and Wednesday are sacred. Decline standing meetings on those days.
- **One ship per Friday.** No surprise launches. No "I'll add this last thing".
- **One RFC at a time.** Two concurrent RFCs cost more than 2x of one — the context-switching destroys the deep work. Finish v-next of the current one before starting the next.

What this rhythm does not protect:

- **The reviewer's calendar.** You ship; the reviewer reads when they read. Do not chase.
- **Your inbox.** If something is urgent, it has its own channel. The strategist's inbox is async.

---

## When the rhythm breaks

If you have not shipped on a Friday for two weeks in a row, something is wrong. Diagnose:

1. **Are you stuck on one specific question?** Write it into the RFC as an open question and ship the rest. Do not block on a single field.
2. **Did you take on an RFC that is too big?** Split it. A "homepage redesign" is too big; "new hero spec + new ProblemGrid spec" is two RFCs.
3. **Did you skip research?** Probably. The fix is the next two-day research block, not "harder Thursday".
4. **Did the customer voice disappear?** Re-read one interview note. Pull one quote. The block usually breaks when the page is being written from your head, not from the buyer's words.

The role survives missed Fridays as long as the diagnosis happens. The role does not survive silent drift.

Next file: [`07-decision-criteria.md`](./07-decision-criteria.md).
