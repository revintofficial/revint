# Section / Block spec — `<section name>`

> **How to use this template.** One section or block per file (or one section per inline ref inside an RFC). Copy this template into the RFC inline, or save as `proposals/specs/<yyyy-mm-dd>-<rfc-slug>-<section-slug>.md`.
>
> **Use this for:** a single homepage section ([`src/components/marketing/v2/*`](../../../src/components/marketing/v2)) or a single lead-detail block ([`src/components/app/lead-detail-v2/*`](../../../src/components/app/lead-detail-v2)).

---

## 0. Meta

- **Belongs to RFC:** `<link to parent RFC>`
- **Surface:** Homepage / Lead detail / Other
- **Component to create or modify:** `<file path>`
- **Reuses existing pattern:** Yes (`<pattern>`) / No — net-new pattern
- **Cost label:** Trivial / Small / Medium / Large / Forbidden

---

## 1. Job

One sentence. What is the one thing this section does. If you cannot name it in one sentence, this is two sections, split it.

> `<one sentence>`

**JTBD framing.** When `<situation>`, the `<role>` wants to `<job>`, so they can `<outcome>`.

---

## 2. Anatomy

| Element | Content | Notes |
|---|---|---|
| Eyebrow / badge | | (optional) |
| Headline | | Sentence case. Under N words. |
| Subhead | | One sentence. |
| Body | | Bullets or paragraph. |
| Proof | | Number, quote, logo, screenshot. |
| Primary CTA | | Label + behavior. |
| Secondary CTA | | (optional) |

---

## 3. Copy draft

Apply voice rules from [`.agents/product-marketing-context.md`](../../product-marketing-context.md). Grep for banned terms before finalizing.

```
HEADLINE:
<copy>

SUBHEAD:
<copy>

BODY:
<copy>

PRIMARY CTA:
<copy>

SECONDARY CTA:
<copy>
```

**Voice-of-customer source** (if copy is lifted from an interview / Reddit / community):
- Quote: "`<verbatim>`"
- Source: `<initials + role + date>` or `<r/coldemail, <thread title>, <date>>`

---

## 4. Visual reference

- Screenshot / Figma link / sketch: `<link>`
- Or describe in words: `<one paragraph>`

If this section reuses an existing pattern, link the source component:
- Pattern from: [`<file path>`](<relative path>)

---

## 5. Frameworks applied

Cite the lens(es) from [`04-growth-frameworks-library.md`](../04-growth-frameworks-library.md). Each citation gets one sentence of why.

- `<framework>` — `<why it applies here>`
- `<framework>` — `<why>`

---

## 6. Component pattern to reuse

For homepage:
- Reuse [`src/components/marketing/v2/section.tsx`](../../../src/components/marketing/v2/section.tsx) wrapper.
- Reference patterns: [`hero.tsx`](../../../src/components/marketing/v2/hero.tsx), [`dossier-proof.tsx`](../../../src/components/marketing/v2/dossier-proof.tsx), [`built-for.tsx`](../../../src/components/marketing/v2/built-for.tsx), etc.

For lead detail:
- Reuse [`src/components/app/lead-detail-v2/Block.tsx`](../../../src/components/app/lead-detail-v2/Block.tsx) wrapper.
- Claims surface via [`EvidenceChip.tsx`](../../../src/components/app/lead-detail-v2/EvidenceChip.tsx) + [`ClaimWithEvidence.tsx`](../../../src/components/app/lead-detail-v2/ClaimWithEvidence.tsx).
- Mobile primary action via [`MobileStickyCTA.tsx`](../../../src/components/app/lead-detail-v2/MobileStickyCTA.tsx).

State which patterns this spec reuses:
- `<pattern>` — `<why>`
- `<pattern>` — `<why>`

---

## 7. Design tokens

Reference [`src/app/globals.css`](../../../src/app/globals.css). No hex literals.

| Element | Token | Notes |
|---|---|---|
| Background | `--leadac-card` | |
| Border | `--leadac-border` | |
| Primary text | `--leadac-text-1` | |
| Accent | `--leadac-500` | |
| Success state | `--leadac-success` | |
| (other) | | |

---

## 8. Motion

- Entrance: `<CSS-only fade-up / blur-up / none>`
- Hover / focus: `<spec>`
- Reduced motion fallback: `<spec>`
- Performance budget: `<≤16ms paint or note exception>`

---

## 9. Accessibility

- Semantic landmark: `<section / article / aside / nav>`
- Heading level: `<h1 / h2 / h3>`
- ARIA: `<labels needed, role overrides>`
- Focus order: `<spec>`
- Contrast ratio: `<≥4.5:1 confirmed>`
- Screen reader narrative: `<one sentence on how it reads>`

---

## 10. Mobile behavior

- What changes vs desktop: `<spec>`
- Tappable target sizes: `<≥44×44px>`
- One-handed reachability: `<spec>`

---

## 11. Empty / error / loading states

| State | Visible content |
|---|---|
| Loading | |
| Empty (no data) | |
| Error | |
| Locked (plan-gated) | |

---

## 12. Telemetry (lead-detail only)

| Event | When | Properties |
|---|---|---|
| | | |

---

## 13. Voice test

- [ ] No banned phrases ([`.agents/product-marketing-context.md`](../../product-marketing-context.md) § Banned).
- [ ] Sentence case in headings.
- [ ] No em dashes.
- [ ] No false ranges ("whether you're a... or a...").
- [ ] No negative parallelism ("not just X, it's Y").

---

## 14. Open questions for this section

-
-
