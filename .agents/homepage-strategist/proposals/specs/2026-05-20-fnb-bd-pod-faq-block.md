# Section spec — FaqBlock (swap 3 of 7 Q&As for call-pod objections)

> Per-section spec for the homepage RFC at
> [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md) § 4 row 11.
> Built from the template at [`../../templates/section-spec.md`](../../templates/section-spec.md).

---

## 0. Meta

- **Belongs to RFC:** [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md)
- **Surface:** Homepage.
- **Component to modify:** [`src/components/marketing/v2/faq-block.tsx`](../../../../src/components/marketing/v2/faq-block.tsx).
- **Reuses existing pattern:** yes. Same `FAQ: QA[]` array shape, same native `<details>/<summary>` accordion, same chevron rotate behavior. Only the array contents change.
- **Cost label:** Trivial. Three of seven Q&As swap out for call-pod-specific objections; four stay.

---

## 1. Job

> Knock down the three objections most likely to stop a BD manager from joining the waitlist after they have read the rest of the page.

**JTBD framing.** When a BD manager has scrolled to the FAQ, they want quick answers to "do I already have this", "does this match our calling motion", and "is the rep going to actually use it", so they can either join the waitlist or close the tab without lingering doubt.

---

## 2. Anatomy

| Element | Content | Notes |
|---|---|---|
| Eyebrow / badge | `Questions` (no change from current line 61) | Sentence case. |
| Headline | `Before you sign up.` (existing dynamic copy; pre-launch flag swaps to `Answers before launch.` per [faq-block.tsx](../../../../src/components/marketing/v2/faq-block.tsx) lines 53-55) | Keep both variants. |
| Subhead | `Quick answers. Longer ones are one email away.` (existing dynamic copy per lines 56-58) | Keep. |
| Body | Seven `<details>` accordion items. Four kept verbatim (Q4 / Q5 / Q6 / Q7 below). Three swapped out for call-pod objections from BUYER-PERSONA § 5 (Q1 / Q2 / Q3 below). | Total stays at seven, matching the existing density. |
| Proof | None per item; the answer copy is the proof. | The cohort numbers stay in PreCallBrief and IntelligenceLoop; FAQ stays text-only. |
| Primary CTA | None at the item level. Footer email link "Email mert@leadacai.com" stays (lines 82-90). | Existing behavior. |
| Secondary CTA | Same footer link. | Same. |

---

## 3. Copy draft

Grepped against banned list 2026-05-20. Zero hits.

Three NEW Q&As (replace current items 1, 5, and 7 of [`faq-block.tsx`](../../../../src/components/marketing/v2/faq-block.tsx) lines 22-49):

```
Q1: We have HubSpot already. What does LeadAC do that HubSpot does not?

A1: HubSpot is the activity ledger. LeadAC is the brief that gets written
before the activity. We do not replace your CRM. We feed your reps the
dossier for each restaurant they will dial this morning, plus the
first 30 seconds they should open with. Activity then writes back into
HubSpot in the normal way.

---

Q2: Most local restaurants do not reply to cold email. Is this still useful
for us?

A2: That is exactly why this is built around the dial, not the inbox.
Your BD pod calls. We hand the rep the brief before they call. The
email is only the booking layer for the next call, and the page above
covers when that helps and when it does not.

---

Q3: Our BD team needs in-person, not more email. Is this for us?

A3: Yes. The morning queue, the talk track for the first 30 seconds, the
shared disposition chips, and the repeat-call guard all serve a pod
whose closer is the in-person demo. The dial is the booking layer for
the demo. LeadAC sits in front of the dial, not in front of the
inbox.
```

Four KEPT Q&As (verbatim from current [`faq-block.tsx`](../../../../src/components/marketing/v2/faq-block.tsx) lines 26-49, renumbered Q4 through Q7):

