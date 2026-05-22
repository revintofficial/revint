import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero, CtaBlock } from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  itemListSchema,
} from "@/components/seo/json-ld";

const PATH = "/integrations";

const INTEGRATIONS = [
  {
    slug: "hubspot",
    name: "HubSpot",
    status: "Native · day one",
    description:
      "OAuth in 30 minutes. 12 enriched fields per company record. Closed-loop deal-outcome ingestion via HubSpot webhooks.",
  },
  {
    slug: "smartlead",
    name: "Smartlead",
    status: "Native · day one",
    description:
      "Webhook handoff. LeadAC fills Smartlead merge variables with per-account context. Replies flow back into the closed loop.",
  },
];

const ROADMAP = [
  { name: "Pipedrive", eta: "Q2 2026" },
  { name: "Close", eta: "Q2 2026" },
  { name: "Instantly", eta: "Q3 2026" },
  { name: "Outreach", eta: "Q3 2026" },
  { name: "Salesforce", eta: "Q3 2026 — Enterprise tier" },
  { name: "Apollo Sequences", eta: "Q4 2026" },
];

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Integrations — HubSpot and Smartlead native, more on the roadmap",
  description:
    "LeadAC ships native HubSpot and Smartlead on day one. Pipedrive, Close, Instantly, Outreach, and Salesforce follow on a dated roadmap.",
});

export default function IntegrationsIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Integrations", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          INTEGRATIONS.map((i) => ({
            name: i.name,
            url: `/integrations/${i.slug}`,
            description: i.description,
          })),
        )}
      />

      <Hero
        eyebrow="Integrations"
        headline="Two native integrations on day one. A dated roadmap for the rest."
        subhead="We ship HubSpot and Smartlead first because that is where our buyer lives. Every other integration is on a public roadmap with a date — no vague 'coming soon'."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/integrations/hubspot", label: "Read the HubSpot page" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="site-eyebrow mb-3">Native today</div>
            <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              The two integrations that ship on day one.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {INTEGRATIONS.map((i) => (
              <Link
                key={i.slug}
                href={`/integrations/${i.slug}`}
                className="group block rounded-2xl border border-ink-3 bg-ink-1 p-8 transition-colors hover:border-signal/50 hover:bg-ink-2"
              >
                <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
                  {i.status}
                </div>
                <h3 className="mt-3 text-[22px] leading-tight text-paper-0">
                  {i.name}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                  {i.description}
                </p>
                <div className="mt-5 flex items-center gap-2 text-[13px] text-paper-1 group-hover:text-signal">
                  Read the integration page
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="site-eyebrow mb-3">Roadmap</div>
            <h2 className="text-[26px] leading-tight tracking-tight text-paper-0 md:text-[36px]">
              What ships next, and when.
            </h2>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border border-ink-3">
            <table className="min-w-full divide-y divide-ink-3">
              <thead className="bg-ink-1">
                <tr>
                  <th className="px-5 py-4 text-left text-[12px] uppercase tracking-wider text-paper-3">
                    Integration
                  </th>
                  <th className="px-5 py-4 text-left text-[12px] uppercase tracking-wider text-paper-3">
                    Target ship
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-3 bg-ink-0">
                {ROADMAP.map((r) => (
                  <tr key={r.name}>
                    <td className="px-5 py-4 text-[15px] text-paper-0">
                      {r.name}
                    </td>
                    <td className="px-5 py-4 site-mono text-[13px] text-paper-2">
                      {r.eta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] text-paper-3">
            Need an integration that's not listed? Mention it on the demo
            call — we ship one new integration per month based on customer
            ask.
          </p>
        </div>
      </section>

      <CtaBlock
        eyebrow="The integration in action"
        title="Bring your CRM to the call. We'll wire it live."
        subtitle="HubSpot OAuth runs in 30 minutes. Smartlead webhook takes 10. You see one of your own accounts get a brief inside the first hour of the demo."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
