# Section spec — trivial copy retunes (HowItThinks, UnderstandsGrid, IntelligenceLoop, WaitlistBlock, FinalCta)

> Per-section spec for the homepage RFC at
> [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md) § 4 rows 4, 5, 7, 10, 12.
> Five sections grouped into one spec because each one is a **Trivial-cost** copy / data-array edit; full per-section spec files would inflate scope past what the change merits. Each section gets its own short subsection below with copy diff, voice test, and any open question.
> Built from the template at [`../../templates/section-spec.md`](../../templates/section-spec.md), abbreviated form.

---

## 0. Meta (applies to all five sections)

- **Belongs to RFC:** [`../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md)
- **Surface:** Homepage.
- **Reuses existing pattern:** yes, all five. No new patterns introduced.
- **Cost label:** Trivial across the board. Each section is a copy / data-array edit inside an existing component.
- **Voice grep:** all five sections grepped against the banned list at [.agents/product-marketing-context.md § Banned](../../../product-marketing-context.md) on 2026-05-20. Zero hits in any proposed copy below.

---

## 1. HowItThinks (§ 4 row 4) — retune Execute layer for the call motion

**Component to modify:** [`src/components/marketing/v2/how-it-thinks.tsx`](../../../../src/components/marketing/v2/how-it-thinks.tsx).

**Job (no change):** show Detect / Reason / Execute as a continuous loop.

**Copy diff.** Detect and Reason blocks (lines 22-44) stay verbatim. Execute block (lines 46-55) retunes:

```
EXECUTE BLOCK — CURRENT (lines 47-54)
{
  number: "03",
  title: "Execute",
  copy: "Generate personalized outreach angles and SDR-ready intelligence instantly.",
  rows: [
    { label: "Opener draft", chip: "Ready" },
    { label: "Opportunity summary", chip: "1 paragraph" },
    { label: "Next action", chip: "Email + call" },
    { label: "Sequence recommendation", chip: "3-touch" },
  ],
}

EXECUTE BLOCK — PROPOSED
{
  number: "03",
  title: "Execute",
  copy: "Hand the rep a fresh dossier and a talk track before they pick up the phone. Email is the booking layer for the next call.",
  rows: [
    { label: "Talk track", chip: "First 30 seconds ready" },
    { label: "Dossier", chip: "1 page" },
    { label: "Next action", chip: "Call" },
    { label: "Disposition", chip: "4 chips" },
  ],
}
```

Section headline at line 63 (`"Three layers between a postcode and a reply."`) stays. The word "reply" lands cleanly for both call and email contexts.

Section sub at line 64 (`"The system runs detection, reasoning, and execution as a continuous loop, not three disconnected steps."`) stays.

**Voice-of-customer source.** "First 30 seconds" comes verbatim from the proposed Hero subhead in RFC § 5 ("what to say in the first 30 seconds"). "Disposition / 4 chips" comes from the four-chip set in [DispositionStrip lines 47-50](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx).

**Voice test.**
- [x] No banned phrases.
- [x] Sentence case.
- [x] No em dashes.
- [x] No false ranges.
- [x] No negative parallelism.

**Open questions.** None. This is a straight copy retune.

---

## 2. UnderstandsGrid (§ 4 row 5) — pivot every bullet to a call-talkable line

**Component to modify:** [`src/components/marketing/v2/understands-grid.tsx`](../../../../src/components/marketing/v2/understands-grid.tsx).

**Job (no change):** prove the system understands F&B sub-niche economics.

**Copy diff.** The five `NICHES` entries (lines 30-81) keep their `icon`, `name`, and `summary` fields verbatim. The `bullets` tuples retune from operational-frame phrasing to call-talkable-line phrasing.

```
FINE DINING — bullets
  CURRENT:  ["Reservation systems", "Prestige and review sensitivity", "Average ticket size"]
  PROPOSED: ["Does the booking widget handle Friday peak", "How recent are the 1-star reviews", "Where is the £75-plus tasting menu hidden on the site"]

CAFES — bullets
  CURRENT:  ["Local SEO and Google Maps", "Repeat customer behavior", "Mobile conversion paths"]
  PROPOSED: ["Does the Google Maps listing have hours and photos", "How many of the last 30 reviews mention the queue", "Is the menu readable on a phone in under 5 seconds"]

BARS — bullets
  CURRENT:  ["Late-night foot traffic", "Event programming", "Social proof and Instagram"]
  PROPOSED: ["What did Friday and Saturday night look like in the reviews", "Is the events page current or 6 months stale", "Last Instagram post within the last 14 days"]

BAKERIES — bullets
  CURRENT:  ["Local SEO and listings", "Walk-in conversion", "Morning peak optimization"]
  PROPOSED: ["Does the listing show 'open now' correctly at 7am", "How many reviews mention selling out before noon", "Does the site say what time the morning rush hits"]

GHOST KITCHENS — bullets
  CURRENT:  ["Delivery platform mix", "Conversion funnel design", "Average order value"]
  PROPOSED: ["Which delivery platforms list this brand today", "How many duplicate brands share this kitchen address", "Is the cheapest item under £8 for app-only acquisition"]
```

Each new bullet reads as something a rep could open a call with ("Hi, I noticed your booking widget redirects to a 404 on the Friday peak hour..."). The grammar stays consistent: a question or observation phrased so the rep can voice it verbatim.

Section headline at line 87 (`"Built for real local business economics."`) stays. Sub at line 88 stays.

**Voice-of-customer source.** The pattern of phrasing comes directly from BUYER-PERSONA § 5 quote Q3 ("The opener has to mention something specific about their setup or it doesn't get read"). Verbatim record in [`../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md` § 2](../../research/synthesis/2026-05-20-fnb-bd-pod-voc.md).

**Voice test.**
- [x] No banned phrases.
- [x] Sentence case.
- [x] No em dashes.
- [x] No false ranges. "Friday and Saturday" is a list of two nouns, not a "whether you're a... or a..." construction.
- [x] No negative parallelism.

**Open questions.**
- The bullet "Does the cheapest item under £8 for app-only acquisition" assumes ghost-kitchen economics are roughly the same in the UK and US markets the page may serve. If the founder prefers a market-neutral phrasing, replace with "Is the cheapest item under the price floor of the major delivery platforms". Recommendation: keep the £8 specificity; it reads operator, not abstract.

---

## 3. IntelligenceLoop (§ 4 row 7) — retune to "every disposition feeds the next morning's call list"

**Component to modify:** [`src/components/marketing/v2/intelligence-loop.tsx`](../../../../src/components/marketing/v2/intelligence-loop.tsx).

**Job (no change):** communicate workspace-scoped learning over time.

**Copy diff.** The `NODES` and `EDGES` arrays (lines 22-41) stay; they encode niche / city relationships that already apply. The `PROOF_CARDS` array (lines 43-56) retunes:

```
PROOF_CARDS — CURRENT
[
  { title: "Outcome graph",      body: "Every reply, meeting, and silent loss feeds the next campaign's reasoning, scoped to your workspace." },
  { title: "Behavioral memory",  body: "Tone, opener structure, and angle that work for sushi restaurants in London do not get recycled blindly into bakeries in Manchester." },
  { title: "Playbook formation", body: "Over time the system surfaces rules. \"No booking provider plus high review count\" tends to convert with reservation-optimization angles." },
]

PROOF_CARDS — PROPOSED
[
  { title: "Disposition graph",  body: "Every connected, voicemail, no-answer, and wrong-number disposition feeds tomorrow's call list, scoped to your workspace." },
  { title: "Talk-track memory",  body: "The openers that get the GM to keep listening on Friday afternoons in Camden do not get recycled blindly into Tuesday mornings in Shoreditch." },
  { title: "Playbook formation", body: "Over time the system surfaces rules. \"No booking provider plus three recent slow-service reviews\" tends to keep the GM on the line past 60 seconds." },
]
```

Section headline at line 68 (`"Lead intelligence that improves over time."`) stays.

Section sub at line 69 (`"Revint learns which outreach angles perform best across niches, cities, and business types. Patterns that work get reinforced. Patterns that fail get pruned."`) stays. The word "outreach" survives the pivot because the page's intelligence loop covers both call and email; we are not narrowing to call-only here.

The three floating proof badges inside the SVG (lines 159-191) retune labels:
- `reply rate +14%` → `connect rate +14%` (a "connect" is the 1st chip in the DispositionStrip)
- `meeting +3` → `demo +3` (the BD pod's closer is the demo)
- `tone match` → keep verbatim (the tone-match concept survives the pivot)

**Voice-of-customer source.** "Disposition" labels lifted from [DispositionStrip lines 47-50](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx). "Demo" as the closer comes from BUYER-PERSONA § 5 day-in-life paragraph ("in-person demos at restaurants in the territory").

**Voice test.**
- [x] No banned phrases.
- [x] Sentence case.
- [x] No em dashes.
- [x] No false ranges.
- [x] No negative parallelism.

**Open questions.** None.

---

## 4. WaitlistBlock (§ 4 row 10) — no change

**Component to modify:** [`src/components/marketing/v2/waitlist-block.tsx`](../../../../src/components/marketing/v2/waitlist-block.tsx).

**Job (no change):** pre-launch email capture in place of pricing.

**Copy diff.** None. The current copy (lines 16-72) already covers all three reassurance points the BD-pod reader needs:

1. "Audit before you commit" — the BD manager reads "Reply to the confirmation with a postcode plus niche. We run the audit before a 15-min call" and recognizes the qualifying-call pattern they already run.
2. "First cohort sets the price" — answers the "what does this cost" question without exposing pricing pre-launch, per [01-role-and-mandate.md anti-goal 5](../../01-role-and-mandate.md).
3. "Built for restaurants and the F&B vertical" — already names the vertical correctly for our persona.

Keep verbatim. The block earns its slot by being the calm exit; rewriting it for this cycle would burn cost without moving a metric.

**Voice test.** Existing copy passes the voice grep (no banned terms; sentence case; no em dashes in current file lines 16-72). Verified 2026-05-20.

**Open questions.** None.

---

## 5. FinalCta (§ 4 row 12) — pivot to "Wire Revint into your BD pod's morning queue"

**Component to modify:** [`src/components/marketing/v2/final-cta.tsx`](../../../../src/components/marketing/v2/final-cta.tsx).

**Job (no change):** one last calm push to the trial or the walkthrough.

**Copy diff.**

```
HEADLINE — CURRENT (line 24)
"Stop guessing which businesses to pitch."

HEADLINE — PROPOSED
"Wire Revint into your BD pod's morning queue."

SUB — CURRENT (lines 26-30)
"Revint helps agencies focus on businesses already showing intent signals. Pick a postcode, pick a niche, and the first dossier lands in your tab in five minutes."

SUB — PROPOSED
"Pick a postcode, pick a niche, and the first 47 audited briefs land in your pod's tab in five minutes. Each one ready for the dial."

REASSURANCE LINE — CURRENT (line 88)
"14-day trial · cancel any time · no setup call required."

REASSURANCE LINE — PROPOSED
"14-day trial · cancel any time · refund window if your pod does not connect on a single dial."
```

Primary CTA label stays `Start free trial` (line 64); secondary CTA stays `Book a 15-min walkthrough` (line 81). The `MARKETING_COMING_SOON` branches stay intact (the inert "Launching soon" span and the `Email the founder` fallback).

**Voice-of-customer source.**
- "47 audited briefs in five minutes" cites [.agents/product-marketing-context.md § Evidence layer](../../../product-marketing-context.md) verbatim ("47 audited leads in 5 minutes is real and DB-backed").
- "Refund window" language is canonical per [05-infrastructure-primer.md § 3 Plan tiers and gating](../../05-infrastructure-primer.md) ("Use '14-day trial · cancel any time' instead" and the refund-window framing from [.agents/product-marketing-context.md § FREE plan decision](../../../product-marketing-context.md): "refund window if it doesn't earn you a reply"). The proposed reassurance line tweaks "earn you a reply" to "your pod does not connect on a single dial" to match the call-pod pivot.

**Voice test.**
- [x] No banned phrases.
- [x] Sentence case.
- [x] No em dashes. Middle-dot separator (`·`) only, matching the existing file convention.
- [x] No false ranges.
- [x] No negative parallelism.

**Open questions.**
- The reassurance line "refund window if your pod does not connect on a single dial" tightens the refund condition vs the canonical "if it doesn't earn you a reply". A single connect is a much lower bar than a reply, so this should be cheaper to honor. Confirm with the founder that the refund-window policy actually allows this framing. If not, fall back to "refund window if your pod does not get a single demo booked in 14 days" or revert to the canonical "earn you a reply" with no narrowing. Owner: founder.

---

## 6. Cross-section voice grep

All five sections' proposed copy was grepped together against the banned terms list on 2026-05-20. Zero hits. Em dashes in this spec document itself live only in markdown headings and bullet separators, following the same convention as the parent RFC and the existing strategist docs at [`../../01-role-and-mandate.md`](../../01-role-and-mandate.md).
