/**
 * P0.7 - Voice notes light.
 *
 * POST: receives a multipart/form-data audio blob (webm/ogg/mp4/wav) recorded
 * via the browser MediaRecorder API. Sends to Gemini 2.5 Flash for inline
 * transcription (Gemini supports audio input directly), then writes a VoiceNote
 * row + appends to WatchlistItem.pipelineNotes for pipeline visibility.
 *
 * Audio storage: for the launch we DO NOT persist the audio blob (PII + storage
 * cost + KVKK/GDPR). We only persist the transcript. If audioUrl persistence
 * becomes needed later, route via Supabase Storage with a 30-day TTL.
 *
 * GET: list voice notes for this lead (most recent first, max 50).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { transcribeAudioWithGemini } from "@/lib/gemini-transcribe";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DURATION_SEC = 90;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      select: { id: true, workspaceId: true, watchlistItem: { select: { id: true } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const form = await request.formData();
    const audio = form.get("audio");
    const declaredDuration = Number(form.get("durationSec") ?? "0");
    const language = (form.get("language") as string | null) ?? null;

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "audio multipart field required" },
        { status: 400 },
      );
    }

    if (audio.size === 0) {
      return NextResponse.json({ error: "Empty audio" }, { status: 400 });
    }

    if (audio.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Audio too large", maxBytes: MAX_BYTES },
        { status: 413 },
      );
    }

    if (declaredDuration > MAX_DURATION_SEC) {
      return NextResponse.json(
        { error: "Audio too long", maxSec: MAX_DURATION_SEC },
        { status: 413 },
      );
    }

    await assertCanUseAi(session.workspaceId, 1);

    const buffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type || "audio/webm";

    let transcript = "";
    try {
      transcript = await transcribeAudioWithGemini(buffer, mimeType, language);
    } catch (err) {
      console.error("Transcription failed:", err);
      return NextResponse.json(
        { error: "Transcription failed", details: String(err) },
        { status: 502 },
      );
    }

    const voiceNote = await prisma.voiceNote.create({
      data: {
        leadId,
        workspaceId: session.workspaceId,
        durationSec: Math.round(declaredDuration),
        transcript,
        language,
        source: "web",
        createdBy: session.user.id,
      },
    });

    // Append the transcript to WatchlistItem.pipelineNotes for pipeline visibility.
    if (lead.watchlistItem) {
      const existing = await prisma.watchlistItem.findUnique({
        where: { id: lead.watchlistItem.id },
        select: { pipelineNotes: true },
      });
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const newLine = `[${stamp} ses notu] ${transcript}`;
      const merged = existing?.pipelineNotes
        ? `${existing.pipelineNotes}\n\n${newLine}`
        : newLine;
      await prisma.watchlistItem.update({
        where: { id: lead.watchlistItem.id },
        data: { pipelineNotes: merged },
      });
    }

    await recordAiUsed(session.workspaceId, 1);

    return NextResponse.json({ ok: true, voiceNote });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof QuotaExceededError) {
      return error.toResponse();
    }
    console.error("Voice note error:", error);
    return NextResponse.json({ error: "Failed to save voice note" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const notes = await prisma.voiceNote.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ notes });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Voice note list error:", error);
    return NextResponse.json({ error: "Failed to list voice notes" }, { status: 500 });
  }
}
