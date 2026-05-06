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
  CinePain,
  CineCaseStudy,
  CineLogoWall,
  CineLeadIntelligence,
  CineFaq,
  CineCta,
  type CineReason,
  type CineStep,
  type CineStat,
  type CinePainPoint,
  type CineCaseStudyMetric,
  type CineCaseStudyBeat,
  type CineLogoWallEntry,
  type CineIntelligenceFeature,
  type CineFaqItem,
} from "@/components/marketing/cine";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/",
  title: "LeadAC — Find your next local customer.",
  description:
    "Type a postcode and a niche. LeadAC pulls 50 fresh leads from our local-business index, audits every site, and drafts an opener grounded in what the audit found. Pipeline-ready dossiers in five minutes. Built for the local-business segment Apollo doesn't cover. Works with Smartlead, Instantly, GHL, Gmail, Outlook.",
  keywords: [
    "local lead generation for agencies",
    "agency outbound system",
    "google maps lead intelligence",
    "google maps lead generation",
    "agency lead generation",
    "local business prospecting",
    "outbound system for agencies",
    "smma lead generation",
    "cold email reply rate",
    "audit-driven cold email",
    "lead dossier",
    "b2b agency outbound",
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

const PAIN_POINTS: CinePainPoint[] = [
  {
    icon: "Database",
    title: "Recycled lists skip local",
    body: "Apollo, ZoomInfo, Lusha — agencies share the same 50 million enterprise contacts, pitched by ten other shops this month. Reply rates on shared-list outbound dropped from 3-4% into 1-2%. The fix isn't a better cadence. Apollo's strength is enterprise B2B. Local-business coverage was never theirs. Most local prospects aren't even indexed, and the ones that are sit on stale data nobody re-crawls.",
    source: {
      quote:
        "Same 50M contacts. Same crawls. Same emails to the same prospects.",
      attribution: "r/coldemail · April 2026",
    },
  },
  {
    icon: "MessageSquareDashed",
    title: "AI personalization stopped working",
    body: "Twelve months of training-data leakage and every GPT first-line generator sounds the same. The receiving inbox figured it out. \"I noticed you launched...\" is a deliverability liability now. Different fuel beats louder personalization.",
    source: {
      quote:
        "If you're using AI for cold outreach, are you OK with the damages?",
      attribution: "r/coldemail · AI thread",
    },
  },
  {
    icon: "Layers",
    title: "Manual research caps at ten a day",
    body: "A senior SDR can hand-write a great per-prospect message — for ten prospects. That's not a pipeline. The middle path between AI slop at scale and hand-write everything is the gap nothing was filling.",
    source: {
      quote:
        "I need a predictable way to get clients. Not another course, not another tool. A system.",
      attribution: "r/SMMA · April 2026",
    },
  },
];

const REASONS: CineReason[] = [
  {
    icon: "Package",
    title: "Dossiers, not contact rows",
    body: "Apollo hands you a contact and a guess. We hand you a dossier: the audit, the score, the angle, and the draft. Same SDR seat, different fuel.",
  },
  {
    icon: "TrendingUp",
    title: "Sharper as you keep what works",
    body: "Saved openers seed the next campaign. Your voice and offer are learned once and applied everywhere. Drafts get sharper because the inputs do.",
  },
  {
    icon: "ShieldCheck",
    title: "One subscription, no credit math",
    body: "Maps data, reviews, competitor ads, LinkedIn signals, Reddit mentions. One monthly cap. No panic mid-campaign because you ran out of credits.",
  },
  {
    icon: "Scale",
    title: "AI drafts. You review. Your brand.",
    body: "Auto-send is off by default. You check everything before it leaves your own inbox. Take the human out and quality tanks. Every cold email operator on Reddit will tell you the same.",
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
    title: "Research",
    body: "Site signals, up to 500 reviews scanned for sentiment, sub-niche detection, competitor ads, social posts. 0-100 fit score with the angle and price band ready.",
  },
  {
    n: "3",
    title: "Pitch",
    body: "Opener draft grounded in what the audit found, not in a generic 'I noticed you...' prompt. One click.",
  },
  {
    n: "4",
    title: "Send",
    body: "Gmail, Outlook, or export to Smartlead/Instantly. Replies match back to the lead automatically.",
  },
  {
    n: "5",
    title: "Install",
    body: "Closed prospect? Export the AI receptionist, review-reply agent, and lead-response flow you pitched. Booking widget and GBP posting in beta.",
  },
];

const STATS: CineStat[] = [
  { value: "47", label: "Leads audited in five minutes" },
  { value: "500", label: "Google reviews scanned per lead" },
  { value: "20+", label: "Site signals scored, 0-100" },
  {
    value: "75x",
    label: "Year-1 payback on Agency+ if one closed retainer pays $1,500/mo",
  },
];

/**
 * Beta-cohort case study card. Anonymized as "F&B SaaS BD team" until the
 * customer grants written permission for their name to appear publicly.
 * Source: research/finedine/beta-test-round-2-camden-report.md (12 leads,
 * Camden / North London cafes, May 2026).
 */
const CASE_STUDY_BEATS: CineCaseStudyBeat[] = [
  {
    label: "Before",
    body: "Two BD reps spent 80% of their day juggling tabs and spreadsheets, manually qualifying cafes against the QR-menu and reservations stack they sell. Maybe 30 prospects per rep per day, and most of the research never made it into the opener.",
  },
  {
    label: "After",
    body: "12 cafes audited end-to-end in one afternoon. Sub-niche detection, package recommendation, and an opener grounded in what each cafe was missing (online ordering, reservations, loyalty).",
  },
  {
    label: "What landed",
    body: "Audit signal flagged 6 of 12 cafes as 'no online ordering' — the exact pitch territory their product covers. The team had a shortlist they could send Monday.",
  },
  {
    label: "What didn't",
    body: "Round 2 surfaced 10 bug classes (chain blindness, review small-sample blowups, expired-domain context). The customer found them, not us — and that's the point. Hotfix release this sprint addresses each one.",
  },
];

const CASE_STUDY_METRICS: CineCaseStudyMetric[] = [
  { value: "12", label: "Cafes audited end-to-end in one afternoon" },
  { value: "6/12", label: "Pitch-ready prospects on the shortlist" },
  { value: "10", label: "Bug classes the customer reported (we fix, not hide)" },
];

/**
 * Logo wall placeholder — text-only slots until 3+ customers grant
 * written permission for their real logo. The framing line is itself the
 * trust signal: "we don't ship anonymous claims" beats a row of grey-scale
 * logos with no source.
 */
const LOGO_WALL_ENTRIES: CineLogoWallEntry[] = [
  { label: "F&B SaaS BD team" },
  { label: "Local SEO agency" },
  { label: "Walk-in web agency" },
  { label: "B2B outbound shop" },
  { label: "Solo Klaviyo specialist" },
];

const LEAD_INTELLIGENCE_FEATURES: CineIntelligenceFeature[] = [
  {
    icon: "MapPin",
    title: "Discovery",
    body: "Pulled live from our local-business index, scoped to your postcode and niche. Refreshed continuously so you don't get stale rows or recycled enterprise contacts.",
  },
  {
    icon: "FileSearch",
    title: "Deep prospect research",
    body: "Not just a site scrape. 20+ site signals (HTTPS, mobile fit, booking flow, schema, LCP), up to 500 reviews scanned for sentiment, competitor ad presence, recent social posts, hiring signals. 0-100 fit score with each reason listed.",
  },
  {
    icon: "Tag",
    title: "Sub-niche classification",
    body: "Detects whether the prospect is a fine-dining restaurant, a coffee shop, or a ghost kitchen, and matches the pitch and package to their sub-niche.",
  },
  {
    icon: "MessageSquare",
    title: "Opener grounded in the audit",
    body: "Drafts the first line from the audit, not from a generic 'I noticed you launched...' prompt. The line references something the prospect can see on their own homepage.",
  },
  {
    icon: "Package",
    title: "Pipeline-ready dossier",
    body: "Each lead arrives as a dossier: signals, score, suggested package, draft opener. Open Monday, work through Friday.",
  },
];

const FAQ_ITEMS: CineFaqItem[] = [
  {
    q: "How is this different from Apollo or Clay?",
    a: "Apollo and Clay own the enterprise B2B database — that's where they're strong. We're the local-business lead-intelligence layer Apollo doesn't cover well: our own continuously-refreshed local-business index, a real audit on every site, and an opener grounded in the audit. Most agencies run LeadAC in front of Apollo, not instead of it.",
  },
  {
    q: "Where do the leads come from?",
    a: "From our local-business index — refreshed continuously so the data is clean and current rather than a scraped list. Deep enrichment adds reviews, social posts, competitor ads, LinkedIn signals, and Reddit mentions on top of every record. All inside your monthly cap.",
  },
  {
    q: "What does the deep research actually cover?",
    a: "More than a site scrape. 20+ technical site signals (HTTPS, mobile fit, booking flow integrity, schema markup, Largest Contentful Paint), up to 500 reviews scanned for sentiment, sub-niche classification, competitor ad presence, recent social posts, hiring signals where they exist. 0-100 fit score with each reason listed, so you can sanity-check before pitching.",
  },
  {
    q: "How long until first booked call?",
    a: "Most operators see their first reply in week 1, first booked call in week 2-3. Retainer-grade clients tend to land in week 4. Faster if you already have a sender warmed and a working ICP.",
  },
  {
    q: "Does it work with Smartlead, Instantly, or GHL?",
    a: "Yes. Solo and Studio plans export CSV formatted for Smartlead and Instantly with custom variables for the audit signals. Agency+ adds native Gmail and Outlook send with reply attribution back to the lead.",
  },
  {
    q: "Is the AI sending emails for me?",
    a: "No. Auto-send is off by default and stays that way unless you flip a toggle. We generate the audit and the draft. You review and ship from your own inbox. AI cold email without a human in the loop burns deliverability — we won't ship that.",
  },
  {
    q: "Can I bring my existing client list?",
    a: "Yes. Import a CSV and we'll audit each row. Fit scoring and sub-niche detection still run, just against the rows you bring instead of a fresh pull from our index.",
  },
  {
    q: "Is there an agency-friendly billing model?",
    a: "Agency+ is workspace-based, not per-seat: 5 seats included, no per-seat surcharge for adding the next SDR. Custom volume above the Agency+ tier on request.",
  },
  {
    q: "Is there a money-back window?",
    a: "14-day trial with a card on file. If you don't pull a single fresh lead list and an audit you'd actually send, cancel inside 14 days and the card on file gets a refund. No 'are you sure?' loops.",
  },
  {
    q: "Is my data private?",
    a: "Leads, notes, pipeline, voice notes, and saved playbook are scoped to your workspace. Only invited members see them. We don't share or resell, and we don't train models on your data.",
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
        tagline="Local lead generation for outbound agencies"
        headline="Find your next local customer."
        sub="Type a postcode and a niche. LeadAC pulls fresh leads from our local-business index, runs deep research on every prospect (site signals, reviews, competitors, social posts, sub-niche), and drafts the opener from what the research found. Pipeline-ready dossiers in your tab in five minutes — for the local-business segment Apollo doesn't cover."
        ctaPrimary={
          MARKETING_COMING_SOON
            ? { label: "Launching soon" }
            : { label: "Audit your first 10 leads", href: "/signup" }
        }
        ctaSecondary={
          MARKETING_COMING_SOON
            ? { label: "Watch the tour", href: "#tour" }
            : { label: "Book a 15-min walkthrough", href: "/demo" }
        }
        partnersLabel="Works with your sender. We don't replace it."
        partners={["Smartlead", "Instantly", "GHL", "Gmail", "Outlook"]}
      />

      <CinePain
        eyebrow="Why outbound stopped paying out"
        headline="The most-used outbound playbook stopped working."
        sub="Cold outreach became every agency's default just as reply rates collapsed. Three things broke at once. We built around the third."
        points={PAIN_POINTS}
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

      <CineCaseStudy
        eyebrow="Beta cohort"
        headline="12 cafes in Camden. One BD team. One afternoon."
        sub="The first cohort that ran the full motion end-to-end. What landed, what didn't, what we fixed because they reported it."
        customerLabel="F&B SaaS BD team"
        customerSetup="2-rep BD team selling QR menu and reservations to local cafes. Camden and North London cohort, May 2026."
        beats={CASE_STUDY_BEATS}
        metrics={CASE_STUDY_METRICS}
        disclosure="Anonymized at customer request. Public case study lands when permission confirmed. Internal artifact: research/finedine/beta-test-round-2-camden-report.md."
      />

      <CineLogoWall
        entries={LOGO_WALL_ENTRIES}
        framing="Used by a small group of operators running outbound across the UK. We add a logo here when the customer asks us to. We don't ship anonymous proof."
      />

      <CineStats eyebrow="The numbers that matter" stats={STATS} />

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
                  <span className="vx-text-gradient">Stop bolting on a research VA.</span>
                </>
              )}
            </h2>
            <p className="text-[15px] md:text-[16.5px] text-white/55 max-w-xl leading-relaxed">
              {MARKETING_COMING_SOON
                ? "Finishing the packaging. One workspace instead of four tools and a research VA. Details when signup opens."
                : "Local outbound is a per-prospect-homework cost line. A research VA at $3-5/hr × 30 hrs/week runs $360-600/month. We collapse that line. Apollo and Smartlead stay where they are."}
            </p>
          </div>
          <PricingCards ctaDisabled={MARKETING_COMING_SOON} />
        </div>
      </section>

      <CineLeadIntelligence
        eyebrow="The system, not a feature"
        headline="Five steps we run before you write a word."
        sub="Cold email is a workflow, not a tool. Skip a step and the next one runs blind."
        features={LEAD_INTELLIGENCE_FEATURES}
      />

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
        headline="Your next 50 clients are local. They're in our index."
        sub={
          MARKETING_COMING_SOON
            ? "Apollo doesn't cover them. Watch the tour above or drop us a line."
            : "Apollo and the big B2B databases don't cover them. Pick a postcode, pick a niche, and the first audited dossier lands in your tab in five minutes. If the list doesn't beat what you're emailing now, cancel inside 14 days and the card on file gets a refund."
        }
        primary={
          MARKETING_COMING_SOON
            ? { label: "Launching soon" }
            : { label: "Audit your first 10 leads", href: "/signup" }
        }
        secondary={
          MARKETING_COMING_SOON
            ? { label: "Email the founder", href: "mailto:mert@leadac.ai" }
            : { label: "Book a 15-min walkthrough", href: "/demo" }
        }
        microCopy={
          MARKETING_COMING_SOON
            ? undefined
            : "14-day trial · cancel any time · refund window if it doesn't earn you a reply"
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
              Start your trial
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
