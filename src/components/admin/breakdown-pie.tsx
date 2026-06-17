"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = [
  "hsl(var(--revint-h, 38) var(--revint-s, 78%) 60%)",
  "hsl(var(--revint-h, 38) var(--revint-s, 78%) 45%)",
  "hsl(var(--revint-h, 38) var(--revint-s, 78%) 30%)",
  "hsl(210 60% 55%)",
  "hsl(150 50% 50%)",
  "hsl(0 60% 55%)",
  "hsl(280 50% 60%)",
  "hsl(var(--revint-h, 38) var(--revint-s, 78%) 75%)",
];

export function BreakdownPie({
  data,
  total,
  label,
}: {
  data: Array<{ key: string; label: string; sessions: number }>;
  total: number;
  label: string;
}) {
  if (data.length === 0 || total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-[var(--revint-text-3)]">
        No {label.toLowerCase()} data yet.
      </div>
    );
  }
  const slices = data.slice(0, PALETTE.length);
  return (
    <div className="grid grid-cols-2 gap-3 items-center">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="sessions"
              nameKey="label"
              innerRadius={42}
              outerRadius={72}
              paddingAngle={1}
              stroke="none"
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--revint-card)",
                border: "1px solid var(--revint-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--revint-text-3)" }}
              itemStyle={{ color: "var(--revint-text-1)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-xs text-[var(--revint-text-2)] space-y-1.5">
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.sessions / total) * 100 : 0;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 truncate text-[var(--revint-text-1)]">
                {s.label}
              </span>
              <span className="tabular-nums text-[var(--revint-text-3)]">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
