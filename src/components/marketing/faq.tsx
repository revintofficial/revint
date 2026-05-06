"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QUESTIONS = [
  {
    q: "How is this different from Apollo or Clay?",
    a: "Apollo and Clay own the enterprise B2B database — that's their strong category. We're the local-business lead-intelligence layer Apollo doesn't cover well: our own continuously-refreshed local-business index, a real audit on every site, and an opener grounded in the audit. Most agencies run LeadAC in front of Apollo, not instead of it.",
  },
  {
    q: "What counts as one lead?",
    a: "One business pulled from our local-business index. Re-pulling the same business doesn't double-count; duplicates are filtered per workspace. Solo gets 1,000/month, Studio 2,500, Agency+ 5,000.",
  },
  {
    q: "Does it integrate with Smartlead, Instantly, or my existing sender?",
    a: "Yes. Solo and Studio plans export CSV formatted for Smartlead and Instantly with custom variables for the audit signals. Agency+ adds native Gmail and Outlook send with reply attribution. We don't replace your sender; we feed it.",
  },
  {
    q: "Is the AI sending emails for me?",
    a: "No. Auto-send is off by default. We generate the audit and the draft. You review and ship from your own inbox or sender. AI cold email without a human in the loop hurts brand and deliverability — we won't ship that.",
  },
  {
    q: "Where do the leads come from?",
    a: "From the LeadAC local-business index — refreshed continuously so every search returns current name, website, phone, rating, and hours. The index is built on top of public business profiles that the businesses themselves keep current, so the data is much more accurate than a scraped list. Enrichment (reviews, social, ads, LinkedIn signals) runs on top.",
  },
  {
    q: "How accurate is the audit scoring?",
    a: "The audit combines hard signals (no HTTPS, no mobile fit, no booking system, slow load, missing meta) with Gemini's qualitative read on business size and pain points. Scores are 0-100 with each reason listed, so you can sanity-check before pitching.",
  },
  {
    q: "How long until first booked call?",
    a: "Most operators see their first reply in week 1, first booked call in week 2-3. Retainer-grade clients tend to land in week 4. Faster if you already have a sender warmed and a working ICP.",
  },
  {
    q: "Can I bring more seats than my plan allows?",
    a: "Solo is 1 seat, Studio is 3 seats, Agency+ is 5 seats. Above 5 is custom. We don't charge a per-seat surcharge inside the included count.",
  },
  {
    q: "Annual or monthly?",
    a: "Annual saves 20% on the effective monthly rate. Monthly is on by default. Switch in Settings → Billing whenever the math works for you.",
  },
  {
    q: "Refund window?",
    a: "14-day trial with a card on file. If you don't pull a list and an audit you'd actually send, cancel inside 14 days and we refund. No 'are you sure?' loops.",
  },
  {
    q: "Is my data private?",
    a: "Your leads, notes, pipeline, voice notes, and saved playbook are scoped to your workspace. Only invited members see them. We don't share or resell, and we don't train models on your data.",
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
              background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.5)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
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
