"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Lock, ShieldCheck } from "lucide-react";
import {
  PLANS,
  PLAN_ORDER,
  ANNUAL_DISCOUNT_PCT,
  currencySymbol,
  detectBrowserCurrency,
  getDisplayPrice,
  type BillingCycle,
  type Currency,
  SUPPORTED_CURRENCIES,
} from "@/lib/plans";

const CURRENCY_LABEL: Record<Currency, string> = {
  USD: "USD ($)",
  GBP: "GBP (£)",
};

interface Props {
  ctaHref?: string;
  /**
   * When true, the CTA points users at /signup with `?plan=` and `?currency=`
   * preserved so the auth flow can resume checkout post-confirm. Defaults true
   * for marketing surfaces.
   */
  carryIntentToSignup?: boolean;
}

export function PricingCards({ ctaHref = "/signup", carryIntentToSignup = true }: Props) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState<Currency>("USD");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("le.currency");
      if (stored === "USD" || stored === "GBP") {
        setCurrency(stored);
        return;
      }
    } catch {
      // ignore localStorage failures (private mode, etc.)
    }
    setCurrency(detectBrowserCurrency());
  }, []);

  function changeCurrency(next: Currency) {
    setCurrency(next);
    try {
      localStorage.setItem("le.currency", next);
    } catch {
      // ignore
    }
  }

  function buildHref(planId: string) {
    if (planId === "FREE") return ctaHref;
    if (carryIntentToSignup) {
      const params = new URLSearchParams({ plan: planId, currency, cycle });
      return `/signup?${params.toString()}`;
    }
    const params = new URLSearchParams({ plan: planId, currency, cycle, autocheckout: "1" });
    return `/app/settings/billing?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* Cycle + currency controls */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div
          className="inline-flex p-0.5 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
          role="tablist"
          aria-label="Billing cycle"
        >
          <button
            onClick={() => setCycle("monthly")}
            role="tab"
            aria-selected={cycle === "monthly"}
            className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all"
            style={{
              background: cycle === "monthly" ? "rgba(255,255,255,0.08)" : "transparent",
              color: cycle === "monthly" ? "white" : "rgba(235,235,245,0.55)",
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("annual")}
            role="tab"
            aria-selected={cycle === "annual"}
            className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all flex items-center gap-1.5"
            style={{
              background: cycle === "annual" ? "rgba(255,255,255,0.08)" : "transparent",
              color: cycle === "annual" ? "white" : "rgba(235,235,245,0.55)",
            }}
          >
            Annual
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: "rgba(48,209,88,0.18)",
                color: "#5EE6A1",
              }}
            >
              -{ANNUAL_DISCOUNT_PCT}%
            </span>
          </button>
        </div>

        <div
          className="inline-flex p-0.5 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
          role="tablist"
          aria-label="Currency"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => changeCurrency(c)}
              role="tab"
              aria-selected={currency === c}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={{
                background: currency === c ? "rgba(255,255,255,0.08)" : "transparent",
                color: currency === c ? "white" : "rgba(235,235,245,0.55)",
              }}
            >
              {CURRENCY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isHighlight = plan.highlight;
          const price = getDisplayPrice(id, currency, cycle);
          const monthlyEquivalent = getDisplayPrice(id, currency, "monthly");
          const showStrike = cycle === "annual" && id !== "FREE";
          const symbol = currencySymbol(currency);
          return (
            <div
              key={plan.id}
              className="relative p-6 rounded-2xl flex flex-col"
              style={{
                background: isHighlight
                  ? "linear-gradient(180deg, rgba(94,106,210,0.14), rgba(28,28,30,0.6))"
                  : "rgba(28,28,30,0.5)",
                border: isHighlight
                  ? "0.5px solid rgba(94,106,210,0.45)"
                  : "0.5px solid rgba(255,255,255,0.07)",
                boxShadow: isHighlight ? "0 24px 60px rgba(67,56,202,0.22)" : "none",
              }}
            >
              {isHighlight && (
                <span
                  className="absolute -top-2.5 left-6 px-2 py-0.5 rounded-md text-[10.5px] font-semibold"
                  style={{
                    background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(49,46,129,0.45)",
                  }}
                >
                  Most popular
                </span>
              )}
              <h3 className="text-[18px] font-semibold tracking-tight">{plan.name}</h3>
              <p className="text-[12.5px] text-white/55 mt-1 mb-5">{plan.tagline}</p>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-[36px] font-semibold tracking-tight">
                  {symbol}
                  {price}
                </span>
                <span className="text-[12.5px] text-white/45">/month</span>
                {showStrike && monthlyEquivalent > price && (
                  <span className="text-[12px] text-white/35 line-through ml-1.5">
                    {symbol}
                    {monthlyEquivalent}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/40 mb-5 h-4">
                {cycle === "annual" && id !== "FREE"
                  ? `Billed yearly · ${symbol}${price * 12}/yr`
                  : id === "FREE"
                  ? "Forever free"
                  : "Billed monthly · cancel anytime"}
              </p>

              <Link
                href={buildHref(plan.id)}
                className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-[13px] font-semibold mb-3 transition-all"
                style={
                  isHighlight
                    ? {
                        background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                        color: "white",
                        boxShadow:
                          "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 8px 24px rgba(49,46,129,0.45)",
                      }
                    : id === "FREE"
                    ? {
                        background: "rgba(255,255,255,0.05)",
                        color: "white",
                        border: "0.5px solid rgba(255,255,255,0.1)",
                      }
                    : {
                        background: "rgba(255,255,255,0.08)",
                        color: "white",
                        border: "0.5px solid rgba(255,255,255,0.14)",
                      }
                }
              >
                {plan.id === "FREE" ? "Start free" : `Get ${plan.name}`}
              </Link>

              {id !== "FREE" && (
                <p className="text-[10.5px] text-white/40 mb-4 flex items-center justify-center gap-1.5">
                  <Lock className="w-2.5 h-2.5" />
                  Secure Stripe checkout · cancel anytime
                </p>
              )}
              {id === "FREE" && (
                <p className="text-[10.5px] text-white/40 mb-4 text-center">
                  No credit card required
                </p>
              )}

              <ul className="space-y-2.5 text-[12.5px]">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className="w-3.5 h-3.5 mt-0.5 shrink-0"
                      style={{ color: isHighlight ? "#A5B4FC" : "rgba(52, 211, 153, 0.95)" }}
                    />
                    <span className="text-white/75">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 text-[11.5px] text-white/40 pt-2">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          Stripe-secured payments
        </span>
        <span className="hidden sm:inline">·</span>
        <span>Cancel anytime, no questions</span>
        <span className="hidden sm:inline">·</span>
        <span>Switch tiers any time</span>
      </div>
    </div>
  );
}
