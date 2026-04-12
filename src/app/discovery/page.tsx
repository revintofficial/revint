"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LONDON_BOROUGHS, SEARCH_QUERIES } from "@/types";

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
        setError(data.error || `API hatasi: ${res.status}`);
        return;
      }
      if (!data.success) {
        setError(data.error || "Bilinmeyen hata");
        return;
      }
      setSingleResult(data);
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Baglanti hatasi. Sunucu calisiyor mu?");
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
        setError(data.error || `API hatasi: ${res.status}`);
        return;
      }
      setResults(data.results || []);
    } catch (err) {
      console.error("Bulk discovery failed:", err);
      setError("Baglanti hatasi. Sunucu calisiyor mu?");
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Discovery</h2>
        <p className="text-zinc-500 mt-1 text-sm md:text-base">
          Google Places API ile yeni telefon tamircisi lead&apos;leri kesfet
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tekli Arama</CardTitle>
            <CardDescription>
              Belirli bir borough ve sorgu ile lead ara
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                Borough
              </label>
              <Select
                value={selectedBorough}
                onValueChange={setSelectedBorough}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LONDON_BOROUGHS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                Arama Sorgusu
              </label>
              <Select value={selectedQuery} onValueChange={setSelectedQuery}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_QUERIES.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                veya Ozel Sorgu
              </label>
              <input
                type="text"
                placeholder="ornek: samsung repair shop"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <Button
              className="w-full"
              onClick={runDiscovery}
              disabled={running}
            >
              {running ? "Araniyor..." : "Discovery Baslat"}
            </Button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                <strong>Hata:</strong> {error}
              </div>
            )}

            {singleResult && (
              <div className="bg-zinc-50 rounded-lg p-4 text-sm space-y-1">
                <p>
                  <strong>Toplam:</strong> {singleResult.total} sonuc
                </p>
                <p>
                  <strong>Yeni:</strong> {singleResult.created} lead eklendi
                </p>
                <p>
                  <strong>Duplike:</strong> {singleResult.skipped} atildi
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Toplu Discovery</CardTitle>
            <CardDescription>
              Ilk 5 borough x ilk 3 sorgu = otomatik toplu tarama
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-zinc-500 space-y-2">
              <p>Bu islem asagidaki borough&apos;lari tarayacak:</p>
              <div className="flex flex-wrap gap-1">
                {LONDON_BOROUGHS.slice(0, 5).map((b) => (
                  <Badge key={b.name} variant="outline">
                    {b.name}
                  </Badge>
                ))}
              </div>
              <p className="mt-2">Sorgular:</p>
              <div className="flex flex-wrap gap-1">
                {SEARCH_QUERIES.slice(0, 3).map((q) => (
                  <Badge key={q} variant="secondary">
                    {q}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              variant="outline"
              onClick={runAllDiscovery}
              disabled={runningAll}
            >
              {runningAll ? "Toplu tarama devam ediyor..." : "Toplu Discovery Baslat"}
            </Button>

            {results && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="bg-zinc-50 rounded p-2 text-sm flex justify-between"
                  >
                    <span>
                      {r.borough} - {r.query}
                    </span>
                    <span>
                      <Badge variant="success">{r.created}</Badge>{" "}
                      <Badge variant="secondary">{r.skipped} dup</Badge>
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 text-sm font-medium">
                  Toplam:{" "}
                  {results.reduce((s, r) => s + r.created, 0)} yeni lead
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline</CardTitle>
          <CardDescription>
            Discovery sonrasi crawl ve analiz islemleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={async () => {
                const res = await fetch("/api/crawl", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ crawlAll: true }),
                });
                const data = await res.json();
                alert(
                  `Crawl tamamlandi: ${data.crawled} basarili, ${data.failed} basarisiz`
                );
              }}
            >
              Tum Pending Crawl
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={async () => {
                const res = await fetch("/api/analyze", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ analyzeAll: true }),
                });
                const data = await res.json();
                alert(
                  `Analiz tamamlandi: ${data.analyzed} basarili, ${data.failed} basarisiz`
                );
              }}
            >
              Tum Pending AI Analiz
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
