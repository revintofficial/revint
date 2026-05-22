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
    q: "We already use HubSpot or Salesforce. What does LeadAC do that the CRM does not?",
    a: "The CRM is the system of record. LeadAC is the revenue intelligence layer that sits on top of it. We do not replace your CRM — we read it, build a per-vertical account graph around it, and write account briefs, detected stacks, and recommended angles back into the same lead and account records your team already opens.",
  },
  {
    q: "How is this different from Apollo, Clay, or Gong?",
    a: "Apollo gives you a firmographic list. Clay gives you infrastructure to build enrichment workflows yourself, but you have to build them. Gong analyses calls after they happen. LeadAC is the layer that does vertical-aware account discovery, deep local enrichment per account, CRM-native writes, and closed-loop learning from every won and lost deal. We're complementary to Gong, not competing with it.",
  },
  {
    q: "Which verticals does LeadAC cover today?",
    a: "Restaurant tech is the live beachhead — SaaS vendors selling POS, QR ordering, reservations, loyalty, and back-of-house systems into independent and small-chain restaurants. We're validating the model in production alongside a design-partner SaaS vendor in that segment. Field service / HVAC, dental practice software, and legal practice management ship next. Each vertical carries its own operational frame, so the system reasons about a two-location independent restaurant and a single-truck HVAC operator with the right context.",
  },
  {
    q: "How does account scoring actually work?",
    a: "LeadAC reads vertical-specific operational signals and produces a calibrated 0-100 fit score with the reasons listed. For restaurants, those signals include the detected POS, ordering and reservation provider, cuisine, whether the operator runs one location or several, review velocity, weekend-wait language patterns, digital-channel maturity, and site-tech footprint. Recommended angles come out of the same graph, so the rep's opener tracks what actually closes in that vertical sub-segment.",
  },
  {
    q: "Does the system learn from our closed deals?",
    a: "Yes — this is the core of the product. Closed-won and closed-lost reasons from your CRM feed the next reasoning step. Winning proof points reinforce. Losing patterns get pruned. The learning loop is scoped to your workspace, so the model gets sharper for your vertical over time without leaking across tenants.",
  },
  {
    q: "What does \"read in place\" mean for the integrations?",
    a: "LeadAC sits on top of the GTM stack you already run — CRMs, enrichment, sequencing, inbox, and dialer. We read what is already there and write our enrichment back into native CRM fields. Nothing to migrate. The full integration list is in the strip above; long tail is via Zapier, Make, n8n, and webhooks.",
  },
  {
    q: "Can multiple SDRs and AEs use it?",
    a: "Yes. Workspaces are seat-based with team tiers — typical first cohort is 5 to 15 seats. Account assignment and reply attribution route through your CRM's existing ownership model so you don't lose attribution when teammates send.",
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
