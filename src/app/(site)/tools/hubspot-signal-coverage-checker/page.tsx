import type { Metadata } from "next";
import { Hero, CtaBlock } from "@/components/site/sections";
import { SignalCoverageWidget } from "@/components/site/tools/signal-coverage-widget";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  toolApplicationSchema,
} from "@/components/seo/json-ld";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/tools/hubspot-signal-coverage-checker";
const TITLE = "HubSpot signal coverage checker";
const DESCRIPTION =
  "Paste a list of HubSpot company-record fields. We bucket each one into firmographic, vertical stack, owner activity, or scale & expansion — and report the operational signal coverage gap.";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: `${TITLE} — free tool`,
  description: DESCRIPTION,
});

export default function HubspotSignalCoveragePage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Free tools", url: "/tools" },
          { name: TITLE, url: PATH },
        ])}
      />
      <JsonLd
        id="ld-tool"
        data={toolApplicationSchema({
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE.url}${PATH}`,
        })}
      />

      <Hero
        eyebrow="Free tool · checker"
        headline="What percent of your HubSpot company fields carry operational signal?"
        subhead="Most HubSpot company records carry firmographic fields — industry, employees, revenue. Almost none carry the operational signals that actually predict close rate. This tool quantifies the gap in seconds."
        primaryCta={{ href: "#checker", label: "Run the checker" }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />

      <section id="checker" className="site-section">
        <div className="site-container">
          <SignalCoverageWidget />
          <p className="mt-6 text-[12px] text-paper-3">
            Field classification uses token matching across firmographic,
            vertical stack, owner activity, and scale & expansion
            categories. Nothing leaves the browser — the input is not
            sent to a server.
          </p>
        </div>
      </section>

      <CtaBlock
        eyebrow="Fill the gap"
        title="Revint writes the operational fields next to your firmographic ones."
        subtitle="Twelve fields per company record on day one — vertical stack, location count, owner activity, expansion tag, suggested opener. Same HubSpot company object your team already opens."
        primaryCta={{
          href: "/integrations/hubspot",
          label: "Read the HubSpot integration",
        }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />
    </>
  );
}
