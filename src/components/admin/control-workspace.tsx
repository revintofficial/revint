"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { roleLabel } from "@/lib/control/labels";

export type WorkspaceOption = { id: string; name: string; slug: string; /** Leads with a brief in the last 14 days (picker only). */ recentBriefs?: number };

const RECENT_KEY = "revint.control.recentWorkspaces";

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

function remember(id: string, recent: string[]) {
  const next = [id, ...recent.filter((item) => item !== id)].slice(0, 3);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function WorkspacePicker({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  function choose(id: string) {
    const next = remember(id, recent);
    setRecent(next);
    const params = new URLSearchParams(window.location.search);
    params.set("workspaceId", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  const recentWorkspaces = recent
    .map((id) => workspaces.find((workspace) => workspace.id === id))
    .filter((workspace): workspace is WorkspaceOption => Boolean(workspace));
  const needle = query.trim().toLowerCase();
  // Without a search every workspace is listed (active ones first, as the server sorted them).
  const matches = needle
    ? workspaces.filter((workspace) => workspace.name.toLowerCase().includes(needle) || workspace.slug.toLowerCase().includes(needle))
    : workspaces;
  const active = workspaces.filter((workspace) => (workspace.recentBriefs ?? 0) > 0).length;

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">Hangi çalışma alanına bakıyorsun?</h1>
      {recentWorkspaces.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">Son bakılanlar</p>
          <div className="flex flex-col gap-2">
            {recentWorkspaces.map((workspace) => (
              <button key={workspace.id} type="button" onClick={() => choose(workspace.id)} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3 text-left hover:bg-[var(--revint-hover)]">
                <span className="block text-sm font-medium text-[var(--revint-text-1)]">{workspace.name}</span>
                <span className="block text-xs text-[var(--revint-text-3)]">{workspace.slug}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block space-y-2">
        <span className="text-sm text-[var(--revint-text-2)]">Ad veya slug ara</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]" />
      </label>
      {!needle && workspaces.length > 0 && (
        <p className="text-xs text-[var(--revint-text-3)]">
          {active > 0
            ? `${workspaces.length} çalışma alanından ${active} tanesinde son 14 günde brief var; onlar üstte.`
            : "Son 14 günde hiçbir çalışma alanında brief üretilmedi."}
        </p>
      )}
      {needle && matches.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Bu ada uyan çalışma alanı yok.</p>}
      {matches.length > 0 && (
        <ul className="space-y-2">
          {matches.map((workspace) => (
            <li key={workspace.id}>
              <button type="button" onClick={() => choose(workspace.id)} className="w-full rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3 text-left hover:bg-[var(--revint-hover)]">
                <span className="block text-sm font-medium">{workspace.name}</span>
                <span className="block text-xs text-[var(--revint-text-3)]">
                  {workspace.slug} · {(workspace.recentBriefs ?? 0) > 0 ? `son 14 günde ${workspace.recentBriefs} lead'de brief` : "son 14 günde brief yok"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ControlStrip({
  workspace,
  role,
  email,
  workspaces,
}: {
  workspace: WorkspaceOption;
  role: string;
  email: string | null;
  workspaces: WorkspaceOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? workspaces.filter((item) => item.name.toLowerCase().includes(needle) || item.slug.toLowerCase().includes(needle)).slice(0, 8)
    : [];

  function choose(id: string) {
    const recent = readRecent();
    remember(id, recent);
    const params = new URLSearchParams(window.location.search);
    params.set("workspaceId", id);
    setOpen(false);
    setQuery("");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-[var(--revint-text-1)]">{workspace.name}</div>
        <div className="text-xs text-[var(--revint-text-3)]">{workspace.slug}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-[var(--revint-border)] px-2 py-1 text-xs text-[var(--revint-text-2)]">{roleLabel(role)}</span>
        <span className="text-[var(--revint-text-2)]">{email ?? "E-posta yok"}</span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="text-sm text-[var(--revint-500)]">Alan değiştir</button>
      </div>
      {open && (
        <div className="w-full space-y-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad veya slug ara" className="w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm" />
          {needle && matches.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Bu ada uyan çalışma alanı yok.</p>}
          {matches.map((item) => (
            <button key={item.id} type="button" onClick={() => choose(item.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--revint-hover)]">
              {item.name} <span className="text-[var(--revint-text-3)]">{item.slug}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
