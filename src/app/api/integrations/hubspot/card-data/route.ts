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
import { verifyHubspotSignatureV3 } from "@/lib/integrations/hubspot/webhook";
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
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");

  const verify = verifyHubspotSignatureV3({
    method: "POST",
    requestUrl: request.url,
    rawBody,
    signature,
    timestamp,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    // HubSpot signs the URL it called; behind a proxy the URL we see
    // differs, so try the env override + forwarded-host reconstructions.
    urlOverride: cardUrlCandidates(request),
  });
  if (!verify.valid) {
    logger.warn("api.hubspot.card_data.invalid_signature", {
      reason: verify.reason,
      observedUrl: request.url,
      hasClientSecret: !!process.env.HUBSPOT_CLIENT_SECRET,
      hasCardUrlEnv: !!process.env.HUBSPOT_CARD_URL,
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // HubSpot ships the portal id in a dedicated header on hubspot.fetch.
  // Trusted because it's covered by the v3 signature above.
  const portalId = request.headers.get("x-hubspot-hub-id");
  if (!portalId) {
    return NextResponse.json({ error: "missing_portal_id" }, { status: 400 });
  }

  let body: CardRequestBody;
  try {
    body = rawBody ? (JSON.parse(rawBody) as CardRequestBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const objectType = (body.objectType ?? "CONTACT").toString().toUpperCase();
  const objectId = body.objectId == null ? "" : String(body.objectId);
  if (!objectId) {
    return NextResponse.json({ error: "missing_object_id" }, { status: 400 });
  }

  // Resolve workspace from portal — non-throwing query so an unknown
  // portal returns an empty payload (the card renders "not connected").
  const conn = await prisma.crmConnection.findFirst({
    where: { portalId, provider: "HUBSPOT", status: { not: "REVOKED" } },
    select: { workspaceId: true },
  });
  if (!conn) {
    return NextResponse.json({
      found: false,
      reason: "workspace_not_found",
    });
  }
  const { workspaceId } = conn;

  // Find the lead via the appropriate CRM linkage column. Multi-tenant
  // scope: `workspaceId` is the trusted source; the CRM id alone is not
  // unique across workspaces.
  const where =
    objectType === "DEAL"
      ? { workspaceId, crmDealId: objectId }
      : objectType === "COMPANY"
        ? { workspaceId, crmCompanyId: objectId }
        : { workspaceId, crmContactId: objectId };

  const lead = await prisma.lead.findFirst({
    where,
    select: {
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
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          openingHook: true,
          timingWindowStart: true,
          timingWindowEnd: true,
          actionKind: true,
          confidence: true,
        },
      },
    },
  });

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
