/**
 * POST /api/onboarding/complete
 *
 * Marks onboarding complete — but only once the workspace is calibrated
 * enough for the lead pipeline to produce value:
 *   - company calibration submitted (companyDomain set)
 *   - ICP confirmed (IdealCustomerProfile exists)
 *   - at least one ServicePackage confirmed (else lead_created blocks on
 *     BLOCKED_NEEDS_PACKAGES)
 *   - HubSpot leads imported OR the user explicitly skipped HubSpot
 *
 * Returns a 409 with a `reason` when a precondition is unmet so the wizard
 * can route the user back to the right step instead of silently completing.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    let hubspotSkipped = false;
    try {
      const body = (await request.json()) as { hubspotSkipped?: boolean };
      hubspotSkipped = body?.hubspotSkipped === true;
    } catch {
      // empty body — treat as not explicitly skipped
    }

    const [workspace, packageCount, icp, leadCount] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { companyDomain: true, onboardingCompletedAt: true },
      }),
      prisma.servicePackage.count({ where: { workspaceId } }),
      prisma.idealCustomerProfile.findUnique({
        where: { workspaceId },
        select: { id: true },
      }),
      prisma.lead.count({ where: { workspaceId } }),
    ]);

    // Idempotent — already completed.
    if (workspace.onboardingCompletedAt) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    if (!workspace.companyDomain) {
      return NextResponse.json(
        { error: "company_required", message: "Add your company website first." },
        { status: 409 },
      );
    }
    if (!icp) {
      return NextResponse.json(
        { error: "icp_required", message: "Confirm your ICP draft first." },
        { status: 409 },
      );
    }
    if (packageCount === 0) {
      return NextResponse.json(
        { error: "packages_required", message: "Confirm at least one package first." },
        { status: 409 },
      );
    }

    const hubspotImported = leadCount > 0;
    if (!hubspotSkipped && !hubspotImported) {
      return NextResponse.json(
        {
          error: "hubspot_pending",
          message: "Import your HubSpot leads or skip HubSpot to finish.",
        },
        { status: 409 },
      );
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompletedAt: new Date() },
    });

    logger.info("onboarding.completed", { workspaceId, hubspotSkipped, leadCount });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.onboarding.complete_error", { err: error });
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
