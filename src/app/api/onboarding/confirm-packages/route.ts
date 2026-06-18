/**
 * POST /api/onboarding/confirm-packages
 *
 * Syncs the workspace's ServicePackage rows from the user-edited package
 * draft. Packages are the hard gate for the lead_created pipeline
 * (BLOCKED_NEEDS_PACKAGES), so at least one confirmed package is required.
 *
 * Upserts by (workspaceId, name) to preserve ids for unchanged packages, then
 * removes packages no longer present in the confirmed set. Owner/Admin only.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { sanitizePackageDrafts, validateConfirmedPackages } from "@/lib/onboarding/packages";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = (await request.json()) as { packages?: unknown };
    const { packages, droppedDuplicates } = sanitizePackageDrafts(body?.packages ?? body);
    const validationError = validateConfirmedPackages(packages);
    if (validationError) {
      return NextResponse.json({ error: validationError, droppedDuplicates }, { status: 400 });
    }

    const keepNames = packages.map((p) => p.name);

    await prisma.$transaction([
      // Remove packages the user deleted from the confirmed set.
      prisma.servicePackage.deleteMany({
        where: { workspaceId: session.workspaceId, name: { notIn: keepNames } },
      }),
      // Upsert each confirmed package by its unique (workspaceId, name).
      ...packages.map((p) =>
        prisma.servicePackage.upsert({
          where: { workspaceId_name: { workspaceId: session.workspaceId, name: p.name } },
          create: {
            workspaceId: session.workspaceId,
            name: p.name,
            priceLabel: p.priceLabel,
            features: p.features,
            isPopular: p.isPopular,
            sortOrder: p.sortOrder,
          },
          update: {
            priceLabel: p.priceLabel,
            features: p.features,
            isPopular: p.isPopular,
            sortOrder: p.sortOrder,
          },
        }),
      ),
    ]);

    logger.info("onboarding.packages_confirmed", {
      workspaceId: session.workspaceId,
      count: packages.length,
    });

    return NextResponse.json({ ok: true, count: packages.length, droppedDuplicates });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.onboarding.confirm_packages_error", err);
  }
}
