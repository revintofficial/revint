"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-zinc-200 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">
          Henuz veri yok. Discovery baslatarak lead toplamaya baslayin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-zinc-500 mt-1">
          Telefon tamircisi lead&apos;lerinin genel gorunumu
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Toplam Lead" value={stats.totalLeads} />
        <StatCard
          title="Website Var"
          value={stats.withWebsite}
          subtitle={`${stats.withoutWebsite} websitesiz`}
        />
        <StatCard title="Ort. Skor" value={stats.averageScore} suffix="/100" />
        <StatCard
          title="Bu Hafta"
          value={stats.recentLeads}
          subtitle="yeni lead"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Borough Dagilimi</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.boroughDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.boroughDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="borough"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-zinc-400 text-sm py-8 text-center">
                Henuz veri yok
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 mb-2">
                Crawl Durumu
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.crawlStatus.map((s) => (
                  <Badge
                    key={s.status}
                    variant={
                      s.status === "CRAWLED"
                        ? "success"
                        : s.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {s.status}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 mb-2">
                Analiz Durumu
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.analyzeStatus.map((s) => (
                  <Badge
                    key={s.status}
                    variant={
                      s.status === "ANALYZED"
                        ? "success"
                        : s.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {s.status}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 mb-2">
                Satis Durumu
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.outreachStatus.map((s) => (
                  <Badge
                    key={s.status}
                    variant={
                      s.status === "WON"
                        ? "success"
                        : s.status === "LOST"
                        ? "destructive"
                        : s.status === "CONTACTED" ||
                          s.status === "INTERESTED"
                        ? "warning"
                        : "secondary"
                    }
                  >
                    {s.status}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  suffix,
}: {
  title: string;
  value: number;
  subtitle?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {value}
          {suffix && (
            <span className="text-lg font-normal text-zinc-400">{suffix}</span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
