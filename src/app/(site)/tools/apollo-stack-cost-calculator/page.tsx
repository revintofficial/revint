import type { Metadata } from "next";
import { Hero, CtaBlock } from "@/components/site/sections";
import { StackCostWidget } from "@/components/site/tools/stack-cost-widget";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  toolApplicationSchema,
} from "@/components/seo/json-ld";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/tools/apollo-stack-cost-calculator";
const TITLE = "Apollo + Clay + Gong stack cost calculator";
const DESCRIPTION =
  "Punch in your seat count and tool mix. See the real annual stack cost with the verification add-ons most teams forget to list — compared to the Revint Team annual.";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: `${TITLE} — free tool`,
  description: DESCRIPTION,
});

export default function ApolloStackCostCalculatorPage() {
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
        eyebrow="Free tool · calculator"
        headline="What does your Apollo + Clay + Gong stack actually cost?"
        subhead="The sticker price quoted on each vendor's pricing page is not the cost you pay. Verification, dialer add-ons, and per-seat overages stack on top. This calculator does the math out loud."
        primaryCta={{ href: "#calculator", label: "Use the calculator" }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />

      <section id="calculator" className="site-section">
        <div className="site-container">
          <StackCostWidget />
          <p className="mt-6 text-[12px] text-paper-3">
            Pricing inputs sourced from Apollo, Clay, Gong, and Outreach
            public pricing pages, audited May 2026. Email verification
            baselines use ZeroBounce, NeverBounce, and BriteVerify floor
            tiers.
          </p>
        </div>
      </section>

      <CtaBlock
        eyebrow="The reframe"
        title="Your stack cost is not the problem. The shared substrate is."
        subtitle="Even if your stack lands at $11K/yr instead of $29K/yr, the four tools still don't share a memory layer. Read the full reframe in the vs Apollo + Clay + Gong comparison."
        primaryCta={{
          href: "/vs/apollo-clay-gong",
          label: "Read the stack reframe",
        }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />
    </>
  );
}
