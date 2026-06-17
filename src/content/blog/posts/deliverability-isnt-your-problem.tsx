import type { BlogPost } from "../types";
import { AUTHORS } from "../types";

export const post: BlogPost = {
  slug: "deliverability-isnt-your-problem",
  title: "Deliverability isn't your problem. Your list is.",
  description:
    "Most agencies blaming Smartlead, Instantly, or SPF records for low reply rates have a list problem hiding underneath. How to tell the difference, and what to fix first.",
  lede: "If you're on your third sender in six months and reply rates still suck, the sender isn't the variable.",
  publishedAt: "2026-02-14T09:00:00Z",
  author: AUTHORS["revint-team"],
  tags: ["deliverability", "cold email", "contrarian"],
  readMinutes: 7,
  body: () => (
    <>
      <p>
        <strong>Short answer:</strong> if your open rate is above 40% and
        your reply rate is still below 1%, you don't have a deliverability
        problem. You have a list problem or an opener problem. Deliverability
        shows up in the open rate, not the reply rate.
      </p>

      <h2>The diagnosis people keep skipping</h2>
      <p>
        Every quarter we talk to agencies who've migrated from Instantly to
        Smartlead to Lemlist to Mailreef looking for the "best" deliverability
        stack. They're optimising a variable that isn't broken. Before
        touching sender infrastructure, look at this:
      </p>

      <table>
        <thead>
          <tr>
            <th>If you see...</th>
            <th>...you probably have</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Open rate &lt; 30%</td>
            <td>A real deliverability problem</td>
          </tr>
          <tr>
            <td>Open rate 30-50%, reply rate &lt; 0.5%</td>
            <td>A saturated list (Apollo / ZoomInfo / Lusha defaults)</td>
          </tr>
          <tr>
            <td>Open rate &gt; 50%, reply rate &lt; 1%</td>
            <td>A generic opener problem</td>
          </tr>
          <tr>
            <td>Open rate &gt; 60%, reply rate 1-3%</td>
            <td>Healthy send. Work on offer or cadence.</td>
          </tr>
          <tr>
            <td>Bounce rate &gt; 5%</td>
            <td>
              List-verification problem. Your data source isn't refreshing.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Most agencies we meet sit in row 2 or row 3 and spend money fixing
        row 1.
      </p>

      <h2>What deliverability actually controls</h2>
      <p>
        Deliverability is the art of not getting filtered into spam or
        Promotions. It shows up in two metrics: open rate and bounce rate.
        If both are healthy, your sender setup is fine.
      </p>

      <p>
        Things that genuinely help deliverability, in the order the data
        supports them:
      </p>

      <ol>
        <li>
          Authenticated SPF, DKIM, and DMARC, aligned. This is the first
          thing every sender tool checks. Skip it and you'll sit in spam
          forever.
        </li>
        <li>
          Warmup for at least 21 days before sending volume, and keep warmup
          running at 15-20% of your send volume indefinitely. This is the
          single setting most agencies have wrong.
        </li>
        <li>
          Max 30-50 sends per mailbox per day across all sequences. Not
          per campaign — per mailbox. Split volume across mailboxes before
          splitting across senders.
        </li>
        <li>
          No link in the first email. Or if you must, a plain-text
          unsubscribe line in the footer and nothing else. Tracking pixels
          aren't necessary in 2026 — the signal they produce isn't worth
          the deliverability tax.
        </li>
        <li>
          Text-only body. HTML rendering adds almost nothing and costs
          deliverability against Gmail's Promotions tab.
        </li>
      </ol>

      <p>
        That's it. If you've done those five and your open rate is still
        below 30%, talk to your sender's support. If you've done those five
        and your open rate is above 40% but your reply rate is under 1%, do
        not talk to your sender's support. Look at your list.
      </p>

      <h2>The saturated-list test</h2>
      <p>
        Want to know if your list is saturated? Run a 100-contact side
        experiment: pull a list from a live source (Google Maps, LinkedIn
        Sales Nav scraping, a customer lookalike) that has zero overlap
        with Apollo. Send the exact same sequence. If the reply rate
        jumps 3-4× on the fresh list, you have your answer.
      </p>

      <p>
        Roughly 85% of the agencies we've watched run this test have the
        fresh list win by at least 3×. The other 15% typically find out
        their opener is the bottleneck, which is a separate and easier
        problem to fix.
      </p>

      <h2>Why the industry keeps blaming deliverability</h2>
      <p>
        Two reasons. First, sender tools have a commercial incentive to
        sell you on the idea that the sending stack is where reply rate
        lives. They don't control your list, so they can't make money
        telling you the list is the problem. Second, swapping a sender
        feels like action. Rebuilding your data layer feels like work.
        Agencies pick the thing that feels like action.
      </p>

      <h2>The one deliverability change that's actually changed recently</h2>
      <p>
        Google and Microsoft rolled out stricter bulk-sender requirements
        in early 2024, with real enforcement starting mid-2024. If you're
        not authenticated at the DNS level, you will sit in spam 80%+ of
        the time now. This affected a lot of small outbound teams who were
        getting by on domain reputation alone.
      </p>

      <p>
        Fix DNS, fix warmup, then stop touching the sender stack. Go fix
        your list.
      </p>
    </>
  ),
  faqs: [
    {
      question: "How do I check if my domain is authenticated correctly?",
      answer:
        "Run a test through mail-tester.com or your sender's built-in health check. You want 10/10 on SPF, DKIM, and DMARC. Anything less and you'll sit in spam at modern providers.",
    },
    {
      question: "Is it worth migrating to Google Workspace mailboxes for warmup?",
      answer:
        "For most small outbound operations, yes. Google's reputation scoring is stricter than Outlook's but the ceiling is higher — once warmed, Workspace mailboxes get deliverability advantages that private domains can't match.",
    },
    {
      question: "What open rate is 'normal' for cold email in 2026?",
      answer:
        "45-60% for text-only cold email on a warmed stack. Under 35% means deliverability or subject-line problems. Over 70% usually means open-tracking inflation from mail-provider preloading — take it with a grain of salt.",
    },
    {
      question: "Should I worry about the Promotions tab?",
      answer:
        "Only if your recipients are consumers. For B2B, most buyers check Promotions during lulls in the day. Promotions placement hurts reply rate by maybe 20-30%, which matters but isn't fatal. Don't blow up your sending setup to escape it.",
    },
  ],
  citations: [
    {
      label: "Google bulk-sender requirements (2024)",
      url: "https://support.google.com/a/answer/81126",
    },
    {
      label: "Microsoft sender requirements update (2024)",
      url: "https://www.microsoft.com/en-us/security/blog",
    },
    {
      label: "Mail-tester scoring reference",
      url: "https://www.mail-tester.com/",
    },
  ],
};
