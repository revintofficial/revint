import type { Metadata } from "next";
import {
  Hero,
  ManifestoBlock,
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
 * /about — who built Revint, and why now.
 *
 * Psych: Credibility / Authority (psych-map). Specific dates, specific
 * cities, specific prior roles. brand-assets §1.4 internal manifesto
 * cadence — we owe the reader a real story, not a generic founding myth.
 */

const PATH = "/about";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "About Revint — who built it, and why now",
  description:
    "Founded in 2026 by a small team that previously worked on outbound at vertical SaaS companies. Based in London, with team members in Istanbul and the US.",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "About", url: PATH },
        ])}
      />

      <Hero
        eyebrow="About"
        headline="We built Revint because we kept rebuilding it in our own jobs."
        subhead="The founders previously ran outbound at vertical SaaS companies — restaurant tech, field service software, dental practice management. Every time we changed jobs, the pattern in our SDR team's head got rebuilt from scratch. Revint is the system that captures it once."
        primaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />

      <ProofRow
        cells={[
          {
            value: "2026",
            label: "Founded. Pre-seed funded. Three vertical packs shipped.",
          },
          {
            value: "London + IST + US",
            label: "Three time zones. Eight people. Two engineers per timezone.",
          },
          {
            value: "$2M-$50M ARR",
            label:
              "ICP — vertical SaaS GTM teams that need memory at mid-market price.",
          },
          {
            value: "Sales-led",
            label:
              "Pilot starts at $500. Demos are 20 minutes. We pass on more deals than we close.",
          },
        ]}
      />

      <ManifestoBlock
        eyebrow="Why now"
        title="Gong proved the memory thesis. The price floor that came with it left vertical SaaS behind."
        paragraphs={[
          "Gong's Revenue Graph launch in May 2026 made the memory thesis official: the future of revenue tooling is a layer that remembers what happens, automatically. Gong's product is conversation memory — it indexes what your team said on calls and emails — and it costs $100,000 per year for 25 reps with eight weeks of RevOps engineering.",
          "Operational memory — what the account is doing in the world, not what your team said about it — is a different substrate. Same word, different layer. And for the 50,000 vertical SaaS companies sitting between $2M and $50M ARR, operational memory matters more than conversation memory. They don't lose deals because of what an SDR said on a call. They lose deals because nobody on the team knew the prospect was a multi-location operator with a hiring signal in the operations seat.",
          "We built Revint for that segment. Vertical SaaS GTM teams selling to local business — restaurant tech, field service software, dental practice management, beauty and wellness software. The memory layer their CRM never had, at a price that fits a 5-seat team.",
        ]}
        pullQuote={{
          quote:
            "Same word, different substrate. Gong indexes what your team said. We index what the account is doing.",
        }}
      />

      <ManifestoBlock
        eyebrow="Where we sit"
        title="One step below the orchestrator. One step above the database."
        paragraphs={[
          "Apollo is the contact database. Clay is the workflow runtime. Smartlead is the sender. Gong is the conversation recorder. None of the four feeds your closed-won and closed-lost outcomes back into the next list — the layer of pattern that lives in your best SDR's head and walks out the door when they quit.",
          "Revint sits in that gap. We do not replace Apollo's contact list. We do not replace Clay's workflow logic. We do not replace Gong's transcripts. We sit one layer below the orchestrator, one layer above the contact database, and we write twelve fields into your HubSpot company record before your SDR opens the contact.",
          "If you have a Salesforce + Gong + dedicated RevOps stack, you are not our customer and we will say so on the call. If you have HubSpot, Apollo, Smartlead, and an SDR team that is rebuilding the pattern from scratch every time someone quits, we are exactly your tool.",
        ]}
      />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What buyers ask before they call us."
        entries={FAQS.about}
      />

      <CtaBlock
        eyebrow="Want the long-form version"
        title="The manifesto explains the category. The demo explains the product."
        subtitle="The manifesto is a 12-minute read. The demo is 20 minutes. Most buyers do one before the other."
        primaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
        secondaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
      />
    </>
  );
}
