import Link from "next/link";
import type { PublicLeadCard } from "@/lib/seo/programmatic";

/**
 * Reusable directory page primitives. Every `/cities`, `/niches`, and
 * `/niches/{v}/{c}` page composes these: DirectoryShell for the outer
 * wrapper + H1, LeadCardList for the list, CrossLinkBlock for the
 * internal-link graph that makes directory SEO work.
 */

export function DirectoryShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px 80px" }}>
      <p
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#a5b4fc",
          fontWeight: 600,
          margin: "0 0 12px",
        }}
      >
        {eyebrow}
      </p>
      <h1
        style={{
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
          color: "#ffffff",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 17,
          color: "rgba(237,237,240,0.72)",
          margin: "0 0 36px",
          maxWidth: 720,
        }}
      >
        {intro}
      </p>
      {children}
    </div>
  );
}

export function LeadCardList({ items }: { items: PublicLeadCard[] }) {
  if (items.length === 0) {
    return (
      <p style={{ color: "rgba(237,237,240,0.55)", fontSize: 14 }}>
        No audited businesses published yet for this segment. Check back soon.
      </p>
    );
  }
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: "0 0 40px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            style={{
              display: "block",
              padding: "18px 20px",
              background: "#121214",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.15s",
            }}
          >
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#ffffff",
                margin: "0 0 4px",
                letterSpacing: "-0.01em",
              }}
            >
              {item.businessName}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "rgba(237,237,240,0.55)",
                margin: "0 0 8px",
              }}
            >
              {item.borough || "United Kingdom"}
            </p>
            {item.oneLiner && (
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(237,237,240,0.72)",
                  margin: "0 0 8px",
                  lineHeight: 1.45,
                }}
              >
                {item.oneLiner}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 11,
                color: "rgba(237,237,240,0.5)",
              }}
            >
              {item.rating && (
                <span>
                  ★ {item.rating.toFixed(1)} ({item.reviewCount ?? 0})
                </span>
              )}
              {item.websiteUrl && <span>Has site</span>}
              {item.primaryType && <span>{item.primaryType}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CrossLinkBlock({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string; sub?: string }>;
}) {
  if (links.length === 0) return null;
  return (
    <section
      style={{
        marginTop: 36,
        padding: "20px 24px",
        background: "rgba(18,18,20,0.6)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(237,237,240,0.7)",
          fontWeight: 600,
          margin: "0 0 14px",
        }}
      >
        {title}
      </h2>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              style={{
                color: "#a5b4fc",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {l.label}
              {l.sub && (
                <span
                  style={{
                    color: "rgba(237,237,240,0.45)",
                    fontSize: 12,
                    marginLeft: 6,
                  }}
                >
                  {l.sub}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FaqBlock({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 40 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          margin: "0 0 20px",
          color: "#ffffff",
        }}
      >
        Frequently asked questions
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => (
          <details
            key={item.question}
            style={{
              padding: "16px 20px",
              background: "#121214",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
            }}
          >
            <summary
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              {item.question}
            </summary>
            <p
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "rgba(237,237,240,0.72)",
                lineHeight: 1.6,
              }}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
