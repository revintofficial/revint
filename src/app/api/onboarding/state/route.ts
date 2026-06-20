/**
 * GET /api/onboarding/state
 *
 * Single hydration endpoint for the calibration-first onboarding wizard.
 * Returns the workspace calibration fields, the AI draft + its status, the
 * confirmed ICP (if any), confirmed packages, and HubSpot connection status,
 * plus derived booleans the wizard uses to resume on the right step after a
 * refresh. Everything is scoped to the caller's active workspace.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { isHubspotConfigured } from "@/lib/integrations/hubspot/oauth";
import { sanitizeIcpDraft } from "@/lib/onboarding/icp";
import { sanitizePackageDrafts } from "@/lib/onboarding/packages";
import type { OnboardingDraftStatus } from "@/lib/onboarding/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { workspaceId, role } = await requireUser();

    const [workspace, draft, icp, packages, conn] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: {
          name: true,
          country: true,
          plan: true,
          companyName: true,
          companyDomain: true,
          pricingPageUrl: true,
          onboardingCompletedAt: true,
        },
      }),
      prisma.workspaceOnboardingDraft.findUnique({
        where: { workspaceId },
        select: {
          status: true,
          companyContextJson: true,
          icpDraftJson: true,
          packagesDraftJson: true,
          error: true,
          lastRunId: true,
          updatedAt: true,
        },
      }),
      prisma.idealCustomerProfile.findUnique({
        where: { workspaceId },
        select: {
          description: true,
          industryWeights: true,
          subNicheWeights: true,
          priceLevelMin: true,
          priceLevelMax: true,
          minReviewCount: true,
          minRating: true,
          digitalMaturityFloor: true,
          highValueSignals: true,
          negativeSignals: true,
          locationFit: true,
          sourceJson: true,
          version: true,
        },
      }),
      prisma.servicePackage.findMany({
        where: { workspaceId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          priceLabel: true,
          features: true,
          isPopular: true,
          sortOrder: true,
        },
      }),
      prisma.crmConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
        select: { status: true, propertiesProvisionedAt: true },
      }),
    ]);

    const hubspotConnected = !!conn && conn.status !== "REVOKED";

    const completion = {
      workspaceNamed: Boolean(workspace.name && workspace.name.trim()),
      companySubmitted: Boolean(workspace.companyDomain),
      icpConfirmed: Boolean(icp),
      packagesConfirmed: packages.length > 0,
      hubspotConnected,
      onboardingCompleted: Boolean(workspace.onboardingCompletedAt),
    };

    return NextResponse.json({
      role,
      workspace,
      completion,
      draft: draft
        ? {
            status: draft.status as OnboardingDraftStatus,
            companyContext: draft.companyContextJson,
            icpDraft: sanitizeIcpDraft(draft.icpDraftJson),
            packagesDraft: sanitizePackageDrafts(draft.packagesDraftJson).packages,
            error: draft.error,
            lastRunId: draft.lastRunId,
            updatedAt: draft.updatedAt,
          }
        : null,
      icp,
      packages,
      hubspot: {
        configured: isHubspotConfigured(),
        connected: hubspotConnected,
        propertiesProvisionedAt: conn?.propertiesProvisionedAt
          ? conn.propertiesProvisionedAt.toISOString()
          : null,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.onboarding.state_error", err);
  }
}
