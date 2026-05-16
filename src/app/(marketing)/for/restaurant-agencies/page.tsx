import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  CalendarClock,
  Camera,
  ChevronDown,
  Coffee,
  Cookie,
  MessageSquareWarning,
  Truck,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";

import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * Self-contained vertical landing page for agencies whose ICP is F&B
 * (restaurants, cafes, bars, bakeries, ghost kitchens). Apple-style
 * minimal dark layout. No client interactivity. Built independently of
 * the v2 component rebuild so it does not block on parallel work.
 */

export const metadata: Metadata = buildMetadata({
  path: "/for/restaurant-agencies",
  title: "For agencies selling to restaurants — LeadAC",
  description:
    "LeadAC is the AI outbound system built around restaurant economics. Reservation flow, no-show rate, review velocity, delivery dependency. We surface the gap, the dossier, and the opener — for the F&B prospects your team would actually pitch.",
});

const CONTAINER = "max-w-6xl mx-auto px-5 sm:px-6";
const SECTION = "py-24 md:py-32";
const ACCENT_TEXT = "text-[hsl(var(--leadac-h)_var(--leadac-s)_70%)]";
const ACCENT_DOT = "bg-[hsl(var(--leadac-h)_var(--leadac-s)_60%)]";
const HAIRLINE = "border-white/[0.08]";
const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";

export default function RestaurantAgenciesPage() {
  return (
    <>
      <Hero />
      <FBProblems />
      <RestaurantEconomics />
      <PitchAngles />
      <DossierProof />
      <RestaurantFAQ />
      <FinalCTA />
    </>
  );
}

