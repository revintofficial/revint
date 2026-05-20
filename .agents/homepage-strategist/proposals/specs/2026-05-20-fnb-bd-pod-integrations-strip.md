# Section spec — IntegrationsStrip (split into Senders + Dialers)

> Per-section spec for the homepage RFC at
> [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md) § 4 row 8.
> Built from the template at [`../../templates/section-spec.md`](../../templates/section-spec.md).

---

## 0. Meta

- **Belongs to RFC:** [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md)
- **Surface:** Homepage.
- **Component to modify:** [`src/components/marketing/v2/integrations-strip.tsx`](../../../../src/components/marketing/v2/integrations-strip.tsx).
- **Reuses existing pattern:** yes. Same wordmark-pill grammar as today; add a second row of pills with a label above each row.
- **Cost label:** Small. The component changes from one flat pill list to a two-row layout with row labels. No new wordmarks beyond plain text labels (per the existing file-header comment in [`integrations-strip.tsx`](../../../../src/components/marketing/v2/integrations-strip.tsx) lines 4-7, the section avoids logo SVGs for licensing reasons).

---

## 1. Job

> Knock down two stack-compat objections in one row each: "do you fit my sender" and "do you fit my dialer".

**JTBD framing.** When a BD manager skims the page for "will this fit the tools my pod already pays for", they want a single calm row per stack-layer (sender, dialer), so they can stop worrying about migration and keep reading.

---

## 2. Anatomy

| Element | Content | Notes |
|---|---|---|
| Eyebrow / badge | None. | Strip lives outside the Section wrapper (per existing [`integrations-strip.tsx`](../../../../src/components/marketing/v2/integrations-strip.tsx) line 21) so it can sit tighter against neighboring blocks. |
| Headline | None. | The two row labels replace a headline. |
| Subhead | None. | Same. |
| Body | Two rows. Row 1 label: "Senders". Row 1 pills: Gmail, Outlook, Smartlead, Instantly, GHL. Row 2 label: "Dialers". Row 2 pills: Twilio, Aircall, Justcall (the three currently wired in [`src/app/api/webhooks/telephony/[provider]/route.ts`](../../../../src/app/api/webhooks/telephony/%5Bprovider%5D/route.ts) line 12). | "Google Maps" pill from the current list drops out — it was reading as a sender, which it never was. It belongs in HowItThinks (Detect layer), not here. |
| Proof | The list of real vendor names. | Per Orum teardown § 4 lesson 3, real vendor names are the proof. |
| Primary CTA | None. | Strip section does not push action. |
| Secondary CTA | None. | Same. |

---

## 3. Copy draft

Grepped against banned list 2026-05-20. Zero hits.

```
ROW 1 LABEL:
Senders

ROW 1 PILLS (5):
Gmail · Outlook · Smartlead · Instantly · GHL

ROW 2 LABEL:
Dialers

ROW 2 PILLS (3):
Twilio · Aircall · Justcall

OPTIONAL FOOTNOTE (if reviewer wants the migration objection killed in writing, not just visually):
"Wire your own dialer or sender. We do not replace either."

PRIMARY CTA:
(none)

SECONDARY CTA:
(none)
```

**Voice-of-customer source.**

- The phrase "we do not replace the sender" comes verbatim from [`.agents/product-marketing-context.md` § What LeadAC is](../../../product-marketing-context.md) ("We do not replace the sender. We feed it."). The footnote extends the same construction to dialers.
- The objection-pattern is BUYER-PERSONA § 5 objection O3 ("Our BD team needs in-person, not more email"). The dialer row says, without writing a word, "we know your motion is dial-first; we fit it".

---

## 4. Visual reference

ASCII sketch:

```
+-------------------- (page-wide, no Section wrapper) ----------------+
|                          Works with your stack.                     |
|                                                                     |
|   SENDERS                                                           |
|   ( Gmail ) ( Outlook ) ( Smartlead ) ( Instantly ) ( GHL )         |
|                                                                     |
|   DIALERS                                                           |
|   ( Twilio ) ( Aircall ) ( Justcall )                               |
+---------------------------------------------------------------------+
```

The existing centered "Works with your stack." caption (line 23 of the current component) stays as the cap. Below it, the two labeled rows sit centered. Each row label uses the same uppercase eyebrow grammar already established in [`section.tsx`](../../../../src/components/marketing/v2/section.tsx) line 47-52 (`text-[11.5px] font-semibold uppercase tracking-[0.16em]` with `hsl(var(--leadac-h) var(--leadac-s) 62%)` color). Pills keep the current grammar from [`integrations-strip.tsx`](../../../../src/components/marketing/v2/integrations-strip.tsx) lines 28-37.

---

## 5. Frameworks applied

- **G5 Friction removal** ([04-growth-frameworks-library.md](../../04-growth-frameworks-library.md)) — the "do you fit my stack" worry is the highest-friction objection for a BD manager who already pays for HubSpot, Aircall, etc. Naming the integrations in plain text removes the worry without requiring a click.
- **C5 Specificity over abstraction** — real vendor names beat "works with major dialers". The reader's brain pattern-matches "Aircall" in 200ms; it cannot pattern-match "major dialers" at all.

---

## 6. Component pattern to reuse

