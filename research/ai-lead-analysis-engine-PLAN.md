# AI Lead Analysis Engine — Improved Implementation Plan

Date: 2026-05-30
Owner: Product + Engineering
Status: Ready for implementation

## Vision

This is not a lead analysis card bolted onto the lead detail page. This is the execution spine of
LeadAC — the system that turns raw signals from Openmart, Google Places, Apify, website audits,
and review corpora into a grounded Account Intelligence Brief, and learns from every outcome.
Every other LeadAC surface depends on this engine.

The rep experience is a visible agent run:

- Click `Analyze with AI` (or `Force Refresh` to bypass cached intelligence).
- The system inspects the lead, classifies its sub-niche, selects only the relevant tools.
- A live timeline shows each step: what ran, why, what it found, what it is skipping and why.
- The final output is a fully sourced Account Intelligence Brief: fit score, digital stack map,
  operational pain, contact intelligence, pitch angle, recommended package, risk flags.
- Every claim carries a source and a reliability tier. Unsupported hypotheses are labeled as such.
- The brief writes back to the lead's fields and enqueues a HubSpot sync.
- When outcomes arrive (reply, booked, closed-won, closed-lost), the playbook learns.

## Product Non-Negotiables

1. One visible button: `Analyze with AI`. Force refresh is a secondary affordance on the same button.
2. No Workers tab in the lead detail UI.
3. No settings page for users to configure analysis workers.
4. The analysis plan is lead-specific and sub-niche-aware. No fixed all-leads chain.
5. Tool selection is registry + schema + deterministic guards first, LLM arbitration second.
6. Every claim in the brief must carry a T1 or T2 evidence citation, or be explicitly labeled as
   T3 inference or T4 hypothesis. The evidence enforcer rejects uncited claims before brief assembly.
7. Every workspace-owned DB query is scoped by `workspaceId`.
8. No new BullMQ queue. Use `agent-runs`.
9. No Gemini calls in API routes. All model calls live under AI Core or agent-worker modules.
10. New code imports Prisma types from `@/generated/prisma/client`, never `@prisma/client`.
11. Openmart and other external APIs must degrade gracefully when keys are missing.
12. The Account Intelligence Brief is the canonical artifact. A bare score is not sufficient output.

## Three-Layer Architecture

```
+-------------------------------------------------------------+
|  LAYER 3 - EVIDENCE CHAIN FOUNDATION                        |
|  Every claim has a reliability tier. No output without      |
|  cited evidence. Confidence propagates through the DAG.     |
+-------------------------------------------------------------+
|  LAYER 2 - VERTICAL ONTOLOGY GATE                           |
|  Sub-niche classifier runs first. Tool selection, evidence  |
|  weights, and playbook rules are all sub-niche-aware.       |
+-------------------------------------------------------------+
|  LAYER 1 - DYNAMIC TOOL GRAPH                               |
|  All workers and external APIs are callable tools.          |
|  Planner orchestrates. Source reconciler resolves conflicts. |
+-------------------------------------------------------------+
```

## Execution Flow

```
Rep clicks "Analyze with AI"
    |
    v
POST /api/leads/[id]/analysis-runs { forceRefresh?: boolean }
    |
    v
[S1] Snapshot Builder
     - Aggregate all fresh DB data + memory scoped by workspaceId
     - Check freshness per tool (stale = needs re-run)
     - forceRefresh bypasses all freshness checks
    |
    v
[S2] Sub-Niche Classification (planning step, not a counted execution tool)
     - Re-use fresh SUBVERTICAL_CLASSIFIER output or re-run it
     - Determines sub-niche: fine_dining / cafe / ghost_kitchen / bar
       / chain / hotel_restaurant / qsr / independent_casual
     - All downstream tool selection and evidence weighting depends on this
    |
    v
[S3] Deterministic Candidate Selector
     - Sub-niche-aware selection rules
     - Playbook graph queried: which signals matched for this sub-niche?
     - Outputs: candidates, forced, skipped (with reasons for each)
    |
    v
[S4] Planner Arbitration (Gemini structured output)
     - Receives: snapshot, sub-niche, candidates, playbook match
     - Outputs: validated DAG with step dependencies and priorities
     - Falls back to deterministic selector if Gemini fails
     - Cannot invent tools; output validated against registered tool keys
    |
    v
[S5] Tool Graph Execution via orchestrator + agent-runs queue

  TIER A: Data Collection (parallel)
  -----------------------------------------------------------------------
  openmart_enrichment      OPENMART_ENRICHMENT      owner/contact/tech stack

  TIER B: Signal Analysis (parallel, after Tier A)
  -----------------------------------------------------------------------
  website_audit            WEBSITE_AUDITOR           booking, mobile, speed, CTAs
  review_analysis          REVIEW_ANALYST            pain KPIs, sentiment, switch signals
  booking_friction         BOOKING_FRICTION_DETECTOR deterministic friction score 0-100
  chain_detection          ACCOUNT_TIER_RANKER       chain vs independent, locationCount

  TIER C: Source Reconciliation (after Tier A + B)
  -----------------------------------------------------------------------
  source_reconciliation    SOURCE_RECONCILER         canonical values + provenance
                                                     conflict surfacing

  TIER D: Scoring (parallel, after Tier C)
  -----------------------------------------------------------------------
  icp_fit                  ICP_SCORER                fit score + dimension reasons
  opportunity_scoring      SALES_OPPORTUNITY_SCORER  opportunity score + pain map + package

  TIER E: Synthesis (after Tier D)
  -----------------------------------------------------------------------
  outreach_angles          OUTREACH_ANGLE_GENERATOR  3 grounded angles + opener seeds

  TIER F: Brief Assembly (final step)
  -----------------------------------------------------------------------
  account_brief            ACCOUNT_BRIEF_WRITER      assembles AccountIntelligenceBrief
                                                      evidence enforcer is the final gate
    |
    v
[S6] Write-back
     - Lead.salesConfidence updated
     - Lead.intelligenceBriefVersion bumped
     - LeadNextAction created / updated from recommendedNextAction
     - HubSpot sync enqueued (if workspace connected)
    |
    v
[S7] Outcome Learning (async, triggered by HubSpot/sender events)
     - Deal stage changes -> PlaybookRule.weight + winCount / lossCount updated
     - Reply / bounce / booked events -> same learning path
     - outcomeJson + outcomeAt written to LeadAnalysisRun
```

