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
    "Leadac AI — Postcode and a niche. 47 fresh local leads, audited and pitched.",
  description:
    "Live Google Maps discovery for local-service outbound agencies. Postcode plus niche gives you 47 fresh leads, a 20-signal Playwright audit on every site, a 0-100 opportunity score, and a personalised opener that references what the audit actually found. Feeds Smartlead, Instantly, GHL, Gmail, Outlook.",
  keywords: [
    "local lead generation",
    "google maps scraper",
    "cold email outbound",
    "agency lead generation",
    "apollo alternative",
    "website audit tool",
    "lead scoring",
    "SMMA",
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
    title: "A list nobody else is emailing",
    body: "Your competitors are all reading from the same Apollo dump. Postcode plus niche pulls 50 to 1,000 fresh businesses live off Google Places — the list you get this morning, no other agency has tonight.",
    accent: "hsl(231 75% 74%)",
  },
  {
    icon: "Globe",
    title: "The homework, already done",
    body: "Every lead lands with its own site read for you — booking flow, mobile fit, page speed, schema, up to 500 Google reviews. Gemini turns the findings into a 0-100 score, the angle to pitch, the offer tier, the price band. You stop tabbing through websites before you can write the first line.",
    accent: "hsl(165 80% 62%)",
  },
  {
    icon: "Wand2",
    title: "An opener that doesn’t sound cold",
    body: "The first draft references the exact thing the crawl found — the booking page that breaks on mobile, the 1-star review they never answered, the schema they’re missing. Paired with a hosted one-page mockup link, the reply asks what it would cost, not who you are.",
    accent: "hsl(280 80% 72%)",
  },
  {
    icon: "Send",
    title: "Your inbox. Your brand. Your reputation.",
    body: "Auto-send stays off. You connect Gmail or Outlook, review the draft, ship it yourself — so the quality floor and the deliverability score both stay yours. Replies come back, Leadac matches them to the lead and moves the pipeline stage on its own. No CRM housekeeping on Monday morning.",
    accent: "hsl(12 85% 66%)",
  },
  {
    icon: "PhoneCall",
    title: "The retainer extension, already packaged",
    body: "The day they sign, the tool exports what you pitched. Today: AI receptionist (Synthflow / Retell / Vapi / GHL), review-reply agent with a human gate on 1- and 2-star reviews, 60-second lead-response tree for GHL / n8n / Make. Booking widget and GBP auto-post are in beta.",
    accent: "hsl(200 85% 66%)",
  },
  {
    icon: "Brain",
    title: "Your best lines compound",
    body: "Month three writes better copy than month one — because the system watches what worked. Every winning opener gets saved and retrieved as a few-shot when the next draft runs; your positioning is embedded once and applied to every email. You don’t re-prompt the AI for every lead. It learns how you pitch.",
    accent: "hsl(32 75% 70%)",
  },
];

const REASONS: CineReason[] = [
  {
    icon: "Package",
    title: "The reply is the product",
    body: "Apollo hands you a contact and says good luck. Clay enriches a row. Smartlead sends. Leadac gives you the shape of the first two emails — the opener that references what the crawl found, the mockup link that turns the reply into a discovery call. You stop buying lists. You start buying conversations.",
  },
  {
    icon: "TrendingUp",
    title: "Month three outperforms month one",
    body: "Most outbound tools reset every lead. Leadac watches what works. Winning openers are saved and pulled back in as few-shot examples the next time you draft — so your voice sharpens with every reply, and the AI stops needing to be re-prompted for every client.",
  },
  {
    icon: "ShieldCheck",
    title: "One subscription, no credit math",
    body: "Fresh Google Maps data on every search. Up to 500 reviews, competitor ads, LinkedIn hiring, Reddit mentions — all inside a single monthly cap. You stop mid-campaign credit panic and you stop budgeting enrichment per row.",
  },
  {
    icon: "Scale",
    title: "AI drafts. You ship.",
    body: "Your sender reputation stays yours. Auto-send is off by default — the AI does the research, the audit, the opener draft; you review and send from your own inbox. Because every cold-email operator on Reddit agrees: the moment the human leaves the loop, the quality floor collapses.",
  },
];

