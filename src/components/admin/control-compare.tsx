"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ComparePicker({
  workspaceId,
  runs,
  baseId,
  candidateId,
}: {
  workspaceId: string;
  runs: Array<{ id: string; label: string }>;
  baseId: string;
  candidateId: string;
}) {
  const router = useRouter();

  function go(nextBase: string, nextCandidate: string) {
    const params = new URLSearchParams({ workspaceId });
    if (nextBase) params.set("base", nextBase);
    if (nextCandidate) params.set("candidate", nextCandidate);
    router.push(`/admin/control/golden/compare?${params.toString()}`);
  }

  if (runs.length < 2) {
    return <p className="text-sm text-[var(--revint-text-2)]">Karşılaştırmak için iki kontrol koşusu gerekir.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-[var(--revint-text-2)]">
        Taban
        <select value={baseId} onChange={(event) => go(event.target.value, candidateId)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]">
          <option value="">Koşu seç</option>
          {runs.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
        </select>
      </label>
      <label className="text-sm text-[var(--revint-text-2)]">
        Aday
        <select value={candidateId} onChange={(event) => go(baseId, event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]">
          <option value="">Koşu seç</option>
          {runs.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
        </select>
      </label>
    </div>
  );
}

export function AcceptEval({
  workspaceId,
  evalRunId,
  canAccept,
}: {
  workspaceId: string;
  evalRunId: string;
  canAccept: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/golden/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, evalRunId, reason }),
      });
      if (!response.ok) {
        setMessage("Kabul kaydedilemedi.");
        return;
      }
      setMessage("Kontrol sonucu kabul edildi.");
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--revint-border)] p-4">
      <p className="text-sm text-[var(--revint-text-1)]">Bu, kontrol sonucunu kabul eder. Canlı ICP, paket ve oyun kitabını yayınlamaz.</p>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canAccept} rows={2} className="w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm disabled:opacity-60" />
      <button type="button" disabled={!canAccept || pending || reason.trim().length === 0} onClick={accept} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
        Kontrol sonucunu kabul et
      </button>
      {!canAccept && <p className="text-sm text-[var(--revint-text-2)]">Kabul etmek Yönetici işidir.</p>}
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}
