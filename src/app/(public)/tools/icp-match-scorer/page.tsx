import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import { ToolShell } from "@/components/tools/tool-shell";
import IcpMatchScorer from "@/components/tools/icp-match-scorer";

const FAQS = [
  {
    question: "What does the score actually mean?",
    answer:
      "It's a weighted sum of eight signals that predict reply-rate and close-rate for a given prospect in the postcode-niche playbook. 80+ is tier A (pursue aggressively), 60-79 is tier B (standard sequence), 40-59 is tier C (cheap automation only), below 40 is tier D (skip).",
  },
  {
    question: "How are the weights set?",
    answer:
      "They reflect our own agency data: vertical match (18%), geographic density (16%), and website quality gap (16%) dominate because they drive opener strength and deliverability. Buyer role and budget fit matter but are secondary.",
  },
  {
    question: "Can I use this for B2B SaaS ICPs?",
    answer:
      "Roughly — but the weights are calibrated for local-service outbound. For B2B SaaS, the 'owner operated' and 'review volume' questions don't carry as much signal; substitute them with 'technology stack match' and 'funding stage'.",
  },
  {
    question: "What happens after I score a prospect tier A?",
    answer:
      "Drop them into a personalized opener sequence — ideally one that leads with an audit finding specific to that business. Tier-A prospects should get human-quality effort on email one. Tier-C prospects get a generic-but-correct sequence and no personal-sender time.",
  },
];

const PATH = "/tools/icp-match-scorer";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "ICP match scorer — Leadac AI",
  description:
    "Score a prospect 0-100 against the postcode-niche playbook before you add them to a sequence. Eight questions, instant tier recommendation. Free.",
});

export default function IcpMatchScorerPage() {
  const canonical = `${SITE.url}${PATH}`;

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ICP match scorer",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: canonical,
    description:
      "Interactive scorer that rates a prospect 0-100 across eight weighted signals and returns a tiered recommendation for outbound.",
    publisher: { "@id": `${SITE.url}/#organization` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    isAccessibleForFree: true,
  };

  return (
    <>
      <JsonLd data={softwareAppSchema} />
      <JsonLd data={faqSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "ICP match scorer", url: PATH },
        ])}
      />

      <ToolShell
        eyebrow="Free tool"
        title="ICP match scorer"
        intro="Score a single prospect 0-100 against the Leadac AI postcode-niche playbook. Eight weighted questions, tiered recommendation. Use it to decide whether a prospect deserves personal-sender time or cheap automation."
      >
        <p
          style={{
            padding: "16px 20px",
            marginBottom: 28,
            background: "rgba(165,180,252,0.08)",
            border: "0.5px solid rgba(165,180,252,0.18)",
            borderRadius: 10,
            color: "rgba(237,237,240,0.88)",
            fontSize: 15,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "#ffffff" }}>Short answer:</strong> pick
          the answer that most closely matches this prospect for each of the
          eight questions. The score and tier update live; 80+ gets personal
          treatment, 40-79 gets a standard sequence, under 40 gets skipped.
        </p>

        <IcpMatchScorer />

        <section style={{ marginTop: 56 }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
            }}
          >
            Why these eight signals
          </h2>
          <p>
            Every question maps to something we've seen move reply rate or
            close rate by at least 2× in real agency data. Vertical match
            and geographic density dominate because they're what lets the
            opener reference the neighborhood and the exact shop across the
            street. Website quality gap matters because it's the body of
            the first email.
          </p>
          <p>
            The last three questions — buyer role, booking infrastructure,
            review volume — are the tie-breakers between a solid B-tier and
            a strong A-tier prospect. If your top three answers are all
            high-signal and the bottom five are mixed, you're still looking
            at a tier-A pursue.
          </p>
        </section>

        <section style={{ marginTop: 48 }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
            }}
          >
            FAQ
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {FAQS.map((f) => (
              <details
                key={f.question}
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
                  {f.question}
                </summary>
                <p
                  style={{
                    marginTop: 12,
                    color: "rgba(237,237,240,0.82)",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {f.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </ToolShell>
    </>
  );
}
