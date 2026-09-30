import { NextResponse } from "next/server";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { AdjudicationConflictError, VERDICTS, adjudicateRun } from "@/lib/control/agreement";

export const runtime = "nodejs";

/** ADMIN only. Appends an adjudicated verdict; the three lens verdicts stay untouched. No model call. */
export const POST = withControlAuth("ADMIN", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const workspaceId = controlString(body, "workspaceId");
  const agentRunId = controlString(body, "agentRunId");
  const verdict = controlString(body, "verdict");
  const note = controlString(body, "note");
  if (!workspaceId || !agentRunId) return NextResponse.json({ error: "Vaka seçilmedi." }, { status: 400 });
  if (!(VERDICTS as readonly string[]).includes(verdict)) return NextResponse.json({ error: "Karar geçersiz." }, { status: 400 });
  if (!note.trim()) return NextResponse.json({ error: "Uzlaştırma için bir cümle gerekçe gerekir." }, { status: 400 });
  try {
    const created = await adjudicateRun({
      workspaceId,
      agentRunId,
      verdict: verdict as (typeof VERDICTS)[number],
      note,
      actorUserId: actor.userId,
      actorRole: actor.role,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof AdjudicationConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
});