```
Q4: How does the AI scoring actually work?

A4: LeadAC reads operational signals: review velocity, reservation maturity,
social activity, site quality, and sub-niche fit. The score is a
calibrated 0-100 with the reasons listed, so you can sanity-check
before pitching.

---

Q5: What signals does LeadAC analyze?

A5: Maps coverage, up to 500 reviews per business, reservation and ordering
tooling, SEO and site signals, social activity, competitor ad presence,
and sub-niche classification.

---

Q6: Does the system learn from outreach outcomes?

A6: Yes. Replies, meetings, and silent losses feed the next campaign's
reasoning. Tone, opener structure, and angles that work in your niche
get reinforced. The memory is scoped to your workspace.

---

Q7: Can multiple SDRs use it?

A7: Yes. Agency+ is workspace-based, not per-seat. Five seats included.
Replies route back to the lead automatically so you do not lose
attribution when teammates send.
```

Three Q&As DROPPED from current copy:

- "Does LeadAC send emails for me?" (current Q1, lines 22-25) — drop because it positions LeadAC against email-send, which is exactly the framing the v0.1 cycle is moving away from. The "we feed the sender, we do not replace it" message moves to the new Q1 (HubSpot) more naturally.
- "Does LeadAC work outside restaurants?" (current Q5, lines 38-41) — drop because the BuiltFor section now answers this implicitly with the secondary chips (Local agencies + Restaurant-tech in-house BD).
- "Where does the lead data come from?" (current Q7, lines 47-49) — drop because the HowItThinks Detect layer card (after the retune in RFC § 4) already covers the data-source question.

**Voice-of-customer source.**

- All three new question stems are verbatim BUYER-PERSONA § 5 objections O1 / O2 / O3. Record in [`../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md` § 4](../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md).
- A1's "we do not replace your CRM" rhymes with [.agents/product-marketing-context.md § What we are NOT replacing](../../../product-marketing-context.md) ("Apollo stays" / "Smartlead / Instantly stay" / "Clay stays"). The construction is canonical.
- A2's "the email is only the booking layer for the next call" is new copy specifically drafted for this RFC; it is not pulled from any prior doc and should be reviewed for accuracy by the founder against the actual product behavior.

---

## 4. Visual reference

No change from current. The accordion grammar at [`faq-block.tsx`](../../../../src/components/marketing/v2/faq-block.tsx) lines 62-79 stays exactly as-is. Only the `FAQ` array contents change.

ASCII sketch (collapsed state):

```
+-------------------------------------------------------+
|  [Eyebrow: Questions]                                 |
|                                                       |
|  Before you sign up.                                  |
|  Quick answers. Longer ones are one email away.       |
|                                                       |
|  +-------------------------------------------------+  |
|  | We have HubSpot already. What does LeadAC...  v |  |
|  | -------------------------------------------     |  |
|  | Most local restaurants do not reply to cold...v |  |
|  | -------------------------------------------     |  |
|  | Our BD team needs in-person, not more email v   |  |
|  | -------------------------------------------     |  |
|  | How does the AI scoring actually work?      v   |  |
|  | -------------------------------------------     |  |
|  | What signals does LeadAC analyze?           v   |  |
|  | -------------------------------------------     |  |
|  | Does the system learn from outreach...      v   |  |
|  | -------------------------------------------     |  |
|  | Can multiple SDRs use it?                   v   |  |
|  +-------------------------------------------------+  |
|                                                       |
|        Still have questions? Email mert@...           |
+-------------------------------------------------------+
```

Pattern source: existing component, no visual changes.

---

## 5. Frameworks applied

- **B5 Objection-handling order** ([04-growth-frameworks-library.md](../../04-growth-frameworks-library.md)) — the three call-pod objections (HubSpot, restaurants do not reply, BD needs in-person) sit at positions 1-3 so the BD manager hits them first. The remaining four kept Q&As (scoring, signals, learning, multi-seat) cover scaling and trust, which matter only if the first three pass.
- **A2 Jobs-to-be-Done** — each new question is the job framed as a doubt ("when I am evaluating tools, I want to know whether this duplicates HubSpot, so I can decide whether to forward the page to my pod").
- **G5 Friction removal** — objection handling at the FAQ is the last friction layer before WaitlistBlock conversion. Pre-empting the three sharpest objections reduces drop-off at the email-capture moment above.

---

## 6. Component pattern to reuse

