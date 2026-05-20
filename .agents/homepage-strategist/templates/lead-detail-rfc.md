# Lead Detail RFC — `<short title>`

> **How to use this template.** Copy this file into `proposals/<yyyy-mm-dd>-lead-detail-rfc-<slug>-v<n>.md`. Fill in every section top to bottom. If a section is "TBD", write "TBD because <reason>" so reviewers know it was thought about.
>
> **Read first:** [`01-role-and-mandate.md`](../01-role-and-mandate.md), [`05-infrastructure-primer.md`](../05-infrastructure-primer.md) (especially § 5 multi-tenant scope), [`07-decision-criteria.md`](../07-decision-criteria.md).

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

`<One sentence stating what changes and why.>`

---

## 2. Primary SDR job this RFC optimizes for

Pick exactly one. "Decide to dial in under 10 seconds" or "Send the audit-grounded opener in under 60 seconds" or similar. The job must be a verb, a time bound, and a measurable outcome.

- **Primary job:** `<job>`
- **Persona the job belongs to:** `<which persona from BUYER-PERSONA.md>`
- **Why this is the bottleneck now:** `<one paragraph, cite VoC>`

---

## 3. Current-state audit

Cross-reference your week-1 lead-detail block inventory (`research/synthesis/<yyyy-mm-dd>-lead-detail-state-of-the-page.md`).

Group the current ~30 v2 blocks by job. Mark redundancies, gaps, and friction.

| Block | SDR job today | Working? | Above fold? | Notes |
|---|---|---|---|---|
| `HeaderBar` | | | | |
| `WhyNowBlock` | | | | |
| `NextGestureBlock` | | | | |
| `RecommendedApproach` | | | | |
| `WebsiteSignalStrip` | | | | |
| `IntelligenceBriefCard` | | | | |
| `SpinBoard` | | | | |
| `MeddpiccChecklist` | | | | |
| `BantBars` | | | | |
| `WhoBlock` / `StakeholderCard` | | | | |
| `AccountBlock` / `AccountMapMini` | | | | |
| `HistoryBlock` / `RecentDialContext` | | | | |
| `ReviewIntelligenceSummary` / `ReviewVelocityBadge` / `ReviewTimelineMini` | | | | |
| `SisterLeadRow` / `ClosestWinCallout` / `CrossBranchInsightCallout` | | | | |
| `DispositionStrip` / `PipelineStageChip` / `QueueStrip` | | | | |
| `MobileStickyCTA` / `VoiceNoteFAB` | | | | |
| `PlanLockedBlock` / `PowerToolsLink` | | | | |
| (other) | | | | |

**Headline diagnosis:** `<one paragraph: what works, what does not, where the SDR loses time>`

---

## 4. Proposed information hierarchy

What is above the fold. What is one tap away. What is hidden behind progressive disclosure. What is removed.

### Above the fold (priority 1)
- `<Block>` — job — why above the fold
- `<Block>` — job — why above the fold

### One tap / one scroll away (priority 2)
- `<Block>` — job
- `<Block>` — job

### Progressive disclosure (priority 3)
- `<Block>` — when surfaced
- `<Block>` — when surfaced

### Removed / consolidated
- `<Block>` — reason
- `<Block>` — reason

**Hierarchy framework applied:** `<e.g. F-pattern, Miller's Law, progressive disclosure — from 04-growth-frameworks-library.md § G>`

---

## 5. Primary / secondary / tertiary actions

| Tier | Action | Where it lives | Trigger | Fitts/Hick check |
|---|---|---|---|---|
| Primary | (e.g. Dial) | Header bar + sticky shell | Always visible | Largest target, top-right |
| Primary alt (mobile) | (e.g. Dial) | `MobileStickyCTA` | Always visible | Thumb-reachable |
| Secondary | (e.g. Send opener) | Header bar | Always visible | Adjacent to primary |
| Secondary | (e.g. Voice note) | `VoiceNoteFAB` | Always visible | Mobile-first |
| Tertiary | (e.g. Archive / Discard / Edit) | More-actions menu | One tap | Hidden until needed |

---

## 6. Per-block specs

Use [`section-spec.md`](./section-spec.md) for each block that is new or substantially changed. Link the specs here.

- `<BlockName>`: `<link>`
- `<BlockName>`: `<link>`
- `<BlockName>`: `<link>`

---

## 7. Empty states and edge cases

For each, define what the user sees and what the page does.

