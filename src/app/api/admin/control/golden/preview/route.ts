/**
 * POST /api/admin/control/golden/preview
 *
 * Scores the frozen brief output against candidate expected rules before
 * a reference case is saved. Read-only: no row, no audit event, no model call.
 *
 * Body: { workspaceId: string, agentRunId: string, expected: ExpectedRules-shaped object }
 * 200 { passed: boolean, failures: { code: ScoreFailureCode, message: string }[] }
 * 400 { error } invalid body / invalid expected · 404 run not in workspace
 */
import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/auth";
import { controlString, readControlBody, withControlAuth } from "@/lib/control/api";
import { previewScore } from "@/lib/control/score";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export const POST = withControlAuth("REVIEWER", async (_actor, request: Request) => {
  const body = await readControlBody(request);
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const workspaceId = controlString(body, "workspaceId");
  const agentRunId = controlString(body, "agentRunId");
  if (!workspaceId || !agentRunId) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  const run = await prisma.agentRun.findFirst({
    where: { id: agentRunId, workspaceId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED" },
    select: { outputJson: true },
  });
  if (!run) throw new NotFoundError("Başarılı brief bu çalışma alanında bulunamadı.");

  try {
    return NextResponse.json(previewScore(run.outputJson, body.expected));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid expected") {
      return NextResponse.json({ error: "Kurallar geçersiz." }, { status: 400 });
    }
    throw error;
  }
});
