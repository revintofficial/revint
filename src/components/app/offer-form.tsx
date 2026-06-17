/**
 * P0.2 - "My offer" form. Edits the workspace-level offer context fields.
 * Drives both SalesOpportunity and WebsitePlan prompt personalization.
 *
 * OfferFields is also imported by the onboarding wizard.
 */

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Sparkles } from "lucide-react";
import { getChildrenOf, verticalRootForWorkspace } from "@/lib/niches";
import type { WorkspaceNiche } from "@/generated/prisma";

export interface OfferContext {
  offerName: string;
  valueProposition: string;
  socialProof: string;
  offerHook: string;
  objective: string;
  tone: string;
  length: string;
  language: string;
  senderName: string;
  conversionLink: string;
  niche: string;
  targetSubNiches: string[];
}

export const NICHE_OPTIONS = [
  { value: "WEB_AGENCY", label: "Web / Marketing Agency (default)", available: true },
  {
    value: "RESTAURANT_TECH",
    label: "F&B / Hospitality (restaurants, bars, hotels, cafes, ghost kitchens, food trucks, QSR)",
    available: true,
  },
  { value: "DENTAL", label: "Dental (coming soon)", available: false },
  { value: "REAL_ESTATE", label: "Real Estate (coming soon)", available: false },
] as const;

export const RESTAURANT_TECH_DEFAULTS = {
  offerName: "F&B Digital Stack (QR menu, ordering, reservations)",
  valueProposition:
    "We modernise the digital touchpoints F&B operators rely on — QR menu, table-side ordering, online reservations, and guest data capture — so every cover spends more, comes back more often, and is reachable for marketing.",
  offerHook:
    "Quickly scoped your site and there's no proper QR menu / reservation flow yet — put together a tailored mockup for you.",
  // Empty default = workspace targets all 10 child packs. Sales lead can narrow
  // afterwards (e.g. only fine-dining + bars + hotels for the first month).
  targetSubNiches: [] as string[],
};

export const TONE_OPTIONS = ["friendly", "professional", "direct", "casual", "warm"];
export const LENGTH_OPTIONS = ["very short", "short", "medium", "long"];
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "tr", label: "Türkçe" },
];
export const OBJECTIVE_OPTIONS = [
  "Book a 15-min call",
  "Get a reply",
  "Send the mockup link",
  "Quote a price",
  "Schedule on-site visit",
];

export const EMPTY_OFFER: OfferContext = {
  offerName: "",
  valueProposition: "",
  socialProof: "",
  offerHook: "",
  objective: "",
  tone: "",
  length: "",
  language: "en",
  senderName: "",
  conversionLink: "",
  niche: "WEB_AGENCY",
  targetSubNiches: [],
};

// ---------------------------------------------------------------------------
// Shared field renderer used by both the settings form and the onboarding step
// ---------------------------------------------------------------------------

