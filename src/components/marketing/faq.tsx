"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QUESTIONS = [
  {
    q: "Where do the leads come from?",
    a: "Lead Engine pulls real local businesses from Google Places — name, address, phone number, website, rating, review count. You search by niche and location, and we hit Google's Places API to surface every match.",
  },
  {
    q: "How accurate is the AI scoring?",
    a: "We combine deterministic signals (no HTTPS, no mobile site, no booking, broken links, slow load) with Gemini's qualitative analysis (business size, pain points, addressable market). The score is a 0-100 number, and we always show you the reasons behind it so you can sanity-check.",
  },
  {
    q: "Can I export my leads?",
    a: "Yes — Excel and PDF export are built in for any list or shortlist. Your data is yours.",
  },
  {
    q: "Do I need technical skills to use it?",
    a: "No. If you can search Google Maps, you can use Lead Engine. The whole flow is point-and-click: pick a niche, pick an area, hit Discover.",
  },
  {
    q: "What counts as one 'lead'?",
    a: "One lead = one business pulled from Google. The Free plan gets 50 leads/month, Pro gets 1,000, and Agency gets 10,000. Re-running the same search doesn't double-count — duplicates are filtered automatically.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel from Settings → Billing. You'll keep access until the end of your billing cycle, and your data is preserved for 30 days in case you come back.",
  },
  {
    q: "Is my data private?",
    a: "Your discovered leads, notes, pipeline, and shortlists are isolated to your workspace. Only members you invite can see them. We don't share or sell data, full stop.",
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
