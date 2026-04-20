/**
 * P2.1 - Personalized video script generator (pilot endpoint).
 *
 * POST: returns a 30-second video script for screen-sharing the mockup.
 * Pilot için hazır; production tier gating P1'e taşınmadan açılmasın diye
 * şu an quota olarak normal AI credit kullanıyor.
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { VIDEO_SCRIPT_PROMPT } from "@/lib/prompts/video-script-prompt";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";
import { logger } from "@/lib/logger";

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
        { error: "Önce mockup oluşturun, sonra video script'i çıkarın." },
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
      ?? "Online randevu yok";

    const auditIssues = audit
      ? [
          !audit.https && "HTTPS yok",
          !audit.mobileFriendlyGuess && "mobile uyumsuz",
          !audit.hasBookingSystem && "online booking yok",
          audit.loadTimeMs && audit.loadTimeMs > 3000 && `${(audit.loadTimeMs / 1000).toFixed(1)}sn yavaş`,
        ]
          .filter(Boolean)
          .join(", ") || "küçük UX iyileştirmeleri"
      : "audit yapılmamış";

    const filled = VIDEO_SCRIPT_PROMPT
      .replaceAll("{business_name}", lead.businessName)
      .replaceAll("{address}", lead.formattedAddress)
      .replaceAll("{top_pain}", topPain)
      .replaceAll("{audit_issues}", auditIssues)
      .replaceAll("{mockup_solution}", topPain + " sorununu çözen yeni hero ve booking widget")
      .replaceAll("{offer_value_proposition}", ws.valueProposition || "Modern yerel işletme web sitesi")
      .replaceAll("{offer_hook}", ws.offerHook || "Mevcut sitenizdeki üç sorunu gösteren bir taslak hazırladım")
      .replaceAll("{conversion_link}", ws.conversionLink || "leadengine.io")
      .replaceAll("{workspace_objective}", ws.objective || "Book a 15-min call")
      .replaceAll("{workspace_tone}", ws.tone || "friendly")
      .replaceAll("{workspace_language}", ws.language || "tr");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 503 });
    }
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 512, temperature: 0.5 },
    });

    const result = await model.generateContent(filled);
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
    logger.error("api.leads.video_script_error", { err });
    return NextResponse.json(
      { error: "Failed to generate video script", detail: String(err) },
      { status: 500 },
    );
  }
}
