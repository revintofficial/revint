import { requireControlRole } from "@/lib/control/roles";
import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { formatControlDate } from "@/lib/control/labels";
import { getControlOverview } from "@/lib/control/overview";

export default async function ControlOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const { workspaceId } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <OverviewBody workspaceId={workspaceId} /> : null}
    </ControlFrame>
  );
}

async function OverviewBody({ workspaceId }: { workspaceId: string }) {
  await requireControlRole("VIEWER");
  const data = await getControlOverview(workspaceId);
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Genel Bakış</h1>
      <p className="text-sm text-[var(--revint-text-1)]">{headline(data.failed24h, data.stuckSessions)}</p>
      <p className="text-sm text-[var(--revint-text-3)]">Son 24 saatte {data.completed24h} analiz tamamlandı.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card href={`/admin/control/trace?${query}&filter=failed`} label="Düşen analiz" value={String(data.failed24h)} />
        <Card
          href={`/admin/control/trace?${query}&filter=stuck`}
          label="Takılı oturum"
          value={String(data.stuckSessions)}
          caption="Planlama veya çalışıyor durumunda, 30 dakikadır güncellenmemiş."
        />
        <Card href={`/admin/control/reviews?${query}`} label="Eksik mercekli brief (14 gün)" value={String(data.openReviews)} />
        {data.lastEval ? (
          <Card
            href={`/admin/control/golden/compare?${query}`}
            label="Son taban"
            value={`${data.lastEval.passed}/${data.lastEval.total} · ${data.lastEval.total ? Math.round(100 * data.lastEval.passed / data.lastEval.total) : 0}%, ${formatControlDate(data.lastEval.finishedAt)}`}
          />
        ) : (
          <Card href={`/admin/control/golden?${query}`} label="Son taban" value="İnceleyen referans vakaları kaydedip taban sayımını başlatmalı" />
        )}
        <Card href={`/admin/control/golden/compare?${query}`} label="Son aday" value={data.lastCandidate ? `${data.lastCandidate.passed}/${data.lastCandidate.total} · ${data.lastCandidate.total ? Math.round(100 * data.lastCandidate.passed / data.lastCandidate.total) : 0}%` : "Yönetici referans vakalar için aday koşuyu başlatmalı"} />
      </div>
    </section>
  );
}

function headline(failed: number, stuck: number): string {
  if (failed === 0 && stuck === 0) return "Son 24 saatte düşen iş veya takılı oturum yok.";
  if (failed > 0 && stuck > 0) return `Son 24 saatte ${failed} analiz düştü, ${stuck} oturum 30 dakikadır ilerlemiyor.`;
  if (failed > 0) return `Son 24 saatte ${failed} analiz düştü.`;
  return `${stuck} oturum 30 dakikadır ilerlemiyor.`;
}

function Card({ href, label, value, caption }: { href: string; label: string; value: string; caption?: string }) {
  return (
    <Link href={href} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4 hover:bg-[var(--revint-hover)]">
      <span className="block text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{label}</span>
      <strong className="mt-2 block text-xl text-[var(--revint-text-1)]">{value}</strong>
      {caption && <span className="mt-2 block text-xs text-[var(--revint-text-2)]">{caption}</span>}
    </Link>
  );
}
