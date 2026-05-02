"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bookmark,
  Bot,
  CircleCheck,
  CircleX,
  Filter,
  Globe,
  Info,
  Loader2,
  Plus,
  ScanSearch,
  Users,
} from "lucide-react";
import {
  DEFAULT_LEADS_FILTERS,
  type LeadListItem,
  type LeadsFilters,
  useLeadsQuery,
} from "@/components/app/leads/useLeadsQuery";
import { LeadFiltersBar } from "@/components/app/leads/LeadFiltersBar";
import { LeadTableView } from "@/components/app/leads/LeadTableView";
import { LeadCardsGrid } from "@/components/app/leads/LeadCardsGrid";
import { LeadActionBar } from "@/components/app/leads/LeadActionBar";
import { LiveProcessingStrip } from "@/components/app/leads/LiveProcessingStrip";
import { MobileLeadList } from "@/components/app/leads/MobileLeadList";
import { BottomSheet, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import {
  type LeadsView,
  parseLeadsView,
} from "@/components/app/leads/useLeadsView";

// Map + Kanban are heavy (Leaflet ~40KB, dnd-kit) and only loaded
// when the user actually switches into those views. SSR is disabled
// because Leaflet hits `window` on import.
const LeadMapMulti = dynamic(
  () => import("@/components/app/leads/LeadMapMulti"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[600px] rounded-2xl" />,
  },
);
const LeadKanbanLite = dynamic(
  () => import("@/components/app/leads/LeadKanbanLite"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[600px] rounded-2xl" />,
  },
);

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

const STORAGE_KEY = "leads-filters-v2";
const DENSITY_KEY = "leads-density";

function getSavedState<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Read URL search params + sessionStorage and produce the initial
 * LeadsFilters used on first render. URL wins when present so deep
 * links are honoured.
 */
function buildInitialFilters(
  searchParams: URLSearchParams,
  saved: Partial<LeadsFilters> | null,
): LeadsFilters {
  const urlNonEmpty = Array.from(searchParams.entries()).length > 0;
  const source: Partial<LeadsFilters> = urlNonEmpty
    ? {
        search: searchParams.get("search") ?? "",
        borough: searchParams.get("borough") ?? "all",
        hasWebsite:
          (searchParams.get("hasWebsite") as "all" | "true" | "false") ?? "all",
        statuses: (searchParams.get("status") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        niche: searchParams.get("niche") ?? "all",
        subNiche: searchParams.get("subNiche") ?? "all",
        minScore: parseInt(searchParams.get("minScore") ?? "0") || 0,
        maxScore: parseInt(searchParams.get("maxScore") ?? "100") || 100,
        minRating: searchParams.has("minRating")
          ? parseFloat(searchParams.get("minRating") ?? "")
          : null,
        maxRating: searchParams.has("maxRating")
          ? parseFloat(searchParams.get("maxRating") ?? "")
          : null,
        createdSince: searchParams.get("createdSince"),
        sortBy: searchParams.get("sortBy") ?? "createdAt",
        page: parseInt(searchParams.get("page") ?? "1") || 1,
        userLat: searchParams.has("userLat")
          ? parseFloat(searchParams.get("userLat") ?? "")
          : null,
        userLng: searchParams.has("userLng")
          ? parseFloat(searchParams.get("userLng") ?? "")
          : null,
        withinMiles: searchParams.has("withinMiles")
          ? parseFloat(searchParams.get("withinMiles") ?? "")
          : null,
      }
    : saved ?? {};
  return { ...DEFAULT_LEADS_FILTERS, ...source };
}

function filtersToUrlParams(
  filters: LeadsFilters,
  view: LeadsView,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.borough !== "all") params.set("borough", filters.borough);
  if (filters.hasWebsite !== "all") params.set("hasWebsite", filters.hasWebsite);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.niche !== "all") params.set("niche", filters.niche);
  if (filters.subNiche !== "all") params.set("subNiche", filters.subNiche);
  if (filters.minScore > 0) params.set("minScore", String(filters.minScore));
  if (filters.maxScore < 100) params.set("maxScore", String(filters.maxScore));
  if (filters.minRating != null) params.set("minRating", String(filters.minRating));
  if (filters.maxRating != null) params.set("maxRating", String(filters.maxRating));
  if (filters.createdSince) params.set("createdSince", filters.createdSince);
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.userLat != null && filters.userLng != null) {
    params.set("userLat", String(filters.userLat));
    params.set("userLng", String(filters.userLng));
  }
  if (filters.withinMiles != null)
    params.set("withinMiles", String(filters.withinMiles));
  if (view !== "table") params.set("view", view);
  return params;
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

  // M18 fix - hydration mismatch. The previous initializer read
  // localStorage synchronously inside useState/useRef, which means
  // the SSR-rendered HTML (no localStorage) and the first client
  // render (reading saved filter state) produced different DOM
  // trees. The hydration warning aside, the briefly-wrong filter
  // state caused a duplicate /api/leads request right after mount.
  // The fix uses URL-only initial state (which IS available on the
  // server via searchParams) and rehydrates from localStorage in a
  // useEffect that runs only on the client after first paint.
  const initialFilters = useRef(
    buildInitialFilters(
      new URLSearchParams(searchParams?.toString() ?? ""),
      // M18 - intentionally pass null on first render so SSR + first
      // CSR render produce identical state. localStorage rehydrate
      // runs in the effect below.
      null,
    ),
  ).current;

  const [filters, setFilters] = useState<LeadsFilters>(initialFilters);
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );

  // M18 - rehydrate persisted filter / density state after first
  // commit. We only apply it when the URL didn't pin the relevant
  // params (so a shared link wins over local memory).
  useEffect(() => {
    const saved = getSavedState<Partial<LeadsFilters>>(STORAGE_KEY);
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (saved && sp.size === 0) {
      setFilters((prev) => ({ ...prev, ...saved }));
    }
    const savedDensity = getSavedState<"comfortable" | "compact">(DENSITY_KEY);
    if (savedDensity === "compact") {
      setDensity("compact");
    }
    // searchParams is captured once at mount on purpose - we do NOT
    // want to re-read localStorage every time the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [view, setView] = useState<LeadsView>(() =>
    parseLeadsView(searchParams?.get("view")),
  );
  // Map + kanban benefit from a wider page than the default 20.
  const pageSize = view === "map" || view === "kanban" ? 100 : 20;

  // Selection state (lead ids selected for bulk action). Cleared when
  // filters change so a stale set of ids can't leak into the next page
  // load — matches the "selection persist" UX warning in the plan.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { leads, pagination, loading, refetch } = useLeadsQuery(
    filters,
    pageSize,
  );

  const [watchlistLeadIds, setWatchlistLeadIds] = useState<Set<string>>(
    new Set(),
  );
  const [watchlistDialogLead, setWatchlistDialogLead] =
    useState<LeadListItem | null>(null);
  const [watchlistSiteUrl, setWatchlistSiteUrl] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState("");
  const [watchlistSaving, setWatchlistSaving] = useState(false);

  const [contentCheckLeadId, setContentCheckLeadId] = useState<string | null>(
    null,
  );
  const [contentCheckResult, setContentCheckResult] =
    useState<ContentCheckResult | null>(null);
  const [contentCheckLoading, setContentCheckLoading] = useState(false);

  const [websiteSearchLeadId, setWebsiteSearchLeadId] = useState<string | null>(
    null,
  );
  const [websiteSearchResult, setWebsiteSearchResult] =
    useState<WebsiteSearchResult | null>(null);
  const [websiteSearchLoading, setWebsiteSearchLoading] = useState(false);

  const [scanRunning, setScanRunning] = useState(false);
  const [analyzeRunning, setAnalyzeRunning] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const fetchWatchlistIds = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      const ids = new Set<string>(
        (data.items || []).map((item: { leadId: string }) => item.leadId),
      );
      setWatchlistLeadIds(ids);
    } catch {
      // Silent: watchlist sidecar isn't critical for the list to render.
    }
  }, []);

  useEffect(() => {
    fetchWatchlistIds();
  }, [fetchWatchlistIds]);

  // Persist filters + sync URL whenever filters or view change.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore quota errors
    }
    const params = filtersToUrlParams(filters, view);
    const qs = params.toString();
    router.replace(qs ? `/app/leads?${qs}` : "/app/leads", { scroll: false });
  }, [filters, view, router]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DENSITY_KEY, JSON.stringify(density));
    } catch {
      // ignore
    }
  }, [density]);

  // Drop selection when filters or pagination changes — a row that's
  // no longer in the visible set shouldn't continue to count toward
  // bulk actions silently.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    filters.search,
    filters.borough,
    filters.hasWebsite,
    filters.statuses,
    filters.niche,
    filters.subNiche,
    filters.minScore,
    filters.maxScore,
    filters.sortBy,
    filters.page,
  ]);

  const toggleSelect = useCallback((leadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const togglePageSelect = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = leads.length > 0 && leads.every((l) => prev.has(l.id));
      if (allSelected) {
        const next = new Set(prev);
        for (const lead of leads) next.delete(lead.id);
        return next;
      }
      const next = new Set(prev);
      for (const lead of leads) next.add(lead.id);
      return next;
    });
  }, [leads]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const geoActive =
    filters.userLat != null && filters.userLng != null;

  const updateStatus = useCallback(
    async (leadId: string, status: string) => {
      await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      refetch();
    },
    [refetch],
  );

  const runContentCheck = useCallback(async (lead: LeadListItem) => {
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
      if (res.ok) setContentCheckResult(await res.json());
    } catch (err) {
      console.error("Content check failed:", err);
    } finally {
      setContentCheckLoading(false);
    }
  }, []);

  const runWebsiteSearch = useCallback(
    async (lead: LeadListItem) => {
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
          if (data.found) refetch();
        }
      } catch (err) {
        console.error("Website search failed:", err);
      } finally {
        setWebsiteSearchLoading(false);
      }
    },
    [refetch],
  );

  const openWatchlistDialog = useCallback((lead: LeadListItem) => {
    setWatchlistDialogLead(lead);
    setWatchlistSiteUrl("");
    setWatchlistNotes("");
  }, []);

  const handleAddToWatchlist = useCallback(async () => {
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
  }, [
    watchlistDialogLead,
    watchlistSiteUrl,
    watchlistNotes,
    fetchWatchlistIds,
  ]);

  const handleCallStatus = useCallback(
    (lead: LeadListItem) => {
      updateStatus(lead.id, "CONTACTED");
    },
    [updateStatus],
  );

  const onPageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleScanWebsites = useCallback(async () => {
    setScanRunning(true);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawlAll: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const reason =
          body && typeof body === "object" && "error" in body
            ? String(body.error)
            : `HTTP ${res.status}`;
        toast.error(`Scan failed: ${reason}`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data && typeof data.crawled === "number") {
        toast.success(
          `Scan complete: ${data.crawled} succeeded, ${data.failed ?? 0} failed`,
        );
      } else {
        toast.success("Scan complete");
      }
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Scan failed: network error");
    } finally {
      setScanRunning(false);
    }
  }, [refetch]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzeRunning(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyzeAll: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const reason =
          body && typeof body === "object" && "error" in body
            ? String(body.error)
            : `HTTP ${res.status}`;
        toast.error(`Analysis failed: ${reason}`);
        return;
      }
      const data = await res.json().catch(() => null);
      // The endpoint returns 202 + `enqueued` count — the actual AI
      // chain runs asynchronously in the worker process. Make that
      // explicit so the user knows where to look (the live strip
      // above) instead of expecting the data to appear instantly.
      const enqueued =
        data && typeof data.enqueued === "number" ? data.enqueued : null;
      if (enqueued && enqueued > 0) {
        toast.success(
          `Queued ${enqueued} lead${enqueued === 1 ? "" : "s"} for AI analysis — progress shows above the list.`,
        );
      } else {
        toast.success("Nothing pending — every lead already has a sales brief.");
      }
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Analysis failed: network error");
    } finally {
      setAnalyzeRunning(false);
    }
  }, [refetch]);

  const subtitle = useMemo(() => {
    if (loading && pagination.total === 0) return "Loading…";
    return `${pagination.total.toLocaleString()} lead${pagination.total === 1 ? "" : "s"} found`;
  }, [loading, pagination.total]);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Leads"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleScanWebsites}
              disabled={scanRunning}
              title="Pull fresh website signals for any leads waiting in the pipeline"
            >
              {scanRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              Refresh signals
            </Button>
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzeRunning}
              title="Re-run the full AI sales brief on every pending lead"
            >
              {analyzeRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
              Build sales brief
            </Button>
          </div>
        }
      />

      {/* Phase 1 — top-level queue tabs (Today / Mine / All / Archive). */}
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/8 bg-white/3 p-1">
        {(["today", "mine", "all", "archive"] as const).map((q) => {
          const active = filters.queue === q;
          const label =
            q === "today" ? "Today's queue" :
            q === "mine" ? "My leads" :
            q === "all" ? "All leads" :
            "Archive";
          return (
            <button
              key={q}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, queue: q, page: 1 }))}
              className={
                active
                  ? "rounded-xl bg-(--leadac-500) px-3 py-1.5 text-[13px] font-medium text-black"
                  : "rounded-xl px-3 py-1.5 text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/5"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Live heartbeat for background AI work. Shows nothing when the
          workspace is idle; auto-refetches the leads list when the
          last worker drains so brand-new scores show up without a
          manual refresh. */}
      <LiveProcessingStrip onTransitionToIdle={refetch} />

      {/* Mobile: filter trigger row (replaces the inline LeadFiltersBar on phone).
          The full filter UI lives in a bottom sheet to keep the list above the fold. */}
      <div className="md:hidden flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileFiltersOpen(true)}
          className="flex-1 justify-start gap-2"
          aria-label="Open filters"
        >
          <Filter className="w-4 h-4" />
          <span className="flex-1 text-left">Filters</span>
          <span
            className="text-[11px] tabular-nums"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {pagination.total.toLocaleString()}
          </span>
        </Button>
      </div>

      {/* Desktop / tablet: full inline filter bar */}
      <div className="hidden md:block">
        <LeadFiltersBar
          filters={filters}
          setFilters={setFilters}
          density={density}
          setDensity={setDensity}
          view={view}
          setView={setView}
          geoActive={geoActive}
          totalCount={pagination.total}
        />
      </div>

      <LeadActionBar
        selectedIds={Array.from(selectedIds)}
        totalLoaded={leads.length}
        onClear={clearSelection}
        onSelectAll={() => {
          setSelectedIds(new Set(leads.map((l) => l.id)));
        }}
        onDone={refetch}
      />

      {/* Mobile cards — native interactions live in MobileLeadList */}
      <div className="md:hidden">
        <MobileLeadList
          leads={leads}
          loading={loading}
          watchlistLeadIds={watchlistLeadIds}
          selectedIds={selectedIds}
          contentCheckLeadId={contentCheckLeadId}
          contentCheckLoading={contentCheckLoading}
          websiteSearchLeadId={websiteSearchLeadId}
          websiteSearchLoading={websiteSearchLoading}
          onRefresh={refetch}
          onContentCheck={runContentCheck}
          onWebsiteSearch={runWebsiteSearch}
          onShortlist={openWatchlistDialog}
          onToggleSelect={toggleSelect}
          onCallStatusChange={handleCallStatus}
        />
      </div>

      {/* Desktop view switcher */}
      <div className="hidden md:block">
        {view === "table" && (
          <LeadTableView
            leads={leads}
            loading={loading}
            pagination={pagination}
            density={density}
            watchlistLeadIds={watchlistLeadIds}
            selectedIds={selectedIds}
            contentCheckLeadId={contentCheckLeadId}
            contentCheckLoading={contentCheckLoading}
            websiteSearchLeadId={websiteSearchLeadId}
            websiteSearchLoading={websiteSearchLoading}
            onContentCheck={runContentCheck}
            onWebsiteSearch={runWebsiteSearch}
            onShortlist={openWatchlistDialog}
            onCallStatusChange={handleCallStatus}
            onToggleSelect={toggleSelect}
            onTogglePageSelect={togglePageSelect}
            onPageChange={onPageChange}
          />
        )}
        {view === "cards" && (
          <LeadCardsGrid
            leads={leads}
            loading={loading}
            pagination={pagination}
            watchlistLeadIds={watchlistLeadIds}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onShortlist={openWatchlistDialog}
            onPageChange={onPageChange}
          />
        )}
        {view === "map" && (
          <LeadMapMulti
            leads={leads}
            loading={loading}
            watchlistLeadIds={watchlistLeadIds}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
        {view === "kanban" && (
          <LeadKanbanLite
            leads={leads}
            loading={loading}
            onMutate={refetch}
          />
        )}
      </div>

      <Dialog
        open={
          !!(contentCheckLeadId && (contentCheckLoading || contentCheckResult))
        }
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

      <Dialog
        open={
          !!(
            websiteSearchLeadId &&
            (websiteSearchLoading || websiteSearchResult)
          )
        }
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
              <p className="text-sm text-white/30 mt-3">
                Searching for website...
              </p>
              <p className="text-xs text-white/20 mt-1">
                Running domain guess and Google search...
              </p>
            </div>
          ) : websiteSearchResult ? (
            <WebsiteSearchPanel result={websiteSearchResult} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Mobile filter bottom sheet — wraps the existing LeadFiltersBar for parity */}
      <BottomSheet
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        title="Filters"
        description={`${pagination.total.toLocaleString()} lead${pagination.total === 1 ? "" : "s"} match`}
        snap="max"
      >
        <LeadFiltersBar
          filters={filters}
          setFilters={setFilters}
          density={density}
          setDensity={setDensity}
          view={view}
          setView={setView}
          geoActive={geoActive}
          totalCount={pagination.total}
        />
        <BottomSheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              setFilters((prev) => ({
                ...DEFAULT_LEADS_FILTERS,
                queue: prev.queue,
              }));
            }}
          >
            Reset
          </Button>
          <Button onClick={() => setMobileFiltersOpen(false)}>Done</Button>
        </BottomSheetFooter>
      </BottomSheet>

      {/* Phone-only floating action button — go to discovery */}
      <Link
        href="/app/discovery"
        aria-label="Start discovery"
        className="md:hidden fixed right-4 z-40 flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
        style={{
          bottom: "calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 16px)",
          width: "var(--fab-size)",
          height: "var(--fab-size)",
          background:
            "linear-gradient(135deg, var(--leadac-500), var(--leadac-700))",
          color: "white",
          boxShadow:
            "0 8px 24px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.5)",
        }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </Link>

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
              <Button
                variant="outline"
                onClick={() => setWatchlistDialogLead(null)}
              >
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
  const verdictConfig: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    placeholder: {
      label: "Placeholder / Empty Site",
      color: "text-[hsl(4_62%_54%)]",
      bg: "bg-[hsl(4_62%_54%)]/[0.06] border-[hsl(4_62%_54%)]/20",
    },
    basic: {
      label: "Basic Website",
      color: "text-[hsl(38_70%_52%)]",
      bg: "bg-[hsl(38_70%_52%)]/[0.06] border-[hsl(38_70%_52%)]/20",
    },
    developed: {
      label: "Developed Website",
      color: "text-[hsl(152_48%_50%)]",
      bg: "bg-[hsl(152_48%_50%)]/[0.06] border-[hsl(152_48%_50%)]/20",
    },
    unreachable: {
      label: "Unreachable",
      color: "text-white/60",
      bg: "bg-white/5 border-white/10",
    },
  };
  const config = verdictConfig[result.verdict] || verdictConfig.unreachable;

  return (
    <div className="space-y-4 pt-2">
      <div className={`rounded-xl border p-4 ${config.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`font-semibold text-lg ${config.color}`}>
            {config.label}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-white/50">Score:</span>
            <span
              className={`text-lg font-bold ${
                result.score >= 65
                  ? "text-[hsl(152_48%_50%)]"
                  : result.score >= 35
                  ? "text-[hsl(38_70%_52%)]"
                  : "text-[hsl(4_62%_54%)]"
              }`}
            >
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
          <div
            key={stat.label}
            className="rounded-xl bg-white/5 p-2.5 text-center"
          >
            <p className="text-sm font-semibold text-white">{stat.value}</p>
            <p className="text-[10px] text-white/30">{stat.label}</p>
          </div>
        ))}
      </div>

      {result.builderDetected && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-(--leadac-500)/[0.06] border border-(--leadac-500)/20">
          <Info className="w-4 h-4 text-(--leadac-500) shrink-0" />
          <span className="text-sm text-(--leadac-500)">
            Built with <strong>{result.builderDetected}</strong>
          </span>
        </div>
      )}

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        <p className="text-[11px] font-medium text-white/30">
          Detailed Analysis
        </p>
        {result.signals.map((signal, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  signal.status === "good"
                    ? "bg-[hsl(152_48%_50%)]"
                    : signal.status === "warning"
                    ? "bg-[hsl(38_70%_52%)]"
                    : "bg-[hsl(4_62%_54%)]"
                }`}
              />
              <span className="text-xs font-medium text-white/70">
                {signal.label}
              </span>
            </div>
            <span className="text-xs text-white/50 text-right max-w-[55%] truncate">
              {signal.detail}
            </span>
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
              Website(s) found online that were not listed in Google Places.
              The first match was saved to the lead automatically.
            </p>
          </div>

          <div className="space-y-2">
            {result.websites.map((website, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 p-3 hover:bg-white/5 transition-colors"
              >
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
                      <p className="text-xs text-white/50 mt-0.5 truncate">
                        {website.title}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={
                        website.source === "google_search"
                          ? "secondary"
                          : "outline"
                      }
                    >
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
            Searched {result.searchedCount} URLs but could not find an active
            website for this business. The business may truly have no site —
            a strong opportunity for a new website pitch.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-white/30">
          {result.searchedCount} URLs searched
        </p>
        <p className="text-xs text-white/30">Domain guess + Google search</p>
      </div>
    </div>
  );
}
