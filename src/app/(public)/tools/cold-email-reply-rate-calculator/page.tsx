import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import { ToolShell } from "@/components/tools/tool-shell";
import ReplyRateCalculator from "@/components/tools/reply-rate-calculator";

const FAQS = [
  {
    question: "What reply rate should I put in for a new campaign?",
    answer:
      "If you're sourcing from Apollo or ZoomInfo with a boilerplate template, start at 0.5% — that matches 2026 benchmarks. If you're running a grounded-opener postcode-niche campaign with Leadac AI, start at 3%. Adjust after your first 200 sends measure.",
  },
  {
    question: "What's a realistic positive-reply share?",
    answer:
      "20-35% of total replies are positive (interested, want more info, or book a call). The rest are objections, out-of-office, or opt-outs. Sequences with sharper targeting trend higher on positive-reply share.",
  },
  {
    question: "Why isn't cost-per-send in the calculator?",
    answer:
      "For most agencies, sender cost is fixed ($30-80/month per inbox) and swamped by the revenue calc — the math is dominated by reply × close × deal-value. If you want to model sender cost, subtract your monthly sender spend from the projected revenue output.",
  },
  {
    question: "Should I track deals or meetings as the key output?",
    answer:
      "Meetings booked is the leading indicator; closed deals is the lagging one. Track both weekly. If meetings are high but deals are low, your offer or qualification is off. If meetings are low, your top-of-funnel (reply rate or positive-reply share) is the bottleneck.",
  },
];

const PATH = "/tools/cold-email-reply-rate-calculator";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Cold email reply rate calculator — Leadac AI",
  description:
    "Plug in your cold-email volume and reply rate to project meetings, deals, and monthly revenue. Free, no login, updated for 2026 benchmarks.",
});

export default function ReplyRateCalculatorPage() {
  const canonical = `${SITE.url}${PATH}`;

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Cold email reply rate calculator",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: canonical,
    description:
      "Interactive calculator that projects meetings, closed deals, and monthly revenue from cold-email send volume and reply rate.",
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
          { name: "Cold email reply rate calculator", url: PATH },
        ])}
      />

      <ToolShell
        eyebrow="Free tool"
        title="Cold email reply rate calculator"
        intro="Plug in your send volume and reply rate. Get a projection for replies, positive replies, meetings booked, deals closed, and monthly revenue. Defaults reflect 2026 benchmarks for postcode-niche outbound."
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
          <strong style={{ color: "#ffffff" }}>Short answer:</strong> at 2,000
          sends/month × 3% reply × 30% positive × 40% meeting × 20% close ×
          $3,000 deal = about $4,320/month in projected revenue. Adjust the
          inputs below to match your data.
        </p>

        <ReplyRateCalculator />

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
            How the formula works
          </h2>
          <p>
            Revenue = Sends × Reply × Positive × Meetings × Deals × Deal
            value. Each step multiplies the survivors of the previous — the
            classic outbound funnel. The formula is deliberately simple so
            it's easy to pressure-test against your own CRM.
          </p>
          <p>
            In practice, the two inputs that move revenue the most are the
            reply rate and the meeting-booked rate. Going from 0.5% to 3%
            reply rate is a 6× multiplier on everything downstream, which is
            why the postcode-niche playbook focuses there before anywhere
            else.
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
