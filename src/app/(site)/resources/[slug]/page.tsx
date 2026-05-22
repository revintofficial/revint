import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import {
  Hero,
  LeadMagnetBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  articleSchema,
  datasetSchema,
} from "@/components/seo/json-ld";
import { RESOURCES, getResource } from "@/content/site/resources";
import { RESOURCE_BODIES } from "@/content/site/resource-bodies";
import { SITE } from "@/lib/seo/metadata";

/**
 * /resources/[slug] — dynamic detail page for cornerstone resources.
 *
 * Each entry has structured metadata in `resources.ts` and a long-form
 * body in `resource-bodies.tsx`. Schema selection is conditional on
 * `kind` so report-kind entries emit Dataset + Article, while playbook
 * and guide entries emit just Article.
 */

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return RESOURCES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = RESOURCES.find((x) => x.slug === slug);
  if (!r) return buildMetadata({ path: `/resources/${slug}`, title: "Resource", description: "Resource" });
  return buildMetadata({
    path: `/resources/${r.slug}`,
    title: `${r.title} — LeadAC ${r.kind}`,
    description: r.summary,
  });
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const resource = (() => {
    try {
      return getResource(slug);
    } catch {
      return null;
    }
  })();
  if (!resource) notFound();

  const body = RESOURCE_BODIES[slug];
  if (!body) notFound();

  const url = `${SITE.url}/resources/${resource.slug}`;

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Resources", url: "/resources" },
          { name: resource.title, url: `/resources/${resource.slug}` },
        ])}
      />
      <JsonLd
        id="ld-article"
        data={articleSchema({
          headline: resource.title,
          description: resource.summary,
          url,
          datePublished: resource.publishedAt,
          authorName: resource.author,
          tags: resource.dataset?.keywords ?? [resource.kind, "vertical SaaS GTM"],
        })}
      />
      {resource.dataset ? (
        <JsonLd
          id="ld-dataset"
          data={datasetSchema({
            name: resource.title,
            description: resource.dataset.description,
            url,
            keywords: resource.dataset.keywords,
            license: resource.dataset.license,
            contentUrl: resource.dataset.contentUrl,
            datePublished: resource.publishedAt,
          })}
        />
      ) : null}

      <Hero
        eyebrow={body.hero.eyebrow}
        headline={body.hero.headline}
        subhead={body.hero.subhead}
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/resources", label: "Back to resources" }}
        anchor={body.anchor}
      />

      <section className="site-section">
        <div className="site-container">
          <article className="mx-auto grid max-w-3xl gap-16">
            {body.sections.map((s, i) => (
              <section key={i}>
                {s.eyebrow ? (
                  <div className="site-eyebrow mb-2">{s.eyebrow}</div>
                ) : null}
                <h2 className="text-[24px] leading-tight tracking-tight text-paper-0 md:text-[32px]">
                  {s.title}
                </h2>
                <div className="mt-5">{s.body}</div>
              </section>
            ))}

            {body.citations?.length ? (
              <section>
                <div className="site-eyebrow mb-3">Sources</div>
                <ul className="grid gap-2">
                  {body.citations.map((c) => (
                    <li key={c.url}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[14px] text-paper-1 hover:text-signal"
                      >
                        {c.name}
                        {c.date ? (
                          <span className="text-paper-3">· {c.date}</span>
                        ) : null}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        </div>
      </section>

      {resource.dataset ? (
        <LeadMagnetBlock
          eyebrow="Download"
          title={`Get the ${resource.title} CSV.`}
          subtitle="Email-gated. The download includes the full benchmark CSV and a one-page summary. License: Creative Commons BY-NC-SA."
          bullets={[
            "Cross-vertical benchmark CSV — 200 GTM teams",
            "Per-vertical breakouts (Field service, Restaurant tech, Dental)",
            "One-page executive summary suitable for board review",
            "Quarterly refresh window stated in the document",
          ]}
          cta={{ href: "/demo", label: "Get the benchmark + demo" }}
        />
      ) : null}

      <section className="site-section">
        <div className="site-container">
          <div className="site-eyebrow mb-3">More resources</div>
          <div className="grid gap-4 md:grid-cols-3">
            {RESOURCES.filter((r) => r.slug !== resource.slug).map((r) => (
              <Link
                key={r.slug}
                href={`/resources/${r.slug}`}
                className="group rounded-2xl border border-ink-3 bg-ink-1 p-6 transition-colors hover:border-signal/50 hover:bg-ink-2"
              >
                <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
                  {r.kind}
                </div>
                <h3 className="mt-2 text-[17px] leading-tight text-paper-0">
                  {r.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-paper-2">
                  {r.summary}
                </p>
                <div className="mt-4 flex items-center gap-1 text-[12px] text-paper-1 group-hover:text-signal">
                  Read
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        eyebrow="See the system live"
        title="Bring your CRM to the call. Read the report after."
        subtitle="Twenty minutes. One of your real accounts. The same operational signals this report describes — written into HubSpot during the call."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />
    </>
  );
}
