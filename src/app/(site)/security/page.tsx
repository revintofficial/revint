import type { Metadata } from "next";
import { Lock, ShieldCheck, FileLock2, KeyRound, Globe2, Eye } from "lucide-react";
import {
  Hero,
  ProofRow,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { FAQS } from "@/content/site/faq";

/**
 * /security — trust page.
 *
 * Psych: Authority + Loss-aversion (psych-map). Specific controls, dated
 * progress on the SOC 2 audit, honest about what's still in progress.
 */

const PATH = "/security";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Security & trust — how LeadAC handles your CRM data and HubSpot OAuth scope",
  description:
    "SOC 2 Type II audit in progress. AES-256 at rest, TLS 1.3 in transit. Per-workspace row-level isolation. Never trains models on customer data. Plain English.",
});

const CONTROLS = [
  {
    icon: Lock,
    title: "Encryption at rest and in transit",
    body: "AES-256 at rest with AWS KMS keys. TLS 1.3 in transit. HubSpot OAuth refresh tokens are encrypted with a per-customer KMS key, never stored in plaintext.",
  },
  {
    icon: ShieldCheck,
    title: "SOC 2 Type II — in progress",
    body: "Audit window started Q2 2026, target completion Q3 2026. Until then we run on a SOC 2 compliant infrastructure provider (AWS) and follow the same internal control set.",
  },
  {
    icon: KeyRound,
    title: "Workspace isolation",
    body: "Every customer-content table carries a workspace_id column. Cross-workspace inference is impossible by construction; the workspace_id is enforced at the database row level.",
  },
  {
    icon: FileLock2,
    title: "HubSpot OAuth — minimum scope",
    body: "Read access to contacts, companies, deals. Write access to contact and company custom property fields only. No write access to lists, sequences, workflows, or pipelines.",
  },
  {
    icon: Globe2,
    title: "Data residency",
    body: "US (us-east-1) by default. EU (eu-west-1) and UK on the Enterprise tier. Customer data never leaves the chosen region.",
  },
  {
    icon: Eye,
    title: "Model training — opt out by default",
    body: "Customer CRM data is never used to train our Gemini-based pattern-matching models. The closed-loop ICP refinement runs per-workspace; your patterns sharpen only your lists.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Security", url: PATH },
        ])}
      />

      <Hero
        eyebrow="Security & trust"
        headline="What we do with your data. What we never do with your data."
        subhead="LeadAC stores customer CRM data, OAuth tokens, and signal extractions. This page is the honest map of how those three are kept apart, encrypted, and never used to train cross-workspace models."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "#controls", label: "See the controls" }}
      />

      <ProofRow
        cells={[
          {
            value: "SOC 2 II",
            label: "Audit in progress. Q3 2026 target completion.",
          },
          {
            value: "AES-256",
            label: "At rest. AWS KMS, per-customer key on OAuth secrets.",
          },
          {
            value: "TLS 1.3",
            label: "In transit. HSTS preload, no HTTP fallback.",
          },
          {
            value: "0 models",
            label:
              "Trained on customer CRM data. Cross-workspace inference impossible.",
          },
        ]}
      />

      <section id="controls" className="site-section">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="site-eyebrow mb-3">Controls</div>
            <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              Six controls we lead with on every security review.
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-paper-2">
              Every customer signs an MSA + DPA that backs the controls
              below. Request the latest copies via the demo form.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink-3 bg-ink-3 md:grid-cols-2">
            {CONTROLS.map((c) => (
              <div key={c.title} className="bg-ink-1 p-6 md:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal/30 bg-[hsl(218_50%_16%_/_0.4)]">
                    <c.icon className="h-4 w-4 text-signal" />
                  </div>
                  <div className="text-[16px] font-medium text-paper-0">
                    {c.title}
                  </div>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-paper-2">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FaqBlock
        eyebrow="Security questions"
        title="What buyers and IT teams ask."
        entries={FAQS.security}
      />

      <CtaBlock
        eyebrow="Need the DPA or SOC 2 progress letter?"
        title="Request the latest security documentation via the demo form."
        subtitle="We send the DPA, the SOC 2 progress letter (when in audit), the sub-processor list, and the per-region data residency addendum. No NDA required for the first three."
        primaryCta={{ href: "/demo", label: "Request the docs" }}
        secondaryCta={{ href: "/legal/privacy", label: "Read the privacy policy" }}
      />
    </>
  );
}
