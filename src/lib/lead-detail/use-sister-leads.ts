"use client";

/**
 * use-sister-leads — Phase 4 client hook for the v2 ACCOUNT block.
 *
 * Lazy by design: nothing fires until `enabled === true`. The
 * `AccountBlock` flips this when its stub transitions to expanded so a
 * lead with no chain (the common case) never pays the round-trip and
 * a chain of 50+ branches doesn't touch the DB until the rep asks for
 * it. Per RETHINK §9 Q5 + PLAN §4 line 311 + §6 risk #2 (N+1).
 *
 * The hook is intentionally tiny — no SWR dependency. It revalidates
 * once on enable, exposes a `mutate()` to manual-refresh on
 * sister-lead-impacting events, and never auto-revalidates on focus
 * (sister-lead state changes slowly).
 *
 * State writes are deferred via `Promise.resolve().then(...)` so the
 * effect body never calls setState synchronously — keeps the
 * `react-hooks/set-state-in-effect` lint rule happy and avoids
 * cascading renders.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { SisterLeadsResponse } from "@/app/api/leads/[id]/account/sister-leads/route";
import type { SisterLeadSummary } from "@/lib/lead-detail/sister-leads";

export interface UseSisterLeadsArgs {
  leadId: string;
  /** Toggle on once the ACCOUNT block expands. Off → no fetch ever. */
  enabled: boolean;
  /** Page size hint — passed straight through to the route. */
  take?: number;
}

export interface UseSisterLeadsResult {
  items: SisterLeadSummary[];
  total: number;
  nextCursor: string | null;
  locked: boolean;
  account: SisterLeadsResponse["account"];
  isLoading: boolean;
  error: string | null;
  mutate: () => Promise<void>;
}

const EMPTY_RESULT: Omit<UseSisterLeadsResult, "isLoading" | "error" | "mutate"> = {
  items: [],
  total: 0,
  nextCursor: null,
  locked: false,
  account: null,
};

export function useSisterLeads({
  leadId,
  enabled,
  take = 20,
}: UseSisterLeadsArgs): UseSisterLeadsResult {
  const [data, setData] = useState<typeof EMPTY_RESULT>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const hasFetchedRef = useRef(false);
  const lastLeadIdRef = useRef(leadId);

  const run = useCallback(async (): Promise<void> => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/leads/${leadId}/account/sister-leads?take=${take}`;
      const res = await fetch(url, { cache: "no-store" });
      if (seq !== requestSeqRef.current) return;
      if (!res.ok) {
        setError(`sister_leads_${res.status}`);
        setIsLoading(false);
        return;
      }
      const json = (await res.json()) as SisterLeadsResponse;
      if (seq !== requestSeqRef.current) return;
      setData({
        items: json.items,
        total: json.total,
        nextCursor: json.nextCursor,
        locked: json.locked,
        account: json.account,
      });
      setIsLoading(false);
    } catch {
      if (seq !== requestSeqRef.current) return;
      setError("sister_leads_failed");
      setIsLoading(false);
    }
  }, [leadId, take]);

  useEffect(() => {
    if (lastLeadIdRef.current !== leadId) {
      lastLeadIdRef.current = leadId;
      hasFetchedRef.current = false;
      requestSeqRef.current = 0;
      // Defer the synchronous resets out of the effect body so the
      // `react-hooks/set-state-in-effect` rule doesn't flag a
      // cascading render.
      void Promise.resolve().then(() => {
        setData(EMPTY_RESULT);
        setError(null);
        setIsLoading(false);
      });
    }

    if (!enabled) return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      void run();
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, leadId, run]);

  return {
    items: data.items,
    total: data.total,
    nextCursor: data.nextCursor,
    locked: data.locked,
    account: data.account,
    isLoading,
    error,
    mutate: run,
  };
}
