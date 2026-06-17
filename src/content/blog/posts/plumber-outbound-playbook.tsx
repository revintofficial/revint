import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "plumber-outbound-playbook",
  title:
    "The plumber outbound playbook: list, opener, offer, follow-up.",
  description:
    "A specific, tested outbound playbook for selling websites, SEO, or lead-gen services to UK and US plumbers. Where to source the list, what opener works, what offer closes, what follow-up re-engages.",
  lede: "We've run outbound into plumbers for 18 months. Some things work. Most things don't. Here's the short version.",
  publishedAt: "2026-01-17T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["playbook", "plumbers", "local service", "niche"],
  readMinutes: 9,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> plumbers convert on outbound when the
        opener is a mobile speed or booking finding, the offer is a fixed
        £1,500-£2,500 site with a clear before/after, and the follow-up is
        three touches across two weeks. Anything fancier is over-engineering.
      </p>

      <h2>Who this is for</h2>
      <p>
        Agencies and solo operators selling websites, SEO, Google Ads, or
        lead-generation into domestic and commercial plumbers in the UK or
        US. If you're selling a £49/mo SaaS tool into plumbers, this isn't
        quite your playbook — the economics push toward inbound and
        partnerships, not cold outbound.
      </p>

      <h2>List: where to source</h2>
      <p>
        In rough order of signal quality:
      </p>

      <ol>
        <li>
          <strong>Google Maps by postcode.</strong> The highest-intent list
          you can build. Every result is a business actively trying to be
          found for "plumber near me." Grab the website, review count,
          average rating, category, address. If you can pair it with a site
          audit, you've built a list with built-in opener fuel.
        </li>
        <li>
          <strong>Checkatrade / Trustpilot / Yelp directories.</strong>
          Second-best. Lists plumbers who've invested in being found but
          often don't have their own site, or have a WordPress template
          they barely touch. Good opener substrate: "you're on Checkatrade
          but your direct site sends traffic to a Wix template."
        </li>
        <li>
          <strong>Companies House / state business registries.</strong>
          Cheap, dense, but the data is stale and most sole traders aren't
          there. Worth it only as an enrichment cross-reference.
        </li>
        <li>
          <strong>Apollo / ZoomInfo.</strong> Don't. The coverage is thin,
          the data is stale, and — if you read our 90-day teardown — the
          reply rates are 0.2-0.5% even with a clean opener. Skip.
        </li>
      </ol>

      <h2>What the audit should find</h2>
      <p>
        The specific site issues that convert into bookings when named
        directly in the opener:
      </p>

      <table>
        <thead>
          <tr>
            <th>Finding</th>
            <th>% of plumber sites affected</th>
            <th>Opener fit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mobile LCP &gt; 4s</td>
            <td>62%</td>
            <td>Excellent. Specific and measurable.</td>
          </tr>
          <tr>
            <td>No online booking or quote form above fold</td>
            <td>54%</td>
            <td>Excellent. Direct revenue link.</td>
          </tr>
          <tr>
            <td>No WhatsApp / SMS click-to-contact (UK)</td>
            <td>77%</td>
            <td>
              Good. Most UK plumbers get leads via WhatsApp, not phone calls.
            </td>
          </tr>
          <tr>
            <td>No services page breakdown</td>
            <td>43%</td>
            <td>
              Good, especially if you can pair with "your competitors in
              [city] rank for boiler install because they have a page for it."
            </td>
          </tr>
          <tr>
            <td>HTTP (not HTTPS)</td>
            <td>11%</td>
            <td>
              Okay. Works but "your site is marked insecure in Chrome" is
              the version that lands.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The opener that works</h2>
      <p>
        We've tested roughly 40 opener variants. This shape wins by a margin:
      </p>

      <blockquote>
        Hi [first name], quick note on [business name]'s site.<br />
        <br />
        Your mobile page takes 6.2s to show anything (most plumber sites in
        [city] sit at 2-3s). The "Book a plumber" section isn't visible on
        mobile until you scroll past two images.<br />
        <br />
        We rebuild plumber sites flat-rate, £1,800, usually live in 10 days.
        Want me to send three before/afters from other [city] plumbers?<br />
        <br />
        — [your name]
      </blockquote>

      <p>
        Why it works, in order of importance:
      </p>

      <ul>
        <li>
          A specific measurable finding, not generic "your site could be
          better."
        </li>
        <li>
          A comparison to their local market, not a global average.
        </li>
        <li>
          A concrete price. Plumbers quote fixed prices on everything they
          do. They don't trust proposals.
        </li>
        <li>
          A short timeline. "Live in 10 days" matters more than "we'll
          workshop the discovery phase."
        </li>
        <li>
          A reference offer (three before/afters), not a discovery call.
          Plumbers don't want a 30-minute call with a stranger.
        </li>
      </ul>

      <h2>The offer that closes</h2>
      <p>
        Two things convert far better than the rest:
      </p>

      <ol>
        <li>
          <strong>Fixed-price rebuild.</strong> £1,500-£2,500 gets you in
          the door. Include hosting for 12 months. Charge separately for
          Google Ads or SEO retainers after.
        </li>
        <li>
          <strong>Performance guarantee framing.</strong> "If your mobile
          page isn't under 2.5s by week 2, we refund £500." You won't have
          to pay it out, and it reframes the purchase from cost to result.
        </li>
      </ol>

      <h2>Follow-up cadence</h2>
      <p>
        Three touches over two weeks. Any more is diminishing returns on
        this segment — plumbers either reply in week 1 or they didn't care:
      </p>

      <ul>
        <li>
          Day 0: the opener above.
        </li>
        <li>
          Day 4: a 90-second Loom recording of their actual site loading
          on a mobile. Nothing else. "Thought this was easier to show than
          describe." Loom views become a qualification signal — anyone who
          watches it is worth a second email.
        </li>
        <li>
          Day 11: a one-sentence close — "Still happy to send those three
          before/afters — want me to?" — or a break-up email. "Last note,
          happy to drop it if it's not the right time." Break-ups pull
          ~18% of the replies we get.
        </li>
      </ul>

      <h2>What doesn't work</h2>
      <ul>
        <li>
          Long emails. Plumbers read on their phone between jobs. If it
          scrolls past one screen, it's dead.
        </li>
        <li>
          "Case study" attachments or PDFs. Deleted on sight.
        </li>
        <li>
          Generic SEO pitches. "Rank #1 for plumber near me" reads as scam
          because it's been used by scams. Lead with the site, not the
          ranking.
        </li>
        <li>
          Automated voicemail drops. Illegal or borderline in most markets
          and the brand damage outlasts the tactic.
        </li>
      </ul>

      <h2>Realistic numbers to expect</h2>
      <p>
        On a 500-contact campaign into a fresh Google Maps list with a
        proper audit-grounded opener, expect roughly:
      </p>

      <ul>
        <li>3-5% positive reply rate</li>
        <li>1.5-2.5% calls booked</li>
        <li>25-40% close rate on the calls</li>
        <li>3-8 closed deals at £1,500-£2,500 each</li>
      </ul>

      <p>
        That's £4,500-£20,000 of revenue from a 500-contact campaign that
        takes about a week to run once the stack is in place. Not everyone
        hits the top of that range. Most settle in the middle, which is
        still good business.
      </p>
    </>
  ),
  faqs: [
    {
      question: "Is plumber outbound better in the UK or US?",
      answer:
        "Similar close rates, but UK is easier to start in. Tighter geography, WhatsApp as a standard contact channel, fewer franchise-network gatekeepers. US plumbers often belong to regional franchise networks where decisions aren't at the shop level. Start UK if you have a choice.",
    },
    {
      question: "How do I build a Google Maps list by postcode?",
      answer:
        "Either manually (slow but free), via a scraping tool like Outscraper or Apify, or through Revint — we do discovery by postcode and audit the sites as one flow. Any of the three works. The important thing is the list is fresh, not three months old.",
    },
    {
      question: "What price points close best?",
      answer:
        "£1,500-£2,500 is the sweet spot for a rebuild. Below £1,000 and plumbers get suspicious the work will be cheap; above £3,000 and they stall. If you're selling ongoing SEO or ads retainers, £600-£900/mo is what sticks. Higher than that and you need a referral, not cold email.",
    },
    {
      question: "Does this playbook work for electricians, HVAC, roofers?",
      answer:
        "Most of it yes, with small tweaks. Electricians respond to emergency-keyword opener framings (weekend availability, landlord certificates). HVAC has seasonality — April-June and October is prime. Roofers are harder because the industry is flooded with lead-gen scams and trust is lower. Same stack, tuned per niche.",
    },
  ],
  citations: [
    {
      label: "Checkatrade — UK trade directory",
      url: "https://www.checkatrade.com/",
    },
    {
      label: "Google Business Profile — categories reference",
      url: "https://support.google.com/business/answer/3038177",
    },
  ],
};
