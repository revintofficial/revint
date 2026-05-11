# Lead Detail v2 — Phased Build Plan

> Source of truth: `research/sdr-brain-v2-lead-detail-RETHINK.md`.
> Companion context (do not re-litigate): `research/sdr-brain-v2-lead-detail-design-brief.md`.
> This document is a build plan. No code, no Figma. Phases, files, schema deltas, risks.

---

## 1. Plan TL;DR

Ten phases, in order: foundations → decision/evidence shell → surface SDR-Brain-v2 outputs that already exist → **V1 richness absorption** → the four missing jobs (snooze, queue, compare-to-wins, post-call) → multi-location → mobile-native pass → power-tools split → polish/observability → **review-volume trigger**. Rough total effort ≈ 1 XS + 1 S + 4 M + 4 L + 1 XL across the surface; the demo-able slice ships at end of **Phase 1** — a feature-flagged `/app/leads/[id]?v=2` route that shows the no-tabs vertical narrative reading the existing `next-action` endpoint, with the legacy 5-tab page untouched. Phase 2 wins the "wow" moment because BANT/ICP-dimensions/MEDDPICC/SPIN/stakeholders all become first-class without any schema.

**Binding constraint added in this revision: richness parity.** V1 surfaces ~12 customer-finding signals V2 currently drops (cached `LEAD_INTELLIGENCE_BRIEF` with `salesConfidence`, AI dossier markdown, full `WebsiteIntelligencePanel`, full `ReviewIntelligencePanel` with sentiment/KPIs/switch-signals/leadScore, `ReviewTimelineChart`, `RecommendedPackageCard`, `PersonalizedMessageCard`, `LeadMapView`, `IdentityRail` pipeline rows, social/directory badges from `discoveredLinks`, `SubNicheOverride`, `OutreachStepper`). An SDR opening V2 today finds fewer customers than on V1 even though V2 is structurally better — this is the founder's exact framing of the regression. **Phase 2.5** ("V1 richness absorption") closes that gap by folding every V1 signal into the 7 SDR blocks; the cookie-default flip waits on it. **Phase 8** makes "review volume" a first-class `LeadTriggerType` (today the queue-strip mock copy `WHY NOW: review streak` doesn't map to any real enum or worker rule) so the trigger detector emits surge/dip rows the same way `RATING_DROP` does.

---

## 2. Build philosophy

- **Ship the shell behind a flag before touching schema.** The structural difference (no tabs, vertical narrative, inline evidence chips) lands first reading the `next-action` route as-is. If the IA is wrong we find out in week 1, not week 6.
- **Richness parity is binding.** Every V1 component that surfaces a customer-finding signal MUST land on a V2 block in this plan — no signal silently dropped between V1 and V2. The "I built this for myself" → "fits the SDR market" gap closes only when an SDR opening V2 sees ≥ everything they'd see in V1, framework-shaped. The cookie-default flip waits on the §5.x V1 richness parity checklist passing 100%. Until Phase 2.5 ships, V2 is cookie-only even where it looks better.
- **Zero schema in phases 0–2.** Everything the rethink claims is already-derivable is verified before any migration. The only Phase 0–7 schema add (`Lead.snoozeUntilTriggerType`) waits for Phase 3. **Phase 8** adds two `LeadTriggerType` enum values (`REVIEW_VOLUME_SURGE`, `REVIEW_VOLUME_DIP`) — the full DDL footprint of this plan is therefore 1 column add + 2 enum values.
- **Polling shape stays the same.** `GET /api/leads/[id]/next-action` keeps returning `{ preliminary, final, triggers, insight, reasoningGraph, arbitrationRecords }`. The UI absorbs the morph; the server contract does not change in phase 1.
- **Deprecate by redirect, not by delete.** The legacy 5-tab page at `src/app/app/leads/[id]/page.tsx` stays mounted at the same URL until Phase 6. A single switch (workspace + cookie + URL `?v=2`) decides which surface renders. Old hash deep-links (`#workers`, `#outreach`, `#anchor-workers-top`) keep resolving after the cutover via a tiny client-side rewriter.
- **One aggregator endpoint, never N waterfalls.** Phase 1 introduces `GET /api/leads/[id]/decision-surface` early. Even when only a subset of fields is consumed, the contract is wide so phase 2/3/4 only add fields, never new endpoints.
- **Component reuse over rewrites.** `BantBars`, `MeddpiccChecklist`, `SpinBoard`, `StakeholderCard`, `VoiceNoteRecorder`, `ReasoningTraceExpandable` get re-skinned and re-parented; they do not get rewritten. The dropped components (`IcpScoreRing`, `TriggerChip`, `OpeningHookBlock`, `CommercialInsightCard`, `ObjectionAccordion`, `PipelineStageStepper`, `InsightApplicationRow`, `PowerToolDrawer`) get marked deprecated in phase 6 and deleted in phase 7.
- **No new BullMQ queues, no new Gemini-calling endpoints outside `src/lib/agent-workers/`.** The whole rethink is a UI-and-aggregator job. Phase-3 snooze and queue endpoints are pure Prisma reads/writes.

---

## 3. Backward-compat & feature flag strategy

### 3.1 Feature flag

- **Name:** `leadDetailV2` (kebab in env, camel in code).
- **Where it lives, in priority order:**
  1. URL override `?v=2` / `?v=1` — highest, per-tab (used by founder + designers + QA).
  2. Per-user cookie `leadac_lead_detail_v2=on|off` set by a settings toggle.
  3. Per-workspace `Workspace.featureFlags` JSON (already a column-family pattern in `prisma/schema.prisma`; verify before phase 0; if absent, store as a row in a `WorkspaceFeatureFlag` model — but DO NOT create that model in phase 0; first try a literal env-keyed allow-list).
  4. Env `LEAD_DETAIL_V2_DEFAULT=on|off` for global default.
- **Resolution helper:** new `src/lib/feature-flags.ts` exporting `isLeadDetailV2Enabled(session, searchParams)`. Server-side only. Imported by both the page server component and the (eventual) middleware redirect.
- **Plan gating interaction:** the flag does NOT bypass plan gates. A FREE workspace seeing `?v=2` still gets the v2 shell, but the locked surfaces inside (compare-to-wins, queue strip on PRO_TEAM) render their existing locked state.
- **Default-flip gate:** the env / cookie default for `leadDetailV2` stays `off` until Phase 2.5's richness parity checklist passes (`§5.x`). Internal allow-list (founder + designers + QA) overrides via `?v=2` from day 1, but external workspaces stay on legacy until V2 carries every customer-finding signal V1 does. This avoids a regression where SDRs find fewer customers on V2 than V1.

### 3.2 URL strategy

- **Same URL, two surfaces.** `/app/leads/[id]` keeps responding to `GET`. The route's server component reads the flag and either renders the legacy `<LegacyLeadDetailClient/>` (renamed from current default export) or `<LeadDetailV2Client/>`.
- **Hash deep links (legacy → v2):**
  - `#overview` → no-op (v2 has no tab; just scroll to top).
  - `#outreach` / `#anchor-sales-opportunity` → scroll to `NEXT GESTURE` block.
  - `#workers` / `#anchor-workers-top` → 301-style client redirect to `/app/leads/[id]/workers` once Phase 6 ships; until then, scroll to the "⚙ Power tools →" link.
  - `#reviews` → scroll to `HISTORY` block (reviews surface there).
  - `#website` → scroll to `WHY NOW` block (the audit chip lives there).
- **Mapping table** lives in `src/lib/lead-detail/legacy-hash-redirect.ts` (new, phase 1). Pure function used by a tiny `useEffect` in `LeadDetailV2Client`. Telemetry event `lead_detail.legacy_hash_consumed` fires once per session per hash so we can prune aliases later.

### 3.3 Rollback

- **Phases 0–2.5:** rollback = flip env / cookie. No DB rollback. No worker rollback. Phase 2.5's new companion endpoints (`/review-intel`, `/website-intel`) are additive — orphaning them is harmless.
- **Phase 3:** the only schema add (`Lead.snoozeUntilTriggerType` nullable) is forward-compatible — rollback means flipping the flag; the column stays unused.
- **Phase 6:** worker route split is a redirect, never a delete. The Workers content stays mounted under the old route (behind the flag-off branch) for one full release after `/leads/[id]/workers` is GA.
- **Phase 8:** the two new enum values (`REVIEW_VOLUME_SURGE`, `REVIEW_VOLUME_DIP`) are forward-compatible — rollback means turning off the detector rule; existing rows stay readable. UI fallback is the derived velocity badge from Phase 3, which is enum-independent.

---

## 4. Phases

### 4.0 Sequencing & parallelism

```
Phase 0 ── Phase 1 ── Phase 2 ── Phase 2.5 ──┬── Phase 3 ──┬── Phase 5 ── Phase 6 ── Phase 7 ── Phase 8
                                              └── Phase 4 ──┘
```

- **0 → 1 → 2 → 2.5** is strictly sequential; each is a hard prereq for the next. Phase 2.5 is the binding richness-parity gate — the cookie-default flip waits on it.
- **Phase 3 and Phase 4** can land in parallel branches once Phase 2.5 is merged. They touch disjoint blocks (NextGesture + queue vs Account block) and disjoint endpoints. If only one engineer is on this, sequence as `2.5 → 3 → 4`.
- **Phase 5 (mobile)** is gated on Phases 1–4 because it re-tests every block.
- **Phase 6 (workers split)** is independent of Phase 5 and can run concurrently.
- **Phase 7 (polish)** is the final convergence step — touches every block, includes the `EvidenceChip` rework that Phase 8 depends on.
- **Phase 8 (review-volume trigger)** is independent and can land any time after Phase 7 — the schema add is forward-compatible.

Kill criteria per phase (failing any of these stops the next phase from starting):
- **Phase 0:** flag flip changes 0 bytes of HTML on `?v=1`. Verified by HTML diff in CI.
- **Phase 1:** the 90-second walkthrough on a COLD seeded lead completes without entering a tab.
- **Phase 2:** aggregator round-trips ≤ 12 in the integration test; multi-tenant scope test passes; p95 ≤ 400ms hot DB on three reference fixtures.
- **Phase 2.5:** richness-parity Playwright test green — every V1 signal text on a seeded lead appears somewhere on V2; companion endpoints (`/review-intel`, `/website-intel`) workspace-scoped and ≤ 4 queries each.
- **Phase 3:** snooze "until trigger" actually un-snoozes when the trigger-detector cron writes a matching trigger row in a fixture; derived `ReviewVelocityBadge` renders on the right delta thresholds; `EvidenceChip` shows `windowDropStars` / `recentCount` / `priorCount` for `RATING_DROP` rows.
- **Phase 4:** sister-lead query returns 0 cross-workspace rows in the seeded multi-workspace fixture.
- **Phase 5:** Lighthouse mobile a11y ≥ 95 on the reference COLD lead.
- **Phase 6:** legacy `#workers` deep link still resolves to a power-tools render.
- **Phase 7:** every PostHog event in the catalog fires at least once during the 90-second walkthrough.
- **Phase 8:** detector emits `REVIEW_VOLUME_SURGE` and `REVIEW_VOLUME_DIP` on the seeded fixtures; queue-strip headline copy resolves cleanly to either type; snooze "until trigger" works with both new types.

---

### Phase 0 — Foundations

**Goal in one sentence.** Land the feature flag, the v2 route shell, the pipeline-stage hook, and motion/a11y primitives without changing any visible behavior.

**Demo-able outcome.** Flip a cookie, see an empty "Lead Detail v2 — coming soon" placeholder at `/app/leads/[id]`. Flip it back, see today's 5-tab page unchanged.

**Files to create.**
- `src/lib/feature-flags.ts` — `isLeadDetailV2Enabled(session, searchParams)` resolver.
- `src/lib/lead-detail/use-pipeline-stage.ts` — client hook returning `{ stage, isStaleWhyNow, expandRules }` from `Lead.pipelineStatus`. The expand-rules table from rethink §4.3 lives here as a constant.
- `src/components/app/lead-detail-v2/LeadDetailV2Client.tsx` — placeholder. Mounts header + a single `<div>Coming soon</div>` and the legacy hash-redirect effect.
- `src/components/app/lead-detail-v2/Block.tsx` — container primitive: `expanded | collapsed-stub | hidden`. AnimatePresence + `layout` prop. Implements the section-reorder + collapse-to-stub motion in one place so phases 1–4 just declare blocks.
- `src/components/app/lead-detail-v2/StickyShell.tsx` — header (sticky 56px) + main scroll area + bottom queue-strip slot. Phase 0 ships header only.
- `src/lib/lead-detail/legacy-hash-redirect.ts` — pure mapping function (table in §3.2).
- `src/__tests__/lead-detail/feature-flag.test.ts` — vitest unit covering URL > cookie > workspace > env precedence.
- `src/__tests__/lead-detail/legacy-hash-redirect.test.ts` — table-driven test of every legacy hash.

**Files to modify.**
- `src/app/app/leads/[id]/page.tsx` — split today's default export into `LegacyLeadDetailClient` (renamed) and a new server-component wrapper that reads the flag and picks. **No behavior change** for users on legacy.

