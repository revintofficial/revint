import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/auth";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { recordReview, type ErrorClass, type ReviewSeverity } from "@/lib/control/review";

export const runtime = "nodejs";

export const POST = withControlAuth("REVIEWER", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const verdict = controlString(body, "verdict");
  if (verdict !== "PASS" && verdict !== "FAIL" && verdict !== "NEEDS_REVIEW") {
    return NextResponse.json({ error: "Karar geçersiz." }, { status: 400 });
  }
  try {
    const created = await recordReview({
      workspaceId: controlString(body, "workspaceId"),
      leadId: controlString(body, "leadId"),
      agentRunId: controlString(body, "agentRunId") || null,
      verdict,
      lens: controlString(body, "lens") as import("@/generated/prisma/client").ReviewLens || null,
      errorClass: controlString(body, "errorClass") ? controlString(body, "errorClass") as ErrorClass : null,
      severity: controlString(body, "severity") ? controlString(body, "severity") as ReviewSeverity : null,
      note: controlString(body, "note"),
      reviewerUserId: actor.userId,
      actorRole: actor.role,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error instanceof Error && error.message === "fail requires class, severity, and note") {
      return NextResponse.json({ error: "Kaldı için sınıf, ciddiyet ve bir cümle not gerekir." }, { status: 400 });
    }
    throw error;
  }
});
