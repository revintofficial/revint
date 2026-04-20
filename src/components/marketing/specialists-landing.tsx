import {
  Compass,
  Send,
  Briefcase,
  Wand2,
  Layers,
  GraduationCap,
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
 * SpecialistsLanding - dedicated layout for /for/specialists.
 *
 * The Klaviyo / Webflow / GHL specialist going independent is at a MacBook
 * with two browser tabs open at all times: their deliverable surface
 * (Klaviyo flow editor, Webflow Designer) and the new pipeline surface they
 * have never had to operate before. The "swap" middle section visualizes
 * exactly that: a stylized two-tab macOS browser composition - "Executor:
 * the deliverable you ship" vs "Operator: the pipeline you didn't".
 */
export function SpecialistsLanding({ copy }: { copy: VerticalCopy }) {
  const tourLead = copy.demoLeads[1] ?? copy.demoLeads[0];

  const tourScenes: ScrollScene[] = [
    {
      id: "spec-1",
      eyebrow: "Independent · 01",
      title: "Pull a fresh prospect list. Filter by site signal.",
      body: "Not buried Apollo exports. Not a friend's spreadsheet. Real local businesses pulled from Maps, scored by site freshness, ranked by which ones look most ready to buy what you ship.",
      visual: (
        <MacBookFrame
          url="leadac.ai/discovery"
          tabLabel="Discovery"
          tilt="left"
        >
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
      id: "spec-2",
      eyebrow: "Independent · 02",
      title: "Mockup that proves you understand their stack.",
      body: "Use their actual reviews, services, address. Send the link with the cold email. Replies start with 'how soon can you start' instead of 'who are you'.",
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
      id: "spec-3",
      eyebrow: "Independent · 03",
      title: "Opener in plain English. Edit, ship.",
      body: "The audit signals are the personalization. Drafted opener in your voice, references their site, no GPT-fabricated 'I noticed your bounce rate'. The first one sets the tone for the next fifty.",
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
      id: "spec-4",
      eyebrow: "Independent · 04",
      title: "Pipeline view, not a second CRM.",
      body: "Notes, status, voice memos, follow-up dates. All next to the lead. The 'how do agencies acquire clients' question turns into a workflow you can see.",
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
        eyebrowIcon={GraduationCap}
        h1={copy.h1}
        h1Highlight={copy.h1Highlight}
        sub={copy.sub}
        primaryCta={copy.primaryCta}
        secondaryCtaLabel="See the operator side"
        footnote="50 free leads · no card · the deliverable stays yours"
        visual={
          <MacBookFrame url="leadac.ai/discovery" tabLabel="Discovery">
            <DiscoveryDemo
              cities={copy.demoCities}
              niches={copy.demoNiches}
              leads={copy.demoLeads}
              caption="The pipeline surface you never saw. Open it in a second tab next to whatever you ship."
            />
          </MacBookFrame>
        }
      />

      {/* PAINS + EXECUTOR/OPERATOR SWAP */}
      <section className="relative py-24 sm:py-32">
        <MarketingBackdrop variant="muted" />
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <PainsSection
            eyebrow="Going independent"
            heading={copy.painsHeading}
            pains={copy.pains}
          />

          <RevealOnScroll>
            <div className="text-center mt-20 mb-10">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#A5B4FC] mb-1.5">
                The swap
              </p>
              <p className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
                The deliverable was always yours. The pipeline doesn't have to be.
              </p>
            </div>
            <ExecutorOperatorSwap />
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
                One MacBook, two tabs
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
                  And the rest of the operator stack
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
 * Executor / Operator swap: a single stylized macOS browser window with
 * two tabs visible. Left tab = the deliverable they already know
 * (Klaviyo, Webflow). Right tab = the pipeline surface (Leadac AI).
 * The active tab in the rendering is the right one - the pipeline they
 * never had to operate.
 */
function ExecutorOperatorSwap() {
  return (
    <div
      className="rounded-[14px] overflow-hidden mx-auto max-w-3xl"
      style={{
        background:
          "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 0.5px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.55), 0 80px 200px rgba(49,46,129,0.22)",
      }}
    >
      {/* Browser chrome */}
      <div
        className="px-3.5 pt-3 flex items-center gap-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(38,38,42,0.95), rgba(28,28,32,0.95))",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-1.5 pb-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: "#FF5F57" }}
          />
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: "#FEBC2E" }}
          />
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: "#28C840" }}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-end gap-1 -mb-px">
          <Tab label="Klaviyo · Flows" sub="executor" subIcon={Briefcase} />
          <Tab
            label="Leadac AI · Pipeline"
            sub="operator"
            subIcon={Compass}
            active
          />
        </div>
      </div>

      {/* Active tab content */}
      <div className="grid md:grid-cols-2 gap-0 divide-x divide-white/5">
        {/* Executor (left) - what they already know */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 className="w-3.5 h-3.5 text-white/45" />
            <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/45">
              Muscle memory
            </p>
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight mb-2">
            The deliverable
          </h3>
          <p className="text-[12.5px] text-white/55 leading-relaxed mb-4">
            Klaviyo flows. Webflow builds. Custom email templates. You shipped
            them in three agencies. Execution is the easy part.
          </p>
          <ul className="space-y-1.5 text-[12px] text-white/55">
            {[
              "Welcome flow + abandoned cart",
              "Custom Webflow CMS structure",
              "Brand-matched email templates",
              "QA checklist before send",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-white/35" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Operator (right) - what's new */}
        <div
          className="p-6"
          style={{
            background:
              "linear-gradient(180deg, rgba(28,30,46,0.45), rgba(20,22,36,0.35))",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-3.5 h-3.5 text-[#A5B4FC]" />
            <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[#A5B4FC]">
              The new tab
            </p>
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight mb-2">
            The pipeline
          </h3>
          <p className="text-[12.5px] text-white/70 leading-relaxed mb-4">
            Fresh prospect list. Audit on each one. Mockup ready before the
            call. Opener already drafted. The CEO posted on LinkedIn part of
            the agency, automated.
          </p>
          <ul className="space-y-1.5 text-[12px] text-white/75">
            {[
              { label: "50 audited prospects", icon: Compass },
              { label: "Custom mockup per lead", icon: Wand2 },
              { label: "Opener referencing their site", icon: Send },
              { label: "Pipeline + voice notes built in", icon: Layers },
            ].map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="w-3 h-3 text-[#A5B4FC]" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Tab({
  label,
  sub,
  subIcon: SubIcon,
  active = false,
}: {
  label: string;
  sub: string;
  subIcon: typeof Briefcase;
  active?: boolean;
}) {
  return (
    <div
      className="px-3 pt-2 pb-2.5 rounded-t-md flex items-center gap-2"
      style={{
        background: active
          ? "linear-gradient(180deg, rgba(20,20,24,1), rgba(14,14,18,1))"
          : "rgba(255,255,255,0.02)",
        border: active
          ? "0.5px solid rgba(255,255,255,0.06)"
          : "0.5px solid transparent",
        borderBottom: "none",
      }}
    >
      <SubIcon
        className="w-3 h-3"
        style={{ color: active ? "#A5B4FC" : "rgba(235,235,245,0.45)" }}
      />
      <span
        className="text-[11.5px] font-medium"
        style={{
          color: active
            ? "rgba(235,235,245,0.95)"
            : "rgba(235,235,245,0.55)",
        }}
      >
        {label}
      </span>
      <span
        className="text-[9.5px] uppercase tracking-[0.14em] font-semibold"
        style={{
          color: active ? "#A5B4FC" : "rgba(235,235,245,0.3)",
        }}
      >
        {sub}
      </span>
    </div>
  );
}
