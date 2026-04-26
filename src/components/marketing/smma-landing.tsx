import {
  Compass,
  Send,
  Briefcase,
  Sparkles,
  Clock,
  Inbox,
  Rocket,
} from "lucide-react";
import {
  DiscoveryDemo,
  ScrollStage,
  RevealOnScroll,
  MarketingBackdrop,
  MockupGeneratorDemo,
  OpenerComposer,
  PipelineBoard,
  MacBookFrame,
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
 * SmmaLanding - dedicated layout for /for/smma.
 *
 * Apple-style design vocabulary, but every demo lives inside a literal
 * MacBook Pro screen because the new SMMA owner is at a laptop in a coffee
 * shop, not on a doorstep with a tablet. The "swap" middle section is a
 * stopwatch comparison: 8 hours of manual prospecting vs 15 minutes of
 * Leadac AI + a shipped first 10 emails.
 */
export function SmmaLanding({ copy }: { copy: VerticalCopy }) {
  const tourLead = copy.demoLeads[1] ?? copy.demoLeads[0];

  const tourScenes: ScrollScene[] = [
    {
      id: "smma-1",
      eyebrow: "Coffee shop · 01",
      title: "Pick a city. 50 audited leads in 30 seconds.",
      body: "Type the niche, hit search. No Apollo seat, no Clay table, no scraping the wrong list off Google. Real local businesses with real audit signals.",
      visual: (
        <MacBookFrame url="leadac.ai/discovery" tabLabel="Discovery" tilt="left">
          <DiscoveryDemo
            cities={copy.demoCities}
            niches={copy.demoNiches}
            leads={copy.demoLeads}
            autoplayDelayMs={1100}
          />
        </MacBookFrame>
      ),
    },
    {
      id: "smma-2",
      eyebrow: "Coffee shop · 02",
      title: "One click, custom mockup for the first prospect.",
      body: "Hero, services, booking widget, price block. 20 seconds of generation. Send the link in the email and the call starts with 'how soon can we start' instead of 'who are you'.",
      visual: (
        <MacBookFrame
          url="leadac.ai/leads/jamies-hvac/mockup"
          tabLabel="Mockup"
          tilt="left"
        >
          <MockupGeneratorDemo lead={tourLead} />
        </MacBookFrame>
      ),
    },
    {
      id: "smma-3",
      eyebrow: "Coffee shop · 03",
      title: "Opener writes itself. You edit, you ship.",
      body: "Drafted from real audit signals on their actual site. Not 'I noticed your website' slop. The first 10 take fifteen minutes, not eight hours.",
      visual: (
        <MacBookFrame
          url="leadac.ai/leads/jamies-hvac/opener"
          tabLabel="Opener"
          tilt="left"
        >
          <div className="p-4 sm:p-5 h-full overflow-hidden">
            <OpenerComposer lead={tourLead} chromeless />
          </div>
        </MacBookFrame>
      ),
    },
    {
      id: "smma-4",
      eyebrow: "Coffee shop · 04",
      title: "Every conversation lives next to the lead.",
      body: "Notes, status, meeting outcomes. Voice memos auto-transcribed. No second CRM, no spreadsheet, no 'wait which one was that again' on Friday afternoon.",
      visual: (
        <MacBookFrame
          url="leadac.ai/pipeline"
          tabLabel="Pipeline"
          tilt="left"
        >
          <div className="h-full overflow-hidden">
            <PipelineBoard business={tourLead.name} />
          </div>
        </MacBookFrame>
      ),
    },
  ];

  return (
    <>
      <MarketingHero
        eyebrow={copy.eyebrow}
        eyebrowIcon={Rocket}
        h1={copy.h1}
        h1Highlight={copy.h1Highlight}
        sub={copy.sub}
        primaryCta={copy.primaryCta}
        secondaryCtaLabel="See the workflow"
        footnote="50 free leads · no credit card · works on your MacBook in any coffee shop"
        visual={
          <MacBookFrame url="leadac.ai/discovery" tabLabel="Discovery">
            <DiscoveryDemo
              cities={copy.demoCities}
              niches={copy.demoNiches}
              leads={copy.demoLeads}
              caption="Pick a city, hit search, see the audit. The first 10 emails ship from this screen."
            />
          </MacBookFrame>
        }
      />

      {/* PAINS + STOPWATCH SWAP */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <PainsSection
            eyebrow="Reality of the first 90 days"
            heading={copy.painsHeading}
            pains={copy.pains}
          />

          <RevealOnScroll>
            <div className="text-center mt-20 mb-10">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-1.5">
                The swap
              </p>
              <p className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
                Same first 10 emails. Different morning.
              </p>
            </div>
            <StopwatchSwap />
          </RevealOnScroll>
        </div>
      </section>

      {/* WORKFLOW TOUR */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
              <p className="text-[12px] uppercase tracking-[0.15em] font-semibold text-(--leadac-300) mb-3">
                Your morning at the laptop
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
                  And the rest of the day
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
 * Stopwatch swap: two cards side by side. Left = "8 hours" (manual), right
 * = "15 minutes" (Leadac AI), each with a stylized analog stopwatch.
 * Numbers are deliberately specific - "first 10 emails" is the unit the
 * SMMA founder actually thinks in.
 */
function StopwatchSwap() {
  return (
    <div className="grid md:grid-cols-2 gap-6 lg:gap-10 items-stretch">
      {/* BEFORE */}
      <div
        className="rounded-2xl p-7 sm:p-9 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(40,28,30,0.4), rgba(28,18,22,0.3))",
          border: "0.5px solid hsl(4 62% 70% / 0.18)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[hsl(4 62% 70%)]" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[hsl(4 62% 70%)]">
            Manual prospecting
          </p>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-[64px] sm:text-[80px] font-semibold leading-none tabular-nums"
            style={{ letterSpacing: "-0.04em", color: "hsl(4 42% 72%)" }}
          >
            8h
          </span>
          <span className="text-[14px] text-white/45">to ship 10 emails</span>
        </div>
        <p className="text-[13.5px] text-white/55 leading-relaxed mb-5">
          Apollo seat, Google Maps tab, Loom of their site, ChatGPT for the
          opener, paste, paste, paste. By 6pm you have ten emails out and zero
          energy left for the rest of the week.
        </p>

        <ul className="mt-auto space-y-1.5 text-[12px] text-white/45">
          {[
            "Apollo: build list (60 min)",
            "Inspect 10 sites by hand (90 min)",
            "Write 10 first lines (180 min)",
            "Draft 10 opener bodies (120 min)",
            "Find emails, send (30 min)",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[hsl(4 62% 70%)]/60" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* AFTER */}
      <div
        className="rounded-2xl p-7 sm:p-9 flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(28,30,46,0.55), rgba(20,22,36,0.45))",
          border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.32)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.45), 0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.22)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-(--leadac-300)" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-(--leadac-300)">
            With Leadac AI
          </p>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-[64px] sm:text-[80px] font-semibold leading-none tabular-nums"
            style={{
              letterSpacing: "-0.04em",
              backgroundImage:
                "linear-gradient(120deg, #FFFFFF 0%, hsl(var(--leadac-h) var(--leadac-s) 88%) 45%, hsl(var(--leadac-h) var(--leadac-s) 50%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            15m
          </span>
          <span className="text-[14px] text-white/45">to ship the same 10</span>
        </div>
        <p className="text-[13.5px] text-white/70 leading-relaxed mb-5">
          One search, 50 audited prospects. Mockup per shortlisted lead.
          Drafted opener referencing their site. Edit the parts that need your
          voice and send. The afternoon is yours for the call backs.
        </p>

        <ul className="mt-auto space-y-1.5 text-[12px] text-white/65">
          {[
            { label: "Pull leads from Maps", t: "30 sec", icon: Compass },
            { label: "Audit signals attached", t: "auto", icon: Inbox },
            { label: "Mockup per lead", t: "20 sec", icon: Sparkles },
            { label: "Opener drafted, you edit", t: "8 min", icon: Send },
            { label: "Send batch", t: "2 min", icon: Briefcase },
          ].map(({ label, t, icon: Icon }) => (
            <li
              key={label}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <Icon className="w-3 h-3 text-(--leadac-300)" />
                {label}
              </span>
              <span className="text-white/40 tabular-nums">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
