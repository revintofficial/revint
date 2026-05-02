"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { UpgradeModal } from "@/components/app/upgrade-modal";

export interface UpgradeBannerProps {
  usage: {
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
    planName: string;
    leadsUsed: number;
    leadsLimit: number;
    aiUsed: number;
    aiLimit: number;
  };
}

// Pin number formatting locale so SSR (Node, en-US) and CSR (browser,
// possibly tr-TR) produce identical output. See usage-badge.tsx for the
// full rationale.
const NUM_FMT = new Intl.NumberFormat("en-US");

export function UpgradeBanner({ usage }: UpgradeBannerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const leadPct = (usage.leadsUsed / usage.leadsLimit) * 100;
  const aiPct = (usage.aiUsed / usage.aiLimit) * 100;
  const overLeads = leadPct >= 100;
  const overAi = aiPct >= 100;
  const message = overLeads
    ? `You've reached your ${usage.planName} plan lead limit (${NUM_FMT.format(usage.leadsLimit)}). Upgrade to keep discovering.`
    : overAi
    ? `You've used all your ${usage.planName} plan AI credits (${NUM_FMT.format(usage.aiLimit)}). Upgrade to keep analyzing.`
    : leadPct >= 80
    ? `You're at ${Math.round(leadPct)}% of your monthly lead quota.`
    : `You're at ${Math.round(aiPct)}% of your AI credits this cycle.`;

  const isHard = overLeads || overAi;
  // Pick the most-relevant reason for the modal copy. Prefer the breached
  // dimension when both are over, otherwise the higher-pct dimension.
  const reason: "leads" | "ai" = overLeads
    ? "leads"
    : overAi
    ? "ai"
    : leadPct >= aiPct
    ? "leads"
    : "ai";
  const limitForReason = reason === "leads" ? usage.leadsLimit : usage.aiLimit;

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
        style={{
          background: isHard
            ? "color-mix(in oklab, var(--leadac-error) 8%, transparent)"
            : "color-mix(in oklab, var(--leadac-warning) 7%, transparent)",
          border: `0.5px solid ${
            isHard
              ? "color-mix(in oklab, var(--leadac-error) 25%, transparent)"
              : "color-mix(in oklab, var(--leadac-warning) 20%, transparent)"
          }`,
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: isHard
              ? "color-mix(in oklab, var(--leadac-error) 15%, transparent)"
              : "color-mix(in oklab, var(--leadac-warning) 15%, transparent)",
          }}
        >
          <Sparkles
            className="w-3.5 h-3.5"
            style={{ color: isHard ? "var(--leadac-error)" : "var(--leadac-warning)" }}
          />
        </div>
        <p className="flex-1 text-[12.5px]" style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.85)" }}>
          {message}
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 text-[12px] font-semibold text-(--leadac-500) hover:text-(--leadac-300) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--leadac-500) rounded px-1"
          aria-haspopup="dialog"
          aria-expanded={modalOpen}
        >
          {isHard ? "Upgrade now" : "Upgrade"} <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentPlan={usage.plan}
        reason={reason}
        planName={usage.planName}
        limit={limitForReason}
      />
    </>
  );
}
