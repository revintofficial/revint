/**
 * P0.2 - "My offer" workspace context.
 *
 * GET: returns the current 10-field offer context for this workspace.
 * PATCH: updates any subset of the 10 fields. Empty strings → null.
 *
 * The offer context is injected into:
 *   - SalesOpportunity prompt (offer ↔ pain matching, bestSalesAngle)
 *   - WebsitePlan prompt (mockup CTA + hero offer alignment, P0.3)
 *   - Future co-pilot chat (P1.2)
 *   - Future direct email send personalization (P1.1)
 *
 * Without this context every Lead Engine output is generic. With it, every
 * mockup speaks in the workspace owner's voice and points to their own
 * conversion link.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const OFFER_FIELDS = [
  "offerName",
  "valueProposition",
  "socialProof",
  "offerHook",
  "objective",
  "tone",
  "length",
  "language",
  "senderName",
  "conversionLink",
] as const;

type OfferField = (typeof OFFER_FIELDS)[number];
type OfferPayload = Partial<Record<OfferField, string | null>>;

const STRING_LIMITS: Record<OfferField, number> = {
  offerName: 80,
  valueProposition: 500,
  socialProof: 400,
  offerHook: 300,
  objective: 200,
  tone: 60,
  length: 60,
  language: 8,
  senderName: 80,
  conversionLink: 300,
};

export async function GET() {
  try {
    const session = await requireUser();
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: session.workspaceId },
      select: {
        offerName: true,
        valueProposition: true,
        socialProof: true,
        offerHook: true,
        objective: true,
        tone: true,
        length: true,
        language: true,
        senderName: true,
        conversionLink: true,
      },
    });
    return NextResponse.json(ws);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.offer_get_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch offer" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as OfferPayload;
    const updates: Record<string, string | null> = {};

    for (const field of OFFER_FIELDS) {
      if (!(field in body)) continue;
      const raw = body[field];
      if (raw === null || raw === undefined) {
        updates[field] = null;
        continue;
      }
      if (typeof raw !== "string") {
        return NextResponse.json(
          { error: `Field ${field} must be a string or null` },
          { status: 400 },
        );
      }
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        updates[field] = null;
        continue;
      }
      if (trimmed.length > STRING_LIMITS[field]) {
        return NextResponse.json(
          {
            error: "field_too_long",
            field,
            max: STRING_LIMITS[field],
            length: trimmed.length,
          },
          { status: 400 },
        );
      }
      if (field === "conversionLink") {
        try {
          const u = new URL(trimmed);
          if (u.protocol !== "https:" && u.protocol !== "http:") {
            return NextResponse.json(
              { error: "conversionLink must be http or https" },
              { status: 400 },
            );
          }
        } catch {
          return NextResponse.json(
            { error: "conversionLink must be a valid URL" },
            { status: 400 },
          );
        }
      }
      updates[field] = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: updates,
      select: {
        offerName: true,
        valueProposition: true,
        socialProof: true,
        offerHook: true,
        objective: true,
        tone: true,
        length: true,
        language: true,
        senderName: true,
        conversionLink: true,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.offer_patch_error", { err: error });
    return NextResponse.json({ error: "Failed to update offer" }, { status: 500 });
  }
}
