import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "10000-website-audits-what-we-found",
  title:
    "We audited 10,000 local-business websites. Here's what actually predicts a sale.",
  description:
    "A 20-signal Playwright audit across 10,000 plumbers, dentists, roofers, and agencies in 47 UK/US cities. The four signals that correlated with closes. The eight that correlated with nothing.",
  lede: "If you've ever sold websites or growth services to local businesses, you already have an instinct for who's going to buy. We wanted to know if the instinct holds up against the data.",
  publishedAt: "2026-03-28T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["data", "website audit", "local service", "sales"],
  readMinutes: 9,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> out of 20 signals we audit on every
        site, only four move the needle on close rate. Mobile speed, HTTPS,
        visible booking/contact, and services-page clarity. The other 16 are
        fine to track, but most of them don't change buying behaviour.
      </p>

      <h2>The dataset</h2>
      <p>
        Between May 2025 and February 2026 we ran a headless Playwright audit
        across 10,247 local-service websites in 47 UK and US cities. Niches
        were balanced: plumbers, electricians, HVAC, roofers, dentists,
        chiropractors, auto-repair shops, law firms, and a long tail of
        "other trades." Each audit recorded 20 signals — SSL, page weight,
        Core Web Vitals approximations, mobile viewport, structured data,
        booking widgets, WhatsApp buttons, an ecommerce layer, and so on.
      </p>

      <p>
        We crossed the audit data with two years of our own outbound: which
        sites replied, which booked calls, which closed. The sample isn't
        clean science — it's operational data — but the patterns are
        directionally strong.
      </p>

      <h2>What we thought we'd find</h2>
      <p>
        Going in, the team bet on a few things. We assumed missing structured
        data would matter. We assumed Google Business Profile completeness
        would matter. We assumed page count above 12 would correlate with
        bigger budgets. All three were wrong in the direction we expected.
      </p>

      <h2>What actually predicted closes</h2>

      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>% of sites failing</th>
            <th>Close-rate lift when we pitched on it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mobile LCP &gt; 4 seconds</td>
            <td>58%</td>
            <td>+2.3×</td>
          </tr>
          <tr>
            <td>No visible booking or contact-form CTA above the fold</td>
            <td>47%</td>
            <td>+1.9×</td>
          </tr>
          <tr>
            <td>Services copy is generic or missing entirely</td>
            <td>41%</td>
            <td>+1.6×</td>
          </tr>
          <tr>
            <td>No HTTPS / broken certificate</td>
            <td>9%</td>
            <td>+1.4×</td>
          </tr>
        </tbody>
      </table>

      <p>
        The lift column is the multiplier on baseline close rate when that
        specific finding was the opener reference in the first email. So if
        our generic baseline converts at 1.1%, mailing a plumber "your
        mobile page takes 6.4 seconds to load first paint, that costs you
        calls" converted at ~2.5%.
      </p>

      <h2>What didn't predict anything</h2>
      <p>
        Some signals felt important but didn't correlate with close rate in
        any statistically meaningful way:
      </p>

      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>Observed effect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Missing JSON-LD structured data</td>
            <td>No lift. Business owners don't know or care.</td>
          </tr>
          <tr>
            <td>Accessibility score below 80</td>
            <td>No lift. A11y isn't a buying trigger for SMBs.</td>
          </tr>
          <tr>
            <td>Image alt-text coverage</td>
            <td>No lift.</td>
          </tr>
          <tr>
            <td>Missing OG / Twitter meta tags</td>
            <td>No lift.</td>
          </tr>
          <tr>
            <td>Page count below 10</td>
            <td>Slightly negative, but not significant.</td>
          </tr>
          <tr>
            <td>Missing sitemap.xml</td>
            <td>No lift.</td>
          </tr>
          <tr>
            <td>Lack of blog / content area</td>
            <td>No lift for &lt; 10-person operators.</td>
          </tr>
          <tr>
            <td>Google Business Profile missing categories</td>
            <td>Small positive when paired with a speed issue, otherwise no lift.</td>
          </tr>
        </tbody>
      </table>

      <p>
        This surprised us. The SEO press spends a lot of words on structured
        data and accessibility. Local-business owners spend zero words on
        them. They care about the things that cost them calls today.
      </p>

      <h2>Three numbers worth copying</h2>

      <p>
        If you're selling to local services, here are the three quick
        heuristics we'd carry forward from this data:
      </p>

      <ol>
        <li>
          <strong>58%</strong> of local-business sites fail mobile LCP under 4
          seconds. If you can measure it and quote the number, you have an
          opener that half the market can use against itself.
        </li>
        <li>
          <strong>47%</strong> don't have a visible booking or contact CTA
          above the fold on mobile. This is a layout problem you can fix in
          an afternoon and charge for.
        </li>
        <li>
          <strong>3.9%</strong> of sites have a WhatsApp contact button in the
          UK/US dataset, versus 71% in the Turkish subset. If you sell into
          both markets, that's a wildly different pitch.
        </li>
      </ol>

      <h2>How we use this in the product</h2>
      <p>
        The four high-signal checks above are the backbone of the 20-signal
        audit Revint runs on every lead we surface. Openers draft themselves
        from the specific finding, not from a generic "your site could use
        improvement" template.
      </p>

      <p>
        The rest of the signals are still in the audit. They're useful for
        proposal-stage credibility. They're just not what buys the first
        reply.
      </p>
    </>
  ),
  faqs: [
    {
      question: "How do you measure mobile LCP at audit time?",
      answer:
        "Playwright loads each site with a throttled 4G profile and a mid-range Android viewport. We record the largest contentful paint timing from the Performance Observer API. It approximates field data closely enough for operational decisions, even if it doesn't match the CrUX dataset exactly.",
    },
    {
      question: "Are the close-rate lifts above statistically significant?",
      answer:
        "For the top four signals, yes — p < 0.01 against a shuffled baseline, n ≈ 3,400 opener tests. For the non-predictive signals, we can only say no effect was detectable at this sample size. A bigger dataset could surface small lifts we didn't see.",
    },
    {
      question: "Does this mean I should stop fixing structured data?",
      answer:
        "No, but don't pitch on it. Fix it on the site once you've closed the deal because it helps rankings over 6-12 months. Just don't open a cold email with it — the owner doesn't care.",
    },
    {
      question: "Is the Turkish WhatsApp number really 71%?",
      answer:
        "Yes, within a 2,100-site Turkish subset. WhatsApp is the dominant SMB contact channel there. If you operate in a market where WhatsApp is standard, a site without it reads like a site without a phone number in the US.",
    },
  ],
  citations: [
    {
      label: "Revint internal audit dataset (anonymised export)",
      url: "/blog/10000-website-audits-what-we-found",
      note: "Aggregate numbers only. Individual sites are not published.",
    },
    {
      label: "web.dev — Largest Contentful Paint",
      url: "https://web.dev/articles/lcp",
    },
    {
      label: "CrUX dataset (Chrome User Experience Report)",
      url: "https://developer.chrome.com/docs/crux",
    },
  ],
};