## V1 Tool Catalog (10 execution tools)

| # | Tool key | Worker | New/Existing | Tier |
|---|----------|--------|-------------|------|
| 1 | `openmart_enrichment` | `OPENMART_ENRICHMENT` | New | A |
| 2 | `website_audit` | `WEBSITE_AUDITOR` | Existing | B |
| 3 | `review_analysis` | `REVIEW_ANALYST` | Existing | B |
| 4 | `booking_friction` | `BOOKING_FRICTION_DETECTOR` | New | B |
| 5 | `chain_detection` | `ACCOUNT_TIER_RANKER` | Existing | B |
| 6 | `source_reconciliation` | `SOURCE_RECONCILER` | New | C |
| 7 | `icp_fit` | `ICP_SCORER` | Existing | D |
| 8 | `opportunity_scoring` | `SALES_OPPORTUNITY_SCORER` | Existing | D |
| 9 | `outreach_angles` | `OUTREACH_ANGLE_GENERATOR` | New | E |
| 10 | `account_brief` | `ACCOUNT_BRIEF_WRITER` | New | F |

Sub-niche classification (`SUBVERTICAL_CLASSIFIER`) runs at Step S2 (planning), not counted here.

New workers to build: `OPENMART_ENRICHMENT`, `BOOKING_FRICTION_DETECTOR`, `SOURCE_RECONCILER`,
`OUTREACH_ANGLE_GENERATOR`, `ACCOUNT_BRIEF_WRITER`.

## V1.1 Tool Catalog (deferred, in registry but not scheduled by default)

| Tool key | Worker | Reason deferred |
|----------|--------|----------------|
| `orbital_enrichment` | `ORBITAL_ENRICHMENT` | Orbital API integration, needs separate setup |
| `social_profile_check` | `SOCIAL_SCRAPER` | Adds value but not blocking V1 brief quality |
| `trigger_detection` | `TRIGGER_DETECTOR` | High value; schedule after V1 stable |
| `bant_inference` | `BANT_INFERRER` | Needs enough signals; add when call data is wired |
| `commercial_insight` | `COMMERCIAL_INSIGHT_MATCHER` | Requires opportunity score + review history |
| `why_now_synthesis` | `WHY_NOW_SYNTHESIZER` | Requires trigger signals; blocked on trigger_detection |
| `lookalike_analysis` | `LOOKALIKE_ANALYST` | Requires LEAD_PROFILE memory to exist first |

## Evidence Tier System

Every value produced by a tool carries a reliability tier. This is the foundation that prevents
hallucination at every layer of the brief.

| Tier | Name | Example | Output rule |
|------|------|---------|-------------|
| T1 | Direct observation | Website crawl result, review text, DB field value | Always cite source |
| T2 | Deterministic rule | "No booking button found in crawl" | Always cite rule + T1 basis |
| T3 | Model inference | "Likely independent restaurant based on name pattern" | Label as inference |
| T4 | Hypothesis | "May benefit from loyalty program given segment" | Label as hypothesis |

The `ACCOUNT_BRIEF_WRITER` runs the evidence enforcer before writing any brief field:

- A T4-only claim with no T3 or higher anchor is dropped, not included.
- A T3 claim with no T1/T2 basis is dropped.
- A T3 claim with a T1/T2 basis is included but labeled as inference.
- Only T1/T2-grounded claims are presented as facts.

The evidence enforcer is unit-tested independently. It is the quality gate for the entire system.

## Source Reconciliation

When Openmart and Google Places and the website audit all return different values for the same
field, the `SOURCE_RECONCILER` does not silently pick one. It assigns:

- **Canonical value**: most specific + highest-confidence source wins per field.
- **Provenance chain**: `[{ source, value, confidence, retrievedAt }]` per field.
- **Conflict flag**: when sources disagree beyond threshold, the conflict is surfaced in the brief
  under `sourceConflicts[]` so the rep can see it rather than trust a silently wrong value.

Source confidence hierarchy (descending):
T1 direct crawl > Openmart verified > Google Places scraped > Apify extracted > model inference.

## Playbook Graph

The playbook is a set of `PlaybookRule` rows per workspace, scoped to sub-niche + signal pattern.

Seed rules from the FineDine project:

```
fine_dining + no_booking_provider + high_review_count  ->  reservation optimization angle
pdf_menu + premium_branding + high_instagram           ->  branded digital menu angle
chain_detected + multiple_locations                    ->  central menu governance + analytics angle
low_rating + service_wait_mentions + cafe              ->  order-ahead + queue reduction angle
delivery_dependency + ghost_kitchen                    ->  direct ordering + commission reduction angle
```

Rules have `source = "seed"` initially. When outcomes arrive, the learning layer updates `weight`,
`winCount`, and `lossCount`. Rules with enough validated outcomes are promoted to `source = "learned"`.

At planning time the planner queries playbook rules matching sub-niche + signal pattern and uses
the matched rule's `recommendedAngle` and `recommendedPackage` as a strong prior.

## New Domain Model

### LeadAnalysisRun

