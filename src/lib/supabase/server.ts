import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * Mirror of `sharedCookieDomain` in supabase/middleware.ts. Both server
 * actions and the middleware must agree on the cookie domain or the
 * browser will end up with two parallel auth cookies (one host-only,
 * one `.revint.dev`-scoped) and the session will look invalid every
 * other request.
 */
async function sharedCookieDomain(): Promise<string | undefined> {
  try {
    const h = await headers();
    const host = h.get("host")?.toLowerCase().split(":")[0];
    if (!host) return undefined;
    if (host === "revint.dev" || host.endsWith(".revint.dev")) {
      return ".revint.dev";
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const cookieDomain = await sharedCookieDomain();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const merged = cookieDomain
                ? { ...options, domain: cookieDomain }
                : options;
              cookieStore.set(name, value, merged);
            });
          } catch {
            // Server Component — Supabase will refresh from middleware instead.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for trusted server operations (webhooks, admin tasks,
 * Stripe → DB sync). Never import in code that runs on the browser.
 */
export function createSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
