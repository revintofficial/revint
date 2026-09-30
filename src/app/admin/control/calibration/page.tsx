import { CalibrationPanel } from "@/components/admin/control-calibration-panel";
import { ControlFrame } from "@/components/admin/control-frame";
import { listCalibrationVersions, snapshotLive } from "@/lib/control/calibration";
import { formatControlDate } from "@/lib/control/labels";
import { loadUserLabels } from "@/lib/control/read";
import { requireControlRole } from "@/lib/control/roles";
import { parseClaims, type SalesClaim } from "@/lib/control/score";

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; tab?: string }>;
}) {
  const { workspaceId, tab } = await searchParams;
  const selected = tab === "packages" || tab === "playbook" || tab === "pipeline" || tab === "claims" ? tab : "icp";
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <CalibrationBody workspaceId={workspaceId} tab={selected} /> : null}
    </ControlFrame>
  );
}

async function CalibrationBody({ workspaceId, tab }: { workspaceId: string; tab: string }) {
  const [actor, live, versions] = await Promise.all([
    requireControlRole("VIEWER"),
    snapshotLive(workspaceId),
    listCalibrationVersions(workspaceId),
  ]);
  const active = versions.find((version) => version.status === "ACTIVE") ?? null;
  const draft = versions.find((version) => version.status === "DRAFT" || version.status === "APPROVED") ?? null;
  const people = await loadUserLabels([active?.activatedByUserId, draft?.createdByUserId].filter((id): id is string => Boolean(id)));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Calibration</h1>
      <CalibrationPanel
        workspaceId={workspaceId}
        role={actor.role}
        actorUserId={actor.userId}
        tab={tab}
        today={today}
        live={toPanelSnapshot(live)}
        active={active ? {
          version: active.version,
          status: active.status,
          activatedAt: active.activatedAt ? formatControlDate(active.activatedAt.toISOString()) : null,
          activatedBy: active.activatedByUserId ? people.get(active.activatedByUserId) ?? "Bilinmeyen kişi" : "",
        } : null}
        draft={draft ? {
          id: draft.id,
          version: draft.version,
          createdByUserId: draft.createdByUserId,
          reason: draft.reason,
          snapshot: {
            icpJson: asRecord(draft.icpJson),
            packagesJson: asRecords(draft.packagesJson),
            claimsJson: { claims: parseClaims(draft.claimsJson) },
            playbookJson: asRecord(draft.playbookJson),
            pipelineJson: asPipeline(draft.pipelineJson),
          },
        } : null}
      />
    </section>
  );
}

function toPanelSnapshot(live: Awaited<ReturnType<typeof snapshotLive>>) {
  return {
    icpJson: live.icpJson,
    packagesJson: live.packagesJson,
    claimsJson: { claims: live.claimsJson.claims satisfies SalesClaim[] },
    playbookJson: live.playbookJson,
    pipelineJson: live.pipelineJson,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
}

function asPipeline(value: unknown): { preset: string; steps: unknown[]; enabled: boolean } {
  const record = asRecord(value);
  return {
    preset: typeof record.preset === "string" ? record.preset : "BALANCED",
    steps: Array.isArray(record.steps) ? record.steps : [],
    enabled: record.enabled !== false,
  };
}
