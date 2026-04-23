import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";

const TOOLS = [
  {
    slug: "cold-email-reply-rate-calculator",
    name: "Cold email reply rate calculator",
    description:
      "Plug in your send volume and reply rate to project meetings, deals, and monthly revenue from outbound.",
  },
  {
    slug: "icp-match-scorer",
    name: "ICP match scorer",
    description:
      "Score a prospect 0-100 against the postcode-niche playbook before you add them to a sequence.",
  },
];

export const metadata: Metadata = buildMetadata({
  path: "/tools",
  title: "Free tools — Leadac AI",
  description:
    "Small, sharp tools for outbound agencies. A reply-rate calculator, an ICP match scorer. Free, no login.",
});

export default function ToolsIndexPage() {
  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Free tools for outbound agencies",
          description:
            "Small, sharp tools for local outbound agencies. Reply-rate calculator, ICP match scorer, more on the way.",
          url: `${SITE.url}/tools`,
        })}
      />
      <JsonLd
        data={itemListSchema(
          TOOLS.map((t) => ({
            name: t.name,
            url: `/tools/${t.slug}`,
            description: t.description,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
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
          Free · No login
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
          Small, sharp tools for outbound
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "rgba(237,237,240,0.78)",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 640,
          }}
        >
          Useful calculators and scorers for agencies running local outbound.
          Free and stays that way.
        </p>
      </section>

      <section style={{ maxWidth: 820, margin: "0 auto", padding: "24px 24px 96px" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {TOOLS.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              style={{
                display: "block",
                padding: "24px 28px",
                background: "#121214",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                textDecoration: "none",
                color: "#ededf0",
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 8px",
                  letterSpacing: "-0.01em",
                }}
              >
                {t.name} →
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "rgba(237,237,240,0.72)",
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                {t.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
