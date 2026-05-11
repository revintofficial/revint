"use client";

/**
 * WebsiteSignalStrip — Phase 2.5.
 *
 * Chip strip rendered inside `WhyNowBlock` summarising the most
 * sales-relevant website features in 6 chips:
 *   - https / no-https
 *   - mobile / desktop-only
 *   - booking widget (with provider name when present)
 *   - contact form / no contact form
 *   - load time bucket (fast / ok / slow)
 *   - whatsapp link present
 *
 * Reads `decision-surface.websiteIntelSummary`. Empty (no audit yet)
 * renders a single "no website data yet" placeholder chip with no
 * crawlStatus colour.
 *
 * Tap on the strip dispatches the `expandHistory` callback so the
 * full website panel opens in the HISTORY block (lazy-fired via
 * `/website-intel`).
 */

import { type ReactNode } from "react";

import type { WebsiteIntelSummaryDto } from "@/lib/lead-detail/use-decision-surface";

export interface WebsiteSignalStripCopy {
  https: { yes: string; no: string };
  mobile: { yes: string; no: string };
  booking: { yes: string; no: string };
  contactForm: { yes: string; no: string };
  loadTime: { fast: string; ok: string; slow: string; unknown: string };
  whatsapp: string;
  noData: string;
  crawlBlocked: string;
  crawlError: string;
  fullPanelCta: string;
}

export interface WebsiteSignalStripProps {
  summary: WebsiteIntelSummaryDto | null;
  /**
   * Called when the rep taps the "View full website panel →" CTA.
   * Parent should set `expanded.HISTORY = true` so the history block
   * opens and the lazy `/website-intel` fetch fires.
   */
  onOpenFullPanel?: () => void;
  copy: WebsiteSignalStripCopy;
}

interface Chip {
  key: string;
  label: string;
  tone: "ok" | "warn" | "neutral";
}

function loadTimeBucket(loadTimeMs: number | null): "fast" | "ok" | "slow" | "unknown" {
  if (loadTimeMs == null) return "unknown";
  if (loadTimeMs < 1500) return "fast";
  if (loadTimeMs < 3000) return "ok";
  return "slow";
}

function buildChips(
  s: WebsiteIntelSummaryDto,
  copy: WebsiteSignalStripCopy,
): Chip[] {
  const chips: Chip[] = [];
  chips.push({
    key: "https",
    label: s.https ? copy.https.yes : copy.https.no,
    tone: s.https ? "ok" : "warn",
  });
  chips.push({
    key: "mobile",
    label: s.mobileFriendlyGuess ? copy.mobile.yes : copy.mobile.no,
    tone: s.mobileFriendlyGuess ? "ok" : "warn",
  });
  chips.push({
    key: "booking",
    label: s.hasBookingSystem
      ? s.bookingProvider
        ? `${copy.booking.yes} (${s.bookingProvider})`
        : copy.booking.yes
      : copy.booking.no,
    tone: s.hasBookingSystem ? "ok" : "neutral",
  });
  chips.push({
    key: "contact-form",
    label: s.hasContactForm ? copy.contactForm.yes : copy.contactForm.no,
    tone: s.hasContactForm ? "ok" : "neutral",
  });
  const bucket = loadTimeBucket(s.loadTimeMs);
  const loadLabelMap: Record<typeof bucket, string> = {
    fast: copy.loadTime.fast,
    ok: copy.loadTime.ok,
    slow: copy.loadTime.slow,
    unknown: copy.loadTime.unknown,
  };
  chips.push({
    key: "load-time",
    label:
      s.loadTimeMs != null
        ? `${loadLabelMap[bucket]} · ${s.loadTimeMs}ms`
        : loadLabelMap[bucket],
    tone: bucket === "slow" ? "warn" : bucket === "fast" ? "ok" : "neutral",
  });
  if (s.hasWhatsappLink) {
    chips.push({ key: "whatsapp", label: copy.whatsapp, tone: "ok" });
  }
  return chips;
}

const TONE_BG: Record<Chip["tone"], string> = {
  ok: "color-mix(in srgb, var(--leadac-success) 15%, transparent)",
  warn: "color-mix(in srgb, var(--leadac-warning) 15%, transparent)",
  neutral: "var(--leadac-surface-2, rgba(255,255,255,0.05))",
};

const TONE_FG: Record<Chip["tone"], string> = {
  ok: "var(--leadac-success)",
  warn: "var(--leadac-warning)",
  neutral: "var(--leadac-text-2)",
};

export function WebsiteSignalStrip({
  summary,
  onOpenFullPanel,
  copy,
}: WebsiteSignalStripProps): ReactNode {
  if (!summary) {
    return (
      <div
        data-testid="website-signal-strip-empty"
        className="flex items-center gap-2 text-[11px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        <span>{copy.noData}</span>
      </div>
    );
  }

  if (summary.crawlStatus === "blocked") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className="rounded-full border border-white/10 px-2 py-0.5"
          style={{
            background: TONE_BG.warn,
            color: TONE_FG.warn,
          }}
        >
          {copy.crawlBlocked}
        </span>
      </div>
    );
  }
  if (summary.crawlStatus === "error") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className="rounded-full border border-white/10 px-2 py-0.5"
          style={{
            background: TONE_BG.warn,
            color: TONE_FG.warn,
          }}
        >
          {copy.crawlError}
        </span>
      </div>
    );
  }

  const chips = buildChips(summary, copy);

  return (
    <div data-testid="website-signal-strip">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <span
            key={c.key}
            className="rounded-full border border-white/10 px-2 py-0.5 text-[11px]"
            style={{ background: TONE_BG[c.tone], color: TONE_FG[c.tone] }}
          >
            {c.label}
          </span>
        ))}
      </div>
      {onOpenFullPanel ? (
        <button
          type="button"
          onClick={onOpenFullPanel}
          className="mt-1.5 text-[11px] underline"
          style={{ color: "var(--leadac-info)" }}
        >
          {copy.fullPanelCta}
        </button>
      ) : null}
    </div>
  );
}
