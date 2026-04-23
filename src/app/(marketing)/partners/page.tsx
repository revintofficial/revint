import Link from "next/link";
import { ArrowRight, DollarSign, Megaphone, Award, Download } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/partners",
  title: "Partner program — Leadac AI",
  description:
    "Refer agencies and SDRs to Leadac AI. 30% recurring commission for the lifetime of every paid customer you bring in.",
});

const TIERS = [
  {
    icon: DollarSign,
    title: "30% recurring",
    body: "Every paying customer you refer pays you 30% of their subscription, every month, for the lifetime of their account.",
  },
  {
    icon: Megaphone,
    title: "Co-marketing",
    body: "If you ship a video, blog post, or thread that brings in 10+ paid customers in a quarter, we'll co-fund the next one.",
  },
  {
    icon: Award,
    title: "Certified Partner",
    body: "Hit $5k MRR referred and you get 'Leadac AI Certified Partner' on your profile, plus access to early features and Slack.",
  },
];

const FAQS = [
  {
    q: "Who runs the affiliate tracking?",
    a: "Rewardful, billed against Stripe. Cookie-based attribution with a 60-day window. You see referral counts, conversion rate, and pending vs paid commissions in your dashboard.",
  },
  {
    q: "When do I get paid?",
    a: "Monthly. Commission accrues the moment your referral pays their subscription. Payouts go out on the 15th via PayPal or bank transfer once you're over $50.",
  },
  {
    q: "Are there refund or chargeback rules?",
    a: "If a referred customer refunds within their first 30 days, the matching commission is reversed. After 30 days, commissions are locked in.",
  },
  {
    q: "Can I promote Leadac AI on YouTube / Twitter / a newsletter?",
    a: "Yes. The only ask: be honest, don't promise replies-per-dollar numbers we can't back up, and don't bid on our brand keywords on Google Ads.",
  },
  {
    q: "What about the brand kit?",
    a: "You get logos, product screenshots, a demo Loom, and copy snippets for video descriptions. Link below. We refresh it whenever a major feature ships.",
  },
];

export default function PartnersPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(94,106,210,0.55), transparent)",
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11.5px] font-medium mb-6"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "0.5px solid rgba(255, 255, 255, 0.1)",
              color: "rgba(235, 235, 245, 0.85)",
            }}
          >
            <span>Partner program</span>
          </div>

          <h1
            className="text-[40px] sm:text-[58px] md:text-[64px] font-semibold tracking-tight leading-[1.04] mb-6"
            style={{ letterSpacing: "-0.035em" }}
          >
            Recommend Leadac AI.
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #FFFFFF 0%, #C7CCFF 45%, #5E6AD2 100%)",
              }}
            >
              Get paid for the lifetime of every signup.
            </span>
          </h1>

          <p className="text-[16px] sm:text-[18px] text-white/55 max-w-2xl mx-auto mb-9 leading-relaxed">
            30% recurring commission for the lifetime of every signup.
            Cookie-based attribution through Rewardful and Stripe. No quotas
            and no exclusivity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              href="/signup?ref=partners"
              className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
              style={{
                background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 12px 32px rgba(49,46,129,0.45)",
              }}
            >
              Apply to the program
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#brand-kit"
              className="px-5 py-3 rounded-xl text-[14.5px] font-medium text-white/85 hover:text-white"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.1)",
              }}
            >
              Download brand kit
            </a>
          </div>
        </div>
      </section>

      {/* TIERS */}
      <section className="py-24 sm:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {TIERS.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.title}
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
                    {t.title}
                  </h3>
                  <p className="text-[13.5px] text-white/55 leading-relaxed">{t.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BRAND KIT */}
      <section id="brand-kit" className="py-24 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              Brand kit
            </p>
            <h2
              className="text-[30px] sm:text-[40px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Everything you need to ship a review.
            </h2>
          </div>

          <div
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: "rgba(28,28,30,0.5)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <p className="text-[13.5px] text-white/65">
              The kit includes logo variants (light / dark / wordmark), product
              screenshots at 2x retina, a 90-second demo Loom, copy snippets for
              YouTube descriptions and X threads, and a one-page PDF you can
              hand to a sponsor.
            </p>
            <a
              href="/brand-kit.zip"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
              style={{
                background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 6px 18px rgba(49,46,129,0.4)",
              }}
            >
              <Download className="w-4 h-4" />
              Download brand-kit.zip
            </a>
            <p className="text-[11px] text-white/35">
              ~12 MB. Updated whenever a major feature ships.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-[30px] sm:text-[40px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Quick answers.
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div
                key={i}
                className="p-5 rounded-xl"
                style={{
                  background: "rgba(28,28,30,0.5)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="text-[14px] font-semibold mb-2">{f.q}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
          <h2
            className="text-[36px] sm:text-[48px] font-semibold tracking-tight mb-4"
            style={{ letterSpacing: "-0.03em" }}
          >
            Ship one video this month.
            <br />
            <span className="text-white/55">Get paid every month a customer stays.</span>
          </h2>
          <p className="text-[15px] text-white/55 mb-8 max-w-lg mx-auto">
            Apply to the partner program in 60 seconds. We approve creators
            and newsletters with a real audience.
          </p>
          <Link
            href="/signup?ref=partners"
            className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5"
            style={{
              background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 12px 32px rgba(49,46,129,0.45)",
            }}
          >
            Apply now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
