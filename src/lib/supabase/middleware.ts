import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set([
  "/",
  "/pricing",
  "/login",
  "/signup",
  "/legal/terms",
  "/legal/privacy",
]);

const AUTH_ROUTES = new Set(["/login", "/signup"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
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

  if (isApp && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  void isPublic;
  return response;
}
