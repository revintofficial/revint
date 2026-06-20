import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/legal/terms",
  "/legal/privacy",
]);

const AUTH_ROUTES = new Set(["/login", "/signup"]);

/**
 * Return the cookie `domain` attribute that lets a Supabase auth cookie
 * issued on any `*.revint.dev` host be visible to its siblings
 * (`app.`, `admin.`, apex). Without this every subdomain would have its
 * own isolated session and post-login redirects between hosts would
 * dead-end in a `/login` loop.
 *
 * For localhost, Vercel previews, and any host outside the revint.dev
 * zone we return `undefined` so the browser falls back to host-only
 * cookies — those environments don't share a parent.
 */
function sharedCookieDomain(request: NextRequest): string | undefined {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0];
  if (!host) return undefined;
  if (host === "revint.dev" || host.endsWith(".revint.dev")) {
    return ".revint.dev";
  }
  return undefined;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cookieDomain = sharedCookieDomain(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const merged = cookieDomain
              ? { ...options, domain: cookieDomain }
              : options;
            response.cookies.set(name, value, merged);
          });
        },
      },
    }
  );

  // IMPORTANT: getUser() refreshes the session if needed; do not skip.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApp = pathname.startsWith("/app");
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const isPublic =
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/api/billing/webhook");

  // When getUser() refreshes/rotates the token, the new auth cookies were
  // written onto `response` via setAll() above. A bare NextResponse.redirect()
  // would drop those Set-Cookie headers, so the browser keeps its old (now
  // consumed) refresh token. The next hop then disagrees about whether the
  // user is logged in and the request bounces /login <-> /app/dashboard until
  // the browser aborts with ERR_TOO_MANY_REDIRECTS. Copy the cookies over so
  // every redirect carries the refreshed session.
  const redirectWithSession = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  };

  if (isApp && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithSession(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.search = "";
    return redirectWithSession(url);
  }

  void isPublic;
  return response;
}
