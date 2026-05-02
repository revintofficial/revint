"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Phase 1 — Today's Queue / My Leads / All / Archive top-level "view"
 * tabs. Drives a different default filter combo PLUS a different
 * sort order (Today's Queue sorts on `nextActionDueAt asc + salesConfidence desc`).
 */
export type LeadQueue = "today" | "mine" | "all" | "archive";

/**
 * Filter shape used by the leads list. Multi-valued filters are arrays
 * (we serialize to comma-joined strings on the wire). Empty / "all"
 * values are stripped before the request goes out so the URL stays
 * clean.
 */
export interface LeadsFilters {
  /**
   * Phase 1 top-level tab. "today" = leads with nextActionDueAt
   * <= now() OR no nextActionDueAt + assignedToUserId = current user;
   * "mine" = all assignedToUserId = current user; "all" = workspace-wide
   * (legacy default); "archive" = archivedAt IS NOT NULL.
   */
  queue: LeadQueue;
  search: string;
  borough: string; // "all" or a London borough name
  hasWebsite: "all" | "true" | "false";
  statuses: string[]; // outreach statuses (NEW, CONTACTED, ...) plus "unscored"
  niche: string; // "all" or parent slug
  subNiche: string; // "all" or sub-niche slug
  minScore: number; // 0..100, 0 = no min
  maxScore: number; // 0..100, 100 = no max
  // Google review rating bounds. null = unset on that side.
  minRating: number | null;
  maxRating: number | null;
  // ISO timestamp; only leads with createdAt >= this are returned.
  // null = no lower bound.
  createdSince: string | null;
  sortBy: string; // "createdAt" | "rating" | "reviewCount" | "businessName" | "score" | "nearest" | "queue"
  page: number;
  // GPS-based filters (only set when "near me" toggle is on)
  userLat: number | null;
  userLng: number | null;
  withinMiles: number | null;
}

/**
 * Default sort direction per `sortBy`. The UI labels imply a specific
 * direction (e.g. "Name (A→Z)" must be ascending; "Score (high → low)"
 * must be descending) so the wire-level `sortOrder` is derived from
 * `sortBy` rather than hardcoded.
 */
function defaultSortOrder(sortBy: string): "asc" | "desc" {
  if (sortBy === "businessName") return "asc";
  // rating / reviewCount / score / createdAt / confidence / nearest:
  // "highest / newest / nearest first" all map to desc.
  return "desc";
}

export const DEFAULT_LEADS_FILTERS: LeadsFilters = {
  queue: "today",
  search: "",
  borough: "all",
  hasWebsite: "all",
  statuses: [],
  niche: "all",
  subNiche: "all",
  minScore: 0,
  maxScore: 100,
  minRating: null,
  maxRating: null,
  createdSince: null,
  // Phase 1 — Today's Queue is the default view; "queue" sortBy means
  // "next action ASC, sales confidence DESC". Reps see leads they
  // need to act on TODAY at the top.
  sortBy: "queue",
  page: 1,
  userLat: null,
  userLng: null,
  withinMiles: null,
};

export interface LeadListItem {
  id: string;
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUri: string | null;
  crawlStatus: string;
  analyzeStatus: string;
  nicheSlug: string | null;
  subNicheSlug: string | null;
  subNicheSource: "AUTO" | "MANUAL" | null;
  subNicheConfidence: number | null;
  // Phase 1 SDR fields surfaced on the row.
  salesConfidence: number | null;
  lastContactedAt: string | null;
  nextActionDueAt: string | null;
  sequenceStep: number;
  lastDisposition: string | null;
  assignedToUserId: string | null;
  dnc: boolean;
  archivedAt: string | null;
  snoozeUntil: string | null;
  updatedAt: string;
  createdAt: string;
  sourceLat: number | null;
  sourceLng: number | null;
  salesOpportunity: {
    opportunityScore: number;
    suggestedOffer: string;
    status: string;
    reasonCodes: string[];
    recommendedPackageId: string | null;
    recommendedPackageName: string | null;
    recommendedPackagePriceLabel: string | null;
    personalizedFirstMessage: string | null;
  } | null;
  watchlistItem: {
    id: string;
    pipelineStage: string | null;
  } | null;
  distanceMiles?: number | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildLeadsQuery(filters: LeadsFilters, limit: number): URLSearchParams {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(limit),
    sortBy: filters.sortBy,
    sortOrder: defaultSortOrder(filters.sortBy),
    queue: filters.queue,
  });
  if (filters.borough !== "all") params.set("borough", filters.borough);
  if (filters.hasWebsite !== "all") params.set("hasWebsite", filters.hasWebsite);
  if (filters.search) params.set("search", filters.search);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.niche !== "all") params.set("niche", filters.niche);
  if (filters.subNiche !== "all") params.set("subNiche", filters.subNiche);
  if (filters.minScore > 0) params.set("minScore", String(filters.minScore));
  if (filters.maxScore < 100) params.set("maxScore", String(filters.maxScore));
  if (filters.minRating != null) params.set("minRating", String(filters.minRating));
  if (filters.maxRating != null) params.set("maxRating", String(filters.maxRating));
  if (filters.createdSince) params.set("createdSince", filters.createdSince);
  if (filters.userLat != null && filters.userLng != null) {
    params.set("userLat", String(filters.userLat));
    params.set("userLng", String(filters.userLng));
  }
  if (filters.withinMiles != null) params.set("withinMiles", String(filters.withinMiles));
  return params;
}

interface UseLeadsQueryResult {
  leads: LeadListItem[];
  pagination: Pagination;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * SWR-style data hook. Cancels in-flight requests on filter change.
 * Returns a stable `refetch` so callers can re-pull after a mutation
 * (e.g. shortlist toggle, status update).
 */
export function useLeadsQuery(filters: LeadsFilters, limit = 20): UseLeadsQueryResult {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: filters.page,
    limit,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLeads = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = buildLeadsQuery(filters, limit);
      const res = await fetch(`/api/leads?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setLeads(data.leads || []);
      setPagination(data.pagination || { page: filters.page, limit, total: 0, totalPages: 0 });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [filters, limit]);

  useEffect(() => {
    fetchLeads();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchLeads]);

  return { leads, pagination, loading, error, refetch: fetchLeads };
}
