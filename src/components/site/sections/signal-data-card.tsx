import { cn } from "@/lib/utils";

/**
 * SignalDataCard — single instrument-panel data cell.
 *
 * The smallest visual primitive in the site. Used inside other sections
 * (homepage proof row, vertical signal list) and on the homepage as a
 * decorative element next to the hero.
 *
 * Shape: 6 px color bar + label (uppercase mono) + monospace value +
 * optional one-line note. Matches the .site-data-cell CSS recipe.
 */

type SignalDataCardProps = {
  label: string;
  /** The actual number, e.g. "200 accounts/hr". */
  value: string;
  /** Optional caption below the value. */
  note?: string;
  /** Color override — default is signal amber. */
  tone?: "signal" | "success" | "warning" | "error" | "info";
  className?: string;
};

const TONE_COLOR: Record<NonNullable<SignalDataCardProps["tone"]>, string> = {
  signal: "var(--signal)",
  success: "var(--site-success)",
  warning: "var(--site-warning)",
  error: "var(--site-error)",
  info: "var(--site-info)",
};

export function SignalDataCard({
  label,
  value,
  note,
  tone = "signal",
  className,
}: SignalDataCardProps) {
  return (
    <div className={cn("site-data-cell", className)}>
      <div
        className="site-data-cell__color"
        style={{ background: `hsl(${TONE_COLOR[tone]})` }}
      />
      <div>
        <div className="site-data-cell__label">{label}</div>
        <div className="site-data-cell__value mt-1">{value}</div>
        {note ? (
          <div className="mt-1 text-[12px] text-paper-2">{note}</div>
        ) : null}
      </div>
    </div>
  );
}
