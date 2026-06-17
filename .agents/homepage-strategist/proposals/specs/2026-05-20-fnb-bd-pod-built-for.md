# Section spec — BuiltFor (collapse from 3 audiences to 1 primary + 2 secondary)

> Per-section spec for the homepage RFC at
> [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md) § 4 row 9.
> Built from the template at [`../../templates/section-spec.md`](../../templates/section-spec.md).

---

## 0. Meta

- **Belongs to RFC:** [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md)
- **Surface:** Homepage.
- **Component to modify:** [`src/components/marketing/v2/built-for.tsx`](../../../../src/components/marketing/v2/built-for.tsx).
- **Reuses existing pattern:** yes. Same `CHIPS` array shape, same card grammar; the only structural change is one primary card sized larger plus two secondary cards sized smaller, instead of three equal cards.
- **Cost label:** Trivial. Copy + data-array edit + one grid-column rebalance.

---

## 1. Job

> Tell the reader who the page is for, in one sentence the BD manager can repeat to a colleague.

**JTBD framing.** When a BD manager reaches the bottom third of the page, they want one chip that says "you specifically", so they can stop wondering whether the page is for them and either join the waitlist or forward the page.

---

## 2. Anatomy

| Element | Content | Notes |
|---|---|---|
| Eyebrow / badge | `Built for` (no change from current) | Sentence case, matches existing. |
| Headline | `One pod. One screen. One morning at a time.` | Replaces current "Three teams, one system." which list-coded the audience. New headline pivots to the pod's day. Sentence case, 9 words. |
| Subhead | `Revint was built for the BD manager who runs a 5 to 10 person calling pod selling to restaurants and local businesses.` | Replaces current "Revint was built for the operators who pitch local businesses every day." Pivots from "operators" (vague) to "BD manager" (specific). |
| Body | One primary chip + two secondary chips. Primary takes 2 of 3 grid columns at `md+`; secondary chips split the remaining 1 column stacked. On mobile, primary is full-width, secondaries are full-width stacked. | Visual weight shift makes the primary the unmistakable headline of the section. |
| Proof | Each chip carries a one-line operational detail. | The detail is the proof. Persona-card grammar already established. |
| Primary CTA | None. | Section sits 2 below from the WaitlistBlock; not the place to push action. |
| Secondary CTA | None. | Same. |

---

## 3. Copy draft

Grepped against banned list 2026-05-20. Zero hits.

```
HEADLINE:
One pod. One screen. One morning at a time.

SUBHEAD:
Revint was built for the BD manager who runs a 5 to 10 person calling pod selling to restaurants and local businesses.

CHIPS (1 primary, 2 secondary):

  PRIMARY (icon: Headset)
    LABEL:  F&B restaurant-tech BD pods
    BODY:   The morning queue, the call brief, the disposition mix. The whole shape of a 5 to 10 person BD team that lives on the phone with restaurants, cafes, bars, and hotels.

  SECONDARY 1 (icon: Building2)
    LABEL:  Local agencies calling restaurants
    BODY:   For the agency owner who calls local cafes about web work and wants the brief on the screen before the call connects.

  SECONDARY 2 (icon: ChefHat)
    LABEL:  Restaurant-tech in-house BD
    BODY:   For the VP Sales hiring their 6th BD rep at a regional POS or QR-menu vendor.

PRIMARY CTA:
(none)

SECONDARY CTA:
(none)
```

**Voice-of-customer source.**

- Primary chip body lifts the workflow language directly from BUYER-PERSONA § 5 day-in-life paragraph ("calls with shortlisted prospects" + "in-person demos at restaurants in the territory"). Verbatim record in [`../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md` § 1](../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md).
- Secondary 2 chip ("hiring their 6th BD rep at a regional POS or QR-menu vendor") names the vendor type directly from BUYER-PERSONA § 5 Setup paragraph ("a company like FineDine, Toast, Square for Restaurants, or a regional POS / QR-menu vendor"). The phrasing is generalized to avoid naming-and-shaming a specific vendor.
- Headline "One pod. One screen. One morning at a time." rhymes with the canonical [.agents/product-marketing-context.md § Three lines the founder uses internally](../../../product-marketing-context.md) line F2 ("Lead dossiers ready for your end-of-month pipeline review.") in structure (concrete, time-bounded, operator register) without copying it.

