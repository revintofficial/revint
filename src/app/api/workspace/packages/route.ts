import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

const NAME_MAX = 80;
const PRICE_MAX = 40;
const FEATURE_MAX = 120;
const FEATURES_COUNT_MAX = 8;

function validatePackageBody(body: Record<string, unknown>) {
  const { name, priceLabel, features, isPopular, sortOrder } = body;

  if (typeof name !== "string" || !name.trim()) {
    return { error: "name is required" };
  }
  if (name.trim().length > NAME_MAX) {
    return { error: `name must be ≤ ${NAME_MAX} chars` };
  }
  if (typeof priceLabel !== "string" || !priceLabel.trim()) {
    return { error: "priceLabel is required" };
  }
  if (priceLabel.trim().length > PRICE_MAX) {
    return { error: `priceLabel must be ≤ ${PRICE_MAX} chars` };
  }
  if (!Array.isArray(features)) {
    return { error: "features must be an array" };
  }
  if (features.length > FEATURES_COUNT_MAX) {
    return { error: `features must have ≤ ${FEATURES_COUNT_MAX} items` };
  }
  for (const f of features) {
    if (typeof f !== "string") return { error: "each feature must be a string" };
    if (f.length > FEATURE_MAX) return { error: `each feature must be ≤ ${FEATURE_MAX} chars` };
  }
  if (isPopular !== undefined && typeof isPopular !== "boolean") {
    return { error: "isPopular must be a boolean" };
  }
  if (sortOrder !== undefined && typeof sortOrder !== "number") {
    return { error: "sortOrder must be a number" };
  }
  return null;
}

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const packages = await prisma.servicePackage.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(packages);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.packages_get_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const validationError = validatePackageBody(body);
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }

    const pkg = await prisma.servicePackage.create({
      data: {
        workspaceId: session.workspaceId,
        name: (body.name as string).trim(),
        priceLabel: (body.priceLabel as string).trim(),
        features: (body.features as string[]).map((f) => f.trim()).filter(Boolean),
        isPopular: (body.isPopular as boolean | undefined) ?? false,
        sortOrder: (body.sortOrder as number | undefined) ?? 0,
      },
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.packages_post_error", { err: error });
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
  }
}
