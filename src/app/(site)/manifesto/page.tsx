import type { Metadata } from "next";
import {
  Hero,
  ManifestoBlock,
  ProblemGrid,
  StackPositionDiagram,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  articleSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { painsForVertical } from "@/content/site/pains";
import { FAQS } from "@/content/site/faq";
import { SITE } from "@/lib/seo/metadata";

/**
 * /manifesto — the long-form positioning piece.
 *
 * Psych: Cognitive Dissonance Resolution (psych-map). The piece names a
 * conflict (Gong proved the memory thesis; nobody under $100K can use it)
 * and resolves it by re-drawing the category map. brand-assets §1.4
 * external manifesto cadence; first-person plural, no rallying cries.
 */

const PATH = "/manifesto";
const TITLE =
  "The category is operational intelligence. The substrate is memory.";
const DESCRIPTION =
  "Why we built Revint: conversation intelligence covers what your team said. Operational intelligence covers what the account is doing. Vertical SaaS GTM teams need the second one at the first one's price band.";
const PUBLISHED = "2026-05-22";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  ogType: "article",
  article: {
    publishedTime: PUBLISHED,
    author: SITE.name,
    section: "Manifesto",
    tags: [
      "operational intelligence",
      "vertical SaaS",
      "memory layer",
      "category creation",
    ],
  },
});

export default function ManifestoPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Manifesto", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-article"
        data={articleSchema({
          headline: TITLE,
          description: DESCRIPTION,
          url: `${SITE.url}${PATH}`,
          datePublished: PUBLISHED,
          authorName: SITE.name,
          tags: [
            "operational intelligence",
            "vertical SaaS",
            "memory layer",
          ],
        })}
      />

      <Hero
        eyebrow="Manifesto"
        headline={TITLE}
        subhead="Two things are true at the same time. Gong proved the memory thesis is the future of revenue tooling. And the price floor that comes with that proof rules out roughly 50,000 vertical SaaS companies that need memory the most. Revint exists to close that gap."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />

      <ManifestoBlock
        eyebrow="The thesis"
        title="Conversation memory and operational memory live on different substrates."
        paragraphs={[
          "Gong's Revenue Graph indexes what your team said. Calls, emails, meeting transcripts — a memory layer assembled from the words that pass through your sellers. It is a real category, it is well built, and it costs $100,000 per year for 25 reps with eight weeks of RevOps engineering.",
          "Operational intelligence indexes what the account is doing. Reviews, location count, vertical software stack, owner activity, hiring posts, expansion signals. Same word — memory — different substrate. The two layers describe different things, serve different buyers, and live at different price floors.",
          "Vertical SaaS GTM teams selling to local business need the operational layer more than the conversation layer. Restaurant tech sellers don't lose deals because a rep said the wrong thing on a call. They lose deals because nobody on the team knew the prospect was a multi-location group on OpenTable Lite with a hiring signal in the operations seat. That is an operational fact about the world, not a fact about the conversation.",
        ]}
        pullQuote={{
          quote:
            "We index what the account is doing. Gong indexes what your team said. Different substrate, different price floor, same word.",
        }}
      />

      <ManifestoBlock
        eyebrow="The gap"
        title="Mid-market vertical SaaS lives between Apollo and Gong, and nothing serves them."
        paragraphs={[
          "Apollo's contact data was built for B2B SaaS selling to other B2B SaaS. Restaurant operators don't have a Crunchbase entry. HVAC dispatchers don't show up in LinkedIn Sales Navigator the way a VP of Engineering does. The firmographic signature that powers Apollo's match logic is thin for the buyer Revint's customers sell to.",
          "Clay is a programmable workflow runtime. Powerful, real, well built — and it requires a GTM engineer to operate. Vertical SaaS teams at $5M to $30M ARR rarely have one. The Clay account that gets opened in week one usually goes idle by month two. Not because Clay is wrong; because the staffing assumption is wrong for the segment.",
          "Gong's $100K floor and 8-week implementation rule out almost every team under 50 sellers. Outreach is being repositioned upmarket. Smartlead and Instantly are sequencers — they send the email but don't decide what should be in it. The gap between Apollo's lists and Gong's transcripts is where vertical SaaS GTM teams live, and the dominant stack does not serve it.",
        ]}
      />

      <StackPositionDiagram
        eyebrow="How the layers stack"
        title="Apollo finds. Clay enriches. Gong records. Revint remembers."
        subtitle="We do not replace any of the four boxes. We are the operational memory layer that ties them together — the layer that learns from your won and lost deals and pushes that pattern back into discovery."
      />

      <ManifestoBlock
        eyebrow="What we are not"
        title="We are not another AI SDR. We are not a horizontal sales tool."
        paragraphs={[
          "We do not write your emails. We do not replace your reps. We do not sell call recording, forecasting, or pipeline review. We do not bid on the keyword 'AI SDR' and we never describe Revint as 'agentic'. The 11x, Artisan, AiSDR pattern of fully autonomous outreach is the opposite of what we build — the homework is automated, the conversation stays human.",
          "We do not sell to enterprise GTM teams that have a dedicated RevOps engineer, a Salesforce + Gong stack, and a 12-month buying cycle. Gong serves that customer well and the price is fair for the buyer. We serve the 10x larger TAM below that price floor — vertical SaaS companies at $2M to $50M ARR with 5 to 30 sellers and a HubSpot instance that already runs the business.",
          "We do not promise 10x. We do not promise to replace your team. We promise to write twelve fields into your HubSpot company record before your SDR opens the contact, and to learn from your closed-won and closed-lost outcomes inside of every list we generate after that.",
        ]}
      />

      <ProblemGrid
        eyebrow="What the segment is dealing with right now"
        title="Six things that show up in every discovery call with a vertical SaaS VP Sales."
        intro="Every pain ships with a real source and a real date. We refuse to write a problem section out of stock phrases."
        pains={painsForVertical("cross-vertical", 6)}
      />

      <FaqBlock
        eyebrow="Questions about the thesis"
        title="Questions that come up when we ship this thesis."
        entries={FAQS.manifesto}
      />

      <CtaBlock
        eyebrow="The pilot"
        title="Run Revint on five of your own accounts for thirty days."
        subtitle="$500, one vertical pack, your HubSpot. We refund the pilot fee if you don't see a brief land that your SDR would have used."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
