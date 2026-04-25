import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isSupportedLocale,
  negotiateLocale,
} from "@/lib/i18n/config";

/**
 * Next.js 16 "proxy" (formerly middleware).
 *
 * Responsibilities:
 *   1. Refresh Supabase auth cookies via updateSession() so server
 *      components always see a valid session.
 *   2. Negotiate a locale (cookie → Accept-Language) and forward it to
 *      downstream handlers via the `x-locale` request header. Persist
 *      the resolved locale in the `NEXT_LOCALE` cookie.
 *
 * Locale scaffolding ships EN-only (LOCALES = ["en"]); when phase 2
 * flips `LOCALES` to include "tr", this same proxy will start rewriting
 * `/tr/*` to `/[locale]/*`. For now it only sets the header so server
 * code can read the preferred locale without URL changes.
 *
 * Routes skipped for locale negotiation (but still auth-refreshed):
 *   - /api, /app, /_next, /static, static asset extensions.
 */

const LOCALE_SKIP_PREFIXES = ["/api", "/app", "/_next", "/static"];

export async function proxy(request: NextRequest) {
  const res = await updateSession(request);

  // Skip locale work on auth redirects — they're already terminal.
  const isRedirect = res.status >= 300 && res.status < 400;

  const { pathname } = request.nextUrl;
  const shouldNegotiate =
    !isRedirect &&
    !LOCALE_SKIP_PREFIXES.some((p) => pathname.startsWith(p));

  // Always forward the request pathname so server-component layouts can
  // read it via headers(). Used by the onboarding gate in app/app/layout.tsx
  // to distinguish /app/onboarding from other /app/* routes without a loop.
  res.headers.set("x-pathname", request.nextUrl.pathname);

  if (shouldNegotiate) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const resolved =
      cookieLocale && isSupportedLocale(cookieLocale)
        ? cookieLocale
        : negotiateLocale(request.headers.get("accept-language"));

    res.headers.set("x-locale", resolved);

    if (resolved !== cookieLocale) {
      res.cookies.set("NEXT_LOCALE", resolved, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Skip static files, _next, and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

export { LOCALES as SUPPORTED_LOCALES, DEFAULT_LOCALE };
