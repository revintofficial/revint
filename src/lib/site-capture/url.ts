// src/lib/site-capture/url.ts
import { bare } from "@/lib/site-facts";

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

/**
 * One key per page: scheme, `www.`, fragment, trailing slash and tracking
 * parameters do not make a different page. `null` for anything that is not
 * an http(s) address.
 */
export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "/";
  const query = u.searchParams.toString();
  return `${bare(u.hostname)}${path || "/"}${query ? `?${query}` : ""}`;
}
