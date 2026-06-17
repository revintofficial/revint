/**
 * Top-of-page hero for the v2 marketing surface.
 *
 * Design intent: Apple-style, dark and quiet. A two-column lockup at lg+,
 * left holds the headline and CTAs, right holds the static AI flow card.
 * A subtle warm radial glow sits behind the headline. Primary CTA respects
 * MARKETING_COMING_SOON: when the flag is on, it renders as an inert span
 * with disabled styling so the page still feels balanced before signup
 * opens. No client JS, no Framer.
 *
 * Positioning (canonical, per docs/positioning.md §1.2 + §9):
 *   H-101 (headline): "Revenue intelligence for the teams selling to local business."
 *   H-102 (subhead):  "Your CRM knows the deal. We know the business behind it."
 *   S-101 (body):     "Revint finds your next 200 local accounts, syncs them into
 *                      HubSpot, and learns from every won and lost deal..."
 *   C-101 / C-102 CTAs.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";
import { LeadDetailBento } from "./lead-detail-bento";

export function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[520px]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, hsl(var(--revint-h) var(--revint-s) 50% / 0.18), transparent 70%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-6">
        <div className="grid gap-14 lg:gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-medium tracking-wide"
              style={{
                borderColor: "hsl(var(--revint-h) var(--revint-s) 50% / 0.28)",
                background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.06)",
                color: "hsl(var(--revint-h) var(--revint-s) 72%)",
              }}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "hsl(var(--revint-h) var(--revint-s) 60%)" }}
              />
              For vertical SaaS teams selling to local business
            </span>

            <h1
              className="mt-6 text-white font-semibold tracking-[-0.03em] leading-[1.02] max-w-[18ch]"
              style={{ fontSize: "clamp(36px, 6.4vw, 72px)" }}
            >
              Revenue intelligence for the teams selling to local business.
            </h1>

            <p className="mt-6 text-[17px] md:text-[19px] leading-relaxed text-white/80 max-w-[46ch] font-medium">
              Your CRM knows the deal. We know the business behind it.
            </p>

            <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-white/65 max-w-[48ch]">
              Revint finds your next 200 local accounts, syncs them into
              HubSpot, and learns from every won and lost deal you log. Built
              for vertical SaaS GTM teams selling into restaurant, HVAC,
              dental, legal, and field-service businesses.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              {MARKETING_COMING_SOON ? (
                <span
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold cursor-default select-none"
                  style={{
                    background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.18)",
                    color: "hsl(var(--revint-h) var(--revint-s) 78%)",
                    border:
                      "1px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.35)",
                  }}
                  aria-disabled="true"
                >
                  Launching soon
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none"
                    style={{
                      background: "hsl(var(--revint-h) var(--revint-s) 70%)",
                    }}
                  />
                </span>
              ) : (
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-black transition-shadow"
                  style={{
                    background:
                      "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-s) 72%) 0%, hsl(var(--revint-h) var(--revint-s) 58%) 100%)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.4) inset, 0 12px 36px hsl(var(--revint-h) var(--revint-s) 50% / 0.35)",
                  }}
                >
                  Book a 20-min demo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}

              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium text-white/85 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
              >
                See it on a sample account
              </Link>
            </div>

            <p className="mt-6 text-[13px] text-white/45">
              Already on Apollo + Clay + Gong?{" "}
              <Link
                href="/vs/apollo-clay-gong"
                className="text-white/70 hover:text-white underline-offset-4 hover:underline"
              >
                Read why we built something different
              </Link>
              .
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[32px]"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 50%, hsl(var(--revint-h) var(--revint-s) 50% / 0.12), transparent 70%)",
              }}
            />
            <LeadDetailBento />
          </div>
        </div>
      </div>
    </section>
  );
}