**Schema deltas.** None.

**API additions/changes.** None.

**Worker additions/changes.** None.

**Test surface.** Two unit tests above. One Playwright smoke (`tests/e2e/lead-detail-flag.spec.ts`) that opens a known seeded lead with `?v=2` and asserts the placeholder, then with `?v=1` and asserts the existing 5-tab `<TabsList>` is in the DOM.

**Risk callouts.**
- **Multi-tenant scope:** the wrapper still calls `requireUser()` and resolves `workspaceId` before deciding the surface. The flag resolver itself does not query the DB in phase 0.
- **Latency:** flag resolution must be synchronous after `requireUser()`. No extra round-trip.
- **A11y baseline:** the placeholder must not introduce a new focus trap; legacy keyboard order is preserved.
- **i18n:** the placeholder string lives in the i18n catalog from day 1, even if it's one string (precedent for phases 1+).

**Rough effort.** XS.

**Definition of done.** Cookie flip swaps surfaces; tests green; legacy route bytes unchanged in the v=1 path; no production telemetry regression on `lead_detail.viewed`.

**What this phase explicitly does NOT do.** No new visible UI, no schema, no API, no change to NBA polling, no migration of any tab content into v2.

---

### Phase 1 — Decision/Evidence shell

**Goal in one sentence.** Replace the placeholder with the seven-block vertical narrative reading **only** the existing `next-action` endpoint, so the IA shift is measurable without any schema or API change.

**Demo-able outcome.** On `?v=2`: sticky header (with TIER badge wired from `Account.tier`) → `WHY NOW` block with inline evidence chips → `NEXT GESTURE` block with preliminary→final morph → five collapsed-stub blocks (`WHO`, `DISCOVERY`, `QUALIFICATION`, `HISTORY`, `ACCOUNT`) that expand to placeholders for now → "⚙ Power tools →" link top-right that navigates to `/app/leads/[id]?tab=workers&v=1` (interim until phase 6). The "✨ updated 18s ago" toast replaces the glow-on-final pattern. Mobile renders the one-screen-two-CTAs layout from rethink §4.5.

**Files to create.**
- `src/components/app/lead-detail-v2/HeaderBar.tsx` — back arrow, business name, sub-niche pill, TIER badge (reuses logic from `TierBadge`), pipeline stage chip + dropdown, Call/Email/Voice-note quick actions, kebab.
- `src/components/app/lead-detail-v2/WhyNowBlock.tsx` — single-line headline + urgency window + inline evidence-chip row.
- `src/components/app/lead-detail-v2/NextGestureBlock.tsx` — opener, don't-pitch list, pushback-rebuttal pair, action chips (Dial / Email / WhatsApp / Schedule / Snooze placeholder), version chip, "open full graph →" link. Wraps the existing `NbaCard` *content* but not its outer card; the card chrome is the `Block` primitive.
- `src/components/app/lead-detail-v2/EvidenceChip.tsx` — 12px badge + hover/tap card. Supports types `linkedin | review | audit | voice-note | prior-nba | contradiction`. Reads from `LeadTrigger.evidence` JSON, `Stakeholder.source`, `DealQualificationFact.sourceQuote`, `DiscoveryItem.evidence` — all already-existing fields. Phase 1 only consumes the trigger + arbitration shape.
- `src/components/app/lead-detail-v2/UpdatedToast.tsx` — replaces the glow-on-final. AnimatePresence, fades in for 4s when `final.id` changes, never blocks click.
- `src/components/app/lead-detail-v2/CollapsedStub.tsx` — one-line stub renderer used by all five reorder-able blocks.
- `src/components/app/lead-detail-v2/PowerToolsLink.tsx` — anchor button top-right; phase 1 points to legacy `?tab=workers&v=1`, phase 6 swaps target.
- `src/lib/lead-detail/use-decision-surface.ts` — client hook. Phase 1 it just wraps the existing `useNextAction` hook and returns the same shape under a stable name. The wrapper exists so phase 2 swap-in to the aggregator endpoint is one-line.
- `src/__tests__/lead-detail/why-now-evidence-chip.test.tsx` — render-only check that `LeadTrigger[]` produces the right chip count and types.

**Files to modify.**
- `src/components/app/lead-detail-v2/LeadDetailV2Client.tsx` — replace placeholder with the 7-block layout. Wires the expansion rules from `use-pipeline-stage`.
- `src/app/app/leads/[id]/page.tsx` — no functional change; just imports the new client and adds the v2 mount path. Legacy untouched.
- `src/components/app/nba/NbaCard.tsx` — extract the content render into a `<NbaContent>` sub-component so v2 can reuse without the card chrome. Legacy stays the same default export.

**Schema deltas.** None.

**API additions/changes.** None. `GET /api/leads/[id]/next-action` is the only data source.

**Worker additions/changes.** None.

**Test surface.**
- Component test: stage-driven expand/collapse — given `pipelineStatus = COLD`, `WHO` is expanded, `DISCOVERY` is a stub.
- Component test: preliminary→final morph asserts no layout shift (use `getBoundingClientRect` snapshots).
- Playwright: navigate two known seeded leads (one COLD, one REPLIED) on `?v=2`, screenshot for visual diff.
- Playwright a11y: tab order through header → why-now → next-gesture → block stubs is linear, all interactive elements have an accessible name.

**Risk callouts.**
- **Latency:** if the existing `next-action` poller is broken in any way, v2 regresses worse than legacy because the whole hero depends on it. Phase 1 adds a "preliminary is shippable" banner if `final` hasn't arrived in 25s — the rethink's §3.10(b).
- **Plan gating:** v2 must respect the same NBA gating that legacy does (FREE has BANT-only preliminary). Confirm by reading the same response.
- **Mobile:** the one-screen-two-CTAs layout must hold for iPhone 14 Pro (390×844) and a Pixel 7 (412×915) without scroll to dial. CSS dynamic viewport units only; no fixed pixels for the action row.
- **A11y:** the inline evidence chip's source-quote tooltip is hover/focus on desktop, tap on mobile. Tap dismisses on second tap (rethink §9 Q4 — this plan resolves it as: tap = open slide-up footnote band; tap-outside or ESC dismisses).
- **i18n:** every label in the eight new components uses the existing `t()` helper. Add EN/TR slots from day 1; defer translation to phase 7.
- **Layout shift:** AnimatePresence with `layout` prop only on the Block container — never on children — so the morph never reflows ancestors.

**Rough effort.** L.

**Definition of done.** A flag-gated v2 page that passes a 90-second walkthrough on a COLD lead and a REPLIED lead end-to-end without entering a tab, on desktop and on iPhone 14 Pro. Legacy bytes still unchanged on `?v=1`. PostHog `lead_detail.v2.viewed` and `lead_detail.legacy_hash_consumed` events fire.

**What this phase explicitly does NOT do.** No SDR-Brain-v2 surfaces beyond what `next-action` already returns. No BANT bars, no MEDDPICC, no SPIN, no stakeholder cards, no sister-lead nav, no snooze CTA wiring, no queue strip. No `decision-surface` aggregator yet.

---

### Phase 2 — Surface SDR-Brain-v2 outputs that already exist

**Goal in one sentence.** Wire BANT, ICP-dimensions, MEDDPICC, SPIN, Stakeholders, predicted/real objection diff into the v2 blocks using read-time aggregation only — zero schema, zero new workers.

**Demo-able outcome.** Expanded `QUALIFICATION` block shows ICP fit (with revenue/staff/stack/geo dimension bars derived from `IdealCustomerProfile.weights × Lead.*`), BANT 4-bar with always-visible evidence chips, MEDDPICC 7-row checklist (auto-creating `WatchlistItem` if needed — see §5 / Q9 from the rethink). Expanded `DISCOVERY` block shows the 4-column SPIN board fed by `DiscoveryItem[]`. Expanded `WHO` block renders the stakeholder grid with champion/blocker/economic-buyer rosettes. `HISTORY` shows the predicted-vs-real objection diff.

**Files to create.**
- `src/app/api/leads/[id]/decision-surface/route.ts` — single aggregator. Returns `{ leadCore, nba, bant, icpDimensions, stakeholders, dealQualification, latestDiscovery, recentObjections, accountSummary, intelligenceBrief, recommendedPackage, personalizedFirstMessage, reviewIntelSummary, websiteIntelSummary, reviewVelocity, discoveredLinks, subNicheState, dossierStub, pipelineState }`. `requireUser()` then `workspaceId`-scoped reads. Read shape is the union of every consumer in phase 2 + 2.5; phase 3/4 only add new fields, never new routes.

  **Summary fields** (added to absorb V1 richness without inflating round-trips):
  - `intelligenceBrief: { runId, generatedAt, salesConfidence, headline, painPoints[], whyGoodTarget } | null` — read off the cached `LEAD_INTELLIGENCE_BRIEF` `AgentRun.output`. Same logic as legacy `src/app/api/leads/[id]/intelligence-brief/route.ts`. Keep the "open full brief →" deep-link payload intact for the Phase 7 reasoning route.
  - `recommendedPackage: { slug, displayName, priceCents, reasonCodes[] } | null` — already resolved on the legacy `GET /api/leads/[id]` path; lift the resolution helper into a shared module so both routes share it.
  - `personalizedFirstMessage: string | null` — from `salesOpportunity.personalizedFirstMessage`.
  - `reviewIntelSummary: { leadScore, summary, sentimentBreakdown, weaknessKpisTop3, strengthKpisTop3, switchSignalsTop3, reviewsAnalyzedCount, lastAnalyzedAt } | null` — projection of `ReviewAnalysis`; trim arrays to top-3 server-side.
  - `websiteIntelSummary: { auditScore, hasBookingSystem, bookingProvider, loadTimeMs, securityScore, performanceScore, schemaPresent, lastAuditedAt } | null` — projection of `WebsiteAudit`.
  - `reviewVelocity: { recentCount30d, priorCount30d, deltaPct, recent30dAvgRating, prior30dAvgRating, ratingDelta }` — derived **read-time** in the route from `GoogleReview[]` (no schema). Same window math as the trigger-detector's Rule A so the badge UI agrees with the future trigger row from Phase 8.
  - `discoveredLinks: { socials: { platform, url }[], directories: { name, url }[] }` — already present on legacy `GET /api/leads/[id]` (merged from latest `AgentRun` outputs).
  - `subNicheState: { current, override, available[] }` — current shape of `GET /api/leads/[id]/sub-niche`; folded in so the header kebab override doesn't need a second fetch on first paint.
  - `dossierStub: { hasDossier, lastGeneratedAt, summarySnippet }` — full markdown stays lazy under `POST /api/leads/[id]/explain`.
  - `pipelineState: { crawl, analyze, outreach, dnc }` — chip-row replacement for the legacy `IdentityRail`.
- `src/lib/icp-fit/dimensions.ts` — pure function `computeIcpDimensions(lead, icpDoc)`. Returns `{ revenue, staff, stack, geo, vertical, total }` each `0..100`. No persistence. Tested against fixtures.
- `src/components/app/lead-detail-v2/QualificationBlock.tsx` — composes ICP bars, BANT bars, MEDDPICC checklist.
- `src/components/app/lead-detail-v2/DiscoveryBlock.tsx` — SPIN board + voice-note FAB anchor.
- `src/components/app/lead-detail-v2/WhoBlock.tsx` — stakeholder grid (3-col desktop, horizontally-paged mobile).
- `src/components/app/lead-detail-v2/HistoryBlock.tsx` — activity timeline + predicted-vs-real objection diff renderer.
- `src/components/app/lead-detail-v2/IcpDimensionBars.tsx` — replaces `IcpScoreRing` (drop list, rethink §6).
- `src/components/app/lead-detail-v2/PredictedVsRealObjections.tsx` — renders three buckets: predicted-and-real (rebuttal landed), predicted-not-real (skipped), real-only (no rebuttal yet, with inline `[+ rebuttal]` capture).
- `src/__tests__/lead-detail/icp-dimensions.test.ts` — matrix of `IdealCustomerProfile.weights` × `Lead` fixtures.
- `src/__tests__/lead-detail/decision-surface-route.test.ts` — integration: workspace A cannot read lead from workspace B (multi-tenant scope guard).

**Files to modify.**
- `src/lib/lead-detail/use-decision-surface.ts` — swap the underlying fetch from `next-action` to `decision-surface`. Hook signature stays.
- `src/components/app/lead-detail-v2/LeadDetailV2Client.tsx` — wire the four newly-real blocks.
- `src/components/app/voice-notes-panel.tsx` — split into `<VoiceNoteRecorderFAB>` (global, used by v2) + the legacy panel (used by v1). Both share state via the existing hook.
- `src/lib/sdr-brain/buying-readiness.ts` — no behavior change; export the existing derive function under a stable named export so the aggregator can call it.
- Re-skin (no rewrite): `BantBars`, `MeddpiccChecklist`, `SpinBoard`, `StakeholderCard`. Drop hover-only tooltips in favor of always-visible inline evidence chips per the §4.4 "no Why? link" rule. The chip implementation is shared from phase 1.

