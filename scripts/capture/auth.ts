/**
 * Bypass the email login flow for video capture.
 *
 * The Leadac AI app uses Supabase's PKCE / `@supabase/ssr` cookie flow,
 * which is incompatible with the implicit-grant magic link that
 * `auth.admin.generateLink` returns. Trying to navigate the browser
 * through the magic link drops the access token into a URL fragment
 * that the server-side middleware can't see.
 *
 * Workaround: do the OTP verification ourselves with the anon client to
 * obtain a real Supabase session, then write that session into the cookie
 * jar in the exact format `@supabase/ssr` writes it on real sign-in. The
 * app's middleware reads the cookie and the page loads as authenticated —
 * identical to what happens after a normal magic-link click.
 */
import { createClient } from "@supabase/supabase-js";
import type { Page } from "playwright";
import { requireEnv } from "./env-check";

export const TARGET_EMAIL = "meertseker@gmail.com";

interface SupabaseSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: unknown;
}

/**
 * Build the auth cookie value the way @supabase/ssr does for v0.10+.
 * It JSON-stringifies the session, base64-encodes it, and prefixes with
 * "base64-" so the server-side reader knows how to decode.
 */
function encodeSessionCookie(session: SupabaseSession): string {
  const json = JSON.stringify(session);
  const b64 = Buffer.from(json, "utf-8").toString("base64");
  return `base64-${b64}`;
}

/**
 * @supabase/ssr chunks the cookie if its base64 value > 3180 chars,
 * splitting it into `-token.0`, `-token.1`, etc. We mirror that limit
 * so we don't hit Vercel's 4096-byte per-cookie ceiling.
 */
const CHUNK_SIZE = 3180;

function chunkCookieValue(value: string): string[] {
  if (value.length <= CHUNK_SIZE) return [value];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    out.push(value.slice(i, i + CHUNK_SIZE));
  }
  return out;
}

export async function loginAsTarget(
  page: Page,
  redirectPath: string,
): Promise<void> {
  const env = requireEnv();
  const projectRef = new URL(env.supabaseUrl).hostname.split(".")[0];
  const cookieBaseName = `sb-${projectRef}-auth-token`;

  const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[auth] minting magic link for ${TARGET_EMAIL}`);
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TARGET_EMAIL,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkErr?.message ?? "no hashed_token"}`);
  }

  // Fetch the public anon key from env via NEXT_PUBLIC_SUPABASE_ANON_KEY.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");

  const anon = createClient(env.supabaseUrl, anonKey);

  console.log(`[auth] verifying OTP to obtain session...`);
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !verifyData?.session) {
    throw new Error(`verifyOtp failed: ${verifyErr?.message ?? "no session"}`);
  }

  const session = verifyData.session as SupabaseSession;
  console.log(`[auth] session acquired (expires in ${session.expires_in}s)`);

  const cookieValue = encodeSessionCookie(session);
  const chunks = chunkCookieValue(cookieValue);

  // Cookie domain — apex hostname of the app, with leading dot so subpaths match.
  const appUrl = new URL(env.appBaseUrl);
  const domain = appUrl.hostname;

  const cookies = chunks.map((chunk, i) => ({
    name: chunks.length === 1 ? cookieBaseName : `${cookieBaseName}.${i}`,
    value: chunk,
    domain,
    path: "/",
    httpOnly: false, // ssr writes httpOnly via Set-Cookie, but Playwright addCookies needs false to be readable by both
    secure: appUrl.protocol === "https:",
    sameSite: "Lax" as const,
    expires: session.expires_at,
  }));

  await page.context().addCookies(cookies);
  console.log(`[auth] injected ${cookies.length} cookie chunk(s) → ${domain}`);

  // Now navigate to the protected route. Middleware reads the cookie and serves
  // the authenticated page directly — no magic-link round trip.
  const target = new URL(redirectPath, env.appBaseUrl).toString();
  console.log(`[auth] navigating to ${target}`);
  await page.goto(target, { waitUntil: "domcontentloaded" });

  // Sanity: confirm we landed on the target, not bounced to /login.
  const finalUrl = page.url();
  if (finalUrl.includes("/login") || finalUrl.includes("/signup")) {
    throw new Error(
      `Auth bypass failed — landed on ${finalUrl} instead of ${target}. ` +
        `The cookie format may be wrong for this @supabase/ssr version.`,
    );
  }

  console.log(`[auth] logged in as ${TARGET_EMAIL}, on ${finalUrl}`);
}
