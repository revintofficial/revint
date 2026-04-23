import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isSupportedLocale,
  negotiateLocale,
} from "@/lib/i18n/config";

/**
 * Minimal locale-detection middleware (phase 1, EN-only).
 *
 * Responsibilities today:
 *   - Negotiate a locale from the request (cookie -> Accept-Language).
 *   - Forward it to server components via `x-locale` request header.
 *   - Persist the user's effective locale in the `NEXT_LOCALE` cookie so
 *     subsequent requests stay stable.
 *
 * We do NOT prefix or rewrite URLs yet. When phase 2 turns on `tr`:
 *   1. LOCALES in src/lib/i18n/config.ts flips to ["en", "tr"].
 *   2. This middleware rewrites `/tr/*` → `/[locale]/*` and canonicalises
 *      unprefixed URLs to `en`.
 *   3. generateStaticParams on [locale] routes starts emitting both.
 *
 * Keeping the logic here means URLs stay stable through the transition.
 *
 * Routes the middleware skips:
 *   - /api/*            — API responses don't need locale negotiation.
 *   - /app/*            — authenticated dashboard is single-locale (en).
 *   - /_next, /static   — framework internals.
 *   - /*.{ico,png,jpg,…}— static assets.
 *
 * Matcher is defined below so the cost is near-zero on hot paths.
 */

const SKIP_PREFIXES = ["/api", "/app", "/_next", "/static"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
  const header = req.headers.get("accept-language");
  const resolved =
    cookieLocale && isSupportedLocale(cookieLocale)
      ? cookieLocale
      : negotiateLocale(header);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-locale", resolved);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (resolved !== cookieLocale) {
    res.cookies.set("NEXT_LOCALE", resolved, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: [
    // Exclude framework internals and asset requests; everything else
    // gets the locale header. The negative lookahead is the cheapest
    // way to exclude common static extensions at the edge.
    "/((?!api|app|_next|static|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)).*)",
  ],
};

// Re-export the canonical list so consumers of `middleware.ts` can
// inspect the compiled-in locale set without pulling `config.ts`.
export { LOCALES as SUPPORTED_LOCALES, DEFAULT_LOCALE };
