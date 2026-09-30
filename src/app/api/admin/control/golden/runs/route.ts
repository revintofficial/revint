import { NextResponse } from "next/server";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { CandidateConflictError, startCandidateRun, startEvalRun } from "@/lib/control/eval-run";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const POST = withControlAuth("REVIEWER", async (actor, request: Request) => {
 const body = await readControlBody(request);
 if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
 const workspaceId = controlString(body, "workspaceId"), label = controlString(body, "label");
 if (!workspaceId || !["taban", "aday"].includes(label)) return NextResponse.json({ error: "Taban veya aday seç." }, { status: 400 });
 if (label === "aday" && actor.role !== "ADMIN") return NextResponse.json({ error: "Aday koşuyu yalnızca Yönetici başlatır." }, { status: 403 });
 if (label === "aday" && (body.confirmed !== true || !Number.isInteger(body.caseCount) || Number(body.caseCount) < 1)) return NextResponse.json({ error: "Vaka sayısını ve lead'e yazılmayacağını onayla." }, { status: 400 });
 const dataset = await prisma.evalDataset.findFirst({ where: { workspaceId, ...(controlString(body, "datasetId") ? { id: controlString(body, "datasetId") } : { name: "Referans" }) }, select: { id: true } });
 if (!dataset) return NextResponse.json({ error: "Önce bir İnceleyen referans vaka kaydetmeli." }, { status: 400 });
 const datasetId = dataset.id;
 try {
   const input = { workspaceId, datasetId, actorUserId: actor.userId, actorRole: actor.role };
   const created = label === "aday" ? await startCandidateRun({ ...input, confirmedCaseCount: Number(body.caseCount) }) : await startEvalRun({ ...input, label: "taban" });
   return NextResponse.json({ ok: true, ...created }, { status: label === "aday" ? 202 : 200 });
 } catch (error) {
   if (error instanceof CandidateConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
   throw error;
 }
});
