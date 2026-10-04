"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatControlWhen, formatDuration, formatUsd, runStatusLabel } from "@/lib/control/labels";
import type { TrialRow } from "@/lib/control/worker-test";

const REFRESH_MS = 5000;

/**
 * Worker trial: tick leads, give one reason, run. While a run is queued or
 * running the page refreshes itself; when it finishes, each lead shows the
 * fields that changed against its previous successful run.
 */
export function TrialPanel({
  workspaceId,
  workerKind,
  workerName,
  rows,
  canRun,
  maxLeads,
}: {
  workspaceId: string;
  workerKind: string;
  workerName: string;
  rows: TrialRow[];
  canRun: boolean;
  maxLeads: number;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const running = rows.filter((row) => row.inFlight).length;
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;

  useEffect(() => {
    if (running === 0) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  function toggle(leadId: string) {
    setPicked((current) => (current.includes(leadId) ? current.filter((id) => id !== leadId) : current.length >= maxLeads ? current : [...current, leadId]));
  }

  async function run() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/deneme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, workerKind, leadIds: picked, reason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(typeof result?.error === "string" ? result.error : "Deneme başlatılamadı.");
        return;
      }
      const started = Array.isArray(result?.started) ? result.started.length : 0;
      const notQueued = Array.isArray(result?.notQueued) ? result.notQueued.length : 0;
      const rejected = Array.isArray(result?.rejected) ? result.rejected.length : 0;
      setMessage([
        `${started} lead kuyruğa girdi.`,
        notQueued ? `${notQueued} kayıt açıldı ama kuyruğa alınamadı (Redis'e ulaşılamadı).` : null,
        rejected ? `${rejected} lead kabul edilmedi.` : null,
      ].filter(Boolean).join(" "));
      setPicked([]);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const blocker = !canRun ? "Deneme başlatmak Yönetici işidir."
    : picked.length === 0 ? "Çalıştırılacak lead'leri işaretle."
    : reason.trim().length === 0 ? "Neyi denediğini bir cümleyle yaz; denetim kaydına geçer."
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        <label className="block text-sm text-[var(--revint-text-2)]">
          Neyi deniyorsun?
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!canRun || pending}
            placeholder="Örn. derin site taraması sonrası rezervasyon sağlayıcısı bulunuyor mu"
            className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)] disabled:opacity-60"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={Boolean(blocker) || pending} onClick={run} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
            {picked.length > 0 ? `${workerName}: ${picked.length} lead'de çalıştır` : `${workerName}: çalıştır`}
          </button>
          <span className="text-sm text-[var(--revint-text-2)]">{blocker ?? `En fazla ${maxLeads} lead. Eski sonuçlar durur; her lead için yeni bir koşu açılır.`}</span>
        </div>
        {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
        {running > 0 && <p role="status" className="text-sm text-[var(--revint-text-2)]">{running} koşu sürüyor. Sayfa {REFRESH_MS / 1000} saniyede bir kendini yeniler.</p>}
      </div>

      {rows.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Bu çalışma alanında lead yok.</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.leadId} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
            <div className="flex flex-wrap items-start gap-3">
              <input
                type="checkbox"
                aria-label={`${row.businessName || "İsimsiz işletme"} seç`}
                checked={picked.includes(row.leadId)}
                disabled={!canRun || row.inFlight}
                onChange={() => toggle(row.leadId)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--revint-text-1)]">{row.businessName || "İsimsiz işletme"}</span>
                  <Link href={`/admin/control/trace/${row.leadId}?${query}`} className="text-xs text-[var(--revint-500)]">Vaka izi</Link>
                </div>
                <p className="break-all text-xs text-[var(--revint-text-3)]">{row.websiteUrl || "Site adresi yok"}</p>
                <p className="text-sm text-[var(--revint-text-2)]">
                  {row.latest
                    ? `${runStatusLabel(row.latest.status)} · ${formatControlWhen(row.latest.finishedAt ?? row.latest.createdAt)} · ${formatDuration(row.latest.startedAt, row.latest.finishedAt)} · ${formatUsd(row.latest.costUsdCents)}`
                    : "Hiç çalışmadı"}
                </p>
                {row.note && <p className="text-sm text-[var(--revint-text-2)]">{row.note}</p>}
                {row.diff && <Diff diff={row.diff} previousAt={row.previousFinishedAt} />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Diff({ diff, previousAt }: { diff: NonNullable<TrialRow["diff"]>; previousAt: string | null }) {
  if (diff.changes.length === 0) {
    return <p className="text-sm text-[var(--revint-text-2)]">Önceki başarılı koşuyla ({previousAt ? formatControlWhen(previousAt) : "zaman yok"}) aynı çıktı; hiçbir alan değişmedi.</p>;
  }
  return (
    <details open className="text-sm">
      <summary className="cursor-pointer text-[var(--revint-text-1)]">
        {diff.changes.length + diff.hidden} alan değişti · önceki koşu {previousAt ? formatControlWhen(previousAt) : "zaman yok"}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed text-left text-xs">
          <thead className="text-[var(--revint-text-3)]">
            <tr>
              <th className="w-1/4 py-1 pr-3 font-normal uppercase tracking-wider">Alan</th>
              <th className="py-1 pr-3 font-normal uppercase tracking-wider">Önce</th>
              <th className="py-1 font-normal uppercase tracking-wider">Sonra</th>
            </tr>
          </thead>
          <tbody>
            {diff.changes.map((change) => (
              <tr key={change.path} className="border-t border-[var(--revint-border)] align-top">
                <td className="break-words py-1 pr-3 font-mono text-[var(--revint-text-2)]">{change.path}</td>
                <td className="break-words py-1 pr-3 text-[var(--revint-text-3)]">{change.before}</td>
                <td className="break-words py-1 text-[var(--revint-text-1)]">{change.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {diff.hidden > 0 && <p className="mt-1 text-xs text-[var(--revint-text-3)]">+{diff.hidden} alan daha değişti; tamamı Vaka izi'ndeki ham JSON'da.</p>}
    </details>
  );
}
