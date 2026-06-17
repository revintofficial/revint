import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "20-signal-audit-explained",
  title: "The 20-signal website audit, explained",
  description:
    "Every lead in Revint runs through a 20-signal Playwright audit. Here's every signal we check, why it maps to a pitch angle, and how the opportunity score is computed.",
  lede: "What we check, why, and how each signal translates to a sales pitch.",
  publishedAt: "2026-01-08T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["audit", "playwright", "product"],
  readMinutes: 9,
  body: () => (
    <>
      <p>
        Short answer: the 20 signals cover speed, security, mobile
        experience, booking infrastructure, and freshness. Each signal is
        either green (no pitch angle), amber (mentionable), or red (lead).
        The opportunity score is a weighted sum — speed and mobile
        experience get the heaviest weight because they map to provable
        revenue loss.
      </p>

      <h2>Why 20 and not 5 or 50?</h2>
      <p>
        We tested 5-signal audits first. They covered the basics but left
        dead air in the pitch; openers all sounded the same. At 50 signals
        the noise swamped the signal — every site got a long list of
        negatives and the email became a lecture. Twenty is the point where
        you have enough to pick three specific things to mention in email
        one, and enough variety that no two outreach emails sound alike.
      </p>

      <h2>The full signal list</h2>

      <h3>Speed and Core Web Vitals (5 signals)</h3>
      <ul>
        <li>
          <strong>Mobile LCP.</strong> Largest Contentful Paint on a throttled
          mobile network. Under 2.5s is green; 2.5-4s amber; over 4s red.
        </li>
        <li>
          <strong>Desktop LCP.</strong> Same measurement on desktop.
        </li>
        <li>
          <strong>CLS.</strong> Cumulative Layout Shift during initial load.
          Over 0.25 is red.
        </li>
        <li>
          <strong>INP.</strong> Interaction to Next Paint on the first button
          click.
        </li>
        <li>
          <strong>Total page weight.</strong> Over 3MB on mobile is red for
          local-service sites.
        </li>
      </ul>

      <h3>Security and hygiene (4 signals)</h3>
      <ul>
        <li>
          <strong>HTTPS present.</strong> Missing HTTPS is an immediate red
          and a conversation-starter.
        </li>
        <li>
          <strong>Security headers.</strong> X-Content-Type-Options,
          X-Frame-Options, Content-Security-Policy, Referrer-Policy,
          Strict-Transport-Security.
        </li>
        <li>
          <strong>Outdated framework signatures.</strong> WordPress 5.x from
          2019, jQuery 1.x, PHP 5 indicators.
        </li>
        <li>
          <strong>Mixed content.</strong> HTTPS page loading HTTP assets.
        </li>
      </ul>

      <h3>Mobile experience (3 signals)</h3>
      <ul>
        <li>Viewport meta tag correctness.</li>
        <li>Touch-target sizing.</li>
        <li>Mobile-friendly score (Google's public rubric).</li>
      </ul>

      <h3>Booking and conversion infrastructure (3 signals)</h3>
      <ul>
        <li>
          <strong>Booking system detected.</strong> Calendly, SimplyBook,
          Setmore, Booksy, Square, Fresha.
        </li>
        <li>
          <strong>Click-to-call present.</strong> tel: links in the header.
        </li>
        <li>
          <strong>Contact form present.</strong>
        </li>
      </ul>

      <h3>Discoverability (3 signals)</h3>
      <ul>
        <li>
          <strong>Schema.org markup.</strong> LocalBusiness, Service, OpeningHours.
        </li>
        <li>
          <strong>Google reviews embed or link.</strong>
        </li>
        <li>
          <strong>Sitemap.xml + robots.txt.</strong>
        </li>
      </ul>

      <h3>Freshness (2 signals)</h3>
      <ul>
        <li>
          <strong>Copyright year.</strong> 2019-2022 suggests the site has
          been neglected.
        </li>
        <li>
          <strong>Last-modified header.</strong> Older than 180 days is amber.
        </li>
      </ul>

      <h2>How the opportunity score is computed</h2>
      <p>
        The score ranges 0-100, higher = bigger opportunity (weaker site). It
        weights speed (30%), mobile experience (25%), booking infrastructure
        (20%), security/hygiene (15%), and discoverability + freshness (10%).
      </p>

      <p>
        A typical phone-repair shop in a mid-size UK city scores 65-75. That
        means there are enough weak signals to pitch, but the site is
        functional — people can still buy. We deliberately don't pitch sites
        that score below 40 (already good) or above 90 (probably going out
        of business or unstaffed).
      </p>

      <h2>What you do with the audit</h2>
      <p>
        Three things, in order:
      </p>
      <ol>
        <li>
          <strong>Pick the top three red signals.</strong> Those are your
          email-one talking points.
        </li>
        <li>
          <strong>Map them to a specific outcome.</strong> "Mobile LCP of 7.2s"
          becomes "roughly half your phone traffic drops before the page loads
          — I can probably fix that in an afternoon".
        </li>
        <li>
          <strong>Attach a website plan.</strong> The audit report is a PDF
          the prospect can open. It looks like the deliverable of a $500
          engagement; it costs the prospect $0 and positions you as the
          person who should build the replacement.
        </li>
      </ol>
    </>
  ),
};