- Outer `<section className="py-16">` wrapper from current file (lines 21-22) stays.
- `max-w-6xl mx-auto px-5 sm:px-6` container stays.
- Pill grammar: `rounded-full px-4 py-2 text-[13px] text-white/75` with `border: "0.5px solid rgba(255,255,255,0.12)"` and `background: "rgba(255,255,255,0.02)"` (lines 28-37). Reuse exactly.
- New: row label grammar lifted from the Section header eyebrow recipe (sentence-case label is "Senders" / "Dialers", but visual treatment is uppercase tracking-wide via the className — same recipe the section eyebrows use).

State which patterns this spec reuses:

- Existing pill recipe — for visual continuity with the page's pill grammar everywhere else.
- Section-eyebrow row-label recipe — for visual continuity with the rest of the page's small-caps labels.

---

## 7. Design tokens

| Element | Token | Notes |
|---|---|---|
| Pill background | `rgba(255,255,255,0.02)` (existing recipe) | Inline style, matches current file. Per [ui-components.mdc](../../../../.cursor/rules/ui-components.mdc), this is a borderline anti-pattern (hardcoded rgba). Current file already does this; leaving the recipe alone for v0.1 to keep cost label Small. Flagged as a follow-up. |
| Pill border | `rgba(255,255,255,0.12)` (existing recipe) | Same caveat. |
| Pill text | `text-white/75` (Tailwind utility) | Existing recipe. |
| Row label color | `hsl(var(--leadac-h) var(--leadac-s) 62%)` | Same eyebrow color used by [`section.tsx`](../../../../src/components/marketing/v2/section.tsx) line 49. |
| Caption text ("Works with your stack.") | `text-white/45` | Existing recipe (line 23). |

---

## 8. Motion

- Entrance: none. Server, no Framer, no CSS keyframe.
- Hover / focus: none. Pills are not interactive.
- Reduced motion fallback: not applicable.
- Performance budget: ≤ 4 ms paint (text-only section).

---

## 9. Accessibility

- Semantic landmark: `<section>` (existing wrapper).
- Heading level: none. Caption is a `<p>`. Row labels are `<p>` with strong typography (not `<h3>`) so the page outline stays clean (one h2 per Section in the rest of the page; this strip has no h2).
- ARIA: each row gets `aria-label="Sender integrations"` and `aria-label="Dialer integrations"` on the row container `<div>`.
- Focus order: not applicable.
- Contrast ratio: pill text at `text-white/75` on the page-background passes 4.5:1 in the current rendering and stays unchanged.
- Screen reader narrative: "Works with your stack. Sender integrations: Gmail, Outlook, Smartlead, Instantly, GHL. Dialer integrations: Twilio, Aircall, Justcall."

---

## 10. Mobile behavior

- What changes vs desktop: pill rows wrap naturally. Each row's label sits left-aligned above the row instead of inline so the wrap reads cleanly. Caption "Works with your stack." stays centered.
- Tappable target sizes: not applicable; pills are not interactive.
- One-handed reachability: not applicable.

---

## 11. Empty / error / loading states

| State | Visible content |
|---|---|
| Loading | Not applicable. |
| Empty (no data) | Not applicable. The pill lists are hard-coded. |
| Error | Not applicable. |
| Locked (plan-gated) | Not applicable. |

If a future cycle pulls integration availability from a feature flag (e.g., GHL not yet wired in production), the row should drop the unavailable pill and the visual layout should still balance. Out of scope for v0.1.

---

## 12. Telemetry

Homepage section, not a lead-detail block. Skipped.

If the reviewer wants to A/B test the footnote-vs-no-footnote variant against the click-through to the FAQ section, a PostHog scroll event on `data-section="integrations-strip"` covers it. Recorded as engineering detail.

---

## 13. Voice test

- [x] No banned phrases per [.agents/product-marketing-context.md § Banned](../../../product-marketing-context.md). Grepped 2026-05-20.
- [x] Sentence case in labels. "Senders" and "Dialers" are sentence-case nouns; visual uppercase comes from CSS, not from the source string.
- [x] No em dashes. Period and dot separators only.
- [x] No false ranges. None.
- [x] No negative parallelism. The optional footnote "Wire your own dialer or sender. We do not replace either." is a positive parallel construction, not a negative one.

---

## 14. Open questions for this section

- The dialer row hard-codes the three providers from [`src/app/api/webhooks/telephony/[provider]/route.ts`](../../../../src/app/api/webhooks/telephony/%5Bprovider%5D/route.ts) line 12. Per RFC § 12 open question 2, engineering should confirm which of those three carry production traffic vs are scaffolded only. If a provider is scaffold-only, drop it from the marketing pill for v0.1 and add it back when production-ready. Owner: engineering.
- Decide on the optional footnote ("Wire your own dialer or sender. We do not replace either."). Reviewer choice. Recommendation: include it, because the explicit "we do not replace" is a positioning move that aligns with [`.agents/product-marketing-context.md` § What we are NOT replacing](../../../product-marketing-context.md) and answers BUYER-PERSONA § 5 objection O1 ("We have HubSpot already") in passing.
- Should GHL stay in the Senders row, or is it accurate to call GHL a sender? GHL ships both calling and email primitives. Recommendation: keep GHL in Senders for v0.1 because that is how most agencies wire it; flag for engineering to confirm.
