"use client";

import { useMemo, useState } from "react";

/**
 * HubSpot signal coverage checker widget.
 *
 * The user pastes a list of HubSpot company-record field names — one
 * per line. We bucket each line into one of four signal categories and
 * report the operational-signal coverage gap.
 */

const FIRMOGRAPHIC_TOKENS = [
  "industry",
  "naics",
  "sic",
  "employees",
  "employee",
  "headcount",
  "revenue",
  "arr",
  "founded",
  "country",
  "state",
  "city",
  "address",
  "domain",
  "website",
  "phone",
];

const STACK_TOKENS = [
  "stack",
  "software",
  "platform",
  "tech",
  "saas",
  "pms",
  "pos",
  "crm_used",
  "tools",
];

const ACTIVITY_TOKENS = [
  "owner",
  "founder",
  "ceo_post",
  "google_business",
  "review",
  "rating",
  "yelp",
  "social",
  "linkedin_activity",
];

const SCALE_TOKENS = [
  "location",
  "branch",
  "site",
  "store",
  "office",
  "rooftop",
  "multi",
  "expansion",
  "hiring",
  "new_location",
];

type Bucket = "firmographic" | "stack" | "activity" | "scale" | "other";

const BUCKET_LABELS: Record<Bucket, string> = {
  firmographic: "Firmographic",
  stack: "Vertical stack",
  activity: "Owner activity",
  scale: "Scale & expansion",
  other: "Other",
};

function classify(field: string): Bucket {
  const f = field.toLowerCase();
  if (STACK_TOKENS.some((t) => f.includes(t))) return "stack";
  if (ACTIVITY_TOKENS.some((t) => f.includes(t))) return "activity";
  if (SCALE_TOKENS.some((t) => f.includes(t))) return "scale";
  if (FIRMOGRAPHIC_TOKENS.some((t) => f.includes(t))) return "firmographic";
  return "other";
}

const PLACEHOLDER = `industry
employees
annual_revenue
website
phone
city
country
hubspot_owner
lifecyclestage
lead_status`;

export function SignalCoverageWidget() {
  const [input, setInput] = useState(PLACEHOLDER);

  const stats = useMemo(() => {
    const fields = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const counts: Record<Bucket, number> = {
      firmographic: 0,
      stack: 0,
      activity: 0,
      scale: 0,
      other: 0,
    };
    fields.forEach((f) => {
      counts[classify(f)] += 1;
    });
    const operational =
      counts.stack + counts.activity + counts.scale;
    const total = fields.length || 1;
    const opPct = Math.round((operational / total) * 100);
    return { counts, total: fields.length, operational, opPct };
  }, [input]);

  return (
    <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6 md:p-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <label className="site-mono text-[12px] uppercase tracking-wider text-paper-3">
            Paste HubSpot company-record fields, one per line
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={14}
            className="site-mono mt-2 w-full rounded-md border border-ink-3 bg-ink-0 px-3 py-2 text-[13px] text-paper-0 focus:border-signal focus:outline-none"
            spellCheck={false}
          />
          <p className="mt-2 text-[12px] text-paper-3">
            Find your fields in HubSpot Settings → Properties → Company.
            Paste the internal names; we match on tokens, not exact strings.
          </p>
        </div>

        <div className="rounded-xl border border-ink-3 bg-ink-0 p-6">
          <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
            Operational signal coverage
          </div>
          <div className="site-mono mt-2 text-[44px] text-paper-0 md:text-[52px]">
            {stats.opPct}%
          </div>
          <div className="mt-1 text-[12px] text-paper-3">
            {stats.operational} of {stats.total} fields carry operational signal
          </div>

          <ul className="mt-6 grid gap-2">
            {(["stack", "activity", "scale", "firmographic", "other"] as Bucket[]).map(
              (b) => (
                <li
                  key={b}
                  className="flex items-baseline justify-between gap-3 border-b border-ink-3 pb-2 last:border-b-0"
                >
                  <span className="text-[14px] text-paper-1">
                    {BUCKET_LABELS[b]}
                  </span>
                  <span className="site-mono text-[14px] text-paper-0">
                    {stats.counts[b]}
                  </span>
                </li>
              ),
            )}
          </ul>

          <p className="mt-6 text-[13px] leading-relaxed text-paper-2">
            Most HubSpot company records score under 15% on operational
            signal coverage. The gap is the part LeadAC writes — vertical
            stack, owner activity, location count, expansion tag — into
            the same record alongside your firmographic fields.
          </p>
        </div>
      </div>
    </div>
  );
}
