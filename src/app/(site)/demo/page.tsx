import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ShieldCheck, Sparkles } from "lucide-react";
import {
  Hero,
  ProofRow,
  FaqBlock,
  QuoteBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { FAQS } from "@/content/site/faq";
import { PERSONAS } from "@/content/site/personas";

/**
 * /demo — book the 20-minute live walkthrough.
 *
 * Psych: Reciprocity + Commitment (psych-map). The page promises a
 * specific value (a brief written on your own account) in exchange for
 * a small commitment (20 minutes). brand-assets §3.3 demo cadence — no
 * "schedule a discovery call", just "twenty minutes on your own data".
 */

const PATH = "/demo";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Book a 20-minute demo — we'll run Revint on one of your own accounts",
  description:
    "Twenty minutes. Bring one prospect URL. We run Revint live, walk the brief that lands in your HubSpot card, and answer the four questions VPs of Sales ask before buying. No slideware.",
  index: true,
  follow: true,
});

const BOOKING_URL =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL || "/api/demo/book";

export default function DemoPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Demo", url: PATH },
        ])}
      />

      <Hero
        eyebrow="Twenty-minute walkthrough"
        headline="Bring one prospect URL. We'll write the HubSpot brief on the call."
        subhead="No slideware. Paste a website URL on the call, we run Revint live in our environment, and you see the twelve fields that would land in your HubSpot company record before your SDR opens the contact."
        primaryCta={{ href: "#book", label: "Pick a 20-minute slot" }}
        secondaryCta={{ href: "/pricing", label: "See pricing first" }}
        visual={
          <div className="grid gap-4">
            <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-signal" />
                <div className="text-[15px] font-medium text-paper-0">
                  20 minutes, end to end
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                Five minutes on your stack. Ten on a live brief for an
                account you bring. Five for your specific questions.
              </p>
            </div>
            <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-signal" />
                <div className="text-[15px] font-medium text-paper-0">
                  You leave with a written brief
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                The brief we generate during the call is yours. Use it on
                the next dial whether you sign up or not.
              </p>
            </div>
            <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-signal" />
                <div className="text-[15px] font-medium text-paper-0">
                  HubSpot OAuth is optional
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                Want the brief written into your CRM live? Connect HubSpot
                read-only on the call. Want to keep your CRM untouched?
                We&apos;ll walk the brief in our environment instead.
              </p>
            </div>
          </div>
        }
      />

      <ProofRow
        cells={[
          {
            value: "20 min",
            label:
              "Calendar block. No 60-minute discovery call masquerading as a demo.",
          },
          {
            value: "1 URL",
            label:
              "What you bring. The brief we generate is based on a real prospect of yours.",
          },
          {
            value: "12 fields",
            label:
              "Written into HubSpot if you connect OAuth. Same brief in our environment if you don't.",
          },
          {
            value: "0 SDR seat",
            label:
              "No live SDR seat required to evaluate. The pilot starts only when you decide it should.",
          },
        ]}
      />

      <section id="book" className="site-section">
        <div className="site-container">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-ink-3 bg-ink-1 p-8 md:p-10">
              <div className="site-eyebrow mb-3">Pick a time</div>
              <h2 className="text-[26px] leading-tight tracking-tight text-paper-0 md:text-[32px]">
                Twenty-minute slots, EST and PST, Monday through Thursday.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-paper-2">
                Calendar embed loads below. If the embed doesn&apos;t render
                in your browser, the direct booking link is one click away.
              </p>
              <div className="mt-6 aspect-[4/3] w-full overflow-hidden rounded-xl border border-ink-3 bg-ink-0">
                {/* The actual scheduler embed is wired in Phase 4 with the
                    real Cal.com / SavvyCal URL. The placeholder keeps the
                    page shippable on Day 1. */}
                <div className="flex h-full items-center justify-center p-8 text-center">
                  <div>
                    <Calendar className="mx-auto h-8 w-8 text-paper-3" />
                    <div className="mt-4 text-[16px] text-paper-1">
                      Scheduler loads here.
                    </div>
                    <p className="mt-2 text-[14px] text-paper-2">
                      Embed wired during onboarding integration phase.
                    </p>
                    <Link
                      href={BOOKING_URL}
                      className="site-btn-primary mt-6 inline-flex"
                    >
                      Open booking page
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6">
                <div className="site-eyebrow mb-3">Before the call</div>
                <ul className="grid gap-2.5 text-[14px] leading-relaxed text-paper-1">
                  <li className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                    Pick a prospect you&apos;d actually like the brief on.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                    Optional: bring the HubSpot company record open in another tab.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                    Optional: list one objection your stack hasn&apos;t answered.
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6">
                <div className="site-eyebrow mb-3">What happens after</div>
                <p className="text-[14px] leading-relaxed text-paper-2">
                  If Revint fits, you start the pilot the same week — $500
                  for 30 days, 500 accounts, one vertical pack, your real
                  CRM. If it doesn&apos;t fit, we say so on the call and
                  point you to whichever tool does.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <QuoteBlock persona={PERSONAS.daniel} />

      <FaqBlock
        eyebrow="Demo questions"
        title="What to expect — and what we don't do on the call."
        entries={FAQS.demo}
      />
    </>
  );
}
