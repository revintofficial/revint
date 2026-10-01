"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "PASS", label: "Geçti" },
  { value: "FAIL", label: "Kaldı" },
  { value: "NEEDS_REVIEW", label: "İncelenmeli" },
] as const;

/** Adds an adjudicated verdict next to the three lens verdicts. Originals stay as they are. */
export function AdjudicateControl({
  workspaceId,
  agentRunId,
  canAdjudicate,
}: {
  workspaceId: string;
  agentRunId: string;
  canAdjudicate: boolean;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/uyum/adjudicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, agentRunId, verdict, note }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : null;
        setMessage(error ?? "Uzlaştırma kaydedilemedi.");
        return;
      }
      setMessage("Uzlaştırılmış hüküm kaydedildi. Mercek hükümleri değişmedi.");
      setNote("");
      router.refresh();
    } catch {
      setMessage("İstek gönderilemedi. Yeniden dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--revint-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Uzlaştırılmış hüküm"
          value={verdict}
          disabled={!canAdjudicate}
          onChange={(event) => setVerdict(event.target.value)}
          className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)] disabled:opacity-60"
        >
          <option value="">Hüküm seç</option>
          {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input
          aria-label="Uzlaştırma gerekçesi"
          value={note}
          disabled={!canAdjudicate}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Hangi rubrik maddesi ayrıştırdı? Bir cümle."
          className="min-w-[16rem] flex-1 rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm disabled:opacity-60"
        />
        <button
          type="button"
          disabled={!canAdjudicate || pending || !verdict || note.trim().length === 0}
          onClick={submit}
          className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Uzlaştır
        </button>
      </div>
      {!canAdjudicate && <p className="text-xs text-[var(--revint-text-2)]">Uzlaştırma Yönetici işidir. İnceleyen hükmünü İnceleme ekranında yazar.</p>}
      {message && <p role="status" aria-live="polite" className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}
