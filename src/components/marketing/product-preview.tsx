"use client";

import {
  Search,
  Star,
  Globe,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Phone,
  MapPin,
} from "lucide-react";

const SAMPLE_LEADS = [
  {
    name: "Bella Vita Trattoria",
    borough: "Brooklyn, NY",
    phone: "+1 (718) 555-0142",
    website: "bellavita-trattoria.com",
    score: 87,
    issues: ["No mobile site", "No HTTPS", "No booking"],
    pitch:
      "Their site looks like 2008. They're getting 4.7★ but losing reservations because guests can't book on mobile.",
  },
  {
    name: "Marlow Coffee Co.",
    borough: "Williamsburg, NY",
    phone: "+1 (718) 555-0298",
    website: null,
    score: 94,
    issues: ["No website", "No online ordering"],
    pitch:
      "5★ café with no website. They're getting 200+ Instagram DMs/week asking for a menu. An easy first call.",
  },
  {
    name: "Nova Dental Studio",
    borough: "Queens, NY",
    phone: "+1 (347) 555-0118",
    website: "novadental-ny.com",
    score: 72,
    issues: ["Slow load (5.2s)", "No SEO", "Outdated design"],
    pitch:
      "Dental practices in this zip code earn $1.2M+/yr. Their site is killing 30%+ of organic search.",
  },
];

function scoreColor(s: number) {
  if (s >= 85) return "#F87171";
  if (s >= 70) return "#F59E0B";
  return "#5E6AD2";
}

export function ProductPreview() {
  return (
    <div className="relative" style={{ perspective: "2400px" }}>
      {/* Soft overhead light (key light) */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -top-32 w-[120%] h-[420px] -z-10 pointer-events-none blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.28), rgba(94,106,210,0.18) 40%, transparent 70%)",
        }}
      />
      {/* Subtle rim light from the right */}
      <div
        aria-hidden
        className="absolute -right-20 top-10 w-[460px] h-[460px] -z-10 pointer-events-none blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(94,106,210,0.45), transparent 60%)",
        }}
      />

      <div
        className="relative rounded-2xl overflow-hidden will-change-transform"
        style={{
          background:
            "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 50%, rgba(16,16,20,0.98) 100%)",
          border: "0.5px solid rgba(255,255,255,0.09)",
          transform: "rotateX(2deg)",
          transformOrigin: "50% 100%",
          boxShadow: [
            // ambient
            "0 1px 0 rgba(255,255,255,0.08) inset",
            "0 0 0 1px rgba(255,255,255,0.04) inset",
            // contact shadow under the device
            "0 2px 6px rgba(0,0,0,0.4)",
            // mid drop
            "0 24px 60px rgba(0,0,0,0.55)",
            // long, photographic falloff
            "0 60px 140px rgba(0,0,0,0.7)",
            // subtle colored bounce light
            "0 80px 200px rgba(49,46,129,0.35)",
          ].join(", "),
        }}
      >
        {/* Top glass highlight (mimics studio key light hitting the bezel) */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 pointer-events-none opacity-60"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)",
            mixBlendMode: "overlay",
          }}
        />
        {/* Faint diagonal sheen */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            background:
              "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.6) 48%, transparent 60%)",
            mixBlendMode: "overlay",
          }}
        />

        {/* App chrome */}
        <div
          className="relative px-4 py-2.5 flex items-center gap-2"
          style={{
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
            background:
              "linear-gradient(180deg, rgba(44,44,48,0.75), rgba(30,30,34,0.55))",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div
            className="ml-3 flex-1 max-w-md mx-auto px-3 py-1 rounded text-[11px] text-white/40"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            app.leadengine.io / leads
          </div>
        </div>

        <div className="grid md:grid-cols-[200px_1fr] min-h-[520px]">
          {/* Sidebar mock */}
          <div
            className="p-3 hidden md:block"
            style={{ borderRight: "0.5px solid rgba(255,255,255,0.05)" }}
          >
            <div className="space-y-0.5">
              {[
                { label: "Overview", active: false },
                { label: "Discover", active: false },
                { label: "Leads", active: true },
                { label: "Pipeline", active: false },
                { label: "Shortlist", active: false },
                { label: "Tasks", active: false },
                { label: "Campaigns", active: false },
              ].map((n) => (
                <div
                  key={n.label}
                  className="px-2.5 py-1.5 rounded-md text-[11.5px]"
                  style={{
                    background: n.active ? "rgba(94,106,210,0.16)" : "transparent",
                    color: n.active ? "white" : "rgba(235,235,245,0.55)",
                    fontWeight: n.active ? 600 : 400,
                  }}
                >
                  {n.label}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Leads</h3>
                <p className="text-[11.5px] text-white/45">
                  3 high-priority targets in Brooklyn
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-white/55"
                  style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)" }}
                >
                  <Search className="w-3 h-3" />
                  Search…
                </div>
                <div
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white"
                  style={{
                    background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.6)",
                  }}
                >
                  + New search
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {SAMPLE_LEADS.map((lead) => (
                <div
                  key={lead.name}
                  className="p-3 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{
                      background: `${scoreColor(lead.score)}1f`,
                      border: `0.5px solid ${scoreColor(lead.score)}40`,
                    }}
                  >
                    <span
                      className="text-[15px] font-bold leading-none"
                      style={{ color: scoreColor(lead.score) }}
                    >
                      {lead.score}
                    </span>
                    <span
                      className="text-[8.5px] uppercase tracking-wider mt-0.5"
                      style={{ color: scoreColor(lead.score) }}
                    >
                      Score
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-[13.5px] font-semibold truncate">{lead.name}</h4>
                      <Star className="w-3 h-3 text-[#FFD60A] fill-[#FFD60A]" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50 mb-1.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {lead.borough}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" /> {lead.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> {lead.website || "no website"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {lead.issues.map((i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            background: "rgba(255, 69, 58, 0.1)",
                            color: "rgba(255, 100, 92, 0.95)",
                            border: "0.5px solid rgba(255, 69, 58, 0.18)",
                          }}
                        >
                          {i}
                        </span>
                      ))}
                    </div>
                    <p
                      className="text-[11.5px] italic leading-snug"
                      style={{ color: "rgba(235, 235, 245, 0.6)" }}
                    >
                      <Sparkles className="w-2.5 h-2.5 inline -mt-0.5 mr-1" style={{ color: "#A5B4FC" }} />
                      {lead.pitch}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 self-stretch sm:self-center">
                    <ArrowRight className="w-3.5 h-3.5 text-white/40" />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-5 px-3 py-2.5 rounded-xl flex items-center gap-2"
              style={{
                background: "rgba(52, 211, 153, 0.07)",
                border: "0.5px solid rgba(52, 211, 153, 0.2)",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
              <p className="text-[11.5px] text-white/75">
                <span className="font-semibold text-white">Next:</span>{" "}
                Generate personalized pitches for these three leads in one click.
              </p>
            </div>
          </div>
        </div>

        {/* Faint inner vignette to deepen the corners (photographic falloff) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            boxShadow:
              "inset 0 0 120px rgba(0,0,0,0.35), inset 0 -40px 80px rgba(0,0,0,0.25)",
          }}
        />
      </div>

      {/* Floor reflection (gives the device weight, like sitting on glass) */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -bottom-10 w-[88%] h-24 pointer-events-none -z-10 blur-2xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.55), transparent 70%)",
        }}
      />
    </div>
  );
}
