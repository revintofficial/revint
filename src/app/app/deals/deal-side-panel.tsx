"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MinimalEditor } from "@/components/ui/minimal-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  ExternalLink,
  Trash2,
  Phone,
  MapPin,
  Check,
  Loader2,
} from "lucide-react";
import type { DealItem, OfferValue } from "./types";
import { toast } from "sonner";

const OFFER_PACKAGES: {
  value: OfferValue;
  label: string;
  price: string;
  description: string;
  cls: {
    selected: string;
    hover: string;
    dot: string;
    label: string;
    price: string;
  };
}[] = [
  {
    value: "STARTER",
    label: "Starter",
    price: "£500–800",
    description: "Single page, mobile-friendly",
    cls: {
      selected: "border-[hsl(152_48%_50%)] bg-[hsl(152_48%_50%)]/10 ring-2 ring-[hsl(152_48%_50%)]/20",
      hover: "hover:border-[hsl(152_48%_50%)]/40 hover:bg-[hsl(152_48%_50%)]/5",
      dot: "bg-[hsl(152_48%_50%)]",
      label: "text-[hsl(152_48%_50%)]",
      price: "text-[hsl(152_48%_50%)]",
    },
  },
  {
    value: "GROWTH",
    label: "Growth",
    price: "£800–1500",
    description: "Multi-page, SEO, online sales",
    cls: {
      selected: "border-(--leadac-500) bg-(--leadac-500)/10 ring-2 ring-(--leadac-500)/20",
      hover: "hover:border-(--leadac-500)/40 hover:bg-(--leadac-500)/5",
      dot: "bg-(--leadac-500)",
      label: "text-(--leadac-500)",
      price: "text-(--leadac-500)",
    },
  },
];

