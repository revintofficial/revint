/**
 * Lead-detail bento for the v2 marketing hero.
 *
 * Design intent: a static no-JS bento that mirrors what the actual
 * lead detail page (LeadDetailV2Client) shows when LeadAC has fully
 * analyzed a prospect. Same vocabulary the product writes back into
 * Postgres: real `LeadTrigger.type` enum values, real
 * `SalesOpportunity.reasonCodes`, real `ReviewAnalysis.weaknessKpis`,
 * and the same severity / urgency-window framing the trigger ranker
 * surfaces. A first-time visitor reads "this is the screen I will be
 * working in", not "this is a marketing diagram".
 *
 * No real customer data. The fictional "Cucina 47 / Greenwich" lead is
 * shaped to match the real signal distribution we see on a fully-cooked
 * casual-dining restaurant in our beta workspace.
 *
 * Pure server component, CSS-only decoration, motion-reduce safe.
 */
import * as React from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Mail,
  Mic,
  Phone,
  Sparkles,
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
    label: "Bad service reviews",
    severity: 78,
    windowDays: 30,
  },
  {
    type: "COMPETITOR_PRESSURE",
    label: "Competitor pressure",
    severity: 65,
    windowDays: 60,
  },
  {
    type: "REBRANDING",
    label: "Rebranding in flight",
    severity: 60,
    windowDays: 90,
  },
  {
    type: "MENU_REDESIGN_SIGNAL",
    label: "Menu redesign signal",
    severity: 50,
    windowDays: 60,
  },
];

const REASON_CODES = [
  "high_rating_weak_site",
  "no_qr_menu",
  "no_booking",
  "no_https",
  "high_review_volume",
];

interface ReviewKpi {
  label: string;
  count: number;
  trend?: string;
}

const REVIEW_KPIS: ReviewKpi[] = [
  { label: "Greasy / worn menu cards", count: 11, trend: "+38%" },
  { label: "Service charge disputes", count: 4, trend: "+20%" },
  { label: "Small portions", count: 7 },
];

const ACTIONS = [
  { icon: Phone, label: "Dial" },
  { icon: Mail, label: "Email" },
  { icon: Mic, label: "Voice" },
  { icon: Calendar, label: "Schedule" },
];

function severityTone(s: number): string {
  if (s >= 70) return "var(--leadac-error)";
  if (s >= 50) return "var(--leadac-warning)";
  return "var(--leadac-info)";
}

export function LeadDetailBento() {
  return (
    <div
      className="relative w-full max-w-[580px] mx-auto rounded-[28px] overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 11%) 0%, hsl(var(--leadac-h) var(--leadac-ns) 7%) 100%)",
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
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
                border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.28)",
              }}
            >
              Italian · casual dining
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-white/45">
            Greenwich, London · 4.5★ · 1.5k reviews
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
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.06))",
            color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
            border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.32)",
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
              background: "var(--leadac-error)",
              color: "white",
              opacity: 0.92,
            }}
          >
            Active 30d
          </span>
        </div>

        <p className="text-[14.5px] font-medium text-white leading-snug">
          Greasy and worn physical menu complaints up 38% in the last
          30 days. QR menu + loyalty angle is the strongest hook.
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
                    background: "var(--leadac-error)",
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
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 10%), hsl(var(--leadac-h) var(--leadac-ns) 8%))",
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

        {/* RECOMMENDED ANGLE — mirrors NextGestureBlock + opportunity */}
        <div
          className="p-5 flex flex-col"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 10%), hsl(var(--leadac-h) var(--leadac-ns) 8%))",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/50">
              Recommended
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.14)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
              }}
            >
              v6
            </span>
          </div>

          <div className="flex items-start gap-2 mb-3">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.16)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
                border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.3)",
              }}
              aria-hidden
            >
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-[14px] font-semibold text-white leading-tight">
              QR menu + loyalty
            </p>
          </div>

          <p className="text-[11.5px] text-white/55 leading-relaxed flex-1">
            Diners flagging greasy and worn physical menu cards over the
            last 30 days. Anchor on QR menu replacement and a points
            loyalty program. Skip the food compliment.
          </p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className="rounded px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              AIDA
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              EMAIL
            </span>
            <span className="ml-auto text-[10.5px] font-mono tabular-nums text-white/55">
              60% conf
            </span>
          </div>
        </div>
      </div>

      {/* WEBSITE SIGNALS — mirrors SalesOpportunity.reasonCodes */}
      <section className="px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/50">
            Website signals
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

      {/* ACTION CHIPS — mirrors HeaderBar quick actions */}
      <footer
        className="flex items-center justify-between gap-2 px-5 py-4"
        style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <span
                key={a.label}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-white/85"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid rgba(255,255,255,0.1)",
                }}
              >
                <Icon className="h-3 w-3 text-white/65" aria-hidden />
                {a.label}
              </span>
            );
          })}
        </div>
        <span
          className="hidden md:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] text-white/55"
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.1)",
            border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-1 w-1 rounded-full animate-pulse motion-reduce:animate-none"
            style={{ background: "hsl(var(--leadac-h) var(--leadac-s) 70%)" }}
          />
          Updated 2h ago
        </span>
      </footer>
    </div>
  );
}
