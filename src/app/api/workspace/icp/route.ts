/**
 * GET /api/workspace/icp
 *
 * Returns the workspace's IdealCustomerProfile shaped as an editable draft
 * (plain-text description + structured fields + provenance) for the Settings
 * ICP editor. Writes go through POST /api/onboarding/confirm-icp, which bumps
 * the profile version so stale lead scores can be detected and re-scored.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const icp = await prisma.idealCustomerProfile.findUnique({
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
    });
    return NextResponse.json({ icp });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.workspace.icp_get_error", err);
  }
}
