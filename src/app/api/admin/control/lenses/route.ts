import { NextResponse } from "next/server";
import type { ReviewLens } from "@/generated/prisma/client";
import { assignControlLens } from "@/lib/control/assign-lens";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { LENSES } from "@/lib/control/lenses";

export const runtime = "nodejs";

export const POST = withControlAuth("ADMIN", async (actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body || !("lens" in body)) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const workspaceId = controlString(body, "workspaceId");
  const userId = controlString(body, "userId");
  if (!workspaceId || !userId) return NextResponse.json({ error: "Kişi ve çalışma alanı gerekir." }, { status: 400 });

  const raw = body.lens;
  const lens = raw === null || raw === ""
    ? null
    : typeof raw === "string" && (LENSES as string[]).includes(raw)
      ? raw as ReviewLens
      : undefined;
  if (lens === undefined) return NextResponse.json({ error: "Mercek geçersiz." }, { status: 400 });

  const saved = await assignControlLens({
    actorUserId: actor.userId,
    actorRole: actor.role,
    workspaceId,
    targetUserId: userId,
    lens,
  });
  return NextResponse.json({ ok: true, id: saved.id });
});
