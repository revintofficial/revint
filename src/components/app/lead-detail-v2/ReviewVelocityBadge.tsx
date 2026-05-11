"use client";

/**
 * ReviewVelocityBadge — Phase 3 derived pill, Phase 8 trigger-paired
 * promotion.
 *
 * Renders a small `📈 +X% reviews / 30d` pill inside `WhyNowBlock`
 * when the lead's review velocity crosses a UI threshold:
 *   - surge: deltaPct ≥ +50%
 *   - dip:   deltaPct ≤ -30%
 *
 * The thresholds (and the underlying window math) live in
 * `src/lib/lead-detail/review-velocity.ts` so the badge agrees with
 * the Phase 8 detector by construction (PLAN §6 risk #20).
 *
 * Phase 8 promotion: when the lead has a `REVIEW_VOLUME_SURGE` or
 * `REVIEW_VOLUME_DIP` trigger row attached, the badge upgrades from
 * "derived" tone (low-key gold tint) to "trigger" tone (chip-family
 * accent) so the SDR knows the signal has been promoted to a real
 * trigger row. Same numbers, different tone.
 *
 * Color-blind safety: every state pairs the color with an icon
 * (📈 surge / 📉 dip) per `ui-components.mdc` rule.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import {
  classifyVelocityBadge,
  type ReviewVelocity,
  type ReviewVelocityBadgeKind,
} from "@/lib/lead-detail/review-velocity";

export interface ReviewVelocityBadgeCopy {
  surgeTemplate: string;
  dipTemplate: string;
  surgeAriaTemplate: string;
  dipAriaTemplate: string;
}

export interface ReviewVelocityBadgeProps {
  velocity: ReviewVelocity | null;
  /**
   * Phase 8 promotion: when true, renders in "trigger" tone instead
   * of "derived" tone. Same numbers, different visual weight. Pass
   * `true` when the lead carries a `REVIEW_VOLUME_SURGE` or
   * `REVIEW_VOLUME_DIP` trigger row.
   */
  promoted?: boolean;
  copy: ReviewVelocityBadgeCopy;
}

function formatTemplate(template: string, value: number): string {
  return template.replace("{deltaPct}", String(Math.abs(value)));
}

function visualForKind(
  kind: ReviewVelocityBadgeKind,
  promoted: boolean,
): { bg: string; color: string; border: string } {
  // Derived tone: low-key gold tint (matches the leadac brand
  // accent without competing with real chips). Trigger tone: full
  // chip-family color treatment so the badge reads as "promoted".
  if (promoted) {
    return kind === "surge"
      ? {
          bg: "color-mix(in srgb, var(--leadac-success) 18%, transparent)",
          color: "var(--leadac-success)",
          border: "color-mix(in srgb, var(--leadac-success) 35%, transparent)",
        }
      : {
          bg: "color-mix(in srgb, var(--leadac-error) 18%, transparent)",
          color: "var(--leadac-error)",
          border: "color-mix(in srgb, var(--leadac-error) 35%, transparent)",
        };
  }
  return {
    bg: "color-mix(in srgb, var(--leadac-500) 8%, transparent)",
    color: "var(--leadac-text-2)",
    border: "color-mix(in srgb, var(--leadac-500) 18%, transparent)",
  };
}

export function ReviewVelocityBadge({
  velocity,
  promoted = false,
  copy,
}: ReviewVelocityBadgeProps): ReactNode {
  if (!velocity) return null;
  const kind = classifyVelocityBadge(velocity);
  if (!kind) return null;

  const visual = visualForKind(kind, promoted);
  const Icon = kind === "surge" ? TrendingUp : TrendingDown;
  const template = kind === "surge" ? copy.surgeTemplate : copy.dipTemplate;
  const ariaTemplate =
    kind === "surge" ? copy.surgeAriaTemplate : copy.dipAriaTemplate;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium tabular-nums"
      style={{
        background: visual.bg,
        color: visual.color,
        borderColor: visual.border,
      }}
      data-testid="review-velocity-badge"
      data-kind={kind}
      data-promoted={promoted ? "true" : "false"}
      role="status"
      aria-label={formatTemplate(ariaTemplate, velocity.deltaPct)}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {formatTemplate(template, velocity.deltaPct)}
    </span>
  );
}
