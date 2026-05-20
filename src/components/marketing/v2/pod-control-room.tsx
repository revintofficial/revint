/**
 * PodControlRoom — the manager view of a BD pod morning.
 *
 * Net-new section for the F&B BD cold-call pod RFC at
 * `.agents/homepage-strategist/proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`,
 * per-section spec at
 * `.agents/homepage-strategist/proposals/specs/2026-05-20-fnb-bd-pod-pod-control-room.md`.
 *
 * Three-column presentational mock: morning queue, yesterday's disposition
 * mix, repeat-call guard. No client JS, no animation. Mirrors the chip and
 * card grammar of the product's DispositionStrip and the marketing surface's
 * HowItThinks card. Numbers are illustrative-but-plausible per spec § 14.
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
    name: "Kazu Sushi",
    area: "Camden",
    fit: 84,
    whyNow: "3 reviews flag Friday wait",
  },
  {
    name: "Dishoom Shoreditch",
    area: "Shoreditch",
    fit: 79,
    whyNow: "new GM 11 days ago",
  },
  {
    name: "Cafe Lobo",
    area: "Hackney",
    fit: 71,
    whyNow: "booking link 404s on mobile",
  },
];

interface DispChip {
  label: string;
  count: number;
}

const DISPOSITIONS: DispChip[] = [
  { label: "Connected", count: 7 },
  { label: "Voicemail", count: 11 },
  { label: "No-answer", count: 9 },
  { label: "Wrong-#", count: 1 },
];

function cardSurface() {
  return "rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_8%)] p-6 md:p-7";
}

function columnCaption(): string {
  return "mt-5 text-[11.5px] text-white/45 leading-relaxed";
}

export function PodControlRoom() {
  return (
    <Section
      id="pod-control-room"
      eyebrow="For the pod manager"
      headline="The manager view, before the morning stand-up."
      sub="Queue waiting on your pod, disposition mix from yesterday, repeat-call guard. The numbers your stand-up runs on, prepared while your reps are still on the train in."
    >
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-6"
        data-section="pod-control-room"
      >
        {/* COLUMN 1 — MORNING QUEUE */}
        <article
          role="group"
          aria-label="Morning queue"
          className={cardSurface()}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            Morning queue
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
                        "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
                      color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
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
            3 of 28 in your pod&apos;s queue today
          </p>
        </article>

        {/* COLUMN 2 — DISPOSITIONS */}
        <article
          role="group"
          aria-label="Yesterday's disposition mix"
          className={cardSurface()}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            Dispositions, yesterday
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
                      "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
                    color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
                  }}
                  aria-label={`${chip.count} ${chip.label.toLowerCase()} ${chip.count === 1 ? "call" : "calls"}`}
                >
                  {chip.count}
                </span>
              </li>
            ))}
          </ul>

          <p className={columnCaption()}>
            28 dialed yesterday by 4 reps
          </p>
        </article>

        {/* COLUMN 3 — REPEAT-CALL GUARD */}
        <article
          role="group"
          aria-label="Repeat-call guard"
          className={cardSurface()}
        >
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            Repeat-call guard
          </p>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="text-[14px] font-medium text-white leading-snug">
              Kazu Sushi
            </p>
            <p className="mt-1.5 text-[12.5px] text-white/65 leading-relaxed">
              Last dialed by Sam, 9 days ago. Voicemail.
            </p>
            <p className="mt-3 text-[12.5px] text-white/80 leading-relaxed">
              The brief is fresh; the dial is yours.
            </p>
          </div>

          <p className={columnCaption()}>
            Pod-wide, scoped to your workspace
          </p>
        </article>
      </div>
    </Section>
  );
}
