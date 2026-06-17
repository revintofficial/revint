"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PLANS,
  PLAN_ORDER,
  ANNUAL_DISCOUNT_PCT,
  currencySymbol,
  detectBrowserCurrency,
  getDisplayPrice,
  SUPPORTED_CURRENCIES,
  type BillingCycle,
  type Currency,
} from "@/lib/plans";
import { Check, Loader2, ExternalLink, Lock, ShieldCheck, Sparkles } from "lucide-react";
import type { Plan } from "@/generated/prisma/client";
import { toast } from "sonner";

interface BillingPanelProps {
  plan: Plan;
  role: "OWNER" | "ADMIN" | "MEMBER";
  billingEnabled: boolean;
  usage: {
    leadsUsed: number;
    leadsLimit: number;
    aiUsed: number;
    aiLimit: number;
  };
}

const CURRENCY_LABEL: Record<Currency, string> = { USD: "USD ($)", GBP: "GBP (£)" };

function bar(used: number, limit: number) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return {
    pct,
    color:
      pct >= 90
        ? "var(--revint-error)"
        : pct >= 70
          ? "var(--revint-warning)"
          : "var(--revint-500)",
  };
}

export function BillingPanel({ plan, role, billingEnabled, usage }: BillingPanelProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState<Currency>("USD");
  const autoCheckoutFiredRef = useRef(false);

  const canManage = role === "OWNER";
  const current = PLANS[plan];
  const leadsBar = bar(usage.leadsUsed, usage.leadsLimit);
  const aiBar = bar(usage.aiUsed, usage.aiLimit);

  // Initial currency: URL param > localStorage > navigator. Initial cycle:
  // URL param > localStorage > monthly. Once we mount, persist whatever the
  // user actually selects so the next visit feels familiar.
  useEffect(() => {
    const urlCurrency = params.get("currency");
    if (urlCurrency === "USD" || urlCurrency === "GBP") {
      setCurrency(urlCurrency);
    } else {
      try {
        const stored = localStorage.getItem("le.currency");
        if (stored === "USD" || stored === "GBP") setCurrency(stored);
        else setCurrency(detectBrowserCurrency());
      } catch {
        setCurrency(detectBrowserCurrency());
      }
    }
    const urlCycle = params.get("cycle");
    if (urlCycle === "monthly" || urlCycle === "annual") {
      setCycle(urlCycle);
    } else {
      try {
        const stored = localStorage.getItem("le.cycle");
        if (stored === "monthly" || stored === "annual") setCycle(stored);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeCurrency(next: Currency) {
    setCurrency(next);
    try { localStorage.setItem("le.currency", next); } catch { /* ignore */ }
  }
  function changeCycle(next: BillingCycle) {
    setCycle(next);
    try { localStorage.setItem("le.cycle", next); } catch { /* ignore */ }
  }

  // Surface the result of a Stripe checkout round-trip. The webhook handles
  // the actual plan upgrade; this is purely UX feedback so the user sees that
  // their action landed (instead of a silent reload back to the same page).
  useEffect(() => {
    if (params.get("success") === "1") {
      toast.success("You're upgraded!", {
        description: "Your new plan is active. Welcome aboard.",
        duration: 6000,
      });
      router.replace("/app/settings/billing");
    } else if (params.get("canceled") === "1") {
      toast("Checkout canceled", {
        description: "No charge was made. You can resume any time.",
      });
      router.replace("/app/settings/billing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout(target: Plan, opts?: { silent?: boolean }) {
    if (!billingEnabled) {
      if (!opts?.silent) toast.error("Billing is not configured. Add STRIPE_SECRET_KEY to .env.");
      return;
    }
    setBusy(target);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target, currency, cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (!opts?.silent) toast.error(data.error || "Failed to start checkout");
        setBusy(null);
        return;
      }
      setRedirecting(true);
      window.location.assign(data.url);
    } catch (err) {
      if (!opts?.silent) toast.error("Network error. Please try again.");
      setBusy(null);
      console.error(err);
    }
  }

  // Auto-trigger checkout when the user arrived with `?plan=PRO_TEAM&autocheckout=1`
  // (e.g. clicked a pricing-card CTA, signed up, and got bounced here). Only
  // fires once per mount. Skip silently if billing is disabled or the user is
  // not the workspace owner.
  useEffect(() => {
    if (autoCheckoutFiredRef.current) return;
    const wantsAutocheckout = params.get("autocheckout") === "1";
    const planParam = params.get("plan");
    if (!wantsAutocheckout) return;
    if (!planParam || (planParam !== "PRO" && planParam !== "PRO_TEAM" && planParam !== "AGENCY")) return;
    if (!billingEnabled || !canManage) return;
    if (planParam === plan) {
      // Already on this plan - just toast and clean URL.
      toast.success(`You're already on ${PLANS[planParam].name}.`);
      router.replace("/app/settings/billing");
      return;
    }
    autoCheckoutFiredRef.current = true;
    void startCheckout(planParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingEnabled, canManage]);

  async function openPortal() {
    if (!billingEnabled) {
      toast.error("Billing is not configured.");
      return;
    }
    setBusy("portal");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.url) {
      toast.error(data.error || "Failed to open portal");
      setBusy(null);
      return;
    }
    setRedirecting(true);
    window.location.assign(data.url);
  }

  return (
    <div className="space-y-5 relative">
      {/* Full-screen redirect overlay - prevents the user from clicking again
          while Stripe loads, and gives them clear "something is happening" UX
          instead of a button-only spinner. */}
      {redirecting && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="px-6 py-5 rounded-2xl flex items-center gap-3 max-w-sm"
            style={{
              background: "hsl(var(--revint-h) var(--revint-ns) 11% / 0.95)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin text-(--revint-500)" />
            <div>
              <p className="text-[14px] font-semibold text-white">Redirecting to secure checkout</p>
              <p className="text-[12px] text-white/55 flex items-center gap-1.5 mt-0.5">
                <Lock className="w-3 h-3" />
                Powered by Stripe · 256-bit encryption
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>{current.tagline}</CardDescription>
            </div>
            <Badge variant={plan === "FREE" ? "secondary" : "success"}>{current.name}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-5 mb-5">
            <div>
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-white/55">Leads this cycle</span>
                <span className="font-medium text-white">
                  {usage.leadsUsed.toLocaleString()} / {usage.leadsLimit.toLocaleString()}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${leadsBar.pct}%`, backgroundColor: leadsBar.color }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-white/55">AI credits this cycle</span>
                <span className="font-medium text-white">
                  {usage.aiUsed.toLocaleString()} / {usage.aiLimit.toLocaleString()}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${aiBar.pct}%`, backgroundColor: aiBar.color }}
                />
              </div>
            </div>
          </div>

          {plan !== "FREE" && canManage && (
            <Button onClick={openPortal} disabled={busy === "portal"} variant="outline">
              {busy === "portal" ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Opening…</>
              ) : (
                <><ExternalLink className="w-3.5 h-3.5" />Manage subscription</>
              )}
            </Button>
          )}

          {!billingEnabled && (
            <div
              className="mt-4 px-3 py-2 rounded-lg text-[12px]"
              style={{
                background: "color-mix(in oklab, var(--revint-warning) 7%, transparent)",
                border: "0.5px solid color-mix(in oklab, var(--revint-warning) 20%, transparent)",
                color: "hsl(38 50% 70%)",
              }}
            >
              Billing is not configured. Add <code className="text-white">STRIPE_SECRET_KEY</code>,{" "}
              <code className="text-white">STRIPE_WEBHOOK_SECRET</code>, and price IDs to{" "}
              <code className="text-white">.env</code> to enable upgrades.
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <CardTitle>Plans</CardTitle>
                <CardDescription>Upgrade or downgrade at any time.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex p-0.5 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                  }}
                  role="tablist"
                  aria-label="Billing cycle"
                >
                  <button
                    onClick={() => changeCycle("monthly")}
                    role="tab"
                    aria-selected={cycle === "monthly"}
                    className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all"
                    style={{
                      background: cycle === "monthly" ? "rgba(255,255,255,0.08)" : "transparent",
                      color: cycle === "monthly" ? "white" : "hsl(var(--revint-h) var(--revint-nts) 92% / 0.55)",
                    }}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => changeCycle("annual")}
                    role="tab"
                    aria-selected={cycle === "annual"}
                    className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all flex items-center gap-1"
                    style={{
                      background: cycle === "annual" ? "rgba(255,255,255,0.08)" : "transparent",
                      color: cycle === "annual" ? "white" : "hsl(var(--revint-h) var(--revint-nts) 92% / 0.55)",
                    }}
                  >
                    Annual
                    <span
                      className="text-[9.5px] font-semibold px-1 py-0.5 rounded"
                      style={{
                        background: "color-mix(in oklab, var(--revint-success) 20%, transparent)",
                        color: "var(--revint-success-soft)",
                      }}
                    >
                      -{ANNUAL_DISCOUNT_PCT}%
                    </span>
                  </button>
                </div>
                <div
                  className="inline-flex p-0.5 rounded-lg"
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
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                      style={{
                        background: currency === c ? "rgba(255,255,255,0.08)" : "transparent",
                        color: currency === c ? "white" : "hsl(var(--revint-h) var(--revint-nts) 92% / 0.55)",
                      }}
                    >
                      {CURRENCY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              {PLAN_ORDER.filter((id) => id !== "FREE").map((id) => {
                const p = PLANS[id];
                const isCurrent = id === plan;
                const isHighlight = p.highlight && !isCurrent;
                const price = getDisplayPrice(id, currency, cycle);
                const monthlyEquivalent = getDisplayPrice(id, currency, "monthly");
                const symbol = currencySymbol(currency);
                const isUpgrade = plan === "FREE" || PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(plan);
                return (
                  <div
                    key={id}
                    className="relative p-4 rounded-xl flex flex-col"
                    style={{
                      background: isCurrent
                        ? "hsl(var(--revint-h) var(--revint-s) 50% / 0.07)"
                        : isHighlight
                        ? "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-s) 60% / 0.14), hsl(var(--revint-h) var(--revint-ns) 11% / 0.5))"
                        : "hsl(var(--revint-h) var(--revint-ns) 11% / 0.5)",
                      border: isCurrent
                        ? "0.5px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.35)"
                        : isHighlight
                        ? "0.5px solid hsl(var(--revint-h) var(--revint-s) 60% / 0.45)"
                        : "0.5px solid rgba(255,255,255,0.06)",
                      boxShadow: isHighlight ? "0 16px 40px hsl(var(--revint-h) var(--revint-s) 50% / 0.18)" : "none",
                    }}
                  >
                    {isHighlight && (
                      <span
                        className="absolute -top-2 left-4 px-1.5 py-0.5 rounded text-[9.5px] font-semibold"
                        style={{
                          background: "linear-gradient(180deg, var(--revint-500), var(--revint-700))",
                          color: "white",
                        }}
                      >
                        Most popular
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[14px] font-semibold">{p.name}</p>
                      {isCurrent && <Badge variant="success">Current</Badge>}
                    </div>
                    <p className="text-[11.5px] text-white/55 mb-3">{p.tagline}</p>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-[24px] font-semibold">
                        {symbol}{price}
                      </span>
                      <span className="text-[11px] text-white/45">/mo</span>
                      {cycle === "annual" && monthlyEquivalent > price && (
                        <span className="text-[11px] text-white/35 line-through ml-1">
                          {symbol}{monthlyEquivalent}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-white/40 mb-4">
                      {cycle === "annual"
                        ? `${symbol}${price * 12}/yr · save ${ANNUAL_DISCOUNT_PCT}%`
                        : "Billed monthly"}
                    </p>
                    <ul className="space-y-1.5 text-[12px] mb-4 flex-1">
                      {p.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="w-3 h-3 mt-0.5 shrink-0 text-[hsl(152_48%_50%)]" />
                          <span className="text-white/70">{f}</span>
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => startCheckout(id)}
                          disabled={busy === id || redirecting}
                          className="w-full"
                          style={isHighlight ? {
                            background: "linear-gradient(180deg, var(--revint-500), var(--revint-700))",
                            color: "white",
                            boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 20px hsl(var(--revint-h) var(--revint-s) 34% / 0.4)",
                          } : undefined}
                        >
                          {busy === id ? (
                            <><Loader2 className="w-3 h-3 animate-spin" />Loading…</>
                          ) : isUpgrade ? (
                            <>
                              <Sparkles className="w-3 h-3" />
                              {`Upgrade to ${p.name}`}
                            </>
                          ) : (
                            `Switch to ${p.name}`
                          )}
                        </Button>
                        <p className="mt-2 text-[10px] text-white/40 flex items-center justify-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Stripe · cancel anytime
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/40">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                Stripe-secured payments
              </span>
              <span>·</span>
              <span>Prorated upgrades</span>
              <span>·</span>
              <span>Cancel any time, no questions</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
