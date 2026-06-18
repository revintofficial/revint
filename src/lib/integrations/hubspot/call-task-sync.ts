/**
 * Revint → HubSpot call/task/deal sync workflow.
 *
 * The plan (Faz 5) defines three SDR moments that need synchronised
 * HubSpot side effects beyond the plain property writeback:
 *
 *   • No Answer  → Call Activity (already done by writeback) +
 *                  Stage → Attempting + "try again tomorrow" Task.
 *   • Connected  → Stage → Connected (call note + props already done).
 *   • Qualified  → Stage → Qualified + ensure a Deal exists at the
 *                  qualified-mapped stage in the default pipeline.
 *
 * The plain property writeback (`writeback.ts → enqueueCrmWriteback`)
 * is keyed on a payload hash and is idempotent. The Call/Task/Deal
 * side-effects each need their own idempotency, which we get by
 * writing dedicated `CrmSyncLog` rows (OUTBOUND, `objectType` =
 * "task" / "deal") keyed on a payload hash derived from the lead +
 * intent + due date. Re-running the same disposition save is therefore
 * a no-op on the HubSpot side.
 *
 * Failure model: every helper here returns its outcome but never
 * throws into the caller. The route returns 200 to the SDR even if
 * HubSpot is throttled or has hiccuped — the `CrmSyncLog` row stays
 * FAILED and the existing reconcile tick will retry.
 */
import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { getPlaybook } from "@/lib/playbook/resolve";
import { mapPlaybookStageToHubspot } from "./field-map";
import type { CrmFieldMapping } from "./field-map";
import {
  getHubspotClient,
  HubspotNotConnectedError,
  type HubspotClient,
} from "./client";

type SyncOutcome = { status: "SUCCESS" | "FAILED" | "SKIPPED"; reason?: string };

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function hash(intent: string, payload: Record<string, string>): string {
  const stable = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join("&");
  return createHash("sha256").update(`${intent}:${stable}`).digest("hex");
}

// -------------------------------------------------------------------------
// Disposition → stage + side-effect mapping.
// -------------------------------------------------------------------------

export type CallDispositionString =
  | "ANSWERED_INTERESTED"
  | "ANSWERED_NOT_INTERESTED"
  | "VOICEMAIL"
  | "NO_ANSWER"
  | "WRONG_NUMBER"
  | "BOOKED_MEETING"
  | "OPTED_OUT";

interface DispositionPlan {
  /** Playbook stage to advance to (forward-only). */
  targetStageKey: string | null;
  /** Whether to schedule a follow-up call task in HubSpot. */
  task: {
    subject: string;
    body: string;
    dueDeltaHours: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
  } | null;
  /** Whether to ensure a Deal exists at the target stage. */
  ensureDeal: boolean;
}

const DISPOSITION_PLAN: Record<CallDispositionString, DispositionPlan> = {
  NO_ANSWER: {
    targetStageKey: "attempting",
    task: {
      subject: "Revint: try again — no answer",
      body: "No answer earlier. Vary time of day; aim for tomorrow morning when inbound was fresh.",
      dueDeltaHours: 24,
      priority: "HIGH",
    },
    ensureDeal: false,
  },
  VOICEMAIL: {
    targetStageKey: "attempting",
    task: {
      subject: "Revint: re-attempt after voicemail",
      body: "Left voicemail. Follow-up call required to confirm receipt and progress qualification.",
      dueDeltaHours: 24,
      priority: "HIGH",
    },
    ensureDeal: false,
  },
  WRONG_NUMBER: {
    targetStageKey: "attempting",
    task: {
      subject: "Revint: verify contact phone (wrong number)",
      body: "Phone on file was wrong. Pull the correct number from the form / company website before next attempt.",
      dueDeltaHours: 4,
      priority: "MEDIUM",
    },
    ensureDeal: false,
  },
  ANSWERED_INTERESTED: {
    targetStageKey: "connected",
    task: {
      subject: "Revint: follow up — interested",
      body: "Connected & interested. Send the next-step artefact today; schedule a follow-up touch in 2 days.",
      dueDeltaHours: 48,
      priority: "MEDIUM",
    },
    ensureDeal: false,
  },
  ANSWERED_NOT_INTERESTED: {
    targetStageKey: "connected",
    task: null,
    ensureDeal: false,
  },
  BOOKED_MEETING: {
    targetStageKey: "meeting_booked",
    task: {
      subject: "Revint: confirm + reduce no-show risk",
      body: "Meeting booked. Send a calendar invite + reminder cadence to cut no-show risk.",
      dueDeltaHours: 24,
      priority: "HIGH",
    },
    ensureDeal: true,
  },
  OPTED_OUT: {
    targetStageKey: "lost",
    task: null,
    ensureDeal: false,
  },
};

