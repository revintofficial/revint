import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Search,
  Globe,
  Wand2,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import {
  DiscoveryDemo,
  LeadCardLive,
  MockupGeneratorDemo,
  OpenerComposer,
  PipelineBoard,
  ScrollStage,
  RevealOnScroll,
  ValidationQuote,
  MetricCounter,
  MarketingBackdrop,
  type ScrollScene,
} from "@/components/marketing/interactive";
import { HOME_LEADS, HOME_CITIES, HOME_NICHES } from "@/components/marketing/interactive/demo-data";

export const metadata = {
  title: "Leadac AI — Predictable client pipeline for outbound agencies",
  description:
    "Pull fresh local leads from Google Maps, audit their sites, generate a custom mockup, and write the opener. Half the price of a Clay setup, with mockups included.",
};

const FEATURES: { title: string; body: string; icon: LucideIcon; color: string }[] = [
  {
    title: "Live Google Places discovery",
    body: "Pull thousands of leads in seconds. Filter by niche, neighborhood, and review count. The data is fresh, not a recycled Apollo export.",
    icon: Search,
    color: "#5E6AD2",
  },
  {
    title: "Audits that read like a senior consultant wrote them",
    body: "Every site gets crawled for 20+ signals: HTTPS, mobile fit, booking flow, page speed, last-touched year. Gemini turns that into a one-paragraph diagnosis.",
    icon: Globe,
    color: "#34D399",
  },
  {
    title: "Per-lead mockup, not a generic deck",
    body: "One click generates a one-page site for the prospect with their reviews, services, and address pulled in. The opener attaches the link.",
    icon: Wand2,
    color: "#A5B4FC",
  },
  {
    title: "Pipeline that lives with the lead",
    body: "Notes, statuses, meeting outcomes all attached to the business, not floating in a spreadsheet you forget to open.",
    icon: GitBranch,
    color: "#F87171",
  },
];

