"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, PLAN_ORDER } from "@/lib/plans";

export function PricingCards({ ctaHref = "/signup" }: { ctaHref?: string }) {
  return (
    <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const isHighlight = plan.highlight;
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
              boxShadow: isHighlight
                ? "0 24px 60px rgba(67,56,202,0.22)"
                : "none",
            }}
          >
            {isHighlight && (
              <span
                className="absolute -top-2.5 left-6 px-2 py-0.5 rounded-md text-[10.5px] font-semibold"
                style={{
                  background: "linear-gradient(180deg, #6E7AE0, #4C5BC1)",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(67,56,202,0.35)",
                }}
              >
                Most popular
              </span>
            )}
            <h3 className="text-[18px] font-semibold tracking-tight">{plan.name}</h3>
            <p className="text-[12.5px] text-white/55 mt-1 mb-5">{plan.tagline}</p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-[36px] font-semibold tracking-tight">
                ${plan.monthlyPrice}
              </span>
              <span className="text-[12.5px] text-white/45">/month</span>
            </div>

            <Link
              href={
                plan.id === "FREE"
                  ? ctaHref
                  : ctaHref === "/signup"
                  ? "/signup"
                  : `/app/settings/billing?plan=${plan.id}`
              }
              className="w-full inline-flex items-center justify-center px-3 py-2 rounded-xl text-[13px] font-semibold mb-5 transition-all"
              style={
                isHighlight
                  ? {
                      background: "linear-gradient(180deg, #6E7AE0, #4C5BC1)",
                      color: "white",
                      boxShadow:
                        "0 1px 0 rgba(255,255,255,0.22) inset, 0 0 0 0.5px rgba(94,106,210,0.55), 0 8px 24px rgba(67,56,202,0.32)",
                    }
                  : {
                      background: "rgba(255,255,255,0.05)",
                      color: "white",
                      border: "0.5px solid rgba(255,255,255,0.1)",
                    }
              }
            >
              {plan.id === "FREE" ? "Start free" : `Get ${plan.name}`}
            </Link>

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
  );
}
