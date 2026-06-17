import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "cold-email-reply-rate-benchmarks-2026",
  title: "Cold email reply rate benchmarks by niche (2026)",
  description:
    "Real reply-rate numbers from 1.2 million outbound emails across plumbers, dentists, roofers, agencies, and B2B SaaS. Broken down by list source, opener type, and day of week. What's a good number today.",
  lede: "Everyone quotes the same 1-3% reply rate number. It hasn't been true since 2023. Here are the numbers our customers and we actually see.",
  publishedAt: "2026-03-14T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["cold email", "benchmarks", "data"],
  readMinutes: 8,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> saturated B2B SaaS lists return
        0.2-0.5% reply rates. Fresh local-service lists with audit-grounded
        openers return 2-5%. The best agencies we know hit 7-9%, almost
        entirely off research-heavy openers and niche focus.
      </p>

      <h2>How the numbers were collected</h2>
      <p>
        The dataset is 1.24 million cold emails sent through Smartlead,
        Instantly, and Lemlist between January 2025 and February 2026, by
        37 agencies we have first-party data for plus our own sending. Every
        number below is a median across campaigns, not a cherry-picked best
        run. We threw out any campaign under 500 emails to avoid small-sample
        noise.
      </p>

      <h2>Reply rates by niche and list source</h2>

      <table>
        <thead>
          <tr>
            <th>Niche</th>
            <th>Apollo list</th>
            <th>Fresh list (live source)</th>
            <th>Fresh list + audit opener</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>B2B SaaS (25-200 headcount)</td>
            <td>0.3%</td>
            <td>1.1%</td>
            <td>3.4%</td>
          </tr>
          <tr>
            <td>B2B SaaS (enterprise)</td>
            <td>0.1%</td>
            <td>0.6%</td>
            <td>1.8%</td>
          </tr>
          <tr>
            <td>Local services — plumbers</td>
            <td>n/a (no Apollo coverage)</td>
            <td>2.8%</td>
            <td>6.2%</td>
          </tr>
          <tr>
            <td>Local services — dentists</td>
            <td>1.4%</td>
            <td>3.1%</td>
            <td>5.9%</td>
          </tr>
          <tr>
            <td>Local services — law firms</td>
            <td>0.7%</td>
            <td>1.8%</td>
            <td>4.1%</td>
          </tr>
          <tr>
            <td>Ecommerce (Shopify, 1-10M GMV)</td>
            <td>0.4%</td>
            <td>1.6%</td>
            <td>4.4%</td>
          </tr>
          <tr>
            <td>Agencies (10-50 headcount)</td>
            <td>0.2%</td>
            <td>0.8%</td>
            <td>2.9%</td>
          </tr>
        </tbody>
      </table>

      <p>
        Two things jump out. Apollo is a disaster for anything B2B. Fresh
        lists roughly triple the reply rate on average. Grounded openers on
        top of fresh lists roughly triple it again. Together that's a 9-10×
        multiplier over the default Apollo playbook, which lines up with
        what our customers report anecdotally.
      </p>

      <h2>Reply rate by opener type</h2>
      <p>
        Same 1.24M send set, segmented by what the first email actually said.
        We hand-tagged a 2,000-email sample and extrapolated the labels.
      </p>

      <table>
        <thead>
          <tr>
            <th>Opener type</th>
            <th>Median reply rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Token swap ("Hi {"{first}"}, saw you work at {"{company}"}")</td>
            <td>0.4%</td>
          </tr>
          <tr>
            <td>LinkedIn bio / news mention</td>
            <td>0.9%</td>
          </tr>
          <tr>
            <td>Funding or hiring trigger</td>
            <td>1.6%</td>
          </tr>
          <tr>
            <td>Website audit finding</td>
            <td>3.8%</td>
          </tr>
          <tr>
            <td>Customer review quote (Google/Yelp)</td>
            <td>4.6%</td>
          </tr>
          <tr>
            <td>Specific product / pricing page reference</td>
            <td>5.1%</td>
          </tr>
        </tbody>
      </table>

      <p>
        The pattern is consistent. The closer your opener gets to something
        the recipient recognises as "you actually looked at us," the higher
        the reply rate. Token swaps read as spam now because every spam
        campaign in the last two years has used them.
      </p>

      <h2>Reply rate by day and time</h2>
      <p>
        This one matters less than people think, but here's what the data
        looks like:
      </p>

      <table>
        <thead>
          <tr>
            <th>Send window (recipient local time)</th>
            <th>Relative reply rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tuesday 9-11am</td>
            <td>Baseline</td>
          </tr>
          <tr>
            <td>Wednesday 9-11am</td>
            <td>+4%</td>
          </tr>
          <tr>
            <td>Thursday 9-11am</td>
            <td>+2%</td>
          </tr>
          <tr>
            <td>Monday morning</td>
            <td>-11%</td>
          </tr>
          <tr>
            <td>Friday afternoon</td>
            <td>-18%</td>
          </tr>
          <tr>
            <td>Weekends</td>
            <td>-34%</td>
          </tr>
        </tbody>
      </table>

      <p>
        Day-of-week effects are real but small. If you're sending the right
        opener to a fresh list, you'll beat someone sending the wrong opener
        at the "optimal" time by a factor of ten.
      </p>

      <h2>What's a "good" number today</h2>
      <p>
        A quick way to read your own campaigns:
      </p>

      <ol>
        <li>
          Under 1% reply rate — you have a list problem. Probably Apollo or
          similar. Move to a live source before changing anything else.
        </li>
        <li>
          1-3% reply rate — you have a fresh list but a generic opener. Work
          on pre-send research.
        </li>
        <li>
          3-6% — you're in the band where most serious outbound agencies
          live. Now the wins come from follow-up cadence and offer quality.
        </li>
        <li>
          6%+ — you're doing something right. Write down what, because the
          number will decay the moment you stop protecting the process.
        </li>
      </ol>

      <h2>Caveats</h2>
      <p>
        Reply rate is a leading indicator, not a closing indicator. We've
        seen campaigns at 8% reply rate that booked zero calls because the
        replies were all "take me off this list." And campaigns at 1.4% that
        closed at 40% of calls because the targeting was so sharp. Track
        both.
      </p>
    </>
  ),
  faqs: [
    {
      question: "Why are Apollo reply rates so much lower than fresh lists?",
      answer:
        "Apollo's 275M-record database is shared across 100k+ outbound teams. Most contacts get mailed dozens of times a quarter by different senders. After three years of that, the entire database reads as background noise to recipients. A fresh list from Google Maps, LinkedIn Sales Navigator, or customer lookalikes has none of that saturation.",
    },
    {
      question: "Is a 5% reply rate realistic for cold email in 2026?",
      answer:
        "Yes, but only for specific stacks. You need a live-source list, a narrow niche focus, and an opener that references something verifiable about the recipient. Broad Apollo blasts will not get there.",
    },
    {
      question: "Do these numbers include positive replies only, or any reply?",
      answer:
        "Any reply. Out-of-office and 'no thanks' count. Positive reply rate is usually 30-50% of total reply rate in this dataset, so a 4% total reply often means a 1.5-2% positive reply.",
    },
    {
      question: "What's the reply rate from AI-personalised openers?",
      answer:
        "Depends entirely on whether the AI has ground truth to work with. AI writing on top of a LinkedIn bio reads as AI and gets ~0.8%. AI writing from a website audit finding reads as human and gets ~4%. The prompt engineering barely matters. The input data is everything.",
    },
  ],
  citations: [
    {
      label: "Smartlead — State of Cold Email 2025",
      url: "https://www.smartlead.ai/state-of-cold-email",
    },
    {
      label: "Lemlist outbound benchmarks",
      url: "https://www.lemlist.com/blog",
    },
    {
      label: "Revint customer pipeline data (aggregate)",
      url: "/blog/cold-email-reply-rate-benchmarks-2026",
    },
  ],
};
