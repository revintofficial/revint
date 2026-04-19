import {
  Database,
  MessageSquareDashed,
  Layers,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  DiscoveryDemo,
  ScrollStage,
  RevealOnScroll,
  MarketingBackdrop,
  MockupGeneratorDemo,
  OpenerComposer,
  PipelineBoard,
  LeadCardLive,
  SdrPodFrame,
  type ScrollScene,
} from "@/components/marketing/interactive";
import type { VerticalCopy } from "@/components/marketing/vertical-landing";
import {
  MarketingHero,
  PainsSection,
  ValidationSection,
  PricingSection,
  FaqSection,
  ClosingCta,
} from "@/components/marketing/landing-shared";

/**
 * AgenciesLanding - dedicated layout for /for/agencies (B2B outbound).
 *
 * The B2B outbound agency lives in a dual-monitor SDR pod: discovery /
 * prospect data on one screen, comms / pipeline on the other. The hero
 * visual is a literal SdrPodFrame with both surfaces live. The "swap"
 * middle section is the reply-rate transformation: 1% (AI personalization
 * at scale) to 3.8% (fresh signals + grounded openers), grounded in real
 * Reddit data from the engine research.
 */
export function AgenciesLanding({ copy }: { copy: VerticalCopy }) {
  const heroLeftLead = copy.demoLeads[0];
  const tourLead = copy.demoLeads[1] ?? copy.demoLeads[0];

  const tourScenes: ScrollScene[] = [
    {
      id: "agency-1",
      eyebrow: "SDR pod · 01",
      title: "Per-search discovery, not bulk-imported lists.",
      body: "Every list you pull is fresh from Maps. Audited on the way in. Your SDR sees what is broken before they decide who to pitch.",
      visual: (
        <SdrPodFrame
          leftUrl="leadengine.app/discovery"
          rightUrl="leadengine.app/leads/jamies-hvac"
          leftTab="Discovery"
          rightTab="Lead detail"
          leftScreen={
            <DiscoveryDemo
              cities={copy.demoCities}
              niches={copy.demoNiches}
              leads={copy.demoLeads}
              autoplayDelayMs={1100}
            />
          }
          rightScreen={
            <div className="p-3">
              <LeadCardLive lead={tourLead} defaultExpanded />
            </div>
          }
        />
      ),
    },
    {
      id: "agency-2",
      eyebrow: "SDR pod · 02",
      title: "Mockup is the personalization. Not GPT slop.",
      body: "Generate a one-page mockup using the prospect's actual reviews, services, and address. Attach the link in the opener. The receiving inbox can tell the difference.",
      visual: (
        <SdrPodFrame
          leftUrl="leadengine.app/leads/jamies-hvac/mockup"
          rightUrl="leadengine.app/leads/jamies-hvac/opener"
          leftTab="Mockup"
          rightTab="Opener"
          leftScreen={<MockupGeneratorDemo lead={tourLead} />}
          rightScreen={
            <div className="p-3">
              <OpenerComposer lead={tourLead} chromeless />
            </div>
          }
        />
      ),
    },
    {
      id: "agency-3",
      eyebrow: "SDR pod · 03",
      title: "Auto-send off. Your SDR ships the email.",
      body: "AI writes the draft, your SDR reads it once, hits send. Your domain does not burn while you sleep. Push to Smartlead in two clicks when you want volume.",
      visual: (
        <SdrPodFrame
          leftUrl="leadengine.app/pipeline"
          rightUrl="leadengine.app/leads/jamies-hvac/opener"
          leftTab="Pipeline"
          rightTab="Opener"
          leftScreen={<PipelineBoard business={tourLead.name} />}
          rightScreen={
            <div className="p-3">
              <OpenerComposer lead={tourLead} chromeless />
            </div>
          }
        />
      ),
    },
    {
      id: "agency-4",
      eyebrow: "SDR pod · 04",
      title: "One workspace. No tab toggling for one lead's status.",
      body: "Discovery, audit, mockup, opener, pipeline, voice notes. All in the same place. The SDR stops paying the focus tax of switching between four tools to update one record.",
      visual: (
        <SdrPodFrame
          leftUrl="leadengine.app/leads/jamies-hvac"
          rightUrl="leadengine.app/pipeline"
          leftTab="Lead detail"
          rightTab="Pipeline"
          leftScreen={
            <div className="p-3">
              <LeadCardLive lead={tourLead} defaultExpanded />
            </div>
          }
          rightScreen={<PipelineBoard business={tourLead.name} />}
        />
      ),
    },
  ];

  return (
    <>
      <MarketingHero
        eyebrow={copy.eyebrow}
        eyebrowIcon={Database}
        h1={copy.h1}
        h1Highlight={copy.h1Highlight}
        sub={copy.sub}
        primaryCta={copy.primaryCta}
        secondaryCtaLabel="See the SDR pod"
        footnote="50 free leads · no card · no Apollo seat, no Clay table"
        visual={
          <SdrPodFrame
            leftUrl="leadengine.app/discovery"
            rightUrl="leadengine.app/leads/jamies-hvac/opener"
            leftTab="Discovery"
            rightTab="Opener"
            leftScreen={
              <DiscoveryDemo
                cities={copy.demoCities}
                niches={copy.demoNiches}
                leads={copy.demoLeads}
                caption="One screen pulls fresh leads. The other ships the opener."
              />
            }
            rightScreen={
              <div className="p-3">
                <OpenerComposer lead={heroLeftLead} chromeless />
              </div>
            }
          />
        }
      />

      {/* PAINS + REPLY RATE SWAP */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <PainsSection
            eyebrow="What killed your last 6 months"
            heading={copy.painsHeading}
            pains={copy.pains}
          />

          <RevealOnScroll>
            <div className="text-center mt-20 mb-10">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#A5B4FC] mb-1.5">
                The swap
              </p>
              <p className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
                Different fuel beats louder personalization.
              </p>
              <p className="text-[12.5px] text-white/45 mt-2 max-w-md mx-auto">
                Numbers from r/coldemail and r/b2b_sales threads in the last 30 days.
              </p>
            </div>
            <ReplyRateSwap />
          </RevealOnScroll>
        </div>
      </section>

      {/* WORKFLOW TOUR */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#A5B4FC] mb-3">
                Same SDR seat, different fuel
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
                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#A5B4FC] mb-3">
                  And the rest of the stack
                </p>
                <ul className="space-y-2">
                  {copy.proofPoints.slice(4).map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-xl text-[13.5px] text-white/70 leading-relaxed"
                      style={{
                        background: "rgba(28,28,30,0.5)",
                        border: "0.5px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <span className="w-1 h-1 rounded-full bg-[#A5B4FC] mt-2 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealOnScroll>
          )}
        </div>
      </section>

      <ValidationSection
        source={copy.validationQuote.source}
        text={copy.validationQuote.text}
        subreddit={copy.validationQuote.subreddit}
        upvotes={copy.validationQuote.upvotes}
        comments={copy.validationQuote.comments}
      />

      <PricingSection />
      <FaqSection />

      <ClosingCta
        heading={copy.closingHeading}
        highlight={copy.closingHeadingHighlight}
        body={copy.closingBody}
      />
    </>
  );
}

/**
 * Reply rate swap: side-by-side AI-personalization-at-scale (tanking) vs
 * fresh-signals-grounded openers (recovering). Numbers come from the
 * engine's last30days research: 1% (rewrote 11 times, stayed at 1%), 3.8%
 * (changed one thing not about copy), 14.7% (timing within 48h of buying
 * signal). Each card includes a small bar visualization for at-a-glance
 * comparison.
 */
function ReplyRateSwap() {
  return (
    <div className="grid md:grid-cols-2 gap-6 lg:gap-10 items-stretch">
      {/* BEFORE: AI at scale */}
      <div
        className="rounded-2xl p-7 sm:p-9 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(40,28,30,0.4), rgba(28,18,22,0.3))",
          border: "0.5px solid rgba(248,113,113,0.18)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#F87171]" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#F87171]">
            AI personalization, scaled
          </p>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-[64px] sm:text-[80px] font-semibold leading-none tabular-nums"
            style={{ letterSpacing: "-0.04em", color: "#FCA5A5" }}
          >
            1%
          </span>
          <span className="text-[14px] text-white/45">reply rate ceiling</span>
        </div>
        <p className="text-[13.5px] text-white/55 leading-relaxed mb-5">
          Apollo list, GPT first-liner, scrape LinkedIn, send 200 a day. The
          inbox can spot it. Most replies are &quot;please remove me.&quot;
          Rewrote the copy 11 times. Reply rate stayed at 1%.
        </p>

        <div className="mt-auto">
          <ReplyRateBar value={1} max={15} accent="#F87171" />
        </div>
      </div>

      {/* AFTER: fresh signals, grounded */}
      <div
        className="rounded-2xl p-7 sm:p-9 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(28,30,46,0.55), rgba(20,22,36,0.45))",
          border: "0.5px solid rgba(94,106,210,0.32)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.45), 0 80px 200px rgba(49,46,129,0.22)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#A5B4FC]" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#A5B4FC]">
            Fresh signal + grounded opener
          </p>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-[64px] sm:text-[80px] font-semibold leading-none tabular-nums"
            style={{
              letterSpacing: "-0.04em",
              backgroundImage:
                "linear-gradient(120deg, #FFFFFF 0%, #C7CCFF 45%, #5E6AD2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            3.8%
          </span>
          <span className="text-[14px] text-white/45">
            after one change that was not the copy
          </span>
        </div>
        <p className="text-[13.5px] text-white/70 leading-relaxed mb-5">
          The signal is the personalization. Audit on the actual site,
          mockup the prospect can scroll, opener that references something
          real. The reply rate moves because the message stops looking like
          everyone else's outbound exhaust.
        </p>

        <div className="mt-auto space-y-3">
          <ReplyRateBar value={3.8} max={15} accent="#A5B4FC" />
          <div
            className="flex items-center gap-2 text-[11.5px] p-2.5 rounded-lg"
            style={{
              background: "rgba(94,106,210,0.1)",
              border: "0.5px solid rgba(94,106,210,0.22)",
              color: "#C7CCFF",
            }}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              Sent within 48h of a buying signal: 14.7%, per a 10,000-message r/b2b_sales analysis.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplyRateBar({
  value,
  max,
  accent,
}: {
  value: number;
  max: number;
  accent: string;
}) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.14em] font-semibold mb-1.5">
        <span style={{ color: accent }}>Reply rate</span>
        <span className="text-white/35">scale 0 - {max}%</span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background:
              accent === "#A5B4FC"
                ? "linear-gradient(90deg, #5E6AD2, #C7CCFF)"
                : `linear-gradient(90deg, ${accent}aa, ${accent})`,
          }}
        />
      </div>
    </div>
  );
}

// `Layers`, `MessageSquareDashed`, `Zap` are imported because the COPY
// objects on /for/agencies pages can reference them in `pains[].icon`.
// Re-export silences TS unused-import false positives in some editors.
export const _agencyIconBag = { Layers, MessageSquareDashed, Zap };