---

## 4. Visual reference

ASCII sketch (desktop, 3-col grid with primary spanning 2 cols):

```
+--------------------------------------------------------------------+
|  [Eyebrow: Built for]                                              |
|                                                                    |
|  One pod. One screen. One morning at a time.                       |
|  [subhead]                                                         |
|                                                                    |
|  +-----------------------------+   +--------------------------+    |
|  |  [Headset icon]             |   | [Building2 icon]         |    |
|  |                             |   |                          |    |
|  |  F&B restaurant-tech BD     |   | Local agencies calling   |    |
|  |  pods                       |   | restaurants              |    |
|  |                             |   | [body]                   |    |
|  |  [body, longer]             |   +--------------------------+    |
|  |                             |   +--------------------------+    |
|  |                             |   | [ChefHat icon]           |    |
|  |                             |   | Restaurant-tech          |    |
|  |                             |   | in-house BD              |    |
|  |                             |   | [body]                   |    |
|  +-----------------------------+   +--------------------------+    |
+--------------------------------------------------------------------+
```

Pattern source: the per-card grammar comes directly from the current [`built-for.tsx`](../../../../src/components/marketing/v2/built-for.tsx) lines 48-67 (`<article className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_9%)] p-6 transition-colors hover:border-white/[0.12]">`). The change is only the grid template, which moves from `md:grid-cols-3` to `md:grid-cols-3` with the primary getting `md:col-span-2` and the two secondaries each `md:col-span-1` and stacked via wrapping into the third column.

Icon swap: the current file uses `Building2 / Headset / ChefHat` (lines 9). New order: primary uses `Headset` (the BD pod), secondary 1 uses `Building2` (the agency), secondary 2 uses `ChefHat` (the vendor BD). The icons are reordered, not replaced.

---

## 5. Frameworks applied

- **A6 Crossing the Chasm — one beachhead segment** ([04-growth-frameworks-library.md](../../04-growth-frameworks-library.md)) — the primary chip is the beachhead (F&B BD pod). The secondary chips are adjacent segments that share workflow shape but get less visual weight. The single page does not try to please all six personas; it picks one.
- **G7 Visual hierarchy via size** — the primary chip is 2x the visual weight of each secondary. A reader who skims this section in two seconds sees the primary first; the secondaries register as "and adjacent to" rather than "and equal to".
- **D6 Loss aversion on the manager forward** — if a 500-co VP Sales reads "F&B restaurant-tech BD pods" and recognizes themselves, they forward. The secondary chips reassure their pod that "this is for our adjacent agency partners too" without diluting the primary.

---

## 6. Component pattern to reuse

- Section wrapper: existing [`section.tsx`](../../../../src/components/marketing/v2/section.tsx) with default variant (current file uses default per [`built-for.tsx`](../../../../src/components/marketing/v2/built-for.tsx) line 37-42).
- Card grammar: existing `<article>` per lines 48-67. Reuse the `rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_9%)] p-6 transition-colors hover:border-white/[0.12]` recipe exactly.
- Icon chip: existing `<span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06]">` (lines 51-58).
- Lucide icons: `Headset`, `Building2`, `ChefHat` already imported in the current file (line 9).

State which patterns this spec reuses:

- Card grammar — for visual continuity with the rest of the page.
- Icon chip recipe — for visual continuity with ProblemGrid, UnderstandsGrid, and the BuiltFor itself.
- Grid wrapper — for vertical rhythm.

