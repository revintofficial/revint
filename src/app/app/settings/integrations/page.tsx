/**
 * FineDine v1 update — Integrations / CRM settings page.
 *
 * Admin-only. Shows the HubSpot connection state (configured / connected
 * / portal / provisioning) and a connect / disconnect control.
 */
import { requireWorkspaceAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
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
              updatedAt: conn.updatedAt.toISOString(),
            }
          : null
      }
    />
  );
}
