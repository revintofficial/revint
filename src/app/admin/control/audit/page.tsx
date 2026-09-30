import { requireControlRole } from "@/lib/control/roles";
import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";
import { listAdminAudit } from "@/lib/control/audit";
import { auditSentence, auditTargetHref, formatControlWhen } from "@/lib/control/labels";
import { prisma } from "@/lib/prisma";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; action?: string; person?: string; outcome?: string; on?: string; before?: string }>;
}) {
  const params = await searchParams;
  return (
    <ControlFrame workspaceId={params.workspaceId}>
      {params.workspaceId ? <AuditBody params={params} workspaceId={params.workspaceId} /> : null}
    </ControlFrame>
  );
}

async function AuditBody({
  workspaceId,
  params,
}: {
  workspaceId: string;
  params: { action?: string; person?: string; outcome?: string; on?: string; before?: string };
}) {
  await requireControlRole("VIEWER");
  const person = params.person?.trim() ?? "";
  let actorUserId: string | undefined;
  let missingPerson = false;
  if (person) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: person }, { fullName: person }] },
      select: { id: true },
    });
    if (!user) missingPerson = true;
    else actorUserId = user.id;
  }
  const on = params.on ? new Date(`${params.on}T00:00:00.000Z`) : undefined;
  const since = on && !Number.isNaN(on.getTime()) ? on : undefined;
  const until = since ? new Date(since.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const before = params.before ? new Date(params.before) : until;
  const listed = missingPerson
    ? { rows: [], hasOlder: false }
    : await listAdminAudit({
        workspaceId,
        action: params.action || undefined,
        outcome: params.outcome || undefined,
        actorUserId,
        since,
        before: before && !Number.isNaN(before.getTime()) ? before : undefined,
      });
  const query = new URLSearchParams({ workspaceId });
  if (params.action) query.set("action", params.action);
  if (person) query.set("person", person);
  if (params.outcome) query.set("outcome", params.outcome);
  if (params.on) query.set("on", params.on);
  const oldest = listed.rows[listed.rows.length - 1];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Denetim</h1>
      <p className="text-sm text-[var(--revint-text-1)]">Bu kayıt düzenlenemez ve silinemez.</p>
      <form className="grid gap-3 md:grid-cols-4" method="get">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input name="action" defaultValue={params.action ?? ""} placeholder="Eylem" className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm" />
        <input name="person" defaultValue={person} placeholder="Ad veya e-posta" className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm" />
        <select name="outcome" defaultValue={params.outcome ?? ""} className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm">
          <option value="">Sonuç</option>
          <option value="SUCCEEDED">Oldu</option>
          <option value="FAILED">Olmadı</option>
        </select>
        <input type="date" name="on" defaultValue={params.on ?? ""} className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg border border-[var(--revint-border)] px-3 py-2 text-sm md:col-span-4 md:w-fit">Süz</button>
      </form>
      {missingPerson && <p className="text-sm text-[var(--revint-text-2)]">Bu kişiye ait kayıt yok.</p>}
      {!missingPerson && listed.rows.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Henüz bu filtrelere uyan denetim kaydı yok. İnceleyen bir hüküm veya referans vaka kaydettiğinde, Yönetici aday koşuyu başlattığında kayıt burada görünür.</p>}
      <ul className="space-y-3">
        {listed.rows.map((row) => {
          const href = auditTargetHref(workspaceId, row.targetType, row.targetId);
          return (
            <li key={row.id} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
              <p className="text-sm text-[var(--revint-text-1)]">{auditSentence(row.actorLabel, row.action, row.targetLabel, row.afterJson)}</p>
              <p className="mt-1 text-xs text-[var(--revint-text-3)]">{row.action}</p>
              <p className="mt-2 text-xs text-[var(--revint-text-2)]">
                {formatControlWhen(row.createdAt)} · {row.outcome === "SUCCEEDED" ? "oldu" : "olmadı"} · {row.reason || "Gerekçe yok"}
              </p>
              {href && <Link href={href} className="mt-2 inline-block text-sm text-[var(--revint-500)]">{row.targetLabel}</Link>}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[var(--revint-text-3)]">Önce / sonra</summary>
                <pre className="mt-2 overflow-auto text-xs text-[var(--revint-text-3)]">{JSON.stringify({ before: row.beforeJson, after: row.afterJson }, null, 2)}</pre>
              </details>
            </li>
          );
        })}
      </ul>
      {listed.hasOlder && oldest && (
        <Link href={`/admin/control/audit?${query.toString()}&before=${encodeURIComponent(oldest.createdAt)}`} className="inline-block text-sm text-[var(--revint-500)]">
          Daha eski kayıt var
        </Link>
      )}
    </section>
  );
}