```prisma
enum LeadAnalysisRunStatus {
  PLANNING
  RUNNING
  SUCCEEDED
  PARTIAL
  FAILED
  CANCELLED
}

model LeadAnalysisRun {
  id                  String                @id @default(cuid())
  workspaceId         String                @map("workspace_id")
  leadId              String                @map("lead_id")
  userId              String?               @map("user_id") @db.Uuid
  plannerSessionId    String?               @map("planner_session_id")
  status              LeadAnalysisRunStatus @default(PLANNING)

  // Planning
  subNiche            String?               @map("sub_niche")
  planJson            Json                  @default("[]") @map("plan_json")
  toolSelectionJson   Json                  @default("{}") @map("tool_selection_json")
  playbookRulesJson   Json                  @default("[]") @map("playbook_rules_json")
  leadSnapshotJson    Json                  @default("{}") @map("lead_snapshot_json")
  forceRefresh        Boolean               @default(false) @map("force_refresh")

  // Results
  reconciledDataJson  Json                  @default("{}") @map("reconciled_data_json")
  briefJson           Json?                 @map("brief_json")
  finalScore          Int?                  @map("final_score")
  confidence          Float?
  costTokens          Int                   @default(0) @map("cost_tokens")
  costUsdCents        Int                   @default(0) @map("cost_usd_cents")

  // Outcome learning
  outcomeJson         Json?                 @map("outcome_json")
  outcomeAt           DateTime?             @map("outcome_at")

  errorMsg            String?               @map("error_msg") @db.Text
  startedAt           DateTime?             @map("started_at")
  completedAt         DateTime?             @map("completed_at")
  createdAt           DateTime              @default(now()) @map("created_at")
  updatedAt           DateTime              @updatedAt @map("updated_at")

  workspace           Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  lead                Lead                  @relation(fields: [leadId], references: [id], onDelete: Cascade)
  plannerSession      PlannerSession?       @relation(fields: [plannerSessionId], references: [id], onDelete: SetNull)
  events              LeadAnalysisTimelineEvent[]

  @@index([workspaceId, leadId, createdAt])
  @@index([workspaceId, status, createdAt])
  @@map("lead_analysis_runs")
}
```

### LeadAnalysisTimelineEvent

```prisma
enum LeadAnalysisEventType {
  SNAPSHOT
  SUBNICHE_CLASSIFIED
  PLAN
  TOOL_STARTED
  TOOL_SKIPPED
  TOOL_SUCCEEDED
  TOOL_FAILED
  RECONCILIATION
  EVIDENCE
  INFERENCE
  FINAL_BRIEF
}

model LeadAnalysisTimelineEvent {
  id                  String                @id @default(cuid())
  workspaceId         String                @map("workspace_id")
  leadAnalysisRunId   String                @map("lead_analysis_run_id")
  leadId              String                @map("lead_id")
  agentRunId          String?               @map("agent_run_id")
  stepId              String?               @map("step_id")
  toolKey             String?               @map("tool_key")
  analysisTier        String?               @map("analysis_tier")
  type                LeadAnalysisEventType
  status              String?
  title               String
  rationale           String?               @db.Text
  evidenceJson        Json                  @default("[]") @map("evidence_json")
  payloadJson         Json                  @default("{}") @map("payload_json")
  occurredAt          DateTime              @default(now()) @map("occurred_at")
  sortIndex           Int                   @map("sort_index")

  analysisRun         LeadAnalysisRun       @relation(fields: [leadAnalysisRunId], references: [id], onDelete: Cascade)
  lead                Lead                  @relation(fields: [leadId], references: [id], onDelete: Cascade)
  agentRun            AgentRun?             @relation(fields: [agentRunId], references: [id], onDelete: SetNull)

  @@index([workspaceId, leadAnalysisRunId, sortIndex])
  @@index([workspaceId, leadId, occurredAt])
  @@map("lead_analysis_timeline_events")
}
```

### PlaybookRule

```prisma
model PlaybookRule {
  id                  String    @id @default(cuid())
  workspaceId         String    @map("workspace_id")
  subNiche            String    @map("sub_niche")
  signalPattern       Json      @map("signal_pattern")
  recommendedAngle    String    @map("recommended_angle")
  recommendedPackage  String?   @map("recommended_package")
  weight              Float     @default(1.0)
  winCount            Int       @default(0) @map("win_count")
  lossCount           Int       @default(0) @map("loss_count")
  source              String    @default("seed")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  workspace           Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, subNiche])
  @@map("playbook_rules")
}
```

Schema notes:
- Add relation arrays to `Workspace`, `Lead`, `PlannerSession`, and `AgentRun`.
- Run `npm run db:push` and `npm run db:generate` after schema edits.

## Account Intelligence Brief Shape

Primary artifact. Stored as `briefJson` on `LeadAnalysisRun`. Evidence enforcer validates
every field before the brief is persisted.

```ts
interface AccountIntelligenceBrief {
  // Identity
  accountName: string;
  subNiche: string;
  subNicheConfidence: number;
  isChain: boolean;
  locationCount: number | null;
  chainGroupName: string | null;

  // Fit
  fitScore: number;                          // 0-100 deterministic weighted score
  fitLabel: "Strong" | "Moderate" | "Weak" | "Disqualified";
  fitConfidence: number;                     // degrades when key signals missing
  fitSummary: string;                        // evidence-grounded, no unsupported claims
  fitComponents: FitComponent[];             // per-dimension with evidence

  // Digital stack
  detectedStack: StackItem[];
    // { module, provider, confidence, evidenceTier, source, detectedAt }
  missingModules: MissingModule[];
    // { module, impact, evidence: EvidenceRef[] }

  // Operational pain
  reviewDerivedPain: PainPoint[];            // grounded in review corpus with quotes
  websiteFindings: WebsiteFinding[];         // crawl-based, T1/T2 only
  bookingFriction: BookingFrictionResult | null;

  // Contact intelligence
  contacts: ContactCandidate[];
    // { name, role, email, phone, linkedinUrl, confidence, source, provenance }
  sourceConflicts: SourceConflict[];         // surfaced, not hidden

  // Recommendations
  recommendedNextAction: string;
  recommendedPitchAngle: string;
  recommendedPackage: string | null;
  playbookRuleMatched: string | null;
  playbookRuleSource: "seed" | "learned" | null;

  // Outreach
  outreachAngles: OutreachAngle[];
    // { title, openingLine, whyThisWorks, evidence: EvidenceRef[], risk, playbookAligned }
  doNotSay: string[];

  // Provenance + trust
  sourceProvenance: Record<string, SourceProvenanceEntry[]>;
  riskFlags: RiskFlag[];
  evidenceGaps: string[];
  hypotheses: string[];

  // Metadata
  analysisVersion: number;
  forceRefreshed: boolean;
  toolsRun: string[];
  toolsSkipped: Array<{ key: string; reason: string }>;
  costTokens: number;
  costUsdCents: number;
}
```

