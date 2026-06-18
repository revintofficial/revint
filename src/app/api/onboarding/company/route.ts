/**
 * PATCH /api/onboarding/company
 *
 * Saves the calibration inputs (company name, website domain, pricing page
 * URL) onto the workspace and kicks off the WORKSPACE_CONTEXT_EXTRACTOR
 * calibration run. Owner/Admin only; scoped to the caller's workspace.
 *
 * Calibration is best-effort — the company fields always persist even if the
 * crawl can't start, so the wizard can fall back to manual ICP/package entry.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { normalizeCompanyDomain, normalizePricingUrl } from "@/lib/onboarding/url";
import { startWorkspaceCalibration } from "@/lib/onboarding/calibration";

export const runtime = "nodejs";

const COMPANY_NAME_MAX = 120;

interface Body {
  companyName?: string;
  companyDomain?: string;
  pricingPageUrl?: string | null;
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = (await request.json()) as Body;

    const companyName =
      typeof body.companyName === "string" && body.companyName.trim()
        ? body.companyName.trim().slice(0, COMPANY_NAME_MAX)
        : null;

    if (typeof body.companyDomain !== "string" || !body.companyDomain.trim()) {
      return NextResponse.json({ error: "Company website is required" }, { status: 400 });
    }
    const companyDomain = normalizeCompanyDomain(body.companyDomain);
    if (!companyDomain) {
      return NextResponse.json(
        { error: "Enter a valid company website (e.g. example.com)" },
        { status: 400 },
      );
    }

    // Pricing URL is optional — when absent the extractor falls back to the
    // company domain crawl and the wizard offers manual package entry.
    let pricingPageUrl: string | null = null;
    if (typeof body.pricingPageUrl === "string" && body.pricingPageUrl.trim()) {
      pricingPageUrl = normalizePricingUrl(body.pricingPageUrl);
      if (!pricingPageUrl) {
        return NextResponse.json(
          { error: "Enter a valid pricing page URL" },
          { status: 400 },
        );
      }
    }

    await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: { companyName, companyDomain, pricingPageUrl },
    });

    const calibration = await startWorkspaceCalibration({
      workspaceId: session.workspaceId,
      plan: session.workspace.plan,
      userId: session.user.id,
      companyDomain,
      pricingPageUrl,
      companyName,
    });

    logger.info("onboarding.company_submitted", {
      workspaceId: session.workspaceId,
      calibrationStarted: calibration.started,
    });

    return NextResponse.json({
      ok: true,
      companyName,
      companyDomain,
      pricingPageUrl,
      calibration,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.onboarding.company_error", err);
  }
}
