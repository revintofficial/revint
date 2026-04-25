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
}

export const NICHE_OPTIONS = [
  { value: "WEB_AGENCY", label: "Web / Marketing Agency (default)" },
  { value: "RESTAURANT_TECH", label: "Restaurant Tech (QR menu / digital ordering)" },
  { value: "DENTAL", label: "Dental (coming soon)" },
  { value: "REAL_ESTATE", label: "Real Estate (coming soon)" },
];

export const RESTAURANT_TECH_DEFAULTS = {
  offerName: "QR Menu & Digital Ordering",
  valueProposition:
    "We replace paper menus with a QR code that lets guests browse, order, and pay from their phone — driving higher spend per table and faster table turns.",
  offerHook:
    "Checked your site and noticed you don't have a QR menu yet — put together a quick demo for you.",
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
    const next: OfferContext = { ...data, niche: newNiche };
    if (newNiche === "RESTAURANT_TECH") {
      if (!data.offerName) next.offerName = RESTAURANT_TECH_DEFAULTS.offerName;
      if (!data.valueProposition) next.valueProposition = RESTAURANT_TECH_DEFAULTS.valueProposition;
      if (!data.offerHook) next.offerHook = RESTAURANT_TECH_DEFAULTS.offerHook;
    }
    onChange(next);
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
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
        >
          {NICHE_OPTIONS.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </Field>

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
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50"
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
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50"
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
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Message goal" help="What do you want when they reply?">
          <select
            value={data.objective}
            onChange={(e) => update("objective")(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
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
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
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
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
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
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
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
            placeholder="https://leadac.ai/demo"
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
    fetch("/api/workspace/offer")
      .then((r) => r.json())
      .then((d) =>
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
        }),
      )
      .catch(() => toast.error("Couldn't load offer context"))
      .finally(() => setLoading(false));
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
          <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
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
