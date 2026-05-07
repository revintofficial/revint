"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TimeSeriesPoint {
  bucket: string;
  sessions: number;
  visitors: number;
  conversions: number;
}

/**
 * Stacked area chart for sessions / visitors / conversions over time.
 * Bucket labels render hour-of-day for "today" granularity and
 * MMM-DD for daily. Dark theme via --leadac-* tokens.
 */
export function TimeSeriesChart({
  data,
  granularity,
}: {
  data: TimeSeriesPoint[];
  granularity: "hour" | "day";
}) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-[var(--leadac-text-3)]">
        No traffic in this window yet.
      </div>
    );
  }

  const fmtX = (iso: string) => {
    const d = new Date(iso);
    if (granularity === "hour") {
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  };

  const stroke = "hsl(var(--leadac-h, 38) var(--leadac-s, 78%) 60%)";
  const visitorStroke = "hsl(var(--leadac-h, 38) var(--leadac-s, 78%) 35%)";
  const conversionStroke = "hsl(150 70% 55%)";

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="adminTsSessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={stroke} stopOpacity={0.45} />
              <stop offset="95%" stopColor={stroke} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="adminTsVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={visitorStroke} stopOpacity={0.4} />
              <stop offset="95%" stopColor={visitorStroke} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={fmtX}
            stroke="rgba(255,255,255,0.35)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            stroke="rgba(255,255,255,0.35)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "var(--leadac-card)",
              border: "1px solid var(--leadac-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--leadac-text-3)" }}
            itemStyle={{ color: "var(--leadac-text-1)" }}
            labelFormatter={(v) => (typeof v === "string" ? fmtX(v) : "")}
          />
          <Area
            name="Sessions"
            type="monotone"
            dataKey="sessions"
            stroke={stroke}
            fill="url(#adminTsSessions)"
            strokeWidth={2}
          />
          <Area
            name="Visitors"
            type="monotone"
            dataKey="visitors"
            stroke={visitorStroke}
            fill="url(#adminTsVisitors)"
            strokeWidth={1.5}
          />
          <Area
            name="Conversions"
            type="monotone"
            dataKey="conversions"
            stroke={conversionStroke}
            fill="transparent"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--leadac-text-3)]">
        <Legend dot={stroke} label="Sessions" />
        <Legend dot={visitorStroke} label="Visitors" />
        <Legend dot={conversionStroke} label="Conversions" />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: dot }}
      />
      {label}
    </span>
  );
}
