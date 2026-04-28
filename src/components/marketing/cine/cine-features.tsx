import {
  ArrowUpRight,
  CheckCircle2,
  FileSearch,
  Inbox,
  MapPin,
  Mail,
  Star,
  Send,
  Sparkles,
} from "lucide-react";

/**
 * Why it works — bento feature grid (light theme).
 *
 * Mirrors the Tailark "AI features" bento layout (one hero card spanning the
 * row + three smaller cards, each with its own scrappy illustration), but
 * styled with the workspace's `vx-card` tokens so it sits inside the cine
 * marketing system. The four cards retell the long six-card pitch in a much
 * tighter, more visual form: audit + opener + mockup attached to email one,
 * fresh local data, an opener that did the homework, and your-inbox-your-brand
 * sending discipline.
 */
export function CineFeatures() {
  return (
    <section
      id="services"
      className="vx-light-section relative py-20 md:py-28"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-4 mb-12 md:mb-14 max-w-3xl mx-auto">
          <span className="vx-badge-light">Why it works</span>
          <h2 className="vx-display text-[clamp(30px,4.4vw,52px)] leading-[1.04] text-[color:var(--vx-ink)] max-w-[24ch]">
            Cold email is broken because it sounds{" "}
            <span className="vx-text-gradient">cold.</span>
          </h2>
          <p className="text-[14.5px] md:text-[15.5px] text-[color:var(--vx-ink-mute)] max-w-xl leading-relaxed">
            What gets a reply is proof you did your homework. We do it for you on every prospect — audit, opener, mockup — and ship it on the first line.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Hero card — col-span-full, audit panel illustration */}
          <FeatureCard
            tinted
            className="col-span-full lg:row-span-1 overflow-hidden pl-6 pt-6 pr-6"
            icon={<FileSearch className="w-5 h-5" />}
            title="The homework, attached to email one"
            body="Booking flow, mobile fit, page speed, schema, up to 500 Google reviews — read for you on every lead. The 0-100 score, the angle, the offer tier and the price band are waiting before you write the first line."
          >
            <AuditPanelIllustration />
          </FeatureCard>

          {/* Small card 1 — fresh local data, map illustration */}
          <FeatureCard
            className="overflow-hidden p-6"
            icon={<MapPin className="w-5 h-5" />}
            title="Fresh local data"
            body="Postcode plus niche pulls 50 businesses live off Google Maps. The list you get this morning, no other agency has tonight."
          >
            <MapIllustration />
          </FeatureCard>

          {/* Small card 2 — opener that did the research */}
          <FeatureCard
            className="group overflow-hidden p-6"
            icon={<Mail className="w-5 h-5" />}
            title="An opener that did the research"
            body="The draft references the exact thing the audit found. The reply asks what it would cost — not who you are."
          >
            <OpenerIllustration />
          </FeatureCard>

          {/* Small card 3 — your inbox, your brand */}
          <FeatureCard
            className="group overflow-hidden p-6"
            icon={<Inbox className="w-5 h-5" />}
            title="Your inbox. Your brand."
            body="Auto-send stays off. Review and ship from Gmail or Outlook so the deliverability score and the quality floor both stay yours."
          >
            <InboxIllustration />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  children,
  className,
  tinted,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <div
      className={[
        tinted ? "vx-card-tinted" : "vx-card",
        "relative flex flex-col gap-3",
        className ?? "",
      ].join(" ")}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.22), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12))",
          border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.25)",
          color: "var(--vx-purple-700)",
        }}
        aria-hidden
      >
        {icon}
      </div>
      <h3 className="text-[16.5px] md:text-[18px] font-semibold tracking-[-0.01em] text-[color:var(--vx-ink)] mt-1">
        {title}
      </h3>
      <p className="text-[13.5px] md:text-[14px] text-[color:var(--vx-ink-mute)] leading-relaxed max-w-xl text-balance">
        {body}
      </p>
      <ArrowUpRight
        className="absolute top-6 right-6 w-4 h-4 text-[color:var(--vx-purple-500)]/55"
        aria-hidden
      />
      {children}
    </div>
  );
}

/* ---------- Illustrations ---------- */

/**
 * Hero card illustration: a composed "lead audit panel". Shows what a single
 * lead actually looks like in the product — business name, score arc, signal
 * pills, and the "draft opener" CTA the user clicks next.
 */
