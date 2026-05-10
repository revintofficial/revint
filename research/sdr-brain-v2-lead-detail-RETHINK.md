# Lead Detail — Strategic Rethink (counter-brief)

> Companion to `sdr-brain-v2-lead-detail-design-brief.md`. Read that first.
> This document does **not** redo the brief. It argues the brief solves the
> wrong problem at the IA layer, then proposes a different shape and
> defends it against the 12 challenges the brief side-stepped.
>
> Audience: PM + designer + tech lead. Not the rep. No code, no Figma,
> only ASCII wireframes. Opinionated on purpose.

---

## 1. TL;DR

The brief correctly diagnoses that the current page is a "data catalog,"
but it then ships a 4-tab data catalog wearing a Decision Bar hat — same
sin, taller hero. The right move is to **delete the tabs entirely**, make
the page a single vertical decision narrative whose sections collapse and
reorder by pipeline stage, and **promote reasoning from an opt-in drawer
to inline evidence chips** because reasoning *is* the product. Two
artifacts the brief tries to cram in here belong elsewhere: Workers go to
`/app/leads/[id]/workers` and retro/LEARN goes to a workspace-level
`/app/wins`. The lead page does one job: the next 90 seconds.

---

## 2. Where the brief is right

Don't reflexively dunk. These calls are correct and we keep them:

- **Three-question framing** (Why now / What to say / What pushback) is
  the right cognitive frame for a B2B agency SDR.
- **Pipeline-stage morphing** — the page must look different in COLD vs
  REPLIED. Today's page is identical across the lifecycle.
- **NbaCard is doing too much alone.** `predictedObjections`,
  `whatNotToPitch`, `openingHook`, reasoning trace all in one ~320px
  card (`NbaCard.tsx:264–356`).
- **Workers panel is power-user surface, not SDR surface.**
- **Voice-note → SPIN/MEDDPICC live update is the magic moment.** Under-
  celebrated today.
- **One reusable reasoning component per claim.** Right call; we just
  disagree about whether it's a sheet or inline.
- **Brand tokens stay.** `--leadac-*` is the substrate; semantic adds only.
- **TIER badge in header.** `Account.tier` (`schema.prisma:1684`) is
  real and currently invisible.

Seven correct calls. The rest of this doc argues the brief gets the
*shape* wrong even when the *intent* is right.

---

## 3. Where the brief is weak

Numbered, with evidence. Each item: assumption → why weak → what data
fact (model name / route / component) makes it weak.

### 3.1 Tabs are still tabs.

