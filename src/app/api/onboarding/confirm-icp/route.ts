/**
 * POST /api/onboarding/confirm-icp
 *
 * Upserts the workspace's IdealCustomerProfile from the user-edited ICP draft.
 * The plain-text `description` is the human surface; the structured fields are
 * filled so ICP_SCORER works. `sourceJson` keeps the AI provenance. On every
 * edit the profile `version` is bumped so stale Lead.icpVersion stamps can be
 * detected and re-scored later.
 *
 * Owner/Admin only; scoped to the caller's workspace.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { sanitizeIcpDraft, mapIcpDraftToProfile, buildIcpSourceJson } from "@/lib/onboarding/icp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = (await request.json()) as { icp?: unknown };
    const draft = sanitizeIcpDraft(body?.icp ?? body);
    if (!draft.description.trim()) {
      return NextResponse.json(
        { error: "Add a short description of your ideal customer before confirming." },
        { status: 400 },
      );
    }

    const { locationFit, ...profileScalars } = mapIcpDraftToProfile(draft);
    const profileData = {
      ...profileScalars,
      locationFit: locationFit as unknown as Prisma.InputJsonValue,
    };
    const sourceJson = buildIcpSourceJson(draft) as unknown as Prisma.InputJsonValue;
    const name =
      (await prisma.workspace.findUnique({
        where: { id: session.workspaceId },
        select: { companyName: true, name: true },
      }))?.companyName ?? "Ideal Customer Profile";

    const icp = await prisma.idealCustomerProfile.upsert({
      where: { workspaceId: session.workspaceId },
      create: {
        workspaceId: session.workspaceId,
        name,
        ...profileData,
        sourceJson,
        version: 1,
      },
      update: {
        ...profileData,
        sourceJson,
        version: { increment: 1 },
      },
      select: { id: true, version: true },
    });

    logger.info("onboarding.icp_confirmed", {
      workspaceId: session.workspaceId,
      version: icp.version,
    });

    return NextResponse.json({ ok: true, version: icp.version });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.onboarding.confirm_icp_error", err);
  }
}
