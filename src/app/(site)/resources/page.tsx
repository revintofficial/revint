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
  collectionPageSchema,
} from "@/components/seo/json-ld";
import { RESOURCES } from "@/content/site/resources";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/resources";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Resources — annual GTM benchmark, playbooks, guides",
  description:
    "Cornerstone resources for vertical SaaS GTM teams. The annual benchmark dataset, the Apollo bounce-rate playbook, and the guide to closed-loop ICP refinement.",
});

export default function ResourcesIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Resources", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-coll"
        data={collectionPageSchema({
          name: "LeadAC resources",
          description:
            "Cornerstone resources for vertical SaaS GTM teams — annual benchmark, playbooks, and guides.",
          url: `${SITE.url}${PATH}`,
        })}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          RESOURCES.map((r) => ({
            name: r.title,
            url: `/resources/${r.slug}`,
            description: r.summary,
          })),
        )}
      />

      <Hero
        eyebrow="Resources"
        headline="Three cornerstone resources. No content mill."
        subhead="One annual benchmark dataset. One playbook for the most common Apollo problem. One guide to the mechanism that defines our category. We publish quarterly — not weekly — so each piece carries weight."
        primaryCta={{
          href: "/resources/2026-vertical-saas-gtm-benchmark",
          label: "Read the 2026 benchmark",
        }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-6 md:grid-cols-3">
            {RESOURCES.map((r) => (
              <Link
                key={r.slug}
                href={`/resources/${r.slug}`}
                className="group flex flex-col rounded-2xl border border-ink-3 bg-ink-1 p-7 transition-colors hover:border-signal/50 hover:bg-ink-2"
              >
                <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
                  {r.kind}
                </div>
                <h2 className="mt-3 text-[20px] leading-tight text-paper-0">
                  {r.title}
                </h2>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-paper-2">
                  {r.summary}
                </p>
                <div className="mt-5 flex items-center justify-between gap-3 text-[12px] text-paper-3">
                  <span>
                    {new Date(r.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1 text-paper-1 group-hover:text-signal">
                    Read
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="Want the benchmark dataset"
        title="The 2026 vertical SaaS GTM benchmark is gated by an email — and worth it."
        subtitle="200 vertical SaaS teams, $2M to $50M ARR, surveyed across tool spend, SDR ramp, and account-research time. CSV download under Creative Commons BY-NC-SA."
        primaryCta={{
          href: "/resources/2026-vertical-saas-gtm-benchmark",
          label: "Get the benchmark",
        }}
        secondaryCta={{ href: "/blog", label: "Read the blog" }}
      />
    </>
  );
}
