"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_LOCATIONS, DEFAULT_SEARCH_QUERIES } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, MapPin, Search, Loader2, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { number: 1, title: "Your niche", description: "What kind of websites do you build?" },
  { number: 2, title: "Your location", description: "Where are your ideal clients?" },
  { number: 3, title: "Find leads", description: "Discover your first businesses" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [running, setRunning] = useState(false);

  const effectiveNiche = customNiche || niche;
  const effectiveLocation = customLocation || location;

  const handleDiscover = async () => {
    if (!effectiveNiche || !effectiveLocation) return;
    setRunning(true);

    const loc = DEFAULT_LOCATIONS.find((l) => l.name === effectiveLocation);

    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQuery: effectiveNiche,
          boroughName: loc?.name || effectiveLocation,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const found = data.created ?? 0;
        if (found === 0) {
          toast.warning("No new leads found for that combination. Try another niche or location.");
          router.push("/app/leads");
          return;
        }

        toast.success(`Found ${found} new leads. Starting audits in the background.`);

        // Kick off audit for the new batch so the user lands on populated rows
        // instead of empty placeholders. Fire-and-forget; the workers handle
        // the heavy lifting and the leads page polls for status.
        Promise.allSettled([
          fetch("/api/crawl", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ crawlAll: true }),
          }),
          fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analyzeAll: true }),
          }),
        ]).catch(() => {
          // Silent: leads page will let the user retry per-lead.
        });

        router.push("/app/leads");
      } else {
        toast.error(data.error || "Discovery failed. Please try again.");
        setRunning(false);
      }
    } catch {
      toast.error("Connection error. Is the server running?");
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1d1d1f] flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Welcome to Lead Engine</h1>
          <p className="text-sm text-white/50 mt-1">Pick a niche and a city. We&apos;ll bring back 50 audited leads.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s) => (
            <div key={s.number} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  s.number < step
                    ? "bg-[#30D158] text-white"
                    : s.number === step
                      ? "bg-[#0A84FF] text-white"
                      : "bg-white/10 text-white/30"
                }`}
              >
                {s.number < step ? <Check className="w-4 h-4" /> : s.number}
              </div>
              {s.number < 3 && (
                <div className={`w-12 h-0.5 rounded-full transition-all ${s.number < step ? "bg-[#30D158]" : "bg-white/15"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">{STEPS[step - 1].title}</h2>
              <p className="text-sm text-white/50 mt-0.5">{STEPS[step - 1].description}</p>
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <Select value={niche} onValueChange={(v) => { setNiche(v); setCustomNiche(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a business type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_SEARCH_QUERIES.map((q) => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/15" />
                  <span className="text-[13px] font-medium text-white/50">or type your own</span>
                  <div className="h-px flex-1 bg-white/15" />
                </div>
                <Input
                  type="text"
                  placeholder="e.g. web design for restaurants"
                  value={customNiche}
                  onChange={(e) => { setCustomNiche(e.target.value); setNiche(""); }}
                />
                <Button
                  className="w-full"
                  disabled={!effectiveNiche}
                  onClick={() => setStep(2)}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Select value={location} onValueChange={(v) => { setLocation(v); setCustomLocation(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an area…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_LOCATIONS.map((l) => (
                      <SelectItem key={l.name} value={l.name}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-white/30" />
                          {l.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/15" />
                  <span className="text-[13px] font-medium text-white/50">or type a location</span>
                  <div className="h-px flex-1 bg-white/15" />
                </div>
                <Input
                  type="text"
                  placeholder="e.g. Brooklyn, Berlin, Manchester"
                  value={customLocation}
                  onChange={(e) => { setCustomLocation(e.target.value); setLocation(""); }}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button
                    className="flex-1"
                    disabled={!effectiveLocation}
                    onClick={() => setStep(3)}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Search className="w-4 h-4 text-[#0A84FF]" />
                    <span className="text-white/50">Searching for:</span>
                    <span className="font-medium text-white">{effectiveNiche}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-[#0A84FF]" />
                    <span className="text-white/50">Near:</span>
                    <span className="font-medium text-white">{effectiveLocation}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button
                    className="flex-1"
                    onClick={handleDiscover}
                    disabled={running}
                  >
                    {running ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Discovering…</>
                    ) : (
                      <><Search className="w-4 h-4" />Discover Leads</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
