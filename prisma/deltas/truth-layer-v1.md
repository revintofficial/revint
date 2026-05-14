# Truth Layer v1 — Schema Delta Register

**Purpose:** Single source of truth for every DDL change shipped under
the Truth Layer v1 master plan. Track owners append rows here when
their PR introduces schema changes. The Integration Steward verifies
this file before each Wave-end gate (per master plan §4 gate criteria).

**Naming:** `W{wave}-{owner}-{seq}` (e.g. `W0-Foundation-001`).

---

## W0-Foundation-001 — `Lead.websiteVerificationStatus` column

**Wave:** 0 (Foundation)
**Track:** Foundation (mega-PR)
**Type:** New column, nullable.
**Forward-compat:** Yes — null on legacy rows; consumers default to "uncertain".

```prisma
model Lead {
  // ...
  websiteVerificationStatus WebsiteVerificationStatus? @map("website_verification_status")
}
```

**Why nullable:** Backfill is a T-E concern (it owns the verification
orchestrator). Foundation only carves the column so T-E and T-D can
work in parallel without a second schema PR mid-wave.

**Rollback:** Drop column. Forward-compatible — code paths that read it
already handle `null === uncertain`.

---

## W0-Foundation-002 — `WebsiteVerificationStatus` enum

**Wave:** 0
**Track:** Foundation
**Type:** New enum.

```prisma
enum WebsiteVerificationStatus {
  confirmed_present
  confirmed_absent
  uncertain
}
```

**Consumers locked in by contract:** `src/lib/sdr-brain/contracts/website-verification.ts`
(`__contractVersion = 1`).

**Rollback:** New enum, no existing rows reference. Drop is safe.

---

## W0-Foundation-003 — `NextActionKind` += `CONTACT_DISCOVERY_FIRST`

**Wave:** 0
**Track:** Foundation
**Type:** Enum value addition. Forward-compatible.

```prisma
enum NextActionKind {
  // ... existing values ...
  CONTACT_DISCOVERY_FIRST
}
```

**Why DB enum + TS contract are separate:** The TS contract
`NextBestActionType` (in `contracts/nba-types.ts`) is the AI-worker
output type — used by `BANT_INFERRER` / `SDR_BRAIN` decision trees.
The DB enum `NextActionKind` is the persisted action surface. T-A's
worker output types resolve to one of these for the
`LeadNextAction.kind` write. They share the literal
`CONTACT_DISCOVERY_FIRST` so the persistence step is a 1:1 map.

**Rollback:** Removing an enum value is destructive when rows reference
it. The Truth Layer rollback playbook leaves the value in place even
when the feature flag is off.

---

## W0-Foundation-004 — `SwitchDirection` enum

**Wave:** 0
**Track:** Foundation
**Type:** New enum.

```prisma
enum SwitchDirection {
  inbound
  outbound
  comparison_neutral
}
```

**Storage location TBD by T-C:** Wave 1 T-C decides whether to:
1. Promote the existing `ReviewAnalysis.switchSignals: Json` column
   into a relational `ReviewSwitchSignal` model with `direction` as a
   typed column, **or**
2. Keep the Json blob and add `direction` to the per-entry shape.

Option (1) requires an additional W1 schema delta (logged as
`W1-T-C-001`). Option (2) requires only a contract bump on
`switch-signal.ts` — no DDL.

**Rollback:** New enum, no existing rows. Drop is safe.

---

## W1-T-C-001 — *Option B chosen (Json shape change, no DDL)*

**Wave:** 1
**Track:** T-C Evidence Calibration
**Type:** Contract bump on `switch-signal.ts` only — **no DDL**.
**Decision date:** Wave 1 dispatch.

**Decision:** T-C ships **Option B** — keep the existing
`ReviewAnalysis.switchSignals: Json` column and change the per-entry
shape from a flat `string[]` (legacy) to the typed
`SwitchSignal[]` defined by the contract:

