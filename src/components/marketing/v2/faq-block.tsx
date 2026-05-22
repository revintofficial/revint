/**
 * FAQ accordion for the v2 marketing surface.
 *
 * Design intent: native HTML accordion using <details>/<summary> so we
 * stay server-only and free of JS. A manually-rendered ChevronDown
 * rotates 180deg when the details element is open (via
 * `[&[open]_svg]:rotate-180`). The block adapts to the coming-soon
 * flag for the headline and sub. Email fallback at the bottom for the
 * inevitable eighth question.
 */
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";
import { Section } from "./section";

interface QA {
  q: string;
  a: string;
}

export const HOMEPAGE_FAQ: QA[] = [
  {
    q: "We have HubSpot already. What does LeadAC do that HubSpot does not?",
    a: "HubSpot is the activity ledger. LeadAC is the revenue intelligence layer that sits on top of it. We do not replace your CRM — we read it, alongside your enrichment and outreach, and turn campaign outcomes into niche-specific patterns your team can operate on. Activity continues to write back into HubSpot in the normal way.",
  },
  {
    q: "What does \"revenue intelligence for local business acquisition\" actually mean?",
    a: "It means one model behind outreach, enrichment, and campaign outcomes. LeadAC reads reviews, websites, social activity, outreach replies, and operational behavior, then assembles a graph of niches, messaging patterns, buying behavior, and conversion outcomes. Reps get evidence where they work. Leaders operate on portfolio-level conversion.",
  },
  {
    q: "Which niches does LeadAC cover today?",
    a: "F&B is the live cohort — restaurants, cafes, bakeries, bars, brunch spots, and ghost kitchens. Medspa, home services, and fitness ship next. Each niche carries its own operational frame, so the system reasons about a fine-dining restaurant and a fitness studio with the right economic context.",
  },
  {
    q: "How does the scoring and messaging actually work?",
    a: "LeadAC reads operational signals — review velocity, reservation or booking maturity, social activity, site quality, and sub-niche fit — and produces a calibrated 0-100 fit score with the reasons listed. Messaging recommendations and outreach angles are generated from the same graph, so the rep's opener tracks with what is actually moving conversion in that niche.",
  },
  {
    q: "Does the system learn from outreach outcomes?",
    a: "Yes. Replies, meetings, objections, and silent losses feed the next campaign's reasoning. Win patterns reinforce. Losing patterns get pruned. The learning loop is scoped to your workspace, so the model gets sharper for your niche over time without leaking across tenants.",
  },
  {
    q: "What does \"read in place\" mean for the integrations?",
    a: "LeadAC sits on top of the outbound stack you already run — CRMs, enrichment systems, sequencing tools, inbox infrastructure, and campaign workflows. We read what is already there. Nothing to migrate. The full integration list is in the strip above; long tail is via Zapier, Make, n8n, and webhooks.",
  },
  {
    q: "Can multiple SDRs use it?",
    a: "Yes. Agency+ is workspace-based, not per-seat. Five seats included. Replies route back to the lead automatically so you do not lose attribution when teammates send.",
  },
];

export function FaqBlock() {
  const headline = MARKETING_COMING_SOON
    ? "Answers before launch."
    : "Before you sign up.";
  const sub = MARKETING_COMING_SOON
    ? "Quick answers. Full story when signup opens."
    : "Quick answers. Longer ones are one email away.";

  return (
    <Section id="faq" eyebrow="Questions" headline={headline} sub={sub}>
      <div className="mx-auto max-w-3xl divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_8%)]">
        {HOMEPAGE_FAQ.map((item) => (
          <details
            key={item.q}
            className="group [&_summary::-webkit-details-marker]:hidden [&[open]_svg]:rotate-180"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 md:px-6 md:py-5 text-[14.5px] md:text-[15px] font-medium text-white/90 hover:text-white">
              <span>{item.q}</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform text-white/45"
                aria-hidden
              />
            </summary>
            <div className="px-5 pb-5 md:px-6 md:pb-6 -mt-1 text-[14px] text-white/60 leading-relaxed">
              {item.a}
            </div>
          </details>
        ))}
      </div>

      <p className="mt-6 text-center text-[13px] text-white/45">
        Still have questions?{" "}
        <a
          href="mailto:mert@leadacai.com"
          className="text-white/75 hover:text-white underline-offset-4 hover:underline"
        >
          Email mert@leadacai.com
        </a>
      </p>
    </Section>
  );
}
