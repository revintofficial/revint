import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/auth";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { activateCalibration } from "@/lib/control/calibration";

export const runtime = "nodejs";

export const POST = withControlAuth("ADMIN", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const reason = controlString(body, "reason");
  if (!reason.trim()) return NextResponse.json({ error: "Gerekçe gerekir." }, { status: 400 });
  try {
    const created = await activateCalibration({
      workspaceId: controlString(body, "workspaceId"),
      versionId: controlString(body, "versionId"),
      actorUserId: actor.userId,
      actorRole: actor.role,
      reason,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error instanceof Error && error.message === "activator must differ from author") {
      return NextResponse.json({ error: "Bunu sen yazdın. Yayınlaması başka bir yönetici." }, { status: 403 });
    }
    if (error instanceof Error && (error.message === "reason required" || error.message === "only a draft or approved version can be activated")) {
      return NextResponse.json({ error: "Bu sürüm yayınlanamaz." }, { status: 400 });
    }
    throw error;
  }
});
