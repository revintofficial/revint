import { NextResponse, type NextRequest } from "next/server";
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
 *   1. Enforce the subdomain boundary (apex marketing / app. product /
 *      admin. internal) so each host only serves its own surface.
 *   2. Refresh Supabase auth cookies via updateSession() so server
 *      components always see a valid session.
 *   3. Negotiate a locale (cookie → Accept-Language) and forward it to
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

// -----------------------------------------------------------------------
// Subdomain boundary
// -----------------------------------------------------------------------

type HostMode = "marketing" | "app" | "admin" | "unbounded";

const APP_HOST_SUFFIX = "app.revint.dev";
const ADMIN_HOST_SUFFIX = "admin.revint.dev";
const APEX_HOST_SUFFIX = "revint.dev";

/**
 * Classify the incoming Host header so the boundary check knows which
 * surface this request is allowed to touch.
 *
 * `unbounded` means "no subdomain enforcement" — used for localhost,
 * Vercel preview URLs (`*.vercel.app`), and any host that does not end
 * in `revint.dev`. Those environments serve every route from a single
 * origin and would otherwise redirect-loop.
 *
 * The check uses suffix matching (not equality) so `www.app.revint.dev`
 * or future regional subdomains don't fall through silently.
 */
function classifyHost(host: string | null): HostMode {
  if (process.env.SUBDOMAIN_ROUTING_DISABLED === "true") return "unbounded";
  if (!host) return "unbounded";
  const lower = host.toLowerCase().split(":")[0];
  if (lower === "localhost" || lower === "127.0.0.1" || lower.endsWith(".local")) {
    return "unbounded";
  }
  if (lower.endsWith(".vercel.app")) return "unbounded";
  if (lower === ADMIN_HOST_SUFFIX || lower.endsWith("." + ADMIN_HOST_SUFFIX)) {
    return "admin";
  }
  if (lower === APP_HOST_SUFFIX || lower.endsWith("." + APP_HOST_SUFFIX)) {
    return "app";
  }
  if (lower === APEX_HOST_SUFFIX || lower === "www." + APEX_HOST_SUFFIX) {
    return "marketing";
  }
  // Any other host (custom domain, staging, etc.) gets the apex behaviour
  // so we never accidentally lock people out behind a redirect loop.
  return "unbounded";
}

/**
 * Compose a redirect target on a sibling subdomain. Preserves path,
 * query string, and hash. Always emits HTTPS — these subdomains are
 * production-only.
 */
function redirectToHost(
  request: NextRequest,
  targetHost: string,
  pathOverride?: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = targetHost;
  url.port = "";
  if (pathOverride !== undefined) url.pathname = pathOverride;
  // 308 preserves the HTTP method, so a POST that hit the wrong host
  // (rare but possible for webhooks pointed at the old domain) still
  // lands on the right surface instead of being downgraded to a GET.
  return NextResponse.redirect(url, 308);
}

/**
 * Apply the host -> path boundary. Returns null when the request is
 * allowed to proceed; otherwise returns the redirect/404 response.
 *
 * Allowlist per mode:
 *   - app.    → `/app/*`, `/api/*`, `/auth/*`, `/m/*`
 *   - admin.  → `/admin/*`, `/api/*`, `/auth/*`
 *   - apex    → everything except `/app/*` and `/admin/*` (those redirect
 *               to their subdomains so old bookmarks keep working)
 *
 * `/api/*`, `/auth/*`, `/_next/*`, static assets, `/m/*` (public mockup
 * viewer), `/login`, `/signup`, and `/legal/*` are accepted on every
 * host. The first batch is required so external integrations (Stripe /
 * HubSpot / Apify webhooks, Supabase auth callbacks, cold-email mockup
 * links) keep working regardless of which subdomain they were configured
 * against during the rename window. The auth/legal batch keeps session
 * cookies bound to a single subdomain (cookies are scoped to
 * `.revint.dev` so siblings see each other's session).
 */
