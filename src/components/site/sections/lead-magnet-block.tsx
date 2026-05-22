import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LeadMagnetBlock — gated download / reciprocity surface.
 *
 * Used by /resources/2026-vertical-saas-gtm-benchmark and the sample
 * vertical briefs. brand-assets §3.4 marketing-ideas #103 — annual report
 * as PR-grade linkable asset.
 *
 * The actual form (email capture) lives in the page that hosts the block;
 * this primitive renders the "what you get" framing + the CTA.
 */

type LeadMagnetBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  /** Bullets describing exactly what the reader receives. */
  bullets: string[];
  /** Primary action — either the gate form or a download endpoint. */
  cta: { href: string; label: string };
  /** Optional inline "what's in the PDF" image / preview slot. */
  preview?: React.ReactNode;
  className?: string;
};

export function LeadMagnetBlock({
  eyebrow,
  title,
  subtitle,
  bullets,
  cta,
  preview,
  className,
}: LeadMagnetBlockProps) {
  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <div className="grid items-start gap-10 rounded-2xl border border-ink-3 bg-ink-1 p-8 md:p-12 lg:grid-cols-2">
          <div>
            {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
            <h2 className="text-[26px] leading-tight tracking-tight text-paper-0 md:text-[36px]">
              {title}
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-paper-2">
              {subtitle}
            </p>
            <ul className="mt-6 grid gap-2.5">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[14px] leading-snug text-paper-1"
                >
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href={cta.href}
                className="site-btn-primary"
                data-cta={`lead-magnet:${cta.label}`}
              >
                <Download className="h-4 w-4" />
                {cta.label}
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-ink-3 bg-ink-0 p-6">
            {preview ?? (
              <div className="aspect-[4/5] w-full rounded-md border border-ink-3 bg-ink-1" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
