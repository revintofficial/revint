/**
 * FineDine v1 update — HubSpot CRM Card (data-fetch).
 *
 * HubSpot calls this endpoint to render a card on the contact/deal
 * record. We resolve the workspace from `portalId`, find the linked
 * lead, and return the LeadAC signal: temperature, best angle, risk,
 * next action, plus an "Open Lead Sheet" action that deep-links into the
 * LeadAC lead detail.
 *
 * Auth: server-to-server from HubSpot. Verified by the v1 signature
 * (`X-HubSpot-Signature` = sha256(clientSecret + method + uri + body))
 * when present; we also require the resolved portal to have an active
 * connection. No `requireUser()` (no end-user session here).
 *
 * Response shape follows HubSpot's CRM card "results" contract.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyV1Signature(request: Request): boolean {
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientSecret) return false;
  const sig = request.headers.get("x-hubspot-signature");
  // In dev / when HubSpot doesn't send a signature for GET cards, allow
  // through (the portalId → connection resolution still gates data).
  if (!sig) return process.env.NODE_ENV !== "production";
  const uri = process.env.HUBSPOT_CARD_URL || request.url;
  const source = `${clientSecret}GET${uri}`;
  const expected = createHash("sha256").update(source).digest("hex");
  return expected === sig;
}

function leadSheetUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/app/leads/${leadId}`;
}

const TEMP_LABEL: Record<string, string> = { HOT: "🔥 Hot", WARM: "🌤 Warm", COLD: "❄️ Cold" };

export async function GET(request: Request) {
  try {
    if (!verifyV1Signature(request)) {
      return NextResponse.json({ results: [] }, { status: 401 });
    }

    const url = new URL(request.url);
    const portalId = url.searchParams.get("portalId");
    const associatedObjectId = url.searchParams.get("associatedObjectId");
    const associatedObjectType =
      url.searchParams.get("associatedObjectType")?.toUpperCase() ?? "CONTACT";

    if (!portalId || !associatedObjectId) {
      return NextResponse.json({ results: [] });
    }

    const conn = await prisma.crmConnection.findFirst({
      where: { portalId, provider: "HUBSPOT", status: { not: "REVOKED" } },
      select: { workspaceId: true },
    });
    if (!conn) return NextResponse.json({ results: [] });

    const where =
      associatedObjectType === "DEAL"
        ? { workspaceId: conn.workspaceId, crmDealId: associatedObjectId }
        : associatedObjectType === "COMPANY"
          ? { workspaceId: conn.workspaceId, crmCompanyId: associatedObjectId }
          : { workspaceId: conn.workspaceId, crmContactId: associatedObjectId };

    const lead = await prisma.lead.findFirst({
      where,
      include: { qualification: true },
    });
    if (!lead) {
      return NextResponse.json({
        results: [],
        primaryAction: {
          type: "IFRAME",
          width: 890,
          height: 748,
          uri: leadSheetUrl(""),
          label: "Open in LeadAC",
        },
      });
    }

    const properties: Array<{ label: string; dataType: string; value: string }> = [];
    if (lead.leadTemperature) {
      properties.push({
        label: "Temperature",
        dataType: "STRING",
        value: TEMP_LABEL[lead.leadTemperature] ?? lead.leadTemperature,
      });
    }
    if (lead.qualification?.status) {
      properties.push({
        label: "Qualification",
        dataType: "STRING",
        value: lead.qualification.status,
      });
    }
    if (lead.qualification?.qualificationRisk) {
      properties.push({
        label: "Qual risk",
        dataType: "STRING",
        value: lead.qualification.qualificationRisk,
      });
    }
    if (lead.qualification?.noShowRisk) {
      properties.push({
        label: "No-show risk",
        dataType: "STRING",
        value: lead.qualification.noShowRisk,
      });
    }
    if (typeof lead.salesConfidence === "number") {
      properties.push({
        label: "Priority",
        dataType: "STRING",
        value: `${lead.salesConfidence}/100`,
      });
    }

    return NextResponse.json({
      results: [
        {
          objectId: Number.isNaN(Number(lead.id)) ? 1 : Number(lead.id),
          title: lead.businessName,
          link: leadSheetUrl(lead.id),
          properties,
        },
      ],
      primaryAction: {
        type: "IFRAME",
        width: 890,
        height: 748,
        uri: leadSheetUrl(lead.id),
        label: "Open Lead Sheet",
      },
    });
  } catch (err) {
    logger.error("api.hubspot.card_error", { err });
    return NextResponse.json({ results: [] });
  }
}
