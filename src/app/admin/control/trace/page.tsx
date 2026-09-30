import { requireControlRole } from "@/lib/control/roles";
import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { TraceLeadList } from "@/components/admin/control-trace-list";
import { listTraceLeads } from "@/lib/control/trace";

export default async function TraceListPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; filter?: string }>;
}) {
  const { workspaceId, filter } = await searchParams;
  const selected = filter === "failed" || filter === "stuck" ? filter : "all";
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <TraceBody workspaceId={workspaceId} filter={selected} /> : null}
    </ControlFrame>
  );
}

async function TraceBody({ workspaceId, filter }: { workspaceId: string; filter: "all" | "failed" | "stuck" }) {
  await requireControlRole("VIEWER");
  const rows = await listTraceLeads(workspaceId, filter);
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  const filters = [
    ["failed", "Düşen"],
    ["stuck", "Takılı"],
    ["all", "Hepsi"],
  ] as const;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Vaka izi</h1>
      <div className="flex gap-2">
        {filters.map(([id, label]) => (
          <Link key={id} href={`/admin/control/trace?${query}&filter=${id}`} className={`rounded-lg border px-3 py-2 text-sm ${filter === id ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}>
            {label}
          </Link>
        ))}
      </div>
      <TraceLeadList workspaceId={workspaceId} rows={rows} />
    </section>
  );
}
