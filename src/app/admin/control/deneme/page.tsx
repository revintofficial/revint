import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { TrialPanel } from "@/components/admin/control-trial";
import { requireControlRole, roleAtLeast } from "@/lib/control/roles";
import { TRACE_GROUPS } from "@/lib/control/trace-groups";
import { TRIAL_MAX_LEADS, isTrialKind, listTrialRows } from "@/lib/control/worker-test";

/** What each chain step does, in one plain sentence. */
const STEP_TEXT: Record<string, string> = {
  APIFY_GMAPS_DEEP: "Google Haritalar'dan işletmenin yorumlarını ve iletişim bilgilerini çeker.",
  WEBSITE_AUDITOR: "İşletmenin web sitesini açar; rezervasyon, menü, sipariş gibi şeyleri arar.",
  REVIEW_ANALYST: "Çekilen yorumları okur; müşterilerin neyi övdüğünü, neden şikâyet ettiğini çıkarır.",
  LEAD_INTELLIGENCE_BRIEF: "Önceki üç adımın bulduklarından satış kartını (brief) yazar. Yapay zekâ çalışır.",
};

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
  const steps = TRACE_GROUPS.flatMap((group) => group.kinds.map((item) => ({ kind: item, label: group.label })));
  const current = steps.find((step) => step.kind === kind) ?? steps[0];
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Deneme</h1>

      <section aria-labelledby="trial-step" className="space-y-3">
        <h2 id="trial-step" className="text-sm font-semibold text-[var(--revint-text-1)]">Hangi adımı deniyorsun?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const active = step.kind === kind;
            return (
              <Link
                key={step.kind}
                href={`/admin/control/deneme?${query}&worker=${step.kind}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl border p-4 ${active ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)] bg-[var(--revint-card)] hover:bg-[var(--revint-hover)]"}`}
              >
                <span className="block text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{index + 1}. adım{active ? " · seçili" : ""}</span>
                <span className="mt-1 block text-base font-semibold text-[var(--revint-text-1)]">{step.label}</span>
                <span className="mt-1 block text-xs text-[var(--revint-text-2)]">{STEP_TEXT[step.kind]}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <TrialPanel
        key={kind}
        workspaceId={workspaceId}
        workerKind={kind}
        stepName={current.label}
        rows={rows}
        canRun={roleAtLeast(actor.role, "ADMIN")}
        maxLeads={TRIAL_MAX_LEADS}
      />
    </section>
  );
}
