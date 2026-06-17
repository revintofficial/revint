import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero, CtaBlock } from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import { GLOSSARY } from "@/content/site/glossary";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/glossary";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Glossary — operational intelligence, memory layer, closed-loop ICP refinement",
  description:
    "Eight terms vertical SaaS GTM teams use that the Apollo+Clay+Gong stack doesn't have a vocabulary for. Each entry is one sentence for AI extraction plus one paragraph for the page body.",
});

export default function GlossaryIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Glossary", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-coll"
        data={collectionPageSchema({
          name: "Revint glossary",
          description:
            "Vocabulary for operational intelligence, the memory layer, and closed-loop ICP refinement — the language of vertical SaaS GTM.",
          url: `${SITE.url}${PATH}`,
        })}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          GLOSSARY.map((g) => ({
            name: g.term,
            url: `/glossary/${g.slug}`,
            description: g.oneSentence,
          })),
        )}
      />

      <Hero
        eyebrow="Glossary"
        headline="The language of vertical SaaS GTM."
        subhead="Eight terms the Apollo + Clay + Gong stack doesn't have a vocabulary for. Each entry is one sentence for AI engines to extract verbatim, then one paragraph for humans to read."
        primaryCta={{
          href: "/glossary/operational-intelligence",
          label: "Start with operational intelligence",
        }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-4">
            {GLOSSARY.map((g) => (
              <Link
                key={g.slug}
                href={`/glossary/${g.slug}`}
                className="group flex flex-col gap-3 rounded-2xl border border-ink-3 bg-ink-1 p-6 transition-colors hover:border-signal/50 hover:bg-ink-2 md:flex-row md:items-start md:gap-8"
              >
                <div className="md:w-1/3">
                  <h2 className="text-[18px] leading-tight text-paper-0">
                    {g.term}
                  </h2>
                  <div className="site-mono mt-2 text-[12px] uppercase tracking-wider text-paper-3">
                    Term
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] leading-relaxed text-paper-1">
                    {g.oneSentence}
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-[12px] text-paper-3 group-hover:text-signal">
                    Read the definition
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="The category"
        title="The vocabulary points at a category. Operational memory."
        subtitle="Read the manifesto for the long-form thesis behind the terms — why Apollo finds, Clay enriches, Gong records, and we remember."
        primaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />
    </>
  );
}
