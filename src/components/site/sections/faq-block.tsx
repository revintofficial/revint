"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { JsonLd, faqSchema } from "@/components/seo/json-ld";
import type { FaqEntry } from "@/content/site/faq";

/**
 * FaqBlock — renders an FAQPage and emits the FAQPage JSON-LD.
 *
 * brand-assets §7.1 Task 3 mandates this on every cornerstone page.
 * Answers stay verbatim with the schema so LLM crawlers see the same
 * answer text the visitor reads.
 */

type FaqBlockProps = {
  eyebrow?: string;
  title?: string;
  entries: FaqEntry[];
  className?: string;
  /** Default open index — used to surface the most-asked Q above the fold. */
  defaultOpen?: number;
};

export function FaqBlock({
  eyebrow,
  title = "Questions buyers ask before they pick Revint",
  entries,
  className,
  defaultOpen = 0,
}: FaqBlockProps) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <JsonLd
          id={`ld-faq-${entries.length}`}
          data={faqSchema(
            entries.map((e) => ({ question: e.question, answer: e.answer })),
          )}
        />
        <div className="max-w-3xl">
          {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
          <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
            {title}
          </h2>
        </div>

        <div className="mt-10 max-w-3xl divide-y divide-ink-3 overflow-hidden rounded-xl border border-ink-3">
          {entries.map((e, i) => {
            const isOpen = open === i;
            return (
              <details
                key={i}
                open={isOpen}
                className="group bg-ink-1"
                onToggle={(ev) => {
                  if ((ev.target as HTMLDetailsElement).open) {
                    setOpen(i);
                  } else if (open === i) {
                    setOpen(null);
                  }
                }}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 px-5 py-4 text-[16px] font-medium text-paper-0 transition-colors hover:bg-ink-2 md:px-6">
                  <span>{e.question}</span>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-paper-2 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </summary>
                <div className="px-5 pb-5 text-[15px] leading-relaxed text-paper-2 md:px-6">
                  {e.answer}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
