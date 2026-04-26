import Link from "next/link";
import {
  ArrowRight,
  AlertOctagon,
  Sparkles,
  CheckCircle2,
  Send,
  Tablet as TabletIcon,
} from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import {
  DiscoveryDemo,
  ScrollStage,
  RevealOnScroll,
  ValidationQuote,
  MarketingBackdrop,
  MockupGeneratorDemo,
  OpenerComposer,
  TabletFrame,
  PhoneFrame,
  VoiceMemoCard,
  WalkRouteCard,
  type ScrollScene,
} from "@/components/marketing/interactive";
import type { VerticalCopy } from "@/components/marketing/vertical-landing";

/**
 * WalkInLanding - dedicated layout for /for/walk-in-web-agencies.
 *
 * Same Apple-style design language as the shared VerticalLanding (dark glass
 * cards, indigo gradient hero, RevealOnScroll, ScrollStage, soft shadows),
 * but every demo lives inside a literal iPad bezel. The proof tour is
 * reordered to put the "magic moment" (mockup generated, owner reaches for
 * the tablet) at scene 2, and the kanban PipelineBoard is dropped entirely
 * because kanban does not belong on a doorstep.
 *
 * Two new field-specific primitives carry the bottom half of the tour:
 *   - VoiceMemoCard: 30-second waveform + auto-transcribed snippet, attached
 *     to a lead. Maps to the "voice memo on the way to the next door" beat.
 *   - WalkRouteCard: Apple Maps-flavored stop list, sorted by walking
 *     distance. Maps to the "GPS sorts the next 30 leads" beat.
 *
 * The end-of-day card swaps the iPad for an iPhone (PhoneFrame) holding the
 * OpenerComposer because the copy is explicit: the follow-up email gets
 * shipped from the sofa, not the tablet.
 */