export default function LandingPage() {
  const sampleLead = HOME_LEADS[0];

  const SCENES: ScrollScene[] = [
    {
      id: "discover",
      eyebrow: "Step one",
      title: "Type a postcode. Get the list.",
      body: "Pick a city and a niche. Leadac AI queries Google Places live and returns every matching business with phone, rating, address, and website status. No re-using last quarter's Apollo dump.",
      visual: (
        <DiscoveryDemo
          cities={HOME_CITIES}
          niches={HOME_NICHES}
          leads={HOME_LEADS}
          caption="Click any lead to see the full audit, then generate a custom mockup."
        />
      ),
    },
    {
      id: "audit",
      eyebrow: "Step two",
      title: "Open a lead. See exactly what's broken.",
      body: "Each lead unfolds into a real audit: HTTPS, mobile viewport, booking flow, page speed, last update. Five signals, with details, scored 0 to 100. That score is the conversation starter you used to write yourself.",
      visual: (
        <div
          className="rounded-2xl p-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 100%)",
            border: "0.5px solid rgba(255,255,255,0.09)",
            boxShadow:
              "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px rgba(49,46,129,0.25)",
          }}
        >
          <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[#A5B4FC] mb-3">
            Lead detail · expanded
          </p>
          <LeadCardLive lead={sampleLead} defaultExpanded />
        </div>
      ),
    },
    {
      id: "mockup",
      eyebrow: "Step three",
      title: "Hand them a draft, not a deck.",
      body: "One click composes a one-page site for the prospect. Their reviews, services, and address baked in. Three colour variants if you want to A/B which one lands. Attach the link to the cold email and watch the conversation shift.",
      visual: <MockupGeneratorDemo lead={sampleLead} />,
    },
    {
      id: "opener",
      eyebrow: "Step four",
      title: "The opener writes itself. You ship it.",
      body: "The draft references the actual issues the audit found. Edit the parts that need your voice, then push the file straight into Smartlead or Instantly. Auto-send stays off — the human ships, the AI doesn't.",
      visual: <OpenerComposer lead={sampleLead} />,
    },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
        <MarketingBackdrop variant="hero" />

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
            className="text-[44px] sm:text-[68px] md:text-[84px] font-semibold tracking-tight leading-none mb-6"
            style={{ letterSpacing: "-0.04em" }}
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
              href="#tour"
              className="px-5 py-3 rounded-xl text-[14.5px] font-medium text-white/85 hover:text-white"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.1)",
              }}
            >
              Watch the 60-second tour
            </Link>
          </div>

          <p className="text-[12px] text-white/35">
            50 free leads · no credit card · cancel any time
          </p>
        </div>

        {/* Live discovery below the fold */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mt-16">
          <RevealOnScroll>
            <div className="text-center mb-5">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#A5B4FC] mb-1.5">
                Try it now
              </p>
              <p className="text-[13px] text-white/45">
                Pick a city and a niche. The leads are real businesses, the
                signals are what we&apos;d score.
              </p>
            </div>
            <DiscoveryDemo
              cities={HOME_CITIES}
              niches={HOME_NICHES}
              leads={HOME_LEADS}
              caption="Click any lead to see the audit, then keep scrolling for what happens next."
            />
          </RevealOnScroll>
        </div>
      </section>

      {/* SCROLLYTELLING TOUR */}
      <section id="tour" className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
                The four screens
              </p>
              <h2
                className="text-[34px] sm:text-[56px] font-semibold tracking-tight leading-[1.05]"
                style={{ letterSpacing: "-0.03em" }}
              >
                Scroll the product.
                <br />
                <span className="text-white/55">
                  Not a tour video, the actual UI.
                </span>
              </h2>
            </div>
          </RevealOnScroll>

          <ScrollStage scenes={SCENES} />
        </div>
      </section>

      {/* PIPELINE */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <RevealOnScroll>
            <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
              After the send
            </p>
            <h2
              className="text-[32px] sm:text-[44px] font-semibold tracking-tight leading-[1.05] mb-4"
              style={{ letterSpacing: "-0.025em" }}
            >
              The pipeline lives with the lead.
            </h2>
            <p className="text-[15px] text-white/60 leading-relaxed mb-6">
              Notes, statuses, meeting outcomes attach to the business itself.
              When the deal closes, it closes against the same record you
              opened on Monday. No CRM duct tape, no copying rows between
              tools.
            </p>
            <ul className="space-y-2.5 text-[13.5px] text-white/70">
              <li className="flex items-start gap-2.5">
                <span className="w-1 h-1 rounded-full bg-[#A5B4FC] mt-2 shrink-0" />
                Auto-status updates when you push to Smartlead or log a reply.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1 h-1 rounded-full bg-[#A5B4FC] mt-2 shrink-0" />
                Meeting outcomes ship with notes, not just a checkbox.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1 h-1 rounded-full bg-[#A5B4FC] mt-2 shrink-0" />
                Won deals stay attached, so case studies write themselves.
              </li>
            </ul>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <PipelineBoard />
          </RevealOnScroll>
        </div>
      </section>

      {/* PROOF */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-12">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
                The thesis, in numbers
              </p>
              <h2
                className="text-[30px] sm:text-[44px] font-semibold tracking-tight leading-[1.1]"
                style={{ letterSpacing: "-0.025em" }}
              >
                Apollo sells the same list to everyone.
                <br />
                <span className="text-white/55">
                  Yours is fresh on every search.
                </span>
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            <RevealOnScroll>
              <MetricCounter
                value={50}
                suffix="M"
                label="Apollo contacts shared across thousands of agencies. Same inbox, ten pitches a week."
                accent="#F87171"
              />
            </RevealOnScroll>
            <RevealOnScroll delay={0.1}>
              <MetricCounter
                value={47}
                label="Audited local leads in five minutes. Pick a city, pick a niche, walk to the kitchen."
                accent="#A5B4FC"
              />
            </RevealOnScroll>
            <RevealOnScroll delay={0.2}>
              <MetricCounter
                value={4}
                suffix="×"
                label="Reply lift our pilot users see when the cold email arrives with a mockup attached."
                accent="#34D399"
              />
            </RevealOnScroll>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <ValidationQuote
              source="11 days ago"
              subreddit="SMMA"
              upvotes={42}
              comments={61}
              text="The reason your SMMA isn't growing isn't your service. It's that you have no predictable way to get clients. Referrals, posting on social, and hoping — that's not a strategy, that's a prayer."
            />
            <ValidationQuote
              source="5 days ago · $140k/mo agency stack"
              subreddit="coldemail"
              upvotes={39}
              comments={47}
              text="Everyone's fighting over the same Apollo and Clay exports. Same 50 million contacts, same crawls, same emails that have been cold emailed by ten other people this month."
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
                Inside the box
              </p>
              <h2
                className="text-[34px] sm:text-[44px] font-semibold tracking-tight leading-[1.1]"
                style={{ letterSpacing: "-0.025em" }}
              >
                Four pieces, one workflow.
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <RevealOnScroll key={f.title} delay={i * 0.06}>
                  <div
                    className="p-6 rounded-2xl group transition-all duration-300 hover:-translate-y-0.5 h-full"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(28,28,30,0.55), rgba(20,20,22,0.45))",
                      border: "0.5px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: `${f.color}1a`,
                        border: `0.5px solid ${f.color}30`,
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <h3 className="text-[16px] font-semibold mb-1.5 tracking-tight">
                      {f.title}
                    </h3>
                    <p className="text-[13.5px] text-white/55 leading-relaxed">
                      {f.body}
                    </p>
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-14">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
                Pricing
              </p>
              <h2
                className="text-[34px] sm:text-[44px] font-semibold tracking-tight mb-3"
                style={{ letterSpacing: "-0.025em" }}
              >
                Half the price of a Clay setup.
              </h2>
              <p className="text-[15px] text-white/55 max-w-xl mx-auto mb-3">
                Start free. Upgrade when you start closing. Cancel anytime.
              </p>
              <p className="text-[12.5px] text-white/40 max-w-xl mx-auto">
                For reference: a typical Clay + cold email stack runs around
                $475/mo. Leadac AI includes the audit and the mockup for
                less.
              </p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <PricingCards />
          </RevealOnScroll>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
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
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <Faq />
          </RevealOnScroll>
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
          <RevealOnScroll>
            <Image
              src="/logo.png"
              alt="Leadac AI"
              width={48}
              height={48}
              className="inline-block w-12 h-12 object-contain mb-6"
            />
            <h2
              className="text-[36px] sm:text-[56px] font-semibold tracking-tight mb-4 leading-[1.05]"
              style={{ letterSpacing: "-0.03em" }}
            >
              Your first 50 leads
              <br />
              <span className="text-white/55">are five minutes away.</span>
            </h2>
            <p className="text-[15px] text-white/55 mb-8 max-w-lg mx-auto">
              No credit card. If the discovery doesn&apos;t pull anything you
              can pitch, walk away.
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
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
