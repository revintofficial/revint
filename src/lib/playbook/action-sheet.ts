/**
 * FineDine v1 update — build the call-first Action Sheet payload.
 *
 * Centralizes the computation shared by `GET /api/leads/[id]` and the
 * dedicated `GET /api/leads/[id]/action-sheet` endpoint: playbook, stage,
 * temperature, SLA, qualification roll-up, and the recommended angle.
 * Pure-ish (one set of scoped DB reads, no writes).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getPlaybook,
  computeQualification,
  computeTemperature,
  type LeadTemperatureValue,
} from "./resolve";
import { pickAngle } from "./angle";
import type { PlaybookShape } from "./types";

export interface ActionSheetPayload {
  businessName: string;
  phone: string | null;
  websiteUrl: string | null;
  timezone: string | null;
  formattedAddress: string | null;
  rating: number | null;
  reviewCount: number | null;
  borough: string | null;
  primaryType: string | null;
  businessStatus: string | null;
  salesConfidence: number | null;
  opportunityScore: number | null;
  playbook: PlaybookShape;
  currentStageKey: string | null;
  temperature: LeadTemperatureValue;
  computedTemperature: LeadTemperatureValue;
  sla: {
    inboundReceivedAt: string | null;
    hoursSinceInbound: number | null;
    untouched: boolean;
    leadSource: string | null;
  };
  qualification: {
    answers: Record<string, boolean>;
    qualified: boolean;
    status: string;
    qualificationRisk: string | null;
    noShowRisk: string | null;
    missing: string[];
  };
  recommendedAngle: {
    key: string;
    label: string;
    whenToPitch?: string;
    whenNotToPitch?: string;
    matchedTriggers: string[];
    confident: boolean;
    openingHook: string | null;
    whatNotToPitch: string[];
  } | null;
  crm: {
    contactId: string | null;
    companyId: string | null;
    dealId: string | null;
    ownerId: string | null;
    connected: boolean;
    lastSyncedAt: string | null;
  };
}

export async function buildActionSheet(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
): Promise<ActionSheetPayload | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    include: {
      qualification: true,
      salesOpportunity: { select: { opportunityScore: true } },
    },
  });
  if (!lead) return null;

  const playbook = await getPlaybook(prisma, workspaceId);

  const latestNextAction = await prisma.leadNextAction.findFirst({
    where: { workspaceId, leadId, supersededAt: null },
    orderBy: { createdAt: "desc" },
    select: { openingHook: true, whatNotToPitch: true },
  });

  const qualAnswers =
    (lead.qualification?.answers as Record<string, boolean> | null) ?? {};
  const qualificationResult = computeQualification(playbook, qualAnswers);

  const currentStageKey = lead.playbookStageKey ?? playbook.stages[0]?.key ?? null;
  const currentStage = playbook.stages.find((s) => s.key === currentStageKey) ?? null;
  const isQualifiedStage = !!currentStage?.isQualified;

  const hoursSinceInbound = lead.inboundReceivedAt
    ? (Date.now() - lead.inboundReceivedAt.getTime()) / 3_600_000
    : null;
  const computedTemperature = computeTemperature(playbook, {
    hoursSinceInbound,
    lastDisposition: lead.lastDisposition,
    qualified: qualificationResult.qualified || isQualifiedStage,
  });

  const picked = pickAngle(playbook, {
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    priceLevel: lead.priceLevel,
    isMultiLocation: !!lead.accountId,
  });

  return {
    businessName: lead.businessName,
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
    timezone: lead.timezone ?? null,
    formattedAddress: lead.formattedAddress ?? null,
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    borough: lead.borough ?? null,
    primaryType: lead.primaryType ?? null,
    businessStatus: lead.businessStatus ?? null,
    salesConfidence: lead.salesConfidence ?? null,
    opportunityScore: lead.salesOpportunity?.opportunityScore ?? null,
    playbook,
    currentStageKey,
    temperature: (lead.leadTemperature as LeadTemperatureValue | null) ?? computedTemperature,
    computedTemperature,
    sla: {
      inboundReceivedAt: lead.inboundReceivedAt?.toISOString() ?? null,
      hoursSinceInbound:
        hoursSinceInbound !== null ? Math.round(hoursSinceInbound) : null,
      untouched: !lead.lastContactedAt,
      leadSource: lead.leadSource,
    },
    qualification: {
      answers: qualAnswers,
      qualified: lead.qualification?.qualified ?? qualificationResult.qualified,
      status: lead.qualification?.status ?? qualificationResult.status,
      qualificationRisk: lead.qualification?.qualificationRisk ?? null,
      noShowRisk: lead.qualification?.noShowRisk ?? null,
      missing: qualificationResult.missing,
    },
    recommendedAngle: picked
      ? {
          key: picked.angle.key,
          label: picked.angle.label,
          whenToPitch: picked.angle.whenToPitch,
          whenNotToPitch: picked.angle.whenNotToPitch,
          matchedTriggers: picked.matchedTriggers,
          confident: picked.score > 0,
          openingHook: latestNextAction?.openingHook ?? null,
          whatNotToPitch: latestNextAction?.whatNotToPitch ?? [],
        }
      : null,
    crm: {
      contactId: lead.crmContactId,
      companyId: lead.crmCompanyId,
      dealId: lead.crmDealId,
      ownerId: lead.crmOwnerId,
      connected: !!lead.crmContactId || !!lead.crmCompanyId || !!lead.crmDealId,
      lastSyncedAt: lead.crmLastSyncedAt?.toISOString() ?? null,
    },
  };
}
