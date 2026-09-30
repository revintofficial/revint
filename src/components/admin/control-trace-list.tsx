"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatControlWhen, runStatusLabel, workerLabel } from "@/lib/control/labels";

export function TraceLeadList({
  workspaceId,
  rows,
}: {
  workspaceId: string;
  rows: Array<{
    leadId: string;
    businessName: string;
    latestStatus: string;
    latestWorkerKind: string;
    latestAt: string;
    failedCount: number;
  }>;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => rows.filter((row) => !needle || row.businessName.toLowerCase().includes(needle)),
    [needle, rows],
  );
  const queryString = `workspaceId=${encodeURIComponent(workspaceId)}`;

  return (
    <div className="space-y-3">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İşletme adı" className="w-full max-w-md rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm" />
      {rows.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Bu süzgeçte iş kaydı yok. Ekip bir lead için analiz başlattığında iş durumu burada görünür; farklı bir süzgeç de seçebilirsin.</p>}
      {rows.length > 0 && visible.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Bu ada uyan işletme yok. Aramayı temizle veya işletme adını kontrol et.</p>}
      <ul className="space-y-2">
        {visible.map((row) => (
          <li key={row.leadId}>
            <Link href={`/admin/control/trace/${row.leadId}?${queryString}`} className="block rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3 hover:bg-[var(--revint-hover)]">
              <span className="block text-sm font-medium text-[var(--revint-text-1)]">{row.businessName || "İsimsiz işletme"}</span>
              <span className="mt-1 block text-xs text-[var(--revint-text-2)]">
                {row.latestStatus ? runStatusLabel(row.latestStatus) : "Son koşu yok"}
                {" · "}
                {row.latestWorkerKind ? workerLabel(row.latestWorkerKind) : "İş yok"}
                {" · "}
                {row.latestAt ? formatControlWhen(row.latestAt) : "Zaman yok"}
                {" · "}
                {row.failedCount === 0 ? "Düşüş yok" : `${row.failedCount} düşüş`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
