# Competitor teardown — Orum

> Companion teardown for the homepage RFC at
> [`../../proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../../proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md).
> Why this competitor: the RFC repositions the homepage for a 5-10 person F&B BD pod whose closing motion is the dial, not the inbox. Orum is the canonical "homepage that addresses an SDR call pod manager" in the wider B2B outbound category. Reading their page sharpens our voice for the manager who would forward our page to their reps (Test 2 — 500-co test).

---

## 0. Meta

- **Competitor:** Orum
- **URL captured:** https://www.orum.com (canonical homepage, captured by reference; this teardown is a structured pull, not a screen-by-screen archive)
- **Date captured:** 2026-05-20
- **Tier:** Adjacent inspiration. Orum is a power / parallel dialer. We are a pre-call brief layer. We do not compete on the dial mechanic itself. We compete (and overlap) on "the homepage that a BD manager forwards to their pod."
- **Surface(s) covered:** Homepage. Pricing referenced only at the level of public claims, not captured in depth.
- **Pulled by:** homepage-strategist, cycle v0.1
- **Why Orum and not Salesfinity / Apollo dialer:** the plan ([.cursor/plans/homepage_rfc_fnb_bd_6f4f968a.plan.md](../../../../.cursor/plans/homepage_rfc_fnb_bd_6f4f968a.plan.md) § Open questions) flagged Salesfinity and the Apollo dialer as fallbacks "if Orum is too parallel-dialer-coded". Orum stays the primary because its homepage is the cleanest example of a page that addresses the call-pod manager as the buyer. The parallel-dialer mechanic is exactly the AI tactic we are NOT cloning; the page architecture is what we are studying.

---

## 1. Their thesis in one line

> "AI-powered conversation platform for sales teams to have more live conversations."

How they position vs us:
- Same category we play in? **No.** They sell the dialer itself. We sell the brief in front of the dial.
- Direct competitor for our buyer? **Partial.** A BD manager who has Orum still has a "what do my reps say in the first 30 seconds" problem. Our page is the solve for that problem on top of any dialer.
- What they replace in the buyer's stack: a manual dial workflow (Aircall / Twilio + a CRM list). What they do NOT replace: the research VA, the per-prospect homework, the per-prospect call opener. That is the gap we live in.

---

## 2. Section-by-section audit

Walk the page top to bottom. Screenshots not captured for this stub; rows describe construction.

| # | Section | Job | Headline (paraphrased to fair-use length) | Proof element | Primary CTA | Works? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Hero | Frame the platform as the way to "more live conversations" | "Have more live sales conversations" type line | Single product still / screenshot of the rep's calling cockpit | "Book a demo" | Yes | The page is unambiguously for a sales leader running a calling motion. The hero does not try to please email marketers. |
| 2 | Logo wall | Authority | (Strip of customer logos, mid-market B2B SaaS) | Logo strip | (none — passive) | Yes | Calibrates expectations of "who else like me uses this" instantly. |
| 3 | Product capability strip | Name three or four call workflow primitives (dialer, AI assistant, call recording / analytics, integrations) | Short capability titles, one icon each | Static stills | (none) | Partial | Reads as feature listing but the labels are operator-language ("dial faster", "record + analyze"), not AI-hype. |
| 4 | Outcome metric block | Quantify "more conversations" | A bold "Nx more conversations per rep per day" style metric | Number with attribution to a customer study | "See how it works" | Yes | The metric is the spine of the whole page. Every other section earns its keep against that number. |
| 5 | Case study row | Named customer testimonial with photo and quote | Quote + role + company | Photo + name + result number | "Read case study" | Yes | Names a sales leader at a named company. Lifts the page above the "stock photo of headset" register. |
| 6 | Integration strip | Stack-compat objection | "Works with Salesforce, HubSpot, Outreach, Salesloft" | Logo strip (real vendor marks) | (none) | Yes | Single most calming section on the page for the buyer's "do I have to migrate" worry. |
| 7 | Final CTA | Book a demo | "See it in action" | (none) | "Book a demo" | Yes | Single-purpose. No competing footer offers. |

---

## 3. Frameworks they are using (lens from our library at [04-growth-frameworks-library.md](../../04-growth-frameworks-library.md))

- **A1 April Dunford positioning** — every section refuses to drift into "dialer alternative" framing. They keep saying "more conversations" instead of comparing to RingDNA / Outreach Voice. Defends category framing top to bottom.
- **B1 StoryBrand** — hero positions the rep as the hero; Orum is the guide that solves the "I do not have enough live conversations" problem. The plan in section 3, the call to action in section 7.
- **C2 Specificity over abstraction** — the outcome metric in section 4 is a number with a customer attribution, not a "transform your team" abstraction.
- **D3 Loss aversion implied** — by quantifying "Nx more conversations", the implicit anchor is "you are currently leaving Nx-1 conversations on the table". The page never says this out loud; the number does the work.

---

## 4. What they do better than us

1. **One metric carries the page.** The "Nx more conversations" line in section 4 is the spine. Every other section either delivers proof of it or removes objections to it. Our current homepage at [src/app/(marketing)/page.tsx](../../../../src/app/(marketing)/page.tsx) does not have one number that the whole page is built around. The closest analog we have is "47 audited leads in 5 minutes" (per [.agents/product-marketing-context.md § Evidence layer](../../../product-marketing-context.md)). That number is on the page nowhere.
2. **The buyer's role is named without persona-listing.** Orum's page never says "for SDR managers, AE leaders, RevOps, and SDR coaches". It writes for one. Our current [BuiltFor section](../../../../src/components/marketing/v2/built-for.tsx) lists three audiences and dilutes against all three. The RFC's collapse to one primary chip + two secondary fixes this.
3. **The integration strip removes the migration objection in one row.** Single line, real vendor names, no ambiguity. Our [IntegrationsStrip](../../../../src/components/marketing/v2/integrations-strip.tsx) has the format but only lists senders today. The RFC's split into senders + dialers brings the section up to Orum's clarity.

---

## 5. What we do better than them

1. **Operator language.** Our copy already reads like one operator to another (see [problem-grid.tsx](../../../../src/components/marketing/v2/problem-grid.tsx) lines 30-51). Orum drifts slightly toward the AI-platform register in its capability strip ("AI-powered conversation intelligence"). Per our voice rules at [.agents/product-marketing-context.md § Voice rules](../../../product-marketing-context.md), that register is banned for us.
2. **Vertical depth.** Our [UnderstandsGrid](../../../../src/components/marketing/v2/understands-grid.tsx) names five F&B sub-niches with their actual economics. Orum's page is vertical-agnostic. For our F&B BD persona, vertical depth is the entire wedge. Orum cannot copy this without breaking their horizontal positioning.
3. **The dossier as the proof.** Our [DossierProof](../../../../src/components/marketing/v2/dossier-proof.tsx) shows the actual artifact the product produces. Orum shows a screenshot of their cockpit. The artifact is more persuasive because it is the thing the rep actually uses, not the thing the manager sees in a dashboard.

---

## 6. Three patterns to consider stealing

| # | Pattern | Where to apply on our surface | Cost label | Reason it would work for our ICP |
|---|---|---|---|---|
| 1 | One spine metric repeated in the hero, in the proof section, and in the final CTA. | Hero subhead + PreCallBrief headline + FinalCTA microcopy. Candidate spine metric: "47 audited leads in 5 minutes" (sourced, see [.agents/product-marketing-context.md § Evidence layer](../../../product-marketing-context.md)). | Trivial (copy only). | The BD manager skims for a number. One number repeated three times anchors. |
| 2 | Logo / wordmark strip with real vendor names for the dial layer integrations (Twilio, Aircall, Justcall), parallel to the existing sender strip. | [IntegrationsStrip](../../../../src/components/marketing/v2/integrations-strip.tsx) split into Senders row + Dialers row. | Small (split layout + 3 wordmarks, plain text per current component convention). | Removes the "we already have a dialer" objection (BUYER-PERSONA § 5 objection O3) in one row. |
| 3 | Final CTA that names the role explicitly ("for the head of sales who wants to see live conversation lift in week 4"). | [FinalCta](../../../../src/components/marketing/v2/final-cta.tsx) variant for the BD-pod cycle: "Wire LeadAC into your BD pod's morning queue." | Trivial (copy only). | Forwarding moment. The BD manager reads the page, sees themselves named, forwards it. Tests 2 and 4 hinge on this. |

---

## 7. Three patterns to avoid

| # | Pattern | Why avoid |
|---|---|---|
| 1 | "AI-powered" prefix on every capability label. | Banned by [.agents/product-marketing-context.md § Banned words](../../../product-marketing-context.md). Our voice rule is operator-to-operator. AI is the mechanism, not the headline. |
| 2 | A capability strip that reads as a feature list instead of a workflow. | Per [01-role-and-mandate.md anti-goal 3](../../01-role-and-mandate.md), feature listing is not positioning. Our equivalent block ([HowItThinks](../../../../src/components/marketing/v2/how-it-thinks.tsx)) earns its keep by being a three-layer loop, not a four-feature wall. Keep it that way. |
| 3 | Generic stock photography in the case study row. | Our cohort is small and anonymized for now (per [.agents/product-marketing-context.md § Evidence layer](../../../product-marketing-context.md)). Stock photos signal "no real customers"; better to use no photo and let the cohort sentence carry the row until real customer permission lands. |

---

## 8. Copy lifts (verbatim or near-verbatim)

We are studying construction, not stealing copy. These lines are recorded for the muscle of seeing.

- "Have more live sales conversations." — Hero. Strong because the verb is concrete ("have"), the unit is concrete ("conversations"), and the qualifier is operator-meaningful ("live", not "more pipeline").
- "Works with Salesforce, HubSpot, Outreach, Salesloft." — Integrations row. Strong because it is a list of nouns the buyer already pays for. The implicit promise: no migration.
- "Book a demo." — Final CTA. Single CTA, no competing offer.

---

## 9. Pricing observations

Orum's public pricing is not exposed on the homepage in detail (industry-standard for B2B SaaS at their ACV). Their pricing page asks for a demo. This rhymes with our pre-launch posture where [src/app/(marketing)/page.tsx](../../../../src/app/(marketing)/page.tsx) intentionally hides pricing in favor of the [WaitlistBlock](../../../../src/components/marketing/v2/waitlist-block.tsx) and the strategist mandate's anti-goal 5 ([01-role-and-mandate.md](../../01-role-and-mandate.md)). No change recommended.

| Tier | Price | Seats | What's included | What's gated |
|---|---|---|---|---|
| Public | Not exposed | n-a | n-a | n-a |
| Sales-led | "Contact us" | Seats negotiated | Full platform | Dial cost / minutes-bundled tiers |

---

## 10. Lead / prospect view observations

Not applicable. Orum's prospect view is gated behind an account and is also not the surface this RFC is studying.

---

## 11. One-line verdict

> If we were Orum, the only change we would ship tomorrow is a one-sentence vertical proof beneath the hero metric ("for the SDR pod selling into restaurants, this number doubles when the opener is built from the prospect's own audit"). They would not, because horizontal is their wedge. That sentence is ours to write, because vertical is ours.

---

## 12. Followups for our synthesis doc

Add to `research/synthesis/2026-05-fnb-bd-teardown-synthesis.md` once the second teardown lands (Salesfinity or Apollo dialer per the plan's open questions):

- Pattern to log: one spine metric carries the whole page. Adopt for our v0.1 BD-pod rewrite.
- Frame for our writing: the buyer's role gets named once at the top and once at the bottom. The middle of the page proves it, it does not re-name them.
- Hypothesis we should test: "spine metric repeated in hero, mid-page, and final CTA" beats "three different proof points spread across three sections" on the 5-second test for the BD-manager reader. A/B candidate for the [`ab-test-hypothesis.md`](../../templates/ab-test-hypothesis.md) template in a future cycle.
