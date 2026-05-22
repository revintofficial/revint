import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * CtaBlock — final CTA at the bottom of every page.
 *
 * Style guide §2 closing rule: this is a new sentence, not a recap. Says
 * what happens next, not what was just said.
 */

type CtaBlockProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  className?: string;
  variant?: "default" | "bare";
};

export function CtaBlock({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  className,
  variant = "default",
}: CtaBlockProps) {
  return (
    <section
      className={cn(
        variant === "default" ? "site-section" : "py-16",
        className,
      )}
    >
      <div className="site-container">
        <div
          className={cn(
            "rounded-2xl border border-ink-3 bg-ink-1 p-10 md:p-16",
            "flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between",
          )}
        >
          <div className="max-w-2xl">
            {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
            <h2 className="text-[26px] leading-tight tracking-tight text-paper-0 md:text-[36px]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-4 text-[16px] leading-relaxed text-paper-2">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={primaryCta.href}
              className="site-btn-primary"
              data-cta={`cta-primary:${primaryCta.label}`}
            >
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="site-btn-secondary"
                data-cta={`cta-secondary:${secondaryCta.label}`}
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
