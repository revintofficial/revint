"use client";

/**
 * SDR feedback on a head-agent brief (plan Task 10, karar kağıdı §9 Kanal 2).
 *
 * One primary decision: "Bu brief'i kullandım" / "Kullanmadım". Not using it
 * opens a fixed single-choice list of six reasons; a one-sentence note is
 * optional. No score, no stars, no rubric, no link to the control room.
 * Each save appends a row (the newest one counts); after saving the line
 * says "Teşekkürler, kaydedildi" and the buttons stay disabled.
 */
import { useState } from "react";
import { SDR_REASON_OPTIONS } from "@/lib/control/labels";

type Status = "idle" | "saving" | "saved";

export function LeadFeedback({ leadId, agentRunId }: { leadId: string; agentRunId: string }) {
  const [choice, setChoice] = useState<"used" | "unused" | null>(null);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const done = status === "saved";
  const busy = status === "saving";

  async function send(used: boolean) {
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentRunId,
          used,
          reason: used ? null : reason || null,
          note: note.trim() ? note.trim() : null,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(typeof result?.error === "string" ? result.error : "Kaydedilemedi, tekrar dene.");
        setStatus("idle");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Kaydedilemedi, tekrar dene.");
      setStatus("idle");
    }
  }

  const saveBlocker = !reason ? "Bir neden seç." : null;

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4" aria-label="Brief geri bildirimi">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={done || busy}
          aria-pressed={choice === "used"}
          onClick={() => { setChoice("used"); void send(true); }}
          className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${choice === "used" ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}
        >
          Bu brief&apos;i kullandım
        </button>
        <button
          type="button"
          disabled={done || busy}
          aria-pressed={choice === "unused"}
          onClick={() => setChoice("unused")}
          className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${choice === "unused" ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}
        >
          Kullanmadım
        </button>
      </div>

      {choice === "unused" && !done && (
        <div className="space-y-3">
          <fieldset className="space-y-1">
            <legend className="text-sm text-[var(--revint-text-2)]">Neden?</legend>
            {SDR_REASON_OPTIONS.map(option => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-[var(--revint-text-1)]">
                <input
                  type="radio"
                  name={`sdr-reason-${agentRunId}`}
                  value={option.value}
                  checked={reason === option.value}
                  disabled={busy}
                  onChange={() => setReason(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm text-[var(--revint-text-2)]">
            Not (istersen tek cümle)
            <input
              value={note}
              maxLength={1000}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="istersen tek cümle"
              className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]"
            />
          </label>
          <button
            type="button"
            disabled={busy || Boolean(saveBlocker)}
            onClick={() => void send(false)}
            className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Kaydet
          </button>
          {saveBlocker && <p className="text-xs text-[var(--revint-text-3)]">{saveBlocker}</p>}
        </div>
      )}

      {done && <p role="status" className="text-sm text-[var(--revint-success)]">Teşekkürler, kaydedildi</p>}
      {error && <p role="alert" className="text-sm text-[var(--revint-error)]">{error}</p>}
    </div>
  );
}
