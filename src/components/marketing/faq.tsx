"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QUESTIONS = [
  {
    q: "How is this different from Apollo or Clay?",
    a: "Apollo and Clay sell the same 50M B2B contacts to thousands of agencies, so the same prospects get hit by ten different pitches a month. Leadac AI pulls live from Google Maps every time you search, so the data is fresh and the businesses keep it current themselves. We focus on local service verticals like plumbers and dental practices, where Apollo's coverage is thin to begin with.",
  },
  {
    q: "Does it integrate with Smartlead, Instantly, or my existing sender?",
    a: "Yes. Pro and Agency plans include native CSV export in Smartlead and Instantly format, with custom variables for the mockup URL and the audit signals. Drop the file into your sender and the personalization fields wire up on import. We don't replace your sender; we feed it.",
  },
  {
    q: "Is the AI sending emails for me?",
    a: "No. Auto-send is off by default. Leadac AI generates the audit, the mockup, and the draft opener. You review and ship from your own inbox or sender. AI cold outreach with no human in the loop hurts brand and deliverability; we won't ship that.",
  },
  {
    q: "Where do the leads come from?",
    a: "Live from Google Maps via the Places API: business name, website, phone, plus rating and hours. Searched fresh for every query. Businesses keep their own Google profile current, so the data is much more accurate than a scraped list.",
  },
  {
    q: "What's the website mockup for?",
    a: "For each shortlisted lead, Leadac AI generates a custom one-page mockup (hero, services, CTA) populated with the business's real info. You attach the mockup link to your cold email, so the message goes from 'hi, I might be useful' to 'I built you a draft, link below.' That's the difference between 1% and 4% reply rates.",
  },
  {
    q: "How accurate is the AI scoring?",
    a: "We combine hard signals (no HTTPS, no mobile fit, no booking system, slow load, missing meta) with Gemini's qualitative read on business size and pain points. Scores are 0-100 with the reasons listed, so you can sanity-check before pitching.",
  },
  {
    q: "What counts as one lead?",
    a: "One lead = one business pulled from Google. Free gets 50/month, Pro gets 1,000, Agency gets 10,000. Re-running the same search doesn't double-count, since duplicates get filtered per workspace.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, from Settings → Billing. You keep access through the end of your billing cycle. Data is preserved for 30 days if you come back. Free plan never charges, so there's nothing to cancel.",
  },
  {
    q: "Is my data private?",
    a: "Your leads, notes, pipeline, and shortlists are isolated to your workspace. Only invited members see them. We don't share or sell your data, and we don't use it to train models.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {QUESTIONS.map((qa, i) => {
        const isOpen = open === i;
        return (
          <div
            key={qa.q}
            className="rounded-xl overflow-hidden"
            style={{
              background: "rgba(28,28,30,0.5)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5E6AD2]"
              aria-expanded={isOpen}
            >
              <span className="text-[14px] font-medium text-white">{qa.q}</span>
              <ChevronDown
                className="w-4 h-4 text-white/45 transition-transform shrink-0"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-[13px] text-white/60 leading-relaxed">
                {qa.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
