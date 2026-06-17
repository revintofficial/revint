import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "ai-personalization-without-ground-truth",
  title:
    "AI personalisation in cold email: what works, what gets you ignored, what gets you blocked.",
  description:
    "AI-written cold email isn't the problem. AI-written cold email on top of LinkedIn bios is the problem. How to tell the difference, and why ground truth beats prompt engineering every time.",
  lede: "Most 'AI personalised' cold emails are worse than token-swap templates. They sound personalised without being personal, which is the worst combination.",
  publishedAt: "2025-11-22T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["ai", "cold email", "personalisation"],
  readMinutes: 7,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> AI personalisation works when the AI
        is summarising something specific and verifiable about the
        recipient — a website audit finding, a product review, a pricing
        page. It doesn't work when the AI is free-associating over a
        LinkedIn bio. The input data is the whole game.
      </p>

      <h2>The two failure modes of AI personalisation</h2>

      <h3>Failure 1: LinkedIn bio alchemy</h3>
      <p>
        The most common AI-personalisation workflow right now: the user
        feeds GPT-4 or Claude a LinkedIn bio, a company description, and
        a job title, then asks for a "personalised" opener. The AI writes
        something that looks specific — "I saw you spent 4 years at
        [previous company] before joining [current company], and I
        imagine scaling the sales org through Series B must be..." — but
        isn't actually specific. It's a plausible paragraph generated
        from public profile text. Recipients clock it in two seconds.
      </p>

      <p>
        The tell: compliments the recipient. Real humans writing cold
        email rarely compliment strangers in the first sentence.
      </p>

      <h3>Failure 2: fake-data confidence</h3>
      <p>
        The second failure mode is worse. The user asks the AI to do
        "research" on the prospect, the AI hallucinates a detail that
        sounds plausible, and the user sends it. "Congrats on the recent
        Series A" when the company closed Series A three years ago, or
        "I saw you mentioned AI observability on your blog" when the
        company has never written about AI observability. One email
        like that and your domain goes on an internal block list.
      </p>

      <h2>What ground truth looks like</h2>
      <p>
        Ground truth is data the AI didn't have to guess. For outbound,
        it usually comes from four places:
      </p>

      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Example of ground truth</th>
            <th>Why it works</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Website audit</td>
            <td>"Your mobile LCP is 6.2s, your booking widget isn't above the fold"</td>
            <td>Verifiable in 10 seconds by the recipient</td>
          </tr>
          <tr>
            <td>Review scrape</td>
            <td>"Your last 30 Google reviews mention booking 4 times"</td>
            <td>Public, datable, specific</td>
          </tr>
          <tr>
            <td>Product / pricing page</td>
            <td>"You charge £99/mo for the Pro plan but the feature gate on X doesn't match the comparison table"</td>
            <td>Implies actual reading</td>
          </tr>
          <tr>
            <td>Job post mining</td>
            <td>"You're hiring 3 SDRs — the JD mentions Outreach, not Apollo"</td>
            <td>Signals current pain</td>
          </tr>
        </tbody>
      </table>

      <p>
        The AI's job in these workflows is to write two sentences of
        natural-sounding English on top of the ground truth. It's not
        inventing the insight — the audit, the scrape, the job post is
        the insight. The AI is just polishing.
      </p>

      <h2>A working pattern</h2>
      <p>
        The workflow we see hit 4-6% reply rates consistently:
      </p>

      <ol>
        <li>
          <strong>Collect a specific fact per lead.</strong> Not 20 facts.
          One. The site takes 6s to load, or the booking widget is broken,
          or their pricing page has a bug on mobile.
        </li>
        <li>
          <strong>Feed it to a narrow prompt.</strong> "Write a 3-sentence
          cold email that opens with [fact]. No compliments. No 'hope
          this finds you well.' End with a single clear offer." Give the
          model the company name, the recipient's first name, and the
          fact. Nothing else.
        </li>
        <li>
          <strong>Have a human read every 50th email.</strong> Check for
          hallucinations, tonal drift, and weird phrasings that slip
          through. This is the step most scaled AI outbound skips and
          regrets.
        </li>
        <li>
          <strong>Kill the model that starts drifting.</strong> After
          ~2,000 emails a model's stylistic tells become predictable to
          inbox filters. Rotate the prompt, the model, or both monthly.
        </li>
      </ol>

      <h2>The words AI keeps putting in and that you should strip</h2>
      <p>
        We run every outbound draft through a sanity filter before it
        leaves. The words that get flagged in ~70% of raw AI outputs and
        that we always strip:
      </p>

      <ul>
        <li>"hope this email finds you well"</li>
        <li>"quickly" (as in "quickly wanted to reach out")</li>
        <li>"in today's fast-paced world"</li>
        <li>"leverage" (noun or verb)</li>
        <li>"streamline"</li>
        <li>"seamlessly"</li>
        <li>"I noticed"</li>
        <li>"I came across"</li>
        <li>"impressive"</li>
        <li>"congrats on [anything]"</li>
        <li>em dashes in the opener</li>
      </ul>

      <p>
        If your draft has three or more of these, it reads as AI regardless
        of how specific the opening fact is.
      </p>

      <h2>When AI personalisation beats human writing</h2>
      <p>
        At volume. A human writing cold email researches for 15 minutes
        and writes for 5. An AI on ground truth researches for 0 minutes
        and writes in 2 seconds. Above a few hundred emails a day, AI
        with ground truth beats human output on both consistency and
        throughput. Below that volume, a diligent human with a
        prioritised list still outperforms.
      </p>

      <p>
        The cutoff we see in our data is around 300-500 daily sends. Below
        it, do it yourself. Above it, automate with ground truth.
      </p>

      <h2>When human writing beats AI every time</h2>
      <p>
        The second touch in a sequence, when the recipient has replied
        with a question or pushback. This is where AI loses hard — every
        tonal misstep gets multiplied, and recovering from an odd second
        email is much harder than not sending it. We hand-write every
        second touch. The sequence steps before and after can be AI.
      </p>
    </>
  ),
  faqs: [
    {
      question: "Does GPT-4, Claude, or Gemini write better cold emails?",
      answer:
        "Differences are smaller than the quality of your input data. Claude tends to be slightly more natural in tone out of the box. GPT-4 is more controllable with system prompts. Gemini is cheaper. If your ground truth is good, all three produce usable output; if it's bad, none of them can save it.",
    },
    {
      question: "Should I run my drafts through an 'AI detector'?",
      answer:
        "No. AI detectors are mostly unreliable and they optimise for a metric (statistical-signature detection) that doesn't correlate with whether a human will notice AI-ness. Read the email out loud. If it sounds like someone texted you a polished LinkedIn post, strip it and try again.",
    },
    {
      question: "How long should an AI-written cold email be?",
      answer:
        "3-5 sentences. Anything longer than 80 words and the AI will over-elaborate. Shorter than 30 and it'll sound abrupt. The sweet spot is 40-70 words on the first touch.",
    },
    {
      question: "Is AI cold email going to be banned?",
      answer:
        "Unlikely. Inbox providers will keep tightening deliverability standards, which indirectly disadvantages bad AI output, but there's no regulatory path to banning AI-assisted writing. The real selection pressure is that AI without ground truth is getting ignored at scale, so the market is self-correcting.",
    },
  ],
  citations: [
    {
      label: "Google bulk-sender requirements (2024)",
      url: "https://support.google.com/a/answer/81126",
    },
    {
      label: "OpenAI — prompting best practices",
      url: "https://platform.openai.com/docs/guides/prompt-engineering",
    },
    {
      label: "Anthropic — prompt engineering guide",
      url: "https://docs.anthropic.com/claude/docs/prompt-engineering",
    },
  ],
};
