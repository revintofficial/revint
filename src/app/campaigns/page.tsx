"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, ArrowRight, Star, Check, Zap } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string;
  leadCount: number;
  filter: Record<string, string>;
  color: string;
}

const gradientMap: Record<string, string> = {
  red: "from-rose-500 to-pink-500",
  orange: "from-amber-500 to-orange-500",
  yellow: "from-yellow-500 to-amber-500",
  green: "from-emerald-500 to-teal-500",
};

const badgeMap: Record<string, "destructive" | "warning" | "success" | "secondary"> = {
  red: "destructive",
  orange: "warning",
  yellow: "warning",
  green: "success",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setCampaigns(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Kampanyalar"
        subtitle="Lead'leri segmentlere ayırarak hedefli satış kampanyaları"
      />

      {campaigns.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Henüz kampanya yok</h3>
            <p className="text-sm text-slate-500">Lead&apos;ler analiz edildikçe kampanyalar otomatik oluşturulacak.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((campaign, index) => (
            <Card
              key={campaign.id}
              className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className={`h-1 bg-gradient-to-r ${gradientMap[campaign.color] || "from-slate-400 to-slate-500"}`} />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{campaign.name}</CardTitle>
                  <Badge variant={badgeMap[campaign.color] || "secondary"}>
                    {campaign.leadCount} lead
                  </Badge>
                </div>
                <CardDescription>{campaign.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/leads?${new URLSearchParams(campaign.filter).toString()}`}>
                  <Button variant="outline" className="w-full group-hover:border-indigo-300 group-hover:text-indigo-600 transition-colors">
                    Lead&apos;leri Gör
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Teklif Paketleri</CardTitle>
          <CardDescription>Her lead için önerilen paket tipi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200/60 bg-white/50 p-5 hover:shadow-md transition-all">
              <h3 className="font-semibold text-lg text-slate-900">Starter</h3>
              <p className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent mt-1">&pound;500-800</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {["Mobil uyumlu tek sayfa site", "İletişim formu", "Google Maps entegrasyonu", "Temel SEO"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 p-5 relative hover:shadow-md transition-all">
              <Badge variant="gradient" className="absolute -top-2.5 right-4">
                <Star className="w-3 h-3 mr-1" />
                Popüler
              </Badge>
              <h3 className="font-semibold text-lg text-slate-900">Growth</h3>
              <p className="text-2xl font-bold gradient-text mt-1">&pound;800-1500</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {["Çok sayfalık profesyonel site", "Online booking sistemi", "WhatsApp entegrasyonu", "Local SEO optimizasyonu", "Google yorumları widget", "Online satış altyapısı"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
