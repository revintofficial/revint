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
          <span className="vx-badge-light">The system between AI slop and hand-written</span>
          <h2 className="vx-display text-[clamp(30px,4.4vw,52px)] leading-[1.04] text-[color:var(--vx-ink)] max-w-[24ch]">
            Generating text is easy. Doing the homework is what gets a{" "}
            <span className="vx-text-gradient">reply.</span>
          </h2>
          <p className="text-[14.5px] md:text-[15.5px] text-[color:var(--vx-ink-mute)] max-w-xl leading-relaxed">
            Every prospect gets researched before a single word is written. Site signals, reviews, sub-niche, competitor ads, social posts. The draft starts from what we found, not from a generic prompt.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Hero card — col-span-full, audit panel illustration */}
          <FeatureCard
            tinted
            className="col-span-full lg:row-span-1 overflow-hidden pl-6 pt-6 pr-6"
            icon={<FileSearch className="w-5 h-5" />}
            title="Deep research on every prospect, before you write a word"
            body="Site signals, up to 500 reviews scanned for sentiment, sub-niche classification, competitor ads, social posts. All run before the draft. 0-100 score with the angle and price band waiting. Skip the research and you're guessing, same as everyone else in the inbox."
          >
            <AuditPanelIllustration />
          </FeatureCard>

          {/* Small card 1 — fresh local data, map illustration */}
          <FeatureCard
            className="overflow-hidden p-6"
            icon={<MapPin className="w-5 h-5" />}
            title="Data nobody else has"
            body="Your list pulls fresh from our local-business index this morning. No other agency is emailing these tonight."
          >
            <MapIllustration />
          </FeatureCard>

          {/* Small card 2 — opener that did the research */}
          <FeatureCard
            className="group overflow-hidden p-6"
            icon={<Mail className="w-5 h-5" />}
            title="Emails that mention actual problems"
            body="The draft references something the prospect can see on their own homepage. They read it and think 'wait, we're actually missing this.' After that, you don't have to sell."
          >
            <OpenerIllustration />
          </FeatureCard>

          {/* Small card 3 — your inbox, your brand */}
          <FeatureCard
            className="group overflow-hidden p-6"
            icon={<Inbox className="w-5 h-5" />}
            title="Your inbox. Your rules."
            body="Auto-send stays off. Review everything and send from your own Gmail or Outlook."
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
 * Hero card illustration: the full "lead research" panel as it appears
 * inside the product. Layered vertically to surface every research stage
 * the system runs on a single prospect: site audit, review intelligence
 * (themes + verbatim pain phrases), sub-niche detection, and reason
 * codes feeding the score. Real beta-cohort data (Fabler Bakery Camden,
 * NW1 0LT, May 2026) — not mock numbers.
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
        {/* Header band: business + score */}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 p-6 md:p-8 pb-5 md:pb-6">
          {/* Left column — business + site signals */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className="text-[10.5px] uppercase tracking-[0.14em] font-semibold"
                style={{ color: "var(--vx-purple-700)" }}
              >
                Lead research
              </span>
              <span
                className="text-[10.5px] font-medium"
                style={{ color: "var(--vx-ink-mute)" }}
              >
                · NW1 0LT · cafés
              </span>
            </div>
            <h4 className="text-[20px] md:text-[24px] font-semibold tracking-[-0.01em] text-[color:var(--vx-ink)] leading-[1.15]">
              Fabler Bakery Camden
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[12px] text-[color:var(--vx-ink-soft)]">
                <Star className="w-3.5 h-3.5 fill-[color:var(--vx-purple-700)] text-[color:var(--vx-purple-700)]" />
                4.9 · 1,141 reviews
              </span>
              <span className="text-[12px] text-[color:var(--vx-ink-mute)]">·</span>
              <span className="text-[12px] text-[color:var(--vx-ink-mute)]">
                Open · daily
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <SignalPill label="No HTTPS" tone="bad" />
              <SignalPill label="No online booking" tone="warn" />
              <SignalPill label="Schema missing" tone="warn" />
              <SignalPill label="QR menu missing" tone="warn" />
            </div>
          </div>

          {/* Right column — score arc + recommended angle + draft */}
          <div className="flex flex-col gap-3 items-start md:items-end">
            <ScoreArc score={80} />
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
                QR table ordering · £2,200 setup
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

        {/* Review intelligence band */}
        <div
          className="px-6 md:px-8 py-5 border-t"
          style={{ borderColor: "var(--vx-rule, rgba(22,19,31,0.06))" }}
        >
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <span
              className="text-[10.5px] uppercase tracking-[0.14em] font-semibold"
              style={{ color: "var(--vx-purple-700)" }}
            >
              Review intelligence
            </span>
            <span
              className="text-[10.5px] inline-flex items-center gap-3 flex-wrap"
              style={{ color: "var(--vx-ink-mute)" }}
            >
              <span>50 reviews scanned</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#30A46C" }}
                  aria-hidden
                />
                96% positive
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#E5484D" }}
                  aria-hidden
                />
                4% negative
              </span>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-7 gap-y-4">
            {/* Strength themes */}
            <div className="flex flex-col gap-2">
              <div
                className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-0.5"
                style={{ color: "var(--vx-ink-mute)" }}
              >
                Strength themes · count · share
              </div>
              <ThemeBar label="Great food" count={30} percent={61} />
              <ThemeBar label="Friendly staff" count={19} percent={39} />
              <ThemeBar label="Cozy atmosphere" count={8} percent={16} />
            </div>
            {/* Pain phrases verbatim */}
            <div className="flex flex-col gap-1.5">
              <div
                className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-0.5"
                style={{ color: "var(--vx-ink-mute)" }}
              >
                Pain phrases · verbatim from reviewers
              </div>
              <PainQuote text="very little space, very cramped" />
              <PainQuote text="the waiter is VERY rude" />
              <PainQuote text="it was quite expensive" />
            </div>
          </div>
        </div>

        {/* Sub-niche + reason codes band */}
        <div
          className="px-6 md:px-8 py-3.5 border-t flex items-center justify-between gap-x-5 gap-y-2 flex-wrap"
          style={{ borderColor: "var(--vx-rule, rgba(22,19,31,0.06))" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-[0.12em] font-semibold"
              style={{ color: "var(--vx-ink-mute)" }}
            >
              Sub-niche
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-[11.5px] font-medium"
              style={{
                background:
                  "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
                color: "var(--vx-purple-700)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
              }}
            >
              café-bakery · 55% confidence
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className="text-[10px] uppercase tracking-[0.12em] font-semibold"
              style={{ color: "var(--vx-ink-mute)" }}
            >
              Reason codes · 5 of 13
            </span>
            <span
              className="text-[10.5px] font-mono truncate"
              style={{ color: "var(--vx-ink-soft)" }}
            >
              icp_fit · high_review_volume · high_rating_weak_site · no_qr_menu · no_reservation
            </span>
          </div>
        </div>

        {/* Footer status */}
        <div
          className="border-t flex items-center justify-between px-6 py-3 text-[11.5px]"
          style={{
            borderColor: "var(--vx-rule, rgba(22,19,31,0.06))",
            color: "var(--vx-ink-mute)",
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Research complete · 22 signals · 50 reviews analyzed · sub-niche tagged
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

/**
 * Strength theme row inside Review intelligence band. Bar width is
 * `percent` of the row, label and count sit on the left, percent label
 * on the right. Visualises that we don't just count reviews — we
 * cluster them by theme and quantify the share.
 */
function ThemeBar({
  label,
  count,
  percent,
}: {
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span
        className="font-medium truncate"
        style={{ color: "var(--vx-ink)", minWidth: "112px", maxWidth: "112px" }}
      >
        {label}
      </span>
      <span
        className="text-[10.5px] tabular-nums"
        style={{ color: "var(--vx-ink-mute)", minWidth: "20px" }}
      >
        {count}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(22,19,31,0.06)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background:
              "linear-gradient(90deg, var(--vx-purple-500), var(--vx-purple-700))",
          }}
        />
      </div>
      <span
        className="text-[11px] tabular-nums font-semibold"
        style={{
          color: "var(--vx-purple-700)",
          minWidth: "30px",
          textAlign: "right",
        }}
      >
        {percent}%
      </span>
    </div>
  );
}

/**
 * Verbatim review pain phrase chip. Uses a soft red surface so the
 * complaint reads as a real-customer quote, not as a system label —
 * this is the "wait, we're actually missing this" moment in card form.
 */
function PainQuote({ text }: { text: string }) {
  return (
    <div
      className="text-[11.5px] leading-snug rounded-md px-2.5 py-1.5"
      style={{
        background: "rgba(229,72,77,0.06)",
        border: "1px solid rgba(229,72,77,0.14)",
        color: "var(--vx-ink-soft)",
      }}
    >
      <span
        className="text-[9px] mr-1.5 align-middle"
        style={{ color: "#E5484D" }}
        aria-hidden
      >
        ●
      </span>
      &quot;{text}&quot;
    </div>
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
        NW1 + cafés
      </div>

      {/* Bottom strip — three mini lead rows */}
      <div className="absolute left-3 right-3 bottom-3 rounded-xl bg-white/95 backdrop-blur border border-black/5 shadow-sm p-2 flex flex-col gap-1.5">
        {[
          { name: "Brew's", score: 94 },
          { name: "Fabler Bakery Camden", score: 80 },
          { name: "LUMI Camden", score: 78 },
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
            F
          </div>
          <div className="flex flex-col">
            <span className="text-[12.5px] font-medium text-[color:var(--vx-ink)] leading-none">
              To: Fabler Bakery Camden
            </span>
            <span className="text-[10.5px] text-[color:var(--vx-ink-mute)] mt-1">
              Subject: your cramped-space reviews
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
        Saw &quot;cramped space&quot; come up in your weekend reviews at Fabler. QR table ordering would clear the Saturday rush…
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
