"use client";

/**
 * WhoBlock — buying-committee grid for the v2 WHO block. Mounts with
 * id `who-block`. Visible to FREE (PLAN §5.3 — basic stakeholders are
 * not gated; only MEDDPICC + SPIN are).
 *
 * Desktop: 3-column grid of `<StakeholderCard>` rows.
 * Mobile (< 640px): horizontally-paged scroll snap (PLAN §4 line 188).
 */

import type { ReactNode } from "react";

import {
  StakeholderCard,
  type StakeholderCardCopy,
  type StakeholderCardData,
} from "./StakeholderCard";
import type { StakeholderOnlinePresenceLink } from "./StakeholderOnlinePresence";
import type { DiscoveredLinksDto } from "@/lib/lead-detail/use-decision-surface";

export interface WhoBlockCopy {
  loading: string;
  empty: string;
  card: StakeholderCardCopy;
}

export interface WhoBlockProps {
  loading: boolean;
  stakeholders: StakeholderCardData[];
  // Phase 2.5 — `decision-surface.discoveredLinks` so we can render
  // a stakeholder-specific online-presence strip on each card.
  discoveredLinks?: DiscoveredLinksDto;
  copy: WhoBlockCopy;
}

/**
 * Match a stakeholder against discovered social links.
 * Conservative: matches when the stakeholder's name appears in
 * either the URL path or one of the link's discovery query terms.
 * Falls back to platform-level matches via `linkedinUrl` exact-equal.
 */
function matchSocialsToStakeholder(
  stakeholder: StakeholderCardData,
  links: DiscoveredLinksDto["socials"],
): StakeholderOnlinePresenceLink[] {
  const out: StakeholderOnlinePresenceLink[] = [];
  const slug = (stakeholder.name ?? "").toLowerCase().replace(/\s+/g, "");
  for (const link of links) {
    if (!link.url) continue;
    if (
      stakeholder.linkedinUrl &&
      link.platform === "linkedin" &&
      link.url === stakeholder.linkedinUrl
    ) {
      out.push({ platform: link.platform, url: link.url });
      continue;
    }
    if (slug && slug.length >= 3 && link.url.toLowerCase().includes(slug)) {
      out.push({ platform: link.platform, url: link.url });
    }
  }
  return out;
}

export function WhoBlock({
  loading,
  stakeholders,
  discoveredLinks,
  copy,
}: WhoBlockProps): ReactNode {
  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="who-loading"
      >
        {copy.loading}
      </p>
    );
  }

  if (stakeholders.length === 0) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="who-empty"
      >
        {copy.empty}
      </p>
    );
  }

  const socials = discoveredLinks?.socials ?? [];

  return (
    <div data-testid="who-block-body">
      <div className="hidden gap-2 sm:grid sm:grid-cols-3">
        {stakeholders.map((s) => (
          <StakeholderCard
            key={s.id}
            data={s}
            copy={copy.card}
            onlineLinks={
              socials.length > 0
                ? matchSocialsToStakeholder(s, socials)
                : undefined
            }
          />
        ))}
      </div>
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {stakeholders.map((s) => (
          <div
            key={s.id}
            className="min-w-[80%] shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <StakeholderCard
              data={s}
              copy={copy.card}
              onlineLinks={
                socials.length > 0
                  ? matchSocialsToStakeholder(s, socials)
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
