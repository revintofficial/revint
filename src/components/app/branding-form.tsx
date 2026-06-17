"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Lock, Globe } from "lucide-react";
import type { WorkspaceBranding } from "@/lib/branding";
import { getPlanLabel } from "@/lib/plans";

interface Props {
  plan: string;
  planAllowsWhiteLabel: boolean;
  initialBranding: WorkspaceBranding;
  publicProfilesEnabled: boolean;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

export function BrandingForm({
  plan,
  planAllowsWhiteLabel,
  initialBranding,
  publicProfilesEnabled: initialPublicProfilesEnabled,
  workspaceName,
  role,
}: Props) {
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primaryColor ?? "hsl(var(--revint-h) var(--revint-s) 50%)");
  const [accentColor, setAccentColor] = useState(initialBranding.accentColor ?? "hsl(var(--revint-h) var(--revint-s) 78%)");
  const [footerText, setFooterText] = useState(initialBranding.footerText ?? "");
  const [hideCredit, setHideCredit] = useState(initialBranding.hideRevintCredit);
  const [publicProfiles, setPublicProfiles] = useState(initialPublicProfilesEnabled);
  const [busy, setBusy] = useState(false);

  const canEdit = role === "OWNER" || role === "ADMIN";

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branding: {
          logoUrl: logoUrl || null,
          primaryColor: primaryColor || null,
          accentColor: accentColor || null,
          footerText: footerText || null,
          hideRevintCredit: hideCredit,
        },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message || data.error || "Failed to save branding");
      return;
    }
    toast.success("Branding saved. New mockups will use these colors.");
  }

  async function savePublicProfiles(next: boolean) {
    setPublicProfiles(next);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicProfilesEnabled: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save");
      setPublicProfiles(!next);
      return;
    }
    toast.success(
      next
        ? "Public lead profiles enabled. Indexable pages will be generated for new audited leads."
        : "Public lead profiles disabled. Existing pages will return 404."
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>White-label branding</CardTitle>
          <CardDescription>
            Customize how mockup pages and exports look. Useful when sending
            mockup links to your own clients without revealing the underlying
            tool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!planAllowsWhiteLabel && (
            <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.025] p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-white/60 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] font-medium text-white">
                  White label is on the Agency plan
                </p>
                <p className="text-[12px] text-white/55 mt-1">
                  You&apos;re on {getPlanLabel(plan)}. Upgrade to swap the logo, colors, and
                  remove the &quot;Revint&quot; credit on shared mockups.
                </p>
                <Link
                  href="/app/settings/billing"
                  className="text-[12px] text-(--revint-300) hover:underline mt-2 inline-block"
                >
                  Upgrade to Agency →
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={saveBranding} className={`space-y-4 max-w-md ${!planAllowsWhiteLabel ? "opacity-50 pointer-events-none" : ""}`}>
            <div>
              <label className="block text-[11.5px] text-white/55 mb-1">Logo URL (PNG or SVG)</label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                disabled={!canEdit}
                placeholder="https://..."
              />
              <p className="text-[10.5px] text-white/35 mt-1">
                Hosted PNG or SVG, ideally 200x60. Shown in the mockup header.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] text-white/55 mb-1">Primary color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!canEdit}
                    className="h-9 w-10 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!canEdit}
                    placeholder="hsl(var(--revint-h) var(--revint-s) 50%)"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] text-white/55 mb-1">Accent color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!canEdit}
                    className="h-9 w-10 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={!canEdit}
                    placeholder="hsl(var(--revint-h) var(--revint-s) 78%)"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] text-white/55 mb-1">Footer text (max 200 chars)</label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value.slice(0, 200))}
                disabled={!canEdit}
                placeholder={`Drafted by ${workspaceName}`}
              />
            </div>

            <label className="flex items-start gap-2 text-[12.5px] text-white/75 cursor-pointer">
              <input
                type="checkbox"
                checked={hideCredit}
                onChange={(e) => setHideCredit(e.target.checked)}
                disabled={!canEdit}
                className="mt-0.5"
              />
              <span>
                Remove the &ldquo;Drafted by Revint&rdquo; line at the bottom
                of mockup pages.
              </span>
            </label>

            {canEdit && (
              <Button type="submit" disabled={busy}>
                {busy ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>) : "Save branding"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Public lead profiles
          </CardTitle>
          <CardDescription>
            When enabled, Revint generates indexable public pages for each
            audited lead so prospects searching ChatGPT or Perplexity for your
            niche can find you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className={`flex items-center gap-3 cursor-pointer ${!canEdit ? "opacity-50 pointer-events-none" : ""}`}>
            <input
              type="checkbox"
              checked={publicProfiles}
              onChange={(e) => savePublicProfiles(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4"
            />
            <div>
              <p className="text-[13px] font-medium text-white">
                Generate indexable lead profile pages
              </p>
              <p className="text-[11.5px] text-white/55 mt-0.5">
                Pages live at /[country]/[city]/[niche]/[business] with
                Schema.org LocalBusiness markup.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
