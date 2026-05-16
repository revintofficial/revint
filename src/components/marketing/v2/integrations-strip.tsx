/**
 * Stack-compatibility strip for the v2 marketing surface.
 *
 * Design intent: a calm, single-line answer to the "will this fit my
 * setup" objection. Stylized text wordmarks only (no logo SVGs — those
 * require licensing). Lives outside Section so the strip can sit
 * tighter against neighboring blocks.
 */
import * as React from "react";

const PILLS: string[] = [
  "Gmail",
  "Outlook",
  "Smartlead",
  "Instantly",
  "Google Maps",
];

export function IntegrationsStrip() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <p className="text-center text-[12px] uppercase tracking-wider text-white/45">
          Works with your stack.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {PILLS.map((pill) => (
            <span
              key={pill}
              className="rounded-full px-4 py-2 text-[13px] text-white/75"
              style={{
                border: "0.5px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
