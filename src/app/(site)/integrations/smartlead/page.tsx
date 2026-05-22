import type { Metadata } from "next";
import { ArrowRight, Mail, Send, Sparkles, ShieldCheck } from "lucide-react";
import {
  Hero,
  ProofRow,
  FaqBlock,
  CtaBlock,
  QuoteBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  serviceSchema,
} from "@/components/seo/json-ld";
import { PERSONAS } from "@/content/site/personas";
import { SITE } from "@/lib/seo/metadata";

/**
 * /integrations/smartlead — the handoff page.
 *
 * Psych: Endowment (psych-map). Smartlead is already in the buyer's
 * stack; LeadAC sits behind it and feeds the per-account context
 * Smartlead's variables can't synthesize on their own.
 */

const PATH = "/integrations/smartlead";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Smartlead handoff — pre-call context for your existing sequencer",
  description:
    "LeadAC writes per-account context Smartlead's variables can't synthesize — location count, vertical stack, owner activity. Webhook into your existing Smartlead workflow. No replacement, no rip-and-replace.",
});

const STEPS = [
  {
    icon: Sparkles,
    title: "1. We index the account",
    body: "Operational signals — vertical stack, location count, owner activity, review tone — get written into HubSpot.",
  },
  {
    icon: ArrowRight,
    title: "2. Smartlead pulls the brief",
    body: "On sequence-trigger, Smartlead fetches the LeadAC brief variables via webhook. No new tab, no SDR copy-paste.",
  },
  {
    icon: Send,
    title: "3. Your sequence personalises",
    body: "The same Smartlead sequence you already run, with per-account context baked into the merge fields automatically.",
  },
  {
    icon: ShieldCheck,
    title: "4. Replies flow back",
    body: "Smartlead reply data ingests back into LeadAC. Replies on the 'multi-location operator' tag refine the next list.",
  },
];

export default function SmartleadIntegrationPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Integrations", url: "/integrations" },
          { name: "Smartlead", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-service"
        data={serviceSchema({
          name: "LeadAC Smartlead handoff",
          description:
            "Webhook-based handoff from LeadAC's operational memory layer into Smartlead sequences. Per-account context as merge variables, reply data ingested back into the LeadAC closed loop.",
          url: `${SITE.url}${PATH}`,
          serviceType: "Outbound Integration",
        })}
      />

      <Hero
        eyebrow="Integrations · Smartlead"
        headline="Smartlead sends. We decide what should go in the send."
        subhead="LeadAC writes per-account context into the Smartlead merge fields your sequence already uses. Same sequence, same domain warmup, same dashboard — with the operational signal Smartlead's variables can't synthesise on their own."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/integrations/hubspot", label: "HubSpot first" }}
        anchor={{
          note: "Built on top of",
          label: "Smartlead Pro · $468/yr · stays your sender of record",
        }}
        visual={
          <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6">
            <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
              Smartlead merge fields LeadAC fills
            </div>
            <ul className="mt-5 grid gap-3 site-mono text-[13px] text-paper-0">
              <li className="flex justify-between gap-3 border-b border-ink-3 pb-2">
                <span>{`{{leadac.location_count}}`}</span>
                <span className="text-paper-2">e.g. &ldquo;4 locations&rdquo;</span>
              </li>
              <li className="flex justify-between gap-3 border-b border-ink-3 pb-2">
                <span>{`{{leadac.vertical_stack}}`}</span>
                <span className="text-paper-2">e.g. &ldquo;Housecall Pro&rdquo;</span>
              </li>
              <li className="flex justify-between gap-3 border-b border-ink-3 pb-2">
                <span>{`{{leadac.expansion_signal}}`}</span>
                <span className="text-paper-2">e.g. &ldquo;new location 21d&rdquo;</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>{`{{leadac.opener}}`}</span>
                <span className="text-paper-2">2-sentence draft</span>
              </li>
            </ul>
          </div>
        }
      />

      <ProofRow
        cells={[
          {
            value: "Webhook",
            label:
              "One webhook from Smartlead into LeadAC. No new sender, no new domain warmup.",
          },
          {
            value: "8 fields",
            label:
              "Available as Smartlead merge variables on day one of the integration.",
          },
          {
            value: "0 replacements",
            label:
              "Smartlead stays your sender of record, domain warmup, and reply inbox.",
          },
          {
            value: "Reply loop",
            label:
              "Smartlead replies ingest back into the LeadAC closed-loop refinement.",
          },
        ]}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="site-eyebrow mb-3">How the handoff works</div>
            <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              Four steps. Most of them happen in tools you already pay for.
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-paper-2">
              Smartlead remains the sender of record. LeadAC sits one layer
              behind it, filling the merge fields and reading the reply
              data to sharpen the next list.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink-3 bg-ink-3 md:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.title} className="bg-ink-1 p-6 md:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal/30 bg-[hsl(38_60%_15%_/_0.4)]">
                    <s.icon className="h-4 w-4 text-signal" />
                  </div>
                  <div className="text-[16px] font-medium text-paper-0">
                    {s.title}
                  </div>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-paper-2">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuoteBlock persona={PERSONAS.mike} />

      <FaqBlock
        eyebrow="Smartlead questions"
        title="What SDR managers ask before they wire the webhook."
        entries={[
          {
            question: "Does LeadAC replace Smartlead?",
            answer:
              "No. Smartlead stays the sender of record — your domain warmup, your reply inbox, your sequence templates. LeadAC fills the merge fields the sequence already uses; the email goes out from the same Smartlead account that sends today.",
          },
          {
            question: "What about Instantly, Apollo Sequences, or Outreach?",
            answer:
              "We support Smartlead native first. Instantly and Outreach are on the integration roadmap for Q3 2026. Apollo Sequences is supported via a CSV export today; native webhook is on the roadmap behind the broader Apollo integration.",
          },
          {
            question: "Do you write the sequences for us?",
            answer:
              "No. The sequence cadence, copy, and templates stay yours. LeadAC writes the per-account variables your sequence merges; the strategic decision about what cadence to send is your team's, not ours.",
          },
          {
            question: "Will replies still land in Smartlead?",
            answer:
              "Yes. Smartlead remains the reply inbox. LeadAC reads the reply data via webhook for the closed-loop ICP refinement; we never insert ourselves into the reply path.",
          },
        ]}
      />

      <CtaBlock
        eyebrow="See the handoff live"
        title="Bring your Smartlead account to the call. We'll wire the webhook in 10 minutes."
        subtitle="Twenty minutes. Smartlead OAuth on the call. You see one of your own active sequences pick up a LeadAC-filled brief in real time."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{
          href: "/integrations/hubspot",
          label: "Read the HubSpot integration",
        }}
      />
    </>
  );
}
