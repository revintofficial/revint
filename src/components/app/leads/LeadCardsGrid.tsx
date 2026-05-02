"use client";

/**
 * LeadCardsGrid — desktop "cards" view for the leads list.
 *
 * Layout: 1 column on small screens, 2 on md, 3 on lg+. Each card
 * surfaces:
 *   - hero score ring (circular progress, colour-banded by score)
 *   - business name, address, niche / reason chips
 *   - personalized opener preview (truncated, popover with full text
 *     on hover)
 *   - 3 quick action icons (call / shortlist / dossier-deeplink) +
 *     "Open" link to the detail page
 *   - selection checkbox visible on hover (or always when bulk
 *     selection is active)
 *
 * The grid intentionally re-uses `LeadBadgeRow`, `PipelineStageDot`,
 * and `formatRelativeTime` from `LeadRow.tsx` so the chip styling is
 * identical across views. Anything that lives only on the card (the
 * score ring, opener popover) stays in this file.
 */

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquareText,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import {
  LeadBadgeRow,
  PipelineStageDot,
  StatusBadge,
} from "@/components/app/leads/LeadRow";
import { formatRelativeTime } from "@/components/app/leads/format";
import type {
  LeadListItem,
  Pagination,
} from "@/components/app/leads/useLeadsQuery";

export interface LeadCardsGridProps {
  leads: LeadListItem[];
  loading: boolean;
  pagination: Pagination;
  watchlistLeadIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (leadId: string) => void;
  onShortlist: (lead: LeadListItem) => void;
  onPageChange: (page: number) => void;
}

export function LeadCardsGrid({
  leads,
  loading,
  pagination,
  watchlistLeadIds,
  selectedIds,
  onToggleSelect,
  onShortlist,
  onPageChange,
}: LeadCardsGridProps) {
  if (loading && leads.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!loading && leads.length === 0) {
    return (
      <Card>
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Users className="w-10 h-10 text-white/20" />
          <p className="text-sm font-medium text-white/50">
            No leads match these filters
          </p>
          <p className="text-xs text-white/30">
            Try clearing presets or running discovery for more leads.
          </p>
          <Link href="/app/discovery">
            <Button size="sm">Go to Discovery</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map((lead, index) => (
          <LeadGridCard
            key={lead.id}
            lead={lead}
            index={index}
            isWatchlisted={watchlistLeadIds.has(lead.id)}
            isSelected={selectedIds.has(lead.id)}
            onToggleSelect={onToggleSelect}
            onShortlist={onShortlist}
          />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-2">
          <p className="text-sm text-white/50 text-center sm:text-left">
            Page {pagination.page} of {pagination.totalPages}
            <span className="text-white/30 ml-2">
              ({pagination.total} results)
            </span>
          </p>
          <div className="flex gap-1 justify-center sm:justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadGridCard({
  lead,
  index,
  isWatchlisted,
  isSelected,
  onToggleSelect,
  onShortlist,
}: {
  lead: LeadListItem;
  index: number;
  isWatchlisted: boolean;
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
  onShortlist: (lead: LeadListItem) => void;
}) {
  const opener = lead.salesOpportunity?.personalizedFirstMessage ?? null;
  return (
    <Card
      className={`group relative animate-fade-in-up overflow-hidden transition-colors ${
        isSelected
          ? "border-(--leadac-500) bg-(--leadac-500)/[0.06]"
          : "hover:bg-white/[0.02]"
      }`}
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 data-[selected=true]:opacity-100 transition-opacity"
        data-selected={isSelected}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(lead.id)}
          aria-label={`Select ${lead.businessName}`}
        />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ScoreRing score={lead.salesOpportunity?.opportunityScore ?? null} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/app/leads/${lead.id}`}
              className="block font-medium text-white hover:text-(--leadac-500) transition-colors text-[15px] leading-snug line-clamp-2"
            >
              {lead.businessName}
            </Link>
            <p className="text-xs text-white/30 mt-0.5 line-clamp-1">
              {lead.formattedAddress}
            </p>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {lead.salesOpportunity ? (
                <StatusBadge status={lead.salesOpportunity.status} />
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-white/10 bg-white/5 text-white/60">
                  Queued
                </span>
              )}
              {lead.watchlistItem?.pipelineStage && (
                <PipelineStageDot stage={lead.watchlistItem.pipelineStage} />
              )}
              <span className="text-[10px] text-white/30 ml-auto">
                {formatRelativeTime(lead.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        <LeadBadgeRow lead={lead} />

        {opener ? <OpenerPreview text={opener} /> : null}

        <div className="flex items-center gap-1 pt-2 border-t border-white/5">
          {isWatchlisted ? (
            <Link href={`/app/deals?lead=${lead.id}`}>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 gap-1 text-[11px] text-[hsl(38_70%_52%)] hover:text-[hsl(38_70%_52%)]"
              >
                <BookmarkCheck className="w-3 h-3" /> Open Deal
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1 text-[11px]"
              onClick={() => onShortlist(lead)}
            >
              <Bookmark className="w-3 h-3" /> Shortlist
            </Button>
          )}
          {lead.phone ? (
            <a href={`tel:${lead.phone}`}>
              <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-[11px]">
                <Phone className="w-3 h-3" /> Call
              </Button>
            </a>
          ) : null}
          {lead.googleMapsUri ? (
            <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-[11px]">
                <MapPin className="w-3 h-3" /> Map
              </Button>
            </a>
          ) : null}
          <Link href={`/app/leads/${lead.id}`} className="ml-auto">
            <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-[11px]">
              Open <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function OpenerPreview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;
  const truncated = trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="text-left rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:border-(--leadac-500)/40 transition-colors w-full"
        >
          <div className="flex items-start gap-1.5">
            <MessageSquareText className="w-3 h-3 text-(--leadac-300) mt-0.5 shrink-0" />
            <p className="text-[11.5px] leading-relaxed text-white/70 line-clamp-2">
              {truncated}
            </p>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-md text-xs leading-relaxed">
        <div className="flex items-center gap-2 mb-2 text-white/50">
          <Sparkles className="w-3 h-3 text-(--leadac-300)" />
          <span className="text-[11px] font-medium uppercase tracking-wider">
            Personalized opener
          </span>
        </div>
        <p className="text-white/85 whitespace-pre-wrap">{trimmed}</p>
      </PopoverContent>
    </Popover>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="w-14 h-14 shrink-0 rounded-full border-2 border-white/10 flex flex-col items-center justify-center text-white/30">
        <Loader2 className="w-3 h-3 animate-pulse" />
        <span className="text-[8px] uppercase tracking-wider mt-0.5">queued</span>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 60
      ? "var(--leadac-success)"
      : clamped >= 35
      ? "var(--leadac-warning)"
      : "var(--leadac-error)";
  // Conic gradient ring; the inner mask makes it a hollow ring.
  const background = `conic-gradient(${color} ${clamped * 3.6}deg, hsl(0 0% 100% / 0.08) 0deg)`;
  return (
    <div
      className="w-14 h-14 shrink-0 rounded-full p-1 flex items-center justify-center"
      style={{ background }}
    >
      <div className="w-full h-full rounded-full bg-(--leadac-card) flex flex-col items-center justify-center">
        <span className="text-base font-bold text-white">{clamped}</span>
        <span className="text-[8px] uppercase tracking-wider text-white/40">
          score
        </span>
      </div>
    </div>
  );
}
