import { requireControlRole } from "@/lib/control/roles";
import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { formatControlDate } from "@/lib/control/labels";
import { gateAnswer, getControlOverview, getGateStatuses, type GateGroup, type GateStatus } from "@/lib/control/overview";
import { formatRate } from "@/lib/control/stats";

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

const GROUP_TITLES: Record<GateGroup, { title: string; caption: string }> = {
  A: { title: "Kapı A · Boru hattı", caption: "İnceleme başlamadan önce yeterli head agent kararı üretilmeli." },
  B: { title: "Kapı B · Ölçüm", caption: "Üç merceğin hükmü güvenilir mi? Aktif rubrik sürümü üzerinden ölçülür." },
  C: { title: "Kapı C · Teslim", caption: "Referans vakalarda kalite eşiği ve regresyon yokluğu." },
};

async function OverviewBody({ workspaceId }: { workspaceId: string }) {
  await requireControlRole("VIEWER");
  const now = new Date();
  const [data, gates] = await Promise.all([getControlOverview(workspaceId, now), getGateStatuses(workspaceId, now)]);
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold">Genel Bakış</h1>

      <section className="space-y-3" aria-labelledby="today">
        <h2 id="today" className="text-lg font-semibold">Bugün</h2>
        <p className="text-sm text-[var(--revint-text-1)]">{headline(data.failed24h, data.stuckSessions)}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Card href={`/admin/control/trace?${query}&filter=failed`} label="Düşen analiz (24 saat)" value={String(data.failed24h)} />
          <Card
            href={`/admin/control/trace?${query}&filter=stuck`}
            label="Takılı oturum"
            value={String(data.stuckSessions)}
            caption="Planlama veya çalışıyor durumunda, 30 dakikadır güncellenmemiş."
          />
          <Card href={`/admin/control/reviews?${query}`} label="İnceleme kuyruğu (14 gün)" value={String(data.openReviews)} caption="Üç merceği tamamlanmamış brief." />
        </div>
        <p className="text-xs text-[var(--revint-text-3)]">Son 24 saatte {data.completed24h} lead head agent kararına ulaştı.</p>
      </section>

      <section className="space-y-3" aria-labelledby="gates">
        <h2 id="gates" className="text-lg font-semibold">Kapılar</h2>
        <p className="text-sm text-[var(--revint-text-1)]">{gateAnswer(gates)}</p>
        {(["A", "B", "C"] as const).map((group) => (
          <div key={group} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
            <h3 className="text-sm font-semibold text-[var(--revint-text-1)]">{GROUP_TITLES[group].title}</h3>
            <p className="mt-1 text-xs text-[var(--revint-text-3)]">{GROUP_TITLES[group].caption}</p>
            <ul className="mt-3 divide-y divide-[var(--revint-border)]">
              {gates.filter((gate) => gate.group === group).map((gate) => <GateRow key={gate.key} gate={gate} />)}
            </ul>
          </div>
        ))}
        <p className="text-xs text-[var(--revint-text-3)]">
          Oranlar %95 Wilson aralığıyla basılır. 50 vakanın altında veya aralık 25 puandan genişse kapı &quot;yetersiz veri&quot; kalır.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="counts">
        <h2 id="counts" className="text-lg font-semibold">Son sayımlar</h2>
        {!data.lastEval && !data.lastCandidate ? (
          <p className="text-sm text-[var(--revint-text-2)]">
            Henüz kontrol koşusu yok. <Link href={`/admin/control/golden?${query}`} className="underline">Referans vakalar</Link>
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              href={`/admin/control/golden/compare?${query}`}
              label="Son taban"
              value={data.lastEval ? formatRate(data.lastEval.passed, data.lastEval.total) : "Henüz taban koşusu yok"}
              caption={data.lastEval ? formatControlDate(data.lastEval.finishedAt) : undefined}
            />
            <Card
              href={`/admin/control/golden/compare?${query}`}
              label="Son aday"
              value={data.lastCandidate ? formatRate(data.lastCandidate.passed, data.lastCandidate.total) : "Henüz aday koşu yok"}
              caption={data.lastCandidate ? formatControlDate(data.lastCandidate.finishedAt) : undefined}
            />
          </div>
        )}
      </section>
    </section>
  );
}

function headline(failed: number, stuck: number): string {
  if (failed === 0 && stuck === 0) return "Bugün müdahale gerektiren bir şey yok.";
  if (failed > 0 && stuck > 0) return `Son 24 saatte ${failed} analiz düştü, ${stuck} oturum 30 dakikadır ilerlemiyor.`;
  if (failed > 0) return `Son 24 saatte ${failed} analiz düştü.`;
  return `${stuck} oturum 30 dakikadır ilerlemiyor.`;
}

function GateRow({ gate }: { gate: GateStatus }) {
  const status = gate.met === true
    ? { text: "Geçti", className: "text-[var(--revint-success)]" }
    : gate.met === false
      ? { text: "Geçmedi", className: "font-semibold text-[var(--revint-error)]" }
      : { text: "yetersiz veri", className: "text-[var(--revint-text-3)]" };
  return (
    <li className={`grid gap-1 py-2 text-sm md:grid-cols-[1fr_1.4fr_auto_auto] md:items-center md:gap-4 ${gate.met === null ? "text-[var(--revint-text-3)]" : "text-[var(--revint-text-1)]"}`}>
      <span>{gate.label}</span>
      <span className={gate.met === null ? "" : "text-[var(--revint-text-2)]"}>{gate.value}</span>
      <span className="text-xs text-[var(--revint-text-3)]">Hedef {gate.target}</span>
      <span className={`text-xs ${status.className}`}>{status.text}</span>
    </li>
  );
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
