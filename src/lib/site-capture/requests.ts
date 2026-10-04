// src/lib/site-capture/requests.ts
/**
 * Third-party requests a page makes while it renders. A booking or ordering
 * widget that loads late never shows up in the final HTML; its requests do.
 * Resource hints (preconnect / dns-prefetch) make no request, so they are
 * not evidence here.
 */
import type { Page } from "playwright";
import { siteKey } from "@/lib/site-signals";

const MAX_REQUESTS = 200;
const KEPT_TYPES = new Set(["script", "xhr", "fetch"]);

/** Starts recording; call the returned function to read `origin + path` of each request. */
export function recordThirdPartyRequests(page: Page, homeUrl: string): () => string[] {
  let homeKey = "";
  try {
    homeKey = siteKey(new URL(homeUrl).hostname);
  } catch {
    // unparsable home URL: every host counts as third party
  }
  const seen = new Set<string>();
  page.on("request", (req) => {
    try {
      const type = req.resourceType();
      const subFrame = type === "document" && req.frame() !== page.mainFrame();
      if (!KEPT_TYPES.has(type) && !subFrame) return;
      const u = new URL(req.url());
      if (!/^https?:$/.test(u.protocol) || siteKey(u.hostname) === homeKey) return;
      if (seen.size < MAX_REQUESTS) seen.add(u.origin + u.pathname);
    } catch {
      // detached frame or unparsable URL: nothing to record
    }
  });
  return () => [...seen];
}
