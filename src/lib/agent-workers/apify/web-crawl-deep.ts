/**
 * APIFY_WEB_CRAWL_DEEP - website content deep crawler.
 *
 * Uses `apify/website-content-crawler` which is explicitly marketed
 * as "crawl websites and extract text content to feed AI models,
 * LLM applications, vector databases, or RAG pipelines." The output
 * is clean markdown per page.
 *
 * Writes:
 *   - PROSPECT_KB_CHUNK rows - one per page chunk (url + markdown).
 *     Consumed by AI_RECEPTIONIST_BUILDER to ground its FAQ / services
 *     output in the prospect's own site content.
 *
 * This is the Apify worker with the highest business ROI: it turns
 * the deliverable receptionist builder from "here's a config file"
 * into "here's a working AI receptionist with your business
 * knowledge baked in".
 */
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "../types";

const ACTOR_ID = "apify/website-content-crawler";
const MAX_PAGES = 50;

interface CrawledPage {
  url?: string;
  title?: string;
  text?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_WEB_CRAWL_DEEP requires a lead context");
  if (!ctx.lead.websiteUrl) {
    return { output: { skipped: true, reason: "no_website" }, costUsdCents: 0 };
  }
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }

  const input = {
    startUrls: [{ url: ctx.lead.websiteUrl }],
    maxCrawlPages: MAX_PAGES,
    crawlerType: "cheerio",
    saveMarkdown: true,
    saveHtml: false,
    removeElementsCssSelector: "nav, footer, header, .cookie, script, style",
  };

  const result = await runSync<CrawledPage>(ACTOR_ID, input, { timeoutSec: 300 });

  const pages = result.items
    .filter((p) => p && (typeof p.markdown === "string" || typeof p.text === "string"))
    .slice(0, MAX_PAGES);

  logger.info("apify.web_crawl_deep.done", {
    leadId: ctx.lead.id,
    pages: pages.length,
    costCents: result.costUsdCents,
  });

  return {
    output: {
      pages: pages.map((p) => ({
        url: p.url,
        title: p.title,
        text: p.markdown ?? p.text ?? "",
      })),
      pageCount: pages.length,
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
  const o = output as { pages?: Array<{ url?: string; title?: string; text: string }> };
  if (!Array.isArray(o.pages)) return [];

  const writes: MemoryWrite[] = [];
  for (let i = 0; i < o.pages.length; i++) {
    const page = o.pages[i];
    const txt = (page.text ?? "").trim();
    if (!txt) continue;

    // Chunk long pages into ~2000 char pieces. We chunk on paragraph
    // boundaries when possible; anything else we hard-split.
    const chunks = chunkText(txt, 2000);
    for (let j = 0; j < chunks.length; j++) {
      writes.push({
        kind: "PROSPECT_KB_CHUNK",
        text: `${page.title ? page.title + "\n\n" : ""}${chunks[j]}`,
        leadId: ctx.leadId,
        refType: "prospect_kb",
        refId: `${ctx.leadId}:${i}:${j}`,
        metadata: {
          url: page.url ?? null,
          title: page.title ?? null,
          chunkIndex: j,
          chunkCount: chunks.length,
          source: "APIFY_WEB_CRAWL_DEEP",
        },
      });
    }
  }
  return writes;
};

function chunkText(input: string, size: number): string[] {
  if (input.length <= size) return [input];
  const paras = input.split(/\n\s*\n/);
  const out: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf.length + p.length + 2) > size && buf) {
      out.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) out.push(buf);
  // If any paragraph alone exceeds `size`, hard-split it
  return out.flatMap((c) => {
    if (c.length <= size) return [c];
    const pieces: string[] = [];
    for (let k = 0; k < c.length; k += size) pieces.push(c.slice(k, k + size));
    return pieces;
  });
}
