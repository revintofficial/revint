"use client";

/**
 * StakeholderOnlinePresence — Phase 2.5.
 *
 * Small icon strip rendered on each `StakeholderCard` showing which
 * social profiles match the stakeholder. Reads (a slice of)
 * `decision-surface.discoveredLinks.socials`. The slice is computed
 * by the parent — this component just renders icons + click-throughs.
 *
 * Empty (no matching socials) renders nothing.
 */

import { type ReactNode } from "react";

export interface StakeholderOnlinePresenceCopy {
  /** Per-platform aria-label format: `Open ${platformLabel}` */
  platforms: Record<string, string>;
  fallback: string;
}

export interface StakeholderOnlinePresenceLink {
  platform: string;
  url: string;
}

export interface StakeholderOnlinePresenceProps {
  links: ReadonlyArray<StakeholderOnlinePresenceLink>;
  copy: StakeholderOnlinePresenceCopy;
}

const PLATFORM_GLYPH: Record<string, string> = {
  linkedin: "in",
  twitter: "x",
  instagram: "ig",
  facebook: "fb",
  youtube: "yt",
  tiktok: "tt",
  whatsapp: "wa",
  pinterest: "pn",
  reddit: "rd",
};

function glyphFor(platform: string): string {
  return PLATFORM_GLYPH[platform] ?? platform.slice(0, 2);
}

export function StakeholderOnlinePresence({
  links,
  copy,
}: StakeholderOnlinePresenceProps): ReactNode {
  if (links.length === 0) return null;
  return (
    <div
      data-testid="stakeholder-online-presence"
      className="flex flex-wrap items-center gap-1"
    >
      {links.slice(0, 5).map((l) => (
        <a
          key={`${l.platform}:${l.url}`}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          aria-label={copy.platforms[l.platform] ?? `${copy.fallback} ${l.platform}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/3 text-[9px] font-semibold uppercase hover:bg-white/8"
          style={{ color: "var(--leadac-text-2)" }}
        >
          {glyphFor(l.platform)}
        </a>
      ))}
    </div>
  );
}
