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

const colorMap: Record<string, string> = {
  red: "#FF3B30",
  orange: "#FF9500",
  yellow: "#FF9500",
  green: "#34C759",
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
      <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Segment leads into targeted sales campaigns"
      />

      {campaigns.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Megaphone className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white/70 mb-2">No campaigns yet</h3>
            <p className="text-sm text-white/50">Campaigns will appear automatically as leads are analyzed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((campaign, index) => {
            const accentColor = colorMap[campaign.color] || "#86868b";
            return (
              <Card
                key={campaign.id}
                className="group hover:shadow-md transition-shadow duration-200 overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="h-1" style={{ backgroundColor: accentColor }} />
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
                  <Link href={`/app/leads?${new URLSearchParams(campaign.filter).toString()}`}>
                    <Button variant="outline" className="w-full group-hover:border-[#007AFF]/30 group-hover:text-[#0A84FF] transition-colors">
                      View Leads
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Service Packages</CardTitle>
          <CardDescription>Suggested package tiers for each lead</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg text-white">Starter</h3>
              <p className="text-2xl font-bold text-white mt-1">&pound;500-800</p>
              <ul className="mt-4 space-y-2 text-sm text-white/60">
                {["Mobile-friendly single page site", "Contact form", "Google Maps integration", "Basic SEO"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#30D158] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-[#007AFF]/30 bg-[#0A84FF]/[0.03] p-5 relative hover:shadow-md transition-shadow">
              <Badge className="absolute -top-2.5 right-4 bg-[#0A84FF] text-white border-transparent">
                <Star className="w-3 h-3 mr-1" />
                Popular
              </Badge>
              <h3 className="font-semibold text-lg text-white">Growth</h3>
              <p className="text-2xl font-bold text-[#0A84FF] mt-1">&pound;800-1500</p>
              <ul className="mt-4 space-y-2 text-sm text-white/60">
                {["Multi-page professional site", "Online booking system", "WhatsApp integration", "Local SEO optimization", "Google reviews widget", "Online sales infrastructure"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#0A84FF] shrink-0" />
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
