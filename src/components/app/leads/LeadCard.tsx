"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bookmark,
  BookmarkCheck,
  Globe,
  Loader2,
  MapPin,
  Phone,
  ScanSearch,
} from "lucide-react";
import {
  LeadBadgeRow,
  PipelineStageDot,
  ScoreBadge,
  StatusBadge,
} from "@/components/app/leads/LeadRow";
import { formatRelativeTime } from "@/components/app/leads/format";
import type { LeadListItem } from "@/components/app/leads/useLeadsQuery";

export interface LeadCardProps {
  lead: LeadListItem;
  isWatchlisted: boolean;
  isSelected: boolean;
  contentCheckLoading: boolean;
  websiteSearchLoading: boolean;
  onContentCheck: (lead: LeadListItem) => void;
  onWebsiteSearch: (lead: LeadListItem) => void;
  onShortlist: (lead: LeadListItem) => void;
  onToggleSelect: (leadId: string) => void;
  index: number;
}

export function LeadCard({
  lead,
  isWatchlisted,
  isSelected,
  contentCheckLoading,
  websiteSearchLoading,
  onContentCheck,
  onWebsiteSearch,
  onShortlist,
  onToggleSelect,
  index,
}: LeadCardProps) {
  return (
    <Card
      className={`animate-fade-in-up transition-colors ${
        isSelected ? "border-(--leadac-500) bg-(--leadac-500)/[0.06]" : ""
      }`}
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(lead.id)}
            aria-label={`Select ${lead.businessName}`}
            className="mt-1 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/app/leads/${lead.id}`}
              className="font-medium text-white hover:text-(--leadac-500) transition-colors text-[15px] leading-snug break-words"
            >
              {lead.businessName}
            </Link>
            <p className="text-xs text-white/30 mt-0.5 line-clamp-2">
              {lead.formattedAddress}
            </p>
          </div>
          {lead.salesOpportunity && (
            <ScoreBadge score={lead.salesOpportunity.opportunityScore} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {lead.hasWebsite ? (
            <Badge variant="success" className="text-[10px]">
              Has site
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">
              No site
            </Badge>
          )}
          {lead.salesOpportunity ? (
            <StatusBadge status={lead.salesOpportunity.status} />
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Queued
            </Badge>
          )}
          {lead.borough && (
            <Badge variant="outline" className="text-[10px]">
              {lead.borough}
            </Badge>
          )}
          {lead.watchlistItem?.pipelineStage && (
            <PipelineStageDot stage={lead.watchlistItem.pipelineStage} />
          )}
          <span className="text-[10px] text-white/30 ml-auto">
            {formatRelativeTime(lead.updatedAt)}
          </span>
        </div>

        <LeadBadgeRow lead={lead} />

        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
          {lead.hasWebsite ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1 text-[11px]"
              onClick={() => onContentCheck(lead)}
              disabled={contentCheckLoading}
            >
              {contentCheckLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ScanSearch className="w-3 h-3" />
              )}
              Check
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1 text-[11px]"
              onClick={() => onWebsiteSearch(lead)}
              disabled={websiteSearchLoading}
            >
              {websiteSearchLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Globe className="w-3 h-3" />
              )}
              Find site
            </Button>
          )}
          {isWatchlisted ? (
            <Link href={`/app/deals?lead=${lead.id}`}>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 gap-1 text-[11px] text-[hsl(38_70%_52%)] hover:text-[hsl(38_70%_52%)]"
              >
                <BookmarkCheck className="w-3 h-3" />
                Open Deal
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 gap-1 text-[11px]"
              onClick={() => onShortlist(lead)}
            >
              <Bookmark className="w-3 h-3" />
              Shortlist
            </Button>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`}>
              <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-[11px]">
                <Phone className="w-3 h-3" />
                Call
              </Button>
            </a>
          )}
          {lead.googleMapsUri && (
            <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-[11px]">
                <MapPin className="w-3 h-3" />
                Map
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
