"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LONDON_BOROUGHS } from "@/types";

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
    <Suspense fallback={<div className="p-8 text-center text-zinc-400">Yukleniyor...</div>}>
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
    router.replace(qs ? `/leads?${qs}` : "/leads", { scroll: false });
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
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Leads</h2>
          <p className="text-zinc-500 mt-1 text-sm">
            {pagination.total} lead bulundu
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-initial"
            onClick={() => {
              fetch("/api/crawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ crawlAll: true }),
              }).then(() => fetchLeads());
            }}
          >
            Crawl Baslat
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-initial"
            onClick={() => {
              fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ analyzeAll: true }),
              }).then(() => fetchLeads());
            }}
          >
            AI Analiz
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <input
                type="text"
                placeholder="Isletme ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
            <div>
              <Select value={borough} onValueChange={setBorough}>
                <SelectTrigger>
                  <SelectValue placeholder="Borough" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tum Borough&apos;lar</SelectItem>
                  {LONDON_BOROUGHS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={hasWebsite} onValueChange={setHasWebsite}>
                <SelectTrigger>
                  <SelectValue placeholder="Website" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tumu</SelectItem>
                  <SelectItem value="true">Website Var</SelectItem>
                  <SelectItem value="false">Website Yok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sirala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Tarih</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="reviewCount">Yorum Sayisi</SelectItem>
                  <SelectItem value="businessName">Isim</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left p-3 font-medium">Isletme</th>
                <th className="text-left p-3 font-medium">Borough</th>
                <th className="text-left p-3 font-medium">Rating</th>
                <th className="text-left p-3 font-medium">Website</th>
                <th className="text-left p-3 font-medium">Skor</th>
                <th className="text-left p-3 font-medium">Teklif</th>
                <th className="text-left p-3 font-medium">Durum</th>
                <th className="text-left p-3 font-medium">Islem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    Yukleniyor...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    Henuz lead yok. Discovery sayfasindan baslayin.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                  >
                    <td className="p-3">
                      <a
                        href={`/leads/${lead.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {lead.businessName}
                      </a>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">
                        {lead.formattedAddress}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{lead.borough || "?"}</Badge>
                    </td>
                    <td className="p-3">
                      {lead.rating ? (
                        <span>
                          {lead.rating.toFixed(1)}{" "}
                          <span className="text-zinc-400">
                            ({lead.reviewCount})
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.hasWebsite ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="success">Var</Badge>
                          <button
                            onClick={(e) => { e.preventDefault(); runContentCheck(lead); }}
                            disabled={contentCheckLoading && contentCheckLeadId === lead.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                            title="Website icerik kontrolu"
                          >
                            {contentCheckLoading && contentCheckLeadId === lead.id ? (
                              <div className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-indigo-300 border-t-indigo-600" />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>
                            )}
                            Kontrol
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="destructive">Yok</Badge>
                          <button
                            onClick={(e) => { e.preventDefault(); runWebsiteSearch(lead); }}
                            disabled={websiteSearchLoading && websiteSearchLeadId === lead.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
                            title="Internette website ara"
                          >
                            {websiteSearchLoading && websiteSearchLeadId === lead.id ? (
                              <div className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-orange-300 border-t-orange-600" />
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            )}
                            Ara
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.salesOpportunity ? (
                        <ScoreBadge
                          score={lead.salesOpportunity.opportunityScore}
                        />
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.salesOpportunity ? (
                        <Badge variant="secondary">
                          {lead.salesOpportunity.suggestedOffer}
                        </Badge>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.salesOpportunity ? (
                        <StatusBadge
                          status={lead.salesOpportunity.status}
                        />
                      ) : (
                        <Badge variant="outline">Bekliyor</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {watchlistLeadIds.has(lead.id) ? (
                          <a href="/watchlist">
                            <Button size="sm" variant="secondary" className="text-amber-600">
                              ★ Listede
                            </Button>
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWatchlistDialog(lead)}
                          >
                            ☆ Watchlist
                          </Button>
                        )}
                        {lead.salesOpportunity?.status === "NEW" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateStatus(lead.id, "CONTACTED")
                            }
                          >
                            Iletisim
                          </Button>
                        )}
                        {lead.googleMapsUri && (
                          <a
                            href={lead.googleMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              Maps
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-t border-zinc-200">
            <p className="text-sm text-zinc-500 text-center sm:text-left">
              Sayfa {pagination.page} / {pagination.totalPages}
            </p>
            <div className="flex gap-2 justify-center sm:justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
              >
                Onceki
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
      </div>

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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
              Icerik Kontrol Sonucu
            </DialogTitle>
            <DialogDescription>
              {contentCheckResult?.url || "Website analiz ediliyor..."}
            </DialogDescription>
          </DialogHeader>
          {contentCheckLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-600" />
              <p className="text-sm text-zinc-400 mt-3">Website analiz ediliyor...</p>
            </div>
          ) : contentCheckResult ? (
            <ContentCheckPanel result={contentCheckResult} />
          ) : null}
        </DialogContent>
      </Dialog>

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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Website Arama Sonucu
            </DialogTitle>
            <DialogDescription>
              {websiteSearchResult?.businessName
                ? `"${websiteSearchResult.businessName}" icin internet taramasi`
                : "Internette website araniyor..."}
            </DialogDescription>
          </DialogHeader>
          {websiteSearchLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-orange-200 border-t-orange-600" />
              <p className="text-sm text-zinc-400 mt-3">Internette website araniyor...</p>
              <p className="text-xs text-zinc-300 mt-1">Domain tahmini + Google arama yapiliyor</p>
            </div>
          ) : websiteSearchResult ? (
            <WebsiteSearchPanel result={websiteSearchResult} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!watchlistDialogLead}
        onOpenChange={(open) => !open && setWatchlistDialogLead(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Watchlist&apos;e Ekle</DialogTitle>
            <DialogDescription>
              {watchlistDialogLead?.businessName} icin bilgileri girin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Yapilan Site URL
              </label>
              <input
                type="url"
                value={watchlistSiteUrl}
                onChange={(e) => setWatchlistSiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Notlar
              </label>
              <textarea
                value={watchlistNotes}
                onChange={(e) => setWatchlistNotes(e.target.value)}
                placeholder="Notlarinizi yazin..."
                rows={3}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWatchlistDialogLead(null)}>
                Iptal
              </Button>
              <Button onClick={handleAddToWatchlist} disabled={watchlistSaving}>
                {watchlistSaving ? "Ekleniyor..." : "Ekle"}
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
    placeholder: { label: "Placeholder / Bos Site", color: "text-red-600", bg: "bg-red-50 border-red-200" },
    basic: { label: "Temel Duzey Site", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    developed: { label: "Gelistirilmis Site", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    unreachable: { label: "Erisilemedi", color: "text-zinc-600", bg: "bg-zinc-50 border-zinc-200" },
  };

  const config = verdictConfig[result.verdict] || verdictConfig.unreachable;

  return (
    <div className="space-y-4 pt-2">
      <div className={`rounded-lg border p-4 ${config.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`font-semibold text-lg ${config.color}`}>{config.label}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-zinc-500">Skor:</span>
            <span className={`text-lg font-bold ${result.score >= 65 ? "text-emerald-600" : result.score >= 35 ? "text-amber-600" : "text-red-600"}`}>
              {result.score}
            </span>
            <span className="text-xs text-zinc-400">/100</span>
          </div>
        </div>
        <p className="text-sm text-zinc-700 leading-relaxed">{result.summary}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-md bg-zinc-50 p-2 text-center">
          <p className="text-sm font-bold text-zinc-800">{result.wordCount}</p>
          <p className="text-[10px] text-zinc-500">Kelime</p>
        </div>
        <div className="rounded-md bg-zinc-50 p-2 text-center">
          <p className="text-sm font-bold text-zinc-800">{result.imageCount}</p>
          <p className="text-[10px] text-zinc-500">Gorsel</p>
        </div>
        <div className="rounded-md bg-zinc-50 p-2 text-center">
          <p className="text-sm font-bold text-zinc-800">{result.internalLinkCount}</p>
          <p className="text-[10px] text-zinc-500">Link</p>
        </div>
        <div className="rounded-md bg-zinc-50 p-2 text-center">
          <p className="text-sm font-bold text-zinc-800">{(result.htmlSize / 1024).toFixed(0)}</p>
          <p className="text-[10px] text-zinc-500">KB</p>
        </div>
      </div>

      {result.builderDetected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span className="text-sm text-blue-700"><strong>{result.builderDetected}</strong> ile olusturulmus</span>
        </div>
      )}

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Detayli Analiz</p>
        {result.signals.map((signal, i) => (
          <div key={i} className="flex items-center justify-between py-1 border-b border-zinc-100 last:border-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${signal.status === "good" ? "bg-emerald-500" : signal.status === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
              <span className="text-xs font-medium text-zinc-700">{signal.label}</span>
            </div>
            <span className="text-xs text-zinc-500 text-right max-w-[55%] truncate">{signal.detail}</span>
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              <p className="font-semibold text-emerald-700">
                {result.websites.length} website bulundu!
              </p>
            </div>
            <p className="text-sm text-emerald-600">
              Google Places API&apos;da kayitli olmayan ama internette bulunan website(ler) tespit edildi. Ilk bulunan site lead&apos;e otomatik kaydedildi.
            </p>
          </div>

          <div className="space-y-2">
            {result.websites.map((website, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline break-all"
                    >
                      {website.url}
                    </a>
                    {website.title && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{website.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      website.source === "google_search"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-purple-50 text-purple-700 border border-purple-200"
                    }`}>
                      {website.source === "google_search" ? "Google" : "Domain"}
                    </span>
                    {i === 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Kaydedildi
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>
            <p className="font-semibold text-zinc-600">Website bulunamadi</p>
          </div>
          <p className="text-sm text-zinc-500">
            {result.searchedCount} adres tarandi ancak bu isletme icin aktif bir website tespit edilemedi. Isletmenin gercekten websitesi olmayabilir - bu yeni site teklifi icin ideal bir firsat.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-zinc-400">
          {result.searchedCount} adres tarandi
        </p>
        <p className="text-xs text-zinc-400">
          Domain tahmini + Google arama
        </p>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 60 ? "success" : score >= 35 ? "warning" : "secondary";
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
  return <Badge variant={variantMap[status] || "secondary"}>{status}</Badge>;
}
