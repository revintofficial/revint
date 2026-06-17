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
    q: "We already use HubSpot or Salesforce. What does Revint actually add?",
    a: "Your CRM is the system of record. It knows the deal, the stage, and the owner. It does not know that this account has 8 locations, runs on Square POS, and has rising wait-time complaints in its last 30 reviews. Revint writes that context into the same lead and account records your team already opens. Nothing to migrate.",
  },
  {
    q: "How is this different from Apollo, Clay, or Gong?",
    a: "Apollo gives you a list. Clay gives you workflows you have to build yourself. Gong records the calls. None of the three remember what your team figured out on the last call when they sit down to make the next one. We laid out the full comparison, including the cost of building the same thing yourself, at /vs/apollo-clay-gong.",
  },
  {
    q: "Which verticals work today?",
    a: "Restaurant tech is live. We are running it in production alongside a design-partner SaaS vendor in that segment. Field service and HVAC, dental practice software, and legal practice management ship next. If you sell into a local-business vertical we have not announced yet, email the founder and we will tell you honestly how far we can go.",
  },
  {
    q: "Does the system actually learn from our closed deals?",
    a: "Yes. Closed-won and closed-lost reasons from your CRM feed the next discovery run. Segments that close fast get more weight. Segments that go quiet get pruned. The learning loop stays scoped to your workspace, so the model sharpens for your vertical without ever leaking across tenants.",
  },
  {
    q: "How fast do we see the first list?",
    a: "Connect the CRM, write your ICP in plain English, and the first 200 enriched accounts land in your CRM inside an hour. Closed-loop kicks in after the first ten deals you log.",
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
      <div className="mx-auto max-w-3xl divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_8%)]">
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
          href="mailto:mert@revint.dev"
          className="text-white/75 hover:text-white underline-offset-4 hover:underline"
        >
          Email mert@revint.dev
        </a>
      </p>
    </Section>
  );
}
