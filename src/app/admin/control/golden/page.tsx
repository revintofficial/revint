import { listRecentBriefs } from "@/lib/control/review";
import { LENS_LABELS } from "@/lib/control/lenses";
import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { StartEvalForm } from "@/components/admin/control-golden-actions";
import { severityLabel } from "@/lib/control/labels";
import { listGoldenCases } from "@/lib/control/golden";
import { loadUserLabels } from "@/lib/control/read";
import { requireControlRole, roleAtLeast } from "@/lib/control/roles";

export default async function GoldenPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const { workspaceId } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <GoldenBody workspaceId={workspaceId} /> : null}
    </ControlFrame>
  );
}

async function GoldenBody({ workspaceId }: { workspaceId: string }) {
  const actor = await requireControlRole("VIEWER");
  const [cases, briefs] = await Promise.all([listGoldenCases(workspaceId), listRecentBriefs(workspaceId)]);
  const people = await loadUserLabels(cases.map((evalCase) => evalCase.approvedByUserId));
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Referans vakalar</h1>
        <Link href={`/admin/control/golden/compare?${query}`} className="text-sm text-[var(--revint-500)]">Karşılaştır</Link>
      </div>
      <p className="text-sm text-[var(--revint-text-2)]">Taban sayımı saklanan çıktıyı kurallarla ölçer; model çağırmaz. Aday koşuyu Karşılaştırma ekranında yönetici başlatır.</p>
      <StartEvalForm workspaceId={workspaceId} canStart={roleAtLeast(actor.role, "REVIEWER")} />
      {cases.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Henüz referans vaka yok. Teknik, Alan ve Satış aynı brief için hüküm bırakmalı; sonra merceği atanmış bir İnceleyen beklenen kuralları yazarak kaydetmeli.</p>}
      <section className="space-y-2"><h2 className="font-semibold">Referans vakaya dönüştürülecek brief’ler</h2>
      {briefs.length === 0 && <p className="text-sm">FineDine ekibi başarılı bir brief ürettiğinde burada işletme adı görünür.</p>}
      {briefs.map(brief => <div key={brief.agentRunId} className="rounded-xl border border-[var(--revint-border)] p-3 text-sm"><Link className="text-[var(--revint-500)]" href={`/admin/control/reviews?${query}&lead=${brief.leadId}`}>{brief.businessName} incelemesini aç</Link><p>{brief.missingLenses.length ? `Referans vaka kapalı. Eksik mercekler: ${brief.missingLenses.map(l => LENS_LABELS[l]).join(", ")}` : "Üç mercek tamamlandı. İncelemeyi aç ve beklenen kuralları yazarak referans vaka kaydet."}</p></div>)}
      </section>
      <ul className="space-y-2">
        {cases.map((evalCase) => (
          <li key={evalCase.id} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3 text-sm">
            <div className="font-medium text-[var(--revint-text-1)]">{evalCase.title}</div>
            <div className="mt-1 text-[var(--revint-text-2)]">
              {evalCase.segment || "Segment yok"} · {evalCase.country || "Ülke yok"} · {severityLabel(evalCase.severity)} · {people.get(evalCase.approvedByUserId) ?? "Bilinmeyen kişi"}
            </div>
            {evalCase.sourceLeadId && evalCase.businessName && (
              <Link href={`/admin/control/trace/${evalCase.sourceLeadId}?${query}`} className="mt-1 inline-block text-[var(--revint-500)]">
                {evalCase.businessName}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