const STEPS: CineStep[] = [
  {
    n: "1",
    title: "Discover",
    body: "Postcode plus niche. Google Places live. Name, website, phone, rating, hours come back in seconds.",
  },
  {
    n: "2",
    title: "Score",
    body: "Open any lead. A 20-signal Playwright audit, up to 500 Google reviews scanned, and a 0-100 opportunity score with best angle, offer tier, and price band are already waiting.",
  },
  {
    n: "3",
    title: "Pitch",
    body: "One click drafts the opener off the audit findings and hosts a one-page mockup at /m/{slug}. That link in the email is the thing that gets replied to.",
  },
  {
    n: "4",
    title: "Send",
    body: "Review the draft, push from Gmail or Outlook, or export a CSV to Smartlead or Instantly. Replies attribute to the lead automatically — the pipeline stage advances without you touching it.",
  },
  {
    n: "5",
    title: "Install",
    body: "When they sign, Leadac exports the AI receptionist, review-reply agent, and lead-response tree you pitched. Booking widget and GBP auto-post are in beta.",
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
    q: "How is this different from Apollo or Clay?",
    a: "Apollo and Clay own the enterprise-SaaS contact database. Leadac does not try to fight on that ground. We’re the upstream layer for local-service outbound: Google Places live (not a shared 50M dump), a Playwright audit on every site, a 0-100 opportunity score, and a personalised opener grounded in the audit. Most agencies end up running Leadac in front of Apollo, not instead of it.",
  },
  {
    q: "What does the ‘install’ part actually ship?",
    a: "Three products live today, grounded in the prospect’s own site via deep crawl + semantic memory: (1) AI receptionist exported to Synthflow, Retell, Vapi, GHL, or plain JSON; (2) Review-reply agent with a 50-reply pool, tone spec, and a human approval gate for 1- and 2-star reviews; (3) Lead-response tree — 60-second SMS or email — exported to GHL, n8n, or Make. In beta: an embeddable booking widget (Cal.com / GHL) and a 30-day Google Business Profile post schedule. We don’t advertise what hasn’t shipped.",
  },
  {
    q: "How does the AI actually improve over time?",
    a: "Every inbound reply writes to semantic memory (pgvector, HNSW index, 14 memory kinds). Winning openers are tagged OPENER_SUCCESS; weak ones, OPENER_FAILURE. When the next opener generates, the retriever pulls the three most-similar past wins as few-shot examples. Your best lines compound. Your WORKSPACE_OFFER is embedded once and injected into every opener and mockup, so the AI learns your voice instead of being re-prompted per lead.",
  },
  {
    q: "Does it integrate with Smartlead or Instantly?",
    a: "Yes. Pro and Agency plans export a CSV formatted for both, with custom variables for the mockup URL and the audit signals. You can also send natively from your connected Gmail or Outlook — the Reply Attributor then matches inbound replies back to the lead and advances the pipeline stage without you touching it.",
  },
  {
    q: "Is the AI sending emails for me?",
    a: "No, and it won’t unless you flip a toggle. Auto-send is off by default. Leadac generates the audit, the mockup, and the draft opener. You review and ship. AI outreach with no human in the loop burns brand and deliverability — the default stays conservative.",
  },
  {
    q: "Where do the leads come from?",
    a: "Google Places, queried live on every search: business name, website, phone, rating, opening hours. Because each business keeps its own Google Business Profile current, the data is dramatically cleaner than any scraped list — and fresher than an Apollo export ten other agencies worked this quarter. Apify adds the deep layer: up to 500 reviews, social posts, competitor ads, LinkedIn hiring signals, Reddit mentions — inside your monthly cap.",
  },
  {
    q: "Can I white-label it for clients?",
    a: "Agency tier ships per-workspace branding JSON today — your logo, colour, and domain on the hosted /m/{slug} mockup pages. Full white-label (custom domain across the whole workspace, invoiced to your entity) lands mid-2026.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Settings → Billing. Access continues through the end of the cycle. Data is held for 30 days in case you come back. Free plan never charges a card.",
  },
  {
    q: "Is my data private?",
    a: "Leads, notes, pipeline, shortlists, voice notes, and the semantic memory are scoped to your workspace. Only invited members see them. We do not share or resell your data and we do not use it to train third-party models.",
  },
];

const COPILOT_TOOLS = [
  {
    name: "search_leads",
    hint: "Filter by niche, borough, score, stage.",
  },
  {
    name: "semantic_search_leads",
    hint: "Find leads by meaning, not keyword.",
  },
  {
    name: "start_pitch_pack",
    hint: "Kick off mockup + opener + plan for a lead.",
  },
  {
    name: "start_deep_research",
    hint: "Fire Apify Maps Deep + web crawl + socials.",
  },
  {
    name: "find_lookalikes",
    hint: "Score similar leads against your best closer.",
  },
];

