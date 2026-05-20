# A/B test hypothesis — `<short title>`

> **How to use this template.** Save as `proposals/<yyyy-mm-dd>-abtest-<slug>.md`. Register the hypothesis BEFORE you ship the variant. Do not change the metric or sample size after the test starts.
>
> **Read first:** [`04-growth-frameworks-library.md`](../04-growth-frameworks-library.md) § E (CRO) — especially LIFT, ConversionXL 6-step, and friction audit. [`07-decision-criteria.md`](../07-decision-criteria.md) for the seven tests.
>
> **Use this for:** experiments on the homepage or lead-detail page. For learning experiments (qualitative, no metric pre-registered), use a research synthesis doc instead.

---

## 0. Meta

- **Author:**
- **Date proposed:**
- **Status:** Proposed / Approved / Running / Concluded
- **Surface:** Homepage / Lead detail / Other
- **Related RFC:** `<link>`
- **Owner during the test:** `<who watches the metric>`

---

## 1. Hypothesis statement

Use the format: **If we change `<X>` to `<Y>` for `<ICP Z>` then `<metric M>` will move by `<N%>` because `<reason R>`.**

> `<your hypothesis here>`

---

## 2. The change (control vs variant)

### Control (current)

- Surface: `<section / block>`
- Copy / element: `<verbatim>`
- Screenshot: `<path>`

### Variant

- Surface: `<section / block>`
- Copy / element: `<verbatim>`
- Screenshot or sketch: `<path>`

**Why this change:** `<one paragraph: the friction or weakness the variant addresses, ideally with a customer quote or framework cited from 04-growth-frameworks-library.md>`

---

## 3. ICP and audience

- **Persona targeted:** `<from BUYER-PERSONA.md>`
- **Traffic source(s) included:** `<all / direct / organic / paid / referral>`
- **Segments excluded:** `<bot traffic, internal IPs, employees>`
- **Geos:** `<all / specific list>`
- **Device:** `<all / desktop only / mobile only>`

---

## 4. Metrics

### Primary metric

- **Name:** `<e.g. waitlist signup rate per unique visitor>`
- **Current baseline:** `<value + sample size + time window measured>`
- **Target lift:** `<N% absolute or relative>`
- **How measured:** `<event name, calculation>`
- **Direction matters:** Up / Down

### Secondary metrics (guardrails)

| Metric | Direction we want | Threshold for concern |
|---|---|---|
| (e.g. bounce rate) | not worsen | +5% |
| (e.g. time on page) | not worsen | -10% |
| (e.g. demo requests) | not worsen | -10% |
| (e.g. page errors) | not worsen | +0.1% |

---

## 5. Sample size and duration

- **Estimated baseline conversion rate:** `<%>`
- **Minimum detectable effect:** `<%>`
- **Statistical significance threshold:** 95%
- **Statistical power:** 80%
- **Required sample per arm:** `<calculated>` (use a sample size calculator; cite which one)
- **Estimated test duration:** `<N days/weeks>` at current traffic
- **Concurrent tests on this surface:** `<list or "none — exclusive">`

If the estimated duration is >4 weeks, reconsider the test. Long tests get contaminated by seasonality, traffic mix changes, and copy drift elsewhere on the page.

---

## 6. Decision rule (pre-registered)

What you will do based on the result. Decide now; do not bargain after.

| Result | Action |
|---|---|
| Variant wins primary metric significantly, no guardrail breach | Ship variant |
| Variant wins primary metric significantly, but guardrail breached | Investigate guardrail breach; ship only if breach is acceptable |
| No significant difference after planned sample | Kill variant; keep control |
| Variant loses primary metric significantly | Kill variant; keep control; capture learning |
| Variant wins but effect size below business significance | Kill variant; not worth the implementation cost |

---

## 7. Risk if wrong

What happens if the hypothesis is wrong and the variant ships before we know?

- **Worst case for the user:** `<spec>`
- **Worst case for the metric:** `<spec>`
- **Worst case for engineering / data integrity:** `<spec>`
- **Mitigation if discovered post-ship:** `<rollback plan>`

---

## 8. Tools / implementation

- **Tool used:** `<e.g. PostHog feature flags, Vercel A/B, custom server-side split>`
- **Random assignment unit:** `<visitor / session / user>`
- **Persistence:** `<cookie / session storage / user record>`
- **Tracking:** `<event(s) fired, properties>`
- **Engineering owner:** `<name>`
- **Estimated implementation cost:** Trivial / Small / Medium / Large (see [`05-infrastructure-primer.md`](../05-infrastructure-primer.md) § 11)

---

## 9. Frameworks applied

Cite the lens(es) from [`04-growth-frameworks-library.md`](../04-growth-frameworks-library.md).

- `<framework>` — `<why it applies>`
- `<framework>` — `<why>`

---

## 10. Customer evidence supporting the hypothesis

Pull verbatim quotes from `research/interviews/` and `research/synthesis/voc*`.

- "`<quote>`" — `<source>`
- "`<quote>`" — `<source>`

If you cannot cite at least one quote, the hypothesis is a guess. Consider running an interview before the test.

---

## 11. Decision-criteria checklist (lightweight version)

For experiments we run the abbreviated checklist; the full 7-test checklist applies to the underlying RFC, not the test.

- [ ] **Voice test** — variant copy passed humanizer / banned-word grep
- [ ] **Evidence test** — at least one customer quote supports the hypothesis
- [ ] **Engineering test** — implementation cost labeled, tracking event named
- [ ] **Sample test** — estimated sample is achievable in <4 weeks at current traffic

---

## 12. Result (filled after the test)

- **Started:**
- **Ended:**
- **Sample per arm:**
- **Primary metric — control:** `<value ± CI>`
- **Primary metric — variant:** `<value ± CI>`
- **Statistical significance:** `<p-value or Bayesian probability of variant winning>`
- **Guardrails breached:** Yes / No (list)
- **Decision per pre-registered rule:** Ship variant / Kill / Iterate
- **Learning captured in:** `<link to synthesis doc>`

---

## 13. Post-test followup

- [ ] Result added to `research/synthesis/experiment-log.md`
- [ ] Learning fed back into open RFCs
- [ ] Variant code cleaned up (ship-side or revert-side)
- [ ] Feature flag retired
