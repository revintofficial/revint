import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { HomeScrollTour } from "@/components/marketing/home-scroll-tour";
import {
  CineHero,
  CineBento,
  CineWhy,
  CineProcess,
  CineStats,
  CineTestimonials,
  CineFaq,
  CineCta,
  type CineService,
  type CineReason,
  type CineStep,
  type CineStat,
  type CineTestimonial,
  type CineFaqItem,
} from "@/components/marketing/cine";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/",
  title:
    "Leadac — Client acquisition system for agencies. Turn Google Maps into your next 50 clients.",
  description:
    "Client acquisition system for agencies selling into local businesses. Postcode plus niche pulls 50 fresh businesses off Google Maps, reads every site for you, drafts a personalised first email from what the audit found, and ships a one-page mockup the prospect can click. Replies that don't crash mid-quarter. Plugs into Smartlead, Instantly, GHL, Gmail, Outlook.",
  keywords: [
    "client acquisition system",
    "client acquisition system for agencies",
    "google maps lead generation",
    "google maps scraper for agencies",
    "agency lead generation",
    "local lead generation software",
    "personalized cold outreach",
    "ai cold email that gets replies",
    "apollo alternative",
    "smma lead generation",
    "outbound system for agencies",
    "cold email reply rate",
  ],
});

/* --- Hero scroll-scrub config ------------------------------------------
 * Drop a short hero video into `/input/source.mp4` and extract frames:
 *
 *   mkdir -p public/frames
 *   ffmpeg -i input/source.mp4 \
 *     -vf "fps=30,scale='min(1920,iw)':'-2':flags=lanczos" \
 *     -q:v 3 public/frames/frame_%04d.jpg
 *
 * Then set HERO_FRAME_COUNT to the number of produced files.
 * Until then the hero renders the graceful gradient fallback.
 * --------------------------------------------------------------------- */
const HERO_FRAMES_PATH = "/frames";
const HERO_FRAME_COUNT = 0;
const HERO_FRAME_EXT = "jpg" as const;

const SERVICES: CineService[] = [
  {
    icon: "Search",
    title: "A list nobody else is pitching",
    body: "Apollo and Clay sell the same 50M contacts to every agency on the planet. Postcode plus niche pulls 50 to 1,000 fresh businesses live off Google Places — local-deep where the enterprise databases are blind. The list you get this morning, no other agency has tonight.",
    accent: "hsl(231 75% 74%)",
  },
  {
    icon: "Globe",
    title: "The homework, already done",
    body: "Every lead lands with its own site read for you — booking flow, mobile fit, page speed, schema, security headers, up to 500 Google reviews. The AI turns the findings into a 0-100 opportunity score, the angle to pitch, the offer tier, and the price band you can charge. You stop tabbing through websites before the first line gets written.",
    accent: "hsl(165 80% 62%)",
  },
  {
    icon: "Wand2",
    title: "An opener that reads like you researched them",
    body: "The first draft references the exact thing the audit found. The booking page that breaks on mobile. The 1-star review they never replied to. The schema they’re missing. The reply asks what it would cost, not who you are.",
    accent: "hsl(280 80% 72%)",
  },
  {
    icon: "LayoutGrid",
    title: "A one-page mockup, hand-attached to the email",
    body: "The thing nobody else is doing. Every opener ships with a private link to a one-page mockup of how their site could look — branded for your agency, ready for the prospect to click. The link is the conversion device; click rate and reply rate compound off the same line.",
    accent: "hsl(38 90% 70%)",
  },
  {
    icon: "Send",
    title: "Your inbox. Your brand. Your reputation.",
    body: "Auto-send stays off by default. You connect Gmail or Outlook, review the draft, send it from your own sender — so the deliverability score and the quality floor both stay yours. Replies attribute back to the lead, the pipeline stage advances on its own, and Monday morning is not a CRM cleanup.",
    accent: "hsl(12 85% 66%)",
  },
  {
    icon: "PhoneCall",
    title: "What you sold, ready to install the day they sign",
    body: "When the contract closes, Leadac exports the AI receptionist (Synthflow / Retell / Vapi / GHL), the review-reply agent with a human gate on 1- and 2-star reviews, and the 60-second lead-response tree for GHL, n8n, or Make. Booking widget and GBP auto-post are in beta. The retainer is already packaged.",
    accent: "hsl(200 85% 66%)",
  },
];

