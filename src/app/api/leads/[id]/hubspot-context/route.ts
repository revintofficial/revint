/**
 * FineDine v1 update — lazy HubSpot context for a lead.
 *
 * The Action Sheet fetches this separately from the main lead payload so
 * a slow / rate-limited HubSpot call never delays the lead sheet render.
 * Returns `{ context: null }` when the workspace isn't connected or the
 * lead has no CRM linkage.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { getHubspotLeadContext } from "@/lib/integrations/hubspot/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { crmContactId: true, crmCompanyId: true, crmDealId: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const context = await getHubspotLeadContext(prisma, workspaceId, lead);
    return NextResponse.json({ context });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.hubspot_context.GET", err);
  }
}