A tabbed IA forces the rep to predict which tab holds the answer they
walked in with. The brief's three questions (`Why now / What to say /
What pushback`) are not a partition over four tabs; they're one linear
narrative. Today's page is 5 tabs (`page.tsx:715–719`); the brief's
4 tabs are shrinkflation, not redesign — same primitive, same failure
mode. **Evidence:** `src/app/app/leads/[id]/page.tsx:695–885` is a
200-line `<Tabs>` block.

### 3.2 "Decision Bar" is just a bigger NbaCard.

The proposed contents (Why Now + opener + champion + reasoning link)
are exactly the current NbaCard fields, repackaged sticky. **Evidence:**
the NBA route (`api/leads/[id]/next-action/route.ts:90–98`) already
returns `{ preliminary, final, triggers, insight, reasoningGraph,
arbitrationRecords }`. The Decision Bar surfaces *none* of stakeholders,
BANT, MEDDPICC, ICP dimensions. It's a wider NBA card plus a champion
avatar. Fine — but stop calling it a structural rethink.

### 3.3 Sidebar with 5 slots fights above-the-fold.

Goal G1 says "decide-and-act in the first fold." Then a sidebar eats
280–320px of horizontal space on a 1280px laptop with dashboard nav,
pushing the Decision Bar narrower than today's NbaCard. A scannable
sidebar and a hero decision unit are two solutions to the same job.

### 3.4 Pipeline-aware *default tab* is the wrong primitive.

"COLD → Outreach default open; REPLIED → Discover default open" is a
workaround for tabs existing at all. If sections reorder vertically by
stage, no tab needs default selection. Strictly dominant: same morph
benefit, zero IA cognitive load.

### 3.5 Reasoning trace as opt-in drawer ≠ "no one opens it."

Today's "Why?" link (`NbaCard.tsx:350`) is one click away, already
styled with a chevron — reps don't open it. Adding 7 more identical
affordances on MEDDPICC/ICP/BANT/etc. doesn't solve discoverability;
it amplifies it (8 unread links instead of 1). **Reasoning is not a
footnote — it's the product's durable advantage.** Treat it like the
timeline of a Datadog trace: not a drawer, *the spine of the view*.

### 3.6 Three questions ≠ four tabs.

The three questions arrive sequentially in the rep's head ("should I
call → what do I say → what comes back"). A four-tab IA forces leaving
Outreach to check Discover to answer "what comes back" — which is the
*third* question while still on the *first* call. The mismatch isn't
cosmetic; it's a flow violation.

### 3.7 "Brief" tab does two jobs.

First-read context for a fresh COLD lead and post-mortem for a closed
deal are different surfaces. First-read is "what should I know right
now"; post-mortem is "what did the system get right/wrong, and what
can we generalize." Closed-loop learning is a **workspace-level**
insight (the brief itself cites `/api/settings/insight-performance`)
— it belongs in a `/app/wins` route, not in a per-lead tab.

### 3.8 Power Tools as drawer ≠ separate concern.

A drawer attached to the lead page preserves the worker concept inside
the SDR's mental model. It should not be there at all. **Workers belong
on `/app/leads/[id]/workers`** — a separate route. Benefit isn't
aesthetic; deep-linkable URLs for agency owners + the lead page stops
paying the cognitive tax of "what is this drawer." A drawer that hides
14 things is still 14 things; a route is zero things until visited.

### 3.9 Multi-location accounts under-designed.

A sidebar text label "Casa Polanco · 4 locations" doesn't let the rep
navigate sister leads. **Evidence:** `Account` is its own model
(`schema.prisma:728`) with `tier: AccountTier?`. `Stakeholder.accountId`
(`:1985`) attaches stakeholders to accounts — meaning the data model
already assumes a buying committee spans branches. The brief treats
Accounts as a chip, not as a navigable context.

### 3.10 Latency reality is hand-waved.

Preliminary at t=3–8s, final at t=15–45s, brief offers "crossfade." A
30+s cook is forever in SDR time. Crossfade is the visual treatment of
the problem; the *behavioral* problem is what the rep does for 30s.
Two real answers: (a) auto-show the **queue companion** (next 3 leads)
so the rep scans ahead, or (b) the preliminary becomes *shippable*
(dial off BANT-only) and the final re-renders behind a "✨ updated 17s
ago" toast. Brief picks neither.

### 3.11 Mobile claim is desktop-shaped.

The brief's 4-tab desktop IA collapsed to single column is still 4
screens stacked + Decision Bar + sidebar-as-summary-header — 6+
vertical sections before the dial button. The real mobile page is **one
screen**: name, why-now (1 line), opener (3 lines), dial, voice-note.
Everything else is a swipe.

### 3.12 Missing entirely: snooze, compare-to-wins, queue, post-call, daily-stack.

| Missing job                | Schema today                                  |
|---|---|
| Snooze / nurture           | `Lead.snoozeUntil` (`:589`) — exists; not surfaced |
| Compare-to-similar-wins    | `InsightPerformance` (`:2070`) — exists; aggregate only |
| Queue position / context   | `Lead.nextActionDueAt`, `lastDisposition` (`:608–611`) — exist; not surfaced |
| Post-call capture          | voice-notes + dispositions POST — exist; UX buried |
| Daily-stack ("queue of 3") | No schema; pure UI on top of Today's Queue order |

Brief catalogs 18 components but skips these. Three are single-day
implementations because the data is already there.

---

## 4. A structurally different IA

### 4.1 The thesis + three moves

> The lead detail page is **not a page**. It's a single, ordered,
> ~7-block decision narrative whose blocks reorder and collapse by
> pipeline stage. There are **no tabs**. Reasoning is **always visible
> inline** as evidence chips on every claim. Worker tools and retro
> analysis live on separate routes. The "queue of 3" is a persistent
> strip so the rep always knows what's next.

Three structural moves: (1) vertical narrative, not tabs; (2) inline
evidence, not drawer reasoning; (3) companion strip, not isolated lead.

### 4.2 The seven blocks (fixed order)

```
HEADER (sticky, 56px)
─────────────────────
WHY NOW          (always visible)
NEXT GESTURE     (always visible)
─────────────────────
WHO              ┐
DISCOVERY        │ reorders/collapses
QUALIFICATION    │ by pipeline stage
HISTORY          │
ACCOUNT          ┘
─────────────────────
QUEUE STRIP (sticky bottom)   ·   POWER TOOLS link (top-R)
```

Order is **fixed** to match the rep's mental sequence. What changes
per stage is which blocks are expanded vs collapsed-to-one-line.

### 4.3 Stage-driven expansion rules

| Stage              | Expanded                   | Collapsed (one-line stub)                   |
|---|---|---|
| COLD               | Why Now, Next Gesture, Who | Discovery, Qualification, History, Account  |
| CONTACTED          | Why Now, Next Gesture, History | Who, Discovery, Qualification, Account  |
| REPLIED            | Discovery, Qualification, Who, Next Gesture | Why Now (now stale), History, Account |
| MEETING_BOOKED     | Qualification, Discovery, Next Gesture | Who, Why Now, History, Account     |
| PROPOSAL/NEGOTIATING | Qualification, History (objections), Next Gesture | Who, Discovery, Why Now, Account |
| WON / LOST         | History (full timeline)    | Everything else collapsed; sticky banner: "Lessons → /app/wins/{id}" |

Collapsed is not hidden. A stub like `WHO ▸ María García (champion 0.82)
+ 2 others` is one click to expand. This preserves orientation
("everything is here") while serving the answer to whichever question
the rep is in.

### 4.4 Inline evidence (the "no Why? link" rule)

Every claim renders as `[CLAIM] · [evidence-chip] [evidence-chip]`. A
chip is a 12px badge with type icon (📄 audit / ⭐ review / 💼 LinkedIn
/ 🗣 voice-note / 🔁 prior NBA) and a hover/tap card with the source
quote. Reasoning becomes **the dotted line under the claim**, not a
sheet. A separate full-graph power view still exists (linked lower-right
of Next Gesture). Implementation hook: `reasoningGraph` Json (`:1871`)
and `arbitrationRecords` already carry the metadata — render `nodes`
of kind `EVIDENCE` as chips on the consuming `DECISION` node's line.

### 4.5 Wireframe — State 1: COLD lead, preliminary NBA, final cooking

**Desktop (1440 × 900)**

```
─── header (sticky) ──────────────────────────────────────────────────────
← Casa Polanco · Roma   FNB · Fine-dining   ◉ TIER_2   COLD ▾   📞 ✉ 🎤 ⋮
──────────────────────────────────────────────────────────────────────────
WHY NOW                                              ⏱ act in 7d
⏳ Quick read (BANT only) · final cooking · ~22s     ░░░░░░░░░░
Owner hired 2nd-location head; reviews dropped to 3.6★ last 30d
[💼 LinkedIn:hiring] [⭐ reviewAnalysis:delivery]

