import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ClosedLoopDiagram — ICP → discover → enrich → outreach → won/lost → ICP refine.
 *
 * brand-assets §7.2 cornerstone #9. Renders five nodes in a horizontal
 * flow on desktop, vertical stack on mobile, with the loop-back arrow
 * from "won/lost" to "ICP". Animation is purely static — the loop is the
 * shape, not a moving thing (humanizer no-motion preference).
 */

const STEPS: Array<{
  id: string;
  label: string;
  body: string;
}> = [
  {
    id: "icp",
    label: "ICP",
    body: "Define the vertical, geography, software signature, and outcome you want to learn.",
  },
  {
    id: "discover",
    label: "Discover",
    body: "Index local-business accounts matching the ICP — operational signals, not firmographics.",
  },
  {
    id: "enrich",
    label: "Enrich",
    body: "Write 12 fields per account into HubSpot. The brief lands inside the contact card.",
  },
  {
    id: "outreach",
    label: "Outreach",
    body: "SDR reads the brief, dials or sends. We hand off to Smartlead, Apollo, or your sequencer.",
  },
  {
    id: "outcome",
    label: "Won / lost",
    body: "Deal stages and lost reasons flow back via HubSpot webhooks within minutes.",
  },
];

type ClosedLoopDiagramProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
};

export function ClosedLoopDiagram({
  eyebrow,
  title = "The loop that closes — every won and lost deal sharpens the next list.",
  subtitle,
  className,
}: ClosedLoopDiagramProps) {
  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
          <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-4 text-[18px] leading-relaxed text-paper-2">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-5 lg:gap-2">
          {STEPS.map((step, i) => (
            <div key={step.id} className="relative">
              <div className="h-full rounded-xl border border-ink-3 bg-ink-1 p-5">
                <div className="site-eyebrow">{`0${i + 1}`}</div>
                <div className="mt-2 text-[18px] font-medium text-paper-0">
                  {step.label}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-paper-2">
                  {step.body}
                </p>
              </div>
              {i < STEPS.length - 1 ? (
                <div
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden -translate-y-1/2 lg:block"
                >
                  <ArrowRight className="h-5 w-5 text-paper-3" />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-ink-3 bg-ink-1 px-4 py-2 text-[13px] text-paper-2">
            <span className="site-signal-dot" />
            Loop closes — outcome feeds discovery within 5 minutes.
          </div>
        </div>
      </div>
    </section>
  );
}
