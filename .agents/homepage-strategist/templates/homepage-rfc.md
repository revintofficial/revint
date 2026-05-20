# Homepage RFC — `<short title>`

> **How to use this template.** Copy this file into `proposals/<yyyy-mm-dd>-homepage-rfc-<slug>-v<n>.md`. Fill in every section top to bottom. If a section is "TBD", write "TBD because <reason>" so reviewers know it was thought about. Do not skip the decision-criteria checklist at the bottom.
>
> **Read first:** [`01-role-and-mandate.md`](../01-role-and-mandate.md), [`07-decision-criteria.md`](../07-decision-criteria.md), [`05-infrastructure-primer.md`](../05-infrastructure-primer.md).

---

## 0. Meta

- **Author:**
- **Date:**
- **Version:** v0.1
- **Status:** Draft / In review / Approved / Shipped
- **Reviewer:**
- **Related RFCs:**
- **Linked research:** (list paths under `research/` that this RFC pulls from)

---

## 1. One-line thesis

`<One sentence stating what changes and why. If you cannot fit it on one line, you have two RFCs, not one.>`

---

## 2. ICP this RFC is for

Pick exactly one persona from [`BUYER-PERSONA.md`](../../../BUYER-PERSONA.md). Do not try to please all six in one RFC.

- **Persona:** `<e.g. B2B outbound agency owner>`
- **Why this one now:** `<the buying trigger that makes this persona the right target this cycle>`
- **The line they should be able to say after reading the page:** `<one sentence>`

---

## 3. Current-state diagnosis

Cross-reference your week-1 audit (`research/synthesis/<yyyy-mm-dd>-homepage-state-of-the-page.md`).

| # | Current section | Job today | Working? | Why |
|---|---|---|---|---|
| 1 | Hero | | | |
| 2 | ProblemGrid | | | |
| 3 | HowItThinks | | | |
| 4 | UnderstandsGrid | | | |
| 5 | IntelligenceLoop | | | |
| 6 | DossierProof | | | |
| 7 | BuiltFor | | | |
| 8 | IntegrationsStrip | | | |
| 9 | WaitlistBlock | | | |
| 10 | FaqBlock | | | |
| 11 | FinalCta | | | |

**Headline diagnosis:** `<one paragraph: what the current page does well, what it does poorly, what is missing entirely>`

---

## 4. Proposed new section order

| # | Proposed section | Job | Reuse existing? | Cost label |
|---|---|---|---|---|
| 1 | Hero | | Modify existing `hero.tsx` | Trivial / Small |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |

Cost labels from [`05-infrastructure-primer.md`](../05-infrastructure-primer.md) § 11: Trivial / Small / Medium / Large / Forbidden.

**Rationale per section.** Write 1-3 sentences per row above explaining why it is in this position. Pay particular attention to anything that moves up vs the current order.

---

## 5. Hero spec

| Field | Value |
|---|---|
| Eyebrow / badge | |
| Headline | |
| Subhead | |
| Primary CTA label + behavior | |
| Secondary CTA label + behavior | |
| Hero proof element | (logo wall / number / quote / screenshot) |
| Visual / motion notes | |

**5-second test result.** `<Show to 3 people, ask the 3 questions, record what they said.>`

**Frameworks applied:**
- (e.g. StoryBrand — character + problem + plan)
- (e.g. Above-the-fold rubric — 5 elements present)

**Voice-of-customer source.** `<verbatim quote(s) that informed the headline/subhead>`

---

## 6. Per-section specs

Use [`section-spec.md`](./section-spec.md) for each section that is new or substantially changed. Link the specs here.

- §2 `<Section name>`: `<link to spec file or inline ref>`
- §3 `<Section name>`: `<link>`
- §4 `<Section name>`: `<link>`

(At minimum, write specs for hero + the next two below-the-fold sections. Cover more if budget allows.)

---

## 7. Mobile narrative

One paragraph on what the section flow becomes on a phone. Where does an extra section appear or collapse. What gets pinned. What gets cut.

---

## 8. Motion and accessibility

- Motion: `<which sections use motion, what kind (CSS-only is preferred), whether prefers-reduced-motion is respected>`
- A11y: `<contrast ratios, focus rings, semantic landmarks, screen reader narrative>`

---

## 9. SEO / metadata changes

Edit [`src/lib/seo/metadata.ts`](../../../src/lib/seo/metadata.ts) usage in [`src/app/(marketing)/page.tsx`](../../../src/app/(marketing)/page.tsx).

- Title (under 50 chars): `<new title>`
- Description (155-160 chars): `<new description>`
- Keywords (no banned terms): `<list>`
- OG image: `<path or "no change">`
- JSON-LD additions: `<none / Organization / FAQPage / etc.>`

---

## 10. Success metrics + measurement plan

Pre-register before shipping. Do not move the goalposts after.

| Metric | Current baseline | Target | How measured | Decision rule |
|---|---|---|---|---|
| (e.g. waitlist signups / unique visitor) | | | | |
| (e.g. scroll depth to FinalCTA) | | | | |
| (e.g. demo requests / 1k visits) | | | | |

**North Star alignment:** `<which North Star metric this RFC nudges, and how>`

**Risk if metric does not move:** `<roll back vs ship vs iterate>`

---

## 11. Decision criteria — 7 tests

From [`07-decision-criteria.md`](../07-decision-criteria.md).

- [ ] **1. 5-second test** — `<pass / fail / n-a>` — `<one-line evidence>`
- [ ] **2. 500-co test** — `<pass / fail>` — `<one-line evidence>`
- [ ] **3. SDR-30x test** — `<n-a — this is a homepage RFC>` (covered in lead-detail RFCs)
- [ ] **4. FineDine BD test (or named analog: <name>)** — `<pass / fail>` — `<one-line evidence>`
- [ ] **5. Voice test** — `<pass / fail>` — `<grep'd for banned terms: yes/no>`
- [ ] **6. Evidence test** — `<pass / fail>` — `<every claim cited: yes/no>`
- [ ] **7. Engineering test** — `<pass / fail>` — `<all proposed changes labeled on cost ladder: yes/no>`

---

## 12. Open questions

List anything you flagged as TBD, fail, or unresolved. The reviewer answers these or hands them to engineering.

- [ ]
- [ ]
- [ ]

---

## 13. Out-of-scope (explicitly not in this RFC)

Anything you considered and chose not to address in this version, so the reviewer does not re-raise it.

-
-
