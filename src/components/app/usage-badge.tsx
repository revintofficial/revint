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
    pct >= 90 ? "#FF453A" : pct >= 70 ? "#FF9F0A" : "#0A84FF";
  return { pct, color };
}

export function UsageBadge({ usage }: UsageBadgeProps) {
  const leads = bar(usage.leadsUsed, usage.leadsLimit);
  const ai = bar(usage.aiUsed, usage.aiLimit);

  return (
    <Link
      href="/app/settings/billing"
      className="block rounded-lg p-2.5 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF]"
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
          <span className="text-[10px] font-medium text-[#0A84FF]">Upgrade →</span>
        )}
      </div>

      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[10.5px] mb-0.5">
            <span style={{ color: "rgba(235, 235, 245, 0.55)" }}>Leads</span>
            <span style={{ color: "rgba(235, 235, 245, 0.7)" }}>
              {usage.leadsUsed.toLocaleString()} / {usage.leadsLimit.toLocaleString()}
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
            <span style={{ color: "rgba(235, 235, 245, 0.55)" }}>AI credits</span>
            <span style={{ color: "rgba(235, 235, 245, 0.7)" }}>
              {usage.aiUsed.toLocaleString()} / {usage.aiLimit.toLocaleString()}
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
