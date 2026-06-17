/**
 * Settings → Lead Pipeline.
 *
 * Server component: hydrates the workspace's current pipeline row,
 * derives the canonical chain for the active preset, runs the cost
 * estimator against the workspace's last-30-day telemetry, and hands
 * everything to the client editor. The editor lets the workspace
 * owner / admin pick a preset, toggle individual workers, and see
 * live cost projections via /lead-pipeline/dry-run.
 */
import { requireWorkspaceAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getDefaultChain,
  validateLeadPipelineChain,
  LEAD_PIPELINE_ALLOWED_WORKERS,
  type Chain,
} from "@/lib/ai-core/chains";
import { estimateChainCost } from "@/lib/agent-workers/cost-estimator";
import { listWorkers } from "@/lib/agent-workers/registry";
import { LeadPipelineEditor } from "@/components/app/lead-pipeline-editor";
import type { PipelinePreset } from "@/generated/prisma/client";

export default async function LeadPipelineSettingsPage() {
  const session = await requireWorkspaceAdmin();

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
    select: {
      id: true,
      plan: true,
      leadPipeline: {
        select: { preset: true, steps: true, enabled: true, updatedAt: true },
      },
    },
  });

  const preset: PipelinePreset = ws.leadPipeline?.preset ?? "BALANCED";
  const enabled = ws.leadPipeline?.enabled ?? true;

  let resolvedSteps: Chain;
  if (preset === "CUSTOM" && ws.leadPipeline?.steps) {
    try {
      validateLeadPipelineChain(ws.leadPipeline.steps as unknown as Chain);
      resolvedSteps = ws.leadPipeline.steps as unknown as Chain;
    } catch (err) {
      logger.warn("settings.lead_pipeline.custom_invalid", {
        workspaceId: ws.id,
        err: err instanceof Error ? err.message : String(err),
      });
      resolvedSteps = getDefaultChain("BALANCED", ws.plan);
    }
  } else {
    resolvedSteps = getDefaultChain(preset, ws.plan);
  }

  const estimate = await estimateChainCost({
    workspaceId: ws.id,
    plan: ws.plan,
    chain: resolvedSteps,
    leadCount: 100,
  });

  // Filter the worker catalog to those that are valid in the lead
  // onboarding pipeline. The full registry includes deliverables (AI
  // receptionist, GBP autopost) that have nothing to sequence on
  // lead_created.
  const allowedWorkers = listWorkers().filter((w) =>
    LEAD_PIPELINE_ALLOWED_WORKERS.has(w.kind),
  );

  return (
    <div className="space-y-6">
      {/* Section heading rather than full PageHeader — the parent
          settings layout already renders the "Settings" page header
          and a duplicate H1 here would compete with it. */}
      <div className="space-y-1">
        <h2
          className="font-semibold tracking-tight"
          style={{
            color: "var(--revint-text-1)",
            fontSize: "var(--text-title-2)",
            letterSpacing: "-0.01em",
          }}
        >
          Lead Pipeline
        </h2>
        <p
          className="text-[13px]"
          style={{ color: "var(--revint-text-2)" }}
        >
          Configure what runs automatically when a new lead is added. Pick a
          preset for one-click defaults or toggle individual workers.
        </p>
      </div>
      <LeadPipelineEditor
        workspaceId={ws.id}
        plan={ws.plan}
        canEdit={session.role === "OWNER" || session.role === "ADMIN"}
        initial={{
          preset,
          enabled,
          steps: resolvedSteps,
          estimate,
          updatedAt: ws.leadPipeline?.updatedAt?.toISOString() ?? null,
        }}
        workers={allowedWorkers.map((w) => ({
          kind: w.kind,
          group: w.group,
          displayName: w.displayName,
          description: w.description,
          minPlan: w.minPlan,
          estimatedDurationMs: w.estimatedDurationMs,
        }))}
      />
    </div>
  );
}