## Core Type Layer

Files under `src/lib/lead-analysis/`:

| File | Responsibility |
|------|---------------|
| `types.ts` | Shared types: `LeadAnalysisSnapshot`, `CandidateTool`, `SkippedTool`, `AnalysisTier` |
| `evidence.ts` | `EvidenceRef`, tier constants, citation helpers, confidence math |
| `evidence-enforcer.ts` | Validates claims against tier requirements, rejects violations |
| `snapshot.ts` | Workspace-scoped snapshot from DB + memory |
| `playbook-query.ts` | Queries `PlaybookRule` by sub-niche + signal pattern |
| `selector.ts` | Deterministic candidate selection, sub-niche-aware freshness rules |
| `planner.ts` | Gemini arbitration; fallback to selector; DAG validation |
| `tool-contracts.ts` | Contract definitions for all 10 V1 tools |
| `timeline.ts` | Helpers for writing timeline events from worker output |
| `source-reconciler.ts` | Pure conflict resolution logic (used by SOURCE_RECONCILER worker) |
| `finalize.ts` | Deterministic fit score computation |
| `outcome-learner.ts` | Updates PlaybookRule weights from HubSpot/sender outcomes |

## Evidence Reference

```ts
export interface EvidenceRef {
  tier: 1 | 2 | 3 | 4;
  kind:
    | "lead_field"
    | "website_crawl"
    | "review_text"
    | "review_analysis"
    | "agent_run"
    | "openmart_record"
    | "google_places"
    | "semantic_memory"
    | "deterministic_rule"
    | "model_inference"
    | "playbook_rule";
  refId?: string | null;
  label: string;
  quote?: string | null;
  url?: string | null;
  source?: string | null;
  confidence: number;
  retrievedAt?: string | null;
}
```

## Tool Contract Interface

```ts
export interface LeadAnalysisToolContract {
  key: LeadAnalysisToolKey;
  workerKind: AgentWorkerKind;
  analysisTier: "A" | "B" | "C" | "D" | "E" | "F";
  label: string;
  purpose: string;
  requires: Array<
    | "lead" | "website" | "reviews" | "icp"
    | "servicePackages" | "reconciled_data"
    | "subNiche" | "playbookMatch"
  >;
  produces: Array<
    | "contactSignals" | "websiteSignals" | "reviewSignals"
    | "frictionScore" | "fitScore" | "opportunityScore"
    | "canonicalData" | "outreachAngles" | "brief"
  >;
  externalApi: "none" | "apify" | "openmart" | "gemini" | "google_places";
  estimatedCostUsdCents: number;
  minPlan: Plan;
  freshnessTtlHours: number;
  optional: boolean;
  precondition: (snapshot: LeadAnalysisSnapshot) => ToolPreconditionResult;
  evidencePolicy: EvidencePolicy;
  subNicheWeights?: Partial<Record<SubNiche, number>>;
}
```

## Tool Catalog Detail

### Tier A — Data Collection

#### openmart_enrichment
- Worker: `OPENMART_ENRICHMENT` (new)
- Runs when: contact density is low or no strong stakeholder data
- Skips when: `OPENMART_API_KEY` missing — graceful, never fails the whole analysis
- Output: company profile, contact candidates with confidence, social URLs, evidence chain
- Evidence tier: T1 for Openmart-verified fields, T3 for inferred contacts
- V1 persistence: `AgentRun.outputJson` + timeline evidence only. No new contact tables.
- Add quota row in `src/lib/agent-workers/quota.ts`

### Tier B — Signal Analysis

#### website_audit
- Worker: `WEBSITE_AUDITOR` (existing)
- Runs when: lead has websiteUrl and audit is stale (> 7 days) or missing
- Skips when: no website URL and verification says absent
- Output: booking provider, mobile load, CTAs, social links, services detected, T1/T2

#### review_analysis
- Worker: `REVIEW_ANALYST` (existing)
- Runs when: review corpus >= 5 and analysis is stale or corpus changed
- Skips when: review count below threshold
- Sub-niche weight: elevated for fine_dining, bar, ghost_kitchen
- Output: pain KPIs, switch signals, sentiment, strength KPIs

#### booking_friction
- Worker: `BOOKING_FRICTION_DETECTOR` (new)
- Runs when: website audit exists or can run first
- Score is deterministic 0-100. Gemini may only summarize recommendations, not assign the score.
- All findings must cite audit fields (T1/T2 only for score; T3 allowed for recommendations)
- Output: `{ frictionScore, severity, provider, findings[], recommendedFixes[], evidence[] }`

#### chain_detection
- Worker: `ACCOUNT_TIER_RANKER` (existing)
- Runs on every analysis
- Critical: prevents independent-restaurant pitch being applied to a chain account
- Output: tier (independent / group / chain / franchise), locationCount, chainGroupName

### Tier C — Source Reconciliation

#### source_reconciliation
- Worker: `SOURCE_RECONCILER` (new)
- Runs after Tier A + B (at least one Tier A must have succeeded)
- Inputs: Openmart output, Google Places data, website audit
- Output: `{ canonicalFields, sourceConflicts[], evidence[] }`
- Source confidence priority: T1 direct crawl > Openmart verified > Google Places scraped
  > Apify extracted > model inference
- Conflicts are surfaced in the brief, not hidden

### Tier D — Scoring

#### icp_fit
- Worker: `ICP_SCORER` (existing)
- Runs on every analysis — anchor for the final score
- Inputs: reconciled data, ICP row, sub-niche, audit/review signals
- Output: fit score 0-100, dimension breakdown with evidence
- Deterministic; no LLM call

