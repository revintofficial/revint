/**
 * GET /api/agent-runs/[id]/export?format=synthflow|retell|vapi|json|zip
 *
 * Streams the artifact for a successful AgentRun in the requested
 * export format. For deliverable workers (AI Receptionist, Review
 * Reply, Lead Response) the run stores a normalized output; this
 * route serializes that output into the platform-specific config
 * format requested by the query parameter.
 *
 * Security: workspaceId scope + run must be SUCCEEDED; returns 404
 * for cross-tenant ids and 409 for pending / failed runs.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-errors";
import {
  exportReceptionistArtifact,
  type ReceptionistArtifact,
} from "@/lib/agent-workers/ai-receptionist";
import {
  exportReviewReplyArtifact,
  type ReviewReplyArtifact,
} from "@/lib/agent-workers/review-reply";
import {
  exportLeadResponseArtifact,
  type LeadResponseArtifact,
} from "@/lib/agent-workers/lead-response";
import type { AgentExportFormat } from "@/lib/agent-workers/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const url = new URL(request.url);
    const formatRaw = (url.searchParams.get("format") ?? "json").toLowerCase();
    const format = formatRaw as AgentExportFormat;

    const run = await prisma.agentRun.findFirst({
      where: { id, workspaceId: session.workspaceId },
      select: {
        id: true,
        workerKind: true,
        status: true,
        outputJson: true,
      },
    });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (run.status !== "SUCCEEDED") {
      return NextResponse.json(
        { error: "Run is not ready for export", status: run.status },
        { status: 409 },
      );
    }
    if (!run.outputJson) {
      return NextResponse.json({ error: "Run has no output" }, { status: 409 });
    }

    // Dispatch to per-kind exporter.
    let body: string;
    let contentType = "application/json; charset=utf-8";
    let filename = `${run.workerKind.toLowerCase()}-${run.id}.json`;

    switch (run.workerKind) {
      case "AI_RECEPTIONIST_BUILDER": {
        const artifact = run.outputJson as unknown as ReceptionistArtifact;
        const out = exportReceptionistArtifact(artifact, format);
        body = out.body;
        contentType = out.contentType;
        filename = out.filename;
        break;
      }
      case "REVIEW_REPLY_AGENT": {
        const artifact = run.outputJson as unknown as ReviewReplyArtifact;
        const out = exportReviewReplyArtifact(artifact, format);
        body = out.body;
        contentType = out.contentType;
        filename = out.filename;
        break;
      }
      case "LEAD_RESPONSE_AGENT": {
        const artifact = run.outputJson as unknown as LeadResponseArtifact;
        const out = exportLeadResponseArtifact(artifact, format);
        body = out.body;
        contentType = out.contentType;
        filename = out.filename;
        break;
      }
      default:
        // Fallback - raw JSON dump of outputJson.
        body = JSON.stringify(run.outputJson, null, 2);
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Agent-Run-Id": run.id,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.agent_run.export_error", err);
  }
}
