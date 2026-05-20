# 02 — Onboarding, first 30 days

This is the ramp. Four weeks. Four outputs. By the end of week 4, you will have shipped two RFCs that are good enough to review.

The pattern is **Absorb → Teardown → Customer voice → Propose**. Do not skip a week. Most of the failure modes downstream come from someone trying to write copy in week 1 before they understand the buyer.

You are not graded on speed in month one. You are graded on quality of the first two RFCs.

---

## Week 1 — Absorb

Goal: understand what LeadAC is, who it is for, what is on the page today, and why each thing is there.

### Reading (in this order)

| Doc | Why | Skim or deep? |
|---|---|---|
| [`.agents/product-marketing-context.md`](../product-marketing-context.md) | The brain. Voice rules + banned words + positioning sentence + ROI line. | Deep |
| [`POSITIONING.md`](../../POSITIONING.md) | The three-page strategy doc. Memorize the canonical positioning sentence. | Deep |
| [`BUYER-PERSONA.md`](../../BUYER-PERSONA.md) | Six personas with day-in-life. | Deep, all six |
| [`MARKETING.md`](../../MARKETING.md) | The master copy book. Current canonical copy for every public surface. | Deep on § 1 Homepage; skim the rest |
| [`AGENTS.md`](../../AGENTS.md) + [`.cursor/rules/architecture.mdc`](../../.cursor/rules/architecture.mdc) | Project map + non-negotiables. | Deep |
| [`.cursor/rules/multi-tenant-scope.mdc`](../../.cursor/rules/multi-tenant-scope.mdc) | The number-one bug class. You must understand it before proposing lead-detail changes. | Deep |
| [`docs/berkay-paketler.md`](../../docs/berkay-paketler.md) | Concrete field example of how a real seller bundles the product for a real vertical. Notice the register and the bundling logic. | Deep |
| [`docs/decisions/free-plan-sunset.md`](../../docs/decisions/free-plan-sunset.md) | Why FREE is sunsetting. Affects every CTA you write. | Skim |

### Hands-on

1. Open the live homepage in a real browser. Walk it section by section. Map each section to the component file in [`src/components/marketing/v2/`](../../src/components/marketing/v2). The current order is:

   ```
   Hero → ProblemGrid → HowItThinks → UnderstandsGrid → IntelligenceLoop →
   DossierProof → BuiltFor → IntegrationsStrip → WaitlistBlock → FaqBlock → FinalCta
   ```

   For each section, write one sentence answering "what job does this section do?". If you cannot name the job, that is data.

2. Open a real lead in [`src/app/app/leads/[id]/page.tsx`](../../src/app/app/leads/[id]/page.tsx) on the v2 surface. Map each block to the component file in [`src/components/app/lead-detail-v2/`](../../src/components/app/lead-detail-v2). The current block inventory you will see includes:

   - `HeaderBar`, `StickyShell`, `CompactIdentityCard`
   - `WhyNowBlock`, `NextGestureBlock`, `RecommendedApproach`
   - `WebsiteSignalStrip`, `WebsiteIntelLazyPanel`, `IntelligenceBriefCard`
   - `SpinBoard`, `MeddpiccChecklist`, `BantBars`, `IcpDimensionBars`
   - `DiscoveryBlock`, `WhoBlock`, `AccountBlock`, `HistoryBlock`
   - `EvidenceChip`, `ClaimWithEvidence`, `FourThingsCard`
   - `StakeholderCard`, `StakeholderOnlinePresence`, `RecentDialContext`, `ReviewTimelineMini`, `ReviewVelocityBadge`, `ReviewIntelligenceSummary`
   - `SisterLeadRow`, `AccountMapMini`, `ClosestWinCallout`, `CrossBranchInsightCallout`
   - `SalesTalkingPoints`, `PredictedVsRealObjections`, `QualificationBlock`
   - `DispositionStrip`, `PipelineStageChip`, `QueueStrip`, `PowerToolsLink`, `PlanLockedBlock`, `SubNicheOverrideMenu`
   - `MobileStickyCTA`, `VoiceNoteFAB`, `UpdatedToast`, `PreliminaryBanner`

   For each block, write one sentence: "what SDR job does this block do?" If two blocks do the same job, that is data.

