"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [borough, setBorough] = useState("all");
  const [hasWebsite, setHasWebsite] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [watchlistLeadIds, setWatchlistLeadIds] = useState<Set<string>>(new Set());
  const [watchlistDialogLead, setWatchlistDialogLead] = useState<Lead | null>(null);
  const [watchlistSiteUrl, setWatchlistSiteUrl] = useState("");
  const [watchlistNotes, setWatchlistNotes] = useState("");
  const [watchlistSaving, setWatchlistSaving] = useState(false);
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
          <p className="text-zinc-500 mt-1">
            {pagination.total} lead bulundu
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
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
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <input
                type="text"
                placeholder="Isletme ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
            <div className="w-48">
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
            <div className="w-48">
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
            <div className="w-48">
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
                        <Badge variant="success">Var</Badge>
                      ) : (
                        <Badge variant="destructive">Yok</Badge>
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
          <div className="flex items-center justify-between p-4 border-t border-zinc-200">
            <p className="text-sm text-zinc-500">
              Sayfa {pagination.page} / {pagination.totalPages}
            </p>
            <div className="flex gap-2">
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