const MEMORY_KINDS = [
  {
    name: "OPENER_SUCCESS",
    hint: "Your winning first messages, retrieved as few-shot.",
  },
  {
    name: "WORKSPACE_OFFER",
    hint: "Your positioning, embedded once, applied to every draft.",
  },
  {
    name: "PROSPECT_KB_CHUNK",
    hint: "The prospect’s own site, RAG-grounded for the receptionist.",
  },
  {
    name: "REVIEW_CHUNK",
    hint: "Pain points and switch signals from their Google reviews.",
  },
  {
    name: "MOCKUP_SECTION",
    hint: "The hero, services, CTA blocks that converted before.",
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
        tagline="Built for agencies selling into local businesses"
        headline="We don’t sell the lead. We sell the first reply."
        sub="Book more calls from inboxes nobody else is pitching. Leadac builds you a fresh local list off Google Maps, reads every site in the background, and drafts a first email from what it found — so the reply asks what it would cost, not who you are. Five minutes, one postcode."
        ctaPrimary={{ label: "Try 50 free leads", href: "/signup" }}
        ctaSecondary={{ label: "Watch the tour", href: "#tour" }}
        partnersLabel="Feeds your sender. Doesn’t replace it."
        partners={["Smartlead", "Instantly", "GHL", "Gmail", "Outlook"]}
      />

      <CineBento
        eyebrow="What you get"
        headline="Six pieces of the job, already done."
        sub="The parts of outbound that used to eat your Monday — the research, the first draft, the CRM update, the install doc for the product you sold — pulled into one workspace and handed back."
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
              See it before you{" "}
              <span className="vx-text-gradient">sign up.</span>
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              No sales call, no scripted demo. Scroll down and the four screens play in order with real data — discovery, audit, mockup, opener. What you see is what you type into the app ten minutes from now.
            </p>
          </div>
          <HomeScrollTour />
        </div>
      </section>

      <CineWhy
        eyebrow="Why bother"
        headline="Fewer emails. More replies. Month after month."
        sub="The four reasons the agencies piloting Leadac keep the card attached past month three."
        reasons={REASONS}
      />

      <CineProcess
        eyebrow="Five moves"
        headline="From empty screen to signed client."
        sub="No onboarding call, no 60-page doc. You open the app, you type, you send — the tool carries the rest."
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
              Under the hood
            </span>
              <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] tracking-[-0.03em] max-w-[22ch] text-white">
              The tool that{" "}
              <span className="vx-text-gradient">gets better the more you use it.</span>
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
                    <code
                      className="text-[12px] font-mono shrink-0"
                      style={{ color: "var(--leadac-300)" }}
                    >
                      {t.name}
                    </code>
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
                Every reply tells the system which lines landed and which didn’t. The next draft quietly retrieves your three most-similar wins as examples before it writes — so your voice compounds, the AI stops drifting, and you never re-prompt it for every client. Under the hood: pgvector, HNSW, 14 memory kinds.
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
                    <code
                      className="text-[12px] font-mono shrink-0"
                      style={{ color: "var(--leadac-300)" }}
                    >
                      {m.name}
                    </code>
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
        eyebrow="Pre-launch — these are the threads we read every morning"
        headline="The problem, in their own words."
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
              A typical Apollo + Clay + Smartlead + AI-receptionist setup runs $300–$475 a month before your agency retainer. Leadac’s Agency tier does the same work for roughly 15% of that — one subscription, one workspace, one card on file.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      <CineFaq
        eyebrow="Questions"
        headline="Read before you sign up."
        sub="The short answers. The long answers are one email away."
        contactCta={{ label: "Email the founder", href: "mailto:mert@leadac.ai" }}
        items={FAQ_ITEMS}
      />

      <CineCta
        headline="Your next 50 prospects nobody else is emailing."
        sub="Fresh off Google Maps, audited and scored before you see them. Pick a postcode, pick a niche, open the first lead in five minutes. If the list doesn’t beat what you’re sending to today, walk away — no card taken, nothing to cancel."
        primary={{ label: "Try 50 free leads", href: "/signup" }}
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