export function WalkInLanding({ copy }: { copy: VerticalCopy }) {
  const featuredLead = copy.demoLeads[0];
  const tourLead = copy.demoLeads[1] ?? copy.demoLeads[0];

  const tourScenes: ScrollScene[] = [
    {
      id: "tour-1",
      eyebrow: "Doorstep · 01",
      title: "Type 'Camden + plumber' in the cab.",
      body: "47 audited leads loaded before the first knock, sorted by which sites are most broken. The iPad is your cold file the second you stand up.",
      visual: (
        <TabletFrame appLabel="Leadac AI" tilt="left">
          <DiscoveryDemo
            cities={copy.demoCities}
            niches={copy.demoNiches}
            leads={copy.demoLeads}
            autoplayDelayMs={1100}
          />
        </TabletFrame>
      ),
    },
    {
      id: "tour-2",
      eyebrow: "Doorstep · 02",
      title: "Hand him the tablet. Watch his shoulders drop.",
      body: "20 seconds of generation and he is looking at his own services, his own reviews, a booking button, a price. Most owners stop arguing once they are touching it.",
      visual: (
        <TabletFrame appLabel="Leadac AI - Mockup" tilt="left">
          <MockupGeneratorDemo lead={tourLead} />
        </TabletFrame>
      ),
    },
    {
      id: "tour-3",
      eyebrow: "Doorstep · 03",
      title: "30 seconds of voice on the walk to the next door.",
      body: "Auto-transcribed and pinned to the lead before you knock again. No 'I'll write it up tonight' lie that you forget by 9pm.",
      visual: (
        <TabletFrame appLabel="Voice Memos" tilt="left">
          <VoiceMemoCard />
        </TabletFrame>
      ),
    },
    {
      id: "tour-4",
      eyebrow: "Doorstep · 04",
      title: "Next door. Sorted by walking distance.",
      body: "The crew never argues about who walks where. GPS does it. Hackney in the morning, Hammersmith after lunch, the route writes itself.",
      visual: (
        <TabletFrame appLabel="Maps" tilt="left">
          <WalkRouteCard />
        </TabletFrame>
      ),
    },
  ];

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
            <TabletIcon className="w-3 h-3 text-(--leadac-300)" />
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
              See it on the iPad
            </Link>
          </div>

          <p className="text-[12px] text-white/35 mb-10">
            50 free leads · no credit card · works on iPad, Android tablet, anything with a browser
          </p>
        </div>

        {/* Live discovery preview, framed as the iPad you'd carry */}
        <div id="try-it" className="max-w-5xl mx-auto px-5 sm:px-6 mt-6">
          <RevealOnScroll>
            <TabletFrame appLabel="Leadac AI" tilt="none">
              <DiscoveryDemo
                cities={copy.demoCities}
                niches={copy.demoNiches}
                leads={copy.demoLeads}
                caption="Tap any lead to see the audit. Keep scrolling for the doorstep."
              />
            </TabletFrame>
          </RevealOnScroll>
        </div>
      </section>

      {/* DOORSTEP REALITY (pains) */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
                Reality on the doorstep
              </p>
              <h2
                className="text-[34px] sm:text-[44px] font-semibold tracking-tight leading-[1.1]"
                style={{ letterSpacing: "-0.025em" }}
              >
                {copy.painsHeading}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-5 mb-20">
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

          {/* THE SWAP: paper brochure vs iPad */}
          <RevealOnScroll>
            <div className="text-center mb-10">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-1.5">
                The swap
              </p>
              <p className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
                Same crew. Different thing in their hand.
              </p>
            </div>
            <BrochureVsTablet
              beforeLabel={copy.beforeAfter.beforeLabel}
              afterLabel={copy.beforeAfter.afterLabel}
              lead={featuredLead}
            />
          </RevealOnScroll>
        </div>
      </section>

      {/* DOORSTEP TOUR (scrollytelling, all visuals iPad-framed) */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
                One morning, one tablet
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
        </div>
      </section>

      {/* END OF THE DAY: pricing callout + iPhone OpenerComposer */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
                End of the day
              </p>
              <h2
                className="text-[32px] sm:text-[42px] font-semibold tracking-tight leading-[1.1]"
                style={{ letterSpacing: "-0.025em" }}
              >
                Tablet stays in the bag. Phone ships the follow-ups.
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
            <RevealOnScroll>
              <div
                className="p-7 sm:p-9 rounded-2xl h-full"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.6), hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.4))",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-3">
                  Pro Team
                </p>
                <p
                  className="text-[40px] sm:text-[52px] font-semibold tracking-tight leading-none mb-1"
                  style={{ letterSpacing: "-0.025em" }}
                >
                  $149<span className="text-[20px] text-white/45 font-medium">/mo</span>
                </p>
                <p className="text-[14px] text-white/55 mb-7">
                  Three of you. Shared workspace, voice notes, mockups, the lot. One signed deposit covers it for a year.
                </p>

                <ul className="space-y-2.5 mb-7">
                  {[
                    "Three seats, one shared pipeline",
                    "Push 'maybe' leads to Smartlead at night",
                    "Auto-send stays off - you ship the email",
                    "GPS-sorts the next morning's route",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2.5 text-[13.5px] text-white/75 leading-relaxed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-(--leadac-300) shrink-0 mt-0.5" />
                      {line}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-(--leadac-200) hover:text-white group"
                >
                  See full pricing
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.08}>
              <div className="flex items-center justify-center max-w-[300px] sm:max-w-[340px] mx-auto">
                <PhoneFrame appLabel="Mail">
                  <div className="h-full overflow-hidden">
                    <OpenerComposer lead={featuredLead} chromeless />
                  </div>
                </PhoneFrame>
              </div>
              <p className="text-[11.5px] text-white/40 text-center mt-4 max-w-xs mx-auto">
                <Send className="w-3 h-3 inline mr-1 -translate-y-px" />
                The follow-up writes itself. One of you ships it from the sofa.
              </p>
            </RevealOnScroll>
          </div>
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
        {/* Ghost iPad silhouette */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[640px] h-[440px] rounded-[36px] opacity-[0.08]"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02))",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center relative">
          <RevealOnScroll>
            <h2
              className="text-[36px] sm:text-[52px] font-semibold tracking-tight mb-4 leading-[1.05]"
              style={{ letterSpacing: "-0.03em" }}
            >
              {copy.closingHeading}
              <br />
              <span className="text-white/55">
                {copy.closingHeadingHighlight}
              </span>
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

/**
 * The swap section: paper brochure on the left (binned by 6pm), iPad with
 * the live mockup on the right (the owner scrolls through it himself).
 * Kept inline because it is specific to this layout and not reusable
 * elsewhere.
 */
function BrochureVsTablet({
  beforeLabel,
  afterLabel,
  lead,
}: {
  beforeLabel: string;
  afterLabel: string;
  lead: import("@/components/marketing/interactive").DemoLead;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-6 lg:gap-10 items-center">
      {/* BEFORE: paper brochure */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertOctagon className="w-4 h-4 text-[hsl(4 62% 70%)]" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[hsl(4 62% 70%)]">
            {beforeLabel}
          </p>
        </div>
        <div className="relative mx-auto max-w-[360px] aspect-3/4 transform-[rotate(-3deg)]">
          {/* Paper shadow */}
          <div
            aria-hidden
            className="absolute inset-2 rounded-md blur-xl opacity-40"
            style={{ background: "rgba(0,0,0,0.6)" }}
          />
          {/* Paper itself */}
          <div
            className="relative w-full h-full rounded-md p-6 flex flex-col"
            style={{
              background:
                "linear-gradient(180deg, #F8F4EC 0%, #ECE6D8 100%)",
              boxShadow:
                "0 1px 0 rgba(0,0,0,0.04) inset, 0 18px 40px rgba(0,0,0,0.45)",
              backgroundImage:
                "linear-gradient(180deg, #F8F4EC 0%, #ECE6D8 100%), repeating-linear-gradient(0deg, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 1px, transparent 1px, transparent 28px)",
            }}
          >
            <div className="text-center mb-4">
              <p
                className="text-[18px] font-bold tracking-tight"
                style={{ color: "#3A2E1F" }}
              >
                LONDON WEB CO.
              </p>
              <p
                className="text-[10px] uppercase tracking-[0.18em] mt-1"
                style={{ color: "rgba(58,46,31,0.5)" }}
              >
                Modern websites · Fast delivery
              </p>
            </div>

            <div
              className="flex-1 rounded-sm mb-3"
              style={{
                background:
                  "repeating-linear-gradient(135deg, rgba(58,46,31,0.05), rgba(58,46,31,0.05) 6px, transparent 6px, transparent 14px)",
              }}
            />

            <div className="space-y-1.5 mb-3">
              <div
                className="h-1.5 w-full rounded-full"
                style={{ background: "rgba(58,46,31,0.18)" }}
              />
              <div
                className="h-1.5 w-4/5 rounded-full"
                style={{ background: "rgba(58,46,31,0.14)" }}
              />
              <div
                className="h-1.5 w-3/5 rounded-full"
                style={{ background: "rgba(58,46,31,0.12)" }}
              />
            </div>

            <p
              className="text-center text-[10px] tracking-wide"
              style={{ color: "rgba(58,46,31,0.55)" }}
            >
              hello@londonweb.co · 020 0000 0000
            </p>

            {/* Stamp */}
            <div
              aria-hidden
              className="absolute -right-3 top-6 px-3 py-1 transform-[rotate(8deg)] rounded-sm"
              style={{
                border: "1.5px solid rgba(220,38,38,0.55)",
                color: "rgba(220,38,38,0.7)",
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.18em",
                background: "rgba(255,255,255,0.4)",
              }}
            >
              BINNED BY 6PM
            </div>
          </div>
        </div>
      </div>

      {/* AFTER: iPad with mockup */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-(--leadac-300)" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-(--leadac-300)">
            {afterLabel}
          </p>
        </div>
        <div className="max-w-[480px] mx-auto">
          <TabletFrame appLabel="Leadac AI - Mockup" tilt="right">
            <MockupGeneratorDemo lead={lead} />
          </TabletFrame>
        </div>
      </div>
    </div>
  );
}