// -------------------------------------------------------------------------
// Stage advance + writeback wrapper.
// -------------------------------------------------------------------------

/**
 * Returns true when `nextKey` is forward of `currentKey` in the
 * workspace playbook (i.e. the stage advance is "progress" and not a
 * regression). Falls back to allowing the change when keys are unknown.
 */
function isForwardOnly(
  currentKey: string | null,
  nextKey: string,
  playbook: { stages: Array<{ key: string; order: number; isTerminal?: boolean }> },
): boolean {
  if (!currentKey) return true;
  const current = playbook.stages.find((s) => s.key === currentKey);
  const next = playbook.stages.find((s) => s.key === nextKey);
  if (!current || !next) return true;
  // Always allow advance into a terminal (lost / closed) stage.
  if (next.isTerminal) return true;
  return next.order >= current.order;
}

// -------------------------------------------------------------------------
// Idempotent Task / Deal create against HubSpot.
// -------------------------------------------------------------------------

interface TaskSyncInput {
  workspaceId: string;
  leadId: string;
  disposition: CallDispositionString;
  dueAt: Date;
  subject: string;
  body: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

async function syncHubspotTask(
  prisma: PrismaClient,
  client: HubspotClient,
  input: TaskSyncInput,
  lead: { crmContactId: string | null; crmDealId: string | null; crmOwnerId: string | null },
): Promise<SyncOutcome> {
  if (!lead.crmContactId) {
    return { status: "SKIPPED", reason: "no_contact" };
  }

  const payloadHash = hash("call_task", {
    leadId: input.leadId,
    disposition: input.disposition,
    day: dayKey(input.dueAt),
  });

  const prior = await prisma.crmSyncLog.findUnique({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId: input.workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
  });
  if (prior?.status === "SUCCESS") {
    return { status: "SKIPPED", reason: "duplicate" };
  }

  const log = await prisma.crmSyncLog.upsert({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId: input.workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      direction: "OUTBOUND",
      objectType: "task",
      payloadHash,
      status: "PENDING",
      attempts: 1,
    },
    update: { status: "PENDING", attempts: { increment: 1 } },
  });

  try {
    const task = await client.createTask({
      contactId: lead.crmContactId,
      dealId: lead.crmDealId,
      ownerId: lead.crmOwnerId,
      body: input.body,
      subject: input.subject,
      dueAtMs: input.dueAt.getTime(),
      priority: input.priority,
    });
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", externalId: task.id, lastError: null },
    });
    return { status: "SUCCESS" };
  } catch (err) {
    logger.error("hubspot.call_task.task_failed", {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      err: err instanceof Error ? err.message : String(err),
    });
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    return { status: "FAILED" };
  }
}

interface DealSyncInput {
  workspaceId: string;
  leadId: string;
  stageKey: string;
  dealName: string;
}

/**
 * Ensure a HubSpot Deal exists at the mapped stage. When the lead
 * already has a `crmDealId` we only update the stage; otherwise we
 * create a fresh deal in the workspace's default pipeline and link it
 * back to the lead.
 */