**Schema deltas.** None.

**API additions/changes.**
- New: `GET /api/leads/[id]/decision-surface`. Workspace-scoped via `requireUser()`. Returns the union shape above (now including richness summaries). Cache headers: `Cache-Control: private, max-age=0, must-revalidate`. Latency budget: **≤ 400ms p95** on a hot DB (raised from 250ms because the union absorbs V1 richness — full V1 payloads stay lazy under Phase 2.5 companion endpoints, so this is the ceiling, not a floor).
- One side-effect call: when the aggregator sees `dealQualification = null` for a non-COLD lead, it auto-creates a `WatchlistItem` per rethink Q9. This write is `workspaceId`-scoped and idempotent (unique on `(workspaceId, leadId)`). If the unique already exists, the route is a pure read.

**Worker additions/changes.** None.

**Test surface.**
- Integration: aggregator returns the right shape for COLD / REPLIED / WON fixtures; multi-tenant guard test (workspace A vs B); auto-watchlist-on-first-fact behavior.
- Component: each of the four new blocks renders empty/loading/populated states.
- Playwright: walk a REPLIED lead, expand QUALIFICATION, click a BANT evidence chip, see the source-quote drawer, dismiss with ESC.
- Visual regression: SPIN board + MEDDPICC checklist on desktop and iPhone 14 Pro.

**Risk callouts.**
- **Multi-tenant scope:** EVERY query in the aggregator (`Lead`, `Account`, `LeadTrigger`, `Stakeholder`, `DealQualification`, `DealQualificationFact`, `DiscoverySession`, `DiscoveryItem`, `Objection`, `LeadNextAction`, `WatchlistItem`, `IdealCustomerProfile`, `ReviewAnalysis`, `GoogleReview`, `WebsiteAudit`, `SalesOpportunity`, `AgentRun`) MUST include `workspaceId` in the `where` clause (or be reachable through a parent relation that does). Per `multi-tenant-scope.mdc`. Audit checklist embedded in the route header comment.
- **Generated Prisma client:** import paths are `@/generated/prisma/client` only. No `@prisma/client`.
- **Latency:** the union shape risks N+1. The aggregator batches via `Prisma.$transaction([...])` of read promises and uses `select` projections (not `include`) for relations we summarize, to avoid pulling full rows when we only render top-3 KPIs. Budget: **≤ 400ms p95**. Round-trip ceiling: ≤ 12 in the integration test (was ≤ 8). `reviewVelocity` derivation reuses the same `GoogleReview` rows fetched for the BANT timing input — it does not add a query.
- **Plan gating:** MEDDPICC + SPIN are PRO+ surfaces. FREE workspaces see locked stubs with upgrade CTAs. Plan check uses `getPlan(workspaceId)` from `src/lib/plans.ts`.
- **A11y:** ICP dimension bars get text labels in addition to color; MEDDPICC status colors get icons too (color-blind safe per design brief §10).
- **i18n:** SPIN/MEDDPICC dimension names are user-facing. EN + TR slots required.
- **Mobile:** SPIN board collapses to a 4-section vertical accordion below 640px. MEDDPICC stays a 7-row vertical list (rethink §4.7).

**Rough effort.** L.

**Definition of done.** All five SDR-Brain-v2 surfaces (BANT, ICP-dimensions, MEDDPICC, SPIN, Stakeholders) are visible without ever entering a tab. Aggregator route is workspace-scoped (test proves it). Auto-`WatchlistItem` creation works. Locked-state for FREE renders with copy + upgrade CTA. Aggregator round-trips ≤ 12, p95 ≤ 400ms. Summary fields (`intelligenceBrief`, `recommendedPackage`, `personalizedFirstMessage`, `reviewIntelSummary`, `websiteIntelSummary`, `reviewVelocity`, `discoveredLinks`, `subNicheState`, `dossierStub`, `pipelineState`) are typed and present in the response — the UI to render them lands in Phase 2.5.

**What this phase explicitly does NOT do.** No block UX changes that consume the new summary fields (Phase 2.5). No snooze, no queue strip, no compare-to-wins, no post-call disposition strip, no multi-location nav, no power-tools route split. No new companion endpoints — those land in Phase 2.5.

---

### Phase 2.5 — V1 richness absorption

**Goal in one sentence.** Every V1 customer-finding signal lands on a V2 block, framework-shaped — no signal silently dropped between V1 and V2; this is the cookie-default-flip gate.

**Demo-able outcome.** Open any seeded lead on `?v=2` and the SDR sees ≥ everything V1's hero/tabs surface, just folded into the 7 blocks: header kebab can override sub-niche; WHY NOW shows a site-signal chip strip; NEXT GESTURE has a "Recommended approach" subsection with the package + personalized first message; QUALIFICATION leads with the Intelligence Brief inline card (`salesConfidence`, headline, why-good-target); WHO carries per-stakeholder online-presence strips; DISCOVERY exposes the "AI dossier →" lazy expand; HISTORY leads with a "Review intelligence" sub-block (KPIs, sentiment, switch signals, leadScore) and lazy-loads the full review timeline + raw rows; ACCOUNT renders the map mini + pipeline state chip row.

**Files to create.**
- `src/components/app/lead-detail-v2/ReviewIntelligenceSummary.tsx` — sub-block in `HistoryBlock`. Renders top-3 weakness/strength KPIs + sentiment ring + `leadScore` + switch signals from `decision-surface.reviewIntelSummary`. "Open full →" expands with lazy fetch.
- `src/components/app/lead-detail-v2/WebsiteSignalStrip.tsx` — chip row inside `WhyNowBlock` reading `decision-surface.websiteIntelSummary` (security/perf/schema/booking).
- `src/components/app/lead-detail-v2/RecommendedApproach.tsx` — collapsible subsection inside `NextGestureBlock`. Renders the recommended package + personalized first message with copy-to-clipboard.
- `src/components/app/lead-detail-v2/IntelligenceBriefCard.tsx` — top-of-block card inside `QualificationBlock` reading `decision-surface.intelligenceBrief`. "Open full brief →" deep-links to a Phase 7 reasoning route once it ships.
- `src/components/app/lead-detail-v2/DossierExpand.tsx` — "AI dossier →" button inside `DiscoveryBlock`. On click: lazy-load `POST /api/leads/[id]/explain` (existing) for markdown + `GET /api/leads/[id]/dossier-sources` (existing) for source drawer. Renders `DossierMarkdown` re-skinned.
- `src/components/app/lead-detail-v2/ReviewTimelineMini.tsx` — embedded chart in the expanded `HistoryBlock`. Lazy-fetches via the new `/review-intel` endpoint and renders a stacked-bar volume-over-time chart (re-skin of legacy `ReviewTimelineChart`).
- `src/components/app/lead-detail-v2/AccountMapMini.tsx` — small map view inside `AccountBlock` reading `lead.sourceLat`/`lead.sourceLng`. Re-skin of legacy `LeadMapView`.
- `src/components/app/lead-detail-v2/PipelineStateChips.tsx` — chip row inside `AccountBlock` reading `decision-surface.pipelineState` (crawl / analyze / outreach / dnc).
- `src/components/app/lead-detail-v2/StakeholderOnlinePresence.tsx` — small icon strip inside `StakeholderCard` reading filtered `decision-surface.discoveredLinks.socials`.
- `src/components/app/lead-detail-v2/SubNicheOverrideMenu.tsx` — Radix popover triggered by a kebab item in `HeaderBar`. Bound to `PATCH /api/leads/[id]/sub-niche`. Reads `subNicheState` from decision-surface; revalidates SWR on save.
- `src/app/api/leads/[id]/review-intel/route.ts` — NEW companion endpoint. Returns `{ analysis, reviewsByMonth: { month, count, avgRating }[], recentReviews: GoogleReview[20] }`. `requireUser()` then `workspaceId`-scoped. Lazy-fired only when HISTORY expands.
- `src/app/api/leads/[id]/website-intel/route.ts` — NEW companion endpoint. Returns the full `WebsiteAudit` shape + the legacy ad-hoc content-check / website-search bridge. `requireUser()` then `workspaceId`-scoped. Lazy-fired only when WHY NOW or HISTORY's full website panel expands.
- `src/lib/lead-detail/recommended-package.ts` — pure helper extracting the resolution logic from the legacy `GET /api/leads/[id]` path. Used by both routes.
- `src/__tests__/lead-detail/decision-surface-richness.test.ts` — integration: aggregator returns the 10 new summary fields with sane shapes for COLD / REPLIED / WON fixtures.
- `src/__tests__/lead-detail/review-intel-route.test.ts` — multi-tenant guard + plan gating + query-count ≤ 4.
- `src/__tests__/lead-detail/website-intel-route.test.ts` — multi-tenant guard + plan gating + query-count ≤ 4.
- `tests/e2e/lead-detail-richness-parity.spec.ts` — Playwright. Loads V1 (`?v=1`) and V2 (`?v=2`) on the same seeded lead. For each item in the V1 richness parity checklist (§5.x), asserts the corresponding text/chip/badge appears in the V2 DOM.

**Files to modify.**
- `src/app/api/leads/[id]/decision-surface/route.ts` — implement the 10 new summary projections from Phase 2's typed response.
- `src/lib/lead-detail/use-decision-surface.ts` — extend the typed return shape; no behavior change for existing consumers.
- `src/components/app/lead-detail-v2/HeaderBar.tsx` — add "Override sub-niche" + "Re-run pipeline" kebab items.
- `src/components/app/lead-detail-v2/WhyNowBlock.tsx` — render `WebsiteSignalStrip` below the trigger chips.
- `src/components/app/lead-detail-v2/NextGestureBlock.tsx` — add `RecommendedApproach` subsection (collapsed by default, expandable).
- `src/components/app/lead-detail-v2/QualificationBlock.tsx` — render `IntelligenceBriefCard` above BANT bars.
- `src/components/app/lead-detail-v2/WhoBlock.tsx` / `StakeholderCard.tsx` — render `StakeholderOnlinePresence` per card.
- `src/components/app/lead-detail-v2/DiscoveryBlock.tsx` — wire `DossierExpand`.
- `src/components/app/lead-detail-v2/HistoryBlock.tsx` — wire `ReviewIntelligenceSummary` (always-visible) + `ReviewTimelineMini` (expand-on-demand).
- `src/components/app/lead-detail-v2/AccountBlock.tsx` — wire `AccountMapMini` + `PipelineStateChips`.

**Schema deltas.** None. Every field already exists on `Lead`, `Account`, `WebsiteAudit`, `ReviewAnalysis`, `GoogleReview`, `SalesOpportunity`, `AgentRun`.

**API additions/changes.**
- New: `GET /api/leads/[id]/review-intel`. Workspace-scoped. p95 ≤ 200ms. Lazy-fired.
- New: `GET /api/leads/[id]/website-intel`. Workspace-scoped. p95 ≤ 150ms. Lazy-fired.
- Extended: `GET /api/leads/[id]/decision-surface` populates the 10 new summary fields declared in Phase 2.
- Reused (no changes): `POST /api/leads/[id]/explain`, `GET /api/leads/[id]/dossier-sources`, `PATCH /api/leads/[id]/sub-niche`, `POST /api/leads/[id]/pipeline-rerun`.

**Worker additions/changes.** None.

**Test surface.**
- 3 new integration tests above.
- 1 new richness-parity Playwright spec.
- Component tests per new sub-component (loading / locked / populated).
- Visual diff per affected V2 block (before / after richness absorption).

**Risk callouts.**
- **Multi-tenant scope** on the two new companion routes. Per `multi-tenant-scope.mdc`, every Prisma `where` includes `workspaceId` (or is reachable through `lead: { workspaceId }`).
- **Plan gating:** `personalizedFirstMessage`, full review intel (timeline + raw rows), full website intel = PRO+. FREE shows summaries with locked CTAs. `intelligenceBrief.headline` + `recommendedPackage.slug` are FREE-friendly.
- **Latency:** lazy companions fire only on block expand; never on first paint. The aggregator p95 ≤ 400ms is a ceiling — test asserts on 3 reference fixtures.
- **A11y:** new chip strips and inline cards keep the existing `<h2>` per block; no new focus traps. `RecommendedApproach`'s copy-button announces via `aria-live="polite"` after copy.
- **i18n:** new strings ("Recommended approach", "AI dossier", "Review intelligence", "Site signal", "Online presence", "Override sub-niche", "Re-run pipeline", "Pipeline state", "Open full brief →") in EN + TR catalogs from day 1.
- **Mobile:** `WebsiteSignalStrip` collapses to 2 columns under 640px. `IntelligenceBriefCard` truncates `whyGoodTarget` to 2 lines with "more →" expand.
- **No richness drop:** every legacy V1 panel section that the user actually clicked into in PostHog over the last 30 days has a corresponding V2 surface. The richness-parity Playwright test enforces this.

**Rough effort.** L. (Largest phase in the plan after Phase 2.)

**Definition of done.** A seeded lead opened on `?v=2` shows every V1 signal across the 7 blocks. Companion endpoints workspace-scoped (tests prove it). Visual-parity Playwright test green on COLD / REPLIED / WON fixtures. After 2.5 ships, the cookie default for v2 can flip on without losing customer-finding power. Richness-parity checklist (§5.x) is 100% green.

