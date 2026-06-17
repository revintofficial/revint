/**
 * Operator surface — the SDR manager / VP Sales view of a vertical
 * SaaS team's morning.
 *
 * Three-column presentational mock: today's account queue, yesterday's
 * reply mix, repeat-touch guard. No client JS, no animation. Mirrors
 * the chip and card grammar of the product's reply strip and the
 * marketing surface's HowItThinks card. Numbers are illustrative-but
 * plausible. Framed as "Operate on intelligence" — the same graph
 * leadership operates on, surfaced where the SDR team works.
 */
import * as React from "react";
import { Section } from "./section";

interface QueueRow {
  name: string;
  area: string;
  fit: number;
  whyNow: string;
}

const QUEUE: QueueRow[] = [
  {
    name: "Cucina 47",
    area: "Austin, TX",
    fit: 84,
    whyNow: "opening 3rd location · still phone-only",
  },
  {
    name: "Kazu Sushi",
    area: "Brooklyn, NY",
    fit: 79,
    whyNow: "1.4k reviews · no QR menu live",
  },
  {
    name: "Cafe Lobo",
    area: "Chicago, IL",
    fit: 71,
    whyNow: "reservation widget 404s on mobile",
  },
];

interface DispChip {
  label: string;
  count: number;
}

const DISPOSITIONS: DispChip[] = [
  { label: "Replied", count: 7 },
  { label: "Opened", count: 11 },
  { label: "No-touch", count: 9 },
  { label: "Bounced", count: 1 },
];

function cardSurface() {
  return "rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_8%)] p-6 md:p-7";
}

function columnCaption(): string {
  return "mt-5 text-[11.5px] text-white/45 leading-relaxed";
}

export function PodControlRoom() {
  return (
    <Section
      id="operator-surface"
      eyebrow="Operate on intelligence"
      headline="The VP-of-Sales view, before the morning stand-up."
      sub="Today's account queue, yesterday's reply mix, repeat-touch guard. The numbers leadership runs on at the portfolio level, scoped to your workspace and refreshed after every CRM sync."
    >
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-6"
        data-section="operator-surface"
      >
        {/* COLUMN 1 — TODAY'S OUTREACH QUEUE */}
        <article
          role="group"
          aria-label="Today's outreach queue"
          className={cardSurface()}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
          >
            Today&apos;s account queue
          </p>

          <ul className="mt-4 divide-y divide-white/[0.04]">
            {QUEUE.map((row) => (
              <li
                key={row.name}
                className="py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-white truncate">
                    {row.name}
                  </span>
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-mono tabular-nums"
                    style={{
                      background:
                        "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)",
                      color: "hsl(var(--revint-h) var(--revint-s) 78%)",
                    }}
                    aria-label={`Fit score ${row.fit}`}
                  >
                    Fit {row.fit}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-white/55">
                  {row.area}{" "}·{" "}{row.whyNow}
                </p>
              </li>
            ))}
          </ul>

          <p className={columnCaption()}>
            3 of 28 in your team&apos;s queue today
          </p>
        </article>

        {/* COLUMN 2 — REPLY MIX */}
        <article
          role="group"
          aria-label="Yesterday's reply mix"
          className={cardSurface()}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
          >
            Yesterday&apos;s reply mix
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-2.5">
            {DISPOSITIONS.map((chip) => (
              <li
                key={chip.label}
                className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3 flex items-center justify-between"
              >
                <span className="text-[12.5px] text-white/70">
                  {chip.label}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 text-[12px] font-mono font-semibold tabular-nums"
                  style={{
                    background:
                      "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)",
                    color: "hsl(var(--revint-h) var(--revint-s) 80%)",
                  }}
                  aria-label={`${chip.count} ${chip.label.toLowerCase()}`}
                >
                  {chip.count}
                </span>
              </li>
            ))}
          </ul>

          <p className={columnCaption()}>
            28 touched yesterday by 4 reps
          </p>
        </article>

        {/* COLUMN 3 — REPEAT-TOUCH GUARD */}
        <article
          role="group"
          aria-label="Repeat-touch guard"
          className={cardSurface()}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
          >
            Repeat-touch guard
          </p>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="text-[14px] font-medium text-white leading-snug">
              Cucina 47
            </p>
            <p className="mt-1.5 text-[12.5px] text-white/65 leading-relaxed">
              Last touched by Sam, 9 days ago. No reply.
            </p>
            <p className="mt-3 text-[12.5px] text-white/80 leading-relaxed">
              Stack and review signals refreshed since. The next touch is yours.
            </p>
          </div>

          <p className={columnCaption()}>
            Portfolio-wide, scoped to your workspace
          </p>
        </article>
      </div>
    </Section>
  );
}
