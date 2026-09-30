"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RerunControl({
  workspaceId,
  leadId,
  workerKind,
  canRerun,
}: {
  workspaceId: string;
  leadId: string;
  workerKind: string;
  canRerun: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/control/trace/${leadId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, workerKind, reason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(response.status === 400 ? "Gerekçe boş olamaz." : "Yeniden çalıştırma kabul edilmedi.");
        return;
      }
      if (result?.enqueued === false) {
        setMessage("Kayıt açıldı, kuyruğa alınamadı.");
        router.refresh();
        return;
      }
      setMessage("Yeni çalıştırma kuyruğa girdi.");
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--revint-border)] pt-3">
      <p className="text-sm text-[var(--revint-text-2)]">Eski sonuç durur. Yeni bir çalıştırma kuyruğa girer. Bu düğme analizi silmez.</p>
      <label className="block text-sm text-[var(--revint-text-2)]">
        Gerekçe
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canRerun || pending} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)] disabled:opacity-60" rows={2} />
      </label>
      <button type="button" disabled={!canRerun || pending || reason.trim().length === 0} onClick={submit} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
        Yeniden çalıştır
      </button>
      {!canRerun && <p className="text-sm text-[var(--revint-text-2)]">Yeniden çalıştırmak Yönetici işidir.</p>}
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}