export function OfferFields({
  data,
  onChange,
  disabled = false,
}: {
  data: OfferContext;
  onChange: (next: OfferContext) => void;
  disabled?: boolean;
}) {
  const update = (k: keyof OfferContext) => (v: string) =>
    onChange({ ...data, [k]: v });

  const handleNicheChange = (newNiche: string) => {
    // Coming-soon niches are disabled in the <option> below, but a
    // determined user could still POST the value through the API.
    // Defensively reject the change on the client too so the form
    // never enters an unsupported state.
    const opt = NICHE_OPTIONS.find((n) => n.value === newNiche);
    if (opt && !opt.available) return;
    const next: OfferContext = { ...data, niche: newNiche };
    if (newNiche === "RESTAURANT_TECH") {
      if (!data.offerName) next.offerName = RESTAURANT_TECH_DEFAULTS.offerName;
      if (!data.valueProposition) next.valueProposition = RESTAURANT_TECH_DEFAULTS.valueProposition;
      if (!data.offerHook) next.offerHook = RESTAURANT_TECH_DEFAULTS.offerHook;
    } else {
      // Switching out of a parent vertical clears the sub-niche focus list —
      // those slugs only make sense inside their parent vertical.
      next.targetSubNiches = [];
    }
    onChange(next);
  };

  // Sub-niche focus list is only meaningful for verticals that define a
  // parent → children NichePack tree (currently only RESTAURANT_TECH → fnb).
  const verticalRoot = verticalRootForWorkspace(data.niche as WorkspaceNiche);
  const childPacks = verticalRoot ? getChildrenOf(verticalRoot) : [];

  const toggleSubNiche = (slug: string) => {
    const set = new Set(data.targetSubNiches);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    onChange({ ...data, targetSubNiches: Array.from(set) });
  };

  return (
    <div className="space-y-5">
      <Field
        label="Niche"
        help="Select what your workspace sells. The AI analysis, reason codes, and openers all adapt to your niche."
      >
        <select
          value={data.niche}
          onChange={(e) => handleNicheChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-(--revint-500)/50"
        >
          {NICHE_OPTIONS.map((n) => (
            <option key={n.value} value={n.value} disabled={!n.available}>
              {n.label}
            </option>
          ))}
        </select>
      </Field>

      {childPacks.length > 0 && (
        <Field
          label="Sub-niche focus"
          help="Optional. Tick the sub-verticals your team actually pitches — Discovery defaults, the auto-classifier prior, and the quota planner narrow to them. Leave all unchecked to target every sub-vertical."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-white/3 border border-white/10 p-3">
            {childPacks.map((pack) => {
              const checked = data.targetSubNiches.includes(pack.slug);
              return (
                <label
                  key={pack.slug}
                  className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                    disabled
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSubNiche(pack.slug)}
                    disabled={disabled}
                    className="mt-0.5 h-4 w-4 accent-(--revint-500)"
                  />
                  <span className="leading-tight">
                    <span className="block text-white">{pack.label}</span>
                    <span className="block text-[11px] text-white/40">
                      {pack.tagline}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Field>
      )}

      <Field
        label="Offer name"
        help="e.g. Local Business Web Package, Klaviyo Email Setup, Phone Repair Site Setup."
      >
        <Input
          value={data.offerName}
          onChange={(e) => update("offerName")(e.target.value)}
          disabled={disabled}
          maxLength={80}
          placeholder="Local Business Web Package"
        />
      </Field>

      <Field
        label="Value proposition"
        help="In one sentence: what you sell and what the customer gets out of it."
      >
        <textarea
          value={data.valueProposition}
          onChange={(e) => update("valueProposition")(e.target.value)}
          disabled={disabled}
          maxLength={500}
          rows={3}
          placeholder="One-page, mobile-first website with online booking for local service businesses. Bookings in minutes, live within 14 days."
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-(--revint-500)/50"
        />
      </Field>

      <Field
        label="Social proof"
        help="Which references, numbers, or case studies add credibility?"
      >
        <textarea
          value={data.socialProof}
          onChange={(e) => update("socialProof")(e.target.value)}
          disabled={disabled}
          maxLength={400}
          rows={2}
          placeholder="120+ sites delivered, 14-day average launch, 4.8/5 customer rating."
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-(--revint-500)/50"
        />
      </Field>

      <Field
        label="Hook / opening line"
        help="The attention-grabbing first sentence of your message."
      >
        <textarea
          value={data.offerHook}
          onChange={(e) => update("offerHook")(e.target.value)}
          disabled={disabled}
          maxLength={300}
          rows={2}
          placeholder="Measured your site's mobile load time — 4.8s, no booking button. Put together a 1-page draft for you."
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-(--revint-500)/50"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Message goal" help="What do you want when they reply?">
          <select
            value={data.objective}
            onChange={(e) => update("objective")(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-(--revint-500)/50"
          >
            <option value="">Select...</option>
            {OBJECTIVE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>

        <Field label="Tone" help="How the message should read">
          <select
            value={data.tone}
            onChange={(e) => update("tone")(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-(--revint-500)/50"
          >
            <option value="">Select...</option>
            {TONE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Length">
          <select
            value={data.length}
            onChange={(e) => update("length")(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-(--revint-500)/50"
          >
            <option value="">Select...</option>
            {LENGTH_OPTIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>

        <Field label="Language">
          <select
            value={data.language}
            onChange={(e) => update("language")(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-(--revint-500)/50"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sender name" help="The name that appears in the email signature">
          <Input
            value={data.senderName}
            onChange={(e) => update("senderName")(e.target.value)}
            disabled={disabled}
            maxLength={80}
            placeholder="Jane Doe"
          />
        </Field>

        <Field label="Conversion link" help="Where should the CTA send them?">
          <Input
            value={data.conversionLink}
            onChange={(e) => update("conversionLink")(e.target.value)}
            disabled={disabled}
            maxLength={300}
            placeholder="https://revint.dev/demo"
          />
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings page wrapper — loads data from API and wraps OfferFields with save
// ---------------------------------------------------------------------------

export function OfferForm({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<OfferContext>(EMPTY_OFFER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // M19 fix - cancel-on-unmount. The previous version called
    // setData / setLoading unconditionally inside the .then chain,
    // so a navigation that unmounted this component before the
    // /api/workspace/offer round trip resolved would log a
    // "setState on unmounted component" warning AND keep the
    // request alive (no AbortController). The new version aborts
    // the in-flight fetch on unmount and short-circuits the
    // setState calls if the component is gone.
    const ctrl = new AbortController();
    let cancelled = false;
    fetch("/api/workspace/offer", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData({
          offerName: d.offerName ?? "",
          valueProposition: d.valueProposition ?? "",
          socialProof: d.socialProof ?? "",
          offerHook: d.offerHook ?? "",
          objective: d.objective ?? "",
          tone: d.tone ?? "",
          length: d.length ?? "",
          language: d.language ?? "en",
          senderName: d.senderName ?? "",
          conversionLink: d.conversionLink ?? "",
          niche: d.niche ?? "WEB_AGENCY",
          targetSubNiches: Array.isArray(d.targetSubNiches) ? d.targetSubNiches : [],
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // AbortError on unmount is expected; don't toast.
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error("Couldn't load offer context");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/offer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Couldn't save");
        return;
      }
      toast.success("Offer context updated. It'll kick in on your next mockup and message.");
    } catch (err) {
      console.error("Offer save error:", err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-white/40 text-sm">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-(--revint-300)" />
          My Offer
        </CardTitle>
        <CardDescription>
          What does this workspace sell? The AI mockup, opener, and sales angle all personalize
          based on this. Your own voice and price anchor flow through every message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="max-w-2xl">
          <OfferFields data={data} onChange={setData} disabled={!canEdit} />

          <div className="flex items-center gap-3 pt-5">
            <Button type="submit" disabled={!canEdit || saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save
                </>
              )}
            </Button>
            {!canEdit && (
              <span className="text-xs text-white/40">
                Only Owners and Admins can edit.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-white/70 mb-1">{label}</label>
      {children}
      {help && <p className="text-[11px] text-white/35 mt-1 leading-relaxed">{help}</p>}
    </div>
  );
}