#### opportunity_scoring
- Worker: `SALES_OPPORTUNITY_SCORER` (existing)
- Runs when: audit/review/ICP signals changed or no fresh score exists
- Inputs: reconciled data, review analysis, service packages
- Output: opportunity score, pain map, recommended package, best sales angle

### Tier E — Synthesis

#### outreach_angles
- Worker: `OUTREACH_ANGLE_GENERATOR` (new)
- Runs after Tier D; inputs are all prior tool outputs + playbook rule match
- Output: `{ angles[], doNotSay[], recommendedAngleIndex }`
- Validation: reject if `angles.length === 0`; reject any angle without evidence
- Reject unsupported claims like "no booking system" unless website audit confirms it
- Angles aligned with matched playbook rule are flagged `playbookAligned: true`

### Tier F — Brief Assembly

#### account_brief
- Worker: `ACCOUNT_BRIEF_WRITER` (new)
- Runs last; partial input is allowed (not all tiers need to have succeeded)
- Collects all tool outputs from `AgentRun.outputJson` via `leadAnalysisRunId`
- Runs `finalize.ts` for deterministic fit score
- Assembles full `AccountIntelligenceBrief`
- Evidence enforcer validates every field before persisting
- Writes `briefJson` to `LeadAnalysisRun`, emits `FINAL_BRIEF` timeline event

### Deterministic Fit Score

File: `src/lib/lead-analysis/finalize.ts`

Weights across components present in a given run:

| Component | Base weight | Required to be present |
|-----------|------------|----------------------|
| ICP fit | 30% | Yes (always runs) |
| Opportunity score | 25% | When SALES_OPPORTUNITY_SCORER succeeded |
| Booking/provider friction | 20% | When BOOKING_FRICTION_DETECTOR succeeded |
| Review pain/switch signals | 15% | When REVIEW_ANALYST succeeded |
| Chain/account tier | 10% | When ACCOUNT_TIER_RANKER succeeded |

Rules:
- Normalize weights across present components when some are missing.
- Confidence decreases proportionally for each missing component.
- Sub-niche overrides: fine_dining boosts review weight; ghost_kitchen boosts booking weight.
- Playbook-matched rule boosts confidence by +5% (capped at 0.95).
- Final score is stable for fixed inputs — deterministic, not LLM-generated.

## Snapshot Builder

File: `src/lib/lead-analysis/snapshot.ts`

```ts
interface LeadAnalysisSnapshot {
  workspaceId: string;
  leadId: string;
  forceRefresh: boolean;
  subNiche: string | null;
  subNicheConfidence: number | null;
  subNicheFreshHours: number | null;

  // Lead core
  hasWebsiteUrl: boolean;
  websiteVerificationStatus: string | null;
  reviewCount: number;
  hasPlaceId: boolean;
  formattedAddress: string | null;

  // Tool freshness (hours since last successful run, null = never run)
  freshness: Record<LeadAnalysisToolKey, number | null>;

  // Existing output summaries
  websiteAuditSummary: WebsiteAuditSummary | null;
  reviewAnalysisSummary: ReviewAnalysisSummary | null;
  opportunityScoreSummary: OpportunityScoreSummary | null;

  // Contact density
  contactDensity: "none" | "low" | "medium" | "high";
  hasVerifiedEmail: boolean;
  hasPhone: boolean;

  // Memory
  hasLeadProfile: boolean;

  // Workspace
  plan: Plan;
  hasOpenmart: boolean;
  hasHubspot: boolean;
  servicePackages: ServicePackageSummary[];

  // Quota
  quotaRemainingCents: number;
  budgetCapCents: number;
}
```

Every query in the snapshot builder includes `workspaceId` in the `where` clause.

## Dynamic Planner Design

### Layer 1: Deterministic Candidate Selector

File: `src/lib/lead-analysis/selector.ts`

Rules:
- Always include: `icp_fit`, `chain_detection`.
- Include `subvertical_classify` if sub-niche is missing or stale.
- Include `openmart_enrichment` when `hasOpenmart` and contact density is low.
- Include `website_audit` when URL exists and audit is stale/missing.
- Include `review_analysis` when review corpus >= 5 and analysis is stale.
- Include `source_reconciliation` when `openmart_enrichment` is in the candidate set.
- Include `booking_friction` after `website_audit` or when audit already exists.
- Include `opportunity_scoring` when audit/review/ICP signals changed or no fresh score.
- Include `outreach_angles` as synthesis step unless no Tier B tools succeeded.
- Always include `account_brief` as the terminal step.

Sub-niche overrides:
- `fine_dining`: boost review_analysis priority; boost booking_friction priority
- `ghost_kitchen`: boost opportunity_scoring; delivery_dependency angle seeded
- `chain`: force chain_detection first; suppress individual-restaurant pitch angles
- `cafe`: boost website_audit for social link extraction

Force refresh: every tool treated as stale, all freshness checks bypassed.

### Layer 2: Playbook Query

File: `src/lib/lead-analysis/playbook-query.ts`

Query `PlaybookRule` by `workspaceId` + `subNiche` + `signalPattern` overlap.
Return top 3 by `weight DESC`. Pass as `playbookContext` to planner.

The planner uses matched rules to:
- Seed `recommendedPitchAngle` and `recommendedPackage` in brief assembly
- Flag outreach angles as `playbookAligned: true` when they match a rule

### Layer 3: Planner Arbitration

File: `src/lib/lead-analysis/planner.ts`

Gemini receives: snapshot, sub-niche + confidence, candidate tools (keys + purpose + cost +
dependencies), playbook context, max cost budget, "skip this tool" option per candidate.
Cannot invent tools. Output validated against registered V1 tool keys.

Post-validation: drop unknown keys; enforce tier order (A -> B -> C -> D -> E -> F);
enforce quota/plan limits; enforce freshness unless forceRefresh; write skipped timeline events.

If Gemini fails: use deterministic selector output directly.

## AI Core Integration

