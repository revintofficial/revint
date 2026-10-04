"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatControlWhen, formatDuration, formatUsd } from "@/lib/control/labels";
import type { TrialOutcome, TrialRow } from "@/lib/control/worker-test";

const REFRESH_MS = 5000;

const OUTCOME: Record<TrialOutcome, { text: string; className: string }> = {
  done: { text: "Tamamlandı", className: "border-[var(--revint-success)] text-[var(--revint-success)]" },
  stopped: { text: "Çalışmadan durdu", className: "border-[var(--revint-warning)] text-[var(--revint-warning)]" },
  failed: { text: "Düştü", className: "border-[var(--revint-error)] text-[var(--revint-error)]" },
  running: { text: "Çalışıyor", className: "border-[var(--revint-500)] text-[var(--revint-500)]" },
  never: { text: "Hiç çalışmadı", className: "border-[var(--revint-border)] text-[var(--revint-text-3)]" },
};

type Filter = "results" | "changed" | "all";

/**
 * Worker trial: tick businesses, say what is being tried, run. While a run is
 * queued or running the page refreshes itself; when it finishes, each business
 * shows what the step found in plain words, with the changed facts marked.
 */
export function TrialPanel({
  workspaceId,
  workerKind,
  stepName,
  rows,
  canRun,
  maxLeads,
}: {
  workspaceId: string;
  workerKind: string;
  /** Short name of the chain step, e.g. "Site". */
  stepName: string;
  rows: TrialRow[];
  canRun: boolean;
  maxLeads: number;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;

  const running = rows.filter((row) => row.outcome === "running").length;
  const withResult = rows.filter((row) => row.outcome !== "never");
  const changedRows = rows.filter((row) => (row.changed ?? 0) > 0);
  const failed = rows.filter((row) => row.outcome === "failed").length;

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
        started ? `${started} işletme için çalışma başladı. Sonuçlar aşağıda kendiliğinden görünecek.` : null,
        notQueued ? `${notQueued} işletme sıraya alınamadı: işleri çalıştıran arka plan servisine ulaşılamadı. Teknik ekibe haber ver.` : null,
        rejected ? `${rejected} işletme kabul edilmedi.` : null,
      ].filter(Boolean).join(" "));
      setPicked([]);
      setFilter("all");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const blocker = !canRun ? "Deneme başlatmak Yönetici yetkisi ister. Sonuçları yine de okuyabilirsin."
    : picked.length === 0 ? "Aşağıdaki listeden en az bir işletme işaretle."
    : reason.trim().length === 0 ? "Neyi denediğini bir cümleyle yaz."
    : null;

  const visible = filter === "changed" ? changedRows : filter === "results" ? withResult : rows;
  const filters: Array<[Filter, string, number]> = [
    ["all", "Hepsi", rows.length],
    ["results", "Sonucu olanlar", withResult.length],
    ["changed", "Değişenler", changedRows.length],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="İşletme" value={rows.length} />
        <Stat label="Şu an çalışan" value={running} accent={running > 0} />
        <Stat label="Sonucu değişen" value={changedRows.length} />
        <Stat label="Düşen" value={failed} warn={failed > 0} />
      </div>

      <section aria-labelledby="trial-run" className="space-y-3 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        <h2 id="trial-run" className="text-sm font-semibold text-[var(--revint-text-1)]">Denemeyi başlat</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--revint-text-2)]">
          <li>Aşağıdaki listeden işletmeleri işaretle (en fazla {maxLeads}).</li>
          <li>Neyi denediğini bir cümleyle yaz.</li>
          <li>Çalıştır&apos;a bas ve bekle; sayfa kendini yeniler.</li>
        </ol>
        <label className="block text-sm text-[var(--revint-text-2)]">
          Neyi deniyorsun?
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!canRun || pending}
            placeholder="Örn. Güncellemeden sonra rezervasyon sistemini buluyor mu?"
            className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)] disabled:opacity-60"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={Boolean(blocker) || pending} onClick={run} className="rounded-lg bg-[var(--revint-500)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "Başlatılıyor…" : picked.length > 0 ? `${stepName} adımını ${picked.length} işletmede çalıştır` : `${stepName} adımını çalıştır`}
          </button>
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])} className="text-sm text-[var(--revint-text-2)] underline">Seçimi temizle</button>
          )}
        </div>
        <p className="text-sm text-[var(--revint-text-2)]">{blocker ?? "Eski sonuçlar silinmez; her işletme için yeni bir koşu açılır ve Denetim'e kaydedilir."}</p>
        {message && <p role="status" className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]">{message}</p>}
        {running > 0 && <p role="status" className="text-sm text-[var(--revint-500)]">{running} koşu sürüyor. Sayfa {REFRESH_MS / 1000} saniyede bir kendini yeniliyor; bir şey yapmana gerek yok.</p>}
      </section>

      <section aria-labelledby="trial-list" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="trial-list" className="text-sm font-semibold text-[var(--revint-text-1)]">İşletmeler</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Süzgeç">
            {filters.map(([id, label, count]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-lg border px-3 py-1.5 text-sm ${filter === id ? "border-[var(--revint-500)] bg-[var(--revint-hover)] text-[var(--revint-text-1)]" : "border-[var(--revint-border)] text-[var(--revint-text-2)]"}`}>
                {label} ({count})
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Bu çalışma alanında henüz işletme yok.</p>}
        {rows.length > 0 && visible.length === 0 && (
          <p className="text-sm text-[var(--revint-text-2)]">
            {filter === "changed" ? "Önceki koşusuna göre sonucu değişen işletme yok." : "Bu adım henüz hiçbir işletmede çalışmadı."}
          </p>
        )}
        <ul className="space-y-3">
          {visible.map((row) => (
            <LeadCard
              key={row.leadId}
              row={row}
              query={query}
              checked={picked.includes(row.leadId)}
              disabled={!canRun || row.outcome === "running" || (!picked.includes(row.leadId) && picked.length >= maxLeads)}
              onToggle={() => toggle(row.leadId)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: number; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3">
      <span className="block text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{label}</span>
      <strong className={`mt-1 block text-xl tabular-nums ${warn ? "text-[var(--revint-error)]" : accent ? "text-[var(--revint-500)]" : "text-[var(--revint-text-1)]"}`}>{value}</strong>
    </div>
  );
}

function LeadCard({ row, query, checked, disabled, onToggle }: { row: TrialRow; query: string; checked: boolean; disabled: boolean; onToggle: () => void }) {
  const outcome = OUTCOME[row.outcome];
  const name = row.businessName || "İsimsiz işletme";
  const changedFirst = [...row.facts].sort((a, b) => Number(b.before !== null && row.changed !== null) - Number(a.before !== null && row.changed !== null));
  return (
    <li className={`rounded-xl border bg-[var(--revint-card)] ${checked ? "border-[var(--revint-500)]" : "border-[var(--revint-border)]"}`}>
      <div className="flex flex-wrap items-start gap-3 p-4">
        <input type="checkbox" aria-label={`${name} seç`} checked={checked} disabled={disabled} onChange={onToggle} className="mt-1 h-4 w-4" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--revint-text-1)]">{name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${outcome.className}`}>{outcome.text}</span>
            {(row.changed ?? 0) > 0 && <span className="rounded-full bg-[var(--revint-hover)] px-2 py-0.5 text-xs text-[var(--revint-text-1)]">Önceki koşudan farklı</span>}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--revint-text-3)]">
            {row.websiteUrl
              ? <a href={row.websiteUrl} target="_blank" rel="noreferrer noopener" className="break-all text-[var(--revint-500)] underline">{row.websiteUrl}</a>
              : <span>Site adresi yok</span>}
            {row.latest && (
              <span>
                {formatControlWhen(row.latest.finishedAt ?? row.latest.createdAt)}
                {row.latest.finishedAt ? ` · ${formatDuration(row.latest.startedAt, row.latest.finishedAt)} sürdü · ${formatUsd(row.latest.costUsdCents)}` : ""}
              </span>
            )}
            <Link href={`/admin/control/trace/${row.leadId}?${query}`} className="text-[var(--revint-500)]">Tüm geçmişi (Vaka izi)</Link>
          </p>
          <p className={`mt-2 text-sm ${row.outcome === "failed" ? "text-[var(--revint-error)]" : "text-[var(--revint-text-2)]"}`}>{row.summary}</p>
        </div>
      </div>

      {row.facts.length > 0 && (
        <div className="border-t border-[var(--revint-border)] px-4 py-3">
          <h3 className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">Bu koşu ne buldu?</h3>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {changedFirst.map((fact) => {
              const changed = fact.before !== null && row.changed !== null;
              return (
                <div key={fact.label} className={`rounded-lg border px-3 py-2 ${changed ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}>
                  <dt className="flex items-center justify-between gap-2 text-xs text-[var(--revint-text-3)]">
                    {fact.label}
                    {changed && <span className="font-medium text-[var(--revint-500)]">Değişti</span>}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--revint-text-1)]">{fact.value}</dd>
                  {changed && (
                    <dd className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--revint-text-3)]">
                      Önce: {fact.before}
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
          {row.previousFinishedAt && (
            <p className="mt-2 text-xs text-[var(--revint-text-3)]">Karşılaştırılan önceki koşu: {formatControlWhen(row.previousFinishedAt)}</p>
          )}
        </div>
      )}

      {row.record.length > 0 && (
        <details className="border-t border-[var(--revint-border)] px-4 py-3">
          <summary className="cursor-pointer text-sm text-[var(--revint-text-2)]">Sistemde bu işletme için şu an kayıtlı olan (incelemede görünen hâli)</summary>
          <div className="mt-3 hidden grid-cols-2 gap-3 text-xs uppercase tracking-wider text-[var(--revint-text-3)] sm:grid">
            <span>Sistemin söylediği</span>
            <span>Dayandığı kayıt</span>
          </div>
          <ul className="mt-2 space-y-2">
            {row.record.map((item, index) => (
              <li key={index} className={`grid gap-1 rounded-lg border px-3 py-2 sm:grid-cols-2 sm:gap-3 ${item.conflict ? "border-[var(--revint-warning)]" : "border-[var(--revint-border)]"}`}>
                <span className={`whitespace-pre-wrap break-words text-sm ${item.claim.muted ? "text-[var(--revint-text-3)]" : "text-[var(--revint-text-1)]"}`}>{item.claim.text}</span>
                <span className={`whitespace-pre-wrap break-words text-sm ${item.support.muted ? "text-[var(--revint-text-3)]" : "text-[var(--revint-text-2)]"}`}>{item.support.text}</span>
                {item.conflict && <span className="text-sm text-[var(--revint-warning)] sm:col-span-2">Çelişki: {item.conflict}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
