import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PreCallBriefCard — visual that mimics the brief rendered inside a
 * HubSpot card. Used in homepage hero visual + /integrations/hubspot.
 *
 * Static SVG/HTML mock — no live HubSpot connection needed. The shape is
 * the marketing asset.
 */

type SignalRow = { label: string; value: string };

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
  className?: string;
};

export function PreCallBriefCard({
  account,
  tag,
  context,
  signals,
  opener,
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
            LeadAC brief · inside HubSpot
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

        <div className="mt-5 rounded-md border border-signal/30 bg-[hsl(38_60%_15%_/_0.3)] p-4">
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
