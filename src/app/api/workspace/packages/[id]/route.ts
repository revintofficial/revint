import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

const NAME_MAX = 80;
const PRICE_MAX = 40;
const FEATURE_MAX = 120;
const FEATURES_COUNT_MAX = 8;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;

    // L3 fix - findFirst({id, workspaceId}) instead of
    // findUnique({id}) + post-check. Same IDOR shape as L1/L2:
    // a future PR that drops the post-check would silently expose
    // every workspace's pricing config.
    const existing = await prisma.servicePackage.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      if (body.name.trim().length > NAME_MAX) {
        return NextResponse.json({ error: `name must be ≤ ${NAME_MAX} chars` }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if ("priceLabel" in body) {
      if (typeof body.priceLabel !== "string" || !body.priceLabel.trim()) {
        return NextResponse.json({ error: "priceLabel must be a non-empty string" }, { status: 400 });
      }
      if (body.priceLabel.trim().length > PRICE_MAX) {
        return NextResponse.json({ error: `priceLabel must be ≤ ${PRICE_MAX} chars` }, { status: 400 });
      }
      updates.priceLabel = body.priceLabel.trim();
    }

    if ("features" in body) {
      if (!Array.isArray(body.features)) {
        return NextResponse.json({ error: "features must be an array" }, { status: 400 });
      }
      if (body.features.length > FEATURES_COUNT_MAX) {
        return NextResponse.json({ error: `features must have ≤ ${FEATURES_COUNT_MAX} items` }, { status: 400 });
      }
      for (const f of body.features) {
        if (typeof f !== "string") {
          return NextResponse.json({ error: "each feature must be a string" }, { status: 400 });
        }
        if (f.length > FEATURE_MAX) {
          return NextResponse.json({ error: `each feature must be ≤ ${FEATURE_MAX} chars` }, { status: 400 });
        }
      }
      updates.features = (body.features as string[]).map((f) => f.trim()).filter(Boolean);
    }

    if ("isPopular" in body) {
      if (typeof body.isPopular !== "boolean") {
        return NextResponse.json({ error: "isPopular must be a boolean" }, { status: 400 });
      }
      updates.isPopular = body.isPopular;
    }

    if ("sortOrder" in body) {
      if (typeof body.sortOrder !== "number") {
        return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
      }
      updates.sortOrder = body.sortOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // L3 - update via updateMany so the workspaceId scope is in
    // the WHERE clause at the DB layer too. Then re-fetch with the
    // same scope for the response payload.
    await prisma.servicePackage.updateMany({
      where: { id, workspaceId: session.workspaceId },
      data: updates,
    });
    const updated = await prisma.servicePackage.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.packages_patch_error", { err: error });
    return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;

    // L3 fix - same workspace-scoped lookup + scoped deleteMany so
    // the (id, workspaceId) tuple is enforced both before and at
    // the actual delete. deleteMany returns a count we use as the
    // 404 signal so the response shape is stable.
    const result = await prisma.servicePackage.deleteMany({
      where: { id, workspaceId: session.workspaceId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.packages_delete_error", { err: error });
    return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
  }
}