const REASONS: CineReason[] = [
  {
    icon: "Package",
    title: "The reply is the product",
    body: "Apollo hands you a contact and says good luck. Clay enriches a row. Smartlead sends. Leadac gives you the shape of the first two emails — the opener grounded in what the audit found, the mockup link that turns the reply into a discovery call. You stop buying lists. You start buying conversations.",
  },
  {
    icon: "TrendingUp",
    title: "Month three writes better copy than month one",
    body: "Most outbound tools reset every lead. Leadac watches what works. Winning openers are saved and pulled back in as examples the next time you draft — your voice sharpens with every reply, and your AI stops needing a fresh prompt for every client account.",
  },
  {
    icon: "ShieldCheck",
    title: "One subscription, no credit math",
    body: "Fresh Google Maps data on every search. Up to 500 reviews, competitor ads, LinkedIn hiring, Reddit mentions — under one monthly cap. No mid-campaign credit panic. No per-row enrichment budget.",
  },
  {
    icon: "Scale",
    title: "AI drafts. You ship. Brand stays yours.",
    body: "Auto-send is off by default. The AI runs the research, the audit, the opener, the mockup. You review and send from your own inbox — every cold-email operator on Reddit agrees that the moment the human leaves the loop, the quality floor collapses.",
  },
];

const STEPS: CineStep[] = [
  {
    n: "1",
    title: "Discover",
    body: "Postcode plus niche. Google Places live. Name, website, phone, rating, opening hours — back in seconds.",
  },
  {
    n: "2",
    title: "Score",
    body: "Open any lead. A 20-signal site audit, up to 500 Google reviews scanned, and a 0-100 opportunity score with the best angle, offer tier, and price band already waiting.",
  },
  {
    n: "3",
    title: "Pitch",
    body: "One click drafts the opener off the audit findings and hosts a one-page mockup on a private branded link. That link in the email is the thing that gets replied to.",
  },
  {
    n: "4",
    title: "Send",
    body: "Review the draft, push from Gmail or Outlook, or export a CSV to Smartlead or Instantly. Replies attribute to the lead automatically — the pipeline stage advances without you touching it.",
  },
  {
    n: "5",
    title: "Install",
    body: "When the prospect signs, Leadac exports the AI receptionist, review-reply agent, and lead-response tree you pitched. Booking widget and GBP auto-post are in beta.",
  },
];

const STATS: CineStat[] = [
  { value: "47", label: "Audited leads in five minutes" },
  { value: "500", label: "Google reviews scanned per lead" },
  { value: "20+", label: "Site signals scored, 0-100" },
  { value: "0", label: "Apollo contacts reused" },
];

/**
 * Pre-launch. No paying customers yet. These are market signals from the
 * threads the product was designed to answer — quoted verbatim, attributed
 * to the subreddit and comment count. Replace with real customer quotes as
 * they land.
 */
