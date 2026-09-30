import { NextResponse } from "next/server";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { acceptEvalRun } from "@/lib/control/eval-run";

export const runtime = "nodejs";

export const POST = withControlAuth("ADMIN", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const reason = controlString(body, "reason");
  if (!reason.trim()) return NextResponse.json({ error: "Gerekçe gerekir." }, { status: 400 });
  try {
    const created = await acceptEvalRun({
      workspaceId: controlString(body, "workspaceId"),
      evalRunId: controlString(body, "evalRunId"),
      actorUserId: actor.userId,
      actorRole: actor.role,
      reason,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof Error && error.message === "reason required") {
      return NextResponse.json({ error: "Gerekçe gerekir." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "eval run not found") {
      return NextResponse.json({ error: "Bu kontrol koşusu bu alanda yok." }, { status: 404 });
    }
    throw error;
  }
});
