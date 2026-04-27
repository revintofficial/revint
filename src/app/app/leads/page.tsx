"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DEFAULT_LOCATIONS } from "@/lib/constants";
import { OUTREACH_LABELS, CRAWL_LABELS } from "@/lib/labels";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Bookmark,
  BookmarkCheck,
  Phone,
  Bot,
  Loader2,
  ScanSearch,
  CircleCheck,
  CircleX,
  Info,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
} from "lucide-react";

interface ContentCheckSignal {
  label: string;
  status: "good" | "bad" | "warning";
  detail: string;
}

interface ContentCheckResult {
  url: string;
  reachable: boolean;
  verdict: "placeholder" | "basic" | "developed" | "unreachable";
  score: number;
  signals: ContentCheckSignal[];
  summary: string;
  htmlSize: number;
  wordCount: number;
  imageCount: number;
  internalLinkCount: number;
  hasCustomContent: boolean;
  isParked: boolean;
  isComingSoon: boolean;
  builderDetected: string | null;
}

interface WebsiteSearchFoundItem {
  url: string;
  title: string | null;
  source: "domain_guess" | "google_search";
  reachable: boolean;
}

interface WebsiteSearchResult {
  businessName: string;
  found: boolean;
  websites: WebsiteSearchFoundItem[];
  searchedCount: number;
}

interface Lead {
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
  salesOpportunity: {
    opportunityScore: number;
    suggestedOffer: string;
    status: string;
    reasonCodes: string[];
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STORAGE_KEY = "leads-filters";

function getSavedFilters() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <LeadsPageContent />
    </Suspense>
  );
}

function LeadsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const saved = useRef(getSavedFilters()).current;
  const urlBorough = searchParams.get("borough");
  const urlHasWebsite = searchParams.get("hasWebsite");
  const urlSearch = searchParams.get("search");
  const urlSortBy = searchParams.get("sortBy");
  const urlPage = searchParams.get("page");
  const hasUrlParams = !!(urlBorough || urlHasWebsite || urlSearch || urlSortBy || urlPage);

  const initBorough = hasUrlParams ? (urlBorough || "all") : (saved?.borough || "all");
  const initHasWebsite = hasUrlParams ? (urlHasWebsite || "all") : (saved?.hasWebsite || "all");
  const initSearch = hasUrlParams ? (urlSearch || "") : (saved?.search || "");
  const initSortBy = hasUrlParams ? (urlSortBy || "createdAt") : (saved?.sortBy || "createdAt");
  const initPage = hasUrlParams ? parseInt(urlPage || "1") : (saved?.page || 1);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: initPage,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [borough, setBorough] = useState(initBorough);
  const [hasWebsite, setHasWebsite] = useState(initHasWebsite);
  const [search, setSearch] = useState(initSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initSearch);
  const [sortBy, setSortBy] = useState(initSortBy);
  const [watchlistLeadIds, setWatchlistLeadIds] = useState<Set<string>>(new Set());
  const [watchlistDialogLead, setWatchlistDialogLead] = useState<Lead | null>(null);
  const [watchlistSiteUrl, setWatchlistSiteUrl] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState("");
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [contentCheckLeadId, setContentCheckLeadId] = useState<string | null>(null);
  const [contentCheckResult, setContentCheckResult] = useState<ContentCheckResult | null>(null);
  const [contentCheckLoading, setContentCheckLoading] = useState(false);
  const [websiteSearchLeadId, setWebsiteSearchLeadId] = useState<string | null>(null);
  const [websiteSearchResult, setWebsiteSearchResult] = useState<WebsiteSearchResult | null>(null);
  const [websiteSearchLoading, setWebsiteSearchLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchWatchlistIds = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      const ids = new Set<string>((data.items || []).map((item: { leadId: string }) => item.leadId));
      setWatchlistLeadIds(ids);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchWatchlistIds();
  }, [fetchWatchlistIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, borough, hasWebsite, sortBy]);

  useEffect(() => {
    const state = {
      borough,
      hasWebsite,
      search: debouncedSearch,
      sortBy,
      page: pagination.page,
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}

    const params = new URLSearchParams();
    if (borough !== "all") params.set("borough", borough);
    if (hasWebsite !== "all") params.set("hasWebsite", hasWebsite);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortBy !== "createdAt") params.set("sortBy", sortBy);
    if (pagination.page > 1) params.set("page", pagination.page.toString());
    const qs = params.toString();
    router.replace(qs ? `/app/leads?${qs}` : "/app/leads", { scroll: false });
  }, [debouncedSearch, borough, hasWebsite, sortBy, pagination.page, router]);

  const fetchLeads = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: "20",
      sortBy,
      sortOrder: "desc",
    });
    if (borough !== "all") params.set("borough", borough);
    if (hasWebsite !== "all") params.set("hasWebsite", hasWebsite);
    if (debouncedSearch) params.set("search", debouncedSearch);

    try {
      const res = await fetch(`/api/leads?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error("API error:", res.status);
        return;
      }
      const data = await res.json();
      setLeads(data.leads || []);
      setPagination((prev) => data.pagination || prev);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, borough, hasWebsite, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchLeads();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchLeads]);

  const updateStatus = async (leadId: string, status: string) => {
    await fetch(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchLeads();
  };

  const runContentCheck = async (lead: Lead) => {
    if (!lead.websiteUrl) return;
    setContentCheckLeadId(lead.id);
    setContentCheckLoading(true);
    setContentCheckResult(null);
    try {
      const res = await fetch("/api/website-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lead.websiteUrl }),
      });
      if (res.ok) {
        setContentCheckResult(await res.json());
      }
    } catch (err) {
      console.error("Content check failed:", err);
    } finally {
      setContentCheckLoading(false);
    }
  };

  const runWebsiteSearch = async (lead: Lead) => {
    setWebsiteSearchLeadId(lead.id);
    setWebsiteSearchLoading(true);
    setWebsiteSearchResult(null);
    try {
      const res = await fetch("/api/website-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: lead.businessName,
          address: lead.formattedAddress,
          leadId: lead.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebsiteSearchResult(data);
        if (data.found) {
          fetchLeads();
        }
      }
    } catch (err) {
      console.error("Website search failed:", err);
    } finally {
      setWebsiteSearchLoading(false);
    }
  };

  const openWatchlistDialog = (lead: Lead) => {
    setWatchlistDialogLead(lead);
    setWatchlistSiteUrl("");
    setWatchlistNotes("");
  };

  const handleAddToWatchlist = async () => {
    if (!watchlistDialogLead) return;
    setWatchlistSaving(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: watchlistDialogLead.id,
          siteUrl: watchlistSiteUrl || null,
          notes: watchlistNotes || null,
        }),
      });
      if (res.ok) {
        setWatchlistDialogLead(null);
        fetchWatchlistIds();
      }
    } catch (err) {
      console.error("Failed to add to watchlist:", err);
    } finally {
      setWatchlistSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Leads"
        subtitle={`${pagination.total} leads found`}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch("/api/crawl", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ crawlAll: true }),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    const reason = (body && typeof body === "object" && "error" in body)
                      ? String(body.error)
                      : `HTTP ${res.status}`;
                    toast.error(`Scan failed: ${reason}`);
                    return;
                  }
                  const data = await res.json().catch(() => null);
                  if (data && typeof data.crawled === "number") {
                    toast.success(`Scan complete: ${data.crawled} succeeded, ${data.failed ?? 0} failed`);
                  } else {
                    toast.success("Scan complete");
                  }
                  fetchLeads();
                } catch (err) {
                  console.error(err);
                  toast.error("Scan failed: network error");
                }
              }}
            >
              <Globe className="w-4 h-4" />
              Scan Websites
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ analyzeAll: true }),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    const reason = (body && typeof body === "object" && "error" in body)
                      ? String(body.error)
                      : `HTTP ${res.status}`;
                    toast.error(`Analysis failed: ${reason}`);
                    return;
                  }
                  const data = await res.json().catch(() => null);
                  if (data && typeof data.analyzed === "number") {
                    toast.success(`Analysis complete: ${data.analyzed} succeeded, ${data.failed ?? 0} failed`);
                  } else {
                    toast.success("Analysis complete");
                  }
                  fetchLeads();
                } catch (err) {
                  console.error(err);
                  toast.error("Analysis failed: network error");
                }
              }}
            >
              <Bot className="w-4 h-4" />
              AI Analysis
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                type="text"
                placeholder="Search businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={borough} onValueChange={setBorough}>
              <SelectTrigger>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {DEFAULT_LOCATIONS.map((loc) => (
                  <SelectItem key={loc.name} value={loc.name}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={hasWebsite} onValueChange={setHasWebsite}>
              <SelectTrigger>
                <SelectValue placeholder="Website" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Has Website</SelectItem>
                <SelectItem value="false">No Website</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="reviewCount">Reviews</SelectItem>
                <SelectItem value="businessName">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card>
            <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-(--leadac-500) animate-spin" />
              <p className="text-sm text-white/30">Loading...</p>
            </CardContent>
          </Card>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent className="p-10 flex flex-col items-center justify-center gap-3 text-center">
              <Users className="w-10 h-10 text-white/20" />
              <p className="text-sm font-medium text-white/50">No leads yet</p>
              <p className="text-xs text-white/30">Start by discovering businesses.</p>
              <Link href="/app/discovery">
                <Button size="sm">Go to Discovery</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          leads.map((lead, index) => (
            <Card
              key={lead.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
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
                    <Badge variant="success" className="text-[10px]">Has site</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">No site</Badge>
                  )}
                  {lead.salesOpportunity ? (
                    <StatusBadge status={lead.salesOpportunity.status} />
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Queued</Badge>
                  )}
                  {lead.borough && (
                    <Badge variant="outline" className="text-[10px]">{lead.borough}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                  {lead.hasWebsite ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 gap-1 text-[11px]"
                      onClick={() => runContentCheck(lead)}
                      disabled={contentCheckLoading && contentCheckLeadId === lead.id}
                    >
                      {contentCheckLoading && contentCheckLeadId === lead.id ? (
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
                      onClick={() => runWebsiteSearch(lead)}
                      disabled={websiteSearchLoading && websiteSearchLeadId === lead.id}
                    >
                      {websiteSearchLoading && websiteSearchLeadId === lead.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Globe className="w-3 h-3" />
                      )}
                      Find site
                    </Button>
                  )}
                  {watchlistLeadIds.has(lead.id) ? (
                    <Link href={`/app/deals?lead=${lead.id}`}>
                      <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-[11px] text-[hsl(38_70%_52%)] hover:text-[hsl(38_70%_52%)]">
                        <BookmarkCheck className="w-3 h-3" />
                        Open Deal
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 gap-1 text-[11px]"
                      onClick={() => openWatchlistDialog(lead)}
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
          ))
        )}

        {pagination.totalPages > 1 && !loading && leads.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-xs text-white/50 text-center">
              Page {pagination.page} of {pagination.totalPages}
              <span className="text-white/30 ml-2">({pagination.total} results)</span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="text-left p-3 text-[13px] font-medium text-white/50">Business</th>
                <th className="text-left p-3 text-[13px] font-medium text-white/50">Website</th>
                <th className="text-left p-3 text-[13px] font-medium text-white/50">Score</th>
                <th className="text-left p-3 text-[13px] font-medium text-white/50">Status</th>
                <th className="text-left p-3 text-[13px] font-medium text-white/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 text-(--leadac-500) animate-spin" />
                      <p className="text-sm text-white/30">Loading...</p>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Users className="w-10 h-10 text-white/20" />
                      <p className="text-sm font-medium text-white/50">No leads yet</p>
                      <p className="text-xs text-white/30">Start by discovering businesses.</p>
                      <Link href="/app/discovery">
                        <Button size="sm">Go to Discovery</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead, index) => (
                  <tr
                    key={lead.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="p-3">
                      <Link
                        href={`/app/leads/${lead.id}`}
                        className="font-medium text-white hover:text-(--leadac-500) transition-colors"
                      >
                        {lead.businessName}
                      </Link>
                      <p className="text-xs text-white/30 mt-0.5 truncate max-w-xs">
                        {lead.formattedAddress}
                      </p>
                    </td>
                    <td className="p-3">
                      {lead.hasWebsite ? (
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                          <div className="flex items-center gap-1.5" title="Has website">
                            <CircleCheck className="w-4 h-4 shrink-0 text-[hsl(152_48%_50%)]" aria-hidden />
                            <Badge variant="success">Yes</Badge>
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); runContentCheck(lead); }}
                            disabled={contentCheckLoading && contentCheckLeadId === lead.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border border-(--leadac-500)/20 bg-(--leadac-500)/[0.06] text-(--leadac-500) hover:bg-(--leadac-500)/10 transition-colors disabled:opacity-50 w-fit"
                          >
                            {contentCheckLoading && contentCheckLeadId === lead.id ? (
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
                            onClick={(e) => { e.preventDefault(); runWebsiteSearch(lead); }}
                            disabled={websiteSearchLoading && websiteSearchLeadId === lead.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border border-[hsl(38_70%_52%)]/20 bg-[hsl(38_70%_52%)]/[0.06] text-[hsl(38_70%_52%)] hover:bg-[hsl(38_70%_52%)]/10 transition-colors disabled:opacity-50 w-fit"
                          >
                            {websiteSearchLoading && websiteSearchLeadId === lead.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Globe className="w-2.5 h-2.5" />
                            )}
                            Search
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.salesOpportunity ? (
                        <ScoreBadge score={lead.salesOpportunity.opportunityScore} />
                      ) : (
                        <span className="text-white/20">-</span>
                      )}
                    </td>
                    <td
                      className="p-3"
                      title={`Website scan: ${CRAWL_LABELS[lead.crawlStatus] ?? lead.crawlStatus}`}
                    >
                      {lead.salesOpportunity ? (
                        <StatusBadge status={lead.salesOpportunity.status} />
                      ) : (
                        <Badge variant="outline">Queued</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {watchlistLeadIds.has(lead.id) ? (
                          <Link href={`/app/deals?lead=${lead.id}`}>
                            <Button size="sm" variant="ghost" className="text-[hsl(38_70%_52%)] hover:text-[hsl(38_70%_52%)] h-8 px-2 gap-1">
                              <BookmarkCheck className="w-4 h-4 shrink-0" />
                              Open Deal
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 gap-1"
                            onClick={() => openWatchlistDialog(lead)}
                          >
                            <Bookmark className="w-4 h-4 shrink-0" />
                            Shortlist
                          </Button>
                        )}
                        {lead.salesOpportunity?.status === "NEW" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 gap-1"
                            onClick={() => updateStatus(lead.id, "CONTACTED")}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-t border-white/5">
            <p className="text-sm text-white/50 text-center sm:text-left">
              Page {pagination.page} of {pagination.totalPages}
              <span className="text-white/30 ml-2">({pagination.total} results)</span>
            </p>
            <div className="flex gap-1 justify-center sm:justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Content Check Dialog */}
      <Dialog
        open={!!(contentCheckLeadId && (contentCheckLoading || contentCheckResult))}
        onOpenChange={(open) => {
          if (!open) {
            setContentCheckLeadId(null);
            setContentCheckResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanSearch className="w-5 h-5 text-(--leadac-500)" />
              Content Check Result
            </DialogTitle>
            <DialogDescription>
              {contentCheckResult?.url || "Analyzing website..."}
            </DialogDescription>
          </DialogHeader>
          {contentCheckLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-(--leadac-500) animate-spin" />
              <p className="text-sm text-white/30 mt-3">Analyzing website...</p>
            </div>
          ) : contentCheckResult ? (
            <ContentCheckPanel result={contentCheckResult} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Website Search Dialog */}
      <Dialog
        open={!!(websiteSearchLeadId && (websiteSearchLoading || websiteSearchResult))}
        onOpenChange={(open) => {
          if (!open) {
            setWebsiteSearchLeadId(null);
            setWebsiteSearchResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[hsl(38_70%_52%)]" />
              Website Search Result
            </DialogTitle>
            <DialogDescription>
              {websiteSearchResult?.businessName
                ? `Web search for "${websiteSearchResult.businessName}"`
                : "Searching for website..."}
            </DialogDescription>
          </DialogHeader>
          {websiteSearchLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-[hsl(38_70%_52%)] animate-spin" />
              <p className="text-sm text-white/30 mt-3">Searching for website...</p>
              <p className="text-xs text-white/20 mt-1">Running domain guess and Google search...</p>
            </div>
          ) : websiteSearchResult ? (
            <WebsiteSearchPanel result={websiteSearchResult} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Watchlist Dialog */}
      <Dialog
        open={!!watchlistDialogLead}
        onOpenChange={(open) => !open && setWatchlistDialogLead(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-(--leadac-500)" />
              Add to Shortlist
            </DialogTitle>
            <DialogDescription>
              Enter details for {watchlistDialogLead?.businessName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-[13px] font-medium text-white/50 mb-1.5">
                Built Website URL
              </label>
              <Input
                type="url"
                value={watchlistSiteUrl}
                onChange={(e) => setWatchlistSiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-white/50 mb-1.5">
                Notes
              </label>
              <Textarea
                value={watchlistNotes}
                onChange={(e) => setWatchlistNotes(e.target.value)}
                placeholder="Add your notes..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWatchlistDialogLead(null)}>
                Cancel
              </Button>
              <Button onClick={handleAddToWatchlist} disabled={watchlistSaving}>
                {watchlistSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </span>
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContentCheckPanel({ result }: { result: ContentCheckResult }) {
  const verdictConfig: Record<string, { label: string; color: string; bg: string }> = {
    placeholder: { label: "Placeholder / Empty Site", color: "text-[hsl(4_62%_54%)]", bg: "bg-[hsl(4_62%_54%)]/[0.06] border-[hsl(4_62%_54%)]/20" },
    basic: { label: "Basic Website", color: "text-[hsl(38_70%_52%)]", bg: "bg-[hsl(38_70%_52%)]/[0.06] border-[hsl(38_70%_52%)]/20" },
    developed: { label: "Developed Website", color: "text-[hsl(152_48%_50%)]", bg: "bg-[hsl(152_48%_50%)]/[0.06] border-[hsl(152_48%_50%)]/20" },
    unreachable: { label: "Unreachable", color: "text-white/60", bg: "bg-white/5 border-white/10" },
  };

  const config = verdictConfig[result.verdict] || verdictConfig.unreachable;

  return (
    <div className="space-y-4 pt-2">
      <div className={`rounded-xl border p-4 ${config.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`font-semibold text-lg ${config.color}`}>{config.label}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white/50">Score:</span>
            <span className={`text-lg font-bold ${result.score >= 65 ? "text-[hsl(152_48%_50%)]" : result.score >= 35 ? "text-[hsl(38_70%_52%)]" : "text-[hsl(4_62%_54%)]"}`}>
              {result.score}
            </span>
            <span className="text-xs text-white/30">/100</span>
          </div>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">{result.summary}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { value: result.wordCount, label: "Words" },
          { value: result.imageCount, label: "Images" },
          { value: result.internalLinkCount, label: "Links" },
          { value: `${(result.htmlSize / 1024).toFixed(0)}`, label: "KB" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white/5 p-2.5 text-center">
            <p className="text-sm font-semibold text-white">{stat.value}</p>
            <p className="text-[10px] text-white/30">{stat.label}</p>
          </div>
        ))}
      </div>

      {result.builderDetected && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-(--leadac-500)/[0.06] border border-(--leadac-500)/20">
          <Info className="w-4 h-4 text-(--leadac-500) shrink-0" />
          <span className="text-sm text-(--leadac-500)">Built with <strong>{result.builderDetected}</strong></span>
        </div>
      )}

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        <p className="text-[11px] font-medium text-white/30">Detailed Analysis</p>
        {result.signals.map((signal, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${signal.status === "good" ? "bg-[hsl(152_48%_50%)]" : signal.status === "warning" ? "bg-[hsl(38_70%_52%)]" : "bg-[hsl(4_62%_54%)]"}`} />
              <span className="text-xs font-medium text-white/70">{signal.label}</span>
            </div>
            <span className="text-xs text-white/50 text-right max-w-[55%] truncate">{signal.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebsiteSearchPanel({ result }: { result: WebsiteSearchResult }) {
  return (
    <div className="space-y-4 pt-2">
      {result.found ? (
        <>
          <div className="rounded-xl border border-[hsl(152_48%_50%)]/20 bg-[hsl(152_48%_50%)]/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <CircleCheck className="w-5 h-5 text-[hsl(152_48%_50%)]" />
              <p className="font-semibold text-[hsl(152_48%_50%)]">
                {result.websites.length} website(s) found!
              </p>
            </div>
            <p className="text-sm text-[hsl(152_48%_50%)]">
              Website(s) found online that were not listed in Google Places. The first match was saved to the lead automatically.
            </p>
          </div>

          <div className="space-y-2">
            {result.websites.map((website, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-3 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-(--leadac-500) hover:underline break-all"
                    >
                      {website.url}
                    </a>
                    {website.title && (
                      <p className="text-xs text-white/50 mt-0.5 truncate">{website.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={website.source === "google_search" ? "secondary" : "outline"}>
                      {website.source === "google_search" ? "Google" : "Domain"}
                    </Badge>
                    {i === 0 && <Badge variant="success">Saved</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CircleX className="w-5 h-5 text-white/30" />
            <p className="font-semibold text-white/60">No website found</p>
          </div>
          <p className="text-sm text-white/50">
            Searched {result.searchedCount} URLs but could not find an active website for this business. The business may truly have no site — a strong opportunity for a new website pitch.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-white/30">{result.searchedCount} URLs searched</p>
        <p className="text-xs text-white/30">Domain guess + Google search</p>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 60 ? "success" : score >= 35 ? "warning" : "secondary";
  return <Badge variant={variant}>{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
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
