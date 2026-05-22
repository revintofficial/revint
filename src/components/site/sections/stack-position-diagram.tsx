import { cn } from "@/lib/utils";
import { STACK_LINE } from "@/content/site/competitors";

/**
 * StackPositionDiagram — "Apollo finds. Clay enriches. Gong records. LeadAC remembers."
 *
 * brand-assets §2.9 ships this as the conference sticker line. Rendered as
 * 4 columns with the verbs in mono so the line reads as the instrument
 * panel label set. LeadAC's column carries the signal-amber lamp dot.
 */

type StackPositionDiagramProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
};

export function StackPositionDiagram({
  eyebrow,
  title,
  subtitle,
  className,
}: StackPositionDiagramProps) {
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

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink-3 bg-ink-3 md:grid-cols-4">
          {STACK_LINE.map((step) => {
            const isLeadac = step.slug === "leadac";
            const label =
              step.slug === "leadac"
                ? "LeadAC"
                : step.slug.charAt(0).toUpperCase() + step.slug.slice(1);
            return (
              <div
                key={step.slug}
                className={cn(
                  "p-6 md:p-7",
                  isLeadac ? "bg-ink-2" : "bg-ink-1",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      isLeadac ? "site-signal-dot" : "bg-paper-3",
                    )}
                  />
                  <div className="text-[15px] font-medium text-paper-0">
                    {label}
                  </div>
                </div>
                <div className="site-mono mt-4 text-[24px] uppercase tracking-tight text-paper-0">
                  {step.verb}.
                </div>
                <div className="mt-3 text-[13px] text-paper-2">
                  {isLeadac
                    ? "Operational memory: what closes, in your CRM."
                    : step.slug === "apollo"
                      ? "Contact list, firmographic match."
                      : step.slug === "clay"
                        ? "Workflow + enrichment chain."
                        : "Call recordings + deal forecast."}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
