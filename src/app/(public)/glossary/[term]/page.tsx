import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  definedTermSchema,
} from "@/components/seo/json-ld";
import {
  GLOSSARY_TERMS,
  getTermBySlug,
  getAllTermSlugs,
} from "@/content/glossary/terms";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllTermSlugs().map((term) => ({ term }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}): Promise<Metadata> {
  const { term: slug } = await params;
  const t = getTermBySlug(slug);
  if (!t) return { title: "Not found" };
  return buildMetadata({
    path: `/glossary/${slug}`,
    title: `${t.name} — Glossary — Leadac AI`,
    description: t.meta,
  });
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term: slug } = await params;
  const t = getTermBySlug(slug);
  if (!t) notFound();

  const canonical = `${SITE.url}/glossary/${slug}`;
  const related = (t.related ?? [])
    .map((r) => getTermBySlug(r))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const bodyParagraphs = t.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <JsonLd
        data={definedTermSchema({
          name: t.name,
          description: t.oneSentence,
          url: canonical,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Glossary", url: "/glossary" },
          { name: t.name, url: `/glossary/${t.slug}` },
        ])}
      />

      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px 96px",
          color: "rgba(237,237,240,0.88)",
          fontSize: 16,
          lineHeight: 1.7,
        }}
      >
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: 13,
            color: "rgba(237,237,240,0.5)",
            margin: "0 0 32px",
          }}
        >
          <Link href="/glossary" style={{ color: "inherit", textDecoration: "none" }}>
            ← All terms
          </Link>
        </nav>

        <p
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(165,180,252,0.8)",
            margin: "0 0 10px",
          }}
        >
          {t.category}
        </p>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 20px",
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          {t.name}
        </h1>

        <p
          style={{
            fontSize: 19,
            color: "#ededf0",
            margin: "0 0 28px",
            lineHeight: 1.55,
            padding: "16px 20px",
            background: "rgba(165,180,252,0.08)",
            border: "0.5px solid rgba(165,180,252,0.18)",
            borderRadius: 10,
          }}
        >
          <strong style={{ color: "#ffffff" }}>Short answer:</strong>{" "}
          {t.oneSentence}
        </p>

        {bodyParagraphs.map((p, i) => (
          <p key={i} style={{ margin: "16px 0" }}>
            {p}
          </p>
        ))}

        {related.length > 0 && (
          <section
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <h2
              style={{
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(237,237,240,0.65)",
                margin: "0 0 14px",
              }}
            >
              Related terms
            </h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 8,
              }}
            >
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/glossary/${r.slug}`}
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      background: "#121214",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: "#ededf0",
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ marginTop: 48, fontSize: 14 }}>
          <Link
            href="/glossary"
            style={{ color: "var(--leadac-300)", textDecoration: "none" }}
          >
            Browse the full glossary ({GLOSSARY_TERMS.length} terms) →
          </Link>
        </section>
      </article>
    </>
  );
}
