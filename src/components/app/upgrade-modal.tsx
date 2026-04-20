"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import {
  PLANS,
  PLAN_ORDER,
  ANNUAL_DISCOUNT_PCT,
  currencySymbol,
  detectBrowserCurrency,
  getDisplayPrice,
  type BillingCycle,
  type Currency,
} from "@/lib/plans";
import type { Plan } from "@/generated/prisma/client";
import { toast } from "sonner";

export interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current plan, used to determine which plans are upgrades. */
  currentPlan: Plan;
  /** Optional headline override - defaults to "You're out of <thing>". */
  reason?: "leads" | "ai" | "general";
  planName: string;
  limit: number;
}

const REASON_COPY: Record<"leads" | "ai" | "general", { title: string; sub: string }> = {
  leads: {
    title: "You've hit your lead limit",
    sub: "Upgrade to keep discovering new prospects this cycle.",
  },
  ai: {
    title: "You're out of AI credits",
    sub: "Upgrade to keep auditing sites and generating openers.",
  },
  general: {
    title: "Unlock more capacity",
    sub: "Pick the plan that matches how fast you're moving.",
  },
};

export function UpgradeModal({
  open,
  onOpenChange,
  currentPlan,
  reason = "general",
  planName,
  limit,
}: UpgradeModalProps) {
  const [busy, setBusy] = useState<Plan | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState<Currency>("USD");

  useEffect(() => {
    try {
      const c = localStorage.getItem("le.currency");
      if (c === "USD" || c === "GBP") setCurrency(c);
      else setCurrency(detectBrowserCurrency());
      const cy = localStorage.getItem("le.cycle");
      if (cy === "monthly" || cy === "annual") setCycle(cy);
    } catch {
      setCurrency(detectBrowserCurrency());
    }
  }, []);

  const upgradeTargets = PLAN_ORDER.filter(
    (id) => id !== "FREE" && PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(currentPlan)
  );
  const targets = upgradeTargets.length > 0 ? upgradeTargets : PLAN_ORDER.filter((id) => id !== "FREE" && id !== currentPlan);

  async function startCheckout(target: Plan) {
    setBusy(target);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target, currency, cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || "Failed to start checkout");
        setBusy(null);
        return;
      }
      setRedirecting(true);
      window.location.assign(data.url);
    } catch (err) {
      toast.error("Network error. Please try again.");
      setBusy(null);
      console.error(err);
    }
  }

  const copy = REASON_COPY[reason];
  const headline = reason === "leads" || reason === "ai"
    ? `${copy.title} (${limit.toLocaleString()} on ${planName})`
    : copy.title;

  return (
    <Dialog open={open} onOpenChange={(v) => !redirecting && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(94,106,210,0.18)", border: "0.5px solid rgba(94,106,210,0.35)" }}
            >
              <Sparkles className="w-4 h-4 text-[#A5B4FC]" />
            </div>
            <DialogTitle className="text-[18px]">{headline}</DialogTitle>
          </div>
          <DialogDescription>{copy.sub}</DialogDescription>
        </DialogHeader>

        {/* Cycle + currency selectors */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div
            className="inline-flex p-0.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={() => setCycle("monthly")}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all"
              style={{
                background: cycle === "monthly" ? "rgba(255,255,255,0.08)" : "transparent",
                color: cycle === "monthly" ? "white" : "rgba(235,235,245,0.55)",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all flex items-center gap-1"
              style={{
                background: cycle === "annual" ? "rgba(255,255,255,0.08)" : "transparent",
                color: cycle === "annual" ? "white" : "rgba(235,235,245,0.55)",
              }}
            >
              Annual
              <span
                className="text-[9.5px] font-semibold px-1 py-0.5 rounded"
                style={{ background: "rgba(48,209,88,0.2)", color: "#5EE6A1" }}
              >
                -{ANNUAL_DISCOUNT_PCT}%
              </span>
            </button>
          </div>
          <div
            className="inline-flex p-0.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            {(["USD", "GBP"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background: currency === c ? "rgba(255,255,255,0.08)" : "transparent",
                  color: currency === c ? "white" : "rgba(235,235,245,0.55)",
                }}
              >
                {c === "USD" ? "USD ($)" : "GBP (£)"}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid gap-3 ${targets.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-" + targets.length}`}>
          {targets.map((id) => {
            const p = PLANS[id];
            const price = getDisplayPrice(id, currency, cycle);
            const monthlyEquivalent = getDisplayPrice(id, currency, "monthly");
            const symbol = currencySymbol(currency);
            const isHighlight = p.highlight;
            return (
              <div
                key={id}
                className="relative p-4 rounded-xl flex flex-col"
                style={{
                  background: isHighlight
                    ? "linear-gradient(180deg, rgba(94,106,210,0.14), rgba(28,28,30,0.5))"
                    : "rgba(28,28,30,0.5)",
                  border: isHighlight
                    ? "0.5px solid rgba(94,106,210,0.45)"
                    : "0.5px solid rgba(255,255,255,0.06)",
                }}
              >
                {isHighlight && (
                  <span
                    className="absolute -top-2 left-4 px-1.5 py-0.5 rounded text-[9.5px] font-semibold"
                    style={{
                      background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                      color: "white",
                    }}
                  >
                    Most popular
                  </span>
                )}
                <p className="text-[14px] font-semibold mb-0.5">{p.name}</p>
                <p className="text-[11px] text-white/55 mb-3">{p.tagline}</p>
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-[22px] font-semibold">{symbol}{price}</span>
                  <span className="text-[10.5px] text-white/45">/mo</span>
                  {cycle === "annual" && monthlyEquivalent > price && (
                    <span className="text-[10.5px] text-white/35 line-through ml-1">
                      {symbol}{monthlyEquivalent}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/40 mb-3">
                  {cycle === "annual"
                    ? `${symbol}${price * 12}/yr · save ${ANNUAL_DISCOUNT_PCT}%`
                    : "Billed monthly"}
                </p>
                <ul className="space-y-1.5 text-[11.5px] mb-3 flex-1">
                  {p.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 shrink-0 text-[#30D158]" />
                      <span className="text-white/70">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  onClick={() => startCheckout(id)}
                  disabled={busy === id || redirecting}
                  className="w-full"
                  style={isHighlight ? {
                    background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                    color: "white",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 20px rgba(49,46,129,0.4)",
                  } : undefined}
                >
                  {busy === id ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />Loading…</>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      {`Upgrade to ${p.name}`}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/40 pt-1">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Stripe-secured checkout
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Cancel anytime
          </span>
          <span>·</span>
          <span>Prorated upgrades</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
