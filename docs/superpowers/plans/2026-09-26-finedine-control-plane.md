# FineDine Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six platform-admin pages that trace a lead decision, record a human verdict, score that verdict against a golden case, and publish ICP/playbook/claim changes as a reversible calibration version.

**Architecture:** Keep `/admin` marketing analytics. Add a Control group that reads and writes only through `src/lib/control/*`. Those services always take an explicit `workspaceId`. Calibration does not create a second config store: a draft snapshots the live `IdealCustomerProfile`, `ServicePackage`, and `WorkspacePlaybook` rows, and activation writes those same rows back inside one transaction. Golden cases are test oracles. They are never written to `SemanticMemory`. Eval v1 scores stored JSON with deterministic assertions. Re-running a worker uses the existing `agent-runs` queue.

**Tech Stack:** Next.js 16.2.3 App Router, React 19, TypeScript, Prisma 6, Postgres, Vitest, existing `withAdminAuth`.

## Global Constraints

- Every Prisma read/write on workspace-owned rows includes `workspaceId` in `where` or `data`. Platform admin selects the workspace; the id in the URL is not trusted until the control role check passes, and child queries still filter by that id.
- Import Prisma types from `@/generated/prisma/client`. Do not import `@prisma/client` in app code.
- Do not add a BullMQ queue. A rerun inserts an `AgentRun` and enqueues `agent-runs`.
- Do not call Gemini from a new `/api/admin` route. Eval v1 does not call a model.
- Do not write `prisma.semanticMemory.*`. Golden promotion does not call `memory.ts`.
- `params` and `searchParams` are Promises. `await` them.
- Admin mutations append `AdminAuditEvent`. No update or delete route for that table.
- Live ICP, playbook, and package rows are not edited in place from the control UI. Edits create a `WorkspaceCalibrationVersion` in `DRAFT`.
- `POST /api/admin/pipeline/cancel-all-global` stays out of the UI.
- `typescript.ignoreBuildErrors` stays `false`.
- Commercial claim strings stored in seed scripts stay `provisional: true` until a FineDine owner sets `provisional: false` on that claim.
- Screen copy is Turkish. Routes stay English. Enum values (`workerKind`, `NEEDS_REVIEW`, `ICP_BAND`, `trace.rerun`) are never the primary label.
- A control the role cannot use stays visible, disabled, with the reason written next to it. The server still returns 403.
- Reuse the existing admin shell: card, border, `--revint-*` tokens. No new visual language, chart, keyboard shortcut, ChainTelemetry panel, or role.

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | New enums and tables. Relations on `Workspace` and `User`. |
| `src/lib/control/roles.ts` | `VIEWER < REVIEWER < ADMIN`. `requireControlRole`. |
| `src/lib/control/audit.ts` | Append-only `writeAdminAudit`. |
| `src/lib/control/trace.ts` | Lead → planner → worker → CRM trace. |
| `src/lib/control/overview.ts` | 24h counts for one workspace. |
| `src/lib/control/review.ts` | Verdict write. Does not mutate `AgentRun.outputJson`. |
| `src/lib/control/golden.ts` | Case create, promote-from-review, list. |
| `src/lib/control/score.ts` | Deterministic assertions over frozen output. |
| `src/lib/control/eval-run.ts` | Create an eval run and persist case results. |
| `src/lib/control/calibration.ts` | Snapshot, draft, diff, activate, rollback. |
| `src/lib/control/claims.ts` | Read active approved claims. |
| `src/lib/control/telemetry.ts` | Insert `ChainTelemetry` after a terminal `AgentRun`. |
| `src/components/admin/nav.tsx` | Second nav group, Control. |
| `src/app/admin/control/*/page.tsx` | The six screens. Server components. |
| `src/app/api/admin/control/*/route.ts` | Mutations only. Pages read via services directly. |

Marketing pages under `/admin`, `/admin/realtime`, `/admin/sessions`, and the rest stay mounted.

## Screen routes

| Menu label | Route | Minimum role |
|---|---|---|
| Genel Bakış | `/admin/control` | VIEWER |
| İnceleme | `/admin/control/reviews` | REVIEWER to judge. VIEWER reads a disabled form. |
| Vaka izi | `/admin/control/trace` and `/admin/control/trace/[leadId]` | VIEWER. Rerun is ADMIN. |
| Referans vakalar | `/admin/control/golden` | REVIEWER to add a case. VIEWER can read. |
| Calibration | `/admin/control/calibration` | REVIEWER to draft. ADMIN to activate, and the activator is not the draft author. |
| Denetim | `/admin/control/audit` | VIEWER |

Menu order is that table order. The word Golden appears only in the route and in code names.

`workspaceId` stays the search param. The strip shows the workspace name and slug, never the id as the label. Changing workspace keeps the current path and replaces the param. The picker is a searchable list of name + slug, not a flat list of 100 links. With no workspace selected the page title is “Hangi çalışma alanına bakıyorsun?” and the last three workspaces the browser stored sit above the search.

Every control page renders the same strip: workspace name and slug, role badge (İzleyici / İnceleyen / Yönetici), and the person’s email.

---

## Data model

Add to `prisma/schema.prisma`. Then `npm run db:push` and `npm run db:generate`.

