/**
 * Shared section wrapper for the v2 marketing surface.
 *
 * Design intent: every block on the new landing reads as a calm,
 * vertically-rhythmed Apple-style section. Consistent gutter, generous
 * vertical padding, sentence-case headline at clamp(32px, 5vw, 52px), and
 * a single muted sub paragraph. The `soft` variant lightens the surface a
 * notch using the leadac neutral surface token so adjacent sections can
 * alternate without looking striped.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  headline?: React.ReactNode;
  sub?: string;
  children?: React.ReactNode;
  variant?: "default" | "soft";
  className?: string;
}

export function Section({
  id,
  eyebrow,
  headline,
  sub,
  children,
  variant = "default",
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full py-24 md:py-32",
        variant === "soft" &&
          "bg-[hsl(var(--leadac-h)_var(--leadac-ns)_8%)] border-y border-white/[0.04]",
        className,
      )}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        {(eyebrow || headline || sub) && (
          <header className="mb-12 md:mb-16 max-w-3xl">
            {eyebrow && (
              <p
                className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 62%)" }}
              >
                {eyebrow}
              </p>
            )}
            {headline && (
              <h2
                className="text-white font-semibold tracking-[-0.025em] leading-[1.08]"
                style={{ fontSize: "clamp(32px, 5vw, 52px)" }}
              >
                {headline}
              </h2>
            )}
            {sub && (
              <p className="mt-5 text-[16px] md:text-[17px] leading-relaxed text-white/55 max-w-2xl">
                {sub}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
