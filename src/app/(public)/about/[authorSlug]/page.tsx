import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";
import { AUTHORS } from "@/content/blog/types";
import { getPostsByAuthor } from "@/content/blog";
import { PostCard } from "@/components/blog/blog-shell";

export const dynamicParams = false;

export async function generateStaticParams() {
  return Object.keys(AUTHORS).map((authorSlug) => ({ authorSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ authorSlug: string }>;
}): Promise<Metadata> {
  const { authorSlug } = await params;
  const author = AUTHORS[authorSlug];
  if (!author) return { title: "Not found" };
  return buildMetadata({
    path: `/about/${authorSlug}`,
    title: `${author.name} — Leadac AI`,
    description: author.bio.slice(0, 160),
  });
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ authorSlug: string }>;
}) {
  const { authorSlug } = await params;
  const author = AUTHORS[authorSlug];
  if (!author) notFound();

  const posts = getPostsByAuthor(authorSlug);
  const canonical = `${SITE.url}/about/${authorSlug}`;

  const personSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    description: author.bio,
    url: canonical,
    jobTitle: author.role,
    ...(author.links?.twitter || author.links?.linkedin
      ? {
          sameAs: [
            author.links?.twitter,
            author.links?.linkedin,
          ].filter(Boolean) as string[],
        }
      : {}),
    worksFor: { "@id": `${SITE.url}/#organization` },
  };

  return (
    <>
      <JsonLd data={personSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
          { name: author.name, url: `/about/${authorSlug}` },
        ])}
      />

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 32px" }}>
        <p
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "rgba(237,237,240,0.5)",
            margin: "0 0 12px",
          }}
        >
          {author.role}
        </p>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 20px",
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          {author.name}
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "rgba(237,237,240,0.82)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {author.bio}
        </p>
        {(author.links?.twitter || author.links?.linkedin) && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 20,
              fontSize: 14,
            }}
          >
            {author.links?.twitter && (
              <a
                href={author.links.twitter}
                style={{ color: "var(--leadac-300)", textDecoration: "none" }}
                rel="me noopener"
                target="_blank"
              >
                Twitter →
              </a>
            )}
            {author.links?.linkedin && (
              <a
                href={author.links.linkedin}
                style={{ color: "var(--leadac-300)", textDecoration: "none" }}
                rel="me noopener"
                target="_blank"
              >
                LinkedIn →
              </a>
            )}
          </div>
        )}
      </section>

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 96px" }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#ffffff",
            margin: "48px 0 20px",
            letterSpacing: "-0.01em",
          }}
        >
          Posts by {author.name}
        </h2>
        {posts.length === 0 ? (
          <p style={{ color: "rgba(237,237,240,0.6)" }}>No posts yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {posts.map((p) => (
              <PostCard
                key={p.slug}
                slug={p.slug}
                title={p.title}
                description={p.description}
                publishedAt={p.publishedAt}
                readMinutes={p.readMinutes}
                tags={p.tags}
              />
            ))}
          </div>
        )}
        <div style={{ marginTop: 40, fontSize: 14 }}>
          <Link href="/blog" style={{ color: "var(--leadac-300)", textDecoration: "none" }}>
            ← Back to blog
          </Link>
        </div>
      </section>
    </>
  );
}