async function ensureHubspotDeal(
  prisma: PrismaClient,
  client: HubspotClient,
  input: DealSyncInput,
  lead: {
    crmContactId: string | null;
    crmCompanyId: string | null;
    crmDealId: string | null;
    crmOwnerId: string | null;
  },
): Promise<SyncOutcome & { dealId?: string }> {
  if (!lead.crmContactId) {
    return { status: "SKIPPED", reason: "no_contact" };
  }

  const conn = await prisma.crmConnection.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId: input.workspaceId,
        provider: "HUBSPOT",
      },
    },
    select: { fieldMappingJson: true, defaultPipelineId: true },
  });
  const mapping =
    (conn?.fieldMappingJson as unknown as CrmFieldMapping | null) ?? null;
  const playbook = await getPlaybook(prisma, input.workspaceId);
  const target = mapPlaybookStageToHubspot(
    input.stageKey,
    playbook,
    mapping,
    conn?.defaultPipelineId,
  );
  if (!target) {
    return { status: "SKIPPED", reason: "no_stage_mapping" };
  }

  const payloadHash = hash("ensure_deal", {
    leadId: input.leadId,
    stageId: target.stageId,
    pipelineId: target.pipelineId,
  });

  const prior = await prisma.crmSyncLog.findUnique({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId: input.workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
  });
  if (prior?.status === "SUCCESS") {
    return { status: "SKIPPED", reason: "duplicate" };
  }

  const log = await prisma.crmSyncLog.upsert({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId: input.workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      direction: "OUTBOUND",
      objectType: "deal",
      payloadHash,
      status: "PENDING",
      attempts: 1,
    },
    update: { status: "PENDING", attempts: { increment: 1 } },
  });

  try {
    let dealId: string;
    if (lead.crmDealId) {
      await client.updateDeal(lead.crmDealId, {
        dealstage: target.stageId,
      });
      dealId = lead.crmDealId;
    } else {
      const created = await client.createDeal({
        contactId: lead.crmContactId,
        companyId: lead.crmCompanyId,
        ownerId: lead.crmOwnerId,
        dealName: input.dealName,
        pipelineId: target.pipelineId,
        stageId: target.stageId,
      });
      dealId = created.id;
      // Persist the new deal id back to the lead so subsequent
      // writeback / stage updates target it.
      await prisma.lead.update({
        where: { id: input.leadId },
        data: { crmDealId: dealId, crmLastSyncedAt: new Date() },
      });
    }

    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", externalId: dealId, lastError: null },
    });
    return { status: "SUCCESS", dealId };
  } catch (err) {
    logger.error("hubspot.call_task.deal_failed", {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      stageKey: input.stageKey,
      err: err instanceof Error ? err.message : String(err),
    });
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    return { status: "FAILED" };
  }
}

// -------------------------------------------------------------------------
// Public entry points
// -------------------------------------------------------------------------

export interface CallOutcomeInput {
  workspaceId: string;
  leadId: string;
  disposition: CallDispositionString;
  /** Optional override for the task due date (defaults to plan.deltaHours from now). */
  taskDueAt?: Date | null;
}

export interface CallOutcomeResult {
  stageAdvanced: { from: string | null; to: string } | null;
  task: SyncOutcome;
  deal: SyncOutcome;
}

/**
 * Apply the call disposition workflow to a lead:
 *   1. Forward-only stage advance on `Lead.playbookStageKey` (with a
 *      STATUS_CHANGED activity), if the disposition warrants it.
 *   2. Create a follow-up HubSpot Task (idempotent on lead+disposition+day).
 *   3. Ensure a HubSpot Deal exists at the target stage when the
 *      disposition is BOOKED_MEETING.
 *
 * Best-effort: missing HubSpot connection → SKIPPED; transient HubSpot
 * failures → FAILED (reconcile-able).
 */
