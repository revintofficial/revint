import type { Metadata } from "next";
import { Hero, CtaBlock } from "@/components/site/sections";
import { SdrRampWidget } from "@/components/site/tools/sdr-ramp-widget";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  toolApplicationSchema,
} from "@/components/seo/json-ld";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/tools/sdr-ramp-estimator";
const TITLE = "SDR ramp time estimator";
const DESCRIPTION =
  "Three inputs — loaded SDR cost, current ramp weeks, target ramp weeks. See the dollar cost of un-recovered ramp today and the saved cost of cutting it.";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: `${TITLE} — free tool`,
  description: DESCRIPTION,
});

export default function SdrRampEstimatorPage() {
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
        eyebrow="Free tool · estimator"
        headline="What does your SDR ramp time actually cost?"
        subhead="Eleven weeks of ramp at $80K loaded cost is $16,900 of un-recovered payroll before the rep produces a single closed-won. This estimator quantifies the gap — and the saved cost of closing it."
        primaryCta={{ href: "#estimator", label: "Run the estimator" }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />

      <section id="estimator" className="site-section">
        <div className="site-container">
          <SdrRampWidget />
          <p className="mt-6 text-[12px] text-paper-3">
            Median 11-week ramp from the 2026 vertical SaaS GTM benchmark
            (200 teams). Median 6-week ramp from the Revint customer
            cohort running pre-call brief inside HubSpot.
          </p>
        </div>
      </section>

      <CtaBlock
        eyebrow="The mechanism"
        title="Ramp drops because new SDRs inherit the operational pattern."
        subtitle="The pre-call brief carries the pattern that used to live in your best SDR's head. New hires read it on day one instead of building it over eleven weeks."
        primaryCta={{
          href: "/manifesto",
          label: "Read the operational-memory thesis",
        }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />
    </>
  );
}
