/**
 * SourceChip — interactive citation pill rendered inline by
 * `DossierMarkdown`. Three behaviours:
 *
 *   1. Visual: brand-tinted pill with an icon + short label, derived
 *      from the canonical tag via `getSourceVisual`.
 *   2. Hover (and tap on touch): Radix Popover shows a tiny preview
 *      with up to ~5 KeyMetric rows from `buildPreviewMetrics`. Loads
 *      instantly because the preview data is on the page already
 *      (fetched once by the parent's `useDossierSources` hook).
 *   3. Click: opens the side drawer with the FULL source detail. The
 *      parent (`DossierSection`) owns the drawer state — the chip
 *      just calls `onOpen(tag)`.
 */
"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  buildPreviewMetrics,
  chipClassesForTone,
  getSourceVisual,
  type CanonicalTag,
  type DossierSourcesPayload,
} from "./source-registry";

interface SourceChipProps {
  tag: CanonicalTag;
  sources: DossierSourcesPayload | null;
  /** Called when the user clicks the chip — parent opens the drawer. */
  onOpen: (tag: CanonicalTag) => void;
  /** When true, render with extra muted styling (e.g. drawer not yet enabled because dossier-sources is still loading). */
  disabled?: boolean;
}

export function SourceChip({ tag, sources, onOpen, disabled }: SourceChipProps) {
  const visual = getSourceVisual(tag);
  const tone = chipClassesForTone(visual.tone);
  const preview = buildPreviewMetrics(tag, sources);
  const Icon = visual.Icon;

  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(e) => {
            e.preventDefault();
            setOpen(false);
            onOpen(tag);
          }}
          disabled={disabled}
          aria-label={`${visual.title} — open detail`}
          className={cn(
            "inline-flex items-center gap-1 align-baseline whitespace-nowrap",
            // Slightly tighter than a normal pill so prose spacing stays natural.
            "h-[20px] px-1.5 mx-0.5 rounded-md border text-[10.5px] font-medium leading-none",
            "transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-(--revint-500)/40",
            tone.bg,
            tone.text,
            tone.border,
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <Icon className={cn("h-2.5 w-2.5 shrink-0", tone.iconColor)} />
          <span className="truncate max-w-[140px]">{visual.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-72 p-0"
        // Stop the popover from stealing focus so chips can be hovered
        // through prose without losing keyboard focus on the parent
        // text selection.
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Don't close the popover when clicking inside it (e.g. clicking
        // the "View detail" button below).
        onPointerDownOutside={() => setOpen(false)}
      >
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-md w-7 h-7 shrink-0 border",
                tone.bg,
                tone.border,
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", tone.iconColor)} />
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white leading-tight">
                {visual.title}
              </div>
              {visual.description && (
                <div className="text-[11px] text-white/45 leading-snug mt-0.5">
                  {visual.description}
                </div>
              )}
            </div>
          </div>

          {preview.headline && (
            <div className="text-[12px] text-white/75 leading-snug border-l-2 border-white/10 pl-2 italic">
              {preview.headline}
            </div>
          )}

          {preview.loading ? (
            <div className="space-y-1.5">
              <div className="h-3 w-1/2 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-white/8 animate-pulse" />
            </div>
          ) : preview.metrics.length === 0 ? (
            <div className="text-[11px] text-white/40 italic">No preview data.</div>
          ) : (
            <div className="space-y-1">
              {preview.metrics.slice(0, 6).map((m, i) => (
                <div
                  key={`${m.label}-${i}`}
                  className="flex items-baseline justify-between gap-2 text-[11px]"
                >
                  <span className="text-white/45 shrink-0">{m.label}</span>
                  <span
                    className={cn(
                      "text-right font-medium truncate",
                      preview.missing ? "text-white/40 italic" : "text-white/85",
                    )}
                    title={m.value}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 border-t border-white/8">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onOpen(tag);
              }}
              className="w-full text-[11px] text-white/65 hover:text-white py-1 rounded transition-colors text-center"
            >
              Open full detail →
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
