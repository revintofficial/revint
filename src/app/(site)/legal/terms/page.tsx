import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

/**
 * /legal/terms — terms of service.
 *
 * Same approach as the privacy page: plain English, dated. The MSA-grade
 * legal language lives in the standalone MSA document; this page covers
 * the self-serve subscription path.
 */

const PATH = "/legal/terms";
const LAST_UPDATED = "May 22, 2026";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Terms of Service",
  description:
    "The agreement between LeadAC and the customer when you start a pilot or subscription. Plain English. Updated May 22, 2026.",
});

export default function TermsPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Legal", url: "/legal" },
          { name: "Terms", url: PATH },
        ])}
      />

      <section className="site-section pt-24 md:pt-32">
        <div className="site-container">
          <div className="mx-auto max-w-3xl">
            <div className="site-eyebrow mb-3">Legal · Terms</div>
            <h1 className="text-[32px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              Terms of Service
            </h1>
            <p className="mt-4 text-[14px] text-paper-3">
              Last updated {LAST_UPDATED}.
            </p>

            <Section title="1. The agreement">
              <p>
                When you start a LeadAC subscription you agree to these
                Terms. If you sign a custom MSA later, the MSA governs and
                these Terms become a fallback for anything the MSA
                doesn&apos;t cover.
              </p>
            </Section>

            <Section title="2. The pilot">
              <p>
                The 30-day pilot is $500 charged on signup. It includes
                500 enriched accounts, one vertical pack, one SDR seat,
                and live onboarding. The pilot is not a free trial — the
                fee is not refundable except as described below.
              </p>
              <p>
                At the end of 30 days, the workspace converts to the
                month-to-month tier you select. We never auto-roll you
                onto a higher tier. If you don&apos;t pick one, the
                workspace pauses until you do.
              </p>
            </Section>

            <Section title="3. Subscriptions and billing">
              <p>
                Subscriptions are monthly unless you sign an annual
                addendum. Stripe handles billing. Cards are charged on the
                same calendar day each month; failed charges retry three
                times over seven days before the workspace pauses.
              </p>
              <p>
                You can cancel anytime from the billing portal or by
                emailing your success contact. Cancellation takes effect
                at the end of the current billing period; you keep
                access through the period you&apos;ve paid for.
              </p>
            </Section>

            <Section title="4. What you own. What we own.">
              <p>
                <strong>You own your data.</strong> Everything you ingest
                via HubSpot, Pipedrive, Close, or direct import — the
                contacts, companies, deals, lost reasons, signal overrides
                — is yours. You export it whenever you want.
              </p>
              <p>
                <strong>We own the platform.</strong> The LeadAC software,
                the signal libraries, the vertical packs, the prompts, and
                the models stay ours. Your subscription is a licence to
                use them, not a transfer of ownership.
              </p>
            </Section>

            <Section title="5. Acceptable use">
              <p>You agree not to:</p>
              <ul>
                <li>
                  Use LeadAC to send unsolicited bulk email, run scams, or
                  contact lists you do not have lawful permission to
                  contact.
                </li>
                <li>
                  Reverse-engineer the platform, scrape the dashboard, or
                  redistribute LeadAC outputs as your own product.
                </li>
                <li>
                  Use LeadAC to enrich consumer-grade contact data outside
                  of B2B sales contexts.
                </li>
              </ul>
              <p>
                We can suspend a workspace that violates this section.
                Suspension for cause is not refundable.
              </p>
            </Section>

            <Section title="6. Service availability">
              <p>
                We target 99.5% monthly uptime. Scheduled maintenance is
                announced at least 48 hours in advance and lands outside
                the US business-hour window when possible. We don&apos;t
                publish a financial SLA on the self-serve tiers; the
                Enterprise tier carries a contractual SLA with credits.
              </p>
            </Section>

            <Section title="7. Liability">
              <p>
                We are liable for breaches of these Terms up to 12 months
                of fees paid by you in the period immediately before the
                claim. We are not liable for indirect, incidental, or
                consequential damages — lost revenue, lost pipeline, lost
                profit — to the extent the law permits us to disclaim
                them.
              </p>
            </Section>

            <Section title="8. Governing law">
              <p>
                These Terms are governed by the laws of England and Wales.
                Disputes go to the courts of London unless a customer
                location-specific addendum says otherwise.
              </p>
            </Section>

            <Section title="9. Changes">
              <p>
                We update these Terms when the product or the law moves.
                We email subscribers 30 days before a material change.
                Continued use after the change takes effect is acceptance.
              </p>
            </Section>

            <Section title="10. Contact">
              <p>
                Legal questions:{" "}
                <a className="site-source" href={`mailto:${SITE.email}`}>
                  {SITE.email}
                </a>
                . Custom MSA?{" "}
                <Link className="site-source" href="/demo">
                  Book a 20-minute demo
                </Link>{" "}
                and ask on the call.
              </p>
            </Section>
          </div>
        </div>
      </section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-10">
      <h2 className="text-[20px] font-medium tracking-tight text-paper-0 md:text-[24px]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-paper-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_strong]:text-paper-0">
        {children}
      </div>
    </div>
  );
}
