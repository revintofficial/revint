import { headers, cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  negotiateLocale,
  type Locale,
} from "./config";

/**
 * Server-side locale resolver. Call from server components / route
 * handlers that need to render locale-aware copy. Precedence:
 *
 *   1. `x-locale` request header (set by middleware after negotiation).
 *   2. `NEXT_LOCALE` cookie (user's sticky choice, survives refresh).
 *   3. Negotiation from `accept-language`.
 *   4. DEFAULT_LOCALE.
 *
 * Always returns a valid Locale — never throws.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const headerLocale = h.get("x-locale");
    if (headerLocale && isSupportedLocale(headerLocale)) return headerLocale;

    const c = await cookies();
    const cookieLocale = c.get("NEXT_LOCALE")?.value;
    if (cookieLocale && isSupportedLocale(cookieLocale)) return cookieLocale;

    return negotiateLocale(h.get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}
