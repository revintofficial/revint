"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { Check, Loader2, ExternalLink } from "lucide-react";
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

function bar(used: number, limit: number) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return { pct, color: pct >= 90 ? "#FF453A" : pct >= 70 ? "#FF9F0A" : "#0A84FF" };
}

export function BillingPanel({ plan, role, billingEnabled, usage }: BillingPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const canManage = role === "OWNER";
  const current = PLANS[plan];
  const leadsBar = bar(usage.leadsUsed, usage.leadsLimit);
  const aiBar = bar(usage.aiUsed, usage.aiLimit);

  async function startCheckout(target: Plan) {
    if (!billingEnabled) {
      toast.error("Billing is not configured. Add STRIPE_SECRET_KEY to .env.");
      return;
    }
    setBusy(target);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: target }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok || !data.url) {
      toast.error(data.error || "Failed to start checkout");
      return;
    }
    window.location.assign(data.url);
  }

  async function openPortal() {
    if (!billingEnabled) {
      toast.error("Billing is not configured.");
      return;
    }
    setBusy("portal");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    setBusy(null);
    if (!res.ok || !data.url) {
      toast.error(data.error || "Failed to open portal");
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="space-y-5">
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
                background: "rgba(255,159,10,0.07)",
                border: "0.5px solid rgba(255,159,10,0.2)",
                color: "#FFD37A",
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
            <CardTitle>Plans</CardTitle>
            <CardDescription>Upgrade or downgrade at any time.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              {PLAN_ORDER.map((id) => {
                const p = PLANS[id];
                const isCurrent = id === plan;
                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl flex flex-col"
                    style={{
                      background: isCurrent ? "rgba(10,132,255,0.07)" : "rgba(28,28,30,0.5)",
                      border: isCurrent
                        ? "0.5px solid rgba(10,132,255,0.35)"
                        : "0.5px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[14px] font-semibold">{p.name}</p>
                      {isCurrent && <Badge variant="success">Current</Badge>}
                    </div>
                    <p className="text-[11.5px] text-white/55 mb-3">{p.tagline}</p>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-[24px] font-semibold">${p.monthlyPrice}</span>
                      <span className="text-[11px] text-white/45">/mo</span>
                    </div>
                    <ul className="space-y-1.5 text-[12px] mb-4 flex-1">
                      {p.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="w-3 h-3 mt-0.5 shrink-0 text-[#30D158]" />
                          <span className="text-white/70">{f}</span>
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && id !== "FREE" && (
                      <Button
                        size="sm"
                        onClick={() => startCheckout(id)}
                        disabled={busy === id}
                        className="w-full"
                      >
                        {busy === id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Loading…</>
                        ) : plan === "FREE" || PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(plan) ? (
                          `Upgrade to ${p.name}`
                        ) : (
                          `Switch to ${p.name}`
                        )}
                      </Button>
                    )}
                    {!isCurrent && id === "FREE" && plan !== "FREE" && (
                      <Button size="sm" variant="outline" onClick={openPortal} className="w-full">
                        Downgrade in portal
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