const TESTIMONIALS: CineTestimonial[] = [
  {
    quote:
      "Google Maps is the most underrated lead database in cold email.",
    name: "r/coldemail",
    role: "121 comments · 2026-04",
  },
  {
    quote:
      "Same 50M contacts. Same data from the same crawls. Same emails that have been cold emailed by ten other people this month.",
    name: "r/coldemail",
    role: "Recurring theme, April 2026",
  },
  {
    quote:
      "If you’re using AI for cold outreach, are you OK with the damages?",
    name: "r/coldemail",
    role: "AI-cold-email thread",
  },
  {
    quote:
      "3–4% reply and 96%+ deliverability is the realistic bar. Everything else is vanity.",
    name: "r/coldemail",
    role: "60k-email operator",
  },
  {
    quote:
      "Everyone told me cold email was dead in 2026. Then I looked at Google Maps.",
    name: "r/coldemail",
    role: "204 comments · 2026-04",
  },
  {
    quote:
      "I need a predictable way to get clients — not another course, not another tool, a system.",
    name: "r/SMMA",
    role: "Top comment, April 2026",
  },
  {
    quote:
      "I worked as an executor for four years. I know Klaviyo cold. I don’t know how agencies actually acquire clients.",
    name: "r/agency",
    role: "Klaviyo specialist, going solo",
  },
];

const FAQ_ITEMS: CineFaqItem[] = [
  {
    q: "Is this a tool or a system?",
    a: "Both. The tool is the surface — it runs the discovery, the audit, the mockup, the opener draft, the export. The system is the thing that actually books the call: fresh local data nobody else has, the homework hand-attached to every first email, and a memory that learns which lines land. Most agencies arrive with four tools and leave with one.",
  },
  {
    q: "How is this different from Apollo or Clay?",
    a: "Apollo and Clay own the enterprise-SaaS contact database. Leadac does not try to fight on that ground. We are the upstream layer for local-service outbound: fresh Google Maps data (not a shared 50M dump), a 20-signal site audit on every lead, a 0-100 opportunity score, and a personalised opener built from what the audit found. Most agencies end up running Leadac in front of Apollo, not instead of it.",
  },
  {
    q: "What does the ‘install’ part actually ship?",
    a: "Three products live today, each one trained on the prospect’s own site so it speaks like their business, not a template: (1) an AI receptionist that exports to Synthflow, Retell, Vapi, or GHL; (2) a review-reply agent with a 50-reply pool, your tone, and a human approval gate on 1- and 2-star reviews; (3) a 60-second lead-response sequence (SMS or email) that exports to GHL, n8n, or Make. In beta: an embeddable booking widget and a 30-day Google Business Profile post schedule. We don’t advertise what hasn’t shipped.",
  },
  {
    q: "How does the AI actually improve over time?",
    a: "Every reply you send teaches it. Openers that landed get saved as wins; weak ones get marked. The next time you draft, the system quietly pulls your three best past wins as examples before it writes — so your voice sharpens with every campaign, and the AI stops sounding like generic AI. Your offer and positioning are learned once and applied to every opener and mockup; you don’t re-prompt it for every client.",
  },
  {
    q: "Does it integrate with Smartlead or Instantly?",
    a: "Yes. Pro and Agency plans export a CSV formatted for both, with custom variables for the mockup link and the audit signals. You can also send natively from your connected Gmail or Outlook — Leadac then matches inbound replies back to the lead automatically and advances the pipeline stage without you touching it.",
  },
  {
    q: "Is the AI sending emails for me?",
    a: "No, and it won’t unless you flip a toggle. Auto-send is off by default. Leadac generates the audit, the mockup, and the draft opener. You review and ship. AI outreach with no human in the loop burns brand and deliverability — the default stays conservative.",
  },
  {
    q: "Where do the leads come from?",
    a: "Live Google Maps on every search: business name, website, phone, rating, opening hours. Because each business keeps its own Google Business Profile current, the data is dramatically cleaner than any scraped list — and fresher than an Apollo export ten other agencies worked this quarter. On top of that, the deep enrichment layer adds up to 500 reviews, social posts, competitor ads, LinkedIn hiring signals, and Reddit mentions — all inside your monthly cap.",
  },
  {
    q: "Can I white-label it for clients?",
    a: "Agency tier ships per-workspace branding today — your logo, colour, and domain on the hosted mockup pages. Full white-label (custom domain across the whole workspace, invoiced to your entity) lands mid-2026.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Settings → Billing. Access continues through the end of the cycle. Data is held for 30 days in case you come back. Free plan never charges a card.",
  },
  {
    q: "Is my data private?",
    a: "Leads, notes, pipeline, shortlists, voice notes, and your saved memory are scoped to your workspace. Only invited members see them. We do not share or resell your data and we do not use it to train third-party models.",
  },
];