**What this phase explicitly does NOT do.** No new SDR frameworks (BANT/MEDDPICC/SPIN already landed in Phase 2). No snooze / queue / disposition (Phase 3). No multi-location (Phase 4). No mobile re-pass (Phase 5). No power-tools split (Phase 6). No reasoning route or perf budget (Phase 7). No review-volume trigger (Phase 8). The deprecation of the legacy 5-tab page is NOT in 2.5 — it stays a flag-off branch through Phase 7+1.

---

### Phase 3 — The four missing jobs

**Goal in one sentence.** Land snooze (with the "until trigger" novel option), the queue-of-3 strip, compare-to-similar-wins, and one-gesture post-call capture — the four jobs the brief misses entirely.

**Demo-able outcome.**
- Snooze CTA in `NextGestureBlock` opens a 5-option dropdown (1d / 3d / 1w / custom / until trigger). Selecting "until trigger" prompts for the trigger type. After tap, the lead disappears from today's queue; queue strip auto-advances.
- Bottom-sticky queue strip shows `Today 3/12 ‹ prev ⏻ snooze ✓ done next ›` + a `NEXT: Maido Bar ★ TIER_1 · WHY NOW: rating drop -0.6★ / 30d · ETA 48s` preview line. (The `WHY NOW` value is sourced from the next lead's top `LeadTrigger.type` + `evidence.impactPrediction` — no fake mock copy. Real `LeadTriggerType` only; if no trigger has fired, the line falls back to `WHY NOW: queued`.) Pressing `next` preloads the next lead.
- A small `ReviewVelocityBadge` pill appears inside `WhyNowBlock` when `decision-surface.reviewVelocity.deltaPct ≥ +50%` (📈 "+X% reviews / 30d") or `≤ -30%` (📉 "-X% reviews / 30d"). UI-only signal — no enum, no schema, no detector change. Phase 8 will pair this with a real `REVIEW_VOLUME_SURGE` / `_DIP` trigger row so the badge and the chip agree.
- `EvidenceChip` for trigger-family chips now renders structured numeric evidence the detector already writes: `windowDropStars`, `recentCount`, `priorCount`, `kpis[].label/count`, `matchedCodes[]`. Today these fields are persisted to `LeadTrigger.evidence` JSON but the chip drops them. Cross-cutting fix that enriches every `RATING_DROP`, `BAD_SERVICE_REVIEWS`, `MENU_REDESIGN_SIGNAL`, `DELIVERY_EXPANSION` chip in WHY NOW.
- After a `Dial` tap, returning to the page within 5 minutes shows a 4-chip disposition strip overlay (Connected / Voicemail / No-answer / Wrong-#) — one tap persists.
- When MEDDPICC ≥ 4/7 ✓ AND a winning insight exists for the same `nicheSlug` + trigger family, an "🏆 Closest win:" callout appears at the top of the `HISTORY` block.

**Files to create.**
- `src/app/api/leads/[id]/snooze/route.ts` — `POST { until: ISO } | { triggerType: LeadTriggerType, maxHorizonDays: 90 }`. Workspace-scoped. Sets `Lead.snoozeUntil` and (optionally) `Lead.snoozeUntilTriggerType`. The 90-day cap auto-`DROP`s expired snoozes via the existing nightly cleanup cron (extension, not new queue).
- `src/app/api/leads/queue/route.ts` — `GET ?cursor=<leadId>&take=3&assignedToUserId=<self>`. Returns `{ items, totalToday, doneToday }`. Sorted by `nextActionDueAt asc nulls last, salesConfidence desc`. Filters: workspace, assignedTo (per-rep, per rethink Q1), not archived, not discarded, `snoozeUntil` null or past.
- `src/app/api/leads/[id]/dispositions/route.ts` — already mounted? Re-check: `src/app/api/leads/[id]/log-call/route.ts` exists and writes activity rows; verify whether it accepts a `disposition` field. If yes, reuse and only add a thin wrapper. If no, this file lands here. Either way, no new BullMQ queue: write `Lead.lastDisposition` + emit `disposition_logged` (existing event).
- `src/components/app/lead-detail-v2/QueueStrip.tsx` — bottom-sticky strip; `prev / done / snooze / next`; preloads next lead via `prefetch`.
- `src/components/app/lead-detail-v2/SnoozeMenu.tsx` — dropdown rendered inside `NextGestureBlock`. Six options. The "until trigger" option opens a sub-popover with the `LeadTriggerType` enum.
- `src/components/app/lead-detail-v2/DispositionStrip.tsx` — 4-chip bottom overlay; appears via the `<RecentDialContext>` provider when `now - lastDialAt < 5min`.
- `src/components/app/lead-detail-v2/RecentDialContext.tsx` — tracks "rep tapped Dial in this session" timestamp. localStorage-backed.
- `src/components/app/lead-detail-v2/ClosestWinCallout.tsx` — pure UI, fed by aggregator.
- `src/lib/lead-detail/closest-win.ts` — pure function `findClosestWin(lead, insightPerformance, sisterLeads)`. Reads `InsightPerformance.won > 0 AND triggerType IN (lead.triggers) AND segmentTier = lead.tier`. No persistence.
- `src/components/app/lead-detail-v2/ReviewVelocityBadge.tsx` — small pill rendered inside `WhyNowBlock` when `decision-surface.reviewVelocity.deltaPct ≥ +50%` or `≤ -30%`. Pure presentational; no fetch. Reads from the existing aggregator. UI-only — Phase 8 pairs it with a real trigger row.
- `src/lib/lead-detail/review-velocity.ts` — pure shared helper. Single source of truth for the rolling-window math (last-30d vs prior-30d count + avg rating). Used by (a) the aggregator's `reviewVelocity` derivation, (b) `ReviewVelocityBadge` thresholds, and (c) Phase 8's `trigger-detector` rule. Guarantees badge ↔ trigger agreement (per R20 mitigation).
- `src/lib/lead-detail/queue-headline.ts` — pure helper that maps a `Lead` + its top `LeadTrigger` to the queue-strip `WHY NOW: …` string. Returns `"queued"` when no trigger fired. Used by `QueueStrip.tsx`. Tested against the full `LeadTriggerType` enum.
- `src/__tests__/lead-detail/snooze-route.test.ts` — workspace scope, "until trigger" cap to 90d, idempotent re-snooze.
- `src/__tests__/lead-detail/queue-route.test.ts` — per-rep scope, snoozed-out filter, sort order.
- `src/__tests__/lead-detail/closest-win.test.ts` — tier × trigger fixture matrix.
- `src/__tests__/lead-detail/queue-headline.test.ts` — every `LeadTriggerType` enum value resolves to a non-empty headline; missing trigger → `"queued"`.
- `src/__tests__/lead-detail/review-velocity-badge.test.tsx` — threshold matrix (-30% / 0 / +50% / +120%) renders correct pill or no pill.

**Files to modify.**
- `src/app/api/leads/[id]/decision-surface/route.ts` — extend response with `closestWin`, `queuePosition`, `recentDialAt`.
- `src/components/app/lead-detail-v2/StickyShell.tsx` — wire the bottom queue-strip slot.
- `src/components/app/lead-detail-v2/QueueStrip.tsx` — consume `queue-headline.ts` so the preview line shows a real trigger ("rating drop -0.6★ / 30d"), not a hard-coded mock string.
- `src/components/app/lead-detail-v2/NextGestureBlock.tsx` — add Snooze CTA inline.
- `src/components/app/lead-detail-v2/WhyNowBlock.tsx` — render `ReviewVelocityBadge` next to the trigger-chip row.
- `src/components/app/lead-detail-v2/EvidenceChip.tsx` — extend the trigger-evidence renderer to surface structured numeric evidence: `windowDropStars`, `recentCount`, `priorCount`, `kpis[].label/count`, `matchedCodes[]`. Today these fields are persisted in `LeadTrigger.evidence` JSON but never displayed. Backward-compatible: chips with only `quote`/`url` keep their current rendering. The Phase 7 `ClaimWithEvidence` rework reuses this renderer.
- `src/workers/cron-cleanup.ts` (or wherever the nightly cleanup runs — verify path; if absent, the cleanup runs as part of the existing `agent-runs` queue with a timer trigger). Extension only, no new queue.
- `prisma/schema.prisma` — add `Lead.snoozeUntilTriggerType: LeadTriggerType?`. Single nullable column. `npm run db:push` in dev; in prod we treat as a normal Prisma migration via the existing flow.

**Schema deltas.**
- `Lead.snoozeUntilTriggerType: LeadTriggerType?` — the **only** schema add in the entire plan. Nullable, no default, no index needed (read-time scan is fine; trigger-detector cron already iterates leads with `snoozeUntil != null`).
- New `@@index([workspaceId, snoozeUntilTriggerType])` only if the trigger-detector cron measurably slows down. Add reactively, not preemptively.

**API additions/changes.**
- `POST /api/leads/[id]/snooze` — new.
- `GET /api/leads/queue` — new.
- `POST /api/leads/[id]/dispositions` — new IF `log-call` doesn't already cover it; otherwise extend `log-call` shape additively.
- `GET /api/leads/[id]/decision-surface` — extended fields, additive only.

**Worker additions/changes.**
- **No new BullMQ queue.** The trigger-detector that nulls `snoozeUntil` when a fresh `LeadTrigger` writes is an extension of the existing trigger-detector worker (`src/lib/agent-workers/trigger-detector.ts`). On each new trigger write, post-hook clears matching `Lead.snoozeUntil` rows where `snoozeUntilTriggerType = newTrigger.type AND workspaceId = workspaceId`.
- **No new Gemini endpoint.** All four jobs are pure Prisma I/O.

**Test surface.**
- All three new route integration tests (workspace scope is the bug class to catch).
- Component test: snooze "until trigger" cap to 90d.
- Component test: disposition strip appears only within the 5-min window.
- Playwright: full 90-second flow from rethink §7.2 — Sarah opens lead, dials, drops voice note, taps disposition, queue auto-advances.

**Risk callouts.**
- **Multi-tenant scope:** queue endpoint is the highest-risk new query in the whole plan. Test catches workspace-A queue ever returning workspace-B leads.
- **Plan gating:** queue strip is a PRO+ surface (FREE has 50 leads/month, no need for pacing). FREE sees a static "Done — start your day" string instead. Snooze is FREE-friendly.
- **Race:** two reps in PRO_TEAM tap `done` on the same lead — see Q1 in rethink. Implementation: optimistic claim. The queue endpoint filters `assignedToUserId = self` and the rep's `next` advances cursor optimistically. If a sibling rep also calls `done` on the same lead concurrently, both succeed; the second is a no-op via Prisma upsert.
- **A11y:** disposition strip is a top-of-stacking-context overlay. Focus must trap inside it on appearance and return to the trigger element on dismiss.
- **i18n:** snooze duration labels, disposition labels, queue strip labels — all need TR + EN.
- **Latency:** queue endpoint MUST serve from the existing `(workspaceId, assignedToUserId, nextActionDueAt)` index (verified present in schema, line 705). p95 ≤ 80ms.
- **Mobile:** queue strip is a 56px sticky bar; on mobile it competes with the keyboard. When focus is in voice-note recorder or any text input, the strip auto-hides.

**Rough effort.** L.

**Definition of done.** Three new endpoints live, schema migrated, four new client surfaces wired, 90-second flow demo-able on staging. `ReviewVelocityBadge` renders correctly across the threshold matrix; `EvidenceChip` shows structured numeric evidence; queue-strip headline cites a real `LeadTriggerType` (no fake mock copy). PostHog `lead_detail.snooze`, `lead_detail.disposition`, `lead_detail.queue.advance`, `lead_detail.closest_win.shown`, `lead_detail.v2.review_velocity_shown` events fire.

**What this phase explicitly does NOT do.** No new `LeadTriggerType` enum values — that's Phase 8. The velocity badge is derived UI-only; until Phase 8 lands, no `LeadTrigger` row is written for review-volume signals (the badge appears even without a trigger row). No multi-location sister-lead nav (phase 4). No mobile bottom-sheet drawers (phase 5). No power-tools route split (phase 6). No reasoning power-view route (phase 7).

---

### Phase 4 — Multi-location account view

**Goal in one sentence.** Make `ACCOUNT` a navigable section with sister-lead rows and cross-branch insight propagation, not a chip.

**Demo-able outcome.** Expanded `ACCOUNT` block shows a 4-row table of sister leads (`Roma · Polanco · Condesa · Coyoacán`) with ICP, stage, last-touch. Clicking a row navigates to that sister lead's v2 page with `?from=<currentLeadId>`. A 🏆 callout under the rows says "Insight that won on Coyoacán: 'delivery dip after expansion is an ops-gap' — same trigger fires here" with a one-tap `[ⓘ apply]` that creates an `InsightApplication` row.

**Files to create.**
- `src/components/app/lead-detail-v2/AccountBlock.tsx` — expanded view with sister rows and shared-stakeholder list.
- `src/components/app/lead-detail-v2/SisterLeadRow.tsx` — clickable row with stage chip, ICP, last-touch, mini-disposition.
- `src/components/app/lead-detail-v2/CrossBranchInsightCallout.tsx` — 🏆 callout. One-click `[ⓘ apply]` posts to the existing insight-application endpoint.
- `src/lib/lead-detail/sister-leads.ts` — pure query helper: `prisma.lead.findMany({ where: { workspaceId, accountId, id: { not: currentId } }, ... })`. Workspace-scoped. Lazy-loaded (only fires when `ACCOUNT` block expands — see rethink Q5).
- `src/__tests__/lead-detail/sister-leads.test.ts` — multi-tenant guard + 50-row chain pagination.

**Files to modify.**
- `src/app/api/leads/[id]/decision-surface/route.ts` — add `accountSummary.locationsCount` (already a column on `Account`) but DO NOT eager-load sister rows (too expensive for chains of 50+).
- `src/app/api/leads/[id]/account/route.ts` — verify it already returns sister rows; if yes, the v2 block consumes it directly. If not, extend it. Either way, additive.
- `src/components/app/lead-detail-v2/LeadDetailV2Client.tsx` — wire `AccountBlock`.

**Schema deltas.** None. `Lead.accountId`, `Account.tier`, `Account.locationsCount`, `Stakeholder.accountId` all already exist. `InsightApplication.outcome` already exists.

**API additions/changes.** Possibly extend `/api/leads/[id]/account` to include the sister-rows shape if it doesn't already. Lazy fetch — only when block expands.

**Worker additions/changes.** None.

**Test surface.**
- Multi-tenant scope test: sister leads from another workspace never appear.
- Chain pagination: 60-location chain returns first page + counts.
- Component: empty state (account with 1 location).

**Risk callouts.**
- **Latency:** lazy-load is mandatory. Eager would add ~100ms p50 for the 5% of leads with chains.
- **Plan gating:** account-view + cross-branch insight propagation is PRO_TEAM+ (agency-tier feature). FREE/PRO see the locations count but no row table.
- **A11y:** the row table is a `<table role="grid">` with arrow-key navigation between rows.
- **Mobile:** rows collapse to a vertical card list below 640px; horizontal scroll forbidden.
- **i18n:** stage labels, last-touch relative-time strings.

**Rough effort.** M.

**Definition of done.** Sister-lead nav works on a seeded 4-location chain. Cross-branch insight callout fires when conditions match. `accountId = null` leads render the block with a "single-location" stub.

**What this phase explicitly does NOT do.** No buying-committee mapping across branches (already a worker; not UI work). No account-level rollup of BANT or MEDDPICC.

---

### Phase 5 — Mobile-native pass

**Goal in one sentence.** Re-test phases 1–4 on real iPhone + Pixel and convert the lingering desktop-shaped patterns into mobile-native ones (bottom sheets, sticky CTA bar, voice-note FAB).

**Demo-able outcome.** On iPhone 14 Pro: header (sticky 56px), single-screen WHY-NOW + NEXT-GESTURE + dial/voice-note CTAs, no scroll required to dial. Snooze/disposition open as bottom sheets, not desktop popovers. Voice-note FAB is a 56px gold circle bottom-right above the queue strip. Reasoning evidence-chip taps open a slide-up footnote band (rethink Q4).

**Files to create.**
- `src/components/ui/bottom-sheet.tsx` — generic Radix-based bottom sheet with focus trap + drag-to-dismiss. Used by SnoozeMenu, DispositionStrip, EvidenceChip footnote on mobile.
- `src/components/app/lead-detail-v2/MobileStickyCTA.tsx` — phone-only sticky bar with Dial + Voice-note + chevron-down (more actions).
- `src/components/app/lead-detail-v2/VoiceNoteFAB.tsx` — global, mobile-only. Tap-and-hold to record, release to upload. Reuses the existing recorder hook.
- `src/__tests__/lead-detail/bottom-sheet.test.tsx` — focus trap, ESC dismisses, swipe dismisses on touch devices.

**Files to modify.**
- `src/components/app/lead-detail-v2/SnoozeMenu.tsx` — use `bottom-sheet` on mobile, popover on desktop.
- `src/components/app/lead-detail-v2/DispositionStrip.tsx` — same.
- `src/components/app/lead-detail-v2/EvidenceChip.tsx` — slide-up footnote band on mobile, hover card on desktop.
- `src/components/app/lead-detail-v2/QueueStrip.tsx` — auto-hide on focus inside any text input on mobile.

**Schema deltas.** None.

**API additions/changes.** None.

**Worker additions/changes.** None.

**Test surface.**
- Playwright on Pixel 7 + iPhone 14 Pro emulation: full 90-second flow.
- Lighthouse mobile: a11y ≥ 95, performance ≥ 75 on a slow-3G simulation.
- Real-device QA checklist: 4 viewports, 2 OS versions, both light and dark.

**Risk callouts.**
- **A11y:** bottom sheets are notorious focus-trap landmines. Use Radix primitives end-to-end.
- **Polling impact on mobile:** the existing 2s NBA poll over slow-3G burns battery + data. Phase 5 lowers the poll interval to 4s on mobile and pauses it when the page is hidden (`document.visibilityState`).
- **Layout shift:** the `MobileStickyCTA` reserves 64px at page bottom from first paint to prevent the queue strip ↔ CTA bar fight.
- **Plan gating:** none new in phase 5.

**Rough effort.** M.

**Definition of done.** 90-second flow on iPhone 14 Pro = ≤ 90s wall-clock with all chrome reachable by thumb. Lighthouse mobile a11y ≥ 95. Polling on mobile pauses when tab hidden.

**What this phase explicitly does NOT do.** No PWA install prompts, no native app shell, no offline mode.

---

### Phase 6 — Power Tools split

**Goal in one sentence.** Move the workers panel off the lead page onto its own route at `/app/leads/[id]/workers`, and rewrite the legacy hash redirect for `#workers` and `#anchor-workers-top`.

**Demo-able outcome.** `/app/leads/[id]/workers` is a real, deep-linkable route. From v2, the top-right `⚙ Power tools →` link navigates there. From legacy, `#workers` does an in-page anchor scroll for one release; in the next release, it 301s to the new route. Old AI-Workers panel content renders identically on the new route.

**Files to create.**
- `src/app/app/leads/[id]/workers/page.tsx` — server component. `requireUser()`. Renders `<AiWorkersPanel leadId={id} />` (the existing component, untouched). Adds breadcrumb "Casa Polanco › Power tools".
- `src/app/app/leads/[id]/workers/loading.tsx` — Next 16 loading boundary.
- `src/__tests__/lead-detail/workers-route.test.ts` — multi-tenant scope, plan gating (some workers are PRO+).

**Files to modify.**
- `src/components/app/lead-detail-v2/PowerToolsLink.tsx` — change target from `?tab=workers&v=1` to `/app/leads/[id]/workers`.
- `src/lib/lead-detail/legacy-hash-redirect.ts` — `#workers` and `#anchor-workers-top` now `router.replace` to the new route. The mapping table grows by one row.
- `src/app/app/leads/[id]/page.tsx` — legacy `?tab=workers` content stays for one release, but the page emits a deprecation telemetry event so we can measure traffic before truly removing.
- `src/components/app/ai-workers-panel.tsx` — no behavior change. The component already does its own data loading via `/api/leads/[id]/workers`.

**Schema deltas.** None.

**API additions/changes.** None. `GET /api/leads/[id]/workers` and `POST /api/leads/[id]/workers/[kind]` already exist.

**Worker additions/changes.** None.

**Test surface.**
- Route renders, plan gating works, multi-tenant isolation holds.
- Playwright: legacy `#workers` deep link redirects.
- Telemetry: `lead_detail.power_tools.viewed` and `lead_detail.legacy_workers_link_followed` events.

**Risk callouts.**
- **Backward compat:** the legacy `?tab=workers` URLs in user emails / Slack threads must keep working. Two-release deprecation window.
- **Plan gating:** unchanged from current — the workers panel already enforces.
- **A11y:** the new route adds a real `<nav aria-label="lead-secondary">` breadcrumb back to the lead.
- **i18n:** "Power tools" label.

**Rough effort.** S.

**Definition of done.** New route live; legacy hash links resolve; AI-Workers panel content unchanged; deprecation telemetry fires.

**What this phase explicitly does NOT do.** No worker-panel UX redesign. No worker grouping changes. No `hiddenFromPanel` re-litigation.

---

### Phase 7 — Polish, motion, observability

**Goal in one sentence.** Land the reasoning power-view route, the inline reasoning-trace patterns on every claim, the perf budget and the telemetry envelope, and delete the deprecated components from the catalog.

**Demo-able outcome.**
- `/app/leads/[id]/reasoning/[actionId]` route renders the full `reasoningGraph` + `arbitrationRecords`. From v2, every "open full graph →" link navigates here.
- Every claim in v2 (BANT cells, MEDDPICC rows, ICP-dimension bars, NextGesture pushback) shows always-visible inline evidence chips. No "Why?" link anywhere on the page.
- Glow-on-final replaced everywhere by the `UpdatedToast` pattern.
- Perf budget enforced: initial paint ≤ 1.2s on hot DB; layout-shift score 0; polling pauses on tab hidden.
- PostHog dashboard `Lead Detail v2` shows: viewed, dialed, snoozed, voice-note-added, disposition-set, queue-advanced, closest-win-shown, closest-win-applied, legacy-hash-consumed, legacy-workers-link-followed.

**Files to create.**
- `src/app/app/leads/[id]/reasoning/[actionId]/page.tsx` — server component, workspace-scoped. Renders the full reasoning graph + contradictions.
- `src/components/app/lead-detail-v2/ReasoningGraphFullView.tsx` — re-uses the existing `ReasoningTraceExpandable` graph render but as a primary surface (no expand toggle).
- `src/components/app/lead-detail-v2/ClaimWithEvidence.tsx` — generic wrapper that turns any claim string + `EvidenceRef[]` into an inline `claim · chip · chip` row.
- `src/lib/lead-detail/perf-marks.ts` — pure helper for `performance.mark` / `performance.measure` instrumentation; reports to PostHog as `lead_detail.perf.{event}`.
- `src/lib/lead-detail/telemetry.ts` — typed event catalog. Single source of truth for every PostHog event the page emits. Phase 7 enforces every emitter goes through this module.
- `src/__tests__/lead-detail/reasoning-route.test.ts` — workspace scope on the new route.
- `src/__tests__/lead-detail/perf-budget.test.ts` — synthetic perf check using fixtures.

**Files to delete (after one release of deprecation telemetry).**
- `src/components/app/nba/IcpScoreRing.tsx` (if exists separately).
- `src/components/app/nba/TriggerChip.tsx` (if exists separately).
- `src/components/app/nba/OpeningHookBlock.tsx` (if exists separately).
- `src/components/app/nba/CommercialInsightCard.tsx` (if exists separately).
- `src/components/app/nba/ObjectionAccordion.tsx` (if exists separately).
- `src/components/app/nba/PipelineStageStepper.tsx` (if exists separately).
- `src/components/app/nba/InsightApplicationRow.tsx` (if exists separately).
- `src/components/app/nba/PowerToolDrawer.tsx` (if exists separately).
- The legacy 5-tab `LegacyLeadDetailClient` is **kept** behind the flag for one full release after phase 7 lands, then deleted in a separate dedicated PR.

**Files to modify.**
- Every block in `src/components/app/lead-detail-v2/*Block.tsx` — replace any "Why?" link with `<ClaimWithEvidence>`. Remove every hover-only tooltip.
- `src/components/app/lead-detail-v2/NextGestureBlock.tsx` — replace glow with `UpdatedToast`.
- `src/lib/lead-detail/use-decision-surface.ts` — wire perf-marks.

**Schema deltas.** None.

**API additions/changes.** None new. The reasoning route is a thin Prisma read off `LeadNextAction.reasoningGraph` + `arbitrationRecords` columns.

**Worker additions/changes.** None.

**Test surface.**
- Reasoning route: workspace scope, 404 for unknown actionId.
- Perf budget regression test on three reference leads (COLD / REPLIED / WON).
- Telemetry catalog test: every PostHog event emitted is in the typed catalog.

**Risk callouts.**
- **Multi-tenant scope:** `reasoning/[actionId]` is the new query — workspace must be in the where.
- **Layout shift:** replacing glow with toast must not push the queue strip up. AnimatePresence positioning: the toast lives in a portal.
- **A11y:** the toast must have `role="status"` and announce once, not on every poll tick.
- **i18n:** every event property in `telemetry.ts` is locale-independent; user-facing strings still go through `t()`.
- **Plan gating:** the reasoning power-view is a PRO+ surface. FREE sees a teaser.

**Rough effort.** M.

**Definition of done.** Eight deprecated components deleted (or moved to `legacy/`). Every claim has inline evidence. Reasoning route deep-linkable. Perf budget enforced in CI via the regression test. Full telemetry envelope in PostHog dashboard.

**What this phase explicitly does NOT do.** No legacy 5-tab page deletion (one-release lag). No real-time multi-user "Alex is viewing" badge (out of scope, §7). No websocket replacement of polling (V3).

---

### Phase 8 — Review-volume trigger

**Goal in one sentence.** Make "review volume" a first-class `LeadTriggerType` with a deterministic detector rule, evidence chip, BANT weighting, and queue-strip headline source — so the V2 plan's "review streak" framing has a real backend instead of a UI-only badge.

**Demo-able outcome.** A lead with a 30d review-count surge ≥ +50% (and ≥ 8 recent reviews) writes a `LeadTrigger` of type `REVIEW_VOLUME_SURGE` and surfaces in the queue with `WHY NOW: review surge +120%`. A lead with a -30% dip vs the prior 30d window writes `REVIEW_VOLUME_DIP` (high-severity — a buying signal because operations gaps are the SDR opening) with `WHY NOW: review dip -40%`. Both types pair with the existing `ReviewVelocityBadge` from Phase 3 so the badge and the chip agree on the same window math.

**Files to create.**
- `src/__tests__/agent-workers/trigger-detector-review-volume.test.ts` — fixture matrix:
  - `recent30dCount=12, prior30dCount=6` → `REVIEW_VOLUME_SURGE` (delta +100%, severity `medium`).
  - `recent30dCount=4, prior30dCount=10` → `REVIEW_VOLUME_DIP` (delta -60%, severity `high`).
  - `recent30dCount=7, prior30dCount=6` → no trigger (under +50% threshold).
  - `recent30dCount=20, prior30dCount=4` (≥ 8 recent) → `REVIEW_VOLUME_SURGE` (delta +400%, severity `medium`).
  - `recent30dCount=5, prior30dCount=4` (prior < 5) → no trigger.
  - Fewer than 6 total reviews → no trigger (same guard as Rule A).

**Files to modify.**
- `prisma/schema.prisma` — `LeadTriggerType` enum gains `REVIEW_VOLUME_SURGE` and `REVIEW_VOLUME_DIP`. Two enum values, no column change. The full DDL footprint of this whole plan (combined with Phase 3's `Lead.snoozeUntilTriggerType`) is therefore: 1 column add + 2 enum values.
- `src/lib/agent-workers/trigger-detector.ts` — new rule that imports the **same** `src/lib/lead-detail/review-velocity.ts` helper Phase 3's badge uses, so the badge ↔ trigger never disagree (R20). Surge: `deltaPct >= +50%` AND `recent30dCount >= 8`. Dip: `deltaPct <= -30%` AND `prior30dCount >= 5`. Severity: surge=`medium`, dip=`high`. Evidence: `{ source: "review", recentCount, priorCount, deltaPct, recent30dAvgRating, prior30dAvgRating, ratingDelta }`. `impactPrediction` set ("Operations stretched / coverage gap" for dip; "Momentum window — strike before competitor catches up" for surge).
- `src/lib/agent-workers/registry.ts` — verify `TRIGGER_DETECTOR.requiredIncludes.googleReviews = true` is already wide enough; currently `take: 50` (see `execute.ts` lines 657–665). 50 rows is enough for two non-overlapping 30d buckets in the typical case; bump to 80 if seasonal-restaurant fixtures show clipping.
- `src/lib/sdr-brain/buying-readiness.ts` — extend the per-`LeadTriggerType` need/timing weight maps with surge/dip scores. Suggested: surge → `+0.10` need, `+0.15` timing; dip → `+0.20` need, `+0.25` timing (dip is the stronger buying signal).
- `src/app/api/leads/[id]/snooze/route.ts` — add `REVIEW_VOLUME_SURGE` and `REVIEW_VOLUME_DIP` to the accepted-trigger allowlist for "until trigger" snooze.
- `src/components/app/lead-detail-v2/WhyNowBlock.tsx` — `TRIGGER_TYPE_TO_CHIP`: `REVIEW_VOLUME_SURGE → review`, `REVIEW_VOLUME_DIP → review`. (`EvidenceChip` already gained the structured-evidence renderer in Phase 3, so the new types render their `recentCount`/`priorCount`/`deltaPct` for free.)
- `src/lib/lead-detail/queue-headline.ts` — add headline templates for the two new types so `QueueStrip` reads `WHY NOW: review surge +120%` / `review dip -40%` deterministically.
- `src/components/app/lead-detail-v2/ReviewVelocityBadge.tsx` — when the lead has a `REVIEW_VOLUME_SURGE` or `REVIEW_VOLUME_DIP` trigger row attached, the badge upgrades from "derived" tone to "trigger" tone (subtle visual: the same numbers, but with the chip-family color treatment) so the SDR knows the signal has been "promoted" to a real trigger.

**Schema deltas.**
- `LeadTriggerType` += `REVIEW_VOLUME_SURGE`, `REVIEW_VOLUME_DIP`. No new model, no new column. Forward-compatible: old code reading the enum still functions; new values fall through default branches.

**API additions/changes.** None new. The aggregator already returns the trigger rows under `nba.triggers`; the new types ride that channel.

**Worker additions/changes.**
- `TRIGGER_DETECTOR` gains the new rule. Idempotency: keep the existing pattern of dedup-by-type within the run window.
- The trigger-detector's snooze post-hook already clears `Lead.snoozeUntil` where `snoozeUntilTriggerType IN (newlyWrittenTypes)` — automatically extends to the new types because the SQL is `IN (...)`.

**Test surface.**
- Detector fixture matrix above.
- BANT weight regression on a lead pre-/post-`REVIEW_VOLUME_DIP` write — `timing` score increases by ≥ 0.20.
- Snooze allowlist test for the two new types.
- `queue-headline.ts` unit test extended to cover both new values.
- Visual regression on `WhyNowBlock` rendering a `REVIEW_VOLUME_SURGE` chip.
- Multi-tenant scope test: surge/dip writes on a workspace-A lead never appear in workspace-B's `decision-surface`.

**Risk callouts.**
- **Multi-tenant scope:** the detector already scopes its writes per `Lead.workspaceId`. New types follow the same path; the snooze post-hook explicitly filters by `workspaceId`. Test catches a leak through the trigger row.
- **Plan gating:** review-volume triggers are FREE-friendly (signal is fundamental). The chip is always shown; the BANT timing boost it produces is shown to all plans.
- **Latency:** `take: 50` reviews is ~3KB on the wire; the new rule is O(n) over those 50 rows. No new round-trip.
- **A11y:** chip color paired with icon (`📈` / `📉`) per `ui-components.mdc` color-blind rule.
- **i18n:** "Review surge", "Review dip", "Operations stretched / coverage gap", "Momentum window" — EN + TR catalogs.
- **False positives on small businesses:** the `recent30dCount >= 8` and `prior30dCount >= 5` guards prevent triggering on micro-volume noise. Sanity-check on a sample of 100 fixtures from PROD-snapshot before flipping the rule on for all workspaces.
- **Rollback:** turn off the detector rule; existing rows stay readable. UI fallback is the derived `ReviewVelocityBadge` from Phase 3, which is enum-independent.

**Rough effort.** M.

**Definition of done.** Detector emits both new types on the fixture matrix. Queue-strip headline maps cleanly. Snooze "until trigger" works. BANT weights move correctly when a dip fires. The Phase 3 `ReviewVelocityBadge` and the Phase 8 trigger chip never disagree on the same lead (same window math). The plan's "review streak" framing now has a real backend.

**What this phase explicitly does NOT do.** No new ReviewAnalysis fields. No deeper review history persistence (the 50-row include in `execute.ts` is the corpus). No cross-workspace signal sharing. No pricing-page copy updates for the new trigger family — that's marketing's call.

---

## 5. Cross-cutting concerns

### 5.1 Multi-tenant scope checklist

- Every new API route uses `requireUser()` from `src/lib/auth.ts` first thing; uses `session.workspaceId` in EVERY Prisma `where` clause that touches `Lead`, `Account`, `Stakeholder`, `LeadNextAction`, `LeadTrigger`, `DealQualification`, `DealQualificationFact`, `DiscoverySession`, `DiscoveryItem`, `Objection`, `InsightApplication`, `InsightPerformance`, `WatchlistItem`, `IdealCustomerProfile`, `LeadActivity`, `VoiceNote`.
- The aggregator route (`/decision-surface`) is the highest-risk surface — its integration test explicitly seeds two workspaces and asserts cross-tenant reads return 404.
- The queue route is the second-highest — same test pattern.
- Reasoning route (`/reasoning/[actionId]`) — same.
- Sister-lead query — same.
- Snooze, disposition, log-call writes — workspace-scoped via `where: { id, workspaceId }`.

### 5.2 Generated Prisma client

- All imports use `@/generated/prisma/client`. Never `@prisma/client`. ESLint rule lives in the existing `eslint.config.*`; the plan does not add new rules.

### 5.3 Plan gating

- **FREE:** v2 shell, BANT-only preliminary NBA, ICP-dimensions, basic stakeholders, snooze, manual queue advance. **No** MEDDPICC, **no** SPIN, **no** sister-lead nav, **no** queue auto-advance, **no** closest-win callout, **no** reasoning power view.
- **PRO:** all of FREE + MEDDPICC + SPIN + closest-win callout + reasoning power view.
- **PRO_TEAM:** all of PRO + per-rep queue + assignee filter + sister-lead account view.
- **AGENCY:** all of PRO_TEAM + cross-branch insight propagation + multi-workspace queue rollup.
- Source of truth: `src/lib/plans.ts`. Locked surfaces render via existing `<UpgradeBadge>` / `<PlanLockedBlock>` (verify name in `src/components/app/`; if the actual component is named differently, conform).

### 5.4 i18n

- Every new label in every new component is wrapped in `t(...)` and registered in the existing TR + EN catalogs (`src/i18n/`).
- Worker `displayName` / `displayNameTr` already exist on the registry; v2 reads them directly.
- Translation lag: copy-paste EN into TR slots in phases 1–6, get human-reviewed TR before phase 7 ships.
- Reasoning power view labels (`EVIDENCE / INFERENCE / DECISION / SUPPORTS / CONTRADICTS / DEPENDS_ON`) are user-facing; both languages required.

### 5.5 Telemetry (PostHog)

Single typed catalog at `src/lib/lead-detail/telemetry.ts` (phase 7). Events expected:

- `lead_detail.v2.viewed { leadId, pipelineStage, planTier }`
- `lead_detail.v2.preliminary_received { leadId, latencyMs }`
- `lead_detail.v2.final_received { leadId, latencyMs }`
- `lead_detail.block.expanded { leadId, blockKey }`
- `lead_detail.evidence_chip.opened { leadId, chipType }`
- `lead_detail.snooze { leadId, kind: '1d|3d|1w|custom|trigger', triggerType? }`
- `lead_detail.disposition { leadId, disposition }`
- `lead_detail.queue.advance { leadId, position, totalToday }`
- `lead_detail.closest_win.shown { leadId, sisterLeadId, insightId }`
- `lead_detail.closest_win.applied { leadId, insightId }`
- `lead_detail.power_tools.viewed { leadId }`
- `lead_detail.reasoning.viewed { leadId, actionId }`
- `lead_detail.legacy_hash_consumed { leadId, hash }`
- `lead_detail.legacy_workers_link_followed { leadId }`
- `lead_detail.perf.* { event, durationMs, leadId }`

**Phase 2.5 / 3 / 8 additions** (richness absorption + review-volume work-stream):

- `lead_detail.v2.review_velocity_shown { leadId, deltaPct }` — Phase 3, derived badge.
- `lead_detail.v2.dossier_expanded { leadId, lazyLatencyMs }` — Phase 2.5, on `DiscoveryBlock` "AI dossier →".
- `lead_detail.v2.review_intel_expanded { leadId, lazyLatencyMs }` — Phase 2.5, on `HistoryBlock` "View full →".
- `lead_detail.v2.website_intel_expanded { leadId, lazyLatencyMs }` — Phase 2.5, on `WhyNowBlock` deep-dive.
- `lead_detail.v2.recommended_package_shown { leadId, packageSlug }` — Phase 2.5, fires once per `NextGestureBlock` mount.
- `lead_detail.v2.personalized_message_copied { leadId }` — Phase 2.5, on copy-to-clipboard.
- `lead_detail.v2.sub_niche_overridden { leadId, from, to }` — Phase 2.5, on `HeaderBar` kebab save.
- `lead_detail.v2.intelligence_brief_clicked { leadId, runId }` — Phase 2.5, on "open full brief →" deep-link.
- `lead_detail.v2.review_volume_trigger_surfaced { leadId, kind: 'surge'|'dip', deltaPct }` — Phase 8, fires when a `REVIEW_VOLUME_*` chip is rendered in `WhyNowBlock`.

### 5.6 Performance budget

- **Initial paint (server):** ≤ 1.2s p95 hot DB. The page server component must not block on the aggregator; the aggregator is fetched client-side after first paint of the static shell.
- **Aggregator route:** ≤ 250ms p95 hot DB.
- **Queue route:** ≤ 80ms p95 — index-only read.
- **Polling impact:** existing 2s NBA poll continues for v2 unchanged. On mobile (phase 5), 4s when foregrounded, paused when hidden.
- **Layout-shift policy:** target CLS = 0 on the lead-detail page. Block primitive uses `min-height` placeholders during fetch to prevent shifts.
- **Aggregator caching:** `Cache-Control: private, max-age=0, must-revalidate`. `stale-while-revalidate` on the client via SWR.

### 5.7 Component reuse map

What stays, what moves, what dies. Tracks the rethink §6 catalog × the actual codebase (`src/components/app/nba/` confirmed to currently hold 2 files: `NbaCard.tsx` and `ReasoningTraceExpandable.tsx`; the other catalog names live inline within `NbaCard` or do not exist as separate files yet).

| Catalog name              | Today's location (verified)                          | Phase verdict                      |
|---|---|---|
| `TierBadge`               | inline header chip, not a separate file              | Phase 1 lift to `lead-detail-v2/HeaderBar.tsx`; deprecate inline |
| `WhyNowHeadline`          | `NbaCard.tsx` (inline)                               | Phase 1 own file in `lead-detail-v2/WhyNowBlock.tsx` |
| `NbaPrimaryCard` (prelim/final) | `src/components/app/nba/NbaCard.tsx`           | Phase 1 extract `<NbaContent>`; both v1 and v2 wrap it |
| `BantBars`                | inline (no separate file today)                      | Phase 2 own file `lead-detail-v2/QualificationBlock.tsx` |
| `StakeholderCard`         | inline                                               | Phase 2 own file `lead-detail-v2/WhoBlock.tsx` |
| `SpinBoard`               | inline / part of voice-notes panel                   | Phase 2 own file `lead-detail-v2/DiscoveryBlock.tsx` |
| `MeddpiccChecklist`       | inline                                               | Phase 2 own file in `QualificationBlock.tsx` |
| `ContradictionLogItem`    | inside `ReasoningTraceExpandable.tsx`                | Phase 7 lift to `ClaimWithEvidence.tsx` chip |
| `VoiceNoteRecorder`       | `src/components/app/voice-notes-panel.tsx`           | Phase 2 split into recorder hook + global FAB |
| `IcpScoreRing`            | inline (today renders as ring)                       | Phase 2 replace with `IcpDimensionBars.tsx`; phase 7 delete ring |
| `TriggerChip`             | inline in `NbaCard`                                  | Phase 1 replace with `EvidenceChip.tsx`; phase 7 delete chip |
| `OpeningHookBlock`        | inline in `NbaCard`                                  | Phase 1 merge into `NextGestureBlock.tsx`; phase 7 delete |
| `CommercialInsightCard`   | inline                                               | Phase 1 merge into `NextGestureBlock.tsx` (one line); phase 7 delete |
| `ObjectionAccordion`      | inline                                               | Phase 2 replace with `PredictedVsRealObjections.tsx` in HISTORY; phase 7 delete |
| `ReasoningTraceSheet`     | `src/components/app/nba/ReasoningTraceExpandable.tsx` | Phase 7 lift to `ReasoningGraphFullView.tsx` route surface; legacy stays for v1 |
| `PipelineStageStepper`    | inline (today is a chip)                             | Phase 1 replace with header chip + dropdown; phase 7 delete stepper if separate file emerges |
| `InsightApplicationRow`   | inline                                               | Phase 4 reuse for cross-branch callout `[ⓘ apply]` button only; phase 7 delete row component |
| `PowerToolDrawer`         | `src/components/app/ai-workers-panel.tsx`            | Phase 6 relocate to route; phase 7 delete drawer-as-overlay code path |
| `WebsiteIntelligencePanel` | `src/components/app/website-intelligence-panel.tsx` | Phase 2.5 absorbed: chip strip → `WhyNowBlock` (`WebsiteSignalStrip`); full panel re-skin → `HistoryBlock` lazy expand via `/website-intel` |
| `ReviewIntelligencePanel`  | `src/components/app/review-intelligence-panel.tsx`  | Phase 2.5 absorbed: KPIs / sentiment / switch signals / leadScore → `HistoryBlock` (`ReviewIntelligenceSummary`); full panel → lazy expand |
| `ReviewTimelineChart`      | inline                                              | Phase 2.5 → `HistoryBlock` lazy expand (`ReviewTimelineMini`) via `/review-intel` |
| `DossierMarkdown` + `DossierSection` | inline                                    | Phase 2.5 → `DiscoveryBlock` lazy expand (`DossierExpand`); existing `/explain` + `/dossier-sources` reused |
| `RecommendedPackageCard`   | inline                                              | Phase 2.5 → `NextGestureBlock` "Recommended approach" subsection (`RecommendedApproach`) |
| `PersonalizedMessageCard`  | inline                                              | Phase 2.5 → `NextGestureBlock` (same subsection); copy-to-clipboard preserved |
| `LeadMapView`              | inline                                              | Phase 2.5 → `AccountBlock` (`AccountMapMini`) |
| `IdentityRail` rows        | inline                                              | Phase 2.5 → `AccountBlock` (`PipelineStateChips`) |
| `HeroSocialBadges` / `HeroDirectoryBadges` / `SocialProfileIcons` | inline | Phase 2.5 → `WhoBlock`/`StakeholderCard` (`StakeholderOnlinePresence`) per stakeholder + `AccountBlock` for account-level directories |
| `SubNicheOverride`         | inline                                              | Phase 2.5 → `HeaderBar` kebab item (`SubNicheOverrideMenu`) |
| `OutreachStepper`          | inline                                              | Phase 2.5 superseded by `DispositionStrip` + `PipelineStageChip`; phase 7 delete |
| `HeroPipelineRerunBar`     | inline                                              | Phase 2.5 → `HeaderBar` kebab item; phase 7 delete inline bar |
| `IntelligenceBriefCard` (new) | n/a                                              | Phase 2.5 new: top-of-block in `QualificationBlock`; reads `decision-surface.intelligenceBrief`; "open full brief →" deep-links to phase 7 reasoning route |
| `ReviewVelocityBadge` (new) | n/a                                                | Phase 3 new: derived UI-only pill in `WhyNowBlock`; phase 8 promotes its tone when paired with a `REVIEW_VOLUME_*` trigger row |

Net at end of phase 7+2.5+8: ~17 surviving components on the lead page (12 from the original target + 5 absorbed sub-components rendering V1 signals). The component count went up vs the original §6 target — this is the deliberate cost of richness parity. 8 components are still deleted, 1 is route-relocated. Two new ones (`IntelligenceBriefCard`, `ReviewVelocityBadge`) are created in 2.5 / 3 to host signals V1 only had inline.

### 5.8 A11y

- Keyboard: full tab order through header → blocks → queue strip. Arrow keys navigate sister-lead rows.
- Screen reader: every block has an `<h2>` with the section name. Inline evidence chips have `aria-describedby` pointing to their source-quote drawer.
- Focus management: drawers/sheets trap focus on appearance, restore on dismiss. Snooze and disposition popovers use Radix primitives.
- Color contrast: every status color is paired with an icon (MEDDPICC ✓ / ◐ / ✗, BANT bars, trigger urgency).
- Motion: respects `prefers-reduced-motion` — fade-only when set.

### 5.9 V1 richness parity checklist

The cookie-default flip from `off` → `on` for `leadDetailV2` waits until every row below shows green in the Phase 2.5 Playwright spec (`tests/e2e/lead-detail-richness-parity.spec.ts`). This is the binding gate that closes the "SDR finds more deals on V1 than V2" regression.

| # | V1 surface (legacy file / inline) | Signal it carries | V2 absorption block | V2 component(s) | Data source on V2 | Phase |
|---|---|---|---|---|---|---|
| 1 | `LegacyLeadDetailClient` `HeroBand` score ring | `salesConfidence` from cached `LEAD_INTELLIGENCE_BRIEF` | QUALIFICATION | `IntelligenceBriefCard` | `decision-surface.intelligenceBrief.salesConfidence` | 2.5 |
| 2 | `HeroFitSummary` (`whyGoodTarget`, `likelyPainPoints`) | Strategic narrative for the lead | QUALIFICATION | `IntelligenceBriefCard` | `decision-surface.intelligenceBrief.whyGoodTarget` / `painPoints` | 2.5 |
| 3 | `HeroPriorityStrip` audit wedges | Site quality signal | WHY NOW | `WebsiteSignalStrip` | `decision-surface.websiteIntelSummary` | 2.5 |
| 4 | `HeroPriorityStrip` review IQ sub-score | `reviewAnalysis.leadScore` | HISTORY | `ReviewIntelligenceSummary` | `decision-surface.reviewIntelSummary.leadScore` | 2.5 |
| 5 | `HeroSocialBadges` / `HeroDirectoryBadges` | Discovered links from AgentRun | WHO + ACCOUNT | `StakeholderOnlinePresence` + `AccountBlock` strip | `decision-surface.discoveredLinks` | 2.5 |
| 6 | `HeroPipelineRerunBar` | Re-run pipeline action | HEADER kebab | `HeaderBar` kebab item | `POST /api/leads/[id]/pipeline-rerun` | 2.5 |
| 7 | `IdentityRail` pipeline status rows | Crawl/analyze/outreach state | ACCOUNT | `PipelineStateChips` | `decision-surface.pipelineState` | 2.5 |
| 8 | `LeadMapView` | Geographic context | ACCOUNT | `AccountMapMini` | `lead.sourceLat`/`lead.sourceLng` (in `leadCore`) | 2.5 |
| 9 | Overview tab — `NbaCard` | NBA preliminary→final | NEXT GESTURE | `NextGestureBlock` | `decision-surface.nba` | 1 (already shipped) |
| 10 | Overview tab — `DossierSection` + `DossierMarkdown` + sources | AI dossier markdown + sources | DISCOVERY | `DossierExpand` | `POST /api/leads/[id]/explain` (lazy) + `GET /api/leads/[id]/dossier-sources` | 2.5 |
| 11 | Overview tab — `RecommendedPackageCard` | Package recommendation + reason codes | NEXT GESTURE | `RecommendedApproach` | `decision-surface.recommendedPackage` | 2.5 |
| 12 | Overview tab — `PersonalizedMessageCard` | First-message draft | NEXT GESTURE | `RecommendedApproach` | `decision-surface.personalizedFirstMessage` | 2.5 |
| 13 | Website tab — `WebsiteIntelligencePanel` (full) | Audit, security, perf, schema, booking | WHY NOW (chips) + HISTORY (full panel lazy) | `WebsiteSignalStrip` (always) + lazy `/website-intel` | `decision-surface.websiteIntelSummary` + lazy companion | 2.5 |
| 14 | Website tab — `SubNicheOverride` | Sub-niche override + re-pipeline | HEADER kebab | `SubNicheOverrideMenu` | `decision-surface.subNicheState` + `PATCH /api/leads/[id]/sub-niche` | 2.5 |
| 15 | Workers tab — `PlannerActions` + `DeepResearchProgressPanel` | Planner sessions + deep-research live progress | Power tools route | unchanged | `/api/planner/*` + `/api/leads/[id]/deep-research-session` | 6 |
| 16 | Workers tab — `AiWorkersPanel` | Worker grid + quotas + exports | Power tools route | unchanged | `/api/leads/[id]/workers` + `[kind]` | 6 |
| 17 | Workers tab — `WebsitePlanSection` | 19-section website plan artifact | Power tools route | unchanged (`WebsitePlanSection` lifted) | `POST /api/website-plan/[id]` | 6 |
| 18 | Reviews tab — `ReviewIntelligencePanel` (full) | Sentiment, weakness/strength KPIs, switch signals, leadScore, summary | HISTORY | `ReviewIntelligenceSummary` (always) + lazy `/review-intel` | `decision-surface.reviewIntelSummary` + lazy companion | 2.5 |
| 19 | Reviews tab — `ReviewTimelineChart` | Volume-over-time | HISTORY (lazy expand) | `ReviewTimelineMini` | `GET /api/leads/[id]/review-intel` | 2.5 |
| 20 | Reviews tab — `GoogleReviewsAccordion` | Raw review rows + refresh | HISTORY (lazy expand) | inside `ReviewTimelineMini` viewer | `GET /api/leads/[id]/review-intel` | 2.5 |
| 21 | Reviews tab — `VoiceNotesPanel` (full list) | Voice-note list | HISTORY + DISCOVERY FAB | existing `VoiceNoteFAB` + new HISTORY list | `GET /api/leads/[id]/voice-notes` | 2 (already shipped) / 2.5 (list) |
| 22 | Outreach tab — outreach status + `OutreachStepper` | Pipeline stage stepper | NEXT GESTURE + HEADER pipeline chip | `DispositionStrip` + `PipelineStageChip` | `PATCH /api/leads/[id]/status` | 3 (disposition) / 2.5 (chip) |
| 23 | Outreach tab — `SocialProfileIcons` (extra fetch) | Social profile icons | WHO | `StakeholderOnlinePresence` | `decision-surface.discoveredLinks` (no extra fetch) | 2.5 |
| 24 | `SalesCallSheet` + `MobileActionBar` log-call | Call logging + post-call disposition | NEXT GESTURE + DISPOSITION strip | `DispositionStrip` + `MobileStickyCTA` | `POST /api/leads/[id]/log-call` + `dispositions` | 3 |
| 25 | (cross-cutting) trigger detector's `recentCount` / `priorCount` / `windowDropStars` evidence | Numeric evidence the chip silently dropped | WHY NOW | `EvidenceChip` (extended) | `decision-surface.nba.triggers[].evidence` | 3 |
| 26 | (cross-cutting) review-volume signal | "Review streak" signal the queue mock referenced but no enum existed | WHY NOW + queue strip | `ReviewVelocityBadge` (3) + `REVIEW_VOLUME_*` trigger chip (8) | `decision-surface.reviewVelocity` (3) + `LeadTrigger` row (8) | 3 + 8 |

**How to use this checklist.** Phase 2.5 PR cannot merge with any row red. Phase 3 PR cannot merge with rows 22 / 24 / 25 / 26 (Phase 3 portion) red. Phase 8 PR cannot merge with row 26 (Phase 8 portion) red. The cookie-default flip waits on rows 1–24 plus row 26 (Phase 3 portion) green.

---

## 6. Risk register

1. **Feature flag accidentally enables on FREE plan and shows locked surfaces with no copy** → likelihood M, impact M → mitigation: phase-2 locked-state component is a shared primitive used by every gated block; visual regression test seeds a FREE workspace.
2. **Polling-driven morph causes layout shift on slow connections** → likelihood M, impact H → mitigation: Block primitive owns the AnimatePresence + `layout` boundary; layout shift score asserted in phase-1 component test.
3. **Existing deep-link analytics break** → likelihood H, impact L → mitigation: legacy-hash-redirect emits `lead_detail.legacy_hash_consumed`; we keep telemetry parity for one full release before pruning aliases.
4. **Aggregator route N+1 makes lead detail slower than legacy** → likelihood M, impact H → mitigation: phase-2 integration test asserts query count (≤ 12 round-trips after richness absorption — was 8 before Phase 2.5 widened the union); `Prisma.$transaction([...])` for parallelizable reads, `select` projections on summarized relations. See R17 for the latency-budget pair of this risk.
5. **BullMQ worker concurrency × plan-tier × Gemini key rotation can starve the final NBA, leaving v2 stuck on preliminary** → likelihood M, impact H → mitigation: phase-1 ships the "preliminary is shippable" banner so the page is dial-able even when final never arrives; phase-3 disposition strip works regardless of NBA status.
6. **Multi-tenant scope leak via sister-leads query when `accountId` is non-null on a leaked lead** → likelihood L, impact H (highest severity) → mitigation: phase-4 integration test seeds two workspaces sharing the same external `placeId` and asserts isolation; the helper function takes `workspaceId` as a non-optional first arg.
7. **Auto-watchlist creation in the aggregator surprises users on FREE who hit watchlist limits** → likelihood L, impact M → mitigation: aggregator's auto-create is gated by plan; FREE sees the MEDDPICC stub locked instead of getting a watchlist row silently consumed.
8. **Snooze "until trigger" never fires because the trigger-detector cron only iterates non-snoozed leads** → likelihood M, impact M → mitigation: phase-3 trigger-detector extension explicitly iterates leads where `snoozeUntilTriggerType IS NOT NULL` regardless of `snoozeUntil`.
9. **Mobile bottom-sheet conflict with iOS Safari URL bar dismissal causes the queue strip to overlap dial CTA** → likelihood H, impact M → mitigation: phase-5 reserves bottom space using `100dvh - safe-area-inset-bottom`; real-device QA on iPhone 14 Pro is a phase-5 DoD.
10. **Reasoning power-view route exposes contradiction logs that include PII from voice-note transcripts cross-workspace** → likelihood L, impact H → mitigation: phase-7 route guard + integration test; the reasoning graph is opaque JSON but the source-quote nodes can quote PII verbatim.
11. **Legacy hash consumers (Zapier / email signatures / Slack threads) silently break in the deprecation window** → likelihood M, impact L → mitigation: `lead_detail.legacy_hash_consumed` telemetry; a 14-day observation window before removing aliases.
12. **Layout-shift in `Block` collapse animation when content height differs significantly between expanded / stub** → likelihood M, impact M → mitigation: Block primitive uses Framer's `layout="position"` (not "size") for stubs; absolute positioning during transition.
13. **Compare-to-similar-wins false positives because `InsightPerformance` shares trigger×framework×tier across workspaces** → likelihood L, impact M → mitigation: phase-3 closest-win helper filters `workspaceId` first; the schema comment at line 2068 already warns about cross-workspace scope.
14. **Per-rep queue fights in PRO_TEAM when two reps have overlapping assignment** → likelihood M, impact M → mitigation: rethink Q1 — optimistic claim; phase-3 queue endpoint filters strictly by `assignedToUserId = self`. AGENCY-tier rollup is a future phase.
15. **The flag-resolver becomes a hot path when checked on every render** → likelihood M, impact L → mitigation: resolver is server-side, called once per request in the page server component, passed to client via prop.
16. **Richness-parity drift during cutover — V2 silently drops a V1 signal an SDR depended on** → likelihood H, impact H (this is the exact regression the user flagged) → mitigation: §5.9 V1 richness parity checklist is the binding gate for the cookie-default flip; phase 2.5's `tests/e2e/lead-detail-richness-parity.spec.ts` Playwright spec asserts every V1 signal text appears on the V2 DOM for COLD/REPLIED/WON fixtures; PostHog telemetry on each absorbed surface (`dossier_expanded`, `review_intel_expanded`, `recommended_package_shown`, `personalized_message_copied`, `intelligence_brief_clicked`) lets us measure adoption per absorption row.
17. **`decision-surface` p95 inflates as it absorbs ~10 summary fields, putting v2 first paint behind v1** → likelihood M, impact M → mitigation: budget bumped to ≤ 400ms p95 (was 250ms) but enforced in CI on three reference fixtures; aggregator uses `Prisma.$transaction([...])` of read promises with `select` projections (NOT `include`) for relations we summarize; round-trip ceiling ≤ 12 (was ≤ 8); `reviewVelocity` derivation reuses the same `GoogleReview` rows fetched for BANT timing, no new query.
18. **Lazy companion endpoints (`/review-intel`, `/website-intel`) reintroduce the N+1 we wanted to avoid** → likelihood M, impact M → mitigation: each lazy endpoint has its own integration test asserting query count ≤ 4; endpoints fire only on block expand (not on first paint); both routes are workspace-scoped per `multi-tenant-scope.mdc` with the same audit checklist as the aggregator.
19. **Phase 8 review-volume trigger fires false positives on micro-volume restaurants (5 reviews → 8 reviews registers as +60% surge)** → likelihood M, impact L → mitigation: hard guards `recent30dCount >= 8` and `prior30dCount >= 5`, plus the existing rule-A guard of ≥ 6 total reviews; sanity-check rule on a 100-fixture sample from a PROD snapshot before flipping the rule on for all workspaces; rollback = turn off detector rule, UI fallback to derived `ReviewVelocityBadge` from Phase 3.
20. **Phase 3 derived `ReviewVelocityBadge` and Phase 8 trigger row disagree on the same lead because they read different windows** → likelihood L, impact M → mitigation: both consume the same window math (last-30d vs prior-30d); shared helper in `src/lib/lead-detail/review-velocity.ts` (created in Phase 3, reused by detector in Phase 8); regression test asserts agreement on fixtures.

---

## 7. Out-of-scope (this plan doesn't touch)

- **Websocket / SSE push** to replace the 2s NBA polling. The polling shape is preserved end-to-end.
- **Real-time multi-user "Alex is viewing" badge.** Brief mentions, plan defers — V3.
- **On-device speech-to-text** for voice notes. Server-side transcription stays.
- **Workers panel UX redesign.** Phase 6 only relocates; the panel itself is untouched.
- **Account-level rollups of BANT / MEDDPICC** across all sister leads.
- **Cross-workspace insight propagation** (only within a workspace).
- **Full reasoning-graph editor** (read-only renderer in phase 7).
- **`/app/wins`** workspace-level retro/LEARN view. The rethink rightly removes it from the lead page; building it is a separate plan.
- **Stripe / billing** changes. Plan tiers as written today.
- **Migrating off Webpack to Turbopack** for faster `next dev`.
- **PWA install prompts, offline mode, native shell.**
- **Replacing the existing 5-tab page bytes** (kept as a flag-off branch through phase 7+1).
- **Re-architecting the AI-Workers panel.**
- **Worker key rotation** that affects final NBA latency (a known production concern, addressed elsewhere).
- **Marketing-site copy** for "What's new in lead detail v2."

---

## 8. Open decisions blocking the plan

These need a decision from the founder before phase 1 ships. (Distinct from the rethink's nine open questions; those are design/implementation calls. These are go/no-go for the plan.)

1. **Phase 0 flag location: env-only vs workspace-row.** If we add a `WorkspaceFeatureFlag` model now, it costs a migration. Recommendation: env-only allow-list for phase 0; migrate to a row in phase 7. Need user sign-off because the allow-list lives in code and requires a deploy to flip per-workspace.
2. **Are we OK with a single nullable schema add (`Lead.snoozeUntilTriggerType: LeadTriggerType?`) being the entire DDL footprint of this plan?** If the founder wants more (e.g. an explicit `LeadDailyRank` table for queue ordering), phase 3 grows materially.
3. **Aggregator-vs-N-route policy.** Phase 2 introduces `/decision-surface` as the union read. The alternative is keeping the existing endpoint zoo (`/next-action`, `/account`, `/intelligence-brief`, `/voice-notes`, ...). Recommendation: aggregator. Need a decision because it reshapes how the existing endpoint zoo is touched in future work.
4. **Per-rep vs per-workspace queue (rethink Q1).** Plan assumes per-rep with optimistic claim. If the founder wants per-workspace optimistic claim, phase-3 queue endpoint shape changes.
5. **Auto-`WatchlistItem` creation on first `DealQualificationFact` (rethink Q9).** Plan assumes yes (so MEDDPICC is visible on COLD leads once any fact arrives). If the founder wants strict opt-in, phase 2 changes — MEDDPICC stays empty on COLD until the rep clicks "track."
6. **Plan-tier gating mapping in §5.3.** Specifically: should sister-lead account view be PRO or PRO_TEAM? Plan says PRO_TEAM. Need confirmation because it affects pricing-page copy.
7. **Two-release vs one-release deprecation window for the legacy `?tab=workers` URL.** Plan assumes two releases. Faster removal means risk of broken email/Slack links.
8. **Telemetry vendor: PostHog only?** Plan assumes yes. If GA4 / Mixpanel / Segment needs to be added, the typed catalog in phase 7 grows transports.
9. **Mobile breakpoint policy.** Plan assumes 640px. If the founder wants 768px (matches Tailwind `md`), phase 5 wireframe assumptions shift.
10. **Whether the rethink's `/app/wins` route is in or out of this plan.** Plan keeps it out (§7). If it's in, Phase 8 needs to be added.

---

## 9. Suggested first PR

**Branch:** `lead-detail-v2/phase-0-foundations`.

**Diff scope (commit-able):**
- `src/lib/feature-flags.ts` (new) — flag resolver.
- `src/lib/lead-detail/use-pipeline-stage.ts` (new) — stage hook + expand-rules table.
- `src/lib/lead-detail/legacy-hash-redirect.ts` (new) — legacy hash mapping.
- `src/components/app/lead-detail-v2/LeadDetailV2Client.tsx` (new) — placeholder.
- `src/components/app/lead-detail-v2/Block.tsx` (new) — primitive.
- `src/components/app/lead-detail-v2/StickyShell.tsx` (new) — layout shell.
- `src/components/app/lead-detail-v2/HeaderBar.tsx` (new, header-only) — minimal.
- `src/app/app/leads/[id]/page.tsx` (modified) — split into `LegacyLeadDetailClient` + flag wrapper.
- `src/__tests__/lead-detail/feature-flag.test.ts` (new).
- `src/__tests__/lead-detail/legacy-hash-redirect.test.ts` (new).
- `tests/e2e/lead-detail-flag.spec.ts` (new).

**Screenshot/proof requirement:**
- Screenshot 1: legacy 5-tab page on `?v=1` — looks identical to today's prod.
- Screenshot 2: v2 placeholder on `?v=2` — shows "Lead Detail v2 — coming soon" inside `StickyShell`.
- Screenshot 3: cookie toggle in browser devtools flips the surface without a hard reload.
- Test output: `npm run test src/__tests__/lead-detail/` green.
- Test output: `npm run lint` green.

**Rollback procedure:**
- If `LEAD_DETAIL_V2_DEFAULT=off` (default): no users see v2. Cookie + URL override gated to `leadac.app/internal` allow-listed users.
- If anything regresses on `?v=1`: revert the single PR. Legacy bytes are unchanged in semantics; only the export name is renamed.
- DB: no rollback needed — zero schema in phase 0.
- Workers: no rollback needed — zero worker change in phase 0.

— end of plan —
