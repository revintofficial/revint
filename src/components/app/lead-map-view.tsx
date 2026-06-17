/**
 * P1.6 - Lead map view (lightweight, dependency-free).
 *
 * Renders an OpenStreetMap iframe centered on the lead's coordinates with a
 * marker. Click "Open in Google Maps" or "Get directions" to launch the
 * platform's native maps app (works on iPad/iPhone/Android out of the box).
 *
 * Why no Leaflet/Mapbox? At lead-detail scale we have ONE pin and the user
 * actually wants to navigate to it, not zoom around. iframe + native maps =
 * 0 dependencies, 0 tile cost, 100% works in the PWA shell.
 *
 * The full multi-pin workspace map (workspace lead list view) is built on
 * top of this same approach — see /app/leads/map (future).
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ExternalLink } from "lucide-react";

interface Props {
  lat: number;
  lng: number;
  title: string;
  address: string;
}

export function LeadMapView({ lat, lng, title, address }: Props) {
  // OpenStreetMap embed: ~0.005 lat/lng box ≈ 500m radius.
  const delta = 0.005;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  // Native maps deeplinks (iOS/Android both honor the platform's default app).
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const appleMapsUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(title)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-(--revint-300)" /> Location
        </CardTitle>
        <p className="text-xs text-white/40 mt-1 truncate">{address}</p>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          title={`${title} location`}
          src={osmUrl}
          className="w-full h-64 border-0"
          loading="lazy"
        />
        <div className="flex flex-wrap gap-2 p-3 border-t border-white/10">
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Navigation className="w-3.5 h-3.5" /> Directions
            </Button>
          </a>
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="gap-1.5">
              Google Maps <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </Button>
          </a>
          <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="gap-1.5">
              Apple Maps <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