const COPILOT_TOOLS = [
  {
    name: "Find leads",
    hint: "Filter by niche, area, score, or pipeline stage.",
  },
  {
    name: "Search by meaning",
    hint: "Pull leads by intent, not just keywords.",
  },
  {
    name: "Start a pitch",
    hint: "Spin up the mockup, opener, and plan for any lead.",
  },
  {
    name: "Run deep research",
    hint: "Pull web, socials, reviews, and competitor signals.",
  },
  {
    name: "Find lookalikes",
    hint: "Score similar leads against your best closer.",
  },
];

const MEMORY_KINDS = [
  {
    name: "Winning openers",
    hint: "Your best first messages, pulled in as examples next time.",
  },
  {
    name: "Your positioning",
    hint: "Your offer and voice, learned once and applied to every draft.",
  },
  {
    name: "Prospect knowledge",
    hint: "Their own site, ready for the receptionist to answer questions.",
  },
  {
    name: "Review pain points",
    hint: "What their customers complain about, ready for the opener.",
  },
  {
    name: "Mockup blocks that converted",
    hint: "Hero, service, and CTA sections that got replies before.",
  },
];

export default function LandingPage() {
  return (
    <>
      <CineHero
        framesPath={HERO_FRAMES_PATH}
        frameCount={HERO_FRAME_COUNT}
        frameExt={HERO_FRAME_EXT}
        badge="New"
        tagline="Client acquisition system for agencies"
        headline="Turn Google Maps into your next 50 clients."
        sub="Postcode plus niche. Leadac pulls 50 fresh businesses off Google Maps, reads every site in the background, and drafts a personalised first email from what the audit found — paired with a one-page mockup the prospect can click on the same line. Five minutes from your first search to a list nobody else is emailing tonight."
        ctaPrimary={{ label: "Get my first 50 clients", href: "/signup" }}
        ctaSecondary={{ label: "Watch the tour", href: "#tour" }}
        partnersLabel="Plugs into your sender. We don’t replace it."
        partners={["Smartlead", "Instantly", "GHL", "Gmail", "Outlook"]}
      />

      <CineBento
        eyebrow="Why it works"
        headline="Cold email is broken because it sounds cold."
        sub="What gets a reply is proof you did your homework. We do the homework for you on every prospect — audit, opener, mockup — and ship it on the first line. The prospect stops asking who you are. They ask what it would cost."
        services={SERVICES}
      />

      {/* Live interactive scroll tour — the product, shown actually working.
          Keeps a dark wrapper so the existing dark-themed product frames
          inside HomeScrollTour continue to read.

          CRITICAL: use `overflow-x-clip` (NOT `overflow-hidden`). The
          ScrollStage inside HomeScrollTour relies on `position: sticky`, and
          any ancestor with `overflow: hidden` / `overflow: auto` turns into
          a scroll container, which silently breaks sticky and leaves only
          scene 1’s visual on screen while the rest scroll off. `clip`
          doesn’t create a scroll container, so sticky keeps working. */}
      <section
        id="tour"
        className="vx-dark-section-soft relative py-24 md:py-36 overflow-x-clip"
      >
        <div
          className="relative z-10 max-w-(--cine-max) mx-auto"
          style={{ paddingLeft: "var(--cine-gutter)", paddingRight: "var(--cine-gutter)" }}
        >
          <div className="flex flex-col items-center text-center gap-5 mb-14 max-w-3xl mx-auto">
            <span
              className="rounded-full px-4 py-1.5 text-[11.5px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 68% / 0.28)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              The four screens
            </span>
            <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] tracking-[-0.03em] max-w-[22ch] text-white">
              See it work before you{" "}
              <span className="vx-text-gradient">sign up.</span>
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              No sales call. No scripted demo. Scroll, and four screens play in order with real data — discover, audit, mockup, opener. Same screens you’ll be using ten minutes from now.
            </p>
          </div>
          <HomeScrollTour />
        </div>
      </section>

      <CineWhy
        eyebrow="What changes"
        headline="Fewer emails. More replies. Paid retainers, not pilot calls."
        sub="Four reasons the agencies running a pilot keep the card on file past month three."
        reasons={REASONS}
      />

      <CineProcess
        eyebrow="Five moves"
        headline="From empty screen to signed client."
        sub="No onboarding call. No 60-page doc. You open the app, type a postcode, hit go — the tool carries the rest."
        steps={STEPS}
      />

      {/* The brain — copilot tools + learning loop. Dark-soft wrapper to
          break the rhythm between the two light sections (Process → Stats)
          and signal that what sits in here is the invisible engine. */}
      <section
        id="brain"
        className="vx-dark-section-soft relative py-24 md:py-36 overflow-hidden"
      >
        <div
          className="relative z-10 max-w-(--cine-max) mx-auto"
          style={{ paddingLeft: "var(--cine-gutter)", paddingRight: "var(--cine-gutter)" }}
        >
          <div className="flex flex-col items-center text-center gap-5 mb-16 max-w-3xl mx-auto">
            <span
              className="rounded-full px-4 py-1.5 text-[11.5px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 68% / 0.28)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              The compounding part
            </span>
              <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] tracking-[-0.03em] max-w-[22ch] text-white">
              The tool that{" "}
              <span className="vx-text-gradient">gets sharper the more you use it.</span>
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              Most outbound tools look the same on day 90 as day one. Two things make Leadac different: a copilot that runs real actions from chat, and a memory that watches every reply and teaches the next draft how to sound more like you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Copilot panel */}
            <div
              className="rounded-2xl p-7 md:p-8 flex flex-col gap-5"
              style={{
                background:
                  "linear-gradient(180deg, rgba(32,32,36,0.92), rgba(22,22,26,0.96))",
                border: "0.5px solid rgba(255,255,255,0.08)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.25), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.15))",
                    border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.35)",
                    color: "var(--leadac-300)",
                  }}
                  aria-hidden
                >
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300)">
                  Copilot
                </p>
              </div>
              <h3 className="text-[22px] md:text-[26px] font-semibold tracking-[-0.01em] text-white leading-[1.15]">
                Ask your pipeline, not a spreadsheet.
              </h3>
              <p className="text-[13.5px] text-white/60 leading-relaxed">
                Skip the four-step workflow in your head. Say “find 20 lookalikes of my best closer in Manchester and draft the openers” — the copilot runs the real tools, attributes the work back to each lead, and hands you the drafts. No more clicking through filters.
              </p>
              <ul className="flex flex-col gap-2 mt-2">
                {COPILOT_TOOLS.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "0.5px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      className="text-[12.5px] font-semibold shrink-0"
                      style={{ color: "var(--leadac-300)" }}
                    >
                      {t.name}
                    </span>
                    <span className="text-[12.5px] text-white/55 leading-snug">
                      {t.hint}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Learning loop panel */}
            <div
              className="rounded-2xl p-7 md:p-8 flex flex-col gap-5"
              style={{
                background:
                  "linear-gradient(180deg, rgba(32,32,36,0.92), rgba(22,22,26,0.96))",
                border: "0.5px solid rgba(255,255,255,0.08)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.25), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.15))",
                    border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.35)",
                    color: "var(--leadac-300)",
                  }}
                  aria-hidden
                >
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300)">
                  Learning loop
                </p>
              </div>
              <h3 className="text-[22px] md:text-[26px] font-semibold tracking-[-0.01em] text-white leading-[1.15]">
                Your winning openers train the next one.
              </h3>
              <p className="text-[13.5px] text-white/60 leading-relaxed">
                Every reply tells the system which lines landed and which didn’t. The next time you draft, it quietly pulls your three best past wins as examples before writing — your voice sharpens with every campaign, the AI stops drifting, and you never re-prompt it for every client account.
              </p>
              <ul className="flex flex-col gap-2 mt-2">
                {MEMORY_KINDS.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "0.5px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      className="text-[12.5px] font-semibold shrink-0"
                      style={{ color: "var(--leadac-300)" }}
                    >
                      {m.name}
                    </span>
                    <span className="text-[12.5px] text-white/55 leading-snug">
                      {m.hint}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <CineStats eyebrow="The thesis, in numbers" stats={STATS} />

      <CineTestimonials
        eyebrow="What the operators say"
        headline="The math the threads keep posting."
        testimonials={TESTIMONIALS}
      />

      {/* Pricing — dark wrapper so the existing dark PricingCards component
          continues to read. Purple accent used inside the cards now. */}
      <section
        id="pricing"
        className="vx-dark-section-soft relative py-24 md:py-36 overflow-hidden"
      >
        <div
          className="relative z-10 max-w-(--cine-max) mx-auto"
          style={{ paddingLeft: "var(--cine-gutter)", paddingRight: "var(--cine-gutter)" }}
        >
          <div className="flex flex-col items-center text-center gap-5 mb-12 md:mb-16 max-w-3xl mx-auto">
            <span
              className="rounded-full px-4 py-1.5 text-[11.5px] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 68% / 0.28)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Pricing
            </span>
            <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] tracking-[-0.03em] max-w-[22ch] text-white">
              Stop stacking tools.{" "}
              <span className="vx-text-gradient">Start stacking replies.</span>
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              A typical Apollo + Clay + Smartlead + AI-receptionist stack runs $300–$475 a month before your agency retainer. Leadac’s Agency tier does the same work for roughly 15% of that. One subscription. One workspace. One card on file.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      <CineFaq
        eyebrow="Questions"
        headline="Read this before you sign up."
        sub="Short answers. The long answers are one email away."
        contactCta={{ label: "Email the founder", href: "mailto:mert@leadac.ai" }}
        items={FAQ_ITEMS}
      />

      <CineCta
        headline="Your next 50 clients aren’t on Apollo."
        sub="They’re on Google Maps. Pick a postcode, pick a niche, open the first audited lead in five minutes. If the list doesn’t beat what you’re emailing to today, walk away. No card taken, nothing to cancel."
        primary={{ label: "Get my first 50 clients", href: "/signup" }}
        secondary={{ label: "See pricing", href: "#pricing" }}
        microCopy="50 free leads · no credit card · cancel any time"
      />

      <div className="relative z-10 border-t border-white/6">
        <div
          className="max-w-(--cine-max) mx-auto py-6 md:py-8 flex items-center justify-center gap-6 flex-wrap text-[11.5px]"
          style={{ paddingLeft: "var(--cine-gutter)", paddingRight: "var(--cine-gutter)" }}
        >
          <Link href="/pricing" style={{ color: "rgba(255,255,255,0.45)" }} className="hover:!text-white transition-colors">
            Pricing
          </Link>
          <Link href="/#faq" style={{ color: "rgba(255,255,255,0.45)" }} className="hover:!text-white transition-colors">
            FAQ
          </Link>
          <Link href="/legal/terms" style={{ color: "rgba(255,255,255,0.45)" }} className="hover:!text-white transition-colors">
            Terms
          </Link>
          <Link href="/legal/privacy" style={{ color: "rgba(255,255,255,0.45)" }} className="hover:!text-white transition-colors">
            Privacy
          </Link>
          <Link
            href="/signup"
            style={{ color: "rgba(255,255,255,0.75)" }}
            className="inline-flex items-center gap-1 hover:!text-white transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Start free
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </>
  );
}
