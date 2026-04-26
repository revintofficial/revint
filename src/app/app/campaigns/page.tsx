"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, ArrowRight, Star, Check, Zap, Package, Settings } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string;
  leadCount: number;
  filter: Record<string, string>;
  color: string;
}

interface ServicePackage {
  id: string;
  name: string;
  priceLabel: string;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
}

const colorMap: Record<string, string> = {
  red: "var(--leadac-error)",
  orange: "var(--leadac-warning)",
  yellow: "var(--leadac-warning)",
  green: "var(--leadac-success)",
};

const badgeMap: Record<string, "destructive" | "warning" | "success" | "secondary"> = {
  red: "destructive",
  orange: "warning",
  yellow: "warning",
  green: "success",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/campaigns")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("/api/workspace/packages")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([c, p]) => {
      if (Array.isArray(c)) setCampaigns(c);
      if (Array.isArray(p)) setPackages(p);
      setLoading(false);
    });
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
            const accentColor = colorMap[campaign.color] || "var(--leadac-muted)";
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
                    <Button variant="outline" className="w-full group-hover:border-(--leadac-500)/30 group-hover:text-(--leadac-500) transition-colors">
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

      {/* Service Packages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Packages</CardTitle>
              <CardDescription>Suggested package tiers for each lead</CardDescription>
            </div>
            <Link href="/app/settings/packages">
              <Button variant="ghost" size="sm" className="text-white/40 hover:text-white/70 gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Manage
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
              <Package className="w-10 h-10 text-white/20 mx-auto" />
              <p className="text-sm text-white/50">No service packages defined yet.</p>
              <Link href="/app/settings/packages">
                <Button size="sm" variant="outline">
                  <Star className="w-3.5 h-3.5" />
                  Add Service Packages
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-2xl p-5 hover:shadow-md transition-shadow relative ${
                    pkg.isPopular
                      ? "border-2 border-(--leadac-500)/30 bg-(--leadac-500)/3"
                      : "border border-white/10 bg-white/5"
                  }`}
                >
                  {pkg.isPopular && (
                    <Badge className="absolute -top-2.5 right-4 bg-(--leadac-500) text-white border-transparent">
                      <Star className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                  <h3 className="font-semibold text-lg text-white">{pkg.name}</h3>
                  <p className={`text-2xl font-bold mt-1 ${pkg.isPopular ? "text-(--leadac-500)" : "text-white"}`}>
                    {pkg.priceLabel}
                  </p>
                  {pkg.features.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm text-white/60">
                      {pkg.features.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          {pkg.isPopular ? (
                            <Zap className="w-4 h-4 text-(--leadac-500) shrink-0" />
                          ) : (
                            <Check className="w-4 h-4 text-[hsl(152_48%_50%)] shrink-0" />
                          )}
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
