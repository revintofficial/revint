"use client";

/**
 * SalesTalkingPoints — Phase 1.3 (V2 Richness Absorption).
 *
 * V2 re-skin of the legacy `WebsitePlanSection`. Renders the
 * "Sales Talking Points" markdown body that powers the SDR's
 * cold-call cheat sheet — it is the primary supporting doc for
 * the FourThingsCard's "3 SORU" row. The rep opens it when they
 * need more context than the four-line card surfaces.
 *
 * Behaviour matches the V1 component:
 *   - Generate via `POST /api/website-plan/[id]` (the same endpoint
 *     LegacyLeadDetailClient uses).
 *   - When the markdown is missing, show "Build talking points" CTA.
 *   - When present, expose copy / download / hide / regenerate.
 *
 * Default open state is driven by the caller (NextGestureBlock):
 *   - COLD     → collapsed (the FourThingsCard is enough on screen)
 *   - CONTACTED+ → open (rep needs the markdown live during dial)
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

export interface SalesTalkingPointsCopy {
  title: string;
  empty: string;
  build: string;
  rebuild: string;
  building: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  downloadMd: string;
}

export interface SalesTalkingPointsProps {
  leadId: string;
  businessName: string;
  /** Cached markdown body from `WatchlistItem.websitePlan`. */
  markdown: string | null;
  /** Default expanded state — caller decides via pipeline stage. */
  defaultOpen?: boolean;
  /** Optional callback so the parent can refresh the decision-surface
   * cache once a new plan is generated. */
  onGenerated?: () => void;
  copy: SalesTalkingPointsCopy;
}

export function SalesTalkingPoints({
  leadId,
  businessName,
  markdown,
  defaultOpen = false,
  onGenerated,
  copy,
}: SalesTalkingPointsProps): ReactNode {
  const [current, setCurrent] = useState<string | null>(markdown);
  const [showBody, setShowBody] = useState<boolean>(defaultOpen && !!markdown);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep local state in sync if the parent refetches and the
  // markdown changes underneath us (e.g. another tab regenerated).
  useEffect(() => {
    setCurrent(markdown);
  }, [markdown]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/website-plan/${leadId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(
            body.message ??
              "AI credit quota reached. Upgrade your plan to continue.",
          );
        } else if (res.status === 401) {
          toast.error("Session expired. Please sign in again.");
        } else {
          toast.error(body.error ?? `Failed to generate plan (${res.status})`);
        }
        return;
      }
      const data = (await res.json()) as { plan?: string };
      if (data.plan) {
        setCurrent(data.plan);
        setShowBody(true);
        onGenerated?.();
      }
    } catch {
      toast.error("Plan generation failed. Check your connection and retry.");
    } finally {
      setGenerating(false);
    }
  }, [leadId, onGenerated]);

  const handleCopy = useCallback(async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard rejection — rep can select-and-copy manually.
    }
  }, [current]);

  const handleDownload = useCallback(() => {
    if (!current || typeof window === "undefined") return;
    const blob = new Blob([current], { type: "text/markdown" });
    const link = document.createElement("a");
    link.download = `${businessName.replace(/\s+/g, "_")}_talking_points.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [current, businessName]);

  return (
    <div
      data-testid="sales-talking-points"
      className="rounded-lg border border-white/8 bg-white/3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--leadac-500)" }}
            aria-hidden
          />
          <h4
            className="truncate text-[12px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {copy.title}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {current ? (
            <>
              <ChipButton
                onClick={() => setShowBody((v) => !v)}
                icon={
                  showBody ? (
                    <EyeOff className="h-3 w-3" aria-hidden />
                  ) : (
                    <Eye className="h-3 w-3" aria-hidden />
                  )
                }
                label={showBody ? copy.hide : copy.show}
              />
              <ChipButton
                onClick={handleCopy}
                icon={
                  copied ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden />
                  )
                }
                label={copied ? copy.copied : copy.copy}
              />
              <ChipButton
                onClick={handleDownload}
                icon={<Download className="h-3 w-3" aria-hidden />}
                label={copy.downloadMd}
              />
            </>
          ) : null}
          <ChipButton
            onClick={handleGenerate}
            disabled={generating}
            primary
            icon={
              generating ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : current ? (
                <RefreshCw className="h-3 w-3" aria-hidden />
              ) : (
                <Sparkles className="h-3 w-3" aria-hidden />
              )
            }
            label={generating ? copy.building : current ? copy.rebuild : copy.build}
          />
        </div>
      </div>
      {showBody && current ? (
        <div className="border-t border-white/8 px-3 py-3">
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-white/8 bg-white/5 p-3 text-[13px]">
            <MarkdownRenderer content={current} />
          </div>
        </div>
      ) : !current ? (
        <p
          className="border-t border-white/8 px-3 py-3 text-[12px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.empty}
        </p>
      ) : null}
    </div>
  );
}

interface ChipButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  primary?: boolean;
}

function ChipButton({ onClick, icon, label, disabled, primary }: ChipButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{
        borderColor: primary
          ? "color-mix(in srgb, var(--leadac-500) 50%, transparent)"
          : "color-mix(in srgb, var(--leadac-text-3) 25%, transparent)",
        color: primary ? "var(--leadac-text-1)" : "var(--leadac-text-2)",
        background: primary
          ? "color-mix(in srgb, var(--leadac-500) 12%, transparent)"
          : "transparent",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
