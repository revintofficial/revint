import { NextResponse } from "next/server";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { createDraft, snapshotLive } from "@/lib/control/calibration";
import { parseClaims } from "@/lib/control/score";

export const runtime = "nodejs";

export const POST = withControlAuth("REVIEWER", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const workspaceId = controlString(body, "workspaceId");
  const reason = controlString(body, "reason");
  if (!workspaceId || !reason.trim()) return NextResponse.json({ error: "Gerekçe gerekir." }, { status: 400 });
  const live = await snapshotLive(workspaceId);
  const icp = typeof body.icp === "object" && body.icp !== null && !Array.isArray(body.icp)
    ? body.icp as Record<string, unknown>
    : {};
  const created = await createDraft({
    workspaceId,
    reason,
    actorUserId: actor.userId,
    actorRole: actor.role,
    snapshot: {
      ...live,
      icpJson: { ...live.icpJson, ...icp },
      claimsJson: { claims: parseClaims(body.claims ?? live.claimsJson) },
    },
  });
  return NextResponse.json({ ok: true, id: created.id, version: created.version });
});