Add to `src/lib/agent-workers/types.ts`:

```ts
| "lead_analysis_requested"
```

`planFromEvent("lead_analysis_requested")` calls `planLeadAnalysis()`. Static `CHAINS` is not
modified.

`planLeadAnalysis()`:
1. Creates `LeadAnalysisRun`
2. Builds snapshot
3. Classifies sub-niche (re-use or re-run)
4. Queries playbook
5. Runs selector + planner arbitration
6. Creates `PlannerSession` with validated DAG
7. Writes `SNAPSHOT`, `SUBNICHE_CLASSIFIED`, and `PLAN` timeline events
8. Enqueues orchestrator advance

Every `AgentRun.inputsJson` for analysis steps carries:
- `leadAnalysisRunId`
- `toolKey`
- `analysisTier`
- `analysisStepId`

Timeline hook in `src/lib/agent-workers/execute.ts`: when `leadAnalysisRunId` is present in
`inputsJson`, call helpers from `src/lib/lead-analysis/timeline.ts` to write `TOOL_STARTED`,
`TOOL_SUCCEEDED`, `TOOL_FAILED`, `TOOL_SKIPPED` events.

## API Routes

### POST /api/leads/[id]/analysis-runs

- Auth: `requireUser()`
- Validate lead: `findFirst({ id, workspaceId })`
- Body: `{ forceRefresh?: boolean }`
- Reject duplicate active run unless `forceRefresh = true`
- Create run, build snapshot, plan, create `PlannerSession`, enqueue advance
- Return: `{ analysisRunId, plannerSessionId, status, subNiche, toolsSelected }`

### GET /api/leads/[id]/analysis-runs

Latest analysis run for lead with timeline preview and brief summary.

### GET /api/leads/[id]/analysis-runs/[runId]

Scoped by `workspaceId + leadId + runId`.
Returns: status, briefJson, timeline events ordered by sortIndex, cost, retryability flags.

### GET /api/leads/[id]/analysis-runs/[runId]/stream (SSE)

Server-sent events while run is PLANNING or RUNNING.
Emits: `timeline_event`, `status_change`, `brief_ready`.
Client gracefully falls back to 2s polling if SSE fails.

### POST /api/leads/[id]/analysis-runs/[runId]/cancel (V1.1)
### POST /api/leads/[id]/analysis-runs/[runId]/retry (V1.1)

## New Worker Implementations

### OPENMART_ENRICHMENT
Files: `src/lib/agent-workers/openmart-enrichment.ts` + test

Output:
```ts
{
  skipped?: boolean;
  reason?: string;
  company?: { name: string; domain: string | null; profileUrl: string | null };
  contacts: Array<{
    name: string | null; role: string | null; email: string | null;
    phone: string | null; linkedinUrl: string | null;
    confidence: number; evidence: EvidenceRef[];
  }>;
  socials: Array<{ platform: string; url: string; confidence: number }>;
  evidence: EvidenceRef[];
}
```

Add quota row. Skip gracefully when `OPENMART_API_KEY` missing.

### BOOKING_FRICTION_DETECTOR
Files: `src/lib/agent-workers/booking-friction-detector.ts` + test

Score is deterministic 0-100. Gemini summarizes recommendations only; it does not assign score.
All findings cite audit fields (T1/T2 for score; T3 allowed for recommendations).

Output:
```ts
{
  frictionScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  provider: string | null;
  findings: Array<{ code: string; label: string; impact: string; evidence: EvidenceRef[] }>;
  recommendedFixes: string[];
  evidence: EvidenceRef[];
}
```

### SOURCE_RECONCILER
Files: `src/lib/agent-workers/source-reconciler.ts`
       `src/lib/lead-analysis/source-reconciler.ts` (pure logic, no Prisma)
       `src/__tests__/lead-analysis/source-reconciler.test.ts`

Pure logic lives in the helper; the worker wraps it with AgentRun context.

Output:
```ts
{
  canonicalFields: Record<string, CanonicalFieldValue>;
  sourceConflicts: Array<{
    field: string;
    values: Array<{ source: string; value: unknown; confidence: number }>;
    resolution: string;
    conflictLevel: "minor" | "major";
  }>;
  evidence: EvidenceRef[];
}
```

### OUTREACH_ANGLE_GENERATOR
Files: `src/lib/agent-workers/outreach-angle-generator.ts` + test

Output:
```ts
{
  angles: Array<{
    title: string; openingLine: string; whyThisWorks: string;
    evidence: EvidenceRef[]; risk: string | null; playbookAligned: boolean;
  }>;
  doNotSay: string[];
  recommendedAngleIndex: number;
}
```

Reject if `angles.length === 0`. Reject any angle without evidence. Reject unsupported claims
like "no booking system" unless website audit confirms it.

### ACCOUNT_BRIEF_WRITER
Files: `src/lib/agent-workers/account-brief-writer.ts` + test
       `src/lib/lead-analysis/finalize.ts`

Steps:
1. Collect all tool outputs from `AgentRun.outputJson` via `leadAnalysisRunId`
2. Run `finalize.ts` to compute deterministic fit score
3. Assemble full `AccountIntelligenceBrief`
4. Run evidence enforcer on every brief field
5. Persist to `LeadAnalysisRun.briefJson`
6. Emit `FINAL_BRIEF` timeline event

## Outcome Learning

File: `src/lib/lead-analysis/outcome-learner.ts`

Triggered by: HubSpot deal stage webhooks, Smartlead reply/bounce/booked events, Instantly
reply/bounce/booked events.

On outcome:
1. Find most recent `LeadAnalysisRun` for the lead scoped by `workspaceId`
2. Extract `playbookRulesJson` from the run
3. Increment `winCount` or `lossCount` on each matched rule
4. Recompute `weight = winCount / (winCount + lossCount + 1)` (Laplace smoothing)
5. Promote rule to `source = "learned"` when `winCount + lossCount >= 5`
6. Write `outcomeJson` + `outcomeAt` to the run

## Lead Detail UI Changes