// ---------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/65">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT} animate-pulse motion-reduce:animate-none`}
      />
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  headline,
  sub,
  centered = false,
}: {
  eyebrow: string;
  headline: string;
  sub?: string;
  centered?: boolean;
}) {
  const wrapper = centered
    ? "flex flex-col items-center text-center mx-auto max-w-2xl gap-5"
    : "flex flex-col gap-5 max-w-3xl";
  return (
    <div className={wrapper}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-white font-medium tracking-tight leading-[1.08] text-[clamp(28px,4.5vw,46px)]">
        {headline}
      </h2>
      {sub ? (
        <p className="text-white/65 leading-relaxed text-[15.5px] max-w-2xl">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function PrimaryCTA({ href, label }: { href: string; label: string }) {
  if (MARKETING_COMING_SOON) {
    return (
      <span className="inline-flex cursor-default items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-medium text-black/85">
        Launching soon
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/90"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SecondaryCTA({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-6 py-3 text-sm font-medium text-white/85 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18) 0%, transparent 70%)",
        }}
      />
      <div className={CONTAINER}>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 text-center">
          <Eyebrow>For agencies selling to restaurants</Eyebrow>
          <h1 className="mx-auto max-w-[20ch] font-medium tracking-tight leading-[1.05] text-white text-[clamp(36px,7vw,72px)]">
            The outbound system built around restaurant economics.
          </h1>
          <p className="mx-auto max-w-2xl text-white/65 leading-relaxed text-[17px]">
            Reservation flow, no-show rate, table turnover, review velocity,
            delivery dependency. LeadAC reasons about restaurants the way
            operators do, then hands you the angle, the opener, and the
            dossier.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCTA href="/signup" label="Start free trial" />
            <SecondaryCTA href="/demo" label="Book a 15-min walkthrough" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section 1 — F&B Problem block
// ---------------------------------------------------------------------

type ProblemCard = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const PROBLEMS: ProblemCard[] = [
  {
    icon: CalendarClock,
    title: "Booking provider friction",
    body: "Phone-only reservations, no online widget, no SMS confirmation. The gap is visible in five seconds, but most outbound never names it.",
  },
  {
    icon: MessageSquareWarning,
    title: "Review psychology",
    body: "Restaurants live and die by reviews, but most owners reply to none of them. The right opener references the negative thread nobody handled.",
  },
  {
    icon: Truck,
    title: "Delivery dependency",
    body: "Ghost kitchens lose 25-35% to platform commissions. Independents do not always know there is a direct-order alternative until somebody runs the math.",
  },
  {
    icon: Camera,
    title: "Instagram influence",
    body: "For brunch and bars, Instagram is the funnel. A restaurant with a strong feed and a weak booking flow is the cleanest pitch in this category.",
  },
];

function FBProblems() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader
          eyebrow="Why restaurant outbound stalls"
          headline="Restaurants ignore generic pitches faster than any other vertical."
          sub={'Owners get five "I noticed your website..." emails a day. The ones that land start with the operational gap, not the compliment.'}
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className={`${CARD} flex h-full flex-col gap-3 p-6`}
            >
              <Icon className={`h-5 w-5 ${ACCENT_TEXT}`} />
              <h3 className="text-[15.5px] font-medium tracking-tight text-white">
                {title}
              </h3>
              <p className="text-[14px] leading-relaxed text-white/65">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section 2 — Restaurant economics grid
// ---------------------------------------------------------------------

type NicheCard = {
  icon: LucideIcon;
  name: string;
  summary: string;
  bullets: [string, string, string];
};

const NICHES: NicheCard[] = [
  {
    icon: UtensilsCrossed,
    name: "Fine dining",
    summary: "Prestige and reservation flow drive the unit economics.",
    bullets: [
      "Reservation systems",
      "Prestige and review sensitivity",
      "Average ticket size",
    ],
  },
  {
    icon: Coffee,
    name: "Cafes",
    summary: "Local discovery and repeat foot traffic carry the business.",
    bullets: [
      "Local SEO and Google Maps",
      "Repeat customer behavior",
      "Mobile conversion paths",
    ],
  },
  {
    icon: Wine,
    name: "Bars",
    summary: "Late-night traffic and event nights swing the week.",
    bullets: [
      "Late-night foot traffic",
      "Event programming",
      "Social proof and Instagram",
    ],
  },
  {
    icon: Cookie,
    name: "Bakeries",
    summary: "Walk-ins and morning windows define the day.",
    bullets: [
      "Local SEO and listings",
      "Walk-in conversion",
      "Morning peak optimization",
    ],
  },
  {
    icon: Bike,
    name: "Ghost kitchens",
    summary: "Delivery platforms own the conversion funnel.",
    bullets: [
      "Delivery platform mix",
      "Conversion funnel design",
      "Average order value",
    ],
  },
];

function RestaurantEconomics() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader
          eyebrow="What the AI understands"
          headline="Five sub-niches. Five different unit economics."
          sub="Fine dining and a coffee shop do not earn money the same way. The pitch should not pretend they do."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {NICHES.map(({ icon: Icon, name, summary, bullets }) => (
            <article
              key={name}
              className={`${CARD} flex h-full flex-col gap-4 p-6`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                  <Icon className={`h-5 w-5 ${ACCENT_TEXT}`} />
                </div>
                <h3 className="text-[16px] font-medium tracking-tight text-white">
                  {name}
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed text-white/70">
                {summary}
              </p>
              <ul className="mt-1 space-y-2">
                {bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2.5 text-[13.5px] text-white/55"
                  >
                    <span
                      className={`mt-[7px] h-1 w-1 flex-none rounded-full ${ACCENT_DOT}`}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section 3 — Pitch-angle examples
// ---------------------------------------------------------------------

type AngleCard = {
  scenario: string;
  angle: string;
  why: string;
};

const ANGLES: AngleCard[] = [
  {
    scenario:
      "Fine dining, 4.5 stars, 2k reviews, phone-only reservations, no online widget.",
    angle: "Reservation optimization.",
    why: 'Strong demand signals. Low operational maturity around bookings. The opener leads with Friday-night turnaway risk, not "I love your menu."',
  },
  {
    scenario:
      "Independent coffee shop, weak Google Maps presence, 6 photos uploaded in 2021, 3.9 stars.",
    angle: "Local SEO and photo refresh.",
    why: "Discovery is the bottleneck. The opener references the missing photos and the ranking drop, with a 7-day plan attached.",
  },
  {
    scenario:
      "Ghost kitchen running on Deliveroo and UberEats, no direct-order channel.",
    angle: "Direct-order channel.",
    why: "Commission cut is 25-35%. The opener runs the unit economics back at the operator and offers a direct-order build that pays back inside the quarter.",
  },
];

function PitchAngles() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader
          eyebrow="Worked examples"
          headline="Three angles the system would surface this week."
          sub="Each one starts with a gap a restaurant operator can see on their own homepage."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {ANGLES.map(({ scenario, angle, why }, idx) => (
            <article
              key={angle}
              className={`${CARD} flex h-full flex-col gap-4 p-6`}
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Example {idx + 1}
              </div>
              <p className="text-[14.5px] leading-relaxed text-white/85">
                {scenario}
              </p>
              <div
                className={`flex items-center gap-2 text-[14px] font-medium ${ACCENT_TEXT}`}
              >
                <ArrowRight className="h-4 w-4" />
                <span>{angle}</span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-white/55">
                {why}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section 4 — Dossier proof card
// ---------------------------------------------------------------------

const SIGNALS: string[] = [
  "High review volume — 1.4k reviews, 4.6 avg",
  "Weak reservation funnel — no online booking widget, phone-only",
  "No response strategy — zero owner replies on negative reviews in last 90 days",
  "High Instagram activity — 3.2k followers, 4 posts per week",
];

function DossierProof() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <div className="mx-auto flex max-w-2xl flex-col gap-12">
          <SectionHeader
            eyebrow="One restaurant, one dossier"
            headline="This is what lands in your tab when LeadAC finishes thinking."
            centered
          />
          <article
            className={`rounded-3xl border ${HAIRLINE} bg-white/[0.02] p-8 md:p-10`}
          >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-6">
              <div>
                <h3 className="text-[22px] font-medium tracking-tight text-white">
                  Kazu Sushi
                </h3>
                <p className="mt-1 text-[13.5px] text-white/55">
                  Sushi restaurant · London · Camden
                </p>
              </div>
              <div className="rounded-full border border-[hsl(var(--leadac-h)_var(--leadac-s)_50%)]/30 bg-[hsl(var(--leadac-h)_var(--leadac-s)_50%)]/[0.08] px-4 py-2 text-right">
                <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/55">
                  Fit score
                </div>
                <div className={`text-[14px] font-medium ${ACCENT_TEXT}`}>
                  84 / 100
                </div>
              </div>
            </header>

            <div className="mt-7 flex flex-col gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Detected signals
              </div>
              <ul className="flex flex-col gap-2.5">
                {SIGNALS.map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-3 text-[14px] leading-relaxed text-white/80"
                  >
                    <span
                      className={`mt-[7px] h-1.5 w-1.5 flex-none rounded-full ${ACCENT_DOT}`}
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Recommended angle
              </div>
              <div>
                <span
                  className={`inline-flex items-center rounded-full border border-[hsl(var(--leadac-h)_var(--leadac-s)_50%)]/30 bg-[hsl(var(--leadac-h)_var(--leadac-s)_50%)]/[0.08] px-3.5 py-1.5 text-[12.5px] font-medium ${ACCENT_TEXT}`}
                >
                  Reservation optimization
                </span>
              </div>
              <p className="text-[14px] leading-relaxed text-white/65">
                Strong demand signals. Low operational maturity around
                bookings. The opener leads with the gap, not the compliment.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Suggested opener
              </div>
              <blockquote
                className="border-l-2 pl-5 text-[14.5px] italic leading-relaxed text-white/80"
                style={{
                  borderColor:
                    "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.35)",
                }}
              >
                Saw 1.4k reviews on Kazu and a 4.6 average. The food is not
                the issue. Curious how you are handling the Friday-night
                reservation rush without an online widget. We help London
                sushi restaurants close that gap in a week.
              </blockquote>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section 5 — F&B FAQ (static <details>)
// ---------------------------------------------------------------------

type FAQItem = { q: string; a: string };

const FAQ: FAQItem[] = [
  {
    q: "Does LeadAC cover restaurants outside the UK?",
    a: "Yes. Our index pulls from public local-business data globally, with deeper coverage in cities our beta cohorts work in. London, Manchester, New York, and Istanbul are dense. Other cities pull cleanly but may need a sub-niche pass before you launch a campaign.",
  },
  {
    q: "How does the system handle multi-location brands?",
    a: "Each location is treated as its own prospect by default, with the parent brand surfaced. Multi-location pitches are usually weaker than single-location ones because the buying decision lives at headquarters, not the venue. The system flags this so your SDR does not waste an opener.",
  },
  {
    q: "Can it read reviews in non-English languages?",
    a: "Yes. Review sentiment runs through a multilingual model. Turkish, Spanish, French, and Italian are tested. Less common languages may produce a wider confidence band, which the dossier shows alongside the score.",
  },
  {
    q: "Will the AI suggest a different angle for fine dining vs a cafe?",
    a: "Yes. Sub-niche detection branches the angle library. Fine dining pulls from reservation, prestige, and review threads. Cafes pull from local SEO and repeat-customer threads. Ghost kitchens pull from delivery economics. Same engine, different playbook.",
  },
  {
    q: "Where does the lead data come from?",
    a: "From our continuously refreshed local-business index plus public review and social signals. Enrichment runs on top inside your monthly cap. No separate credit math, no Apollo bolt-on.",
  },
];

function RestaurantFAQ() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader
          eyebrow="Restaurant FAQ"
          headline="Specific to F&B outbound."
          sub="The five questions that come up on every walkthrough with an F&B-focused agency."
        />
        <div className="mt-12 flex flex-col gap-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className={`group rounded-2xl border ${HAIRLINE} bg-white/[0.02] open:bg-white/[0.03] transition-colors`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="text-[15.5px] font-medium tracking-tight text-white/90">
                  {q}
                </span>
                <ChevronDown className="h-4 w-4 flex-none text-white/40 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-6 text-[14.5px] leading-relaxed text-white/65">
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Section 6 — Final CTA
// ---------------------------------------------------------------------

function FinalCTA() {
  const secondary = MARKETING_COMING_SOON
    ? { href: "mailto:mert@leadacai.com", label: "Email the founder" }
    : { href: "/demo", label: "Book a 15-min walkthrough" };

  return (
    <section className={`relative ${SECTION}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 100%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.16) 0%, transparent 70%)",
        }}
      />
      <div className={CONTAINER}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
          <h2 className="font-medium tracking-tight leading-[1.08] text-white text-[clamp(30px,5vw,52px)]">
            The list of restaurants you should be pitching is already audited.
          </h2>
          <p className="max-w-2xl text-[16px] leading-relaxed text-white/65">
            Pick a postcode, pick a sub-niche, and the first dossier lands in
            your tab in five minutes.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCTA href="/signup" label="Start free trial" />
            <SecondaryCTA href={secondary.href} label={secondary.label} />
          </div>
          {!MARKETING_COMING_SOON && (
            <p className="text-[12.5px] text-white/40">
              14-day trial · cancel any time · no setup call required.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
