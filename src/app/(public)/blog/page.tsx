import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import { POSTS } from "@/content/blog";
import { PostCard } from "@/components/blog/blog-shell";

export const metadata: Metadata = buildMetadata({
  path: "/blog",
  title: "Blog — Leadac AI",
  description:
    "Field notes from building Leadac AI. Playbooks, audits, opener frameworks, and candid reporting on what's working in outbound today.",
});

export default function BlogIndexPage() {
  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Leadac AI blog",
          description:
            "Field notes from building Leadac AI. Playbooks, audits, opener frameworks, and candid reporting on what's working in outbound.",
          url: `${SITE.url}/blog`,
        })}
      />
      <JsonLd
        data={itemListSchema(
          POSTS.map((p) => ({
            name: p.title,
            url: `/blog/${p.slug}`,
            description: p.description,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
        ])}
      />

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "80px 24px 32px" }}>
        <p
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "rgba(237,237,240,0.5)",
            margin: "0 0 12px",
          }}
        >
          Field notes
        </p>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 16px",
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          The Leadac AI blog
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "rgba(237,237,240,0.75)",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 640,
          }}
        >
          What we're learning about outbound, local lead gen, and the weird
          economics of agencies that sell to local-service businesses.
          Published when we have something worth saying.
        </p>
      </section>

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "24px 24px 96px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {POSTS.map((p) => (
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

        <div
          style={{
            marginTop: 64,
            padding: "20px 24px",
            background: "rgba(165,180,252,0.06)",
            border: "0.5px solid rgba(165,180,252,0.15)",
            borderRadius: 12,
            fontSize: 14,
            color: "rgba(237,237,240,0.8)",
            lineHeight: 1.6,
          }}
        >
          Want Leadac AI in your pipeline? <Link href="/signup" style={{ color: "#A5B4FC" }}>Start free</Link> — 20 leads, no card.
        </div>
      </section>
    </>
  );
}