```prisma
enum PlatformRole {
  VIEWER
  REVIEWER
  ADMIN
}

enum CalibrationStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  ACTIVE
  SUPERSEDED
  ROLLED_BACK
}

enum ReviewVerdict {
  PASS
  FAIL
  NEEDS_REVIEW
}

enum EvalRunStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
  CANCELLED
}

model PlatformRoleAssignment {
  id        String       @id @default(cuid())
  userId    String       @map("user_id") @db.Uuid
  role      PlatformRole
  createdAt DateTime     @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("platform_role_assignments")
}

model AdminAuditEvent {
  id             String       @id @default(cuid())
  actorUserId    String       @map("actor_user_id") @db.Uuid
  actorRole      PlatformRole @map("actor_role")
  workspaceId    String?      @map("workspace_id")
  action         String
  targetType     String       @map("target_type")
  targetId       String       @map("target_id")
  reason         String       @db.Text
  beforeJson     Json?        @map("before_json")
  afterJson      Json?        @map("after_json")
  approvalUserId String?      @map("approval_user_id") @db.Uuid
  outcome        String
  createdAt      DateTime     @default(now()) @map("created_at")

  @@index([workspaceId, createdAt])
  @@index([targetType, targetId])
  @@map("admin_audit_events")
}

model WorkspaceCalibrationVersion {
  id                String            @id @default(cuid())
  workspaceId       String            @map("workspace_id")
  version           Int
  status            CalibrationStatus @default(DRAFT)
  icpJson           Json              @map("icp_json")
  packagesJson      Json              @map("packages_json")
  claimsJson        Json              @map("claims_json")
  playbookJson      Json              @map("playbook_json")
  pipelineJson      Json              @map("pipeline_json")
  baseVersionId     String?           @map("base_version_id")
  reason            String            @db.Text
  createdByUserId   String            @map("created_by_user_id") @db.Uuid
  approvedByUserId  String?           @map("approved_by_user_id") @db.Uuid
  activatedByUserId String?           @map("activated_by_user_id") @db.Uuid
  createdAt         DateTime          @default(now()) @map("created_at")
  activatedAt       DateTime?         @map("activated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, version])
  @@index([workspaceId, status])
  @@map("workspace_calibration_versions")
}

model EvalDataset {
  id          String   @id @default(cuid())
  workspaceId String   @map("workspace_id")
  name        String
  createdAt   DateTime @default(now()) @map("created_at")

  workspace Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  cases     EvalCase[]

  @@unique([workspaceId, name])
  @@map("eval_datasets")
}

model EvalCase {
  id               String   @id @default(cuid())
  workspaceId      String   @map("workspace_id")
  datasetId        String   @map("dataset_id")
  sourceLeadId     String?  @map("source_lead_id")
  sourceRunId      String?  @map("source_run_id")
  title            String
  segment          String?
  country          String?
  language         String?
  inputSnapshot    Json     @map("input_snapshot")
  outputSnapshot   Json     @map("output_snapshot")
  expectedJson     Json     @map("expected_json")
  severity         String
  tags             String[] @default([])
  approvedByUserId String   @map("approved_by_user_id") @db.Uuid
  createdAt        DateTime @default(now()) @map("created_at")

  workspace Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  dataset   EvalDataset @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@index([workspaceId, datasetId])
  @@map("eval_cases")
}

model HumanReview {
  id                   String        @id @default(cuid())
  workspaceId          String        @map("workspace_id")
  leadId               String?       @map("lead_id")
  agentRunId           String?       @map("agent_run_id")
  evalCaseId           String?       @map("eval_case_id")
  verdict              ReviewVerdict
  errorClass           String?       @map("error_class")
  severity             String?
  note                 String?       @db.Text
  reviewerUserId       String        @map("reviewer_user_id") @db.Uuid
  secondReviewerUserId String?       @map("second_reviewer_user_id") @db.Uuid
  createdAt            DateTime      @default(now()) @map("created_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
  @@index([workspaceId, leadId])
  @@map("human_reviews")
}

model EvalRun {
  id                     String        @id @default(cuid())
  workspaceId            String        @map("workspace_id")
  datasetId              String        @map("dataset_id")
  label                  String
  calibrationVersionId   String?       @map("calibration_version_id")
  status                 EvalRunStatus @default(PENDING)
  createdByUserId        String        @map("created_by_user_id") @db.Uuid
  summaryJson            Json?         @map("summary_json")
  createdAt              DateTime      @default(now()) @map("created_at")
  finishedAt             DateTime?     @map("finished_at")

  workspace Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  results   EvalCaseResult[]

  @@index([workspaceId, datasetId, createdAt])
  @@map("eval_runs")
}

model EvalCaseResult {
  id          String  @id @default(cuid())
  workspaceId String  @map("workspace_id")
  evalRunId   String  @map("eval_run_id")
  evalCaseId  String  @map("eval_case_id")
  passed      Boolean
  failures    Json
  outputJson  Json    @map("output_json")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  evalRun   EvalRun   @relation(fields: [evalRunId], references: [id], onDelete: Cascade)

  @@unique([evalRunId, evalCaseId])
  @@index([workspaceId, evalRunId])
  @@map("eval_case_results")
}
```

Add relation fields on `User` (`platformRole PlatformRoleAssignment?`, no audit back-relation required) and on `Workspace` (`calibrationVersions`, `evalDatasets`, `evalCases`, `humanReviews`, `evalRuns`, `adminAuditEvents` is optional because `workspaceId` on audit is nullable). `AdminAuditEvent.workspaceId` is a plain string, not a required FK, so a platform action with no workspace still records.

`expectedJson` shape, validated by Zod in `src/lib/control/score.ts`:

```ts
export const expectedSchema = z.object({
  icpMin: z.number().int().min(0).max(100).optional(),
  icpMax: z.number().int().min(0).max(100).optional(),
  allowedModules: z.array(z.string()).optional(),
  forbiddenClaims: z.array(z.string()).default([]),
  forbiddenAngles: z.array(z.string()).default([]),
});
```

`outputSnapshot` / scored output shape the scorer reads:

```ts
export type ScoredOutput = {
  icpFitScore?: number;
  modules?: string[];
  claims?: string[];
  angle?: string;
};
```

Claim object inside `claimsJson`:

```ts
export type SalesClaim = {
  id: string;
  text: string;
  source: string;
  expiresOn: string; // YYYY-MM-DD
  provisional: boolean;
};
```

A claim with `provisional: true` or `expiresOn` before today is not approved.

Error classes, closed set in `src/lib/control/review.ts`:

```ts
export const ERROR_CLASSES = [
  "IDENTITY_MISMATCH",
  "STALE_SOURCE",
  "UNSUPPORTED_CLAIM",
  "PACKAGE_MISMATCH",
  "SCORE_CALIBRATION",
  "PLAYBOOK_VIOLATION",
  "PIPELINE_OMISSION",
] as const;
```

---

## Shared types produced for later tasks

```ts
// src/lib/control/roles.ts
export type ControlRole = "VIEWER" | "REVIEWER" | "ADMIN";
export async function resolveControlRole(userId: string, email: string | null): Promise<ControlRole | null>;
export async function requireControlRole(min: ControlRole): Promise<{ userId: string; email: string | null; role: ControlRole }>;

// src/lib/control/audit.ts
export async function writeAdminAudit(input: {
  actorUserId: string;
  actorRole: ControlRole;
  workspaceId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  beforeJson: unknown;
  afterJson: unknown;
  approvalUserId?: string | null;
  outcome: "SUCCEEDED" | "FAILED";
}): Promise<{ id: string }>;

// src/lib/control/trace.ts
export type DecisionCard = {
  icpFitScore: number | null;
  modules: string[];
  claims: string[];
  angle: string | null;
};
export type LeadTrace = {
  lead: { id: string; businessName: string };
  sessions: Array<{
    id: string;
    status: string;
    goal: string;
    createdAt: string;
    updatedAt: string;
    runs: Array<{
      id: string;
      workerKind: string;
      status: string;
      costUsdCents: number;
      errorMsg: string | null;
      startedAt: string | null;
      finishedAt: string | null;
      decision: DecisionCard;
    }>;
  }>;
  unsessionedRuns: LeadTrace["sessions"][number]["runs"];
  crmSyncs: Array<{ id: string; status: string; objectType: string; lastError: string | null }>;
};
export async function getLeadTrace(workspaceId: string, leadId: string): Promise<LeadTrace | null>;
export async function listTraceLeads(workspaceId: string, filter: "all" | "failed" | "stuck", now?: Date): Promise<Array<{
  leadId: string;
  businessName: string;
  latestStatus: string;
  latestWorkerKind: string;
  latestAt: string;
  failedCount: number;
}>>;

// src/lib/control/overview.ts
export type ControlOverview = {
  completed24h: number;
  failed24h: number;
  stuckSessions: number;
  openReviews: number;
  lastEval: { passed: number; total: number; finishedAt: string } | null;
};
export async function getControlOverview(workspaceId: string, now?: Date): Promise<ControlOverview>;

// src/lib/control/score.ts
export type ScoreFailure = { code: string; detail: string };
export function scoreOutput(output: ScoredOutput, expected: z.infer<typeof expectedSchema>, now?: Date): { passed: boolean; failures: ScoreFailure[] };
export function scoreClaims(claims: SalesClaim[], now: Date): SalesClaim[];
```

