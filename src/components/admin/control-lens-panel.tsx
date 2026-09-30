"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewLens } from "@/generated/prisma/client";
import { LENS_LABELS } from "@/lib/control/lenses";
import { roleLabel } from "@/lib/control/labels";

type LensPerson = {
  userId: string;
  label: string;
  role: "VIEWER" | "REVIEWER" | "ADMIN";
  lens: ReviewLens | null;
};

export function LensAssignList({ workspaceId, people }: { workspaceId: string; people: LensPerson[] }) {
  return (
    <ul className="space-y-3">
      {people.map((person) => (
        <li key={`${person.userId}:${person.lens ?? "none"}`}>
          <LensRow workspaceId={workspaceId} person={person} />
        </li>
      ))}
    </ul>
  );
}

function LensRow({ workspaceId, person }: { workspaceId: string; person: LensPerson }) {
  const router = useRouter();
  const [lens, setLens] = useState(person.lens ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = person.lens ? LENS_LABELS[person.lens] : "Atanmadı";

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/lenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userId: person.userId,
          lens: lens === "" ? null : lens,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(typeof result?.error === "string" ? result.error : "Mercek kaydedilemedi.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3">
      <p className="text-sm font-medium text-[var(--revint-text-1)]">{person.label}</p>
      <p className="mt-1 text-xs text-[var(--revint-text-3)]">{roleLabel(person.role)} · {current}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--revint-text-2)]">
          Mercek
          <select
            value={lens}
            onChange={(event) => setLens(event.target.value)}
            className="ml-2 rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]"
          >
            <option value="">Atanmadı</option>
            <option value="TECHNICAL">Teknik</option>
            <option value="DOMAIN">Alan</option>
            <option value="SALES">Satış</option>
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Kaydet
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-[var(--revint-text-1)]">{message}</p>}
    </article>
  );
}
