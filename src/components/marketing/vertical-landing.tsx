import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import {
  DiscoveryDemo,
  BeforeAfterSplit,
  ScrollStage,
  RevealOnScroll,
  ValidationQuote,
  MarketingBackdrop,
  MockupGeneratorDemo,
  OpenerComposer,
  PipelineBoard,
  LeadCardLive,
  type DemoLead,
  type ScrollScene,
} from "@/components/marketing/interactive";

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
    subreddit?: string;
    upvotes?: number;
    comments?: number;
  };
  painsHeading: string;
  pains: { title: string; body: string; icon: LucideIcon }[];
  proofHeading: string;
  proofPoints: string[];
  closingHeading: string;
  closingHeadingHighlight: string;
  closingBody: string;
  // New: visual proof config
  demoCities: string[];
  demoNiches: string[];
  demoLeads: DemoLead[];
  beforeAfter: { beforeLabel: string; afterLabel: string };
  // Optional: a 4-step proof tour (defaults to a kit-rendered fallback)
  proofTourTitle?: string;
}

const SCENE_VISUALS = [
  "discovery",
  "leadCard",
  "mockup",
  "opener",
  "pipeline",
] as const;

export function VerticalLanding({ copy }: { copy: VerticalCopy }) {
  const featuredLead = copy.demoLeads[0];
  const tourLead = copy.demoLeads[1] ?? copy.demoLeads[0];

  const tourScenes: ScrollScene[] = copy.proofPoints
    .slice(0, 4)
    .map((point, i) => ({
      id: `proof-${i}`,
      eyebrow: `What changes · ${String(i + 1).padStart(2, "0")}`,
      title: point.split(".")[0] + ".",
      body:
        point.split(".").slice(1).join(".").trim() ||
        "This is what the workflow looks like once you switch.",
      visual: visualForScene(SCENE_VISUALS[i] ?? "leadCard", tourLead, copy),
    }));

  return (
    <>
      {/* HERO */}
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
            <span>{copy.eyebrow}</span>
          </div>

          <h1
            className="text-[40px] sm:text-[60px] md:text-[76px] font-semibold tracking-tight leading-[1.02] mb-6"
            style={{ letterSpacing: "-0.04em" }}
          >
            {copy.h1}
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #FFFFFF 0%, hsl(var(--leadac-h) var(--leadac-s) 88%) 45%, hsl(var(--leadac-h) var(--leadac-s) 50%) 100%)",
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
                background: "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 34%))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.7), 0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.45)",
              }}
            >
              {copy.primaryCta}
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
              Try the discovery
            </Link>
          </div>

          <p className="text-[12px] text-white/35 mb-10">
            50 free leads · no credit card · cancel any time
          </p>
        </div>

        {/* Live discovery preview */}
        <div id="try-it" className="max-w-5xl mx-auto px-5 sm:px-6 mt-6">
          <RevealOnScroll>
            <DiscoveryDemo
              cities={copy.demoCities}
              niches={copy.demoNiches}
              leads={copy.demoLeads}
              caption="Click any lead to see the audit. Keep scrolling for what happens next."
            />
          </RevealOnScroll>
        </div>
      </section>

      {/* PAINS + BEFORE/AFTER */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
                What Leadac AI fixes
              </p>
              <h2
                className="text-[34px] sm:text-[44px] font-semibold tracking-tight leading-[1.1]"
                style={{ letterSpacing: "-0.025em" }}
              >
                {copy.painsHeading}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {copy.pains.map((p, i) => {
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

          <RevealOnScroll>
            <div className="text-center mb-8">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-1.5">
                The swap
              </p>
              <p className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
                Same outbound motion. Different fuel.
              </p>
            </div>
            <BeforeAfterSplit
              beforeLabel={copy.beforeAfter.beforeLabel}
              afterLabel={copy.beforeAfter.afterLabel}
              freshLead={featuredLead}
            />
          </RevealOnScroll>
        </div>
      </section>

      {/* PROOF POINTS — scrollytelling */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
                What your week looks like
              </p>
              <h2
                className="text-[32px] sm:text-[48px] font-semibold tracking-tight leading-[1.05]"
                style={{ letterSpacing: "-0.03em" }}
              >
                {copy.proofTourTitle ?? copy.proofHeading}
              </h2>
            </div>
          </RevealOnScroll>

          <ScrollStage scenes={tourScenes} />

          {copy.proofPoints.length > 4 && (
            <RevealOnScroll>
              <div className="mt-20 max-w-3xl mx-auto">
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-3">
                  And the rest
                </p>
                <ul className="space-y-2">
                  {copy.proofPoints.slice(4).map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-xl text-[13.5px] text-white/70 leading-relaxed"
                      style={{
                        background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.5)",
                        border: "0.5px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <span className="w-1 h-1 rounded-full bg-(--leadac-300) mt-2 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>
          )}
        </div>
      </section>

      {/* QUOTE */}
      <section className="relative py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <ValidationQuote
              source={copy.validationQuote.source}
              text={copy.validationQuote.text}
              subreddit={copy.validationQuote.subreddit}
              upvotes={copy.validationQuote.upvotes}
              comments={copy.validationQuote.comments}
            />
          </RevealOnScroll>
        </div>
      </section>

      {/* PRICING */}
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

      {/* FAQ */}
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

      {/* CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--leadac-h) var(--leadac-s) 60% / 0.28), transparent 60%)",
          }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
          <RevealOnScroll>
            <h2
              className="text-[36px] sm:text-[52px] font-semibold tracking-tight mb-4 leading-[1.05]"
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
                background: "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 34%))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.7), 0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.45)",
              }}
            >
              Start free, no card
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}

function visualForScene(
  kind: (typeof SCENE_VISUALS)[number],
  lead: DemoLead,
  copy: VerticalCopy
): React.ReactNode {
  switch (kind) {
    case "discovery":
      return (
        <DiscoveryDemo
          cities={copy.demoCities}
          niches={copy.demoNiches}
          leads={copy.demoLeads}
          autoplayDelayMs={1100}
        />
      );
    case "leadCard":
      return (
        <div
          className="rounded-2xl p-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 100%)",
            border: "0.5px solid rgba(255,255,255,0.09)",
            boxShadow:
              "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.25)",
          }}
        >
          <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-(--leadac-300) mb-3">
            Lead detail
          </p>
          <LeadCardLive lead={lead} defaultExpanded />
        </div>
      );
    case "mockup":
      return <MockupGeneratorDemo lead={lead} />;
    case "opener":
      return <OpenerComposer lead={lead} />;
    case "pipeline":
      return <PipelineBoard business={lead.name} />;
  }
}
