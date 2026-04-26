import type { ReactNode } from "react";
import Link from "next/link";

const prose = {
  color: "rgba(237,237,240,0.88)",
  fontSize: 16,
  lineHeight: 1.7,
} as const;

export function BlogShell({
  children,
  width = 720,
}: {
  children: ReactNode;
  width?: number;
}) {
  return (
    <article
      style={{
        maxWidth: width,
        margin: "0 auto",
        padding: "64px 24px 96px",
        ...prose,
      }}
    >
      {children}
    </article>
  );
}

export function PostMetaRow({
  publishedAt,
  updatedAt,
  readMinutes,
  author,
  tags,
}: {
  publishedAt: string;
  updatedAt?: string;
  readMinutes: number;
  author: { slug: string; name: string; url?: string };
  tags: string[];
}) {
  const pubDate = new Date(publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const updatedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        fontSize: 13,
        color: "rgba(237,237,240,0.6)",
        margin: "12px 0 32px",
        paddingBottom: 20,
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <Link
        href={author.url ?? `/about/${author.slug}`}
        style={{ color: "var(--leadac-300)", textDecoration: "none" }}
      >
        {author.name}
      </Link>
      <span>·</span>
      <time dateTime={publishedAt}>{pubDate}</time>
      {updatedDate && (
        <>
          <span>·</span>
          <span>Updated {updatedDate}</span>
        </>
      )}
      <span>·</span>
      <span>{readMinutes} min read</span>
      {tags.length > 0 && (
        <>
          <span>·</span>
          <span>
            {tags.map((t, i) => (
              <span key={t}>
                <Link
                  href={`/blog?tag=${encodeURIComponent(t)}`}
                  style={{ color: "rgba(237,237,240,0.75)", textDecoration: "none" }}
                >
                  #{t}
                </Link>
                {i < tags.length - 1 ? " " : ""}
              </span>
            ))}
          </span>
        </>
      )}
    </div>
  );
}

export function PostFaqs({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section
      style={{
        marginTop: 56,
        paddingTop: 32,
        borderTop: "0.5px solid rgba(255,255,255,0.1)",
      }}
    >
      <h2
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 20px",
          letterSpacing: "-0.01em",
        }}
      >
        Frequently asked
      </h2>
      <div style={{ display: "grid", gap: 16 }}>
        {items.map((it) => (
          <details
            key={it.question}
            style={{
              padding: "16px 20px",
              background: "#121214",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
                color: "#ededf0",
              }}
            >
              {it.question}
            </summary>
            <p
              style={{
                marginTop: 12,
                color: "rgba(237,237,240,0.82)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {it.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function PostCitations({
  items,
}: {
  items: Array<{ label: string; url: string; note?: string }>;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section
      style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(237,237,240,0.6)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          margin: "0 0 10px",
        }}
      >
        Sources
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
        {items.map((c) => (
          <li key={c.url} style={{ padding: "6px 0", color: "rgba(237,237,240,0.75)" }}>
            <a
              href={c.url}
              style={{ color: "var(--leadac-300)", textDecoration: "underline" }}
              rel="nofollow noopener"
              target="_blank"
            >
              {c.label}
            </a>
            {c.note && (
              <span style={{ color: "rgba(237,237,240,0.55)" }}> — {c.note}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PostCard({
  slug,
  title,
  description,
  publishedAt,
  readMinutes,
  tags,
}: {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readMinutes: number;
  tags: string[];
}) {
  const pubDate = new Date(publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <Link
      href={`/blog/${slug}`}
      style={{
        display: "block",
        padding: "20px 24px",
        background: "#121214",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        textDecoration: "none",
        color: "#ededf0",
        transition: "border-color 120ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          color: "rgba(237,237,240,0.55)",
          marginBottom: 10,
        }}
      >
        <time dateTime={publishedAt}>{pubDate}</time>
        <span>·</span>
        <span>{readMinutes} min read</span>
      </div>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 8px",
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: "rgba(237,237,240,0.72)",
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
      {tags.length > 0 && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "rgba(237,237,240,0.5)",
          }}
        >
          {tags.map((t) => `#${t}`).join("  ")}
        </div>
      )}
    </Link>
  );
}
