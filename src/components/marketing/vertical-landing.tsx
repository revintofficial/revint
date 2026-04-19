import Link from "next/link";
import { ArrowRight, Check, Quote, type LucideIcon } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";

export interface VerticalCopy {
  eyebrow: string;
  h1: string;
  h1Highlight: string;
  sub: string;
  primaryCta: string;
  metaTitle: string;
  metaDescription: string;
  validationQuote: {
    source: string;
    text: string;
  };
  painsHeading: string;
  pains: { title: string; body: string; icon: LucideIcon }[];
  proofHeading: string;
  proofPoints: string[];
  closingHeading: string;
  closingHeadingHighlight: string;
  closingBody: string;
}

export function VerticalLanding({ copy }: { copy: VerticalCopy }) {
  return (
    <>
      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[640px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(94,106,210,0.55), transparent)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-5 sm:px-6 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11.5px] font-medium mb-6"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "0.5px solid rgba(255, 255, 255, 0.1)",
              color: "rgba(235, 235, 245, 0.85)",
            }}
          >
            <span>{copy.eyebrow}</span>
          </div>

          <h1
            className="text-[40px] sm:text-[58px] md:text-[68px] font-semibold tracking-tight leading-[1.04] mb-6"
            style={{ letterSpacing: "-0.035em" }}
          >
            {copy.h1}
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #FFFFFF 0%, #C7CCFF 45%, #5E6AD2 100%)",
              }}
            >
              {copy.h1Highlight}
            </span>
          </h1>

          <p className="text-[16px] sm:text-[18px] text-white/55 max-w-2xl mx-auto mb-9 leading-relaxed">
            {copy.sub}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-9">
            <Link
              href="/signup"
              className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
              style={{
                background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 12px 32px rgba(49,46,129,0.45)",
              }}
            >
              {copy.primaryCta}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/#how"
              className="px-5 py-3 rounded-xl text-[14.5px] font-medium text-white/85 hover:text-white"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.1)",
              }}
            >
              See how it works
            </Link>
          </div>

          <p className="text-[12px] text-white/35 mb-12">
            50 free leads · no credit card · cancel any time
          </p>

          {/* Validation quote */}
          <div
            className="max-w-2xl mx-auto px-5 py-3.5 rounded-xl text-left"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <Quote className="w-4 h-4 text-[#A5B4FC] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#A5B4FC] mb-1.5">
                  {copy.validationQuote.source}
                </p>
                <p className="text-[13px] text-white/65 leading-relaxed">
                  {copy.validationQuote.text}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAINS */}
      <section className="py-24 sm:py-32 relative">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              What Lead Engine fixes
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              {copy.painsHeading}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {copy.pains.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(28,28,30,0.6), rgba(20,20,22,0.4))",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{
                      background: "rgba(94, 106, 210, 0.12)",
                      border: "0.5px solid rgba(94, 106, 210, 0.28)",
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#A5B4FC" }} />
                  </div>
                  <h3 className="text-[18px] font-semibold mb-2 tracking-tight">
                    {p.title}
                  </h3>
                  <p className="text-[13.5px] text-white/55 leading-relaxed">
                    {p.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="py-24 sm:py-32 relative">
        <div
          className="absolute inset-0 -z-10 opacity-25"
          style={{
            background:
              "radial-gradient(circle at 30% 50%, rgba(94,106,210,0.18), transparent 60%)",
          }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              How it works for you
            </p>
            <h2
              className="text-[30px] sm:text-[40px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              {copy.proofHeading}
            </h2>
          </div>

          <ul className="space-y-3">
            {copy.proofPoints.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{
                  background: "rgba(28,28,30,0.5)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center mt-0.5 shrink-0"
                  style={{
                    background: "rgba(52, 211, 153, 0.14)",
                    border: "0.5px solid rgba(52, 211, 153, 0.28)",
                  }}
                >
                  <Check className="w-3.5 h-3.5 text-[#34D399]" />
                </div>
                <p className="text-[14px] text-white/75 leading-relaxed">
                  {point}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              Pricing
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight mb-3"
              style={{ letterSpacing: "-0.025em" }}
            >
              Same plans for everyone.
            </h2>
            <p className="text-[15px] text-white/55 max-w-xl mx-auto">
              Start free. Upgrade when you start closing.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <h2
              className="text-[30px] sm:text-[40px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Quick answers.
            </h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(94,106,210,0.28), transparent 60%)",
          }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
          <h2
            className="text-[36px] sm:text-[52px] font-semibold tracking-tight mb-4"
            style={{ letterSpacing: "-0.03em" }}
          >
            {copy.closingHeading}
            <br />
            <span className="text-white/55">{copy.closingHeadingHighlight}</span>
          </h2>
          <p className="text-[15px] text-white/55 mb-8 max-w-lg mx-auto">
            {copy.closingBody}
          </p>
          <Link
            href="/signup"
            className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
            style={{
              background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 12px 32px rgba(49,46,129,0.45)",
            }}
          >
            Start free, no card
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
