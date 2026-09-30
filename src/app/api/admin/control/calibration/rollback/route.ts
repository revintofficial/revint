import { NextResponse } from "next/server";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { rollbackCalibration } from "@/lib/control/calibration";

export const runtime = "nodejs";

export const POST = withControlAuth("ADMIN", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const reason = controlString(body, "reason");
  if (!reason.trim()) return NextResponse.json({ error: "Gerekçe gerekir." }, { status: 400 });
  try {
    const created = await rollbackCalibration({
      workspaceId: controlString(body, "workspaceId"),
      actorUserId: actor.userId,
      actorRole: actor.role,
      reason,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof Error && error.message === "no previous version") {
      return NextResponse.json({ error: "Geri alınacak önceki sürüm yok." }, { status: 400 });
    }
    throw error;
  }
});