/**
 * Final CTA section for the v2 marketing surface.
 *
 * Design intent: one last calm push. Big centered headline, short sub,
 * two CTAs, and a small reassurance line below. Respects
 * MARKETING_COMING_SOON: primary becomes inert "Launching soon",
 * secondary swaps to an email link to the founder, and the
 * "14-day trial" microcopy is hidden so the section stays honest.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";
import { Section } from "./section";

export function FinalCta() {
  return (
    <Section className="py-32 md:py-40">
      <div className="text-center max-w-3xl mx-auto">
        <h2
          className="text-white font-semibold tracking-[-0.03em] leading-[1.05]"
          style={{ fontSize: "clamp(36px, 5.4vw, 60px)" }}
        >
          Wire LeadAC into your BD pod&apos;s morning queue.
        </h2>
        <p className="mt-6 text-[16px] md:text-[17px] text-white/65 leading-relaxed max-w-xl mx-auto">
          Pick a postcode, pick a niche, and the first 47 audited briefs land
          in your pod&apos;s tab in five minutes, ready for the dial.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {MARKETING_COMING_SOON ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold cursor-default select-none"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.35)",
              }}
              aria-disabled="true"
            >
              Launching soon
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none"
                style={{
                  background: "hsl(var(--leadac-h) var(--leadac-s) 70%)",
                }}
              />
            </span>
          ) : (
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-black"
              style={{
                background:
                  "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 72%) 0%, hsl(var(--leadac-h) var(--leadac-s) 58%) 100%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.4) inset, 0 12px 36px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.35)",
              }}
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          {MARKETING_COMING_SOON ? (
            <a
              href="mailto:mert@leadacai.com"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium text-white/85 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            >
              Email the founder
            </a>
          ) : (
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-medium text-white/85 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            >
              Book a 15-min walkthrough
            </Link>
          )}
        </div>

        {!MARKETING_COMING_SOON && (
          <p className="mt-5 text-[12px] text-white/45">
            14-day trial · cancel any time · no setup call required.
          </p>
        )}
      </div>
    </Section>
  );
}
