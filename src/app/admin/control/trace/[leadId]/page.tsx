import Link from "next/link";
import { DecisionCardView } from "@/components/admin/decision-card";
import { ControlFrame } from "@/components/admin/control-frame";
import { RerunControl } from "@/components/admin/control-rerun";
import { crmStatusLabel, formatDuration, formatUsd, plannerStatusLabel, runStatusLabel, workerLabel } from "@/lib/control/labels";
import { requireControlRole, roleAtLeast } from "@/lib/control/roles";
import { toDecisionCard } from "@/lib/control/decision";
import { TRACE_GROUPS, groupForKind } from "@/lib/control/trace-groups";
import { getLeadTrace, type DecisionCard, type TraceRun } from "@/lib/control/trace";
import type { AgentWorkerKind } from "@/generated/prisma/client";

export default async function TraceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const { leadId } = await params;
  const { workspaceId } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <TraceDetail workspaceId={workspaceId} leadId={leadId} /> : null}
    </ControlFrame>
  );
}

async function TraceDetail({ workspaceId, leadId }: { workspaceId: string; leadId: string }) {
  const actor = await requireControlRole("VIEWER");
  const trace = await getLeadTrace(workspaceId, leadId);
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  if (!trace) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-[var(--revint-text-1)]">Bu lead bu alanda yok</p>
        <Link href={`/admin/control/trace?${query}`} className="text-sm text-[var(--revint-500)]">Vaka izine dön</Link>
      </section>
    );
  }

  const runs = [...trace.sessions.flatMap((session) => session.runs), ...trace.unsessionedRuns];
  const decision = latestDecision(runs);
  const canRerun = roleAtLeast(actor.role, "ADMIN");

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{trace.lead.businessName}</h1>
        <p className="text-sm text-[var(--revint-text-2)]">bu çalışma alanında</p>
      </div>
      <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        <DecisionCardView decision={decision} />
      </div>
      <ChainSummary runs={runs} />
      {trace.sessions.map((session) => (
        <section key={session.id} className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--revint-text-1)]">Oturum · {plannerStatusLabel(session.status)}</h2>
          <p className="text-sm text-[var(--revint-text-2)]">{session.goal || "Amaç yok"}</p>
          {session.runs.length === 0 && <p className="text-sm text-[var(--revint-text-3)]">Planlayıcı bu oturuma henüz iş eklemedi. Teknik mercek oturum durumunu kontrol etmeli.</p>}
          {session.runs.map((run) => (
            <RunRow key={run.id} run={run} workspaceId={workspaceId} leadId={leadId} canRerun={canRerun} />
          ))}
        </section>
      ))}
      {trace.unsessionedRuns.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Oturuma bağlı olmayan işler</h2>
          {trace.unsessionedRuns.map((run) => (
            <RunRow key={run.id} run={run} workspaceId={workspaceId} leadId={leadId} canRerun={canRerun} />
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">CRM</h2>
        {trace.crmSyncs.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Henüz CRM kaydı yok. Entegrasyon senkronizasyonu çalıştığında sonucu burada görünür.</p>}
        {trace.crmSyncs.map((sync) => (
          <p key={sync.id} className="text-sm text-[var(--revint-text-2)]">
            {sync.objectType} · {crmStatusLabel(sync.status)}
            {sync.lastError ? ` · ${sync.lastError}` : ""}
          </p>
        ))}
      </section>
    </section>
  );
}

/**
 * The four chain steps in order, whether or not they ran. A step that
 * never ran says so — the old page only listed the runs that existed,
 * so a missing map pull or a missing brief looked the same as a chain
 * that was never meant to have one.
 */
function ChainSummary({ runs }: { runs: TraceRun[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Zincir</h2>
      {TRACE_GROUPS.map(({ label, kinds }) => {
        const matched = runs.filter((run) => kinds.includes(run.workerKind as AgentWorkerKind));
        const latest = matched.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0];
        return (
          <p key={label} className="text-sm text-[var(--revint-text-2)]">
            <span className="text-[var(--revint-text-1)]">{label}</span>
            {" · "}
            {latest
              ? `${runStatusLabel(latest.status)} · ${formatDuration(latest.startedAt, latest.finishedAt)} · ${formatUsd(latest.costUsdCents)}`
              : "çalışmadı"}
          </p>
        );
      })}
    </section>
  );
}

function RunRow({ run, workspaceId, leadId, canRerun }: { run: TraceRun; workspaceId: string; leadId: string; canRerun: boolean }) {
  return (
    <article className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
      <p className="text-sm text-[var(--revint-text-1)]">
        {groupForKind(run.workerKind as AgentWorkerKind) ?? "Tıklamayla çalışan iş"} · {workerLabel(run.workerKind)} · {runStatusLabel(run.status)} · {formatDuration(run.startedAt, run.finishedAt)} · {formatUsd(run.costUsdCents)}
      </p>
      {run.errorMsg && <p className="mt-2 text-sm text-[var(--revint-text-2)]">{run.errorMsg}</p>}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-[var(--revint-text-3)]">Ham JSON</summary>
        <pre className="mt-2 overflow-auto text-xs text-[var(--revint-text-3)]">{run.rawJson || "Kayıt yok"}</pre>
      </details>
      <RerunControl workspaceId={workspaceId} leadId={leadId} workerKind={run.workerKind} canRerun={canRerun} />
    </article>
  );
}

function latestDecision(runs: TraceRun[]): DecisionCard {
  return runs.filter(run => run.workerKind === "LEAD_INTELLIGENCE_BRIEF" && run.status === "SUCCEEDED").sort((a,b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") || b.id.localeCompare(a.id))[0]?.decision ?? toDecisionCard(null);
}
