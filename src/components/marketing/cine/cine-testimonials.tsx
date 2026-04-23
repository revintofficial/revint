"use client";

import { Quote } from "lucide-react";

export type CineTestimonial = {
  quote: string;
  name: string;
  role: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  testimonials: CineTestimonial[];
};

/**
 * Voxr-style testimonial marquee, light theme. Two rows scrolling in
 * opposite directions, cards pause on hover, pill-shaped avatars carry
 * a purple gradient.
 */
export function CineTestimonials({ eyebrow, headline, testimonials }: Props) {
  if (testimonials.length < 4) return null;

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  const mid = Math.ceil(testimonials.length / 2);
  const rowA = testimonials.slice(0, mid);
  const rowB = testimonials.slice(mid).concat(testimonials.slice(0, 1));

  return (
    <section
      id="testimonials"
      className="vx-light-section relative py-24 md:py-36 overflow-hidden"
    >
      <div
        className="max-w-(--cine-max) mx-auto mb-14 md:mb-18"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5">
          <span className="vx-badge-light">{eyebrow}</span>
          <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] text-[color:var(--vx-ink)] max-w-[22ch]">
            {firstPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-5 vx-marquee-mask-light group">
        <div className="flex gap-5 w-max animate-cine-marquee group-hover:[animation-play-state:paused]">
          {[...rowA, ...rowA].map((t, i) => (
            <TestimonialCard key={`a-${i}`} t={t} />
          ))}
        </div>
        <div className="flex gap-5 w-max animate-cine-marquee-r group-hover:[animation-play-state:paused]">
          {[...rowB, ...rowB].map((t, i) => (
            <TestimonialCard key={`b-${i}`} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ t }: { t: CineTestimonial }) {
  return (
    <article className="vx-card p-6 md:p-7 w-[320px] md:w-[380px] shrink-0 flex flex-col gap-4 min-h-[220px]">
      <Quote className="w-5 h-5" style={{ color: "var(--vx-purple-500)" }} aria-hidden />
      <p className="text-[14.5px] md:text-[15px] text-[color:var(--vx-ink)] leading-relaxed flex-1">
        “{t.quote}”
      </p>
      <div className="flex items-center gap-3 mt-auto">
        <div
          aria-hidden
          className="w-9 h-9 rounded-full"
          style={{
            background:
              "linear-gradient(135deg, var(--vx-purple-400), var(--vx-purple-700))",
            boxShadow: "0 4px 12px rgba(124,58,237,0.28)",
          }}
        />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[color:var(--vx-ink)] truncate">
            {t.name}
          </p>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--vx-ink-mute)] truncate">
            {t.role}
          </p>
        </div>
      </div>
    </article>
  );
}
