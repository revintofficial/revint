"use client";

import { useMemo, useState } from "react";

/**
 * SDR ramp time estimator widget.
 *
 * Inputs: SDR loaded cost (annual), current ramp weeks, target ramp weeks.
 * Outputs: un-recovered cost per hire today vs target, and saved cost
 * per 5 hires.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export function SdrRampWidget() {
  const [loaded, setLoaded] = useState(80000);
  const [currentWeeks, setCurrentWeeks] = useState(11);
  const [targetWeeks, setTargetWeeks] = useState(6);
  const [hiresPerYear, setHiresPerYear] = useState(5);

  const result = useMemo(() => {
    const weeklyLoaded = loaded / 52;
    const costPerHireToday = weeklyLoaded * currentWeeks;
    const costPerHireTarget = weeklyLoaded * targetWeeks;
    const savingsPerHire = costPerHireToday - costPerHireTarget;
    const totalSavings = savingsPerHire * hiresPerYear;
    return {
      costPerHireToday,
      costPerHireTarget,
      savingsPerHire,
      totalSavings,
    };
  }, [loaded, currentWeeks, targetWeeks, hiresPerYear]);

  return (
    <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6 md:p-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid gap-5">
          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              Loaded SDR cost (annual)
            </label>
            <input
              type="number"
              min={30000}
              max={250000}
              step={5000}
              value={loaded}
              onChange={(e) => setLoaded(Math.max(30000, Number(e.target.value) || 0))}
              className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
            />
            <p className="mt-1 text-[12px] text-paper-3">
              Base salary + commission + benefits + tooling allocation.
            </p>
          </div>
          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              Current ramp time (weeks)
            </label>
            <input
              type="number"
              min={1}
              max={52}
              value={currentWeeks}
              onChange={(e) =>
                setCurrentWeeks(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
            />
            <p className="mt-1 text-[12px] text-paper-3">
              Median across our 200-team benchmark: 11 weeks.
            </p>
          </div>
          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              Target ramp time (weeks)
            </label>
            <input
              type="number"
              min={1}
              max={52}
              value={targetWeeks}
              onChange={(e) =>
                setTargetWeeks(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
            />
          </div>
          <div>
            <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
              SDR hires per year
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={hiresPerYear}
              onChange={(e) =>
                setHiresPerYear(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[15px] text-paper-0 focus:border-signal focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-ink-3 bg-ink-0 p-6">
          <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
            Un-recovered ramp cost
          </div>
          <div className="site-mono mt-2 text-[36px] text-paper-0 md:text-[44px]">
            {fmt(result.costPerHireToday)}
          </div>
          <div className="mt-1 text-[12px] text-paper-3">per hire, today</div>

          <ul className="mt-6 grid gap-3 site-mono text-[14px]">
            <li className="flex items-baseline justify-between gap-3 border-b border-ink-3 pb-2">
              <span className="text-paper-2">Per hire at target ramp</span>
              <span className="text-paper-1">{fmt(result.costPerHireTarget)}</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 border-b border-ink-3 pb-2">
              <span className="text-paper-2">Savings per hire</span>
              <span className="text-signal">{fmt(result.savingsPerHire)}</span>
            </li>
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-paper-2">
                Savings across {hiresPerYear} hires
              </span>
              <span className="text-signal">{fmt(result.totalSavings)}</span>
            </li>
          </ul>

          <p className="mt-6 text-[13px] leading-relaxed text-paper-2">
            Vertical SaaS GTM teams running LeadAC's pre-call brief see
            ramp time drop from 11 weeks to 6–7 weeks because new SDRs
            inherit the operational pattern instead of building it from
            scratch.
          </p>
        </div>
      </div>
    </div>
  );
}
