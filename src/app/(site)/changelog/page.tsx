import type { Metadata } from "next";
import { Hero, CtaBlock } from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { CHANGELOG } from "@/content/site/changelog";

const PATH = "/changelog";

const KIND_LABELS: Record<(typeof CHANGELOG)[number]["kind"], string> = {
  ship: "Ship",
  milestone: "Milestone",
  vertical: "Vertical pack",
  integration: "Integration",
};

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: "Changelog — what we have shipped, dated",
  description:
    "Dated entries for every meaningful ship: vertical packs, integrations, product releases, and company milestones. We publish the date the work landed in production, not the date we announced it.",
});

export default function ChangelogPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Changelog", url: PATH },
        ])}
      />

      <Hero
        eyebrow="Changelog"
        headline="Dated entries for every meaningful ship."
        subhead="We publish the date the work landed in production, not the date we announced it. Newest first. No pre-launch promises, no &lsquo;coming soon.&rsquo;"
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />

      <section className="site-section">
        <div className="site-container">
          <ol className="mx-auto grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-ink-3 bg-ink-3">
            {CHANGELOG.map((c, i) => (
              <li key={i} className="bg-ink-1 p-6 md:p-7">
                <div className="flex flex-wrap items-baseline gap-3">
                  <time
                    dateTime={c.date}
                    className="site-mono text-[13px] text-paper-0"
                  >
                    {new Date(c.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <span className="site-mono rounded-full border border-signal/30 bg-[hsl(38_60%_15%_/_0.4)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-signal">
                    {KIND_LABELS[c.kind]}
                  </span>
                  {c.version ? (
                    <span className="site-mono text-[12px] text-paper-3">
                      v{c.version}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-[18px] leading-tight text-paper-0">
                  {c.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-paper-2">
                  {c.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBlock
        eyebrow="See it in product"
        title="Twenty minutes. Bring your CRM. We index one of your real accounts."
        subtitle="Every changelog entry above maps to a piece of the product. The demo is the fastest way to see the shipped work, not just read about it."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/blog", label: "Read the blog" }}
      />
    </>
  );
}
