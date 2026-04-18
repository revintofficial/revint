import Link from "next/link";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Pricing — Lead Engine",
  description: "Simple, fair pricing. Start free. Upgrade when you start closing.",
};

export default function PricingPage() {
  return (
    <div className="pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="max-w-5xl mx-auto px-5 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
            Pricing
          </p>
          <h1
            className="text-[40px] sm:text-[56px] font-semibold tracking-tight mb-4"
            style={{ letterSpacing: "-0.03em" }}
          >
            Simple, fair pricing.
          </h1>
          <p className="text-[16px] text-white/55 max-w-xl mx-auto">
            Start free. Upgrade when the deals start closing. Cancel any time.
          </p>
        </div>

        <PricingCards />

        <div
          className="mt-14 mx-auto max-w-3xl px-6 py-5 rounded-2xl text-center"
          style={{
            background: "rgba(28,28,30,0.5)",
            border: "0.5px solid rgba(255,255,255,0.07)",
          }}
        >
          <p className="text-[13px] text-white/60">
            <span className="font-semibold text-white">Need more?</span>{" "}
            We do custom volume deals for agencies running 50k+ leads/month.{" "}
            <a
              href="mailto:hello@leadengine.app"
              className="text-[#A5B4FC] hover:underline"
            >
              Talk to us →
            </a>
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
          <Link
            href="/signup"
            className="px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white inline-flex items-center gap-1.5 group"
            style={{
              background: "linear-gradient(180deg, #6E7AE0, #4C5BC1)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.22) inset, 0 0 0 0.5px rgba(94,106,210,0.6), 0 12px 32px rgba(67,56,202,0.35)",
            }}
          >
            Start free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
