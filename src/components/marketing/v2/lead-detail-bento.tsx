/**
 * Account-detail bento for the v2 marketing hero.
 *
 * Design intent: a static no-JS bento that mirrors what the actual
 * account-detail page shows when Revint has fully analysed a target
 * account. Same vocabulary the product writes back into Postgres
 * (real `LeadTrigger.type` enum values, real `SalesOpportunity.reasonCodes`,
 * real `ReviewAnalysis.weaknessKpis`) and the same severity /
 * urgency-window framing the trigger ranker surfaces. A first-time
 * visitor reads "this is the screen I will be working in", not "this
 * is a marketing diagram".
 *
 * No real customer data. The fictional "Cucina 47 / Austin" account
 * is shaped to match the kind of signal distribution we see on a
 * growing independent restaurant that is a prime target account for
 * a restaurant-tech SaaS vendor (the beachhead vertical).
 *
 * Pure server component, CSS-only decoration, motion-reduce safe.
 */
import * as React from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  PhoneOff,
  Voicemail,
  X,
} from "lucide-react";

interface Trigger {
  type: string;
  label: string;
  severity: number;
  windowDays: number;
}

const TRIGGERS: Trigger[] = [
  {
    type: "BAD_SERVICE_REVIEWS",
    label: "Wait-time complaints rising",
    severity: 78,
    windowDays: 30,
  },
  {
    type: "MULTI_LOCATION_EXPANSION",
    label: "3rd location announced",
    severity: 65,
    windowDays: 60,
  },
  {
    type: "DIGITAL_CHANNEL_GAP",
    label: "No QR menu, no online ordering",
    severity: 60,
    windowDays: 30,
  },
  {
    type: "POS_INCUMBENT_DETECTED",
    label: "On Square POS · upgrade fit",
    severity: 50,
    windowDays: 90,
  },
];

const REASON_CODES = [
  "multi_location",
  "pos_square",
  "no_qr_menu",
  "no_online_ordering",
  "high_review_volume",
];

interface ReviewKpi {
  label: string;
  count: number;
  trend?: string;
}

const REVIEW_KPIS: ReviewKpi[] = [
  { label: "Weekend wait complaints", count: 11, trend: "+38%" },
  { label: "Phone-order frustration", count: 4, trend: "+20%" },
  { label: "Menu-card legibility flags", count: 7 },
];

interface DispositionChip {
  icon: typeof CheckCircle2;
  label: string;
  count: number;
}

const DISPOSITIONS: DispositionChip[] = [
  { icon: CheckCircle2, label: "Connected", count: 7 },
  { icon: Voicemail, label: "Voicemail", count: 11 },
  { icon: PhoneOff, label: "No-answer", count: 9 },
  { icon: X, label: "Wrong-#", count: 1 },
];

function severityTone(s: number): string {
  if (s >= 70) return "var(--revint-error)";
  if (s >= 50) return "var(--revint-warning)";
  return "var(--revint-info)";
}

