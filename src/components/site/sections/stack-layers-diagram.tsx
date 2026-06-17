import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StackLayersDiagram — the architectural picture of where Revint sits.
 *
 * Structure inspired by Clari's "AI + Revenue Context" diagram (stacked
 * tiered cards on a dark canvas) with Apple's typographic restraint
 * (sentence case, generous tracking, single accent color, light weights).
 *
 * The layers mirror Revint's real bounded-context architecture (see the
 * Notion architecture hub: SI / OI / CH). Top to bottom, output first,
 * raw sources last — data flows UP the stack:
 *
 *   1. Output  — the Account Intelligence Brief, inside the HubSpot card.
 *   2. OI      — Operational Intelligence. Learns what actually closed and
 *                makes every claim carry its evidence. (Revint core.)
 *   3. SI      — Sales Intelligence. AI workers read each account and turn
 *                operational signals into a sales angle. (Revint core.)
 *   4. Sources — your CRM and the data rails you already run.
 *
 * Reads tokens from globals.css so it re-skins automatically when the
 * `--revint-h` / `--signal` knobs change.
 */

type LayerKind = "output" | "oi" | "si" | "sources";

type Layer = {
  kind: LayerKind;
  label: string;
  caption: string;
  pills: string[];
};

const LAYERS: Layer[] = [
  {
    kind: "output",
    label: "Account Intelligence Brief",
    caption: "The single source of truth, inside the HubSpot card before the dial.",
    pills: [
      "Fit score",
      "Recommended angle",
      "Next best action",
      "No-show risk",
    ],
  },
  {
    kind: "oi",
    label: "Learns what actually closes",
    caption:
      "Scores every account against the deals you won, then makes each claim carry its evidence.",
    pills: [
      "Winning patterns",
      "Evidence chain (T1–T4)",
      "Playbook learning",
      "QA gate",
    ],
  },
  {
    kind: "si",
    label: "Reads every account's signals",
    caption:
      "AI workers audit the site, reviews, search, and socials, then turn the friction into a sales angle.",
    pills: [
      "Website audit",
      "Review analysis",
      "SERP",
      "Social",
      "ICP score",
      "Sales angle",
    ],
  },
  {
    kind: "sources",
    label: "Your CRM and the data you bring",
    caption: "HubSpot is live now; Apollo, Clay, Openmart and the rest sit alongside it.",
    pills: ["HubSpot", "Apollo", "Clay", "Openmart", "Reviews", "Google"],
  },
];

type StackLayersDiagramProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
};

export function StackLayersDiagram({
  eyebrow,
  title,
  subtitle,
  className,
}: StackLayersDiagramProps) {
  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
          <h2 className="text-[34px] font-light leading-[1.05] tracking-[-0.03em] text-paper-0 md:text-[56px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-paper-2 md:text-[19px]">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="absolute -inset-x-6 -inset-y-8 rounded-[36px] bg-[radial-gradient(ellipse_at_top,hsl(218_85%_58%/0.12),transparent_62%)]" />

          <div className="relative rounded-[28px] border border-ink-3 bg-[hsl(220_10%_5%/0.6)] p-3 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm md:p-4">
            <div className="rounded-[22px] border border-ink-3/70 bg-ink-1 p-3 md:p-5">
              <div className="mb-4 flex items-center justify-center gap-2 md:mb-5">
                <span className="site-signal-dot" />
                <span className="site-mono text-[11px] uppercase tracking-[0.18em] text-paper-2">
                  Operational revenue intelligence stack
                </span>
              </div>

              <div className="flex flex-col">
                {LAYERS.map((layer, i) => (
                  <div key={layer.kind}>
                    <LayerRow layer={layer} />
                    {i < LAYERS.length - 1 ? <FlowConnector /> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Faint upward connector between tiers — signals that data flows up the
 * stack, from the raw rails at the bottom to the rep-facing outputs on top.
 */
function FlowConnector() {
  return (
    <div className="flex justify-center" aria-hidden>
      <div className="flex flex-col items-center py-1">
        <span className="h-3 w-px bg-linear-to-t from-transparent to-signal/45 md:h-4" />
        <ArrowUp className="-mt-px h-3 w-3 text-signal/55" />
        <span className="h-3 w-px bg-linear-to-b from-transparent to-signal/45 md:h-4" />
      </div>
    </div>
  );
}

function LayerRow({ layer }: { layer: Layer }) {
  const variant = LAYER_VARIANTS[layer.kind];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border px-5 py-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)] md:px-7 md:py-6",
        variant.surface,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 md:max-w-[42%]">
          <div
            className={cn(
              "site-mono text-[10.5px] uppercase tracking-[0.2em]",
              variant.label,
            )}
          >
            {variant.tag}
          </div>
          <div
            className={cn(
              "mt-2 text-[19px] font-light leading-tight tracking-[-0.01em] md:text-[22px]",
              variant.title,
            )}
          >
            {layer.label}
          </div>
          <p
            className={cn(
              "mt-1.5 text-[13px] leading-snug md:text-[14px]",
              variant.caption,
            )}
          >
            {layer.caption}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          {layer.pills.map((pill) => (
            <span
              key={pill}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-[12px] leading-none transition-colors duration-300 md:text-[13px]",
                variant.pill,
              )}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type LayerVariant = {
  tag: string;
  surface: string;
  /** Color for the small uppercase layer tag. */
  label: string;
  /** Color for the layer title. */
  title: string;
  /** Color for the caption line. */
  caption: string;
  pill: string;
};

const LAYER_VARIANTS: Record<LayerKind, LayerVariant> = {
  output: {
    tag: "Output · what the rep opens",
    surface:
      "border-signal/40 bg-[linear-gradient(180deg,hsl(218_70%_22%/0.55),hsl(218_70%_14%/0.45))] hover:border-signal/70",
    label: "text-signal",
    title: "text-paper-0",
    caption: "text-paper-2",
    pill: "border-signal/40 bg-[hsl(218_60%_18%/0.7)] text-paper-0",
  },
  oi: {
    tag: "OI · operational intelligence",
    surface:
      "border-paper-0/15 bg-[linear-gradient(180deg,hsl(216_14%_94%/0.94),hsl(216_14%_84%/0.92))] text-ink-0 hover:border-paper-0/30",
    label: "text-ink-0/60",
    title: "text-ink-0",
    caption: "text-ink-0/70",
    pill: "border-ink-0/15 bg-ink-0/5 text-ink-0",
  },
  si: {
    tag: "SI · sales intelligence",
    surface:
      "border-signal/25 bg-ink-2 hover:border-signal/45",
    label: "text-signal/80",
    title: "text-paper-0",
    caption: "text-paper-2",
    pill: "border-ink-3 bg-ink-1 text-paper-1",
  },
  sources: {
    tag: "Sources · your data + CRM",
    surface: "border-ink-3 bg-[hsl(220_10%_6%/0.85)] hover:border-paper-3/40",
    label: "text-paper-3",
    title: "text-paper-1",
    caption: "text-paper-2",
    pill: "border-ink-3 bg-ink-0 text-paper-2",
  },
};
