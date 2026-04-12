"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  name: string;
  description: string;
  leadCount: number;
  filter: Record<string, string>;
  color: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-zinc-200 rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-zinc-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    red: "border-l-red-500",
    orange: "border-l-orange-500",
    yellow: "border-l-amber-500",
    green: "border-l-emerald-500",
  };

  const badgeMap: Record<string, "destructive" | "warning" | "success" | "secondary"> = {
    red: "destructive",
    orange: "warning",
    yellow: "warning",
    green: "success",
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Kampanyalar</h2>
        <p className="text-zinc-500 mt-1">
          Lead&apos;leri segmentlere ayirarak hedefli satis kampanyalari
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campaigns.map((campaign) => (
          <Card
            key={campaign.id}
            className={`border-l-4 ${colorMap[campaign.color] || ""}`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{campaign.name}</CardTitle>
                <Badge variant={badgeMap[campaign.color] || "secondary"}>
                  {campaign.leadCount} lead
                </Badge>
              </div>
              <CardDescription>{campaign.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={`/leads?${new URLSearchParams(campaign.filter).toString()}`}
              >
                <Button variant="outline" className="w-full">
                  Lead&apos;leri Gor
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Teklif Paketleri</CardTitle>
          <CardDescription>
            Her lead icin onerilen paket tipi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-zinc-200 rounded-lg p-4">
              <h3 className="font-bold text-lg">Starter</h3>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                &pound;500-800
              </p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                <li>&bull; Mobil uyumlu tek sayfa site</li>
                <li>&bull; Iletisim formu</li>
                <li>&bull; Google Maps entegrasyonu</li>
                <li>&bull; Temel SEO</li>
              </ul>
            </div>
            <div className="border-2 border-zinc-900 rounded-lg p-4">
              <h3 className="font-bold text-lg">Growth</h3>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                &pound;800-1500
              </p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                <li>&bull; Cok sayfalik profesyonel site</li>
                <li>&bull; Online booking sistemi</li>
                <li>&bull; WhatsApp entegrasyonu</li>
                <li>&bull; Local SEO optimizasyonu</li>
                <li>&bull; Google yorumlari widget</li>
              </ul>
            </div>
            <div className="border border-zinc-200 rounded-lg p-4">
              <h3 className="font-bold text-lg">Sales</h3>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                &pound;1500-3000
              </p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                <li>&bull; Growth paketi + envanter showcase</li>
                <li>&bull; Online satis altyapisi</li>
                <li>&bull; Yorum embedding</li>
                <li>&bull; Lead capture formlari</li>
                <li>&bull; CRM entegrasyonu</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
