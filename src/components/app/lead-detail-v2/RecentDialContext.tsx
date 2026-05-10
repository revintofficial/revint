"use client";

/**
 * RecentDialContext — Phase 3 helper.
 *
 * Tracks "rep tapped Dial in this session" timestamps per leadId so
 * the DispositionStrip can decide whether to overlay a 4-chip capture
 * UI. localStorage-backed because the rep often dials, leaves the
 * tab, and comes back within minutes — we don't want the strip to
 * disappear just because the React state was lost.
 *
 * Storage shape: `leadac_recent_dial_<leadId>` → ISO timestamp string.
 * Keys are namespaced to avoid colliding with future product surfaces.
 *
 * The provider also reads the optional aggregator-supplied
 * `serverRecentDialAt` so a freshly-loaded device (or another browser)
 * still gets the overlay if a recent dial was logged via `log-call`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_PREFIX = "leadac_recent_dial_";
export const RECENT_DIAL_WINDOW_MS = 5 * 60 * 1000;

export interface RecentDialState {
  lastDialAt: Date | null;
  isRecent: boolean;
}

export interface RecentDialContextValue {
  markDialed: (leadId: string) => void;
  recentDialFor: (leadId: string) => RecentDialState;
  clearRecent: (leadId: string) => void;
}

const NOOP: RecentDialContextValue = {
  markDialed: () => undefined,
  recentDialFor: () => ({ lastDialAt: null, isRecent: false }),
  clearRecent: () => undefined,
};

const RecentDialContext = createContext<RecentDialContextValue>(NOOP);

interface ProviderProps {
  children: ReactNode;
  /**
   * Optional server-side fallback (e.g. aggregator's `recentDialAt`).
   * Hydrates `recent[leadId]` if localStorage is empty so the overlay
   * still shows on a fresh device within the 5-min window.
   */
  serverRecentDialFor?: { leadId: string; iso: string | null };
}

function readFromStorage(leadId: string): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + leadId);
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(leadId: string, value: Date | null) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      window.localStorage.removeItem(STORAGE_PREFIX + leadId);
    } else {
      window.localStorage.setItem(STORAGE_PREFIX + leadId, value.toISOString());
    }
  } catch {
    // Quota / private mode — silently degrade. The provider still
    // works in-memory for the lifetime of this session.
  }
}

export function RecentDialProvider({ children, serverRecentDialFor }: ProviderProps) {
  const [recent, setRecent] = useState<Record<string, Date | null>>({});

  // Hydrate from the server-supplied timestamp lazily inside
  // `recentDialFor` rather than via a setState-in-effect — that pattern
  // is flagged by `react-hooks/set-state-in-effect` and is unnecessary
  // here because the server value is derived state, not authoritative
  // state.
  const markDialed = useCallback((leadId: string) => {
    const now = new Date();
    writeToStorage(leadId, now);
    setRecent((prev) => ({ ...prev, [leadId]: now }));
  }, []);

  const clearRecent = useCallback((leadId: string) => {
    writeToStorage(leadId, null);
    setRecent((prev) => ({ ...prev, [leadId]: null }));
  }, []);

  const recentDialFor = useCallback(
    (leadId: string): RecentDialState => {
      const fromState = recent[leadId];
      let lastDialAt: Date | null;
      if (fromState !== undefined) {
        lastDialAt = fromState;
      } else {
        const fromStorage = readFromStorage(leadId);
        const fromServer =
          serverRecentDialFor &&
          serverRecentDialFor.leadId === leadId &&
          serverRecentDialFor.iso
            ? new Date(serverRecentDialFor.iso)
            : null;
        const candidate =
          fromStorage && fromServer
            ? fromStorage.getTime() >= fromServer.getTime()
              ? fromStorage
              : fromServer
            : (fromStorage ?? fromServer);
        lastDialAt = candidate ?? null;
        if (lastDialAt && Number.isNaN(lastDialAt.getTime())) {
          lastDialAt = null;
        }
      }
      if (!lastDialAt) return { lastDialAt: null, isRecent: false };
      const isRecent = Date.now() - lastDialAt.getTime() < RECENT_DIAL_WINDOW_MS;
      return { lastDialAt, isRecent };
    },
    [recent, serverRecentDialFor],
  );

  const value = useMemo<RecentDialContextValue>(
    () => ({ markDialed, recentDialFor, clearRecent }),
    [markDialed, recentDialFor, clearRecent],
  );

  return (
    <RecentDialContext.Provider value={value}>
      {children}
    </RecentDialContext.Provider>
  );
}

export function useRecentDial(): RecentDialContextValue {
  return useContext(RecentDialContext);
}