```ts
// from @/lib/sdr-brain/contracts (switch-signal@v1)
interface SwitchSignal {
  competitor: string;
  direction: "inbound" | "outbound" | "comparison_neutral";
  quote: string;
  reviewId: string;
  severity: number; // 0..100
}
```

**Why Option B over the relational `ReviewSwitchSignal` model:**

1. **Zero DDL footprint** — fits master plan §6's "minimal DDL"
   guardrail (Wave 1 had to land in a single PR window without a
   coordinated Prisma generate across other tracks). Option A would
   have required `npx prisma db push` mid-wave with `node` lock-file
   risk on Windows dev boxes.
2. **Contract-aligned** — the `SwitchSignal` shape is already pinned
   at `__contractVersion = 1`. Option B is a 1:1 map from the
   contract to the persisted blob; Option A would have been the same
   shape projected across columns. The relational form buys nothing
   the contract doesn't already give us.
3. **Forward-compatible** — legacy rows with `switchSignals: string[]`
   read as "no direction extracted", and the consumer (per
   `switch-signal.ts` doc-comment) treats an unknown direction as
   `comparison_neutral`. Switching to Option A later remains open
   (contract version stays 1, only the storage adapter changes).
4. **Dedupes on `reviewId`** — uniqueness is enforced by the
   producer (review-analyst writes synthetic `${leadId}:switch:${idx}`
   ids) which is sufficient for current consumers (T-F NBA Hygiene,
   trigger-detector COMPETITOR_PRESSURE gate). A future requirement
   for cross-row analytics would justify Option A; today's surface
   does not.

**Trade-off accepted:** querying for "all leads with an outbound
switch signal" requires a JSONB `?` operator instead of an indexed
column scan. Trigger-detector reads switch signals out of
`lead.reviewAnalysis.switchSignals` per-lead inside the worker, so
the per-row cost is bounded; no global query exists today that
would benefit from the relational form.

**Cumulative DDL footprint table updated below:** row #5 changes
from "0–1 new model" to "0 new model (Option B)".

**Reserved row preserved for future reversal:** if a downstream
track later needs the relational form, the `ReviewSwitchSignal`
draft below remains the canonical schema to materialise. The
contract version stays at 1; only the storage adapter changes.

```prisma
// Reserved draft — NOT applied. Kept for future reversibility.
model ReviewSwitchSignal {
  id             String          @id @default(cuid())
  reviewAnalysisId String        @map("review_analysis_id")
  competitor     String
  direction      SwitchDirection @default(comparison_neutral)
  quote          String          @db.Text
  reviewId       String          @map("review_id")
  severity       Int

  reviewAnalysis ReviewAnalysis @relation(fields: [reviewAnalysisId], references: [id], onDelete: Cascade)

  @@index([reviewAnalysisId])
  @@map("review_switch_signals")
}
```

---

## W3-CI-P-001 — `LeadOutputFeedback` model *(Wave 3, deferred)*

**Wave:** 3
**Track:** CI-P Reviewer Feedback Loop
**Type:** New model.

Out-of-scope for this build session per master plan §10.6 timing.
Reserved here so the register stays append-only.

---

## Cumulative DDL footprint

| # | Wave | Owner | Change | Footprint |
|---|------|-------|--------|-----------|
| 1 | W0 | Foundation | `Lead.websiteVerificationStatus` column | +1 nullable column |
| 2 | W0 | Foundation | `WebsiteVerificationStatus` enum | +1 enum (3 values) |
| 3 | W0 | Foundation | `NextActionKind += CONTACT_DISCOVERY_FIRST` | +1 enum value |
| 4 | W0 | Foundation | `SwitchDirection` enum | +1 enum (3 values) |
| 5 | W1 (T-C) | T-C | Json shape change (Option B) | 0 new model |
| 6 | W3 (CI-P) | CI-P | `LeadOutputFeedback` model | +1 model (deferred) |

**Total active footprint shipped in this build session:** 1 column +
3 enums (one with a new value). Aligned with master plan §6 cap
("toplam DDL ayak izi ~minimal").
