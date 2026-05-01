"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Eye,
  MoreVertical,
  Phone,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadCard } from "@/components/app/leads/LeadCard";
import type { LeadListItem } from "@/components/app/leads/useLeadsQuery";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Phone/tablet leads list with native interactions:
 *   - Pull to refresh
 *   - Swipe right = mark contacted (constructive, green)
 *   - Swipe left = add to shortlist or archive (destructive paths)
 *   - Long-press = action sheet (Open, Mark contacted, Shortlist, Archive)
 *   - Tap card body = open lead detail (Link inside LeadCard)
 *
 * On tablet (768–1023px) we keep the same touch interactions but render two
 * cards per row for better information density.
 */
export interface MobileLeadListProps {
  leads: LeadListItem[];
  loading: boolean;
  watchlistLeadIds: Set<string>;
  selectedIds: Set<string>;
  contentCheckLeadId: string | null;
  contentCheckLoading: boolean;
  websiteSearchLeadId: string | null;
  websiteSearchLoading: boolean;
  onRefresh: () => void | Promise<unknown>;
  onContentCheck: (lead: LeadListItem) => void;
  onWebsiteSearch: (lead: LeadListItem) => void;
  onShortlist: (lead: LeadListItem) => void;
  onToggleSelect: (leadId: string) => void;
  onCallStatusChange?: (lead: LeadListItem) => void;
}

export function MobileLeadList({
  leads,
  loading,
  watchlistLeadIds,
  selectedIds,
  contentCheckLeadId,
  contentCheckLoading,
  websiteSearchLeadId,
  websiteSearchLoading,
  onRefresh,
  onContentCheck,
  onWebsiteSearch,
  onShortlist,
  onToggleSelect,
  onCallStatusChange,
}: MobileLeadListProps) {
  const router = useRouter();
  const [longPressed, setLongPressed] = React.useState<LeadListItem | null>(null);

  const markContacted = React.useCallback(
    async (lead: LeadListItem) => {
      try {
        const res = await fetch(`/api/leads/${lead.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONTACTED" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        triggerHaptic("success");
        toast.success(`Marked ${lead.businessName} as contacted`);
        onCallStatusChange?.(lead);
      } catch (err) {
        triggerHaptic("error");
        toast.error("Couldn't update status");
        console.error(err);
      }
    },
    [onCallStatusChange],
  );

  const archiveLead = React.useCallback(async (lead: LeadListItem) => {
    try {
      const res = await fetch(`/api/leads/${lead.id}/archive`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      triggerHaptic("success");
      toast.success(`Archived ${lead.businessName}`);
    } catch (err) {
      // The /archive endpoint may not exist yet; fall back to clear feedback
      triggerHaptic("warning");
      toast.error("Archive coming soon — use the lead detail to manage status");
      console.error(err);
    }
  }, []);

  const buildActionSheetItems = React.useCallback(
    (lead: LeadListItem): ActionSheetItem[] => [
      {
        id: "open",
        label: "Open lead",
        icon: Eye,
        onSelect: () => router.push(`/app/leads/${lead.id}`),
      },
      {
        id: "contacted",
        label: "Mark as contacted",
        icon: CheckCircle2,
        onSelect: () => markContacted(lead),
      },
      {
        id: "shortlist",
        label: watchlistLeadIds.has(lead.id)
          ? "In shortlist"
          : "Add to shortlist",
        icon: Bookmark,
        disabled: watchlistLeadIds.has(lead.id),
        onSelect: () => onShortlist(lead),
      },
      {
        id: "pitch",
        label: "Generate pitch",
        icon: Sparkles,
        onSelect: () => router.push(`/app/leads/${lead.id}?tab=workers`),
      },
      ...(lead.phone
        ? [
            {
              id: "call",
              label: `Call ${lead.phone}`,
              icon: Phone,
              onSelect: () => {
                window.location.href = `tel:${lead.phone}`;
                markContacted(lead);
              },
            } satisfies ActionSheetItem,
          ]
        : []),
      ...(lead.websiteUrl
        ? [
            {
              id: "website",
              label: "Open website",
              icon: ExternalLink,
              onSelect: () => {
                window.open(lead.websiteUrl ?? "", "_blank", "noopener");
              },
            } satisfies ActionSheetItem,
          ]
        : []),
      {
        id: "archive",
        label: "Archive",
        icon: Trash2,
        destructive: true,
        onSelect: () => archiveLead(lead),
      },
    ],
    [archiveLead, markContacted, onShortlist, router, watchlistLeadIds],
  );

  if (loading && leads.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 sm:p-10 flex flex-col items-center justify-center gap-3 text-center">
          <Users
            className="w-10 h-10"
            style={{ color: "var(--leadac-muted)" }}
            aria-hidden="true"
          />
          <p
            className="font-medium"
            style={{
              color: "var(--leadac-text-1)",
              fontSize: "var(--text-callout)",
            }}
          >
            No leads match these filters
          </p>
          <p
            style={{
              color: "var(--leadac-text-3)",
              fontSize: "var(--text-footnote)",
            }}
          >
            Try clearing presets or running discovery for more leads.
          </p>
          <Link href="/app/discovery" className="mt-2">
            <Button size="sm">Go to Discovery</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => onRefresh()}>
      <ul role="list" className="space-y-3">
        
        {leads.map((lead, index) => (
          <li key={lead.id}>
            <SwipeableRow
              className="rounded-2xl"
              leadingAction={{
                label: "Contacted",
                icon: CheckCircle2,
                color: "var(--leadac-success)",
                onSelect: () => markContacted(lead),
              }}
              trailingAction={
                watchlistLeadIds.has(lead.id)
                  ? {
                      label: "Archive",
                      icon: Archive,
                      color: "var(--leadac-error)",
                      onSelect: () => archiveLead(lead),
                    }
                  : {
                      label: "Shortlist",
                      icon: Bookmark,
                      color: "var(--leadac-warning)",
                      textColor: "white",
                      onSelect: () => onShortlist(lead),
                    }
              }
              onLongPress={() => setLongPressed(lead)}
            >
              <div className="relative">
                <LeadCard
                  lead={lead}
                  index={index}
                  isWatchlisted={watchlistLeadIds.has(lead.id)}
                  isSelected={selectedIds.has(lead.id)}
                  contentCheckLoading={
                    contentCheckLoading && contentCheckLeadId === lead.id
                  }
                  websiteSearchLoading={
                    websiteSearchLoading && websiteSearchLeadId === lead.id
                  }
                  onContentCheck={onContentCheck}
                  onWebsiteSearch={onWebsiteSearch}
                  onShortlist={onShortlist}
                  onToggleSelect={onToggleSelect}
                />
                <button
                  type="button"
                  aria-label={`More actions for ${lead.businessName}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerHaptic("light");
                    setLongPressed(lead);
                  }}
                  className="absolute top-2 right-2 touch-target rounded-lg hover:bg-white/10 active:bg-white/15 focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
                  style={{ color: "var(--leadac-text-2)" }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </SwipeableRow>
          </li>
        ))}
      </ul>

      <ActionSheet
        open={!!longPressed}
        onOpenChange={(open) => !open && setLongPressed(null)}
        title={longPressed?.businessName}
        description={longPressed?.formattedAddress}
        items={longPressed ? buildActionSheetItems(longPressed) : []}
      />
    </PullToRefresh>
  );
}
