import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { parseBranding, planAllowsWhiteLabel } from "@/lib/branding";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, plan: true, country: true, onboardingCompletedAt: true },
    });
    return NextResponse.json(ws);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.get_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 });
  }
}

interface PatchBody {
  name?: string;
  slug?: string;
  branding?: unknown;
  publicProfilesEnabled?: boolean;
  country?: string | null;
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const body = (await request.json()) as PatchBody;

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.slug !== undefined) {
      if (!body.slug.trim()) {
        return NextResponse.json({ error: "Slug is required" }, { status: 400 });
      }
      const cleanSlug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32);
      if (!cleanSlug) {
        return NextResponse.json({ error: "Slug is required" }, { status: 400 });
      }

      if (cleanSlug !== session.workspace.slug) {
        const exists = await prisma.workspace.findUnique({ where: { slug: cleanSlug } });
        if (exists) {
          return NextResponse.json({ error: "Slug is taken" }, { status: 409 });
        }
      }

      updates.slug = cleanSlug;
    }

    if (body.branding !== undefined) {
      // Branding writes only honored on Agency tier; lower plans get a 402.
      if (!planAllowsWhiteLabel(session.workspace.plan)) {
        return NextResponse.json(
          {
            error: "white_label_requires_agency",
            message: "White label branding is only available on the Agency plan.",
            upgradeUrl: "/app/settings/billing",
          },
          { status: 402 }
        );
      }
      updates.branding = parseBranding(body.branding);
    }

    if (body.publicProfilesEnabled !== undefined) {
      updates.publicProfilesEnabled = !!body.publicProfilesEnabled;
    }

    if (body.country !== undefined) {
      if (body.country === null || body.country === "") {
        updates.country = null;
      } else if (typeof body.country === "string") {
        const clean = body.country.trim().toUpperCase().slice(0, 2);
        if (!/^[A-Z]{2}$/.test(clean)) {
          return NextResponse.json({ error: "country must be a valid ISO-2 code" }, { status: 400 });
        }
        updates.country = clean;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: updates,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.update_error", { err: error });
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
  }
}
