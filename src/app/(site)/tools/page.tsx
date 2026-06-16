import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Clock, Gauge } from "lucide-react";
import { Hero, CtaBlock } from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import { TOOLS } from "@/content/site/tools";

const PATH = "/tools";

const ICONS = {
  calculator: Calculator,
  estimator: Clock,
  checker: Gauge,
} as const;

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Free tools — stack cost calculator, ramp estimator, signal checker",
  description:
    "Three ungated tools for vertical SaaS GTM teams. The Apollo+Clay+Gong stack cost calculator, the SDR ramp estimator, and the HubSpot signal coverage checker.",
});

export default function ToolsIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Free tools", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          TOOLS.map((t) => ({
            name: t.name,
            url: `/tools/${t.slug}`,
            description: t.summary,
          })),
        )}
      />

      <Hero
        eyebrow="Free tools"
        headline="Three ungated tools. No email wall, no demo redirect."
        subhead="Each tool answers a single, quantifiable question vertical SaaS GTM teams hit on a quarterly cadence. They run in the browser, write nothing to your CRM, and require zero login."
        primaryCta={{
          href: "/tools/apollo-stack-cost-calculator",
          label: "Calculate your stack cost",
        }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-6 md:grid-cols-3">
            {TOOLS.map((t) => {
              const Icon = ICONS[t.category];
              return (
                <Link
                  key={t.slug}
                  href={`/tools/${t.slug}`}
                  className="group flex flex-col rounded-2xl border border-ink-3 bg-ink-1 p-7 transition-colors hover:border-signal/50 hover:bg-ink-2"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-signal/30 bg-[hsl(218_50%_16%_/_0.4)]">
                    <Icon className="h-5 w-5 text-signal" />
                  </div>
                  <h2 className="mt-5 text-[20px] leading-tight text-paper-0">
                    {t.name}
                  </h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                    {t.summary}
                  </p>
                  <p className="mt-3 flex-1 text-[13px] leading-relaxed text-paper-3">
                    {t.payoff}
                  </p>
                  <div className="mt-5 flex items-center gap-2 text-[13px] text-paper-1 group-hover:text-signal">
                    Open the {t.category}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="See the system live"
        title="The tools answer one question each. The demo shows the full mechanism."
        subtitle="Bring your CRM to the call. We index one of your real accounts in real time, write the brief into HubSpot, and you decide if the loop is worth wiring."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />
    </>
  );
}