NEXT GESTURE  ◆ CALL  preliminary v1
┌──────────────────────────────────────────────────────────────────────┐
│ María García (champion likelihood pending — final cooking)            │
│ Opener: "Hi María, saw your Polanco opening — quick question         │
│  about delivery ops..."                                              │
│ ◯ Dial now  ◯ WhatsApp  ◯ Snooze 24h                                │
│ [🔁 v1 · BANT-only] · refining…                                       │
└──────────────────────────────────────────────────────────────────────┘

WHO ▸ María García + 2 others
DISCOVERY ▸ empty — drop a voice note to start
QUALIFICATION ▸ ICP 78 · BANT 41/82/60/35 · MEDDPICC not started
HISTORY ▸ created 4m ago · no touches yet
ACCOUNT ▸ Casa Polanco · 4 locations · 2 sister leads ▸
                                                       ⚙ Power tools →
─── queue strip (sticky bottom) ──────────────────────────────────────────
📋 Today 3/12   ‹ prev   ⏻ snooze   ✓ done   next ›
1. Casa Polanco · Roma (here)  2. Maido Bar ★ TIER_1  3. Quintonil
```

**Mobile (390 × 844)** — one screen, two CTAs:

```
← Casa Polanco · Roma  ⋮         │ WHY NOW ⏱7d ⏳refining…
FINE-DINING · TIER_2 · COLD ▾    │ Owner hired 2nd head; ★3.6
                                  │ [💼][⭐]
