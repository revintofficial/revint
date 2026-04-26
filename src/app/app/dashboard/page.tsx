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
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OUTREACH_LABELS, CRAWL_LABELS, ANALYZE_LABELS } from "@/lib/labels";
import { LEADAC, getFunnelStepColor } from "@/lib/colors";

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

// Mono-indigo KPI cards: every icon shares the same primary hue, only the
// surrounding tint background gives it a distinct silhouette. The "highlight"
// KPI (averageScore) sits one step lighter.
const KPI_CONFIG = [
  { key: "totalLeads", label: "Total Leads", icon: Users, color: LEADAC.primary400 },
  { key: "withWebsite", label: "Have Website", icon: Globe, color: LEADAC.primary400 },
  { key: "averageScore", label: "Avg. Score", icon: TrendingUp, color: LEADAC.primary300, suffix: "/100" },
  { key: "recentLeads", label: "This Week", icon: CalendarDays, color: LEADAC.primary400 },
] as const;

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="leadac-card-glass px-4 py-3" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
      <p className="text-xs font-medium" style={{ color: "var(--leadac-text-2)" }}>{label}</p>
      <p className="text-lg font-semibold text-white">{payload[0].value}</p>
    </div>
  );
}

function getNextAction(stats: Stats): { message: string; action: string; href: string; icon: typeof Search } | null {
  if (stats.totalLeads === 0) {
    return { message: "You haven't discovered any businesses yet.", action: "Get started", href: "/app/onboarding", icon: Search };
  }

  const scanned = stats.crawlStatus.find((s) => s.status === "CRAWLED")?.count || 0;
  const analyzed = stats.analyzeStatus.find((s) => s.status === "ANALYZED")?.count || 0;
  const pendingCrawl = stats.crawlStatus.find((s) => s.status === "PENDING")?.count || 0;
  const pendingAnalyze = stats.analyzeStatus.find((s) => s.status === "PENDING")?.count || 0;

  if (pendingCrawl > 0 && scanned === 0) {
    return { message: `${pendingCrawl} leads waiting to be scanned.`, action: "Scan websites", href: "/app/discovery", icon: Globe };
  }
  if (pendingAnalyze > 0 && analyzed === 0) {
    return { message: `${pendingAnalyze} leads ready for AI analysis.`, action: "Run analysis", href: "/app/discovery", icon: Bot };
  }
  if (analyzed > 0 && stats.averageScore > 0) {
    return { message: `${analyzed} leads analyzed — review top opportunities.`, action: "View leads", href: "/app/leads?sortBy=score", icon: TrendingUp };
  }

  return null;
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
      <div className="p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-10">
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--leadac-muted)" }} />
          <h3 className="text-lg font-semibold text-white mb-2">No data yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--leadac-text-2)" }}>
            Start by discovering local businesses in your area.
          </p>
          <Link href="/app/onboarding">
            <Button>Get Started</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const scannedCount = stats.crawlStatus.find((s) => s.status === "CRAWLED")?.count || 0;
  const analyzedCount = stats.analyzeStatus.find((s) => s.status === "ANALYZED")?.count || 0;
  const shortlistedCount = stats.outreachStatus.reduce((sum, s) => sum + s.count, 0);
  const inTalksCount = stats.outreachStatus
    .filter((s) => ["CONTACTED", "INTERESTED", "MEETING"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);
  const wonCount = stats.outreachStatus.find((s) => s.status === "WON")?.count || 0;

  // Mono palette: lightness ramps from 42% (Discovered) to 66% (Won), keeping
  // a single indigo hue. The eye reads stage progression without the rainbow
  // noise of mixed hues.
  const funnelStages = [
    { name: "Discovered", value: stats.totalLeads },
    { name: "Scanned", value: scannedCount },
    { name: "Analyzed", value: analyzedCount },
    { name: "Shortlisted", value: shortlistedCount },
    { name: "In Talks", value: inTalksCount },
    { name: "Won", value: wonCount },
  ];
  const funnelData = funnelStages.map((stage, idx) => ({
    ...stage,
    fill: getFunnelStepColor(idx, funnelStages.length),
  }));

  const nextAction = getNextAction(stats);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Your sales pipeline at a glance"
        actions={
          <div className="flex gap-2">
            <Link href="/app/discovery">
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4" />
                Discover
              </Button>
            </Link>
            <Link href="/app/leads">
              <Button size="sm">
                <ArrowUpRight className="w-4 h-4" />
                View Leads
              </Button>
            </Link>
          </div>
        }
      />

      {/* Next Action Prompt — landing-style hero CTA with indigo glow */}
      {nextAction && (
        <Card
          className="overflow-hidden"
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.04)",
            borderTop: "1px solid var(--leadac-500)",
            border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18)",
          }}
        >
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 leadac-glow-cta"
                style={{ background: "var(--leadac-500)" }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">What to do next</p>
                <p className="text-sm" style={{ color: "var(--leadac-text-2)" }}>{nextAction.message}</p>
              </div>
            </div>
            <Link href={nextAction.href}>
              <Button size="sm" className="leadac-glow-cta">
                {nextAction.action}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards — mono indigo icons on subtle indigo tint backgrounds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CONFIG.map((kpi) => {
          const value = stats[kpi.key as keyof Stats] as number;
          return (
            <Card key={kpi.key} className="glass-hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[13px] font-medium mb-2" style={{ color: "var(--leadac-text-2)" }}>{kpi.label}</p>
                    <div className="text-2xl font-semibold text-white">
                      {value}
                      {"suffix" in kpi && kpi.suffix && (
                        <span className="text-base font-normal" style={{ color: "var(--leadac-text-3)" }}>{kpi.suffix}</span>
                      )}
                    </div>
                    {kpi.key === "withWebsite" && (
                      <p className="text-xs mt-1" style={{ color: "var(--leadac-text-3)" }}>{stats.withoutWebsite} without website</p>
                    )}
                    {kpi.key === "recentLeads" && (
                      <p className="text-xs mt-1" style={{ color: "var(--leadac-text-3)" }}>new leads</p>
                    )}
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)" }}
                  >
                    <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalLeads > 0 ? (
              <div className="space-y-3">
                {funnelData.map((stage) => {
                  const pct = stats.totalLeads > 0 ? (stage.value / stats.totalLeads) * 100 : 0;
                  return (
                    <div key={stage.name} className="flex items-center gap-3">
                      <span className="text-xs w-20 text-right shrink-0" style={{ color: "var(--leadac-text-2)" }}>{stage.name}</span>
                      <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ backgroundColor: "var(--leadac-hover)" }}>
                        <div
                          className="h-full rounded-lg transition-all duration-700"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stage.fill }}
                        />
                        <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white">
                          {stage.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--leadac-muted)" }} />
                <p className="text-sm" style={{ color: "var(--leadac-text-3)" }}>No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Status */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PipelineSection title="Scan Status" items={stats.crawlStatus} successKey="CRAWLED" labels={CRAWL_LABELS} />
            <PipelineSection title="Analysis Status" items={stats.analyzeStatus} successKey="ANALYZED" labels={ANALYZE_LABELS} />
            <PipelineSection title="Outreach Status" items={stats.outreachStatus} successKey="WON" warnKeys={["CONTACTED", "INTERESTED"]} labels={OUTREACH_LABELS} />
          </CardContent>
        </Card>
      </div>

      {/* Location Chart */}
      {stats.boroughDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leads by Location</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.boroughDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                <XAxis
                  dataKey="borough"
                  tick={{ fontSize: 11, fill: LEADAC.text2 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  axisLine={{ stroke: "hsl(0 0% 100% / 0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: LEADAC.text2 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={LEADAC.primary500} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PipelineSection({
  title,
  items,
  successKey,
  warnKeys = [],
  labels,
}: {
  title: string;
  items: { status: string; count: number }[];
  successKey: string;
  warnKeys?: string[];
  labels: Record<string, string>;
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-medium" style={{ color: "var(--leadac-text-2)" }}>{title}</p>
        <span className="text-xs" style={{ color: "var(--leadac-text-3)" }}>{total} total</span>
      </div>
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: "var(--leadac-hover)" }}>
          {items.map((s) => {
            const pct = (s.count / total) * 100;
            const fill =
              s.status === successKey
                ? "var(--leadac-success)"
                : s.status === "FAILED" || s.status === "LOST"
                ? "var(--leadac-error)"
                : warnKeys.includes(s.status)
                ? "var(--leadac-warning)"
                : "var(--leadac-border)";
            return (
              <div
                key={s.status}
                className="transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: fill }}
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
            {labels[s.status] || s.status}: {s.count}
          </Badge>
        ))}
      </div>
    </div>
  );
}
