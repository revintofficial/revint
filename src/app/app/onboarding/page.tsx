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
  ArrowLeft,
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

const TOTAL_STEPS = STEPS.length;

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
  onChange,
  onRemove,
}: {
  pkg: NewPackage;
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
          aria-label={pkg.isPopular ? "Unmark as popular" : "Mark as popular"}
          className={pkg.isPopular ? "text-(--revint-500)" : "text-white/30 hover:text-white/60"}
        >
          <Star className="w-4 h-4" fill={pkg.isPopular ? "currentColor" : "none"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove package"
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
              aria-label={`Remove feature ${i + 1}`}
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

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // ---- Per-step CTA wiring (used by both phone sticky bar and tablet inline)

  // Each step contributes its own primary CTA + optional skip. Centralising the
  // wiring here means we only render one set of action UI per breakpoint and
  // never get the two out of sync (Apple HIG: "primary action should be the
  // single, obvious next step").
  type StepActions = {
    primary: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean; busyLabel?: string };
    secondary?: { label: string; onClick: () => void };
  };

  const actions: StepActions =
    step === 1
      ? {
          primary: {
            label: "Continue",
            onClick: advance,
            disabled: !workspaceName.trim() || saving,
            busy: saving,
            busyLabel: "Saving…",
          },
        }
      : step === 2
        ? {
            primary: {
              label: "Continue",
              onClick: advance,
              disabled: !country || saving,
              busy: saving,
              busyLabel: "Saving…",
            },
            secondary: { label: "Back", onClick: goBack },
          }
        : step === 3
          ? {
              primary: {
                label: "Continue",
                onClick: advance,
                disabled: saving,
                busy: saving,
                busyLabel: "Saving…",
              },
              secondary: { label: "Back", onClick: goBack },
            }
          : step === 4
            ? {
                primary: {
                  label: "Continue",
                  onClick: advance,
                  disabled: saving,
                  busy: saving,
                  busyLabel: "Saving…",
                },
                secondary: { label: "Back", onClick: goBack },
              }
            : step === 5
              ? {
                  primary: {
                    label: "Continue",
                    onClick: advance,
                    disabled: saving,
                    busy: saving,
                    busyLabel: "Sending…",
                  },
                  secondary: { label: "Back", onClick: goBack },
                }
              : {
                  primary: {
                    label: "Discover Leads",
                    onClick: handleDiscover,
                    disabled: !effectiveNiche || !city.trim() || running,
                    busy: running,
                    busyLabel: "Discovering…",
                  },
                  secondary: { label: "Back", onClick: goBack },
                };

  // ---- Render ---------------------------------------------------------------

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);
  const stepInfo = STEPS[step - 1];

  return (
    <div className="min-h-screen flex flex-col md:items-center md:justify-center md:p-6">
      {/* ------------------------------------------------------------- */}
      {/* Phone-only top bar — back chevron, step counter, progress bar  */}
      {/* ------------------------------------------------------------- */}
      <header
        className="md:hidden sticky top-0 z-20 safe-pt"
        style={{
          background: "hsl(var(--revint-h) var(--revint-ns) 8% / 0.92)",
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          borderBottom: "0.5px solid hsl(0 0% 100% / 0.08)",
        }}
      >
        <div
          className="flex items-center gap-3 px-4"
          style={{ minHeight: "var(--app-bar-height)" }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Previous step"
              className="touch-target rounded-lg hover:bg-white/5 -ml-2"
              style={{ color: "var(--revint-text-1)" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div style={{ width: "var(--touch-target-min)" }} aria-hidden="true" />
          )}
          <div className="flex-1 min-w-0 text-center">
            <p
              className="uppercase tracking-wider"
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--revint-muted)",
              }}
            >
              Step {step} of {TOTAL_STEPS}
            </p>
            <p
              className="font-semibold tracking-tight truncate"
              style={{
                fontSize: "var(--text-callout)",
                color: "var(--revint-text-1)",
                letterSpacing: "-0.01em",
              }}
            >
              {stepInfo.title}
            </p>
          </div>
          <div style={{ width: "var(--touch-target-min)" }} aria-hidden="true" />
        </div>
        {/* Slim progress strip — accessible-name applied via aria-label below */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label={`Onboarding progress, step ${step} of ${TOTAL_STEPS}`}
          className="h-1 w-full"
          style={{ background: "hsl(0 0% 100% / 0.08)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${progressPercent}%`,
              background:
                "linear-gradient(90deg, var(--revint-500), var(--revint-300))",
              transition: "width var(--motion-base) var(--motion-ease-emphasized)",
            }}
          />
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* Tablet+ logo + dot progress  */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden md:block w-full max-w-xl space-y-8">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="Revint"
            width={56}
            height={56}
            priority
            className="w-14 h-14 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold text-white">Welcome to Revint</h1>
          <p className="text-sm text-white/50 mt-1">
            Let&apos;s set up your workspace in a few steps.
          </p>
        </div>

        <nav
          className="flex items-center justify-center gap-1.5 flex-wrap"
          aria-label="Onboarding steps"
        >
          {STEPS.map((s) => (
            <div key={s.number} className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  s.number < step
                    ? "bg-[var(--revint-success)] text-white"
                    : s.number === step
                      ? "bg-(--revint-500) text-white"
                      : "bg-white/10 text-white/30"
                }`}
                aria-current={s.number === step ? "step" : undefined}
                aria-label={`Step ${s.number}: ${s.title}`}
              >
                {s.number < step ? <Check className="w-3.5 h-3.5" /> : s.number}
              </div>
              {s.number < TOTAL_STEPS && (
                <div
                  className={`w-6 h-0.5 rounded-full transition-all ${
                    s.number < step ? "bg-[var(--revint-success)]" : "bg-white/10"
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Step body — phone full-bleed, tablet+ inside Card  */}
      {/* ------------------------------------------------------------- */}
      <main
        id="onboarding-step-body"
        className="flex-1 w-full md:max-w-xl md:mt-6"
      >
        {/* Phone layout: full-bleed flow, no card chrome, sticky bottom CTA. */}
        <div
          className="md:hidden px-5 pt-5 space-y-5"
          style={{
            // Reserve space for the sticky CTA so the last form field doesn't
            // hide behind it on smaller phones.
            paddingBottom: "calc(120px + env(safe-area-inset-bottom))",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-subhead)",
              color: "var(--revint-text-2)",
            }}
          >
            {stepInfo.description}
          </p>
          <StepBody
            step={step}
            workspaceName={workspaceName}
            setWorkspaceName={setWorkspaceName}
            country={country}
            setCountry={setCountry}
            offer={offer}
            setOffer={setOffer}
            packages={packages}
            setPackages={setPackages}
            inviteEmails={inviteEmails}
            setInviteEmails={setInviteEmails}
            niche={niche}
            setNiche={setNiche}
            customNiche={customNiche}
            setCustomNiche={setCustomNiche}
            city={city}
            setCity={setCity}
            effectiveNiche={effectiveNiche}
          />
        </div>

        {/* Tablet+ layout: classic single-card wizard. */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">{stepInfo.title}</h2>
                <p className="text-sm text-white/50 mt-0.5">{stepInfo.description}</p>
              </div>
              <StepBody
                step={step}
                workspaceName={workspaceName}
                setWorkspaceName={setWorkspaceName}
                country={country}
                setCountry={setCountry}
                offer={offer}
                setOffer={setOffer}
                packages={packages}
                setPackages={setPackages}
                inviteEmails={inviteEmails}
                setInviteEmails={setInviteEmails}
                niche={niche}
                setNiche={setNiche}
                customNiche={customNiche}
                setCustomNiche={setCustomNiche}
                city={city}
                setCity={setCity}
                effectiveNiche={effectiveNiche}
              />
              <div className="flex gap-2 pt-1">
                {actions.secondary && (
                  <Button
                    variant="outline"
                    onClick={actions.secondary.onClick}
                    className="flex-1"
                  >
                    {actions.secondary.label}
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={actions.primary.onClick}
                  disabled={actions.primary.disabled}
                >
                  {actions.primary.busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {actions.primary.busyLabel ?? "Working…"}
                    </>
                  ) : (
                    <>
                      {step === 6 ? <Search className="w-4 h-4" /> : null}
                      {actions.primary.label}
                      {step !== 6 ? <ArrowRight className="w-4 h-4" /> : null}
                    </>
                  )}
                </Button>
              </div>
              {(step === 4 || step === 5) && (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="w-full text-[11.5px] text-white/30 hover:text-white/50 transition-colors"
                >
                  Skip for now
                </button>
              )}
              {step === 6 && (
                <button
                  type="button"
                  onClick={skipAndComplete}
                  className="w-full text-[11.5px] text-white/30 hover:text-white/50 transition-colors"
                >
                  Skip — I&apos;ll discover leads later
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Phone-only sticky bottom CTA bar (safe-area aware)  */}
      {/* ------------------------------------------------------------- */}
      <div
        className="md:hidden fixed left-0 right-0 bottom-0 z-30 safe-pb px-4 pt-3"
        style={{
          background: "hsl(var(--revint-h) var(--revint-ns) 8% / 0.95)",
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          borderTop: "0.5px solid hsl(0 0% 100% / 0.08)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <Button
          className="w-full revint-glow-cta"
          onClick={actions.primary.onClick}
          disabled={actions.primary.disabled}
          style={{ minHeight: "var(--touch-target-large)" }}
        >
          {actions.primary.busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {actions.primary.busyLabel ?? "Working…"}
            </>
          ) : (
            <>
              {step === 6 ? <Search className="w-4 h-4" /> : null}
              {actions.primary.label}
              {step !== 6 ? <ArrowRight className="w-4 h-4" /> : null}
            </>
          )}
        </Button>
        {(step === 4 || step === 5) && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="w-full text-center mt-2 py-1 text-[12.5px]"
            style={{ color: "var(--revint-text-3)" }}
          >
            Skip for now
          </button>
        )}
        {step === 6 && (
          <button
            type="button"
            onClick={skipAndComplete}
            className="w-full text-center mt-2 py-1 text-[12.5px]"
            style={{ color: "var(--revint-text-3)" }}
          >
            Skip — I&apos;ll discover leads later
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepBody — content for each step, rendered identically on phone + tablet so
// the tablet card and the phone full-bleed layout never drift.
// ---------------------------------------------------------------------------

interface StepBodyProps {
  step: number;
  workspaceName: string;
  setWorkspaceName: (s: string) => void;
  country: string;
  setCountry: (s: string) => void;
  offer: OfferContext;
  setOffer: (o: OfferContext) => void;
  packages: NewPackage[];
  setPackages: (p: NewPackage[]) => void;
  inviteEmails: string[];
  setInviteEmails: (e: string[]) => void;
  niche: string;
  setNiche: (s: string) => void;
  customNiche: string;
  setCustomNiche: (s: string) => void;
  city: string;
  setCity: (s: string) => void;
  effectiveNiche: string;
}

function StepBody(props: StepBodyProps) {
  const {
    step,
    workspaceName,
    setWorkspaceName,
    country,
    setCountry,
    offer,
    setOffer,
    packages,
    setPackages,
    inviteEmails,
    setInviteEmails,
    niche,
    setNiche,
    customNiche,
    setCustomNiche,
    city,
    setCity,
    effectiveNiche,
  } = props;

  if (step === 1) {
    return (
      <div className="space-y-4">
        <div>
          <label
            htmlFor="onboarding-workspace-name"
            className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" /> Workspace name
          </label>
          <Input
            id="onboarding-workspace-name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. Acme Web Agency"
            autoFocus
            autoComplete="organization"
            enterKeyHint="next"
          />
          <p className="text-[11px] text-white/35 mt-1">
            This is how your workspace appears in the app.
          </p>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <div>
          <label
            htmlFor="onboarding-country"
            className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" /> Country
          </label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="onboarding-country">
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
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-(--revint-300) text-sm">
          <Sparkles className="w-4 h-4" />
          <span>These fields personalize every AI mockup and message.</span>
        </div>
        <OfferFields data={offer} onChange={setOffer} />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Package className="w-4 h-4 text-(--revint-300)" />
          Add the service tiers you pitch to clients. You can edit these later.
        </div>

        {packages.map((pkg, i) => (
          <PackageEditor
            key={i}
            pkg={pkg}
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
          onClick={() =>
            setPackages([
              ...packages,
              { name: "", priceLabel: "", features: [], isPopular: false },
            ])
          }
          disabled={packages.length >= 6}
        >
          <Plus className="w-4 h-4" />
          Add Package
        </Button>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Users className="w-4 h-4 text-(--revint-300)" />
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
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              aria-label={`Invite ${i + 1}`}
            />
            {inviteEmails.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setInviteEmails(inviteEmails.filter((_, fi) => fi !== i))
                }
                aria-label={`Remove invite ${i + 1}`}
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
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="space-y-4">
        <div>
          <label
            htmlFor="onboarding-niche"
            className="block text-[12px] font-medium text-white/70 mb-1.5"
          >
            Business type
          </label>
          <Select
            value={niche}
            onValueChange={(v) => {
              setNiche(v);
              setCustomNiche("");
            }}
          >
            <SelectTrigger id="onboarding-niche">
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
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
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
            onChange={(e) => {
              setCustomNiche(e.target.value);
              setNiche("");
            }}
            placeholder="e.g. web design for restaurants"
            className="mt-2"
            enterKeyHint="next"
          />
        </div>

        <div>
          <label
            htmlFor="onboarding-city"
            className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" /> City / Area
          </label>
          <Input
            id="onboarding-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Manchester, Istanbul, New York"
            autoComplete="address-level2"
            enterKeyHint="search"
          />
          {country && (
            <p className="text-[11px] text-white/35 mt-1">
              Searching in{" "}
              {COUNTRIES.find((c) => c.code === country)?.name ?? country}
            </p>
          )}
        </div>

        {(effectiveNiche || city) && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-1.5">
            {effectiveNiche && (
              <div className="flex items-center gap-2 text-sm">
                <Search className="w-4 h-4 text-(--revint-500)" />
                <span className="text-white/50">Looking for:</span>
                <span className="font-medium text-white">{effectiveNiche}</span>
              </div>
            )}
            {city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-(--revint-500)" />
                <span className="text-white/50">In:</span>
                <span className="font-medium text-white">{city}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