◆ CALL María García               │
"Hi María, saw your Polanco…"     │ ▸ WHO 3 ppl
[📞 Dial]    [🎤 Voice-note]      │ ▸ DISCOVERY empty
ⓘ preliminary · v1                │ ▸ QUAL ICP 78 · MEDDPICC —
                                  │ ▸ HISTORY 4m ago
─── bottom: Queue 1/12 ‹ › ───   │ ▸ ACCOUNT 4 branches
```

Everything below the fold on mobile is a swipe-down list of expand
toggles. Two CTAs above the fold: dial and voice-note.

### 4.6 Wireframe — State 2: COLD lead, FINAL NBA, full data

**Desktop** (showing deltas from State 1; same header/queue strip)

```
WHY NOW   urgency 78/100   ⏱ act within 7 days
Owner hired 2nd-location head + reviews dropped to 3.6★ in last 30d.
[💼 hiring · 0.91] [⭐ delivery-theme · 0.84] [📄 perf:42] [⚖ -1 contrad.]

NEXT GESTURE   ◆ CALL María García   confidence 82          ✨ updated 18s ago
┌──────────────────────────────────────────────────────────────────────────┐
│ "I noticed you opened the Polanco location last month and your delivery │
│  scores dipped. Most multi-loc operators we work with hit an ops gap    │
│  exactly here — worth 12 minutes?"                                      │
│ Insight: "Delivery dip after expansion is an ops-gap, not menu" · 47%   │
│ Don't pitch: × AI receptionist (already has one) × price-anchor         │
│ Pushback: "we're on Rappel" → "Rappel is rails; we sit on top to triage"│
│ ◯ Dial   ◯ Email   ◯ WhatsApp   ◯ Schedule   ◯ Snooze ▾                │
│ [🔁 v3 final] [⚖ 1 contradiction resolved]   [open full graph →]        │
└──────────────────────────────────────────────────────────────────────────┘

WHO ▾  3 stakeholders         (3-col grid: María ◆champ · Carlos ⚠blocker · Diego –)
DISCOVERY ▸ no notes yet — drop a voice note to start
QUALIFICATION ▾
  ICP 78/100  ▏▏▏▏▏▏▏▏░░  revenue 90 · staff 80 · stack 60 · geo 100
  BANT  B 41 ▏▏▏▏░░  A 82 ▏▏▏▏▏▏▏▏░░  N 60 ▏▏▏▏▏▏░░  T 35 ▏▏▏░░░
        (each cell exposes 3 inline evidence chips; no Why? link)
  MEDDPICC ▸ not started (lead not yet on watchlist)
HISTORY ▾  audit · reviews · T1 · T3 (timeline rows with worker chips)
ACCOUNT ▾  Casa Polanco · 4 locations · TIER_2
  ▸ Roma (here) · Polanco (Apr · ICP 81 · uncalled) ·
    Condesa (CONTACTED Mar 14 · no reply) · Coyoacán (WON Feb 3) ▸
```

**Mobile** — State 1 mobile layout, but Next Gesture block grows to fit
insight + don't-pitch + pushback (still 1 screen on iPhone 14 Pro), and
WHO expands to a horizontally-paged row of 3 stakeholder cards.

### 4.7 Wireframe — State 3: REPLIED lead, Discover surface dominant

**Desktop** (showing block reorder + new content vs State 2)

```
WHY NOW ▸ stale (call already happened)        ← collapsed to one line

NEXT GESTURE  ◆ BOOK_DISCOVERY  confidence 71
┌──────────────────────────────────────────────────────────────────────┐
│ Reply to María: propose 30-min discovery Tue/Wed.                    │
│ Don't propose pricing yet — MEDDPICC.M (metric) is UNKNOWN.          │
│ Copy: "Wonderful. Tue 10:00 or Wed 14:00 — which gives me 30min?"    │
│ [🔁 v5 · 4m ago]   [open full graph →]                                │
└──────────────────────────────────────────────────────────────────────┘

