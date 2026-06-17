"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  CircleX,
  Globe,
  Loader2,
  MapPin,
  Package,
  Phone,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import {
  OUTREACH_LABELS,
  CRAWL_LABELS,
  REASON_CODE_LABELS,
  REASON_LABELS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_DOT,
} from "@/lib/labels";
import { getNicheBySlug } from "@/lib/niches";
import { formatRelativeTime } from "@/components/app/leads/format";
import type { LeadListItem } from "@/components/app/leads/useLeadsQuery";

export interface LeadRowProps {
  lead: LeadListItem;
  density: "comfortable" | "compact";
  isWatchlisted: boolean;
  isSelected: boolean;
  contentCheckLoading: boolean;
  websiteSearchLoading: boolean;
  onContentCheck: (lead: LeadListItem) => void;
  onWebsiteSearch: (lead: LeadListItem) => void;
  onShortlist: (lead: LeadListItem) => void;
  onCallStatusChange: (lead: LeadListItem) => void;
  onToggleSelect: (leadId: string) => void;
  index: number;
}

export function LeadRow({
  lead,
  density,
  isWatchlisted,
  isSelected,
  contentCheckLoading,
  websiteSearchLoading,
  onContentCheck,
  onWebsiteSearch,
  onShortlist,
  onCallStatusChange,
  onToggleSelect,
  index,
}: LeadRowProps) {
  const padding = density === "compact" ? "p-2" : "p-3";

  return (
    <tr
      className={`border-b border-white/5 transition-colors animate-fade-in-up ${
        isSelected ? "bg-(--revint-500)/[0.06]" : "hover:bg-white/5"
      }`}
      style={{ animationDelay: `${index * 25}ms` }}
    >
      {/* Selection checkbox */}
      <td className={`${padding} w-10`}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(lead.id)}
          aria-label={`Select ${lead.businessName}`}
        />
      </td>
      {/* Business + niche + reason chips */}
      <td className={padding}>
        <div className="flex flex-col gap-1.5 min-w-0">
          <Link
            href={`/app/leads/${lead.id}`}
            className="font-medium text-white hover:text-(--revint-500) transition-colors leading-tight"
          >
            {lead.businessName}
          </Link>
          <p className="text-xs text-white/30 truncate max-w-md">
            {lead.formattedAddress}
          </p>
          {density !== "compact" && (
            <LeadBadgeRow lead={lead} />
          )}
        </div>
      </td>

      {/* Website + content check / find */}
      <td className={padding}>
        {lead.hasWebsite ? (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <div
              className="flex items-center gap-1.5"
              title={`Website scan: ${CRAWL_LABELS[lead.crawlStatus] ?? lead.crawlStatus}`}
            >
              <CircleCheck className="w-4 h-4 shrink-0 text-[hsl(152_48%_50%)]" aria-hidden />
              <Badge variant="success">Yes</Badge>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                onContentCheck(lead);
              }}
              disabled={contentCheckLoading}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border border-(--revint-500)/20 bg-(--revint-500)/[0.06] text-(--revint-500) hover:bg-(--revint-500)/10 transition-colors disabled:opacity-50 w-fit"
            >
              {contentCheckLoading ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <ScanSearch className="w-2.5 h-2.5" />
              )}
              Check
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-1.5" title="No website">
              <CircleX className="w-4 h-4 shrink-0 text-[hsl(4_62%_54%)]" aria-hidden />
              <Badge variant="destructive">No</Badge>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                onWebsiteSearch(lead);
              }}
              disabled={websiteSearchLoading}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border border-[hsl(218_85%_58%)]/20 bg-[hsl(218_85%_58%)]/[0.06] text-[hsl(218_85%_58%)] hover:bg-[hsl(218_85%_58%)]/10 transition-colors disabled:opacity-50 w-fit"
            >
              {websiteSearchLoading ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Globe className="w-2.5 h-2.5" />
              )}
              Search
            </button>
          </div>
        )}
      </td>

      {/* Score — Phase 2.7: prefer the Sales Fit (LEAD_INTELLIGENCE_BRIEF
          rollup) when it exists; fall back to opportunityScore for leads
          enriched before the brief shipped. The badge label flips so the
          rep knows which signal they're looking at. */}
      <td className={padding}>
        {lead.salesConfidence != null ? (
          <ScoreBadge
            score={lead.salesConfidence}
            label="Fit"
            title="Sales Fit (rolled-up brief score). NOT the Google rating."
          />
        ) : lead.salesOpportunity ? (
          <ScoreBadge
            score={lead.salesOpportunity.opportunityScore}
            label="Opp"
            title="Opportunity sub-score (brief not yet generated)."
          />
        ) : (
          <span className="text-white/20">—</span>
        )}
      </td>

      {/* Status + pipeline stage */}
      <td className={padding}>
        <div className="flex flex-col gap-1">
          {lead.salesOpportunity ? (
            <StatusBadge status={lead.salesOpportunity.status} />
          ) : (
            <Badge variant="outline">Queued</Badge>
          )}
          {lead.watchlistItem?.pipelineStage && (
            <PipelineStageDot stage={lead.watchlistItem.pipelineStage} />
          )}
        </div>
      </td>

      {/* Last activity */}
      <td className={padding}>
        <span
          className="text-xs text-white/40"
          title={new Date(lead.updatedAt).toLocaleString()}
        >
          {formatRelativeTime(lead.updatedAt)}
        </span>
      </td>

      {/* Actions */}
      <td className={padding}>
        <div className="flex flex-wrap gap-1">
          {isWatchlisted ? (
            <Link href={`/app/deals?lead=${lead.id}`}>
              <Button
                size="sm"
                variant="ghost"
                className="text-[hsl(218_85%_58%)] hover:text-[hsl(218_85%_58%)] h-8 px-2 gap-1"
              >
                <BookmarkCheck className="w-4 h-4 shrink-0" />
                Open Deal
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1"
              onClick={() => onShortlist(lead)}
            >
              <Bookmark className="w-4 h-4 shrink-0" />
              Shortlist
            </Button>
          )}
          {lead.salesOpportunity?.status === "NEW" && lead.phone && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1"
              onClick={() => onCallStatusChange(lead)}
            >
              <Phone className="w-4 h-4 shrink-0" />
              Call
            </Button>
          )}
          {lead.googleMapsUri && (
            <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-8 px-2 gap-1">
                <MapPin className="w-4 h-4 shrink-0" />
                View
              </Button>
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Compact badge ribbon shown directly under the business name. Surfaces
 * niche / sub-niche, recommended package, and the top reason codes — the
 * three signals that turn a list scan into a "ready to pitch?" decision.
 */
export function LeadBadgeRow({ lead }: { lead: LeadListItem }) {
  const niche = lead.nicheSlug ? getNicheBySlug(lead.nicheSlug) : null;
  const subNiche = lead.subNicheSlug ? getNicheBySlug(lead.subNicheSlug) : null;
  const lowConfidenceAuto =
    lead.subNicheSource === "AUTO" &&
    typeof lead.subNicheConfidence === "number" &&
    lead.subNicheConfidence < 0.7;

  const reasonCodes = lead.salesOpportunity?.reasonCodes ?? [];
  const visibleReasons = reasonCodes.slice(0, 2);
  const hiddenReasons = reasonCodes.slice(2);

  const recommendedName = lead.salesOpportunity?.recommendedPackageName;
  const recommendedPrice = lead.salesOpportunity?.recommendedPackagePriceLabel;

  const nicheLabel = useMemo(() => {
    if (!niche && !subNiche) return null;
    if (niche && subNiche && subNiche.parentSlug === niche.slug) {
      return `${niche.label} · ${subNiche.label.replace(/^Restaurants & F&B \(all\) ?/, "")}`;
    }
    return subNiche?.label ?? niche?.label ?? null;
  }, [niche, subNiche]);

  if (
    !nicheLabel &&
    visibleReasons.length === 0 &&
    !recommendedName
  ) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1">
        {nicheLabel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                  lowConfidenceAuto
                    ? "border-[hsl(4_62%_54%)]/30 bg-[hsl(4_62%_54%)]/[0.06] text-[hsl(4_42%_72%)]"
                    : "border-(--revint-500)/25 bg-(--revint-500)/[0.06] text-(--revint-300)"
                }`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {nicheLabel}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {lowConfidenceAuto
                ? `Auto-classified (confidence ${Math.round((lead.subNicheConfidence ?? 0) * 100)}%) — opener falls back to generic angle.`
                : lead.subNicheSource === "MANUAL"
                ? "Manually set"
                : `Auto-classified${lead.subNicheConfidence ? ` (confidence ${Math.round(lead.subNicheConfidence * 100)}%)` : ""}`}
            </TooltipContent>
          </Tooltip>
        )}

        {visibleReasons.map((code) => (
          <Tooltip key={code}>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--revint-warning) 8%, transparent)",
                  borderColor: "color-mix(in oklab, var(--revint-warning) 20%, transparent)",
                  color: "hsl(38 50% 72%)",
                }}
              >
                {REASON_CODE_LABELS[code] ?? code.replace(/_/g, " ")}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {REASON_LABELS[code] ?? REASON_CODE_LABELS[code] ?? code.replace(/_/g, " ")}
            </TooltipContent>
          </Tooltip>
        ))}

        {hiddenReasons.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-white/10 bg-white/5 text-white/60">
                +{hiddenReasons.length}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-0.5">
                {hiddenReasons.map((code) => (
                  <div key={code} className="text-xs">
                    {REASON_LABELS[code] ?? code.replace(/_/g, " ")}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {recommendedName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-white/15 bg-white/[0.04] text-white/70">
                <Package className="w-2.5 h-2.5" />
                {recommendedName}
                {recommendedPrice && (
                  <span className="text-white/40">· {recommendedPrice}</span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Recommended package for this lead{recommendedPrice ? ` (${recommendedPrice})` : ""}.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export function PipelineStageDot({ stage }: { stage: string }) {
  const label = PIPELINE_STAGE_LABELS[stage] ?? stage;
  const color = PIPELINE_STAGE_DOT[stage] ?? "hsl(220 8% 70%)";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium"
      style={{ color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export function ScoreBadge({
  score,
  label,
  title,
}: {
  score: number;
  /**
   * Phase 2.7 — short label appended to the score (e.g. "Fit" or
   * "Opp") so the rep can tell at a glance whether the badge is the
   * rolled-up Sales Fit metric or the raw opportunity sub-score.
   * Optional for backwards compatibility with legacy callers.
   */
  label?: string;
  /** Tooltip for screen-reader / mouse-hover. */
  title?: string;
}) {
  const variant: "success" | "warning" | "secondary" =
    score >= 60 ? "success" : score >= 35 ? "warning" : "secondary";
  return (
    <Badge variant={variant} title={title}>
      {score}
      {label ? <span className="ml-1 text-[9px] opacity-70">{label}</span> : null}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    NEW: "secondary",
    CONTACTED: "warning",
    INTERESTED: "warning",
    MEETING: "default",
    WON: "success",
    LOST: "destructive",
  };
  const label = OUTREACH_LABELS[status] ?? status;
  return <Badge variant={variantMap[status] || "secondary"}>{label}</Badge>;
}
