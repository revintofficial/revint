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
  path: "/compare",
  title: "Compare lead-gen tools — Leadac AI",
  description:
    "Every competitor comparison page in one place. Leadac AI vs Apollo, Clay, Instantly, Smartlead, Lemlist, ZoomInfo, Lusha, and Lead Forensics — plus head-to-heads between any two of them.",
});

export default function CompareIndexPage() {
  const vsLeadac = COMPETITORS.map((c) => ({
    label: `Leadac AI vs ${c.name}`,
    href: `/vs/${c.slug}`,
  }));

  const pairs: Array<{ label: string; href: string }> = [];
  for (const a of COMPETITORS) {
    for (const b of COMPETITORS) {
      if (a.slug < b.slug) {
        pairs.push({
          label: `${a.name} vs ${b.name}`,
          href: `/vs/${a.slug}-vs-${b.slug}`,
        });
      }
    }
  }

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Compare lead-gen tools",
          description:
            "Every competitor comparison page in one index — Leadac AI vs every major lead-gen tool, plus head-to-heads between them.",
          url: `${SITE.url}/compare`,
        })}
      />
      <JsonLd
        data={itemListSchema(
          [...vsLeadac, ...pairs].map((p) => ({
            name: p.label,
            url: p.href,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
        ])}
      />

      <DirectoryShell
        eyebrow="Compare"
        title="Every lead-gen comparison"
        intro="Every competitor comparison page in one index — Leadac AI vs each of the usual suspects, plus head-to-heads between two tools when you're deciding between them."
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 12px",
            letterSpacing: "-0.01em",
          }}
        >
          Leadac AI vs …
        </h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 40px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          {vsLeadac.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
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
                {p.label}
              </Link>
            </li>
          ))}
        </ul>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 12px",
            letterSpacing: "-0.01em",
          }}
        >
          Head-to-heads between other tools
        </h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 40px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          {pairs.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  background: "#121214",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  color: "rgba(237,237,240,0.85)",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>

        <CrossLinkBlock
          title="See also"
          links={[
            { label: "Alternatives", href: "/alternatives" },
            { label: "Pricing", href: "/pricing" },
            { label: "All cities", href: "/cities" },
            { label: "All niches", href: "/niches" },
          ]}
        />
      </DirectoryShell>
    </>
  );
}