Work only in:
- `src/components/app/leads/LegacyLeadDetailClient.tsx`
- `src/components/app/lead-analysis/**` (new)

### New components

| Component | Purpose |
|-----------|---------|
| `LeadAnalysisCard.tsx` | Card container in Overview tab; all 6 states |
| `AnalyzeWithAiButton.tsx` | Primary button + force refresh secondary |
| `LeadAnalysisTimeline.tsx` | Live timeline via SSE |
| `LeadAnalysisTimelineRow.tsx` | Single step: tier badge, title, rationale, evidence |
| `AccountIntelligenceBrief.tsx` | Full brief renderer |
| `BriefEvidenceDrawer.tsx` | Slide-out: evidence refs, tier badges, source links |
| `SourceConflictAlert.tsx` | Inline alert when source conflicts detected |

### Card states

- **Never run**: primary `Analyze with AI` button
- **Planning**: "Classifying lead signals..." with sub-niche badge when available
- **Running**: live SSE timeline; tier badges show A→F progress
- **Complete**: full brief + expandable timeline + copy-to-CRM action
- **Partial**: brief with labeled gaps + skipped tool reasons
- **Failed**: retryable error; no stack trace or prompt leakage

### Force refresh UX

`AnalyzeWithAiButton` has a secondary chevron:
- `Analyze with AI` — uses cached intelligence where fresh
- `Force refresh` — re-runs all tools

### Streaming

SSE while status is PLANNING or RUNNING. Each event is a serialized `LeadAnalysisTimelineEvent`.
Graceful fallback to 2s polling if SSE fails.

### Removals

- `workers` from `TabKey` and all tab renders
- `AiWorkersPanel` import and render
- `Lead Pipeline` from `src/components/app/settings-nav.tsx`

Do not delete backend worker routes until Phase 9 confirms no internal link paths remain.

## Phase 0 — Surface Reset

Tasks:
1. Force normal lead detail: remove or hard-disable `isLeadDetailV2Enabled`.
2. Remove Workers tab from `LegacyLeadDetailClient` (TabKey, TabsTrigger, TabsContent).
3. Remove `AiWorkersPanel` import.
4. Remove `Lead Pipeline` from settings nav; redirect to `/app/settings/workspace`.
5. Update `MobileLeadList` links from `?tab=workers` to default or `#ai-analysis`.
6. Add placeholder `LeadAnalysisCard` (disabled button, static UI).

Tests: Workers tab not rendered. Worker URL does not reveal panel. Lead detail v2 not reachable.

## Phase 1 — Schema + API Skeleton

Tasks:
1. Add `LeadAnalysisRun`, `LeadAnalysisTimelineEvent`, `PlaybookRule` to schema.
2. Add enums `LeadAnalysisRunStatus`, `LeadAnalysisEventType`.
3. `npm run db:push` and `npm run db:generate`.
4. Implement POST start and GET latest-run endpoints.
5. Implement GET `[runId]` endpoint.
6. Duplicate active-run guard (bypass with `forceRefresh`).
7. Seed FineDine playbook rules from project paper section 7.4.

Tests: 401 unauthorized. 404 cross-workspace lead. 409 duplicate active run without forceRefresh.
Cross-workspace run isolation.

## Phase 2 — Evidence Chain Foundation

Tasks:
1. `evidence.ts`: tier constants, `EvidenceRef`, citation helpers, confidence math.
2. `evidence-enforcer.ts`: takes tool output + evidence policy, returns violations + cleaned output.
3. Confidence: `weightedAvg(evidence[].confidence)` degraded by missing T1/T2 anchors.

Tests: T4-only dropped. T3 without T1/T2 dropped. T3 with T1/T2 passes as labeled inference.
T1/T2 passes unchanged. Confidence degrades correctly.

## Phase 3 — Sub-Niche + Snapshot + Selector

Tasks:
1. `snapshot.ts`: workspace-scoped snapshot with per-tool freshness.
2. Sub-niche classification at Step S2: re-use or re-run `SUBVERTICAL_CLASSIFIER`.
3. `playbook-query.ts`: match rules by workspaceId + subNiche + signal pattern.
4. `selector.ts`: deterministic candidate selection with sub-niche-aware rules + force refresh.
5. Write skipped-tool timeline events with explicit reasons.

Tests: Force refresh selects all tools. No URL -> website_audit skipped. Stale audit -> selected.
Low reviews -> review_analysis skipped. No `hasOpenmart` -> openmart skipped. fine_dining ->
review_analysis priority boosted. Playbook match returned when pattern matches.

## Phase 4 — Dynamic Planner + Tool Graph

Tasks:
1. Add `lead_analysis_requested` to `EventKind`.
2. Implement `planLeadAnalysis()`.
3. Define all 10 V1 tool contracts in `tool-contracts.ts`.
4. Create `PlannerSession` from validated DAG.
5. Pass `leadAnalysisRunId`, `toolKey`, `analysisTier`, `analysisStepId` into `AgentRun.inputsJson`.
6. Enqueue via existing orchestrator.

Tests: Plan creates PlannerSession. Only registered V1 tools appear. Gemini failure falls back to
selector. Plan respects minPlan + quota. Tier order enforced. Playbook context influences priorities.

## Phase 5 — New Workers

Build in parallel where possible:

1. `OPENMART_ENRICHMENT`
2. `BOOKING_FRICTION_DETECTOR`
3. `SOURCE_RECONCILER`
4. `OUTREACH_ANGLE_GENERATOR`
5. `ACCOUNT_BRIEF_WRITER` (depends on finalize.ts being ready)

For every worker: add `AgentWorkerKind` enum value, registry entry, quota row if external API,
implementation, memory writes only through `src/lib/ai-core/memory.ts`.

Tests for every worker: graceful skip, schema-valid output, evidence on every non-hypothesis
claim, no cross-tenant queries, enforcer passes on clean output, enforcer rejects unsupported claims.

## Phase 6 — Timeline Hooking + Write-back