`scoreClaims` returns only claims that are not provisional and whose `expiresOn` is today or later. Head-agent integration is Task 12.

---

### Task 1: Schema

**Files:**
- Modify: `prisma/schema.prisma` (append enums and models above; add relation names on `User` and `Workspace`)
- Test: `src/__tests__/control/schema-smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Prisma delegates `platformRoleAssignment`, `adminAuditEvent`, `workspaceCalibrationVersion`, `evalDataset`, `evalCase`, `humanReview`, `evalRun`, `evalCaseResult`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";

describe("control plane schema", () => {
  it("exposes the control delegates", () => {
    expect(Prisma.ModelName.AdminAuditEvent).toBe("AdminAuditEvent");
    expect(Prisma.ModelName.WorkspaceCalibrationVersion).toBe("WorkspaceCalibrationVersion");
    expect(Prisma.ModelName.EvalCase).toBe("EvalCase");
    expect(Prisma.ModelName.HumanReview).toBe("HumanReview");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/control/schema-smoke.test.ts`

Expected: FAIL. `AdminAuditEvent` is not on `Prisma.ModelName`.

- [ ] **Step 3: Add the models from the Data model section. Run `npm run db:generate`.**

Do not run `db:push` in the unit test. Generate the client so the type test compiles. `db:push` is a manual step the implementer runs against the dev database before any integration check.

- [ ] **Step 4: Run the test again**

Run: `npx vitest run src/__tests__/control/schema-smoke.test.ts`

Expected: PASS.

---

### Task 2: Roles

**Files:**
- Create: `src/lib/control/roles.ts`
- Modify: `src/lib/admin-auth.ts` (no behavior change; control roles call `isPlatformAdmin` the same way)
- Test: `src/__tests__/control/roles.test.ts`

**Interfaces:**
- Consumes: `User.isPlatformAdmin`, `PlatformRoleAssignment`
- Produces: `resolveControlRole`, `requireControlRole`

Role order: `User.isPlatformAdmin === true` or email in `ADMIN_DASHBOARD_EMAILS` resolves to `ADMIN` even with no assignment row. An assignment row of `REVIEWER` or `VIEWER` applies only when the user is not already an admin by that bootstrap rule. Missing session throws the existing `UnauthorizedError`. Signed-in user with no role throws `ForbiddenError`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    platformRoleAssignment: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveControlRole } from "@/lib/control/roles";

describe("resolveControlRole", () => {
  it("treats isPlatformAdmin as ADMIN", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPlatformAdmin: true } as never);
    await expect(resolveControlRole("user-1", "a@b.co")).resolves.toBe("ADMIN");
  });

  it("returns the assignment when the user is not a platform admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPlatformAdmin: false } as never);
    vi.mocked(prisma.platformRoleAssignment.findUnique).mockResolvedValue({ role: "REVIEWER" } as never);
    await expect(resolveControlRole("user-2", "c@d.co")).resolves.toBe("REVIEWER");
  });

  it("returns null when there is no assignment and no allowlist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPlatformAdmin: false } as never);
    vi.mocked(prisma.platformRoleAssignment.findUnique).mockResolvedValue(null);
    await expect(resolveControlRole("user-3", "nobody@example.com")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/control/roles.test.ts`

Expected: FAIL. Cannot find module `@/lib/control/roles`.

- [ ] **Step 3: Implement `resolveControlRole`**

```ts
import { prisma } from "@/lib/prisma";
import type { PlatformRole } from "@/generated/prisma/client";

export type ControlRole = PlatformRole;

const RANK: Record<ControlRole, number> = { VIEWER: 1, REVIEWER: 2, ADMIN: 3 };

export function roleAtLeast(actual: ControlRole, min: ControlRole): boolean {
  return RANK[actual] >= RANK[min];
}

export async function resolveControlRole(userId: string, email: string | null): Promise<ControlRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  if (user?.isPlatformAdmin) return "ADMIN";
  const allow = (process.env.ADMIN_DASHBOARD_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (email && allow.includes(email.toLowerCase())) return "ADMIN";
  const assignment = await prisma.platformRoleAssignment.findUnique({
    where: { userId },
    select: { role: true },
  });
  return assignment?.role ?? null;
}
```

`requireControlRole` calls `requireUser()` from `@/lib/auth`, then `resolveControlRole`. If the role is null, throw `ForbiddenError`. If `roleAtLeast` fails, throw `ForbiddenError`.

- [ ] **Step 4: Re-run the test**

Run: `npx vitest run src/__tests__/control/roles.test.ts`

Expected: PASS.

---

### Task 3: Audit writer

**Files:**
- Create: `src/lib/control/audit.ts`
- Test: `src/__tests__/control/audit.test.ts`

**Interfaces:**
- Consumes: `AdminAuditEvent`
- Produces: `writeAdminAudit`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { adminAuditEvent: { create } } }));

import { writeAdminAudit } from "@/lib/control/audit";

describe("writeAdminAudit", () => {
  it("inserts an append-only row and returns the id", async () => {
    create.mockResolvedValue({ id: "aud_1" });
    const row = await writeAdminAudit({
      actorUserId: "00000000-0000-0000-0000-000000000001",
      actorRole: "ADMIN",
      workspaceId: "ws_1",
      action: "calibration.activate",
      targetType: "WorkspaceCalibrationVersion",
      targetId: "cal_1",
      reason: "golden subset passed",
      beforeJson: { status: "APPROVED" },
      afterJson: { status: "ACTIVE" },
      outcome: "SUCCEEDED",
    });
    expect(row.id).toBe("aud_1");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws_1",
        action: "calibration.activate",
        outcome: "SUCCEEDED",
      }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/control/audit.test.ts`

Expected: FAIL. Module missing.

- [ ] **Step 3: Implement `writeAdminAudit` as a single `prisma.adminAuditEvent.create`. Do not export update or delete.**

- [ ] **Step 4: Re-run the test**

Expected: PASS.

---

### Task 4: Chain telemetry on terminal runs

**Files:**
- Create: `src/lib/control/telemetry.ts`
- Modify: `src/lib/agent-workers/execute.ts` at each terminal `agentRun.update` that sets `finishedAt` (success, stale skip, failure). Call `recordChainTelemetry` after the update. Swallow telemetry errors with `logger.warn` so a telemetry failure does not fail the worker.
- Test: `src/__tests__/control/telemetry.test.ts`

**Interfaces:**
- Consumes: `AgentRun` fields `workspaceId`, `plannerSessionId`, `workerKind`, `costTokens`, `costUsdCents`, `startedAt`, `finishedAt`, `errorMsg`
- Produces: `recordChainTelemetry(run: { id, workspaceId, plannerSessionId, workerKind, costTokens, costUsdCents, startedAt, finishedAt, errorMsg, status })`

`durationMs` is `finishedAt - startedAt` when both exist, else null. `slaBreach` is true when `durationMs` is greater than 120000. `errorClass` is the run `status` when it is `FAILED`, else null. Skip the insert when `plannerSessionId` is null (the column is required on `ChainTelemetry`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { chainTelemetry: { create } } }));

