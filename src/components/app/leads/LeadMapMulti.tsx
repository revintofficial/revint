"use client";

/**
 * LeadMapMulti — multi-pin map view for the leads list.
 *
 * Uses Leaflet (~40KB gzipped) + react-leaflet, dynamic-imported by
 * the page so it only ships when the user actually switches to the
 * map view. Pins are coloured by `opportunityScore` band:
 *   - score >= 60: green (hot)
 *   - 35..59:      amber (warm)
 *   - < 35 / null: red / grey (cold / scoreless)
 *
 * Pin click opens a side panel with mini-detail (score, niche,
 * reasons, recommended package, opener preview) and a deep-link to
 * the lead detail page.
 *
 * The "viewport filter" toggle keeps the list (used by the side panel
 * counter and any sibling table view) in sync with the visible map
 * area: as the user pans/zooms, leads outside the bounds are hidden.
 *
 * Default markers' image assets break under webpack so we use Leaflet
 * `divIcon` HTML markers exclusively — this also lets us colour each
 * pin by score without shipping additional PNG assets.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import L, { type LatLngBoundsExpression } from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Filter,
  MapPin,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import {
  LeadBadgeRow,
  PipelineStageDot,
  StatusBadge,
} from "@/components/app/leads/LeadRow";
import type { LeadListItem } from "@/components/app/leads/useLeadsQuery";

export interface LeadMapMultiProps {
  leads: LeadListItem[];
  loading: boolean;
  watchlistLeadIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (leadId: string) => void;
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278]; // London
const DEFAULT_ZOOM = 11;

function pinColor(score: number | null | undefined): string {
  if (score == null) return "hsl(220 8% 70%)";
  if (score >= 60) return "var(--revint-success)";
  if (score >= 35) return "var(--revint-warning)";
  return "var(--revint-error)";
}

function buildPinIcon(score: number | null | undefined, isSelected: boolean) {
  const color = pinColor(score);
  const ring = isSelected ? "box-shadow: 0 0 0 3px hsl(0 0% 100% / 0.45);" : "";
  return L.divIcon({
    className: "leadac-map-pin",
    html: `<div style="
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid hsl(0 0% 100% / 0.85);
      box-shadow: 0 2px 6px rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: 700;
      ${ring}
    ">${score ?? "?"}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function LeadMapMulti({
  leads,
  loading,
  watchlistLeadIds,
  selectedIds,
  onToggleSelect,
}: LeadMapMultiProps) {
  const [activeLead, setActiveLead] = useState<LeadListItem | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [viewportFilter, setViewportFilter] = useState(false);

  const mapped = useMemo(
    () =>
      leads.filter(
        (l) =>
          typeof l.sourceLat === "number" &&
          typeof l.sourceLng === "number",
      ),
    [leads],
  );

  // List of leads currently visible (after viewport filter).
  const visible = useMemo(() => {
    if (!viewportFilter || !bounds) return mapped;
    return mapped.filter(
      (l) =>
        l.sourceLat! >= bounds.minLat &&
        l.sourceLat! <= bounds.maxLat &&
        l.sourceLng! >= bounds.minLng &&
        l.sourceLng! <= bounds.maxLng,
    );
  }, [mapped, viewportFilter, bounds]);

  // Compute initial map bounds from leads. We re-compute only when the
  // *set* of pinned leads changes — pan/zoom interactions on the map
  // shouldn't reset the view.
  const initialBounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (mapped.length === 0) return null;
    const lats = mapped.map((l) => l.sourceLat!);
    const lngs = mapped.map((l) => l.sourceLng!);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped.length]);

  if (loading && leads.length === 0) {
    return <Skeleton className="h-[600px] rounded-2xl" />;
  }

  if (mapped.length === 0) {
    return (
      <Card>
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
          <MapPin className="w-10 h-10 text-white/20" />
          <p className="text-sm font-medium text-white/50">
            No leads with location data
          </p>
          <p className="text-xs text-white/30 max-w-sm">
            Pins appear once a lead has source coordinates. Run discovery to
            populate location data, then come back to this view.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
      <Card className="relative overflow-hidden">
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewportFilter((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
              viewportFilter
                ? "border-(--revint-500)/40 bg-(--revint-500)/15 text-(--revint-200)"
                : "border-white/10 bg-black/60 backdrop-blur text-white/70 hover:bg-black/70"
            }`}
            title="Only show leads inside the visible area"
          >
            <Filter className="w-3 h-3" />
            Viewport filter
          </button>
          <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-black/60 backdrop-blur text-white/70 border border-white/10">
            {visible.length} pin{visible.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="h-[600px] w-full">
          <MapContainer
            // react-leaflet typings are happy with `center` + `zoom` even
            // when `bounds` is preferred — we install bounds via the
            // `FitBounds` child below.
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {initialBounds ? <FitBounds bounds={initialBounds} /> : null}
            <BoundsTracker onChange={setBounds} />
            {visible.map((lead) => {
              const isSelected = selectedIds.has(lead.id);
              const isActive = activeLead?.id === lead.id;
              return (
                <Marker
                  key={lead.id}
                  position={[lead.sourceLat!, lead.sourceLng!]}
                  icon={buildPinIcon(
                    lead.salesOpportunity?.opportunityScore ?? null,
                    isSelected || isActive,
                  )}
                  eventHandlers={{
                    click: () => setActiveLead(lead),
                  }}
                />
              );
            })}
          </MapContainer>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {activeLead ? (
          <ActiveLeadPanel
            lead={activeLead}
            isWatchlisted={watchlistLeadIds.has(activeLead.id)}
            isSelected={selectedIds.has(activeLead.id)}
            onClose={() => setActiveLead(null)}
            onToggleSelect={onToggleSelect}
          />
        ) : (
          <EmptySidePanel count={visible.length} />
        )}
      </Card>
    </div>
  );
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;
    try {
      map.fitBounds(bounds, { padding: [40, 40] });
    } catch {
      // ignore — bad bounds (single point, etc.)
    }
  }, [bounds, map]);
  return null;
}

function BoundsTracker({ onChange }: { onChange: (b: Bounds) => void }) {
  const map = useMapEvents({
    moveend: () => emit(),
    zoomend: () => emit(),
  });
  function emit() {
    const b = map.getBounds();
    onChange({
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    });
  }
  // Emit once on mount.
  useEffect(() => {
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ActiveLeadPanel({
  lead,
  isWatchlisted,
  isSelected,
  onClose,
  onToggleSelect,
}: {
  lead: LeadListItem;
  isWatchlisted: boolean;
  isSelected: boolean;
  onClose: () => void;
  onToggleSelect: (leadId: string) => void;
}) {
  const opener = lead.salesOpportunity?.personalizedFirstMessage ?? null;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-white/5">
        <div className="min-w-0 flex-1">
          <Link
            href={`/app/leads/${lead.id}`}
            className="block font-semibold text-white hover:text-(--revint-500) transition-colors text-[15px] leading-snug"
          >
            {lead.businessName}
          </Link>
          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">
            {lead.formattedAddress}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {lead.salesOpportunity ? (
            <>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-white/5">
                Score {lead.salesOpportunity.opportunityScore}
              </span>
              <StatusBadge status={lead.salesOpportunity.status} />
            </>
          ) : (
            <span className="text-xs text-white/40">No score yet</span>
          )}
          {lead.watchlistItem?.pipelineStage ? (
            <PipelineStageDot stage={lead.watchlistItem.pipelineStage} />
          ) : null}
        </div>

        <LeadBadgeRow lead={lead} />

        {opener ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-white/50 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-(--revint-300)" />
              Personalized opener
            </div>
            <p className="text-xs leading-relaxed text-white/80 whitespace-pre-wrap">
              {opener}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-white/5">
        <Button
          size="sm"
          variant={isSelected ? "outline" : "ghost"}
          onClick={() => onToggleSelect(lead.id)}
          className="text-[11px]"
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
        {isWatchlisted ? (
          <Link href={`/app/deals?lead=${lead.id}`} className="ml-auto">
            <Button size="sm" variant="outline" className="text-[11px]">
              Open deal <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>
        ) : null}
        <Link href={`/app/leads/${lead.id}`} className={isWatchlisted ? "" : "ml-auto"}>
          <Button size="sm" className="text-[11px]">
            <Maximize2 className="w-3 h-3" />
            Open full
          </Button>
        </Link>
      </div>
    </div>
  );
}

function EmptySidePanel({ count }: { count: number }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-2 text-center min-h-[600px]">
      <MapPin className="w-8 h-8 text-white/20" />
      <p className="text-sm font-medium text-white/60">
        Click a pin to inspect
      </p>
      <p className="text-xs text-white/40">
        {count} lead{count === 1 ? "" : "s"} in view
      </p>
    </div>
  );
}
