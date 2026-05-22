"use client";

import { useMemo, useState } from "react";

/**
 * Apollo + Clay + Gong stack cost calculator widget.
 *
 * Inputs: seats (Apollo), seats (Clay), seats (Gong-or-Outreach), verification
 * monthly spend per seat. Outputs: annual stack cost vs LeadAC Team annual,
 * delta, and where the delta lands.
 *
 * Pricing baselines come from competitors.ts (sourced + dated). Anything
 * the user can't punch in is derived, not asked for.
 */

const APOLLO_PRO_SEAT_ANNUAL = 1392; // $116/mo
const CLAY_GROWTH_PRO_RATA = 446 * 12; // $446/mo
const GONG_FLOOR_ANNUAL = 12000; // pilot floor
const OUTREACH_SEAT_ANNUAL = 1320; // $110/mo Standard
const VERIFICATION_SEAT_MONTHLY_DEFAULT = 35;
const LEADAC_TEAM_ANNUAL = 18000;

type Tool = "apollo" | "clay" | "gong" | "outreach";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export function StackCostWidget() {
  const [apolloSeats, setApolloSeats] = useState(5);
  const [hasClay, setHasClay] = useState(true);
  const [thirdTool, setThirdTool] = useState<Tool>("gong");
  const [outreachSeats, setOutreachSeats] = useState(5);
  const [verification, setVerification] = useState<number>(
    VERIFICATION_SEAT_MONTHLY_DEFAULT,
  );

  const breakdown = useMemo(() => {
    const apollo = apolloSeats * APOLLO_PRO_SEAT_ANNUAL;
    const clay = hasClay ? CLAY_GROWTH_PRO_RATA : 0;
    const third =
      thirdTool === "gong"
        ? GONG_FLOOR_ANNUAL
        : outreachSeats * OUTREACH_SEAT_ANNUAL;
    const verif = apolloSeats * verification * 12;
    const total = apollo + clay + third + verif;
    return {
      lines: [
        { label: "Apollo Pro", value: apollo, note: `${apolloSeats} seats × $1,392/yr` },
        ...(hasClay
          ? [{ label: "Clay Growth", value: clay, note: "$446/mo workspace" }]
          : []),
        {
          label: thirdTool === "gong" ? "Gong pilot" : "Outreach Standard",
          value: third,
          note:
            thirdTool === "gong"
              ? "$12K/yr typical pilot floor"
              : `${outreachSeats} seats × $1,320/yr`,
        },
        ...(verif > 0
          ? [
              {
                label: "Email verification",
                value: verif,
                note: `${apolloSeats} seats × $${verification}/mo`,
              },
            ]
          : []),
      ],
      total,
    };
  }, [apolloSeats, hasClay, thirdTool, outreachSeats, verification]);

  const delta = breakdown.total - LEADAC_TEAM_ANNUAL;
  const deltaPct = Math.round((delta / breakdown.total) * 100);

  return (
    <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6 md:p-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid gap-5">
          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              Apollo Pro seats
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={apolloSeats}
              onChange={(e) => setApolloSeats(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 text-[14px] text-paper-1">
              <input
                type="checkbox"
                checked={hasClay}
                onChange={(e) => setHasClay(e.target.checked)}
                className="h-4 w-4 rounded border-ink-3 bg-ink-0 text-signal focus:ring-signal"
              />
              Clay Growth workspace — $446/mo
            </label>
          </div>

          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              Conversation tool
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["gong", "outreach"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThirdTool(t)}
                  className={`rounded-md border px-3 py-2 text-[14px] capitalize transition-colors ${
                    thirdTool === t
                      ? "border-signal bg-[hsl(38_60%_15%_/_0.4)] text-signal"
                      : "border-ink-3 bg-ink-0 text-paper-1 hover:text-paper-0"
                  }`}
                >
                  {t === "gong" ? "Gong pilot" : "Outreach"}
                </button>
              ))}
            </div>
          </div>

          {thirdTool === "outreach" ? (
            <div>
              <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
                Outreach seats
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={outreachSeats}
                onChange={(e) =>
                  setOutreachSeats(Math.max(1, Number(e.target.value) || 1))
                }
                className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
              />
            </div>
          ) : null}

          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              Email verification per seat / month
            </label>
            <input
              type="number"
              min={0}
              max={200}
              value={verification}
              onChange={(e) => setVerification(Math.max(0, Number(e.target.value) || 0))}
              className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
            />
            <p className="mt-1 text-[12px] text-paper-3">
              ZeroBounce, NeverBounce, BriteVerify — typical floor.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-ink-3 bg-ink-0 p-6">
          <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
            Annual stack cost
          </div>
          <div className="site-mono mt-2 text-[36px] text-paper-0 md:text-[44px]">
            {fmt(breakdown.total)}
          </div>
          <ul className="mt-6 grid gap-3">
            {breakdown.lines.map((l) => (
              <li
                key={l.label}
                className="flex items-baseline justify-between gap-3 border-b border-ink-3 pb-2 last:border-b-0"
              >
                <div>
                  <div className="text-[14px] text-paper-0">{l.label}</div>
                  <div className="site-mono text-[11px] text-paper-3">
                    {l.note}
                  </div>
                </div>
                <div className="site-mono text-[14px] text-paper-1">
                  {fmt(l.value)}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-signal/40 bg-[hsl(38_60%_15%_/_0.3)] p-4">
            <div className="text-[13px] text-paper-1">
              LeadAC Team (5 seats, all integrations)
            </div>
            <div className="site-mono mt-1 text-[24px] text-paper-0">
              {fmt(LEADAC_TEAM_ANNUAL)}/yr
            </div>
            <div className="mt-3 text-[13px] text-paper-1">
              {delta > 0 ? (
                <>
                  Delta:{" "}
                  <span className="site-mono text-signal">{fmt(delta)}</span>{" "}
                  ({deltaPct}% lower). Add the memory layer to your
                  existing stack, or use it to replace the conversation
                  tool entirely.
                </>
              ) : (
                <>
                  Your stack is already lean. LeadAC adds the closed-loop
                  layer the other four don't carry — for a delta of {fmt(Math.abs(delta))}/yr.
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
