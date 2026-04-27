"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Star, Package, Check } from "lucide-react";

interface ServicePackage {
  id: string;
  name: string;
  priceLabel: string;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
}

interface PackageCardProps {
  pkg: ServicePackage;
  canEdit: boolean;
  onUpdate: (id: string, updates: Partial<ServicePackage>) => void;
  onDelete: (id: string) => void;
}

function PackageCard({ pkg, canEdit, onUpdate, onDelete }: PackageCardProps) {
  const [name, setName] = useState(pkg.name);
  const [priceLabel, setPriceLabel] = useState(pkg.priceLabel);
  const [features, setFeatures] = useState<string[]>(pkg.features);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDirty =
    name !== pkg.name ||
    priceLabel !== pkg.priceLabel ||
    JSON.stringify(features) !== JSON.stringify(pkg.features);

  const save = async () => {
    if (!name.trim() || !priceLabel.trim()) {
      toast.error("Name and price are required");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/workspace/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        priceLabel: priceLabel.trim(),
        features: features.filter(Boolean),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save");
      return;
    }
    const updated = await res.json();
    onUpdate(pkg.id, updated);
    toast.success("Package saved");
  };

  const togglePopular = async () => {
    const res = await fetch(`/api/workspace/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPopular: !pkg.isPopular }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    const updated = await res.json();
    onUpdate(pkg.id, updated);
  };

  const remove = async () => {
    setDeleting(true);
    const res = await fetch(`/api/workspace/packages/${pkg.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmOpen(false);
    if (!res.ok && res.status !== 204) {
      toast.error("Failed to delete");
      return;
    }
    onDelete(pkg.id);
    toast.success("Package deleted");
  };

  const addFeature = () => {
    if (features.length >= 8) {
      toast.error("Maximum 8 features per package");
      return;
    }
    setFeatures([...features, ""]);
  };

  const updateFeature = (index: number, value: string) => {
    const next = [...features];
    next[index] = value;
    setFeatures(next);
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 transition-all ${
        pkg.isPopular
          ? "border-(--leadac-500)/30 bg-(--leadac-500)/3"
          : "border-white/10 bg-white/5"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Package name"
            disabled={!canEdit}
            className="font-semibold"
          />
          <Input
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
            placeholder="e.g. £500-800 or From £999"
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePopular}
            disabled={!canEdit}
            title={pkg.isPopular ? "Remove Popular badge" : "Mark as Popular"}
            className={pkg.isPopular ? "text-(--leadac-500)" : "text-white/30 hover:text-white/60"}
          >
            <Star className="w-4 h-4" fill={pkg.isPopular ? "currentColor" : "none"} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={!canEdit || deleting}
            title="Delete package"
            className="text-[hsl(4_62%_54%)]/60 hover:text-[hsl(4_62%_54%)]"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete package?</DialogTitle>
            <DialogDescription>
              This will permanently remove
              {" "}
              <span className="text-white">{pkg.name || "this package"}</span>
              {" "}
              and any AI mockups that reference it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Features */}
      <div className="space-y-2">
        <p className="text-[11.5px] text-white/40 font-medium uppercase tracking-wide">Features</p>
        {features.map((feat, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[hsl(152_48%_50%)] shrink-0" />
            <Input
              value={feat}
              onChange={(e) => updateFeature(i, e.target.value)}
              placeholder="Feature description"
              disabled={!canEdit}
              className="text-sm"
            />
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFeature(i)}
                className="shrink-0 text-white/30 hover:text-[hsl(4_62%_54%)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
        {canEdit && features.length < 8 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={addFeature}
            className="text-white/40 hover:text-white/70 pl-6"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add feature
          </Button>
        )}
      </div>

      {/* Save */}
      {canEdit && isDirty && (
        <Button size="sm" onClick={save} disabled={saving} className="w-full">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : "Save changes"}
        </Button>
      )}
    </div>
  );
}

export function PackagesForm({ canEdit }: { canEdit: boolean }) {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workspace/packages");
    if (res.ok) {
      const data = await res.json();
      setPackages(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = (id: string, updates: Partial<ServicePackage>) => {
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleDelete = (id: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  const createPackage = async () => {
    setCreating(true);
    const res = await fetch("/api/workspace/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Package",
        priceLabel: "Contact for pricing",
        features: [],
        isPopular: false,
        sortOrder: packages.length,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to create package");
      return;
    }
    const created = await res.json();
    setPackages((prev) => [...prev, created]);
    toast.success("Package created — fill in the details below");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-white/40 text-sm">Loading…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-(--leadac-300)" />
          Service Packages
        </CardTitle>
        <CardDescription>
          Define the packages you offer. These appear on the Campaigns page so you always know which
          tier to pitch to each lead. Mark one as Popular to give it a highlighted card.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {packages.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
            No packages yet. Add your first one below.
          </div>
        )}

        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            canEdit={canEdit}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}

        {canEdit && (
          <Button
            variant="outline"
            className="w-full"
            onClick={createPackage}
            disabled={creating}
          >
            {creating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
            ) : (
              <><Plus className="w-4 h-4" />Add Package</>
            )}
          </Button>
        )}

        {!canEdit && (
          <p className="text-xs text-white/40 text-center">
            Only Owners and Admins can edit packages.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
