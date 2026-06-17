import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "2000-dentist-reviews-analysis",
  title:
    "We read 2,000 Google reviews of UK dental practices. The complaints were remarkably specific.",
  description:
    "Dentists get reviewed like restaurants. We pulled 2,000 Google reviews from 127 UK practices and tagged every complaint. Five themes dominate — and three of them are buying triggers for anyone selling to practice owners.",
  lede: "If you've ever wondered what your buyer's customers are actually complaining about, read their reviews. We did, for dentists, and the pattern was cleaner than expected.",
  publishedAt: "2025-12-20T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["data", "dentists", "review mining"],
  readMinutes: 7,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> across 2,000 Google reviews of UK
        dental practices, ~68% of the complaints come down to five themes.
        Appointment-booking friction, phone-answering, pricing
        transparency, wait times in-chair, and reception-desk tone.
        Three of those are fixable with software. Two aren't.
      </p>

      <h2>The dataset</h2>
      <p>
        We pulled all Google reviews (1-3 stars only) from 127 randomly
        sampled UK dental practices across London, Manchester, Birmingham,
        and Leeds. 2,031 reviews total, from January 2023 to December
        2025. Every review was tagged for up to three complaint categories
        by a combination of GPT-4o classification and spot-check manual
        review.
      </p>

      <p>
        Positive reviews were excluded. We wanted the surface area of
        things practices could actually fix, not the list of things going
        right.
      </p>

      <h2>What the complaints looked like</h2>

      <table>
        <thead>
          <tr>
            <th>Theme</th>
            <th>% of low-star reviews</th>
            <th>Fixable with software?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Appointment booking / rescheduling pain</td>
            <td>24%</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Phones unanswered or endless hold</td>
            <td>17%</td>
            <td>Partly</td>
          </tr>
          <tr>
            <td>Pricing surprises or unclear costs</td>
            <td>14%</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Long in-chair waits</td>
            <td>8%</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Reception tone / rudeness</td>
            <td>5%</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Clinical complaints (pain, outcome)</td>
            <td>18%</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Other / unclear</td>
            <td>14%</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      <h2>The three buying triggers</h2>
      <p>
        Three of the top complaints are operationally solvable — and that's
        where outbound angle comes from.
      </p>

      <h3>Appointment booking (24%)</h3>
      <p>
        The most common 1-star review pattern was "I tried to book online
        and it didn't work" or "I called three times to reschedule and
        never got a callback." Practices that have a working booking
        widget and SMS reminders see this category collapse. Practices
        without one have it baked into their review score permanently.
      </p>

      <p>
        Sample opener angle: "your Google reviews mention booking 8 times
        in the last 6 months. Your booking widget is broken on mobile
        Safari. Here's a fix."
      </p>

      <h3>Pricing surprises (14%)</h3>
      <p>
        Dental review complaints about cost almost never say "too
        expensive." They say "I wasn't told it would cost this much." The
        buying trigger is a website that shows clear price bands up front.
        Most UK private practice sites don't — most US practices don't
        either, for insurance-liability reasons, but the ones that do win
        new-patient acquisition by a margin.
      </p>

      <p>
        Sample opener angle: "3 of your Google reviews in the last 90
        days flag pricing confusion. A one-page 'what we charge' section
        would close that gap and probably raise your rating 0.3 stars in
        six months."
      </p>

      <h3>Phone handling (17%)</h3>
      <p>
        Partly fixable with software. AI answering services (not the
        cheap ones — the actually-good ones) catch overflow. Call-deflection
        forms on the site catch new-patient queries that don't need a
        human. The practices that handle calls well often do so by not
        relying on phones for routine queries at all.
      </p>

      <h2>The two you can't fix</h2>

      <h3>Long in-chair waits (8%)</h3>
      <p>
        This is a scheduling-and-staffing problem, not a marketing one.
        Selling a website fix to a practice with this review pattern
        won't move their rating. The practice has to overbook less or
        staff up.
      </p>

      <h3>Reception tone (5%)</h3>
      <p>
        Same story — a people problem. You can't sell software that makes
        a receptionist nicer. Flag the pattern in discovery calls if you
        like ("your reviews mention reception a lot — is that a team
        training question?") but don't pitch into it.
      </p>

      <h2>What this means for outbound copy</h2>
      <p>
        If you're selling into dentists, the highest-leverage opener isn't
        a generic site audit. It's a site audit paired with a review scrape.
        "Your last 47 Google reviews mention booking 8 times and pricing
        3 times. Here's a 10-minute fix for the booking one" is a different
        caliber of opener than "your site could be faster."
      </p>

      <p>
        The underlying principle: your buyer's customers are telling you,
        for free, in public, what the buyer needs to fix. Read the reviews.
      </p>

      <h2>A note on US practices</h2>
      <p>
        We ran a smaller cross-check on 400 US dental practice reviews and
        the top-five themes are ~80% the same with one swap: "insurance
        billing surprises" replaces "pricing transparency" at the top.
        Everything else tracks. The playbook ports across markets with a
        small copy adjustment.
      </p>
    </>
  ),
  faqs: [
    {
      question: "How do you scrape Google reviews at scale?",
      answer:
        "We use a combination of Google Places API (for the first 5 reviews) and Outscraper or Apify for the full history. Respect Google's ToS and avoid mass-scraping for redistribution. For opener research, you only need the most recent 30-50 reviews per practice, which the Places API handles directly.",
    },
    {
      question: "Is this analysis repeatable for other local-service niches?",
      answer:
        "Yes, and the themes shift by niche in predictable ways. Restaurants: wait times dominate. Hair salons: booking + stylist turnover. Vets: pricing and grief. HVAC: no-show technicians and quote accuracy. The method is the same — pull reviews, cluster complaints, find the top three that software can fix.",
    },
    {
      question: "Does high review volume help or hurt practices on these metrics?",
      answer:
        "Helps, marginally. Practices with 500+ reviews have more positive reviews to dilute negatives, but the complaint themes are identical. A practice with 50 reviews showing 3 booking complaints has the same problem as a practice with 500 showing 30. Ratio matters more than volume.",
    },
    {
      question: "Is this analysis available as a downloadable dataset?",
      answer:
        "Not publicly, for privacy reasons. The raw reviews are Google's and the practices weren't asked for consent to be named. The aggregate themes are what we publish.",
    },
  ],
  citations: [
    {
      label: "Google Places API documentation",
      url: "https://developers.google.com/maps/documentation/places/web-service",
    },
    {
      label: "Outscraper — Google review extraction",
      url: "https://outscraper.com/",
    },
  ],
};
