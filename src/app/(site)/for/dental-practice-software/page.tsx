import type { Metadata } from "next";
import {
  Hero,
  VerticalSignalList,
  ProofRow,
  ProblemGrid,
  ClosedLoopDiagram,
  QuoteBlock,
  FaqBlock,
  CtaBlock,
  LeadMagnetBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  serviceSchema,
} from "@/components/seo/json-ld";
import { getVertical } from "@/content/site/verticals";
import { PERSONAS } from "@/content/site/personas";
import { PAINS } from "@/content/site/pains";
import { FAQS } from "@/content/site/faq";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/for/dental-practice-software";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Dental practice software outbound — multi-location DSO targeting for vertical SaaS sales",
  description:
    "See which practices run Dentrix, Eaglesoft, Open Dental, or Curve Dental — plus DSO parent, location count, hygienist team size, expansion signals. Built for vertical SaaS GTM teams selling into dental.",
});

export default function DentalPage() {
  const vertical = getVertical("dental-practice-software");
  const persona = PERSONAS[vertical.personaId];
  const pains = PAINS.filter((p) => vertical.painIds.includes(p.id));

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "For verticals", url: "/for" },
          { name: vertical.shortName, url: PATH },
        ])}
      />
      <JsonLd
        id="ld-service"
        data={serviceSchema({
          name: `LeadAC for ${vertical.name}`,
          description:
            "Operational intelligence for dental practice management software vendors: PMS signature detection, DSO parent linking via NPI registry, multi-location practice targeting, HubSpot-native sync.",
          url: `${SITE.url}${PATH}`,
          serviceType: "Sales Intelligence",
          audience: ["Dental practice management software vendors"],
        })}
      />

      <Hero
        eyebrow="For · Dental practice software"
        headline={vertical.hero.headline}
        subhead={vertical.hero.subhead}
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={vertical.sampleBrief}
        anchor={{
          note: "Built for",
          label: "DSO outbound — corporate parent + 5–500 practice locations",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "4 stacks",
            label:
              "Dentrix, Eaglesoft, Open Dental, Curve Dental — detected day one.",
          },
          {
            value: "DSO parent",
            label:
              "Linked via shared NPI registry, owner email, or recent acquisition press.",
          },
          {
            value: "Hygienist count",
            label:
              "Staff page heuristic — predicts contract size on patient management deals.",
          },
          {
            value: "12 fields",
            label:
              "Written into HubSpot — PMS install, DSO parent, location count, last acquisition.",
          },
        ]}
      />

      <VerticalSignalList
        eyebrow="What we index"
        title="The six signals that decide a dental practice outbound deal."
        subtitle="Every signal is observable in public — patient portal subdomain, NPI registry, acquisition press release. No private patient data, no PMS-internal API."
        vertical={vertical}
      />

      <ProblemGrid
        eyebrow="What's broken for dental GTM"
        title="Why the Apollo + Clay stack misses DSO outbound."
        intro="Dental practices and DSO parents don't show up cleanly in firmographic databases. The corporate parent and the operating practice are different records; the dominant outbound stack reads them as separate companies."
        pains={pains}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won DSO deal sharpens the next list — automatically."
        subtitle="Won deals against Dentrix DSOs weight the next list toward more Dentrix DSOs in the same region. Lost deals against single-location Eaglesoft practices down-weight that signal until your team adjusts."
      />

      <QuoteBlock persona={persona} />

      <LeadMagnetBlock
        eyebrow="Sample brief"
        title="Download a sample dental account brief."
        subtitle="One real multi-location DSO on Dentrix, anonymised. The brief landed in HubSpot in under three minutes — the same field map you would see on the demo call."
        bullets={[
          "Group profile: 12 locations across two states, parent DSO linked via NPI",
          "Stack signature: Dentrix + custom patient-portal subdomain",
          "Expansion: one acquisition in last 60 days, hiring Director of Operations",
          "Suggested opener: DSO-language, 2 sentences, ready to dial",
        ]}
        cta={vertical.sampleBrief}
      />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What dental software VPs of Sales ask on the call."
        entries={FAQS["for-dental"]}
      />

      <CtaBlock
        eyebrow="The pilot"
        title="Run the dental pack on 500 of your own accounts for 30 days."
        subtitle="$500 for the pilot. We pre-load Dentrix, Eaglesoft, Open Dental, and Curve Dental signal libraries plus the NPI-to-DSO parent linker. First brief lands inside the first hour."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
