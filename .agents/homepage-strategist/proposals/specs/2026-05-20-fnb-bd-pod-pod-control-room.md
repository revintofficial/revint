# Section spec — PodControlRoom (NEW)

> Per-section spec for the homepage RFC at
> [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md) § 4 row 6.
> This is the only **net-new** section in the v0.1 cycle. Every other section change is a copy / data-array retune of an existing component. Built from the template at [`../../templates/section-spec.md`](../../templates/section-spec.md).

---

## 0. Meta

- **Belongs to RFC:** [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md)
- **Surface:** Homepage.
- **Component to create:** `src/components/marketing/v2/pod-control-room.tsx` (new file). Add to the barrel index at `src/components/marketing/v2/index.ts` and to the imports in [`src/app/(marketing)/page.tsx`](../../../../src/app/(marketing)/page.tsx) between `<UnderstandsGrid />` and `<IntelligenceLoop />`.
- **Reuses existing pattern:** yes. The visual is a presentational riff on three existing product surfaces ([DispositionStrip](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx), [RecentDialContext](../../../../src/components/app/lead-detail-v2/RecentDialContext.tsx), [use-lead-queue](../../../../src/lib/lead-detail/use-lead-queue.ts)). The card construction reuses the Section wrapper at [`section.tsx`](../../../../src/components/marketing/v2/section.tsx) and the bordered-card grammar already established by [`how-it-thinks.tsx`](../../../../src/components/marketing/v2/how-it-thinks.tsx).
- **Cost label:** Small. One new file, no new data fetch, no client JS, no new design pattern.

---

## 1. Job

> Show the BD manager their own morning view: the queue waiting on their pod, the disposition mix from yesterday, and the repeat-call guard.

**JTBD framing.** When a BD manager is reading the page to decide whether Revint fits their pod, they want a section that shows the manager's screen (not just the rep's screen), so they can recognize their Tuesday-morning report and forward the page to the pod with one line of context.

---

## 2. Anatomy

| Element | Content | Notes |
|---|---|---|
| Eyebrow / badge | `For the pod manager` | Sentence case, matches existing eyebrow grammar (compare `Product proof` in [dossier-proof.tsx](../../../../src/components/marketing/v2/dossier-proof.tsx)). |
| Headline | `The manager view, before the morning stand-up.` | Sentence case. 9 words. |
| Subhead | `Queue waiting on your pod, disposition mix from yesterday, repeat-call guard. The numbers your stand-up runs on, prepared while your reps are still on the train in.` | Two sentences. The second sentence carries the time-claim. |
| Body | Three-column mock card: (a) morning queue with 3 stub rows, (b) disposition strip with 4 chips and stub counts, (c) repeat-call guard card with one stub line. | Below the body, no extra prose. The mock is the body. |
| Proof | The mock itself. Visual proof, not numeric proof. (Numeric proof lives in the PreCallBrief and IntelligenceLoop sections per RFC.) | Cohort numbers stay attributed in those sections; this one earns its keep by being recognizable. |
| Primary CTA | None. | This section does not push action. The hero, WaitlistBlock, and FinalCta carry CTAs. Adding a fifth CTA here violates Hick's Law per [04-growth-frameworks-library.md § G1](../../04-growth-frameworks-library.md). |
| Secondary CTA | None. | Same reasoning. |

---

## 3. Copy draft

Grepped against the banned list at [.agents/product-marketing-context.md § Banned](../../../product-marketing-context.md) on 2026-05-20. Zero hits.

```
HEADLINE:
The manager view, before the morning stand-up.

SUBHEAD:
Queue waiting on your pod, disposition mix from yesterday, repeat-call guard. The numbers your stand-up runs on, prepared while your reps are still on the train in.

BODY (mock content):

  COLUMN 1 — MORNING QUEUE (3 stub rows)
  Row 1:  Kazu Sushi · Camden · Fit 84 · Why now: 3 reviews flag Friday wait
  Row 2:  Dishoom Shoreditch · Shoreditch · Fit 79 · Why now: new GM 11 days ago
  Row 3:  Cafe Lobo · Hackney · Fit 71 · Why now: booking link 404s on mobile
  Column footer microcopy: "3 of 28 in your pod's queue today"

  COLUMN 2 — DISPOSITION MIX FROM YESTERDAY (4 chips)
  Connected:   7
  Voicemail:  11
  No-answer:   9
  Wrong-#:     1
  Column footer microcopy: "28 dialed yesterday by 4 reps"

  COLUMN 3 — REPEAT-CALL GUARD (one card)
  "Kazu Sushi was last dialed by Sam, 9 days ago. Voicemail.
   The brief is fresh; the dial is yours."
  Column footer microcopy: "Pod-wide, scoped to your workspace"

PRIMARY CTA:
(none)

SECONDARY CTA:
(none)
```

**Voice-of-customer source.**

