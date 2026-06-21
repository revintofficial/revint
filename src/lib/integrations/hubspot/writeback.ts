/**
 * Revint → HubSpot writeback.
 *
 * Pushes Revint intelligence onto the HubSpot contact via the canonical
 * `revint_*` custom properties, optionally logs a call/note engagement,
 * and updates the deal stage. Every attempt is recorded in `CrmSyncLog`
 * (OUTBOUND) keyed on a payload hash so re-running with the same data
 * is a no-op (idempotent). Failures are marked FAILED for the reconcile
 * tick to retry — there is no new BullMQ queue (per the workspace rule);
 * the route fires this best-effort and `reconcileCrmWriteback` sweeps
 * failures.
 *
 * The property map is the single source of truth for what Revint
 * exposes to HubSpot — see `properties.ts` for the canonical set.
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
import { REVINT_ENUM_PROPERTY_NAMES } from "./properties";

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
  /** HubSpot call disposition GUID (when reason = "disposition"). */
  callDisposition?: string;
}

function hashProps(obj: Record<string, string>, reason: string): string {
  const stable = Object.keys(obj)
    .sort()
    .map((k) => `${k}=${obj[k]}`)
    .join("&");
  return createHash("sha256").update(`${reason}:${stable}`).digest("hex");
}

function actionSheetUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/app/leads/${leadId}`;
}

const RISK_TO_UPPER: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

/**
 * Build the `revint_*` property map for a lead. Only includes
 * properties we have a value for: HubSpot rejects empty enumeration
 * writes, and unset string properties are best left untouched so manual
 * edits in HubSpot aren't clobbered.
 */
async function buildRevintProperties(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
): Promise<{
  properties: Record<string, string>;
  playbookStageKey: string | null;
} | null> {
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

  // --- A. Skorlama -------------------------------------------------------
  if (typeof lead.salesConfidence === "number") {
    props.revint_sales_confidence = String(lead.salesConfidence);
  }
  if (lead.leadTemperature) {
    props.revint_lead_temperature = lead.leadTemperature;
  }
  // `revint_today_priority` is intentionally omitted here: it's a
  // queue-position rank that needs a workspace-wide pass to compute
  // (and changes throughout the day). Future: a priority worker writes
  // it; for now we leave the field unset so manual edits stick.

  // --- B. Karar / pitch sinyalleri ---------------------------------------
  if (picked?.angle.label) {
    props.revint_recommended_angle = picked.angle.label;
  }
  if (nextAction?.openingHook) {
    props.revint_next_best_action = nextAction.openingHook;
  }
  if (lead.qualification?.status) {
    props.revint_qualification_status = lead.qualification.status;
  }
  if (lead.qualification?.noShowRisk) {
    const upper = RISK_TO_UPPER[lead.qualification.noShowRisk];
    if (upper) props.revint_no_show_risk = upper;
  }
  if (lead.subNicheSlug) {
    props.revint_detected_sub_niche = lead.subNicheSlug;
  }

  // --- C. Kanıt / provenance --------------------------------------------
  if (picked && picked.matchedTriggers.length > 0) {
    props.revint_evidence_summary = `Signals: ${picked.matchedTriggers.join(", ")}`;
  }
  // `revint_source_conflicts` is left unset until the source-conflict
  // detector lands (separate plan); provisioning the field now keeps
  // the App Card forward-compatible without writing empty strings.
  props.revint_action_sheet_url = actionSheetUrl(leadId);

  // Defensive: drop enum properties whose value isn't in the allowed set
  // (HubSpot rejects out-of-vocab enum writes with a 400 that fails the
  // whole batch). Belt-and-braces — every enum field above already uses
  // the canonical uppercase, but a future caller might mis-pass.
  for (const key of Object.keys(props)) {
    if (!REVINT_ENUM_PROPERTY_NAMES.has(key)) continue;
    const v = props[key];
    if (!v) {
      delete props[key];
    }
  }

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

  const built = await buildRevintProperties(prisma, workspaceId, leadId);
  if (!built) return { status: "SKIPPED", reason: "lead_not_found" };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: {
      crmContactId: true,
      crmDealId: true,
      crmCompanyId: true,
      crmOwnerId: true,
      businessName: true,
      playbookStageKey: true,
    },
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
            title: "Revint call disposition",
            dealId: lead.crmDealId,
            disposition: input.callDisposition,
          });
        } catch (err) {
          logger.warn("hubspot.writeback.engagement_failed", { leadId, err });
        }
      }
    }

    // Deal stage writeback (stage reason carries the rolled-up playbook
    // stage; the field-map resolves pipeline + stage ids).
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
): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
  failures: Array<{ leadId: string; status: string; reason?: string }>;
}> {
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
  let failed = 0;
  const failures: Array<{ leadId: string; status: string; reason?: string }> =
    [];
  for (const row of rows) {
    if (!row.leadId) continue;
    const res = await enqueueCrmWriteback(prisma, {
      workspaceId: row.workspaceId,
      leadId: row.leadId,
      reason: "analysis",
    });
    if (res.status === "SUCCESS" || res.status === "SKIPPED") {
      succeeded += 1;
    } else {
      failed += 1;
      const log = await prisma.crmSyncLog.findFirst({
        where: {
          workspaceId: row.workspaceId,
          leadId: row.leadId,
          direction: "OUTBOUND",
        },
        orderBy: { updatedAt: "desc" },
        select: { lastError: true },
      });
      failures.push({
        leadId: row.leadId,
        status: res.status,
        reason: res.reason ?? log?.lastError ?? undefined,
      });
    }
  }
  return { retried: rows.length, succeeded, failed, failures };
}