function enforceHostBoundary(
  request: NextRequest,
  mode: HostMode,
): NextResponse | null {
  if (mode === "unbounded") return null;
  const { pathname } = request.nextUrl;

  // Always-allowed prefixes — these MUST work on every host.
  // Auth pages (/login, /signup, /auth/*, /legal/*) intentionally serve
  // from whichever host the user reached them on: cookies are scoped to
  // `.revint.dev` (see supabase/middleware.ts) so the session set on any
  // subdomain is visible to every other one. Without this allow-listing
  // we'd bounce app.revint.dev/login → revint.dev/login, the user would
  // log in on the apex, then on the post-login redirect to
  // app.revint.dev/app/dashboard the new host would see no cookie and
  // send them back to /login → infinite loop.
  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/m/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/legal/")
  ) {
    return null;
  }

  if (mode === "app") {
    if (pathname.startsWith("/app/") || pathname === "/app") return null;
    if (pathname.startsWith("/admin/") || pathname === "/admin") {
      return redirectToHost(request, ADMIN_HOST_SUFFIX);
    }
    // `app.revint.dev/` → app root. Send to dashboard (or login if no
    // session — the supabase middleware handles that next).
    if (pathname === "/") {
      return redirectToHost(request, APP_HOST_SUFFIX, "/app/dashboard");
    }
    // Marketing path on the app host. Send the user to apex so SEO
    // pages aren't duplicated under two origins.
    return redirectToHost(request, APEX_HOST_SUFFIX);
  }

  if (mode === "admin") {
    if (pathname.startsWith("/admin/") || pathname === "/admin") return null;
    if (pathname.startsWith("/app/") || pathname === "/app") {
      return redirectToHost(request, APP_HOST_SUFFIX);
    }
    if (pathname === "/") {
      return redirectToHost(request, ADMIN_HOST_SUFFIX, "/admin");
    }
    return redirectToHost(request, APEX_HOST_SUFFIX);
  }

  // mode === "marketing" (apex)
  if (pathname.startsWith("/app/") || pathname === "/app") {
    return redirectToHost(request, APP_HOST_SUFFIX);
  }
  if (pathname.startsWith("/admin/") || pathname === "/admin") {
    return redirectToHost(request, ADMIN_HOST_SUFFIX);
  }
  return null;
}

/**
 * Pre-launch site gate (TEMPORARY — remove at launch).
 *
 * The public marketing site is password-protected with HTTP Basic Auth so only
 * the team can preview it before launch. Any username works; the password is
 * `SITE_GATE_PASSWORD` (defaults to "revint-preview"). To open the site to
 * the public, set `SITE_GATE_DISABLED=true` (or delete this block).
 *
 * Skips the product app (/app — its own Supabase auth), API routes, auth
 * pages, and login/signup so nothing internal breaks behind the gate.
 */
const GATE_SKIP_PREFIXES = ["/api", "/app", "/auth", "/_next", "/static"];
const GATE_SKIP_EXACT = new Set(["/login", "/signup"]);

function gateRequired(pathname: string): boolean {
  if (process.env.SITE_GATE_DISABLED === "true") return false;
  if (GATE_SKIP_EXACT.has(pathname)) return false;
  return !GATE_SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

function gateAuthorized(request: NextRequest): boolean {
  const expected = process.env.SITE_GATE_PASSWORD || "revint-preview";
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const provided = decoded.slice(decoded.indexOf(":") + 1);
    return provided === expected;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  // 1. Host boundary — `app.` only serves /app, `admin.` only /admin,
  //    apex marketing routes never include /app or /admin. Runs before
  //    everything else so cross-host redirects are cheap (no DB hits,
  //    no Supabase round-trips).
  const mode = classifyHost(request.headers.get("host"));
  const boundary = enforceHostBoundary(request, mode);
  if (boundary) return boundary;

  // 2. Pre-launch gate — only enforced on the apex marketing host.
  //    `app.` and `admin.` carry their own auth (Supabase + admin
  //    allowlist); gating them would double-prompt customers.
  if (
    mode !== "app" &&
    mode !== "admin" &&
    gateRequired(request.nextUrl.pathname) &&
    !gateAuthorized(request)
  ) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Revint private preview"',
      },
    });
  }

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
        // M16 - mark Secure in production. The locale cookie is
        // low-sensitivity but every Set-Cookie we emit should
        // carry the same hardening profile so a future locale-aware
        // server action can't be hijacked over plaintext HTTP.
        secure: process.env.NODE_ENV === "production",
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
