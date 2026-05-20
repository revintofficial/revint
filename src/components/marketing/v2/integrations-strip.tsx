/**
 * Stack-compatibility strip for the v2 marketing surface.
 *
 * Design intent: knock down two stack-compat objections in one row each:
 * "do you fit my sender" and "do you fit my dialer". Stylized text
 * wordmarks only (no logo SVGs, those require licensing). Lives outside
 * Section so the strip can sit tighter against neighboring blocks.
 *
 * Per the F&B BD cold-call pod RFC at
 * `.agents/homepage-strategist/proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`
 * and per-section spec at
 * `.agents/homepage-strategist/proposals/specs/2026-05-20-fnb-bd-pod-integrations-strip.md`.
 */
import * as React from "react";

const SENDERS: string[] = ["Gmail", "Outlook", "Smartlead", "Instantly", "GHL"];
const DIALERS: string[] = ["Aircall", "Bring your own"];

function Pill({ label }: { label: string }) {
  return (
    <span
      className="rounded-full px-4 py-2 text-[13px] text-white/75"
      style={{
        border: "0.5px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {label}
    </span>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-center md:text-left"
      style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 62%)" }}
    >
      {children}
    </p>
  );
}

export function IntegrationsStrip() {
  return (
    <section className="py-16" data-section="integrations-strip">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <p className="text-center text-[12px] uppercase tracking-wider text-white/45">
          Works with your stack.
        </p>

        <div className="mt-8 space-y-6">
          <div role="group" aria-label="Sender integrations" className="space-y-3">
            <RowLabel>Senders</RowLabel>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {SENDERS.map((pill) => (
                <Pill key={pill} label={pill} />
              ))}
            </div>
          </div>

          <div role="group" aria-label="Dialer integrations" className="space-y-3">
            <RowLabel>Dialers</RowLabel>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {DIALERS.map((pill) => (
                <Pill key={pill} label={pill} />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[12.5px] text-white/50">
          Wire your own dialer or sender. We do not replace either.
        </p>
      </div>
    </section>
  );
}
