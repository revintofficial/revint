"use client";

/**
 * PlanLockedBlock — shared FREE-tier locked stub used inside the v2
 * lead-detail blocks (MEDDPICC inside QUALIFICATION, SPIN inside
 * DISCOVERY). Picks up the existing brand tokens (`--leadac-*`) and
 * gives the rep a single upgrade affordance. The component
 * intentionally avoids any plan-detection logic of its own — the
 * caller already knows the gate is locked.
 *
 * Phase 2 risk register #1: a flag accidentally enabled on FREE shows
 * locked surfaces with no copy. This component owns the "what's
 * inside, why locked, what unlocks it" message so we never render a
 * blank locked block.
 */

import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export interface PlanLockedBlockCopy {
  title: string;
  description: string;
  cta: string;
  requiredPlan: string;
}

export interface PlanLockedBlockProps {
  copy: PlanLockedBlockCopy;
  /** Optional — phase 6 hooks the upgrade route. Phase 2 ships a fallback href. */
  upgradeHref?: string;
}

export function PlanLockedBlock({
  copy,
  upgradeHref = "/app/settings/billing",
}: PlanLockedBlockProps): ReactNode {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-dashed px-4 py-4"
      style={{
        borderColor: "var(--leadac-border)",
        background: "color-mix(in srgb, var(--leadac-500) 6%, transparent)",
      }}
      data-testid="plan-locked-block"
      role="region"
      aria-label={copy.title}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--leadac-500) 22%, transparent)",
            color: "var(--leadac-500)",
          }}
        >
          <Lock className="h-3.5 w-3.5" />
        </span>
        <div className="flex flex-col gap-1">
          <p
            className="text-[13px] font-medium"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {copy.title}
          </p>
          <p className="text-[12px]" style={{ color: "var(--leadac-text-3)" }}>
            {copy.description}
          </p>
          <p className="text-[11px]" style={{ color: "var(--leadac-text-3)" }}>
            {copy.requiredPlan}
          </p>
        </div>
      </div>
      <a
        href={upgradeHref}
        className="self-start rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
        style={{
          background: "var(--leadac-500)",
          color: "var(--leadac-bg)",
        }}
      >
        {copy.cta}
      </a>
    </div>
  );
}
