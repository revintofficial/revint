"use client";

/**
 * use-lead-queue — Phase 3 client hook.
 *
 * Tiny SWR-shaped hook that fetches `/api/leads/queue?take=3` once on
 * mount and exposes a `mutate()` callback so the queue strip can be
 * invalidated by SnoozeMenu / DispositionStrip on success. Keeps the
 * polling cadence to manual refresh — the server-side queue is the
 * single source of truth and the rep's interactions are point-in-time
 * actions, not a continuous stream.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface QueueItem {
  id: string;
  name: string;
  accountTier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  whyNow: string | null;
  nextActionEtaSeconds: number | null;
  salesConfidence: number | null;
  nextActionDueAt: string | null;
}

export interface QueueState {
  items: QueueItem[];
  totalToday: number;
  doneToday: number;
  locked: boolean;
  isLoading: boolean;
  error: string | null;
  mutate: () => void;
}

interface QueueResponse {
  items: QueueItem[];
  totalToday: number;
  doneToday: number;
  locked: boolean;
}

const EMPTY_QUEUE: Omit<QueueState, "mutate"> = {
  items: [],
  totalToday: 0,
  doneToday: 0,
  locked: false,
  isLoading: true,
  error: null,
};

export function useLeadQueue(take = 3): QueueState {
  const [state, setState] = useState<Omit<QueueState, "mutate">>(EMPTY_QUEUE);
  const ticker = useRef(0);
  const requestedTake = useRef(take);

  useEffect(() => {
    requestedTake.current = take;
  }, [take]);

  const fetchOnce = useCallback(async () => {
    const generation = ++ticker.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch(
        `/api/leads/queue?take=${requestedTake.current}`,
        { cache: "no-store" },
      );
      if (generation !== ticker.current) return;
      if (!res.ok) {
        setState({
          items: [],
          totalToday: 0,
          doneToday: 0,
          locked: false,
          isLoading: false,
          error: `queue_${res.status}`,
        });
        return;
      }
      const json = (await res.json()) as QueueResponse;
      if (generation !== ticker.current) return;
      setState({
        items: json.items,
        totalToday: json.totalToday,
        doneToday: json.doneToday,
        locked: json.locked,
        isLoading: false,
        error: null,
      });
    } catch {
      if (generation !== ticker.current) return;
      setState({
        items: [],
        totalToday: 0,
        doneToday: 0,
        locked: false,
        isLoading: false,
        error: "queue_failed",
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOnce();
    return () => {
      ticker.current += 1;
    };
  }, [fetchOnce]);

  const mutate = useCallback(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { ...state, mutate };
}