export function LeadDetailBento() {
  return (
    <div
      className="relative w-full max-w-[580px] mx-auto rounded-[28px] overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-ns) 11%) 0%, hsl(var(--revint-h) var(--revint-ns) 7%) 100%)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)",
      }}
    >
      {/* HEADER BAR — mirrors HeaderBar.tsx */}
      <header
        className="flex items-center gap-3 px-5 pt-5 pb-4"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
          aria-hidden
        >
          <ArrowLeft className="h-3.5 w-3.5 text-white/55" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-semibold text-white truncate">
              Cucina 47
            </span>
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium"
              style={{
                background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.12)",
                color: "hsl(var(--revint-h) var(--revint-s) 78%)",
                border: "0.5px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.28)",
              }}
            >
              Italian · 2 locations
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-white/45">
            Austin, TX · 4.5★ · 1.5k reviews · on Square POS
          </p>
        </div>

        <span
          className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wide"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            border: "0.5px solid rgba(255,255,255,0.12)",
          }}
        >
          T1
        </span>

        <span
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold tabular-nums flex items-center gap-1"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-s) 50% / 0.18), hsl(var(--revint-h) var(--revint-s) 50% / 0.06))",
            color: "hsl(var(--revint-h) var(--revint-s) 80%)",
            border: "0.5px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.32)",
          }}
        >
          <span className="text-[9.5px] uppercase tracking-wider opacity-70">
            Fit
          </span>
          73
        </span>
      </header>

      {/* WHY NOW — mirrors WhyNowBlock.tsx (top trigger headline + window) */}
      <section className="px-5 pt-4 pb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/50">
            <Clock className="h-3 w-3" aria-hidden />
            Why now
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px]"
            style={{
              background: "var(--revint-error)",
              color: "white",
              opacity: 0.92,
            }}
          >
            Active 30d
          </span>
        </div>

        <p className="text-[14.5px] font-medium text-white leading-snug">
          Weekend wait-time complaints up 38% in the last 30 days, third
          location announced, no QR menu live. QR ordering + direct-channel
          margin is the strongest hook.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {REVIEW_KPIS.map((k) => (
            <span
              key={k.label}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-white/75"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-white/90">{k.label}</span>
              <span
                className="rounded px-1 py-px text-[10px] font-mono tabular-nums"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {k.count}
              </span>
              {k.trend ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[9.5px] font-mono tabular-nums"
                  style={{
                    background: "var(--revint-error)",
                    color: "white",
                    opacity: 0.9,
                  }}
                  aria-label={`Trend ${k.trend} over 30 days`}
                >
                  <span aria-hidden>▲</span>
                  {k.trend}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      {/* BENTO ROW: TRIGGERS (left) + RECOMMENDED ANGLE (right) */}
      <div
        className="grid grid-cols-1 sm:grid-cols-[1.25fr_1fr] gap-px"
        style={{
          background: "rgba(255,255,255,0.06)",
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* ACTIVE TRIGGERS — mirrors LeadTrigger rows */}
        <div
          className="p-5"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-ns) 10%), hsl(var(--revint-h) var(--revint-ns) 8%))",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/50">
              Active triggers
            </span>
            <span className="text-[10.5px] text-white/40 font-mono tabular-nums">
              4 / 6
            </span>
          </div>

          <ul className="space-y-2.5">
            {TRIGGERS.map((t) => {
              const tone = severityTone(t.severity);
              return (
                <li key={t.type} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-tight"
                      style={{ color: "rgba(255,255,255,0.78)" }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: tone }}
                      />
                      {t.type}
                    </span>
                    <span className="text-[10.5px] font-mono tabular-nums text-white/55">
                      {t.severity} · {t.windowDays}d
                    </span>
                  </div>
                  <div
                    className="h-[4px] rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${t.severity}%`,
                        background: `linear-gradient(90deg, ${tone}aa, ${tone})`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* FIRST 30 SECONDS — talk track the rep opens the call with */}
        <div
          className="p-5 flex flex-col"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-ns) 10%), hsl(var(--revint-h) var(--revint-ns) 8%))",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/50">
              First 30 seconds
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.14)",
                color: "hsl(var(--revint-h) var(--revint-s) 78%)",
              }}
            >
              Talk track
            </span>
          </div>

          <blockquote
            className="flex-1 pl-3 text-[12px] italic text-white/75 leading-relaxed"
            style={{
              borderLeft:
                "2px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.45)",
            }}
          >
            Sarah, this is [REP]. Saw Cucina&apos;s third location announced
            and weekend wait complaints stacking the same month. We help
            independent restaurants on Square pull wait down with QR
            ordering — and keep the margin on direct. Got 90 seconds?
          </blockquote>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className="rounded px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              CALL
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              90s ask
            </span>
            <span className="ml-auto text-[10.5px] font-mono tabular-nums text-white/55">
              Hook ready
            </span>
          </div>
        </div>
      </div>

      {/* WEBSITE SIGNALS — mirrors SalesOpportunity.reasonCodes */}
      <section className="px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/50">
            Account signals
          </span>
          <span className="text-[10.5px] text-white/40 font-mono">
            12 reason codes
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REASON_CODES.map((code) => (
            <span
              key={code}
              className="rounded-md px-2 py-1 text-[10.5px] font-mono"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.7)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {code}
            </span>
          ))}
        </div>
      </section>

      {/* DISPOSITION STRIP — mirrors product DispositionStrip.tsx */}
      <footer
        className="flex items-center justify-between gap-2 px-5 py-4"
        style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex items-center gap-1.5 flex-wrap"
          role="group"
          aria-label="Yesterday's disposition mix"
        >
          {DISPOSITIONS.map((d) => {
            const Icon = d.icon;
            return (
              <span
                key={d.label}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-white/85"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid rgba(255,255,255,0.1)",
                }}
                aria-label={`${d.count} ${d.label.toLowerCase()}`}
              >
                <Icon className="h-3 w-3 text-white/65" aria-hidden />
                {d.label}
                <span className="font-mono tabular-nums text-white/55">
                  {d.count}
                </span>
              </span>
            );
          })}
        </div>
        <span
          className="hidden md:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] text-white/55"
          style={{
            background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.1)",
            border: "0.5px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.22)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-1 w-1 rounded-full animate-pulse motion-reduce:animate-none"
            style={{ background: "hsl(var(--revint-h) var(--revint-s) 70%)" }}
          />
          CRM-synced
        </span>
      </footer>
    </div>
  );
}
