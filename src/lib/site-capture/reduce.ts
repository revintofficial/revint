// src/lib/site-capture/reduce.ts
/**
 * Reduces a page to what the readers need: visible text, links, embedded
 * script / iframe addresses and JSON-LD. Raw HTML is not kept.
 */
import * as cheerio from "cheerio";
import { linksOf } from "@/lib/site-facts";
import { visibleText } from "@/lib/site-signals";
import type { ReducedPage } from "./types";

export const MAX_TEXT_CHARS = 60_000;
const MAX_LINKS = 400;
const MAX_EMBEDS = 150;
const MAX_JSONLD_BLOCKS = 20;
const MAX_JSONLD_CHARS = 20_000;

/** Postgres text columns reject NUL bytes (PDF text and some CMS output carry them). */
export function cleanText(text: string): string {
  return text.replace(/\u0000/g, "");
}

export function reducePage(html: string, pageUrl: string): ReducedPage {
  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text()).replace(/\s+/g, " ").trim() || null;
  const text = cleanText(visibleText(html)).slice(0, MAX_TEXT_CHARS);

  const links: ReducedPage["links"] = [];
  const seenLinks = new Set<string>();
  for (const l of linksOf(html, pageUrl)) {
    const href = l.url.href;
    const key = `${href}\n${l.text}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    links.push({ text: cleanText(l.text).slice(0, 200), href });
    if (links.length >= MAX_LINKS) break;
  }

  const embeds: string[] = [];
  $("script[src], iframe[src], iframe[data-src], embed[src]").each((_, el) => {
    if (embeds.length >= MAX_EMBEDS) return;
    const raw = ($(el).attr("src") ?? $(el).attr("data-src") ?? "").trim();
    if (!raw) return;
    try {
      const u = new URL(raw, pageUrl);
      if (/^https?:$/.test(u.protocol) && !embeds.includes(u.href)) embeds.push(u.href);
    } catch {
      // malformed src: nothing to record
    }
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLd.length >= MAX_JSONLD_BLOCKS) return;
    const raw = $(el).text();
    if (!raw || raw.length > MAX_JSONLD_CHARS) return;
    try {
      jsonLd.push(JSON.parse(cleanText(raw)));
    } catch {
      // malformed JSON-LD: skip
    }
  });

  return { title, text, links, embeds, jsonLd };
}
