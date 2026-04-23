import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import {
  DirectoryShell,
  CrossLinkBlock,
} from "@/components/public-directory/directory-shell";
import { COMPETITORS } from "@/content/competitors";

export const metadata = buildMetadata({
  path: "/alternatives",
  title: "Leadac AI alternatives — compare every lead-gen tool",
  description:
    "Leadac AI alternative pages for Apollo, Clay, Instantly, Smartlead, Lemlist, ZoomInfo, Lusha, and Lead Forensics. Honest scorecards with pricing, citations, and why a Leadac-leaning buyer switches.",
});

export default function AlternativesIndexPage() {
  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Leadac AI alternatives",
          description:
            "Every alternative page in one place — Apollo, Clay, Instantly, and the rest.",
          url: `${SITE.url}/alternatives`,
        })}
      />
      <JsonLd
        data={itemListSchema(
          COMPETITORS.map((c) => ({
            name: `${c.name} alternative`,
            url: `/alternatives/${c.slug}`,
            description: c.tagline,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Alternatives", url: "/alternatives" },
        ])}
      />

      <DirectoryShell
        eyebrow="Alternatives"
        title="Leadac AI alternatives"
        intro="Honest, sourced comparisons with the tools every outbound agency evaluates. Each page includes a scorecard, pricing, citations from real user reviews, and where a Leadac-leaning buyer switches."
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 40px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {COMPETITORS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/alternatives/${c.slug}`}
                style={{
                  display: "block",
                  padding: "18px 20px",
                  background: "#121214",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: "0 0 6px",
                  }}
                >
                  {c.name} alternative
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(237,237,240,0.65)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {c.tagline}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <CrossLinkBlock
          title="Go deeper"
          links={[
            { label: "Comparison pages", href: "/compare" },
            { label: "Blog", href: "/blog" },
            { label: "Glossary", href: "/glossary" },
          ]}
        />
      </DirectoryShell>
    </>
  );
}
