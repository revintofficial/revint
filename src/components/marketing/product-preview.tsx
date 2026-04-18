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
      "5★ café with no website. They're getting 200+ Instagram DMs/week asking for a menu. Slam-dunk pitch.",
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
    <div className="relative">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(28,28,30,0.7), rgba(20,20,22,0.9))",
          border: "0.5px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* App chrome */}
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
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
                    background: "linear-gradient(180deg, #6E7AE0, #4C5BC1)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.18) inset, 0 0 0 0.5px rgba(94,106,210,0.5)",
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
                Generate personalized pitches for these 3 leads — 1 click.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