- Section wrapper: existing `<Section id="faq" eyebrow="Questions" headline=... sub=...>` per [`faq-block.tsx`](../../../../src/components/marketing/v2/faq-block.tsx) line 61.
- Accordion grammar: native `<details className="group [&_summary::-webkit-details-marker]:hidden [&[open]_svg]:rotate-180">` per lines 64-78. Reuse exactly.
- Chevron: `<ChevronDown className="h-4 w-4 shrink-0 transition-transform text-white/45" aria-hidden />`. Reuse.
- Footer email fallback: lines 82-90. Reuse.

State which patterns this spec reuses:

- The entire component shape — only the data array changes.

---

## 7. Design tokens

No change from current. The `divide-y divide-white/[0.06]`, `border-white/[0.06]`, `bg-[hsl(var(--leadac-h)_var(--leadac-ns)_8%)]`, `text-white/90`, `text-white/60` recipe stays intact (lines 62-77).

---

## 8. Motion

No change. The chevron `transition-transform` already lives in the existing class. No motion budget shift.

---

## 9. Accessibility

- Semantic landmark: `<section>` via Section wrapper, no change.
- Heading level: `<h2>` from Section wrapper. Each `<summary>` is a native button-equivalent, no `<h3>` nesting required.
- ARIA: native `<details>` provides correct `aria-expanded` semantics by default; no overrides needed.
- Focus order: native, no overrides. Each `<summary>` is keyboard-focusable.
- Contrast ratio: ≥ 4.5:1 confirmed by inheriting from the current shipped recipe.
- Screen reader narrative: "Section: Questions. Before you sign up. Quick answers. Longer ones are one email away. Disclosure: We have HubSpot already. What does LeadAC do that HubSpot does not? Collapsed. [+ 6 more disclosures]. Still have questions? Email mert@leadacai.com link."

---

## 10. Mobile behavior

No change. The accordion already collapses cleanly on phone widths; tap targets on `<summary>` rows are full-width per the `flex items-center justify-between gap-4 px-5 py-4` recipe, which gives a ≥ 44 px target on mobile out of the box.

---

## 11. Empty / error / loading states

| State | Visible content |
|---|---|
| Loading | Not applicable. Static array. |
| Empty | Not applicable. Array is hard-coded. |
| Error | Not applicable. |
| Locked | Not applicable. |

---

## 12. Telemetry

Homepage section, not lead-detail. Skipped at the per-Q&A level. If section-level scroll tracking is wired per RFC § 10, `data-section="faq"` on the section root covers it. Optional: per-question expand event `lead.faq_expanded` with property `question_id: "hubspot" | "no_reply" | "in_person" | "scoring" | "signals" | "learning" | "multi_seat"` would let the next cycle decide which questions earn their slot. Out of scope for v0.1.

---

## 13. Voice test

- [x] No banned phrases per [.agents/product-marketing-context.md § Banned](../../../product-marketing-context.md). Grepped 2026-05-20.
- [x] Sentence case. All question and answer text is sentence case.
- [x] No em dashes. Periods, commas, colons only.
- [x] No false ranges. None.
- [x] No negative parallelism. A1 uses positive parallelism ("HubSpot is the activity ledger. LeadAC is the brief..."), which is the opposite of the banned "not just X, it's Y" construction.

---

## 14. Open questions for this section

- A2's "the email is only the booking layer for the next call" needs founder review for product-accuracy. If the actual product surfaces email-as-primary-channel in any UI, this line over-positions the dial. Owner: founder.
- Consider whether to retain "Does LeadAC send emails for me?" (current Q1) as Q8, given the page still drafts openers. Recommendation: drop it; the new A1 (HubSpot) and A2 (no-reply) cover the same ground with the right pivot. If the reviewer prefers retaining it for explicit no-send reassurance, move it to position 4.
- Verify with the founder that the dropped current Q7 ("Where does the lead data come from?") is genuinely covered by the retuned HowItThinks Detect layer (per RFC § 4 row 4) before deleting from FAQ. If HowItThinks ends up not stating the data provenance explicitly, retain current Q7 and drop one of the kept ones (Q6 learning is the weakest candidate at the BD-pod stage of the buyer journey).
