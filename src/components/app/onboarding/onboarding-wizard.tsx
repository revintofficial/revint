"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
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
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import type { Plan } from "@/generated/prisma/client";
import type { IcpDraft, PackageDraft, OnboardingDraftStatus } from "@/lib/onboarding/types";
import { trackOnboarding } from "@/lib/analytics/onboarding";
import { IcpReviewStep } from "./icp-review-step";
import { PackagesReviewStep } from "./packages-review-step";
import { HubspotImportStep } from "./hubspot-import-step";

// Step indices — keep in sync with HUBSPOT_STEP_INDEX in hubspot-import-step.
const STEPS = [
  { key: "workspace", title: "Workspace", description: "Name your workspace" },
  { key: "company", title: "Company", description: "Point Revint at your website" },
  { key: "icp", title: "ICP", description: "Review your ideal customer" },
  { key: "packages", title: "Packages", description: "Confirm what you sell" },
  { key: "hubspot", title: "HubSpot", description: "Import your leads" },
  { key: "activation", title: "First leads", description: "See Revint at work" },
] as const;

interface OnboardingState {
  role: "OWNER" | "ADMIN" | "MEMBER";
  workspace: {
    name: string;
    country: string | null;
    plan: Plan;
    companyName: string | null;
    companyDomain: string | null;
    pricingPageUrl: string | null;
    onboardingCompletedAt: string | null;
  };
  completion: {
    workspaceNamed: boolean;
    companySubmitted: boolean;
    icpConfirmed: boolean;
    packagesConfirmed: boolean;
    hubspotConnected: boolean;
    onboardingCompleted: boolean;
  };
  draft: {
    status: OnboardingDraftStatus;
    icpDraft: IcpDraft;
    packagesDraft: PackageDraft[];
    error: string | null;
  } | null;
  icp: ConfirmedIcp | null;
  packages: Array<{ name: string; priceLabel: string; features: string[]; isPopular: boolean; sortOrder: number }>;
  hubspot: { configured: boolean; connected: boolean };
}

/** Raw IdealCustomerProfile shape returned by GET /api/onboarding/state. */
interface ConfirmedIcp {
  description: string | null;
  industryWeights: Record<string, number>;
  subNicheWeights: Record<string, number>;
  priceLevelMin: number | null;
  priceLevelMax: number | null;
  minReviewCount: number | null;
  minRating: number | null;
  digitalMaturityFloor: number | null;
  highValueSignals: string[];
  negativeSignals: string[];
  locationFit: Record<string, unknown>;
  sourceJson: { sources?: Array<{ url: string; evidence: string }>; confidence?: number } | null;
  version: number;
}

