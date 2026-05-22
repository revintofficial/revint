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

const PATH = "/alternatives";

const ALT_PAGES = [
  {
    slug: "apollo",
    name: "Apollo alternatives",
    description:
      "Five alternatives ranked by the segment where Apollo's contact-database primitive runs out of road for vertical SaaS GTM.",
  },
  {
    slug: "clay",
    name: "Clay alternatives",
    description:
      "Five finished-product alternatives for vertical SaaS GTM teams without a GTM engineer to operate Clay's workshop.",
  },
];

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Alternatives — Apollo, Clay, and the rest of the outbound stack",
  description:
    "Honest comparisons of Apollo, Clay, and other outbound tools, sorted by the segment each one actually fits. No leaderboards — different primitives for different teams.",
});

export default function AlternativesIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Alternatives", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          ALT_PAGES.map((p) => ({
            name: p.name,
            url: `/alternatives/${p.slug}`,
            description: p.description,
          })),
        )}
      />

      <Hero
        eyebrow="Alternatives"
        headline="A menu, not a leaderboard."
        subhead="Each outbound tool is a different primitive — contact database, workflow runtime, sender, operational memory. The right alternative depends on what your team already has and what it lacks."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/vs/apollo-clay-gong", label: "Compare the full stack" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-6 md:grid-cols-2">
            {ALT_PAGES.map((p) => (
              <Link
                key={p.slug}
                href={`/alternatives/${p.slug}`}
                className="group rounded-2xl border border-ink-3 bg-ink-1 p-8 transition-colors hover:border-signal/50 hover:bg-ink-2"
              >
                <h2 className="text-[22px] leading-tight text-paper-0">
                  {p.name}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                  {p.description}
                </p>
                <div className="mt-5 flex items-center gap-2 text-[13px] text-paper-1 group-hover:text-signal">
                  Read the page
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="Don't see your tool"
        title="Tell us which competitor you're evaluating against. We'll write an honest comparison."
        subtitle="We publish comparison pages quarterly. If you're evaluating LeadAC against a tool we haven't covered, mention it on the demo call and we'll add it to the queue."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />
    </>
  );
}
