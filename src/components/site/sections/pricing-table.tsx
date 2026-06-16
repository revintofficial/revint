import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRICING_TIERS, PRICING_FOOTNOTE } from "@/content/site/pricing";

/**
 * PricingTable — 4-tier table with Decoy + Anchoring psych.
 *
 * brand-assets §3.3 row "/pricing": cheap → expensive left-to-right, Team
 * highlighted as target, Enterprise as anchor-high. The "Cancel anytime"
 * footnote runs below.
 */

type PricingTableProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
};

export function PricingTable({
  eyebrow,
  title = "Pricing — same money as Gong's mid-market floor, with the memory layer included.",
  subtitle,
  className,
}: PricingTableProps) {
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

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.id}
              className={cn(
                "flex h-full flex-col rounded-2xl border bg-ink-1 p-6",
                tier.recommended
                  ? "border-signal shadow-lg shadow-[hsl(var(--signal-glow))]"
                  : "border-ink-3",
              )}
            >
              {tier.recommended ? (
                <div className="site-mono mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-signal/40 bg-[hsl(218_50%_16%_/_0.4)] px-3 py-1 text-[11px] uppercase tracking-wider text-signal">
                  <span className="site-signal-dot" />
                  Most teams pick this
                </div>
              ) : null}
              <div className="text-[18px] font-medium text-paper-0">
                {tier.name}
              </div>
              <div className="mt-1 text-[13px] text-paper-2">
                {tier.tagline}
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="site-mono text-[40px] tracking-tight text-paper-0">
                  {tier.priceLabel}
                </span>
                {tier.monthly !== null ? (
                  <span className="text-[13px] text-paper-3">/mo</span>
                ) : null}
              </div>
              {tier.unit ? (
                <div className="mt-1 text-[12px] text-paper-3">{tier.unit}</div>
              ) : null}
              {tier.annualLabel ? (
                <div className="site-mono mt-1 text-[12px] text-paper-3">
                  {tier.annualLabel}
                </div>
              ) : null}
              <div className="mt-3 text-[13px] text-paper-2">
                {tier.audience}
              </div>
              {tier.highlight ? (
                <div className="mt-4 rounded-md border border-ink-3 bg-ink-2 p-3 text-[13px] leading-relaxed text-paper-1">
                  {tier.highlight}
                </div>
              ) : null}
              <ul className="mt-6 grid gap-2.5">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] leading-snug text-paper-1"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Link
                  href={tier.cta.href}
                  className={cn(
                    "block w-full text-center",
                    tier.recommended
                      ? "site-btn-primary justify-center"
                      : "site-btn-secondary justify-center",
                  )}
                  data-cta={`pricing-${tier.id}:${tier.cta.label}`}
                >
                  {tier.cta.label}
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-[14px] leading-relaxed text-paper-2">
          {PRICING_FOOTNOTE}
        </p>
      </div>
    </section>
  );
}
