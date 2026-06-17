import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "choosing-first-niche",
  title: "How to choose your first niche as a local outbound agency",
  description:
    "Choosing your first niche is the highest-leverage decision you'll make in year one. Here's the framework we use with new Revint customers — plus the six niches that work today and three to avoid.",
  lede: "Pick wrong and you're three months in with no traction. Pick right and month one pays for the year.",
  publishedAt: "2026-03-14T10:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["agency", "strategy", "niche selection"],
  readMinutes: 6,
  body: () => (
    <>
      <p>
        Short answer: pick a niche where the typical website is obviously
        outdated, the owner can afford £2-5k for a replacement, and there
        are at least 30 businesses in your target postcode. That narrows the
        universe to about a dozen verticals. Eliminate the three where
        national chains dominate local search. You're left with six strong
        options.
      </p>

      <h2>The three tests</h2>

      <h3>1. Visible quality gap</h3>
      <p>
        Walk through the first ten Google results for "[your niche] near me"
        in a city you know. If half of them look like 2015 WordPress templates
        with no booking system, you have a visible quality gap — the
        conversation you're selling writes itself. If every site looks
        passably modern, move on; the niche has been solved.
      </p>

      <h3>2. Willingness-to-pay</h3>
      <p>
        A £3k website is a rounding error to a dental clinic and a
        life-threatening expense to a dog walker. The niche has to generate
        enough revenue to absorb the cost. Rough rule: average transaction
        value × monthly volume should be £15k+ in revenue. Below that, the
        owner can't justify a website investment against other needs.
      </p>

      <h3>3. Density in your target postcode</h3>
      <p>
        Your discovery run needs to produce 30+ leads in a single postcode
        district. If Revint returns eight phone-repair shops in NW1, phone
        repair isn't dense enough in NW1 — pick a different niche or a
        different postcode. Density matters because it's what enables the
        "20 sends, measure, adjust" iteration loop.
      </p>

      <h2>Six niches that pass all three tests today</h2>

      <table>
        <thead>
          <tr>
            <th>Niche</th>
            <th>Quality gap</th>
            <th>WTP</th>
            <th>Typical density</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Phone repair</td>
            <td>Very high</td>
            <td>Medium</td>
            <td>8-15 per postcode</td>
          </tr>
          <tr>
            <td>Dental clinics</td>
            <td>Medium</td>
            <td>Very high</td>
            <td>6-12 per postcode</td>
          </tr>
          <tr>
            <td>Opticians (independent)</td>
            <td>Medium</td>
            <td>High</td>
            <td>4-8 per postcode</td>
          </tr>
          <tr>
            <td>HVAC / boiler repair</td>
            <td>High</td>
            <td>High</td>
            <td>15-30 per postcode</td>
          </tr>
          <tr>
            <td>Driving instructors</td>
            <td>Very high</td>
            <td>Medium</td>
            <td>30-60 per postcode</td>
          </tr>
          <tr>
            <td>Mobile mechanics</td>
            <td>Very high</td>
            <td>Medium</td>
            <td>10-20 per postcode</td>
          </tr>
        </tbody>
      </table>

      <h2>Three to avoid right now</h2>
      <ul>
        <li>
          <strong>Restaurants.</strong> National delivery platforms (Deliveroo,
          Uber Eats) have commoditised the booking-conversion layer. The
          website matters less than it did ten years ago, and every
          restaurant owner has already been pitched a website a dozen times.
        </li>
        <li>
          <strong>Hair salons.</strong> Booksy and Fresha dominate the
          infrastructure layer. If a salon is on Booksy, their booking
          problem is already solved.
        </li>
        <li>
          <strong>Gyms.</strong> Chain gyms dominate local search; independents
          are priced out of rebuilds and generally churning out of business
          before a 12-month agency engagement pays back.
        </li>
      </ul>

      <h2>How to actually run the test</h2>
      <p>
        Take your top three candidate niches, pick one postcode you know,
        and run discovery on all three. Within 20 minutes you'll have:
      </p>
      <ul>
        <li>Density count per niche.</li>
        <li>Average opportunity score per niche.</li>
        <li>
          A subjective feel for how comfortable you are writing an email to
          that type of owner.
        </li>
      </ul>
      <p>
        That last factor matters. The niche you pick has to be one where
        you'd feel confident on a discovery call. If you don't know how
        dental clinics think about patient acquisition, pick something else
        — or spend a week reading the niche's trade press before you start
        sending.
      </p>

      <h2>The meta-rule</h2>
      <p>
        You only need to be right about the niche for the next 90 days.
        Pick the best available today, send 500 emails, measure reply rate
        by niche, double down on whichever one lands. Overthinking the pick
        is the failure mode we see most often in new agencies.
      </p>
    </>
  ),
  faqs: [
    {
      question: "Should I pick a broad niche or a narrow one?",
      answer:
        "Narrow. 'Dental clinics in Camden' beats 'healthcare'. The narrower the niche, the more specific your openers can be, the higher your reply rate. You'll scale into adjacent niches later.",
    },
    {
      question: "What if my city is too small for density?",
      answer:
        "Either widen to a region (e.g., 'Greater Manchester' instead of a single postcode) or pick a denser niche. Driving instructors and mobile mechanics have the highest density in most UK cities.",
    },
  ],
};
