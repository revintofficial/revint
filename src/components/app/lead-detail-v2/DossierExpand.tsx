"use client";

/**
 * DossierExpand — Phase 2.5.
 *
 * "AI dossier →" button rendered inside `DiscoveryBlock`. On click
 * it lazy-fetches:
 *   - `POST /api/leads/[id]/explain`  → markdown body
 *   - `GET /api/leads/[id]/dossier-sources` → source drawer
 *
 * Re-skin of the legacy `DossierMarkdown` + `DossierSection`. The
 * `dossierStub` payload from `decision-surface` decides whether the
 * button shows at all (no cached run = no expand).
 *
 * Since the markdown can be large (5-15kb), this defers the entire
 * payload until the rep clicks. Rendered markdown stays inside the
 * expanded panel so collapsing the discovery block also unmounts
 * the markdown DOM (no memory creep on long sessions).
 */

import { useCallback, useState, type ReactNode } from "react";

import type { DossierStubDto } from "@/lib/lead-detail/use-decision-surface";

interface DossierSource {
  url: string;
  title: string | null;
  excerpt: string | null;
}

export interface DossierExpandCopy {
  triggerLabel: string;
  loading: string;
  error: string;
  collapsed: string;
  expanded: string;
  sourcesHeading: string;
  noSources: string;
  generatedAt: string;
  snippetLabel: string;
}

export interface DossierExpandProps {
  leadId: string;
  stub: DossierStubDto;
  copy: DossierExpandCopy;
}

export function DossierExpand({
  leadId,
  stub,
  copy,
}: DossierExpandProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [sources, setSources] = useState<DossierSource[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const onToggle = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (markdown != null) return; // already loaded
    setLoading(true);
    setError(false);
    try {
      const [explainRes, sourcesRes] = await Promise.all([
        fetch(`/api/leads/${leadId}/explain`, { method: "POST" }),
        fetch(`/api/leads/${leadId}/dossier-sources`),
      ]);
      if (!explainRes.ok) throw new Error(`explain_${explainRes.status}`);
      const explainJson = (await explainRes.json()) as { markdown?: string };
      setMarkdown(explainJson.markdown ?? "");
      if (sourcesRes.ok) {
        const sourcesJson = (await sourcesRes.json()) as {
          sources?: DossierSource[];
        };
        setSources(sourcesJson.sources ?? []);
      } else {
        setSources([]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [open, markdown, leadId]);

  if (!stub.hasDossier) return null;

  const generatedDate = stub.lastGeneratedAt
    ? new Date(stub.lastGeneratedAt)
    : null;
  const generatedLabel =
    generatedDate && !Number.isNaN(generatedDate.getTime())
      ? generatedDate.toLocaleDateString()
      : null;

  return (
    <div data-testid="dossier-expand" className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-2 text-[12px] underline"
        style={{ color: "var(--leadac-info)" }}
      >
        {open ? copy.expanded : copy.triggerLabel}
      </button>

      {!open && stub.summarySnippet ? (
        <p
          className="text-[12px] leading-snug"
          style={{ color: "var(--leadac-text-2)" }}
        >
          <span
            className="mr-1 text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.snippetLabel}
          </span>
          {stub.summarySnippet}
        </p>
      ) : null}

      {open ? (
        <div
          data-testid="dossier-expand-body"
          className="rounded-lg border border-white/8 bg-white/3 p-3"
        >
          {loading ? (
            <div
              className="text-[12px]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.loading}
            </div>
          ) : error ? (
            <div
              className="text-[12px]"
              style={{ color: "var(--leadac-error)" }}
            >
              {copy.error}
            </div>
          ) : (
            <>
              {markdown ? (
                <pre
                  className="whitespace-pre-wrap text-[12px] leading-snug"
                  style={{ color: "var(--leadac-text-1)" }}
                >
                  {markdown}
                </pre>
              ) : null}
              {generatedLabel ? (
                <div
                  className="mt-2 text-[10px]"
                  style={{ color: "var(--leadac-text-3)" }}
                >
                  {copy.generatedAt} {generatedLabel}
                </div>
              ) : null}
              <div className="mt-3">
                <span
                  className="text-[10px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--leadac-text-3)" }}
                >
                  {copy.sourcesHeading}
                </span>
                {sources && sources.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {sources.slice(0, 8).map((s) => (
                      <li
                        key={s.url}
                        className="text-[11px]"
                        style={{ color: "var(--leadac-text-2)" }}
                      >
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                          style={{ color: "var(--leadac-info)" }}
                        >
                          {s.title ?? s.url}
                        </a>
                        {s.excerpt ? (
                          <p className="mt-0.5 line-clamp-2 leading-snug">
                            {s.excerpt}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    {copy.noSources}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
