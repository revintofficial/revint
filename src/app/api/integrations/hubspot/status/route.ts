/**
 * FineDine v1 update — HubSpot connection status + disconnect.
 *
 * GET  → connection summary for the Integrations settings page.
 * DELETE → mark the connection REVOKED (soft disconnect; keeps the row
 *          so sync history / `CrmSyncLog` foreign keys survive).
 *
 * Admin-only.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireWorkspaceAdminApi, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { workspaceId } = await requireWorkspaceAdminApi();
    const conn = await prisma.crmConnection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
      select: {
        portalId: true,
        status: true,
        scopes: true,
        expiresAt: true,
        defaultPipelineId: true,
        propertiesProvisionedAt: true,
        lastError: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      configured: isHubspotConfigured(),
      connected: !!conn && conn.status !== "REVOKED",
      connection: conn,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return internalError("api.hubspot.status_error", err);
  }
}

export async function DELETE() {
  try {
    const { workspaceId } = await requireWorkspaceAdminApi();
    await prisma.crmConnection.updateMany({
      where: { workspaceId, provider: "HUBSPOT" },
      data: { status: "REVOKED", lastError: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return internalError("api.hubspot.disconnect_error", err);
  }
}
