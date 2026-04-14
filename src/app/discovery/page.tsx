"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LONDON_BOROUGHS, SEARCH_QUERIES } from "@/types";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Loader2,
  Zap,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface DiscoveryResult {
  borough: string;
  query: string;
  created: number;
  skipped: number;
}

export default function DiscoveryPage() {
  const [selectedBorough, setSelectedBorough] = useState<string>(LONDON_BOROUGHS[0].name);
  const [selectedQuery, setSelectedQuery] = useState<string>(SEARCH_QUERIES[0]);
  const [customQuery, setCustomQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [singleResult, setSingleResult] = useState<{
    created: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiscovery = async () => {
    setRunning(true);
    setSingleResult(null);
    setError(null);
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQuery: customQuery || selectedQuery,
          boroughName: selectedBorough,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `API hatası: ${res.status}`);
        return;
      }
      if (!data.success) {
        setError(data.error || "Bilinmeyen hata");
        return;
      }
      setSingleResult(data);
      toast.success(`${data.created} yeni lead eklendi!`);
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Bağlantı hatası. Sunucu çalışıyor mu?");
    } finally {
      setRunning(false);
    }
  };

  const runAllDiscovery = async () => {
    setRunningAll(true);
    setResults(null);
    setError(null);
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runAll: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `API hatası: ${res.status}`);
        return;
      }
      setResults(data.results || []);
      const totalCreated = (data.results || []).reduce((s: number, r: DiscoveryResult) => s + r.created, 0);
      toast.success(`Toplu tarama tamamlandı: ${totalCreated} yeni lead!`);
    } catch (err) {
      console.error("Bulk discovery failed:", err);
      setError("Bağlantı hatası. Sunucu çalışıyor mu?");
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Discovery"
        subtitle="Google Places API ile yeni telefon tamircisi lead'leri keşfet"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="group hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Tekli Arama</CardTitle>
                <CardDescription>Belirli bir borough ve sorgu ile lead ara</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 block">Borough</label>
              <Select value={selectedBorough} onValueChange={setSelectedBorough}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LONDON_BOROUGHS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 block">Arama Sorgusu</label>
              <Select value={selectedQuery} onValueChange={setSelectedQuery}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_QUERIES.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 block">veya Özel Sorgu</label>
              <Input
                type="text"
                placeholder="örnek: samsung repair shop"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
              />
            </div>

            <Button variant="gradient" className="w-full" onClick={runDiscovery} disabled={running}>
              {running ? <><Loader2 className="w-4 h-4 animate-spin" />Aranıyor...</> : <><Search className="w-4 h-4" />Discovery Başlat</>}
            </Button>

            {error && (
              <div className="rounded-xl bg-rose-50/80 border border-rose-200/60 p-4 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div><strong>Hata:</strong> {error}</div>
              </div>
            )}

            {singleResult && (
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/60 p-4 text-sm space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Arama tamamlandı!
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-800">{singleResult.total}</p>
                    <p className="text-[10px] text-slate-400">Toplam</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-emerald-600">{singleResult.created}</p>
                    <p className="text-[10px] text-slate-400">Yeni</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-400">{singleResult.skipped}</p>
                    <p className="text-[10px] text-slate-400">Duplike</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Toplu Discovery</CardTitle>
                <CardDescription>İlk 5 borough x ilk 3 sorgu = otomatik toplu tarama</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-500 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Borough&apos;lar:</p>
                <div className="flex flex-wrap gap-1">
                  {LONDON_BOROUGHS.slice(0, 5).map((b) => (
                    <Badge key={b.name} variant="outline">
                      <MapPin className="w-3 h-3 mr-1" />
                      {b.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Sorgular:</p>
                <div className="flex flex-wrap gap-1">
                  {SEARCH_QUERIES.slice(0, 3).map((q) => (
                    <Badge key={q} variant="secondary">{q}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={runAllDiscovery} disabled={runningAll}>
              {runningAll ? <><Loader2 className="w-4 h-4 animate-spin" />Toplu tarama devam ediyor...</> : <><Zap className="w-4 h-4" />Toplu Discovery Başlat</>}
            </Button>

            {results && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="rounded-xl bg-slate-50/80 p-2.5 text-sm flex justify-between items-center">
                    <span className="text-slate-600">{r.borough} — {r.query}</span>
                    <div className="flex gap-1">
                      <Badge variant="success">{r.created}</Badge>
                      <Badge variant="secondary">{r.skipped} dup</Badge>
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-200/60 pt-2 text-sm font-medium text-slate-700">
                  Toplam: {results.reduce((s, r) => s + r.created, 0)} yeni lead
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Discovery sonrası crawl ve analiz işlemleri</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                const res = await fetch("/api/crawl", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ crawlAll: true }),
                });
                const data = await res.json();
                toast.success(`Crawl tamamlandı: ${data.crawled} başarılı, ${data.failed} başarısız`);
              }}
            >
              <Globe className="w-4 h-4" />
              Tüm Pending Crawl
            </Button>
            <Button
              variant="gradient"
              className="flex-1"
              onClick={async () => {
                const res = await fetch("/api/analyze", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ analyzeAll: true }),
                });
                const data = await res.json();
                toast.success(`Analiz tamamlandı: ${data.analyzed} başarılı, ${data.failed} başarısız`);
              }}
            >
              <Zap className="w-4 h-4" />
              Tüm Pending AI Analiz
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