export async function applyCallOutcome(
  prisma: PrismaClient,
  input: CallOutcomeInput,
): Promise<CallOutcomeResult> {
  const plan = DISPOSITION_PLAN[input.disposition];
  const result: CallOutcomeResult = {
    stageAdvanced: null,
    task: { status: "SKIPPED", reason: "no_plan" },
    deal: { status: "SKIPPED", reason: "no_plan" },
  };
  if (!plan) return result;

  // 1. Forward-only stage advance (no HubSpot call yet — the
  //    `playbook-stage` writeback path will reflect it).
  if (plan.targetStageKey) {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, workspaceId: input.workspaceId },
      select: { id: true, playbookStageKey: true },
    });
    if (lead) {
      const playbook = await getPlaybook(prisma, input.workspaceId);
      const forward = isForwardOnly(
        lead.playbookStageKey,
        plan.targetStageKey,
        playbook,
      );
      if (forward && lead.playbookStageKey !== plan.targetStageKey) {
        await prisma.$transaction([
          prisma.lead.update({
            where: { id: lead.id },
            data: { playbookStageKey: plan.targetStageKey },
          }),
          prisma.leadActivity.create({
            data: {
              workspaceId: input.workspaceId,
              leadId: lead.id,
              kind: "STATUS_CHANGED",
              payload: {
                from: lead.playbookStageKey,
                to: plan.targetStageKey,
                kind: "playbook_stage",
                reason: `disposition:${input.disposition}`,
              },
            },
          }),
        ]);
        result.stageAdvanced = {
          from: lead.playbookStageKey,
          to: plan.targetStageKey,
        };
      }
    }
  }

  // 2 + 3. Side-effects that need a HubSpot client.
  let client: HubspotClient;
  try {
    client = await getHubspotClient(prisma, input.workspaceId);
  } catch (err) {
    if (err instanceof HubspotNotConnectedError) {
      result.task = { status: "SKIPPED", reason: "not_connected" };
      result.deal = { status: "SKIPPED", reason: "not_connected" };
      return result;
    }
    throw err;
  }

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, workspaceId: input.workspaceId },
    select: {
      crmContactId: true,
      crmCompanyId: true,
      crmDealId: true,
      crmOwnerId: true,
      businessName: true,
      playbookStageKey: true,
    },
  });
  if (!lead) {
    result.task = { status: "SKIPPED", reason: "lead_not_found" };
    result.deal = { status: "SKIPPED", reason: "lead_not_found" };
    return result;
  }

  if (plan.task) {
    const dueAt =
      input.taskDueAt ??
      new Date(Date.now() + plan.task.dueDeltaHours * 3_600_000);
    result.task = await syncHubspotTask(
      prisma,
      client,
      {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        disposition: input.disposition,
        dueAt,
        subject: plan.task.subject,
        body: plan.task.body,
        priority: plan.task.priority,
      },
      lead,
    );
  }

  if (plan.ensureDeal && plan.targetStageKey) {
    result.deal = await ensureHubspotDeal(
      prisma,
      client,
      {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        stageKey: plan.targetStageKey,
        dealName: lead.businessName ?? "Revint deal",
      },
      lead,
    );
  }

  return result;
}

export interface EnsureQualifiedDealInput {
  workspaceId: string;
  leadId: string;
}

/**
 * Ensure a HubSpot Deal exists at the playbook's qualified stage. Called
 * from the qualification route when the lead crosses the qualification
 * threshold (so a fresh inbound qualified lead generates a Deal even if
 * the SDR never logs a `BOOKED_MEETING` call).
 */
export async function ensureQualifiedDeal(
  prisma: PrismaClient,
  input: EnsureQualifiedDealInput,
): Promise<SyncOutcome> {
  let client: HubspotClient;
  try {
    client = await getHubspotClient(prisma, input.workspaceId);
  } catch (err) {
    if (err instanceof HubspotNotConnectedError) {
      return { status: "SKIPPED", reason: "not_connected" };
    }
    throw err;
  }

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, workspaceId: input.workspaceId },
    select: {
      crmContactId: true,
      crmCompanyId: true,
      crmDealId: true,
      crmOwnerId: true,
      businessName: true,
    },
  });
  if (!lead) return { status: "SKIPPED", reason: "lead_not_found" };

  return ensureHubspotDeal(
    prisma,
    client,
    {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      stageKey: "qualified",
      dealName: lead.businessName ?? "Revint deal",
    },
    lead,
  );
}
