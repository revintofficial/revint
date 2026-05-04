import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";
import { HomeScrollTour } from "@/components/marketing/home-scroll-tour";
import MultiOrbitSemiCircle from "@/components/ui/multi-orbit-semi-circle";
import {
  CineHero,
  CineFeatures,
  CineWhy,
  CineProcess,
  CineStats,
  CineTestimonials,
  CineFaq,
  CineCta,
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
    "Leadac — Find local clients off Google Maps. Audit, email, mockup, close.",
  description:
    "Postcode plus niche pulls 50 fresh businesses off Google Maps. Every site audited, a personalised opener drafted, and a one-page mockup the prospect can click. Works with Smartlead, Instantly, GHL, Gmail, Outlook.",
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

const REASONS: CineReason[] = [
  {
    icon: "Package",
    title: "Conversations, not contacts",
    body: "Apollo gives you a name and wishes you luck. Clay enriches a row. Smartlead sends it. Leadac gives you the opener, the mockup, and the angle that actually gets a response.",
  },
  {
    icon: "TrendingUp",
    title: "Gets better the longer you use it",
    body: "Winning openers get saved and pulled back as examples next time. The drafts sound more like you with every campaign. No re-prompting per client.",
  },
  {
    icon: "ShieldCheck",
    title: "One subscription, no credit maths",
    body: "Maps data, reviews, competitor ads, LinkedIn, Reddit mentions. One monthly cap. No panic mid-campaign because you ran out of credits.",
  },
  {
    icon: "Scale",
    title: "AI writes. You review. Your brand.",
    body: "Auto-send off by default. You check everything before it goes out from your own inbox. Take the human out and quality tanks. Every cold email operator on Reddit will tell you the same.",
  },
];

const STEPS: CineStep[] = [
  {
    n: "1",
    title: "Discover",
    body: "Postcode, niche. Name, website, phone, rating, hours. Back in seconds.",
  },
  {
    n: "2",
    title: "Score",
    body: "20 signals, up to 500 reviews, 0-100 score. Best angle and price band ready.",
  },
  {
    n: "3",
    title: "Pitch",
    body: "One click: opener draft plus a mockup on a branded link. That link is what gets replied to.",
  },
  {
    n: "4",
    title: "Send",
    body: "Gmail, Outlook, or export to Smartlead/Instantly. Replies track back to the lead automatically.",
  },
  {
    n: "5",
    title: "Install",
    body: "Prospect signs? Export the AI receptionist, review-reply agent, and lead-response flow you pitched. Booking widget and GBP posting in beta.",
  },
];

const STATS: CineStat[] = [
  { value: "47", label: "Leads audited in five minutes" },
  { value: "500", label: "Google reviews scanned per lead" },
  { value: "20+", label: "Site signals scored, 0-100" },
  { value: "0", label: "Apollo contacts recycled" },
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
      "If you're using AI for cold outreach, are you OK with the damages?",
    name: "r/coldemail",
    role: "AI-cold-email thread",
  },
  {
    quote:
      "3-4% reply and 96%+ deliverability is the realistic bar. Everything else is vanity.",
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
      "I need a predictable way to get clients. Not another course, not another tool. A system.",
    name: "r/SMMA",
    role: "Top comment, April 2026",
  },
  {
    quote:
      "I worked as an executor for four years. I know Klaviyo cold. I don't know how agencies actually acquire clients.",
    name: "r/agency",
    role: "Klaviyo specialist, going solo",
  },
];