DISCOVERY ▾   3 voice-notes · 14 SPIN items
┌─ SITUATION ─────┬─ PROBLEM ──────┬─ IMPLICATION ────┬─ NEED-PAYOFF ───┐
│ "Use Rappel" .92│ "30% missed at │ "Refunds ~₱40k/mo│ "Half recovered │
│ "8/22 cooks" .85│  peak"         │  on delivery"    │  = our ROI ask" │
│ ...             │ ...            │ ...              │ ...             │
└─────────────────┴────────────────┴──────────────────┴─────────────────┘
[+ voice note]   [+ paste transcript]

QUALIFICATION ▾   ICP 78 · BANT 41/82/60/35 · MEDDPICC 4/7 ✓
  M Metrics    ✗ UNKNOWN — ask in discovery
  E Econ.Buyer ✓ CONFIRMED María García [💼] [🗣 vn-2]
  D Decision   ◐ PARTIAL — "owner approves w/ ops-mgr ack"
  D Process    ✗ UNKNOWN
  I Identify   ✓ CONFIRMED — delivery refund pain [🗣 vn-1]
  C Champion   ✓ CONFIRMED María García
  C Compete    ◐ PARTIAL — Rappel is incumbent (workflow only)

WHO ▾  3 stakeholders (champion + economic-buyer = same person)
HISTORY ▾  2 calls · 1 reply · 14 SPIN items
  Predicted-vs-real objections (live):
   • PREDICTED "we already have Rappel"  → REAL ✓ rebuttal landed
   • PREDICTED "too expensive"            → REAL ✗ didn't come up
   • REAL (new) "needs board approval"    → no rebuttal · [+ rebuttal]
