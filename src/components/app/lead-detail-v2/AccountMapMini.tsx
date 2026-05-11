"use client";

/**
 * AccountMapMini — Phase 2.5.
 *
 * Tiny map view inside `AccountBlock`. Re-skin of the legacy
 * `LeadMapView`. Renders an OpenStreetMap embed iframe centered on
 * the lead's `sourceLat` / `sourceLng` — keeps the bundle map-
 * library-free (the legacy view used react-leaflet which dragged in
 * 60kb of map code we don't need on first paint).
 *
 * Empty (no coords) renders nothing — the parent block has a
 * "no address" stub already.
 */

import { type ReactNode } from "react";

export interface AccountMapMiniCopy {
  openInMaps: string;
  title: string;
}

export interface AccountMapMiniProps {
  lat: number | null;
  lng: number | null;
  businessName: string;
  copy: AccountMapMiniCopy;
}

export function AccountMapMini({
  lat,
  lng,
  businessName,
  copy,
}: AccountMapMiniProps): ReactNode {
  if (lat == null || lng == null) return null;

  // OSM bbox embed: ±0.0035 deg around the centre = ~400m square.
  // Tight enough to show the high-street row, wide enough to give
  // the rep visual context for the location.
  const dLat = 0.0035;
  const dLng = 0.005;
  const bbox = `${lng - dLng}%2C${lat - dLat}%2C${lng + dLng}%2C${lat + dLat}`;
  const marker = `${lat}%2C${lng}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

  return (
    <div data-testid="account-map-mini" className="space-y-1.5">
      <span
        className="text-[10px] uppercase tracking-[0.06em]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.title}
      </span>
      <div
        className="overflow-hidden rounded-md border border-white/10"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          src={src}
          title={`${businessName} location`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full"
        />
      </div>
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-[11px] underline"
        style={{ color: "var(--leadac-info)" }}
      >
        {copy.openInMaps}
      </a>
    </div>
  );
}
