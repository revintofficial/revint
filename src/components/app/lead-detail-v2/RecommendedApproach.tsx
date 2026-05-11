"use client";

/**
 * RecommendedApproach — Phase 2.5.
 *
 * "Recommended approach" subsection inside `NextGestureBlock`.
 * Collapsed by default (uses native <details>) so the block stays
 * scannable. Renders two parts:
 *
 *   1. RecommendedPackage — service-package recommendation card
 *      (resolved by the V1 SCORER worker; absorbed from the legacy
 *      `RecommendedPackageCard`).
 *   2. PersonalizedFirstMessage — pre-drafted opener (PRO+ only).
 *      The legacy `PersonalizedMessageCard`'s "copy to clipboard"
 *      affordance is preserved.
 *
 * Empty (no package + no message) renders nothing — the parent block
 * will already be showing the NBA opener so we never want a second
 * empty "approach" card.
 */

import { useCallback, useState, type ReactNode } from "react";

import type { RecommendedPackageDto } from "@/lib/lead-detail/use-decision-surface";

export interface RecommendedApproachCopy {
  sectionTitle: string;
  packageTitle: string;
  packageReasonLabel: string;
  packageFeaturesLabel: string;
  messageTitle: string;
  messageCopy: string;
  messageCopied: string;
  messageLockedUpgradeCta: string;
}

export interface RecommendedApproachProps {
  recommendedPackage: RecommendedPackageDto | null;
  personalizedFirstMessage: string | null;
  /**
   * `null` means the user is on FREE plan and can't see the message.
   * The component renders an upgrade nudge instead.
   */
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" | null;
  copy: RecommendedApproachCopy;
}

export function RecommendedApproach({
  recommendedPackage,
  personalizedFirstMessage,
  plan,
  copy,
}: RecommendedApproachProps): ReactNode {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!personalizedFirstMessage) return;
    try {
      await navigator.clipboard.writeText(personalizedFirstMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard rejection (browser policy / iframe sandbox) — leave
      // the button label as-is. The rep can still select-and-copy by
      // hand.
    }
  }, [personalizedFirstMessage]);

  if (!recommendedPackage && !personalizedFirstMessage && plan !== "FREE") {
    return null;
  }

  return (
    <details
      data-testid="recommended-approach"
      className="rounded-lg border border-white/8 bg-white/3"
    >
      <summary
        className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium uppercase tracking-[0.06em]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.sectionTitle}
      </summary>

      <div className="space-y-3 px-3 pb-3 pt-1">
        {recommendedPackage ? (
          <div data-testid="recommended-approach-package">
            <div className="flex items-center justify-between gap-2">
              <h4
                className="text-[12px] font-medium"
                style={{ color: "var(--leadac-text-1)" }}
              >
                {recommendedPackage.name}
              </h4>
              <span
                className="text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                {recommendedPackage.priceLabel}
              </span>
            </div>
            {recommendedPackage.reason ? (
              <p
                className="mt-1 text-[12px] leading-snug"
                style={{ color: "var(--leadac-text-2)" }}
              >
                <span
                  className="mr-1 text-[10px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--leadac-text-3)" }}
                >
                  {copy.packageReasonLabel}
                </span>
                {recommendedPackage.reason}
              </p>
            ) : null}
            {recommendedPackage.features.length > 0 ? (
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {recommendedPackage.features.slice(0, 6).map((f) => (
                  <li
                    key={f}
                    className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[11px]"
                    style={{ color: "var(--leadac-text-2)" }}
                  >
                    {f}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {personalizedFirstMessage ? (
          <div data-testid="recommended-approach-message">
            <h4
              className="text-[11px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.messageTitle}
            </h4>
            <p
              className="mt-1 whitespace-pre-line text-[12px] leading-snug"
              style={{ color: "var(--leadac-text-1)" }}
            >
              {personalizedFirstMessage}
            </p>
            <button
              type="button"
              onClick={onCopy}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/3 px-2 py-1 text-[11px] hover:bg-white/8"
              style={{ color: "var(--leadac-text-2)" }}
            >
              {copied ? copy.messageCopied : copy.messageCopy}
            </button>
          </div>
        ) : plan === "FREE" ? (
          <div
            className="rounded-md border border-white/10 bg-white/3 px-2 py-1.5 text-[11px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.messageLockedUpgradeCta}
          </div>
        ) : null}
      </div>
    </details>
  );
}
