import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "opener-frameworks-that-work",
  title: "Four opener frameworks that still get replies in 2026",
  description:
    "The '{FirstName}, quick question about {Company}' template is dead. Here are four opener frameworks that still earn replies — each with a real example pulled from our pipeline.",
  lede: "Four templates, four examples, a rubric for picking between them.",
  publishedAt: "2026-02-05T09:30:00Z",
  author: AUTHORS["leadac-team"],
  tags: ["cold email", "copywriting", "templates"],
  readMinutes: 7,
  body: () => (
    <>
      <p>
        Short answer: the opener frameworks that still work are{" "}
        <em>grounded observation</em>, <em>specific number</em>,{" "}
        <em>earned question</em>, and <em>before/after proof</em>. Each one
        anchors on something the recipient didn't expect you to know. That's
        the only variable that correlates with reply rate in our data.
      </p>

      <h2>Framework 1 — Grounded observation</h2>
      <p>
        <strong>Shape:</strong> "Noticed [specific thing on your site /
        listing / business]. [Implication]. Worth a five-minute call?"
      </p>
      <p>
        <strong>Example:</strong>
      </p>
      <blockquote>
        <p>
          Hi Sarah — ran a quick speed check on fixmyphone-camden.co.uk.
          Mobile page takes 7.2 seconds to load; around 40% of mobile users
          drop off before a page finishes at that speed.
        </p>
        <p>
          Can fix that in a few hours. Worth a five-minute call Thursday?
        </p>
      </blockquote>
      <p>
        Works because the observation is verifiable and tied to a cost the
        recipient cares about (lost mobile traffic).
      </p>

      <h2>Framework 2 — Specific number</h2>
      <p>
        <strong>Shape:</strong> "Your [thing] is [number]. For context,
        [benchmark]. [Question]?"
      </p>
      <p>
        <strong>Example:</strong>
      </p>
      <blockquote>
        <p>
          Your Google Maps listing has 3 reviews. The average phone-repair
          shop in NW1 has 47. Worth 10 minutes on how to close that gap
          without paying for ads?
        </p>
      </blockquote>
      <p>
        Numbers cut through abstraction. The benchmark makes the gap
        uncomfortable without being hostile.
      </p>

      <h2>Framework 3 — Earned question</h2>
      <p>
        <strong>Shape:</strong> "I've been working with [specific type of
        business]. Question that keeps coming up: [question that references
        something you'd only know if you'd done this work]."
      </p>
      <p>
        <strong>Example:</strong>
      </p>
      <blockquote>
        <p>
          We build websites for dental clinics in London. One question that
          keeps coming up: are you seeing the same thing we are with
          Bupa/Denplan referrals driving 30% of new-patient signups now
          versus 15% two years ago?
        </p>
        <p>
          Curious what your setup is — happy to compare notes.
        </p>
      </blockquote>
      <p>
        Works because the question demonstrates specific expertise and opens
        a conversation, not a pitch. Reply rate on this one is the highest
        of the four, but it only works in niches where you actually have
        pattern recognition.
      </p>

      <h2>Framework 4 — Before/after proof</h2>
      <p>
        <strong>Shape:</strong> "[Similar customer] had [specific problem].
        After [what you did], [specific outcome]. Think the same move would
        work here — worth a call?"
      </p>
      <p>
        <strong>Example:</strong>
      </p>
      <blockquote>
        <p>
          Walthamstow Dental had the same slow-loading booking page you've
          got. Moved them to Setmore, load time dropped from 9s to 1.8s,
          new-patient bookings went up 34% in 60 days.
        </p>
        <p>
          Think the same move would work for you — worth a call?
        </p>
      </blockquote>
      <p>
        Requires a case study. If you have one, this is the highest-
        converting opener we've seen. If you don't, use framework 1 or 2
        until you do.
      </p>

      <h2>Which framework when?</h2>

      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>First 20 emails in a new niche</td>
            <td>Framework 1 — grounded observation</td>
          </tr>
          <tr>
            <td>Target has weak Google reviews or low content</td>
            <td>Framework 2 — specific number</td>
          </tr>
          <tr>
            <td>Target is sophisticated (agency, multi-location)</td>
            <td>Framework 3 — earned question</td>
          </tr>
          <tr>
            <td>You have a public case study in the same vertical</td>
            <td>Framework 4 — before/after proof</td>
          </tr>
        </tbody>
      </table>

      <h2>What never works</h2>
      <ul>
        <li>
          "Hope you're well" openers — read as AI-generated before the
          second sentence.
        </li>
        <li>
          Compliments on the business ("love what you're doing") — read as
          bullshit flattery.
        </li>
        <li>
          "Not sure if this is relevant" preambles — apologizing in advance
          signals you know the email doesn't belong.
        </li>
        <li>
          Asking to "pick your brain" — reverses who's providing value.
        </li>
      </ul>
    </>
  ),
};
