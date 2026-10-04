import { NextResponse } from "next/server";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { TRIAL_MAX_LEADS, isTrialKind, startWorkerTrial } from "@/lib/control/worker-test";

export const runtime = "nodejs";

export const POST = withControlAuth("ADMIN", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const workspaceId = controlString(body, "workspaceId");
  const workerKind = controlString(body, "workerKind");
  const reason = controlString(body, "reason").trim();
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  if (!workspaceId || !reason) return NextResponse.json({ error: "Çalışma alanı ve gerekçe gerekir." }, { status: 400 });
  if (!isTrialKind(workerKind)) return NextResponse.json({ error: "Bu worker denemeye açık değil." }, { status: 400 });
  if (leadIds.length === 0) return NextResponse.json({ error: "En az bir lead seç." }, { status: 400 });
  if (leadIds.length > TRIAL_MAX_LEADS) return NextResponse.json({ error: `Bir denemede en fazla ${TRIAL_MAX_LEADS} lead çalışır.` }, { status: 400 });

  const result = await startWorkerTrial({
    actorUserId: actor.userId,
    actorRole: actor.role,
    workspaceId,
    workerKind,
    leadIds,
    reason,
  });
  return NextResponse.json({ ok: true, ...result });
});
