/**
 * APIFY_REDDIT_MENTIONS - Reddit reputation scan.
 *
 * Searches Reddit for the business name. Writes REDDIT_MENTION memory
 * rows with sentiment-tagged metadata. Copilot can answer "are there
 * any Reddit complaints about this business?" from this data.
 */
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "../types";

const ACTOR_ID = "trudax/reddit-scraper-lite";

interface RedditItem {
  id?: string;
  title?: string;
  body?: string;
  text?: string;
  url?: string;
  permalink?: string;
  subreddit?: string;
  author?: string;
  score?: number;
  numberOfComments?: number;
  commentsCount?: number;
  createdAt?: string;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_REDDIT_MENTIONS requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }

  const input = {
    searches: [ctx.lead.businessName],
    maxItems: 15,
    type: "posts",
    sort: "relevance",
  };

  const result = await runSync<RedditItem>(ACTOR_ID, input, { timeoutSec: 120 });
  const items = result.items.filter((i) => i && (i.title || i.body || i.text));

  logger.info("apify.reddit_mentions.done", {
    leadId: ctx.lead.id,
    items: items.length,
    costCents: result.costUsdCents,
  });

  return {
    output: {
      mentions: items.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body ?? i.text,
        subreddit: i.subreddit,
        url: i.url ?? i.permalink,
        score: i.score ?? 0,
        comments: i.numberOfComments ?? i.commentsCount ?? 0,
        createdAt: i.createdAt,
      })),
      count: items.length,
      costUsdCents: result.costUsdCents,
    },
    costUsdCents: result.costUsdCents,
  };
};

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    mentions?: Array<{
      id?: string;
      title?: string;
      body?: string;
      subreddit?: string;
      url?: string;
      score?: number;
      comments?: number;
      createdAt?: string;
    }>;
  };
  if (!Array.isArray(o.mentions)) return [];

  return o.mentions
    .filter((m) => m.title || m.body)
    .map((m) => ({
      kind: "REDDIT_MENTION" as const,
      text: [m.title, m.body].filter(Boolean).join("\n\n"),
      leadId: ctx.leadId,
      refType: "reddit_mention",
      refId: m.id ? `${ctx.leadId}:rd:${m.id}` : undefined,
      metadata: {
        subreddit: m.subreddit,
        url: m.url,
        score: m.score ?? 0,
        comments: m.comments ?? 0,
        createdAt: m.createdAt,
        source: "APIFY_REDDIT_MENTIONS",
      },
    }));
};