export function DealSidePanel({
  item,
  open,
  onClose,
  onPatch,
  onRemove,
}: {
  item: DealItem | null;
  open: boolean;
  onClose: () => void;
  onPatch: (itemId: string, patch: Partial<DealItem>) => void;
  onRemove: (itemId: string) => void;
}) {
  const [siteUrl, setSiteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [removeOpen, setRemoveOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelItemIdRef = useRef<string | null>(null);

  // Sync local edit state when a different card is selected.
  useEffect(() => {
    if (!item) {
      panelItemIdRef.current = null;
      return;
    }
    if (panelItemIdRef.current !== item.id) {
      panelItemIdRef.current = item.id;
      setSiteUrl(item.siteUrl || "");
      setNotes(item.notes || "");
      setSaveStatus("idle");
    }
  }, [item]);

  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const saveField = useCallback(
    async (itemId: string, patch: Record<string, unknown>) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/watchlist/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          // Don't pretend the change persisted. Surface a toast and
          // reset the indicator so the user knows to retry / refresh.
          setSaveStatus("idle");
          const body = await res.json().catch(() => ({}));
          const reason = (body && typeof body === "object" && "error" in body)
            ? String(body.error)
            : `HTTP ${res.status}`;
          toast.error(`Couldn't save change: ${reason}`);
          return;
        }
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus("idle"), 1400);
      } catch (err) {
        console.error("deal.save_failed", err);
        setSaveStatus("idle");
        toast.error("Couldn't save change: network error");
      }
    },
    []
  );

  const debouncedSave = useCallback(
    (itemId: string, patch: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveField(itemId, patch), 700);
    },
    [saveField]
  );

  if (!item) {
    return null;
  }

  const opp = item.lead.salesOpportunity;

  const handleSiteUrlChange = (value: string) => {
    setSiteUrl(value);
    onPatch(item.id, { siteUrl: value });
    debouncedSave(item.id, { siteUrl: value });
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    onPatch(item.id, { notes: value });
    debouncedSave(item.id, { notes: value });
  };

  const handleOfferSelect = (offer: OfferValue) => {
    const next: OfferValue | null = item.selectedOffer === offer ? null : offer;
    onPatch(item.id, { selectedOffer: next });
    saveField(item.id, { selectedOffer: next });
  };

  const handleNotesHtml = (html: string) => {
    onPatch(item.id, { pipelineNotes: html });
    debouncedSave(item.id, { pipelineNotes: html });
  };

  const handleRemove = async () => {
    try {
      await fetch(`/api/watchlist/${item.id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to remove deal:", err);
    }
    setRemoveOpen(false);
    onRemove(item.id);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        role="dialog"
        aria-label={`Deal details for ${item.lead.businessName}`}
        className={`fixed top-0 right-0 z-50 h-dvh w-full sm:w-[480px] bg-(--leadac-card) border-l border-white/10 shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
            <div className="min-w-0 flex-1">
              <Link
                href={`/app/leads/${item.lead.id}`}
                className="text-base font-semibold text-white hover:text-(--leadac-500) transition-colors"
              >
                {item.lead.businessName}
              </Link>
              <p className="text-xs text-white/40 mt-0.5 truncate">{item.lead.formattedAddress}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {opp && (
                  <Badge
                    variant={
                      opp.opportunityScore >= 60
                        ? "success"
                        : opp.opportunityScore >= 35
                          ? "warning"
                          : "secondary"
                    }
                  >
                    Score: {opp.opportunityScore}
                  </Badge>
                )}
                {item.lead.borough && (
                  <Badge variant="outline">{item.lead.borough}</Badge>
                )}
                {saveStatus === "saving" && (
                  <span className="text-[11px] text-white/30 inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> saving
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-[11px] text-[hsl(152_48%_50%)]">saved</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <section className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                <Phone className="w-3 h-3" /> Contact
              </div>
              <div className="space-y-2 text-sm">
                {item.lead.phone ? (
                  <a
                    href={`tel:${item.lead.phone}`}
                    className="block text-white/70 hover:text-white transition-colors"
                  >
                    {item.lead.phone}
                  </a>
                ) : (
                  <p className="text-white/30">No phone on file</p>
                )}
                {item.lead.googleMapsUri ? (
                  <a
                    href={item.lead.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-(--leadac-500) hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    Open in Google Maps
                  </a>
                ) : (
                  <p className="text-white/30">No map link</p>
                )}
              </div>
            </section>

            <section className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                Built website URL
              </label>
              <Input
                type="url"
                value={siteUrl}
                onChange={(e) => handleSiteUrlChange(e.target.value)}
                placeholder="https://example.com"
                className="h-9"
              />
            </section>

            <section className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                Quick notes
              </label>
              <Textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Quick context, preferences, caveats..."
                rows={3}
                className="resize-none"
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                  Offer
                </label>
              </div>
              {/*
                The "AI suggests: X" hint and the per-tier "AI" badge
                were removed when the platform switched to per-workspace
                ServicePackage rows (P0.4). The dossier owns the
                recommendation now and surfaces it in the lead detail
                via RecommendedPackageCard; this manual offer selector
                is rep-driven.
              */}
              <div className="grid grid-cols-2 gap-2">
                {OFFER_PACKAGES.map((pkg) => {
                  const isSelected = item.selectedOffer === pkg.value;
                  return (
                    <button
                      key={pkg.value}
                      onClick={() => handleOfferSelect(pkg.value)}
                      className={`relative rounded-xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? pkg.cls.selected
                          : `border-white/10 bg-white/5 ${pkg.cls.hover}`
                      }`}
                    >
                      {isSelected && (
                        <Check className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${pkg.cls.label}`} />
                      )}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`w-2 h-2 rounded-full ${pkg.cls.dot}`} />
                        <span
                          className={`text-sm font-semibold ${
                            isSelected ? pkg.cls.label : "text-white/70"
                          }`}
                        >
                          {pkg.label}
                        </span>
                      </div>
                      <div
                        className={`text-xs font-medium ${
                          isSelected ? pkg.cls.price : "text-white/50"
                        }`}
                      >
                        {pkg.price}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5 leading-tight">
                        {pkg.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                Pipeline notes
              </label>
              <MinimalEditor
                initialContent={item.pipelineNotes || ""}
                onUpdate={handleNotesHtml}
                placeholder="Called Tuesday, asked for callback Friday..."
              />
            </section>
          </div>

          <div className="flex items-center justify-between gap-2 p-4 border-t border-white/10 bg-black/20">
            <Link href={`/app/leads/${item.lead.id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3.5 h-3.5" />
                Open full detail
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemoveOpen(true)}
              className="text-[hsl(4_62%_54%)] hover:text-[hsl(4_62%_54%)] hover:bg-[hsl(4_62%_54%)]/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          </div>
        </div>
      </aside>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from pipeline?</DialogTitle>
            <DialogDescription className="text-left pt-1">
              You are about to remove{" "}
              <span className="font-medium text-white/70">{item.lead.businessName}</span>{" "}
              from your pipeline. The lead itself will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 pt-2">
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Yes, remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