const FAQ_ITEMS: CineFaqItem[] = [
  {
    q: "Is this a tool or a system?",
    a: "Both. Discovery, audit, mockup, opener draft, export — that's the tool. The system is the part that actually books the call: fresh data nobody else has, homework attached to every first email, and a memory that learns which lines land.",
  },
  {
    q: "How is this different from Apollo or Clay?",
    a: "Apollo and Clay own the enterprise contact database. We don't compete there. Leadac is the upstream layer for local business outbound: fresh Google Maps data, a site audit on every lead, a 0-100 score, and a personalised opener built from what the audit found. Most agencies end up running Leadac in front of Apollo, not instead of it.",
  },
  {
    q: "What does 'install' actually mean?",
    a: "Three products you can sell to the prospect, each trained on their own site: an AI receptionist (exports to Synthflow, Retell, Vapi, or GHL), a review-reply agent with human approval on 1 and 2 star reviews, and a 60-second lead-response sequence (GHL, n8n, or Make). Booking widget and GBP posting are in beta. We don't advertise what hasn't shipped.",
  },
  {
    q: "How does the AI improve over time?",
    a: "Every reply teaches it. Good openers get saved as examples for next time. Your voice and positioning are learned once and applied everywhere. You stop re-prompting it for every client.",
  },
  {
    q: "Does it work with Smartlead or Instantly?",
    a: "Yes. Pro and Agency plans export a CSV formatted for both, with custom variables for the mockup link and audit signals. You can also send from connected Gmail or Outlook. Replies match back to the lead and the pipeline stage moves on its own.",
  },
  {
    q: "Is the AI sending emails for me?",
    a: "No. Auto-send is off by default and it stays that way unless you flip a toggle. Leadac generates the audit, the mockup, and the draft. You review and send. AI outreach without a human in the loop burns deliverability.",
  },
  {
    q: "Where do the leads come from?",
    a: "Live Google Maps on every search. Businesses keep their own profiles current, so the data is cleaner than any scraped list. Deep enrichment adds reviews, social posts, competitor ads, LinkedIn signals, and Reddit mentions. All inside your monthly cap.",
  },
  {
    q: "Can I white-label it?",
    a: "Agency tier has workspace branding today: your logo, colours, and domain on mockup pages. Full white-label with a custom domain across the whole workspace lands mid-2026.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Settings, billing, done. Access runs till the end of your cycle. Data kept 30 days. Free plan never touches a card.",
  },
  {
    q: "Is my data private?",
    a: "Leads, notes, pipeline, shortlists, voice notes, and saved memory are scoped to your workspace. Only invited members see them. We don't share or resell your data and we don't use it to train models.",
  },
];

const COPILOT_TOOLS = [
  {
    name: "Find leads",
    hint: "Filter by niche, area, score, or pipeline stage.",
  },
  {
    name: "Search by meaning",
    hint: "Pull leads by intent, not keywords.",
  },
  {
    name: "Start a pitch",
    hint: "Mockup, opener, and plan for any lead.",
  },
  {
    name: "Run deep research",
    hint: "Web, socials, reviews, competitor signals.",
  },
  {
    name: "Find lookalikes",
    hint: "Score similar leads against your best closer.",
  },
];

