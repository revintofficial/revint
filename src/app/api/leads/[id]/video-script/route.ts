/**
 * P2.1 - Personalized video script generator (pilot endpoint).
 *
 * POST: returns a 30-second video script for screen-sharing the mockup.
 * Ready for pilot; until production tier gating lands in P1, this currently
 * uses a normal AI credit as its quota unit.
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateWithTimeout, WORKER_TIMEOUTS } from "@/lib/gemini-client";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { VIDEO_SCRIPT_PROMPT } from "@/lib/prompts/video-script-prompt";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";
import { internalError } from "@/lib/api-errors";
import { siteHost } from "@/lib/seo/metadata";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        reviewAnalysis: true,
        watchlistItem: true,
        workspace: {
          select: {
            offerName: true,
            valueProposition: true,
            offerHook: true,
            objective: true,
            tone: true,
            language: true,
            conversionLink: true,
          },
        },
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!lead.watchlistItem?.websitePlan) {
      return NextResponse.json(
        { error: "Create a mockup first, then generate the video script." },
        { status: 422 },
      );
    }

    await assertCanUseAi(session.workspaceId, 1);

    const ws = lead.workspace;
    const ri = lead.reviewAnalysis;
    const audit = lead.websiteAudit;

    const topPain =
      ((ri?.painPhrases as string[] | undefined) || [])[0]
      ?? ((lead.salesOpportunity?.likelyPainPoints as string[] | undefined) || [])[0]
      ?? "No online booking";

    const auditIssues = audit
      ? [
          !audit.https && "no HTTPS",
          !audit.mobileFriendlyGuess && "not mobile friendly",
          !audit.hasBookingSystem && "no online booking",
          audit.loadTimeMs && audit.loadTimeMs > 3000 && `${(audit.loadTimeMs / 1000).toFixed(1)}s slow load`,
        ]
          .filter(Boolean)
          .join(", ") || "minor UX improvements"
      : "audit not run";

    const filled = VIDEO_SCRIPT_PROMPT
      .replaceAll("{business_name}", lead.businessName)
      .replaceAll("{address}", lead.formattedAddress)
      .replaceAll("{top_pain}", topPain)
      .replaceAll("{audit_issues}", auditIssues)
      .replaceAll("{mockup_solution}", "a new hero and booking widget that solves the " + topPain + " problem")
      .replaceAll("{offer_value_proposition}", ws.valueProposition || "Modern website for local businesses")
      .replaceAll("{offer_hook}", ws.offerHook || "I put together a draft that shows three issues on your current site")
      .replaceAll("{conversion_link}", ws.conversionLink || siteHost())
      .replaceAll("{workspace_objective}", ws.objective || "Book a 15-min call")
      .replaceAll("{workspace_tone}", ws.tone || "friendly")
      .replaceAll("{workspace_language}", ws.language || "en");

    const { getGeminiKey } = await import("@/lib/gemini-keys");
    let apiKey: string;
    try {
      apiKey = getGeminiKey();
    } catch {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 503 });
    }
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 512, temperature: 0.5 },
    });

    const result = await generateWithTimeout(model, filled, {
      timeoutMs: WORKER_TIMEOUTS.VIDEO_SCRIPT_WRITER,
      label: "video_script",
    });
    const script = result.response.text().trim();

    await recordAiUsed(session.workspaceId, 1);

    return NextResponse.json({ script, durationSec: 30 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof QuotaExceededError) {
      return err.toResponse();
    }
    return internalError("api.leads.video_script_error", err);
  }
}
