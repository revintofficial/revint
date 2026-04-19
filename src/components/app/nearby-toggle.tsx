/**
 * P1.5 - Nearby toggle button.
 * Asks for browser geolocation, returns {lat, lng} via callback.
 * Caller pipes that into /api/leads?sortBy=nearest&userLat=..&userLng=..
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";

interface Props {
  active: boolean;
  onToggle: (loc: { lat: number; lng: number } | null) => void;
}

export function NearbyToggle({ active, onToggle }: Props) {
  const [loading, setLoading] = useState(false);

  const enable = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Bu cihaz konum desteği vermiyor.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onToggle({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLoading(false);
        toast.error(`Konum alınamadı: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  if (active) {
    return (
      <Button size="sm" variant="outline" onClick={() => onToggle(null)} className="gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-[#A5B4FC]" /> Yakındaki kapalı
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={enable} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
      Yakınımdaki leadler
    </Button>
  );
}
