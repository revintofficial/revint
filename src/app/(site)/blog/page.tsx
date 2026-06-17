import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero, CtaBlock } from "@/components/site/sections";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import { POSTS } from "@/content/blog";

const PATH = "/blog";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Blog — field notes from building Revint",
  description:
    "What we are learning about vertical SaaS GTM — playbooks, audits, opener frameworks, and candid reporting on what is working today. Published when we have something worth saying.",
});

export default function BlogIndexPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Blog", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-coll"
        data={collectionPageSchema({
          name: "Revint blog",
          description:
            "Field notes from building Revint — playbooks, audits, opener frameworks, and candid reporting on vertical SaaS GTM.",
          url: `${SITE.url}${PATH}`,
        })}
      />
      <JsonLd
        id="ld-list"
        data={itemListSchema(
          POSTS.slice(0, 20).map((p) => ({
            name: p.title,
            url: `/blog/${p.slug}`,
            description: p.description,
          })),
        )}
      />

      <Hero
        eyebrow="Field notes"
        headline="What we are learning about vertical SaaS GTM."
        subhead="Playbooks, audits, opener frameworks, and candid reporting on what is working in outbound today. We publish when we have something worth saying — not on a content-calendar cadence."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/resources", label: "Cornerstone resources" }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="grid gap-4">
            {POSTS.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col gap-3 rounded-2xl border border-ink-3 bg-ink-1 p-6 transition-colors hover:border-signal/50 hover:bg-ink-2 md:flex-row md:items-start md:gap-8 md:p-7"
              >
                <div className="md:w-40 md:shrink-0">
                  <div className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
                    {new Date(p.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="site-mono mt-1 text-[12px] text-paper-3">
                    {p.readMinutes} min
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-[18px] leading-tight text-paper-0 md:text-[20px]">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-paper-2">
                    {p.description}
                  </p>
                  {p.tags.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-ink-3 bg-ink-0 px-2 py-0.5 text-[11px] text-paper-3"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-1 text-[12px] text-paper-3 group-hover:text-signal">
                    Read
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="See it in product"
        title="Read the blog. Then read your own accounts in HubSpot."
        subtitle="Twenty minutes. Bring your CRM. We index one of your real accounts and you watch the operational signal land as HubSpot fields."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />
    </>
  );
}
