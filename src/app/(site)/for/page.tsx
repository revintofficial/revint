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
import { VERTICALS } from "@/content/site/verticals";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/for";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Revint for vertical SaaS — pick your category",
  description:
    "Three vertical packs ship on day one: Field service, Restaurant tech, Dental. Each pack carries pre-built signal libraries, persona briefs, and HubSpot field maps for the vertical it covers.",
});

export default function ForIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "For verticals", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          VERTICALS.map((v) => ({
            name: v.name,
            url: `/for/${v.slug}`,
            description: v.hero.subhead,
          })),
        )}
      />

      <Hero
        eyebrow="For · vertical packs"
        headline="Pick the vertical pack that matches your motion."
        subhead="Three packs ship on day one — Field service, Restaurant tech, Dental. Each one carries the software signature library, the persona brief, and the HubSpot field map for that vertical."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: `${SITE.url}/pricing`, label: "See pricing" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-6 md:grid-cols-3">
            {VERTICALS.map((v) => (
              <Link
                key={v.slug}
                href={`/for/${v.slug}`}
                className="group block rounded-2xl border border-ink-3 bg-ink-1 p-6 transition-colors hover:border-signal/50 hover:bg-ink-2"
              >
                <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
                  Wave {v.wave}
                </div>
                <h2 className="mt-3 text-[22px] leading-tight text-paper-0">
                  {v.name}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                  {v.hero.subhead}
                </p>
                <div className="mt-5 flex items-center gap-2 text-[13px] text-paper-1 group-hover:text-signal">
                  See the vertical pack
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="Vertical not listed"
        title="Beauty, legal, hospitality — coming Q3 and Q4 2026."
        subtitle="Tell us your vertical on the demo call. We add packs in batches of one per quarter; design partners get the first read on the signal library."
        primaryCta={{ href: "/demo", label: "Tell us your vertical" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />
    </>
  );
}