| State | What the user sees | Component pattern to use |
|---|---|---|
| No audit yet (preliminary) | | `PreliminaryBanner` + skeleton blocks |
| Audit in progress (chunks arriving) | | `WebsiteIntelLazyPanel` pattern |
| Lead is DNC | | Banner + locked primary action |
| Lead is archived | | Read-only mode |
| Plan-locked feature (e.g. cross-branch insight on Solo tier) | | `PlanLockedBlock` |
| Free tier sunset state (legacy free user) | | Direct to upgrade path |
| Workspace-scope violation (e.g. lead from another workspace via shared URL) | | 404 (see [`.cursor/rules/multi-tenant-scope.mdc`](../../../.cursor/rules/multi-tenant-scope.mdc)) |
| Stale data warning (audit older than N days) | | Header chip |
| API/data error in one block | | Block-level error state, rest of page renders |

---

## 8. Mobile / sticky-HUD behavior

- Sticky shell composition on mobile: `<what stays pinned, what hides>`
- Mobile primary action: `<which CTA, label, trigger>`
- Voice-note FAB position and behavior: `<default position, dismissal>`
- Where blocks reorder vs desktop: `<list>`
- One thumb test (can the SDR drive the page one-handed?): `<pass / fail / fix>`

---

## 9. Telemetry events to emit

Follow the `lead_detail.*` naming convention. Add to the typed event catalog (not invented inline).

| Event | When fired | Properties | Already in catalog? |
|---|---|---|---|
| `lead_detail.opened` | (existing) | `leadId`, `workspaceId`, `tier` | Yes |
| `lead_detail.primary_action.clicked` | When primary CTA clicked | `action`, `leadId` | Yes / No (flag) |
| `lead_detail.<new_event>` | | | New — flag for catalog add |

Telemetry helper: [`src/lib/lead-detail/telemetry.ts`](../../../src/lib/lead-detail/telemetry.ts).

---

## 10. Feature flag rollout plan

New blocks ship behind a flag. Rollout sequence:

1. **Shadow** (instrumented, not visible) — week 1-2. Verify event firing.
2. **Canary 10%** — week 3. Watch metrics + qualitative feedback.
3. **Canary 50%** — week 4-5. Watch metric movement.
4. **Full rollout** — week 6.
5. **Flag removal** — week 8 (after one billing cycle of stability).

- **Flag name:** `<LEAD_DETAIL_*>`
- **Default state:** off
- **Kill criteria:** `<metric move below threshold, error rate above threshold, qualitative regressions>`
- **Rollback procedure:** flip flag off; no data migration.

See [`src/lib/feature-flags.ts`](../../../src/lib/feature-flags.ts) for existing flag patterns.

---

## 11. Multi-tenant scope notes

Required section. From [`.cursor/rules/multi-tenant-scope.mdc`](../../../.cursor/rules/multi-tenant-scope.mdc).

If this RFC reads or proposes new data, answer:

- [ ] Every new query is scoped by `workspaceId` (directly or via parent relation)?
- [ ] Any cross-lead read (sister leads, neighbors, comps, account) stays within caller's workspace?
- [ ] Any new field added to schema has `workspaceId` + index + cascade?
- [ ] `requireUser()` is the source of `workspaceId` (not request body / URL)?

If a "no", explain.

---

## 12. Success metrics + measurement plan

| Metric | Current baseline | Target | How measured | Decision rule |
|---|---|---|---|---|
| Time to first primary action on lead detail | | | | |
| % leads acted on within 24h of opening | | | | |
| Disposition completion rate | | | | |
| (other) | | | | |

**North Star alignment:** `<which metric, how>`

**Risk if metric does not move:** `<roll back via flag vs iterate>`

---

## 13. Decision criteria — 7 tests

From [`07-decision-criteria.md`](../07-decision-criteria.md).

- [ ] **1. 5-second test** — `<n-a (homepage test) — substitute: 5-second-on-lead test>` — `<one-line>`
- [ ] **2. 500-co test** — `<pass / fail>` — `<would a 500-co VP Sales tell their SDR to use this layout? evidence>`
- [ ] **3. SDR-30x test** — `<pass / fail>` — `<opened 30 leads, time to first dial decision: <N>s avg>`
- [ ] **4. FineDine BD test (or named analog: <name>)** — `<pass / fail>` — `<one-line>`
- [ ] **5. Voice test** — `<pass / fail>` — `<grep'd for banned terms: yes/no>`
- [ ] **6. Evidence test** — `<pass / fail>` — `<every claim cited: yes/no>`
- [ ] **7. Engineering test** — `<pass / fail>` — `<every change labeled on cost ladder: yes/no; multi-tenant scope addressed: yes/no>`

---

## 14. Open questions

- [ ]
- [ ]
- [ ]

---

## 15. Out-of-scope (explicitly not in this RFC)

-
-
