/**
 * Scroll heatmap bar. A horizontal bar with the four milestones
 * (25/50/75/100) marked, filled up to maxPct. Shows whether the
 * visitor reached the bottom of the page.
 */
export function ScrollHeatmap({
  maxPct,
  milestones,
}: {
  maxPct: number;
  milestones: number[];
}) {
  const reached = new Set(milestones);
  return (
    <div className="w-full">
      <div className="relative h-2 rounded-full bg-[var(--revint-hover)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--revint-500)]"
          style={{ width: `${Math.max(0, Math.min(100, maxPct))}%` }}
        />
        {[25, 50, 75, 100].map((m) => (
          <span
            key={m}
            className="absolute top-0 bottom-0 w-px bg-[var(--revint-bg)]/60"
            style={{ left: `${m}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-[var(--revint-text-3)]">
        {[25, 50, 75, 100].map((m) => (
          <span
            key={m}
            className={
              reached.has(m)
                ? "text-[var(--revint-text-1)]"
                : "text-[var(--revint-text-3)]/60"
            }
          >
            {m}%
          </span>
        ))}
      </div>
    </div>
  );
}