3. Open the codebase in dev mode (`npm run dev`, see [`AGENTS.md`](../../AGENTS.md)). You do not need to write code. You need to feel the latency. How long until the lead-detail loads? How long until the audit data appears? Where does it feel slow? Where does it feel fast? Note it.

### Output for week 1

Two short docs in `research/synthesis/`:

- `<yyyy-mm-dd>-homepage-state-of-the-page.md` — section-by-section audit. One paragraph per section. The job, the copy, the proof, the CTA, your read on whether it works.
- `<yyyy-mm-dd>-lead-detail-state-of-the-page.md` — block-by-block audit. One paragraph per block. The job, the data shown, the SDR action it enables, your read on whether it works.

No proposals yet. No "should we change this". Just observation. The job this week is to see clearly.

---

## Week 2 — Teardown

Goal: understand what the rest of the world is doing for buyers who look like ours, and for SDRs who use tools all day.

### Targets (use [`templates/competitor-teardown.md`](./templates/competitor-teardown.md) for each)

**Direct competitors — prospect / lead view:**

1. Apollo — the prospect detail view. The single most important reference for "what an SDR expects when they click a lead".
2. Clay — the enrichment table view. Reference for information density and "show me the proof for every field".
3. Outreach — the sequence command center / prospect card. Reference for how "what to do next" gets surfaced.
4. Gong — the call/deal card. Reference for how the system tells the rep "here is what mattered in this conversation".
5. Salesforce — the Account 360 view. Reference for everything that goes wrong when you put 40 modules on one page.
6. HubSpot — the contact / company timeline. Reference for chronology and progressive disclosure.

**Adjacent inspiration — homepage craft:**

7. Linear — homepage and "Method" page. Reference for information density and confidence.
8. Stripe — homepage. Reference for technical credibility without jargon.
9. Attio — homepage and product page. Reference for modern CRM register.
10. Notion — homepage. Reference for progressive disclosure and "show, don't tell".
11. Default — homepage. Reference for RevOps speed feel.

**Vertical analogs — local-business SaaS marketing:**

12. FineDine — homepage and pricing. The closest real-world analog to our F&B vertical motion.
13. Toast — homepage and "for restaurants" funnel.
14. OpenTable — partner / restaurant-tech BD funnel.

Three weeks is not enough to do all 14 deeply. Do 6 with the full template, and 8 with a half-page version. The full six should be: Apollo, Clay, Salesforce, Linear, FineDine, plus one of your choice.

### Output for week 2

- 6 to 14 teardowns in `research/teardowns/<competitor-slug>.md`.
- One synthesis doc in `research/synthesis/<yyyy-mm-dd>-patterns-to-steal-or-avoid.md`. Three patterns to steal. Three patterns to avoid. Each one cited to the competitor it came from.

---

## Week 3 — Customer voice

Goal: hear the buyer and the user in their own words. Stop guessing.

### Interviews

Run at least 5 interviews using [`templates/sdr-interview-notes.md`](./templates/sdr-interview-notes.md). Mix the roles:

- 2 agency owners (B2B outbound or SMMA, 1 to 10 SDRs).
- 2 SDRs (the people who would actually open the lead-detail page 30 times a day).
- 1 F&B BD person (the FineDine-shaped buyer).

If real interviews are not available in week 3, do at least 2 with whoever is reachable and supplement with the language mining below.

### Language mining

You will not always have live interviews. Mine the language:

- `r/coldemail` — search for "Apollo", "Smartlead", "reply rate", "deliverability", "personalization".
- `r/agency` and `r/SMMA` — search for "client churn", "lead gen", "retainer", "SDR".
- `r/sales` and `r/sdr` — search for "tools I actually use", "what I want my CRM to do".
- Bravado, RevGenius, SDR Defenders, Pavilion communities.
- Twitter/X — search by handle: Sam Nelson, Florin Tatulea, Will Allred, Jordan Crawford, Adam Robinson, Nicholas Thickett. Read the last 6 months of their posts.
- Lenny's Newsletter homepage breakdowns.

