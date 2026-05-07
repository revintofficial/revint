"use client";

import { useEffect, useState } from "react";

/**
 * Live visitor counter. Polls /api/admin/live every 10 seconds.
 * The endpoint itself is Redis-cached for 10s so a panel left open
 * for hours stays cheap.
 */
export function LiveCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/admin/live", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const j = (await res.json()) as { active: number };
        if (!cancelled) {
          setCount(j.active);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void fetchOnce();
    const t = window.setInterval(fetchOnce, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={
          error
            ? "h-2 w-2 rounded-full bg-[var(--leadac-error)]"
            : count && count > 0
              ? "h-2 w-2 rounded-full bg-[var(--leadac-success)] animate-pulse"
              : "h-2 w-2 rounded-full bg-[var(--leadac-text-3)]"
        }
      />
      <span className="text-[var(--leadac-text-2)]">
        {error
          ? "live offline"
          : count === null
            ? "live --"
            : `${count} active now`}
      </span>
    </div>
  );
}
