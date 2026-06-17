import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PreCallBriefCard — visual that mimics the brief rendered inside a
 * HubSpot card. Used in homepage hero visual + /integrations/hubspot.
 *
 * Static SVG/HTML mock — no live HubSpot connection needed. The shape is
 * the marketing asset.
 *
 * The `nextAction` block is the first-class output that closes the gap
 * with Pocus / HockeyStack's "tell reps what to do next" framing — see
 * `src/content/site/keywords.ts` (WHITE_SPACE: "the next best revenue
 * action"). Always render it on the homepage hero card; optional on the
 * HubSpot integration page where the field map is the focus.
 */

type SignalRow = { label: string; value: string };

type NextAction = {
  /** Short verb-phrase, e.g. "Call the owner today" or "Hold for Q3 budget cycle". */
  label: string;
  /** One-sentence reason grounded in the signals above. */
  reason: string;
};

type PreCallBriefCardProps = {
  /** Account name shown at the top. */
  account: string;
  /** Vertical tag, e.g. "Restaurant tech · Multi-location". */
  tag: string;
  /** 3-line context paragraph. */
  context: string;
  /** Top signals — instrument-panel data cells. */
  signals: SignalRow[];
  /** Suggested opener — 2 sentences max. */
  opener: string;
  /** Recommended next action — first-class output, rendered above the opener. */
  nextAction?: NextAction;
  className?: string;
};

export function PreCallBriefCard({
  account,
  tag,
  context,
  signals,
  opener,
  nextAction,
  className,
}: PreCallBriefCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-ink-3 bg-ink-1 shadow-2xl",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-ink-3 bg-ink-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="site-signal-dot" />
          <div className="site-mono text-[12px] uppercase tracking-wider text-paper-2">
            Revint brief · inside HubSpot
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-paper-3" />
      </div>

      <div className="px-5 py-5">
        <div className="text-[18px] font-medium text-paper-0">{account}</div>
        <div className="site-mono mt-1 text-[12px] uppercase tracking-wider text-signal-soft">
          {tag}
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-paper-2">
          {context}
        </p>

        <div className="mt-5 grid gap-2">
          {signals.map((s) => (
            <div
              key={s.label}
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-ink-3 bg-ink-0 px-3 py-2"
            >
              <div className="text-[12px] uppercase tracking-wider text-paper-3">
                {s.label}
              </div>
              <div className="site-mono text-[13px] text-paper-0">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {nextAction ? (
          <div className="mt-5 rounded-md border border-signal/40 bg-signal/10 p-4">
            <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
              Recommended next action
            </div>
            <div className="mt-2 flex items-start gap-2 text-[15px] leading-snug text-paper-0">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              <span className="font-medium">{nextAction.label}</span>
            </div>
            <p className="mt-1 pl-6 text-[13px] leading-relaxed text-paper-2">
              {nextAction.reason}
            </p>
          </div>
        ) : null}

        <div className="mt-5 rounded-md border border-signal/25 bg-signal/6 p-4">
          <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
            Suggested opener
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-paper-0">
            &ldquo;{opener}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
