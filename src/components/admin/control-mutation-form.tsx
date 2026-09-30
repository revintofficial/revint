"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type ControlFormField = {
  name: string;
  label: string;
  kind?: "select" | "textarea" | "text";
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
};

/** Small shared control form: JSON mutation, readable API errors, and refresh on success. */
export function ControlMutationForm({ endpoint, baseBody, fields, submitLabel }: {
  endpoint: string;
  baseBody: Record<string, string>;
  fields: ControlFormField[];
  submitLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, ...data }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(typeof result?.error === "string" ? result.error : `Request failed (${response.status})`);
        return;
      }
      setMessage("Request submitted.");
      router.refresh();
    } catch {
      setMessage("Unable to send request. Try again.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
    {fields.map((field) => <label key={field.name} className="block space-y-1 text-sm">
      <span className="text-[var(--revint-text-2)]">{field.label}</span>
      {field.kind === "select" ? <select name={field.name} required={field.required} className="w-full rounded border border-[var(--revint-border)] bg-[var(--revint-surface)] p-2">
        <option value="">Select…</option>
        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : field.kind === "textarea" ? <textarea name={field.name} required={field.required} rows={3} className="w-full rounded border border-[var(--revint-border)] bg-[var(--revint-surface)] p-2" /> : <input name={field.name} required={field.required} className="w-full rounded border border-[var(--revint-border)] bg-[var(--revint-surface)] p-2" />}
    </label>)}
    <button type="submit" disabled={pending} className="rounded bg-[var(--revint-500)] px-4 py-2 text-sm font-medium text-[var(--revint-bg)] disabled:opacity-50">{pending ? "Submitting…" : submitLabel}</button>
    {message && <p role="status" aria-live="polite" className="text-sm text-[var(--revint-text-2)]">{message}</p>}
  </form>;
}
