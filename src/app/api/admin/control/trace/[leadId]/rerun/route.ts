import { NextResponse } from "next/server";
import { withControlAuth } from "@/lib/control/api";
import { rerunLeadWorker } from "@/lib/control/rerun";

export const runtime = "nodejs";

export const POST = withControlAuth("ADMIN", async (actor, request: Request, { params }: { params: Promise<{ leadId: string }> }) => {
  const { leadId } = await params;
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = await rerunLeadWorker({
    actorUserId: actor.userId,
    actorRole: actor.role,
    workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : "",
    leadId,
    workerKind: typeof body.workerKind === "string" ? body.workerKind : "",
    reason: typeof body.reason === "string" ? body.reason : "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
});
