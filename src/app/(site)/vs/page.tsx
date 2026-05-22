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
import { COMPETITORS_SITE } from "@/content/site/competitors";

const PATH = "/vs";

const COMPARE_PAGES = [
  {
    slug: "apollo-clay-gong",
    name: "vs Apollo + Clay + Gong",
    description:
      "The stack-cost reframe. Your existing four tools cost $29K/yr and don't share a memory layer. We add the layer for $18K/yr.",
  },
  {
    slug: "apollo",
    name: "vs Apollo",
    description:
      "Apollo's contact database is the wrong shape for local-business outbound. We sit on top of it, never in place of.",
  },
  {
    slug: "clay",
    name: "vs Clay",
    description:
      "Clay is a workshop, LeadAC is the finished tool. Pick by staffing model, not by feature count.",
  },
  {
    slug: "gong",
    name: "vs Gong",
    description:
      "Conversation intelligence vs operational intelligence. Same word — memory — different substrate, different price floor.",
  },
];

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Compare LeadAC — honest side-by-side with the outbound stack",
  description:
    "Side-by-side comparisons of LeadAC against Apollo, Clay, Gong, and the four-tool stack most vertical SaaS teams run today. No leaderboards — different primitives, different fits.",
});

export default function VsIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Compare", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          COMPARE_PAGES.map((p) => ({
            name: p.name,
            url: `/vs/${p.slug}`,
            description: p.description,
          })),
        )}
      />

      <Hero
        eyebrow="Compare"
        headline="Different primitives. Different fits. Pick the one that maps to your team."
        subhead="Each comparison page is honest about which tool wins which job. We pass on more deals than we close because we'd rather lose a deal than ship a bad fit."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-6 md:grid-cols-2">
            {COMPARE_PAGES.map((p) => (
              <Link
                key={p.slug}
                href={`/vs/${p.slug}`}
                className="group block rounded-2xl border border-ink-3 bg-ink-1 p-8 transition-colors hover:border-signal/50 hover:bg-ink-2"
              >
                <h2 className="text-[22px] leading-tight text-paper-0">
                  {p.name}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                  {p.description}
                </p>
                <div className="mt-5 flex items-center gap-2 text-[13px] text-paper-1 group-hover:text-signal">
                  Read the comparison
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12">
            <div className="site-eyebrow mb-3">Other tools we mention</div>
            <div className="flex flex-wrap gap-2">
              {COMPETITORS_SITE.filter((c) =>
                ["smartlead", "outreach", "11x"].includes(c.slug),
              ).map((c) => (
                <span
                  key={c.slug}
                  className="rounded-full border border-ink-3 bg-ink-1 px-3 py-1 text-[12px] text-paper-2"
                >
                  {c.name}
                </span>
              ))}
              <span className="rounded-full border border-ink-3 bg-ink-1 px-3 py-1 text-[12px] text-paper-3">
                Direct comparison pages ship Q3 2026
              </span>
            </div>
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="Don't see your tool"
        title="Tell us which competitor you're evaluating against. We'll write a real comparison."
        subtitle="We add one comparison page per month based on customer ask. If your evaluation includes a tool we haven't covered yet, mention it on the demo call."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/alternatives", label: "Browse alternatives" }}
      />
    </>
  );
}
