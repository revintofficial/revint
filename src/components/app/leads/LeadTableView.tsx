"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { LeadRow } from "@/components/app/leads/LeadRow";
import type {
  LeadListItem,
  Pagination,
} from "@/components/app/leads/useLeadsQuery";

export interface LeadTableViewProps {
  leads: LeadListItem[];
  loading: boolean;
  pagination: Pagination;
  density: "comfortable" | "compact";
  watchlistLeadIds: Set<string>;
  selectedIds: Set<string>;
  contentCheckLeadId: string | null;
  contentCheckLoading: boolean;
  websiteSearchLeadId: string | null;
  websiteSearchLoading: boolean;
  onContentCheck: (lead: LeadListItem) => void;
  onWebsiteSearch: (lead: LeadListItem) => void;
  onShortlist: (lead: LeadListItem) => void;
  onCallStatusChange: (lead: LeadListItem) => void;
  onToggleSelect: (leadId: string) => void;
  onTogglePageSelect: () => void;
  onPageChange: (page: number) => void;
}

export function LeadTableView({
  leads,
  loading,
  pagination,
  density,
  watchlistLeadIds,
  selectedIds,
  contentCheckLeadId,
  contentCheckLoading,
  websiteSearchLeadId,
  websiteSearchLoading,
  onContentCheck,
  onWebsiteSearch,
  onShortlist,
  onCallStatusChange,
  onToggleSelect,
  onTogglePageSelect,
  onPageChange,
}: LeadTableViewProps) {
  const allSelectedOnPage =
    leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelectedOnPage =
    !allSelectedOnPage && leads.some((l) => selectedIds.has(l.id));

  return (
    <Card className="overflow-hidden hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="text-left p-3 w-10">
                <Checkbox
                  checked={
                    allSelectedOnPage
                      ? true
                      : someSelectedOnPage
                      ? "indeterminate"
                      : false
                  }
                  onCheckedChange={onTogglePageSelect}
                  aria-label="Select all on page"
                />
              </th>
              <th className="text-left p-3 text-[13px] font-medium text-white/50">
                Business
              </th>
              <th className="text-left p-3 text-[13px] font-medium text-white/50">
                Website
              </th>
              <th className="text-left p-3 text-[13px] font-medium text-white/50">
                Score
              </th>
              <th className="text-left p-3 text-[13px] font-medium text-white/50">
                Status
              </th>
              <th className="text-left p-3 text-[13px] font-medium text-white/50">
                Activity
              </th>
              <th className="text-left p-3 text-[13px] font-medium text-white/50">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 text-(--revint-500) animate-spin" />
                    <p className="text-sm text-white/30">Loading...</p>
                  </div>
                  <div className="mt-6 space-y-2 max-w-3xl mx-auto">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12">
                  <div className="flex flex-col items-center justify-center gap-3">
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
                </td>
              </tr>
            ) : (
              leads.map((lead, index) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  density={density}
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
                  onCallStatusChange={onCallStatusChange}
                  onToggleSelect={onToggleSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-t border-white/5">
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
    </Card>
  );
}