ACCOUNT ▸ Casa Polanco · 4 locations · 1 sister WON
```

**Mobile** — SPIN board collapses to a vertical 4-section list
(`▸ N items` per section, tap to expand). MEDDPICC stays a 7-row
vertical list with one-tap fact drilldown.

### 4.8 Why this is structurally different from the brief

| Axis              | Brief                          | Rethink                                |
|---|---|---|
| Top-level IA      | 4 tabs                         | 0 tabs · vertical narrative            |
| Reasoning         | Opt-in drawer per block        | Inline evidence chips on every claim   |
| Stage adaptation  | Default-tab selection          | Section expand/collapse + reordering   |
| Workers           | Right-edge drawer              | Separate route `/leads/[id]/workers`   |
| Retro / LEARN     | Brief tab (overloaded)         | Separate route `/wins`                 |
| Latency           | Crossfade animation            | Queue-strip companion + preliminary-as-shippable |
| Sidebar           | 5 quick-glance slots           | No sidebar; quick-glance = collapsed stubs |
| Account context   | Sidebar text label             | Section with sister-lead navigation    |
| Mobile            | Single-column desktop          | One-screen-two-CTAs; rest = swipe      |
| Snooze            | Not designed                   | First-class CTA + queue-strip          |
| Queue context     | Not designed                   | Persistent strip                       |
| Post-call capture | "Voice note FAB"               | FAB + 1-tap disposition row            |
| Reasoning trace view | Bottom sheet / side drawer  | Inline chips + power view route        |

Not a re-skin; a different unit of organization.

---

## 5. Data layer impact

Mostly implementable on existing schema. Three truths the brief glosses:

### 5.1 Models the brief assumes exist but don't

| Brief reference            | Actual state                                |
|---|---|
| `IcpScore` model           | None. `Lead.icpFitScore` (`:613–622`) is one number. Dimension breakdown **must be computed at read time** from `IdealCustomerProfile` (`:1725`) weights × Lead features. |
| `IcpFitDimension[]`        | None. Same as above.                        |
| `BuyingReadiness` model    | None — schema comment `:1599`: "BANT is a pure derive — `src/lib/buying-readiness/derive.ts`. No table; recomputed on read." |
| `AccountTier` model        | Not a model — *enum* (`:1684`) on `Account.tier` and `InsightPerformance.segmentTier`. |
| `LeadTrigger.urgencyDays`  | Field is `urgencyWindowDays` (`:1773`).     |
| `Objection` predicted/real | `LeadNextAction.predictedObjections` is `String[]` (`:1867`); `Objection` rows are REAL ones (`:2014`) plus optional SDR_BRAIN snapshot. Parallel, not hierarchical. |

**Action:** No new tables. The rethink needs:

1. **One aggregator route** `GET /api/leads/[id]/decision-surface`
   returning `{ leadCore, nba, bant, icpDimensions, stakeholders,
   dealQualification, latestDiscovery }` in one shot. `requireUser()`
   + `workspaceId`-scoped on every Prisma call (AGENTS.md §1).
2. `bant` and `icpDimensions` are **computed** by existing helpers
   (`buying-readiness/derive.ts` + a new `icp-fit/dimensions.ts`
   reading `IdealCustomerProfile.weights × Lead.*`). No persistence.

### 5.2 What the new IA needs (all data exists)

- **Sister-lead query.** `prisma.lead.findMany({ where: { workspaceId,
  accountId, id: { not: currentId } } })`. No schema.
- **Queue-of-3 endpoint.** `GET /api/leads/queue?after=<id>&take=3`,
  workspace-scoped, sorted by `nextActionDueAt asc nulls last,
  salesConfidence desc` (existing fields `:608–624`). No schema.
- **Snooze endpoint.** `Lead.snoozeUntil` exists (`:589`). Need
  `POST /api/leads/[id]/snooze { until }`. No schema (except optional
  `snoozeUntilTriggerType` for §8.2).
- **Inline evidence source-quotes.** `LeadTrigger.evidence` Json
  (`:1771`), `Stakeholder.source` (`:1998`), `DealQualificationFact.
  sourceQuote` (`:1925`), `DiscoveryItem.evidence` (`:1965`) all
  exist. Aggregator just has to return them; NBA route hides most today.
- **Predicted-vs-real objection diff.** `Objection.source` enum
  (`:2020`) + `LeadNextAction.predictedFromActionId` join. Pure query.

### 5.3 What the rethink does NOT need

No new BullMQ queue. No new Gemini endpoint. No new tables (besides
optional `Lead.snoozeUntilTriggerType`). No new events — `voice_note_
added`, `disposition_logged`, `watchlist_stage_changed` all exist.

---

## 6. What gets dropped

Brief catalogs 18 components. Not all survive a no-tabs IA:

| Component                  | Verdict                                       |
|---|---|
| `TierBadge`                | KEEP — header chip                            |
| `WhyNowHeadline`           | KEEP — single-line top of WHY NOW             |
| `NbaPrimaryCard` (prelim/final) | KEEP, restyle (drop glow → "✨ updated 18s ago" toast) |
| `BantBars`                 | KEEP inline; drop the hover-tooltip pattern, evidence chips are always-visible |
| `StakeholderCard`          | KEEP — WHO grid                               |
| `SpinBoard`                | KEEP desktop; mobile = 4-section vertical list |
| `MeddpiccChecklist`        | KEEP desktop; mobile = 7-row vertical list    |
| `ContradictionLogItem`     | KEEP as inline chip "[⚖ 1 resolved]"; full log on reasoning power route |
| `VoiceNoteRecorder`        | KEEP, promoted to global FAB                  |
| `IcpScoreRing`             | DROP — inline horizontal bar in QUAL; ring eats space |
| `TriggerChip`              | DROP — triggers become inline evidence chips in WHY NOW |
| `OpeningHookBlock`         | MERGE into `NbaPrimaryCard` — same surface    |
| `CommercialInsightCard`    | MERGE into `NbaPrimaryCard` — one line, not a card |
| `ObjectionAccordion`       | DROP — predicted-vs-real diff lives in HISTORY |
| `ReasoningTraceSheet`      | DROP from default; lives at `/leads/[id]/reasoning/[actionId]` |
| `PipelineStageStepper`     | DROP — replaced by header chip + stage-driven section reordering |
| `InsightApplicationRow`    | DROP from lead page — moves to `/wins` workspace view |
| `PowerToolDrawer`          | DROP — replaced by `/leads/[id]/workers` route |

Net 18 → 11. Three moved off the lead page entirely (Reasoning power
view, InsightApplications, PowerTools). The test: every surviving
component must defend its presence in a 90-second session.

---

## 7. The 90-second test

Walk through `Sarah, an SDR at a Mexico City agency`, 9:14 AM Tuesday,
`Casa Polanco · Roma branch` is at the top of her queue.

### 7.1 Brief's IA (Sarah, COLD lead, t=0)

```
0:00  Decision Bar loads, preliminary, dashed.
0:08  Reads why-now headline.
0:12  Wants likely objection → already on Outreach tab → expand accordion.
0:25  Wants champion context → switch to Discover tab → reads María's card.
0:38  Switch back to Outreach for the opener.
0:45  Final NBA crossfades in. New "Apply this insight" CTA — unclear, skip.
0:55  Copies opener. Switches to phone app.
1:10  Dials. Mid-call drops a voice note via global FAB.
1:30  Hangs up. Disposition is buried under header kebab > "More".
1:45  Done. Back to lead list. Hand-picks next lead.
```

7 surface switches. Two have non-zero think-time. One needless tab-trip
(Outreach → Discover → Outreach) just to read a stakeholder name.

### 7.2 Rethink (same Sarah, same lead)

```
0:00  WHY NOW + NEXT GESTURE both above the fold. Preliminary is shippable.
0:10  Eyes scan: opener + don't-pitch ×2 + pushback + rebuttal — all inline.
0:20  Wants champion context. WHO stub: "María García (champ 0.82) + 2".
      One click → cards expand in place.