---

## 7. Design tokens

| Element | Token | Notes |
|---|---|---|
| Card background | `hsl(var(--revint-h) var(--revint-ns) 9%)` | Existing recipe (line 49). |
| Card border | `border-white/[0.06]` | Existing recipe. |
| Card hover border | `border-white/[0.12]` | Existing recipe. |
| Icon chip background | `hsl(var(--revint-h) var(--revint-s) 50% / 0.08)` | Existing recipe (line 54). |
| Icon color | `hsl(var(--revint-h) var(--revint-s) 72%)` | Existing recipe (line 55). |
| Heading text | `text-white` | Existing recipe (line 61). |
| Body text | `text-white/55` | Existing recipe (line 64). |

Zero new tokens. Zero hardcoded hex.

---

## 8. Motion

- Entrance: none. Server, no Framer.
- Hover / focus: the existing `hover:border-white/[0.12]` color transition stays. No new motion.
- Reduced motion fallback: not applicable; the only motion is a color transition which respects user-agent defaults.
- Performance budget: ≤ 4 ms paint.

---

## 9. Accessibility

- Semantic landmark: `<section>` via Section wrapper.
- Heading level: `<h2>` from Section wrapper for the section headline. Each chip's label is an `<h3>` (matches existing line 60).
- ARIA: no overrides needed. The `<article>` tag self-describes.
- Focus order: not applicable; chips are not interactive.
- Contrast ratio: ≥ 4.5:1 confirmed by inheriting the same recipe as the live page.
- Screen reader narrative: "Section: Built for. One pod. One screen. One morning at a time. [subhead]. F&B restaurant-tech BD pods. [primary body]. Local agencies calling restaurants. [secondary 1 body]. Restaurant-tech in-house BD. [secondary 2 body]."

---

## 10. Mobile behavior

- What changes vs desktop: grid collapses to single column. Primary chip stays first; secondaries stack below in declared order. Card padding stays `p-6`.
- Tappable target sizes: not applicable; chips are not interactive.
- One-handed reachability: not applicable.

---

## 11. Empty / error / loading states

| State | Visible content |
|---|---|
| Loading | Not applicable. |
| Empty | Not applicable. |
| Error | Not applicable. |
| Locked | Not applicable. |

---

## 12. Telemetry

Homepage section, not lead-detail. Skipped. If section-level scroll tracking is wired (per RFC § 10), `data-section="built-for"` is the attribute hook.

---

## 13. Voice test

- [x] No banned phrases. Grepped 2026-05-20.
- [x] Sentence case in headings. "One pod. One screen. One morning at a time." passes. "F&B restaurant-tech BD pods" is sentence-case (the ampersand and acronym capitalizations are conventional, not Title Case).
- [x] No em dashes. Periods only.
- [x] No false ranges. The phrase "5 to 10 person" in the subhead is a numeric range, not a "whether you're a... or a..." construction. Allowed per [.agents/product-marketing-context.md § Preferred phrases](../../../product-marketing-context.md) ("Specific numbers").
- [x] No negative parallelism. None.

---

## 14. Open questions for this section

- Confirm with the founder that the v0.1 secondary chips (Local agencies calling restaurants + Restaurant-tech in-house BD) are the right two adjacencies, vs alternatives like Specialists going solo or SMMA owners. Recommendation: keep these two because they share the calling-into-restaurants motion with the primary; SMMA / specialist personas live closer to email-first and would dilute the page's pivot.
- The headline "One pod. One screen. One morning at a time." has a rule-of-three feel that [.agents/product-marketing-context.md § Banned](../../../product-marketing-context.md) flags as a smell ("Rule of three lists when two would do"). Counter-argument: the three nouns name three distinct frames (pod = team, screen = artifact, morning = time), not three synonyms. Recommendation: keep, but if the reviewer reads it as AI-tell, fall back to "One pod, one morning view." (two-part construction).
