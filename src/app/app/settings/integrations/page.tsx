/**
 * FineDine v1 update — Integrations / CRM settings page.
 *
 * Admin-only. Shows the HubSpot connection state (configured / connected
 * / portal / provisioning) and a connect / disconnect control.
 */
import { requireWorkspaceAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { missingWritebackScopes } from "@/lib/integrations/hubspot/properties";
import { IntegrationsPanel } from "@/components/app/integrations-panel";

export default async function IntegrationsSettingsPage() {
  const session = await requireWorkspaceAdmin();

  const conn = await prisma.crmConnection.findUnique({
    where: {
      workspaceId_provider: { workspaceId: session.workspaceId, provider: "HUBSPOT" },
    },
    select: {
      portalId: true,
      status: true,
      scopes: true,
      defaultPipelineId: true,
      propertiesProvisionedAt: true,
      lastError: true,
      updatedAt: true,
    },
  });

  // Writeback health — the last outbound sync outcome, so a HubSpot
  // failure after analysis is visible here instead of silently lost.
  const [lastSuccess, lastFailure, failedCount] = conn
    ? await Promise.all([
        prisma.crmSyncLog.findFirst({
          where: { workspaceId: session.workspaceId, direction: "OUTBOUND", status: "SUCCESS" },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
        prisma.crmSyncLog.findFirst({
          where: { workspaceId: session.workspaceId, direction: "OUTBOUND", status: "FAILED" },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true, lastError: true },
        }),
        prisma.crmSyncLog.count({
          where: { workspaceId: session.workspaceId, direction: "OUTBOUND", status: "FAILED" },
        }),
      ])
    : ([null, null, 0] as const);

  return (
    <IntegrationsPanel
      configured={isHubspotConfigured()}
      hubspot={
        conn
          ? {
              status: conn.status,
              portalId: conn.portalId,
              scopeCount: conn.scopes.length,
              defaultPipelineId: conn.defaultPipelineId,
              propertiesProvisioned: !!conn.propertiesProvisionedAt,
              lastError: conn.lastError,
              missingScopes: missingWritebackScopes(conn.scopes),
              updatedAt: conn.updatedAt.toISOString(),
              writeback: {
                lastSuccessAt: lastSuccess?.updatedAt.toISOString() ?? null,
                lastFailureAt: lastFailure?.updatedAt.toISOString() ?? null,
                lastFailureError: lastFailure?.lastError ?? null,
                failedCount,
              },
            }
          : null
      }
    />
  );
}
