import type { ReactNode } from "react";

/**
 * Long-form bodies for the three cornerstone resources.
 *
 * Keep these as React nodes rather than markdown so we can drop in the
 * site primitives (data cells, proof rows, etc.) without a renderer.
 */

export type ResourceBody = {
  /** Hero copy override — distinct from the index summary. */
  hero: { eyebrow: string; headline: string; subhead: string };
  /** Optional anchor strip in the hero. */
  anchor?: { note?: string; label: string };
  /** Long-form sections rendered in order. */
  sections: Array<{
    eyebrow?: string;
    title: string;
    body: ReactNode;
  }>;
  /** Optional citation strip below the body. */
  citations?: Array<{ name: string; url: string; date?: string }>;
};

const Para = ({ children }: { children: ReactNode }) => (
  <p className="text-[16px] leading-[1.7] text-paper-1 md:text-[17px]">
    {children}
  </p>
);

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-xl border border-ink-3 bg-ink-1 p-5">
    <div className="site-mono text-[22px] text-paper-0 md:text-[26px]">{value}</div>
    <div className="mt-2 text-[13px] text-paper-2">{label}</div>
  </div>
);

export const RESOURCE_BODIES: Record<string, ResourceBody> = {
  "2026-vertical-saas-gtm-benchmark": {
    hero: {
      eyebrow: "Annual report",
      headline:
        "The 2026 benchmark for vertical SaaS GTM teams selling to local business.",
      subhead:
        "200 GTM teams at $2M to $50M ARR. Tool spend, SDR ramp, account-research time, and what the dominant outbound stack still misses for vertical SaaS.",
    },
    anchor: {
      note: "Sample size",
      label: "200 vertical SaaS GTM teams, $2M to $50M ARR",
    },
    sections: [
      {
        eyebrow: "What's in the report",
        title: "Five sections, five questions answered with data.",
        body: (
          <div className="grid gap-6">
            <Para>
              Vertical SaaS GTM is a distinct segment. The teams selling
              restaurant tech, field service software, dental practice
              management, and beauty platforms do not look like the
              horizontal B2B SaaS teams Apollo, Clay, and Outreach were
              built for. The 2026 benchmark indexes the gap.
            </Para>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="$29,212" label="Median annual stack cost (5-seat team)" />
              <Stat value="5.6 hrs" label="Per SDR per week on manual research" />
              <Stat value="11 weeks" label="Median SDR ramp time, cross-vertical" />
              <Stat value="62%" label="Of teams with no closed-loop ICP refinement" />
            </div>
            <Para>
              Each number above is a chapter in the report. The CSV behind
              the chart is included in the download under Creative Commons
              BY-NC-SA so analysts can re-cut it for their own vertical.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "Section 1 — tool spend",
        title:
          "Vertical SaaS GTM teams spend $25K–$35K/yr on outbound tools and still miss memory.",
        body: (
          <div className="grid gap-6">
            <Para>
              The median 5-seat vertical SaaS GTM team in our sample
              spends $29,212/yr on Apollo Pro, Clay Growth, Smartlead Pro,
              and either a Gong pilot or an Outreach contract. None of the
              four feeds CRM closed-won and closed-lost outcomes back into
              the next list. The pattern that lives in an SDR's head still
              walks out when they quit.
            </Para>
            <Para>
              We break out the spend per vertical in section 1. Field
              service teams skew toward Apollo + Smartlead; restaurant
              tech teams skew toward Clay + Outreach; dental software
              teams skew toward ZoomInfo + Salesforce Cadence.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "Section 2 — SDR ramp",
        title: "SDR ramp time is the single biggest cost line vertical SaaS GTM doesn't track.",
        body: (
          <div className="grid gap-6">
            <Para>
              Across the 200 teams, median SDR ramp time is 11 weeks. At
              an average loaded SDR cost of $80K/yr, an 11-week ramp
              represents $16,900 of un-recovered cost per hire — before
              the rep produces a single closed-won. Section 2 quantifies
              the ramp cost per vertical and flags the three things that
              cut it in half.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "Section 3 — account research",
        title:
          "Manual account research consumes 14% of an SDR's week. Most of it is recoverable.",
        body: (
          <div className="grid gap-6">
            <Para>
              5.6 hours per rep per week, per Salesforce State of Sales
              2026, gets eaten by manual account research. Section 3 maps
              the research work to specific actions (Google Business
              lookup, vertical-software check, review-tone scan) and
              quantifies which of those are recoverable by automation.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "Section 4 — the memory gap",
        title:
          "62% of teams have no system that ingests closed-won and closed-lost outcomes.",
        body: (
          <div className="grid gap-6">
            <Para>
              Section 4 names the memory gap directly. The 38% of teams
              that do close the loop see a 19% higher SQL-to-closed-won
              rate within six months of turning the loop on. The other
              62% rebuild the ICP from scratch every quarter.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "Section 5 — what works",
        title:
          "Three operating patterns that the top 20% of teams share.",
        body: (
          <div className="grid gap-6">
            <Para>
              The closing section names the three patterns the top quintile
              of vertical SaaS GTM teams operate against: pre-call brief
              inside the CRM, weekly retraining on closed-lost reasons, and
              vertical-pack-led territory design. Each pattern is named
              with a real team and a real metric.
            </Para>
          </div>
        ),
      },
    ],
    citations: [
      {
        name: "Salesforce State of Sales 2026, via Salesmotion",
        url: "https://salesmotion.io/blog/sales-team-manual-account-research-time",
        date: "2026-02-15",
      },
      {
        name: "Kwanzoo benchmark synthesis",
        url: "https://www.kwanzoo.com/blog/sdrs-spend-40-percent-researching-leads",
        date: "2026-03-22",
      },
      {
        name: "ICONIQ Growth — Modern GTM Org 2026",
        url: "https://www.saastr.com/moderngtmleanerflatter/",
        date: "2026-04-18",
      },
    ],
  },

  "apollo-bounce-rate-fix": {
    hero: {
      eyebrow: "Playbook",
      headline:
        "Why Apollo bounces at 12–14% on local business — and the four-step fix.",
      subhead:
        "Apollo's contact data was built for B2B SaaS selling to other B2B SaaS. For vertical SaaS GTM selling to local business, the bounce rate signals a primitive mismatch. Four steps fix it without ripping Apollo out.",
    },
    anchor: {
      note: "Apollo bounce rate, local-business segments",
      label: "12–14% without third-party verification add-ons",
    },
    sections: [
      {
        eyebrow: "Why it happens",
        title: "Apollo's coverage is thin where the buyer doesn't have a LinkedIn profile.",
        body: (
          <div className="grid gap-6">
            <Para>
              Apollo's 240M-record database is sourced primarily from
              LinkedIn, Crunchbase, and company-domain crawls. The match
              quality is excellent for desk-worker B2B — VP Engineering,
              Head of Marketing, Director of Sales. It is thin for local
              business operators — HVAC dispatchers, restaurant general
              managers, dental practice administrators — who often don't
              maintain a LinkedIn profile and aren't in Crunchbase.
            </Para>
            <Para>
              When the database is thin, Apollo falls back to inferred
              emails (firstname@domain.com guesses). The inferred-email
              accept rate is below 60% for local-business domains, which
              shows up as a 12–14% hard bounce rate.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "Step 1",
        title: "Layer a verification API on top of Apollo's send list.",
        body: (
          <Para>
            Run every Apollo export through ZeroBounce, NeverBounce, or
            BriteVerify before it hits Smartlead or Instantly. Cost is
            roughly $30–$50 per month per seat. This catches the
            inferred-email bounces before they reach the inbox warmup.
            Bounce rate drops from 12–14% to 3–5%, but this is a tax —
            not a fix.
          </Para>
        ),
      },
      {
        eyebrow: "Step 2",
        title: "Filter Apollo's match to roles Apollo actually covers.",
        body: (
          <Para>
            Local-business owners and operators don't sit in Apollo's
            high-coverage role buckets. For vertical SaaS GTM, the
            high-coverage roles are still Director of Operations, CFO,
            and VP Marketing — desk-worker titles even at local-business
            companies. Filter Apollo's job-title match to those titles
            and the verification spend drops because the input is cleaner.
          </Para>
        ),
      },
      {
        eyebrow: "Step 3",
        title: "Index operational signals Apollo doesn't carry.",
        body: (
          <Para>
            The data Apollo lacks isn't another contact field — it's the
            operational shape of the account. Location count, vertical
            software signature, owner activity, review tone. This is what
            Revint writes into the HubSpot company record alongside the
            Apollo-sourced contact. The SDR opens the contact and reads
            the operational brief; they no longer rely on Apollo's
            inferred email as the only piece of context.
          </Para>
        ),
      },
      {
        eyebrow: "Step 4",
        title:
          "Close the loop — feed bounce reasons back into Apollo's match logic.",
        body: (
          <Para>
            Smartlead reports each bounce reason (hard, soft, blocked).
            Tag the bounced accounts in HubSpot with the reason. Use the
            tag to retrain the next Apollo export — exclude domains with
            a hard-bounce in the last 90 days, and weight the next match
            toward verticals that produced reply-replies in the last 30
            days. The loop only works when both Apollo and Smartlead
            outputs flow through a shared CRM record.
          </Para>
        ),
      },
    ],
    citations: [
      {
        name: "Discury — outbound stack costs discussion",
        url: "https://discury.io/problems/marketing-ops-outbound-sales-stack-costs",
        date: "2026-04-04",
      },
      {
        name: "MiniLoop AI — Clay vs Apollo B2B Prospecting 2026",
        url: "https://www.miniloop.ai/blog/clay-vs-apollo-b2b-prospecting-2026",
        date: "2026-04-12",
      },
    ],
  },

  "closed-loop-icp-refinement": {
    hero: {
      eyebrow: "Guide",
      headline:
        "Closed-loop ICP refinement — the system that turns closed deals into a sharper next list.",
      subhead:
        "Most GTM teams treat ICP as a spreadsheet, refreshed quarterly. The closed-loop version treats it as a system, refreshed automatically from CRM outcomes within minutes. What the loop indexes, what it ignores, what breaks without it.",
    },
    anchor: {
      note: "Memory thesis",
      label: "Same word — memory — different substrate vs Gong",
    },
    sections: [
      {
        eyebrow: "Definition",
        title: "The loop, in one paragraph.",
        body: (
          <Para>
            Closed-loop ICP refinement is the system that reads
            closed-won and closed-lost deal outcomes from a CRM, extracts
            the operational signals on the underlying account (vertical
            stack, location count, owner activity, review tone), and
            updates the weights on the discovery query that produces the
            next account list. It runs automatically — typically within
            five minutes of a deal stage change in the CRM. It is a system,
            not a spreadsheet, because the spreadsheet version cannot
            keep up with the cadence at which deals close.
          </Para>
        ),
      },
      {
        eyebrow: "What it indexes",
        title: "Four signal classes the loop reads from every closed deal.",
        body: (
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat value="Stack" label="Vertical software signature on the account at close" />
              <Stat value="Scale" label="Location count, ARR proxy, employee count" />
              <Stat value="Activity" label="Owner-operator engagement in the 90 days before close" />
              <Stat value="Tone" label="Public review tone — operations-strained, reputation-risk" />
            </div>
            <Para>
              These four classes are the substrate Gong's Revenue Graph
              doesn't carry and Apollo's database doesn't index. They
              are the operational footprint of the account, not the
              conversation footprint of the seller.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "What it ignores",
        title: "Two signal classes the loop refuses to index.",
        body: (
          <div className="grid gap-6">
            <Para>
              The loop ignores reseller-style firmographic signals (NAICS
              code, parent-company SIC, generic 'industry' field) because
              they are too coarse for vertical SaaS GTM. A four-location
              restaurant on OpenTable Lite and a 400-location chain on
              full Toast share the same NAICS code. The loop refuses to
              treat them as the same shape of account.
            </Para>
            <Para>
              The loop also ignores SDR effort signals — calls made,
              emails sent, meetings booked. Those are downstream of the
              account choice, not the cause of the close. Indexing them
              would let SDR activity contaminate the ICP signal.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "What breaks without it",
        title: "The three failure modes teams hit when they skip the loop.",
        body: (
          <div className="grid gap-6">
            <Para>
              <span className="text-paper-0">Failure mode 1.</span> The
              quarterly ICP review meeting. Four people argue over a
              spreadsheet about which segment to target next, with no
              signal data. The decision survives the meeting, but the
              segment doesn't survive contact with the next 100 deals.
            </Para>
            <Para>
              <span className="text-paper-0">Failure mode 2.</span> The
              SDR-pattern walkout. The best SDR builds a mental model of
              what closes — 'multi-location operators on Housecall Pro,
              expansion in the last 90 days, owner posting on Google
              Business.' Then they quit. The model walks out with them.
            </Para>
            <Para>
              <span className="text-paper-0">Failure mode 3.</span> The
              tool-stack mismatch. Apollo's contact list, Clay's workflow,
              Smartlead's sequence, and Gong's transcripts all live in
              different systems. Each one is rebuilt every time the team
              changes a target — because no shared substrate carries the
              pattern across the four tools.
            </Para>
          </div>
        ),
      },
      {
        eyebrow: "How to ship it",
        title: "Three weeks, one CRM, no rip-and-replace.",
        body: (
          <Para>
            Pick one CRM (HubSpot or Salesforce). Pick one vertical pack
            (Field service, Restaurant tech, or Dental). Wire the deal-
            stage webhook into the discovery layer. Let the loop run on
            three months of historical closed deals to warm the weights.
            By week three, the next list query lands accounts shaped like
            your last five closed-won deals, automatically. The product
            you use to do this is, of course, the one we built — the
            mechanism, regardless of vendor, is the same.
          </Para>
        ),
      },
    ],
    citations: [
      {
        name: "Gong Revenue Graph launch — PRNewswire",
        url: "https://www.prnewswire.com/news-releases/gong-growth-accelerates-past-55-yoy-as-enterprises-adopt-revenue-ai-arr-tops-500m-302769127.html",
        date: "2026-05-12",
      },
      {
        name: "Toast SaaStr CRO Confidential",
        url: "https://www.saastr.com/10-things-that-are-different-in-vertical-smb-sales-with-toasts-cro/",
        date: "2026-01-30",
      },
    ],
  },
};