0:25  Final NBA re-renders. "✨ updated 18s ago" toast. No layout shift.
0:32  Hits Dial.
1:00  Mid-call. Mic FAB → 30s note → DISCOVERY stub flips to "transcribing…"
1:30  Hangs up. Bottom strip: [Connected][Voicemail][No-answer][Wrong#].
      One tap.
1:35  "✓ done" → queue auto-advances. Next lead loads in same shape.
```

3 surface switches. Voice-note is one finger. Disposition is one tap on
the persistent strip (no kebab dive). No tab navigation at all.

**Net:** ~50s saved per lead × 30 leads/day ≈ 25min/SDR/day recovered —
spent on the *next* call, not on this one's chrome.

---

## 8. Multi-location, snooze, queue, post-call capture

Quick sketches for the four jobs the brief misses entirely.

### 8.1 Multi-location

ACCOUNT is more than a chip:

```
ACCOUNT ▾  Casa Polanco · 4 locations · TIER_2 · 1 won
  Roma     (here)   ICP 78 · COLD · created 4m ago
  Polanco  (Apr)    ICP 81 · COLD · 0 touches            ▸
  Condesa           ICP 75 · CONTACTED · no reply Mar 14 ▸
  Coyoacán          ICP 70 · WON Feb 3                   ▸
Shared stakeholder: María García (owner, all 4).
🏆 Insight that won on Coyoacán: "delivery dip after expansion is
   an ops-gap" — same trigger fires here. [ⓘ apply]
```

Sister leads are **clickable rows**, not avatars. Cross-branch insight
propagation is surfaced: if insight X won on a sister branch and the
same trigger is present here, suggest it explicitly. Schema is
already there: `Stakeholder.accountId` (`:1985`) + `InsightApplication.
outcome` (`:1822`).

### 8.2 Snooze

`Lead.snoozeUntil` already exists (`:589`). Promote to a CTA in NEXT
GESTURE: `◯ Snooze ▾ → 1d / 3d / 1w / custom / **until trigger**`.

"Until trigger" is the novel one: snooze until a fresh `LeadTrigger`
fires (HIRING_BURST, RATING_DROP, etc.). Needs **one optional column**:
`Lead.snoozeUntilTriggerType: LeadTriggerType?`. The trigger-detection
cron nulls `snoozeUntil` when a matching trigger writes. This is the
only schema add the rethink genuinely needs.

### 8.3 Queue strip (always-visible bottom bar)

```
📋 Today 3/12   ‹ prev   ⏻ snooze   ✓ done   next ›
NEXT: Maido Bar ★ TIER_1 · WHY NOW: review streak · ETA 48s
```

- **`✓ done`** stamps `lastContactedAt` + advances cursor + optionally
  opens disposition chips inline.
- **`⏻ snooze`** opens the snooze dropdown.
- **`next ›`** preloads the next lead into a hidden route → instant render.
- **NEXT preview** gives pacing: "I have 48s of momentum, next one's
  TIER_1, do I rush or finish clean?"

Implementation: `GET /api/leads/queue?cursor=<id>&take=2` (current +
look-ahead). Filter on workspace, snooze, archived, discarded.

### 8.4 Post-call capture (one gesture)

Three primitives, all already API-supported:

1. **Mic FAB** (bottom-right, always visible). Tap → record → release →
   POST `/voice-notes`. DISCOVERY stub flips to "transcribing…".
2. **Disposition strip** auto-overlays the first time the rep returns
   to the page after tapping Dial. Four chips: `Connected · Voicemail ·
   No-answer · Wrong-number`. One tap → POST `/dispositions` → persists
   in HISTORY.
3. **Inline objection capture** — single text input under HISTORY,
   posts an `Objection` row with `source=REAL`.

All three are one-tap. Zero surface switching.

### 8.5 Compare-to-similar-wins (bonus — data is there)

When MEDDPICC ≥ 4/7 ✓ and the lead's primary `LeadTriggerType` matches
a winning insight in `InsightPerformance` for the same `nicheSlug`:

```
🏆 Closest win: Coyoacán branch (same account, Feb 3) — same trigger,
   same MEDDPICC profile. Insight that closed it: "delivery dip after
   expansion is an ops-gap." Currently applied here. [ⓘ]
```

Pure read query: `InsightPerformance.won > 0 AND triggerType IN
(<lead.triggers>) AND segmentTier = <lead.tier>` + sister-lead lookup.

---

## 9. Open questions back to the user

Different from the brief's 10 — these surfaced from this investigation:

1. **Queue strip per-rep or per-workspace?** PRO_TEAM has multiple SDRs;
   two reps shouldn't burn the same next lead. Lock to `assignedToUserId`
   or add an optimistic claim. Suggest: per-rep, optimistic claim.
2. **"Until trigger" snooze — max horizon?** Else dead inventory waits
   forever. Suggest: 90-day hard cap, then auto-`DROP`.
3. **REPLIED stage + stale Why-Now — delete or demote?** Wireframe shows
   "▸ stale." Suggest: visually demote, never delete (audit trail);
   re-promote when a new trigger fires.
4. **Mobile evidence chip gesture?** Desktop has hover cards. Suggest:
   tap shows source quote in a slide-up footnote band; tap again to
   dismiss.
5. **Eager-load sister leads?** A chain may have 50+ sibling rows.
   Suggest: lazy — counts only, full rows on expand.
6. **Reasoning power view: route or `?reasoning=<id>` param?** Routes
   deep-link cleanly. Suggest: route at `/leads/[id]/reasoning/[actionId]`.
7. **Disposition strip on every Dial-tap, or telephony-confirmed only?**
   Without telephony we can't confirm. Suggest: assume call happened if
   Dial tapped in last 5min and we're re-rendering. False-positive cost
   = one extra dismiss.
8. **Queue strip = lead-page bottom, or `/app` shell bottom bar?**
   App-shell saves vertical space and works across list/detail/settings.
   Suggest: app-shell bottom bar.
9. **MEDDPICC requires a `WatchlistItem`?** `DealQualification.
   watchlistItemId` is the PK (`:1889`). COLD leads have no
   `WatchlistItem` → no MEDDPICC row. Suggest: auto-create
   `WatchlistItem` on first `DealQualificationFact` arrival from any
   source, regardless of pipeline stage.

---

## 10. Architectural check + closing

Stays inside AGENTS.md guardrails: every new endpoint
(`/decision-surface`, `/queue`, `/snooze`) is `workspaceId`-scoped via
`requireUser()`; imports from `@/generated/prisma/client`; no semantic-
memory touch; no new BullMQ queue (voice-note + disposition reuse
existing events); no new Gemini endpoint; tokens stay `--leadac-*` plus
two semantic adds (`--leadac-evidence-bg`, `--leadac-claim-underline`).
Single schema add: `Lead.snoozeUntilTriggerType: LeadTriggerType?`
(optional, nullable, no migration risk). Everything else is read-time
aggregation over models that already exist.

The brief and this rethink agree on the diagnosis: today's page is a
data catalog, not a decision surface. They disagree on the cure.

- **Brief:** promote the NbaCard, demote tabs from 5 to 4, add a sidebar.
  A 30% improvement on a page whose *shape* is wrong.
- **Rethink:** the page is not a profile, it's a single decision in a
  stack of decisions. Tabs → 0. Reasoning → the spine, not a drawer.
  Workers + retro leave the building. The queue is always visible.
  Multi-location is navigable.

If the rethink is right, the SDR closes ~30% more loops per day because
they spend the saved 50 seconds on the *next* call, not on this one's
chrome. If the brief is right, the SDR has a prettier card to read the
same thing they read before. Pick the experiment with the bigger upside.

— end —
