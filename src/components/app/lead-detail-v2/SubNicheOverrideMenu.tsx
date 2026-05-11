"use client";

/**
 * SubNicheOverrideMenu — Phase 2.5.
 *
 * Triggered from a kebab item in `HeaderBar` (the "Override sub-
 * niche" entry). Opens a Radix popover with:
 *   - the current sub-niche label + override source (AUTO / MANUAL)
 *   - a list of alternatives (slug + confidence + reason)
 *   - a search box to pick any sub-niche from the niche pack
 *     catalogue (lazy-fetched from `GET /api/leads/sub-niches` on
 *     popover open — no first-paint cost)
 *
 * On save, calls `PATCH /api/leads/[id]/sub-niche` (existing route)
 * and revalidates the parent SWR via the `onSaved` callback so the
 * `decision-surface` query refetches with the new sub-niche state.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SubNicheStateDto } from "@/lib/lead-detail/use-decision-surface";

interface SubNicheCatalogItem {
  slug: string;
  label: string;
}

export interface SubNicheOverrideMenuCopy {
  triggerLabel: string;
  currentLabel: string;
  alternativesLabel: string;
  catalogLabel: string;
  searchPlaceholder: string;
  saveLabel: string;
  saving: string;
  savedLabel: string;
  errorLabel: string;
  loadingCatalog: string;
  noAlternatives: string;
  source: { AUTO: string; MANUAL: string; OVERRIDE: string };
}

export interface SubNicheOverrideMenuProps {
  leadId: string;
  state: SubNicheStateDto | null;
  /** Called after a successful save. Parent should revalidate
   * `useDecisionSurface` so the new override surfaces. */
  onSaved?: () => void;
  /** Optional controlled open state — when provided the component
   * does not render its own trigger button and the parent (e.g. the
   * `HeaderBar` kebab) drives the popover open/close. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  copy: SubNicheOverrideMenuCopy;
}

export function SubNicheOverrideMenu({
  leadId,
  state,
  onSaved,
  open: openProp,
  onOpenChange,
  copy,
}: SubNicheOverrideMenuProps): ReactNode {
  const isControlled = openProp !== undefined;
  const [openInternal, setOpenInternal] = useState(false);
  const open = isControlled ? openProp : openInternal;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setOpenInternal(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );
  const [catalog, setCatalog] = useState<SubNicheCatalogItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lazy-fetch catalogue when the popover opens for the first time.
  useEffect(() => {
    if (!open || catalog != null || catalogLoading) return;
    setCatalogLoading(true);
    fetch("/api/leads/sub-niches")
      .then(async (res) => {
        if (!res.ok) throw new Error(`status_${res.status}`);
        const json = (await res.json()) as { items?: SubNicheCatalogItem[] };
        setCatalog(json.items ?? []);
      })
      .catch(() => {
        setCatalog([]);
        setError(copy.errorLabel);
      })
      .finally(() => setCatalogLoading(false));
  }, [open, catalog, catalogLoading, copy.errorLabel]);

  const onPick = useCallback(
    async (slug: string) => {
      setSavingSlug(slug);
      setError(null);
      try {
        const res = await fetch(`/api/leads/${leadId}/sub-niche`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subNicheSlug: slug }),
        });
        if (!res.ok) throw new Error(`status_${res.status}`);
        onSaved?.();
        setOpen(false);
      } catch {
        setError(copy.errorLabel);
      } finally {
        setSavingSlug(null);
      }
    },
    [leadId, onSaved, copy.errorLabel],
  );

  const filteredCatalog =
    catalog?.filter(
      (c) =>
        !search ||
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  const sourceLabel =
    state?.override.source === "AUTO"
      ? copy.source.AUTO
      : state?.override.source === "MANUAL"
        ? copy.source.MANUAL
        : state?.override.source != null
          ? copy.source.OVERRIDE
          : copy.source.AUTO;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {isControlled ? (
        // In controlled mode the parent owns the trigger surface;
        // we still need an anchor for Radix's positioning so render
        // an invisible 0×0 anchor at the same DOM location the menu
        // would otherwise live at.
        <PopoverTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none inline-block h-0 w-0"
          />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="sub-niche-override-trigger"
            className="rounded-md border border-white/10 bg-white/3 px-2 py-1 text-[11px] hover:bg-white/8"
            style={{ color: "var(--leadac-text-2)" }}
          >
            {copy.triggerLabel}
          </button>
        </PopoverTrigger>
      )}
      <PopoverContent
        align="end"
        className="w-80 space-y-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.currentLabel}
          </span>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {state?.current.label ?? state?.current.slug ?? "—"}
            <span
              className="ml-2 text-[10px]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              ({sourceLabel})
            </span>
          </p>
        </div>

        {state && state.alternatives.length > 0 ? (
          <div>
            <span
              className="text-[10px] uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.alternativesLabel}
            </span>
            <ul className="mt-1 space-y-1">
              {state.alternatives.map((a) => (
                <li key={a.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(a.slug)}
                    disabled={savingSlug != null}
                    className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/3 px-2 py-1 text-left text-[11px] hover:bg-white/8 disabled:opacity-60"
                    style={{ color: "var(--leadac-text-2)" }}
                  >
                    <span>
                      <span style={{ color: "var(--leadac-text-1)" }}>
                        {a.slug}
                      </span>
                      {a.confidence != null ? (
                        <span
                          className="ml-2 text-[10px]"
                          style={{ color: "var(--leadac-text-3)" }}
                        >
                          {Math.round(a.confidence * 100)}%
                        </span>
                      ) : null}
                    </span>
                    <span style={{ color: "var(--leadac-text-3)" }}>
                      {savingSlug === a.slug ? copy.saving : copy.saveLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            className="text-[11px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.noAlternatives}
          </div>
        )}

        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.catalogLabel}
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/3 px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-(--leadac-500)/55"
            style={{ color: "var(--leadac-text-1)" }}
          />
          {catalogLoading ? (
            <div
              className="mt-2 text-[11px]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.loadingCatalog}
            </div>
          ) : filteredCatalog.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {filteredCatalog.slice(0, 30).map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(c.slug)}
                    disabled={savingSlug != null}
                    className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/3 px-2 py-1 text-left text-[11px] hover:bg-white/8 disabled:opacity-60"
                    style={{ color: "var(--leadac-text-2)" }}
                  >
                    <span style={{ color: "var(--leadac-text-1)" }}>
                      {c.label}
                    </span>
                    <span style={{ color: "var(--leadac-text-3)" }}>
                      {savingSlug === c.slug ? copy.saving : copy.saveLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <div
            className="text-[11px]"
            style={{ color: "var(--leadac-error)" }}
          >
            {error}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