function AuditPanelIllustration() {
  return (
    <div className="mask-b-from-95% -ml-2 -mt-2 mr-0.5 pl-2 pt-2">
      <div
        className="relative mx-auto mt-8 w-full overflow-hidden rounded-tl-[20px] border border-transparent shadow"
        style={{
          background: "var(--vx-card)",
          boxShadow:
            "inset 0 0 0 1px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08), 0 24px 60px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.10)",
        }}
        aria-hidden
      >
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 p-6 md:p-8">
          {/* Left column — business + signals */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className="text-[10.5px] uppercase tracking-[0.14em] font-semibold"
                style={{ color: "var(--vx-purple-700)" }}
              >
                Lead audit
              </span>
              <span
                className="text-[10.5px] font-medium"
                style={{ color: "var(--vx-ink-mute)" }}
              >
                · M14 4PH · dental
              </span>
            </div>
            <h4 className="text-[20px] md:text-[24px] font-semibold tracking-[-0.01em] text-[color:var(--vx-ink)] leading-[1.15]">
              Greenfield Dental Practice
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[12px] text-[color:var(--vx-ink-soft)]">
                <Star className="w-3.5 h-3.5 fill-[color:var(--vx-purple-700)] text-[color:var(--vx-purple-700)]" />
                4.6 · 312 reviews
              </span>
              <span className="text-[12px] text-[color:var(--vx-ink-mute)]">·</span>
              <span className="text-[12px] text-[color:var(--vx-ink-mute)]">
                Open · Mon–Fri
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <SignalPill label="Mobile booking fails" tone="warn" />
              <SignalPill label="Schema missing" tone="warn" />
              <SignalPill label="1★ review unreplied" tone="bad" />
              <SignalPill label="LCP 4.8s" tone="warn" />
            </div>
          </div>

          {/* Right column — score arc + actions */}
          <div className="flex flex-col gap-3 items-start md:items-end">
            <ScoreArc score={87} />
            <div className="flex flex-col gap-2 w-full md:items-end">
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[color:var(--vx-ink-mute)]">
                Recommended angle
              </span>
              <span
                className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.18), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08))",
                  color: "var(--vx-purple-700)",
                  border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
                }}
              >
                Booking widget · £1,800 setup
              </span>
              <span
                className="inline-flex items-center gap-2 mt-2 rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, var(--vx-purple-500), var(--vx-purple-700))",
                  color: "white",
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Draft opener
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div
          className="border-t flex items-center justify-between px-6 py-3 text-[11.5px]"
          style={{
            borderColor: "var(--vx-rule, rgba(22,19,31,0.06))",
            color: "var(--vx-ink-mute)",
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Audit complete · 22 signals · 312 reviews scanned
          </span>
          <span>Mockup ready</span>
        </div>
      </div>
    </div>
  );
}

function SignalPill({
  label,
  tone,
}: {
  label: string;
  tone: "warn" | "bad" | "ok";
}) {
  const dot =
    tone === "bad"
      ? "#E5484D"
      : tone === "warn"
        ? "#F5A524"
        : "#30A46C";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px]"
      style={{
        background: "rgba(22,19,31,0.04)",
        color: "var(--vx-ink-soft)",
        border: "1px solid rgba(22,19,31,0.06)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: dot }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function ScoreArc({ score }: { score: number }) {
  // Arc maths: 180° semicircle, score (0-100) → fraction of circumference
  const r = 46;
  const c = Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative w-[140px] h-[80px]">
      <svg viewBox="0 0 120 70" className="w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="cf-arc" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--leadac-h) var(--leadac-s) 70%)" />
            <stop offset="100%" stopColor="hsl(var(--leadac-h) var(--leadac-s) 50%)" />
          </linearGradient>
        </defs>
        <path
          d={`M14,60 A${r},${r} 0 0 1 106,60`}
          stroke="rgba(22,19,31,0.08)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M14,60 A${r},${r} 0 0 1 106,60`}
          stroke="url(#cf-arc)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <span className="text-[26px] font-semibold tracking-[-0.02em] text-[color:var(--vx-ink)] leading-none">
          {score}
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-[color:var(--vx-ink-mute)] mt-0.5">
          opportunity
        </span>
      </div>
    </div>
  );
}

/**
 * Card 2 illustration: a stylised Google-Maps tile with pins. Communicates
 * "live local data" without screenshotting the real Maps tile.
 */
