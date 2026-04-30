"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { DEFAULT_SEARCH_QUERIES } from "@/lib/constants";
import { NICHES } from "@/lib/niches";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Loader2,
  Zap,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { LocationPicker } from "@/components/app/discovery/LocationPicker";
import { LiveProcessingStrip } from "@/components/app/leads/LiveProcessingStrip";
import type { PickedLocation } from "@/types";

// Niche packs are organised into:
//  1. Parent packs with children (hybrid verticals like "fnb") → selecting
//     these triggers a fan-out search across every child's primary query.
//  2. Leaf packs (no parent and no children, e.g. "dental") → single-query.
//  3. Child packs of a hybrid parent (e.g. "fnb-bar-club") → single-query
//     with a tighter audit checklist.
//
// We expose all three through one dropdown so reps don't have to learn
// the parent-vs-child distinction; the UI labels the mode they're in.
const PARENT_PACKS = NICHES.filter((n) => !n.parentSlug && NICHES.some((c) => c.parentSlug === n.slug));
const LEAF_PACKS = NICHES.filter((n) => !n.parentSlug && !NICHES.some((c) => c.parentSlug === n.slug));
const CHILDREN_BY_PARENT = new Map<string, typeof NICHES>(
  PARENT_PACKS.map((p) => [p.slug, NICHES.filter((c) => c.parentSlug === p.slug)]),
);

