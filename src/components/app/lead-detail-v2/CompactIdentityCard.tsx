"use client";

/**
 * CompactIdentityCard — Phase 1.4 (V2 Richness Absorption).
 *
 * V2 re-skin of the legacy `IdentityRail` (`LegacyLeadDetailClient`
 * L1541-1683). The legacy rail occupies the whole right column on
 * lg+ screens and stacks contact + details + pipeline rows. The V2
 * surface is much denser and already exposes the same data across
 * the HeaderBar + WhyNow + Account blocks, so we render the rail
 * as a single COMPACT card at the top of `WhoBlock` — one yoğun
 * temas kartı (plan §1.4) — that gives the rep the same six rows
 * V1 had on screen without leaving the V2 layout.
 *
 * Data source: 100% from `decision-surface.leadCore` + the
 * `discoveredLinks` summary the aggregator already emits. No extra
 * round-trip, no new endpoint.
 */

import { type ReactNode } from "react";
import {
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  ShieldAlert,
  Star,
} from "lucide-react";

import type { DiscoveredLinksDto } from "@/lib/lead-detail/use-decision-surface";

export interface CompactIdentityCardCopy {
  title: string;
  phoneLabel: string;
  websiteLabel: string;
  mapsLabel: string;
  primarySocialLabel: string;
  primaryDirectoryLabel: string;
  reviewsLabel: string;
  statusLabel: string;
  openLink: string;
  dncBadge: string;
  missing: string;
}

export interface CompactIdentityCardProps {
  businessName: string;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUri: string | null;
  businessStatus: string | null;
  reviewCount: number | null;
  dnc: boolean;
  discoveredLinks?: DiscoveredLinksDto | null;
  copy: CompactIdentityCardCopy;
}

function trimUrl(url: string | null): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function CompactIdentityCard({
  businessName,
  phone,
  websiteUrl,
  googleMapsUri,
  businessStatus,
  reviewCount,
  dnc,
  discoveredLinks,
  copy,
}: CompactIdentityCardProps): ReactNode {
  // Pick the highest-confidence social + directory hits — V1 used
  // the first row of each list, we mirror that.
  const primarySocial = discoveredLinks?.socials?.[0] ?? null;
  const primaryDirectory = discoveredLinks?.directories?.[0] ?? null;

  return (
    <section
      data-testid="compact-identity-card"
      aria-label={copy.title}
      className="mb-3 rounded-xl border border-white/8 bg-white/3 p-3"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.title}
        </p>
        {dnc ? (
          <span
            data-testid="compact-identity-dnc"
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{
              borderColor:
                "color-mix(in srgb, var(--leadac-error) 50%, transparent)",
              color: "var(--leadac-error)",
              background:
                "color-mix(in srgb, var(--leadac-error) 12%, transparent)",
            }}
          >
            <ShieldAlert className="h-3 w-3" aria-hidden />
            {copy.dncBadge}
          </span>
        ) : null}
      </header>

      <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
        <IdentityRow
          icon={<Phone className="h-3 w-3" aria-hidden />}
          label={copy.phoneLabel}
          value={
            phone ? (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                className="font-medium hover:underline"
                style={{ color: "var(--leadac-text-1)" }}
              >
                {phone}
              </a>
            ) : (
              <span style={{ color: "var(--leadac-text-3)" }}>
                {copy.missing}
              </span>
            )
          }
        />
        <IdentityRow
          icon={<Globe className="h-3 w-3" aria-hidden />}
          label={copy.websiteLabel}
          value={
            websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-medium hover:underline"
                style={{ color: "var(--leadac-500)" }}
              >
                {trimUrl(websiteUrl)}
              </a>
            ) : (
              <span style={{ color: "var(--leadac-text-3)" }}>
                {copy.missing}
              </span>
            )
          }
        />
        {googleMapsUri ? (
          <IdentityRow
            icon={<MapPin className="h-3 w-3" aria-hidden />}
            label={copy.mapsLabel}
            value={
              <a
                href={googleMapsUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium hover:underline"
                style={{ color: "var(--leadac-500)" }}
              >
                {copy.openLink}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            }
          />
        ) : null}
        {primarySocial ? (
          <IdentityRow
            icon={<Globe className="h-3 w-3" aria-hidden />}
            label={copy.primarySocialLabel}
            value={
              <a
                href={primarySocial.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 truncate font-medium capitalize hover:underline"
                style={{ color: "var(--leadac-500)" }}
              >
                {primarySocial.platform}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            }
          />
        ) : null}
        {primaryDirectory ? (
          <IdentityRow
            icon={<Globe className="h-3 w-3" aria-hidden />}
            label={copy.primaryDirectoryLabel}
            value={
              <a
                href={primaryDirectory.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 truncate font-medium capitalize hover:underline"
                style={{ color: "var(--leadac-500)" }}
              >
                {primaryDirectory.platform}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            }
          />
        ) : null}
        <IdentityRow
          icon={<Star className="h-3 w-3" aria-hidden />}
          label={copy.reviewsLabel}
          value={
            <span style={{ color: "var(--leadac-text-2)" }}>
              {reviewCount != null ? `${reviewCount}` : copy.missing}
            </span>
          }
        />
        <IdentityRow
          icon={<MapPin className="h-3 w-3" aria-hidden />}
          label={copy.statusLabel}
          value={
            <span
              className="capitalize"
              style={{
                color:
                  businessStatus && businessStatus !== "OPERATIONAL"
                    ? "var(--leadac-warn)"
                    : "var(--leadac-text-2)",
              }}
            >
              {businessStatus
                ? businessStatus.toLowerCase().replace(/_/g, " ")
                : copy.missing}
            </span>
          }
        />
      </dl>
      {/* Hidden but accessible — assistive tech context. */}
      <span className="sr-only">{businessName}</span>
    </section>
  );
}

interface IdentityRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

function IdentityRow({ icon, label, value }: IdentityRowProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/4 py-1 last:border-b-0">
      <dt
        className="inline-flex shrink-0 items-center gap-1.5 text-[11px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        <span
          aria-hidden
          style={{ color: "var(--leadac-text-3)" }}
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-[12px]">{value}</dd>
    </div>
  );
}
