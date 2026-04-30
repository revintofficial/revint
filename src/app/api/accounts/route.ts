import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface CreateAccountBody {
  name: string;
  apexDomain?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  notes?: string;
}

/**
 * Phase 2 — list and create Account rollups in the active workspace.
 *
 * The leads list rollup view (UI todo: Phase 2.5) reads /api/accounts
 * and groups leads by accountId. Members can list (so they can see
 * which brand a lead belongs to); only admins can create / edit so
 * lead-grouping decisions stay consistent across the workspace.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const accounts = await prisma.account.findMany({
      where: { workspaceId, archivedAt: null },
      include: {
        _count: { select: { leads: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ accounts });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.accounts.list_error", { err });
    return NextResponse.json({ error: "Failed to list accounts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = (await request.json()) as CreateAccountBody;
    if (!body.name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const apex = body.apexDomain ? body.apexDomain.toLowerCase().replace(/^www\./, "") : null;

    const account = await prisma.account.create({
      data: {
        workspaceId,
        name: body.name,
        apexDomain: apex,
        primaryEmail: body.primaryEmail ?? null,
        primaryPhone: body.primaryPhone ?? null,
        notes: body.notes ?? null,
      },
    });

    logger.info("api.accounts.created", {
      accountId: account.id,
      workspaceId,
    });
    return NextResponse.json({ account });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.accounts.create_error", { err });
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
