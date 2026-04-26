"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  OfferFields,
  EMPTY_OFFER,
  type OfferContext,
} from "@/components/app/offer-form";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Trash2,
  Globe,
  Search,
  MapPin,
  Star,
  Users,
  Package,
  Sparkles,
  Building2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { number: 1, title: "Workspace", description: "Name your workspace" },
  { number: 2, title: "Country", description: "Where are your ideal clients?" },
  { number: 3, title: "Your Offer", description: "Tell us what you sell" },
  { number: 4, title: "Packages", description: "Define your service tiers (optional)" },
  { number: 5, title: "Team", description: "Invite your team (optional)" },
  { number: 6, title: "First Leads", description: "Discover your first businesses" },
];

// ---------------------------------------------------------------------------
// Inline Package editor for onboarding step 4
// ---------------------------------------------------------------------------

interface NewPackage {
  name: string;
  priceLabel: string;
  features: string[];
  isPopular: boolean;
}

function PackageEditor({
  pkg,
  index,
  onChange,
  onRemove,
}: {
  pkg: NewPackage;
  index: number;
  onChange: (pkg: NewPackage) => void;
  onRemove: () => void;
}) {
  const updateFeature = (i: number, v: string) => {
    const next = [...pkg.features];
    next[i] = v;
    onChange({ ...pkg, features: next });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={pkg.name}
          onChange={(e) => onChange({ ...pkg, name: e.target.value })}
          placeholder="Package name (e.g. Starter)"
          className="flex-1 font-medium"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange({ ...pkg, isPopular: !pkg.isPopular })}
          title="Mark as Popular"
          className={pkg.isPopular ? "text-(--leadac-500)" : "text-white/30 hover:text-white/60"}
        >
          <Star className="w-4 h-4" fill={pkg.isPopular ? "currentColor" : "none"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-[hsl(4_62%_54%)]/60 hover:text-[hsl(4_62%_54%)]"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <Input
        value={pkg.priceLabel}
        onChange={(e) => onChange({ ...pkg, priceLabel: e.target.value })}
        placeholder="Price (e.g. £500-800 or From £999)"
      />
      <div className="space-y-2">
        <p className="text-[11px] text-white/40 uppercase tracking-wide font-medium">Features</p>
        {pkg.features.map((feat, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[hsl(152_48%_50%)] shrink-0" />
            <Input
              value={feat}
              onChange={(e) => updateFeature(i, e.target.value)}
              placeholder="e.g. Mobile-friendly site"
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange({ ...pkg, features: pkg.features.filter((_, fi) => fi !== i) })}
              className="shrink-0 text-white/30 hover:text-[hsl(4_62%_54%)]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {pkg.features.length < 8 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...pkg, features: [...pkg.features, ""] })}
            className="text-white/40 hover:text-white/70 pl-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add feature
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main onboarding page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — Workspace name
  const [workspaceName, setWorkspaceName] = useState("");

  // Step 2 — Country
  const [country, setCountry] = useState("");

  // Step 3 — Offer (all 11 fields)
  const [offer, setOffer] = useState<OfferContext>(EMPTY_OFFER);

  // Step 4 — Packages
  const [packages, setPackages] = useState<NewPackage[]>([]);

  // Step 5 — Team invites
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);

  // Step 6 — Discovery
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [city, setCity] = useState("");

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const effectiveNiche = customNiche || niche;

  // ---- Step savers ----------------------------------------------------------

  const saveWorkspaceName = async () => {
    if (!workspaceName.trim()) {
      toast.error("Please enter a workspace name");
      return false;
    }
    setSaving(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save workspace name");
      return false;
    }
    return true;
  };

  const saveCountry = async () => {
    if (!country) {
      toast.error("Please select a country");
      return false;
    }
    setSaving(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save country");
      return false;
    }
    return true;
  };

  const saveOffer = async () => {
    setSaving(true);
    const res = await fetch("/api/workspace/offer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(offer),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; detail?: string };
      toast.error(err.detail || err.error || "Failed to save offer context");
      return false;
    }
    return true;
  };

  const savePackages = async () => {
    if (packages.length === 0) return true;
    setSaving(true);
    for (const [i, pkg] of packages.entries()) {
      if (!pkg.name.trim() || !pkg.priceLabel.trim()) continue;
      await fetch("/api/workspace/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pkg.name.trim(),
          priceLabel: pkg.priceLabel.trim(),
          features: pkg.features.filter(Boolean),
          isPopular: pkg.isPopular,
          sortOrder: i,
        }),
      });
    }
    setSaving(false);
    return true;
  };

  const sendInvites = async () => {
    const validEmails = inviteEmails.map((e) => e.trim()).filter(Boolean);
    if (validEmails.length === 0) return;
    for (const email of validEmails) {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "seat_limit_reached") {
          toast.error(err.message || "Seat limit reached");
        } else if (err.error !== "Already a member") {
          toast.error(`Failed to invite ${email}: ${err.error || "unknown error"}`);
        }
      } else {
        toast.success(`Invite sent to ${email}`);
      }
    }
  };

  const handleDiscover = async () => {
    if (!effectiveNiche || !city.trim() || running) return;
    setRunning(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQuery: effectiveNiche,
          boroughName: city.trim(),
          country,
        }),
        signal: controller.signal,
      });
      let data: { success?: boolean; error?: string; created?: number } = {};
      try { data = await res.json(); } catch { /* empty body */ }

      if (res.ok && data.success) {
        const found = data.created ?? 0;

        // Mark onboarding complete before redirect
        await fetch("/api/onboarding/complete", { method: "POST" });

        if (found === 0) {
          toast.warning("No new leads found for that combination. Try another city or niche.");
          router.push("/app/leads");
          return;
        }

        toast.success(`Found ${found} new leads. Running audits in the background.`);

        Promise.allSettled([
          fetch("/api/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crawlAll: true }) }),
          fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analyzeAll: true }) }),
        ]).catch(() => {});

        router.push("/app/leads");
      } else {
        toast.error(data.error || `Discovery failed (HTTP ${res.status}). Please try again.`);
        setRunning(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Request timed out after 90s. Try a smaller area or retry.");
      } else {
        toast.error("Connection error. Is the server running?");
      }
      setRunning(false);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const skipAndComplete = async () => {
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/app/dashboard");
  };

  // ---- Step navigation ------------------------------------------------------

  const advance = async () => {
    if (step === 1) {
      const ok = await saveWorkspaceName();
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await saveCountry();
      if (ok) setStep(3);
    } else if (step === 3) {
      const ok = await saveOffer();
      if (ok) setStep(4);
    } else if (step === 4) {
      await savePackages();
      setStep(5);
    } else if (step === 5) {
      await sendInvites();
      setStep(6);
    }
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="Leadac AI"
            width={56}
            height={56}
            priority
            className="w-14 h-14 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold text-white">Welcome to Leadac AI</h1>
          <p className="text-sm text-white/50 mt-1">Let&apos;s set up your workspace in a few steps.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {STEPS.map((s) => (
            <div key={s.number} className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  s.number < step
                    ? "bg-[hsl(152_48%_50%)] text-white"
                    : s.number === step
                      ? "bg-(--leadac-500) text-white"
                      : "bg-white/10 text-white/30"
                }`}
              >
                {s.number < step ? <Check className="w-3.5 h-3.5" /> : s.number}
              </div>
              {s.number < 6 && (
                <div className={`w-6 h-0.5 rounded-full transition-all ${s.number < step ? "bg-[hsl(152_48%_50%)]" : "bg-white/15"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">{STEPS[step - 1].title}</h2>
              <p className="text-sm text-white/50 mt-0.5">{STEPS[step - 1].description}</p>
            </div>

            {/* ---- Step 1: Workspace name ---- */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Workspace name
                  </label>
                  <Input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Acme Web Agency"
                    autoFocus
                  />
                  <p className="text-[11px] text-white/35 mt-1">
                    This is how your workspace appears in the app.
                  </p>
                </div>
                <Button
                  className="w-full"
                  disabled={!workspaceName.trim() || saving}
                  onClick={advance}
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            )}

            {/* ---- Step 2: Country ---- */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Country
                  </label>
                  <Select value={country} onValueChange={setCountry}>
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
                  <p className="text-[11px] text-white/35 mt-1">
                    Used to scope Discovery searches globally.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button
                    className="flex-1"
                    disabled={!country || saving}
                    onClick={advance}
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
              </div>
            )}

            {/* ---- Step 3: My Offer ---- */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-(--leadac-300) text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>These fields personalize every AI mockup and message.</span>
                </div>
                <OfferFields data={offer} onChange={setOffer} />
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button className="flex-1" disabled={saving} onClick={advance}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
              </div>
            )}

            {/* ---- Step 4: Service Packages ---- */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Package className="w-4 h-4 text-(--leadac-300)" />
                  Add the service tiers you pitch to clients. You can edit these later.
                </div>

                {packages.map((pkg, i) => (
                  <PackageEditor
                    key={i}
                    pkg={pkg}
                    index={i}
                    onChange={(updated) => {
                      const next = [...packages];
                      next[i] = updated;
                      setPackages(next);
                    }}
                    onRemove={() => setPackages(packages.filter((_, fi) => fi !== i))}
                  />
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPackages([...packages, { name: "", priceLabel: "", features: [], isPopular: false }])}
                  disabled={packages.length >= 6}
                >
                  <Plus className="w-4 h-4" />
                  Add Package
                </Button>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                  <Button className="flex-1" disabled={saving} onClick={advance}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="w-full text-[11.5px] text-white/30 hover:text-white/50 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* ---- Step 5: Invite team ---- */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Users className="w-4 h-4 text-(--leadac-300)" />
                  Teammates will receive an email invite to join your workspace.
                </div>

                {inviteEmails.map((email, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        const next = [...inviteEmails];
                        next[i] = e.target.value;
                        setInviteEmails(next);
                      }}
                      placeholder="colleague@company.com"
                    />
                    {inviteEmails.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setInviteEmails(inviteEmails.filter((_, fi) => fi !== i))}
                        className="text-white/30 hover:text-[hsl(4_62%_54%)] shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {inviteEmails.length < 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteEmails([...inviteEmails, ""])}
                    className="text-white/40"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add another
                  </Button>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep(4)} className="flex-1">Back</Button>
                  <Button className="flex-1" disabled={saving} onClick={advance}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="w-full text-[11.5px] text-white/30 hover:text-white/50 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* ---- Step 6: First discovery ---- */}
            {step === 6 && (
              <div className="space-y-4">
                {/* Niche */}
                <div>
                  <label className="block text-[12px] font-medium text-white/70 mb-1.5">Business type</label>
                  <Select value={niche} onValueChange={(v) => { setNiche(v); setCustomNiche(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a business type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {NICHES.map((n) => (
                        <SelectItem key={n.slug} value={n.searchQueries[0]}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{n.label}</span>
                            <span className="text-[11px] text-white/45">{n.tagline}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {DEFAULT_SEARCH_QUERIES.map((q) => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="h-px flex-1 bg-white/15" />
                    <span className="text-[12px] text-white/40">or type your own</span>
                    <div className="h-px flex-1 bg-white/15" />
                  </div>
                  <Input
                    value={customNiche}
                    onChange={(e) => { setCustomNiche(e.target.value); setNiche(""); }}
                    placeholder="e.g. web design for restaurants"
                    className="mt-2"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> City / Area
                  </label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Manchester, Istanbul, New York"
                  />
                  {country && (
                    <p className="text-[11px] text-white/35 mt-1">
                      Searching in {COUNTRIES.find((c) => c.code === country)?.name ?? country}
                    </p>
                  )}
                </div>

                {/* Summary */}
                {(effectiveNiche || city) && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                    {effectiveNiche && (
                      <div className="flex items-center gap-2 text-sm">
                        <Search className="w-4 h-4 text-(--leadac-500)" />
                        <span className="text-white/50">Looking for:</span>
                        <span className="font-medium text-white">{effectiveNiche}</span>
                      </div>
                    )}
                    {city && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-(--leadac-500)" />
                        <span className="text-white/50">In:</span>
                        <span className="font-medium text-white">{city}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(5)} className="flex-1">Back</Button>
                  <Button
                    className="flex-1"
                    onClick={handleDiscover}
                    disabled={!effectiveNiche || !city.trim() || running}
                  >
                    {running ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Discovering…</>
                    ) : (
                      <><Search className="w-4 h-4" />Discover Leads</>
                    )}
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={skipAndComplete}
                  className="w-full text-[11.5px] text-white/30 hover:text-white/50 transition-colors"
                >
                  Skip — I&apos;ll discover leads later
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
