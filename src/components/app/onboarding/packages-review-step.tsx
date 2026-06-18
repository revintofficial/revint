"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Package, Plus, Trash2, Star, Check, AlertTriangle } from "lucide-react";
import type { PackageDraft, OnboardingDraftStatus } from "@/lib/onboarding/types";
import { trackOnboarding } from "@/lib/analytics/onboarding";

function blankPackage(sortOrder: number): PackageDraft {
  return { name: "", priceLabel: "", features: [], isPopular: false, sortOrder };
}

export function PackagesReviewStep({
  status,
  draft,
  onConfirmed,
}: {
  status: OnboardingDraftStatus | "NONE";
  draft: PackageDraft[] | null;
  onConfirmed: () => void;
}) {
  const [packages, setPackages] = useState<PackageDraft[]>(draft ?? []);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const seededRef = useRef(false);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (draft && !seededRef.current) {
      setPackages(draft);
      seededRef.current = true;
    }
  }, [draft]);

  const isLoading = (status === "RUNNING" || status === "PENDING") && !draft;
  const failed = status === "FAILED";

  useEffect(() => {
    if (!isLoading && !viewedRef.current) {
      viewedRef.current = true;
      trackOnboarding("packages_draft_viewed", { count: packages.length, failed });
    }
  }, [isLoading, failed, packages.length]);

  const markEdited = () => {
    if (!edited) {
      setEdited(true);
      trackOnboarding("packages_draft_edited");
    }
  };

  const update = (i: number, next: PackageDraft) => {
    const copy = [...packages];
    copy[i] = next;
    setPackages(copy);
    markEdited();
  };

  const remove = (i: number) => {
    setPackages(packages.filter((_, idx) => idx !== i));
    markEdited();
  };

  const add = () => {
    setPackages([...packages, blankPackage(packages.length)]);
    markEdited();
  };

  const confirm = async () => {
    const usable = packages.filter((p) => p.name.trim());
    if (usable.length === 0) {
      toast.error("Add at least one package — they power lead recommendations.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/confirm-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages: usable }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error || "Failed to save packages");
        return;
      }
      const data = (await res.json()) as { count: number };
      trackOnboarding("packages_confirmed", { count: data.count });
      onConfirmed();
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-(--revint-300) text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Reading your pricing page to draft your packages…</span>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {failed || packages.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-(--revint-warning)/30 bg-(--revint-warning)/5 p-3 text-[12.5px] text-(--revint-text-2)">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-(--revint-warning) shrink-0" />
          <span>
            Add the packages you sell. These power lead recommendations — at least one is required
            before we import leads.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Package className="w-4 h-4 text-(--revint-300)" />
          We drafted these from your pricing page. Confirm them before we import leads.
        </div>
      )}

      {packages.map((pkg, i) => (
        <PackageCard
          key={i}
          pkg={pkg}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
        />
      ))}

      <Button variant="outline" className="w-full" onClick={add} disabled={packages.length >= 12}>
        <Plus className="w-4 h-4" /> Add package
      </Button>

      <Button className="w-full" onClick={confirm} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          "Confirm packages"
        )}
      </Button>
    </div>
  );
}

function PackageCard({
  pkg,
  onChange,
  onRemove,
}: {
  pkg: PackageDraft;
  onChange: (pkg: PackageDraft) => void;
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
          title="Mark as popular"
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
        placeholder="Price (e.g. From $499/mo)"
      />
      <div className="space-y-2">
        <p className="text-[11px] text-white/40 uppercase tracking-wide font-medium">Features</p>
        {pkg.features.map((feat, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[hsl(152_48%_50%)] shrink-0" />
            <Input
              value={feat}
              onChange={(e) => updateFeature(i, e.target.value)}
              placeholder="e.g. 1 location, basic reporting"
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
            <Plus className="w-3.5 h-3.5 mr-1" /> Add feature
          </Button>
        )}
      </div>
    </div>
  );
}
