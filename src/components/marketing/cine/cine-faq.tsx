"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";

export type CineFaqItem = { q: string; a: string };

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  contactCta?: { label: string; href: string };
  items: CineFaqItem[];
};

/**
 * Voxr-style FAQ. Light theme, sticky heading on the left, accordion on
 * the right. Active question flips to a purple accent.
 */
export function CineFaq({ eyebrow, headline, sub, contactCta, items }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="faq"
      className="vx-light-section-alt relative py-24 md:py-36"
    >
      <div
        className="max-w-(--cine-max) mx-auto grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-12 md:gap-16"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="md:sticky md:top-24 md:self-start flex flex-col items-start gap-5">
          <span className="vx-badge-light">{eyebrow}</span>
          <h2 className="vx-display text-[clamp(30px,4.5vw,56px)] leading-[1.02] text-[color:var(--vx-ink)] max-w-[14ch]">
            {firstPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
          {sub && (
            <p className="text-[15px] text-[color:var(--vx-ink-mute)] max-w-md leading-relaxed">
              {sub}
            </p>
          )}
          {contactCta && (
            <Link
              href={contactCta.href}
              className="inline-flex items-center gap-2 mt-2 rounded-full px-5 py-2.5 text-[13.5px] font-medium transition-colors"
              style={{
                background: "white",
                color: "var(--vx-purple-700)",
                border: "1px solid rgba(139, 92, 246, 0.30)",
              }}
            >
              {contactCta.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <div className="divide-y" style={{ borderColor: "var(--vx-rule)" }}>
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="py-2"
                style={{ borderTopColor: "var(--vx-rule)" }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-6 text-left py-5 md:py-6 group focus-visible:outline focus-visible:outline-2 focus-visible:rounded-md"
                  style={{
                    outlineColor: "var(--vx-purple-500)",
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`cine-faq-${i}`}
                >
                  <span
                    className="text-[17px] md:text-[19px] font-semibold tracking-[-0.005em] transition-colors"
                    style={{
                      color: isOpen
                        ? "var(--vx-purple-700)"
                        : "var(--vx-ink)",
                    }}
                  >
                    {item.q}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="w-5 h-5 shrink-0 mt-0.5 transition-transform"
                    style={{
                      color: isOpen
                        ? "var(--vx-purple-700)"
                        : "var(--vx-ink-mute)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                <div
                  id={`cine-faq-${i}`}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100 pb-6" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-[14.5px] text-[color:var(--vx-ink-mute)] leading-relaxed max-w-[60ch]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