export default function DiscoveryPage() {
  const [selectedCountry, setSelectedCountry] = useState("");
  // Picked locations from the autocomplete flow (preferred path —
  // verified place_id + viewport rectangle, accurate worldwide).
  const [locations, setLocations] = useState<PickedLocation[]>([]);
  // Free-text fallback. Kept for backwards compat + escape hatch when
  // the picker can't resolve a place; surfaced with a warning banner.
  const [city, setCity] = useState("");
  // Niche pack selection (parent or child slug). When set, we use the
  // pack's first searchQuery as the default `selectedQuery` and (for
  // parents) tell the API to fan-out across children.
  const [selectedPackSlug, setSelectedPackSlug] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    created: number;
    skipped: number;
    total: number;
    fanOut?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/country")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.country) setSelectedCountry(d.country);
      })
      .catch(() => null);
  }, []);

  const selectedPack = selectedPackSlug
    ? NICHES.find((n) => n.slug === selectedPackSlug) ?? null
    : null;
  const isParentPack = selectedPack
    ? CHILDREN_BY_PARENT.get(selectedPack.slug)?.length ?? 0
    : 0;
  const fanOutMode = !!selectedPack && (isParentPack as number) > 0;

  // When a parent pack is selected we ignore the per-child query input;
  // the API fans out across every child's first query automatically.
  const effectiveQuery = fanOutMode
    ? null
    : customQuery || selectedQuery || selectedPack?.searchQueries[0] || "";
  // Picker path is preferred; free-text fallback is allowed only when
  // no chips are picked and the user typed something into the legacy
  // field. canRun gates on at least one of those + niche-or-query.
  const hasPickedLocations = locations.length > 0;
  const usingFallback = !hasPickedLocations && city.trim().length > 0;
  const canRun =
    selectedCountry &&
    (hasPickedLocations || usingFallback) &&
    (fanOutMode || (effectiveQuery && effectiveQuery.length > 0));

  const runDiscovery = async () => {
    if (!canRun || running) return;
    setRunning(true);
    setSingleResult(null);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Fan-out mode: API doesn't need searchQuery; we still send
          // the pack slug so it can resolve children.
          searchQuery: fanOutMode ? undefined : effectiveQuery,
          // Preferred: array of verified PickedLocation objects from
          // the autocomplete picker. The API loops over them and
          // applies each viewport as a hard locationRestriction.
          locations: hasPickedLocations ? locations : undefined,
          // Legacy fallback — only sent when user typed into the
          // free-text box without picking. The API geocodes it and
          // applies a 5km circle (less accurate but doesn't block
          // discovery on geocode hiccups).
          boroughName: usingFallback ? city.trim() : undefined,
          country: selectedCountry,
          nichePackSlug: selectedPackSlug || undefined,
        }),
        signal: controller.signal,
      });
      let data: { success?: boolean; error?: string; created?: number; skipped?: number; total?: number; fanOut?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        // empty / invalid body (e.g. 504 from gateway) - fall through to error
      }
      if (!res.ok) {
        setError(data.error || `API error: ${res.status}`);
        return;
      }
      if (!data.success) {
        setError(data.error || "Unknown error");
        return;
      }
      setSingleResult({
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        total: data.total ?? 0,
        fanOut: data.fanOut,
      });
      const childCount = fanOutMode && selectedPack
        ? CHILDREN_BY_PARENT.get(selectedPack.slug)?.length ?? 0
        : 0;
      const locCount = locations.length;
      const locSuffix =
        locCount > 1 ? ` across ${locCount} locations` : "";
      // Tell the user where AI work shows up next — the live strip
      // above starts polling the moment a chain step kicks off, so
      // they should look there instead of refreshing the page.
      const aiSuffix =
        (data.created ?? 0) > 0 ? " — AI analysis is running above." : "";
      toast.success(
        fanOutMode && childCount > 0
          ? `${data.created ?? 0} new leads from ${childCount} sub-niche scans${locSuffix}!${aiSuffix}`
          : `${data.created ?? 0} new leads added${locSuffix}!${aiSuffix}`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          "Request timed out after 90s. Google Places may be slow — try a smaller area or retry.",
        );
      } else {
        console.error("Discovery failed:", err);
        setError("Connection error. Is the server running?");
      }
    } finally {
      clearTimeout(timeoutId);
      setRunning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Discover"
        subtitle="Find local businesses that need your services — anywhere in the world"
      />

      {/* Live heartbeat for the AI Core chain. After each Discovery
          run the audit / classifier / scorer / dossier / mockup /
          brief workers fan out asynchronously — without this strip
          the rep would see the success toast and stare at a frozen
          page wondering whether anything was actually happening. */}
      <LiveProcessingStrip />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-(--leadac-500)/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-(--leadac-500)" />
              </div>
              <div>
                <CardTitle>Find Businesses</CardTitle>
                <CardDescription>Search by country, city, and business type</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Country */}
            <div>
              <label className="text-[13px] font-medium text-white/50 mb-1.5 block">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a country…" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3 text-white/30" />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location picker (preferred) — combobox + chips backed by
                Google Places Autocomplete. Verified place_id + viewport
                rectangle gives Google a hard server-side bounding box
                that fits the actual admin polygon; eliminates the
                "buyukcekmece -> Bend, Oregon" rot. */}
            <div>
              <label className="text-[13px] font-medium text-white/50 mb-1.5 block">
                Locations
              </label>
              <LocationPicker
                value={locations}
                onChange={(next) => {
                  setLocations(next);
                  // Picking a chip clears the free-text fallback so
                  // the user doesn't accidentally double up.
                  if (next.length > 0) setCity("");
                }}
                regionCode={selectedCountry || undefined}
                maxLocations={5}
              />

              {/* Legacy free-text fallback. Hidden once chips exist —
                  picker path is strictly more accurate. Surfaces a
                  warning banner so the user knows they're on the
                  approximate-geocoding path. */}
              {!hasPickedLocations && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-[12px] font-medium text-white/45 block">
                    Or fall back to typed text (approximate)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Manchester, Istanbul, New York"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  {usingFallback && (
                    <p className="text-[11px] text-[hsl(38_50%_72%)] flex items-start gap-1.5">
                      <Info className="w-3 h-3 mt-0.5 shrink-0" />
                      Free-text uses approximate geocoding. Some leads may
                      land outside your target area — pick from the
                      suggestions above for accurate results.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Niche pack (hybrid parent + child) */}
            <div>
              <label className="text-[13px] font-medium text-white/50 mb-1.5 block">Niche pack (recommended)</label>
              <Select
                value={selectedPackSlug}
                onValueChange={(v) => {
                  setSelectedPackSlug(v);
                  setCustomQuery("");
                  // Pre-fill the searchQuery from the pack so the leaf-pack
                  // path doesn't show an empty box. Parents ignore this.
                  const pack = NICHES.find((n) => n.slug === v);
                  setSelectedQuery(pack?.searchQueries[0] ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a vertical with tuned audit signals..." />
                </SelectTrigger>
                <SelectContent>
                  {PARENT_PACKS.map((parent) => {
                    const children = CHILDREN_BY_PARENT.get(parent.slug) ?? [];
                    return (
                      <div key={parent.slug}>
                        <SelectItem value={parent.slug}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              All {parent.label.replace(/ \(all\)$/i, "")}{" "}
                              <span className="text-[11px] text-white/45">
                                ({children.length} sub-niches, fan-out)
                              </span>
                            </span>
                            <span className="text-[11px] text-white/45">{parent.tagline}</span>
                          </div>
                        </SelectItem>
                        {children.map((child) => (
                          <SelectItem key={child.slug} value={child.slug}>
                            <div className="flex flex-col items-start pl-3">
                              <span className="font-medium">↳ {child.label}</span>
                              <span className="text-[11px] text-white/45">{child.tagline}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                  {LEAF_PACKS.map((niche) => (
                    <SelectItem key={niche.slug} value={niche.slug}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{niche.label}</span>
                        <span className="text-[11px] text-white/45">{niche.tagline}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-white/35 mt-1.5">
                Niche packs come with vertical-specific audit signals and mockup templates.
                {fanOutMode && selectedPack && (
                  <span className="block mt-1 text-(--leadac-500)">
                    Fan-out mode: {(CHILDREN_BY_PARENT.get(selectedPack.slug)?.length ?? 0)} parallel queries → deduped by Place ID.
                  </span>
                )}
              </p>

              {!fanOutMode && (
                <>
                  <label className="text-[13px] font-medium text-white/50 mt-3 mb-1.5 block">Or pick a generic category</label>
                  <Select
                    value={
                      selectedQuery && DEFAULT_SEARCH_QUERIES.includes(selectedQuery)
                        ? selectedQuery
                        : ""
                    }
                    onValueChange={(v) => {
                      setSelectedQuery(v);
                      setCustomQuery("");
                      setSelectedPackSlug("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Generic category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_SEARCH_QUERIES.map((q) => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="or type your own niche"
                    value={customQuery}
                    onChange={(e) => {
                      setCustomQuery(e.target.value);
                      setSelectedQuery("");
                      setSelectedPackSlug("");
                    }}
                    className="mt-2"
                  />
                </>
              )}
            </div>

            <Button
              className="w-full"
              onClick={runDiscovery}
              disabled={running || !canRun}
            >
              {running ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Searching...</>
              ) : (
                <><Search className="w-4 h-4" />Discover Leads</>
              )}
            </Button>

            {!canRun && !running && (
              <p className="text-xs text-white/30 text-center">
                Select a country, pick at least one location, and choose a business type to start
              </p>
            )}

            {error && (
              <div className="rounded-xl bg-[hsl(4_62%_54%)]/[0.06] border border-[hsl(4_62%_54%)]/20 p-4 text-sm text-[hsl(4_62%_54%)] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div><strong>Error:</strong> {error}</div>
              </div>
            )}

            {singleResult && (
              <div className="rounded-xl bg-[hsl(152_48%_50%)]/[0.06] border border-[hsl(152_48%_50%)]/20 p-4 text-sm space-y-1.5">
                <div className="flex items-center gap-2 text-[hsl(152_48%_50%)] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Search complete!
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">{singleResult.total}</p>
                    <p className="text-[11px] text-white/30">Found</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-[hsl(152_48%_50%)]">{singleResult.created}</p>
                    <p className="text-[11px] text-white/30">New</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white/30">{singleResult.skipped}</p>
                    <p className="text-[11px] text-white/30">Duplicate</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Queue */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(38_70%_52%)]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[hsl(38_70%_52%)]" />
              </div>
              <div>
                <CardTitle>Processing Queue</CardTitle>
                <CardDescription>Scan websites and run AI analysis on discovered leads</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/crawl", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ crawlAll: true }),
                    });
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      const reason = (body && typeof body === "object" && "error" in body)
                        ? String(body.error)
                        : `HTTP ${res.status}`;
                      toast.error(`Scan failed: ${reason}`);
                      return;
                    }
                    const data = await res.json();
                    toast.success(`Scan complete: ${data.crawled} succeeded, ${data.failed} failed`);
                  } catch (err) {
                    console.error(err);
                    toast.error("Scan failed: network error");
                  }
                }}
              >
                <Globe className="w-4 h-4" />
                Scan All Pending Websites
              </Button>
              <Button
                className="w-full justify-start"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/analyze", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ analyzeAll: true }),
                    });
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      const reason = (body && typeof body === "object" && "error" in body)
                        ? String(body.error)
                        : `HTTP ${res.status}`;
                      toast.error(`Analysis failed: ${reason}`);
                      return;
                    }
                    const data = await res.json();
                    // Endpoint returns 202 + `enqueued` — the chain
                    // runs in the worker, not inline. Surface that
                    // up-front so the rep watches the live strip.
                    const enqueued =
                      data && typeof data.enqueued === "number"
                        ? data.enqueued
                        : null;
                    if (enqueued && enqueued > 0) {
                      toast.success(
                        `Queued ${enqueued} lead${enqueued === 1 ? "" : "s"} for AI analysis — watch progress above.`,
                      );
                    } else {
                      toast.success("Nothing pending — every lead already has a sales brief.");
                    }
                  } catch (err) {
                    console.error(err);
                    toast.error("Analysis failed: network error");
                  }
                }}
              >
                <Zap className="w-4 h-4" />
                Run AI Analysis on All Pending
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
