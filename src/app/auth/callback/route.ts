import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/app/dashboard");

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // L8 - never echo Supabase's raw error message into the URL.
      // It's user-visible (browser address bar, referer header on
      // the login page's outbound requests) and historically has
      // included project refs, role hints, and JWT validation
      // strings. Use an opaque code in the URL and log the real
      // detail server-side under a greppable scope.
      logger.warn("auth.callback.exchange_failed", {
        err: error.message,
        status: error.status,
      });
      const errUrl = new URL("/login", url.origin);
      errUrl.searchParams.set("error", "oauth_failed");
      return NextResponse.redirect(errUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
