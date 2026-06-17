import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero, CtaBlock } from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  definedTermSchema,
} from "@/components/seo/json-ld";
import { GLOSSARY, getGlossaryTerm } from "@/content/site/glossary";
import { SITE } from "@/lib/seo/metadata";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return GLOSSARY.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = GLOSSARY.find((x) => x.slug === slug);
  if (!g)
    return buildMetadata({
      path: `/glossary/${slug}`,
      title: "Glossary term",
      description: "Glossary term",
    });
  return buildMetadata({
    path: `/glossary/${g.slug}`,
    title: `${g.term} — definition for vertical SaaS GTM`,
    description: g.oneSentence,
  });
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const term = (() => {
    try {
      return getGlossaryTerm(slug);
    } catch {
      return null;
    }
  })();
  if (!term) notFound();

  const related = term.related
    .map((rs) => GLOSSARY.find((g) => g.slug === rs))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Glossary", url: "/glossary" },
          { name: term.term, url: `/glossary/${term.slug}` },
        ])}
      />
      <JsonLd
        id="ld-term"
        data={definedTermSchema({
          name: term.term,
          description: term.oneSentence,
          url: `${SITE.url}/glossary/${term.slug}`,
        })}
      />

      <Hero
        eyebrow="Glossary"
        headline={term.term}
        subhead={term.oneSentence}
        primaryCta={{
          href: term.primaryPage,
          label: "See it in context",
        }}
        secondaryCta={{ href: "/glossary", label: "Back to glossary" }}
      />

      <section className="site-section">
        <div className="site-container">
          <article className="mx-auto max-w-3xl">
            <div className="site-eyebrow mb-3">Definition</div>
            <p className="text-[18px] leading-[1.7] text-paper-1 md:text-[19px]">
              {term.definition}
            </p>

            {related.length ? (
              <div className="mt-16">
                <div className="site-eyebrow mb-4">Related terms</div>
                <div className="grid gap-3">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/glossary/${r.slug}`}
                      className="group flex items-baseline justify-between gap-4 rounded-lg border border-ink-3 bg-ink-1 px-4 py-3 transition-colors hover:border-signal/50 hover:bg-ink-2"
                    >
                      <div>
                        <div className="text-[15px] text-paper-0">{r.term}</div>
                        <div className="mt-1 text-[13px] leading-relaxed text-paper-2">
                          {r.oneSentence}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-paper-3 group-hover:text-signal" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </section>

      <CtaBlock
        eyebrow="See the term in product"
        title={`${term.term}, applied to one of your real accounts.`}
        subtitle="Twenty minutes. Bring your CRM. We index one of your accounts and you watch the term play out as a HubSpot field — not as marketing copy."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: term.primaryPage, label: "Read the primary page" }}
      />
    </>
  );
}
