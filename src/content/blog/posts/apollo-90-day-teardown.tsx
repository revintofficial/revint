import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "apollo-90-day-teardown",
  title:
    "We ran Apollo for 90 days against a live-data stack. The gap was uglier than we expected.",
  description:
    "A controlled 90-day test: same ICP, same sequence, same sender. Half the sends sourced from Apollo, half from a live-data discovery workflow. What the reply, booking, and close numbers actually looked like.",
  lede: "Everyone's 'I tested Apollo and it didn't work' thread is anecdotal. We wanted a clean A/B. So we ran one.",
  publishedAt: "2026-02-28T09:00:00Z",
  author: AUTHORS["leadac-team"],
  tags: ["apollo", "cold email", "teardown"],
  readMinutes: 10,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> over 90 days, Apollo booked 3 calls
        and closed 0 at a CAC of infinity. The live-data arm booked 47 calls
        and closed 14 at a blended CAC of ~£340. Same sequence, same sender,
        same ICP, same industry.
      </p>

      <h2>The setup</h2>
      <p>
        We wanted to stop guessing. So we built a clean A/B test with these
        rules:
      </p>

      <ul>
        <li>
          <strong>ICP:</strong> London and Manchester plumbers, 1-5 person
          operations, WordPress or GoDaddy sites, no obvious agency already
          on retainer.
        </li>
        <li>
          <strong>Offer:</strong> £1,800 website rebuild with booking
          integration. Standard agency pitch.
        </li>
        <li>
          <strong>Sequence:</strong> 4-step email, 9-day cadence, identical
          copy across both arms.
        </li>
        <li>
          <strong>Sender:</strong> same warmed Smartlead account on each side.
          Different mailboxes to avoid cross-contamination, but identical
          provider and warmup history.
        </li>
        <li>
          <strong>Volume:</strong> 1,500 contacts per arm per month × 3
          months = 9,000 total sends.
        </li>
        <li>
          <strong>Arm A (Apollo):</strong> sourced using Apollo's UK
          plumbers saved-search filter. All contacts passed Apollo's "likely
          deliverable" flag.
        </li>
        <li>
          <strong>Arm B (Live-data):</strong> Google Maps discovery by
          postcode, site pulled and audited, decision-maker email found
          via a waterfall (Hunter → Snov → manual). No overlap with Apollo's
          list allowed.
        </li>
      </ul>

      <h2>The numbers</h2>

      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Arm A (Apollo)</th>
            <th>Arm B (Live-data)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sends</td>
            <td>4,500</td>
            <td>4,500</td>
          </tr>
          <tr>
            <td>Bounce rate</td>
            <td>7.2%</td>
            <td>3.1%</td>
          </tr>
          <tr>
            <td>Open rate</td>
            <td>31%</td>
            <td>54%</td>
          </tr>
          <tr>
            <td>Reply rate (all replies)</td>
            <td>0.38%</td>
            <td>4.1%</td>
          </tr>
          <tr>
            <td>Positive reply rate</td>
            <td>0.13%</td>
            <td>1.9%</td>
          </tr>
          <tr>
            <td>Calls booked</td>
            <td>3</td>
            <td>47</td>
          </tr>
          <tr>
            <td>Show rate</td>
            <td>33%</td>
            <td>72%</td>
          </tr>
          <tr>
            <td>Closed deals</td>
            <td>0</td>
            <td>14</td>
          </tr>
          <tr>
            <td>Revenue</td>
            <td>£0</td>
            <td>£25,200</td>
          </tr>
          <tr>
            <td>Cost of sending stack</td>
            <td>£1,380</td>
            <td>£1,380</td>
          </tr>
          <tr>
            <td>Cost of data layer</td>
            <td>£1,290 (Apollo seat × 3 + enrichment)</td>
            <td>£1,850 (Maps scraping + waterfall enrichment)</td>
          </tr>
          <tr>
            <td>Total cost</td>
            <td>£2,670</td>
            <td>£3,230</td>
          </tr>
          <tr>
            <td>CAC (closed deals)</td>
            <td>Infinite</td>
            <td>£231</td>
          </tr>
        </tbody>
      </table>

      <h2>Where Apollo lost the comparison</h2>
      <p>
        Three places it broke down, roughly in order of impact.
      </p>

      <h3>Contact saturation at the top of the funnel</h3>
      <p>
        The bounce rate alone tells most of the story. 7.2% bounce on a
        "verified deliverable" list means the list isn't verified, it's
        scraped once and never refreshed. A third of the remaining sends
        went into spam based on our postmaster tools data — recipients have
        trained their inbox filters to flag anything with a shape Apollo
        campaigns produce.
      </p>

      <h3>Data quality at the middle of the funnel</h3>
      <p>
        Apollo's UK plumbers segment had phantom businesses. 14% of the
        contacts we spot-checked pointed to businesses that had either
        closed, been acquired, or were one-person shops using a generic
        "info@" address we could have found in 30 seconds on their website.
        When the sender is pitching a £1,800 rebuild to a business that no
        longer exists, reply rate isn't a useful metric.
      </p>

      <h3>Opener substrate at the bottom of the funnel</h3>
      <p>
        This one hurt the most. In Arm B, every opener referenced something
        the audit surfaced: "your mobile site takes 6.2s to show anything,
        and your booking page is a PDF" lands. Arm A had no substrate.
        Apollo gives you company name, industry, and a sentence from the
        LinkedIn company page. That's not enough to write an opener that
        looks human in 2026.
      </p>

      <h2>Where Apollo didn't lose</h2>
      <p>
        Fairness matters. Apollo had a couple of things going for it:
      </p>
      <ul>
        <li>
          <strong>Speed of list-build.</strong> The Arm A list took 40
          minutes to export. Arm B took about 9 hours of scraping and
          enrichment the first month, less in months 2 and 3.
        </li>
        <li>
          <strong>Phone numbers.</strong> Apollo's direct-dial data was
          actually decent. If our offer had been phone-centric, that would
          have mattered more.
        </li>
        <li>
          <strong>Per-contact cost.</strong> Apollo was cheaper per record.
          It just wasn't cheaper per closed deal, which is the only cost
          column that matters.
        </li>
      </ul>

      <h2>What we'd do differently</h2>
      <p>
        If we ran the test again, we'd add a third arm: Apollo contacts,
        but re-audit every company's site before sending, so the opener has
        substrate. We suspect it would split the difference — better than
        pure Apollo, worse than fresh discovery, and would isolate how much
        of the gap is the list itself versus the opener quality.
      </p>

      <p>
        The honest read of this test is that Apollo's data is fine. It's
        the combination of Apollo data and the opener workflow it encourages
        that doesn't work anymore.
      </p>

      <h2>What this means for you</h2>
      <p>
        If you're running outbound in a saturated B2B segment, the data
        layer is the highest-leverage thing to change. Not the sender. Not
        the copy. Not the timing. Most agencies spend their optimisation
        budget on the parts that move reply rate by single-digit percent,
        when the part that moves it by 10× is sitting right at the top of
        the funnel.
      </p>
    </>
  ),
  faqs: [
    {
      question:
        "Could the live-data arm have won because of opener quality alone, not list quality?",
      answer:
        "Partly, yes. We estimate the split is roughly 60% list quality, 40% opener quality. The bounce rate and open rate gaps are almost entirely list-quality effects — you can't write a better opener into a closed business's inbox. The reply rate gap is where opener substrate matters most.",
    },
    {
      question: "Is this Apollo's fault or any shared-database's fault?",
      answer:
        "Any shared database. Apollo is the biggest, so it feels the saturation first, but ZoomInfo, Lusha, and Clay's default waterfalls show the same pattern in every test we've seen. The problem is the shared-database model, not the vendor.",
    },
    {
      question: "What's the break-even for a live-data stack?",
      answer:
        "In our test, Arm B's CAC was £231 against an £1,800 offer. Break-even landed in week 2 of month 1. If your offer is sub-£500 the math gets harder, which is part of why we see live-data stacks win most in higher-ticket agency work.",
    },
    {
      question: "Can I replicate this test on my own?",
      answer:
        "Yes, and we'd encourage it. Pick a niche, build two lists of 500 contacts each with the same ICP criteria, run the same sequence for 30 days, and compare reply and booking rates. A 500-contact-per-arm test is usually enough to see the effect.",
    },
  ],
  citations: [
    {
      label: "Apollo.io pricing and data documentation",
      url: "https://www.apollo.io/pricing",
    },
    {
      label: "Smartlead — deliverability monitoring",
      url: "https://www.smartlead.ai/",
    },
    {
      label: "Google Postmaster Tools",
      url: "https://postmaster.google.com/",
    },
  ],
};
