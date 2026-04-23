import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  articleSchema,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import { POSTS, getPostBySlug, getAllPostSlugs } from "@/content/blog";
import {
  BlogShell,
  PostMetaRow,
  PostFaqs,
  PostCitations,
  PostCard,
} from "@/components/blog/blog-shell";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not found" };
  return buildMetadata({
    path: `/blog/${slug}`,
    title: `${post.title} — Leadac AI`,
    description: post.description,
    ogType: "article",
    article: {
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      author: post.author.name,
      tags: post.tags,
    },
    keywords: post.tags,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const canonical = `${SITE.url}/blog/${slug}`;

  const related = POSTS.filter(
    (p) =>
      p.slug !== post.slug &&
      p.tags.some((t) => post.tags.includes(t)),
  ).slice(0, 3);

  return (
    <>
      <JsonLd
        data={articleSchema({
          headline: post.title,
          description: post.description,
          url: canonical,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: post.author.name,
          authorUrl: post.author.url
            ? post.author.url.startsWith("http")
              ? post.author.url
              : `${SITE.url}${post.author.url}`
            : undefined,
          tags: post.tags,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ])}
      />
      {post.faqs && post.faqs.length > 0 && (
        <JsonLd data={faqSchema(post.faqs)} />
      )}

      <BlogShell>
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: 13,
            color: "rgba(237,237,240,0.5)",
            margin: "0 0 32px",
          }}
        >
          <Link href="/blog" style={{ color: "inherit", textDecoration: "none" }}>
            ← All posts
          </Link>
        </nav>

        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 12px",
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
          }}
        >
          {post.title}
        </h1>

        <p
          style={{
            fontSize: 19,
            color: "rgba(237,237,240,0.82)",
            margin: "0 0 0",
            lineHeight: 1.5,
          }}
        >
          {post.lede}
        </p>

        <PostMetaRow
          publishedAt={post.publishedAt}
          updatedAt={post.updatedAt}
          readMinutes={post.readMinutes}
          author={post.author}
          tags={post.tags}
        />

        <div className="prose-body">{post.body()}</div>

        {post.citations && <PostCitations items={post.citations} />}
        {post.faqs && <PostFaqs items={post.faqs} />}

        <section
          style={{
            marginTop: 56,
            padding: "24px 28px",
            background: "rgba(165,180,252,0.06)",
            border: "0.5px solid rgba(165,180,252,0.15)",
            borderRadius: 14,
          }}
        >
          <p
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(165,180,252,0.85)",
              margin: "0 0 8px",
            }}
          >
            About the author
          </p>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 8px",
            }}
          >
            {post.author.name}
          </h3>
          <p
            style={{
              margin: "0 0 12px",
              color: "rgba(237,237,240,0.82)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {post.author.bio}
          </p>
          {post.author.url && (
            <Link
              href={post.author.url}
              style={{
                fontSize: 13,
                color: "#A5B4FC",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              More posts →
            </Link>
          )}
        </section>

        {related.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 20px",
                letterSpacing: "-0.01em",
              }}
            >
              Related posts
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              {related.map((p) => (
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
          </section>
        )}
      </BlogShell>

      <style>{`
        .prose-body h2 {
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 40px 0 14px;
          letter-spacing: -0.015em;
          line-height: 1.3;
        }
        .prose-body h3 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 28px 0 10px;
          letter-spacing: -0.01em;
        }
        .prose-body p {
          margin: 16px 0;
          color: rgba(237,237,240,0.88);
          line-height: 1.7;
        }
        .prose-body a {
          color: #A5B4FC;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .prose-body ul, .prose-body ol {
          margin: 16px 0;
          padding-left: 24px;
          color: rgba(237,237,240,0.88);
        }
        .prose-body li {
          margin: 8px 0;
          line-height: 1.7;
        }
        .prose-body strong {
          color: #ffffff;
          font-weight: 600;
        }
        .prose-body em {
          font-style: italic;
          color: rgba(237,237,240,0.95);
        }
        .prose-body blockquote {
          margin: 24px 0;
          padding: 18px 24px;
          background: #121214;
          border-left: 3px solid #A5B4FC;
          border-radius: 0 8px 8px 0;
          color: rgba(237,237,240,0.85);
          font-size: 15px;
        }
        .prose-body blockquote p {
          margin: 8px 0;
        }
        .prose-body table {
          width: 100%;
          margin: 24px 0;
          border-collapse: collapse;
          background: #121214;
          border: 0.5px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          overflow: hidden;
          font-size: 14px;
        }
        .prose-body thead tr {
          background: rgba(255,255,255,0.04);
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(237,237,240,0.65);
        }
        .prose-body th {
          padding: 12px 16px;
          font-weight: 600;
        }
        .prose-body td {
          padding: 12px 16px;
          color: rgba(237,237,240,0.85);
          border-top: 0.5px solid rgba(255,255,255,0.06);
        }
      `}</style>
    </>
  );
}
