"use client";

import Link from "next/link";

export interface UsageBadgeProps {
  usage: {
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
    planName: string;
    leadsUsed: number;
    leadsLimit: number;
    aiUsed: number;
    aiLimit: number;
  };
}

function bar(used: number, limit: number) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const color =
    pct >= 90
      ? "var(--leadac-error)"
      : pct >= 70
      ? "var(--leadac-warning)"
      : "var(--leadac-500)";
  return { pct, color };
}

// Number.toLocaleString() picks up the runtime's default locale, which
// differs between Node (en-US) and a Turkish/non-English browser (tr-TR
// → "1.000" instead of "1,000"). That mismatch fires React error #418
// during hydration, which tears down the whole client tree and breaks
// effects mid-render (e.g. cancels the LocationPicker debounce timer).
// Pinning the locale keeps SSR and CSR byte-identical.
const NUM_FMT = new Intl.NumberFormat("en-US");

export function UsageBadge({ usage }: UsageBadgeProps) {
  const leads = bar(usage.leadsUsed, usage.leadsLimit);
  const ai = bar(usage.aiUsed, usage.aiLimit);

  return (
    <Link
      href="/app/settings/billing"
      className="block rounded-lg p-2.5 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
      style={{
        background: "rgba(255, 255, 255, 0.025)",
        border: "0.5px solid rgba(255, 255, 255, 0.06)",
      }}
      aria-label={`Plan: ${usage.planName}. View billing.`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] uppercase tracking-wider font-semibold text-white/45">
          {usage.planName} plan
        </span>
        {usage.plan === "FREE" && (
          <span className="text-[10px] font-medium text-(--leadac-500)">Upgrade →</span>
        )}
      </div>

      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[10.5px] mb-0.5">
            <span style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.55)" }}>Leads</span>
            <span style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.7)" }}>
              {NUM_FMT.format(usage.leadsUsed)} / {NUM_FMT.format(usage.leadsLimit)}
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255, 255, 255, 0.06)" }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${leads.pct}%`, backgroundColor: leads.color }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10.5px] mb-0.5">
            <span style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.55)" }}>AI credits</span>
            <span style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.7)" }}>
              {NUM_FMT.format(usage.aiUsed)} / {NUM_FMT.format(usage.aiLimit)}
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255, 255, 255, 0.06)" }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${ai.pct}%`, backgroundColor: ai.color }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