/** Map a confirmed ICP row into the editable IcpDraft shape. */
function confirmedToDraft(icp: ConfirmedIcp): IcpDraft {
  return {
    description: icp.description ?? "",
    industryWeights: icp.industryWeights ?? {},
    subNicheWeights: icp.subNicheWeights ?? {},
    priceLevelMin: icp.priceLevelMin,
    priceLevelMax: icp.priceLevelMax,
    minReviewCount: icp.minReviewCount,
    minRating: icp.minRating,
    digitalMaturityFloor: icp.digitalMaturityFloor,
    highValueSignals: icp.highValueSignals ?? [],
    negativeSignals: icp.negativeSignals ?? [],
    locationFit: icp.locationFit ?? {},
    sources: icp.sourceJson?.sources,
    confidence: icp.sourceJson?.confidence,
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [step, setStep] = useState(0);
  const [hubspotSkipped, setHubspotSkipped] = useState(false);
  const startedTracked = useRef(false);

  const loadState = useCallback(async (): Promise<OnboardingState | null> => {
    const res = await fetch("/api/onboarding/state", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as OnboardingState;
    setState(data);
    return data;
  }, []);

  // Initial hydration — pick the resume step from completion + ?step= override.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadState();
      if (cancelled || !data) return;
      if (!startedTracked.current) {
        startedTracked.current = true;
        trackOnboarding("onboarding_started");
      }
      const stepParam = searchParams?.get("step");
      const parsed = stepParam ? Number.parseInt(stepParam, 10) : NaN;
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < STEPS.length) {
        setStep(parsed);
      } else {
        setStep(resumeStep(data.completion));
      }
      if (searchParams?.get("hubspot_connected") === "1") {
        toast.success("HubSpot connected");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the draft while the calibration worker runs and we're on a
  // draft-dependent step (ICP / Packages).
  const draftStatus = state?.draft?.status ?? "NONE";
  const onDraftStep = STEPS[step]?.key === "icp" || STEPS[step]?.key === "packages";
  useEffect(() => {
    if (!onDraftStep) return;
    if (draftStatus !== "RUNNING" && draftStatus !== "PENDING") return;
    const id = setInterval(() => {
      void loadState();
    }, 3000);
    return () => clearInterval(id);
  }, [onDraftStep, draftStatus, loadState]);

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  const stepKey = STEPS[step].key;

  return (
    <div className="min-h-screen flex flex-col items-center md:justify-center p-4 md:p-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="Revint"
            width={48}
            height={48}
            priority
            className="w-12 h-12 object-contain mx-auto mb-3"
          />
          <h1 className="text-xl font-semibold text-white">Welcome to Revint</h1>
          <p className="text-sm text-white/50 mt-1">Let&apos;s calibrate Revint to your business.</p>
        </div>

        <ProgressRail step={step} />

        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{STEPS[step].title}</h2>
                <p className="text-sm text-white/50 mt-0.5">{STEPS[step].description}</p>
              </div>
              {step > 0 && stepKey !== "activation" && (
                <Button variant="ghost" size="sm" onClick={goBack} className="text-white/40">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
            </div>

            {stepKey === "workspace" && (
              <WorkspaceStep
                initialName={state.workspace.name}
                initialCountry={state.workspace.country}
                onNext={async () => {
                  await loadState();
                  trackOnboarding("workspace_step_completed");
                  goNext();
                }}
              />
            )}

            {stepKey === "company" && (
              <CompanyStep
                initial={{
                  companyName: state.workspace.companyName,
                  companyDomain: state.workspace.companyDomain,
                  pricingPageUrl: state.workspace.pricingPageUrl,
                }}
                onNext={async () => {
                  await loadState();
                  goNext();
                }}
              />
            )}

            {stepKey === "icp" && (
              <IcpReviewStep
                status={draftStatus}
                draft={state.icp ? confirmedToDraft(state.icp) : (state.draft?.icpDraft ?? null)}
                sources={
                  state.icp ? state.icp.sourceJson?.sources : state.draft?.icpDraft?.sources
                }
                onConfirmed={async () => {
                  await loadState();
                  goNext();
                }}
              />
            )}

            {stepKey === "packages" && (
              <PackagesReviewStep
                status={draftStatus}
                draft={
                  state.packages.length > 0
                    ? state.packages.map((p, i) => ({ ...p, sortOrder: i }))
                    : (state.draft?.packagesDraft ?? null)
                }
                onConfirmed={async () => {
                  await loadState();
                  goNext();
                }}
              />
            )}

            {stepKey === "hubspot" && (
              <HubspotImportStep
                plan={state.workspace.plan}
                configured={state.hubspot.configured}
                connected={state.hubspot.connected}
                onImported={async () => {
                  await loadState();
                  goNext();
                }}
                onSkip={() => {
                  setHubspotSkipped(true);
                  goNext();
                }}
              />
            )}

            {stepKey === "activation" && (
              <ActivationStep
                hubspotSkipped={hubspotSkipped}
                onDone={() =>
                  router.push(`/app/leads?welcome=1${hubspotSkipped ? "&hs=skipped" : ""}`)
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function resumeStep(c: OnboardingState["completion"]): number {
  if (!c.workspaceNamed) return 0;
  if (!c.companySubmitted) return 1;
  if (!c.icpConfirmed) return 2;
  if (!c.packagesConfirmed) return 3;
  return 4;
}

function ProgressRail({ step }: { step: number }) {
  const pre = ["Account created", "Email verified"];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 text-[11px] text-(--revint-success)">
        {pre.map((label) => (
          <span key={label} className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {label}
          </span>
        ))}
      </div>
      <nav className="flex items-center justify-center gap-1.5 flex-wrap" aria-label="Onboarding steps">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                i < step
                  ? "bg-[var(--revint-success)] text-white"
                  : i === step
                    ? "bg-(--revint-500) text-white"
                    : "bg-white/10 text-white/30"
              }`}
              aria-current={i === step ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.title}`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-5 h-0.5 rounded-full transition-all ${
                  i < step ? "bg-[var(--revint-success)]" : "bg-white/10"
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Workspace (name + country + optional team invites)
// ---------------------------------------------------------------------------

function WorkspaceStep({
  initialName,
  initialCountry,
  onNext,
}: {
  initialName: string;
  initialCountry: string | null;
  onNext: () => Promise<void>;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [country, setCountry] = useState(initialCountry ?? "");
  const [invites, setInvites] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a workspace name");
      return;
    }
    if (!country) {
      toast.error("Please select a country");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), country }),
      });
      if (!res.ok) {
        toast.error("Failed to save workspace");
        return;
      }
      const emails = invites.map((e) => e.trim()).filter(Boolean);
      for (const email of emails) {
        const inviteRes = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (inviteRes.ok) toast.success(`Invite sent to ${email}`);
      }
      await onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ws-name" className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Workspace name
        </label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Web Agency"
          autoComplete="organization"
        />
      </div>

      <div>
        <label htmlFor="ws-country" className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> Country
        </label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger id="ws-country">
            <SelectValue placeholder="Select a country…" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-white/35 mt-1">Used to scope lead discovery globally.</p>
      </div>

      <div>
        <label className="text-[12px] font-medium text-white/70 mb-1.5 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Invite teammates (optional)
        </label>
        {invites.map((email, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                const next = [...invites];
                next[i] = e.target.value;
                setInvites(next);
              }}
              placeholder="colleague@company.com"
              autoComplete="email"
            />
            {invites.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setInvites(invites.filter((_, idx) => idx !== i))}
                aria-label={`Remove invite ${i + 1}`}
                className="text-white/30 hover:text-[hsl(4_62%_54%)] shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        {invites.length < 5 && (
          <Button variant="ghost" size="sm" onClick={() => setInvites([...invites, ""])} className="text-white/40 pl-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add another
          </Button>
        )}
      </div>

      <Button className="w-full" onClick={submit} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            Continue <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Company calibration (kicks off the extractor worker)
// ---------------------------------------------------------------------------

function CompanyStep({
  initial,
  onNext,
}: {
  initial: { companyName: string | null; companyDomain: string | null; pricingPageUrl: string | null };
  onNext: () => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState(initial.companyName ?? "");
  const [companyDomain, setCompanyDomain] = useState(initial.companyDomain ?? "");
  const [pricingPageUrl, setPricingPageUrl] = useState(initial.pricingPageUrl ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!companyDomain.trim()) {
      toast.error("Enter your company website");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          companyDomain: companyDomain.trim(),
          pricingPageUrl: pricingPageUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error || "Failed to save company details");
        return;
      }
      const data = (await res.json()) as { calibration?: { started?: boolean } };
      trackOnboarding("company_domain_submitted");
      if (data.calibration?.started) trackOnboarding("calibration_worker_started");
      await onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-(--revint-300) text-sm">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Revint reads your website to draft your ideal customer profile and the packages you sell —
          so scoring and recommendations fit your business from day one.
        </span>
      </div>

      <div>
        <label htmlFor="co-name" className="text-[12px] font-medium text-white/70 mb-1.5 block">
          Company name (optional)
        </label>
        <Input
          id="co-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Acme Studio"
        />
      </div>

      <div>
        <label htmlFor="co-domain" className="text-[12px] font-medium text-white/70 mb-1.5 block">
          Company website
        </label>
        <Input
          id="co-domain"
          value={companyDomain}
          onChange={(e) => setCompanyDomain(e.target.value)}
          placeholder="example.com"
          inputMode="url"
        />
      </div>

      <div>
        <label htmlFor="co-pricing" className="text-[12px] font-medium text-white/70 mb-1.5 block">
          Pricing page URL (optional)
        </label>
        <Input
          id="co-pricing"
          value={pricingPageUrl}
          onChange={(e) => setPricingPageUrl(e.target.value)}
          placeholder="example.com/pricing"
          inputMode="url"
        />
        <p className="text-[11px] text-white/35 mt-1">
          If you have one, we&apos;ll draft your service packages from it.
        </p>
      </div>

      <Button className="w-full" onClick={submit} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Starting calibration…
          </>
        ) : (
          <>
            Calibrate Revint <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Activation
// ---------------------------------------------------------------------------

function ActivationStep({
  hubspotSkipped,
  onDone,
}: {
  hubspotSkipped: boolean;
  onDone: () => void;
}) {
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    setFinishing(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubspotSkipped }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(err.message || err.error || "Couldn't finish onboarding yet");
        return;
      }
      trackOnboarding("onboarding_completed", { hubspotSkipped });
      onDone();
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-(--revint-300) text-sm">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          You&apos;re calibrated. Revint is scoring your leads against your ICP and matching each one
          to the right package. {hubspotSkipped ? "You can connect HubSpot or discover leads any time." : ""}
        </span>
      </div>
      <Button className="w-full" onClick={finish} disabled={finishing}>
        {finishing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Finishing…
          </>
        ) : (
          <>
            Go to my leads <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
