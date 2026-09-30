import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/auth";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { promoteReviewToCase } from "@/lib/control/golden";

export const runtime = "nodejs";

export const POST = withControlAuth("REVIEWER", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const workspaceId = controlString(body, "workspaceId");
  const reviewId = controlString(body, "reviewId");
  const title = controlString(body, "title");
  if (!workspaceId || !reviewId || !title.trim()) {
    return NextResponse.json({ error: "Başlık ve karar gerekir." }, { status: 400 });
  }
  try {
    const created = await promoteReviewToCase({
      workspaceId,
      reviewId,
      datasetId: controlString(body, "datasetId") || undefined,
      title,
      expected: body.expected,
      actorUserId: actor.userId,
      actorRole: actor.role,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error instanceof Error && (error.message === "invalid expected" || error.message.startsWith("Eksik mercekler:"))) {
      return NextResponse.json({ error: error.message.startsWith("Eksik mercekler:") ? error.message : "Kurallar geçersiz." }, { status: 400 });
    }
    throw error;
  }
});
