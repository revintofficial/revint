import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, ExternalLink } from "lucide-react";
import { CtaBlock } from "@/components/site/sections";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  articleSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import { POSTS, getPostBySlug, getAllPostSlugs } from "@/content/blog";

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
  if (!post)
    return buildMetadata({ path: `/blog/${slug}`, title: "Not found", description: "Not found" });
  return buildMetadata({
    path: `/blog/${slug}`,
    title: `${post.title} — Revint blog`,
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
    (p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)),
  ).slice(0, 3);

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
        ])}
      />
      <JsonLd
        id="ld-article"
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
      {post.faqs && post.faqs.length > 0 ? (
        <JsonLd id="ld-faq" data={faqSchema(post.faqs)} />
      ) : null}

      <article className="site-section">
        <div className="site-container">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[13px] text-paper-2 hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All posts
            </Link>

            <div className="site-eyebrow mt-10">
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {" · "}
              {post.readMinutes} min read
            </div>
            <h1 className="mt-3 text-[34px] leading-tight tracking-tight text-paper-0 md:text-[48px]">
              {post.title}
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-paper-1 md:text-[20px]">
              {post.lede}
            </p>

            {post.tags.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-ink-3 bg-ink-1 px-3 py-1 text-[12px] text-paper-2"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="site-prose mt-12">{post.body()}</div>

            {post.citations?.length ? (
              <section className="mt-16">
                <div className="site-eyebrow mb-3">Sources</div>
                <ul className="grid gap-2">
                  {post.citations.map((c) => (
                    <li key={c.url}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[14px] text-paper-1 hover:text-signal"
                      >
                        {c.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {c.note ? (
                        <span className="ml-2 text-[12px] text-paper-3">
                          — {c.note}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {post.faqs?.length ? (
              <section className="mt-16">
                <div className="site-eyebrow mb-3">Frequently asked</div>
                <div className="grid gap-5">
                  {post.faqs.map((f) => (
                    <div
                      key={f.question}
                      className="rounded-xl border border-ink-3 bg-ink-1 p-5"
                    >
                      <div className="text-[15px] text-paper-0">
                        {f.question}
                      </div>
                      <p className="mt-2 text-[14px] leading-relaxed text-paper-2">
                        {f.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-16 rounded-2xl border border-ink-3 bg-ink-1 p-6">
              <div className="site-eyebrow mb-2">About the author</div>
              <div className="text-[16px] text-paper-0">{post.author.name}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-paper-2">
                {post.author.bio}
              </p>
            </section>

            {related.length ? (
              <section className="mt-16">
                <div className="site-eyebrow mb-3">Related</div>
                <div className="grid gap-3">
                  {related.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="group flex items-baseline justify-between gap-4 rounded-lg border border-ink-3 bg-ink-1 px-4 py-3 transition-colors hover:border-signal/50 hover:bg-ink-2"
                    >
                      <div>
                        <div className="text-[15px] text-paper-0">{p.title}</div>
                        <div className="mt-1 text-[13px] text-paper-2">
                          {p.description}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-paper-3 group-hover:text-signal" />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </article>

      <CtaBlock
        eyebrow="See the post in product"
        title="Read the post. Then read your own accounts in HubSpot."
        subtitle="Twenty minutes. Bring your CRM. We index one of your real accounts and you watch the operational signal land in HubSpot."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/blog", label: "Back to blog" }}
      />
    </>
  );
}
