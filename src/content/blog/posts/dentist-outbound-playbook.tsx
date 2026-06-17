import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "dentist-outbound-playbook",
  title:
    "The dentist outbound playbook: what actually gets a practice manager to reply.",
  description:
    "Outbound to dental practices is a different animal than plumbers. Gatekeepers, compliance-minded buyers, and a brutal intolerance for bad copy. What works, what doesn't, and why one-sentence openers beat clever ones.",
  lede: "Dentists have more money than plumbers and less patience. Your email gets two seconds before the practice manager decides.",
  publishedAt: "2026-01-03T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["playbook", "dentists", "local service", "niche"],
  readMinutes: 8,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> the inbox owner is almost always the
        practice manager, not the dentist. Write to them. Keep the opener
        under three sentences, reference a specific patient-facing issue
        (online booking, review response gap, appointment reminders), and
        price in GBP or USD with no monthly-retainer language in the first
        touch.
      </p>

      <h2>Who's on the other side of the email</h2>
      <p>
        Three roles matter:
      </p>

      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>What they care about</th>
            <th>How to write to them</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Practice manager</td>
            <td>
              Patient flow, no-shows, Google reviews, staff time, compliance.
              Will forward your email to the dentist if it passes their filter.
            </td>
            <td>
              This is your real audience. Keep it short, specific, and
              operational.
            </td>
          </tr>
          <tr>
            <td>Principal dentist</td>
            <td>
              Clinical quality, new-patient volume, reputation, acquiring
              more practices if they're ambitious.
            </td>
            <td>
              You're rarely writing to them directly in cold outbound. When
              you do, lead with new-patient metrics.
            </td>
          </tr>
          <tr>
            <td>Dental group / DSO marketing contact</td>
            <td>
              Multi-site rollouts, consistent branding, HIPAA/GDPR
              compliance. Slower decision cycle.
            </td>
            <td>
              Different sales motion. Not this playbook.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The list</h2>
      <p>
        For independent practices (1-3 chairs), Google Maps by postcode is
        still the best source. Layer on two enrichment steps:
      </p>

      <ol>
        <li>
          Pull the practice manager's name from the site's "Our Team" page.
          Most dentist websites list names and photos. If you can't find a
          name, skip the lead.
        </li>
        <li>
          Check Companies House or your local equivalent for the limited
          company behind the practice. The directors list usually includes
          the principal dentist plus the practice manager if they're a
          co-owner. Useful for title accuracy.
        </li>
      </ol>

      <p>
        Do not use Apollo for dental. The coverage on practice managers
        specifically is poor — the role title varies (practice manager,
        office manager, operations manager, treatment coordinator) and
        Apollo's dataset conflates them.
      </p>

      <h2>The opener that works</h2>
      <p>
        Short. Specific. Operational. Try this shape:
      </p>

      <blockquote>
        Hi [practice manager name],<br />
        <br />
        Ran a quick check on [practice name] — your online booking widget
        isn't loading on mobile Safari (blank screen at the booking step).
        That's probably costing you 2-4 new patients a week given your
        search volume.<br />
        <br />
        We fix this for dental practices, flat fee £850, live in 5 days.
        Happy to send a 30-second video of the bug if useful.<br />
        <br />
        — [your name]
      </blockquote>

      <p>
        The elements that matter:
      </p>

      <ul>
        <li>
          Named practice manager. Dentists list their teams publicly. Use it.
        </li>
        <li>
          Specific patient-facing issue. "Mobile Safari booking widget broken"
          is the kind of sentence a practice manager will forward to the
          principal within 10 minutes.
        </li>
        <li>
          A patient-count estimate. "2-4 new patients a week" translates
          into £ in their head faster than "you're losing leads."
        </li>
        <li>
          Flat fee. Dentists buy capital equipment on quoted prices. They
          expect the same from marketing services.
        </li>
        <li>
          Video offer. Practice managers watch short videos; long Looms die.
          30 seconds, no intro, no sign-off.
        </li>
      </ul>

      <h2>The offers that close</h2>

      <table>
        <thead>
          <tr>
            <th>Offer</th>
            <th>Typical price</th>
            <th>Close rate on calls</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Booking widget fix + mobile rebuild</td>
            <td>£800-£1,500</td>
            <td>40-55%</td>
          </tr>
          <tr>
            <td>Google review-response automation setup</td>
            <td>£500 setup + £150/mo</td>
            <td>30-45%</td>
          </tr>
          <tr>
            <td>New-patient landing page + ads management</td>
            <td>£1,200 setup + £900/mo + ad spend</td>
            <td>15-25%</td>
          </tr>
          <tr>
            <td>Full website rebuild</td>
            <td>£2,500-£4,500</td>
            <td>20-30%</td>
          </tr>
        </tbody>
      </table>

      <p>
        The fix-first offers convert best because they look like a defined
        purchase, not a commitment. Once the fix lands, upselling into a
        rebuild or ads retainer closes at ~60%. That's the real economics
        of the niche — you're buying a first-time customer cheap and
        earning the second deal on delivery.
      </p>

      <h2>Follow-up that works</h2>
      <p>
        Five touches over three weeks. Dentists run on longer cycles than
        plumbers because practice managers batch admin:
      </p>

      <ul>
        <li>Day 0: opener.</li>
        <li>
          Day 3: the 30-second bug video, attached as a link (Loom or
          similar), nothing else.
        </li>
        <li>
          Day 8: a one-sentence reference drop — "we did the same fix for
          [nearby practice] last month; happy to introduce you."
        </li>
        <li>
          Day 14: a summary of three issues from the full audit, framed
          as "here's what we'd do, in priority order."
        </li>
        <li>
          Day 21: break-up email. "Last note — want me to close the file?"
        </li>
      </ul>

      <h2>Compliance and tone</h2>
      <p>
        Two things to be aware of:
      </p>

      <ul>
        <li>
          UK GDPR and US HIPAA don't govern what you can send to a dental
          practice in cold outbound — they govern what the practice can
          send back. Don't ask for patient data in the first touch; some
          practices will disqualify you for asking.
        </li>
        <li>
          Dentists are extremely allergic to hype. Words that kill reply
          rate in this niche: "revolutionary," "transform," "explode your
          practice," "7-figure," any emoji. Tone is accountant, not
          marketer.
        </li>
      </ul>

      <h2>What doesn't work</h2>
      <ul>
        <li>
          Long emails with a before/after table. Dentists skim; tables feel
          like a sales deck.
        </li>
        <li>
          "Free audit" offers. Practice managers don't have time for a
          report. They want a specific fix and a price.
        </li>
        <li>
          LinkedIn connection requests first. Practice managers are rarely
          on LinkedIn. Principal dentists are, but they're not the buyer.
        </li>
        <li>
          Cold calls before email. A cold call without an email trail gets
          you treated as a solicitor. An email first, then a call on day
          7 that references the email, works.
        </li>
      </ul>
    </>
  ),
  faqs: [
    {
      question: "How do I find the practice manager's name?",
      answer:
        "The practice's own website is the most reliable source. 'Meet the team' or 'About us' pages almost always list the practice manager by name and sometimes include a photo. If the site doesn't have one, check the practice's Google Business Profile — sometimes responses to reviews are signed with a name.",
    },
    {
      question: "Should I target NHS or private dental practices?",
      answer:
        "Private. NHS practices are capacity-constrained by their contracts — more new patients doesn't help them. Private and mixed-NHS/private practices grow new-patient volume for a living and buy accordingly.",
    },
    {
      question: "What's a realistic monthly revenue from dentist outbound?",
      answer:
        "A solo operator sending 500 emails/week into independent UK practices with this playbook typically books 6-10 calls per month, closes 2-4 deals, and generates £3,000-£8,000 of new revenue. Ramp over 3-4 months to hit the upper end as references compound.",
    },
    {
      question: "Are dental groups (DSOs) worth pursuing?",
      answer:
        "Different game. Longer cycles (3-6 months), decision by committee, procurement involvement. Worth it once you have a solid independent-practice reference base. Don't start there.",
    },
  ],
  citations: [
    {
      label: "ICO — GDPR guidance on B2B marketing",
      url: "https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/",
    },
    {
      label: "General Dental Council — practice register (UK)",
      url: "https://www.gdc-uk.org/",
    },
  ],
};