Tasks:
1. Timeline events from executor when `leadAnalysisRunId` in `inputsJson`.
2. Map worker output to evidence summaries for timeline display.
3. Status transitions: PLANNING -> RUNNING -> SUCCEEDED / PARTIAL / FAILED.
4. Write-back on SUCCEEDED: `Lead.salesConfidence`, `Lead.intelligenceBriefVersion`,
   `LeadNextAction` from `recommendedNextAction`.
5. Enqueue HubSpot sync if connected.
6. SSE endpoint: `/api/leads/[id]/analysis-runs/[runId]/stream`.

Tests: Optional failed tool -> PARTIAL not FAILED. Required failed tool -> FAILED. Timeline
order stable. Write-back updates correct fields. SSE emits events in order.

## Phase 7 — Normal Lead Detail UI

Tasks:
1. `LeadAnalysisCard` with all 6 states.
2. `AnalyzeWithAiButton` with force refresh secondary.
3. SSE subscription; graceful fallback to 2s polling.
4. `AccountIntelligenceBrief` renderer.
5. `BriefEvidenceDrawer`.
6. `SourceConflictAlert`.
7. Retry button for failed runs.
8. Copy-to-CRM action (brief summary to clipboard for HubSpot note paste).

Tests: React unit tests for all states. Playwright smoke: click -> timeline -> brief -> drawer.
Mobile viewport. Force refresh sends correct body.

## Phase 8 — Outcome Learning Loop

Tasks:
1. `outcome-learner.ts` with Laplace-smoothed weight update.
2. HubSpot deal stage webhook -> outcome learner.
3. Smartlead reply/bounce/booked -> outcome learner.
4. Instantly reply/bounce/booked -> outcome learner.
5. Write `outcomeJson` + `outcomeAt` to matched run.
6. Promote rules from `seed` to `learned` after threshold.

Tests: Win increments winCount + recomputes weight. Loss increments lossCount. Rule promoted
after threshold. Cross-tenant update not possible. No matching run -> gracefully ignored.

## Phase 9 — Cleanup

Tasks:
1. Confirm no internal links depend on worker panel, worker page, Lead Pipeline settings.
2. Delete `src/app/app/leads/[id]/workers/page.tsx` and `loading.tsx`.
3. Delete Lead Pipeline settings UI if ingest automation no longer requires it.
4. Remove or rewrite stale tests.

## Observability

Log events:
- `lead_analysis.start_requested` — forceRefresh flag
- `lead_analysis.snapshot_built` — freshness summary
- `lead_analysis.subniche_classified` — sub-niche + confidence
- `lead_analysis.playbook_matched` — rule id + weight
- `lead_analysis.plan_created` — tool count, tier distribution
- `lead_analysis.tool_scheduled` — toolKey + tier
- `lead_analysis.tool_completed` — toolKey + duration + costTokens + evidenceCount
- `lead_analysis.tool_failed` — toolKey + optional flag + error category
- `lead_analysis.source_reconciled` — conflict count + canonical field count
- `lead_analysis.brief_written` — fitScore + confidence + componentCount
- `lead_analysis.finalized` — total cost + total duration
- `lead_analysis.outcome_received` — ruleId + outcome type + new weight

Do not log full prompts, raw Openmart payloads, or sensitive contact data.

## Security and Privacy Checklist

- All new routes use `requireUser()`.
- All reads filter by `workspaceId`.
- All updates use `updateMany` with `workspaceId` or pre-verified rows.
- Openmart data stored in `AgentRun.outputJson` only in V1 — no new contact tables.
- No raw external payload dump into brief or UI.
- No prompt or stack trace leakage to client.
- Outcome webhook handlers verify signature before processing.
- Playbook rules scoped strictly to `workspaceId`.

## Commands

```bash
npm run db:push
npm run db:generate
npm run test
npm run lint
```

Focused test suites:
```bash
npm run test -- src/__tests__/lead-analysis/evidence-enforcer.test.ts
npm run test -- src/__tests__/lead-analysis/selector.test.ts
npm run test -- src/__tests__/lead-analysis/source-reconciler.test.ts
npm run test -- src/__tests__/lead-analysis/finalize.test.ts
npm run test -- src/__tests__/lead-analysis/outcome-learner.test.ts
npm run test -- src/__tests__/api/lead-analysis-runs.test.ts
npm run test -- src/__tests__/agent-workers/openmart-enrichment.test.ts
npm run test -- src/__tests__/agent-workers/source-reconciler.test.ts
npm run test -- src/__tests__/agent-workers/booking-friction-detector.test.ts
npm run test -- src/__tests__/agent-workers/outreach-angle-generator.test.ts
npm run test -- src/__tests__/agent-workers/account-brief-writer.test.ts
```

## Definition of Done

- Lead Detail v2 not reachable from `/app/leads/[id]`.
- Normal lead detail has no Workers tab and no AI configuration settings.
- `Analyze with AI` starts one lead-scoped analysis run. Force refresh re-runs all tools.
- Planner classifies sub-niche before selecting tools.
- Planner queries playbook graph and uses matched rules in tool selection and brief assembly.
- Tools execute in tier order (A -> B -> C -> D -> E -> F) with maximum intra-tier parallelism.
- Source conflicts from Openmart and Google Places are reconciled and surfaced in the brief.
- Evidence enforcer rejects unsupported claims before brief assembly.
- Account Intelligence Brief is the final artifact with full source provenance.
- Fit score is deterministic and evidence-weighted.
- Live timeline streams via SSE with tier badges and rationale per step.
- Brief write-back updates lead fields and enqueues HubSpot sync.
- Outcome learning updates playbook rule weights from HubSpot/sender events.
- External tools degrade gracefully when API keys are absent.
- Cross-tenant tests pass for runs, timeline events, and playbook rules.
- No new BullMQ queue. No API route calls Gemini directly.
- V1.1 tools (orbital, trigger, bant, commercial insight, why now, lookalike) are in the registry
  but not scheduled — ready to activate without architectural changes.
