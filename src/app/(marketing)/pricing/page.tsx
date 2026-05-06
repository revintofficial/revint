import Link from "next/link";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";
import { Faq } from "@/components/marketing/faq";
import { ArrowRight } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/pricing",
  title: "Pricing — LeadAC",
  description:
    "Math, not features. Local outbound is a per-prospect-homework cost line — we collapse it. Solo $79, Studio $149, Agency+ $249. One closed retainer at $1,500/mo pays back the year 75x over.",
});

export default function PricingPage() {
  return (
    <div className="pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="max-w-5xl mx-auto px-5 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
            {MARKETING_COMING_SOON ? "Launching soon" : "Pricing"}
          </p>
          <h1
            className="text-[40px] sm:text-[56px] font-semibold tracking-tight mb-4"
            style={{ letterSpacing: "-0.03em" }}
          >
            {MARKETING_COMING_SOON ? "Plans open at launch." : "Math, not features."}
          </h1>
          <p className="text-[16px] text-white/55 max-w-xl mx-auto leading-relaxed">
            {MARKETING_COMING_SOON
              ? "Finishing packaging before public signup. The card-required 14-day trial flow ships first."
              : "Local outbound is a per-prospect-homework cost line. We collapse it. Apollo and Smartlead stay where they are."}
          </p>
        </div>

        {!MARKETING_COMING_SOON && (
          <div
            className="mb-12 mx-auto max-w-3xl px-6 py-6 rounded-2xl"
            style={{
              background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.5)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <p className="text-[12.5px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-3">
              The math
            </p>
            <p className="text-[14px] text-white/75 leading-relaxed mb-3">
              <span className="font-semibold text-white">Agency+ at $249/mo is roughly $8 per working day.</span>{" "}
              One closed local-business client at a $1,500/mo retainer pays it back 75x over the year. The multiple holds at every tier:
            </p>
            <ul className="space-y-1.5 text-[13.5px] text-white/65 leading-relaxed">
              <li>
                <span className="text-white font-medium">Solo $79/mo</span> — one closed retainer in year 1 = 19x payback.
              </li>
              <li>
                <span className="text-white font-medium">Studio $149/mo</span> — one closed retainer per quarter = 30x payback.
              </li>
              <li>
                <span className="text-white font-medium">Agency+ $249/mo</span> — one closed retainer per quarter at $1,500/mo = 75x payback.
              </li>
            </ul>
            <p className="text-[12.5px] text-white/45 mt-3 leading-snug">
              If your average retainer is bigger than $1,500/mo (most B2B agency retainers are $2,500-$5,000), the multiple climbs.
            </p>
          </div>
        )}

        <PricingCards ctaDisabled={MARKETING_COMING_SOON} />

        <div
          className="mt-14 mx-auto max-w-3xl px-6 py-5 rounded-2xl text-center"
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.5)",
            border: "0.5px solid rgba(255,255,255,0.07)",
          }}
        >
          <p className="text-[13px] text-white/60">
            <span className="font-semibold text-white">Not sure which tier?</span>{" "}
            We&apos;ll pull a list against your real postcode and ICP, run the audit live, and show you what week 4 looks like.{" "}
            {MARKETING_COMING_SOON ? (
              <a
                href="mailto:hello@leadac.ai"
                className="text-(--leadac-300) hover:underline"
              >
                Email us →
              </a>
            ) : (
              <Link
                href="/demo"
                className="text-(--leadac-300) hover:underline"
              >
                Book a 15-min walkthrough →
              </Link>
            )}
          </p>
        </div>

        <div className="mt-24">
          <h2
            className="text-[28px] sm:text-[36px] font-semibold tracking-tight text-center mb-10"
            style={{ letterSpacing: "-0.025em" }}
          >
            Pricing FAQ
          </h2>
          <div className="max-w-3xl mx-auto">
            <Faq />
          </div>
        </div>

        <div className="mt-20 text-center">
          {!MARKETING_COMING_SOON && (
            <Link
              href="/signup"
              className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
              style={{
                background: "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 34%))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.7), 0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.45)",
              }}
            >
              Start your 14-day trial
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