function MapIllustration() {
  return (
    <div
      className="relative mt-6 aspect-video rounded-2xl overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #F2EEFB 0%, #E7DFF6 100%)",
        border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.14)",
      }}
      aria-hidden
    >
      {/* Faint grid */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="cf-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(22,19,31,0.06)"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="200" height="120" fill="url(#cf-grid)" />
        {/* Faint road lines */}
        <path
          d="M-10,40 Q60,20 110,55 T220,80"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="6"
          fill="none"
        />
        <path
          d="M-10,90 Q70,80 130,90 T220,75"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="5"
          fill="none"
        />
      </svg>

      {/* Pins */}
      {[
        { x: "18%", y: "32%", delay: 0 },
        { x: "44%", y: "22%", delay: 0.1 },
        { x: "62%", y: "48%", delay: 0.05 },
        { x: "30%", y: "68%", delay: 0.15 },
        { x: "78%", y: "70%", delay: 0.2 },
        { x: "82%", y: "30%", delay: 0.08 },
      ].map((p, i) => (
        <Pin key={i} x={p.x} y={p.y} />
      ))}

      {/* Postcode chip */}
      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm border border-black/5 text-[color:var(--vx-ink)]">
        <MapPin className="w-3 h-3" style={{ color: "var(--vx-purple-700)" }} />
        M14 + dental
      </div>

      {/* Bottom strip — three mini lead rows */}
      <div className="absolute left-3 right-3 bottom-3 rounded-xl bg-white/95 backdrop-blur border border-black/5 shadow-sm p-2 flex flex-col gap-1.5">
        {[
          { name: "Greenfield Dental", score: 87 },
          { name: "Northside Smile Co", score: 73 },
          { name: "Trafford Family Dental", score: 64 },
        ].map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between text-[11px]"
          >
            <span className="text-[color:var(--vx-ink)] font-medium truncate">
              {row.name}
            </span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--vx-purple-700)" }}
            >
              {row.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pin({ x, y }: { x: string; y: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full"
      style={{ left: x, top: y }}
      aria-hidden
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shadow-md"
        style={{
          background:
            "linear-gradient(135deg, var(--vx-purple-500), var(--vx-purple-700))",
          color: "white",
          boxShadow: "0 4px 14px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.45)",
        }}
      >
        <MapPin className="w-3.5 h-3.5" strokeWidth={2.4} />
      </div>
      <div
        className="w-2 h-2 rotate-45 mx-auto -mt-1"
        style={{
          background:
            "linear-gradient(135deg, var(--vx-purple-500), var(--vx-purple-700))",
        }}
      />
    </div>
  );
}

/**
 * Card 3 illustration: a draft email card with a "View mockup" pill. Shows
 * what the AI hands you on the first line.
 */
function OpenerIllustration() {
  return (
    <div className="relative mt-6">
      <div
        className="rounded-2xl p-4 transition-transform duration-200 ease-in-out group-hover:-rotate-2"
        style={{
          background: "var(--vx-card)",
          border: "1px solid var(--vx-rule, rgba(22,19,31,0.08))",
          boxShadow: "0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.10)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{
              background:
                "linear-gradient(135deg, var(--vx-purple-400), var(--vx-purple-700))",
              color: "white",
            }}
          >
            G
          </div>
          <div className="flex flex-col">
            <span className="text-[12.5px] font-medium text-[color:var(--vx-ink)] leading-none">
              To: Greenfield Dental
            </span>
            <span className="text-[10.5px] text-[color:var(--vx-ink-mute)] mt-1">
              Subject — your booking page on mobile
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div
            className="h-2 rounded-full w-[92%]"
            style={{ background: "rgba(22,19,31,0.08)" }}
          />
          <div
            className="h-2 rounded-full w-[78%]"
            style={{ background: "rgba(22,19,31,0.08)" }}
          />
          <div
            className="h-2 rounded-full w-[58%]"
            style={{ background: "rgba(22,19,31,0.08)" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
              color: "var(--vx-purple-700)",
              border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
            }}
          >
            <ArrowUpRight className="w-3 h-3" />
            View mockup
          </span>
          <span className="text-[10.5px] text-[color:var(--vx-ink-mute)]">
            +0.9% reply lift
          </span>
        </div>
      </div>

      <div
        className="absolute -top-3 right-3 rounded-xl px-2 py-1 text-[10px] font-semibold shadow-sm transition-transform duration-200 ease-in-out group-hover:rotate-3"
        style={{
          background: "white",
          color: "var(--vx-purple-700)",
          border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
        }}
        aria-hidden
      >
        Draft 1
      </div>
    </div>
  );
}

/**
 * Card 4 illustration: a draft "send from your inbox" composer, mirroring
 * the demo's AIAssistantIllustration shape.
 */
function InboxIllustration() {
  return (
    <div
      className="mt-6 rounded-2xl p-4 pb-3 transition-transform duration-200 group-hover:translate-y-[-4px]"
      style={{
        background: "var(--vx-card)",
        border: "1px solid var(--vx-rule, rgba(22,19,31,0.08))",
        boxShadow: "0 12px 32px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.08)",
      }}
      aria-hidden
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--vx-purple-700)" }} />
        <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--vx-purple-700)]">
          Draft ready · auto-send off
        </span>
      </div>
      <p className="text-[12.5px] text-[color:var(--vx-ink-soft)] leading-snug line-clamp-2">
        Saw your booking widget on Greenfield Dental — it’s freezing on iPhone after the “next slot” tap…
      </p>

      <div
        className="mt-3 -mx-1 rounded-xl p-2.5 flex items-center justify-between"
        style={{ background: "rgba(22,19,31,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded-md px-2 py-1 text-[10.5px] font-semibold"
            style={{
              background: "white",
              color: "var(--vx-ink)",
              border: "1px solid var(--vx-rule, rgba(22,19,31,0.08))",
            }}
          >
            Gmail
          </span>
          <span className="text-[10.5px] text-[color:var(--vx-ink-mute)]">
            from mert@leadac.ai
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, var(--vx-purple-500), var(--vx-purple-700))",
            color: "white",
          }}
          tabIndex={-1}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
