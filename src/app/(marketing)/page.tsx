import Link from "next/link";
import {
  ArrowRight,
  Search,
  Globe,
  Sparkles,
  Target,
  GitBranch,
  FileText,
  Star,
  Check,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import { ProductPreview } from "@/components/marketing/product-preview";

export const metadata = {
  title: "Lead Engine — Predictable client pipeline for outbound agencies",
  description:
    "Pull fresh local leads from Google Maps, audit their sites, generate a custom mockup, and write the opener. Half the price of a Clay setup, with mockups included.",
};

const HOW: { num: string; title: string; body: string; icon: LucideIcon }[] = [
  {
    num: "01",
    title: "Discover",
    body: "Pick a postcode and a niche. Lead Engine pulls every matching local business straight from Google Maps. The data is live, not a recycled Apollo export.",
    icon: Search,
  },
  {
    num: "02",
    title: "Audit & Score",
    body: "We scan each site for things like load time, whether the booking button works, whether HTTPS is on. Gemini then scores the opportunity 0-100 and tells you why.",
    icon: Sparkles,
  },
  {
    num: "03",
    title: "Pitch with a mockup",
    body: "One click generates a custom one-page mockup for each lead, plus a draft opener that references their actual site. Send it from your inbox or push to Smartlead.",
    icon: Target,
  },
];

const FEATURES: { title: string; body: string; icon: LucideIcon; color: string }[] = [
  {
    title: "Google Places discovery",
    body: "Pull thousands of leads in seconds. Filter by niche, neighborhood, and review count.",
    icon: Search,
    color: "#5E6AD2",
  },
  {
    title: "Automated website audit",
    body: "We crawl every site and check 20+ signals: broken links, missing meta, no HTTPS, no booking flow.",
    icon: Globe,
    color: "#34D399",
  },
  {
    title: "AI opportunity scoring",
    body: "Gemini ranks every lead 0-100 based on website quality and how big the business actually is.",
    icon: Sparkles,
    color: "#8B5CF6",
  },
  {
    title: "Personalized first message",
    body: "A custom outreach message for every shortlisted lead, written against their actual site, not a template.",
    icon: FileText,
    color: "#F59E0B",
  },
  {
    title: "Built-in pipeline",
    body: "Track leads from New → Contacted → Meeting → Won. Notes and outcomes live with the lead, not in a spreadsheet.",
    icon: GitBranch,
    color: "#F87171",
  },
  {
    title: "Website plan generator",
    body: "One click drafts a full website proposal with pages, sections, copy direction, and a suggested price.",
    icon: Star,
    color: "#A5B4FC",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[640px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(94,106,210,0.55), transparent)",
            }}
          />
          <div
            className="absolute top-40 left-1/3 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(139,92,246,0.4), transparent)",
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
            <Sparkles className="w-3 h-3" />
            <span>Built for B2B outbound agencies</span>
          </div>

          <h1
            className="text-[44px] sm:text-[64px] md:text-[76px] font-semibold tracking-tight leading-[1.02] mb-6"
            style={{ letterSpacing: "-0.035em" }}
          >
            Your service isn&apos;t the problem.
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #FFFFFF 0%, #C7CCFF 45%, #5E6AD2 100%)",
              }}
            >
              Your client pipeline is.
            </span>
          </h1>

          <p className="text-[16px] sm:text-[18px] text-white/55 max-w-2xl mx-auto mb-9 leading-relaxed">
            Type a postcode and a niche. Five minutes later you have 47 audited
            local leads, a custom mockup for each one, and a draft opener that
            actually references their site.
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
              Start free, no card
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how"
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

          {/* Validated by the community band */}
          <div
            className="max-w-2xl mx-auto px-5 py-3.5 rounded-xl text-left"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#A5B4FC] mb-1.5">
              From r/SMMA, 11 days ago
            </p>
            <p className="text-[13px] text-white/65 leading-relaxed">
              &ldquo;The reason your SMMA isn&apos;t growing isn&apos;t your
              service. It&apos;s that you have no predictable way to get
              clients. Referrals, posting on social, and hoping &mdash;
              that&apos;s not a strategy, that&apos;s a prayer.&rdquo;
            </p>
          </div>
        </div>

        {/* Product preview */}
        <div className="max-w-6xl mx-auto px-5 sm:px-6 mt-16">
          <ProductPreview />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 sm:py-32 relative">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              How it works
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Three steps from
              <br />
              <span className="text-white/55">cold list to signed deal.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {HOW.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  className="relative p-6 rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(28,28,30,0.6), rgba(20,20,22,0.4))",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: "rgba(94, 106, 210, 0.12)",
                        border: "0.5px solid rgba(94, 106, 210, 0.28)",
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: "#A5B4FC" }} />
                    </div>
                    <span
                      className="text-[11px] font-mono font-semibold tracking-wider"
                      style={{ color: "rgba(235, 235, 245, 0.3)" }}
                    >
                      {s.num}
                    </span>
                  </div>
                  <h3 className="text-[18px] font-semibold mb-2 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-[13.5px] text-white/55 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 sm:py-32 relative">
        <div
          className="absolute inset-0 -z-10 opacity-25"
          style={{
            background:
              "radial-gradient(circle at 70% 50%, rgba(94,106,210,0.18), transparent 60%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              Features
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Everything you need
              <br />
              <span className="text-white/55">to fill your pipeline.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="p-5 rounded-2xl group transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: "rgba(28,28,30,0.5)",
                    border: "0.5px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                    style={{
                      background: `${f.color}1a`,
                      border: `0.5px solid ${f.color}30`,
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-[14.5px] font-semibold mb-1.5 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-[12.5px] text-white/55 leading-relaxed">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 sm:py-32 relative">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              Pricing
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight mb-3"
              style={{ letterSpacing: "-0.025em" }}
            >
              Simple, fair pricing.
            </h2>
            <p className="text-[15px] text-white/55 max-w-xl mx-auto mb-3">
              Start free. Upgrade when you start closing. Cancel anytime.
            </p>
            <p className="text-[12.5px] text-white/40 max-w-xl mx-auto">
              For reference: a typical Clay + cold email stack runs around
              $475/mo. Lead Engine includes the audit and the mockup for less.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              FAQ
            </p>
            <h2
              className="text-[34px] sm:text-[44px] font-semibold tracking-tight"
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
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-6"
            style={{
              background: "rgba(94, 106, 210, 0.14)",
              border: "0.5px solid rgba(94, 106, 210, 0.32)",
            }}
          >
            <Zap className="w-5 h-5" style={{ color: "#A5B4FC" }} />
          </div>
          <h2
            className="text-[36px] sm:text-[52px] font-semibold tracking-tight mb-4"
            style={{ letterSpacing: "-0.03em" }}
          >
            Stop prospecting.
            <br />
            <span className="text-white/55">Start closing.</span>
          </h2>
          <p className="text-[15px] text-white/55 mb-8 max-w-lg mx-auto">
            Discover your first 50 leads in the next 5 minutes. No credit card.
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
            Start for free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
