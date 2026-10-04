import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { TrialPanel } from "@/components/admin/control-trial";
import { workerLabel } from "@/lib/control/labels";
import { requireControlRole, roleAtLeast } from "@/lib/control/roles";
import { TRACE_GROUPS } from "@/lib/control/trace-groups";
import { TRIAL_MAX_LEADS, isTrialKind, listTrialRows } from "@/lib/control/worker-test";

export default async function TrialPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; worker?: string }>;
}) {
  const { workspaceId, worker } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <TrialBody workspaceId={workspaceId} worker={worker} /> : null}
    </ControlFrame>
  );
}

async function TrialBody({ workspaceId, worker }: { workspaceId: string; worker?: string }) {
  const actor = await requireControlRole("VIEWER");
  const kind = worker && isTrialKind(worker) ? worker : "WEBSITE_AUDITOR";
  const rows = await listTrialRows(workspaceId, kind);
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Deneme</h1>
      <div className="flex flex-wrap gap-2">
        {TRACE_GROUPS.flatMap((group) => group.kinds.map((item) => (
          <Link
            key={item}
            href={`/admin/control/deneme?${query}&worker=${item}`}
            aria-current={item === kind ? "page" : undefined}
            className={`rounded-lg border px-3 py-2 text-sm ${item === kind ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}
          >
            {group.label} · {workerLabel(item)}
          </Link>
        )))}
      </div>
      <TrialPanel
        key={kind}
        workspaceId={workspaceId}
        workerKind={kind}
        workerName={workerLabel(kind)}
        rows={rows}
        canRun={roleAtLeast(actor.role, "ADMIN")}
        maxLeads={TRIAL_MAX_LEADS}
      />
    </section>
  );
}