const MEMORY_KINDS = [
  {
    name: "Winning openers",
    hint: "Best first messages, pulled in as examples next time.",
  },
  {
    name: "Your positioning",
    hint: "Offer and voice, learned once, applied everywhere.",
  },
  {
    name: "Prospect knowledge",
    hint: "Their own site, ready for the receptionist.",
  },
  {
    name: "Review pain points",
    hint: "What their customers complain about, ready for the opener.",
  },
  {
    name: "Mockup blocks that converted",
    hint: "Sections that got replies before.",
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
        tagline="For agencies selling to local businesses"
        headline="Google Maps to signed clients."
        sub="Postcode, niche, go. 50 fresh leads off Maps, every site audited, a draft email and clickable mockup ready to send. Five minutes."
        ctaPrimary={
          MARKETING_COMING_SOON
            ? { label: "Launching soon" }
            : { label: "Get my first 50 leads", href: "/signup" }
        }
        ctaSecondary={{ label: "Watch the tour", href: "#tour" }}
        partnersLabel="Works with your sender. We don't replace it."
        partners={["Smartlead", "Instantly", "GHL", "Gmail", "Outlook"]}
      />

      <CineFeatures />

      {/* Live interactive scroll tour — the product, shown actually working.
          Keeps a dark wrapper so the existing dark-themed product frames
          inside HomeScrollTour continue to read.

          CRITICAL: use `overflow-x-clip` (NOT `overflow-hidden`). The
          ScrollStage inside HomeScrollTour relies on `position: sticky`, and
          any ancestor with `overflow: hidden` / `overflow: auto` turns into
          a scroll container, which silently breaks sticky and leaves only
          scene 1's visual on screen while the rest scroll off. `clip`
          doesn't create a scroll container, so sticky keeps working. */}
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
              {MARKETING_COMING_SOON ? (
                <>
                  Product tour ·{" "}
                  <span className="vx-text-gradient">launching soon.</span>
                </>
              ) : (
                <>
                  See it work before you{" "}
                  <span className="vx-text-gradient">sign up.</span>
                </>
              )}
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              No sales call, no demo script. Scroll through four screens with real data. Same ones you&apos;ll be using ten minutes from now.
            </p>
          </div>
          <HomeScrollTour />
        </div>
      </section>

      <CineWhy
        eyebrow="What changes"
        headline="Fewer emails. More replies. Retainers, not pilot calls."
        sub="Why agencies stick around after month three."
        reasons={REASONS}
      />

      <CineProcess
        eyebrow="Five steps"
        headline="Empty screen to signed client."
        sub="Open the app, type a postcode, hit go."
        steps={STEPS}
      />

      {/* The brain — copilot tools + learning loop. Dark-soft wrapper
          between light sections for rhythm. */}
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
              Gets sharper{" "}
              <span className="vx-text-gradient">the more you use it.</span>
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              A copilot that runs real actions from chat, and a memory that learns from every reply you get.
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
                Talk to your pipeline.
              </h3>
              <p className="text-[13.5px] text-white/60 leading-relaxed">
                &quot;Find 20 lookalikes of my best closer in Manchester and draft the openers.&quot; It runs the tools, links work back to each lead, hands you the drafts.
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
                Best openers train the next one.
              </h3>
              <p className="text-[13.5px] text-white/60 leading-relaxed">
                Every reply teaches it which lines worked. Next draft pulls your three best past wins as examples. Voice gets sharper, AI stops drifting.
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

      <CineStats eyebrow="The numbers" stats={STATS} />

      <CineTestimonials
        eyebrow="From the threads"
        headline="What the operators keep posting."
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
              {MARKETING_COMING_SOON ? "Pricing · launching soon" : "Pricing"}
            </span>
            <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] tracking-[-0.03em] max-w-[22ch] text-white">
              {MARKETING_COMING_SOON ? (
                <>
                  Plans ·{" "}
                  <span className="vx-text-gradient">opening at launch.</span>
                </>
              ) : (
                <>
                  One subscription.{" "}
                  <span className="vx-text-gradient">Stop stacking tools.</span>
                </>
              )}
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              {MARKETING_COMING_SOON
                ? "Finishing the packaging. One workspace instead of four tools. Details when signup opens."
                : "Apollo + Clay + Smartlead + a receptionist runs $300-$475 a month before your agency retainer. Leadac Agency does it all for about 15% of that. One card on file."}
            </p>
          </div>
          <PricingCards ctaDisabled={MARKETING_COMING_SOON} />
        </div>
      </section>

      {/* Integrations orbit — after pricing so plan choice is answered, then stack fit. */}
      <MultiOrbitSemiCircle
        eyebrow="Integrations"
        title="Works with what you already use."
        subtitle="Gmail or Outlook for sending. Smartlead, Instantly, or GHL for sequences. Synthflow, Retell, or Vapi for the receptionist. One subscription."
      />

      <CineFaq
        eyebrow="Questions"
        headline={
          MARKETING_COMING_SOON ? "Answers before launch." : "Before you sign up."
        }
        sub={
          MARKETING_COMING_SOON
            ? "Quick answers. Full story when signup opens."
            : "Quick answers. Longer ones are one email away."
        }
        contactCta={{ label: "Email the founder", href: "mailto:mert@leadac.ai" }}
        items={FAQ_ITEMS}
      />

      <CineCta
        headline="Your next 50 clients aren't on Apollo."
        sub={
          MARKETING_COMING_SOON
            ? "They're on Google Maps. Watch the tour above or drop us a line."
            : "They're on Google Maps. Pick a postcode, pick a niche, open the first audited lead in five minutes. If the list doesn't beat what you're emailing now, close the tab."
        }
        primary={
          MARKETING_COMING_SOON
            ? { label: "Launching soon" }
            : { label: "Get my first 50 leads", href: "/signup" }
        }
        secondary={
          MARKETING_COMING_SOON
            ? { label: "Email the founder", href: "mailto:mert@leadac.ai" }
            : { label: "See pricing", href: "#pricing" }
        }
        microCopy={
          MARKETING_COMING_SOON
            ? undefined
            : "50 free leads · no credit card · cancel any time"
        }
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
          {MARKETING_COMING_SOON ? (
            <span style={{ color: "rgba(255,255,255,0.45)" }} className="inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 opacity-70" />
              Launching soon
            </span>
          ) : (
            <Link
              href="/signup"
              style={{ color: "rgba(255,255,255,0.75)" }}
              className="inline-flex items-center gap-1 hover:!text-white transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Start free
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
