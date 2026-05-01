/**
 * `useDossierSources` — fetches the dossier-sources payload for a lead
 * once and memoises it in component state. Called by `DossierSection`
 * after the user generates a dossier; results power both the hover
 * popovers on each `SourceChip` and the side drawer's full-detail
 * body.
 *
 * Lazy by design — `enabled = false` skips the fetch entirely so we
 * don't hit the endpoint on leads where the dossier has never been
 * generated. Refetches when `leadId` changes; the page-level
 * `refetchLead` flow doesn't need to invalidate this hook because
 * dossier source data is read-only relative to the chips.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { DossierSourcesPayload } from "./source-registry";

interface UseDossierSourcesResult {
  sources: DossierSourcesPayload | null;
  loading: boolean;
  error: string | null;
  /** Force a re-fetch (e.g. after the user re-generates the dossier). */
  refetch: () => void;
}

export function useDossierSources(
  leadId: string,
  enabled: boolean,
): UseDossierSourcesResult {
  const [sources, setSources] = useState<DossierSourcesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const cancelRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    cancelRef.current = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/dossier-sources`, {
          // Always pull fresh — the endpoint is cheap (single Prisma
          // round-trip) and the dossier markdown is regenerated when
          // any underlying source changes anyway, so we want the chip
          // previews to match.
          cache: "no-store",
        });
        if (cancelRef.current) return;
        if (!res.ok) {
          if (res.status === 404) {
            setSources(null);
            setError(null);
          } else {
            const body = await res.json().catch(() => ({}));
            setError(body.error ?? `Failed to load sources (${res.status})`);
          }
          return;
        }
        const data = (await res.json()) as DossierSourcesPayload;
        if (cancelRef.current) return;
        setSources(data);
      } catch (err) {
        if (cancelRef.current) return;
        // Network failures surface in the chip popover footer as a
        // muted "—" preview; the dossier itself stays readable.
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        if (!cancelRef.current) setLoading(false);
      }
    })();
    return () => {
      cancelRef.current = true;
    };
  }, [leadId, enabled, tick]);

  return {
    sources,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
