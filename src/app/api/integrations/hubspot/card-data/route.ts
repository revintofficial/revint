/**
 * Revint App Card data-fetch endpoint.
 *
 * This is the **new** App Card backend that replaces the deprecated
 * Legacy CRM Card (`src/app/api/integrations/hubspot/card/route.ts`).
 * It is called by the React UI Extension (`hubspot-app/.../RevintCard.tsx`)
 * via `hubspot.fetch()` and returns a **flat JSON** payload (NOT the
 * legacy `{ results: [...] }` shape).
 *
 * Auth contract:
 *   - HubSpot signs the request with v3 signature (POST + URL + body +
 *     timestamp HMAC-SHA256 with the public-app client secret).
 *   - We verify the signature BEFORE any DB read.
 *   - HubSpot ships `X-HubSpot-Hub-Id` as the portal id; we resolve the
 *     workspace from `CrmConnection.portalId` and scope every query by
 *     that workspaceId. Cross-tenant portal leakage is impossible by
 *     construction (the portal id is signed input).
 *
 * Hard limits (from HubSpot's hubspot.fetch contract):
 *   - 15 s default timeout (configurable up to 120 s by the card).
 *   - 1 MB request + response payload.
 *   - 20 concurrent requests per installed portal.
 * So this handler MUST stay light:
 *   - no Gemini / Apify / AI calls,
 *   - no heavy joins,
 *   - reads denormalised `revint_*` shaped fields off the Lead +
 *     LeadQualification + (most recent) LeadNextAction only.
 *
 * Request body (sent by the card):
 *   { "objectType": "CONTACT" | "DEAL" | "COMPANY", "objectId": "12345" }
 * Response (flat JSON the card maps onto its UI):
 *   {
 *     "found": boolean,
 *     "lead": { id, businessName, ... },
 *     "actionSheetUrl": string,
 *     "signals": { temperature, qualificationStatus, ... },
 *     "decision": { recommendedAngle, pitchThis, nextBestAction, ... },
 *     "lastSyncedAt": string | null
 *   }
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyHubspotRequest } from "@/lib/integrations/hubspot/webhook";
import { getHubspotClient } from "@/lib/integrations/hubspot/client";
import { getPlaybook } from "@/lib/playbook/resolve";
import { pickAngle } from "@/lib/playbook/angle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard ceiling on response size we'll ever produce. HubSpot enforces
// 1 MB; we cap individual long-form fields well below that so the
// response stays comfortably inside the limit even with future
// additions.
const MAX_EVIDENCE_CHARS = 2000;
const MAX_HOOK_CHARS = 800;

// HubSpot UI extensions send the CRM object as an `objectTypeId`
// (e.g. "0-1" for contacts, "0-2" companies, "0-3" deals) rather than a
// friendly string. Normalise both shapes to our canonical type so the
// linkage lookup + association fallback target the right column.
const HUBSPOT_OBJECT_TYPE: Record<string, "CONTACT" | "COMPANY" | "DEAL"> = {
  "0-1": "CONTACT",
  "0-2": "COMPANY",
  "0-3": "DEAL",
  CONTACT: "CONTACT",
  COMPANY: "COMPANY",
  DEAL: "DEAL",
};

function normalizeObjectType(raw: string): "CONTACT" | "COMPANY" | "DEAL" {
  return HUBSPOT_OBJECT_TYPE[raw.toUpperCase()] ?? "CONTACT";
}

// A contact can be associated with several companies/deals. HubSpot marks
// the canonical one with the "Primary" association label (typeId 1). When
// resolving a lead we must follow the primary association first, otherwise
// we can surface a stray secondary company (often an unscored duplicate)
// instead of the real account.
interface HubspotAssociation {
  toObjectId: string | number;
  associationTypes?: Array<{ typeId?: number; label?: string | null }>;
}

function isPrimaryAssociation(assoc: HubspotAssociation): boolean {
  return (assoc.associationTypes ?? []).some(
    (t) => t.typeId === 1 || (t.label ?? "").toUpperCase() === "PRIMARY",
  );
}

function primaryFirst<T extends HubspotAssociation>(results: T[]): T[] {
  return [...results].sort(
    (a, b) => Number(isPrimaryAssociation(b)) - Number(isPrimaryAssociation(a)),
  );
}

const leadCardSelect = {
  id: true,
  businessName: true,
  leadTemperature: true,
  salesConfidence: true,
  icpFitScore: true,
  hasWebsite: true,
  rating: true,
  reviewCount: true,
  priceLevel: true,
  accountId: true,
  subNicheSlug: true,
  playbookStageKey: true,
  lastDisposition: true,
  inboundReceivedAt: true,
  crmLastSyncedAt: true,
  qualification: {
    select: {
      status: true,
      qualified: true,
      qualificationRisk: true,
      noShowRisk: true,
    },
  },
  nextActions: {
    where: { supersededAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      openingHook: true,
      timingWindowStart: true,
      timingWindowEnd: true,
      actionKind: true,
      confidence: true,
    },
  },
} as const;

type LeadCardRow = Awaited<
  ReturnType<
    typeof prisma.lead.findFirst<{ select: typeof leadCardSelect }>
  >
>;

/**
 * Resolve a Revint lead for the HubSpot record the card is embedded on.
 * CONTACT records often lack a direct `crmContactId` link when the lead
 * was ingested from a company webhook/import — fall back to HubSpot
 * associations (contact → company/deal) and backfill `crmContactId` so
 * future lookups + writebacks target the right record.
 */
