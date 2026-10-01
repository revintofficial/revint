import type { ReviewLens } from "@/generated/prisma/client";
import { orderDrawers, type Drawer, type ShelfCell } from "@/lib/control/evidence-shelf";

/**
 * Evidence shelf: four drawers, claim on the left, its source on the right.
 * Order follows the lens; the first two drawers open, the rest stay folded
 * but never disappear. Conflict lines sit on top of their drawer.
 */
export function EvidenceShelf({ drawers, lens }: { drawers: Drawer[]; lens: ReviewLens | null }) {
  const ordered = orderDrawers(drawers, lens);
  return (
    <div className="space-y-3" aria-label="Kanıt rafı">
      {ordered.map((drawer, index) => (
        <DrawerView key={drawer.key} drawer={drawer} open={index < 2} />
      ))}
    </div>
  );
}

function DrawerView({ drawer, open }: { drawer: Drawer; open: boolean }) {
  const conflicts = drawer.rows.map(r => r.conflict).filter((c): c is string => Boolean(c));
  const rightHeading = drawer.key === "decision" ? "Oda 1 (kural çıktısı)" : "Dayanak";
  return (
    <details
      open={open}
      data-testid="shelf-drawer"
      data-drawer={drawer.key}
      className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-surface)]"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm font-medium text-[var(--revint-text-1)]">{drawer.label}</span>
        <span className="text-xs text-[var(--revint-text-3)]">
          {drawer.empty ? "Kayıt yok" : conflicts.length ? `${conflicts.length} çelişki` : "Çelişki yok"}
        </span>
      </summary>
      <div className="space-y-2 border-t border-[var(--revint-border)] px-3 py-3">
        {conflicts.length > 0 && (
          <ul className="space-y-1">
            {conflicts.map((conflict, i) => (
              <li key={i} className="rounded-lg border border-[var(--revint-warning)] px-2 py-1 text-sm text-[var(--revint-warning)]">
                Çelişki: {conflict}
              </li>
            ))}
          </ul>
        )}
        <div className="hidden grid-cols-2 gap-3 text-xs uppercase tracking-wider text-[var(--revint-text-3)] sm:grid">
          <span>İddia</span>
          <span>{rightHeading}</span>
        </div>
        <ul className="space-y-2">
          {drawer.rows.map((row, i) => (
            <li
              key={i}
              className={`grid gap-1 rounded-lg border px-2 py-2 sm:grid-cols-2 sm:gap-3 ${row.conflict ? "border-[var(--revint-warning)]" : "border-[var(--revint-border)]"}`}
            >
              <Cell cell={row.claim} />
              <Cell cell={row.support} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Cell({ cell }: { cell: ShelfCell }) {
  return (
    <span className={`whitespace-pre-wrap break-words text-sm ${cell.muted ? "text-[var(--revint-text-3)]" : "text-[var(--revint-text-1)]"}`}>
      {cell.text}
    </span>
  );
}
