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

const FAQ: QA[] = [
  {
    q: "Does LeadAC send emails for me?",
    a: "No. The system generates the opener and the reasoning. You review and ship from your own inbox. Auto-send is off by default and stays that way unless you flip a toggle. AI cold email without a human in the loop burns deliverability.",
  },
  {
    q: "How does the AI scoring actually work?",
    a: "LeadAC reads operational signals: review velocity, reservation maturity, social activity, site quality, and sub-niche fit. The score is a calibrated 0-100 with the reasons listed, so you can sanity-check before pitching.",
  },
  {
    q: "What signals does LeadAC analyze?",
    a: "Maps coverage, up to 500 reviews per business, reservation and ordering tooling, SEO and site signals, social activity, competitor ad presence, and sub-niche classification.",
  },
  {
    q: "Does the system learn from outreach outcomes?",
    a: "Yes. Replies, meetings, and silent losses feed the next campaign's reasoning. Tone, opener structure, and angles that work in your niche get reinforced. The memory is scoped to your workspace.",
  },
  {
    q: "Does LeadAC work outside restaurants?",
    a: "It works for any local business with a public footprint, including dental, real estate, and home services. F&B is the most developed because that is where our beta cohorts live, but the system is not hard-coded to restaurants.",
  },
  {
    q: "Can multiple SDRs use it?",
    a: "Yes. Agency+ is workspace-based, not per-seat. Five seats included. Replies route back to the lead automatically so you do not lose attribution when teammates send.",
  },
  {
    q: "Where does the lead data come from?",
    a: "From our own continuously refreshed local-business index. Enrichment runs on top: reviews, social, competitor ads, hiring signals. All inside your monthly cap, no separate credit math.",
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
        {FAQ.map((item) => (
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
