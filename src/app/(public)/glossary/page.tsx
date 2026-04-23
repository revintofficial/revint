import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import { GLOSSARY_TERMS, getTermsByCategory } from "@/content/glossary/terms";

const CATEGORY_LABELS: Record<string, string> = {
  outbound: "Outbound & cold email",
  sales: "Sales",
  marketing: "Marketing",
  email: "Email & deliverability",
  seo: "SEO & AEO",
  data: "Data & enrichment",
  leadac: "Leadac terminology",
};

const CATEGORY_ORDER = [
  "leadac",
  "outbound",
  "email",
  "sales",
  "marketing",
  "seo",
  "data",
] as const;

export const metadata: Metadata = buildMetadata({
  path: "/glossary",
  title: "Glossary — Leadac AI",
  description:
    "Plain-English definitions for every term we use in outbound, cold email, deliverability, SEO, and the Leadac AI product.",
});

export default function GlossaryIndexPage() {
  const byCategory = getTermsByCategory();

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Leadac AI glossary",
          description:
            "Plain-English definitions for every term used in outbound, cold email, SEO, and the Leadac AI product.",
          url: `${SITE.url}/glossary`,
        })}
      />
      <JsonLd
        data={itemListSchema(
          GLOSSARY_TERMS.map((t) => ({
            name: t.name,
            url: `/glossary/${t.slug}`,
            description: t.oneSentence,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Glossary", url: "/glossary" },
        ])}
      />

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 32px" }}>
        <p
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "rgba(237,237,240,0.5)",
            margin: "0 0 12px",
          }}
        >
          Glossary · {GLOSSARY_TERMS.length} terms
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
          Every term, defined
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
          Plain-English definitions for every concept we use across outbound,
          cold email, deliverability, SEO, and the Leadac AI product itself.
          Each page answers the question in one sentence, then expands.
        </p>
      </section>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 96px" }}>
        {CATEGORY_ORDER.map((cat) => {
          const terms = byCategory[cat];
          if (!terms || terms.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 48 }}>
              <h2
                style={{
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "rgba(165,180,252,0.85)",
                  margin: "0 0 14px",
                  fontWeight: 700,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 10,
                }}
              >
                {terms.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/glossary/${t.slug}`}
                      style={{
                        display: "block",
                        padding: "12px 16px",
                        background: "#121214",
                        border: "0.5px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#ededf0",
                        textDecoration: "none",
                        fontSize: 14,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#ffffff",
                          marginBottom: 3,
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(237,237,240,0.6)",
                          lineHeight: 1.4,
                        }}
                      >
                        {t.oneSentence.length > 110
                          ? t.oneSentence.slice(0, 107) + "…"
                          : t.oneSentence}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}
