import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LearnedPatternCard — makes the "memory" claim visible.
 *
 * The brief card shows the *output* (what the rep does). This card shows the
 * *evidence behind it*: a closed-won pattern Revint learned from the team's own
 * deals, with the sample size, win rate, and an evidence tier (T1–T4) from the
 * OI EvidenceSystem. Without this, the brief reads like an AI summary; with it,
 * the recommendation is visibly grounded in past revenue.
 *
 * Styled as the OI memory surface — light card, signal accent — to echo the
 * "OI · operational intelligence" tier in the StackLayersDiagram.
 */

type Stat = { label: string; value: string };

type LearnedPatternCardProps = {
  /** e.g. "Closed-won pattern #14". */
  patternId: string;
  /** The signal signature that defines the pattern. */
  signals: string[];
  /** Sample-size stats — accounts seen, won, lost, etc. */
  stats: Stat[];
  /** Win rate among decided deals, 0–100. */
  winRate: number;
  /** Evidence tier from the OI EvidenceSystem, e.g. "T3". */
  confidence: string;
  /** One line tying the pattern to revenue / next action. */
  footnote?: string;
  /** Slim variant for a library strip — drops the stats grid + footnote. */
  compact?: boolean;
  className?: string;
};

export function LearnedPatternCard({
  patternId,
  signals,
  stats,
  winRate,
  confidence,
  footnote,
  compact = false,
  className,
}: LearnedPatternCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-paper-0/15 bg-[linear-gradient(180deg,hsl(40_52%_99%/0.97),hsl(42_40%_94%/0.95))] text-paper-0 shadow-2xl",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-paper-0/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-paper-0/70" />
          <div className="site-mono text-[12px] uppercase tracking-wider text-paper-0/60">
            Revint memory · learned pattern
          </div>
        </div>
        <span className="site-mono rounded-full border border-paper-0/20 bg-paper-0/5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-paper-0/70">
          Evidence {confidence}
        </span>
      </div>

      <div className={cn("px-5 py-5", compact && "py-4")}>
        <div className="text-[18px] font-medium text-paper-0">{patternId}</div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {signals.map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full border border-paper-0/15 bg-paper-0/5 px-3 py-1 text-[12px] leading-none text-paper-0"
            >
              {s}
            </span>
          ))}
        </div>

        {!compact && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-paper-0/10 bg-paper-0/3 px-3 py-2 text-center"
              >
                <div className="site-mono text-[18px] text-paper-0">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-paper-0/55">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] uppercase tracking-wider text-paper-0/55">
              Win rate (decided)
            </span>
            <span className="site-mono text-[15px] font-medium text-paper-0">
              {winRate}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-0/10">
            <div
              className="h-full rounded-full bg-signal"
              style={{ width: `${Math.max(0, Math.min(100, winRate))}%` }}
            />
          </div>
        </div>

        {!compact && footnote && (
          <p className="mt-4 text-[13px] leading-relaxed text-paper-0/70">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