Pull verbatim quotes only. Do not paraphrase in this stage. Paraphrasing kills the voice.

### Output for week 3

- 5+ interview notes in `research/interviews/<role>-<initials>-<yyyy-mm-dd>.md`.
- One Voice-of-Customer synthesis in `research/synthesis/<yyyy-mm-dd>-voc.md`:
  - Top 10 unmet jobs (Jobs-to-be-Done style: "when I'm doing X, I want Y, so I can Z").
  - Top 20 verbatim quotes, tagged by theme (positioning, pain, objection, language to lift).
  - Top 5 surprises — things you expected to hear and did not, or things you heard that contradicted the current copy.

---

## Week 4 — Propose

Goal: ship two RFCs that are good enough to review.

### Deliverable 1 — Homepage RFC v0.1

Use [`templates/homepage-rfc.md`](./templates/homepage-rfc.md). Required to include:

- The ICP this RFC is for (pick one of the six personas; do not try to please all of them in v0.1).
- The current-state diagnosis (cross-reference your week-1 audit).
- Proposed new section order with rationale per section.
- Hero spec: headline, subhead, primary CTA, secondary CTA, hero proof element. Headline must pass the 5-second test in [`07-decision-criteria.md`](./07-decision-criteria.md).
- Per-section spec using [`templates/section-spec.md`](./templates/section-spec.md), at minimum for hero + the next two below-the-fold sections.
- Mobile narrative — one paragraph on what the section flow becomes on a phone.
- Success metrics + measurement plan. Pre-register the metric before you ship.
- 7-tests checklist from [`07-decision-criteria.md`](./07-decision-criteria.md), each one filled in.

### Deliverable 2 — Lead Detail RFC v0.1

Use [`templates/lead-detail-rfc.md`](./templates/lead-detail-rfc.md). Required to include:

- The single primary SDR job this RFC optimizes for. Pick one. "Decide to dial in under 10 seconds" or "Send the audit-grounded opener in under 60 seconds" or similar.
- Current-state audit (cross-reference week-1 block inventory).
- Proposed information hierarchy. What is above the fold. What is one tap away. What is hidden behind progressive disclosure.
- Primary action / secondary actions / tertiary actions for the page.
- Per-block spec for at least the above-the-fold blocks.
- Empty states and edge cases: no audit yet, DNC flag set, archived, free-tier locked, free-tier sunset state.
- Mobile / sticky-HUD behavior.
- Telemetry events to emit. Follow the `lead_detail.*` naming pattern used today; do not invent a new namespace.
- Feature flag rollout plan (Shadow → Canary 10% → 50% → Full).
- 7-tests checklist from [`07-decision-criteria.md`](./07-decision-criteria.md), each one filled in.

### Where they land

- `proposals/<yyyy-mm-dd>-homepage-rfc-v0.1.md`
- `proposals/<yyyy-mm-dd>-lead-detail-rfc-v0.1.md`

Ping the reviewer when both are ready. Do not ship one and wait. Ship them together so the reviewer can see how they reinforce each other.

---

## Day-30 checkpoint

By the end of day 30 you should be able to answer these without looking anything up:

1. The canonical positioning sentence, word for word.
2. The six personas and which one your first homepage RFC is aimed at.
3. The 11 current homepage sections in order, with the job each one does.
4. At least 12 lead-detail v2 blocks, with the SDR job each one does.
5. The five banned phrases you most often had to edit out of your own drafts.
6. The seven decision-criteria tests, by name.
7. Three specific patterns you tore down from competitors and want to steal.
8. Five verbatim customer quotes you can lift into copy tomorrow.

If you cannot, go back and finish the missing week before moving on. The package does not unlock on a clock; it unlocks on coverage.

Next file: [`03-research-syllabus.md`](./03-research-syllabus.md).
