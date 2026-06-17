import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "postcode-niche-playbook",
  title: "The postcode-plus-niche playbook for local outbound",
  description:
    "Forget personas. Local outbound wins on a postcode plus a niche. Here's the exact workflow — discovery, audit, and opener — that beats 'Apollo + Instantly' by 4-10× on reply rate.",
  lede: "One postcode. One niche. Forty-seven leads. Zero wasted sequencer slots.",
  publishedAt: "2025-12-03T10:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["local lead gen", "playbook", "outbound"],
  readMinutes: 8,
  body: () => (
    <>
      <p>
        Short answer: if you sell websites, growth services, or anything
        that attaches to a local-service business's existence, stop
        prospecting by persona. Prospect by geography × vertical. A postcode
        and a niche is a list nobody else is mailing.
      </p>

      <h2>Why personas fail for local</h2>
      <p>
        B2B SaaS outbound is persona-driven because the buyers self-identify
        on LinkedIn. "VP Marketing at a Series B, 50-200 employees" is a
        precise target you can filter for in Apollo.
      </p>

      <p>
        Local-service buyers don't. The owner of a phone-repair shop in
        Camden rarely has "Owner" on LinkedIn, never updates their title,
        and isn't findable by the same filters. Personas don't resolve to
        local leads.
      </p>

      <p>
        But <em>geography</em> and <em>vertical</em> do. Every phone-repair
        shop in Camden has a Google Maps listing, a phone number, and a
        website (or lack of one) that tells you more about their buying
        intent than a LinkedIn title ever could.
      </p>

      <h2>The full workflow</h2>
      <p>
        Here's the exact sequence we teach new agencies joining Revint:
      </p>

      <ol>
        <li>
          <strong>Pick a postcode.</strong> One — not a region. London has
          35 postcode districts; Manchester has 20. Pick one you know
          reasonably well. Familiarity matters for the opener later.
        </li>
        <li>
          <strong>Pick a niche.</strong> Ideally one where the typical
          website is obviously under-served: phone repair, HVAC, locksmiths,
          dental clinics, opticians, driving instructors, mobile mechanics,
          pet groomers. Avoid niches where the national chains dominate
          local search — restaurants and hair salons are saturated.
        </li>
        <li>
          <strong>Run discovery.</strong> Feed the postcode + niche to
          Revint (or any Google Places API wrapper). You'll get 30-60
          businesses depending on density.
        </li>
        <li>
          <strong>Audit every site.</strong> 20 signals — mobile load time,
          HTTPS, Core Web Vitals, booking-system presence, Schema coverage,
          security headers, image optimization, copyright date last updated.
          Each signal is a pitchable talking point.
        </li>
        <li>
          <strong>Score and tier.</strong> A 0-100 opportunity score ranks
          the list. Bottom third = high-value targets (weakest sites, most
          room to improve).
        </li>
        <li>
          <strong>Write grounded openers.</strong> Email one references a
          specific finding from the audit. Not "Hope you're well" — "Your
          mobile page takes 7.2s to load; I bet a lot of phone callers drop
          off before it finishes".
        </li>
        <li>
          <strong>Send via your normal sender.</strong> Smartlead, Instantly,
          Lemlist, or manual Gmail for the first 20. Volume comes later.
        </li>
      </ol>

      <h2>What "good" looks like</h2>
      <p>
        Benchmarks we see from agencies doing this consistently:
      </p>

      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Apollo baseline</th>
            <th>Postcode-niche</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Reply rate (email 1)</td>
            <td>0.2-0.5%</td>
            <td>3-7%</td>
          </tr>
          <tr>
            <td>Meeting-booked rate</td>
            <td>0.05-0.1%</td>
            <td>0.8-1.5%</td>
          </tr>
          <tr>
            <td>Time to first paying client</td>
            <td>4-8 weeks</td>
            <td>1-2 weeks</td>
          </tr>
          <tr>
            <td>Lead cost</td>
            <td>$1-3 per contact</td>
            <td>Effectively free (included in tool)</td>
          </tr>
        </tbody>
      </table>

      <h2>Common mistakes</h2>
      <ul>
        <li>
          <strong>Skipping the audit.</strong> Sending a generic "I can build
          you a website" email to 50 local businesses with varied sites
          reads as spray-and-pray. The audit is the differentiator.
        </li>
        <li>
          <strong>Mailing too wide.</strong> Eight niches at once dilutes
          the opener library. Pick one and go deep until you book.
        </li>
        <li>
          <strong>Ignoring the phone.</strong> Local owners answer phones
          faster than inboxes. A postcode-niche list is also a cold-call
          list.
        </li>
      </ul>

      <p>
        Start with one postcode, one niche, one sequence. Measure reply rate
        after 47 sends. Adjust. The playbook is deliberately small — the
        point is that it works small, not that it scales to twenty niches
        overnight.
      </p>
    </>
  ),
  faqs: [
    {
      question: "How do I pick the right niche?",
      answer:
        "Look for niches where the typical website is a WordPress template from 2015 with no booking system. Phone repair, HVAC, locksmiths, dental clinics, opticians, driving instructors, mobile mechanics, pet groomers all qualify. Avoid niches where national chains dominate local search.",
    },
    {
      question: "Does this work outside the UK?",
      answer:
        "Yes. Postcodes are UK terminology; the equivalent is ZIP code in the US or zone in other countries. The logic is 'small geographic radius + single vertical'. Revint is locale-neutral.",
    },
    {
      question: "Can I do this with ChatGPT and Google Maps manually?",
      answer:
        "You can do a crude version. But auditing 47 sites by hand takes a day; Revint runs it in five minutes and writes the draft opener. The product exists because the manual path is too slow to scale past the first cohort.",
    },
  ],
};
