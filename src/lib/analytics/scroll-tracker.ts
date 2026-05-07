/**
 * Scroll depth tracker.
 *
 * Emits at 25/50/75/100% milestones (each fires at most once per page)
 * and exposes the current max scroll percentage so the page-leave
 * event can persist it. RAF-throttled so a long page with a manic
 * scrollwheel doesn't burn CPU.
 *
 * The tracker is path-scoped: call `start(path)` on every navigation,
 * `stop()` on unmount or before the next start. This prevents
 * milestones leaking across SPA navigations.
 */

const MILESTONES: readonly number[] = [25, 50, 75, 100];

export type ScrollMilestoneListener = (pct: number, path: string) => void;

interface ScrollTrackerHandle {
  /** Best-known max scroll percentage (0..100) for the current path. */
  getMaxPct: () => number;
  /** Milestones reached so far on the current path. */
  getMilestones: () => number[];
  /** Detach listeners and reset state. Idempotent. */
  stop: () => void;
}

function currentScrollPct(): number {
  if (typeof window === "undefined") return 0;
  const doc = document.documentElement;
  const body = document.body;
  const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
  const viewport = window.innerHeight || doc.clientHeight || 0;
  const total =
    Math.max(
      doc.scrollHeight,
      doc.offsetHeight,
      body.scrollHeight,
      body.offsetHeight,
    ) || 0;
  const scrollable = total - viewport;
  if (scrollable <= 0) {
    // Page fits in the viewport — count as fully read.
    return 100;
  }
  const pct = (scrollTop / scrollable) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function startScrollTracker(
  path: string,
  onMilestone: ScrollMilestoneListener,
): ScrollTrackerHandle {
  if (typeof window === "undefined") {
    return {
      getMaxPct: () => 0,
      getMilestones: () => [],
      stop: () => {},
    };
  }

  let maxPct = currentScrollPct();
  const reached = new Set<number>();
  let rafQueued = false;

  // Fire any milestones already crossed at mount (long page, hard
  // reload that restored scroll position).
  for (const m of MILESTONES) {
    if (maxPct >= m && !reached.has(m)) {
      reached.add(m);
      onMilestone(m, path);
    }
  }

  const evaluate = () => {
    rafQueued = false;
    const pct = currentScrollPct();
    if (pct > maxPct) maxPct = pct;
    for (const m of MILESTONES) {
      if (maxPct >= m && !reached.has(m)) {
        reached.add(m);
        onMilestone(m, path);
      }
    }
  };

  const onScroll = () => {
    if (rafQueued) return;
    rafQueued = true;
    window.requestAnimationFrame(evaluate);
  };

  const onResize = onScroll;

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  return {
    getMaxPct: () => maxPct,
    getMilestones: () => Array.from(reached).sort((a, b) => a - b),
    stop: () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}
