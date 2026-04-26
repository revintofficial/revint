import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import {
  RevealOnScroll,
  ValidationQuote,
  MarketingBackdrop,
} from "@/components/marketing/interactive";

/**
 * Shared scaffolding for vertical landing pages that share the same Apple-
 * flavored design language but differ in their primary device frame and
 * middle-of-page proof composition. Each fork (SmmaLanding, SpecialistsLanding,
 * AgenciesLanding) imports these blocks and slots in its own hero device
 * frame and custom "swap" / "tour" middle sections.
 *
 * If you want to redesign the hero shell or pricing block consistently
 * across ALL desk-bound vertical pages, edit it here. Per-ICP layout lives
 * in the individual landing files.
 */

interface MarketingHeroProps {
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  h1: string;
  h1Highlight: string;
  sub: string;
  primaryCta: string;
  secondaryCtaLabel?: string;
  /** Render the framed hero visual (DiscoveryDemo inside MacBookFrame, etc.). */
  visual: React.ReactNode;
  /** Footnote under the CTAs (e.g. "50 free leads · no card"). */
  footnote: string;
}

export function MarketingHero({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  h1,
  h1Highlight,
  sub,
  primaryCta,
  secondaryCtaLabel = "See it in action",
  visual,
  footnote,
}: MarketingHeroProps) {
  return (
    <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-20 overflow-hidden">
      <MarketingBackdrop variant="hero" />

      <div className="max-w-5xl mx-auto px-5 sm:px-6 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11.5px] font-medium mb-6"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "0.5px solid rgba(255, 255, 255, 0.1)",
            color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.85)",
          }}
        >
          {EyebrowIcon ? (
            <EyebrowIcon className="w-3 h-3 text-(--leadac-300)" />
          ) : null}
          <span>{eyebrow}</span>
        </div>

        <h1
          className="text-[40px] sm:text-[60px] md:text-[76px] font-semibold tracking-tight leading-[1.02] mb-6"
          style={{ letterSpacing: "-0.04em" }}
        >
          {h1}
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(120deg, #FFFFFF 0%, hsl(var(--leadac-h) var(--leadac-s) 88%) 45%, hsl(var(--leadac-h) var(--leadac-s) 50%) 100%)",
            }}
          >
            {h1Highlight}
          </span>
        </h1>

        <p className="text-[16px] sm:text-[18px] text-white/55 max-w-2xl mx-auto mb-9 leading-relaxed">
          {sub}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-9">
          <Link
            href="/signup"
            className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
            style={{
              background: "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 34%))",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.7), 0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.45)",
            }}
          >
            {primaryCta}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#try-it"
            className="px-5 py-3 rounded-xl text-[14.5px] font-medium text-white/85 hover:text-white"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.1)",
            }}
          >
            {secondaryCtaLabel}
          </Link>
        </div>

        <p className="text-[12px] text-white/35 mb-10">{footnote}</p>
      </div>

      <div id="try-it" className="max-w-5xl mx-auto px-5 sm:px-6 mt-6">
        <RevealOnScroll>{visual}</RevealOnScroll>
      </div>
    </section>
  );
}

interface PainsSectionProps {
  eyebrow: string;
  heading: string;
  pains: { title: string; body: string; icon: LucideIcon }[];
}

export function PainsSection({ eyebrow, heading, pains }: PainsSectionProps) {
  return (
    <RevealOnScroll>
      <div className="text-center mb-14 max-w-3xl mx-auto">
        <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
          {eyebrow}
        </p>
        <h2
          className="text-[34px] sm:text-[44px] font-semibold tracking-tight leading-[1.1]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {heading}
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {pains.map((p, i) => {
          const Icon = p.icon;
          return (
            <RevealOnScroll key={i} delay={i * 0.06}>
              <div
                className="p-6 rounded-2xl h-full group transition-transform duration-300 hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.6), hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.4))",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: "hsl(var(--leadac-h) var(--leadac-s) 60% / 0.12)",
                    border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.28)",
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--leadac-300)" }} />
                </div>
                <h3 className="text-[18px] font-semibold mb-2 tracking-tight">
                  {p.title}
                </h3>
                <p className="text-[13.5px] text-white/55 leading-relaxed">
                  {p.body}
                </p>
              </div>
            </RevealOnScroll>
          );
        })}
      </div>
    </RevealOnScroll>
  );
}

interface ValidationSectionProps {
  source: string;
  text: string;
  subreddit?: string;
  upvotes?: number;
  comments?: number;
}

export function ValidationSection(props: ValidationSectionProps) {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <RevealOnScroll>
          <ValidationQuote {...props} />
        </RevealOnScroll>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <MarketingBackdrop variant="muted" />
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <RevealOnScroll>
          <div className="text-center mb-14">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
              Pricing
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight mb-3"
              style={{ letterSpacing: "-0.025em" }}
            >
              Simple, fair pricing.
            </h2>
            <p className="text-[15px] text-white/55 max-w-xl mx-auto">
              Start free. Upgrade when you start closing.
            </p>
          </div>
        </RevealOnScroll>
        <RevealOnScroll delay={0.1}>
          <PricingCards />
        </RevealOnScroll>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <RevealOnScroll>
          <div className="text-center mb-14">
            <h2
              className="text-[30px] sm:text-[40px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Quick answers.
            </h2>
          </div>
        </RevealOnScroll>
        <RevealOnScroll delay={0.1}>
          <Faq />
        </RevealOnScroll>
      </div>
    </section>
  );
}

interface ClosingCtaProps {
  heading: string;
  highlight: string;
  body: string;
  ctaLabel?: string;
}

export function ClosingCta({
  heading,
  highlight,
  body,
  ctaLabel = "Start free, no card",
}: ClosingCtaProps) {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--leadac-h) var(--leadac-s) 60% / 0.28), transparent 60%)",
        }}
      />
      <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center relative">
        <RevealOnScroll>
          <h2
            className="text-[36px] sm:text-[52px] font-semibold tracking-tight mb-4 leading-[1.05]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {heading}
            <br />
            <span className="text-white/55">{highlight}</span>
          </h2>
          <p className="text-[15px] text-white/55 mb-8 max-w-lg mx-auto">
            {body}
          </p>
          <Link
            href="/signup"
            className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
            style={{
              background: "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 34%))",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.7), 0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.45)",
            }}
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </RevealOnScroll>
      </div>
    </section>
  );
}
