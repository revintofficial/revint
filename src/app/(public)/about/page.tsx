import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";
import { AUTHORS } from "@/content/blog/types";
import { getPostsByAuthor } from "@/content/blog";

export const metadata: Metadata = buildMetadata({
  path: "/about",
  title: "About — Leadac AI",
  description:
    "Leadac AI is postcode-plus-niche discovery for local outbound agencies. We're a small team in London. Here's who we are and what we publish.",
});

export default function AboutIndexPage() {
  const authors = Object.values(AUTHORS);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ])}
      />

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 32px" }}>
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
          About {SITE.name}
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "rgba(237,237,240,0.82)",
            margin: "0 0 20px",
            lineHeight: 1.6,
          }}
        >
          {SITE.description}
        </p>
        <p
          style={{
            fontSize: 17,
            color: "rgba(237,237,240,0.75)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          We write occasionally at{" "}
          <Link href="/blog" style={{ color: "#A5B4FC" }}>
            the blog
          </Link>
          .
        </p>
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
          Authors
        </h2>
        <div style={{ display: "grid", gap: 16 }}>
          {authors.map((a) => {
            const count = getPostsByAuthor(a.slug).length;
            return (
              <Link
                key={a.slug}
                href={`/about/${a.slug}`}
                style={{
                  display: "block",
                  padding: "20px 24px",
                  background: "#121214",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  textDecoration: "none",
                  color: "#ededf0",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "rgba(237,237,240,0.5)",
                    marginBottom: 6,
                  }}
                >
                  {a.role}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#ffffff",
                    margin: "0 0 8px",
                  }}
                >
                  {a.name}
                </h3>
                <p
                  style={{
                    margin: "0 0 8px",
                    color: "rgba(237,237,240,0.72)",
                    fontSize: 14,
                    lineHeight: 1.55,
                  }}
                >
                  {a.bio.slice(0, 140)}
                  {a.bio.length > 140 ? "…" : ""}
                </p>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(165,180,252,0.85)",
                  }}
                >
                  {count} {count === 1 ? "post" : "posts"} →
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
