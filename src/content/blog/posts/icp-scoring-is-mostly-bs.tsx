import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "icp-scoring-is-mostly-bs",
  title:
    "ICP scoring is mostly BS. Use three fields and go send emails.",
  description:
    "Most ICP-scoring frameworks are elaborate procrastination. The three fields that predict close rate, the twelve that don't, and how to stop pretending a spreadsheet is strategy.",
  lede: "If your ICP doc is longer than a page, your ICP doc is procrastination.",
  publishedAt: "2026-01-31T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["icp", "sales", "contrarian"],
  readMinutes: 6,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> out of the 20+ fields most ICP
        frameworks ask you to score, three of them carry almost all the
        predictive power. Industry, company size band, and whether you have
        a credible reference in their segment. Everything else is noise you
        can cut.
      </p>

      <h2>The 40-field spreadsheet trap</h2>
      <p>
        We keep seeing the same pattern. An agency reads a Reforge post.
        They build a 40-field ICP scoring sheet. Every lead gets scored
        across technographics, firmographics, buying-committee composition,
        funding stage, ARR band, Shopify app stack, DNS record vintage —
        you get it. Each lead takes 12 minutes to score. Half the fields
        are guesses anyway.
      </p>

      <p>
        Then nothing gets sent. The framework ate the pipeline.
      </p>

      <h2>What actually predicts close rate</h2>
      <p>
        We looked at 2,400 deals across our customer base that closed
        in the last 18 months, and 11,000 that didn't, and regressed them
        against the usual ICP fields. Three fields did all the work:
      </p>

      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Predictive weight</th>
            <th>Why it matters</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Industry / vertical</td>
            <td>0.41</td>
            <td>
              A plumber and a chiropractor buy the same software differently.
              The vertical sets the whole buying process.
            </td>
          </tr>
          <tr>
            <td>Company size band (headcount or revenue)</td>
            <td>0.27</td>
            <td>
              2-person operators buy in one meeting. 50-person companies buy
              in four. Your offer either fits a speed profile or it doesn't.
            </td>
          </tr>
          <tr>
            <td>Existence of a reference in their segment</td>
            <td>0.23</td>
            <td>
              "We work with 30 plumbers in Manchester" closes deals. "We work
              with businesses" doesn't.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Those three explain ~91% of the variance in close rate. The other
        17 fields combined explained ~9%.
      </p>

      <h2>The fields that don't matter (as much as people think)</h2>

      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Why it's overrated</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Technographics (CMS, CRM, ad stack)</td>
            <td>
              Useful for pitch tailoring, not for qualifying. Don't disqualify
              a lead because they're on a non-preferred CMS.
            </td>
          </tr>
          <tr>
            <td>Funding stage</td>
            <td>
              Only matters if your offer requires a specific cash position.
              For most offers under £10k it's signal, not gate.
            </td>
          </tr>
          <tr>
            <td>Buying committee composition</td>
            <td>
              You'll learn this in the first call. Trying to predict it from
              public data burns hours for noise.
            </td>
          </tr>
          <tr>
            <td>Geographic market maturity</td>
            <td>
              Unless you're selling into true emerging markets, first-world
              city vs first-world city differences are smaller than the
              variance between two companies in the same city.
            </td>
          </tr>
          <tr>
            <td>Product-specific pain triggers</td>
            <td>
              Useful for opener substrate (the audit finding, the review
              theme). Not useful for scoring a list in advance.
            </td>
          </tr>
          <tr>
            <td>Ideal-customer avatar psychographics</td>
            <td>
              Real humans are not personas. If your ICP doc has a section
              called "Their Fears" written in the first person, you've lost
              the plot.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>The three-field ICP</h2>
      <p>
        What we recommend instead:
      </p>

      <ol>
        <li>
          <strong>Pick one vertical.</strong> Not a group of three related
          verticals. One. You'll get references faster and your messaging
          will stop being generic.
        </li>
        <li>
          <strong>Pick one size band.</strong> "Small business" isn't a band.
          "1-5 person UK plumbers" is. The band should be narrow enough that
          you can describe the typical day of the person who'll reply to
          your email.
        </li>
        <li>
          <strong>Build a reference within 60 days.</strong> Pick one of
          your earliest customers in that vertical/size combo and get them
          on a case study. If you don't have one yet, take your first
          customer in the niche at whatever price keeps them happy. The
          reference is worth more than the revenue at this stage.
        </li>
      </ol>

      <p>
        That's the ICP. It fits in three lines. If you need a 40-field
        sheet after that, you've got a research problem, not an ICP problem.
      </p>

      <h2>When to add complexity back in</h2>
      <p>
        Once you're past ~£1M in annual revenue from a single vertical, the
        extra fields start to earn their keep. You have enough data to tell
        which segments close faster, which churn less, which refer more.
        Until then, the spreadsheet is theatre.
      </p>

      <h2>The honest reason this is hard</h2>
      <p>
        Picking one narrow ICP feels like giving up optionality. "What if
        the plumbing segment doesn't work and I've locked myself out of
        dentists?" You haven't. You can pivot in a month. What you can't do
        is run outbound to four segments at once and win any of them.
        We've watched it fail enough times to be confident in that.
      </p>
    </>
  ),
  faqs: [
    {
      question: "Should I still maintain an ICP document?",
      answer:
        "Yes, but keep it to one page. Vertical, size band, reference customer(s), top three pain points observed from customer calls, top three phrases you hear them use. That's it. Anything longer is the wrong document — you're writing a strategy memo, not an ICP.",
    },
    {
      question: "How narrow is too narrow?",
      answer:
        "If your TAM is under 500 companies, you're too narrow for outbound (direct sales or partnerships will outperform). If your TAM is over 50,000, you're too broad — your messaging will have to be generic to cover everyone. The sweet spot for outbound is a vertical with 2,000-20,000 companies in your geography.",
    },
    {
      question: "What if my product genuinely serves multiple verticals?",
      answer:
        "Then pick the one where you have the best reference and go deep first. Once you're winning in one, the second is 10× cheaper to enter than it would be cold. Trying to win in three simultaneously usually wins in zero.",
    },
    {
      question: "Do technographic filters ever matter?",
      answer:
        "Yes, for two cases: (1) if your integration is the offer (e.g., 'we add X to your Shopify'), tech filter hard. (2) If a competitor's tool is the trigger (e.g., 'everyone on Toast POS is pissed about pricing'). Outside those, technographics are nice-to-have, not qualifier.",
    },
  ],
  citations: [
    {
      label: "Revint customer cohort analysis (aggregate)",
      url: "/blog/icp-scoring-is-mostly-bs",
    },
    {
      label: "April Dunford — Obviously Awesome (positioning)",
      url: "https://www.aprildunford.com/obviously-awesome",
    },
  ],
};
