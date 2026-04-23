import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "postcode-vs-keyword-discovery",
  title:
    "Postcode discovery vs keyword search: why one finds buyers and the other finds noise.",
  description:
    "If you're finding local-service leads by typing 'plumbers Manchester' into Google, you're working with Google's SEO winners, not the market. Postcode-first discovery flips it. Here's the difference in practice.",
  lede: "The businesses that rank on Google and the businesses that need your help are mostly not the same businesses.",
  publishedAt: "2025-12-06T09:00:00Z",
  author: AUTHORS["leadac-team"],
  tags: ["discovery", "postcode", "lead generation"],
  readMinutes: 6,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> keyword search shows you businesses
        that already won SEO. Postcode search shows you every business in
        an area. For outbound, the second list is usually 4-6× larger and
        tilted toward the ones who need your help.
      </p>

      <h2>Why keyword search filters out your best prospects</h2>
      <p>
        When you type "plumbers London" into Google, you get the top 10-20
        results for that query. Those businesses are ranking because they
        already invested in SEO — they have decent sites, reviews, and
        probably an agency on retainer. They're the ones least likely to
        need what you're selling.
      </p>

      <p>
        The plumber who actually needs a website rebuild is two pages deep
        in the results, or on Checkatrade with no direct site at all, or
        running a one-person operation out of their postcode that Google
        doesn't surface because they have 3 reviews and a Wix template.
      </p>

      <p>
        The irony is that the businesses least visible to Google are often
        the most visible inside their own postcode. They're established,
        they have regulars, they get word-of-mouth referrals — they just
        don't have an SEO team.
      </p>

      <h2>What postcode discovery looks like</h2>
      <p>
        Instead of "plumbers London," you pick a postcode (say SE15, in
        Peckham) and ask: what plumbers show up in Google Maps for this
        postcode? Google Maps returns everything it has, ranked by
        proximity and relevance, not by SEO authority. For a single London
        postcode you'll typically get 40-80 plumbers. For London as a
        whole, summed across its ~120 postcodes, you'll see 3,000+.
      </p>

      <p>
        Compare to the ~25 results you'd get from typing "plumbers London"
        into search. That's a 120× difference in list size, and the extra
        businesses are the ones who actually convert.
      </p>

      <h2>What the lists look like side by side</h2>

      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Keyword search</th>
            <th>Postcode Maps discovery</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Typical list size (London plumbers)</td>
            <td>~25</td>
            <td>~3,000</td>
          </tr>
          <tr>
            <td>Avg. review count</td>
            <td>180</td>
            <td>28</td>
          </tr>
          <tr>
            <td>% with a dedicated mobile-optimised site</td>
            <td>88%</td>
            <td>31%</td>
          </tr>
          <tr>
            <td>% with an agency already on retainer</td>
            <td>~70%</td>
            <td>~15%</td>
          </tr>
          <tr>
            <td>Close rate from cold outbound</td>
            <td>1-2%</td>
            <td>4-8%</td>
          </tr>
        </tbody>
      </table>

      <p>
        The keyword-search list is pre-qualified against you. The
        postcode-search list is pre-qualified for you.
      </p>

      <h2>Where this breaks</h2>
      <p>
        Two places.
      </p>

      <p>
        <strong>Very sparse niches.</strong> If your ICP is
        "orthotics-fitters in Cornwall," postcode discovery may find 4
        businesses total and none of them need what you sell. Keyword
        search wouldn't help either — it's just a small TAM problem.
      </p>

      <p>
        <strong>Very dense competitor markets.</strong> In London central
        postcodes for restaurants, you'll get 200+ businesses in a single
        postcode and the noise-to-signal on the list starts to matter.
        You'll need to pair postcode discovery with a filter (review
        count range, business age, site quality) to make the list
        workable.
      </p>

      <h2>How to build a postcode-based list manually</h2>
      <p>
        If you want to try this by hand before automating:
      </p>

      <ol>
        <li>
          Pick 5 postcodes in your target city. Mix central and outer
          postcodes so you get a range of market maturity.
        </li>
        <li>
          For each postcode, open Google Maps, type "plumber" (or your
          niche), and screenshot or export the first 40 results.
        </li>
        <li>
          For each result, note the name, website, review count, and
          whether the site loads quickly on your phone.
        </li>
        <li>
          De-duplicate across postcodes.
        </li>
      </ol>

      <p>
        A diligent hour gets you roughly 150-200 leads with real audit
        substrate. That's a week of sending volume for a solo operator.
        Most of the leads will have mobile speed issues or missing
        booking widgets — the exact openers we covered in the plumber
        playbook.
      </p>

      <h2>Why this matters for the data layer choice</h2>
      <p>
        The debate about Apollo vs fresh lists usually frames "fresh" as
        "just less stale." It's more than that. Apollo and most shared
        databases are keyword-indexed at source — they're built from
        web-crawled signals (hiring pages, press mentions, tech stacks)
        that correlate with online visibility. Postcode discovery is
        physical-index-first — it starts from "who is there" rather than
        "who has SEO." For local-service outbound, the physical index
        wins every time.
      </p>
    </>
  ),
  faqs: [
    {
      question: "Isn't postcode discovery just 'local SEO scraping'?",
      answer:
        "Partly. The mechanic is similar — you're using Google Maps as your data source. The difference is intent. Local SEO scrapers often pull review and ranking data to sell SEO services back to the top results. Postcode discovery for outbound is about finding businesses that are operationally present but not SEO-present — the long tail of the map.",
    },
    {
      question: "How many postcodes should I cover to saturate a city?",
      answer:
        "London has ~120 postcode districts. Covering 40-50 of them gets you ~80% of the plumbers in the city, because the biggest businesses show up in multiple postcode searches. For a tighter city like Manchester (~40 postcodes), 20-25 gets you most of the market.",
    },
    {
      question: "Does this work internationally?",
      answer:
        "Yes, with two caveats. Some countries (France, Germany, Japan) have less granular Google Maps coverage for small businesses. And postcode systems vary — Turkey's is 5-digit and not very geographic, so district-level discovery works better. For the UK and US, postcode/ZIP discovery is the cleanest unit.",
    },
    {
      question: "Is Leadac built on this principle?",
      answer:
        "Yes. Our discovery layer starts with postcode + niche and returns every operating business in that area, not the Google SEO winners. The 20-signal audit runs on each site so the openers write themselves.",
    },
  ],
  citations: [
    {
      label: "Google Maps Platform — Places API",
      url: "https://developers.google.com/maps/documentation/places/web-service/search",
    },
    {
      label: "Royal Mail — UK postcode structure",
      url: "https://www.royalmail.com/business/tools/address-management",
    },
  ],
};
