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
 * /legal/privacy — privacy policy.
 *
 * Plain English, dated, and short enough that a VP Sales can read it on
 * the demo call. Anything that requires legal review lives behind a link
 * to the DPA so the public page stays honest.
 */

const PATH = "/legal/privacy";
const LAST_UPDATED = "May 22, 2026";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Privacy Policy",
  description:
    "How LeadAC collects, uses, and protects the data you bring into the platform. Plain English. Updated May 22, 2026.",
});

export default function PrivacyPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Legal", url: "/legal" },
          { name: "Privacy", url: PATH },
        ])}
      />

      <section className="site-section pt-24 md:pt-32">
        <div className="site-container">
          <div className="mx-auto max-w-3xl">
            <div className="site-eyebrow mb-3">Legal · Privacy</div>
            <h1 className="text-[32px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              Privacy Policy
            </h1>
            <p className="mt-4 text-[14px] text-paper-3">
              Last updated {LAST_UPDATED}.
            </p>

            <Section title="1. What this covers">
              <p>
                This policy covers how LeadAC (&ldquo;we&rdquo;, &ldquo;us&rdquo;) handles
                information when you visit {SITE.url} or use the LeadAC
                product. It covers the marketing site, the authenticated
                app, and the data we ingest from third-party integrations
                you choose to connect.
              </p>
            </Section>

            <Section title="2. What we collect — site visitors">
              <p>We collect three categories of data from site visitors:</p>
              <ul>
                <li>
                  <strong>Page-level traffic.</strong> URL, referrer, browser
                  user agent, anonymised IP, screen size, and country.
                  Recorded by our first-party analytics tracker (no
                  third-party cookies are set).
                </li>
                <li>
                  <strong>Submitted information.</strong> Email address,
                  full name, company name, and anything else you type into
                  a contact, demo, or pilot signup form.
                </li>
                <li>
                  <strong>Inferred information.</strong> Industry vertical
                  and company size derived from the company domain you
                  provide. Used to route demo requests to the right
                  vertical pack.
                </li>
              </ul>
            </Section>

            <Section title="3. What we collect — customers">
              <p>
                Once you sign in, LeadAC ingests data you authorise via
                OAuth: HubSpot company and contact records (plus the deal
                stages you select for closed-loop ingestion), Pipedrive
                or Close records (if connected), and SDR-level usage data
                inside the LeadAC dashboard.
              </p>
              <p>
                Customer-content data is stored encrypted at rest with
                AWS KMS and in transit with TLS 1.3, isolated per
                workspace at the database row level.
              </p>
            </Section>

            <Section title="4. How we use it">
              <ul>
                <li>
                  To run the product — enrich your accounts, write fields
                  into your CRM, sharpen your ICP from closed-won and
                  closed-lost outcomes.
                </li>
                <li>
                  To service your account — billing, support, security,
                  and onboarding emails. We use Resend for transactional
                  email delivery.
                </li>
                <li>
                  To improve LeadAC — aggregated, non-identifying usage
                  data informs product decisions. Customer CRM data is
                  never used to train models.
                </li>
                <li>
                  To meet legal obligations — tax records, audit logs,
                  and lawful requests we are obligated to comply with.
                </li>
              </ul>
            </Section>

            <Section title="5. What we never do">
              <ul>
                <li>
                  We do not train our pattern-matching models on customer
                  CRM data. Cross-workspace inference is impossible by
                  construction.
                </li>
                <li>
                  We do not sell your data. We do not rent your data. We
                  do not enrich third-party datasets with your contacts.
                </li>
                <li>
                  We do not set third-party advertising cookies on the
                  marketing site.
                </li>
              </ul>
            </Section>

            <Section title="6. Sub-processors">
              <p>
                LeadAC runs on AWS (us-east-1, with EU/UK residency on
                Enterprise). We rely on the following sub-processors for
                specific functions: Supabase (auth), Stripe (billing),
                Resend (transactional email), Google Gemini (signal
                extraction). The full sub-processor list is maintained in
                our DPA.
              </p>
            </Section>

            <Section title="7. Your rights">
              <p>
                EU, UK, and California residents have rights of access,
                correction, deletion, portability, and objection. To
                exercise any of them, write to{" "}
                <a className="site-source" href={`mailto:${SITE.email}`}>
                  {SITE.email}
                </a>
                . We respond within 30 days.
              </p>
              <p>
                If you cancel your subscription, you have 30 days to
                export your data through the LeadAC dashboard. After 30
                days, the data is deleted per the retention policy.
              </p>
            </Section>

            <Section title="8. Contact">
              <p>
                Privacy questions:{" "}
                <a className="site-source" href={`mailto:${SITE.email}`}>
                  {SITE.email}
                </a>
                .
              </p>
              <p>
                For the full Data Processing Agreement, request a copy
                via{" "}
                <Link className="site-source" href="/demo">
                  the demo form
                </Link>{" "}
                — we email the latest version on request.
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
