"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Globe,
  TrendingUp,
  CalendarDays,
  Search,
  Bot,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Stats {
  totalLeads: number;
  withWebsite: number;
  withoutWebsite: number;
  averageScore: number;
  boroughDistribution: { borough: string; count: number }[];
  recentLeads: number;
  outreachStatus: { status: string; count: number }[];
  crawlStatus: { status: string; count: number }[];
  analyzeStatus: { status: string; count: number }[];
}

const KPI_CONFIG = [
  { key: "totalLeads", label: "Toplam Lead", icon: Users, color: "from-indigo-500 to-violet-500" },
  { key: "withWebsite", label: "Website Var", icon: Globe, color: "from-emerald-500 to-teal-500" },
  { key: "averageScore", label: "Ort. Skor", icon: TrendingUp, color: "from-amber-500 to-orange-500", suffix: "/100" },
  { key: "recentLeads", label: "Bu Hafta", icon: CalendarDays, color: "from-rose-500 to-pink-500" },
] as const;

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-xl px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{payload[0].value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStats({
          ...data,
          boroughDistribution: data.boroughDistribution ?? [],
          outreachStatus: data.outreachStatus ?? [],
          crawlStatus: data.crawlStatus ?? [],
          analyzeStatus: data.analyzeStatus ?? [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Henüz veri yok</h3>
          <p className="text-sm text-slate-500 mb-4">
            Discovery başlatarak lead toplamaya başlayın.
          </p>
          <Link href="/discovery">
            <Button variant="gradient">Discovery&apos;ye Git</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Telefon tamircisi lead'lerinin genel görünümü"
        actions={
          <div className="flex gap-2">
            <Link href="/discovery">
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4" />
                Discovery
              </Button>
            </Link>
            <Link href="/leads">
              <Button variant="gradient" size="sm">
                <ArrowUpRight className="w-4 h-4" />
                Lead&apos;leri Gör
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CONFIG.map((kpi) => {
          const value = stats[kpi.key as keyof Stats] as number;
          return (
            <Card key={kpi.key} className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">{kpi.label}</p>
                    <div className="text-2xl font-semibold text-slate-900">
                      {value}
                      {"suffix" in kpi && kpi.suffix && (
                        <span className="text-base font-normal text-slate-400">{kpi.suffix}</span>
                      )}
                    </div>
                    {kpi.key === "withWebsite" && (
                      <p className="text-xs text-slate-400 mt-1">{stats.withoutWebsite} websitesiz</p>
                    )}
                    {kpi.key === "recentLeads" && (
                      <p className="text-xs text-slate-400 mt-1">yeni lead</p>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity`}>
                    <kpi.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Borough Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.boroughDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.boroughDistribution}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="borough"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-12 text-center">
                <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Henüz veri yok</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PipelineSection title="Crawl Durumu" items={stats.crawlStatus} successKey="CRAWLED" />
            <PipelineSection title="Analiz Durumu" items={stats.analyzeStatus} successKey="ANALYZED" />
            <PipelineSection title="Satış Durumu" items={stats.outreachStatus} successKey="WON" warnKeys={["CONTACTED", "INTERESTED"]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PipelineSection({
  title,
  items,
  successKey,
  warnKeys = [],
}: {
  title: string;
  items: { status: string; count: number }[];
  successKey: string;
  warnKeys?: string[];
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
        <span className="text-xs text-slate-400">{total} toplam</span>
      </div>
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-3">
          {items.map((s) => {
            const pct = (s.count / total) * 100;
            const color =
              s.status === successKey
                ? "bg-emerald-400"
                : s.status === "FAILED" || s.status === "LOST"
                ? "bg-rose-400"
                : warnKeys.includes(s.status)
                ? "bg-amber-400"
                : "bg-slate-300";
            return (
              <div
                key={s.status}
                className={`${color} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <Badge
            key={s.status}
            variant={
              s.status === successKey
                ? "success"
                : s.status === "FAILED" || s.status === "LOST"
                ? "destructive"
                : warnKeys.includes(s.status)
                ? "warning"
                : "secondary"
            }
          >
            {s.status}: {s.count}
          </Badge>
        ))}
      </div>
    </div>
  );
}