- Queue row "Why now" phrasings are drafted to be talk-track-ready per BUYER-PERSONA § 5 quote Q3: "The opener has to mention something specific about their setup or it doesn't get read." Verbatim record in [`../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md` § 2](../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md).
- The column 2 disposition labels (Connected / Voicemail / No-answer / Wrong-#) are lifted verbatim from the four chips in [`DispositionStrip.tsx`](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx) lines 47-50 and 183-209. The product already ships this chip-set; the marketing surface mirrors it.
- The column 3 microcopy "scoped to your workspace" is a direct response to the multi-tenant scope rule at [`.cursor/rules/multi-tenant-scope.mdc`](../../../../.cursor/rules/multi-tenant-scope.mdc). Even on a marketing mock, the language stays accurate to how the data is actually scoped.

---

## 4. Visual reference

Hand-laid mock, no Figma file required. Three-column layout at `lg+`, stacks to single column at `md` and below. Width matches the existing Section wrapper at `max-w-6xl` per [`section.tsx`](../../../../src/components/marketing/v2/section.tsx) line 43. Approximate vertical height: 280 px desktop, 720 px mobile (stacked).

ASCII sketch (desktop):

```
+--------------------------------------------------------------------+
|  [Eyebrow: For the pod manager]                                    |
|                                                                    |
|  The manager view, before the morning stand-up.                    |
|  [subhead, two sentences]                                          |
|                                                                    |
|  +---------------+  +---------------+  +-----------------------+   |
|  | MORNING QUEUE |  | DISPOSITIONS  |  | REPEAT-CALL GUARD     |   |
|  |---------------|  |---------------|  |-----------------------|   |
|  | Kazu Sushi    |  | Connected   7 |  | Kazu Sushi was last   |   |
|  | Dishoom Shore |  | Voicemail  11 |  | dialed by Sam, 9 days |   |
|  | Cafe Lobo     |  | No-answer   9 |  | ago. Voicemail.       |   |
|  |               |  | Wrong-#     1 |  |                       |   |
|  | 3 of 28       |  | 28 dialed     |  | Pod-wide, workspace.  |   |
|  +---------------+  +---------------+  +-----------------------+   |
+--------------------------------------------------------------------+
```

Pattern source: the bordered card grammar comes from [`how-it-thinks.tsx`](../../../../src/components/marketing/v2/how-it-thinks.tsx) lines 67-117 (three article cards in a `grid lg:grid-cols-3 gap-6`). The internal row separator inside column 1 reuses the `divide-y divide-white/[0.04]` pattern from [`how-it-thinks.tsx`](../../../../src/components/marketing/v2/how-it-thinks.tsx) line 92. The chip styling in column 2 reuses the disposition-chip grammar from [`DispositionStrip.tsx`](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx) lines 291-312, simplified to a static label + count.

---

## 5. Frameworks applied

- **C5 Specificity over abstraction** ([04-growth-frameworks-library.md](../../04-growth-frameworks-library.md)) — every number on the mock is concrete (7 / 11 / 9 / 1, "3 of 28", "9 days ago"). The reader's eye lands on numbers, not adjectives.
- **B1 StoryBrand** — the BD manager is the hero; the obstacle is "I do not know what my pod did yesterday until 10am stand-up"; the plan is the three-column view; this section is the plan beat of the page's story.
- **G7 Progressive disclosure** — only three queue rows show, not 28. The full queue lives in the product. The mock teases, the product delivers.

---

## 6. Component pattern to reuse

- Section wrapper: [`section.tsx`](../../../../src/components/marketing/v2/section.tsx). Use `variant="default"` (not `"soft"`), since IntelligenceLoop directly below uses default and we want them to read as a single rhythm beat, not striped.
- Card grammar: [`how-it-thinks.tsx`](../../../../src/components/marketing/v2/how-it-thinks.tsx) `<article className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_8%)] p-6 md:p-7">`.
- Inner divide: `divide-y divide-white/[0.04]` from the same source.
- Chip grammar: simplified [`DispositionStrip` Chip](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx) lines 291-312 — drop the `onClick`, drop the focus-ring class, keep the border / background / color tokens.

State which patterns this spec reuses:

- Section wrapper — for vertical rhythm and gutter consistency.
- HowItThinks card grammar — for visual continuity with the section above (UnderstandsGrid) and the section below (IntelligenceLoop).
- DispositionStrip Chip styling — for visual honesty with the product surface the mock is depicting.

---

## 7. Design tokens

All token references from [`src/app/globals.css`](../../../../src/app/globals.css). No hex literals.

| Element | Token | Notes |
|---|---|---|
| Background (card) | `hsl(var(--revint-h) var(--revint-ns) 8%)` | Same as HowItThinks card; via the inline-style pattern existing components use. |
| Border (card) | `border-white/[0.06]` | Tailwind utility, same as HowItThinks. |
| Primary text | `text-white` | Card heading / numbers. |
| Secondary text | `text-white/65` | Row labels, microcopy footer. |
| Tertiary text | `text-white/45` | Column captions ("3 of 28 in your pod's queue today"). |
| Accent | `hsl(var(--revint-h) var(--revint-s) 50% / 0.10)` background, `hsl(var(--revint-h) var(--revint-s) 72%)` foreground | Disposition chip background and text. Same recipe as the eyebrow color used across v2 sections. |
| Success state (not used) | `--revint-success` | Reserved; not needed because the mock does not encode pass/fail. |

---

## 8. Motion

- Entrance: none. Server-rendered, no Framer, no CSS keyframe entrance. The page's existing motion budget is hero radial glow only.
- Hover / focus: none. The mock is presentational, no interactive elements.
- Reduced motion fallback: not applicable (no motion to disable).
- Performance budget: ≤ 16 ms paint. Zero JS, zero layout shifts, zero web fonts beyond what the page already loads.

---

## 9. Accessibility

- Semantic landmark: `<section>` via the Section wrapper.
- Heading level: `<h2>` for the section headline (delegated to the Section wrapper's `headline` slot per [`section.tsx`](../../../../src/components/marketing/v2/section.tsx) lines 54-61). Column captions inside the mock should be `<p>` with strong typography, not nested `<h3>`s, to keep the page outline clean (one h2 per section).
- ARIA: the three columns are `<article role="group" aria-label="Morning queue" />`, `<article role="group" aria-label="Yesterday's disposition mix" />`, `<article role="group" aria-label="Repeat-call guard" />`. Numbers inside the disposition chips get `<span aria-label="7 connected calls">7</span>` so a screen reader hears the meaning, not just the digit.
- Focus order: not applicable; no focusable children.
- Contrast ratio: ≥ 4.5:1 confirmed by inheriting from the same surface / text-token recipe used by [`how-it-thinks.tsx`](../../../../src/components/marketing/v2/how-it-thinks.tsx) which is live and passes.
- Screen reader narrative: "Section: For the pod manager. The manager view, before the morning stand-up. [subhead]. Group: Morning queue. Kazu Sushi, Camden, fit 84, three reviews flag Friday wait. Dishoom Shoreditch, fit 79, new GM eleven days ago. Cafe Lobo, fit 71, booking link 404s on mobile. Three of 28 in your pod's queue today. Group: Yesterday's disposition mix. Seven connected, eleven voicemail, nine no-answer, one wrong number. Twenty-eight dialed yesterday by four reps. Group: Repeat-call guard. Kazu Sushi was last dialed by Sam, nine days ago. Voicemail. The brief is fresh; the dial is yours. Pod-wide, scoped to your workspace."

---

## 10. Mobile behavior

- What changes vs desktop: three columns stack to single column, top-to-bottom in the same order (Queue → Dispositions → Guard). Column gap collapses from `gap-6` to `gap-3`. Each column's internal padding reduces from `p-7` to `p-5`.
- Tappable target sizes: not applicable; no interactive targets.
- One-handed reachability: not applicable (presentational). The section as a whole sits mid-page, requiring scroll; this is correct because the hero CTAs are already above the fold and the FinalCta is below.

---

## 11. Empty / error / loading states

| State | Visible content |
|---|---|
| Loading | Not applicable. Section is server-rendered with static mock content. |
| Empty (no data) | Not applicable. Mock is hard-coded. |
| Error | Not applicable. |
| Locked (plan-gated) | Not applicable. Marketing surface; no plan gating. |

If a future cycle wires the mock to real workspace data for logged-in viewers, all four states need rows. Out of scope for v0.1.

---

## 12. Telemetry

Homepage section, not a lead-detail block. Per the section-spec template, the telemetry table applies only to lead-detail blocks. Skipped here.

If the reviewer wants per-section scroll telemetry on the homepage for measurement plan § 10 of the RFC, the section root should carry `data-section="pod-control-room"` so the PostHog scroll-depth event can key off it. Recorded here as the implementation detail engineering owner needs.

---

## 13. Voice test

- [x] No banned phrases per [.agents/product-marketing-context.md § Banned](../../../product-marketing-context.md). Grepped 2026-05-20.
- [x] Sentence case in headings. "The manager view, before the morning stand-up." passes.
- [x] No em dashes in copy. Comma and period only.
- [x] No false ranges ("Whether you're a... or a..."). None.
- [x] No negative parallelism ("not just X, it's Y"). None.

---

## 14. Open questions for this section

- Does the BD-manager queue view render today as a real product surface (via [`use-lead-queue.ts`](../../../../src/lib/lead-detail/use-lead-queue.ts)) at workspace-aggregate scope, or only as a per-rep view? If real, a static screenshot can replace the hand-laid mock in a future cycle. If per-rep only, the marketing mock stays hand-laid until the manager view ships in product. Owner: engineering. Carried into RFC § 12.
- Should the disposition chip counts in the mock match the actual cohort numbers from the Camden beta (per [.agents/product-marketing-context.md § Evidence layer](../../../product-marketing-context.md)) rather than illustrative stubs? Pro: tighter evidence binding. Con: the cohort had 12 leads, not 28, so the mock numbers would not read as a realistic pod day. Recommendation: keep illustrative-but-plausible numbers and flag the design choice here so the reviewer can override.
- Repeat-call guard names "Sam" as the previous-dialer. If the reviewer prefers no fake names, swap to "your teammate" with the same structure. Recommendation: keep "Sam" because anonymized-but-named reads more like a real product than "your teammate" placeholder.