async function resolveLeadForCard(args: {
  workspaceId: string;
  objectType: string;
  objectId: string;
}): Promise<LeadCardRow | null> {
  const { workspaceId, objectType, objectId } = args;

  const directWhere =
    objectType === "DEAL"
      ? { workspaceId, crmDealId: objectId }
      : objectType === "COMPANY"
        ? { workspaceId, crmCompanyId: objectId }
        : { workspaceId, crmContactId: objectId };

  const direct = await prisma.lead.findFirst({
    where: directWhere,
    select: leadCardSelect,
  });
  if (direct) return direct;

  if (objectType !== "CONTACT") return null;

  try {
    const client = await getHubspotClient(prisma, workspaceId);

    const companyAssocs = await client.getAssociations(
      "contacts",
      objectId,
      "companies",
    );
    for (const assoc of primaryFirst(companyAssocs.results ?? [])) {
      const companyId = String(assoc.toObjectId);
      const viaCompany = await prisma.lead.findFirst({
        where: { workspaceId, crmCompanyId: companyId },
        select: leadCardSelect,
      });
      if (viaCompany) {
        await prisma.lead.updateMany({
          where: { id: viaCompany.id, workspaceId, crmContactId: null },
          data: { crmContactId: objectId },
        });
        return viaCompany;
      }
    }

    const dealAssocs = await client.getAssociations(
      "contacts",
      objectId,
      "deals",
    );
    for (const assoc of primaryFirst(dealAssocs.results ?? [])) {
      const dealId = String(assoc.toObjectId);
      const viaDeal = await prisma.lead.findFirst({
        where: { workspaceId, crmDealId: dealId },
        select: leadCardSelect,
      });
      if (viaDeal) {
        await prisma.lead.updateMany({
          where: { id: viaDeal.id, workspaceId, crmContactId: null },
          data: { crmContactId: objectId },
        });
        return viaDeal;
      }
    }
  } catch (err) {
    logger.warn("api.hubspot.card_data.association_lookup_failed", {
      workspaceId,
      objectId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

function actionSheetUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/app/leads/${leadId}`;
}

/**
 * Build every plausible public-URL representation HubSpot might have
 * signed. On Vercel the route handler's `request.url` can surface the
 * internal scheme/host rather than the custom domain the card actually
 * called, which breaks the v3 HMAC. We hand the verifier the env override
 * plus a forwarded-header reconstruction so a host/scheme drift no longer
 * forces a 401.
 */
function cardUrlCandidates(request: Request): string[] {
  const out: string[] = [];
  if (process.env.HUBSPOT_CARD_URL) out.push(process.env.HUBSPOT_CARD_URL);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    out.push(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/card-data`);
  }
  try {
    const u = new URL(request.url);
    const fwdHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
    if (fwdHost) out.push(`${fwdProto}://${fwdHost}${u.pathname}`);
  } catch {
    // request.url not parseable — verifier still tries it raw.
  }
  return out;
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

interface CardRequestBody {
  objectType?: string;
  objectId?: string | number;
  portalId?: string | number;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");

  const verify = verifyHubspotRequest({
    method: "POST",
    requestUrl: request.url,
    rawBody,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    urlOverride: cardUrlCandidates(request),
    signatureV3: signature,
    timestamp,
    signatureV2: request.headers.get("x-hubspot-signature"),
    signatureVersion: request.headers.get("x-hubspot-signature-version"),
  });
  if (!verify.valid) {
    logger.warn("api.hubspot.card_data.invalid_signature", {
      reason: verify.reason,
      observedUrl: request.url,
      signatureVersion: request.headers.get("x-hubspot-signature-version"),
      hasClientSecret: !!process.env.HUBSPOT_CLIENT_SECRET,
      hasCardUrlEnv: !!process.env.HUBSPOT_CARD_URL,
      urlCandidates: cardUrlCandidates(request),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // TEMP DIAGNOSTIC — capture exactly what the real card sends so we can see
  // why requests 400. Remove once the card is confirmed working.
  logger.warn("api.hubspot.card_data.debug_request", {
    rawBodyLen: rawBody.length,
    rawBodySample: rawBody.slice(0, 300),
    hasHubIdHeader: !!request.headers.get("x-hubspot-hub-id"),
    contentType: request.headers.get("content-type"),
  });

  let body: CardRequestBody;
  try {
    body = rawBody ? (JSON.parse(rawBody) as CardRequestBody) : {};
  } catch {
    logger.warn("api.hubspot.card_data.reject", { at: "invalid_body" });
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const objectType = normalizeObjectType((body.objectType ?? "CONTACT").toString());
  const objectId = body.objectId == null ? "" : String(body.objectId);
  if (!objectId) {
    logger.warn("api.hubspot.card_data.reject", {
      at: "missing_object_id",
      keys: Object.keys(body ?? {}),
    });
    return NextResponse.json({ error: "missing_object_id" }, { status: 400 });
  }

  // Portal id resolution. `hubspot.fetch` CANNOT set custom request headers,
  // but HubSpot automatically appends `portalId` (and userId/userEmail/appId)
  // as query params — and the full URL is covered by the v3 signature, so
  // the query param is trustworthy. We accept, in order: the query param
  // (real card), the body (card also sends it), then the x-hubspot-hub-id
  // header (server-to-server / smoke tests).
  const portalId =
    new URL(request.url).searchParams.get("portalId") ??
    (body.portalId != null ? String(body.portalId) : null) ??
    request.headers.get("x-hubspot-hub-id");
  if (!portalId) {
    logger.warn("api.hubspot.card_data.reject", {
      at: "missing_portal_id",
      keys: Object.keys(body ?? {}),
    });
    return NextResponse.json({ error: "missing_portal_id" }, { status: 400 });
  }

  // Resolve workspace from portal — non-throwing query so an unknown
  // portal returns an empty payload (the card renders "not connected").
  // A portal *should* map to one workspace, but during testing the same
  // portal can end up connected to several. Resolve deterministically to the
  // most recently updated active connection so the card never flip-flops
  // between workspaces (and their duplicate leads) across requests.
  const conn = await prisma.crmConnection.findFirst({
    where: { portalId, provider: "HUBSPOT", status: { not: "REVOKED" } },
    orderBy: { updatedAt: "desc" },
    select: { workspaceId: true },
  });
  if (!conn) {
    return NextResponse.json({
      found: false,
      reason: "workspace_not_found",
    });
  }
  const { workspaceId } = conn;

  const lead = await resolveLeadForCard({ workspaceId, objectType, objectId });

  if (!lead) {
    return NextResponse.json({
      found: false,
      reason: "lead_not_found",
      actionSheetUrl: actionSheetUrl(""),
    });
  }

  // Recommend the best angle for the card's "Best Angle" + "Pitch This"
  // rows. `pickAngle` is pure (no IO besides the playbook resolve), so
  // staying inside the 15 s envelope is comfortable.
  const playbook = await getPlaybook(prisma, workspaceId);
  const picked = pickAngle(playbook, {
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    priceLevel: lead.priceLevel,
    isMultiLocation: !!lead.accountId,
  });

  const hoursSinceInbound = lead.inboundReceivedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - lead.inboundReceivedAt.getTime()) / 3_600_000),
      )
    : null;

  const nextAction = lead.nextActions[0] ?? null;
  const stage = playbook.stages.find((s) => s.key === lead.playbookStageKey);

  // Compose a single-line "why this risk?" string so the SDR can see
  // the reasoning without opening the action sheet. Kept terse on
  // purpose (the card is decision-only; deep evidence lives in the
  // action sheet).
  const qualificationRiskReason = (() => {
    if (!lead.qualification) return null;
    if (lead.qualification.status === "info_only") {
      return "Caller only after info — not in buying mode.";
    }
    if (lead.qualification.qualificationRisk === "high") {
      return "Decision-maker contact + concrete next step still missing.";
    }
    if (lead.qualification.qualificationRisk === "medium") {
      return "Partial qualification — one required item still open.";
    }
    return null;
  })();

  return NextResponse.json({
    found: true,
    lead: {
      id: lead.id,
      businessName: lead.businessName,
    },
    actionSheetUrl: actionSheetUrl(lead.id),
    timing: {
      hoursSinceInbound,
      inboundReceivedAt: lead.inboundReceivedAt?.toISOString() ?? null,
      lastSyncedAt: lead.crmLastSyncedAt?.toISOString() ?? null,
    },
    signals: {
      temperature: lead.leadTemperature, // "HOT" | "WARM" | "COLD" | null
      salesConfidence: lead.salesConfidence ?? null,
      icpFitScore: lead.icpFitScore ?? null,
      stageKey: lead.playbookStageKey,
      stageLabel: stage?.label ?? null,
      subNicheSlug: lead.subNicheSlug,
      qualificationStatus: lead.qualification?.status ?? null,
      qualified: lead.qualification?.qualified ?? false,
      qualificationRisk: lead.qualification?.qualificationRisk ?? null,
      qualificationRiskReason,
      // Card UI expects uppercase HIGH/MEDIUM/LOW; storage holds
      // lowercase (low/medium/high) so map here.
      noShowRisk: lead.qualification?.noShowRisk?.toUpperCase() ?? null,
    },
    decision: {
      recommendedAngle: picked?.angle.label ?? null,
      recommendedAngleKey: picked?.angle.key ?? null,
      pitchThis: picked?.angle.whenToPitch ?? null,
      whatNotToPitch: picked?.angle.whenNotToPitch ?? null,
      nextBestAction: truncate(nextAction?.openingHook ?? null, MAX_HOOK_CHARS),
      nextBestActionConfidence: nextAction?.confidence ?? null,
      timingWindowStart: nextAction?.timingWindowStart?.toISOString() ?? null,
      timingWindowEnd: nextAction?.timingWindowEnd?.toISOString() ?? null,
      channel: nextAction?.actionKind ?? null,
      evidenceSummary:
        picked && picked.matchedTriggers.length > 0
          ? truncate(
              `Signals: ${picked.matchedTriggers.join(", ")}`,
              MAX_EVIDENCE_CHARS,
            )
          : null,
    },
  });
}
