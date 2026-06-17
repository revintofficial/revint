/**
 * Stack-compatibility strip for the v2 marketing surface.
 *
 * Design intent: position Revint as the revenue intelligence layer
 * that sits on top of the GTM stack vertical SaaS teams already run.
 * Brand logos rendered from `public/integrations/` (SimpleIcons-style
 * monoglyphs in brand color), arranged in two rows by role:
 *   1. CRM       — the systems-of-record we read closed-won/lost from
 *   2. Execution — outreach, inbox, dialer, calendar we write into
 * A small footer row hints at the long tail (Zapier / Make / n8n /
 * webhooks). The strip lives outside <Section> so it can sit tighter
 * against neighboring blocks. Pure server, no JS.
 *
 * Brand marks are reproduced here under nominative fair use to show
 * compatibility. Each SVG ships in `public/integrations/` and is
 * referenced by its filename. Adding a new integration = drop the SVG
 * there + push to the SOURCES / EXECUTION arrays below. Rendered with
 * plain <img> (not next/image) because Next.js's image optimizer
 * refuses local SVGs unless `dangerouslyAllowSVG` is enabled in
 * `next.config.mjs`, and these are tiny static assets that don't need
 * optimization in the first place.
 */
import * as React from "react";

interface Brand {
  name: string;
  file: string;
}

const SOURCES: Brand[] = [
  { name: "HubSpot", file: "hubspot.svg" },
  { name: "Salesforce", file: "salesforce.svg" },
  { name: "GoHighLevel", file: "gohighlevel.svg" },
  { name: "Apollo", file: "apollo-io.svg" },
  { name: "Slack", file: "slack.svg" },
  { name: "LinkedIn", file: "linkedin.svg" },
];

const EXECUTION: Brand[] = [
  { name: "Smartlead", file: "smartlead.svg" },
  { name: "Instantly", file: "instantly.svg" },
  { name: "Gmail", file: "gmail.svg" },
  { name: "Outlook", file: "outlook.svg" },
  { name: "Twilio", file: "twilio.svg" },
  { name: "Calendly", file: "calendly.svg" },
];

const LONG_TAIL: Brand[] = [
  { name: "Zapier", file: "zapier.svg" },
  { name: "Make", file: "make.svg" },
  { name: "n8n", file: "n8n.svg" },
  { name: "Webhooks", file: "webhook.svg" },
];

function BrandPill({ brand }: { brand: Brand }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium text-white/85 transition-colors hover:text-white"
      style={{
        border: "0.5px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/integrations/${brand.file}`}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] shrink-0"
        aria-hidden
      />
      <span>{brand.name}</span>
    </span>
  );
}

function SmallBrandPill({ brand }: { brand: Brand }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-white/65"
      style={{
        border: "0.5px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.015)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/integrations/${brand.file}`}
        alt=""
        width={14}
        height={14}
        className="h-[14px] w-[14px] shrink-0"
        aria-hidden
      />
      <span>{brand.name}</span>
    </span>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-center md:text-left"
      style={{ color: "hsl(var(--revint-h) var(--revint-s) 62%)" }}
    >
      {children}
    </p>
  );
}

export function IntegrationsStrip() {
  return (
    <section className="py-20" data-section="integrations-strip">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <header className="text-center max-w-2xl mx-auto">
          <p
            className="text-[11.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 62%)" }}
          >
            Integrations
          </p>
          <h2
            className="mt-4 text-white font-semibold tracking-[-0.025em] leading-[1.12]"
            style={{ fontSize: "clamp(26px, 3.8vw, 38px)" }}
          >
            Sits on top of the GTM stack you already run.
          </h2>
          <p className="mt-4 text-[14.5px] md:text-[15.5px] leading-relaxed text-white/55">
            CRMs, enrichment, sequencing, inbox, and dialer. Read in place,
            written back natively. Operated as one model.
          </p>
        </header>

        <div className="mt-12 space-y-8">
          <div role="group" aria-label="CRM and signal" className="space-y-3">
            <RowLabel>CRM &amp; signal</RowLabel>
            <div className="flex flex-wrap justify-center md:justify-start gap-2.5">
              {SOURCES.map((b) => (
                <BrandPill key={b.name} brand={b} />
              ))}
            </div>
          </div>

          <div
            role="group"
            aria-label="Outreach, inbox, dialer, calendar"
            className="space-y-3"
          >
            <RowLabel>Outreach, inbox, dialer &amp; calendar</RowLabel>
            <div className="flex flex-wrap justify-center md:justify-start gap-2.5">
              {EXECUTION.map((b) => (
                <BrandPill key={b.name} brand={b} />
              ))}
            </div>
          </div>

          <div
            role="group"
            aria-label="Automation and webhooks"
            className="space-y-3 pt-2"
          >
            <RowLabel>Everything else, via</RowLabel>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              {LONG_TAIL.map((b) => (
                <SmallBrandPill key={b.name} brand={b} />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-[12.5px] text-white/45 max-w-2xl mx-auto leading-relaxed">
          Brand names and logos are property of their respective owners and
          shown to indicate stack compatibility. Nothing to migrate — Revint
          reads what you already use and operates it as one model.
        </p>
      </div>
    </section>
  );
}
