/**
 * FineDine v1 update — HubSpot writeback (LeadAC → HubSpot).
 *
 * Pushes LeadAC intelligence onto the HubSpot contact via the `leadac_*`
 * custom properties, optionally logs a call/note engagement, and updates
 * the deal stage. Every attempt is recorded in `CrmSyncLog` (OUTBOUND)
 * keyed on a payload hash so re-running with the same data is a no-op
 * (idempotent). Failures are marked FAILED for the reconcile tick to
 * retry — there is no new BullMQ queue (per the workspace rule); the
 * route fires this best-effort and `reconcileCrmWriteback` sweeps
 * failures.
 */
import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import {
  getHubspotClient,
  HubspotNotConnectedError,
  type HubspotClient,
} from "./client";
import { getPlaybook } from "@/lib/playbook/resolve";
import { pickAngle } from "@/lib/playbook/angle";
import {
  mapPlaybookStageToHubspot,
  type CrmFieldMapping,
} from "./field-map";

export type WritebackReason =
  | "qualification"
  | "disposition"
  | "analysis"
  | "stage";

export interface EnqueueWritebackInput {
  workspaceId: string;
  leadId: string;
  reason: WritebackReason;
  /** Optional rep note for a disposition engagement. */
  engagementNote?: string;
}

function hashProps(obj: Record<string, string>, reason: string): string {
  const stable = Object.keys(obj)
    .sort()
    .map((k) => `${k}=${obj[k]}`)
    .join("&");
  return createHash("sha256").update(`${reason}:${stable}`).digest("hex");
}

function leadSheetUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/app/leads/${leadId}`;
}

/**
 * Build the `leadac_*` property map for a lead. Only includes properties
 * we have a value for (HubSpot rejects empty enumeration writes).
 */
async function buildLeadacProperties(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
): Promise<{ properties: Record<string, string>; playbookStageKey: string | null } | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    include: { qualification: true },
  });
  if (!lead) return null;

  const playbook = await getPlaybook(prisma, workspaceId);
  const picked = pickAngle(playbook, {
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    priceLevel: lead.priceLevel,
    isMultiLocation: !!lead.accountId,
  });
  const nextAction = await prisma.leadNextAction.findFirst({
    where: { workspaceId, leadId, supersededAt: null },
    orderBy: { createdAt: "desc" },
    select: { openingHook: true, timingWindowStart: true },
  });

  const props: Record<string, string> = {};
  if (lead.leadTemperature) props.leadac_temperature = lead.leadTemperature;
  if (picked?.angle.label) props.leadac_recommended_angle = picked.angle.label;
  if (nextAction?.openingHook) props.leadac_next_best_action = nextAction.openingHook;
  if (lead.qualification?.status) {
    props.leadac_qualification_status = lead.qualification.status;
  }
  if (lead.qualification?.qualificationRisk) {
    props.leadac_qualification_risk = lead.qualification.qualificationRisk;
  }
  if (lead.qualification?.noShowRisk) {
    props.leadac_no_show_risk = lead.qualification.noShowRisk;
  }
  if (typeof lead.icpFitScore === "number") {
    props.leadac_fit_score = String(lead.icpFitScore);
  }
  if (typeof lead.salesConfidence === "number") {
    props.leadac_lead_priority = String(lead.salesConfidence);
  }
  if (picked && picked.matchedTriggers.length > 0) {
    props.leadac_evidence_summary = `Signals: ${picked.matchedTriggers.join(", ")}`;
  }
  props.leadac_last_analyzed_date = String(Date.now());
  if (lead.nextActionDueAt) {
    props.leadac_next_follow_up_date = String(lead.nextActionDueAt.getTime());
  }
  props.leadac_lead_sheet_url = leadSheetUrl(leadId);

  return { properties: props, playbookStageKey: lead.playbookStageKey };
}

/**
 * Perform a single writeback for a lead. Idempotent on the property
 * payload hash. Returns the sync outcome. Safe to call fire-and-forget.
 */
export async function enqueueCrmWriteback(
  prisma: PrismaClient,
  input: EnqueueWritebackInput,
): Promise<{ status: "SUCCESS" | "FAILED" | "SKIPPED"; reason?: string }> {
  const { workspaceId, leadId, reason } = input;

  const built = await buildLeadacProperties(prisma, workspaceId, leadId);
  if (!built) return { status: "SKIPPED", reason: "lead_not_found" };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { crmContactId: true, crmDealId: true, playbookStageKey: true },
  });
  if (!lead || (!lead.crmContactId && !lead.crmDealId)) {
    return { status: "SKIPPED", reason: "no_crm_linkage" };
  }

  const payloadHash = hashProps(built.properties, reason);

  // Idempotency: an identical successful writeback already happened.
  const prior = await prisma.crmSyncLog.findUnique({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
  });
  if (prior?.status === "SUCCESS") {
    return { status: "SKIPPED", reason: "duplicate" };
  }

  // Record the attempt (PENDING). Upsert so a prior FAILED row is retried.
  const log = await prisma.crmSyncLog.upsert({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
    create: {
      workspaceId,
      leadId,
      direction: "OUTBOUND",
      objectType: "contact",
      payloadHash,
      status: "PENDING",
      attempts: 1,
    },
    update: { status: "PENDING", attempts: { increment: 1 } },
  });

  let client: HubspotClient;
  try {
    client = await getHubspotClient(prisma, workspaceId);
  } catch (err) {
    const skip = err instanceof HubspotNotConnectedError;
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: {
        status: skip ? "SKIPPED" : "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    return { status: skip ? "SKIPPED" : "FAILED" };
  }

  try {
    let externalId: string | undefined;

    if (lead.crmContactId) {
      const res = await client.updateContact(lead.crmContactId, built.properties);
      externalId = res.id;

      if (reason === "disposition" && input.engagementNote) {
        try {
          await client.createCall({
            contactId: lead.crmContactId,
            body: input.engagementNote,
            title: "LeadAC call disposition",
          });
        } catch (err) {
          logger.warn("hubspot.writeback.engagement_failed", { leadId, err });
        }
      }
    }

    // Deal stage writeback.
    if (reason === "stage" && lead.crmDealId && built.playbookStageKey) {
      const conn = await prisma.crmConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
        select: { fieldMappingJson: true, defaultPipelineId: true },
      });
      const mapping =
        (conn?.fieldMappingJson as unknown as CrmFieldMapping | null) ?? null;
      const playbook = await getPlaybook(prisma, workspaceId);
      const target = mapPlaybookStageToHubspot(
        built.playbookStageKey,
        playbook,
        mapping,
        conn?.defaultPipelineId,
      );
      if (target) {
        await client.updateDeal(lead.crmDealId, { dealstage: target.stageId });
      }
    }

    await prisma.$transaction([
      prisma.crmSyncLog.update({
        where: { id: log.id },
        data: { status: "SUCCESS", externalId, lastError: null },
      }),
      prisma.lead.update({
        where: { id: leadId },
        data: { crmLastSyncedAt: new Date() },
      }),
    ]);
    return { status: "SUCCESS" };
  } catch (err) {
    logger.error("hubspot.writeback.failed", {
      workspaceId,
      leadId,
      reason,
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

/**
 * Reconcile tick — retry FAILED / stuck PENDING outbound syncs. Call
 * from a cron route or the workers supervisor. Bounded to avoid hammering
 * HubSpot; gives up on a row after `maxAttempts`.
 */
export async function reconcileCrmWriteback(
  prisma: PrismaClient,
  opts: { workspaceId?: string; limit?: number; maxAttempts?: number } = {},
): Promise<{ retried: number; succeeded: number }> {
  const { limit = 50, maxAttempts = 5 } = opts;
  const rows = await prisma.crmSyncLog.findMany({
    where: {
      direction: "OUTBOUND",
      status: "FAILED",
      attempts: { lt: maxAttempts },
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      leadId: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true, workspaceId: true, leadId: true },
  });

  let succeeded = 0;
  for (const row of rows) {
    if (!row.leadId) continue;
    const res = await enqueueCrmWriteback(prisma, {
      workspaceId: row.workspaceId,
      leadId: row.leadId,
      reason: "analysis",
    });
    if (res.status === "SUCCESS") succeeded += 1;
  }
  return { retried: rows.length, succeeded };
}