import { recordChainTelemetry } from "@/lib/control/telemetry";

describe("recordChainTelemetry", () => {
  it("writes duration and sla breach for a slow failed run", async () => {
    create.mockResolvedValue({ id: "tel_1" });
    await recordChainTelemetry({
      id: "run_1",
      workspaceId: "ws_1",
      plannerSessionId: "ps_1",
      workerKind: "ICP_SCORER",
      costTokens: 10,
      costUsdCents: 0,
      startedAt: new Date("2026-09-26T12:00:00Z"),
      finishedAt: new Date("2026-09-26T12:03:00Z"),
      errorMsg: "boom",
      status: "FAILED",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws_1",
        plannerSessionId: "ps_1",
        agentRunId: "run_1",
        durationMs: 180000,
        slaBreach: true,
        errorClass: "FAILED",
      }),
    });
  });

  it("does not write when the run has no planner session", async () => {
    await recordChainTelemetry({
      id: "run_2",
      workspaceId: "ws_1",
      plannerSessionId: null,
      workerKind: "ICP_SCORER",
      costTokens: 0,
      costUsdCents: 0,
      startedAt: null,
      finishedAt: new Date(),
      errorMsg: null,
      status: "SUCCEEDED",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/control/telemetry.test.ts`

- [ ] **Step 3: Implement `recordChainTelemetry` and call it from `execute.ts` after each terminal update.**

Pass `run.workspaceId` from the row already loaded in `executeAgentRun`. Do not take `workspaceId` from a job payload.

- [ ] **Step 4: Re-run the telemetry test and the existing execute tests**

Run: `npx vitest run src/__tests__/control/telemetry.test.ts src/__tests__/agent-workers`

Expected: telemetry PASS. Existing execute tests still PASS. If a test asserts the exact number of `agentRun.update` calls, leave those assertions alone; telemetry uses `chainTelemetry.create`.

---

### Task 5: Trace and overview services

**Files:**
- Create: `src/lib/control/trace.ts`
- Create: `src/lib/control/overview.ts`
- Test: `src/__tests__/control/trace.test.ts`
- Test: `src/__tests__/control/overview.test.ts`

**Interfaces:**
- Consumes: `Lead`, `PlannerSession`, `AgentRun`, `CrmSyncLog`, `HumanReview`, `EvalRun`
- Produces: `getLeadTrace`, `getControlOverview`

`getLeadTrace` uses `prisma.lead.findFirst({ where: { id: leadId, workspaceId } })`. When the lead is missing, return null. Sessions: `plannerSession.findMany({ where: { workspaceId, leadId } })`. Runs: `agentRun.findMany({ where: { workspaceId, leadId } })`. CRM: `crmSyncLog.findMany({ where: { workspaceId, leadId } })`. Group each run under its `plannerSessionId`. Runs with a null session go in `unsessionedRuns`. Read `outputJson` only inside this function and map it to `DecisionCard` (`icpFitScore`, `modules`, `claims`, `angle`). The returned object does not contain `outputJson` or `inputsJson`.

`listTraceLeads` returns one row per lead, not one row per run. Each row carries `businessName`, the latest run’s status and `workerKind`, the latest timestamp, and how many of that lead’s runs are `FAILED`. `filter: "failed"` keeps leads whose latest run is `FAILED`. `filter: "stuck"` keeps leads that have a planner session in `PLANNING` or `EXECUTING` whose `updatedAt` is older than 30 minutes. `filter: "all"` keeps every lead that has a run in the workspace. Search by business name is applied by the page on this result.

`getControlOverview`:

- `completed24h`: `agentRun.count` where `workspaceId`, `status` in `SUCCEEDED` and `SUCCEEDED_NO_MEMORY`, `finishedAt >= now - 24h`.
- `failed24h`: status `FAILED`, same window.
- `stuckSessions`: `plannerSession.count` where `workspaceId`, `status` in `PLANNING` and `EXECUTING`, `updatedAt < now - 30 minutes`. This is a session count. The trace link opens `filter=stuck`, which lists the leads that own those sessions.
- `openReviews`: the count returned by `countReviewQueue(workspaceId, now)` from Task 7. It is the number of leads in the review queue, not the number of `NEEDS_REVIEW` rows. If an earlier implementation counted every `NEEDS_REVIEW` row, replace that count and rewrite its test before the Genel Bakış page ships. The card and the queue must be the same set.
- `lastEval`: latest `evalRun` for the workspace with `status = SUCCEEDED`. Read `summaryJson.passed`, `summaryJson.total`, and `finishedAt`. Null when no succeeded run exists. Do not expose a bare pass rate.

- [ ] **Step 1: Write failing tests that mock prisma and assert the `where` clause contains `workspaceId`.**

```ts
import { describe, expect, it, vi } from "vitest";

const leadFind = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: leadFind },
    plannerSession: { findMany: vi.fn().mockResolvedValue([]) },
    agentRun: { findMany: vi.fn().mockResolvedValue([]) },
    crmSyncLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { getLeadTrace } from "@/lib/control/trace";

describe("getLeadTrace", () => {
  it("returns null when the lead is outside the workspace", async () => {
    leadFind.mockResolvedValue(null);
    await expect(getLeadTrace("ws_a", "lead_b")).resolves.toBeNull();
    expect(leadFind).toHaveBeenCalledWith({
      where: { id: "lead_b", workspaceId: "ws_a" },
      select: { id: true, businessName: true },
    });
  });
});
```

Overview test: freeze `now` at `2026-09-26T12:00:00Z` and assert `finishedAt: { gte: new Date("2026-09-25T12:00:00Z") }` and `workspaceId: "ws_1"` on `agentRun.count`.

- [ ] **Step 2: Run both tests and confirm they fail on missing modules**

- [ ] **Step 3: Implement both functions with the filters above**

- [ ] **Step 4: Re-run both tests**

Expected: PASS.

---

### Task 6: Genel Bakış and vaka izi pages

**Files:**
- Modify: `src/components/admin/nav.tsx`
- Create: `src/app/admin/control/page.tsx`
- Create: `src/app/admin/control/trace/page.tsx`
- Create: `src/app/admin/control/trace/[leadId]/page.tsx`
- Create: `src/app/api/admin/control/trace/[leadId]/rerun/route.ts`

**Interfaces:**
- Consumes: `requireControlRole`, `getControlOverview`, `getLeadTrace`, `writeAdminAudit`
- Produces: routes listed above

Nav: keep the existing marketing `NAV` array. Add `CONTROL_NAV` in this order: Genel Bakış, İnceleme, Vaka izi, Referans vakalar, Calibration, Denetim.

Create `src/lib/control/labels.ts`. It exports Turkish labels for role, run status, review verdict, error class, severity, calibration status, score failure code, and every `AgentWorkerKind`. A test iterates `Object.values(AgentWorkerKind)` and fails if a kind has no label or if the label equals the enum key. Pages call this module. They do not print enum keys on the primary line.

`/admin/control/page.tsx` is a server component. `await searchParams`. If `workspaceId` is missing, render the title “Hangi çalışma alanına bakıyorsun?” and a searchable name + slug picker. The last three workspace ids from `localStorage` key `revint.control.recentWorkspaces` render above the search. Choosing one writes that id to the front of the list, keeps three, and navigates to the same path with `?workspaceId=`.

When a workspace is selected, `requireControlRole("VIEWER")` then `getControlOverview(workspaceId)`. The first line is one sentence. With `failed24h = 4` and `stuckSessions = 2`: “Son 24 saatte 4 analiz düştü, 2 oturum 30 dakikadır ilerlemiyor.” When both are 0: “Bugün müdahale gerektiren bir şey yok.” Completed count is a health figure, not equal weight with the alarms. The cards that ask for action are failed runs, stuck sessions, and the review queue. Stuck card caption: “Planlama veya çalışıyor durumunda, 30 dakikadır güncellenmemiş.” Its link is `/admin/control/trace?workspaceId=&filter=stuck`. Review card uses `openReviews` from `countReviewQueue` and links to `/admin/control/reviews?workspaceId=`. The number on the card is the number of rows in that queue. Last control card: when `lastEval` is null, the text is “Henüz kontrol koşusu yok” and the only link is Referans vakalar. When present, write the fraction and the date: “12/20, 26 Eyl”. No pause button, settings form, or global cancel.

Trace list calls `listTraceLeads`. One row per lead: business name, latest status label, latest worker label, time, failed count. A text input filters by business name. Three filters: Düşen (`filter=failed`), Takılı (`filter=stuck`), Hepsi (`filter=all`). `filter=stuck` is what Genel Bakış opens. Do not leave the stuck link for a later pass.

Trace detail calls `getLeadTrace`. When it returns null, render “Bu lead bu alanda yok” and a link back to the list. Do not call `notFound()`. One timeline: business name and “bu çalışma alanında”, then each session, the runs that belong to it, then the CRM row. Each run row shows the Turkish worker name, status label, duration from `startedAt` to `finishedAt`, cost in dollars (`costUsdCents / 100`), and `errorMsg` when present. Do not add a ChainTelemetry panel. Above the runs, the decision card shows four lines from `decision`: ICP uyum puanı, modüller, iddialar, açı. Raw JSON for that run sits in a `<details>` element that is closed by default. The page does not render `outputJson` as the decision.

Rerun is a confirm control on the run row, not its own page. A non-admin sees it disabled with “Yeniden çalıştırmak Yönetici işidir.” The confirm text is: “Eski sonuç durur. Yeni bir çalıştırma kuyruğa girer. Bu düğme analizi silmez.” Reason is required. Empty reason returns 400 and creates no run. The response is `{ ok: true, runId, enqueued }`. When `enqueued` is false the page says “Kayıt açıldı, kuyruğa alınamadı.”

Rerun route:

```ts
export const POST = withAdminAuth(async (session, req, ctx) => {
  const { leadId } = await ctx.params;
  const body = await req.json();
  const workspaceId = String(body.workspaceId ?? "");
  const workerKind = String(body.workerKind ?? "");
  const actor = await requireControlRole("ADMIN");
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { id: true, subNicheVersion: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!Object.values(AgentWorkerKind).includes(workerKind as AgentWorkerKind)) {
    return NextResponse.json({ error: "Invalid worker" }, { status: 400 });
  }
  const run = await prisma.agentRun.create({
    data: {
      workspaceId,
      leadId,
      userId: actor.userId,
      workerKind: workerKind as AgentWorkerKind,
      status: "PENDING",
      inputsJson: {},
      inputSubNicheVersion: lead.subNicheVersion,
    },
    select: { id: true },
  });
  // Move the file-local `tryEnqueue` in
  // src/app/api/leads/[id]/workers/[kind]/route.ts into
  // src/lib/control/enqueue-run.ts and export it. Call `tryEnqueue(run.id)` here
  // and from the original route. Do not add a queue. If enqueue returns false,
  // leave the AgentRun PENDING and write the audit outcome as SUCCEEDED with
  // afterJson `{ workerKind, runId, enqueued: false }`. The existing worker
  // route's inline fallback stays in that route only.
  await writeAdminAudit({
    actorUserId: actor.userId,
    actorRole: actor.role,
    workspaceId,
    action: "trace.rerun",
    targetType: "Lead",
    targetId: leadId,
    reason: String(body.reason ?? ""),
    beforeJson: null,
    afterJson: { workerKind, runId: run.id, enqueued },
    outcome: "SUCCEEDED",
  });
  return NextResponse.json({ ok: true, runId: run.id, enqueued });
});
```

Call `tryEnqueue(run.id)` before the audit write and put that boolean in `enqueued`. If `reason` is blank, return 400 and do not create a run. `requireControlRole("ADMIN")` still rejects a reviewer with 403. The disabled button is only the page; the route stays closed.

- [ ] **Step 1: Add `labels.ts`, the nav group, the strip, and the three pages. The review count on Genel Bakış calls `countReviewQueue`.**

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: no errors in the new files. A test fails if any `AgentWorkerKind` lacks a Turkish label.

- [ ] **Step 3: Open `/admin/control` as a platform admin.**

Confirm the searchable picker, the sentence, `filter=stuck` on the stuck link, one row per business name, the four-line decision card, and the closed raw section. Confirm `/admin` marketing overview still renders. Confirm a viewer sees the rerun control disabled with the admin sentence.

---

### Task 7: Human review

**Files:**
- Create: `src/lib/control/review.ts`
- Create: `src/app/admin/control/reviews/page.tsx`
- Create: `src/app/api/admin/control/reviews/route.ts`
- Test: `src/__tests__/control/review.test.ts`

**Interfaces:**
- Consumes: `HumanReview`, `ERROR_CLASSES`, `writeAdminAudit`
- Produces: `recordReview(input): Promise<{ id: string }>`

```ts
export async function recordReview(input: {
  workspaceId: string;
  leadId: string;
  agentRunId: string | null;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  errorClass: (typeof ERROR_CLASSES)[number] | null;
  severity: "P0" | "P1" | "P2" | null;
  note: string;
  reviewerUserId: string;
  actorRole: ControlRole;
}): Promise<{ id: string }>;
```

Rules:

- `FAIL` requires `errorClass`, `severity`, and a non-empty `note`. Otherwise throw `Error` with message `fail requires class, severity, and note`.
- `PASS` and `NEEDS_REVIEW` store `errorClass: null` and `severity: null`.
- Load the lead with `findFirst({ where: { id: leadId, workspaceId } })`. Missing lead throws `NotFoundError`.
- Insert `HumanReview`. Do not update `AgentRun`.
- `writeAdminAudit` action `review.record`.

One queue definition, used by Genel Bakış and this page. `listReviewQueue(workspaceId, now)` returns leads, not review rows. A lead is in the queue when either:

- its latest `HumanReview` in the workspace has verdict `NEEDS_REVIEW`, or
- it has an `AgentRun` with status `FAILED`, `finishedAt >= now - 7 days`, and no `PASS` review whose `createdAt` is after that `finishedAt`.

Each row includes `businessName`, `reason` (`"needs_review"` or `"failed_unpassed"`), `age`, and the latest severity if any. `countReviewQueue` returns that list’s length. `openReviews` must equal it. The page maps `needs_review` to “İnceleme istendi” and `failed_unpassed` to “Düştü, henüz geçmedi”.

- [ ] **Step 1: Failing test**

```ts
it("rejects FAIL without an error class", async () => {
  await expect(
    recordReview({
      workspaceId: "ws_1",
      leadId: "lead_1",
      agentRunId: null,
      verdict: "FAIL",
      errorClass: null,
      severity: "P1",
      note: "wrong module",
      reviewerUserId: "00000000-0000-0000-0000-000000000001",
      actorRole: "REVIEWER",
    }),
  ).rejects.toThrow("fail requires class, severity, and note");
});
```

Second test: mock `lead.findFirst` to return `{ id: "lead_1" }`, mock `humanReview.create` and `adminAuditEvent.create`, call with `verdict: "PASS"`, and assert `agentRun.update` was not part of the prisma mock (do not put `update` on the mock; the test fails if the implementation calls it).

- [ ] **Step 2: Run the test, confirm fail, implement, re-run**

Run: `npx vitest run src/__tests__/control/review.test.ts`

- [ ] **Step 3: Page**

Inbox layout: queue on the left, one case on the right, decision controls fixed at the bottom of the case. The selected row opens the same four-line decision card as the trace. Earlier reviews for that lead sit under the card, newest first. Three choices, labeled Geçti, Kaldı, Tekrar bak. Error class and severity render only when Kaldı is selected. Labels:

| Stored value | Screen |
|---|---|
| IDENTITY_MISMATCH | Yanlış işletme |
| STALE_SOURCE | Kaynak eski |
| UNSUPPORTED_CLAIM | İddia dayanaksız |
| PACKAGE_MISMATCH | Paket uymuyor |
| SCORE_CALIBRATION | Puan bandın dışında |
| PLAYBOOK_VIOLATION | Oyun kitabına aykırı |
| PIPELINE_OMISSION | Boru hattında adım eksik |
| P0 | Bugün bakar |
| P1 | Bu hafta |
| P2 | Kayıt |

Geçti clears class and severity. Kaldı requires one sentence in the note. After a successful save, select the next queue row. A viewer sees the controls disabled. A reviewer can save. The case shows this sentence: “Bu karar analizi değiştirmez. Çalıştırmanın çıktısı yerinde kalır.” “Referans vaka yap” lives on this card and opens the four-field promote form from Task 8. An empty queue renders “Bakılacak vaka kalmadı.” The route calls `requireControlRole("REVIEWER")` then `recordReview`.

---

### Task 8: Golden cases and deterministic score

**Files:**
- Create: `src/lib/control/score.ts`
- Create: `src/lib/control/golden.ts`
- Create: `src/app/admin/control/golden/page.tsx`
- Create: `src/app/api/admin/control/golden/route.ts`
- Test: `src/__tests__/control/score.test.ts`
- Test: `src/__tests__/control/golden.test.ts`

**Interfaces:**
- Consumes: `scoreOutput`, `EvalCase`, `HumanReview`
- Produces: `createEvalCase`, `promoteReviewToCase`

`scoreOutput` failures:

| Condition | code |
|---|---|
| `icpFitScore` present and outside `[icpMin, icpMax]` | `ICP_BAND` |
| `modules` contains a value absent from `allowedModules` when `allowedModules` is set | `MODULE` |
| any `forbiddenClaims` entry is a case-insensitive substring of any `claims` entry | `FORBIDDEN_CLAIM` |
| `angle` equals a `forbiddenAngles` entry | `FORBIDDEN_ANGLE` |

Empty forbidden lists do not fail. Missing `icpFitScore` with a band set fails `ICP_BAND`.

`promoteReviewToCase` loads the review by `id` and `workspaceId`. It copies `inputSnapshot` from the caller (the trace page sends the lead fields the reviewer checked: business name, website, country). `outputSnapshot` is the `AgentRun.outputJson` loaded with `findFirst({ where: { id: agentRunId, workspaceId } })`. It inserts `EvalCase` and audits `golden.promote`. It does not write semantic memory.

- [ ] **Step 1: Score tests**

```ts
import { scoreOutput } from "@/lib/control/score";

it("fails a Michelin lead pitched the delivery angle", () => {
  const result = scoreOutput(
    { icpFitScore: 80, modules: ["QR_MENU"], claims: [], angle: "delivery" },
    { icpMin: 70, icpMax: 85, allowedModules: ["QR_MENU", "ORDER_PAY"], forbiddenClaims: [], forbiddenAngles: ["delivery"] },
  );
  expect(result.passed).toBe(false);
  expect(result.failures.map((f) => f.code)).toContain("FORBIDDEN_ANGLE");
});

it("passes when the score is inside the band and the module is allowed", () => {
  const result = scoreOutput(
    { icpFitScore: 80, modules: ["QR_MENU"], claims: ["faster table turns"], angle: "qr" },
    { icpMin: 70, icpMax: 85, allowedModules: ["QR_MENU"], forbiddenClaims: ["18% upsell"], forbiddenAngles: ["delivery"] },
  );
  expect(result.passed).toBe(true);
});
```

- [ ] **Step 2: Run, fail, implement `scoreOutput` with no model call, re-run**

- [ ] **Step 3: Golden promote test asserts `prisma.semanticMemory` is absent from the mock and `evalCase.create` is called with the same `workspaceId`.**

- [ ] **Step 4: Referans vakalar page**

The menu label is Referans vakalar. The route stays `/admin/control/golden`. Each row shows title, segment, country, severity label, approver email, and the source lead’s business name. The name links to `/admin/control/trace/[leadId]?workspaceId=`.

Promotion starts from “Referans vaka yap” on the review card. The form has four fields: puan alt sınırı, puan üst sınırı, izinli modüller, yasak iddialar, yasak açılar. The page builds the existing `{ reviewId, datasetId, title, expected }` body from those fields. Before save, call `scoreOutput` on the frozen `outputSnapshot` and show either “Bu kurallarla donmuş çıktı geçer” or “Kalır, çünkü açı yasak” (use the Turkish failure label). The page states: “Kontrol koşusu lead’i yeniden analiz etmez. Saklanan çıktıyı bu kurallarla sayar.” There is no JSON textarea. An empty dataset says “Referans vaka yok.”

---

### Task 9: Eval run compare

**Files:**
- Create: `src/lib/control/eval-run.ts`
- Create: `src/app/admin/control/golden/runs/[runId]/page.tsx`
- Create: `src/app/api/admin/control/golden/runs/route.ts`
- Test: `src/__tests__/control/eval-run.test.ts`

**Interfaces:**
- Consumes: `scoreOutput`, `EvalCase.outputSnapshot`, `EvalCase.expectedJson`
- Produces: `startEvalRun({ workspaceId, datasetId, label, actorUserId, actorRole })`

`startEvalRun` loads cases with `findMany({ where: { workspaceId, datasetId } })`. For each case it parses `expectedJson` with `expectedSchema` and reads `outputSnapshot` as `ScoredOutput`. It writes one `EvalCaseResult` per case and sets the run `SUCCEEDED` with `summaryJson: { passed, total, failedCaseIds }`. `passed / total` is the fraction the Genel Bakış card prints. When `total` is 0, store `passed: 0` and `total: 0`. This function does not call Gemini and does not enqueue a worker.

The compare page lists this workspace’s succeeded runs. The person picks two: the older one is the taban, the newer one is the aday. The choice may be stored in the query string so a refresh keeps it, but the person does not type run ids. Load both with `workspaceId`.

The first block is bozulanlar: cases that passed on the taban and failed on the aday. Each row shows the business name, the Turkish failure label (Puan bandın dışında, Yasak iddia, Yasak açı, Modül), and the two decision cards side by side. Then düzelenler, then değişmeyenler. The heading is counts: “3 bozuldu, 1 düzeldi, 16 aynı.”

The accept control is enabled for an admin and disabled for everyone else, with the reason written beside it. Its text is: “Bu, kontrol sonucunu kabul eder. Canlı ICP, paket ve oyun kitabını yayınlamaz.” Accept writes audit `eval.accept`. It does not activate a calibration.

- [ ] **Step 1: Test a two-case dataset where one fails `FORBIDDEN_CLAIM` and assert `summaryJson.passed` is `1`, `summaryJson.total` is `2`, and the failed id is listed.**

- [ ] **Step 2: Implement and re-run `npx vitest run src/__tests__/control/eval-run.test.ts`**

- [ ] **Step 3: Add the start route guarded by `requireControlRole("REVIEWER")` and the compare page described above. The accept control writes `eval.accept` and does not call `activateCalibration`.**

---

### Task 10: Calibration snapshot, diff, activate, rollback

**Files:**
- Create: `src/lib/control/calibration.ts`
- Create: `src/lib/control/claims.ts`
- Create: `src/app/admin/control/calibration/page.tsx`
- Create: `src/app/api/admin/control/calibration/draft/route.ts`
- Create: `src/app/api/admin/control/calibration/activate/route.ts`
- Create: `src/app/api/admin/control/calibration/rollback/route.ts`
- Test: `src/__tests__/control/calibration.test.ts`
- Test: `src/__tests__/control/claims.test.ts`

**Interfaces:**
- Consumes: `IdealCustomerProfile`, `ServicePackage`, `WorkspacePlaybook`, `WorkspaceCalibrationVersion`
- Produces: `snapshotLive`, `createDraft`, `activateCalibration`, `rollbackCalibration`, `listApprovedClaims`

`snapshotLive(workspaceId)` reads the three live models scoped by `workspaceId` and returns `{ icpJson, packagesJson, claimsJson, playbookJson, pipelineJson }`. `claimsJson` starts as `{ claims: [] }` when no active calibration exists. `pipelineJson` is `{ preset, steps, enabled }` copied from `WorkspaceLeadPipeline` where `workspaceId` matches. When that row is missing, store `{ preset: "BALANCED", steps: [], enabled: true }`. Activation writes those three fields back with `upsert` on `workspaceId`.

`createDraft` inserts status `DRAFT`, `version = max(version) + 1` for that workspace, `baseVersionId` of the current `ACTIVE` row if any, and the posted JSON. It does not write ICP or playbook.

`activateCalibration`:

1. Load the draft by `id` and `workspaceId`. Status must be `DRAFT` or `APPROVED`.
2. If `activatedByUserId === createdByUserId`, throw `Error("activator must differ from author")`.
3. In `prisma.$transaction`:
   - Set any `ACTIVE` row for the workspace to `SUPERSEDED`.
   - Upsert `IdealCustomerProfile` from `icpJson` and increment `version`.
   - Replace `ServicePackage` rows for the workspace with `packagesJson` (deleteMany where workspaceId, then createMany).
   - Upsert `WorkspacePlaybook` from `playbookJson`.
   - Set this row `ACTIVE`, `activatedAt`, `activatedByUserId`.
4. Audit `calibration.activate` with before/after status.
5. Do not enqueue workers.

`rollbackCalibration(workspaceId, actor)` finds the newest `SUPERSEDED` row and runs the same write path, then sets the current `ACTIVE` to `ROLLED_BACK`.

`listApprovedClaims(workspaceId, now)` reads the `ACTIVE` version's `claimsJson` and returns `scoreClaims`.

- [ ] **Step 1: Test activator rule**

```ts
it("refuses self-activation", async () => {
  await expect(
    activateCalibration({
      workspaceId: "ws_1",
      versionId: "cal_1",
      actorUserId: "same-user",
      actorRole: "ADMIN",
      reason: "ship",
    }),
  ).rejects.toThrow("activator must differ from author");
});
```

Mock the version row with `createdByUserId: "same-user"` and `status: "DRAFT"`. Assert `idealCustomerProfile.upsert` was not called.

- [ ] **Step 2: Claims test**

```ts
import { scoreClaims } from "@/lib/control/score";

it("drops provisional and expired claims", () => {
  const kept = scoreClaims(
    [
      { id: "1", text: "faster turns", source: "owner", expiresOn: "2026-12-01", provisional: false },
      { id: "2", text: "18% upsell", source: "seed", expiresOn: "2026-12-01", provisional: true },
      { id: "3", text: "old", source: "owner", expiresOn: "2025-01-01", provisional: false },
    ],
    new Date("2026-09-26T00:00:00Z"),
  );
  expect(kept.map((c) => c.id)).toEqual(["1"]);
});
```

- [ ] **Step 3: Implement the service and the three routes. Activate and rollback require `requireControlRole("ADMIN")`. Draft requires `REVIEWER`.**

- [ ] **Step 4: Calibration page**

The live version is read-only at the top: version number, Turkish status (Taslak, İncelemede, Onaylı, Yayında, Yerini aldı, Geri alındı), who published it, and when. When no version exists, the header says “Henüz yayın yok.” Tabs stay in the query: `?tab=icp|packages|playbook|pipeline|claims`. Claims are their own tab. A provisional or expired claim is grey and reads “satışta kullanılmaz”.

The draft is a change proposal. Diff lines are field changes, for example “puan alt sınırı 70 → 75”. Raw JSON stays in a closed `<details>`. Saving a draft requires a reason. Yayınla is disabled for the author, with the sentence “Bunu sen yazdın. Yayınlaması başka bir yönetici.” The other admin’s confirm lists what will be written: ICP güncellenir, paketler bu alandakilerin yerine geçer, oyun kitabı ve boru hattı yazılır, önceki yayındaki sürüm “yerini aldı” olur. Geri al is a separate, quieter control: “Canlı ayar bir önceki sürüme döner.” Both require a reason. Both write an audit event. The server still rejects self-activation.

---

### Task 11: Audit page

**Files:**
- Create: `src/app/admin/control/audit/page.tsx`
- Test: `src/__tests__/control/audit-list.test.ts`

**Interfaces:**
- Consumes: `AdminAuditEvent`, `User.email`, `User.fullName`
- Produces: `listAdminAudit({ workspaceId, take, before, action, actorUserId, outcome })`

`listAdminAudit` joins `User` on `actorUserId` and selects `email` and `fullName`. It resolves a target label: a lead id becomes `businessName`, a calibration id becomes `v{version}`. `take` defaults to 100 and is capped at 100. The return value includes `hasOlder: boolean`, true when another row exists past this page. The page prints one sentence at the top: “Bu kayıt düzenlenemez ve silinemez.” Each row is a sentence such as “Ayşe, The Ivy için ICP skorunu yeniden çalıştırdı.” Use `fullName`, and the email when `fullName` is null. Never print the bare user id. Beside the sentence: time, “oldu” or “olmadı”, and the reason. The action code (`trace.rerun`) is a smaller second line. The target links to the trace, the review, or the calibration version. Filters are action, person, outcome, and date. The default page is the latest 100. When `hasOlder` is true, show “Daha eski kayıt var” and a control that passes `before`. Do not stop at 100 without saying so. Before and after JSON sit in an expanded row, not in columns. There is no edit control and no delete route. An empty list says “Denetim kaydı yok.”

- [ ] **Step 1: Test that the where clause includes `workspaceId: "ws_1"`, that `take` above 100 is clamped to 100, and that `hasOlder` is true when 101 rows match.**

- [ ] **Step 2: Implement and render the page for VIEWER. Actor text is the name or email.**

---

### Task 12: Approved claims reach the head-agent gate

**Files:**
- Modify: `src/lib/ai-core/agent/head-agent.ts` inside `validateDecision`
- Test: extend the existing head-agent test file if one exists; otherwise `src/__tests__/control/claims-gate.test.ts`

**Interfaces:**
- Consumes: `listApprovedClaims`
- Produces: a decision whose cited claim strings are a subset of approved claim texts

When the active calibration has at least one approved claim, drop any claim-like string on the decision that is not an approved text. Record a warning `unapproved claim dropped`. When the workspace has no active calibration, leave the decision unchanged so existing workspaces keep current behavior.

- [ ] **Step 1: Write a unit test that passes a decision containing `18% upsell` and an approved list of `faster turns`, and expects the upsell string to be absent from the validated decision.**

- [ ] **Step 2: Implement the filter in `validateDecision` without a new Gemini call.**

- [ ] **Step 3: Run `npx vitest run src/__tests__/control src/lib/ai-core/agent` or the existing head-agent test path.**

---

## Milestone exit checks

| After | The system can |
|---|---|
| Tasks 1–6 | A platform admin opens Genel Bakış, reads one sentence, and opens a business by name. The stuck card lands on `filter=stuck`. The trace shows the four-line decision card. A terminal run writes `ChainTelemetry`. |
| Tasks 7–9 | The review count equals the queue length. A reviewer records Kaldı without editing `AgentRun` and promotes that card to a reference case. Two chosen runs show “N bozuldu, N düzeldi, N aynı.” Accept does not publish calibration. No Gemini call. |
| Tasks 10–12 | A reviewer saves a calibration draft and sees a field diff. A different admin activates it. The author sees Yayınla disabled. Provisional claims read “satışta kullanılmaz” and do not survive `listApprovedClaims`. Rollback restores the previous snapshot. Audit shows a sentence with an email, and says when the list is cut at 100. |

## Out of this plan

These stay unbuilt until a later plan: Sentry SDK, Langfuse or Braintrust, HubSpot outcome dashboard, feature-flag UI, incident groups, six platform roles, product-side "report this analysis" button, charts, keyboard shortcuts, a ChainTelemetry panel, and any button that calls `cancel-all-global`.

## Self-review

- Spec pages covered: Genel Bakış (Task 6), inceleme (Task 7), vaka izi (Task 6), referans vakalar (Task 8), karşılaştırma (Task 9), calibration (Task 10), denetim (Task 11).
- `openReviews` and `listReviewQueue` are the same lead set (Task 5, Task 7).
- Trace rows are one per lead and include `businessName` (Task 5, Task 6).
- Decision card is four fields. Raw JSON is closed. `outputJson` is not the page model (Task 6).
- Reference cases are built from four fields. Eval does not re-analyze the lead and does not call a model (Task 8, Task 9).
- Calibration diff is field-by-field. Accepting an eval does not publish (Task 9, Task 10).
- Audit shows email and `hasOlder` (Task 11).
- Golden does not write memory (Task 8 test).
- Live rows change only inside `activateCalibration` / `rollbackCalibration` (Task 10).
- Workspace scope is in every service signature.
