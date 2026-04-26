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
  MapPin,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function DiscoveryPage() {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [city, setCity] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    created: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill country from workspace settings
  useEffect(() => {
    fetch("/api/workspace/country")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.country) setSelectedCountry(d.country);
      })
      .catch(() => null);
  }, []);

  const effectiveQuery = customQuery || selectedQuery;
  const canRun = selectedCountry && city.trim() && effectiveQuery;

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
          searchQuery: effectiveQuery,
          boroughName: city.trim(),
          country: selectedCountry,
        }),
        signal: controller.signal,
      });
      let data: { success?: boolean; error?: string; created?: number; skipped?: number; total?: number } = {};
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
      });
      toast.success(`${data.created ?? 0} new leads added!`);
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

            {/* City */}
            <div>
              <label className="text-[13px] font-medium text-white/50 mb-1.5 block">City / Area</label>
              <Input
                type="text"
                placeholder="e.g. Manchester, Istanbul, New York"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <p className="text-[11px] text-white/35 mt-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 inline" />
                Type any city, district, or neighbourhood
              </p>
            </div>

            {/* Niche */}
            <div>
              <label className="text-[13px] font-medium text-white/50 mb-1.5 block">Niche pack (recommended)</label>
              <Select
                value={selectedQuery && NICHES.some((n) => n.searchQueries[0] === selectedQuery) ? selectedQuery : ""}
                onValueChange={(v) => { setSelectedQuery(v); setCustomQuery(""); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a vertical with tuned audit signals..." />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((niche) => (
                    <SelectItem key={niche.slug} value={niche.searchQueries[0]}>
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
              </p>

              <label className="text-[13px] font-medium text-white/50 mt-3 mb-1.5 block">Or pick a generic category</label>
              <Select
                value={selectedQuery && !NICHES.some((n) => n.searchQueries[0] === selectedQuery) ? selectedQuery : ""}
                onValueChange={(v) => { setSelectedQuery(v); setCustomQuery(""); }}
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
                onChange={(e) => { setCustomQuery(e.target.value); setSelectedQuery(""); }}
                className="mt-2"
              />
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
                Select a country, enter a city, and choose a business type to start
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
                  const res = await fetch("/api/crawl", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ crawlAll: true }),
                  });
                  const data = await res.json();
                  toast.success(`Scan complete: ${data.crawled} succeeded, ${data.failed} failed`);
                }}
              >
                <Globe className="w-4 h-4" />
                Scan All Pending Websites
              </Button>
              <Button
                className="w-full justify-start"
                onClick={async () => {
                  const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ analyzeAll: true }),
                  });
                  const data = await res.json();
                  toast.success(`Analysis complete: ${data.analyzed} succeeded, ${data.failed} failed`);
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
