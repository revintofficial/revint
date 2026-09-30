import { prisma } from "@/lib/prisma";
import { StartEvalForm } from "@/components/admin/control-golden-actions";
import { DecisionCardView } from "@/components/admin/decision-card";
import { AcceptEval, ComparePicker } from "@/components/admin/control-compare";
import { ControlFrame } from "@/components/admin/control-frame";
import { formatControlDate } from "@/lib/control/labels";
import { listSucceededEvalRuns, loadEvalComparison } from "@/lib/control/eval-run";
import { toDecisionCard } from "@/lib/control/trace";
import { requireControlRole, roleAtLeast } from "@/lib/control/roles";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; base?: string; candidate?: string }>;
}) {
  const { workspaceId, base, candidate } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <CompareBody workspaceId={workspaceId} baseId={base ?? ""} candidateId={candidate ?? ""} /> : null}
    </ControlFrame>
  );
}

async function CompareBody({ workspaceId, baseId, candidateId }: { workspaceId: string; baseId: string; candidateId: string }) {
  const actor = await requireControlRole("VIEWER");
  const [runs, dataset, active] = await Promise.all([
    listSucceededEvalRuns(workspaceId),
    prisma.evalDataset.findFirst({ where: { workspaceId, name: "Referans" }, select: { id: true } }),
    prisma.evalRun.findFirst({ where: { workspaceId, label: "aday", status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } }),
  ]);
  const caseCount = dataset ? await prisma.evalCase.count({ where: { workspaceId, datasetId: dataset.id } }) : 0;
  const options = runs.map((run) => ({
    id: run.id,
    label: `${run.label} · ${formatControlDate((run.finishedAt ?? run.createdAt).toISOString())}`,
  }));
  const ready = Boolean(baseId && candidateId && baseId !== candidateId && runs.some((run) => run.id === baseId) && runs.some((run) => run.id === candidateId));
  const comparison = ready ? await loadEvalComparison(workspaceId, baseId, candidateId) : null;

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Karşılaştırma</h1>
      <StartEvalForm workspaceId={workspaceId} candidate caseCount={caseCount} active={Boolean(active)} canStart={roleAtLeast(actor.role, "ADMIN")} />
      {runs.length < 2 && <p className="text-sm">Karşılaştırma için İnceleyen taban sayımını, Yönetici aday koşuyu tamamlamalı. Ardından iki başarılı koşuyu seç.</p>}
      <ComparePicker workspaceId={workspaceId} runs={options} baseId={baseId} candidateId={candidateId} />
      {comparison && (
        <>
          <p className="text-sm">İki seçimin eskisi taban, yenisi aday olarak gösterilir. Aynı referans vakalar karşılaştırılır.</p>
          <h2 className="text-lg font-semibold">
            {comparison.broken.length} bozuldu, {comparison.fixed.length} düzeldi, {comparison.same.length} aynı.
          </h2>
          <Block title="Bozulanlar" rows={comparison.broken} empty="Bozulan vaka yok." />
          <Block title="Düzelenler" rows={comparison.fixed} empty="Düzelen vaka yok." />
          <Block title="Aynı kalanlar" rows={comparison.same} empty="Aynı kalan vaka yok." />
          <AcceptEval workspaceId={workspaceId} evalRunId={comparison.candidateId} canAccept={roleAtLeast(actor.role, "ADMIN")} />
        </>
      )}
    </section>
  );
}

function Block({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ evalCaseId: string; businessName: string; failureLabel: string; baseOutput: unknown; candidateOutput: unknown; context?: { finishedAt: string | null; locationCount: number } }>;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">{empty}</p>}
      {rows.map((row) => (
        <article key={row.evalCaseId} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
          <p className="text-sm font-medium">{row.businessName}</p>
          {row.failureLabel && <p className="mt-1 text-sm text-[var(--revint-text-2)]">{row.failureLabel}</p>}
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">Taban</p>
              <DecisionCardView decision={toDecisionCard(row.baseOutput, row.context)} />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">Aday</p>
              <DecisionCardView decision={toDecisionCard(row.candidateOutput, row.context)} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
